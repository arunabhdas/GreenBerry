import React, {useState} from 'react';
import {Box, Text, useStdout} from 'ink';
import {THEME} from '../theme.js';
import {arrow, cents} from '../util.js';
import {useInterval} from '../hooks/useInterval.js';
import type {Market} from '../data/types.js';

function Seg({m}: {m: Market}) {
	const chg = m.yes - m.open;
	const col = chg > 0 ? THEME.up : chg < 0 ? THEME.down : THEME.flat;
	return (
		<Text>
			<Text color={m.venue === 'Kalshi' ? THEME.kalshi : THEME.poly}>
				{m.ticker}
			</Text>{' '}
			<Text bold>{cents(m.yes)}</Text>
			<Text color={col}>
				{' '}
				{arrow(chg)}
				{Math.abs(Math.round(chg))}
			</Text>
		</Text>
	);
}

/** Scrolling marquee of the book, rotating one contract at a time. */
export function Ticker({markets}: {markets: Market[]}) {
	const {stdout} = useStdout();
	const width = stdout?.columns ?? 100;
	const count = Math.max(3, Math.min(markets.length, Math.floor((width - 12) / 20)));
	const [start, setStart] = useState(0);

	useInterval(() => setStart(s => (s + 1) % markets.length), 2200);

	const shown = Array.from({length: count}, (_, i) => markets[(start + i) % markets.length]!);

	return (
		<Box paddingX={1}>
			<Text backgroundColor={THEME.down} color="black" bold>
				{' '}
				● LIVE{' '}
			</Text>
			<Text> </Text>
			{shown.map((m, i) => (
				<Text key={m.id}>
					<Seg m={m} />
					{i < shown.length - 1 ? <Text color={THEME.dim}> │ </Text> : null}
				</Text>
			))}
		</Box>
	);
}
