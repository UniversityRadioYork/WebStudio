import React, { useState, useReducer, useEffect } from "react";
import { Menu, Item as CtxMenuItem } from "react-contexify";
import "react-contexify/dist/ReactContexify.min.css";
import { useBeforeunload } from "react-beforeunload";
import {
  FaBars,
  FaTrash,
  FaCircleNotch,
  FaPencilAlt,
  FaHeadphonesAlt,
  FaCircle,
} from "react-icons/fa";

import { MYRADIO_NON_API_BASE, TimeslotItem } from "../api";
import appLogo from "../assets/images/webstudio.svg";

import {
  Droppable,
  DragDropContext,
  DropResult,
  ResponderProvided,
} from "react-beautiful-dnd";
import ReactTooltip from "react-tooltip";

import { useSelector, useDispatch, shallowEqual } from "react-redux";
import { RootState } from "../rootReducer";
import {
  PlanItem,
  getShowplan,
  itemId,
  moveItem,
  addItem,
  removeItem,
  setItemPlayedAt,
  PlanItemBase,
} from "./state";

import * as MixerState from "../mixer/state";

import { Item, TS_ITEM_MENU_ID } from "./Item";
import { CML_CACHE, AUX_CACHE } from "./libraries";
import { Player } from "./Player";

import { CombinedNavAlertBar } from "../navbar";
import { OptionsMenu } from "../optionsMenu";
import { WelcomeModal } from "./WelcomeModal";
import { PisModal } from "./PISModal";
import "./channel.scss";
import Modal from "react-modal";
import { Sidebar } from "./sidebar";
import { PLAYER_ID_PREVIEW } from "../mixer/audio";

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
      <Player id={id} isPreviewChannel={false} />
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

const Showplanner: React.FC<{ timeslotId: number | null }> = function({
  timeslotId,
}) {
  if (!process.env.REACT_APP_BAPSICLE_INTERFACE) {
    // In BAPS, we'll load in the show plan from a async message from server.
    if (!timeslotId) {
      throw new Error("Trying to load showplan with undefined timeslotid!");
    }
  }
  const isShowplan = useSelector(
    (state: RootState) => state.showplan.plan !== null,
    shallowEqual
  );
  const planSaving = useSelector(
    (state: RootState) => state.showplan.planSaving
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
    if (timeslotId) {
      dispatch(getShowplan(timeslotId!));
    }
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
      const newItem: TimeslotItem & PlanItemBase = {
        timeslotitemid: "I" + insertIndex,
        channel: parseInt(result.destination.droppableId, 10),
        weight: result.destination.index,
        playedAt: undefined,
        cue: 0,
        ...data,
      };
      dispatch(addItem(timeslotId!, newItem));
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
      dispatch(addItem(timeslotId!, newItem));
      increment(null);
    } else {
      // this is a normal move (ghosts aren't draggable)
      dispatch(
        moveItem(timeslotId!, result.draggableId, [
          parseInt(result.destination.droppableId, 10),
          result.destination.index,
        ])
      );
    }
    // If we're dragging from a pseudo-column,
    // and a search field or library dropdown is focused, defocus it.
    if (result.source.droppableId[0] === "$") {
      const focus = document.activeElement;
      if (
        (focus && focus instanceof HTMLInputElement && focus.type === "text") ||
        (focus instanceof HTMLSelectElement &&
          focus.id === "sidebarLibrarySelect")
      ) {
        focus.blur();
      }
    }
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
    if (!process.env.REACT_APP_BAPSICLE_INTERFACE) {
      window.addEventListener("message", reloadListener);
      return () => {
        window.removeEventListener("message", reloadListener);
      };
    }
  }, [dispatch, session.currentTimeslot]);

  if (!isShowplan) {
    return <GettingShowPlanScreen />;
  }
  return (
    <div className="sp-container m-0">
      <CombinedNavAlertBar />
      <div className="sp">
        <DragDropContext onDragEnd={onDragEnd}>
          <ChannelStrips />
          <span
            id="sidebar-toggle"
            className="btn btn-outline-dark btn-sm mb-0"
            onClick={() => toggleSidebar()}
          >
            <FaBars style={{ verticalAlign: "text-bottom" }} />
            &nbsp; Toggle Sidebar
          </span>
          <Sidebar />
        </DragDropContext>
      </div>
      <Menu id={TS_ITEM_MENU_ID}>
        <CtxMenuItem
          onClick={(args) =>
            dispatch(removeItem(timeslotId!, (args.props as any).id))
          }
          disabled={planSaving}
        >
          <FaTrash /> Remove
        </CtxMenuItem>
        <CtxMenuItem
          onClick={(args) =>
            dispatch(setItemPlayedAt((args.props as any).id, undefined))
          }
        >
          <FaCircleNotch /> Mark Unplayed
        </CtxMenuItem>
        <CtxMenuItem
          onClick={(args) =>
            dispatch(
              setItemPlayedAt((args.props as any).id, new Date().valueOf())
            )
          }
        >
          <FaCircle /> Mark Played
        </CtxMenuItem>
        {!process.env.REACT_APP_BAPSICLE_INTERFACE && (
          <CtxMenuItem
            onClick={(args) => {
              dispatch(
                MixerState.load(PLAYER_ID_PREVIEW, (args.props as any).item)
              );
            }}
          >
            <FaHeadphonesAlt /> Preview with PFL
          </CtxMenuItem>
        )}
        <CtxMenuItem
          onClick={(args) => {
            if ("trackid" in (args.props as any)) {
              window.open(
                MYRADIO_NON_API_BASE +
                  "/Library/editTrack?trackid=" +
                  (args.props as any).trackid
              );
            } else {
              alert("Sorry, only editing tracks is possible right now");
            }
          }}
        >
          <FaPencilAlt /> Edit Item
        </CtxMenuItem>
      </Menu>
      <ReactTooltip
        id="track-hover-tooltip"
        // Sadly dataTip has to be a string, so let's format this the best we can. Split by something unusual to see in the data.
        getContent={(dataTip) => (
          <>
            {dataTip && (
              <>
                {dataTip
                  .split("¬")
                  .map((t) => t.split(/:(.+)/))
                  .map((t) => (
                    <div key={t[0]}>
                      <strong>{t[0]}:</strong> {t[1]}
                    </div>
                  ))}
              </>
            )}
          </>
        )}
        delayShow={300}
        place="bottom"
      />
      {!process.env.REACT_APP_BAPSICLE_INTERFACE && (
        <>
          <OptionsMenu />
          <WelcomeModal
            isOpen={showWelcomeModal}
            close={() => setShowWelcomeModal(false)}
          />
          <PisModal
            close={() => setShowPisModal(false)}
            isOpen={showPisModal}
          />
          <MicLiveIndicator />
        </>
      )}
    </div>
  );
};

function GettingShowPlanScreen() {
  const { planLoading, planLoadError } = useSelector(
    (state: RootState) => state.showplan
  );
  return (
    <LoadingDialogue
      title="Getting Show Plan..."
      subtitle={planLoading ? "Hang on a sec..." : ""}
      error={planLoadError}
      percent={100}
    />
  );
}

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
        {error !== null &&
          (error === "Error: No valid authentication data provided." ? (
            <p>Redirecting you to MyRadio, please wait...</p>
          ) : (
            <>
              <p>
                <strong>Failed!</strong> Please tell Computing Team that
                something broke.
              </p>
              <p>
                <code>{error}</code>
              </p>
            </>
          ))}
      </span>
    </div>
  );
}

function ChannelStrips() {
  const showplan = useSelector((state: RootState) => state.showplan.plan!);

  useEffect(() => {
    ReactTooltip.rebuild(); // If the show plan has been re-jiggled, make sure the tooltips are updated.
  });

  return (
    <div className="channels">
      <Channel id={0} data={showplan} />
      <Channel id={1} data={showplan} />
      <Channel id={2} data={showplan} />
    </div>
  );
}

export default Showplanner;
