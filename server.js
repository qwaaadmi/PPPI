import express from "express";
import http from "http";
import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import cors from "cors";

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" }
});

app.use(cors());
app.use(express.json());
app.use(express.static("public"));

const JWT_SECRET = "super_secret_key";

// Тимчасова БД (поки без MongoDB)
const users = [];

// Список пісень караоке
const songs = [
  { id: 1, title: "Song One", url: "/songs/song1.mp3" },
  { id: 2, title: "Song Two", url: "/songs/song2.mp3" },
  { id: 3, title: "Song Three", url: "/songs/song3.mp3" }
];

// Тест
app.get("/", (req, res) => {
  res.send("🎤 Karaoke Server is working!");
});

// Отримати список пісень
app.get("/api/songs", (req, res) => {
  res.json(songs);
});

// Реєстрація
app.post("/api/register", async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password)
    return res.json({ message: "Fill all fields" });

  const exists = users.find(u => u.username === username);
  if (exists)
    return res.json({ message: "User already exists" });

  const hash = await bcrypt.hash(password, 10);
  users.push({ username, password: hash });

  res.json({ message: "Registered successfully" });
});

// Логін
app.post("/api/login", async (req, res) => {
  const { username, password } = req.body;

  const user = users.find(u => u.username === username);
  if (!user)
    return res.json({ message: "User not found" });

  const ok = await bcrypt.compare(password, user.password);
  if (!ok)
    return res.json({ message: "Wrong password" });

  const token = jwt.sign({ username }, JWT_SECRET, { expiresIn: "2h" });
  res.json({ token });
});

// 🔐 Авторизація сокетів
io.use((socket, next) => {
  try {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error("No token"));

    const user = jwt.verify(token, JWT_SECRET);
    socket.user = user;
    next();
  } catch {
    next(new Error("Invalid token"));
  }
});

// 🎤 Socket логіка
io.on("connection", socket => {
  console.log("🎤 Connected:", socket.user.username);

  // Надсилаємо список пісень при підключенні
  socket.emit("songsList", songs);

  socket.on("joinRoom", room => {
    socket.join(room);
    console.log(`${socket.user.username} joined room ${room}`);
  });

  socket.on("playSong", data => {
    // data = { room, songId }
    const song = songs.find(s => s.id === data.songId);
    if (!song) return;

    io.to(data.room).emit("playSong", song);
  });

  socket.on("disconnect", () => {
    console.log("👋 Disconnected:", socket.user.username);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log("🎤 Karaoke server running on port", PORT);
});
