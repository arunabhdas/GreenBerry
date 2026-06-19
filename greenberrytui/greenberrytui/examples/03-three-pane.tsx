/**
 * Layout: THREE-PANE — nav / main / inspector
 * -------------------------------------------
 * Classic IDE / mail-client shape: a fixed nav rail, a flexible center, and a
 * fixed-width inspector on the right. Only the middle column flexes.
 *
 * Ink APIs: row of three <Box>es, two fixed widths around one flexGrow.
 *
 * Run:  npx tsx examples/03-three-pane.tsx
 */
import React from 'react';
import {render, Box, Text, useStdout} from 'ink';
import {fileURLToPath} from 'node:url';
import process from 'node:process';

export default function ThreePane() {
	const {stdout} = useStdout();
	const height = (stdout?.rows ?? 24) - 1;

	return (
		<Box flexDirection="row" gap={1} height={height} width="100%">
			<Box width={16} borderStyle="single" paddingX={1} flexDirection="column">
				<Text bold color="green">
					Nav
				</Text>
				<Text dimColor>Inbox</Text>
				<Text dimColor>Sent</Text>
				<Text dimColor>Drafts</Text>
			</Box>

			<Box
				flexGrow={1}
				borderStyle="round"
				borderColor="green"
				paddingX={1}
				flexDirection="column"
			>
				<Text bold>Main</Text>
				<Text dimColor>The center column is the only one with flexGrow=1.</Text>
			</Box>

			<Box width={24} borderStyle="single" paddingX={1} flexDirection="column">
				<Text bold color="cyan">
					Inspector
				</Text>
				<Text dimColor>Fixed-width detail panel.</Text>
			</Box>
		</Box>
	);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
	render(<ThreePane />);
}
