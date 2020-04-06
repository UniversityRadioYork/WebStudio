import {
	Streamer,
	ConnectionStateListener,
	ConnectionStateEnum
} from "./streamer";

type StreamerState = "HELLO" | "OFFER" | "ANSWER" | "CONNECTED";

export class WebRTCStreamer extends Streamer {
	pc: RTCPeerConnection;
	ws: WebSocket | undefined;
	state: StreamerState = "HELLO";

	constructor(stream: MediaStream) {
		super();
		this.pc = new RTCPeerConnection({
			iceServers: [
				{
					urls: ["stun:eu-turn4.xirsys.com"]
				},
				{
					username:
						"h42bRBHL2GtRTiQRoXN8GCG-PFYMl4Acel6EQ9xINBWdTpoZyBEGyCcJBCtT3iINAAAAAF5_NJptYXJrc3BvbGFrb3Zz",
					credential: "17e834fa-70e7-11ea-a66c-faa4ea02ad5c",
					urls: [
						"turn:eu-turn4.xirsys.com:80?transport=udp",
						"turn:eu-turn4.xirsys.com:3478?transport=udp",
						"turn:eu-turn4.xirsys.com:80?transport=tcp",
						"turn:eu-turn4.xirsys.com:3478?transport=tcp",
						"turns:eu-turn4.xirsys.com:443?transport=tcp",
						"turns:eu-turn4.xirsys.com:5349?transport=tcp"
					]
				}
			]
		});
		this.pc.onconnectionstatechange = e => {
			console.log("Connection state change: " + this.pc.connectionState);
			this.onStateChange(this.mapStateToConnectionState());
		};
		console.log("Stream tracks", stream.getAudioTracks());
		stream.getAudioTracks().forEach(track => this.pc.addTrack(track));
	}

	async start(): Promise<void> {
		this.ws = new WebSocket("ws://audio.ury.org.uk/webstudio/stream");
		this.ws.onopen = e => {
			console.log("WS open");
			this.onStateChange(this.mapStateToConnectionState());
		};
		this.ws.onclose = e => {
			console.log("WS close");
			this.onStateChange(this.mapStateToConnectionState());
		};
		this.ws.addEventListener("message", this.onMessage.bind(this));
	}

	async stop(): Promise<void> {
		if (this.ws) {
			this.ws.close();
		}
		this.pc.close();
	}

	async onMessage(evt: MessageEvent) {
		const data = JSON.parse(evt.data);
		switch (data.kind) {
			case "HELLO":
				console.log("WS HELLO, our client ID is " + data.connectionId);
				if (this.state !== "HELLO") {
					this.ws!.close();
				}
				const offer = await this.pc.createOffer();
				// TODO do some fun SDP fuckery to get quality
				await this.pc.setLocalDescription(offer);
				await this.waitForIceCandidates();
				this.ws!.send(
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

	async getStatistics() {
		if (this.pc) {
			return await this.pc.getStats();
		} else {
			return null;
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

	mapStateToConnectionState(): ConnectionStateEnum {
		switch (this.pc.connectionState) {
			case "connected":
				return "CONNECTED";
			case "connecting":
				return "CONNECTING";
			case "disconnected":
				return "CONNECTION_LOST";
			case "failed":
				return "CONNECTION_LOST";
			default:
				if (this.ws) {
					switch (this.ws.readyState) {
						case 1:
							return "CONNECTING";
						case 2:
						case 3:
							return "CONNECTION_LOST";
						case 0:
							return "NOT_CONNECTED";
						default:
							throw new Error();
					}
				}
				return "NOT_CONNECTED";
		}
	}
}
