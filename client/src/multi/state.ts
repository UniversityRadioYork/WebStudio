import {
  createAction,
  createSlice,
  Middleware,
  PayloadAction,
} from "@reduxjs/toolkit";
import { omit, pick } from "lodash";
import { RootState } from "../rootReducer";

interface MultiPeer {
  id: string;
  name: string;
  security_level: number;
}

interface MultiRoom {
  id: string;
  hostId: string;
  timeslotid: number;
  peers: MultiPeer[];
}

export enum MultiConnectionState {
  NONE = "NONE",
  CONNECTING = "CONNECTING",
  CONNECTED = "CONNECTED",
  HELLO = "HELLO",
  JOINED = "JOINED",
  DISCONNECTED = "DISCONNECTED",
}

export interface MultiState {
  state: MultiConnectionState;
  room: MultiRoom | null;
  chatMessages: Array<{ msg: string; from: string; em?: boolean }>;
  us: MultiPeer | null;
  inviteLinkCreateStatus: "pending" | "done" | "error" | null;
  ephemeralInviteLink: string | null;
}

const initialState: MultiState = {
  state: MultiConnectionState.NONE,
  room: null,
  chatMessages: [],
  us: null,
  inviteLinkCreateStatus: null,
  ephemeralInviteLink: null,
};

const extraActions = {
  connect: createAction(
    "Multi/Connect()"
  ),
  createInviteLink: createAction<{ name: string; uses?: number }>(
    "Multi/CreateInviteLink()"
  ),
  sendChatMessage: createAction<string>("Multi/SendChatMessage()"),
};

const multiState = createSlice({
  name: "Multi",
  initialState,
  reducers: {
    connected(state) {
      state.state = MultiConnectionState.CONNECTED;
    },
    hello(state, action: PayloadAction<MultiPeer>) {
      state.state = MultiConnectionState.HELLO;
      state.us = action.payload;
    },
    securityLevelChanged(state, action: PayloadAction<number>) {
      if (state.us) {
        state.us.security_level = action.payload;
      }
    },
    joinedRoom(state, action: PayloadAction<MultiRoom>) {
      state.state = MultiConnectionState.JOINED;
      state.room = action.payload;
    },
    peerJoined(state, action: PayloadAction<MultiPeer>) {
      state.room!.peers.push(action.payload);
      state.chatMessages.push({
        from: action.payload.name,
        msg: "joined the session",
        em: true,
      });
    },
    peerLeft(state, action: PayloadAction<{ id: string }>) {
      const peer = state.room!.peers.find((x) => x.id === action.payload.id);
      if (peer) {
        state.chatMessages.push({
          from: peer.name,
          msg: "left the session",
          em: true,
        });
      }
      state.room!.peers.filter((x) => x.id !== action.payload.id);
    },
    setEphemeralInviteLink(state, action: PayloadAction<string>) {
      state.ephemeralInviteLink = action.payload;
      state.inviteLinkCreateStatus = "done";
    },
    clearEphemeralInviteLink(state) {
      state.ephemeralInviteLink = null;
      state.inviteLinkCreateStatus = null;
    },
    receivedTextMessage(
      state,
      action: PayloadAction<{ msg: string; from: string }>
    ) {
      state.chatMessages.push(action.payload);
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(extraActions.connect, (state) => {
        state.state = MultiConnectionState.CONNECTING;
      })
      .addCase(extraActions.createInviteLink, (state) => {
        state.inviteLinkCreateStatus = "pending";
      });
  },
});

export default multiState.reducer;

export const actions = {
  ...pick(multiState.actions, "clearEphemeralInviteLink"),
  ...pick(extraActions, "connect", "createInviteLink", "sendChatMessage"),
};

export const multiServerMiddleware: Middleware<{}, RootState> = (store) => {
  let connection: WebSocket;
  const send = (data: any) => {
    if (!connection) {
      throw new Error("Tried to send with no connection!");
    }
    connection.send(JSON.stringify(data));
  };
  let requestResolvers: { [rid: string]: (data: any) => any } = {};
  let lastRid = 0;
  const nextRid = () => {
    return (lastRid++).toString(16);
  };
  const waitForReply = (rid: string) => {
    const promise = new Promise((resolve) => {
      requestResolvers[rid] = resolve;
    });
    return promise as Promise<any>;
  };

  return (next) => async (action) => {
    if (extraActions.connect.match(action)) {
      connection = new WebSocket(process.env.REACT_APP_MULTISERVER_URL!);
      connection.onopen = () => {
        store.dispatch(multiState.actions.connected());
        send({ kind: "HELLO" });
      };
      connection.onclose = () => {};
      connection.onerror = (err) => {};
      connection.onmessage = async (e) => {
        const data = JSON.parse(e.data);
        if ("rid" in data && data.rid !== null) {
          if (data.rid in requestResolvers) {
            requestResolvers[data.rid](data);
            delete requestResolvers[data.rid];
          } else {
            console.warn("Orphan RID " + data.rid);
          }
        } else {
          switch (data.kind) {
            case "HELLO":
              store.dispatch(
                multiState.actions.hello(omit(data, "kind", "room") as any)
              );

              const listRoomsRid = nextRid();

              send({
                kind: "LIST_ROOMS",
                rid: listRoomsRid,
              });
              const response = await waitForReply(listRoomsRid);
              if (response.kind !== "LIST_ROOMS") {
                break;
              }

              const ourTimeslotId = store.getState().session.currentTimeslot?.timeslot_id;
              if (typeof ourTimeslotId !== "number") {
                throw new Error("Got no timeslot inside multi Connect(); can't happen")
              }

              const ourTimeslotsRoom = (response.rooms as MultiRoom[]).find(
                x => x.timeslotid === ourTimeslotId
              );

              const joinRid = nextRid();

              if (ourTimeslotsRoom) {
                send({
                  kind: "JOIN_ROOM",
                  room: ourTimeslotsRoom.id
                });
              } else {
                send({
                  kind: "CREATE_ROOM",
                  timeslotid: ourTimeslotId
                });
              }
            
              const joinResponse = await waitForReply(joinRid);
              if (joinResponse.kind !== "ACK") {
                console.warn(joinResponse);
              }

              break;

            case "JOINED_ROOM":
              store.dispatch(
                multiState.actions.joinedRoom(omit(data, "kind") as any)
              );
              break;

            case "PEER_JOINED":
              store.dispatch(
                multiState.actions.peerJoined(omit(data, "kind") as MultiPeer)
              );
              break;

            case "PEER_LEFT":
              store.dispatch(
                multiState.actions.peerLeft({ id: data.id as string })
              );
              break;

            case "SECURITY_LEVEL_CHANGED":
              store.dispatch(
                multiState.actions.securityLevelChanged(
                  data.security_level as number
                )
              );
              break;
            case "ROOM_MSG":
            case "PEER_MSG":
              const msg = data.msg;
              switch (msg.kind) {
                case "MESSAGE":
                  const multiStateNow = store.getState().multi;
                  const fromPeer = multiStateNow.room!.peers.find(
                    (x) => x.id === data.from
                  );
                  let from: string;
                  if (fromPeer) {
                    from = fromPeer.name;
                  } else if (msg.from === multiStateNow.us!.id) {
                    from = multiStateNow.us!.name;
                  } else {
                    from = "(unknown peer)";
                  }
                  store.dispatch(
                    multiState.actions.receivedTextMessage({
                      from,
                      msg: msg.msg,
                    })
                  );
              }
          }
        }
      };
    } else if (extraActions.createInviteLink.match(action)) {
      if (!connection) {
        console.warn("Tried to create invite link with no connection???");
        return;
      }
      const inviteLinkRid = nextRid();
      send({
        kind: "CREATE_INVITE_LINK",
        rid: inviteLinkRid,
        guest_name: action.payload.name,
        uses: action.payload.uses || -1,
      });
      const response = await waitForReply(inviteLinkRid);
      if (response.kind !== "INVITE_LINK") {
        console.warn(response);
      }
      store.dispatch(multiState.actions.setEphemeralInviteLink(response.link));
    } else if (extraActions.sendChatMessage.match(action)) {
      send({
        kind: "MESSAGE_ALL",
        msg: {
          kind: "MESSAGE",
          msg: action.payload,
        },
      });
    } else {
      return next(action);
    }
  };
};
