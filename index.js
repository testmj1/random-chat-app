// index.js
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, "public")));

// separate queues
let waitingVideo = null;
let waitingText = null;

function pair(a, b, mode) {
  const room = a.id + "#" + b.id;
  a.join(room);
  b.join(room);
  a.emit("paired", { partnerId: b.id, mode, room });
  b.emit("paired", { partnerId: a.id, mode, room });
  console.log(`Paired (${mode}): ${a.id} <-> ${b.id} in room ${room}`);
}

io.on("connection", (socket) => {
  console.log("connected:", socket.id);

  // join queue
  socket.on("join", (mode) => {
    socket.mode = mode;

    if (mode === "video") {
      if (!waitingVideo) {
        waitingVideo = socket;
        socket.emit("waiting");
      } else if (waitingVideo.id !== socket.id) {
        pair(waitingVideo, socket, "video");
        waitingVideo = null;
      }
    } else if (mode === "text") {
      if (!waitingText) {
        waitingText = socket;
        socket.emit("waiting");
      } else if (waitingText.id !== socket.id) {
        pair(waitingText, socket, "text");
        waitingText = null;
      }
    }
  });

  // relay WebRTC signals
  socket.on("signal", ({ to, data }) => {
    io.to(to).emit("signal", { from: socket.id, data });
  });

  // relay text chat
  socket.on("chat", ({ room, message }) => {
    socket.to(room).emit("chat", { from: socket.id, message });
  });

  // next
  socket.on("next", () => {
    const rooms = Array.from(socket.rooms).filter((r) => r !== socket.id);
    rooms.forEach((r) => socket.to(r).emit("partner-left"));
    rooms.forEach((r) => socket.leave(r));

    if (socket.mode === "video") {
      if (!waitingVideo) {
        waitingVideo = socket;
        socket.emit("waiting");
      } else if (waitingVideo.id !== socket.id) {
        pair(waitingVideo, socket, "video");
        waitingVideo = null;
      }
    } else if (socket.mode === "text") {
      if (!waitingText) {
        waitingText = socket;
        socket.emit("waiting");
      } else if (waitingText.id !== socket.id) {
        pair(waitingText, socket, "text");
        waitingText = null;
      }
    }
  });

  socket.on("disconnect", () => {
    console.log("disconnected:", socket.id);
    if (waitingVideo && waitingVideo.id === socket.id) waitingVideo = null;
    if (waitingText && waitingText.id === socket.id) waitingText = null;

    const rooms = Array.from(socket.rooms).filter((r) => r !== socket.id);
    rooms.forEach((r) => socket.to(r).emit("partner-left"));
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log("Server running on port", PORT));
