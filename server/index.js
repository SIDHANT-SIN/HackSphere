import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import connectDB from './config/db.js';
import http from 'http';
import { Server } from 'socket.io';

dotenv.config();
connectDB();

const app = express();
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static('uploads'));
// Routes
import fileRoutes from './routes/fileRoutes.js';
app.use('/', fileRoutes);
import roomRoutes from './routes/roomRoutes.js';
app.use('/', roomRoutes);

app.get('/', (req, res) => {
  res.send('Hackathon backend is running!');
});

// Create HTTP server and attach Socket.IO
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: 'http://localhost:5173',
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// Make io accessible in routes (like file upload notifications)
app.set('io', io);

// Import and initialize socket handlers
import initSocketHandlers from './socket/socketHandler.js';
initSocketHandlers(io);  // 👈 pass io to your handlers

// Start the server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
