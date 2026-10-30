
import React, { useCallback, useEffect, useState } from 'react';
import { SeatMap } from '../components/SeatMap';
import { BookingSummary } from '../components/BookingSummary';

interface SeatBookingPageProps {
  event: any;
  slotId: string;
  onBack: () => void;
  onBookingComplete: () => void;
}

const API_URL = 'http://localhost:5000';

export const SeatBookingPage: React.FC<SeatBookingPageProps> = ({
  event,
  slotId,
  onBack,
  onBookingComplete,
}) => {
  const [selectedSeats, setSelectedSeats] = useState<string[]>([]);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [notification, setNotification] = useState('');

  const handleSeatSelect = useCallback((seatNumber: string) => {
    setSelectedSeats((previous) => {
      if (previous.includes(seatNumber)) {
        return previous.filter((seat) => seat !== seatNumber);
      }

      return [...previous, seatNumber];
    });
  }, []);

  const handleHoldCreated = useCallback((newExpiresAt: string) => {
    setExpiresAt(newExpiresAt);
    setNotification('');
  }, []);

  const releaseAllSelectedSeats = async () => {
    const token = localStorage.getItem('token');

    if (!token || selectedSeats.length === 0) return;

    try {
      await fetch(`${API_URL}/api/bookings/release`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          slotId,
          seatNumbers: selectedSeats,
        }),
      });
    } catch (error) {
      console.error('Release seats error:', error);
    }
  };

  const handleBack = async () => {
    await releaseAllSelectedSeats();
    setSelectedSeats([]);
    setExpiresAt(null);
    onBack();
  };

  const handleHoldExpired = useCallback(() => {
    setSelectedSeats([]);
    setExpiresAt(null);
    setNotification(
      'Your seat hold has expired. Please select your seats again.'
    );
  }, []);

  useEffect(() => {
    if (!expiresAt) return;

    const expiryTime = new Date(expiresAt).getTime();
    const delay = expiryTime - Date.now();

    if (!Number.isFinite(expiryTime) || delay <= 0) {
      handleHoldExpired();
      return;
    }

    const timer = window.setTimeout(handleHoldExpired, delay);

    return () => window.clearTimeout(timer);
  }, [expiresAt, handleHoldExpired]);

  const totalAmount = selectedSeats.length * 500;

  if (!slotId) {
    return (
      <div className="p-8 text-red-600">
        Invalid slot. Please go back and select a valid slot.
        <button onClick={onBack} className="block mt-4 underline">
          Go Back
        </button>
      </div>
    );
  }

  return (
    <main className="p-6 space-y-5">
      <button
        type="button"
        onClick={handleBack}
        className="mb-2 bg-gray-200 px-4 py-2 rounded"
      >
        ← Back
      </button>

      <div>
        <h1 className="text-2xl font-bold">Book Your Seats</h1>

        {event?.title && (
          <h2 className="text-lg text-gray-600 mt-1">
            {event.title}
          </h2>
        )}

        <p className="text-xs text-gray-500 mt-2 break-all">
          Slot ID: {slotId}
        </p>
      </div>

      {notification && (
        <div role="alert" className="bg-red-100 text-red-700 p-3 rounded">
          {notification}
        </div>
      )}

      {expiresAt && selectedSeats.length > 0 && (
        <div className="bg-orange-100 text-orange-800 p-3 rounded">
          Your seat hold expires at:{' '}
          {new Date(expiresAt).toLocaleTimeString()}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <section>
          <SeatMap
            eventid={slotId}
            selectedSeats={selectedSeats}
            onSeatSelect={handleSeatSelect}
            onHoldCreated={handleHoldCreated}
          />
        </section>

        <section>
          <BookingSummary
            slotId={slotId}
            selectedSeats={selectedSeats}
            totalAmount={totalAmount}
          
          />
        </section>
      </div>
    </main>
  );
};
