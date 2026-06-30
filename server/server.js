const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: ["http://localhost:3000", "http://127.0.0.1:3000"],
    methods: ["GET", "POST"],
  },
});

// ─── In-Memory State ──────────────────────────────────────────────────────────
// sessions: Map<sessionId, { patientSocket, doctorSocket, messages[] }>
const sessions = new Map();
// waitingPatients: Map<socketId, { sessionId, name }>
const waitingPatients = new Map();
// connectedDoctors: Set<socketId>
const connectedDoctors = new Set();

// ─── REST Endpoints ───────────────────────────────────────────────────────────
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    activeSessions: sessions.size,
    waitingPatients: waitingPatients.size,
    connectedDoctors: connectedDoctors.size,
  });
});

app.get("/sessions", (req, res) => {
  const list = [];
  waitingPatients.forEach((info, socketId) => {
    list.push({ socketId, ...info, status: "waiting" });
  });
  sessions.forEach((session, sessionId) => {
    list.push({
      sessionId,
      hasDoctor: !!session.doctorSocketId,
      messageCount: session.messages.length,
      status: session.doctorSocketId ? "active" : "waiting",
    });
  });
  res.json(list);
});

// ─── Socket Events ────────────────────────────────────────────────────────────
io.on("connection", (socket) => {
  console.log(`[+] Connected: ${socket.id}`);

  // ── Patient joins queue ──────────────────────────────────────────────────
  socket.on("patient:join", ({ sessionId, patientName }) => {
    const sid = sessionId || `session_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

    sessions.set(sid, {
      sessionId: sid,
      patientSocketId: socket.id,
      doctorSocketId: null,
      patientName: patientName || "Anonymous",
      messages: [],
      createdAt: new Date().toISOString(),
    });

    waitingPatients.set(socket.id, { sessionId: sid, name: patientName || "Anonymous" });
    socket.join(sid);
    socket.emit("session:created", { sessionId: sid });

    // Notify all doctors of the new patient
    connectedDoctors.forEach((docSocketId) => {
      io.to(docSocketId).emit("patient:waiting", {
        sessionId: sid,
        patientName: patientName || "Anonymous",
        createdAt: new Date().toISOString(),
      });
    });

    console.log(`[Patient] ${patientName || "Anonymous"} waiting in session ${sid}`);
  });

  // ── Doctor joins ─────────────────────────────────────────────────────────
  socket.on("doctor:join", ({ doctorName }) => {
    connectedDoctors.add(socket.id);
    socket.emit("doctor:registered", { doctorName });

    // Send current waiting patients
    const waiting = [];
    sessions.forEach((session, sessionId) => {
      if (!session.doctorSocketId) {
        waiting.push({
          sessionId,
          patientName: session.patientName,
          createdAt: session.createdAt,
        });
      }
    });
    socket.emit("waiting:list", waiting);
    console.log(`[Doctor] ${doctorName || "Doctor"} connected`);
  });

  // ── Doctor accepts a patient session ─────────────────────────────────────
  socket.on("doctor:accept", ({ sessionId }) => {
    const session = sessions.get(sessionId);
    if (!session) {
      socket.emit("error", { message: "Session not found" });
      return;
    }
    if (session.doctorSocketId) {
      socket.emit("error", { message: "Session already claimed by another doctor" });
      return;
    }

    session.doctorSocketId = socket.id;
    socket.join(sessionId);

    // Remove from waiting
    waitingPatients.delete(session.patientSocketId);

    // Notify patient
    io.to(session.patientSocketId).emit("doctor:joined", {
      sessionId,
      message: "A doctor has joined your session.",
    });

    // Confirm to doctor
    socket.emit("session:joined", {
      sessionId,
      patientName: session.patientName,
      history: session.messages,
    });

    // Broadcast updated waiting list to all doctors
    broadcastWaitingList();

    console.log(`[Doctor] accepted session ${sessionId}`);
  });

  // ── Chat messages ─────────────────────────────────────────────────────────
  socket.on("message:send", ({ sessionId, content, role }) => {
    const session = sessions.get(sessionId);
    if (!session) return;

    const msg = {
      id: `msg_${Date.now()}`,
      content,
      role: role || "patient",
      timestamp: new Date().toISOString(),
    };

    session.messages.push(msg);
    // Broadcast to everyone in the room (patient + doctor)
    io.to(sessionId).emit("message:received", msg);
  });

  // ── Typing indicator ──────────────────────────────────────────────────────
  socket.on("typing:start", ({ sessionId, role }) => {
    socket.to(sessionId).emit("typing:start", { role });
  });

  socket.on("typing:stop", ({ sessionId, role }) => {
    socket.to(sessionId).emit("typing:stop", { role });
  });

  // ── Disconnect ────────────────────────────────────────────────────────────
  socket.on("disconnect", () => {
    console.log(`[-] Disconnected: ${socket.id}`);

    // If a doctor disconnected
    if (connectedDoctors.has(socket.id)) {
      connectedDoctors.delete(socket.id);
      // Notify patients in their sessions
      sessions.forEach((session) => {
        if (session.doctorSocketId === socket.id) {
          session.doctorSocketId = null;
          io.to(session.patientSocketId).emit("doctor:left", {
            message: "The doctor has disconnected. Please wait for another doctor.",
          });
        }
      });
    }

    // If a patient disconnected
    if (waitingPatients.has(socket.id)) {
      const { sessionId } = waitingPatients.get(socket.id);
      waitingPatients.delete(socket.id);
      sessions.delete(sessionId);
      broadcastWaitingList();
    } else {
      // Check if they were in an active session
      sessions.forEach((session, sessionId) => {
        if (session.patientSocketId === socket.id) {
          if (session.doctorSocketId) {
            io.to(session.doctorSocketId).emit("patient:left", { sessionId });
          }
          sessions.delete(sessionId);
          broadcastWaitingList();
        }
      });
    }
  });
});

// ─── Helpers ──────────────────────────────────────────────────────────────────
function broadcastWaitingList() {
  const waiting = [];
  sessions.forEach((session, sessionId) => {
    if (!session.doctorSocketId) {
      waiting.push({
        sessionId,
        patientName: session.patientName,
        createdAt: session.createdAt,
      });
    }
  });
  connectedDoctors.forEach((docSocketId) => {
    io.to(docSocketId).emit("waiting:list", waiting);
  });
}

// ─── Start Server ─────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`✅ CURA AI Socket Server running on http://localhost:${PORT}`);
});
