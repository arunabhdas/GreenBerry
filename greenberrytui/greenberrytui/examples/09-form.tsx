/**
 * Layout: FORM — aligned label/value rows with a focused field
 * -----------------------------------------------------------
 * Settings / connect screens: a column of rows, each a fixed-width label next
 * to its control. The focused field is highlighted with a green border and a
 * block cursor. (Wire real editing with useInput / useFocus — see 15 & gallery.)
 *
 * Ink APIs: column of label/value rows, fixed label width, borderStyle on the
 *           focused control, `inverse` block as a fake cursor.
 *
 * Run:  npx tsx examples/09-form.tsx
 */
import React from 'react';
import {render, Box, Text} from 'ink';
import {fileURLToPath} from 'node:url';
import process from 'node:process';

function Row({label, children}: {label: string; children: React.ReactNode}) {
	return (
		<Box marginBottom={1}>
			<Box width={12}>
				<Text>{label}</Text>
			</Box>
			<Box flexGrow={1}>{children}</Box>
		</Box>
	);
}

export default function Form() {
	return (
		<Box
			flexDirection="column"
			borderStyle="round"
			borderColor="green"
			paddingX={2}
			paddingY={1}
			width={60}
		>
			<Text bold color="green">
				New connection
			</Text>
			<Box marginTop={1} flexDirection="column">
				<Row label="Host">
					<Text>localhost</Text>
				</Row>
				<Row label="Port">
					<Text>5432</Text>
				</Row>
				{/* Focused field: bordered + block cursor */}
				<Row label="Database">
					<Box borderStyle="single" borderColor="green" paddingX={1}>
						<Text>greenberry</Text>
						<Text inverse> </Text>
					</Box>
				</Row>
				<Row label="SSL">
					<Text>
						<Text color="green">[x]</Text> require
					</Text>
				</Row>
			</Box>

			<Box marginTop={1} justifyContent="flex-end" gap={2}>
				<Text dimColor> Cancel </Text>
				<Text inverse color="green">
					{' '}
					Connect{' '}
				</Text>
			</Box>
		</Box>
	);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
	render(<Form />);
}
