/**
 * Layout: UNIFORM GRID — equal cells in rows & columns
 * ----------------------------------------------------
 * An N×M grid where every cell is the same size. Built as a column of rows;
 * each cell uses flexGrow=1 + flexBasis=0 so they split each row evenly.
 * `gap` handles the gutters in both directions.
 *
 * Ink APIs: nested row/column <Box>es, flexGrow+flexBasis for equal cells, gap.
 *
 * Run:  npx tsx examples/04-grid.tsx
 */
import React from 'react';
import {render, Box, Text, useStdout} from 'ink';
import {fileURLToPath} from 'node:url';
import process from 'node:process';

const COLS = 3;
const ROWS = 3;

export default function Grid() {
	const {stdout} = useStdout();
	const height = (stdout?.rows ?? 24) - 1;

	const rows = Array.from({length: ROWS}, (_, r) =>
		Array.from({length: COLS}, (_, c) => r * COLS + c + 1),
	);

	return (
		<Box flexDirection="column" gap={1} height={height} width="100%">
			{rows.map((row, r) => (
				<Box key={r} flexDirection="row" gap={1} flexGrow={1}>
					{row.map(n => (
						<Box
							key={n}
							flexGrow={1}
							flexBasis={0}
							borderStyle="round"
							borderColor="green"
							alignItems="center"
							justifyContent="center"
						>
							<Text bold>cell {n}</Text>
						</Box>
					))}
				</Box>
			))}
		</Box>
	);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
	render(<Grid />);
}
