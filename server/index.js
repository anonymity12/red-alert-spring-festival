const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

// Game rooms management
const gameRooms = new Map();

io.on('connection', (socket) => {
  console.log('Player connected:', socket.id);

  // Create or join a game room
  socket.on('findGame', () => {
    let roomId = null;

    // Find an available room
    for (const [id, room] of gameRooms.entries()) {
      if (room.players.length === 1) {
        roomId = id;
        break;
      }
    }

    // Create new room if none available
    if (!roomId) {
      roomId = `room_${Date.now()}`;
      gameRooms.set(roomId, {
        players: [],
        gameState: null
      });
    }

    const room = gameRooms.get(roomId);
    room.players.push(socket.id);
    socket.join(roomId);
    socket.roomId = roomId;

    // Assign player side
    const playerSide = room.players.length === 1 ? 'player1' : 'player2';
    socket.emit('gameJoined', { roomId, playerSide });

    // Start game if we have 2 players
    if (room.players.length === 2) {
      io.to(roomId).emit('gameStart');
    }

    console.log(`Player ${socket.id} joined room ${roomId} as ${playerSide}`);
  });

  // Handle game actions
  socket.on('gameAction', (action) => {
    if (socket.roomId) {
      // Broadcast action to other players in the room
      socket.to(socket.roomId).emit('gameAction', action);
    }
  });

  // Handle game state sync
  socket.on('syncGameState', (gameState) => {
    if (socket.roomId) {
      const room = gameRooms.get(socket.roomId);
      if (room) {
        room.gameState = gameState;
        socket.to(socket.roomId).emit('gameStateUpdate', gameState);
      }
    }
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    console.log('Player disconnected:', socket.id);
    
    if (socket.roomId) {
      const room = gameRooms.get(socket.roomId);
      if (room) {
        room.players = room.players.filter(id => id !== socket.id);
        
        // Notify other players
        socket.to(socket.roomId).emit('playerLeft');
        
        // Remove empty rooms
        if (room.players.length === 0) {
          gameRooms.delete(socket.roomId);
        }
      }
    }
  });
});

const PORT = process.env.PORT || 3001;

server.listen(PORT, () => {
  console.log(`Game server running on port ${PORT}`);
});
