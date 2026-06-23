import {useState} from 'react';
import {useInterval} from './useInterval.js';

/** A clock that re-renders every second. */
export function useNow(): Date {
	const [now, setNow] = useState<Date>(() => new Date());
	useInterval(() => setNow(new Date()), 1000);
	return now;
}

/** "14:23:07 UTC" */
export const fmtClock = (d: Date): string =>
	d.toISOString().slice(11, 19) + ' UTC';

/** "Mon 22 Jun 2026" */
export const fmtDate = (d: Date): string =>
	d.toUTCString().slice(0, 16);
