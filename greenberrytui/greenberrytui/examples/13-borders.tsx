/**
 * Layout: BORDERS — every border style + dividers
 * -----------------------------------------------
 * A reference of all 8 borderStyle values shipped with Ink 4.4.1, plus colored
 * and dim borders, plus the "single-side border" trick for cheap section
 * dividers and underlines (borderBottom only).
 *
 * Ink APIs: borderStyle (single/double/round/bold/singleDouble/doubleSingle/
 *           classic/arrow), borderColor, borderDimColor, borderTop/Bottom/...
 *
 * Run:  npx tsx examples/13-borders.tsx
 */
import React from 'react';
import {render, Box, Text} from 'ink';
import {fileURLToPath} from 'node:url';
import process from 'node:process';

const styles = [
	'single',
	'double',
	'round',
	'bold',
	'singleDouble',
	'doubleSingle',
	'classic',
	'arrow',
] as const;

export default function Borders() {
	return (
		<Box flexDirection="column" gap={1} width="100%">
			{/* All border styles, wrapped */}
			<Box flexWrap="wrap" gap={1}>
				{styles.map(s => (
					<Box key={s} width={22} borderStyle={s} paddingX={1}>
						<Text>{s}</Text>
					</Box>
				))}
			</Box>

			{/* Colored + dim borders */}
			<Box gap={1}>
				<Box borderStyle="round" borderColor="green" paddingX={1}>
					<Text>borderColor</Text>
				</Box>
				<Box
					borderStyle="round"
					borderColor="green"
					borderDimColor
					paddingX={1}
				>
					<Text dimColor>borderDimColor</Text>
				</Box>
			</Box>

			{/* Single-side border as a section divider / underline */}
			<Box flexDirection="column" width={40}>
				<Text bold>Section title</Text>
				<Box
					borderStyle="single"
					borderTop={false}
					borderLeft={false}
					borderRight={false}
				>
					<Text> </Text>
				</Box>
				<Text dimColor>…content under a borderBottom-only divider.</Text>
			</Box>
		</Box>
	);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
	render(<Borders />);
}
