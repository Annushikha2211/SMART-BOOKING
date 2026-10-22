import React from 'react';

export const Navbar: React.FC = () => {
  return (
    <nav className="flex items-center justify-between px-8 py-4 bg-zinc-950 border-b border-zinc-800/80 text-white sticky top-0 z-50">
      {/* Logo */}
      <div className="flex items-center gap-3">
        <div className="bg-gradient-to-r from-orange-600 to-amber-500 text-black font-black px-3 py-1 rounded-lg text-lg tracking-wider shadow-md">
          RIZZ<span className="text-white bg-black/40 px-1.5 py-0.5 rounded ml-0.5">TIX</span>
        </div>
      </div>

      {/* Search Bar */}
      <div className="hidden md:flex items-center gap-4 w-1/3">
        <div className="relative w-full">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-zinc-400 text-xs">🔍</span>
          <input
            type="text"
            placeholder="Find Amazing Events & Artist..."
            className="w-full bg-zinc-900 border border-zinc-800 rounded-full pl-9 pr-4 py-2 text-xs text-zinc-200 focus:outline-none focus:border-amber-500 transition shadow-inner"
          />
        </div>
      </div>

      {/* Right Actions */}
      <div className="flex items-center gap-5 text-xs font-medium">
        <div className="flex items-center gap-1 text-zinc-300 bg-zinc-900 px-3 py-1.5 rounded-full border border-zinc-800">
          <span>📍</span> Melbourne, AU
        </div>
        <button className="text-zinc-300 hover:text-white transition">My Tickets</button>
        
        <div className="flex items-center gap-2 text-zinc-200">
          <div className="w-7 h-7 bg-zinc-800 rounded-full flex items-center justify-center font-bold text-amber-400 border border-zinc-700">
            J
          </div>
          <span>John</span>
        </div>

        <button className="bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-black font-bold px-4 py-2 rounded-xl transition shadow-lg shadow-orange-500/20">
          Get The App
        </button>
      </div>
    </nav>
  );
};