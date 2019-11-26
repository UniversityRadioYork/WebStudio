import qs from "qs";
import { convertModelToFormData, urlEncode } from "./lib/utils";

const MYRADIO_BASE_URL =
  process.env.REACT_APP_MYRADIO_BASE || "https://ury.org.uk/api/v2";
const MYRADIO_API_KEY = process.env.REACT_APP_MYRADIO_KEY!;

class ApiException extends Error {}

export async function myradioApiRequest(
  endpoint: string,
  method: "GET" | "POST" | "PUT",
  params: any
): Promise<any> {
  let req = null;
  if (method === "GET") {
    req = fetch(
      MYRADIO_BASE_URL +
        endpoint +
        qs.stringify(
          {
            ...params,
            api_key: MYRADIO_API_KEY
          },
          { addQueryPrefix: true }
        )
    );
  } else {
    const body = JSON.stringify(params);
    console.log(body);
    req = fetch(MYRADIO_BASE_URL + endpoint + "?api_key=" + MYRADIO_API_KEY, {
      method,
      body,
      headers: {
        "Content-Type": "application/json; charset=UTF-8"
      }
    });
  }
  const json = await (await req).json();
  if (json.status === "OK") {
    return json.payload;
  } else {
    console.error(json.payload);
    throw new ApiException("Request failed!");
  }
}

interface Album {
  title: string;
  recordid: number;
  artist: string;
  cdid: number | null;
  date_added: string;
  date_released: string;
  // TODO
}

interface TimeslotItemBase {
  timeslotitemid: string;
  channel: number;
  weight: number;
  title: string;
  length: string;
  trackid: number;
}

interface TimeslotItemCentral {
  type: "central";
  artist: string;
  intro: number;
  clean: boolean;
  digitised: boolean;
  album: Album;
}

interface TimeslotItemAux {
  type: "aux";
  summary: string;
  recordid: string;
  auxid: string;
}

export type TimeslotItem = TimeslotItemBase &
  (TimeslotItemCentral | TimeslotItemAux);

export type Showplan = TimeslotItem[][];

export function getShowplan(showId: number): Promise<Showplan> {
  return myradioApiRequest(
    `/timeslot/${showId.toString(10)}/showplan`,
    "GET",
    {}
  ).then(res => {
    console.log(res);
    return Object.keys(res).map(x => res[x]);
  });
}

function wrapPromise<T, TArgs>(factory: (...args: TArgs[]) => Promise<T>) {
  let status = "pending";
  let result: T;
  let suspender: Promise<void>;
  return {
    read(...args: TArgs[]) {
      if (!(suspender instanceof Promise)) {
        suspender = factory(...args).then(
          r => {
            status = "success";
            result = r;
          },
          e => {
            status = "error";
            result = e;
          }
        );
      }
      if (status === "pending") {
        throw suspender;
      } else if (status === "error") {
        throw result;
      } else if (status === "success") {
        return result;
      } else {
        throw new Error("Can't happen.");
      }
    }
  };
}

export interface Track {
  title: string;
  artist: string;
  album: Album;
  trackid: number;
  length: string;
  intro: number;
  clean: boolean;
  digitised: boolean;
}

export const showPlanResource = wrapPromise<Showplan, number>(getShowplan);

export function searchForTracks(
  artist: string,
  title: string
): Promise<Array<Track>> {
  return myradioApiRequest("/track/search", "GET", {
    artist,
    title,
    limit: 100,
    digitised: true
  });
}

export type UpdateOp =
  | {
      op: "MoveItem";
      timeslotitemid: string;
      oldchannel: number;
      oldweight: number;
      channel: number;
      weight: number;
    }
  | {
      op: "AddItem";
      channel: number;
      weight: number;
      id: string;
    };

interface OpResult {
  status: boolean;
  timeslotitemid?: string;
}

export function updateShowplan(
  timeslotid: number,
  ops: UpdateOp[]
): Promise<OpResult[]> {
  return myradioApiRequest(`/timeslot/${timeslotid}/updateshowplan`, "PUT", {
    set: ops
  });
}
