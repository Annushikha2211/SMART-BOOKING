
import React, { useState } from 'react';

interface BookingSummaryProps {
  slotId: string;
  selectedSeats: string[];
  totalAmount: number;
}

const API_URL = 'http://localhost:5000';

export const BookingSummary: React.FC<BookingSummaryProps> = ({
  slotId,
  selectedSeats,
  totalAmount,
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleCheckout = async () => {
    if (!slotId || selectedSeats.length === 0) {
      setError('Please select at least one seat.');
      return;
    }

    const token = localStorage.getItem('token');

    if (!token) {
      setError('Please login before checkout.');
      return;
    }

    try {
      setLoading(true);
      setError('');

      const response = await fetch(`${API_URL}/api/checkout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          slotId,
          seats: selectedSeats,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || data.message || 'Checkout session failed.'
        );
      }

      if (!data.url) {
        throw new Error('Stripe checkout URL was not returned.');
      }

      window.location.href = data.url;
    } catch (err: any) {
      console.error('Checkout error:', err);
      setError(err.message || 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-neutral-900 border border-zinc-800 p-6 rounded-2xl shadow-xl text-zinc-100">
      <h3 className="text-xl font-bold mb-4 text-amber-500">
        Booking Summary
      </h3>

      <p className="mb-2 text-zinc-300">
        <strong className="text-white">Selected Seats:</strong>{' '}
        {selectedSeats.length > 0
          ? selectedSeats.join(', ')
          : 'None'}
      </p>

      <p className="mb-6 text-zinc-300">
        <strong className="text-white">Estimated Total:</strong>{' '}
        ${(totalAmount / 100).toFixed(2)}
      </p>

      {error && (
        <p className="mb-4 text-sm text-red-400">
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={handleCheckout}
        disabled={loading || selectedSeats.length === 0}
        className="w-full bg-amber-500 text-black py-3 rounded-lg font-bold hover:bg-amber-400 disabled:bg-zinc-800 disabled:text-zinc-500 transition"
      >
        {loading ? 'Processing...' : 'Proceed to Checkout'}
      </button>
    </div>
  );
};
