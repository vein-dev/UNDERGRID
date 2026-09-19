import { useEffect } from "@rbxts/react";

/**
 * Custom React hook that connects a callback to an RBXScriptSignal,
 * automatically disconnecting when the component unmounts or signal changes.
 */
export function useSignal<T extends (...args: any[]) => void>(
	signal: RBXScriptSignal<T> | undefined,
	callback: T,
): void {
	useEffect(() => {
		if (!signal) return;
		const connection = signal.Connect(callback);
		return () => {
			connection.Disconnect();
		};
	}, [signal, callback]);
}
