import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

export function getSocket(token?: string): Socket {
  if (!socket) {
    const url = window.location.protocol + '//' + window.location.hostname + (window.location.port ? ':3000' : ''); 

    socket = io(url, {
      auth: { token },
      autoConnect: true,
      transports: ['websocket'],
    });

    socket.on('connect_error', (err) => {
      console.error('Socket connection error:', err.message);
    });
  } else if (token && socket.auth && (socket.auth as any).token !== token) {
    // Update token if it changed and reconnect
    socket.auth = { token };
    socket.disconnect().connect();
  }
  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
