const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

const rooms = {};

io.on('connection', (socket) => {
    socket.on('joinRoom', ({ username, room }) => {
        socket.join(room);
        if (!rooms[room]) {
            rooms[room] = { users: [], currentSongIndex: null, isPlaying: false };
        }
        rooms[room].users.push(username);
        
        io.to(room).emit('updateUsers', rooms[room].users);

        // Якщо пісня вже грає - підключаємо новачка
        if (rooms[room].currentSongIndex !== null) {
            socket.emit('syncSong', { 
                songIndex: rooms[room].currentSongIndex, 
                isPlaying: rooms[room].isPlaying 
            });
        }
    });

    // Зміна пісні (тепер передаємо індекс зі списку)
    socket.on('changeSong', ({ room, songIndex }) => {
        if (rooms[room]) {
            rooms[room].currentSongIndex = songIndex;
            io.to(room).emit('playSong', songIndex);
        }
    });

    // Пауза / Старт
    socket.on('playerStateChange', ({ room, state }) => {
        socket.to(room).emit('syncState', state);
    });
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
    console.log(`Сервер працює на порті ${PORT}`);
});
