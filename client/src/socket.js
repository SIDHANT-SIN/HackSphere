import { io } from 'socket.io-client';

const socket = io('http://localhost:3000', {
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
  timeout: 20000,
});

socket.on('connect_error', (error) => {
  console.error('Connection Error:', error);
});

socket.on('connect', () => {
  console.log('Connected to server');
});

socket.on('disconnect',  (reason) => {
  console.log('Disconnected from server:', reason);
});

export default socket; 