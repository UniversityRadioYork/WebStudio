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
import { PLAYER_ID_PREVIEW } from "../mixer/audio";

import ReactTooltip from "react-tooltip";

export const CML_CACHE: { [recordid_trackid: string]: Track } = {};

type searchingStateEnum =
  | "searching"
  | "not-searching"
  | "results"
  | "no-results";

export function LibraryColumn() {
  const [sauce, setSauce] = useState("None");
  const dispatch = useDispatch();
  const auxPlaylists = useSelector(
    (state: RootState) => state.showplan.auxPlaylists
  );
  const managedPlaylists = useSelector(
    (state: RootState) => state.showplan.managedPlaylists
  );
  const userPlaylists = useSelector(
    (state: RootState) => state.showplan.userPlaylists
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
          <h2 className="h3 hide-low-height">
            <FaBookOpen className="mx-2" size={25} />
            Libraries
          </h2>
          {!process.env.REACT_APP_BAPSICLE_INTERFACE && (
            <div className="row m-0 p-1 card-header hover-menu">
              <span className="hover-label">Hover for Import &amp; Tools</span>
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
            </div>
          )}
        </div>
        <div className="px-2">
          <select
            id="sidebarLibrarySelect"
            className="form-control form-control-sm"
            style={{ flex: "none" }}
            value={sauce}
            onChange={(e) => setSauce(e.target.value)}
          >
            <option value={"None"} disabled>
              Choose a library
            </option>
            <option value={"CentralMusicLibrary"}>Central Music Library</option>
            {!process.env.REACT_APP_BAPSICLE_INTERFACE && (
              <>
                <option disabled>Personal Resources</option>
                {userPlaylists.map((playlist) => (
                  <option key={playlist.managedid} value={playlist.managedid}>
                    {playlist.title}
                  </option>
                ))}
              </>
            )}
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
  const [trackSearchTerm, setTrackSearchTerm] = useState("");
  const [artistSearchTerm, setArtistSearchTerm] = useState("");
  const debouncedTrackSearchTerm = useDebounce(trackSearchTerm, 1000);
  const debouncedArtistSearchTerm = useDebounce(artistSearchTerm, 1000);
  const [tracks, setTracks] = useState<Track[]>([]);

  const [searchingState, setSearchingState] =
    useState<searchingStateEnum>("not-searching");

  useEffect(() => {
    if (debouncedTrackSearchTerm === "" && debouncedArtistSearchTerm === "") {
      setTracks([]);
      setSearchingState("not-searching");
      return;
    }
    setTracks([]);
    setSearchingState("searching");
    searchForTracks(debouncedArtistSearchTerm, debouncedTrackSearchTerm).then(
      (tracks) => {
        tracks.forEach((track) => {
          const id = itemId(track);
          if (!(id in CML_CACHE)) {
            CML_CACHE[id] = track;
          }
        });
        setTracks(tracks);
        if (tracks.length === 0) {
          setSearchingState("no-results");
        } else {
          setSearchingState("results");
          ReactTooltip.rebuild(); // Update tooltips so they appear.
        }
      }
    );
  }, [debouncedTrackSearchTerm, debouncedArtistSearchTerm]);
  return (
    <div className="library library-central">
      <span className="px-2">
        <input
          className="form-control form-control-sm"
          type="text"
          placeholder="Filter by track..."
          value={trackSearchTerm}
          onChange={(e) => setTrackSearchTerm(e.target.value)}
        />
        <input
          className="form-control form-control-sm mt-2"
          type="text"
          placeholder="Filter by artist..."
          value={artistSearchTerm}
          onChange={(e) => setArtistSearchTerm(e.target.value)}
        />
      </span>
      <div className="border-top mt-2"></div>
      <ResultsPlaceholder searchingState={searchingState} />
      <Droppable droppableId="$CML">
        {(provided, snapshot) => (
          <div
            className="library-item-list"
            ref={provided.innerRef}
            {...provided.droppableProps}
          >
            {tracks.map((item, index) => (
              <Item
                key={itemId(item)}
                item={item}
                index={index}
                column={PLAYER_ID_PREVIEW}
              />
            ))}
            {provided.placeholder}
          </div>
        )}
      </Droppable>
    </div>
  );
}

export function ManagedPlaylistLibrary({ libraryId }: { libraryId: string }) {
  const [trackSearchTerm, setTrackSearchTerm] = useState("");
  const [artistSearchTerm, setArtistSearchTerm] = useState("");
  const debouncedTrackSearchTerm = useDebounce(trackSearchTerm, 1000);
  const debouncedArtistSearchTerm = useDebounce(artistSearchTerm, 1000);
  const [items, setItems] = useState<Track[]>([]);

  const [searchingState, setSearchingState] =
    useState<searchingStateEnum>("not-searching");

  useEffect(() => {
    async function load() {
      setItems([]);
      setSearchingState("searching");
      const libItems = await loadPlaylistLibrary(libraryId);
      libItems.forEach((item) => {
        const id = itemId(item);
        if (!(id in CML_CACHE)) {
          CML_CACHE[id] = item;
        }
      });
      setItems(libItems);
      if (libItems.length === 0) {
        setSearchingState("no-results");
      } else {
        setSearchingState("results");
        ReactTooltip.rebuild(); // Update tooltips so they appear.
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
          value={trackSearchTerm}
          onChange={(e) => setTrackSearchTerm(e.target.value)}
        />
        <input
          className="form-control form-control-sm mt-2"
          type="text"
          placeholder="Filter by artist..."
          value={artistSearchTerm}
          onChange={(e) => setArtistSearchTerm(e.target.value)}
        />
      </span>
      <div className="border-top mt-2"></div>
      <ResultsPlaceholder searchingState={searchingState} />
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
                    .indexOf(debouncedTrackSearchTerm.toLowerCase()) > -1
              )
              .filter(
                (its) =>
                  its.artist
                    .toString()
                    .toLowerCase()
                    .indexOf(debouncedArtistSearchTerm.toLowerCase()) > -1
              )
              .map((item, index) => (
                <Item
                  key={itemId(item)}
                  item={item}
                  index={index}
                  column={PLAYER_ID_PREVIEW}
                />
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
  const debouncedQuery = useDebounce(searchQuery, 500);
  const [items, setItems] = useState<AuxItem[]>([]);

  const [searchingState, setSearchingState] =
    useState<searchingStateEnum>("not-searching");

  useEffect(() => {
    async function load() {
      setItems([]);
      setSearchingState("searching");
      const libItems = await loadAuxLibrary(libraryId);
      libItems.forEach((item) => {
        const id = itemId(item);
        if (!(id in AUX_CACHE)) {
          AUX_CACHE[id] = item;
        }
      });
      setItems(libItems);
      ReactTooltip.rebuild(); // Update tooltips so they appear.
      if (libItems.length === 0) {
        setSearchingState("no-results");
      } else {
        setSearchingState("results");
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
      <ResultsPlaceholder searchingState={searchingState} />
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
                <Item
                  key={itemId(item)}
                  item={item}
                  index={index}
                  column={PLAYER_ID_PREVIEW}
                />
              ))}
            {provided.placeholder}
          </div>
        )}
      </Droppable>
    </div>
  );
}

export function ResultsPlaceholder({
  searchingState,
}: {
  searchingState: searchingStateEnum;
}) {
  return (
    <span
      className={
        searchingState !== "results" ? "mt-5 text-center text-muted" : "d-none"
      }
    >
      {searchingState === "not-searching" && <FaSearch size={56} />}
      {searchingState === "searching" && (
        <FaCog size={56} className="fa-spin" />
      )}
      {searchingState === "no-results" && <FaTimesCircle size={56} />}
      <br />
      {searchingState === "not-searching"
        ? "Enter a search term."
        : searchingState === "searching"
        ? "Searching..."
        : searchingState === "no-results"
        ? "No results."
        : ""}
    </span>
  );
}
