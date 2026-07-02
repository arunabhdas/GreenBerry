#!/usr/bin/env node
import React from 'react';
import {render} from 'ink';
import meow from 'meow';
import App from './app.js';

const cli = meow(
	`
	Usage
	  $ greenberry-terminal

	A Bloomberg-style terminal for prediction-market traders (Kalshi /
	Polymarket): live markets, a news wire and OSINT signals in one screen.

	Keys
	  ↑/↓ or j/k   select market        TAB         cycle panel focus
	  1 / 2 / 3    jump to a panel       g / G       jump top / bottom
	  q or Esc     quit

	Notes
	  Best at 140×40 or larger. Data is simulated — wire real feeds in
	  src/data/* (see the README).
`,
	{importMeta: import.meta, flags: {}},
);

void cli; // reserved for future flags (--venue, --category, …)

render(<App />);
