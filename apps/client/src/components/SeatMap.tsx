
import React, { useEffect, useState } from 'react';
import { io } from 'socket.io-client';

interface Seat {
  id: string;
  seatNumber: string;
  status: 'AVAILABLE' | 'HELD' | 'BOOKED';
  heldUntil?: string | null;
  userId?: string | null;
}

interface SeatMapProps {
  eventid: string;
  selectedSeats: string[];
  onSeatSelect: (seatNumber: string) => void;
  onHoldCreated: (expiresAt: string) => void;
}

const API_URL = 'http://localhost:5000';

const socket = io(API_URL, {
  autoConnect: true,
  transports: ['websocket'],
});

export const SeatMap: React.FC<SeatMapProps> = ({
  eventid,
  selectedSeats,
  onSeatSelect,
  onHoldCreated,
}) => {
  const [seats, setSeats] = useState<Seat[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingSeat, setProcessingSeat] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!eventid) {
      setError('Slot ID is missing.');
      setLoading(false);
      return;
    }

    let active = true;

    const fetchSeats = async () => {
      try {
        setLoading(true);
        setError('');

        const response = await fetch(
          `${API_URL}/api/slots/${eventid}/seats`
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.message || 'Could not load seats.');
        }

        if (active) {
          setSeats(Array.isArray(data.seats) ? data.seats : []);
        }
      } catch (err: any) {
        if (active) {
          setError(err.message || 'Could not load seats.');
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    fetchSeats();

    socket.emit('join_slot', eventid);

    const handleSeatsUpdated = (updatedData: {
      seatNumbers: string[];
      status: 'AVAILABLE' | 'HELD' | 'BOOKED';
      heldUntil?: string;
    }) => {
      if (!Array.isArray(updatedData.seatNumbers)) return;

      setSeats((previous) =>
        previous.map((seat) =>
          updatedData.seatNumbers.includes(seat.seatNumber)
            ? {
                ...seat,
                status: updatedData.status,
                heldUntil: updatedData.heldUntil ?? null,
              }
            : seat
        )
      );
    };

    socket.on('seats_updated', handleSeatsUpdated);

    return () => {
      active = false;
      socket.off('seats_updated', handleSeatsUpdated);
      socket.emit('leave_slot', eventid);
    };
  }, [eventid]);

  const handleSeatClick = async (seat: Seat) => {
    const token = localStorage.getItem('token');

    if (!token) {
      setError('Please login before selecting seats.');
      return;
    }

    if (processingSeat) return;

    const isSelected = selectedSeats.includes(seat.seatNumber);

    if (!isSelected && seat.status !== 'AVAILABLE') {
      setError('This seat is no longer available.');
      return;
    }

    try {
      setProcessingSeat(seat.seatNumber);
      setError('');

      const endpoint = isSelected
        ? `${API_URL}/api/bookings/release`
        : `${API_URL}/api/bookings/hold`;

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          slotId: eventid,
          seatNumbers: [seat.seatNumber],
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || data.error || 'Could not update seat selection.'
        );
      }

      if (isSelected) {
        onSeatSelect(seat.seatNumber);

        setSeats((previous) =>
          previous.map((item) =>
            item.seatNumber === seat.seatNumber
              ? {
                  ...item,
                  status: 'AVAILABLE',
                  heldUntil: null,
                  userId: null,
                }
              : item
          )
        );
      } else {
        if (!data.expiresAt) {
          throw new Error('Server did not return hold expiry time.');
        }

        onSeatSelect(seat.seatNumber);
        onHoldCreated(data.expiresAt);

        setSeats((previous) =>
          previous.map((item) =>
            item.seatNumber === seat.seatNumber
              ? {
                  ...item,
                  status: 'HELD',
                  heldUntil: data.expiresAt,
                }
              : item
          )
        );
      }
    } catch (err: any) {
      console.error('Seat selection error:', err);
      setError(err.message || 'Something went wrong.');
    } finally {
      setProcessingSeat(null);
    }
  };

  if (loading) {
    return (
      <div className="bg-white p-6 rounded-xl">
        Loading seats...
      </div>
    );
  }

  return (
    <div className="bg-white p-6 rounded-xl shadow-md border">
      <h3 className="text-xl font-bold mb-4">Select Your Seats</h3>

      {error && (
        <p className="bg-red-100 text-red-700 p-3 rounded mb-4 text-sm">
          {error}
        </p>
      )}

      <div className="flex flex-wrap gap-4 mb-5 text-xs">
        <span className="text-green-700">● Available</span>
        <span className="text-orange-600">● Selected / Held by you</span>
        <span className="text-gray-500">● Unavailable</span>
      </div>

      {seats.length === 0 ? (
        <p className="text-gray-600">
          No seats have been created for this slot yet.
        </p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {seats.map((seat) => {
            const isSelected = selectedSeats.includes(seat.seatNumber);
            const isUnavailable =
              seat.status !== 'AVAILABLE' && !isSelected;

            return (
              <button
                type="button"
                key={seat.id}
                disabled={isUnavailable || processingSeat !== null}
                onClick={() => handleSeatClick(seat)}
                className={`p-4 rounded-lg font-bold transition ${
                  isSelected
                    ? 'bg-orange-500 text-black'
                    : isUnavailable
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-green-100 text-green-800 hover:bg-green-200'
                }`}
              >
                {processingSeat === seat.seatNumber
                  ? 'Please wait...'
                  : `${seat.seatNumber} (${isSelected ? 'YOUR HOLD' : seat.status})`}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
