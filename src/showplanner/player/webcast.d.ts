class WebcastEncoder {
	doEncode(data: any): any;
}

interface WebcastAudioSourceNode extends AudioNode {
	setPassThrough(val: boolean): boolean;
	connectSocket(encoder: WebcastEncoder, url: string): Webcast.Socket;
	close(cb: any): any; // TODO
	getSocket(): Webcast.Socket;
	sendMetadata(meta: any): any;
	isOpen(): boolean | undefined;
}

declare interface AudioContext {
	createWebcastSource(bufferSize: number, channels: number, passThrough?: boolean): WebcastAudioSourceNode;
}

declare namespace Webcast {
	declare namespace Encoder {
		class Asynchronous extends WebcastEncoder {
			constructor(options: {
				encoder: WebcastEncoder,
				scripts: string[]
			})
		}

		class Resample extends WebcastEncoder {
			constructor(options: {
				encoder: WebcastEncoder,
				samplerate: number
			})
		}

		class Mp3 extends WebcastEncoder {
			constructor(options: {
				samplerate: number,
				bitrate: number,
				channels: number,
			})
		}

		class Raw extends WebcastEncoder {
			constructor(options: {
				samplerate: number,
				channels: number,
			})
		}
	}

	class Socket extends WebSocket {
		// TODO
	}
}