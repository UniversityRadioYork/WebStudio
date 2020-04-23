import SdpTransform from "sdp-transform";
import * as later from "later";

import * as BroadcastState from "./state";
import * as MixerState from "../mixer/state";

import { Streamer, ConnectionStateEnum } from "./streamer";
import { Dispatch } from "redux";
import { broadcastApiRequest } from "../api";
import { audioEngine } from "../mixer/audio";

type StreamerState = "HELLO" | "OFFER" | "ANSWER" | "CONNECTED";

export class WebRTCStreamer extends Streamer {
  stream: MediaStream;
  pc: RTCPeerConnection | null = null;
  ws: WebSocket | undefined;
  state: StreamerState = "HELLO";
  isActive = false;
  dispatch: Dispatch<any>;
  unexpectedDeath = false;

  newsInterval?: later.Timer;

  constructor(stream: MediaStream, dispatch: Dispatch<any>) {
    super();
    this.stream = stream;
    this.dispatch = dispatch;
  }

  async start(): Promise<void> {
    console.log("RTCStreamer start");
    this.pc = new RTCPeerConnection({
      iceServers: [
        {
          urls: ["stun:eu-turn4.xirsys.com"],
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
            "turns:eu-turn4.xirsys.com:5349?transport=tcp",
          ],
        },
      ],
    });
    this.pc.oniceconnectionstatechange = (e) => {
      if (!this.pc) {
        throw new Error(
          "Received ICEConnectionStateChange but PC was null?????"
        );
      }
      console.log("ICE Connection state change: " + this.pc.iceConnectionState);
      this.onStateChange(this.mapStateToConnectionState());
    };
    this.stream.getAudioTracks().forEach((track) => this.pc!.addTrack(track));

    this.addConnectionStateListener((state) => {
      if (state === "CONNECTED") {
        this.newsInterval = later.setInterval(
          this.doTheNews,
          later.parse
            .recur()
            .on(59)
            .minute()
        );
      } else if (state === "CONNECTION_LOST" || state === "NOT_CONNECTED") {
        this.newsInterval?.clear();
      }
    });

    console.log("PC created");
    this.ws = new WebSocket(process.env.REACT_APP_WS_URL!);
    this.ws.onopen = (e) => {
      console.log("WS open");
      this.onStateChange(this.mapStateToConnectionState());
    };
    this.ws.onclose = (e) => {
      console.log("WS close");
      this.onStateChange(this.mapStateToConnectionState());
    };
    this.ws.addEventListener("message", this.onMessage.bind(this));
    console.log("WS created");
  }

  async stop(): Promise<void> {
    if (this.ws) {
      this.ws.close();
      this.ws = null as any;
    }
    if (this.pc) {
      this.pc.close();
      this.pc = null;
    }
    this.unexpectedDeath = false;
  }

  async doTheNews() {
    const transition = await broadcastApiRequest<{
      autoNews: boolean;
      selSource: number;
      switchAudioAtMin: number;
    }>("/nextTransition", "GET", {});
    if (transition.autoNews) {
      // Sanity check
      const now = new Date();
      if (now.getSeconds() < 45) {
        later.setTimeout(
          async () => {
            await audioEngine.playNewsIntro();
          },
          later.parse
            .recur()
            .on(59)
            .minute()
            .on(45)
            .second()
        );
      }
      if (now.getMinutes() <= 1 && now.getSeconds() < 55) {
        later.setTimeout(
          async () => {
            await audioEngine.playNewsEnd();
          },
          later.parse
            .recur()
            .on(1)
            .minute()
            .on(55)
            .second()
        );
      }
    }
  }

  async onMessage(evt: MessageEvent) {
    const data = JSON.parse(evt.data);
    switch (data.kind) {
      case "HELLO":
        console.log("WS HELLO, our client ID is " + data.connectionId);
        this.dispatch(BroadcastState.setWsID(data.connectionId));
        if (this.state !== "HELLO") {
          this.ws!.close();
        }
        if (!this.pc) {
          throw new Error(
            "Tried to do websocket fuckery with a null PeerConnection!"
          );
        }
        const offer = await this.pc.createOffer();

        // Do some fun SDP fuckery to get better quality
        const parsed = SdpTransform.parse(offer.sdp!);
        console.log("Old SDP", parsed);
        parsed.media.forEach((track) => {
          let opusIndex = 0;
          for (let i = 0; i < track.rtp.length; i++) {
            if (track.rtp[i].codec === "opus") {
              opusIndex = i;
            }
            // TODO: maybe delete non-Opus candidates?
          }
          track.fmtp[opusIndex].config += `; maxaveragebitrate=${192 *
            2 *
            1024}; stereo=1; sprop-stereo=1 ; cbr=1`;
        });

        offer.sdp = SdpTransform.write(parsed);
        console.log("New SDP", offer.sdp);

        await this.pc.setLocalDescription(offer);
        await this.waitForIceCandidates();
        this.ws!.send(
          JSON.stringify({
            kind: "OFFER",
            type: this.pc.localDescription!.type,
            sdp: this.pc.localDescription!.sdp,
          })
        );
        this.state = "OFFER";
        break;
      case "ANSWER":
        if (!this.pc) {
          throw new Error("Tried to ANSWER with a null PeerConnection!");
        }
        const answer = new RTCSessionDescription({
          type: data.type,
          sdp: data.sdp,
        });
        await this.pc.setRemoteDescription(answer);
        this.state = "ANSWER";
        break;
      case "ACTIVATED":
        this.isActive = true;
        this.onStateChange("LIVE");
        this.dispatch(BroadcastState.setTracklisting(true));
        break;
      case "DEACTIVATED":
        this.isActive = false;
        this.onStateChange(this.mapStateToConnectionState());
        this.dispatch(BroadcastState.setTracklisting(false));
        break;
      case "DIED":
        // oo-er
        // server thinks we've lost connection
        // kill it on our end and trigger a reconnect
        await this.stop();
        await this.start();
        this.unexpectedDeath = true;
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
    return new Promise((resolve) => {
      if (!this.pc) {
        throw new Error(
          "Tried to gather ICE Candidates with a null PeerConnection!"
        );
      }
      if (this.pc.iceGatheringState === "complete") {
        resolve();
      } else {
        const check = () => {
          if (!this.pc) {
            throw new Error(
              "Received iceGatheringStateChange but PC was null???"
            );
          }
          if (this.pc.iceGatheringState === "complete") {
            this.pc.removeEventListener("icegatheringstatechange", check);
            resolve();
          }
        };
        this.pc.addEventListener("icegatheringstatechange", check);
      }
    });
  }

  mapStateToConnectionState(): ConnectionStateEnum {
    if (!this.pc) {
      if (this.unexpectedDeath) {
        return "CONNECTION_LOST";
      } else {
        return "NOT_CONNECTED";
      }
    }
    switch (this.pc.iceConnectionState) {
      case "connected":
      case "completed":
        return "CONNECTED";
      case "new":
        if (this.ws) {
          switch (this.ws.readyState) {
            case 0:
              return "NOT_CONNECTED";
            case 1:
              return "CONNECTING";
            case 2:
            case 3:
              return "CONNECTION_LOST";
            default:
              throw new Error();
          }
        } else {
          return "NOT_CONNECTED";
        }
      case "checking":
        return "CONNECTING";
      case "disconnected":
        return "CONNECTION_LOST_RECONNECTING";
      case "failed":
        return "CONNECTION_LOST";
      case "closed":
        return "NOT_CONNECTED";
    }
  }
}
