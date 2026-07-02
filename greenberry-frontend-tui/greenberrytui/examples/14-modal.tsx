/**
 * Layout: MODAL / DIALOG — centered prompt over a screen
 * ------------------------------------------------------
 * A confirmation dialog centered on the screen with a row of buttons (the
 * destructive one focused). Ink 4 has no true z-index overlay, so the standard
 * approach is to render the dialog *instead of* the background and center it.
 * (For a real overlay you'd need position="absolute" — see the README note.)
 *
 * Ink APIs: full-size centering box, a bordered dialog, button row with focus.
 *
 * Run:  npx tsx examples/14-modal.tsx
 */
import React from 'react';
import {render, Box, Text, useStdout} from 'ink';
import {fileURLToPath} from 'node:url';
import process from 'node:process';

export default function Modal() {
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
				flexDirection="column"
				borderStyle="double"
				borderColor="red"
				paddingX={3}
				paddingY={1}
				width={46}
			>
				<Text bold color="red">
					Drop table?
				</Text>
				<Box marginTop={1}>
					<Text>
						This permanently deletes <Text bold>public.orders</Text> and all
						90,421 rows. This cannot be undone.
					</Text>
				</Box>
				<Box marginTop={1} justifyContent="flex-end" gap={2}>
					<Text dimColor> Cancel </Text>
					<Text inverse color="red">
						{' '}
						Drop table{' '}
					</Text>
				</Box>
			</Box>
		</Box>
	);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
	render(<Modal />);
}
