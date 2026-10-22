import React from 'react';
import { Event } from '../types/booking';

interface LandingPageProps {
  onSelectEvent: (event: Event) => void;
}

const POPULAR_EVENTS: Event[] = [
  {
    id: 'e1',
    title: 'Primal Scream + The Jesus and Mary Chain',
    category: 'Concert',
    date: 'Sep 03',
    time: '10:00 PM',
    location: 'Crystal Palace Bowl, Adelaide',
    image: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&w=800&q=80',
    minPrice: 35.00,
  },
  {
    id: 'e2',
    title: 'Amicorum',
    category: 'Festival',
    date: 'Sep 03',
    time: '08:00 PM',
    location: 'Town Center, Melbourne',
    image: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=800&q=80',
    minPrice: 20.99,
  },
  {
    id: 'e3',
    title: 'Tomorrowland',
    category: 'EDM Fest',
    date: 'Sep 03',
    time: '06:00 PM',
    location: 'Crystal Palace Bowl, Adelaide',
    image: 'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?auto=format&fit=crop&w=800&q=80',
    minPrice: 50.00,
  },
  {
    id: 'e4',
    title: 'Sunburning',
    category: 'Concert',
    date: 'Sep 03',
    time: '09:00 PM',
    location: 'Crystal Palace Bowl, Adelaide',
    image: 'https://images.unsplash.com/photo-1465847899084-d164df4dedc6?auto=format&fit=crop&w=800&q=80',
    minPrice: 35.00,
  },
];

export const LandingPage: React.FC<LandingPageProps> = ({ onSelectEvent }) => {
  return (
    <div className="space-y-10 pb-16">
      {/* Hero Banner (Exact RizzTix Style) */}
      <div className="relative rounded-3xl overflow-hidden h-[420px] flex items-end p-10 border border-zinc-800 shadow-2xl bg-zinc-950">
        <img 
          src="https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&w=1600&q=80" 
          alt="Featured Concert" 
          className="absolute inset-0 w-full h-full object-cover brightness-[0.4]"
        />
        
        {/* Gradient overlay on right */}
        <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/40 to-transparent"></div>

        <div className="relative z-10 space-y-3 max-w-xl">
          <div className="flex items-center gap-2">
            <span className="bg-amber-400 text-black text-[11px] font-extrabold px-2.5 py-0.5 rounded shadow">
              Sep 03
            </span>
            <span className="bg-zinc-900/80 border border-zinc-700 text-zinc-300 text-[11px] font-semibold px-2.5 py-0.5 rounded">
              Concert
            </span>
            <span className="bg-zinc-900/80 border border-zinc-700 text-zinc-300 text-[11px] font-semibold px-2.5 py-0.5 rounded">
              BGM
            </span>
          </div>

          <h1 className="text-3xl lg:text-4xl font-black text-white tracking-tight leading-tight">
            Primal Scream + The Jesus and Mary Chain
          </h1>

          <p className="text-xs text-zinc-300 flex items-center gap-2">
            <span>🕒 10:00 PM to 05:00 AM</span>
            <span>•</span>
            <span>🌐 English</span>
          </p>

          <p className="text-xs text-zinc-400">
            Crystal Palace Bowl, 2ADK8H , Adelaide, AU
          </p>

          <div className="pt-2">
            <button 
              onClick={() => onSelectEvent(POPULAR_EVENTS[0])}
              className="bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-black font-extrabold px-6 py-2.5 rounded-xl text-xs transition shadow-lg shadow-orange-500/30"
            >
              Book Now
            </button>
          </div>

          {/* Carousel Dots */}
          <div className="flex gap-1.5 pt-2">
            <span className="w-4 h-1.5 bg-orange-500 rounded-full"></span>
            <span className="w-1.5 h-1.5 bg-zinc-600 rounded-full"></span>
            <span className="w-1.5 h-1.5 bg-zinc-600 rounded-full"></span>
          </div>
        </div>
      </div>

      {/* Popular Events Section */}
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-extrabold text-white tracking-wide">POPULAR</h2>
            <span className="text-orange-500 font-bold">→</span>
          </div>
          <button className="text-xs text-zinc-400 hover:text-white transition">Explore the most popular events near you</button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {POPULAR_EVENTS.map((event) => (
            <div
              key={event.id}
              onClick={() => onSelectEvent(event)}
              className="bg-zinc-900/90 border border-zinc-800/80 rounded-2xl overflow-hidden hover:border-orange-500/50 hover:scale-[1.02] transition duration-300 cursor-pointer group flex flex-col justify-between shadow-lg"
            >
              <div className="relative h-36 overflow-hidden">
                <img 
                  src={event.image} 
                  alt={event.title} 
                  className="w-full h-full object-cover group-hover:scale-110 transition duration-500"
                />
                <div className="absolute top-2.5 left-2.5 bg-amber-400 text-black text-[10px] font-extrabold px-2 py-0.5 rounded shadow">
                  {event.date}
                </div>
              </div>

              <div className="p-3.5 space-y-2 flex flex-col justify-between flex-grow">
                <div>
                  <h3 className="text-sm font-bold text-white group-hover:text-amber-400 transition line-clamp-1">{event.title}</h3>
                  <p className="text-[11px] text-zinc-400 mt-0.5 truncate">{event.location}</p>
                </div>

                <div className="pt-2 border-t border-zinc-800 flex justify-between items-center">
                  <span className="text-xs font-extrabold text-white">₹ {event.minPrice.toFixed(2)}</span>
                  <span className="bg-orange-500 hover:bg-orange-600 text-black text-[10px] font-bold px-3 py-1.5 rounded-lg transition">
                    Book Now
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};