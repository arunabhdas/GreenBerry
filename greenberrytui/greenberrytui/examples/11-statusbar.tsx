/**
 * Layout: STATUS BAR — pushing segments apart with <Spacer>
 * --------------------------------------------------------
 * Two techniques for spreading items across a row:
 *   1. <Spacer/> — an element that eats all free space (used in the top bar).
 *   2. justifyContent="space-between" — distribute children (used at the bottom).
 * The bottom bar packs three segments (mode / file / position) edge to edge.
 *
 * Ink APIs: <Spacer/>, justifyContent="space-between", flexGrow body.
 *
 * Run:  npx tsx examples/11-statusbar.tsx
 */
import React from 'react';
import {render, Box, Text, Spacer, useStdout} from 'ink';
import {fileURLToPath} from 'node:url';
import process from 'node:process';

export default function StatusBar() {
	const {stdout} = useStdout();
	const height = (stdout?.rows ?? 24) - 1;

	return (
		<Box flexDirection="column" height={height} width="100%">
			{/* Top bar using <Spacer> to push the clock to the right edge */}
			<Box paddingX={1}>
				<Text bold color="green">
					🫐 GreenBerry
				</Text>
				<Spacer />
				<Text dimColor>12:04</Text>
			</Box>

			{/* Body */}
			<Box flexGrow={1} borderStyle="single" paddingX={1}>
				<Text dimColor>Content area</Text>
			</Box>

			{/* Bottom status bar using space-between for three segments */}
			<Box justifyContent="space-between" paddingX={1}>
				<Text inverse color="green">
					{' '}
					NORMAL{' '}
				</Text>
				<Text dimColor>public.orders</Text>
				<Text dimColor>Ln 12, Col 4</Text>
			</Box>
		</Box>
	);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
	render(<StatusBar />);
}
