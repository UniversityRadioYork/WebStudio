type StreamerState = "HELLO" | "OFFER" | "ANSWER" | "CONNECTED";

export type ConnectionStateEnum = "NOT_CONNECTED" | "CONNECTING" | "CONNECTED" | "CONNECTION_LOST";
type ConnectionStateListener = (val: ConnectionStateEnum) => any;

export class WebRTCStreamer {
	pc: RTCPeerConnection;
	ws: WebSocket;
	state: StreamerState = "HELLO";

	csListeners: ConnectionStateListener[] = [];

	constructor(stream: MediaStream) {
		this.pc = new RTCPeerConnection({});
		this.pc.onconnectionstatechange = e => {
			console.log("Connection state change: " + this.pc.connectionState);
			this.csListeners.forEach(l => l(this.mapStateToConnectionState()));
		};
		console.log("Stream tracks", stream.getAudioTracks());
		stream.getAudioTracks().forEach(track => this.pc.addTrack(track));
		this.ws = new WebSocket("ws://localhost:8079/stream"); // TODO
		this.ws.onopen = e => {
			console.log("WS open");
			this.csListeners.forEach(l => l(this.mapStateToConnectionState()));
		};
		this.ws.onclose = e => {
			console.log("WS close");
			this.csListeners.forEach(l => l(this.mapStateToConnectionState()));
		};
		this.ws.addEventListener("message", this.onMessage.bind(this));
	}

	async onMessage(evt: MessageEvent) {
		const data = JSON.parse(evt.data);
		switch (data.kind) {
			case "HELLO":
				console.log("WS HELLO, our client ID is " + data.connectionId);
				if (this.state !== "HELLO") {
					this.ws.close();
				}
				const offer = await this.pc.createOffer();
				// TODO do some fun SDP fuckery to get quality
				await this.pc.setLocalDescription(offer);
				await this.waitForIceCandidates();
				this.ws.send(
					JSON.stringify({
						kind: "OFFER",
						type: this.pc.localDescription!.type,
						sdp: this.pc.localDescription!.sdp
					})
				);
				this.state = "OFFER";
				break;
			case "ANSWER":
				const answer = new RTCSessionDescription({
					type: data.type,
					sdp: data.sdp
				});
				await this.pc.setRemoteDescription(answer);
				this.state = "ANSWER";
				break;
		}
	}

	// TODO: supporting trickle ICE would be nICE
	waitForIceCandidates() {
		return new Promise(resolve => {
			if (this.pc.iceGatheringState === "complete") {
				resolve();
			} else {
				const check = () => {
					if (this.pc.iceGatheringState === "complete") {
						this.pc.removeEventListener(
							"icegatheringstatechange",
							check
						);
						resolve();
					}
				};
				this.pc.addEventListener("icegatheringstatechange", check);
			}
		});
	}

	close() {
		this.ws.close();
		this.pc.close();
	}

	mapStateToConnectionState(): ConnectionStateEnum {
		switch (this.pc.connectionState) {
			case "connected": return "CONNECTED";
			case "connecting": return "CONNECTING";
			case "disconnected": return "CONNECTION_LOST";
			case "failed": return "CONNECTION_LOST";
			default:
				switch (this.ws.readyState) {
					case 1: return "CONNECTING";
					case 2: case 3: return "CONNECTION_LOST";
					case 0: return "NOT_CONNECTED";
					default: throw new Error();
				} 
		}
	}

	addConnectionStateListener(listener: ConnectionStateListener) {
		this.csListeners.push(listener);
		listener(this.mapStateToConnectionState());
		return () => {
			this.csListeners.splice(this.csListeners.indexOf(listener), 1);
		}
	}
}
