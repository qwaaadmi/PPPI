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

const JWT_SECRET = "super_secret_key";

// тимчасова БД в памʼяті
const users = [];

// тестовий маршрут
app.get("/", (req, res) => {
  res.send("Server with Auth is working!");
});

// реєстрація
app.post("/api/register", async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.json({ message: "Fill all fields" });
  }

  const exists = users.find(u => u.username === username);
  if (exists) {
    return res.json({ message: "User already exists" });
  }

  const hash = await bcrypt.hash(password, 10);
  users.push({ username, password: hash });

  res.json({ message: "Registered successfully" });
});

// логін
app.post("/api/login", async (req, res) => {
  const { username, password } = req.body;

  const user = users.find(u => u.username === username);
  if (!user) {
    return res.json({ message: "User not found" });
  }

  const ok = await bcrypt.compare(password, user.password);
  if (!ok) {
    return res.json({ message: "Wrong password" });
  }

  const token = jwt.sign({ username }, JWT_SECRET, { expiresIn: "1h" });
  res.json({ token });
});

// Socket.IO без auth поки
io.on("connection", socket => {
  console.log("Client connected:", socket.id);
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log("Server running on port", PORT);
});
