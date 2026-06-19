/**
 * Layout: SIDEBAR + MAIN — two columns
 * ------------------------------------
 * A fixed-width navigation rail on the left and a content area on the right
 * that grows to fill the rest of the width. The horizontal version of the
 * app shell. `gap` puts breathing room between the two panes.
 *
 * Ink APIs: <Box flexDirection="row">, fixed `width` vs `flexGrow`, gap.
 *
 * Run:  npx tsx examples/02-sidebar.tsx
 */
import React from 'react';
import {render, Box, Text, useStdout} from 'ink';
import {fileURLToPath} from 'node:url';
import process from 'node:process';

const nav = ['Dashboard', 'Tables', 'Query', 'Schema', 'Settings'];

export default function Sidebar() {
	const {stdout} = useStdout();
	const height = (stdout?.rows ?? 24) - 1;
	const active = 'Tables';

	return (
		<Box flexDirection="row" gap={1} height={height} width="100%">
			{/* Fixed-width sidebar */}
			<Box
				flexDirection="column"
				width={22}
				borderStyle="round"
				borderColor="green"
				paddingX={1}
			>
				<Text bold color="green">
					Menu
				</Text>
				<Box marginTop={1} flexDirection="column">
					{nav.map(item =>
						item === active ? (
							<Text key={item} inverse color="green">
								{' '}
								▸ {item}{' '}
							</Text>
						) : (
							<Text key={item} dimColor>
								{'   '}
								{item}
							</Text>
						),
					)}
				</Box>
			</Box>

			{/* Flexible main content */}
			<Box
				flexGrow={1}
				borderStyle="single"
				paddingX={1}
				flexDirection="column"
			>
				<Text bold>Tables</Text>
				<Text dimColor>Sidebar has a fixed width; this pane flexGrow=1.</Text>
			</Box>
		</Box>
	);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
	render(<Sidebar />);
}
