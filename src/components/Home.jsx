import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import socket from '../socket';

function Home() {
  const [roomId, setRoomId] = useState('');
  const navigate = useNavigate();

  const createRoom = () => {
    const newRoomId = Math.random().toString(36).substring(7);
    socket.emit('createRoom', newRoomId);
    navigate(`/room/${newRoomId}`);
  };

  const joinRoom = (e) => {
    e.preventDefault();
    if (roomId.trim()) {
      socket.emit('joinRoom', roomId);
      navigate(`/room/${roomId}`);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center">
      <div className="bg-white rounded-lg shadow-xl p-8 max-w-md w-full">
        <h1 className="text-4xl font-bold text-center mb-4 text-gray-800">Welcome to the Hackathon Collaboration Platform</h1>
        <p className="text-center mb-8 text-gray-600">A real-time collaboration platform for hackathon teams with features like room-based timers, shared notes, live chat, file uploads, and daily logs.</p>
        
            <button 
          onClick={createRoom}
          className="w-full bg-blue-500 text-white py-3 px-4 rounded-lg mb-4 hover:bg-blue-600 transition duration-300"
            >
          Create New Room
            </button>

        <div className="text-center mb-4 text-gray-500">OR</div>

        <form onSubmit={joinRoom} className="space-y-4">
              <input
                type="text"
                value={roomId}
                onChange={(e) => setRoomId(e.target.value)}
            placeholder="Enter Room ID"
            className="w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
            type="submit"
            className="w-full bg-green-500 text-white py-3 px-4 rounded-lg hover:bg-green-600 transition duration-300"
              >
                Join Room
              </button>
        </form>
        </div>
    </div>
  );
}

export default Home; 