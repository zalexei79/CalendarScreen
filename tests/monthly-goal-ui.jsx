import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import MonthlyGoal from '../MonthlyGoal';

function Fixture() {
  const [month, setMonth] = useState(8);
  const [year, setYear] = useState(2026);
  const [currency, setCurrency] = useState('USD');
  const [userId, setUserId] = useState('alice');
  const [earned, setEarned] = useState(false);
  return <>
    <button onClick={() => setMonth(7)}>August</button>
    <button onClick={() => setMonth(8)}>September</button>
    <button onClick={() => setEarned(true)}>Earn</button>
    <button onClick={() => setYear(year === 2026 ? 2025 : 2026)}>Year</button>
    <button onClick={() => setCurrency(currency === 'USD' ? 'EUR' : 'USD')}>Currency</button>
    <button onClick={() => setUserId(userId === 'alice' ? 'bob' : 'alice')}>User</button>
    <MonthlyGoal year={year} month={month} currency={currency} userId={userId}
      currentPnl={month === 7 ? 142 : earned ? 120 : 42} language="en" isLight />
  </>;
}

createRoot(document.getElementById('root')).render(<Fixture />);
