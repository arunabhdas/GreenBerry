/**
 * Terminal color theme. Bloomberg-ish: dense, dark, color-coded.
 * GreenBerry house style leads with green; up=green, down=red, labels=cyan,
 * highlights=amber. Colors are plain Ink <Text color> values (named or hex).
 */
export const THEME = {
	brand: 'green',
	brandDim: '#1f7a3f',
	text: 'white',
	dim: 'gray',
	label: 'cyan',
	accent: '#ffb000', // amber
	up: 'green',
	down: 'red',
	flat: 'gray',
	warn: '#ff5f5f',
	good: 'green',
	border: 'gray',
	borderActive: 'green',
	kalshi: 'cyan',
	poly: 'magenta',
} as const;

export const SENTIMENT_COLOR = {
	bull: THEME.up,
	bear: THEME.down,
	neutral: THEME.dim,
} as const;

export const IMPACT_COLOR = {
	high: THEME.warn,
	med: THEME.accent,
	low: THEME.dim,
} as const;
