export type ConnectionStateEnum =
	| "NOT_CONNECTED"
	| "CONNECTING"
	| "CONNECTED"
	| "CONNECTION_LOST";
export type ConnectionStateListener = (val: ConnectionStateEnum) => any;

export abstract class Streamer {
	private csListeners: ConnectionStateListener[] = [];

	public abstract async start(): Promise<void>;
	public abstract async stop(): Promise<void>;
	public addConnectionStateListener(listener: ConnectionStateListener) {
		this.csListeners.push(listener);
		return () => {
			this.csListeners.splice(this.csListeners.indexOf(listener), 1);
		};
	}

	protected onStateChange(state: ConnectionStateEnum) {
		this.csListeners.forEach(l => l(state));
	}
}
