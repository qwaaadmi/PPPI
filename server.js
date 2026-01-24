import express from "express";
import http from "http";
import { Server } from "socket.io";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// статичні файли
app.use(express.static(path.join(__dirname, "public")));

// головна сторінка
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(cors());
app.use(express.json());

/* ====== DB ====== */
mongoose.connect(process.env.MONGO_URI);

/* ====== MODELS ====== */
const User = mongoose.model("User", new mongoose.Schema({
  username: String,
  email: { type: String, unique: true },
  password: String
}));

const Room = mongoose.model("Room", new mongoose.Schema({
  code: String,
  host: String,
  currentSong: Number
}));

/* ====== AUTH ====== */
app.post("/auth/register", async (req, res) => {
  const { username, email, password } = req.body;
  const hash = await bcrypt.hash(password, 10);
  await User.create({ username, email, password: hash });
  res.json({ ok: true });
});

app.post("/auth/login", async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email });
  if (!user) return res.sendStatus(401);

  const ok = await bcrypt.compare(password, user.password);
  if (!ok) return res.sendStatus(401);

  const token = jwt.sign({ username: user.username }, process.env.JWT_SECRET);
  res.json({ token });
});

/* ====== SOCKET AUTH ====== */
io.use((socket, next) => {
  try {
    socket.user = jwt.verify(socket.handshake.auth.token, process.env.JWT_SECRET);
    next();
  } catch {
    next(new Error("Unauthorized"));
  }
});

/* ====== SOCKET LOGIC ====== */
io.on("connection", socket => {

  socket.on("joinRoom", async ({ code }) => {
    socket.join(code);
    socket.room = code;

    let room = await Room.findOne({ code });
    if (!room) {
      room = await Room.create({
        code,
        host: socket.user.username,
        currentSong: null
      });
    }

    io.to(code).emit("userJoined", socket.user.username);
    if (room.currentSong !== null)
      socket.emit("playSong", room.currentSong);
  });

  socket.on("changeSong", async ({ code, songIndex }) => {
    await Room.updateOne({ code }, { currentSong: songIndex });
    io.to(code).emit("playSong", songIndex);
  });

  socket.on("playerStateChange", ({ state }) => {
    io.to(socket.room).emit("syncState", state);
  });

});

server.listen(3000, () => console.log("🎤 Karaoke backend ready"));

