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
   🧠 Тимчасова БД
========================= */
const users = [];

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
   SOCKET AUTH
========================= */
io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error("No token"));

    try {
        const user = jwt.verify(token, JWT_SECRET);
        socket.user = user;
        next();
    } catch {
        next(new Error("Invalid token"));
    }
});

/* =========================
   SOCKET ROOMS
========================= */
io.on("connection", socket => {
    console.log("🎤 Connected:", socket.user.username);

    socket.on("joinRoom", room => {
        socket.join(room);
        console.log(`${socket.user.username} joined room ${room}`);
        io.to(room).emit("systemMessage", `${socket.user.username} увійшов у кімнату`);
    });

    socket.on("playSong", data => {
        // data = { room, index }
        io.to(data.room).emit("playSong", data.index);
    });

    socket.on("disconnect", () => {
        console.log("👋 Disconnected:", socket.user.username);
    });
});

/* =========================
   TEST ROUTE
========================= */
app.get("/", (req, res) => {
    res.send("🎤 Karaoke backend is running");
});

/* =========================
   START
========================= */
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log("🎤 Karaoke backend ready on port", PORT);
});
