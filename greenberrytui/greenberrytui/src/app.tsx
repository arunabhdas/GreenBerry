import React from 'react';
import { Box, Text, useStdout } from 'ink';

type Props = {
	name: string | undefined;
};

export default function App({ name = 'Stranger' }: Props) {
	const { stdout } = useStdout();
	const height = (stdout?.rows ?? 24) - 1; // leave a row for the shell prompt
	return (
		<>
			<Box flexDirection="row" gap={1} height={height} width="100%">
				<Box width={16} borderStyle="single" paddingX={1} flexDirection="column">
					<Text bold color="green">
						Nav
					</Text>
					<Text dimColor>Inbox</Text>
					<Text dimColor>Sent</Text>
					<Text dimColor>Drafts</Text>
				</Box>

				<Box
					flexGrow={1}
					borderStyle="round"
					borderColor="green"
					paddingX={1}
					flexDirection="column"
				>
					<Text bold>Main</Text>
					<Text dimColor>The center column is the only one with flexGrow=1.</Text>
				</Box>

				<Box width={24} borderStyle="single" paddingX={1} flexDirection="column">
					<Text bold color="cyan">
						Inspector
					</Text>
					<Text dimColor>Fixed-width detail panel.</Text>
				</Box>
			</Box>
		</>
	);
}
