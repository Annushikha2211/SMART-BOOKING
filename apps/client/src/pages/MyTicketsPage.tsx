import React, { useEffect, useState } from 'react';

interface Booking {
  id: string;
  slotId: string;
  seats: { id: string; seatNumber: string }[];
  status: string;
  createdAt: string;
}

interface MyTicketsPageProps {
  onBack: () => void;
}

export const MyTicketsPage: React.FC<MyTicketsPageProps> = ({ onBack }) => {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const fetchBookings = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('http://localhost:5000/api/bookings/my', {
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      const data = await res.json();
      if (res.ok) {
        setBookings(data.bookings || []);
      }
    } catch (err) {
      console.error('Error fetching bookings:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBookings();
    
    // Webhook polling sync for real-time ticket appearance
    const interval = setInterval(fetchBookings, 3000);
    const timeout = setTimeout(() => clearInterval(interval), 15000);

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, []);

  return (
    <div className="min-h-screen bg-zinc-950 text-white p-8">
      {/* Top Header */}
      <button
        onClick={onBack}
        className="text-sm text-zinc-400 hover:text-white mb-6 flex items-center gap-1 transition-colors"
      >
        ← Back to Dashboard
      </button>

      <h1 className="text-3xl font-bold mb-6">My Booked Tickets</h1>

      {loading ? (
        <p className="text-zinc-400">Loading your tickets...</p>
      ) : bookings.length === 0 ? (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-8 text-center text-zinc-400 shadow-xl">
          <p>Aapne abhi tak koi booking confirm nahi ki hai!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {bookings.map((booking) => (
            <div
              key={booking.id}
              className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-xl space-y-4 relative overflow-hidden"
            >
              <div className="flex justify-between items-center">
                <span className="text-xs uppercase tracking-wider text-green-400 font-semibold px-3 py-1 bg-green-500/10 rounded-full border border-green-500/20">
                  {booking.status}
                </span>
                <span className="text-xs text-zinc-500">
                  {new Date(booking.createdAt).toLocaleDateString()}
                </span>
              </div>

              <div>
                <p className="text-xs text-zinc-400">Slot Reference</p>
                <p className="text-sm font-mono text-zinc-200 truncate">{booking.slotId}</p>
              </div>

              <div>
                <p className="text-xs text-zinc-400 mb-1.5">Reserved Seats</p>
                <div className="flex flex-wrap gap-1.5">
                  {booking.seats?.map((seat) => (
                    <span
                      key={seat.id}
                      className="px-2.5 py-1 bg-zinc-800 border border-zinc-700 text-orange-400 font-mono text-xs rounded-lg"
                    >
                      {seat.seatNumber}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};