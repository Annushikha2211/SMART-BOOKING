import React, { useState, useEffect } from 'react';

interface BookingSummaryProps {
  slotId: string;
  selectedSeats: string[];
  onConfirmSuccess: () => void;
}

export const BookingSummary: React.FC<BookingSummaryProps> = ({ slotId, selectedSeats, onConfirmSuccess }) => {
  const [timeLeft, setTimeLeft] = useState(300); // 5 minutes countdown (300 seconds)
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Countdown timer logic
  useEffect(() => {
    if (timeLeft <= 0) return;
    const timer = setInterval(() => {
      setTimeLeft((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [timeLeft]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const handleConfirmBooking = async () => {
    setLoading(true);
    setError(null);
    const token = localStorage.getItem('token');

    try {
      const response = await fetch('http://localhost:5000/api/bookings/confirm', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          slotId,
          seatNumbers: selectedSeats
        })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Failed to confirm booking');

      alert('Booking confirmed successfully! Ticket generated.');
      onConfirmSuccess();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const totalPrice = selectedSeats.length * 500; // Assuming ₹500 per seat

  return (
    <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-3xl max-w-md mx-auto space-y-6 sticky top-24 shadow-2xl">
      <div className="flex justify-between items-center pb-4 border-b border-zinc-800">
        <h4 className="text-white font-bold text-lg">Booking Summary</h4>
        <div className="bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs px-3 py-1.5 rounded-full font-mono font-bold animate-pulse">
          ⏱️ Hold Expires in {formatTime(timeLeft)}
        </div>
      </div>

      <div className="space-y-3 text-sm">
        <div className="flex justify-between text-zinc-400">
          <span>Selected Seats:</span>
          <span className="text-white font-medium">{selectedSeats.join(', ') || 'None'}</span>
        </div>
        <div className="flex justify-between text-zinc-400">
          <span>Price per seat:</span>
          <span className="text-white font-medium">₹500</span>
        </div>
        <div className="flex justify-between text-zinc-400 pt-3 border-t border-zinc-800 text-base font-bold">
          <span className="text-white">Total Amount:</span>
          <span className="text-amber-400">₹{totalPrice}</span>
        </div>
      </div>

      {error && <p className="text-red-400 text-xs">{error}</p>}

      <button
        disabled={selectedSeats.length === 0 || loading || timeLeft <= 0}
        onClick={handleConfirmBooking}
        className="w-full bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-black font-bold py-3 rounded-2xl transition shadow-lg shadow-amber-500/20"
      >
        {loading ? 'Processing Payment...' : 'Proceed to Checkout & Confirm'}
      </button>
    </div>
  );
};