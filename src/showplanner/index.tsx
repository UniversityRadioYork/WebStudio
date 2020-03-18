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

import * as PlayerState from "./player/state";

const CML_CACHE: { [recordid_trackid: string]: Track } = {};

const TS_ITEM_MENU_ID = "SongMenu";

function Item({ item: x, index, column }: { item: PlanItem | Track; index: number; column: number }) {
  const dispatch = useDispatch();
  const id = itemId(x);
  const isReal = "timeslotitemid" in x;
  const isGhost = "ghostid" in x;

  const playerState = useSelector((state: RootState) => state.player.players[column]);

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
          className={`sp-track ${(playerState.loadedItem !== null && itemId(playerState.loadedItem) === id) ? "sp-track-active" : ""}`}
          onClick={triggerClick}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
        >
          <ContextMenuTrigger id={isReal ? TS_ITEM_MENU_ID : ""} collect={() => ({ id })}>
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

function Player({ id }: { id: number }) {
  const playerState = useSelector((state: RootState) => state.player.players[id]);
  const dispatch = useDispatch();

  return (
    <div>
      {playerState.loadedItem == null && (<div>No Media Selected</div>)}
      {playerState.loadedItem !== null && (<div>{playerState.loadedItem.title}</div>)}
      {playerState.loading && <b>LOADING</b>}
      <button
        onClick={() => dispatch(PlayerState.play(id))}
        className={playerState.state === "playing" ? "sp-state-playing" : ""}
      >p</button>
      <button
        onClick={() => dispatch(PlayerState.pause(id))}
        className={playerState.state === "paused" ? "sp-state-paused" : ""}
      >a</button>
      <button
        onClick={() => dispatch(PlayerState.stop(id))}
        className={playerState.state === "stopped" ? "sp-state-stopped" : ""}
      >s</button>
    </div>
  );
}

function Column({ id, data }: { id: number; data: PlanItem[] }) {
  return (
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
    <div className="sp-col">
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
    if (result.destination!.droppableId[0] === "$") {
      // pseudo-channel
      return;
    }
    if (result.draggableId[0] === "T") {
      // this is a track from the CML
      const data = CML_CACHE[result.draggableId];
      const newItem: TimeslotItem = {
        type: "central",
        timeslotitemid: "CHANGEME",
        channel: parseInt(result.destination!.droppableId, 10),
        weight: result.destination!.index,
        ...data
      };
      dispatch(addItem(timeslotId, newItem));
    } else {
      // this is a normal move (ghosts aren't draggable)
      dispatch(
        moveItem(timeslotId, result.draggableId, [
          parseInt(result.destination!.droppableId, 10),
          result.destination!.index
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
      <h1>baps3 ayy lmao</h1>
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
          <LibraryColumn />
        </DragDropContext>
      </div>

      <ContextMenu id={TS_ITEM_MENU_ID}>
        <MenuItem onClick={onCtxRemoveClick}>Remove</MenuItem>
      </ContextMenu>
    </div>
  );
};

export default Showplanner;
