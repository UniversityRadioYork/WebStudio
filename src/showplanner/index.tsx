import React, { useState, useReducer, useRef, useEffect } from "react";
import { DndProvider, useDrag, useDrop } from "react-dnd";
import HTML5Backend from "react-dnd-html5-backend";
import { ContextMenu, ContextMenuTrigger, MenuItem } from "react-contextmenu";

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

import * as PlayerState from "../mixer/state";

import playLogo from "../assets/icons/play.svg";
import pauseLogo from "../assets/icons/pause.svg";
import stopLogo from "../assets/icons/stop.svg";

const CML_CACHE: { [recordid_trackid: string]: Track } = {};

const TS_ITEM_MENU_ID = "SongMenu";

function Item({
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
      dispatch(PlayerState.load(column, x));
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
            {x.title}
            {"artist" in x && " - " + x.artist}
            <code>
              {itemId(x)} {"channel" in x && x.channel + "/" + x.weight}
            </code>
          </ContextMenuTrigger>
        </div>
      )}
    </Draggable>
  );
}

const USE_REAL_GAIN_VALUE = false;

function Player({ id }: { id: number }) {
  const playerState = useSelector(
    (state: RootState) => state.mixer.players[id]
  );
  const dispatch = useDispatch();

  return (
    <div className="player">
      {playerState.loadedItem == null && <div>No Media Selected</div>}
      {playerState.loadedItem !== null && playerState.loading == false && (
        <div style={{ height: "1.5em", overflowY: "hidden" }}>{playerState.loadedItem.title}</div>
      )}
      {playerState.loading && <b>LOADING</b>}
      <div className="mediaButtons">
        <button
          onClick={() => dispatch(PlayerState.play(id))}
          className={playerState.state === "playing" ? "sp-state-playing" : ""}
        >
          <img src={playLogo} className="sp-player-button" />
        </button>
        <button
          onClick={() => dispatch(PlayerState.pause(id))}
          className={playerState.state === "paused" ? "sp-state-paused" : ""}
        >
          <img src={pauseLogo} className="sp-player-button" />
        </button>
        <button
          onClick={() => dispatch(PlayerState.stop(id))}
          className={playerState.state === "stopped" ? "sp-state-stopped" : ""}
        >
          <img src={stopLogo} className="sp-player-button" />
        </button>
      </div>
      <div className="sp-mixer-buttons">
        <div
          className="sp-mixer-buttons-backdrop"
          style={{ width: (USE_REAL_GAIN_VALUE ? playerState.gain : playerState.volume) * 100 + "%" }}
        ></div>
        <button onClick={() => dispatch(PlayerState.setVolume(id, "off"))}>
          Off
        </button>
        <button onClick={() => dispatch(PlayerState.setVolume(id, "bed"))}>
          Bed
        </button>
        <button onClick={() => dispatch(PlayerState.setVolume(id, "full"))}>
          Full
        </button>
      </div>
    </div>
  );
}

function Column({ id, data }: { id: number; data: PlanItem[] }) {
  return (
    <div className="sp-main-col">
      <div className="sp-col">
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
  const debouncedTrack = useDebounce(track, 1000);
  const [items, setItems] = useState<Track[]>([]);
  useEffect(() => {
    if (debouncedTrack === "") {
      return;
    }
    searchForTracks("", track).then(tracks => {
      tracks.forEach(track => {
        const id = itemId(track);
        if (!(id in CML_CACHE)) {
          CML_CACHE[id] = track;
        }
      });
      setItems(tracks);
    });
  }, [debouncedTrack]);
  return (
    <>
      <input
        type="text"
        placeholder="Filter by track..."
        value={track}
        onChange={e => setTrack(e.target.value)}
      />
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
        style={{ width: "100%" }}
        value={sauce}
        onChange={e => setSauce(e.target.value)}
      >
        <option value={"None"} disabled>
          Choose a library
        </option>
        <option value={"CentralMusicLibrary"}>Central Music Library</option>
      </select>
      {sauce === "CentralMusicLibrary" && <CentralMusicLibrary />}
    </div>
  );
}

function MixingInterface() {
  const [sauce, setSauce] = useState("None");
  return (
    <div className="sp-col" style={{ height: "48%", overflowY: "visible" }}>
      <h1>Mixing Interface</h1>
    </div>
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

  useEffect(() => {
    dispatch(getShowplan(timeslotId));
  }, [timeslotId]);

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
    <div className="sp-container">
      <div style={{ height: "10%" }}>
        <h1>baps3 ayy lmao</h1>
        <img
          src="https://ury.org.uk/images/logo.png"
          style={{ height: "6%", right: "2%", position: "absolute", top: "2%" }}
        />
      </div>
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
          <div className="sp-main-col" style={{ marginRight: ".2%" }}>
            <LibraryColumn />
            <MixingInterface />
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
