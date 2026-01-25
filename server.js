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
        origin: "*",
        methods: ["GET", "POST"]
    }
});

app.use(cors());
app.use(express.json());
app.use(express.static("public"));

const JWT_SECRET = "super_secret_key";
const users = [];
const rooms = {};

// REGISTER
app.post("/api/register", async (req, res) => {
    try {
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
    } catch (error) {
        console.error("Register error:", error);
        res.status(500).json({ message: "Помилка сервера" });
    }
});

// LOGIN
app.post("/api/login", async (req, res) => {
    try {
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
    } catch (error) {
        console.error("Login error:", error);
        res.status(500).json({ message: "Помилка сервера" });
    }
});

// SOCKET AUTH
io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) {
        return next(new Error("No token"));
    }
    
    try {
        const user = jwt.verify(token, JWT_SECRET);
        socket.user = user;
        next();
    } catch (error) {
        next(new Error("Invalid token"));
    }
});

// SOCKET
io.on("connection", (socket) => {
    console.log("Connected:", socket.user.username);
    
    socket.on("joinRoom", (roomName) => {
        socket.join(roomName);
        socket.currentRoom = roomName;
        
        // Створюємо кімнату
        if (!rooms[roomName]) {
            rooms[roomName] = { users: [] };
        }
        
        // Додаємо користувача
        rooms[roomName].users.push({
            id: socket.id,
            username: socket.user.username
        });
        
        console.log(socket.user.username + " joined " + roomName);
        
        // Відправляємо список всім
        io.to(roomName).emit("roomUsers", rooms[roomName].users);
        io.to(roomName).emit("systemMessage", socket.user.username + " увійшов");
    });
    
    socket.on("playSong", (data) => {
        console.log("Play song:", data.index, "in room:", data.room);
        io.to(data.room).emit("playSong", { index: data.index });
    });
    
    socket.on("disconnect", () => {
        console.log("Disconnected:", socket.user.username);
        
        if (socket.currentRoom && rooms[socket.currentRoom]) {
            // Видаляємо користувача
            rooms[socket.currentRoom].users = rooms[socket.currentRoom].users.filter(
                u => u.id !== socket.id
            );
            
            // Оновлюємо список
            io.to(socket.currentRoom).emit("roomUsers", rooms[socket.currentRoom].users);
            io.to(socket.currentRoom).emit("systemMessage", socket.user.username + " вийшов");
            
            // Видаляємо порожню кімнату
            if (rooms[socket.currentRoom].users.length === 0) {
                delete rooms[socket.currentRoom];
            }
        }
    });
});

app.get("/", (req, res) => {
    res.send("🎤 Karaoke server running");
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log("Server on port " + PORT);
});
