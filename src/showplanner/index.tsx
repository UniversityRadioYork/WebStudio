import React, { useState, useReducer, useRef, useEffect, memo } from "react";
import { DndProvider, useDrag, useDrop } from "react-dnd";
import HTML5Backend from "react-dnd-html5-backend";
import { ContextMenu, ContextMenuTrigger, MenuItem } from "react-contextmenu";
import { useBeforeunload } from "react-beforeunload";

import {
  showPlanResource,
  Showplan,
  TimeslotItem,
  Track,
  searchForTracks
} from "../api";
import { XYCoord } from "dnd-core";
import {
  Droppable,
  DragDropContext,
  Draggable,
  DropResult,
  ResponderProvided
} from "react-beautiful-dnd";
import useDebounce from "../lib/useDebounce";
import { useSelector, useDispatch } from "react-redux";
import { RootState } from "../rootReducer";
import {
  Plan,
  PlanItem,
  getShowplan,
  itemId,
  moveItem,
  addItem,
  removeItem
} from "./state";
import { secToHHMM } from "../utils";

import * as MixerState from "../mixer/state";

import appLogo from "../assets/images/webstudio.svg";

const CML_CACHE: { [recordid_trackid: string]: Track } = {};

const TS_ITEM_MENU_ID = "SongMenu";

const Item = memo(function Item({
  item: x,
  index,
  column
}: {
  item: PlanItem | Track;
  index: number;
  column: number;
}) {
  const dispatch = useDispatch();
  const id = itemId(x);
  const isReal = "timeslotitemid" in x;
  const isGhost = "ghostid" in x;

  const playerState = useSelector(
    (state: RootState) => state.mixer.players[column]
  );

  function triggerClick() {
    if (column > -1) {
      dispatch(MixerState.load(column, x));
    }
  }

  return (
    <Draggable draggableId={id} index={index} isDragDisabled={isGhost}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          key={id}
          className={`sp-track ${
            column >= 0 &&
            playerState.loadedItem !== null &&
            itemId(playerState.loadedItem) === id
              ? "sp-track-active"
              : ""
          }`}
          onClick={triggerClick}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
        >
          <ContextMenuTrigger
            id={isReal ? TS_ITEM_MENU_ID : ""}
            collect={() => ({ id })}
          >
            <i className={"fa fa-circle " + (x.type)}></i>&nbsp;
            {x.title}
            {"artist" in x && " - " + x.artist}
            <small className=
              {"border rounded border-danger text-danger p-1 m-1" + (
                x.clean === false ? "" : " d-none")}>
              Explicit
            </small>
            <code>
              {itemId(x)} {"channel" in x && x.channel + "/" + x.weight}
            </code>
          </ContextMenuTrigger>
        </div>
      )}
    </Draggable>
  );
});

const USE_REAL_GAIN_VALUE = false;

function Player({ id }: { id: number }) {
  const playerState = useSelector(
    (state: RootState) => state.mixer.players[id]
  );
  const dispatch = useDispatch();

  return (
    <div className={(playerState.loadedItem !== null && playerState.loading == false) ? "player loaded" : "player"}>


        <div className="card text-center">
        <div className="row m-0 p-1 card-header channelButtons">
          <button
            className={(playerState.autoAdvance ? "btn-primary" : "btn-outline-secondary") + " btn btn-sm col-4 sp-play-on-load"}
            onClick={() => dispatch(MixerState.toggleAutoAdvance(id))}
          >
            <i className="fa fa-level-down-alt"></i>&nbsp;
            Auto Advance
          </button>
          <button
            className={(playerState.playOnLoad ? "btn-primary": "btn-outline-secondary") + " btn btn-sm col-4 sp-play-on-load"}
            onClick={() => dispatch(MixerState.togglePlayOnLoad(id))}
          >
            <i className="far fa-play-circle"></i>&nbsp;
            Play on Load
          </button>
          <button
            className={(playerState.repeat != "none" ? "btn-primary" : "btn-outline-secondary") + " btn btn-sm col-4 sp-play-on-load"}
            onClick={() => dispatch(MixerState.toggleRepeat(id))}
          >
            <i className="fa fa-redo"></i>&nbsp;
            Repeat {playerState.repeat}
          </button>
        </div>
        <div className="card-body p-0">
          <span className="card-title">
            <strong>
            {playerState.loadedItem !== null
            && playerState.loading === false
            ? playerState.loadedItem.title
                : (playerState.loading ? `LOADING` : "No Media Selected")}
            </strong>
            <small className=
              {"border rounded border-danger text-danger p-1 m-1" + (
                playerState.loadedItem !== null
                && playerState.loading === false
                && playerState.loadedItem.clean === false ? "" : " d-none")}>
              Explicit
            </small>
          </span><br />
          <span className="text-muted">
              {playerState.loadedItem !== null
              && playerState.loading === false
              ? playerState.loadedItem.artist
              : ""}&nbsp;
          </span>
          <div className="mediaButtons">
            <button
              onClick={() => dispatch(MixerState.play(id))}
                className={(playerState.state === "playing" ? ((playerState.timeRemaining <= 15) ? "sp-state-playing sp-ending-soon" : "sp-state-playing") : "")}
            >
              <i className="fas fa-play"></i>
            </button>
            <button
              onClick={() => dispatch(MixerState.pause(id))}
              className={playerState.state === "paused" ? "sp-state-paused" : ""}
            >
              <i className="fas fa-pause"></i>
            </button>
            <button
              onClick={() => dispatch(MixerState.stop(id))}
              className={playerState.state === "stopped" ? "sp-state-stopped" : ""}
            >
              <i className="fas fa-stop"></i>
            </button>
          </div>
        </div>

        <div className="p-0 card-footer waveform" >

            <span id={"current-" + id} className="m-0 current bypass-click">{secToHHMM(playerState.timeCurrent)}</span>
            <span id={"length-" + id} className="m-0 length bypass-click">{secToHHMM(playerState.timeLength)}</span>
            <span id={"remaining-" + id} className="m-0 remaining bypass-click">{secToHHMM(playerState.timeRemaining)}</span>
            <span className="m-0 intro bypass-click">{playerState.loadedItem !== null ? secToHHMM(playerState.loadedItem.intro ? playerState.loadedItem.intro : 0) : "00:00:00"} - in</span>
            <span className="m-0 outro bypass-click">out - 00:00:00</span>
            {(playerState.loadedItem !== null && playerState.timeLength === 0) && <span className="m-0 loading bypass-click">LOADING</span>}
            <div className="m-0 graph" id={"waveform-" + id}></div>
        </div>
      </div>

      <div className="sp-mixer-buttons">
        <div
          className="sp-mixer-buttons-backdrop"
          style={{
            width:
              (USE_REAL_GAIN_VALUE ? playerState.gain : playerState.volume) *
                100 +
              "%"
          }}
        ></div>
        <button onClick={() => dispatch(MixerState.setVolume(id, "off"))}>
          Off
        </button>
        <button onClick={() => dispatch(MixerState.setVolume(id, "bed"))}>
          Bed
        </button>
        <button onClick={() => dispatch(MixerState.setVolume(id, "full"))}>
          Full
        </button>
      </div>
    </div>
  );
}

function Column({ id, data }: { id: number; data: PlanItem[] }) {
  return (
    <div className="sp-main-col">
      <div className="sp-col shadow">
        <Droppable droppableId={id.toString(10)}>
          {(provided, snapshot) => (
            <div
              className="sp-col-inner"
              ref={provided.innerRef}
              {...provided.droppableProps}
            >
              {typeof data[id] === "undefined"
                ? null
                : data
                    .filter(x => x.channel === id)
                    .sort((a, b) => a.weight - b.weight)
                    .map((x, index) => (
                      <Item
                        key={itemId(x)}
                        item={x}
                        index={index}
                        column={id}
                      />
                    ))}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </div>
      <Player id={id} />
    </div>
  );
}

function CentralMusicLibrary() {
  const [track, setTrack] = useState("");
  const [artist, setArtist] = useState("");
  const debouncedTrack = useDebounce(track, 1000);
  const debouncedArtist = useDebounce(artist, 1000);
  const [items, setItems] = useState<Track[]>([]);

  type searchingStateEnum = "searching" | "not-searching" | "results" | "no-results";
  const [state, setState] = useState<searchingStateEnum>("not-searching");
  useEffect(() => {
    if (debouncedTrack === "" && debouncedArtist === "") {
      setItems([]);
      setState("not-searching");
      return;
    }
    setItems([]);
    setState("searching");
    searchForTracks(artist, track).then(tracks => {
      if (tracks.length === 0) {
        setState("no-results");
      } else {
        setState("results");
      }
      tracks.forEach(track => {
        const id = itemId(track);
        if (!(id in CML_CACHE)) {
          CML_CACHE[id] = track;
        }
      });
      setItems(tracks);
    });
  }, [debouncedTrack, debouncedArtist]);
  return (
    <>
      <input
        className="form-control"
        type="text"
        placeholder="Filter by track..."
        value={track}
        onChange={e => setTrack(e.target.value)}
      />
      <input
        className="form-control"
        type="text"
        placeholder="Filter by artist..."
        value={artist}
        onChange={e => setArtist(e.target.value)}
      />
      <span className={state !== "results" ? "mt-5 text-center text-muted" : "d-none"}>
      <i className=
        {"fa fa-2x " +
          (state === "not-searching"
          ? "fa-search" :
            state === "searching"
              ? "fa-cog fa-spin" :
                state === "no-results"
                ? "fa-times-circle" :
                  "d-none"
          )
        }></i><br />
      {
        state === "not-searching"
        ? "Enter a search term." :
          state === "searching"
            ? "Searching..." :
              state === "no-results"
              ? "No results." :
                ""
      }
      </span>
      <Droppable droppableId="$CML">
        {(provided, snapshot) => (
          <div ref={provided.innerRef} {...provided.droppableProps}>
            {items.map((item, index) => (
              <Item key={itemId(item)} item={item} index={index} column={-1} />
            ))}
            {provided.placeholder}
          </div>
        )}
      </Droppable>
    </>
  );
}

function LibraryColumn() {
  const [sauce, setSauce] = useState("None");
  return (
    <div className="sp-col" style={{ height: "48%", marginBottom: "1%" }}>
      <select
        className="form-control"
        style={{ width: "100%" }}
        value={sauce}
        onChange={e => setSauce(e.target.value)}
      >
        <option value={"None"} disabled>
          Choose a library
        </option>
        <option value={"CentralMusicLibrary"}>Central Music Library</option>
      </select>
      <div className="border-top my-3"></div>
      {sauce === "CentralMusicLibrary" && <CentralMusicLibrary />}

      <span className={sauce === "None" ? "mt-5 text-center text-muted" : "d-none"}>
        <i className="far fa-2x fa-caret-square-down"></i>
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
    <div className="sp-col" style={{ height: "48%", overflowY: "visible" }}>
      <h2>Microphone</h2>
      <button
        disabled={state.open}
        onClick={() => dispatch(MixerState.openMicrophone())}
      >
        Open
      </button>
      {state.openError !== null && (
        <div className="sp-alert">
          {state.openError === "NO_PERMISSION"
            ? "Please grant this page permission to use your microphone and try again."
            : state.openError === "NOT_SECURE_CONTEXT"
            ? "We can't open the microphone. Please make sure the address bar has a https:// at the start and try again."
            : "An error occurred when opening the microphone. Please try again."}
        </div>
      )}
      <div className="sp-mixer-buttons">
        <div
          className="sp-mixer-buttons-backdrop"
          style={{
            width:
              (USE_REAL_GAIN_VALUE ? state.gain : state.volume) *
                100 +
              "%"
          }}
        ></div>
        <button onClick={() => dispatch(MixerState.setMicVolume("off"))}>
          Off
        </button>
        <button onClick={() => dispatch(MixerState.setMicVolume("full"))}>
          Full
        </button>
      </div>
    </div>
  );
}


function NavBar() {
  const userName = "Matthew Stratford";

  return (

    <header className="navbar navbar-ury navbar-expand-md p-0 bd-navbar">
      <nav className="container">
        <button className="navbar-toggler" type="button" data-toggle="collapse" data-target="#collapsed" aria-controls="collapsed" aria-expanded="false" aria-label="Toggle navigation">
          <span className="navbar-toggler-icon"></span>
        </button>
        <div className="navbar-nav">
        <a className="navbar-brand" href="/">
          <img src="//ury.org.uk/myradio/img/URY.svg" height="30" alt="University Radio York Logo" />
        </a>
        <span className="navbar-brand divider"></span>
        <a className="navbar-brand" href="/">
          <img src={appLogo} height="28" alt="Web Studio Logo" />
        </a>
        </div>

        <ul className="nav navbar-nav navbar-right">
          <li className="nav-item">
            <a className="nav-link" target="_blank" href="https://ury.org.uk/myradio/MyRadio/timeslot/?next=/webstudio">
              <span className="fa fa-clock-o"></span>&nbsp;
              Timeslot Time
            </a>
          </li>
          <li className="nav-item dropdown">
            <a className="nav-link dropdown-toggle" href="https://ury.org.uk/myradio/Profile/default/" id="dropdown07" data-toggle="dropdown" aria-haspopup="true" aria-expanded="false">
              <span className="fa fa-user-o"></span>&nbsp;
              {userName}
            </a>
            <div className="dropdown-menu" aria-labelledby="dropdown07">
              <a className="dropdown-item" target="_blank" href="https://ury.org.uk/myradio/Profile/default/">My Profile</a>
              <a className="dropdown-item" target="_blank" href="https://ury.org.uk/myradio/MyRadio/logout/">Logout</a>
            </div>
          </li>
        </ul>
      </nav>
    </header>

  );
}

const Showplanner: React.FC<{ timeslotId: number }> = function({ timeslotId }) {
  const {
    plan: showplan,
    planLoadError,
    planLoading,
    planSaveError,
    planSaving
  } = useSelector((state: RootState) => state.showplan);

  const dispatch = useDispatch();

  useBeforeunload(event => event.preventDefault());

  useEffect(() => {
    dispatch(getShowplan(timeslotId));
  }, [timeslotId]);

  function toggleSidebar() {
    var element = document.getElementById('sidebar');
    if (element) {
      element.classList.toggle('active')
    }
  };

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
      const data = CML_CACHE[result.draggableId];
      const newItem: TimeslotItem = {
        type: "central",
        timeslotitemid: "CHANGEME" + Math.random(),
        channel: parseInt(result.destination.droppableId, 10),
        weight: result.destination.index,
        ...data
      };
      dispatch(addItem(timeslotId, newItem));
    } else {
      // this is a normal move (ghosts aren't draggable)
      dispatch(
        moveItem(timeslotId, result.draggableId, [
          parseInt(result.destination.droppableId, 10),
          result.destination.index
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
        <h1>Show Planner</h1>
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
      <NavBar />
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
          <Column id={0} data={showplan} />
          <Column id={1} data={showplan} />
          <Column id={2} data={showplan} />
          <div className="sp-main-col sidebar-toggle">
            <button id="sidebarCollapse" className="btn btn-sm ml-auto" type="button" onClick={() => toggleSidebar()}>
                <i className="fas fa-align-justify"></i> Show Sidebar
            </button>
          </div>
          <div id="sidebar" className="sp-main-col">
            <LibraryColumn />
            <MicControl />
          </div>
        </DragDropContext>
      </div>
      <ContextMenu id={TS_ITEM_MENU_ID}>
        <MenuItem onClick={onCtxRemoveClick}>Remove</MenuItem>
      </ContextMenu>
    </div>
  );
};

export default Showplanner;
