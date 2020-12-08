import React, { useState, useReducer, useEffect } from "react";
import { ContextMenu, MenuItem } from "react-contextmenu";
import { useBeforeunload } from "react-beforeunload";
import {
  FaBars,
  FaMicrophone,
  FaTrash,
  FaCircleNotch,
  FaBookOpen,
  FaSatelliteDish,
} from "react-icons/fa";
import { VUMeter } from "../optionsMenu/helpers/VUMeter";
import Stopwatch from "react-stopwatch";

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
  setItemPlayed,
  PlanItemBase,
} from "./state";

import * as MixerState from "../mixer/state";
import * as OptionsMenuState from "../optionsMenu/state";
import { Item, TS_ITEM_MENU_ID } from "./Item";
import { CML_CACHE, AUX_CACHE, LibraryColumn } from "./libraries";
import { Player } from "./Player";

import { CombinedNavAlertBar } from "../navbar";
import { OptionsMenu } from "../optionsMenu";
import { WelcomeModal } from "./WelcomeModal";
import { PisModal } from "./PISModal";
import "./channel.scss";
import Modal from "react-modal";
import { Nav, NavItem, NavLink } from "reactstrap";
import { GuestsSidebarTab } from "../multi";

function Channel({ id, data }: { id: number; data: PlanItem[] }) {
  return (
    <div className="channel" id={"channel-" + id}>
      <Droppable droppableId={id.toString(10)}>
        {(provided) => (
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

function MicControl() {
  const state = useSelector((state: RootState) => state.mixer.mic);
  const proMode = useSelector((state: RootState) => state.settings.proMode);
  const stereo = useSelector(
    (state: RootState) => state.settings.channelVUsStereo
  );
  const dispatch = useDispatch();

  return (
    <div className="mic-control">
      <div data-toggle="collapse" data-target="#mic-control-menu">
        <h2>
          <FaMicrophone className="mx-1" size={28} />
          Microphone
        </h2>
        <FaBars
          className="toggle mx-0 mt-2 text-muted"
          title="Toggle Microphone Menu"
          size={20}
        />
      </div>
      <div id="mic-control-menu" className="collapse show">
        {!state.open && (
          <p className="alert-info p-2 mb-0">
            The microphone has not been setup. Go to{" "}
            <button
              className="btn btn-link m-0 mb-1 p-0"
              onClick={() => dispatch(OptionsMenuState.open())}
            >
              {" "}
              options
            </button>
            .
          </p>
        )}
        {state.open && proMode && (
          <span id="micLiveTimer" className={state.volume > 0 ? "live" : ""}>
            <span className="text">Mic Live: </span>
            {state.volume > 0 ? (
              <Stopwatch
                seconds={0}
                minutes={0}
                hours={0}
                render={({ formatted }) => {
                  return <span>{formatted}</span>;
                }}
              />
            ) : (
              "00:00:00"
            )}
          </span>
        )}
        {state.open && (
          <>
            <div id="micMeter">
              <VUMeter
                width={250}
                height={40}
                source="mic-final"
                range={[-40, 3]}
                greenRange={[-16, -6]}
                stereo={proMode && stereo}
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
          </>
        )}
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

function incrReducer(state: number) {
  return state + 1;
}

const Showplanner: React.FC<{ timeslotId: number }> = function({ timeslotId }) {
  const { plan: showplan, planLoadError, planLoading } = useSelector(
    (state: RootState) => state.showplan
  );

  // Tell Modals that #root is the main page content, for accessability reasons.
  Modal.setAppElement("#root");

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

  const [activeSidebarCol, setActiveSidebarCol] = useState<
    "library" | "guests"
  >("library");

  const [insertIndex, increment] = useReducer(incrReducer, 0);

  async function onDragEnd(result: DropResult) {
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
      dispatch(addItem(timeslotId, newItem));
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
    // If we're dragging from a pseudo-column, and a search field is focused, defocus it.
    if (result.source.droppableId[0] === "$") {
      const focus = document.activeElement;
      if (focus && focus instanceof HTMLInputElement && focus.type === "text") {
        focus.blur();
      }
    }
  }

  async function onCtxRemoveClick(data: { id: string }) {
    dispatch(removeItem(timeslotId, data.id));
  }
  async function onCtxUnPlayedClick(data: { id: string }) {
    dispatch(setItemPlayed({ itemId: data.id, played: false }));
  }

  // Add support for reloading the show plan from the iFrames.
  // There is a similar listener in showplanner/ImporterModal.tsx to handle closing the iframe.
  useEffect(() => {
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
            <Nav tabs>
              <NavItem>
                <NavLink
                  className={activeSidebarCol === "library" ? "active" : ""}
                  onClick={() => setActiveSidebarCol("library")}
                >
                  <FaBookOpen className="mx-2" size={4} />
                  Libraries
                </NavLink>
              </NavItem>
              <NavItem>
                <NavLink
                  className={activeSidebarCol === "guests" ? "active" : ""}
                  onClick={() => setActiveSidebarCol("guests")}
                >
                  <FaSatelliteDish className="mx-2" size={14} />
                  Guests
                </NavLink>
              </NavItem>
            </Nav>
            {activeSidebarCol === "library" && <LibraryColumn />}
            {activeSidebarCol === "guests" && <GuestsSidebarTab />}
            <div className="border-top"></div>
            <MicControl />
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
