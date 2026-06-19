/**
 * Layout: CENTERED — splash / empty-state / confirm screen
 * --------------------------------------------------------
 * A single block centered both horizontally and vertically. Used for splash
 * screens, "no data yet" empty states, and full-screen confirmations.
 *
 * Ink APIs: a full-size <Box> with justifyContent="center" (vertical, because
 *           the box is a column) + alignItems="center" (horizontal).
 *
 * Run:  npx tsx examples/05-centered.tsx
 */
import React from 'react';
import {render, Box, Text, useStdout} from 'ink';
import {fileURLToPath} from 'node:url';
import process from 'node:process';

export default function Centered() {
	const {stdout} = useStdout();
	const height = (stdout?.rows ?? 24) - 1;

	return (
		<Box
			height={height}
			width="100%"
			flexDirection="column"
			justifyContent="center"
			alignItems="center"
		>
			<Box
				borderStyle="round"
				borderColor="green"
				paddingX={4}
				paddingY={1}
				flexDirection="column"
				alignItems="center"
			>
				<Text bold color="green">
					🫐 GreenBerry
				</Text>
				<Text dimColor>A Postgres TUI</Text>
				<Box marginTop={1}>
					<Text>
						Press <Text color="cyan">Enter</Text> to connect
					</Text>
				</Box>
			</Box>
		</Box>
	);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
	render(<Centered />);
}
