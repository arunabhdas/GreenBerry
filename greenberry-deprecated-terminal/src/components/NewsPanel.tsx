import React from 'react';
import {Box, Text} from 'ink';
import {THEME, SENTIMENT_COLOR} from '../theme.js';
import {Panel} from './Panel.js';
import {ago, fit, trunc} from '../util.js';
import type {NewsItem} from '../data/types.js';

const dot = {bull: '▲', bear: '▼', neutral: '·'} as const;

export function NewsPanel({
	items,
	selectedId,
	selectedCat,
	focused,
	width,
}: {
	items: NewsItem[];
	selectedId: string;
	selectedCat: string;
	focused: boolean;
	width: number;
}) {
	const rank = (n: NewsItem) =>
		n.tags.includes(selectedId) ? 0 : n.tags.includes(selectedCat) ? 1 : 2;
	const sorted = [...items].sort((a, b) => rank(a) - rank(b) || a.minsAgo - b.minsAgo);
	const headW = Math.max(12, width - 25);

	return (
		<Panel title="News Wire" hint="▲bull ▼bear" focused={focused} grow={1}>
			{sorted.map(n => {
				const rel = n.tags.includes(selectedId);
				return (
					<Box key={n.id}>
						<Text color={rel ? THEME.accent : THEME.dim}>{rel ? '◆ ' : '  '}</Text>
						<Text color={THEME.dim}>{ago(n.minsAgo).padStart(4)} </Text>
						<Text color={THEME.label}>{fit(n.source, 11)}</Text>
						<Text color={SENTIMENT_COLOR[n.sentiment]}>{dot[n.sentiment]} </Text>
						<Text color={rel ? THEME.text : THEME.dim}>
							{trunc(n.headline, headW)}
						</Text>
					</Box>
				);
			})}
		</Panel>
	);
}
