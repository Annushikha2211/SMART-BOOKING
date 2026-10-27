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
}) => {
  const [isHolding, setIsHolding] = useState(false);
  const [isHeld, setIsHeld] = useState(false);

  const seatCount = selectedSeats.length;
  const totalPrice = totalAmount * seatCount;

  // Step 1: Hold Seats Temporarily / Confirm Selection
  const handleHoldBooking = async () => {
    if (seatCount === 0) return;
    setIsHolding(true);

    try {
      // Yahan aap apna hold/lock API call add kar sakti hain agar required ho
      setIsHeld(true);
    } catch (error) {
      console.error('Hold Error:', error);
      alert('Failed to hold seats. Try again.');
    } finally {
      setIsHolding(false);
    }
  };

  // Step 2: Trigger Stripe Payment
  const handlePayment = async () => {
    try {
      const response = await fetch('http://localhost:5000/api/payment/create-checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          slotId: slotId || 'default-slot',
          seatNumbers: selectedSeats,
          amount: totalPrice,
        }),
      });

      const data = await response.json();

      if (data.url) {
        window.location.href = data.url;
      } else {
        alert(data.message || 'Failed to initiate payment');
      }
    } catch (error) {
      console.error('Payment Error:', error);
    }
  };

  return (
    <div className="p-6 bg-zinc-900 text-white rounded-2xl border border-zinc-800 shadow-xl space-y-4">
      <h3 className="text-xl font-bold tracking-wide border-b border-zinc-800 pb-3 text-zinc-100">
        Booking Summary
      </h3>

      <div className="space-y-2 text-sm text-zinc-300">
        <div className="flex justify-between items-center">
          <span className="text-zinc-400">Selected Seats:</span>
          <span className="font-semibold text-amber-500">
            {selectedSeats.length > 0 ? selectedSeats.join(', ') : 'None'}
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
          {isHolding ? 'Holding Seats...' : 'Confirm Selection'}
        </button>
      ) : (
        <button
          onClick={handlePayment}
          className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2.5 px-4 rounded-xl transition shadow-lg"
        >
          Proceed to Payment (₹{totalPrice})
        </button>
      )}
    </div>
  );
};