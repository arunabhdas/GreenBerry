import React, {useState} from 'react';
import {Box, useApp, useInput, useStdin, useStdout} from 'ink';
import {Header} from './components/Header.js';
import {Ticker} from './components/Ticker.js';
import {Watchlist} from './components/Watchlist.js';
import {MarketDetail} from './components/MarketDetail.js';
import {NewsPanel} from './components/NewsPanel.js';
import {OsintPanel} from './components/OsintPanel.js';
import {StatusBar} from './components/StatusBar.js';
import {MARKETS} from './data/markets.js';
import {NEWS} from './data/news.js';
import {OSINT} from './data/osint.js';
import {tickMarkets} from './data/feed.js';
import {useInterval} from './hooks/useInterval.js';
import {useNow} from './hooks/useNow.js';

const PANEL_COUNT = 3; // markets / news / osint
const RIGHT_WIDTH = 56;

export default function App() {
	const {exit} = useApp();
	const {isRawModeSupported} = useStdin();
	const {stdout} = useStdout();
	const now = useNow();
	const [markets, setMarkets] = useState(MARKETS);
	const [sel, setSel] = useState(0);
	const [panel, setPanel] = useState(0);

	// Simulated live feed.
	useInterval(() => setMarkets(m => tickMarkets(m)), 1500);

	useInput(
		(input, key) => {
			if (input === 'q' || key.escape) {
				exit();
				return;
			}
			if (key.downArrow || input === 'j') setSel(s => (s + 1) % markets.length);
			if (key.upArrow || input === 'k')
				setSel(s => (s - 1 + markets.length) % markets.length);
			if (input === 'g') setSel(0);
			if (input === 'G') setSel(markets.length - 1);
			if (key.tab) setPanel(p => (p + 1) % PANEL_COUNT);
			if (input === '1') setPanel(0);
			if (input === '2') setPanel(1);
			if (input === '3') setPanel(2);
		},
		{isActive: Boolean(isRawModeSupported)},
	);

	const selected = markets[sel];
	const height = (stdout?.rows ?? 44) - 1;

	return (
		<Box flexDirection="column" height={height} width="100%">
			<Header now={now} />
			<Ticker markets={markets} />

			<Box flexGrow={1} flexDirection="row" gap={1} paddingX={1}>
				<Watchlist
					markets={markets}
					selectedId={selected.id}
					focused={panel === 0}
				/>

				<MarketDetail market={selected} focused={false} />

				<Box flexDirection="column" width={RIGHT_WIDTH}>
					<NewsPanel
						items={NEWS}
						selectedId={selected.id}
						selectedCat={selected.category}
						focused={panel === 1}
						width={RIGHT_WIDTH}
					/>
					<OsintPanel
						signals={OSINT}
						selectedId={selected.id}
						focused={panel === 2}
						width={RIGHT_WIDTH}
					/>
				</Box>
			</Box>

			<StatusBar markets={markets} />
		</Box>
	);
}
