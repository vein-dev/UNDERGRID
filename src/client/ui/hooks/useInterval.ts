import { useEffect, useRef } from "@rbxts/react";

/**
 * Custom React hook that invokes a callback periodically with a given delay (in seconds).
 * Passing undefined/null for delay pauses the timer.
 */
export function useInterval(callback: () => void, delaySeconds?: number): void {
	const savedCallback = useRef<() => void>();

	useEffect(() => {
		savedCallback.current = callback;
	}, [callback]);

	useEffect(() => {
		if (delaySeconds === undefined) return;

		let isRunning = true;
		const thread = task.spawn(() => {
			while (isRunning) {
				task.wait(delaySeconds);
				if (isRunning && savedCallback.current) {
					savedCallback.current();
				}
			}
		});

		return () => {
			isRunning = false;
			task.cancel(thread);
		};
	}, [delaySeconds]);
}
