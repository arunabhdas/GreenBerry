/**
 * Layout: METERS — progress bars & gauges from text blocks
 * -------------------------------------------------------
 * Bars are just two runs of block characters (█ filled, ░ empty) sized from a
 * percentage. Laid out as label / bar / value rows with aligned columns — a
 * staple of dashboards and install/progress screens.
 *
 * Ink APIs: fixed-width label column, flexGrow bar, color thresholds on <Text>.
 *
 * Run:  npx tsx examples/16-progress.tsx
 */
import React from 'react';
import {render, Box, Text} from 'ink';
import {fileURLToPath} from 'node:url';
import process from 'node:process';

const BAR_WIDTH = 30;

function Bar({pct}: {pct: number}) {
	const filled = Math.round((pct / 100) * BAR_WIDTH);
	const color = pct > 85 ? 'red' : pct > 60 ? 'yellow' : 'green';
	return (
		<Text>
			<Text color={color}>{'█'.repeat(filled)}</Text>
			<Text dimColor>{'░'.repeat(BAR_WIDTH - filled)}</Text>
		</Text>
	);
}

function Meter({label, pct}: {label: string; pct: number}) {
	return (
		<Box>
			<Box width={8}>
				<Text>{label}</Text>
			</Box>
			<Bar pct={pct} />
			<Box width={6} justifyContent="flex-end">
				<Text>{pct}%</Text>
			</Box>
		</Box>
	);
}

export default function Progress() {
	return (
		<Box
			flexDirection="column"
			borderStyle="round"
			borderColor="green"
			paddingX={1}
			width={52}
		>
			<Text bold color="green">
				System
			</Text>
			<Box marginTop={1} flexDirection="column">
				<Meter label="CPU" pct={42} />
				<Meter label="MEM" pct={73} />
				<Meter label="DISK" pct={91} />
				<Meter label="NET" pct={12} />
			</Box>
		</Box>
	);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
	render(<Progress />);
}
