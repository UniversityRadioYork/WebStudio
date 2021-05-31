import React, { memo } from "react";
import { PlanItem, itemId } from "./state";
import { Track, AuxItem } from "../api";
import { useDispatch, useSelector } from "react-redux";
import { RootState } from "../rootReducer";

import * as MixerState from "../mixer/state";
import { Draggable } from "react-beautiful-dnd";
import { ContextMenuTrigger } from "react-contextmenu";
import "./item.scss";
import { sendBAPSicleChannel } from "../bapsicle";

export const TS_ITEM_MENU_ID = "SongMenu";

export const Item = memo(function Item({
  item: x,
  index,
  column,
}: {
  item: PlanItem | Track | AuxItem;
  index: number;
  column: number;
}) {
  const dispatch = useDispatch();
  const id = itemId(x);
  const isReal = "timeslotitemid" in x;
  const isGhost = "ghostid" in x;

  const loadedItem = useSelector(
    (state: RootState) =>
      column > -1 ? state.mixer.players[column]?.loadedItem : null,
    (a, b) =>
      (a === null && b === null) ||
      (a !== null && b !== null && itemId(a) === itemId(b))
  );

  const isLoaded = loadedItem !== null ? itemId(loadedItem) === id : false;

  const showDebug = useSelector(
    (state: RootState) => state.settings.showDebugInfo
  );

  function triggerClick() {
    if (column > -1) {
      console.log("Clicking to load:", x);

      if (process.env.REACT_APP_BAPSICLE_INTERFACE) {
        sendBAPSicleChannel({
          channel: column,
          command: "LOAD",
          weight: index,
        });
        return;
      }
      dispatch(MixerState.load(column, x));
    }
  }

  let isDragDisabled = isGhost;

  if (!process.env.REACT_APP_BAPSICLE_INTERFACE) {
    isDragDisabled = isDragDisabled || isLoaded;
  }
  return (
    <Draggable draggableId={id} index={index} isDragDisabled={isDragDisabled}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          key={id}
          data-itemid={id}
          className={
            "item " +
            ("played" in x ? (x.played ? "played " : "") : "") +
            x.type +
            `${column >= 0 && isLoaded ? " active" : ""}`
          }
          onClick={triggerClick}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
        >
          <ContextMenuTrigger
            id={isReal ? TS_ITEM_MENU_ID : ""}
            collect={() => ({ id, column, index })}
          >
            <span className={"icon " + x.type} />
            &nbsp;
            {"play_count" in x && (
              <>
                <code>{x.play_count}</code>&nbsp;
              </>
            )}
            {x.title.toString()}
            {"artist" in x &&
              x.artist !== "" &&
              x.artist !== null &&
              " - " + x.artist}
            <small
              className={
                "border rounded border-danger text-danger p-1 m-1" +
                ("clean" in x && x.clean === false ? "" : " d-none")
              }
            >
              Explicit
            </small>
            {showDebug && (
              <code>
                {itemId(x)} {"channel" in x && x.channel + "/" + x.weight}
              </code>
            )}
          </ContextMenuTrigger>
        </div>
      )}
    </Draggable>
  );
});
