export interface Event {
  id: string;
  title: string;
  description?: string;
  date?: string;
  time?: string;
  location?: string;
  category?: string;
  image?: string;
  minPrice?: number;
  slotId?: string;
}

export interface Slot {
  id: string;
  startTime: string;
  endTime: string;
  capacity: number;
}

export interface Seat {
  id: string;
  seatNumber: string;
  status: 'AVAILABLE' | 'HELD' | 'BOOKED';
  price: number;
  heldUntil?: string | null;
  userId?: string | null;
}