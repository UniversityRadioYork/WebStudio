import React, { useState, useReducer, useEffect } from "react";
import { ContextMenu, MenuItem } from "react-contextmenu";
import { useBeforeunload } from "react-beforeunload";
import { FaAlignJustify, FaBookOpen, FaMicrophone } from "react-icons/fa";
import { VUMeter } from "../optionsMenu/helpers/VUMeter";

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
  ManagedPlaylistLibrary,
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
  const { auxPlaylists, managedPlaylists, userPlaylists } = useSelector(
    (state: RootState) => state.showplan
  );

  useEffect(() => {
    dispatch(getPlaylists());
  }, [dispatch]);

  return (
    <div className="library-column">
      <h2>
        <FaBookOpen className="mx-2" size={28} />
        Libraries
      </h2>
      <div className="px-2">
        <select
          className="form-control"
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
        className={sauce === "None" ? "mt-5 text-center text-muted" : "d-none"}
      >
        <FaBookOpen size={56} />
        <br />
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
      <h2>
        <FaMicrophone className="mx-1" size={28} />
        Microphone
      </h2>
      {!state.open && (
        <p className="alert-info p-2 mb-0">
          The microphone has not been setup. Go to options.
        </p>
      )}
      <div id="micMeter">
        <VUMeter
          width={250}
          height={40}
          source="mic-final"
          range={[-40, 3]}
          greenRange={[-10, -5]}
        />
      </div>
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
      element.classList.toggle("hidden");
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
      <LoadingDialogue
        title="Getting Show Plan..."
        subtitle={planLoading ? "Hang on a sec..." : ""}
        error={planLoadError}
        percent={100}
      />
    );
  }
  return (
    <div className="sp-container m-0">
      <CombinedNavAlertBar />
      <div className="sp-status">
        {planSaving && <em>Plan saving...</em>}
        {planSaveError && (
          <strong>
            Catastrophe! <code>{planSaveError}</code>
          </strong>
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
            <FaAlignJustify style={{ verticalAlign: "text-bottom" }} />
            &nbsp; Toggle Sidebar
          </span>
          <div id="sidebar">
            <LibraryColumn />
            <div className="border-top"></div>
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
