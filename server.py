import asyncio
import websockets
import json
import uuid
import av
import struct
from aiortc import MediaStreamTrack, RTCPeerConnection, RTCSessionDescription
from aiortc.contrib.media import MediaBlackhole, MediaPlayer
import jack as Jack
import os
import re
from datetime import datetime


file_contents_ex = re.compile(r"^ws=\d$")


def write_ob_status(status):
    if not os.path.exists("/music/ob_state.conf"):
        print("OB State file does not exist. Bailing.")
        return
    with open("/music/ob_state.conf", "r") as fd:
        content = fd.read()
        if "ws" in content:
            content = re.sub(file_contents_ex, "ws=" + str(1 if status else 0), content)
        else:
            if content[len(content) - 1] != "\n":
                content += "\n"
            content += "ws=" + (1 if status else 0) + "\n"
        fd.seek(0)
        fd.write(content)
        fd.truncate()


@Jack.set_error_function
def error(msg):
    print("Error:", msg)


@Jack.set_info_function
def info(msg):
    print("Info:", msg)


jack = Jack.Client("webstudio")
out1 = jack.outports.register("out_0")
out2 = jack.outports.register("out_1")


def init_buffers():
    global transfer_buffer1, transfer_buffer2
    transfer_buffer1 = Jack.RingBuffer(jack.samplerate * 10)
    transfer_buffer2 = Jack.RingBuffer(jack.samplerate * 10)


init_buffers()


@jack.set_process_callback
def process(frames):
    buf1 = out1.get_buffer()
    piece1 = transfer_buffer1.read(len(buf1))
    buf1[: len(piece1)] = piece1
    buf2 = out2.get_buffer()
    piece2 = transfer_buffer2.read(len(buf2))
    buf2[: len(piece2)] = piece2


class JackSender(object):
    def __init__(self, track):
        self.track = track
        self.resampler = None
        self.ended = False

    def end():
        self.ended = True

    async def process(self):
        while True:
            if self.ended:
                break
            frame = await self.track.recv()
            # Right, depending on the format, we may need to do some fuckery.
            # Jack expects all audio to be 32 bit floating point
            # while PyAV may give us audio in any format
            # (my testing has shown it to be signed 16-bit)
            # We use PyAV to resample it into the right format
            if self.resampler is None:
                self.resampler = av.audio.resampler.AudioResampler(
                    format="fltp", layout="stereo", rate=jack.samplerate
                )
            frame.pts = None  # DIRTY HACK
            new_frame = self.resampler.resample(frame)
            transfer_buffer1.write(new_frame.planes[0])
            transfer_buffer2.write(new_frame.planes[1])


current_session = None


class Session(object):
    def __init__(self):
        self.websocket = None
        self.sender = None
        self.pc = None
        self.connection_state = None

    async def end():
        print(self.connection_id, "going away")
        if self.sender is not None:
            self.sender.end()
        if self.pc is not None:
            await self.pc.close()
        init_buffers()
        write_ob_status(False)
        if self.websocket is not None:
            await self.websocket.send(json.dumps({"kind": "REPLACED"}))

    def create_peerconnection(self):
        self.pc = RTCPeerConnection()

        @self.pc.on("signalingstatechange")
        async def on_signalingstatechange():
            print(
                self.connection_id,
                "Signaling state is {}".format(self.pc.signalingState),
            )

        @self.pc.on("iceconnectionstatechange")
        async def on_iceconnectionstatechange():
            print(
                self.connection_id,
                "ICE connection state is {}".format(self.pc.iceConnectionState),
            )
            if self.pc.iceConnectionState == "failed":
                await self.pc.close()
                self.pc = None
                await websocket.close(1008)
                return

        @self.pc.on("track")
        async def on_track(track):
            global current_session
            print(self.connection_id, "Received track")
            if track.kind == "audio":
                print(self.connection_id, "Adding to Jack.")

                @track.on("ended")
                async def on_ended():
                    print(self.connection_id, "Track {} ended".format(track.kind))
                    # TODO: this doesn't exactly handle reconnecting gracefully
                    self.end()

                self.sender = JackSender(track)
                if current_session is not None:
                    await current_session.end()
                current_session = self
                write_ob_status(True)
                await self.sender.process()

    async def process_ice(self, message):
        if self.connection_state == "HELLO" and message["kind"] == "OFFER":
            offer = RTCSessionDescription(sdp=message["sdp"], type=message["type"])
            print(self.connection_id, "Received offer")
            self.create_peerconnection()
            await self.pc.setRemoteDescription(offer)

            answer = await self.pc.createAnswer()
            await self.pc.setLocalDescription(answer)

            await self.websocket.send(
                json.dumps(
                    {
                        "kind": "ANSWER",
                        "type": self.pc.localDescription.type,
                        "sdp": self.pc.localDescription.sdp,
                    }
                )
            )
            self.connection_state = "ANSWER"
            print(self.connection_id, "Sent answer")
        else:
            print(
                self.connection_state,
                "Incorrect kind {} for state {}".format(
                    message["kind"], self.connection_state
                ),
            )

    async def connect(self, websocket):
        self.websocket = websocket
        self.connection_id = uuid.uuid4()
        self.connection_state = "HELLO"
        print(self.connection_id, "Connected")
        await websocket.send(
            json.dumps({"kind": "HELLO", "connectionId": str(self.connection_id)})
        )

        async for msg in websocket:
            data = json.loads(msg)
            if data["kind"] == "OFFER":
                await self.process_ice(data)
            elif data["kind"] == "TIME":
                time = datetime.now().time()
                await websocket.send(json.dumps({"kind": "TIME", "time": str(time)}))
            else:
                print(self.connection_id, "Unknown kind {}".format(data["kind"]))
                await websocket.send(
                    json.dumps({"kind": "ERROR", "error": "unknown_kind"})
                )


async def serve(websocket, path):
    if path == "/stream":
        session = Session()
        await session.connect(websocket)
    else:
        pass


WS_PORT = 8079

jack.activate()
start_server = websockets.serve(serve, "localhost", WS_PORT)

print("Shittyserver starting on port {}.".format(WS_PORT))

asyncio.get_event_loop().run_until_complete(start_server)
asyncio.get_event_loop().run_forever()
