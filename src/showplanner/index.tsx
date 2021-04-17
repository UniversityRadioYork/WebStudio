import React, { useState, useReducer, useEffect } from "react";
import { ContextMenu, MenuItem } from "react-contextmenu";
import { useBeforeunload } from "react-beforeunload";
import { FaBookOpen, FaBars, FaTrash, FaCircleNotch } from "react-icons/fa";

import { TimeslotItem } from "../api";
import appLogo from "../assets/images/webstudio.svg";

import {
  Droppable,
  DragDropContext,
  DropResult,
  ResponderProvided,
} from "react-beautiful-dnd";

import { useSelector, useDispatch } from "react-redux";
import { RootState } from "../rootReducer";
import {
  PlanItem,
  itemId,
  moveItem,
  setItemPlayed,
  getPlaylists,
  PlanItemBase,
} from "./state";

import { Item, TS_ITEM_MENU_ID } from "./Item";
import {
  CentralMusicLibrary,
  CML_CACHE,
  AuxLibrary,
  AUX_CACHE,
  ManagedPlaylistLibrary,
} from "./libraries";
import { Player } from "./Player";

import { CombinedNavAlertBar } from "../navbar";
import "./channel.scss";
import Modal from "react-modal";
import { sendBAPSicleChannel } from "../bapsicle";

function Channel({ id, data }: { id: number; data: PlanItem[] }) {
  return (
    <div className="channel" id={"channel-" + id}>
      <Droppable droppableId={id.toString(10)}>
        {(provided, snapshot) => (
          <div
            className="channel-item-list"
            ref={provided.innerRef}
            {...provided.droppableProps}
          >
            {data
              .filter((x) => x.channel === id)
              .sort((a, b) => a.weight - b.weight)
              .map((x, index) => (
                <Item key={itemId(x)} item={x} index={index} column={id} />
              ))}
            {provided.placeholder}
          </div>
        )}
      </Droppable>
      <Player id={id} />
    </div>
  );
}

function LibraryColumn() {
  const [sauce, setSauce] = useState("None");
  const dispatch = useDispatch();
  const { auxPlaylists, managedPlaylists } = useSelector(
    (state: RootState) => state.showplan
  );

  useEffect(() => {
    dispatch(getPlaylists());
  }, [dispatch]);

  return (
    <>
      <div className="library-column">
        <div className="mx-2 mb-2">
          <h2>
            <FaBookOpen className="mx-2" size={28} />
            Libraries
          </h2>
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
            <option disabled>Shared Resources</option>
            {auxPlaylists.map((playlist: any) => (
              <option
                key={"aux-" + playlist.managedid}
                value={"aux-" + playlist.managedid}
              >
                {playlist.title}
              </option>
            ))}
            <option disabled>Playlists</option>
            {managedPlaylists.map((playlist: any) => (
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

function incrReducer(state: number, action: any) {
  return state + 1;
}

const Showplanner: React.FC = function() {
  const showplan = useSelector((state: RootState) => state.showplan.plan);

  // Tell Modals that #root is the main page content, for accessability reasons.
  Modal.setAppElement("#root");

  const dispatch = useDispatch();

  useBeforeunload((event) => event.preventDefault());

  //useEffect(() => {
  //  dispatch(getShowplan());
  //}, [dispatch]);

  function toggleSidebar() {
    var element = document.getElementById("sidebar");
    if (element) {
      element.classList.toggle("hidden");
    }
  }

  const [insertIndex, increment] = useReducer(incrReducer, 0);

  async function onDragEnd(result: DropResult, provider: ResponderProvided) {
    if (!result.destination) {
      return;
    }
    if (result.destination.droppableId[0] === "$") {
      // pseudo-channel
      return;
    }
    if (result.draggableId[0] === "T") {
      // this is a track from the CML
      // TODO: this is ugly, should be in redux
      const data = CML_CACHE[result.draggableId];
      const newItem: TimeslotItem & PlanItemBase = {
        timeslotitemid: "I" + insertIndex,
        channel: parseInt(result.destination.droppableId, 10),
        weight: result.destination.index,
        played: false,
        cue: 0,
        ...data,
      };
      sendBAPSicleChannel({
        channel: newItem.channel,
        command: "ADD",
        newItem: newItem,
      });
      increment(null);
    } else if (result.draggableId[0] === "A") {
      // this is an aux resource
      // TODO: this is ugly, should be in redux
      const data = AUX_CACHE[result.draggableId];
      const newItem: TimeslotItem & PlanItemBase = {
        timeslotitemid: "I" + insertIndex,
        channel: parseInt(result.destination.droppableId, 10),
        weight: result.destination.index,
        clean: true,
        played: false,
        cue: 0,
        ...data,
      } as any;
      sendBAPSicleChannel({
        channel: newItem.channel,
        command: "ADD",
        newItem: newItem,
      });
      increment(null);
    } else {
      // this is a normal move (ghosts aren't draggable)
      dispatch(
        moveItem(result.draggableId, [
          parseInt(result.destination.droppableId, 10),
          result.destination.index,
        ])
      );
    }
    // If we're dragging from a pseudo-column, and a search field is focused, defocus it.
    if (result.source.droppableId[0] === "$") {
      const focus = document.activeElement;
      if (focus && focus instanceof HTMLInputElement && focus.type === "text") {
        focus.blur();
      }
    }
  }

  async function onCtxRemoveClick(
    e: any,
    data: { id: string; column: number; index: number }
  ) {
    sendBAPSicleChannel({
      channel: data.column,
      command: "REMOVE",
      weight: data.index,
    });
  }
  async function onCtxUnPlayedClick(e: any, data: { id: string }) {
    dispatch(setItemPlayed({ itemId: data.id, played: false }));
  }

  // Add support for reloading the show plan from the iFrames.
  // There is a similar listener in showplanner/ImporterModal.tsx to handle closing the iframe.
  /*useEffect(() => {
    function reloadListener(event: MessageEvent) {
      if (!event.origin.includes("ury.org.uk")) {
        return;
      }
      if (event.data === "reload_showplan") {
        session.currentTimeslot !== null &&
          dispatch(getShowplan(session.currentTimeslot.timeslot_id));
      }
    }

    window.addEventListener("message", reloadListener);
    return () => {
      window.removeEventListener("message", reloadListener);
    };
  }, [dispatch, session.currentTimeslot]);
  */
  if (showplan === null) {
    return (
      <LoadingDialogue
        title="Getting Show Plan..."
        subtitle={"Hang on a sec..."}
        error={null}
        percent={100}
      />
    );
  }
  return (
    <div className="sp-container m-0">
      <CombinedNavAlertBar />
      <div className="sp">
        <DragDropContext onDragEnd={onDragEnd}>
          <div className="channels">
            <Channel id={0} data={showplan} />
            <Channel id={1} data={showplan} />
            <Channel id={2} data={showplan} />
          </div>
          <span
            id="sidebar-toggle"
            className="btn btn-outline-dark btn-sm mb-0"
            onClick={() => toggleSidebar()}
          >
            <FaBars style={{ verticalAlign: "text-bottom" }} />
            &nbsp; Toggle Sidebar
          </span>
          <div id="sidebar">
            <LibraryColumn />
            <div className="border-top"></div>
          </div>
        </DragDropContext>
      </div>
      <ContextMenu id={TS_ITEM_MENU_ID}>
        <MenuItem onClick={onCtxRemoveClick}>
          <FaTrash /> Remove
        </MenuItem>
        <MenuItem onClick={onCtxUnPlayedClick}>
          <FaCircleNotch /> Mark Unplayed
        </MenuItem>
      </ContextMenu>
    </div>
  );
};

export function LoadingDialogue({
  title,
  subtitle,
  error,
  percent,
}: {
  title: string;
  subtitle: string;
  error: string | null;
  percent: number;
}) {
  return (
    <div className="loading-dialogue">
      <div className="logo-container" style={{ width: percent + "%" }}>
        <img
          className="logo mb-5"
          src={appLogo}
          style={{
            filter:
              "brightness(0.5) sepia(0.5) hue-rotate(-180deg) saturate(5)",
            maxHeight: 50,
          }}
          alt="Web Studio Logo"
        />
      </div>

      <span className="inner">
        <h1>{title}</h1>
        <p>
          <strong>{subtitle}</strong>
        </p>
        {error !== null && (
          <>
            <p>
              <strong>Failed!</strong> Please tell Computing Team that something
              broke.
            </p>
            <p>
              <code>{error}</code>
            </p>
          </>
        )}
      </span>
    </div>
  );
}

export default Showplanner;
