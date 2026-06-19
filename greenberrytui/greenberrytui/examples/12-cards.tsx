/**
 * Layout: CARD WRAP — responsive grid via flexWrap
 * ------------------------------------------------
 * Fixed-width cards laid out left-to-right that wrap onto the next line when
 * they run out of horizontal room. Unlike the fixed N×M grid (04), the number
 * of columns adapts to the terminal width. Resize and re-run to see it reflow.
 *
 * Ink APIs: flexWrap="wrap" on a row, fixed-width cards, gap for gutters.
 *
 * Run:  npx tsx examples/12-cards.tsx
 */
import React from 'react';
import {render, Box, Text} from 'ink';
import {fileURLToPath} from 'node:url';
import process from 'node:process';

const cards = [
	{title: 'users', meta: '18.2k rows'},
	{title: 'orders', meta: '90.4k rows'},
	{title: 'products', meta: '1.2k rows'},
	{title: 'events', meta: '5.4M rows'},
	{title: 'sessions', meta: '402k rows'},
	{title: 'invoices', meta: '12.8k rows'},
];

export default function Cards() {
	return (
		<Box flexWrap="wrap" gap={1} width="100%">
			{cards.map(c => (
				<Box
					key={c.title}
					width={24}
					borderStyle="round"
					borderColor="green"
					paddingX={1}
					flexDirection="column"
				>
					<Text bold color="green">
						{c.title}
					</Text>
					<Text dimColor>{c.meta}</Text>
				</Box>
			))}
		</Box>
	);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
	render(<Cards />);
}
