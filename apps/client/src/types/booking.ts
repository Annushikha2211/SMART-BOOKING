export interface Event {
  id: string;
  title: string;
  category: string;
  date: string;
  time: string;
  location: string;
  image: string;
  minPrice: number;
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
}