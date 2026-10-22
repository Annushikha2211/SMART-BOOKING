import React, { useState } from 'react';
import { Navbar } from './components/Navbar';
import { LandingPage } from './pages/LandingPage';
import { SeatBookingPage } from './pages/SeatBookingPage';
import { Event } from './types/booking';

export const App: React.FC = () => {
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [bookingConfirmed, setBookingConfirmed] = useState(false);

  // Slot ID jo backend mein create kiya tha
  const sampleSlotId = "770f5a07-d3ee-4ec1-baad-f8e12c7a9967";

  return (
    <div className="min-h-screen bg-black text-zinc-100 font-sans selection:bg-amber-500 selection:text-black">
      <Navbar />
      <main className="max-w-7xl mx-auto px-8 pt-8">
        {!selectedEvent ? (
          <LandingPage onSelectEvent={(event) => setSelectedEvent(event)} />
        ) : bookingConfirmed ? (
          <div className="text-center py-16 space-y-4">
            <div className="w-16 h-16 bg-green-500/20 text-green-400 rounded-full flex items-center justify-center mx-auto text-3xl border border-green-500/40">
              ✓
            </div>
            <h2 className="text-3xl font-extrabold text-white">Booking Confirmed!</h2>
            <p className="text-zinc-400 text-sm">Your seats have been booked successfully in the database.</p>
            <button
              onClick={() => {
                setBookingConfirmed(false);
                setSelectedEvent(null);
              }}
              className="bg-amber-500 text-black font-bold px-6 py-2.5 rounded-xl text-sm hover:bg-amber-400 transition"
            >
              Book Another Event
            </button>
          </div>
        ) : (
          <SeatBookingPage
            event={selectedEvent}
            slotId={sampleSlotId}
            onBack={() => setSelectedEvent(null)}
            onBookingComplete={() => setBookingConfirmed(true)}
          />
        )}
      </main>
    </div>
  );
};

export default App;