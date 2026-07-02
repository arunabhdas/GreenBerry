import React from 'react';
import {Box, Text} from 'ink';
import {THEME} from '../theme.js';
import {Panel} from './Panel.js';
import {ago, fit, trunc} from '../util.js';
import type {OsintKind, OsintSignal} from '../data/types.js';

const KIND_COLOR: Record<OsintKind, string> = {
	ONCHAIN: THEME.accent,
	SOCIAL: THEME.kalshi,
	FLIGHT: THEME.poly,
	POLL: 'blue',
	SATELLITE: THEME.good,
	GOV: THEME.text,
	MARKET: '#ffb000',
};

const deltaGlyph = {up: '▲', down: '▼', flat: '·'} as const;
const deltaColor = {up: THEME.up, down: THEME.down, flat: THEME.flat} as const;

export function OsintPanel({
	signals,
	selectedId,
	focused,
	width,
}: {
	signals: OsintSignal[];
	selectedId: string;
	focused: boolean;
	width: number;
}) {
	const sorted = [...signals].sort(
		(a, b) =>
			(a.tags.includes(selectedId) ? 0 : 1) -
				(b.tags.includes(selectedId) ? 0 : 1) || a.minsAgo - b.minsAgo,
	);
	const sumW = Math.max(12, width - 28);

	return (
		<Panel title="OSINT Signals" hint="conf · dir" focused={focused} grow={1}>
			{sorted.map(s => {
				const rel = s.tags.includes(selectedId);
				return (
					<Box key={s.id}>
						<Text color={rel ? THEME.accent : THEME.dim}>{rel ? '◆ ' : '  '}</Text>
						<Text color={THEME.dim}>{ago(s.minsAgo).padStart(4)} </Text>
						<Text color={KIND_COLOR[s.kind]} bold>
							{fit(s.kind, 9)}
						</Text>
						<Text color={THEME.dim}>{`${s.confidence}%`.padStart(4)} </Text>
						<Text color={deltaColor[s.delta]}>{deltaGlyph[s.delta]} </Text>
						<Text color={rel ? THEME.text : THEME.dim}>
							{trunc(s.summary, sumW)}
						</Text>
					</Box>
				);
			})}
		</Panel>
	);
}
