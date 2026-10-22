import React, { useState } from 'react';
import { SeatMap } from '../components/SeatMap';
import { BookingSummary } from '../components/BookingSummary';
import { Event } from '../types/booking';

interface SeatBookingPageProps {
  event: Event;
  slotId: string;
  onBack: () => void;
  onBookingComplete: () => void;
}

export const SeatBookingPage: React.FC<SeatBookingPageProps> = ({
  event,
  slotId,
  onBack,
  onBookingComplete,
}) => {
  const [selectedSeats, setSelectedSeats] = useState<string[]>([]);

  // Function jab user SeatMap se seat select/unselect karega
  const handleSeatSelect = (seats: string[]) => {
    setSelectedSeats(seats);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Back Button & Event Info Header */}
      <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
        <div>
          <button
            onClick={onBack}
            className="text-amber-400 hover:text-amber-300 text-sm font-semibold flex items-center gap-1 mb-1 transition"
          >
            ← Back to Event Discovery
          </button>
          <h2 className="text-2xl font-bold text-white">{event.title}</h2>
          <p className="text-xs text-zinc-400">
            📍 {event.location} | 🕒 {event.time}
          </p>
        </div>
      </div>

      {/* Main Grid Layout: Left Side SeatMap, Right Side Sticky Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        {/* Left Column (2 Cols wide on desktop): Interactive Seat Map */}
        <div className="lg:col-span-2">
          <SeatMap
            slotId={slotId}
            selectedSeats={selectedSeats}
            onSeatSelect={handleSeatSelect}
          />
        </div>

        {/* Right Column (1 Col wide): Sticky Summary & Timer */}
        <div className="lg:col-span-1">
          <BookingSummary
            slotId={slotId}
            selectedSeats={selectedSeats}
            onConfirmSuccess={onBookingComplete}
          />
        </div>
      </div>
    </div>
  );
};