import React from 'react';
import {Box, Text} from 'ink';
import {THEME} from '../theme.js';

type Props = {
	title: string;
	hint?: string;
	focused?: boolean;
	width?: number;
	grow?: number;
	children: React.ReactNode;
};

/** A bordered Bloomberg-style panel with a title bar and a focus highlight. */
export function Panel({title, hint, focused = false, width, grow, children}: Props) {
	return (
		<Box
			flexDirection="column"
			width={width}
			flexGrow={grow}
			borderStyle="round"
			borderColor={focused ? THEME.borderActive : THEME.border}
			paddingX={1}
		>
			<Box justifyContent="space-between">
				<Text bold color={focused ? THEME.brand : THEME.label}>
					{focused ? '▌' : ' '}
					{title.toUpperCase()}
				</Text>
				{hint ? <Text color={THEME.dim}>{hint}</Text> : null}
			</Box>
			<Box flexDirection="column" flexGrow={1}>
				{children}
			</Box>
		</Box>
	);
}
