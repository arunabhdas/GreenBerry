/**
 * Layout: DATA TABLE — aligned columns with header
 * ------------------------------------------------
 * Fixed-width columns that line up across a bold header rule and data rows.
 * Each cell is a <Box> with a set width; numeric columns right-align by using
 * justifyContent="flex-end". Text wrap="truncate" keeps long values in-column.
 *
 * Ink APIs: per-cell fixed `width`, justifyContent for alignment, wrap="truncate".
 *
 * Run:  npx tsx examples/08-table.tsx
 */
import React from 'react';
import {render, Box, Text} from 'ink';
import {fileURLToPath} from 'node:url';
import process from 'node:process';

type Row = {id: number; email: string; plan: string; mrr: number};

const data: Row[] = [
	{id: 1, email: 'ada@lovelace.io', plan: 'Pro', mrr: 49},
	{id: 2, email: 'grace@hopper.dev', plan: 'Enterprise', mrr: 999},
	{id: 3, email: 'alan@turing.org', plan: 'Free', mrr: 0},
	{
		id: 4,
		email: 'a-very-long-address@example-company.com',
		plan: 'Pro',
		mrr: 49,
	},
];

const cols = [
	{key: 'id', label: 'ID', width: 5, align: 'right'},
	{key: 'email', label: 'EMAIL', width: 32, align: 'left'},
	{key: 'plan', label: 'PLAN', width: 12, align: 'left'},
	{key: 'mrr', label: 'MRR', width: 8, align: 'right'},
] as const;

function Cell({
	width,
	align,
	children,
	header,
}: {
	width: number;
	align: 'left' | 'right';
	children: React.ReactNode;
	header?: boolean;
}) {
	return (
		<Box
			width={width}
			justifyContent={align === 'right' ? 'flex-end' : 'flex-start'}
			paddingRight={1}
		>
			<Text bold={header} underline={header} wrap="truncate">
				{children}
			</Text>
		</Box>
	);
}

export default function Table() {
	return (
		<Box flexDirection="column" width="100%" paddingX={1}>
			{/* Header */}
			<Box>
				{cols.map(c => (
					<Cell key={c.key} width={c.width} align={c.align} header>
						{c.label}
					</Cell>
				))}
			</Box>

			{/* Rows */}
			{data.map(row => (
				<Box key={row.id}>
					{cols.map(c => (
						<Cell key={c.key} width={c.width} align={c.align}>
							{c.key === 'mrr'
								? `$${row.mrr}`
								: String(row[c.key as keyof Row])}
						</Cell>
					))}
				</Box>
			))}
		</Box>
	);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
	render(<Table />);
}
