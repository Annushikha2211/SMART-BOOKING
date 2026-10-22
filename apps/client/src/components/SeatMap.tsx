import React, { useState, useEffect } from 'react';

interface Seat {
  id: string;
  seatNumber: string;
  status: 'AVAILABLE' | 'HELD' | 'BOOKED';
}

interface SeatMapProps {
  slotId: string;
  selectedSeats: string[];
  onSeatSelect: (seats: string[]) => void;
}

export const SeatMap: React.FC<SeatMapProps> = ({ slotId, selectedSeats, onSeatSelect }) => {
  const [seats, setSeats] = useState<Seat[]>([]);

  useEffect(() => {
    // Initial seats list (A1, A2, A3, A4, B1, B2 etc.)
    setSeats([
      { id: '1', seatNumber: 'A1', status: 'AVAILABLE' },
      { id: '2', seatNumber: 'A2', status: 'AVAILABLE' },
      { id: '3', seatNumber: 'A3', status: 'BOOKED' },
      { id: '4', seatNumber: 'A4', status: 'AVAILABLE' },
      { id: '5', seatNumber: 'B1', status: 'AVAILABLE' },
      { id: '6', seatNumber: 'B2', status: 'AVAILABLE' },
    ]);
  }, [slotId]);

  const toggleSeatSelection = (seatNumber: string, status: string) => {
    if (status === 'BOOKED' || status === 'HELD') return;

    const newSelection = selectedSeats.includes(seatNumber)
      ? selectedSeats.filter((s) => s !== seatNumber)
      : [...selectedSeats, seatNumber];

    onSeatSelect(newSelection);
  };

  return (
    <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-3xl max-w-2xl mx-auto space-y-6">
      <div className="text-center">
        <h3 className="text-xl font-bold text-white">Select Your Seats</h3>
        <p className="text-xs text-zinc-400 mt-1">Stage is this way ↑</p>
      </div>

      <div className="w-full bg-zinc-800 h-2 rounded-full mb-8 relative">
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="bg-zinc-900 px-3 text-[10px] text-zinc-400 uppercase tracking-widest">Stage</span>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-3 justify-items-center">
        {seats.map((seat) => {
          const isSelected = selectedSeats.includes(seat.seatNumber);
          const isBooked = seat.status === 'BOOKED';

          let bgClass = 'bg-zinc-800 text-zinc-300 hover:border-amber-500';
          if (isBooked) bgClass = 'bg-zinc-950 text-zinc-700 border-zinc-900 cursor-not-allowed';
          if (isSelected) bgClass = 'bg-amber-500 text-black font-bold border-amber-400 shadow-lg shadow-amber-500/30';

          return (
            <button
              key={seat.id}
              disabled={isBooked}
              onClick={() => toggleSeatSelection(seat.seatNumber, seat.status)}
              className={`w-12 h-12 rounded-xl border border-zinc-700 flex items-center justify-center text-xs transition duration-200 ${bgClass}`}
            >
              {seat.seatNumber}
            </button>
          );
        })}
      </div>
    </div>
  );
};