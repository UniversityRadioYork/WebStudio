import qs from "qs";

export const MYRADIO_NON_API_BASE =
  process.env.REACT_APP_MYRADIO_NONAPI_BASE ||
  "https://ury.org.uk/myradio-staging";
export const MYRADIO_BASE_URL =
  process.env.REACT_APP_MYRADIO_BASE || "https://ury.org.uk/api-staging/v2";
const MYRADIO_API_KEY = process.env.REACT_APP_MYRADIO_KEY!;

class ApiException extends Error {}

export async function myradioRequest(
  url: string,
  method: "GET" | "POST" | "PUT",
  params: any
): Promise<Response> {
  let req = null;
  if (method === "GET") {
    req = fetch(url + qs.stringify(params, { addQueryPrefix: true }), {
      credentials: "include"
    });
  } else {
    const body = JSON.stringify(params);
    console.log(body);
    req = fetch(url, {
      method,
      body,
      headers: {
        "Content-Type": "application/json; charset=UTF-8"
      },
      credentials: "include"
    });
  }
  return await req;
}

export async function myradioApiRequest(
  endpoint: string,
  method: "GET" | "POST" | "PUT",
  params: any
): Promise<any> {
  const res = await myradioRequest(MYRADIO_BASE_URL + endpoint, method, params);
  const json = await res.json();
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
  clean: boolean;
}

interface TimeslotItemCentral {
  type: "central";
  artist: string;
  intro: number;
  clean: boolean;
  digitised: boolean;
  album: Album;
}

export interface AuxItem {
  type: "aux";
  summary: string;
  title: string;
  managedid: number;
  length: string;
  trackid: number;
  expirydate: boolean | string;
  expired: boolean;
  recordid: string;
  auxid: string;
}

interface TimeslotItemAux extends AuxItem {
  type: "aux";
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
  type: "central";
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

export function loadAuxLibrary(libraryId: string): Promise<AuxItem[]> {
  return myradioRequest(MYRADIO_NON_API_BASE + "/NIPSWeb/load_aux_lib", "GET", {
    libraryid: libraryId
  }).then(res => res.json());
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
    }
  | {
      op: "RemoveItem";
      timeslotitemid: string;
      channel: number;
      weight: number;
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



export interface Timeslot {
  timeslotid: number,
  starttime: number,
  title: string
}



export function getCurrentApiTimeslot(): Promise<Timeslot> {
  return myradioApiRequest(`/timeslot/userselectedtimeslot`, "GET", {}
  ).then(res => {
    return res;
  });
};


export interface User {
  memberid: number,
  fname: string,
  sname: string,
  url: string,
  photo: string
}



export function getCurrentApiUser(): Promise<User> {
  return myradioApiRequest(`/user/currentuser`, "GET", {}
  ).then(res => {
    return res;
  });
};


