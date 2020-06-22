import { broadcastApiRequest } from "../api";
import * as later from "later";
import { add, set } from "date-fns";
import { Timer } from "later";
import { RootState } from "../rootReducer";
import {AudioEngine} from "./state/audio";

/**
 * But now it's time for the news!
 */
async function actuallyDoTheNews() {
  const audioEngine: AudioEngine = window.AE; // TODO
  console.log("actually doing the news");
  // Sanity check
  const now = new Date();
  const newsInTime = set(now, { minutes: 59, seconds: 45 });
  const newsOutTime = set(add(now, { hours: 1 }), { minutes: 1, seconds: 55 });
  const newsInDelta = newsInTime.valueOf() - now.valueOf();
  const newsOutDelta = newsOutTime.valueOf() - now.valueOf();
  console.log(
    "now is",
    now,
    "news in is at",
    newsInTime,
    "and out is at",
    newsOutTime
  );
  console.log(
    "so deltas are",
    newsInDelta,
    "and",
    newsOutDelta,
    "respectively"
  );
  if (newsInDelta > 0) {
    window.setTimeout(async () => {
      console.log("Playing News In");
      await audioEngine.playNewsIntro();
    }, newsInTime.valueOf() - now.valueOf());
  }
  if (newsOutDelta > 0) {
    window.setTimeout(async () => {
      console.log("Playing News Out");
      await audioEngine.playNewsEnd();
    }, newsOutTime.valueOf() - now.valueOf());
  }
}

const considerDoingTheNews = (getState: () => RootState) => async () => {
  console.log("considering doing the news");
  const state = getState();
  if (state.settings.doTheNews === "always") {
    await actuallyDoTheNews();
  } else if (state.settings.doTheNews === "while_live") {
    if (
      state.broadcast.connectionState === "CONNECTED" ||
      state.broadcast.connectionState === "LIVE"
    ) {
      const transition = await broadcastApiRequest<{
        autoNews: boolean;
        selSource: number;
        switchAudioAtMin: number;
      }>("/nextTransition", "GET", {});
      if (transition.autoNews) {
        await actuallyDoTheNews();
      }
    }
  }
};

let newsTimer: Timer | null = null;

export function butNowItsTimeFor(getStateFn: () => RootState) {
  const newsSchedule = later.parse
    .recur()
    .on(30)
    .second()
    .on(59)
    .minute()
    .every("hour");
  if (newsTimer === null) {
    newsTimer = later.setInterval(
      considerDoingTheNews(getStateFn),
      newsSchedule
    );
    console.log(newsSchedule);
    console.log(
      "the next run of the news will be at",
      later.schedule(newsSchedule).next(1)
    );
  }
}
