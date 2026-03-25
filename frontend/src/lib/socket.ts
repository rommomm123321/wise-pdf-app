import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    const token = localStorage.getItem('token');
    
    // In production, you might want to use a specific URL
    // For development with Vite proxy, we can use the current origin
    const url = window.location.protocol + '//' + window.location.hostname + ':3000'; // Assuming backend runs on 3000

    socket = io(url, {
      auth: { token },
      autoConnect: true,
      transports: ['websocket'],
    });

    socket.on('connect_error', (err) => {
      console.error('Socket connection error:', err.message);
    });
  }
  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
