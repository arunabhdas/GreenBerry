import React from 'react';
import {Text} from 'ink';
import {sparkline} from '../util.js';

export function Sparkline({
	values,
	color,
}: {
	values: number[];
	color?: string;
}) {
	return <Text color={color}>{sparkline(values)}</Text>;
}
