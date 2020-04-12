import React from "react";
import ReactDOM from "react-dom";
import "./index.css";
import App from "./App";
import * as serviceWorker from "./serviceWorkerLoader";

import raygun from "raygun4js";

import store from "./store";
import { Provider } from "react-redux";

raygun("apiKey", "mtj24r3YzPoYyCG8cVArA");
raygun("enableCrashReporting", true);
if (typeof process.env.REACT_APP_VERSION === "string" && process.env.REACT_APP_VERSION.length > 0) {
	raygun("setVersion", process.env.REACT_APP_VERSION);
}

function render() {
	ReactDOM.render(
		<Provider store={store}>
			<App />
		</Provider>,
		document.getElementById("root")
	);
}
render();

// If you want your app to work offline and load faster, you can change
// unregister() to register() below. Note this comes with some pitfalls.
// Learn more about service workers: https://bit.ly/CRA-PWA
serviceWorker.register();
