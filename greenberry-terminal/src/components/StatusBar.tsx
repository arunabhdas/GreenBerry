import React from 'react';
import {Box, Text} from 'ink';
import {THEME} from '../theme.js';
import {fmtUsd} from '../util.js';
import {POSITIONS, positionPnl, positionValue} from '../data/positions.js';
import type {Market} from '../data/types.js';

const usdSigned = (n: number): string =>
	`${n >= 0 ? '+' : '-'}${fmtUsd(Math.abs(n))}`;

export function StatusBar({markets}: {markets: Market[]}) {
	const byId = new Map(markets.map(m => [m.id, m]));
	let pnl = 0;
	let value = 0;
	for (const p of POSITIONS) {
		const m = byId.get(p.marketId);
		if (!m) continue;
		pnl += positionPnl(p, m.yes);
		value += positionValue(p, m.yes);
	}
	const pnlCol = pnl > 0 ? THEME.up : pnl < 0 ? THEME.down : THEME.flat;

	return (
		<Box justifyContent="space-between" paddingX={1}>
			<Box>
				<Text backgroundColor={THEME.brand} color="black" bold>
					{' '}
					BOOK{' '}
				</Text>
				<Text color={THEME.dim}> {POSITIONS.length} open · MV </Text>
				<Text bold>{fmtUsd(value)}</Text>
				<Text color={THEME.dim}> · uPnL </Text>
				<Text bold color={pnlCol}>
					{usdSigned(pnl)}
				</Text>
			</Box>
			<Text color={THEME.dim}>
				↑/↓ select · TAB cycle panel · 1/2/3 jump · q quit
			</Text>
		</Box>
	);
}
