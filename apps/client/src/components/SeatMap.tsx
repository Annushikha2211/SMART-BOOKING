import React from 'react';

interface SeatMapProps {
  eventId: string;
  selectedSeats: string[];
  onSeatSelect: (seats: string[]) => void;
  onHoldCreated: (expiresAt: string) => void;
}

export const SeatMap: React.FC<SeatMapProps> = ({
  eventId,
  selectedSeats,
  onSeatSelect,
  onHoldCreated,
}) => {
  const handleSeatClick = async (seatId: string) => {
    const previousSeats = [...selectedSeats];
    
    const newSelection = previousSeats.includes(seatId)
      ? previousSeats.filter(id => id !== seatId)
      : [...previousSeats, seatId];

    onSeatSelect(newSelection);

    try {
      const res = await fetch('http://localhost:3000/api/bookings/hold', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId, seats: newSelection }),
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
      alert('This seat was just claimed by someone else!');
    }
  };

  return (
    <div>
      {/* Apka seat map layout JSX yahan rahega */}
    </div>
  );
};