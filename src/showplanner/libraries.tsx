import React, { useState, useEffect } from "react";
import useDebounce from "../lib/useDebounce";
import {
  Track,
  searchForTracks,
  loadAuxLibrary,
  AuxItem,
  loadPlaylistLibrary,
} from "../api";
import { getPlaylists, itemId } from "./state";
import { Droppable } from "react-beautiful-dnd";
import {
  FaBookOpen,
  FaCog,
  FaFileImport,
  FaPlayCircle,
  FaSearch,
  FaTimesCircle,
  FaUpload,
} from "react-icons/fa";
import { AutoPlayoutModal } from "./AutoPlayoutModal";
import { LibraryUploadModal } from "./LibraryUploadModal";
import { ImporterModal } from "./ImporterModal";
import { Item } from "./Item";
import "./libraries.scss";
import { useDispatch, useSelector } from "react-redux";
import { RootState } from "../rootReducer";
import { Button } from "reactstrap";

export const CML_CACHE: { [recordid_trackid: string]: Track } = {};

type searchingStateEnum =
  | "searching"
  | "not-searching"
  | "results"
  | "no-results";

export function LibraryColumn() {
  const [sauce, setSauce] = useState("None");
  const dispatch = useDispatch();
  const { auxPlaylists, managedPlaylists, userPlaylists } = useSelector(
    (state: RootState) => state.showplan
  );

  const [autoPlayoutModal, setAutoPlayoutModal] = useState(false);
  const [showLibraryUploadModal, setShowLibraryModal] = useState(false);
  const [showImporterModal, setShowImporterModal] = useState(false);

  useEffect(() => {
    dispatch(getPlaylists());
  }, [dispatch]);

  return (
    <>
      <AutoPlayoutModal
        isOpen={autoPlayoutModal}
        close={() => setAutoPlayoutModal(false)}
      />
      <LibraryUploadModal
        isOpen={showLibraryUploadModal}
        close={() => setShowLibraryModal(false)}
      />
      <ImporterModal
        close={() => setShowImporterModal(false)}
        isOpen={showImporterModal}
      />
      <div className="library-column">
        <div className="mx-2 mb-2">
          <h2>
            <FaBookOpen className="mx-2" size={28} />
            Libraries
          </h2>
          <Button
            className="mr-1"
            color="primary"
            title="Auto Playout"
            size="sm"
            outline={true}
            onClick={() => setAutoPlayoutModal(true)}
          >
            <FaPlayCircle /> Auto Playout
          </Button>
          <Button
            className="mr-1"
            color="primary"
            title="Import From Showplan"
            size="sm"
            outline={true}
            onClick={() => setShowImporterModal(true)}
          >
            <FaFileImport /> Import
          </Button>
          <Button
            className="mr-1"
            color="primary"
            title="Upload to Library"
            size="sm"
            outline={true}
            onClick={() => setShowLibraryModal(true)}
          >
            <FaUpload /> Upload
          </Button>
        </div>
        <div className="px-2">
          <select
            className="form-control form-control-sm"
            style={{ flex: "none" }}
            value={sauce}
            onChange={(e) => setSauce(e.target.value)}
          >
            <option value={"None"} disabled>
              Choose a library
            </option>
            <option value={"CentralMusicLibrary"}>Central Music Library</option>
            <option disabled>Personal Resources</option>
            {userPlaylists.map((playlist) => (
              <option key={playlist.managedid} value={playlist.managedid}>
                {playlist.title}
              </option>
            ))}
            <option disabled>Shared Resources</option>
            {auxPlaylists.map((playlist) => (
              <option
                key={"aux-" + playlist.managedid}
                value={"aux-" + playlist.managedid}
              >
                {playlist.title}
              </option>
            ))}
            <option disabled>Playlists</option>
            {managedPlaylists.map((playlist) => (
              <option
                key={"managed-" + playlist.playlistid}
                value={"managed-" + playlist.playlistid}
              >
                {playlist.title}
              </option>
            ))}
          </select>
        </div>
        <div className="border-top my-2"></div>
        {sauce === "CentralMusicLibrary" && <CentralMusicLibrary />}
        {(sauce.startsWith("aux-") || sauce.match(/^\d/)) && (
          <AuxLibrary libraryId={sauce} />
        )}
        {sauce.startsWith("managed-") && (
          <ManagedPlaylistLibrary libraryId={sauce.substr(8)} />
        )}
        <span
          className={
            sauce === "None" ? "mt-5 text-center text-muted" : "d-none"
          }
        >
          <FaBookOpen size={56} />
          <br />
          Select a library to search.
        </span>
      </div>
    </>
  );
}

export function CentralMusicLibrary() {
  const [track, setTrack] = useState("");
  const [artist, setArtist] = useState("");
  const debouncedTrack = useDebounce(track, 600);
  const debouncedArtist = useDebounce(artist, 600);
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
          className="form-control form-control-sm"
          type="text"
          placeholder="Filter by track..."
          value={track}
          onChange={(e) => setTrack(e.target.value)}
        />
        <input
          className="form-control form-control-sm mt-2"
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
              <Item key={itemId(item)} item={item} index={index} column={0} />
            ))}
            {provided.placeholder}
          </div>
        )}
      </Droppable>
    </div>
  );
}

export function ManagedPlaylistLibrary({ libraryId }: { libraryId: string }) {
  const [track, setTrack] = useState("");
  const [artist, setArtist] = useState("");
  const debouncedTrack = useDebounce(track, 600);
  const debouncedArtist = useDebounce(artist, 600);
  const [items, setItems] = useState<Track[]>([]);

  const [state, setState] = useState<searchingStateEnum>("not-searching");

  useEffect(() => {
    async function load() {
      setItems([]);
      setState("searching");
      const libItems = await loadPlaylistLibrary(libraryId);
      libItems.forEach((item) => {
        const id = itemId(item);
        if (!(id in CML_CACHE)) {
          CML_CACHE[id] = item;
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
    <div className="library library-central">
      <span className="px-2">
        <input
          className="form-control form-control-sm"
          type="text"
          placeholder="Filter by track..."
          value={track}
          onChange={(e) => setTrack(e.target.value)}
        />
        <input
          className="form-control form-control-sm mt-2"
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
            {items
              .filter(
                (its) =>
                  its.title
                    .toString()
                    .toLowerCase()
                    .indexOf(debouncedTrack.toLowerCase()) > -1
              )
              .filter(
                (its) =>
                  its.artist
                    .toString()
                    .toLowerCase()
                    .indexOf(debouncedArtist.toLowerCase()) > -1
              )
              .map((item, index) => (
                <Item key={itemId(item)} item={item} index={index} column={0} />
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
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedQuery = useDebounce(searchQuery, 200);
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
          className="form-control form-control-sm"
          type="text"
          placeholder="Filter..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
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
                    .indexOf(debouncedQuery.toLowerCase()) > -1
              )
              .map((item, index) => (
                <Item key={itemId(item)} item={item} index={index} column={0} />
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
