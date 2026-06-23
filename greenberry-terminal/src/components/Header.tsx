import React from 'react';
import {Box, Text} from 'ink';
import {THEME} from '../theme.js';
import {fmtClock, fmtDate} from '../hooks/useNow.js';

function Conn({label, ok}: {label: string; ok: boolean}) {
	return (
		<Text>
			<Text color={ok ? THEME.good : THEME.warn}>●</Text>
			<Text color={THEME.dim}> {label} </Text>
		</Text>
	);
}

/** Top command bar: brand, live connection status, date/clock. */
export function Header({now}: {now: Date}) {
	return (
		<Box justifyContent="space-between" paddingX={1}>
			<Box>
				<Text backgroundColor={THEME.brand} color="black" bold>
					{' '}
					⬢ GREENBERRY{' '}
				</Text>
				<Text color={THEME.dim}> TERMINAL · </Text>
				<Text color={THEME.accent} bold>
					PREDICTION DESK
				</Text>
			</Box>
			<Box>
				<Conn label="MKT" ok />
				<Conn label="NEWS" ok />
				<Conn label="OSINT" ok />
				<Text color={THEME.label}> {fmtDate(now)} </Text>
				<Text bold color={THEME.text}>
					{fmtClock(now)}
				</Text>
			</Box>
		</Box>
	);
}
