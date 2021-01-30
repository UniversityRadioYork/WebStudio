import React, { memo } from "react";
import { PlanItem, itemId, isTrack, isAux } from "./state";
import { Track, AuxItem } from "../api";
import { useDispatch, useSelector } from "react-redux";
import { RootState } from "../rootReducer";

import * as MixerState from "../mixer/state";
import { Draggable } from "react-beautiful-dnd";
import { contextMenu } from "react-contexify";
import "./item.scss";
import { HHMMTosec, secToHHMM } from "../lib/utils";

export const TS_ITEM_MENU_ID = "SongMenu";
export const TS_ITEM_AUX_ID = "AuxMenu";

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
      dispatch(MixerState.load(column, x));
    }
  }

  function openContextMenu(e: React.MouseEvent<HTMLDivElement, MouseEvent>) {
    e.preventDefault();
    if (isTrack(x)) {
      contextMenu.show({
        id: TS_ITEM_MENU_ID,
        event: e,
        props: {
          id,
          trackid: x.trackid,
          title: x.title,
          artist: x.artist,
        },
      });
    } else if (isAux(x)) {
      contextMenu.show({
        id: TS_ITEM_MENU_ID,
        event: e,
        props: {
          id,
          title: x.title,
        },
      });
    }
  }

  function generateTooltipData() {
    let data = ["Title: " + x.title.toString()];

    if ("artist" in x && x.artist !== "") data.push("Artist: " + x.artist);
    if ("album" in x && x.album.title !== "")
      data.push("Album: " + x.album.title);
    data.push("Length: " + x.length);
    if ("intro" in x)
      data.push(
        "Intro: " + (x.intro > 60 ? secToHHMM(x.intro) : x.intro + " secs")
      );
    if ("cue" in x)
      data.push("Cue: " + (x.cue > 60 ? secToHHMM(x.cue) : x.cue + " secs"));
    if ("outro" in x) {
      // Outro seconds are counted from end of track, except 0 = no outro;
      const outroSecs = x.outro === 0 ? 0 : HHMMTosec(x.length) - x.outro;
      data.push(
        "Outro: " +
          (outroSecs > 60 ? secToHHMM(outroSecs) : outroSecs + " secs")
      );
    }
    data.push("Played: " + ("played" in x ? (x.played ? "Yes" : "No") : "No"));
    data.push(
      "ID: " + ("trackid" in x ? x.trackid : "managedid" in x && x.managedid)
    );
    if (showDebug) {
      data.push(
        "Debug: itemId(): " +
          itemId(x) +
          " - Channel/weight: " +
          ("channel" in x && x.channel + "/" + x.weight)
      );
    }
    return data.join("¬"); // Something obscure to split against.
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
          onContextMenu={openContextMenu}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          data-tip={generateTooltipData()}
          data-for="track-hover-tooltip"
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
          {showDebug && (
            <code>
              {itemId(x)} {"channel" in x && x.channel + "/" + x.weight}
            </code>
          )}
        </div>
      )}
    </Draggable>
  );
});
