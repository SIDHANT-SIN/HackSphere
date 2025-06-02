import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import socket from '../socket';

function Home() {
  const [roomId, setRoomId] = useState('');
  const [username, setUsername] = useState('');
  const [showUsernamePrompt, setShowUsernamePrompt] = useState(false);
  const [usernameError, setUsernameError] = useState('');
  const [pendingRoomId, setPendingRoomId] = useState(null);
  const [showRoomError, setShowRoomError] = useState(false);
  const navigate = useNavigate();

  const createRoom = () => {
    const newRoomId = Math.random().toString(36).substring(7);
    setPendingRoomId(newRoomId);
    setShowUsernamePrompt(true);
  };

  const checkRoomExists = async (roomId) => {
    try {
      const response = await fetch(`http://localhost:3000/room/${roomId}/exists`);
      if (!response.ok) {
        throw new Error('Failed to check room status');
      }
      const { exists } = await response.json();
      return exists;
    } catch (error) {
      console.error('Room check error:', error);
      return false;
    }
  };

  const joinRoom = async (e) => {
    e.preventDefault();
    if (!roomId.trim()) return;

    const trimmedRoomId = roomId.trim();
    const roomExists = await checkRoomExists(trimmedRoomId);

    if (!roomExists) {
      setShowRoomError(true);
      setTimeout(() => setShowRoomError(false), 3000); // Hide error after 3 seconds
      return;
    }

    setPendingRoomId(trimmedRoomId);
    setShowUsernamePrompt(true);
  };

  const handleUsernameSubmit = (e) => {
    e.preventDefault();
    if (!username.trim()) {
      setUsernameError("Username cannot be empty");
      return;
    }
    // stores username in localStorage
    localStorage.setItem("username", username.trim());
    localStorage.setItem("roomId", pendingRoomId);
    
    // join room
    socket.emit("joinRoom", {
      roomId: pendingRoomId,
      username: username.trim(),
    });

    navigate(`/room/${pendingRoomId}`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center">
      <div className="bg-white rounded-lg shadow-xl p-8 max-w-md w-full">
        {!showUsernamePrompt ? (
          <>
            <h1 className="text-4xl font-bold text-center mb-4 text-gray-800">Welcome to the Hackathon Timer</h1>
            <p className="text-center mb-8 text-gray-600">Create a new room or join an existing one to collaborate with your team.</p>
            
            <button 
              onClick={createRoom}
              className="w-full bg-blue-500 text-white py-3 px-4 rounded-lg mb-4 hover:bg-blue-600 transition duration-300"
            >
              Create New Room
            </button>

            <div className="text-center mb-4 text-gray-500">OR</div>

            <form onSubmit={joinRoom} className="space-y-4">
              <div>
                <input
                  type="text"
                  value={roomId}
                  onChange={(e) => setRoomId(e.target.value)}
                  placeholder="Enter Room ID"
                  className="w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {showRoomError && (
                  <p className="text-red-500 text-sm mt-2">
                    Room not found. Please check the Room ID or create a new room.
                  </p>
                )}
              </div>
              <button
                type="submit"
                className="w-full bg-green-500 text-white py-3 px-4 rounded-lg hover:bg-green-600 transition duration-300"
              >
                Join Room
              </button>
            </form>
          </>
        ) : (
          <div>
            <h2 className="text-2xl font-bold text-center mb-6">Join Room: {pendingRoomId}</h2>
            <form onSubmit={handleUsernameSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Choose a Username
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter your username"
                  className="w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  maxLength={20}
                />
                {usernameError && (
                  <p className="text-red-500 text-sm mt-1">{usernameError}</p>
                )}
              </div>
              <div className="flex space-x-3">
                <button
                  type="submit"
                  className="flex-1 bg-blue-500 text-white py-3 px-4 rounded-lg hover:bg-blue-600 transition duration-300"
                >
                  Join Room
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowUsernamePrompt(false);
                    setPendingRoomId(null);
                    setUsername('');
                    setUsernameError('');
                  }}
                  className="flex-1 bg-gray-500 text-white py-3 px-4 rounded-lg hover:bg-gray-600 transition duration-300"
                >
                  Back
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}

export default Home; 