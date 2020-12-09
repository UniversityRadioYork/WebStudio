from typing import Any, Dict, List, Optional, Tuple
import aiohttp
import aiohttp.web
import json
import uuid
import configparser
import enum
from expiringdict import ExpiringDict  # type: ignore


config = configparser.RawConfigParser()
config.read("serverconfig.ini")
api_key = config.get("myradio", "key")


class SecurityLevel(enum.IntEnum):
    NONE = 0
    GUEST = 10
    MEMBER = 20
    MEMBER_HOST = 30


class MyRadioUser:
    memberid: int
    fname: str
    sname: str


async def check_cookie(in_cookie_header: str) -> Optional[MyRadioUser]:
    global api_key
    async with aiohttp.ClientSession() as http_session:
        async with await http_session.get(
            f"{config.get('myradio', 'api_base')}/user/currentuser?api_key={api_key}",
            headers={"Cookie": in_cookie_header},
        ) as res:
            data = await res.json()
            if data["status"] == "OK" and data["payload"] is not None:
                result = MyRadioUser()
                result.memberid = data["payload"]["memberid"]
                result.fname = data["payload"]["fname"]
                result.sname = data["payload"]["sname"]
                return result
            else:
                print(data)
                return None


async def get_timeslot_info(timeslot_id: int) -> Tuple[str, List[int]]:
    global api_key
    async with aiohttp.ClientSession() as http_session:
        async with http_session.get(
            f"{config.get('myradio', 'api_base')}/timeslot/{timeslot_id}?api_key={api_key}"
        ) as res:
            data = await res.json()
            if data["status"] != "OK":
                raise Exception(data["payload"])
            if data["payload"] is None:
                raise Exception("no such timeslot")
            return (
                data["payload"]["title"],
                [x["memberid"] for x in data["payload"]["credits"]],
            )


class NoUses(Exception):
    pass


class InviteLink:
    code: str
    room: "Room"
    name: str
    uses: int = 0
    max_uses: int
    creator: "Peer"

    @classmethod
    def create(cls, creator: "Peer", room: "Room", name: str, max_uses: int = -1):
        global invite_links
        link = cls()
        id = uuid.uuid4()
        id_str = ""
        for field in id.fields[:-3]:
            id_str += hex(field)[2:]
        link.code = id_str
        link.room = room
        link.creator = creator
        link.name = name
        link.max_uses = max_uses
        invite_links[link.code] = link
        return link

    @property
    def url(self):
        return f"{config.get('multiserver', 'invite_url_base')}#multicode={self.code}"

    def use(self):
        global invite_links
        if self.max_uses > -1:
            if self.uses == self.max_uses:
                raise NoUses()
            self.uses += 1

    def to_dict(self, include_room: bool = False) -> Dict[str, Any]:
        return {
            "code": self.code,
            "url": self.url,
            "name": self.name,
            "uses": self.uses,
            "max_uses": self.max_uses,
            "creator": self.creator.to_dict(),
            "room": self.room.to_dict() if include_room else None,
        }


invite_links: Dict[str, InviteLink] = dict()
rooms: Dict[str, "Room"] = dict()
reconnect_tokens: Dict[str, Dict[str, Any]] = ExpiringDict(
    max_len=1000, max_age_seconds=900
)


class Room:
    id: str
    timeslotid: int
    name: str
    credited_members: List[int]
    peers: Dict[str, "Peer"] = dict()
    host_id: Optional[str]

    @classmethod
    async def create(cls, timeslotid: int):
        result = cls()
        result.id = hex(uuid.uuid4().fields[-1])[2:]
        result.timeslotid = timeslotid
        timeslot_info = await get_timeslot_info(timeslotid)
        result.name = timeslot_info[0]
        result.credited_members = timeslot_info[1]
        return result

    async def add_peer(self, new_peer: "Peer"):
        self.peers[new_peer.id] = new_peer
        for peer in self.peers.values():
            if peer != new_peer:
                await peer.send_peer_joined_room(new_peer)

    async def remove_peer(self, gone_peer: "Peer"):
        global rooms, invite_links
        del self.peers[gone_peer.id]
        for peer in self.peers.values():
            await peer.send_peer_left_room(gone_peer)
        if len(self.peers) == 0:
            # rip
            del rooms[self.id]
            kill_links = set()
            for link in invite_links.values():
                if link.room == self:
                    kill_links.add(link.code)
            for link in kill_links:
                del invite_links[link]

    async def create_invite_link(self, creator: "Peer", name: str, uses: int = -1):
        return InviteLink.create(creator, self, name, uses)

    async def message_all(self, sender: "Peer", msg: Any):
        for peer in self.peers.values():
            await peer.send_msg_from_room(sender, msg)

    async def notify_peer_update(self, peer: "Peer"):
        for peer in self.peers.values():
            await peer.send_peer_update(peer)

    def to_dict(self, include_peers: bool = False) -> Dict[str, Any]:
        return {
            "id": self.id,
            "timeslotid": self.timeslotid,
            "name": self.name,
            "peers": list([p.to_dict(include_room=False) for p in self.peers.values()])
            if include_peers
            else None,
            "host": self.host_id,
        }


class Peer:
    id: str
    reconnect_token: str
    name: str = ""
    room: Optional[Room] = None
    ws: aiohttp.web.WebSocketResponse
    security_level = 0

    def __init__(self, id: str, ws: aiohttp.web.WebSocketResponse):
        self.id = id
        self.reconnect_token = str(uuid.uuid4())
        self.ws = ws
        self.sync_reconnect()

    async def join_room(self, room: Room):
        assert self.room is None
        self.room = room
        await room.add_peer(self)
        await self.ws.send_json(
            {"kind": "JOINED_ROOM", **room.to_dict(include_peers=True)}
        )
        if self.room.host_id == self.id:
            if self.security_level < SecurityLevel.MEMBER_HOST:
                await self.change_security_level(SecurityLevel.MEMBER_HOST)
        self.sync_reconnect()

    async def leave_room(self, tell_ourselves: bool = False, abnormal: bool = False) -> None:
        assert self.room is not None
        if tell_ourselves:
            await self.send_peer_left_room(self)
        await self.room.remove_peer(self)
        self.room = None
        if not abnormal:
            self.sync_reconnect()

    async def change_security_level(self, new_level: int):
        self.security_level = new_level
        if self.room is not None:
            await self.room.notify_peer_update(self)
        else:
            await self.ws.send_json(
                {
                    "kind": "SECURITY_LEVEL_CHANGED",
                    "security_level": self.security_level,
                }
            )
        self.sync_reconnect()

    async def send_peer_joined_room(self, new_peer: "Peer"):
        await self.ws.send_json(
            {"kind": "PEER_JOINED", **new_peer.to_dict(include_room=True)}
        )

    async def send_peer_left_room(self, peer: "Peer"):
        await self.ws.send_json({"kind": "PEER_LEFT", "id": peer.id})

    async def send_msg_from_room(self, sender: "Peer", msg: Any):
        await self.ws.send_json({"kind": "ROOM_MSG", "from": sender.id, "msg": msg})

    async def send_msg_from_peer(self, sender: "Peer", msg: Any):
        await self.ws.send_json({"kind": "PEER_MSG", "from": sender.id, "msg": msg})

    async def send_peer_update(self, peer: "Peer"):
        await self.ws.send_json({"kind": "PEER_UPDATE", **peer.to_dict(False)})

    async def handle_msg(self, msg: Dict[str, Any]):
        global rooms, invite_links
        # Note that kind == GOODBYE is not handled here
        if msg["kind"] == "LIST_ROOMS":
            await self.ws.send_json(
                {
                    "kind": "LIST_ROOMS",
                    "rid": msg.get("rid"),
                    "rooms": [r.to_dict() for r in rooms.values()],
                }
            )

        elif msg["kind"] == "JOIN_ROOM":
            if self.security_level < SecurityLevel.MEMBER:
                await self.ws.send_json(
                    {"kind": "NOPE", "rid": msg.get("rid"), "why": "not_allowed"}
                )
                return
            if "room" not in msg:
                await self.ws.send_json(
                    {"kind": "WHAT", "rid": msg.get("rid"), "why": "no_room_given"}
                )
                return
            room = rooms.get(msg["room"])
            if room is None:
                await self.ws.send_json(
                    {
                        "kind": "NOPE",
                        "rid": msg.get("rid"),
                        "why": "that_room_doesnt_exist",
                    }
                )
                return
            # if they're already in a room, yeet them out
            if self.room is not None:
                await self.leave_room(tell_ourselves=True)
            await self.join_room(room)
            await self.ws.send_json({"kind": "ACK", "rid": msg.get("rid")})

        elif msg["kind"] == "JOIN_ROOM_BY_INVITE_LINK":
            if "code" not in msg:
                await self.ws.send_json(
                    {"kind": "WHAT", "rid": msg.get("rid"), "why": "no_code_given"}
                )
                return
            link = invite_links.get(msg["code"])
            if link is None:
                await self.ws.send_json(
                    {"kind": "NOPE", "rid": msg.get("rid"), "why": "invalid_code"}
                )
                return
            try:
                link.use()
            except NoUses:
                await self.ws.send_json(
                    {"kind": "NOPE", "rid": msg.get("rid"), "why": "no_uses_left"}
                )
                return
            if self.room is not None:
                await self.leave_room(tell_ourselves=True)
            self.name = link.name
            if self.security_level < SecurityLevel.GUEST:
                await self.change_security_level(SecurityLevel.GUEST)
            await self.join_room(link.room)
            await self.ws.send_json({"kind": "ACK", "rid": msg.get("rid")})

        elif msg["kind"] == "CREATE_ROOM":
            if self.security_level < SecurityLevel.MEMBER:
                await self.ws.send_json(
                    {"kind": "NOPE", "rid": msg.get("rid"), "why": "not_allowed"}
                )
                return
            if "timeslotid" not in msg:
                await self.ws.send_json(
                    {"kind": "WHAT", "rid": msg.get("rid"), "why": "missing_timeslotid"}
                )
                return

            room = await Room.create(int(msg["timeslotid"]))
            room.host_id = self.id
            await self.join_room(room)
            if self.security_level < SecurityLevel.MEMBER_HOST:
                await self.change_security_level(SecurityLevel.MEMBER_HOST)
            rooms[room.id] = room
            await self.ws.send_json({"kind": "ACK", "rid": msg.get("rid")})

        elif msg["kind"] == "CREATE_INVITE_LINK":
            if self.room is None:
                await self.ws.send_json(
                    {"kind": "CANT", "rid": msg.get("rid"), "why": "not_in_room"}
                )
                return
            if self.security_level < SecurityLevel.MEMBER_HOST:
                await self.ws.send_json(
                    {"kind": "NOPE", "rid": msg.get("rid"), "why": "not_allowed"}
                )
                return
            if "guest_name" not in msg:
                await self.ws.send_json(
                    {"kind": "WHAT", "rid": msg.get("rid"), "why": "missing_guest_name"}
                )
                return
            uses = -1
            if "max_uses" in msg:
                uses = msg["max_uses"]
            link = await self.room.create_invite_link(self, msg["guest_name"], uses)
            await self.ws.send_json(
                {
                    "kind": "INVITE_LINK",
                    "rid": msg.get("rid"),
                    **link.to_dict(include_room=False),
                }
            )

        elif msg["kind"] == "LIST_INVITE_LINKS":
            if self.room is None:
                await self.ws.send_json(
                    {"kind": "CANT", "rid": msg.get("rid"), "why": "not_in_room"}
                )
                return
            if self.security_level < SecurityLevel.MEMBER_HOST:
                await self.ws.send_json(
                    {"kind": "NOPE", "rid": msg.get("rid"), "why": "not_allowed"}
                )
                return

            links = [x for x in invite_links.values() if x.room.id == self.room.id]

            await self.ws.send_json(
                {
                    "kind": "LIST_INVITE_LINKS",
                    "rid": msg.get("rid"),
                    "links": [l.to_dict() for l in links],
                }
            )

        elif msg["kind"] == "CANCEL_INVITE_LINK":
            if self.room is None:
                await self.ws.send_json(
                    {"kind": "CANT", "rid": msg.get("rid"), "why": "not_in_room"}
                )
                return
            if self.security_level < SecurityLevel.MEMBER_HOST:
                await self.ws.send_json(
                    {"kind": "NOPE", "rid": msg.get("rid"), "why": "not_allowed"}
                )
                return
            if msg["code"] not in invite_links:
                await self.ws.send_json(
                    {"kind": "CANT", "rid": msg.get("rid"), "why": "no_such_link"}
                )
                return
            del invite_links[msg["code"]]
            await self.ws.send_json({"kind": "ACK", "rid": msg.get("rid")})

        elif msg["kind"] == "LIST_PEERS":
            if self.room is None:
                await self.ws.send_json(
                    {"kind": "CANT", "rid": msg.get("rid"), "why": "not_in_room"}
                )
                return
            await self.ws.send_json(
                {
                    "kind": "LIST_PEERS",
                    "rid": msg.get("rid"),
                    "peers": list([p.to_dict() for p in self.room.peers.values()]),
                }
            )

        elif msg["kind"] == "MESSAGE_ALL":
            if self.room is None:
                await self.ws.send_json(
                    {"kind": "CANT", "rid": msg.get("rid"), "why": "not_in_room"}
                )
                return
            if "msg" not in msg:
                await self.ws.send_json(
                    {"kind": "WHAT", "rid": msg.get("rid"), "why": "missing_msg"}
                )
                return
            await self.room.message_all(self, msg["msg"])
            await self.ws.send_json({"kind": "ACK", "rid": msg.get("rid")})

        elif msg["kind"] == "MESSAGE_PEER":
            if self.room is None:
                await self.ws.send_json(
                    {"kind": "CANT", "rid": msg.get("rid"), "why": "not_in_room"}
                )
                return
            if "msg" not in msg:
                await self.ws.send_json(
                    {"kind": "WHAT", "rid": msg.get("rid"), "why": "missing_msg"}
                )
                return
            if "to" not in msg:
                await self.ws.send_json(
                    {"kind": "WHAT", "rid": msg.get("rid"), "why": "missing_to"}
                )
                return

            receiver = self.room.peers.get(msg["to"])
            if receiver is None:
                await self.ws.send_json(
                    {"kind": "CANT", "rid": msg.get("rid"), "why": "no_such_peer"}
                )
                return

            await receiver.send_msg_from_peer(self, msg["msg"])
            await self.ws.send_json({"kind": "ACK", "rid": msg.get("rid")})
        else:
            await self.ws.send_json(
                {"kind": "WHAT", "rid": msg.get("rid"), "why": "unrecognised_kind"}
            )

    def sync_reconnect(self):
        global reconnect_tokens
        reconnect_tokens[self.reconnect_token] = self.to_dict(include_room=False)
        print(reconnect_tokens[self.reconnect_token])

    def to_dict(self, include_room: bool = False) -> Dict[str, Any]:
        return {
            "id": self.id,
            "name": self.name,
            "security_level": self.security_level,
            "room_id": self.room.id if self.room is not None else None,
            "room": self.room.to_dict()
            if include_room and self.room is not None
            else None,
        }

    async def reconnect(self, data: Dict[str, Any]) -> Optional[Room]:
        global rooms
        """
        Syncs this Peer's state with the data in data.

        Note that this WILL overwrite every field, including id(!), so make sure that the data is trusted. Also, only call this once in the 
        peer's lifecycle, otherwise weird shit will happen!

        Returns the ID of the room they were previously in, if it still exists. Note that it does *not* rejoin the room, so you're responsible for that.
        """
        if "id" in data:
            self.id = data["id"]
        if "name" in data:
            self.name = data["name"]
        if "security_level" in data:
            self.security_level = data["security_level"]
        if "room_id" in data:
            if (room := rooms.get(data["room_id"])) is not None:
                return room
        return None


async def socket(req: aiohttp.web.Request):
    global rooms, reconnect_tokens
    ws = aiohttp.web.WebSocketResponse()
    await ws.prepare(req)
    id = str(uuid.uuid4())
    print("hello", id)

    try:
        msg = await ws.receive_json(timeout=5.0)
    except json.decoder.JSONDecodeError:
        await ws.send_json({"kind": "NOPE", "why": "invalid_json"})
        await ws.close(code=1002)
        return
    except:
        await ws.send_json({"kind": "NOPE", "why": "say_hello_please"})
        await ws.close(code=1002)
        return

    if msg["kind"] != "HELLO":
        await ws.send_json(
            {"kind": "NOPE", "rid": msg.get("rid"), "why": "say_hello_please"}
        )
        await ws.close(code=1002)
        return

    peer = Peer(id, ws)

    reconnect_data = None

    if "reconnect_token" in msg and msg["reconnect_token"] is not None:
        reconnect_data = reconnect_tokens.get(msg["reconnect_token"])

    rejoin_room: Optional[Room] = None
    if reconnect_data is not None:
        print("Got reconnect data", reconnect_data)
        rejoin_room = await peer.reconnect(reconnect_data)
    else:
        user = await check_cookie(req.headers.getone("Cookie", ""))
        if user is not None:
            peer.security_level = SecurityLevel.MEMBER
            peer.name = user.fname + " " + user.sname

    await ws.send_json(
        {
            "kind": "HELLO",
            "rid": msg.get("rid"),
            **peer.to_dict(include_room=False),
            "reconnect_token": peer.reconnect_token,
            "reconnected": reconnect_data is not None,
        }
    )
    if rejoin_room is not None:
        await peer.join_room(rejoin_room)

    disconnected_gracefully = False
    try:
        async for msg in ws:
            type: aiohttp.WSMsgType = msg.type  # type: ignore
            if type == aiohttp.WSMsgType.TEXT:
                try:
                    data = msg.json()
                except:
                    await ws.send_json({"kind": "NOPE", "why": "invalid_json"})
                    await ws.close(code=1002)
                    return

                if data["kind"] == "DISCONNECT":
                    disconnected_gracefully = True
                    del reconnect_tokens[peer.reconnect_token]
                    await ws.send_json({ "kind": "GOODBYE", "rid": data.get("rid") })
                    await ws.close()
                else:
                    await peer.handle_msg(data)
    
            elif type == aiohttp.WSMsgType.ERROR:
                print(id, "left uncleanly", msg)
    finally:
        print("goodbye", id)
        if peer.room is not None:
            await peer.leave_room(tell_ourselves=False, abnormal=not disconnected_gracefully)


if __name__ == "__main__":
    port = int(config.get("multiserver", "port", fallback="1358"))
    app = aiohttp.web.Application()
    app.add_routes([aiohttp.web.get("/socket", socket)])  # type: ignore
    aiohttp.web.run_app(app, port=port)
