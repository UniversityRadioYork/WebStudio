import asyncio
import configparser
import json
import os
import re
import sys
import uuid
from datetime import datetime
from types import TracebackType
from typing import Optional, Any, Type, Dict

import aiohttp
import av  # type: ignore
import jack as Jack  # type: ignore
import websockets
from aiortc import MediaStreamTrack, RTCPeerConnection, RTCSessionDescription  # type: ignore
from aiortc.mediastreams import MediaStreamError  # type: ignore
from raygun4py import raygunprovider  # type: ignore

config = configparser.RawConfigParser()
config.read("serverconfig.ini")

if config.get("raygun", "enable") == "True":

    def handle_exception(
        exc_type: Type[BaseException],
        exc_value: BaseException,
        exc_traceback: TracebackType,
    ) -> None:
        sys.__excepthook__(exc_type, exc_value, exc_traceback)
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
    if transfer_buffer1.read_space == 0:
        for i in range(len(buf1)):
            buf1[i] = b'\x00'
    else:
        piece1 = transfer_buffer1.read(len(buf1))
        buf1[: len(piece1)] = piece1
    buf2 = out2.get_buffer()
    if transfer_buffer2.read_space == 0:
        for i in range(len(buf2)):
            buf2[i] = b'\x00'
    else:
        piece2 = transfer_buffer2.read(len(buf2))
        buf2[: len(piece2)] = piece2


active_sessions: Dict[str, "Session"] = {}
live_session: Optional["Session"] = None


async def notify_mattserver_about_sessions() -> None:
    async with aiohttp.ClientSession() as session:
        data: Dict[str, Dict[str, str]] = {}
        for sid, sess in active_sessions.items():
            data[sid] = sess.to_dict()
        async with session.post(config.get("shittyserver", "notify_url"), json=data) as response:
            print("Mattserver response", response)


class NotReadyException(BaseException):
    pass


class Session(object):
    websocket: Optional[websockets.WebSocketServerProtocol]
    connection_state: Optional[str]
    pc: Optional[Any]
    connection_id: str
    lock: asyncio.Lock
    running: bool
    ended: bool
    resampler: Optional[Any]

    def __init__(self) -> None:
        self.websocket = None
        self.sender = None
        self.pc = None
        self.resampler = None
        self.connection_state = None
        self.connection_id = str(uuid.uuid4())
        self.ended = False
        self.lock = asyncio.Lock()
        self.running = False

    def to_dict(self) -> Dict[str, str]:
        return {"connection_id": self.connection_id}

    async def activate(self) -> None:
        print(self.connection_id, "Activating")
        self.running = True
        if self.websocket is not None:
            await self.websocket.send(json.dumps({"kind": "ACTIVATED"}))

    async def deactivate(self) -> None:
        print(self.connection_id, "Deactivating")
        self.running = False
        if self.websocket is not None:
            try:
                await self.websocket.send(json.dumps({"kind": "DEACTIVATED"}))
            except websockets.exceptions.ConnectionClosedError:
                print(self.connection_id, "not sending DEACTIVATED as it's already closed")
                pass

    async def end(self) -> None:
        global active_sessions, live_session

        async with self.lock:
            if self.ended:
                print(self.connection_id, "already over")
            else:
                print(self.connection_id, "going away")

                self.ended = True
                await self.deactivate()

                if self.pc is not None:
                    await self.pc.close()

                if (
                    self.websocket is not None
                    and self.websocket.state == websockets.protocol.State.OPEN
                ):
                    try:
                        await self.websocket.send(json.dumps({"kind": "DIED"}))
                        await self.websocket.close(1008)
                    except websockets.exceptions.ConnectionClosedError:
                        print(self.connection_id, "socket already closed, no died message")

                if self.connection_id in active_sessions:
                    print(self.connection_id, "removing from active_sessions")
                    del active_sessions[self.connection_id]
                    print("active_sessions now")
                    print(active_sessions)
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
            global live_session, transfer_buffer1, transfer_buffer2
            print(self.connection_id, "Received track")
            if track.kind == "audio":
                print(self.connection_id, "It's audio.")

                await notify_mattserver_about_sessions()

                @track.on("ended")  # type: ignore
                async def on_ended() -> None:
                    print(self.connection_id, "Track {} ended".format(track.kind))
                    await self.end()

                write_ob_status(True)
                while True:
                    try:
                        frame = await track.recv()
                    except MediaStreamError as e:
                        print(self.connection_id, "MediaStreamError")
                        print(e)
                        await self.end()
                        break
                    if self.running:
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

    async def process_ice(self, message: Any) -> None:
        if self.connection_state == "HELLO" and message["kind"] == "OFFER":
            offer = RTCSessionDescription(sdp=message["sdp"], type=message["type"])
            print(self.connection_id, "Received offer")

            self.create_peerconnection()
            assert self.pc is not None

            await self.pc.setRemoteDescription(offer)

            answer = await self.pc.createAnswer()
            answer.sdp += "\na=fmtp:111 minptime=10;useinbandfec=0;maxaveragebitrate=393216;stereo=1;sprop-stereo=1;cbr=1"
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
    serve, "localhost", int(config.get("shittyserver", "websocket_port"))
)

print("Shittyserver WS starting on port {}.".format(config.get("shittyserver", "websocket_port")))


async def telnet_server(
    reader: asyncio.StreamReader, writer: asyncio.StreamWriter
) -> None:
    global active_sessions, live_session
    while True:
        data = await reader.readline()
        if not data:
            break
        try:
            data_str = data.decode("utf-8")
        except UnicodeDecodeError as e:
            print(e)
            continue
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
                    await live_session.deactivate()
                    live_session = None
                    print("OKAY")
                    writer.write("OKAY\r\n".encode("utf-8"))
                else:
                    print("WONT no_live_session")
                    writer.write("WONT no_live_session\r\n".encode("utf-8"))
            else:
                if sid not in active_sessions:
                    print("WONT no_such_session")
                    writer.write("WONT no_such_session\r\n".encode("utf-8"))
                else:
                    session = active_sessions[sid]
                    if session is None:
                        print("OOPS no_such_session")
                        writer.write("OOPS no_such_session\r\n".encode("utf-8"))
                    elif live_session is not None and live_session.connection_id == sid:
                        print("WONT already_live")
                        writer.write("WONT already_live\r\n".encode("utf-8"))
                    else:
                        if live_session is not None:
                            await live_session.deactivate()
                        await session.activate()
                        live_session = session
                        print("OKAY")
                        writer.write("OKAY\r\n".encode("utf-8"))
        else:
            writer.write("WHAT\r\n".encode("utf-8"))
            await writer.drain()
    writer.close()


async def run_telnet_server() -> None:
    server = await asyncio.start_server(
        telnet_server, "localhost", int(config.get("shittyserver", "telnet_port"))
    )
    await server.serve_forever()


jack.activate()

print("Shittyserver TELNET starting on port {}".format(config.get("shittyserver", "telnet_port")))
asyncio.get_event_loop().run_until_complete(notify_mattserver_about_sessions())

asyncio.get_event_loop().run_until_complete(
    asyncio.gather(start_server, run_telnet_server())
)
asyncio.get_event_loop().run_forever()
