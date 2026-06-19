/**
 * Layout: DASHBOARD — bento grid of mixed-size widgets
 * ----------------------------------------------------
 * Unlike the uniform grid, widgets here have *different* weights: a wide hero
 * tile next to a narrow one, then a row of three. Achieved by giving rows and
 * cells different flexGrow values.
 *
 * Ink APIs: nested rows/columns with asymmetric flexGrow, a reusable Panel.
 *
 * Run:  npx tsx examples/06-dashboard.tsx
 */
import React from 'react';
import {render, Box, Text, useStdout} from 'ink';
import {fileURLToPath} from 'node:url';
import process from 'node:process';

function Panel({
	title,
	color = 'green',
	grow = 1,
	children,
}: {
	title: string;
	color?: string;
	grow?: number;
	children: React.ReactNode;
}) {
	return (
		<Box
			flexGrow={grow}
			flexBasis={0}
			borderStyle="round"
			borderColor={color}
			paddingX={1}
			flexDirection="column"
		>
			<Text bold color={color}>
				{title}
			</Text>
			<Box marginTop={1} flexGrow={1}>
				{children}
			</Box>
		</Box>
	);
}

export default function Dashboard() {
	const {stdout} = useStdout();
	const height = (stdout?.rows ?? 24) - 1;

	return (
		<Box flexDirection="column" gap={1} height={height} width="100%">
			{/* Top row: one wide hero (grow 2) + one narrow (grow 1) */}
			<Box flexDirection="row" gap={1} flexGrow={2}>
				<Panel title="Throughput" grow={2}>
					<Text>
						1,204 <Text color="cyan">qps</Text>
					</Text>
				</Panel>
				<Panel title="Errors" color="red" grow={1}>
					<Text color="red">0.2%</Text>
				</Panel>
			</Box>

			{/* Bottom row: three equal widgets */}
			<Box flexDirection="row" gap={1} flexGrow={3}>
				<Panel title="Connections" color="cyan">
					<Text>42 / 100</Text>
				</Panel>
				<Panel title="Cache hit" color="yellow">
					<Text>98.6%</Text>
				</Panel>
				<Panel title="Replication" color="magenta">
					<Text>lag 12ms</Text>
				</Panel>
			</Box>
		</Box>
	);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
	render(<Dashboard />);
}
