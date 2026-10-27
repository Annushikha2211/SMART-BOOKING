import React from 'react';

interface NavbarProps {
  onOpenLogin: () => void;
  onOpenSignup: () => void;
  onOpenMyTickets?: () => void; // Yeh naya prop add kiya
  onGoHome?: () => void;        // Yeh bhi naya prop add kiya
}

export const Navbar: React.FC<NavbarProps> = ({ 
  onOpenLogin, 
  onOpenSignup, 
  onOpenMyTickets, 
  onGoHome 
}) => {
  const token = localStorage.getItem('token');
  const user = JSON.parse(localStorage.getItem('user') || '{}');

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.reload();
  };

  return (
    <nav className="border-b border-zinc-800 bg-zinc-950/80 backdrop-blur-md px-8 py-4 flex justify-between items-center sticky top-0 z-40">
      {/* Logo / Home Click */}
      <h1 
        onClick={onGoHome} 
        className="text-xl font-black tracking-wider text-amber-500 cursor-pointer"
      >
        RizzTix 🎟️
      </h1>

      <div className="flex items-center gap-4">
        {token ? (
          <>
            {/* My Tickets Button in Navbar */}
            <button
              onClick={onOpenMyTickets}
              className="bg-zinc-900 hover:bg-zinc-800 text-amber-400 border border-zinc-800 px-4 py-2 rounded-xl text-xs font-semibold transition"
            >
              🎟️ My Tickets
            </button>

            <span className="text-xs text-zinc-400 font-medium">
              Hi, {user.name || 'User'}
            </span>

            <button
              onClick={handleLogout}
              className="bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 px-4 py-2 rounded-xl text-xs font-semibold transition"
            >
              Logout
            </button>
          </>
        ) : (
          <>
            <button
              onClick={onOpenLogin}
              className="bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 px-4 py-2 rounded-xl text-xs font-semibold transition"
            >
              Login
            </button>
            <button
              onClick={onOpenSignup}
              className="bg-amber-500 hover:bg-amber-400 text-black px-4 py-2 rounded-xl text-xs font-bold transition shadow-lg shadow-amber-500/10"
            >
              Sign Up
            </button>
          </>
        )}
      </div>
    </nav>
  );
};