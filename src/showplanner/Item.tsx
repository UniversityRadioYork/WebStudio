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

  function triggerClick() {
    if (column > -1) {
      sendBAPSicleChannel({
        channel: column,
        command: "LOAD",
        weight: index,
      });
      console.log("Clicking to load:", x);
      dispatch(MixerState.load(column, x));
    }
  }

  return (
    <Draggable
      draggableId={id}
      index={index}
      isDragDisabled={isGhost || isLoaded}
    >
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
            {x.title.toString()}
            {"artist" in x && x.artist !== "" && " - " + x.artist}
            <small
              className={
                "border rounded border-danger text-danger p-1 m-1" +
                ("clean" in x && x.clean === false ? "" : " d-none")
              }
            >
              Explicit
            </small>
            <code>{x.type.toString()}</code>
          </ContextMenuTrigger>
        </div>
      )}
    </Draggable>
  );
});
