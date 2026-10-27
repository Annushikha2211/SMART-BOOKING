import React, { useState } from 'react';
import { Navbar } from './components/Navbar';
import { LandingPage } from './pages/LandingPage';
import { SeatBookingPage } from './pages/SeatBookingPage';
import { Event } from './types/booking';
import { MyTicketsPage } from './pages/MyTicketsPage';

type AuthModalMode = 'NONE' | 'LOGIN' | 'SIGNUP_STEP_1' | 'SIGNUP_STEP_2' | 'FORGOT_STEP_1' | 'FORGOT_STEP_2';

export const App: React.FC = () => {
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [bookingConfirmed, setBookingConfirmed] = useState(false);
  
  // Auth Modal State Management
  const [modalMode, setModalMode] = useState<AuthModalMode>('NONE');
  const [currentView, setCurrentView] = useState<'events' | 'booking' | 'my-tickets'>('events');

  // Form States
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [loading, setLoading] = useState(false);

  // Sample Slot ID
  const sampleSlotId = "770f5a07-d3ee-4ec1-baad-f8e12c7a9967";

  const resetFormState = () => {
    setEmail('');
    setPassword('');
    setName('');
    setOtp('');
    setNewPassword('');
    setError('');
    setSuccessMsg('');
  };

  const closeModal = () => {
    setModalMode('NONE');
    resetFormState();
  };

  // 1. Standard Login
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('http://localhost:5000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();

      if (res.ok && data.status === 'Success') {
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        closeModal();
        window.location.reload();
      } else {
        setError(data.message || 'Login failed');
      }
    } catch {
      setError('Server down or network error');
    } finally {
      setLoading(false);
    }
  };

  // 2. Signup Step 1: Send OTP
  const handleSendSignupOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('http://localhost:5000/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();

      if (res.ok && data.status === 'Success') {
        setModalMode('SIGNUP_STEP_2');
      } else {
        setError(data.message || 'Failed to send OTP');
      }
    } catch {
      setError('Server down or network error');
    } finally {
      setLoading(false);
    }
  };

  // 3. Signup Step 2: Verify OTP & Create Account
  const handleVerifySignupOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('http://localhost:5000/api/auth/verify-signup-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password, otp }),
      });
      const data = await res.json();

      if (res.ok && data.status === 'Success') {
        setSuccessMsg('Account created successfully! Please login.');
        setModalMode('LOGIN');
      } else {
        setError(data.message || 'OTP verification failed');
      }
    } catch {
      setError('Server down or network error');
    } finally {
      setLoading(false);
    }
  };

  // 4. Forgot Password Step 1: Request Reset OTP
  const handleSendForgotOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('http://localhost:5000/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();

      if (res.ok && data.status === 'Success') {
        setModalMode('FORGOT_STEP_2');
      } else {
        setError(data.message || 'Failed to send reset code');
      }
    } catch {
      setError('Server down or network error');
    } finally {
      setLoading(false);
    }
  };

  // 5. Forgot Password Step 2: Reset Password with OTP
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('http://localhost:5000/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp, newPassword }),
      });
      const data = await res.json();

      if (res.ok && data.status === 'Success') {
        setSuccessMsg('Password reset successful! Please login with your new password.');
        setModalMode('LOGIN');
      } else {
        setError(data.message || 'Failed to reset password');
      }
    } catch {
      setError('Server down or network error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-zinc-100 font-sans selection:bg-amber-500 selection:text-black">
      <Navbar 
        onOpenLogin={() => { resetFormState(); setModalMode('LOGIN'); }}
        onOpenSignup={() => { resetFormState(); setModalMode('SIGNUP_STEP_1'); }}
        onOpenMyTickets={() => setCurrentView('my-tickets')}
        onGoHome={() => { setCurrentView('events'); setSelectedEvent(null); }}
      />

      <main className="max-w-7xl mx-auto px-8 pt-8">
        {currentView === 'my-tickets' ? (
          <MyTicketsPage onBack={() => setCurrentView('events')} />
        ) : !selectedEvent ? (
          <LandingPage onSelectEvent={(event) => { setSelectedEvent(event); setCurrentView('booking'); }} />
        ) : bookingConfirmed ? (
          <div className="text-center py-16 space-y-4">
            <div className="w-16 h-16 bg-green-500/20 text-green-400 rounded-full flex items-center justify-center mx-auto text-3xl border border-green-500/40">
              ✓
            </div>
            <h2 className="text-3xl font-extrabold text-white">Booking Confirmed!</h2>
            <p className="text-zinc-400 text-sm">Your seats have been booked successfully in the database.</p>
            <div className="flex justify-center gap-4">
              <button
                onClick={() => {
                  setBookingConfirmed(false);
                  setSelectedEvent(null);
                  setCurrentView('my-tickets');
                }}
                className="bg-zinc-800 text-zinc-200 font-bold px-6 py-2.5 rounded-xl text-sm hover:bg-zinc-700 transition border border-zinc-700"
              >
                View My Tickets
              </button>
              <button
                onClick={() => {
                  setBookingConfirmed(false);
                  setSelectedEvent(null);
                  setCurrentView('events');
                }}
                className="bg-amber-500 text-black font-bold px-6 py-2.5 rounded-xl text-sm hover:bg-amber-400 transition"
              >
                Book Another Event
              </button>
            </div>
          </div>
        ) : (
          <SeatBookingPage
            event={selectedEvent}
            slotId={sampleSlotId}
            onBack={() => { setSelectedEvent(null); setCurrentView('events'); }}
            onBookingComplete={() => setBookingConfirmed(true)}
          />
        )}
      </main>

      {/* --- AUTH MODAL SYSTEM --- */}
      {modalMode !== 'NONE' && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-xl w-full max-w-md text-white space-y-4 shadow-2xl">
            
            {/* Status Messages */}
            {error && <p className="text-red-400 text-xs bg-red-500/10 p-2.5 rounded border border-red-500/20">{error}</p>}
            {successMsg && <p className="text-green-400 text-xs bg-green-500/10 p-2.5 rounded border border-green-500/20">{successMsg}</p>}

            {/* Mode 1: LOGIN */}
            {modalMode === 'LOGIN' && (
              <>
                <h3 className="text-xl font-bold">Welcome Back</h3>
                <form onSubmit={handleLogin} className="space-y-3">
                  <div>
                    <label className="text-xs text-zinc-400 block mb-1">Email</label>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-sm focus:outline-none focus:border-amber-500"
                      placeholder="Enter your email"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-zinc-400 block mb-1">Password</label>
                    <input
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-sm focus:outline-none focus:border-amber-500"
                      placeholder="Enter your password"
                    />
                  </div>
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => { setError(''); setSuccessMsg(''); setModalMode('FORGOT_STEP_1'); }}
                      className="text-xs text-amber-500 hover:underline"
                    >
                      Forgot Password?
                    </button>
                  </div>
                  <div className="flex gap-2 pt-2">
                    <button
                      type="button"
                      onClick={closeModal}
                      className="bg-zinc-800 text-zinc-300 font-bold px-4 py-2 rounded-lg w-1/2 text-xs hover:bg-zinc-700 transition"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={loading}
                      className="bg-amber-500 text-black font-bold px-4 py-2 rounded-lg w-1/2 text-xs hover:bg-amber-400 transition"
                    >
                      {loading ? 'Logging in...' : 'Login'}
                    </button>
                  </div>
                </form>
              </>
            )}

            {/* Mode 2: SIGNUP STEP 1 */}
            {modalMode === 'SIGNUP_STEP_1' && (
              <>
                <h3 className="text-xl font-bold">Create Account</h3>
                <form onSubmit={handleSendSignupOTP} className="space-y-3">
                  <div>
                    <label className="text-xs text-zinc-400 block mb-1">Full Name</label>
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-sm focus:outline-none focus:border-amber-500"
                      placeholder="Enter full name"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-zinc-400 block mb-1">Email</label>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-sm focus:outline-none focus:border-amber-500"
                      placeholder="Enter email"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-zinc-400 block mb-1">Password</label>
                    <input
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-sm focus:outline-none focus:border-amber-500"
                      placeholder="Create password"
                    />
                  </div>
                  <div className="flex gap-2 pt-2">
                    <button
                      type="button"
                      onClick={closeModal}
                      className="bg-zinc-800 text-zinc-300 font-bold px-4 py-2 rounded-lg w-1/2 text-xs hover:bg-zinc-700 transition"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={loading}
                      className="bg-amber-500 text-black font-bold px-4 py-2 rounded-lg w-1/2 text-xs hover:bg-amber-400 transition"
                    >
                      {loading ? 'Sending OTP...' : 'Get OTP Code'}
                    </button>
                  </div>
                </form>
              </>
            )}

            {/* Mode 3: SIGNUP STEP 2 */}
            {modalMode === 'SIGNUP_STEP_2' && (
              <>
                <h3 className="text-xl font-bold">Enter OTP Code</h3>
                <p className="text-xs text-zinc-400">We sent a 6-digit verification code to <span className="text-amber-500 font-medium">{email}</span></p>
                <form onSubmit={handleVerifySignupOTP} className="space-y-3">
                  <div>
                    <label className="text-xs text-zinc-400 block mb-1">OTP Code</label>
                    <input
                      type="text"
                      required
                      maxLength={6}
                      value={otp}
                      onChange={(e) => setOtp(e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-center text-lg tracking-widest font-mono focus:outline-none focus:border-amber-500"
                      placeholder="123456"
                    />
                  </div>
                  <div className="flex gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setModalMode('SIGNUP_STEP_1')}
                      className="bg-zinc-800 text-zinc-300 font-bold px-4 py-2 rounded-lg w-1/2 text-xs hover:bg-zinc-700 transition"
                    >
                      Back
                    </button>
                    <button
                      type="submit"
                      disabled={loading}
                      className="bg-amber-500 text-black font-bold px-4 py-2 rounded-lg w-1/2 text-xs hover:bg-amber-400 transition"
                    >
                      {loading ? 'Verifying...' : 'Verify & Register'}
                    </button>
                  </div>
                </form>
              </>
            )}

            {/* Mode 4: FORGOT PASSWORD STEP 1 */}
            {modalMode === 'FORGOT_STEP_1' && (
              <>
                <h3 className="text-xl font-bold">Reset Password</h3>
                <p className="text-xs text-zinc-400">Enter your email to receive a password reset code.</p>
                <form onSubmit={handleSendForgotOTP} className="space-y-3">
                  <div>
                    <label className="text-xs text-zinc-400 block mb-1">Email</label>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-sm focus:outline-none focus:border-amber-500"
                      placeholder="Enter registered email"
                    />
                  </div>
                  <div className="flex gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setModalMode('LOGIN')}
                      className="bg-zinc-800 text-zinc-300 font-bold px-4 py-2 rounded-lg w-1/2 text-xs hover:bg-zinc-700 transition"
                    >
                      Back
                    </button>
                    <button
                      type="submit"
                      disabled={loading}
                      className="bg-amber-500 text-black font-bold px-4 py-2 rounded-lg w-1/2 text-xs hover:bg-amber-400 transition"
                    >
                      {loading ? 'Sending...' : 'Send Reset Code'}
                    </button>
                  </div>
                </form>
              </>
            )}

            {/* Mode 5: FORGOT PASSWORD STEP 2 */}
            {modalMode === 'FORGOT_STEP_2' && (
              <>
                <h3 className="text-xl font-bold">New Password</h3>
                <form onSubmit={handleResetPassword} className="space-y-3">
                  <div>
                    <label className="text-xs text-zinc-400 block mb-1">OTP Code</label>
                    <input
                      type="text"
                      required
                      maxLength={6}
                      value={otp}
                      onChange={(e) => setOtp(e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-center text-lg tracking-widest font-mono focus:outline-none focus:border-amber-500"
                      placeholder="123456"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-zinc-400 block mb-1">New Password</label>
                    <input
                      type="password"
                      required
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-sm focus:outline-none focus:border-amber-500"
                      placeholder="Enter new password"
                    />
                  </div>
                  <div className="flex gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setModalMode('FORGOT_STEP_1')}
                      className="bg-zinc-800 text-zinc-300 font-bold px-4 py-2 rounded-lg w-1/2 text-xs hover:bg-zinc-700 transition"
                    >
                      Back
                    </button>
                    <button
                      type="submit"
                      disabled={loading}
                      className="bg-amber-500 text-black font-bold px-4 py-2 rounded-lg w-1/2 text-xs hover:bg-amber-400 transition"
                    >
                      {loading ? 'Updating...' : 'Update Password'}
                    </button>
                  </div>
                </form>
              </>
            )}

          </div>
        </div>
      )}
    </div>
  );
};

export default App;