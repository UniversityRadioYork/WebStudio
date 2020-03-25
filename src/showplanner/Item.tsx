import React, { memo } from "react";
import { PlanItem, itemId } from "./state";
import { Track, AuxItem } from "../api";
import { useDispatch, useSelector } from "react-redux";
import { RootState } from "../rootReducer";

import * as MixerState from "../mixer/state";
import { Draggable } from "react-beautiful-dnd";
import { ContextMenuTrigger } from "react-contextmenu";

export const TS_ITEM_MENU_ID = "SongMenu";

export const Item = memo(function Item({
  item: x,
  index,
  column
}: {
  item: PlanItem | Track | AuxItem;
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
                "clean" in x && x.clean === false ? "" : " d-none")}>
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
