import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const Hero = () => {
  const navigate = useNavigate(); 
  const [roomId, setRoomId] = useState('');

  const handleCreateRoom = () => {
    // random room ID generation
    const   newRoomId = Math.random().toString(36).substring(2, 8);
    navigate(`/room/${newRoomId}`);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="text-center mb-12">
        <h2 className="text-4xl font-bold text-gray-900 mb-4">
          Collaborate in Real-Time
        </h2>
        <p className="text-xl text-gray-600 max-w-2xl mx-auto">
          The perfect platform for hackathon teams to work together, track time, and share resources.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-12">
        <div className="bg-white rounded-lg shadow-lg p-6 hover:shadow-xl transition-shadow">
          <h3 className="text-lg font-semibold text-gray-800 mb-3">Room-based Collaboration</h3>
          <p className="text-gray-600">Create or join rooms for your hackathon team and work together in real-time.</p>
        </div>
        <div className="bg-white rounded-lg shadow-lg p-6 hover:shadow-xl transition-shadow">
          <h3 className="text-lg font-semibold text-gray-800 mb-3">Shared Timer</h3>
          <p className="text-gray-600">Keep track of hackathon deadlines with a synchronized team timer.</p>
        </div>
        <div className="bg-white rounded-lg shadow-lg p-6 hover:shadow-xl transition-shadow">
          <h3 className="text-lg font-semibold text-gray-800 mb-3">Live Chat & Notes</h3>
          <p className="text-gray-600">Communicate and collaborate with your team using built-in chat and shared notes.</p>
        </div>
      </div>

      <div className="text-center space-y-4">
        <button
          onClick={handleCreateRoom}
          className="bg-indigo-600 hover:bg-indigo-700 text-white text-lg font-semibold py-3 px-8 rounded-md transition duration-150 ease-in-out transform hover:scale-105"
        >
          Create Your Room
        </button>
        <div className="flex items-center justify-center space-x-4">
          <input
            type="text"
            placeholder="Enter Room ID"
            value={roomId}
            onChange={(e) => setRoomId(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <button
            onClick={() => roomId && navigate(`/room/${roomId}`)}
            className="bg-white text-indigo-600 border border-indigo-600 px-4 py-2 rounded-md hover:bg-indigo-50 transition-colors"
          >
            Join Room
          </button>
        </div>
      </div>
    </div>
  );
};

export default Hero; 