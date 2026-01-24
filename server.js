import express from "express";
import http from "http";

const app = express();
const server = http.createServer(app);

app.get("/", (req, res) => {
  res.send("Server is working!");
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log("Server running on port", PORT);
});
