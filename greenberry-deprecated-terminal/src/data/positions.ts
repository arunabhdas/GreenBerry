/** Sample open positions for the P&L strip. MOCK DATA. */
import type {Position} from './types.js';

export const POSITIONS: Position[] = [
	{marketId: 'shutdown', side: 'YES', qty: 1200, avg: 57},
	{marketId: 'fed-jul', side: 'NO', qty: 800, avg: 61},
	{marketId: 'btc-150', side: 'YES', qty: 500, avg: 30},
	{marketId: 'gpt6', side: 'YES', qty: 650, avg: 66},
];

/**
 * Mark-to-market a position against the current YES price.
 * Contracts settle 0..100; one contract pays $1 at resolution, so a 1¢ move
 * on `qty` contracts = qty cents = $qty/100.
 */
export const positionPnl = (p: Position, yes: number): number => {
	const markYes = yes;
	const mark = p.side === 'YES' ? markYes : 100 - markYes;
	const entry = p.side === 'YES' ? p.avg : 100 - p.avg;
	return ((mark - entry) * p.qty) / 100; // USD
};

export const positionValue = (p: Position, yes: number): number => {
	const mark = p.side === 'YES' ? yes : 100 - yes;
	return (mark * p.qty) / 100; // USD
};
