'use client';

import { useEffect, useState } from 'react';

/** Time-of-day greeting, computed after mount so the static HTML never mismatches. */
export function useGreeting() {
  const [greeting, setGreeting] = useState('');
  useEffect(() => {
    const h = new Date().getHours();
    setGreeting(h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening');
  }, []);
  return greeting;
}
