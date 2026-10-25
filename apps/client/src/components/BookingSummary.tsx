import React, { useEffect, useState } from 'react';

interface BookingSummaryProps {
  eventId: string;
  selectedSeats: string[];
  expiresAt: string | null;
  onHoldExpired: () => void;
  onConfirmSuccess: () => void;
}

export const BookingSummary: React.FC<BookingSummaryProps> = ({
  eventId,
  selectedSeats,
  expiresAt,
  onHoldExpired,
  onConfirmSuccess,
}) => {
  const [timeLeft, setTimeLeft] = useState<number>(0);

  useEffect(() => {
    if (!expiresAt) return;

    const calculateTime = () => {
      const expiryTime = new Date(expiresAt).getTime();
      const currentTime = new Date().getTime();
      const diffInSeconds = Math.max(0, Math.floor((expiryTime - currentTime) / 1000));
      
      setTimeLeft(diffInSeconds);

      if (diffInSeconds <= 0) {
        onHoldExpired();
      }
    };

    calculateTime();
    const timer = setInterval(calculateTime, 1000);

    return () => clearInterval(timer);
  }, [expiresAt, onHoldExpired]);

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const formattedTime = `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 text-white">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-xl font-bold">Booking Summary</h3>
        {expiresAt && timeLeft > 0 && (
          <div className="px-3 py-1 bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-semibold rounded-full flex items-center gap-1.5">
            ⏱️ Hold Expires in {formattedTime}
          </div>
        )}
      </div>

      <div className="space-y-3 text-sm text-zinc-400 mb-6">
        <div className="flex justify-between">
          <span>Selected Seats:</span>
          <span className="text-white font-medium">
            {selectedSeats.length > 0 ? selectedSeats.join(', ') : 'None'}
          </span>
        </div>
        <div className="flex justify-between text-base font-bold text-white pt-3 border-t border-zinc-800">
          <span>Total Amount:</span>
          <span className="text-amber-500">₹{selectedSeats.length * 500}</span>
        </div>
      </div>

      <button
        disabled={selectedSeats.length === 0}
        onClick={onConfirmSuccess}
        className="w-full py-3 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-zinc-950 font-bold rounded-lg transition-colors"
      >
        Confirm Booking
      </button>
    </div>
  );
};