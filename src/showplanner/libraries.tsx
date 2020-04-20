import React, { useState, useEffect } from "react";
import useDebounce from "../lib/useDebounce";
import { Track, searchForTracks, loadAuxLibrary, AuxItem } from "../api";
import { itemId } from "./state";
import { Droppable } from "react-beautiful-dnd";
import { FaCog, FaSearch, FaTimesCircle } from "react-icons/fa";
import { Item } from "./Item";
import "./libraries.scss";

export const CML_CACHE: { [recordid_trackid: string]: Track } = {};

type searchingStateEnum =
  | "searching"
  | "not-searching"
  | "results"
  | "no-results";

export function CentralMusicLibrary() {
  const [track, setTrack] = useState("");
  const [artist, setArtist] = useState("");
  const debouncedTrack = useDebounce(track, 1000);
  const debouncedArtist = useDebounce(artist, 1000);
  const [items, setItems] = useState<Track[]>([]);

  const [state, setState] = useState<searchingStateEnum>("not-searching");

  useEffect(() => {
    if (debouncedTrack === "" && debouncedArtist === "") {
      setItems([]);
      setState("not-searching");
      return;
    }
    setItems([]);
    setState("searching");
    searchForTracks(artist, track).then((tracks) => {
      if (tracks.length === 0) {
        setState("no-results");
      } else {
        setState("results");
      }
      tracks.forEach((track) => {
        const id = itemId(track);
        if (!(id in CML_CACHE)) {
          CML_CACHE[id] = track;
        }
      });
      setItems(tracks);
    });
  }, [debouncedTrack, debouncedArtist, artist, track]);
  return (
    <div className="library library-central">
      <span className="px-2">
        <input
          className="form-control"
          type="text"
          placeholder="Filter by track..."
          value={track}
          onChange={(e) => setTrack(e.target.value)}
        />
        <input
          className="form-control mt-2"
          type="text"
          placeholder="Filter by artist..."
          value={artist}
          onChange={(e) => setArtist(e.target.value)}
        />
      </span>
      <div className="border-top mt-2"></div>
      <ResultsPlaceholder state={state} />
      <Droppable droppableId="$CML">
        {(provided, snapshot) => (
          <div
            className="library-item-list"
            ref={provided.innerRef}
            {...provided.droppableProps}
          >
            {items.map((item, index) => (
              <Item key={itemId(item)} item={item} index={index} column={-1} />
            ))}
            {provided.placeholder}
          </div>
        )}
      </Droppable>
    </div>
  );
}

export const AUX_CACHE: { [auxid: string]: AuxItem } = {};

export function AuxLibrary({ libraryId }: { libraryId: string }) {
  const [title, setTitle] = useState("");
  const [items, setItems] = useState<AuxItem[]>([]);

  const [state, setState] = useState<searchingStateEnum>("not-searching");

  useEffect(() => {
    async function load() {
      setItems([]);
      setState("searching");
      const libItems = await loadAuxLibrary(libraryId);
      libItems.forEach((item) => {
        const id = itemId(item);
        if (!(id in AUX_CACHE)) {
          AUX_CACHE[id] = item;
        }
      });
      setItems(libItems);
      if (libItems.length === 0) {
        setState("no-results");
      } else {
        setState("results");
      }
    }
    load();
  }, [libraryId]);
  return (
    <div className="library library-aux">
      <span className="px-2">
        <input
          className="form-control"
          type="text"
          placeholder="Filter..."
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </span>
      <div className="border-top mt-2"></div>
      <ResultsPlaceholder state={state} />
      <Droppable droppableId="$AUX">
        {(provided, snapshot) => (
          <div
            className="library-item-list"
            ref={provided.innerRef}
            {...provided.droppableProps}
          >
            {items
              .filter(
                (its) =>
                  its.title
                    .toString()
                    .toLowerCase()
                    .indexOf(its.title.toString().toLowerCase()) > -1
              )
              .map((item, index) => (
                <Item
                  key={itemId(item)}
                  item={item}
                  index={index}
                  column={-1}
                />
              ))}
            {provided.placeholder}
          </div>
        )}
      </Droppable>
    </div>
  );
}

export function ResultsPlaceholder({ state }: { state: string }) {
  return (
    <span
      className={state !== "results" ? "mt-5 text-center text-muted" : "d-none"}
    >
      {state === "not-searching" && <FaSearch size={56} />}
      {state === "searching" && <FaCog size={56} className="fa-spin" />}
      {state === "no-results" && <FaTimesCircle size={56} />}
      <br />
      {state === "not-searching"
        ? "Enter a search term."
        : state === "searching"
        ? "Searching..."
        : state === "no-results"
        ? "No results."
        : ""}
    </span>
  );
}
