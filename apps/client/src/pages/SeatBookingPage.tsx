import React, { useState, useCallback } from 'react';
import { SeatMap } from '../components/SeatMap';
import { BookingSummary } from '../components/BookingSummary';

interface SeatBookingPageProps {
  event: any;
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
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [notification, setNotification] = useState<string | null>(null);

  // Seat hold expire hone par callback
  const handleHoldExpired = useCallback(() => {
    setSelectedSeats([]);
    setExpiresAt(null);
    setNotification("Aapka seat hold expire ho chuka hai! Kripya dobara seat select karein.");
    
    // 4 seconds baad banner hide ho jayega
    setTimeout(() => {
      setNotification(null);
    }, 4000);
  }, []);

  

  return (
    <div className="min-h-screen bg-zinc-950 text-white p-8 relative">
      {/* Top Floating Alert Banner */}
      {notification && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 bg-red-950/90 border border-red-800 text-red-300 px-5 py-3 rounded-xl text-xs font-semibold shadow-2xl flex items-center gap-3 animate-bounce">
          <span>⚠️</span>
          <span>{notification}</span>
        </div>
      )}

      {/* Top Header with Back Button */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <button
            onClick={onBack}
            className="text-sm text-zinc-400 hover:text-white mb-2 flex items-center gap-1 transition-colors"
          >
            ← Back to Events
          </button>
          <h1 className="text-3xl font-bold">Select Your Seats</h1>
          {event?.title && (
            <p className="text-sm text-zinc-400 mt-1">{event.title}</p>
          )}
        </div>
      </div>

      {/* Main Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        {/* Left Column: Seat Map Grid */}
        <div className="lg:col-span-2 bg-zinc-900 border border-zinc-800 rounded-xl p-6 shadow-xl">
          <SeatMap
            eventId={slotId}
            selectedSeats={selectedSeats}
            onSeatSelect={setSelectedSeats}
            onHoldCreated={setExpiresAt}
          />
        </div>

        {/* Right Column: Booking Summary & Confirm Action */}
        <div className="lg:col-span-1">
          <BookingSummary
            eventId={slotId}
            selectedSeats={selectedSeats}
            expiresAt={expiresAt}
            onHoldExpired={handleHoldExpired}
            onConfirmSuccess={onBookingComplete}
          />
        </div>
      </div>
    </div>
  );
};