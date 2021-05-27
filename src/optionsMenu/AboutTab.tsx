import React from "react";

import logo from "../assets/images/webstudio.svg";
import {
  MYRADIO_BASE_URL,
  MYRADIO_NON_API_BASE,
  BROADCAST_API_BASE_URL,
} from "../api";

export function AboutTab() {
  return (
    <>
      <img
        src={logo}
        alt="WebStudio Logo"
        style={{ filter: "invert(1)", maxHeight: 50 }}
      />
      <div>
        <b>WebStudio v{process.env.REACT_APP_VERSION}</b>
      </div>
      <div>
        <b>Git hash:</b> <code>{process.env.REACT_APP_GIT_SHA}</code>
      </div>
      <div>
        MyRadio endpoint: <code>{MYRADIO_BASE_URL}</code>/
        <code>{MYRADIO_NON_API_BASE}</code>
      </div>
      <div>
        Streaming server: <code>{process.env.REACT_APP_WS_URL}</code>
      </div>
      <div>
        Broadcast control server: <code>{BROADCAST_API_BASE_URL}</code>
      </div>
      <div>Brought to you by URY Computing Team</div>
    </>
  );
}
