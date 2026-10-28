
import { useCallback, useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";

const API_URL = "http://localhost:5000";

type SeatStatus = "AVAILABLE" | "HELD" | "BOOKED";

interface Seat {
  id: string;
  seatNumber: string;
  status: SeatStatus;
  userId?: string | null;
  bookingId?: string | null;
  heldUntil?: string | null;
}

interface SeatMapProps {
  eventId: string;
  selectedSeats: string[];
  onSeatSelect: (seatNumber: string) => void;
  onHoldCreated?: (expiresAt: string) => void;
}

function getToken(): string | null {
  return localStorage.getItem("token");
}

async function readError(response: Response): Promise<string> {
  try {
    const data = await response.json();
    return data.message || data.error || "Request failed";
  } catch {
    return `Request failed (${response.status})`;
  }
}

export function SeatMap({
  eventId,
  selectedSeats,
  onSeatSelect,
  onHoldCreated,
}: SeatMapProps) {
  const [seats, setSeats] = useState<Seat[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busySeat, setBusySeat] = useState<string | null>(null);

  const selectedRef = useRef(selectedSeats);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    selectedRef.current = selectedSeats;
  }, [selectedSeats]);

  const fetchSeats = useCallback(async () => {
    if (!eventId) {
      setError("Slot ID is missing.");
      setLoading(false);
      return;
    }

    try {
      setError("");

      const response = await fetch(
        `${API_URL}/api/slots/${encodeURIComponent(eventId)}/seats`
      );

      if (!response.ok) {
        throw new Error(await readError(response));
      }

      const data = await response.json();

      // Supports either { seats: [...] } or a direct array response.
      const rows: Seat[] = Array.isArray(data)
        ? data
        : Array.isArray(data.seats)
          ? data.seats
          : [];

      const now = Date.now();

      const normalized = rows.map((seat) => {
        let status = String(seat.status || "AVAILABLE").toUpperCase();

        // Treat expired holds as available in the UI.
        // The backend remains responsible for validating and releasing them.
        if (
          status === "HELD" &&
          seat.heldUntil &&
          new Date(seat.heldUntil).getTime() <= now
        ) {
          status = "AVAILABLE";
        }

        if (!["AVAILABLE", "HELD", "BOOKED"].includes(status)) {
          status = "AVAILABLE";
        }

        return {
          ...seat,
          status: status as SeatStatus,
        };
      });

      setSeats(normalized);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not load seats."
      );
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  // Load the actual database seat statuses when the slot changes.
  useEffect(() => {
    setLoading(true);
    void fetchSeats();
  }, [fetchSeats]);

  // Keep the map in sync with other users' seat updates.
  useEffect(() => {
    const socket = io(API_URL);
    socketRef.current = socket;

    socket.emit("join_slot", eventId);

    const handleSeatsUpdated = () => {
      void fetchSeats();
    };

    socket.on("seats_updated", handleSeatsUpdated);

    return () => {
      socket.off("seats_updated", handleSeatsUpdated);
      socket.emit("leave_slot", eventId);
      socket.disconnect();
      socketRef.current = null;
    };
  }, [eventId, fetchSeats]);

  const handleSeatClick = async (seat: Seat) => {
    if (busySeat || loading) return;

    const token = getToken();

    if (!token) {
      setError("Please log in before selecting seats.");
      return;
    }

    const isSelected = selectedRef.current.includes(seat.seatNumber);

    if (!isSelected && seat.status !== "AVAILABLE") {
      setError(
        seat.status === "BOOKED"
          ? `${seat.seatNumber} is already booked.`
          : `${seat.seatNumber} is currently held.`
      );
      return;
    }

    setBusySeat(seat.seatNumber);
    setError("");

    try {
      const endpoint = isSelected
        ? "/api/bookings/release"
        : "/api/bookings/hold";

      const response = await fetch(`${API_URL}${endpoint}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          slotId: eventId,
          seatNumbers: [seat.seatNumber],
        }),
      });

      if (!response.ok) {
        throw new Error(await readError(response));
      }

      const data = await response.json();

      if (isSelected) {
        // Remove the seat from the parent selection only after release succeeds.
        onSeatSelect(seat.seatNumber);

        setSeats((current) =>
          current.map((item) =>
            item.seatNumber === seat.seatNumber
              ? {
                  ...item,
                  status: "AVAILABLE",
                  userId: null,
                  heldUntil: null,
                }
              : item
          )
        );
      } else {
        // Add the seat to the parent selection only after hold succeeds.
        onSeatSelect(seat.seatNumber);

        setSeats((current) =>
          current.map((item) =>
            item.seatNumber === seat.seatNumber
              ? {
                  ...item,
                  status: "HELD",
                  heldUntil: data.expiresAt ?? null,
                }
              : item
          )
        );

        if (data.expiresAt) {
          onHoldCreated?.(data.expiresAt);
        }
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not update this seat."
      );

      // Re-read server state after a failed hold or release.
      await fetchSeats();
    } finally {
      setBusySeat(null);
    }
  };

  if (loading) {
    return <p>Loading seats from database...</p>;
  }

  if (seats.length === 0) {
    return (
      <div>
        <p>No seats were returned for this slot.</p>
        {error && <p role="alert">{error}</p>}
        <button type="button" onClick={() => void fetchSeats()}>
          Retry
        </button>
      </div>
    );
  }

  return (
    <section>
      <h2>Select your seats</h2>

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "12px",
          marginBottom: "16px",
          fontSize: "14px",
        }}
      >
        <span>🟩 Available</span>
        <span>🟨 Held / selected</span>
        <span>🟥 Booked</span>
      </div>

      {error && (
        <p role="alert" style={{ color: "crimson", marginBottom: "12px" }}>
          {error}
        </p>
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(8, minmax(36px, 1fr))",
          gap: "8px",
          maxWidth: "520px",
        }}
      >
        {seats.map((seat) => {
          const isSelected = selectedSeats.includes(seat.seatNumber);
          const isBusy = busySeat === seat.seatNumber;
          const isDisabled =
            isBusy ||
            (seat.status !== "AVAILABLE" && !isSelected);

          let background = "#dcfce7";
          if (seat.status === "BOOKED") background = "#fecaca";
          else if (seat.status === "HELD" || isSelected) {
            background = "#fef08a";
          }

          return (
            <button
              key={seat.id || `${eventId}-${seat.seatNumber}`}
              type="button"
              disabled={isDisabled}
              onClick={() => void handleSeatClick(seat)}
              title={`${seat.seatNumber}: ${seat.status}`}
              aria-pressed={isSelected}
              style={{
                minHeight: "40px",
                border: isSelected
                  ? "2px solid #ca8a04"
                  : "1px solid #9ca3af",
                borderRadius: "6px",
                background,
                cursor: isDisabled ? "not-allowed" : "pointer",
                opacity: isDisabled && !isSelected ? 0.65 : 1,
                fontWeight: isSelected ? 700 : 400,
              }}
            >
              {isBusy ? "..." : seat.seatNumber}
            </button>
          );
        })}
      </div>

      <p style={{ marginTop: "12px" }}>
        Selected seats:{" "}
        {selectedSeats.length ? selectedSeats.join(", ") : "None"}
      </p>

      <button
        type="button"
        onClick={() => void fetchSeats()}
        style={{ marginTop: "8px" }}
      >
        Refresh seat availability
      </button>
    </section>
  );
}
