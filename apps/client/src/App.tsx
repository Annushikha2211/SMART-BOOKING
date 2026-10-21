import React, { useEffect, useState } from 'react';

export default function App() {
  const [backendStatus, setBackendStatus] = useState<string>('Checking backend...');

  useEffect(() => {
    fetch('http://localhost:5000/health')
      .then((res) => res.json())
      .then((data) => setBackendStatus(JSON.stringify(data, null, 2)))
      .catch((err) => setBackendStatus('Backend connection failed: ' + err.message));
  }, []);

  return (
    <div style={{ padding: '2rem', fontFamily: 'sans-serif' }}>
      <h1>Smart Booking System</h1>
      <p>Frontend client is successfully running!</p>
      <h3>Backend & DB Health Status:</h3>
      <pre style={{ background: '#f4f4f4', padding: '1rem', borderRadius: '5px' }}>
        {backendStatus}
      </pre>
    </div>
  );
}