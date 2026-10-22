import React from 'react';
import { Event } from '../types/booking';

interface EventCardProps {
  event: Event;
  onSelect: (event: Event) => void;
}

export const EventCard: React.FC<EventCardProps> = ({ event, onSelect }) => {
  return (
    <div 
      onClick={() => onSelect(event)}
      className="bg-zinc-900/80 border border-zinc-800 rounded-2xl overflow-hidden hover:border-amber-500/50 hover:scale-[1.02] transition duration-300 cursor-pointer group flex flex-col justify-between"
    >
      <div className="relative h-48 overflow-hidden">
        <img 
          src={event.image} 
          alt={event.title} 
          className="w-full h-full object-cover group-hover:scale-110 transition duration-500"
        />
        <div className="absolute top-3 left-3 bg-amber-500 text-black text-xs font-bold px-2.5 py-1 rounded-md shadow">
          {event.date}
        </div>
      </div>

      <div className="p-4 flex flex-col justify-between flex-grow">
        <div>
          <span className="text-xs text-amber-400 font-semibold uppercase tracking-wider">{event.category}</span>
          <h3 className="text-lg font-bold text-white mt-1 group-hover:text-amber-400 transition">{event.title}</h3>
          <p className="text-xs text-zinc-400 mt-2 flex items-center gap-1">📍 {event.location}</p>
        </div>

        <div className="mt-4 pt-3 border-t border-zinc-800 flex justify-between items-center">
          <div>
            <span className="text-[10px] text-zinc-500 block">Starting from</span>
            <span className="text-amber-400 font-bold text-base">₹{event.minPrice}</span>
          </div>
          <button className="bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold px-4 py-2 rounded-xl transition">
            Book Now
          </button>
        </div>
      </div>
    </div>
  );
};