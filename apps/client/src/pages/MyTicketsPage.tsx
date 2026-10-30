
import React, { useEffect, useState } from 'react';

interface Seat {
  id: string;
  seatNumber: string;
  status: string;
}

interface Booking {
  id: string;
  slotId: string;
  seats: Seat[];
  amount: number | null;
  status: string;
  createdAt: string;
}

interface MyTicketsPageProps {
  onBack?: () => void;
}

export const MyTicketsPage: React.FC<MyTicketsPageProps> = ({
  onBack,
}) => {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchMyTickets = async () => {
      try {
        const token = localStorage.getItem('token');

        if (!token) {
          setError('Please login to view your tickets.');
          return;
        }

        const response = await fetch(
          'http://localhost:5000/api/bookings/my',
          {
            method: 'GET',
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.message || 'Could not load your tickets.');
        }

        setBookings(
          Array.isArray(data.bookings) ? data.bookings : []
        );
      } catch (error: any) {
        console.error('My tickets error:', error);
        setError(error.message || 'Something went wrong.');
      } finally {
        setLoading(false);
      }
    };

    fetchMyTickets();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-950 text-white flex items-center justify-center">
        Loading your tickets...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-white p-6">
      <div className="max-w-4xl mx-auto">
        {onBack && (
          <button
            onClick={onBack}
            className="mb-6 text-amber-400 hover:text-amber-300"
          >
            ← Back
          </button>
        )}

        <h1 className="text-3xl font-bold mb-2">
          My Booked Tickets
        </h1>

        <p className="text-zinc-400 mb-8">
          Your confirmed event bookings appear here.
        </p>

        {error ? (
          <div className="bg-red-950/40 border border-red-800 rounded-xl p-5 text-red-300">
            {error}
          </div>
        ) : bookings.length === 0 ? (
          <div className="bg-neutral-900 border border-zinc-800 rounded-xl p-8 text-center">
            <h2 className="text-xl font-semibold mb-2">
              No bookings found yet.
            </h2>
            <p className="text-zinc-400">
              Your confirmed tickets will appear here after payment is verified.
            </p>
          </div>
        ) : (
          <div className="space-y-5">
            {bookings.map((booking) => (
              <div
                key={booking.id}
                className="bg-neutral-900 border border-zinc-800 rounded-xl p-6"
              >
                <div className="flex flex-wrap justify-between gap-3 mb-4">
                  <div>
                    <p className="text-sm text-zinc-400">
                      Booking ID
                    </p>
                    <p className="font-mono text-sm break-all">
                      {booking.id}
                    </p>
                  </div>

                  <span className="h-fit px-3 py-1 rounded-full text-sm bg-green-950 text-green-400">
                    {booking.status}
                  </span>
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-zinc-400 mb-1">
                      Selected Seats
                    </p>
                    <p className="font-semibold">
                      {booking.seats?.length
                        ? booking.seats
                            .map((seat) => seat.seatNumber)
                            .join(', ')
                        : 'Seat details unavailable'}
                    </p>
                  </div>

                  <div>
                    <p className="text-sm text-zinc-400 mb-1">
                      Total Amount
                    </p>
                    <p className="font-semibold text-amber-400">
                      ${(Number(booking.amount || 0) / 100).toFixed(2)}
                    </p>

                    <div className="mt-4 flex justify-end">
              <button
                onClick={() => window.print()}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-black font-semibold rounded-lg transition cursor-pointer"
              >
                📥 Download Ticket PDF
              </button>
            </div>
            
                  </div>

                  <div>
                    <p className="text-sm text-zinc-400 mb-1">
                      Booking Date
                    </p>
                    <p>
                      {new Date(booking.createdAt).toLocaleString()}
                    </p>
                  </div>

                  <div>
                    <p className="text-sm text-zinc-400 mb-1">
                      Slot ID
                    </p>
                    <p className="font-mono text-sm break-all">
                      {booking.slotId}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
