/**
 * Layout: APP SHELL — header / body / footer vertical stack
 * ---------------------------------------------------------
 * The most common full-screen TUI skeleton: a fixed-height title bar at the
 * top, a body that grows to fill all remaining vertical space, and a fixed
 * status/footer bar pinned to the bottom.
 *
 * Ink APIs: <Box flexDirection="column">, flexGrow (body absorbs slack),
 *           height from useStdout() so the shell fills the real terminal.
 *
 * Run:  npx tsx examples/01-stack.tsx
 */
import React from 'react';
import {render, Box, Text, useStdout} from 'ink';
import {fileURLToPath} from 'node:url';
import process from 'node:process';

export default function Stack() {
	const {stdout} = useStdout();
	const height = (stdout?.rows ?? 24) - 1; // leave a row for the shell prompt

	return (
		<Box flexDirection="column" height={height} width="100%">
			{/* Header — fixed height */}
			<Box
				borderStyle="round"
				borderColor="green"
				paddingX={1}
				justifyContent="space-between"
			>
				<Text bold color="green">
					🫐 GreenBerry
				</Text>
				<Text dimColor>v0.0.0</Text>
			</Box>

			{/* Body — grows to fill everything left over */}
			<Box flexGrow={1} borderStyle="single" paddingX={1} marginY={0}>
				<Text>
					This body has <Text color="cyan">flexGrow=1</Text>, so it expands to
					fill all vertical space between the header and footer. Resize your
					terminal and re-run to watch it stretch.
				</Text>
			</Box>

			{/* Footer — fixed height, pinned to bottom */}
			<Box paddingX={1} justifyContent="space-between">
				<Text inverse> NORMAL </Text>
				<Text dimColor>press q to quit · ? for help</Text>
			</Box>
		</Box>
	);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
	render(<Stack />);
}
