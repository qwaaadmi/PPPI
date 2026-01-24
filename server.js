const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const cors = require("cors");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*"
    }
});

app.use(cors());
app.use(express.json());
app.use(express.static("public"));

const JWT_SECRET = "super_secret_key";

/* =========================
   🧠 Тимчасова БД (без Mongo)
========================= */
const users = [];

/* =========================
   🎵 Список пісень
========================= */
const songs = [
    { id: 1, title: "Song One", url: "/songs/song1.mp3" },
    { id: 2, title: "Song Two", url: "/songs/song2.mp3" },
    { id: 3, title: "Song Three", url: "/songs/song3.mp3" }
];

/* =========================
   TEST
========================= */
app.get("/", (req, res) => {
    res.send("🎤 Karaoke backend is running");
});

/* =========================
   SONGS API
========================= */
app.get("/api/songs", (req, res) => {
    res.json(songs);
});

/* =========================
   REGISTER
========================= */
app.post("/api/register", async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.json({ message: "Заповни всі поля" });
    }

    const exists = users.find(u => u.username === username);
    if (exists) {
        return res.json({ message: "Користувач вже існує" });
    }

    const hash = await bcrypt.hash(password, 10);
    users.push({ username, password: hash });

    res.json({ message: "Реєстрація успішна" });
});

/* =========================
   LOGIN
========================= */
app.post("/api/login", async (req, res) => {
    const { username, password } = req.body;

    const user = users.find(u => u.username === username);
    if (!user) {
        return res.json({ message: "Користувача не знайдено" });
    }

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) {
        return res.json({ message: "Невірний пароль" });
    }

    const token = jwt.sign({ username }, JWT_SECRET, { expiresIn: "2h" });
    res.json({ token });
});

/* =========================
   🔐 SOCKET AUTH
========================= */
io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) {
        return next(new Error("No token"));
    }

    try {
        const user = jwt.verify(token, JWT_SECRET);
        socket.user = user;
        next();
    } catch (err) {
        return next(new Error("Invalid token"));
    }
});

/* =========================
   🎤 SOCKET ROOMS + KARAOKE
========================= */
io.on("connection", socket => {
    console.log("🎤 Connected:", socket.user.username);

    // Надсилаємо список пісень одразу після підключення
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

/* =========================
   START SERVER
========================= */
const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
    console.log("🎤 Karaoke backend ready on port", PORT);
});
