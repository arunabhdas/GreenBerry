/** Small formatting + chart helpers shared across panels. */

export const clamp = (v: number, lo: number, hi: number): number =>
	Math.max(lo, Math.min(hi, v));

/** Compact USD: $1.2B / $34M / $920K / $250 */
export const fmtUsd = (n: number): string => {
	const a = Math.abs(n);
	const sign = n < 0 ? '-' : '';
	if (a >= 1e9) return `${sign}$${(a / 1e9).toFixed(1)}B`;
	if (a >= 1e6) return `${sign}$${(a / 1e6).toFixed(1)}M`;
	if (a >= 1e3) return `${sign}$${(a / 1e3).toFixed(0)}K`;
	return `${sign}$${a.toFixed(0)}`;
};

/** Prediction-market price in cents (0-100). */
export const cents = (n: number): string => `${Math.round(n)}¢`;

/** Implied probability label. */
export const prob = (n: number): string => `${Math.round(n)}%`;

export const signed = (n: number, digits = 0): string =>
	`${n > 0 ? '+' : n < 0 ? '' : '±'}${n.toFixed(digits)}`;

export const arrow = (n: number): string => (n > 0 ? '▲' : n < 0 ? '▼' : '·');

/** "3m" / "2h" / "1h12m" relative time from minutes-ago. */
export const ago = (mins: number): string => {
	if (mins < 1) return 'now';
	if (mins < 60) return `${mins}m`;
	const h = Math.floor(mins / 60);
	const m = mins % 60;
	return m ? `${h}h${m}m` : `${h}h`;
};

/** Truncate to width with an ellipsis. */
export const trunc = (s: string, width: number): string =>
	s.length <= width ? s : s.slice(0, Math.max(0, width - 1)) + '…';

/** Pad/truncate to an exact column width (left-aligned). */
export const fit = (s: string, width: number): string =>
	trunc(s, width).padEnd(width);

const BLOCKS = '▁▂▃▄▅▆▇█'; // ▁▂▃▄▅▆▇█

/** Render an array of numbers as a unicode sparkline string. */
export const sparkline = (values: number[]): string => {
	if (values.length === 0) return '';
	const min = Math.min(...values);
	const max = Math.max(...values);
	const range = max - min || 1;
	return values
		.map(v => {
			const idx = Math.round(((v - min) / range) * (BLOCKS.length - 1));
			return BLOCKS[clamp(idx, 0, BLOCKS.length - 1)];
		})
		.join('');
};

/** Horizontal meter bar built from block chars. */
export const bar = (pct: number, width: number): string => {
	const filled = clamp(Math.round((pct / 100) * width), 0, width);
	return '█'.repeat(filled) + '░'.repeat(width - filled);
};

/** Deterministic price history so screenshots are stable (LCG random walk). */
export const seededHistory = (seed: number, end: number, n = 32): number[] => {
	let s = seed % 2147483647;
	if (s <= 0) s += 2147483646;
	const rng = () => (s = (s * 16807) % 2147483647) / 2147483647;
	const out: number[] = [];
	let v = end - (rng() * 12 - 6);
	for (let i = 0; i < n; i++) {
		v += rng() * 5 - 2.5;
		v = clamp(v, 2, 98);
		out.push(Math.round(v));
	}
	out[n - 1] = end; // anchor the latest point to the current price
	return out;
};
