/**
 * Layout: TABS — tab bar over a content panel
 * -------------------------------------------
 * A horizontal strip of tabs with one active, above a panel that shows the
 * active tab's content. Active tab is highlighted; inactive tabs are dim.
 * This snapshot has "Query" active.
 *
 * Ink APIs: row of tab labels (active=inverse/green), content <Box> below.
 *
 * Run:  npx tsx examples/10-tabs.tsx
 */
import React from 'react';
import {render, Box, Text, useStdout} from 'ink';
import {fileURLToPath} from 'node:url';
import process from 'node:process';

const tabs = ['Overview', 'Query', 'Schema', 'Logs'];

export default function Tabs() {
	const {stdout} = useStdout();
	const height = (stdout?.rows ?? 24) - 1;
	const active = 'Query';

	return (
		<Box flexDirection="column" height={height} width="100%">
			{/* Tab bar */}
			<Box gap={1}>
				{tabs.map(t =>
					t === active ? (
						<Text key={t} inverse color="green">
							{' '}
							{t}{' '}
						</Text>
					) : (
						<Text key={t} dimColor>
							{' '}
							{t}{' '}
						</Text>
					),
				)}
			</Box>

			{/* Content panel for the active tab */}
			<Box
				flexGrow={1}
				marginTop={1}
				borderStyle="round"
				borderColor="green"
				paddingX={1}
				flexDirection="column"
			>
				<Text bold>{active}</Text>
				<Text dimColor>
					Swap the `active` value (or wire useInput with ←/→) to change tabs.
				</Text>
			</Box>
		</Box>
	);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
	render(<Tabs />);
}
