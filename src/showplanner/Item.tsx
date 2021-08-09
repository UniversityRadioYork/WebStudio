import React, { memo } from "react";
import {
  PlanItem,
  itemId,
  isTrack,
  isAux,
  selPlayedTrackAggregates,
} from "./state";
import { Track, AuxItem } from "../api";
import { useDispatch, useSelector } from "react-redux";
import { RootState } from "../rootReducer";

import * as MixerState from "../mixer/state";
import { Draggable } from "react-beautiful-dnd";
import { contextMenu } from "react-contexify";
import "./item.scss";
import { HHMMTosec, secToHHMM } from "../lib/utils";
import { PLAYER_ID_PREVIEW } from "../mixer/audio";

export const TS_ITEM_MENU_ID = "SongMenu";
export const TS_ITEM_AUX_ID = "AuxMenu";

const ONE_HOUR_MS = 1000 * 60 * 60;

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

  const partyMode = useSelector((state: RootState) => state.settings.partyMode);
  const showName =
    !partyMode || column > 2 || !isTrack(x) || ("playedAt" in x && x.playedAt);

  const {
    artists: playedArtists,
    recordIds: playedRecordids,
    trackIds: playedTracks,
  } = useSelector(selPlayedTrackAggregates)!;

  function triggerClick() {
    if (column > -1) {
      dispatch(MixerState.load(column, x));
    }
  }

  function openContextMenu(e: React.MouseEvent<HTMLDivElement, MouseEvent>) {
    e.preventDefault();
    if (column === PLAYER_ID_PREVIEW) return; // Don't let people right click in the library.
    if (isTrack(x)) {
      contextMenu.show({
        id: TS_ITEM_MENU_ID,
        event: e,
        props: {
          id,
          trackid: x.trackid,
          title: x.title,
          artist: x.artist,
          item: x,
        },
      });
    } else if (isAux(x)) {
      contextMenu.show({
        id: TS_ITEM_MENU_ID,
        event: e,
        props: {
          id,
          title: x.title,
          item: x,
        },
      });
    }
  }

  const now = new Date().valueOf();
  let alreadyPlayedTrack = false,
    alreadyPlayedArtist = false,
    alreadyPlayedAlbum = false;
  if (isTrack(x)) {
    if (now - (playedTracks.get(x.trackid) || 0) < ONE_HOUR_MS) {
      alreadyPlayedTrack = true;
    }
    if (now - (playedArtists.get(x.artist) || 0) < ONE_HOUR_MS) {
      alreadyPlayedArtist = true;
    }
    if (now - (playedRecordids.get(x.album.recordid) || 0) < ONE_HOUR_MS) {
      alreadyPlayedAlbum = true;
    }
  }
  const alreadyPlayedClass = alreadyPlayedTrack
    ? "warn-red"
    : alreadyPlayedArtist || alreadyPlayedAlbum
    ? "warn-orange"
    : "";

  function generateTooltipData() {
    let data = [];
    if (partyMode) {
      data.push("Title: 🎉🎉🎉PARTY MODE🎉🎉🎉");
    } else {
      data.push("Title: " + x.title.toString());

      if ("artist" in x && x.artist !== "") data.push("Artist: " + x.artist);
      if ("album" in x && x.album.title !== "")
        data.push("Album: " + x.album.title);
    }
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
    data.push(
      "Played: " + ("playedAt" in x ? (x.playedAt ? "Yes" : "No") : "No")
    );
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
    if (alreadyPlayedTrack) {
      data.push("Warning: Already played in the last hour!");
    } else if (alreadyPlayedArtist) {
      data.push("Warning: Song by same artist played in last hour!");
    } else if (alreadyPlayedAlbum) {
      data.push("Warning: Song on same album played in past hour!");
    }
    return data.join("¬"); // Something obscure to split against.
  }

  return (
    <Draggable draggableId={id} index={index} isDragDisabled={isGhost}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          key={id}
          data-itemid={id}
          className={
            "item " +
            ("playedAt" in x ? (x.playedAt ? "played " : "") : "") +
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
          <span className={"icon " + x.type + " " + alreadyPlayedClass} />
          &nbsp;
          {showName && (
            <>
              {x.title.toString()}
              {"artist" in x && x.artist !== "" && " - " + x.artist}
            </>
          )}
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
