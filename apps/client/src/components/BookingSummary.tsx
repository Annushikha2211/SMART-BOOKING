
import React, { useState } from 'react';

interface BookingSummaryProps {
  slotId?: string;
  eventId?: string;
  selectedSeats: string[];
  totalAmount?: number;
  expiresAt?: string | null;
  onHoldExpired?: () => void;
  onConfirmSuccess?: () => void;
}

export const BookingSummary: React.FC<BookingSummaryProps> = ({
  slotId,
  selectedSeats,
  totalAmount = 500,
  onConfirmSuccess,
}) => {
  const [isHolding, setIsHolding] = useState(false);
  const [isHeld, setIsHeld] = useState(false);
  const [isPaying, setIsPaying] = useState(false);

  const seatCount = selectedSeats.length;
  const totalPrice = totalAmount * seatCount;

  // Step 1: Confirm seat selection
  const handleHoldBooking = async () => {
    if (seatCount === 0) {
      alert('Please select at least one seat.');
      return;
    }

    if (!slotId) {
      alert('Slot ID is missing. Please go back and select the event again.');
      return;
    }

    setIsHolding(true);

    try {
      // Current behavior: proceed to payment after selection.
      // This does not actually hold seats in Redis or the database.
      setIsHeld(true);
      onConfirmSuccess?.();
    } catch (error) {
      console.error('Seat selection error:', error);
      alert('Failed to continue. Please try again.');
    } finally {
      setIsHolding(false);
    }
  };

  // Step 2: Create Stripe Checkout Session
  const handlePayment = async () => {
    if (isPaying) return;

    if (!slotId || seatCount === 0) {
      alert('Please select a valid event and seats.');
      return;
    }

    // Read the login token saved by the frontend.
    const token = localStorage.getItem('token');

    if (!token) {
      alert('Login token not found. Please log in again.');
      return;
    }

    setIsPaying(true);

    try {
      const response = await fetch(
        'http://localhost:5000/api/payment/create-checkout-session',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            slotId,
            seatNumbers: selectedSeats,
            // Backend multiplies the per-seat price by seat count.
            amount: totalAmount,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || data.error || 'Failed to create payment session.'
        );
      }

      if (!data.url) {
        throw new Error('Stripe Checkout URL was not returned.');
      }

      window.location.href = data.url;
    } catch (error) {
      console.error('Payment Error:', error);

      alert(
        error instanceof Error
          ? error.message
          : 'Payment could not be started. Please try again.'
      );

      setIsPaying(false);
    }
  };

  return (
    <div className="p-6 bg-zinc-900 text-white rounded-2xl border border-zinc-800 shadow-xl space-y-4">
      <h3 className="text-xl font-bold tracking-wide border-b border-zinc-800 pb-3 text-zinc-100">
        Booking Summary
      </h3>

      <div className="space-y-2 text-sm text-zinc-300">
        <div className="flex justify-between items-center gap-3">
          <span className="text-zinc-400">Selected Seats:</span>
          <span className="font-semibold text-amber-500 text-right">
            {selectedSeats.length > 0
              ? selectedSeats.join(', ')
              : 'None'}
          </span>
        </div>

        <div className="flex justify-between items-center">
          <span className="text-zinc-400">Price per Seat:</span>
          <span>₹{totalAmount}</span>
        </div>

        <div className="flex justify-between items-center text-lg font-bold border-t border-zinc-800 pt-3 text-white">
          <span>Total Amount:</span>
          <span className="text-amber-400">₹{totalPrice}</span>
        </div>
      </div>

      {!isHeld ? (
        <button
          onClick={handleHoldBooking}
          disabled={seatCount === 0 || isHolding}
          className="w-full bg-amber-500 hover:bg-amber-600 text-zinc-950 font-semibold py-2.5 px-4 rounded-xl transition disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
        >
          {isHolding ? 'Please wait...' : 'Confirm Selection'}
        </button>
      ) : (
        <button
          onClick={handlePayment}
          disabled={isPaying}
          className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2.5 px-4 rounded-xl transition shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isPaying
            ? 'Redirecting to Payment...'
            : `Proceed to Payment (₹${totalPrice})`}
        </button>
      )}
    </div>
  );
};
