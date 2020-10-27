import { createAction } from "@reduxjs/toolkit";

export const REGISTERED = createAction<{ connID: number }>(
  "Broadcast/REGISTERING"
);
export const CONNECTED = createAction("Broadcast/CONNECTED");
export const GONE_LIVE = createAction("Broadcast/GONE_LIVE");
export const DISCONNECTED = createAction("Broadcast/DISCONNECTED");
