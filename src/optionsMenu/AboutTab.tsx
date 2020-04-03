import React from "react";

import logo from "../assets/images/webstudio.svg";

export function AboutTab() {
	return (
		<>
			<img src={logo} style={{ filter: "invert(1)" }} />
			<div><b>WebStudio v{process.env.REACT_APP_VERSION}</b></div>
			<div>Brought to you by URY Computing Team</div>
		</>
	);
}