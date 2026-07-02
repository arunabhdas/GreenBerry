import React, {useEffect, useRef, useState} from 'react';
import {spawn} from 'node:child_process';
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

const MENU = ['Test', 'Connect', 'Quit'] as const;

// The (input, key) signature Ink's useInput passes to its handler.
type InkKey = Parameters<Parameters<typeof useInput>[0]>[1];

type PaneProps = {
	id: string;
	title: string;
	titleColor?: string;
	width?: number;
	grow?: boolean;
	autoFocus?: boolean;
	onInput?: (input: string, key: InkKey) => void;
	children: React.ReactNode;
};

/**
 * A focusable column. `useFocus` registers it as a focus target; Ink cycles
 * targets with Tab / Shift+Tab automatically. `isFocused` drives the highlight.
 *
 * Key input is scoped to this pane: the `onInput` handler only fires while the
 * pane is focused, so e.g. the menu's ↑/↓ don't fire from other panes.
 */
function Pane({
	id,
	title,
	titleColor,
	width,
	grow,
	autoFocus,
	onInput,
	children,
}: PaneProps) {
	const {isFocused} = useFocus({id, autoFocus});
	const {isRawModeSupported} = useStdin();

	useInput(
		(input, key) => {
			onInput?.(input, key);
		},
		{isActive: isFocused && Boolean(isRawModeSupported)},
	);

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

/** Bottom panel: shows the last command and its streamed output. */
function OutputPanel({
	command,
	lines,
	running,
	height,
}: {
	command: string;
	lines: string[];
	running: boolean;
	height: number;
}) {
	const visible = Math.max(1, height - 3);
	const shown = lines.slice(-visible);
	return (
		<Box
			flexDirection="column"
			height={height}
			borderStyle="single"
			borderColor="gray"
			paddingX={1}
		>
			<Box justifyContent="space-between">
				<Text bold color="cyan">
					OUTPUT
				</Text>
				<Text color={running ? 'yellow' : 'gray'}>
					{running ? 'running…' : 'idle'}
				</Text>
			</Box>
			{command ? <Text color="green">$ {command}</Text> : null}
			{shown.map((line, i) => (
				<Text
					key={i}
					color={/error|failed|fatal/i.test(line) ? 'red' : undefined}
					wrap="truncate-end"
				>
					{line === '' ? ' ' : line}
				</Text>
			))}
		</Box>
	);
}

const toLines = (s: string): string[] => {
	const lines = s.split('\n');
	if (lines.length > 0 && lines[lines.length - 1] === '') lines.pop();
	return lines;
};

export default function App(_props: Props) {
	const {exit} = useApp();
	const {focusNext, focusPrevious} = useFocusManager();
	const {isRawModeSupported} = useStdin();
	const {stdout} = useStdout();
	const height = (stdout?.rows ?? 24) - 1; // leave a row for the shell prompt

	const [selected, setSelected] = useState(0);
	const [command, setCommand] = useState('');
	const [output, setOutput] = useState<string[]>([
		'Select "Test" and press Enter to run psql postgres.',
	]);
	const [running, setRunning] = useState(false);

	const alive = useRef(true);
	const child = useRef<ReturnType<typeof spawn> | null>(null);

	useEffect(() => {
		return () => {
			alive.current = false;
			child.current?.kill();
		};
	}, []);

	const run = (file: string, args: string[]) => {
		const display = [file, ...args].join(' ');
		setCommand(display);
		setOutput([]);
		setRunning(true);

		let buf = '';
		const proc = spawn(file, args, {stdio: ['ignore', 'pipe', 'pipe']});
		child.current = proc;

		const push = () => {
			if (alive.current) setOutput(toLines(buf));
		};
		proc.stdout?.on('data', d => {
			buf += d.toString();
			push();
		});
		proc.stderr?.on('data', d => {
			buf += d.toString();
			push();
		});
		proc.on('error', err => {
			if (!alive.current) return;
			setRunning(false);
			setOutput([`error: ${err.message}`]);
		});
		proc.on('close', code => {
			if (!alive.current) return;
			child.current = null;
			setRunning(false);
			setOutput([...toLines(buf), `[exit ${code ?? 0}]`]);
		});
	};

	const activate = (index: number) => {
		const choice = MENU[index];
		if (choice === 'Quit') {
			exit();
			return;
		}
		if (choice === 'Test') {
			run('psql', ['postgres']);
		} else if (choice === 'Connect') {
			setCommand('');
			setOutput(['Connecting to greenberry@localhost… (demo)']);
		}
	};

	// Menu keys, scoped to the left pane (only fire while it is focused).
	const onMenuInput = (input: string, key: InkKey) => {
		if (key.upArrow || input === 'k') {
			setSelected(i => (i - 1 + MENU.length) % MENU.length);
		}

		if (key.downArrow || input === 'j') {
			setSelected(i => (i + 1) % MENU.length);
		}

		if (key.return) {
			activate(selected);
		}
	};

	// Global keys: quit, and move focus between panes. (Tab is built into Ink.)
	useInput(
		(input, key) => {
			if (input === 'q' || key.escape) {
				exit();
				return;
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
				<Pane id="nav" title="Menu" width={20} autoFocus onInput={onMenuInput}>
					<Box flexDirection="column" marginTop={1}>
						{MENU.map((item, i) =>
							i === selected ? (
								<Text key={item} inverse color="green">
									{`› ${item}`.padEnd(16)}
								</Text>
							) : (
								<Text key={item} dimColor>
									{`  ${item}`.padEnd(16)}
								</Text>
							),
						)}
					</Box>
				</Pane>

				<Pane id="main" title="Main" grow>
					<Text>
						Selected:{' '}
						<Text color="green" bold>
							{MENU[selected]}
						</Text>
					</Text>
					<Box marginTop={1}>
						<Text dimColor>Press Enter to run the selected option.</Text>
					</Box>
				</Pane>

				<Pane id="inspector" title="Inspector" titleColor="cyan" width={24}>
					<Text dimColor>Fixed-width detail panel.</Text>
				</Pane>
			</Box>

			<OutputPanel
				command={command}
				lines={output}
				running={running}
				height={12}
			/>

			<Text dimColor>
				{' '}
				↑/↓ select (Menu focused) · Enter run · Tab/←/→ focus · q quit
			</Text>
		</Box>
	);
}
