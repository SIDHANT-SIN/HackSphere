import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Home from './components/Home';
import Room from './components/Room';
import Navbar from "./components/layout/Navbar";
import Footer from "./components/layout/Footer";
import socket from './socket';

function App() {
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {

    
    socket.on("connect", () => {
      console.log("Connected to server");
=======
  

      setIsConnected(true);
    });

    socket.on("disconnect", () => {
      console.log("Disconnected from server");
      setIsConnected(false);
    });

    return () => {
      socket.off("connect");
      socket.off("disconnect");
    };
  }, []);
  return (
    <Router>
      <div className="min-h-screen flex flex-col bg-white">
        {" "}
        {/* Changed bg-gray-100 to bg-white */}
        {!isConnected && (
          <div className="bg-red-500 text-white p-2 text-center">
            Disconnected from server
          </div>
        )}
        <Navbar />
        <main className="flex-grow bg-white">
          {" "}
          {/* Added bg-white here */}
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/room/:roomId" element={<Room />} />
          </Routes>
        </main>
        <Footer />
      </div>
    </Router>
  );
}

export default App;
