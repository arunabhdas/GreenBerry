/**
 * Layout: SCROLLING LIST — a windowed viewport (INTERACTIVE)
 * ---------------------------------------------------------
 * Ink 4.4.1 has no overflow clipping, so you scroll by *windowing*: keep an
 * offset and render only the visible slice of a long list. A right-hand gutter
 * shows a simple scroll position indicator.
 *
 * Controls: ↑/↓ or j/k to move, g/G to jump to top/bottom, q to quit.
 * (Falls back to a static frame when no TTY / raw mode is available.)
 *
 * Ink APIs: useInput, useStdin (raw-mode guard), array slice as a viewport.
 *
 * Run:  npx tsx examples/15-scroll-list.tsx
 */
import React, {useState} from 'react';
import {render, Box, Text, useApp, useInput, useStdin} from 'ink';
import {fileURLToPath} from 'node:url';
import process from 'node:process';

const items = Array.from(
	{length: 40},
	(_, i) => `row ${String(i + 1).padStart(2, '0')}`,
);
const VIEWPORT = 10;

export default function ScrollList() {
	const {exit} = useApp();
	const {isRawModeSupported} = useStdin();
	const [selected, setSelected] = useState(0);

	useInput(
		(input, key) => {
			if (input === 'q' || key.escape) exit();
			if (key.downArrow || input === 'j')
				setSelected(s => Math.min(items.length - 1, s + 1));
			if (key.upArrow || input === 'k') setSelected(s => Math.max(0, s - 1));
			if (input === 'g') setSelected(0);
			if (input === 'G') setSelected(items.length - 1);
		},
		{isActive: Boolean(isRawModeSupported)},
	);

	// Keep the selected row inside the viewport window.
	const offset = Math.max(
		0,
		Math.min(selected - Math.floor(VIEWPORT / 2), items.length - VIEWPORT),
	);
	const visible = items.slice(offset, offset + VIEWPORT);

	return (
		<Box flexDirection="column" width={32}>
			<Box borderStyle="round" borderColor="green" flexDirection="row">
				{/* List viewport */}
				<Box flexDirection="column" flexGrow={1}>
					{visible.map((item, i) => {
						const index = offset + i;
						return index === selected ? (
							<Text key={item} inverse color="green">
								{' '}
								{item.padEnd(26)}
							</Text>
						) : (
							<Text key={item}> {item}</Text>
						);
					})}
				</Box>
				{/* Scrollbar gutter */}
				<Box flexDirection="column">
					{visible.map((_, i) => {
						const pos = Math.round(
							(selected / (items.length - 1)) * (VIEWPORT - 1),
						);
						return <Text key={i}>{i === pos ? '█' : '│'}</Text>;
					})}
				</Box>
			</Box>
			<Text dimColor>
				{' '}
				{selected + 1}/{items.length} · ↑/↓ jk · q quit
			</Text>
		</Box>
	);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
	render(<ScrollList />);
}
