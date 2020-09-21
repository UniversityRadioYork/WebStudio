import qs from "qs";

export const MYRADIO_NON_API_BASE = process.env.REACT_APP_MYRADIO_NONAPI_BASE!;
export const MYRADIO_BASE_URL = process.env.REACT_APP_MYRADIO_BASE!;
export const BROADCAST_API_BASE_URL = process.env.REACT_APP_BROADCAST_API_BASE!;

export class ApiException extends Error {}

export async function apiRequest(
  url: string,
  method: "GET" | "POST" | "PUT",
  params: any,
  need_auth: boolean = true
): Promise<Response> {
  var req: Promise<Response> | null = null;
  if (method === "GET") {
    req = fetch(url + qs.stringify(params, { addQueryPrefix: true }), {
      credentials: need_auth ? "include" : "omit",
    });
  } else {
    const body = JSON.stringify(params);
    console.log(body);
    req = fetch(url, {
      method,
      body,
      headers: {
        "Content-Type": "application/json; charset=UTF-8",
      },
      credentials: need_auth ? "include" : "omit",
    });
  }
  return await req;
}

export async function myradioApiRequest(
  endpoint: string,
  method: "GET" | "POST" | "PUT",
  params: any
): Promise<any> {
  const res = await apiRequest(MYRADIO_BASE_URL + endpoint, method, params);
  const json = await res.json();
  if (json.status === "OK") {
    return json.payload;
  } else {
    console.error(json.payload);
    throw new ApiException(json.payload);
  }
}

export async function broadcastApiRequest<TRes = any>(
  endpoint: string,
  method: "GET" | "POST" | "PUT",
  params: any
): Promise<TRes> {
  const res = await apiRequest(
    BROADCAST_API_BASE_URL + endpoint,
    method,
    params,
    false
  );
  const json = await res.json();
  if (json.status === "OK") {
    return json.payload;
  } else {
    console.error(json.reason);
    throw new ApiException(json.reason);
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
  summary: string | number;
  title: string | number;
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
  ).then((res) => {
    return Object.keys(res).map((x) => res[x]);
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
          (r) => {
            status = "success";
            result = r;
          },
          (e) => {
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
    },
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
    digitised: true,
  });
}

export interface NipswebPlaylist {
  type: "userPlaylist";
  title: string;
  managedid: string;
  folder: string;
}
export interface ManagedPlaylist {
  type: "managedPlaylist";
  title: string;
  playlistid: string;
  folder: string;
}

export function getUserPlaylists(): Promise<Array<NipswebPlaylist>> {
  return myradioApiRequest(
    "/nipswebUserPlaylist/allmanageduserplaylists",
    "GET",
    {}
  );
}

export function getManagedPlaylists(): Promise<Array<ManagedPlaylist>> {
  return myradioApiRequest("/playlist/allitonesplaylists", "GET", {});
}

export function getAuxPlaylists(): Promise<Array<NipswebPlaylist>> {
  return myradioApiRequest("/nipswebPlaylist/allmanagedplaylists", "GET", {});
}

export function loadAuxLibrary(libraryId: string): Promise<AuxItem[]> {
  return apiRequest(MYRADIO_NON_API_BASE + "/NIPSWeb/load_aux_lib", "GET", {
    libraryid: libraryId,
  }).then((res) => res.json());
}

export function loadPlaylistLibrary(libraryId: string): Promise<Track[]> {
  return myradioApiRequest("/playlist/" + libraryId + "/tracks", "GET", {});
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
    set: ops,
  });
}

export interface Timeslot {
  timeslot_id: number;
  time: number;
  start_time: string;
  title: string;
}

export function getCurrentApiTimeslot(): Promise<Timeslot> {
  return myradioApiRequest(`/timeslot/userselectedtimeslot`, "GET", {}).then(
    (res) => {
      return res;
    }
  );
}

export interface User {
  memberid: number;
  fname: string;
  sname: string;
  url: string;
  photo: string;
}

export function getCurrentApiUser(): Promise<User> {
  return myradioApiRequest(`/user/currentuser`, "GET", {}).then((res) => {
    return res;
  });
}

export function doesCurrentUserHavePermission(id: number): Promise<boolean> {
  return myradioApiRequest("/auth/haspermission/" + id.toString(10), "GET", {});
}

export interface NewsEntry {
  newsentryid: string;
  author: string;
  posted: string;
  content: string;
  seen?: boolean;
}

export function getLatestNewsItem(
  newsFeedId: number
): Promise<NewsEntry | null> {
  return myradioApiRequest(`/news/latestnewsitem/${newsFeedId}`, "GET", {});
}
