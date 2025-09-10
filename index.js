// index.js
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, "public")));

let waitingVideo = null;
let waitingText = null;

io.on("connection", (socket) => {
  console.log("connected:", socket.id);

  // --- JOIN ---
  socket.on("join", (mode) => {
    if (mode === "video") {
      if (!waitingVideo) {
        waitingVideo = socket;
        socket.mode = "video";
        socket.emit("waiting");
      } else if (waitingVideo.id !== socket.id) {
        const partner = waitingVideo;
        waitingVideo = null;
        const room = socket.id + "#" + partner.id;
        socket.join(room);
        partner.join(room);
        socket.emit("paired", { partnerId: partner.id, mode, room });
        partner.emit("paired", { partnerId: socket.id, mode, room });
      }
    } else if (mode === "text") {
      if (!waitingText) {
        waitingText = socket;
        socket.mode = "text";
        socket.emit("waiting");
      } else if (waitingText.id !== socket.id) {
        const partner = waitingText;
        waitingText = null;
        const room = socket.id + "#" + partner.id;
        socket.join(room);
        partner.join(room);
        socket.emit("paired", { partnerId: partner.id, mode, room });
        partner.emit("paired", { partnerId: socket.id, mode, room });
      }
    }
  });

  // --- NEXT ---
  socket.on("next", () => {
    const mode = socket.mode;
    if (!mode) return;

    const rooms = [...socket.rooms].filter((r) => r !== socket.id);
    rooms.forEach((r) => socket.leave(r));
    io.to(rooms).emit("partner-left");

    if (mode === "video") {
      if (!waitingVideo) {
        waitingVideo = socket;
        socket.emit("waiting");
      } else if (waitingVideo.id !== socket.id) {
        const partner = waitingVideo;
        waitingVideo = null;
        const room = socket.id + "#" + partner.id;
        socket.join(room);
        partner.join(room);
        socket.emit("paired", { partnerId: partner.id, mode, room });
        partner.emit("paired", { partnerId: socket.id, mode, room });
      }
    } else if (mode === "text") {
      if (!waitingText) {
        waitingText = socket;
        socket.emit("waiting");
      } else if (waitingText.id !== socket.id) {
        const partner = waitingText;
        waitingText = null;
        const room = socket.id + "#" + partner.id;
        socket.join(room);
        partner.join(room);
        socket.emit("paired", { partnerId: partner.id, mode, room });
        partner.emit("paired", { partnerId: socket.id, mode, room });
      }
    }
  });

  // --- CHAT ---
  socket.on("chat", ({ room, message }) => {
    io.to(room).emit("chat", { from: socket.id, message });
  });

  // --- SIGNAL (WebRTC) ---
  socket.on("signal", ({ to, data }) => {
    io.to(to).emit("signal", { from: socket.id, data });
  });

  // --- DISCONNECT ---
  socket.on("disconnect", () => {
    if (waitingVideo && waitingVideo.id === socket.id) waitingVideo = null;
    if (waitingText && waitingText.id === socket.id) waitingText = null;

    const rooms = [...socket.rooms].filter((r) => r !== socket.id);
    rooms.forEach((r) => {
      io.to(r).emit("partner-left");
    });
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log("Server running on port", PORT));
