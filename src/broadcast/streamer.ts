export type ConnectionStateEnum =
  | "NOT_CONNECTED"
  | "CONNECTING"
  | "CONNECTED"
  | "CONNECTION_LOST"
  | "CONNECTION_LOST_RECONNECTING"
  | "LIVE";
export type ConnectionStateListener = (val: ConnectionStateEnum) => any;

export abstract class Streamer {
  private csListeners: ConnectionStateListener[] = [];

  public abstract start(): Promise<void>;
  public abstract stop(): Promise<void>;
  public addConnectionStateListener(listener: ConnectionStateListener) {
    this.csListeners.push(listener);
    return () => {
      this.csListeners.splice(this.csListeners.indexOf(listener), 1);
    };
  }

  protected onStateChange(state: ConnectionStateEnum) {
    this.csListeners.forEach((l) => l(state));
  }
}
