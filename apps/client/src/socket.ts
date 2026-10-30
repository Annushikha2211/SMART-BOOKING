import { io } from 'socket.io-client';

// Vite environments use import.meta.env instead of process.env
const SOCKET_URL = (import.meta as any).env?.VITE_BACKEND_URL || 'http://localhost:5000';

export const socket = io(SOCKET_URL, {
  transports: ['websocket'],
  autoConnect: true,
});