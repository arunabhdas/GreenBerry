/**
 * Layout: MASTER–DETAIL — list selects, panel shows
 * -------------------------------------------------
 * A scannable list on the left; the right panel renders the full record for
 * the highlighted row. The bread-and-butter layout for browsers (tables,
 * files, mail, records). This snapshot shows row 2 selected.
 *
 * Ink APIs: row split, `inverse` to mark the selected row, label/value rows.
 *
 * Run:  npx tsx examples/07-master-detail.tsx
 */
import React from 'react';
import {render, Box, Text, useStdout} from 'ink';
import {fileURLToPath} from 'node:url';
import process from 'node:process';

const rows = [
	{id: 1, name: 'users', rows: 18234, size: '4.2 MB'},
	{id: 2, name: 'orders', rows: 90421, size: '31 MB'},
	{id: 3, name: 'products', rows: 1203, size: '512 KB'},
	{id: 4, name: 'events', rows: 5_400_000, size: '1.1 GB'},
];

export default function MasterDetail() {
	const {stdout} = useStdout();
	const height = (stdout?.rows ?? 24) - 1;
	const selected = rows[1]!;

	return (
		<Box flexDirection="row" gap={1} height={height} width="100%">
			{/* Master list */}
			<Box width={24} borderStyle="single" flexDirection="column">
				{rows.map(r =>
					r.id === selected.id ? (
						<Text key={r.id} inverse color="green">
							{' '}
							{r.name.padEnd(20)}
						</Text>
					) : (
						<Text key={r.id}> {r.name}</Text>
					),
				)}
			</Box>

			{/* Detail panel */}
			<Box
				flexGrow={1}
				borderStyle="round"
				borderColor="green"
				paddingX={1}
				flexDirection="column"
			>
				<Text bold color="green">
					{selected.name}
				</Text>
				<Box marginTop={1} flexDirection="column">
					<Field label="Table id" value={String(selected.id)} />
					<Field label="Row count" value={selected.rows.toLocaleString()} />
					<Field label="On disk" value={selected.size} />
				</Box>
			</Box>
		</Box>
	);
}

function Field({label, value}: {label: string; value: string}) {
	return (
		<Box>
			<Box width={12}>
				<Text dimColor>{label}</Text>
			</Box>
			<Text>{value}</Text>
		</Box>
	);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
	render(<MasterDetail />);
}
