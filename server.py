import asyncio
import websockets
import json
import uuid
import av  # type: ignore
import struct
from aiortc import MediaStreamTrack, RTCPeerConnection, RTCSessionDescription  # type: ignore
from aiortc.contrib.media import MediaBlackhole, MediaPlayer  # type: ignore
import jack as Jack  # type: ignore
import os
import re
from datetime import datetime
from typing import Optional, Any, Type, Dict
from types import TracebackType
import sys
import aiohttp
from raygun4py import raygunprovider  # type: ignore

import configparser

config = configparser.ConfigParser()
config.read("shittyserver.ini")

ENABLE_EXCEPTION_LOGGING = False

if config.get("raygun", "enable") == "True":

    def handle_exception(
        exc_type: Type[BaseException],
        exc_value: BaseException,
        exc_traceback: TracebackType,
    ) -> None:
        cl = raygunprovider.RaygunSender(config.get("raygun", "key"))
        cl.send_exception(exc_info=(exc_type, exc_value, exc_traceback))

    sys.excepthook = handle_exception


file_contents_ex = re.compile(r"^ws=\d$")


def write_ob_status(status: bool) -> None:
    if not os.path.exists("/music/ob_state.conf"):
        print("OB State file does not exist. Bailing.")
        return
    with open("/music/ob_state.conf", "r+") as fd:
        content = fd.read()
        if "ws" in content:
            content = re.sub(file_contents_ex, "ws=" + str(1 if status else 0), content)
        else:
            if len(content) > 0 and content[len(content) - 1] != "\n":
                content += "\n"
            content += "ws=" + str(1 if status else 0) + "\n"
        fd.seek(0)
        fd.write(content)
        fd.truncate()


@Jack.set_error_function  # type: ignore
def error(msg: str) -> None:
    print("Error:", msg)


@Jack.set_info_function  # type: ignore
def info(msg: str) -> None:
    print("Info:", msg)


jack = Jack.Client("webstudio")
out1 = jack.outports.register("out_0")
out2 = jack.outports.register("out_1")

transfer_buffer1: Any = None
transfer_buffer2: Any = None


def init_buffers() -> None:
    global transfer_buffer1, transfer_buffer2
    transfer_buffer1 = Jack.RingBuffer(jack.samplerate * 10)
    transfer_buffer2 = Jack.RingBuffer(jack.samplerate * 10)


init_buffers()


@jack.set_process_callback  # type: ignore
def process(frames: int) -> None:
    buf1 = out1.get_buffer()
    piece1 = transfer_buffer1.read(len(buf1))
    buf1[: len(piece1)] = piece1
    buf2 = out2.get_buffer()
    piece2 = transfer_buffer2.read(len(buf2))
    buf2[: len(piece2)] = piece2


class JackSender(object):
    resampler: Any

    def __init__(self, track: MediaStreamTrack) -> None:
        self.track = track
        self.resampler = None
        self.ended = False

    def end(self) -> None:
        self.ended = True

    async def process(self) -> None:
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


active_sessions: Dict[str, "Session"] = {}
live_session: Optional["Session"] = None


async def notify_mattserver_about_sessions() -> None:
    async with aiohttp.ClientSession() as session:
        data: Dict[str, Dict[str, str]] = {}
        for sid, sess in active_sessions.items():
            data[sid] = sess.to_dict()
        await session.post(config.get("mattserver", "notify_url"), json=data)


class NotReadyException(BaseException):
    pass


class Session(object):
    websocket: Optional[websockets.WebSocketServerProtocol]
    sender: Optional[JackSender]
    connection_state: Optional[str]
    pc: Optional[Any]
    connection_id: str
    lock: asyncio.Lock

    def __init__(self) -> None:
        self.websocket = None
        self.sender = None
        self.pc = None
        self.connection_state = None
        self.connection_id = str(uuid.uuid4())
        self.ended = False
        self.lock = asyncio.Lock()

    def to_dict(self) -> Dict[str, str]:
        return {"connection_id": self.connection_id}

    async def activate(self) -> None:
        print(self.connection_id, "Activating")
        if self.sender is None:
            print(self.connection_id, "... but we don't have a sender!")
            raise NotReadyException()
        else:
            await self.sender.process()

    async def end(self) -> None:
        global active_sessions, live_session

        async with self.lock:
            if self.ended:
                print(self.connection_id, "already over")
            else:
                print(self.connection_id, "going away")

                if self.sender is not None:
                    self.sender.end()

                if self.pc is not None:
                    await self.pc.close()

                init_buffers()

                if (
                    self.websocket is not None
                    and self.websocket.state == websockets.protocol.State.OPEN
                ):
                    await self.websocket.send(json.dumps({"kind": "REPLACED"}))
                    await self.websocket.close(1008)

                if self.connection_id in active_sessions:
                    del active_sessions[self.connection_id]
                    if len(active_sessions) == 0:
                        write_ob_status(False)
                else:
                    print(self.connection_id, "wasn't in active_sessions!")

                if live_session == self:
                    live_session = None

                await notify_mattserver_about_sessions()
                print(self.connection_id, "bye bye")
            self.ended = True

    def create_peerconnection(self) -> None:
        self.pc = RTCPeerConnection()
        assert self.pc is not None

        @self.pc.on("signalingstatechange")  # type: ignore
        async def on_signalingstatechange() -> None:
            assert self.pc is not None
            print(
                self.connection_id,
                "Signaling state is {}".format(self.pc.signalingState),
            )

        @self.pc.on("iceconnectionstatechange")  # type: ignore
        async def on_iceconnectionstatechange() -> None:
            if self.pc is None:
                print(
                    self.connection_id,
                    "ICE connection state change, but the PC is None!",
                )
            else:
                print(
                    self.connection_id,
                    "ICE connection state is {}".format(self.pc.iceConnectionState),
                )
                if self.pc.iceConnectionState == "failed":
                    await self.end()

        @self.pc.on("track")  # type: ignore
        async def on_track(track: MediaStreamTrack) -> None:
            print(self.connection_id, "Received track")
            if track.kind == "audio":
                print(self.connection_id, "Adding to Jack.")

                await notify_mattserver_about_sessions()

                @track.on("ended")  # type: ignore
                async def on_ended() -> None:
                    print(self.connection_id, "Track {} ended".format(track.kind))
                    # TODO: this doesn't exactly handle reconnecting gracefully
                    await self.end()

                self.sender = JackSender(track)
                write_ob_status(True)

    async def process_ice(self, message: Any) -> None:
        if self.connection_state == "HELLO" and message["kind"] == "OFFER":
            offer = RTCSessionDescription(sdp=message["sdp"], type=message["type"])
            print(self.connection_id, "Received offer")

            self.create_peerconnection()
            assert self.pc is not None

            await self.pc.setRemoteDescription(offer)

            answer = await self.pc.createAnswer()
            await self.pc.setLocalDescription(answer)

            assert self.websocket is not None
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

    async def connect(self, websocket: websockets.WebSocketServerProtocol) -> None:
        global active_sessions

        active_sessions[self.connection_id] = self

        self.websocket = websocket
        self.connection_state = "HELLO"
        print(self.connection_id, "Connected")
        # TODO Raygun user ID
        await websocket.send(
            json.dumps({"kind": "HELLO", "connectionId": self.connection_id})
        )

        try:
            async for msg in websocket:
                data = json.loads(msg)
                if data["kind"] == "OFFER":
                    await self.process_ice(data)
                elif data["kind"] == "TIME":
                    time = datetime.now().time()
                    await websocket.send(
                        json.dumps({"kind": "TIME", "time": str(time)})
                    )
                else:
                    print(self.connection_id, "Unknown kind {}".format(data["kind"]))
                    await websocket.send(
                        json.dumps({"kind": "ERROR", "error": "unknown_kind"})
                    )

        except websockets.exceptions.ConnectionClosedError:
            print(self.connection_id, "WebSocket closed")
            await self.end()


async def serve(websocket: websockets.WebSocketServerProtocol, path: str) -> None:
    if path == "/stream":
        session = Session()
        await session.connect(websocket)
    else:
        pass


start_server = websockets.serve(
    serve, "localhost", int(config.get("ports", "websocket"))
)

print("Shittyserver WS starting on port {}.".format(config.get("ports", "websocket")))


async def telnet_server(
    reader: asyncio.StreamReader, writer: asyncio.StreamWriter
) -> None:
    global active_sessions, live_session
    while True:
        data = await reader.read(128)
        if not data:
            break
        data_str = data.decode("utf-8")
        parts = data_str.rstrip().split(" ")
        print(parts)

        if parts[0] == "Q":
            result: Dict[str, Dict[str, str]] = {}
            for sid, sess in active_sessions.items():
                result[sid] = sess.to_dict()
            writer.write(
                (
                    json.dumps(
                        {
                            "live": live_session.to_dict()
                            if live_session is not None
                            else None,
                            "active": result,
                        }
                    )
                    + "\r\n"
                ).encode("utf-8")
            )

        elif parts[0] == "SEL":
            sid = parts[1]
            if sid == "NUL":
                if live_session is not None:
                    await live_session.end()
                    writer.write("OKAY\r\n".encode("utf-8"))
                else:
                    writer.write("WONT\r\n".encode("utf-8"))
            else:
                session = active_sessions[sid]
                if session is None:
                    writer.write("FAIL\r\n".encode("utf-8"))
                else:
                    if live_session is not None:
                        await live_session.end()
                    asyncio.ensure_future(session.activate())
                    live_session = session
                    writer.write("OKAY\r\n".encode("utf-8"))
        else:
            writer.write("WHAT\r\n".encode("utf-8"))
            await writer.drain()
    writer.close()


async def run_telnet_server() -> None:
    server = await asyncio.start_server(
        telnet_server, "localhost", int(config.get("ports", "telnet"))
    )
    await server.serve_forever()


jack.activate()

print("Shittyserver TELNET starting on port {}".format(config.get("ports", "telnet")))
asyncio.get_event_loop().run_until_complete(notify_mattserver_about_sessions())

asyncio.get_event_loop().run_until_complete(
    asyncio.gather(start_server, run_telnet_server())
)
asyncio.get_event_loop().run_forever()
