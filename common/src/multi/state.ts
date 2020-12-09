import {
  createAction,
  createSlice,
  Middleware,
  PayloadAction,
} from "@reduxjs/toolkit";
import { omit, pick } from "lodash";
import { parse as parseQs } from "qs";

interface MultiRootState {
  multi: MultiState;
  session?: {
    currentTimeslot: {
      timeslot_id: number;
    } | null;
  };
}

interface MultiPeer {
  id: string;
  name: string;
  security_level: number;
}

interface MultiRoom {
  id: string;
  hostId: string;
  name: string;
  timeslotid: number;
  peers: MultiPeer[];
}

interface MultiInviteLink {
  name: string;
  code: string;
  url: string;
  uses: number;
  max_uses: number;
}

export enum MultiConnectionState {
  NONE = "Not Connected",
  CONNECTING = "Connecting",
  CONNECTED = "Connected",
  HELLO = "Hello!",
  JOINED = "Joined",
  DISCONNECTED = "Disconnected",
  FAIL_NO_ACTIVE_TIMESLOT = "FAIL_NO_ACTIVE_TIMESLOT",
  FAIL_NOT_SIGNED_IN_AND_NO_GUEST_LINK = "FAIL_NOT_SIGNED_IN_AND_NO_GUEST_LINK",
  FAIL_NO_HOSTING_AS_GUEST = "FAIL_NO_HOSTING_AS_GUEST",
  FAIL_NO_GUESTING_AS_HOST = "FAIL_NO_GUESTING_AS_HOST",
  FAIL_INVALID_INVITE = "FAIL_INVALID_INVITE",
  FAIL_INVITE_OUT_OF_USES = "FAIL_INVITE_OUT_OF_USES"
}

export interface MultiState {
  state: MultiConnectionState;
  room: MultiRoom | null;
  chatMessages: Array<{ msg: string; from: string; em?: boolean }>;
  us: MultiPeer | null;
  inviteLinkCreateStatus: "pending" | "error" | null;
  inviteLinkRefreshStatus: "pending" | "error" | null;
  inviteLinks: MultiInviteLink[];
}

const initialState: MultiState = {
  state: MultiConnectionState.NONE,
  room: null,
  chatMessages: [],
  us: null,
  inviteLinkCreateStatus: null,
  inviteLinkRefreshStatus: null,
  inviteLinks: [],
};

export function createMultiState(mode: "host" | "guest") {
  const extraActions = {
    connect: createAction("Multi/Connect()"),
    createInviteLink: createAction<{ name: string; uses?: number }>(
      "Multi/CreateInviteLink()"
    ),
    sendChatMessage: createAction<string>("Multi/SendChatMessage()"),
    disconnect: createAction("Multi/Disconnect()"),
    refreshInviteLinks: createAction("Multi/RefreshInviteLinks()"),
  };

  const multiState = createSlice({
    name: "Multi",
    initialState,
    reducers: {
      connected(state) {
        state.state = MultiConnectionState.CONNECTED;
      },
      disconnected(state) {
        // on a manual disconnect, Disconnect() will fire _before_ disconnected
        // ditto for closing after a failed attempt to connect
        if (
          state.state !== MultiConnectionState.NONE &&
          state.state !== MultiConnectionState.FAIL_NO_ACTIVE_TIMESLOT &&
          state.state !== MultiConnectionState.FAIL_NO_HOSTING_AS_GUEST &&
          state.state !==
            MultiConnectionState.FAIL_NOT_SIGNED_IN_AND_NO_GUEST_LINK &&
          state.state !== MultiConnectionState.FAIL_NO_GUESTING_AS_HOST &&
          state.state !== MultiConnectionState.FAIL_INVALID_INVITE
        ) {
          state.state = MultiConnectionState.DISCONNECTED;
        }
      },
      setState(state, action: PayloadAction<MultiConnectionState>) {
        state.state = action.payload;
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
        state.room!.peers =  state.room!.peers.filter((x) => x.id !== action.payload.id);
      },
      refreshInviteLinksDone(state, action: PayloadAction<MultiInviteLink[]>) {
        state.inviteLinks = action.payload;
        state.inviteLinkRefreshStatus = null;
      },
      createInviteLinkDone(state, action: PayloadAction<MultiInviteLink>) {
        state.inviteLinkCreateStatus = null;
        state.inviteLinks.push(action.payload);
      },
      receivedTextMessage(
        state,
        action: PayloadAction<{ msg: string; from: string }>
      ) {
        state.chatMessages.push(action.payload);
      },
      usUpdated(state, action: PayloadAction<Partial<MultiPeer>>) {
        state.us = {
          ...state.us,
          ...action.payload,
        };
      },
      peerUpdated(
        state,
        action: PayloadAction<Partial<MultiPeer> & { id: string }>
      ) {
        const peerIdx = state.room?.peers?.findIndex(
          (x) => x.id === action.payload.id
        );
        if (peerIdx > -1) {
          state.room!.peers![peerIdx] = {
            ...state.room!.peers![peerIdx],
            ...action.payload,
          };
        }
      },
    },
    extraReducers: (builder) => {
      builder
        .addCase(extraActions.connect, (state) => {
          state.state = MultiConnectionState.CONNECTING;
        })
        .addCase(extraActions.createInviteLink, (state) => {
          state.inviteLinkCreateStatus = "pending";
        })
        .addCase(extraActions.disconnect, (state) => {
          state = {
            ...initialState,
          };
        })
        .addCase(extraActions.refreshInviteLinks, (state) => {
          state.inviteLinkRefreshStatus = "pending";
        });
    },
  });

  const actions = {
    // ...pick(multiState.actions, "clearEphemeralInviteLink"),
    ...pick(
      extraActions,
      "connect",
      "createInviteLink",
      "sendChatMessage",
      "disconnect",
      "refreshInviteLinks"
    ),
  };

  const multiServerMiddleware: Middleware<{}, MultiRootState> = (store) => {
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
        // Parse out timeslot and invite code stuffs before we actually connect
        // (because there are several reasons why this could go wrong)
        const hash = window.location.hash.replace(/^\#?/, "");
        const hashData = parseQs(hash);

        let ourTimeslotId: number | null = store.getState().session
          ?.currentTimeslot?.timeslot_id;

        if (typeof ourTimeslotId !== "number") {
          // We could be in guest mode but still be joining without a code
          if (mode === "guest") {
            // Invite codes override everything
            if ("multicode" in hashData) {
              ourTimeslotId = null;
            } else {
              // Guest mode and no invite code; if the user is signed in to MyRadio
              // and has a timeslot selected, use that
              const apiRes = await fetch(
                process.env.REACT_APP_MYRADIO_BASE! +
                  "/timeslot/userselectedtimeslot",
                {
                  credentials: "include",
                }
              );
              const apiData = await apiRes.json();

              if (apiData.status === "OK") {
                if (apiData.payload !== null) {
                  // Signed in with active timeslot; just join that
                  ourTimeslotId = apiData.payload.timeslot_id;
                } else {
                  // Signed in, but no active timeslot
                  store.dispatch(
                    multiState.actions.setState(
                      MultiConnectionState.FAIL_NO_ACTIVE_TIMESLOT
                    )
                  );
                  return;
                }
              } else if (
                apiData.payload === "No valid authentication data provided."
              ) {
                store.dispatch(
                  multiState.actions.setState(
                    MultiConnectionState.FAIL_NOT_SIGNED_IN_AND_NO_GUEST_LINK
                  )
                );
                return;
              } else {
                throw new Error(apiData.payload);
              }
            }
          } else {
            throw new Error(
              "Can't happen; are you running in host mode when you shouldn't be?"
            );
          }
        }

        connection = new WebSocket(process.env.REACT_APP_MULTISERVER_URL!);

        connection.onopen = () => {
          store.dispatch(multiState.actions.connected());
          const reconnectTokenMaybe = window.sessionStorage.getItem(
            "MultiserverReconnectToken"
          );
          send({ kind: "HELLO", reconnect_token: reconnectTokenMaybe });
        };

        connection.onclose = () => {
          console.log("MultiSocket Closed");
          store.dispatch(multiState.actions.disconnected());
        };

        connection.onerror = (err) => {
          console.error("MultiSocket ERROR!", err);
        };

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

                window.sessionStorage.setItem(
                  "MultiserverReconnectToken",
                  data.reconnect_token
                );

                const joinRid = nextRid();

                if ("multicode" in hashData) {
                  if (mode === "host") {
                    throw new Error(
                      "Using multicode to join in host mode, you don't want this!"
                    );
                  }
                  const code = hashData.multicode;
                  if (typeof code !== "string") {
                    // TODO: all these throws should become error actions
                    throw new Error("multicode type is not string");
                  }
                  send({
                    kind: "JOIN_ROOM_BY_INVITE_LINK",
                    code,
                    rid: joinRid,
                  });
                } else {
                  const listRoomsRid = nextRid();
                  send({
                    kind: "LIST_ROOMS",
                    rid: listRoomsRid,
                  });
                  const response = await waitForReply(listRoomsRid);
                  if (response.kind !== "LIST_ROOMS") {
                    break;
                  }

                  const ourTimeslotsRoom = (response.rooms as MultiRoom[]).find(
                    (x) => x.timeslotid === ourTimeslotId
                  );

                  if (ourTimeslotsRoom) {
                    send({
                      kind: "JOIN_ROOM",
                      room: ourTimeslotsRoom.id,
                      rid: joinRid,
                    });
                  } else if (mode === "host") {
                    send({
                      kind: "CREATE_ROOM",
                      timeslotid: ourTimeslotId,
                      rid: joinRid,
                    });
                  } else {
                    connection.close();
                    store.dispatch(
                      multiState.actions.setState(
                        MultiConnectionState.FAIL_NO_HOSTING_AS_GUEST
                      )
                    );
                    return;
                  }
                }

                const joinResponse = await waitForReply(joinRid);
                if (joinResponse.kind !== "ACK") {
                  console.warn(joinResponse);
                  switch (joinResponse.why) {
                    case "invalid_code":
                      store.dispatch(
                        multiState.actions.setState(
                          MultiConnectionState.FAIL_INVALID_INVITE
                        )
                      );
                      connection.close();
                      break;
                    case "no_uses_left":
                    store.dispatch(
                      multiState.actions.setState(
                        MultiConnectionState.FAIL_INVITE_OUT_OF_USES
                      )
                    );
                    connection.close();
                    return;
                  }
                }

                break;

              case "JOINED_ROOM":
                if (mode === "host") {
                  if (data.host !== store.getState().multi.us?.id) {
                    // oh noes
                    store.dispatch(
                      multiState.actions.setState(
                        MultiConnectionState.FAIL_NO_GUESTING_AS_HOST
                      )
                    );
                    connection.close();
                    return;
                  }
                }

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

              case "PEER_UPDATE":
                if (data.id === store.getState().multi.us?.id) {
                  store.dispatch(
                    multiState.actions.usUpdated(omit(data, "kind", "rid"))
                  );
                }
                store.dispatch(
                  multiState.actions.peerUpdated(
                    omit(data, "kind", "rid") as any
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
                    break;

                  default:
                    console.warn(`Unrecognised ${data.kind} kind ${msg.kind}`);
                }
                break;
              default:
                console.warn(`Unknown MultiServer message kind ${data.kind}`);
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
          max_uses: action.payload.uses || -1,
        });

        const response = await waitForReply(inviteLinkRid);
        if (response.kind !== "INVITE_LINK") {
          console.warn(response);
        }

        store.dispatch(
          multiState.actions.createInviteLinkDone(
            omit(response, "kind", "rid") as MultiInviteLink
          )
        );
      } else if (extraActions.sendChatMessage.match(action)) {
        send({
          kind: "MESSAGE_ALL",
          msg: {
            kind: "MESSAGE",
            msg: action.payload,
          },
        });
      } else if (extraActions.disconnect.match(action)) {
        if (connection && connection.readyState === WebSocket.OPEN) {
          send({
            kind: "DISCONNECT"
          });
          window.sessionStorage.removeItem("MultiStudioReconnectToken");
          // Don't close the connection, server will do it for us
        }
      } else if (extraActions.refreshInviteLinks.match(action)) {
        const refreshRid = nextRid();
        send({
          kind: "LIST_INVITE_LINKS",
          rid: refreshRid,
        });

        const response = await waitForReply(refreshRid);
        if (response.kind !== "LIST_INVITE_LINKS") {
          console.error(response);
        } else {
          store.dispatch(
            multiState.actions.refreshInviteLinksDone(response.links)
          );
        }
      }

      return next(action);
    };
  };

  return {
    reducer: multiState.reducer,
    actions,
    middleware: multiServerMiddleware,
  };
}
