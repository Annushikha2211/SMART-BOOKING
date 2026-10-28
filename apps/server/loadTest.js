
const BASE_URL = "http://localhost:5000";

const EMAIL = "annushikha1508@gmail.com";
const PASSWORD = "123456";
 
// Database mein existing slot ki actual ID daalo.
const SLOT_ID = "770f5a07-d3ee-4ec1-baad-f8e12c7a9967";

const TOTAL_REQUESTS = 5;

async function testConcurrency() {
  try {
    // Step 1: Login
    const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
    });

    const loginData = await loginRes.json();

    if (!loginRes.ok || !loginData.token) {
      throw new Error(`Login failed: ${loginData.message || loginRes.status}`);
    }

    const token = loginData.token;
    console.log("Login successful. Token received.");

    // Step 2: Send concurrent requests for the same seat
    const requests = Array.from({ length: TOTAL_REQUESTS }, async (_, i) => {
      try {
        const res = await fetch(`${BASE_URL}/api/bookings/hold`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            slotId: SLOT_ID,
            seatNumbers: ["A1"],
          }),
        });

        const data = await res.json();

        console.log(`Request ${i + 1}: Status ${res.status}`, data);
        return res.status;
      } catch (error) {
        console.error(`Request ${i + 1} failed:`, error.message);
        return null;
      }
    });

    const results = await Promise.all(requests);

    console.log("\n--- Test Summary ---");
    console.log("Success:", results.filter(s => s === 200).length);
    console.log("Conflict:", results.filter(s => s === 409).length);
    console.log("Unauthorized:", results.filter(s => s === 401).length);
  } catch (error) {
    console.error("Concurrency test failed:", error.message);
  }
}

testConcurrency();



