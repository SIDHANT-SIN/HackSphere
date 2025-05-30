import React from 'react';
import { useParams } from 'react-router-dom';
import Timer from './Timer';
import Chat from './Chat';
import Notes from './Notes';

const Room = () => {
  const { roomId } = useParams();

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Room: {roomId}</h1>
        <p className="text-gray-600 mt-2">Share this room ID with your team members to collaborate.</p>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <Timer />
          <Notes />
        </div>
        <div className="lg:col-span-1">
          <Chat />
        </div>
      </div>
    </div>
  );
};

export default Room; 