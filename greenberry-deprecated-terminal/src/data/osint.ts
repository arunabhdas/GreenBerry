/**
 * Sample OSINT signal feed. MOCK DATA — replace with live collectors:
 *   ONCHAIN  → mempool / whale-alert / Dune
 *   SOCIAL   → X/Reddit/Telegram trend scrapers
 *   FLIGHT   → ADS-B Exchange / OpenSky
 *   POLL     → poll aggregators
 *   SATELLITE→ commercial imagery providers
 *   GOV      → Federal Register / filings / Hansard
 */
import type {OsintSignal} from './types.js';

export const OSINT: OsintSignal[] = [
	{
		id: 'o1',
		minsAgo: 1,
		kind: 'ONCHAIN',
		summary: 'Polymarket SHUTDOWN-26 YES book absorbs $240k taker buy',
		confidence: 82,
		delta: 'up',
		tags: ['shutdown'],
	},
	{
		id: 'o2',
		minsAgo: 4,
		kind: 'SOCIAL',
		summary: 'Spike in “FOMC” + “hold” mentions across fin-X (3.4σ)',
		confidence: 68,
		delta: 'down',
		tags: ['fed-jul'],
	},
	{
		id: 'o3',
		minsAgo: 9,
		kind: 'FLIGHT',
		summary: 'Two gov VIP jets inbound to capital ahead of budget vote',
		confidence: 71,
		delta: 'up',
		tags: ['shutdown'],
	},
	{
		id: 'o4',
		minsAgo: 16,
		kind: 'ONCHAIN',
		summary: 'Stablecoin inflows to CEXs +$1.1B/24h, risk-on tone',
		confidence: 64,
		delta: 'up',
		tags: ['btc-150', 'eth-6k'],
	},
	{
		id: 'o5',
		minsAgo: 22,
		kind: 'SATELLITE',
		summary: 'Increased vessel count imaged near contested strait',
		confidence: 59,
		delta: 'up',
		tags: ['taiwan'],
	},
	{
		id: 'o6',
		minsAgo: 28,
		kind: 'POLL',
		summary: 'New aggregate: approval 42.6% (−0.4 w/w), within MoE',
		confidence: 77,
		delta: 'down',
		tags: ['approval'],
	},
	{
		id: 'o7',
		minsAgo: 37,
		kind: 'GOV',
		summary: 'Federal Register: contingency-staffing memo posted',
		confidence: 85,
		delta: 'up',
		tags: ['shutdown'],
	},
	{
		id: 'o8',
		minsAgo: 45,
		kind: 'MARKET',
		summary: 'Kalshi/Poly spread on shutdown widens to 3¢ (arb watch)',
		confidence: 73,
		delta: 'flat',
		tags: ['shutdown'],
	},
	{
		id: 'o9',
		minsAgo: 58,
		kind: 'SOCIAL',
		summary: 'Dev-chatter: eval leaks hint near-term frontier release',
		confidence: 55,
		delta: 'up',
		tags: ['gpt6'],
	},
	{
		id: 'o10',
		minsAgo: 74,
		kind: 'ONCHAIN',
		summary: 'SOL staking deposits accelerate; validators +1.8%',
		confidence: 51,
		delta: 'up',
		tags: ['sol-flip'],
	},
];
