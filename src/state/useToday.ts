import { useEffect, useState } from 'react';

import { toISODate } from '@/lib/dates';
import type { ISODate } from '@/lib/types';

const currentDate = () => toISODate(new Date());

/** Today's date, refreshed every minute so the app rolls over at midnight. */
export function useToday(): ISODate {
  const [today, setToday] = useState(currentDate);
  useEffect(() => {
    const id = setInterval(
      () =>
        setToday((prev) => {
          const now = currentDate();
          return prev === now ? prev : now;
        }),
      60_000,
    );
    return () => clearInterval(id);
  }, []);
  return today;
}

/** Minutes since midnight, refreshed every minute. */
export function useNowMinutes(): number {
  const read = () => {
    const d = new Date();
    return d.getHours() * 60 + d.getMinutes();
  };
  const [now, setNow] = useState(read);
  useEffect(() => {
    const id = setInterval(() => setNow(read()), 60_000);
    return () => clearInterval(id);
  }, []);
  return now;
}
