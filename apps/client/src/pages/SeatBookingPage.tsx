import React, { useState, useCallback } from 'react';
import { SeatMap } from '../components/SeatMap';
import { BookingSummary } from '../components/BookingSummary';

export const SeatBookingPage: React.FC = () => {
  const [selectedSeats, setSelectedSeats] = useState<string[]>([]);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const eventId = "default-event-id";

  const handleHoldExpired = useCallback(() => {
    setSelectedSeats([]);
    setExpiresAt(null);
    alert("Aapka seat hold expire ho chuka hai!");
  }, []);

  const handleBookingComplete = () => {
    alert("Booking successful!");
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-white p-8">
      <h1 className="text-3xl font-bold mb-8">Select Your Seats</h1>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        <div className="lg:col-span-2 bg-zinc-900 border border-zinc-800 rounded-xl p-6">
          <SeatMap
            eventId={eventId}
            selectedSeats={selectedSeats}
            onSeatSelect={setSelectedSeats}
            onHoldCreated={setExpiresAt}
          />
        </div>

        <div className="lg:col-span-1">
          <BookingSummary
            eventId={eventId}
            selectedSeats={selectedSeats}
            expiresAt={expiresAt}
            onHoldExpired={handleHoldExpired}
            onConfirmSuccess={handleBookingComplete}
          />
        </div>
      </div>
    </div>
  );
};