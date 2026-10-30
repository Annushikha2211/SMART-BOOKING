import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '10s', target: 50 },  // Ramp up to 50 virtual users
    { duration: '20s', target: 200 }, // Spike to 200 concurrent users hitting same seat
    { duration: '10s', target: 0 },   // Ramp down
  ],
};

const BASE_URL = 'http://localhost:5000/api/bookings/hold';

export default function () {
  const payload = JSON.stringify({
    eventId: "test-slot-1",
    seats: ["A1"],
  });

  const params = {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer test-token-123',
    },
  };

  const res = http.post(BASE_URL, payload, params);

  check(res, {
    'is status 200 or 409': (r) => r.status === 200 || r.status === 409,
  });

  sleep(1);
}