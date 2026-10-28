
import React, { useCallback, useEffect, useState } from "react";
import { SeatMap } from "../components/SeatMap";
import { BookingSummary } from "../components/BookingSummary";

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

  const handleSeatSelect = useCallback((seatNumber: string) => {
    setSelectedSeats((previous) => {
      const current = Array.isArray(previous) ? previous : [];

      if (current.includes(seatNumber)) {
        return current.filter((seat) => seat !== seatNumber);
      }

      return [...current, seatNumber];
    });
  }, []);

  const handleHoldCreated = useCallback((newExpiresAt: string) => {
    setExpiresAt(newExpiresAt);
    setNotification(null);
  }, []);

  const handleHoldExpired = useCallback(() => {
    setSelectedSeats([]);
    setExpiresAt(null);
    setNotification(
      "Aapka seat hold expire ho gaya hai. Kripya dobara seat select karein."
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

  return (
    <main className="seat-booking-page">
      <button type="button" onClick={onBack}>
        ← Back
      </button>

      <h1>Book Your Seats</h1>

      {event?.title && <h2>{event.title}</h2>}
      {!event?.title && event?.name && <h2>{event.name}</h2>}

      {notification && (
        <div role="status" className="booking-notification">
          {notification}
        </div>
      )}

      <div className="booking-layout">
        <section className="seat-map-container">
          <SeatMap
            eventId={slotId}
            selectedSeats={selectedSeats}
            onSeatSelect={handleSeatSelect}
            onHoldCreated={handleHoldCreated}
          />
        </section>

        <section className="booking-summary-container">
          <BookingSummary
            slotId={slotId}
            selectedSeats={selectedSeats}
            totalAmount={totalAmount}
          />
        </section>
      </div>

      {expiresAt && (
        <p>
          Hold expires at:{" "}
          {new Date(expiresAt).toLocaleTimeString()}
        </p>
      )}
    </main>
  );
};

