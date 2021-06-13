import React from "react";
import ReactDOM from "react-dom";
import "./index.css";
import App from "./App";
import * as serviceWorker from "./serviceWorkerLoader";

import * as Sentry from "@sentry/react";
import { Integrations } from "@sentry/tracing";

import store from "./store";
import { Provider } from "react-redux";

function getEnvironment() {
  // this is only set when building for prod
  if (process.env.REACT_APP_PRODUCTION === "true") {
    return "production";
  }
  if (process.env.NODE_ENV === "production") {
    return "webstudio-dev";
  }
  return process.env.NODE_ENV;
}

Sentry.init({
  dsn: process.env.REACT_APP_SENTRY_PUBLIC_DSN,
  integrations: [new Integrations.BrowserTracing()],
  tracesSampleRate: 1.0,
  environment: getEnvironment(),
  release: process.env.REACT_APP_VERSION + "-" + process.env.REACT_APP_GIT_SHA,
  normalizeDepth: 10,
});

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
