import React from 'react';
import {Box, Text} from 'ink';
import {THEME} from '../theme.js';
import {Panel} from './Panel.js';
import {arrow, cents, fit, fmtUsd} from '../util.js';
import type {Market} from '../data/types.js';

function HeadRow() {
	return (
		<Box>
			<Text color={THEME.label} bold>
				{'    '}
				{fit('MARKET', 24)}
				{'YES'.padStart(4)}
				{'CHG'.padStart(5)}
				{'VOL'.padStart(8)}
			</Text>
		</Box>
	);
}

function Row({m, selected}: {m: Market; selected: boolean}) {
	const chg = m.yes - m.open;
	const tick =
		m.yes > m.prevYes ? THEME.up : m.yes < m.prevYes ? THEME.down : THEME.text;
	const chgCol = chg > 0 ? THEME.up : chg < 0 ? THEME.down : THEME.flat;
	const chgStr = `${arrow(chg)}${Math.abs(Math.round(chg))}`;
	return (
		<Box>
			<Text color={THEME.brand} bold>
				{selected ? '▶ ' : '  '}
			</Text>
			<Text color={m.venue === 'Kalshi' ? THEME.kalshi : THEME.poly} bold>
				{m.venue === 'Kalshi' ? 'K ' : 'P '}
			</Text>
			<Text bold={selected} color={selected ? THEME.text : THEME.dim}>
				{fit(m.question, 24)}
			</Text>
			<Text color={tick} bold>
				{cents(m.yes).padStart(4)}
			</Text>
			<Text color={chgCol}>{chgStr.padStart(5)}</Text>
			<Text color={THEME.dim}>{fmtUsd(m.volume24h).padStart(8)}</Text>
		</Box>
	);
}

export function Watchlist({
	markets,
	selectedId,
	focused,
}: {
	markets: Market[];
	selectedId: string;
	focused: boolean;
}) {
	return (
		<Panel
			title="Markets"
			hint={`${markets.length} contracts`}
			focused={focused}
			width={50}
		>
			<HeadRow />
			{markets.map(m => (
				<Row key={m.id} m={m} selected={m.id === selectedId} />
			))}
		</Panel>
	);
}
