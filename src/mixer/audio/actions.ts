import { createAction } from "@reduxjs/toolkit";
import { MicErrorEnum } from "./types";

export const itemLoadComplete = createAction<{
  player: number;
  duration: number;
}>("Audio/itemLoadComplete");

export const timeChange = createAction<{
  player: number;
  currentTime: number;
}>("Audio/timeChange");

export const finished = createAction<{
  player: number;
}>("Audio/finished");

export const micOpenError = createAction<{
  code: null | MicErrorEnum;
}>("Audio/micOpenError");
