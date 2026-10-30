
import React, { useEffect, useState } from 'react';
import { Event, Slot } from '../types/booking';

interface LandingPageProps {
  onSelectEvent: (event: Event) => void;
}

const API_URL = 'http://localhost:5000';

export const LandingPage: React.FC<LandingPageProps> = ({
  onSelectEvent,
}) => {
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchSlots = async () => {
      try {
        setLoading(true);
        setError('');

        const response = await fetch(`${API_URL}/api/slots`);
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.message || 'Could not load slots.');
        }

        setSlots(Array.isArray(data.slots) ? data.slots : []);
      } catch (err: any) {
        console.error('Fetch slots error:', err);
        setError(err.message || 'Something went wrong.');
      } finally {
        setLoading(false);
      }
    };

    fetchSlots();
  }, []);

  const selectSlot = (slot: Slot) => {
    const event: Event = {
      id: slot.id,
      slotId: slot.id,
      title: 'RizzTix Booking',
      date: new Date(slot.startTime).toLocaleDateString(),
      time: new Date(slot.startTime).toLocaleTimeString(),
      location: 'Available booking slot',
      category: 'Booking',
      minPrice: 5,
    };

    onSelectEvent(event);
  };

  return (
    <div className="space-y-8 pb-16">
      <div className="relative rounded-3xl overflow-hidden min-h-[320px] flex items-center p-8 md:p-10 border border-zinc-800 bg-zinc-950">
        <div className="absolute inset-0 bg-gradient-to-r from-orange-950 via-zinc-950 to-black" />

        <div className="relative z-10 max-w-xl space-y-4">
          <span className="text-orange-400 font-bold text-xs tracking-widest">
            RIZZ TIX
          </span>

          <h1 className="text-3xl md:text-5xl font-black text-white">
            Book Your Seats.
            <span className="text-orange-500"> Live.</span>
          </h1>

          <p className="text-zinc-300 text-sm">
            Choose an available slot, select your seats and complete your booking.
          </p>

          <a
            href="#available-slots"
            className="inline-block bg-orange-500 hover:bg-orange-600 text-black font-bold px-6 py-3 rounded-xl transition"
          >
            Explore Slots
          </a>
        </div>
      </div>

      <section id="available-slots" className="space-y-5">
        <div>
          <h2 className="text-xl font-extrabold text-white">
            AVAILABLE SLOTS
          </h2>
          <p className="text-sm text-zinc-400 mt-1">
            These slots are loaded directly from your database.
          </p>
        </div>

        {loading && (
          <p className="text-zinc-300">Loading available slots...</p>
        )}

        {error && (
          <div className="bg-red-950/40 border border-red-800 rounded-xl p-4 text-red-300">
            {error}
          </div>
        )}

        {!loading && !error && slots.length === 0 && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-8 text-center">
            <h3 className="text-white font-bold text-lg">
              No upcoming slots found
            </h3>
            <p className="text-zinc-400 text-sm mt-2">
              Create a future Slot and its Seat records in your database first.
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {slots.map((slot) => {
            const availableSeats = (slot as any).availableSeats ?? 0;

            return (
              <div
                key={slot.id}
                className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-4"
              >
                <div>
                  <span className="text-orange-400 text-xs font-bold">
                    DATABASE SLOT
                  </span>

                  <h3 className="text-white text-lg font-bold mt-2">
                    RizzTix Booking Slot
                  </h3>

                  <p className="text-zinc-400 text-sm mt-2">
                    Starts: {new Date(slot.startTime).toLocaleString()}
                  </p>

                  <p className="text-zinc-400 text-sm">
                    Ends: {new Date(slot.endTime).toLocaleString()}
                  </p>
                </div>

                <div className="flex justify-between text-sm border-t border-zinc-800 pt-4">
                  <span className="text-zinc-400">
                    Capacity: {slot.capacity}
                  </span>

                  <span className="text-green-400 font-bold">
                    Available: {availableSeats}
                  </span>
                </div>

                <button
                  type="button"
                  disabled={availableSeats === 0}
                  onClick={() => selectSlot(slot)}
                  className="w-full bg-orange-500 hover:bg-orange-600 disabled:bg-zinc-700 disabled:text-zinc-400 text-black font-bold py-3 rounded-xl transition"
                >
                  {availableSeats === 0 ? 'Sold Out' : 'Select Seats'}
                </button>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
};
