/**
 * GALLERY — interactive index of every layout example (INTERACTIVE)
 * ----------------------------------------------------------------
 * Browse the catalog with ↑/↓; the right pane shows a description and the exact
 * command to run that example in its own full screen. This screen is itself a
 * live demo of three layouts at once: sidebar + master-detail + status bar.
 *
 * Controls: ↑/↓ or j/k to browse, q / Esc to quit.
 *
 * Run:  npx tsx examples/gallery.tsx
 */
import React, {useState} from 'react';
import {render, Box, Text, useApp, useInput, useStdin, useStdout} from 'ink';
import {fileURLToPath} from 'node:url';
import process from 'node:process';

const examples = [
	{
		file: '01-stack.tsx',
		title: 'App shell',
		blurb:
			'Header / body / footer vertical stack; body flexGrow fills the gap.',
	},
	{
		file: '02-sidebar.tsx',
		title: 'Sidebar + main',
		blurb: 'Fixed-width nav rail beside a flexGrow content pane.',
	},
	{
		file: '03-three-pane.tsx',
		title: 'Three-pane',
		blurb: 'Nav / main / inspector — only the center column flexes.',
	},
	{
		file: '04-grid.tsx',
		title: 'Uniform grid',
		blurb: 'Equal N×M cells using flexGrow + flexBasis and gap.',
	},
	{
		file: '05-centered.tsx',
		title: 'Centered',
		blurb: 'Splash / empty-state centered on both axes.',
	},
	{
		file: '06-dashboard.tsx',
		title: 'Dashboard (bento)',
		blurb: 'Mixed-size widgets via asymmetric flexGrow weights.',
	},
	{
		file: '07-master-detail.tsx',
		title: 'Master–detail',
		blurb: 'List selects a record; panel shows its fields.',
	},
	{
		file: '08-table.tsx',
		title: 'Data table',
		blurb: 'Aligned fixed-width columns, right-aligned numerics, truncation.',
	},
	{
		file: '09-form.tsx',
		title: 'Form',
		blurb: 'Aligned label/value rows with a focused field + cursor.',
	},
	{
		file: '10-tabs.tsx',
		title: 'Tabs',
		blurb: 'Tab bar over a content panel; active tab highlighted.',
	},
	{
		file: '11-statusbar.tsx',
		title: 'Status bar',
		blurb: 'Spacer vs space-between to spread bar segments.',
	},
	{
		file: '12-cards.tsx',
		title: 'Card wrap',
		blurb: 'flexWrap cards that reflow to terminal width.',
	},
	{
		file: '13-borders.tsx',
		title: 'Borders',
		blurb: 'All 8 border styles + colored/dim + single-side dividers.',
	},
	{
		file: '14-modal.tsx',
		title: 'Modal / dialog',
		blurb: 'Centered confirmation dialog with focused button.',
	},
	{
		file: '15-scroll-list.tsx',
		title: 'Scrolling list',
		blurb: 'Windowed viewport over a long list (interactive).',
	},
	{
		file: '16-progress.tsx',
		title: 'Meters',
		blurb: 'Progress bars / gauges from block characters.',
	},
];

export default function Gallery() {
	const {exit} = useApp();
	const {isRawModeSupported} = useStdin();
	const {stdout} = useStdout();
	const height = (stdout?.rows ?? 24) - 1;
	const [selected, setSelected] = useState(0);

	useInput(
		(input, key) => {
			if (input === 'q' || key.escape) exit();
			if (key.downArrow || input === 'j')
				setSelected(s => (s + 1) % examples.length);
			if (key.upArrow || input === 'k')
				setSelected(s => (s - 1 + examples.length) % examples.length);
		},
		{isActive: Boolean(isRawModeSupported)},
	);

	const current = examples[selected]!;

	return (
		<Box flexDirection="column" height={height} width="100%">
			<Box paddingX={1}>
				<Text bold color="green">
					🫐 GreenBerry · Ink layout gallery
				</Text>
			</Box>

			<Box flexGrow={1} flexDirection="row" gap={1}>
				{/* Master list */}
				<Box
					width={26}
					borderStyle="round"
					borderColor="green"
					flexDirection="column"
				>
					{examples.map((ex, i) =>
						i === selected ? (
							<Text key={ex.file} inverse color="green">
								{' '}
								{ex.title.padEnd(24)}
							</Text>
						) : (
							<Text key={ex.file}> {ex.title}</Text>
						),
					)}
				</Box>

				{/* Detail */}
				<Box
					flexGrow={1}
					borderStyle="single"
					paddingX={1}
					flexDirection="column"
				>
					<Text bold color="green">
						{current.title}
					</Text>
					<Box marginTop={1}>
						<Text>{current.blurb}</Text>
					</Box>
					<Box marginTop={1}>
						<Text dimColor>Run it: </Text>
						<Text color="cyan">npx tsx examples/{current.file}</Text>
					</Box>
				</Box>
			</Box>

			{/* Status bar */}
			<Box justifyContent="space-between" paddingX={1}>
				<Text inverse color="green">
					{' '}
					{selected + 1}/{examples.length}{' '}
				</Text>
				<Text dimColor>↑/↓ or j/k to browse · q to quit</Text>
			</Box>
		</Box>
	);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
	render(<Gallery />);
}
