import React from 'react';
import {
	Box,
	Text,
	useApp,
	useFocus,
	useFocusManager,
	useInput,
	useStdin,
	useStdout,
} from 'ink';

type Props = {
	name?: string;
};

type PaneProps = {
	id: string;
	title: string;
	titleColor?: string;
	width?: number;
	grow?: boolean;
	autoFocus?: boolean;
	children: React.ReactNode;
};

/**
 * A focusable column. `useFocus` registers it as a focus target; Ink cycles
 * targets with Tab / Shift+Tab automatically. `isFocused` drives the highlight.
 */
function Pane({
	id,
	title,
	titleColor,
	width,
	grow,
	autoFocus,
	children,
}: PaneProps) {
	const {isFocused} = useFocus({id, autoFocus});

	return (
		<Box
			flexDirection="column"
			width={width}
			flexGrow={grow ? 1 : 0}
			paddingX={1}
			borderStyle={isFocused ? 'round' : 'single'}
			borderColor={isFocused ? 'green' : 'gray'}
		>
			<Text bold color={isFocused ? 'green' : titleColor}>
				{isFocused ? '› ' : '  '}
				{title}
			</Text>
			{children}
		</Box>
	);
}

export default function App(_props: Props) {
	const {exit} = useApp();
	const {focusNext, focusPrevious} = useFocusManager();
	const {isRawModeSupported} = useStdin();
	const {stdout} = useStdout();
	const height = (stdout?.rows ?? 24) - 1; // leave a row for the shell prompt

	// Tab / Shift+Tab navigation is built into Ink. These add ←/→ as an
	// alternative and a quit key. Guarded so it won't crash without a TTY.
	useInput(
		(input, key) => {
			if (input === 'q' || key.escape) {
				exit();
			}

			if (key.rightArrow) {
				focusNext();
			}

			if (key.leftArrow) {
				focusPrevious();
			}
		},
		{isActive: Boolean(isRawModeSupported)},
	);

	return (
		<Box flexDirection="column" height={height} width="100%">
			<Box flexDirection="row" gap={1} flexGrow={1}>
				<Pane id="nav" title="Nav" width={16} autoFocus>
					<Text dimColor>Inbox</Text>
					<Text dimColor>Sent</Text>
					<Text dimColor>Drafts</Text>
				</Pane>

				<Pane id="main" title="Main" grow>
					<Text dimColor>The focused pane has a green rounded border.</Text>
				</Pane>

				<Pane id="inspector" title="Inspector" titleColor="cyan" width={24}>
					<Text dimColor>Fixed-width detail panel.</Text>
				</Pane>
			</Box>

			<Text dimColor>
				{' '}
				Tab · Shift+Tab · ←/→ to move focus · q to quit
			</Text>
		</Box>
	);
}
