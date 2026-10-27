import React, { useEffect, useState } from 'react';
import { io } from 'socket.io-client';

// Component ke bahar socket instance create kiya hai taaki bar-bar reconnect na ho
const socket = io('http://localhost:5000', {
  transports: ['websocket', 'polling']
});

interface SeatMapProps {
  eventId: string;
  selectedSeats: string[];
  onSeatSelect: (seats: string[]) => void;
  onHoldCreated: (expiresAt: string) => void;
}

interface SeatState {
  seatNumber: string;
  status: 'AVAILABLE' | 'HELD' | 'BOOKED';
}

export const SeatMap: React.FC<SeatMapProps> = ({
  eventId,
  selectedSeats,
  onSeatSelect,
  onHoldCreated,
}) => {
  const [seats, setSeats] = useState<SeatState[]>(() => {
    return Array.from({ length: 24 }).map((_, i) => {
      const row = String.fromCharCode(65 + Math.floor(i / 8));
      const num = (i % 8) + 1;
      return { seatNumber: `${row}${num}`, status: 'AVAILABLE' };
    });
  });

  const [notification, setNotification] = useState<{ message: string; type: 'error' | 'success' } | null>(null);

  const showBanner = (message: string, type: 'error' | 'success' = 'error') => {
    setNotification({ message, type });
    setTimeout(() => {
      setNotification(null);
    }, 4000);
  };

  useEffect(() => {
    socket.emit('join_slot', eventId);

    socket.on('seats_updated', (data: { seatNumbers: string[]; status: 'HELD' | 'BOOKED' | 'AVAILABLE' }) => {
      console.log('Real-time seat update received:', data);
      setSeats((prevSeats) =>
        prevSeats.map((seat) =>
          data.seatNumbers.includes(seat.seatNumber)
            ? { ...seat, status: data.status }
            : seat
        )
      );
    });

    return () => {
      socket.emit('leave_slot', eventId);
      socket.off('seats_updated');
    };
  }, [eventId]);

  const handleSeatClick = async (seatId: string) => {
    const targetSeat = seats.find(s => s.seatNumber === seatId);
    if (targetSeat?.status === 'BOOKED' || (targetSeat?.status === 'HELD' && !selectedSeats.includes(seatId))) {
      showBanner('Yeh seat already reserved ya booked hai!', 'error');
      return;
    }

    const previousSeats = [...selectedSeats];
    const isAlreadySelected = previousSeats.includes(seatId);
    
    const newSelection = isAlreadySelected
      ? previousSeats.filter((id) => id !== seatId)
      : [...previousSeats, seatId];

    onSeatSelect(newSelection);

    try {
      const token = localStorage.getItem('token');
      const res = await fetch('http://localhost:5000/api/bookings/hold', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ slotId: eventId, seatNumbers: [seatId] }),
      });

      if (!res.ok) {
        throw new Error('Seat hold failed');
      }

      const data = await res.json();
      if (data.expiresAt) {
        onHoldCreated(data.expiresAt);
      }
    } catch (error) {
      console.error('Conflict detected! Rolling back seat state.', error);
      onSeatSelect(previousSeats);
      showBanner('Yeh seat kisi aur ne select kar li hai!', 'error');
    }
  };

  return (
    <div className="bg-zinc-900/60 p-6 rounded-2xl border border-zinc-800 space-y-6 relative">
      
      {/* Top Floating Notification Card */}
      {notification && (
        <div className={`absolute top-4 left-1/2 -translate-x-1/2 z-20 px-4 py-2.5 rounded-xl border text-xs font-semibold shadow-2xl flex items-center gap-3 transition-all animate-bounce ${
          notification.type === 'error' 
            ? 'bg-red-950/90 border-red-800 text-red-300 shadow-red-950/50' 
            : 'bg-green-950/90 border-green-800 text-green-300 shadow-green-950/50'
        }`}>
          <span>⚠️</span>
          <span>{notification.message}</span>
        </div>
      )}

      {/* Screen Visual Indicator */}
      <div className="w-full text-center mb-6">
        <div className="w-3/4 h-2 bg-gradient-to-r from-transparent via-amber-500 to-transparent mx-auto rounded-full shadow-[0_0_15px_rgba(245,158,11,0.5)]"></div>
        <span className="text-[10px] text-zinc-500 uppercase tracking-widest mt-2 block">STAGE / SCREEN</span>
      </div>

      {/* Seats Grid */}
      <div className="grid grid-cols-8 gap-3 max-w-xl mx-auto">
        {seats.map((seat) => {
          const isSelected = selectedSeats.includes(seat.seatNumber);
          const isHeldBySomeoneElse = (seat.status === 'HELD' || seat.status === 'BOOKED') && !isSelected;
          const isBooked = seat.status === 'BOOKED';

          let buttonStyle = "bg-zinc-800 text-zinc-300 hover:bg-amber-500/20 hover:border-amber-500/50";

          // Priority: Agar aapne select kiya hai toh Yellow, agar kisi aur ne kiya hai toh Red
          if (isSelected) {
            buttonStyle = "bg-amber-500 text-black font-extrabold border-amber-400 shadow-[0_0_12px_rgba(245,158,11,0.4)]";
          } else if (isBooked || isHeldBySomeoneElse) {
            buttonStyle = "bg-red-950/40 text-red-600 border-red-900/40 cursor-not-allowed opacity-60";
          }

          return (
            <button
              key={seat.seatNumber}
              disabled={isBooked || isHeldBySomeoneElse}
              onClick={() => handleSeatClick(seat.seatNumber)}
              className={`h-11 rounded-xl text-xs font-semibold border transition-all duration-200 flex items-center justify-center ${buttonStyle}`}
            >
              {seat.seatNumber}
            </button>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex justify-center gap-6 pt-4 text-xs text-zinc-400 border-t border-zinc-800/60">
        <div className="flex items-center gap-2">
          <span className="w-3.5 h-3.5 bg-zinc-800 border border-zinc-700 rounded-md"></span> Available
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3.5 h-3.5 bg-amber-500 rounded-md"></span> Selected
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3.5 h-3.5 bg-red-950/60 border border-red-900 rounded-md"></span> Reserved / Locked
        </div>
      </div>
    </div>
  );
};