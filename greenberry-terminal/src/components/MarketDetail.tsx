import React from 'react';
import {Box, Text} from 'ink';
import {THEME} from '../theme.js';
import {Panel} from './Panel.js';
import {Sparkline} from './Sparkline.js';
import {arrow, cents, fmtUsd, prob, signed} from '../util.js';
import {buildBook} from '../data/feed.js';
import type {Market} from '../data/types.js';

function Stat({label, children}: {label: string; children: React.ReactNode}) {
	return (
		<Box flexDirection="column" marginRight={3}>
			<Text color={THEME.dim}>{label}</Text>
			<Text bold>{children}</Text>
		</Box>
	);
}

export function MarketDetail({
	market,
	focused,
}: {
	market: Market;
	focused: boolean;
}) {
	const chg = market.yes - market.open;
	const chgCol = chg > 0 ? THEME.up : chg < 0 ? THEME.down : THEME.flat;
	const lo = Math.min(...market.history);
	const hi = Math.max(...market.history);
	const trend = market.history[market.history.length - 1] - market.history[0];
	const book = buildBook(market.yes, market.liquidity);

	return (
		<Panel
			title="Quote"
			hint={`${market.venue} · ${market.category}`}
			focused={focused}
			grow={1}
		>
			<Text bold wrap="truncate-end">
				{market.question}
			</Text>
			<Text color={THEME.dim}>
				{market.ticker} · resolves {market.close}
			</Text>

			<Box marginTop={1}>
				<Box flexDirection="column" marginRight={3}>
					<Text color={THEME.dim}>YES</Text>
					<Text bold color={THEME.up}>
						{cents(market.yes)} <Text color={THEME.dim}>({prob(market.yes)})</Text>
					</Text>
				</Box>
				<Box flexDirection="column" marginRight={3}>
					<Text color={THEME.dim}>NO</Text>
					<Text bold color={THEME.down}>
						{cents(100 - market.yes)}
					</Text>
				</Box>
				<Box flexDirection="column" marginRight={3}>
					<Text color={THEME.dim}>SESS Δ</Text>
					<Text bold color={chgCol}>
						{arrow(chg)} {signed(chg)}
					</Text>
				</Box>
				<Stat label="VOL 24H">{fmtUsd(market.volume24h)}</Stat>
				<Stat label="LIQ">{fmtUsd(market.liquidity)}</Stat>
			</Box>

			<Box marginTop={1} flexDirection="column">
				<Text color={THEME.dim}>YES PRICE · last {market.history.length} ticks</Text>
				<Box>
					<Sparkline values={market.history} color={trend >= 0 ? THEME.up : THEME.down} />
					<Text color={THEME.dim}>
						{'  '}
						lo {lo} hi {hi}
					</Text>
				</Box>
			</Box>

			<Box marginTop={1} flexDirection="column">
				<Text color={THEME.label} bold>
					ORDER BOOK
				</Text>
				<Box>
					<Box flexDirection="column" marginRight={4}>
						<Text color={THEME.dim}>
							{'BID'.padEnd(5)}
							{'SIZE'.padStart(8)}
						</Text>
						{book.bids.map(b => (
							<Text key={b.price} color={THEME.up}>
								{String(b.price).padEnd(5)}
								{b.size.toLocaleString().padStart(8)}
							</Text>
						))}
					</Box>
					<Box flexDirection="column">
						<Text color={THEME.dim}>
							{'ASK'.padEnd(5)}
							{'SIZE'.padStart(8)}
						</Text>
						{book.asks.map(a => (
							<Text key={a.price} color={THEME.down}>
								{String(a.price).padEnd(5)}
								{a.size.toLocaleString().padStart(8)}
							</Text>
						))}
					</Box>
				</Box>
			</Box>
		</Panel>
	);
}
