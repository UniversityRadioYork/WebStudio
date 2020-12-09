import React, { useRef, useState } from "react";
import { useEffect } from "react";
import { useSelector, useDispatch } from "react-redux";
import "./App.scss";
import { RootState } from "./rootReducer";
import { actions as multiActions, MultiConnectionState } from "./multi/state";
import { InputGroup, InputGroupAddon, Input, Button } from "reactstrap";
import { FaPaperPlane } from "react-icons/fa";

import logo from "./assets/logo.png";

const LOAD_SCREEN_STATES: MultiConnectionState[] = [
  MultiConnectionState.NONE,
  MultiConnectionState.CONNECTING,
  MultiConnectionState.CONNECTED,
  MultiConnectionState.HELLO,
];

enum SecurityLevel {
  None = 0,
  Guest = 10,
  Member = 20,
  MemberHost = 30,
}

function RoomState() {
  const room = useSelector((state: RootState) => state.multi.room);
  const us = useSelector((state: RootState) => state.multi.us);
  const chat = useSelector((state: RootState) => state.multi.chatMessages);

  const chatBoxRef = useRef<HTMLUListElement>(null);
  useEffect(() => {
    if (chatBoxRef.current) {
      chatBoxRef.current.scrollTop = chatBoxRef.current.scrollHeight;
    }
  }, [chat]);

  const [chatMsg, setChatMsg] = useState("");
  const dispatch = useDispatch();

  function sendMsg() {
    dispatch(multiActions.sendChatMessage(chatMsg));
    setChatMsg("");
  }

  if (!room) {
    return (
      <em>
        Loading room... if this doesn't go away something's gone very very wrong
      </em>
    );
  }

  return (
    <div className="d-flex align-items-center justify-content-center flex-column">
      <div className="room-header mb-auto">
        <h1>{room.name}</h1>
        <div>
          <ul>
            {room.peers.map((peer) => (
              <li key={peer.id}>
                <b>{peer.name}</b> {peer.id === us?.id && <em>(you!)</em>}{" "}
                {peer.security_level === SecurityLevel.MemberHost && (
                  <em>(host)</em>
                )}
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="room-chat mt-auto">
        <ul className="chat-messages list-unstyled" ref={chatBoxRef}>
          {chat.map((msg, idx) => (
            <li key={idx}>
              <b>{msg.from}</b>: {msg.em ? <em>{msg.msg}</em> : msg.msg}
            </li>
          ))}
        </ul>
        <InputGroup>
          <Input value={chatMsg} onChange={(e) => setChatMsg(e.target.value)} />
          <InputGroupAddon addonType="append">
            <Button color="success" onClick={sendMsg}>
              <FaPaperPlane />
            </Button>
          </InputGroupAddon>
        </InputGroup>
      </div>
      <div className="room-footer"></div>
    </div>
  );
}

function App() {
  const state = useSelector((state: RootState) => state.multi.state);

  const dispatch = useDispatch();

  useEffect(() => {
    setTimeout(() => {
      dispatch(multiActions.connect());
    }, 2000);
  }, []);

  return (
    <div className="app-container">
      <div className="app">
        {LOAD_SCREEN_STATES.indexOf(state) > -1 && (
          <>
            <img src={logo} className="logo logo-loading" />
            <div className="load-state">{state}</div>
          </>
        )}
        {(state === MultiConnectionState.FAIL_NOT_SIGNED_IN_AND_NO_GUEST_LINK ||
          state === MultiConnectionState.FAIL_NO_ACTIVE_TIMESLOT) && (
          <>
            <div className="failure-reason">
              <h2>Something's gone wrong here!</h2>
              <p>
                If you're trying to <em>host</em> a show, please use{" "}
                <a
                  href={
                    process.env.REACT_APP_MYRADIO_NONAPI_BASE +
                    "/MyRadio/webstudio"
                  }
                >
                  WebStudio
                </a>{" "}
                instead.
              </p>
              <p>
                If you're trying to <em>join</em> a show as a guest,
                <ul>
                  <li>
                    If you have a URY login,{" "}
                    <a
                      href={`${
                        process.env.REACT_APP_MYRADIO_NONAPI_BASE
                      }/MyRadio/timeslot?next=${encodeURIComponent(
                        window.location.href
                      )}`}
                    >
                      click here
                    </a>{" "}
                    to sign in and choose the timeslot
                  </li>
                  <li>Otherwise, ask the host for an invite link</li>
                </ul>
              </p>
              <p>
                If the host has given you an invite link, please copy-and-paste
                it into your browser bar <em>exactly</em>. Don't try and type it
                out by hand.
              </p>
              If you've tried all that and still can't get it to work, contact
              URY Computing Team for help. (Error code: <code>{state}</code>)
            </div>
          </>
        )}
        {state === MultiConnectionState.FAIL_NO_HOSTING_AS_GUEST && (
          <div className="failure-reason">
            <h2>Something's gone wrong here!</h2>
            <p>
              If you're trying to host a show, please use{" "}
              <a
                href={
                  process.env.REACT_APP_MYRADIO_NONAPI_BASE +
                  "/MyRadio/webstudio"
                }
              >
                WebStudio
              </a>{" "}
              instead.
            </p>
            <p>
              If you're joining a show, please wait for the person who's hosting
              to start the session.
            </p>
            {/* no comment about URY login, as this error only shows if you're already logged in I think? */}
            <p>
              If they have started the session, and you still can't join,
              contact URY Computing Team for help. (Error code:{" "}
              <code>{state}</code>)
            </p>
          </div>
        )}
        {state === MultiConnectionState.FAIL_INVALID_INVITE && (
          <div className="failure-reason">
            <h2>Something's gone wrong here!</h2>
            <p>The invite link you tried to use is not valid.</p>
            <p>
              Please make sure you've copy-pasted it <em>exactly</em>. Don't try
              and type it out by hand.
            </p>
            <p>
              If you're sure it's right, and you still can't join, ask the host
              for a new link.
            </p>
            <p>
              If they've given you a new link, and you <em>still</em> can't
              join, contact URY Computing Team for help. (Error code:{" "}
              <code>{state}</code>)
            </p>
          </div>
        )}
        {state === MultiConnectionState.FAIL_INVITE_OUT_OF_USES && (
          <div className="failure-reason">
            <h2>Something's gone wrong here!</h2>
            <p>The invite link you tried to use is no longer.</p>
            <p>Please ask your host for a new link.</p>
            <p>
              If they've given you a new link, and you <em>still</em> can't
              join, contact URY Computing Team for help. (Error code:{" "}
              <code>{state}</code>)
            </p>
          </div>
        )}
        {(state === MultiConnectionState.JOINED ||
          state === MultiConnectionState.DISCONNECTED) && <RoomState />}
      </div>
    </div>
  );
}

export default App;
