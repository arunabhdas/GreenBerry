import {useEffect, useRef} from 'react';

/**
 * Declarative setInterval (Dan Abramov pattern). Pass delay=null to pause.
 * The callback ref stays current so you never capture stale state.
 */
export function useInterval(callback: () => void, delay: number | null): void {
	const saved = useRef(callback);

	useEffect(() => {
		saved.current = callback;
	}, [callback]);

	useEffect(() => {
		if (delay === null) return;
		const id = setInterval(() => saved.current(), delay);
		return () => clearInterval(id);
	}, [delay]);
}
