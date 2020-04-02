import asyncio
import websockets
import json
import uuid
import av
import struct
from aiortc import MediaStreamTrack, RTCPeerConnection, RTCSessionDescription
from aiortc.contrib.media import MediaBlackhole, MediaPlayer, MediaRecorder
import jack as Jack

@Jack.set_error_function
def error(msg):
    print('Error:', msg)


@Jack.set_info_function
def info(msg):
    print('Info:', msg)

jack = Jack.Client('webstudio')
out1 = jack.outports.register('out_0')
out2 = jack.outports.register('out_1')

def init_buffers():
    global transfer_buffer1, transfer_buffer2
    transfer_buffer1 = Jack.RingBuffer(jack.samplerate * 10)
    transfer_buffer2 = Jack.RingBuffer(jack.samplerate * 10)
init_buffers()

@jack.set_process_callback
def process(frames):
    buf1 = out1.get_buffer()
    piece1 = transfer_buffer1.read(len(buf1))
    buf1[:len(piece1)] = piece1
    buf2 = out2.get_buffer()
    piece2 = transfer_buffer2.read(len(buf2))
    buf2[:len(piece2)] = piece2

class JackSender(object):
    def __init__(self, track):
        self.track = track
        self.resampler = None

    async def process(self):
        while True:
            frame = await self.track.recv()
            # Right, depending on the format, we may need to do some fuckery.
            # Jack expects all audio to be 32 bit floating point
            # while PyAV may give us audio in any format
            # (my testing has shown it to be signed 16-bit)
            # We use PyAV to resample it into the right format
            if self.resampler is None:
                self.resampler = av.audio.resampler.AudioResampler(format="fltp", layout="stereo", rate=jack.samplerate)
            frame.pts = None # DIRTY HACK
            new_frame = self.resampler.resample(frame)
            transfer_buffer1.write(new_frame.planes[0])
            transfer_buffer2.write(new_frame.planes[1])

current_session = None

class Session(object):
    async def end():
        await self.pc.close()
        init_buffers()
        await self.websocket.send(json.dumps({ "kind": "REPLACED" }))

    async def connect(self, websocket):
        self.websocket = websocket
        connection_id = uuid.uuid4();
        print(connection_id, "Connected")
        await websocket.send(json.dumps({"kind": "HELLO", "connectionId": str(connection_id)}))
        sdp_offer = json.loads(await websocket.recv())
        if sdp_offer["kind"] != "OFFER":
            await websocket.close(1008)
            return
        offer = RTCSessionDescription(sdp=sdp_offer["sdp"], type=sdp_offer["type"])
        print(connection_id, "Received offer")

        self.pc = RTCPeerConnection()

        self.recorder = MediaRecorder("/home/marks/test.opus")

        @self.pc.on("signalingstatechange")
        async def on_signalingstatechange():
            print(connection_id, "Signaling state is {}".format(self.pc.signalingState))

        @self.pc.on("iceconnectionstatechange")
        async def on_iceconnectionstatechange():
            print(connection_id, "ICE connection state is {}".format(self.pc.iceConnectionState))
            if self.pc.iceConnectionState == "failed":
                await self.pc.close()
                self.pc = None
                await websocket.close(1008)
                return

        @self.pc.on("track")
        async def on_track(track):
            print(connection_id, "Received track")
            if track.kind == "audio":
                print(connection_id, "Adding to Jack.")

                @track.on("ended")
                async def on_ended():
                    print(connection_id, "Track {} ended".format(track.kind))
                    init_buffers()

                self.sender = JackSender(track)
                if current_session is not None:
                    await current_session.end()
                current_session = self
                await self.sender.process()
                

        await self.pc.setRemoteDescription(offer)

        answer = await self.pc.createAnswer()
        await self.pc.setLocalDescription(answer)

        await websocket.send(
            json.dumps(
                {
                    "kind": "ANSWER",
                    "type": self.pc.localDescription.type,
                    "sdp": self.pc.localDescription.sdp,
                }
            )
        )
        print(connection_id, "Sent answer")

        async for msg in websocket:
            print(connection_id, msg)


async def serve(websocket, path):
    if path == "/stream":
        session = Session()
        await session.connect(websocket)
    else:
        pass


jack.activate()
start_server = websockets.serve(serve, "localhost", 8079)

asyncio.get_event_loop().run_until_complete(start_server)
asyncio.get_event_loop().run_forever()
