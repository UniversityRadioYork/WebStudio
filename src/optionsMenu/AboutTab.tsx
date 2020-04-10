import React from "react";

import logo from "../assets/images/webstudio.svg";
import { MYRADIO_BASE_URL, MYRADIO_NON_API_BASE } from "../api";

export function AboutTab() {
	return (
		<>
			<img src={logo} style={{ filter: "invert(1)" }} />
			<div><b>WebStudio v{process.env.REACT_APP_VERSION}</b></div>
			<div>MyRadio endpoint: <code>{MYRADIO_BASE_URL}</code>/<code>{MYRADIO_NON_API_BASE}</code></div>
			<div>Streaming server: <code>{process.env.REACT_APP_WS_URL}</code></div>
			<div>Brought to you by URY Computing Team</div>
		</>
	);
}