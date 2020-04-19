import React, { useState, useReducer, useEffect } from "react";
import { ContextMenu, MenuItem } from "react-contextmenu";
import { useBeforeunload } from "react-beforeunload";
import { FaCaretSquareDown, FaAlignJustify } from "react-icons/fa";

import { TimeslotItem } from "../api";

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
  getShowplan,
  itemId,
  moveItem,
  addItem,
  removeItem,
  getPlaylists,
} from "./state";

import * as MixerState from "../mixer/state";
import * as OptionsMenuState from "../optionsMenu/state";
import { Item, TS_ITEM_MENU_ID } from "./Item";
import {
  CentralMusicLibrary,
  CML_CACHE,
  AuxLibrary,
  AUX_CACHE,
} from "./libraries";
import { Player } from "./Player";

import { CombinedNavAlertBar } from "../navbar";
import { OptionsMenu } from "../optionsMenu";
import { WelcomeModal } from "./WelcomeModal";
import { PisModal } from "./PISModal";
import "./channel.scss";

function Channel({ id, data }: { id: number; data: PlanItem[] }) {
  return (
    <div className="channel" id={"channel-" + id}>
      <Droppable droppableId={id.toString(10)}>
        {(provided, snapshot) => (
          <div
            className="channel-track-list"
            ref={provided.innerRef}
            {...provided.droppableProps}
          >
            {typeof data[id] === "undefined"
              ? null
              : data
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
  const { auxPlaylists, userPlaylists } = useSelector(
    (state: RootState) => state.showplan
  );

  useEffect(() => {
    dispatch(getPlaylists());
  }, [dispatch]);

  return (
    <div className="library-column">
      <select
        className="form-control"
        style={{ width: "100%" }}
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
      </select>
      <div className="border-top my-3"></div>
      {sauce === "CentralMusicLibrary" && <CentralMusicLibrary />}
      {(sauce.startsWith("aux-") || sauce.match(/^\d/)) && (
        <AuxLibrary libraryId={sauce} />
      )}
      <span
        className={sauce === "None" ? "mt-5 text-center text-muted" : "d-none"}
      >
        <FaCaretSquareDown />
        Select a library to search.
      </span>
    </div>
  );
}

function MicControl() {
  const state = useSelector((state: RootState) => state.mixer.mic);
  const dispatch = useDispatch();

  return (
    <div className="mic-control">
      <h2>Microphone</h2>
      <div className={`mixer-buttons ${!state.open && "disabled"}`}>
        <div
          className="mixer-buttons-backdrop"
          style={{
            width: state.volume * 100 + "%",
          }}
        ></div>
        <button onClick={() => dispatch(MixerState.setMicVolume("off"))}>
          Off
        </button>
        <button onClick={() => dispatch(MixerState.setMicVolume("full"))}>
          Full
        </button>
      </div>
      <div>
        <button onClick={() => dispatch(OptionsMenuState.open())}>
          Options
        </button>
      </div>
    </div>
  );
}

function MicLiveIndicator() {
  const micState = useSelector((state: RootState) => state.mixer.mic);
  if (micState.open && micState.volume > 0) {
    return <div className="sp-mic-live" />;
  }
  return null;
}

function incrReducer(state: number, action: any) {
  return state + 1;
}

const Showplanner: React.FC<{ timeslotId: number }> = function({ timeslotId }) {
  const {
    plan: showplan,
    planLoadError,
    planLoading,
    planSaveError,
    planSaving,
  } = useSelector((state: RootState) => state.showplan);
  const session = useSelector((state: RootState) => state.session);

  const [showWelcomeModal, setShowWelcomeModal] = useState(
    !session.userCanBroadcast
  );

  const [showPisModal, setShowPisModal] = useState(session.userCanBroadcast);

  const dispatch = useDispatch();

  useBeforeunload((event) => event.preventDefault());

  useEffect(() => {
    dispatch(getShowplan(timeslotId));
  }, [dispatch, timeslotId]);

  function toggleSidebar() {
    var element = document.getElementById("sidebar");
    if (element) {
      element.classList.toggle("active");
    }
    setTimeout(function() {
      dispatch(MixerState.redrawWavesurfers());
    }, 500);
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
      const newItem: TimeslotItem = {
        type: "central",
        timeslotitemid: "I" + insertIndex,
        channel: parseInt(result.destination.droppableId, 10),
        weight: result.destination.index,
        ...data,
      };
      dispatch(addItem(timeslotId, newItem));
      increment(null);
    } else if (result.draggableId[0] === "A") {
      // this is an aux resource
      // TODO: this is ugly, should be in redux
      const data = AUX_CACHE[result.draggableId];
      const newItem: TimeslotItem = {
        type: "aux",
        timeslotitemid: "I" + insertIndex,
        channel: parseInt(result.destination.droppableId, 10),
        weight: result.destination.index,
        clean: true,
        ...data,
      } as any;
      dispatch(addItem(timeslotId, newItem));
      increment(null);
    } else {
      // this is a normal move (ghosts aren't draggable)
      dispatch(
        moveItem(timeslotId, result.draggableId, [
          parseInt(result.destination.droppableId, 10),
          result.destination.index,
        ])
      );
    }
  }

  async function onCtxRemoveClick(e: any, data: { id: string }) {
    dispatch(removeItem(timeslotId, data.id));
  }

  if (showplan === null) {
    return (
      <div className="sp-container">
        <h1>Getting show plan...</h1>
        {planLoading && (
          <b>Your plan is loading, please wait just a second...</b>
        )}
        {planLoadError !== null && (
          <>
            <b>Plan load failed!</b> Please tell Comp that something broke.
            <p>
              <code>{planLoadError}</code>
            </p>
          </>
        )}
      </div>
    );
  }
  return (
    <div className="sp-container m-0">
      <CombinedNavAlertBar />
      <div className="sp-status">
        {planSaving && <em>Plan saving...</em>}
        {planSaveError && (
          <b>
            Catastrophe! <code>{planSaveError}</code>
          </b>
        )}
      </div>
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
            <FaAlignJustify />
            Toggle Sidebar
          </span>
          <div id="sidebar">
            <LibraryColumn />
            <MicControl />
          </div>
        </DragDropContext>
      </div>
      <ContextMenu id={TS_ITEM_MENU_ID}>
        <MenuItem onClick={onCtxRemoveClick}>Remove</MenuItem>
      </ContextMenu>
      <OptionsMenu />
      <WelcomeModal
        isOpen={showWelcomeModal}
        close={() => setShowWelcomeModal(false)}
      />
      <PisModal close={() => setShowPisModal(false)} isOpen={showPisModal} />
      <MicLiveIndicator />
    </div>
  );
};

export default Showplanner;
