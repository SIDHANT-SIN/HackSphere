import React from 'react';
import { SocketProvider } from './contexts/SocketContext';
import Timer from './components/Timer';

function App() {
  return (
    <SocketProvider>
      <div className="min-h-screen bg-gray-100 py-8">
        <div className="container mx-auto px-4">
          <Timer roomId="hackathon-room" />
        </div>
      </div>
    </SocketProvider>
  );
}

export default App; 