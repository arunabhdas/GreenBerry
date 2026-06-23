/** Domain model for the terminal. All prices are 0-100 (cents / implied %). */

export type Venue = 'Kalshi' | 'Polymarket';

export type Category =
	| 'ECON'
	| 'POLITICS'
	| 'GEO'
	| 'CRYPTO'
	| 'TECH'
	| 'WEATHER';

export type Market = {
	id: string;
	ticker: string;
	question: string;
	venue: Venue;
	category: Category;
	yes: number; // current YES price (0-100)
	prevYes: number; // previous tick (for up/down flash)
	open: number; // 24h-ago reference (for session change)
	volume24h: number; // USD
	liquidity: number; // USD resting
	close: string; // resolution date (display string)
	history: number[]; // recent YES prices for the sparkline
};

export type Sentiment = 'bull' | 'bear' | 'neutral';
export type Impact = 'high' | 'med' | 'low';

export type NewsItem = {
	id: string;
	minsAgo: number;
	source: string;
	headline: string;
	sentiment: Sentiment;
	impact: Impact;
	tags: string[]; // category and/or market ids this story moves
};

export type OsintKind =
	| 'ONCHAIN'
	| 'SOCIAL'
	| 'FLIGHT'
	| 'POLL'
	| 'SATELLITE'
	| 'GOV'
	| 'MARKET';

export type OsintSignal = {
	id: string;
	minsAgo: number;
	kind: OsintKind;
	summary: string;
	confidence: number; // 0-100
	delta: 'up' | 'down' | 'flat'; // directional read for related markets
	tags: string[];
};

export type Position = {
	marketId: string;
	side: 'YES' | 'NO';
	qty: number; // contracts
	avg: number; // entry price (0-100)
};
