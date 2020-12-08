from typing import Any, Dict, List, Optional, Set
import aiohttp
import aiohttp.web
import asyncio
import json
import uuid
import os
import configparser
import enum


config = configparser.RawConfigParser()
config.read("serverconfig.ini")
api_key = config.get("myradio", "key")


class SecurityLevel(enum.IntEnum):
    NONE = 0
    GUEST = 10
    MEMBER = 20
    MEMBER_HOST = 30


http_session = aiohttp.ClientSession()


class MyRadioUser:
    memberid: int
    fname: str
    sname: str


async def check_cookie(in_cookie_header: str) -> Optional[MyRadioUser]:
    global api_key
    res = await http_session.get(
        f"https://ury.org.uk/api/v2/user/currentuser?api_key={api_key}",
        headers={"Cookie": in_cookie_header},
    )
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


class NoUses(Exception):
    pass


class InviteLink:
    code: str
    room: "Room"
    name: str
    uses: int

    @classmethod
    def create(cls, room: "Room", name: str, uses: int = -1):
        global invite_links
        link = InviteLink()
        id = uuid.uuid4()
        id_str = ""
        for field in id.fields[:-3]:
            id_str += hex(field)[2:]
        link.code = id_str
        link.room = room
        link.name = name
        link.uses = uses
        invite_links[link.code] = link
        return link

    def use(self):
        global invite_links
        if self.uses > -1:
            if self.uses == 0:
                raise NoUses()
            self.uses -= 1
            if self.uses == 0:
                invite_links.remove(self.code)


invite_links: Dict[str, InviteLink] = dict()
rooms: Dict[str, "Room"] = dict()


class Room:
    id: str
    timeslotid: int
    peers: Dict[str, "Peer"] = dict()
    host_id: Optional[str]

    def __init__(self, timeslotid: int):
        self.id = hex(uuid.uuid4().fields[-1])[2:]
        self.timeslotid = timeslotid

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

    async def message_all(self, sender: "Peer", msg: Any):
        for peer in self.peers.values():
            await peer.send_msg_from_room(sender, msg)

    def to_dict(self, include_peers=False):
        return {
            "id": self.id,
            "timeslotid": self.timeslotid,
            "peers": list([p.to_dict(include_room=False) for p in self.peers.values()])
            if include_peers
            else None,
            "host": self.host_id,
        }


class Peer:
    id: str
    name: str = ""
    room: Optional[Room] = None
    ws: aiohttp.web.WebSocketResponse
    security_level = 0

    def __init__(self, id: str, ws: aiohttp.web.WebSocketResponse):
        self.id = id
        self.ws = ws

    async def join_room(self, room: Room):
        self.room = room
        await room.add_peer(self)
        await self.ws.send_json(
            {"kind": "JOINED_ROOM", **room.to_dict(include_peers=True)}
        )

    async def leave_room(self, tell_ourselves=False):
        if tell_ourselves:
            await self.send_peer_left_room(self)
        await self.room.remove_peer(self)

    async def change_security_level(self, new_level: int):
        self.security_level = new_level
        await self.ws.send_json(
            {"kind": "SECURITY_LEVEL_CHANGED", "security_level": self.security_level}
        )

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

    async def handle_msg(self, msg: Dict[str, Any]):
        global rooms, invite_links
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

            room = Room(int(msg["timeslotid"]))
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
            if uses in msg:
                uses = msg["uses"]
            link = InviteLink.create(self.room, msg["guest_name"], uses)
            await self.ws.send_json(
                {
                    "kind": "INVITE_LINK",
                    "rid": msg.get("rid"),
                    "link": f"http://local-development.ury.org.uk:3001#multicode={link.code}",
                    "name": link.name,
                    "uses": link.uses,
                }
            )

        elif msg["kind"] == "GET_PEERS":
            if self.room is None:
                await self.ws.send_json(
                    {"kind": "CANT", "rid": msg.get("rid"), "why": "not_in_room"}
                )
                return
            await self.ws.send(
                json.dumps(
                    {
                        "kind": "ROOM_PEERS",
                        "rid": msg.get("rid"),
                        "peers": list([p.to_dict() for p in self.room.peers.values()]),
                    }
                )
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

    def to_dict(self, include_room=False):
        return {
            "id": self.id,
            "name": self.name,
            "security_level": self.security_level,
            "room": self.room.to_dict() if include_room else None,
        }


async def socket(req: aiohttp.web.Request):
    global rooms
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

    print(req.headers.getone("Cookie", "no cookie!"))
    user = await check_cookie(req.headers.getone("Cookie", ""))
    if user is not None:
        peer.security_level = SecurityLevel.MEMBER
        peer.name = user.fname + " " + user.sname

    await ws.send_json(
        {"kind": "HELLO", "rid": msg.get("rid"), **peer.to_dict(include_room=False)}
    )

    try:
        async for msg in ws:
            if msg.type == aiohttp.WSMsgType.TEXT:
                try:
                    data = msg.json()
                except:
                    await ws.send_json({"kind": "NOPE", "why": "invalid_json"})
                    await ws.close(code=1002)
                    return

                await peer.handle_msg(data)
            elif msg.type == aiohttp.WSMsgType.ERROR:
                print(id, "left uncleanly", msg)
    finally:
        print("goodbye", id)
        if peer.room is not None:
            await peer.leave_room(tell_ourselves=False)


if __name__ == "__main__":
    port = int(config.get("multiserver", "port", fallback="1358"))
    app = aiohttp.web.Application()
    app.add_routes([aiohttp.web.get("/socket", socket)])
    aiohttp.web.run_app(app, port=port)
    asyncio.get_event_loop().run_until_complete(http_session.close())
