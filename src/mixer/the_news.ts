import {broadcastApiRequest} from "../api";
import * as later from "later";
import {audioEngine} from "./audio";
import { add, set } from "date-fns";
import {Timer} from "later";
import {RootState} from "../rootReducer";

/**
 * But now it's time for the news!
 */
async function actuallyDoTheNews() {
  console.log("actually doing the news")
  // Sanity check
  const now = new Date();
  const newsInTime = set(now, { minutes: 59, seconds: 45 });
  const newsOutTime = set(add(now, {hours: 1}), { minutes: 1, seconds: 55 });
  console.log("now is", now, "news in is at", newsInTime, "and out is at", newsOutTime)
  if (now.getSeconds() < 45) {
    window.setTimeout(
      async () => {
        await audioEngine.playNewsIntro();
      },
      newsInTime.valueOf() - now.valueOf()
    );
  }
  if (now.getMinutes() <= 1 && now.getSeconds() < 55) {
    window.setTimeout(
      async () => {
        await audioEngine.playNewsEnd();
      },
      newsOutTime.valueOf() - now.valueOf()
    );
  }
}

const considerDoingTheNews = (getState: () => RootState) => async () => {
  console.log("considering doing the news")
  const state = getState();
  if (state.settings.doTheNews === "always") {
    await actuallyDoTheNews();
  } else if (state.settings.doTheNews === "while_live") {
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

let newsTimer: Timer | null = null;

export function butNowItsTimeFor(getStateFn: () => RootState) {
  const newsSchedule = later.parse.recur().on(30).second().on(59).minute().every("hour");
  if (newsTimer === null) {
    newsTimer = later.setInterval(considerDoingTheNews(getStateFn), newsSchedule);
    console.log(newsSchedule);
    console.log("the next run of the news will be at", later.schedule(newsSchedule).next(1));
  }
}
