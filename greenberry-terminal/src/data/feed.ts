/**
 * Simulated live feed. Drives the "realtime" feel by nudging YES prices on a
 * random walk each tick. Replace `tickMarkets` with a websocket handler that
 * merges venue updates into the Market[] (keeping the same shape).
 */
import {clamp} from '../util.js';
import type {Market} from './types.js';

export const tickMarkets = (markets: Market[]): Market[] =>
	markets.map(m => {
		// Bigger books move less per tick; thin books are jumpier.
		const vol = m.liquidity > 1_500_000 ? 0.6 : m.liquidity > 600_000 ? 1.1 : 1.8;
		const drift = (Math.random() - 0.5) * 2 * vol;
		const yes = clamp(Math.round((m.yes + drift) * 10) / 10, 1, 99);
		const history = [...m.history.slice(1), Math.round(yes)];
		return {...m, prevYes: m.yes, yes, history};
	});

/** Synthetic order book around the current YES price (for the detail panel). */
export type Level = {price: number; size: number};
export const buildBook = (
	yes: number,
	liquidity: number,
	depth = 5,
): {bids: Level[]; asks: Level[]} => {
	const spread = liquidity > 1_500_000 ? 1 : 2;
	const unit = Math.max(1, Math.round(liquidity / 100 / depth));
	const bids: Level[] = [];
	const asks: Level[] = [];
	for (let i = 0; i < depth; i++) {
		const bp = clamp(Math.round(yes - spread / 2 - i), 1, 99);
		const ap = clamp(Math.round(yes + spread / 2 + i), 1, 99);
		// deterministic-ish sizes that taper away from the touch
		bids.push({price: bp, size: unit * (depth - i) + ((bp * 37) % 19) * 10});
		asks.push({price: ap, size: unit * (depth - i) + ((ap * 31) % 23) * 10});
	}
	return {bids, asks};
};
