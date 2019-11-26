import { TimeslotItem, Track, Showplan } from "../api";
import * as api from "../api";
import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { AppThunk } from "../store";
import { cloneDeep } from "lodash";

export interface ItemGhost {
  title: string;
  ghostid: string;
  channel: number;
  weight: number;
}

export type PlanItem = TimeslotItem | ItemGhost;

export type Plan = PlanItem[][];

export function itemId(item: PlanItem | Track) {
  if ("timeslotitemid" in item) {
    return item.timeslotitemid;
  }
  if ("ghostid" in item) {
    return "G" + item.ghostid;
  }
  if ("trackid" in item) {
    return "T" + item.album.recordid + "-" + item.trackid;
  }
  throw new Error();
}

interface ShowplanState {
  planLoading: boolean;
  planLoadError: string | null;
  plan: null | PlanItem[];
  planSaving: boolean;
  planSaveError: string | null;
}

const initialState: ShowplanState = {
  planLoading: true,
  planLoadError: null,
  plan: null,
  planSaving: false,
  planSaveError: null
};

const showplan = createSlice({
  name: "showplan",
  initialState,
  reducers: {
    getShowplanStarting(state, action) {
      state.planLoadError = null;
      state.planLoading = true;
    },
    getShowplanSuccess(state, action: PayloadAction<PlanItem[]>) {
      state.plan = action.payload;
      state.planLoading = false;
    },
    getShowplanError(state, action: PayloadAction<string>) {
      state.planLoading = false;
      state.planLoadError = action.payload;
    },
    setPlanSaving(state, action: PayloadAction<boolean>) {
      state.planSaving = action.payload;
    },
    planSaveError(state, action: PayloadAction<string>) {
      state.planSaving = false;
      state.planSaveError = action.payload;
    },
    applyOps(state, action: PayloadAction<api.UpdateOp[]>) {
      if (!state.plan) {
        return;
      }
      action.payload.forEach(op => {
        switch (op.op) {
          case "MoveItem":
            const item = state.plan!.find(
              x => itemId(x) === op.timeslotitemid
            )!;
            item.channel = op.channel;
            item.weight = op.weight;
            break;
          default:
            throw new Error();
        }
      });
    }
  }
});

export default showplan.reducer;

export const moveItem = (
  timeslotid: number,
  itemid: string,
  to: [number, number]
): AppThunk => async (dispatch, getState) => {
  // Make a copy of the plan, because we are about to engage in FUCKERY.
  const plan = cloneDeep(getState().showplan.plan!);
  const itemToMove = plan.find(x => itemId(x) === itemid)!;
  if (itemToMove.channel === to[0] && itemToMove.weight === to[1]) {
    return;
  }
  console.log(
    `Moving item ${itemId(itemToMove)} from ${itemToMove.channel}x${
      itemToMove.weight
    } to ${to[0]}x${to[1]}`
  );
  dispatch(showplan.actions.setPlanSaving(true));

  const oldChannel = itemToMove.channel;
  const oldWeight = itemToMove.weight;
  const [newChannel, newWeight] = to;

  const inc: string[] = [];
  const dec: string[] = [];

  if (oldChannel === newChannel) {
    // Moving around in the same channel
    const itemChan = plan
      .filter(x => x.channel === oldChannel)
      .sort((a, b) => a.weight - b.weight);
    if (oldWeight < newWeight) {
      // moved the item down (incremented) - everything in between needs decrementing
      for (let i = oldWeight + 1; i <= newWeight; i++) {
        dec.push(itemId(itemChan[i]));
        itemChan[i].weight -= 1;
      }
    } else {
      // moved the item up (decremented) - everything in between needs incrementing
      for (let i = newWeight; i < oldWeight; i++) {
        inc.push(itemId(itemChan[i]));
        itemChan[i].weight += 1;
      }
    }
    itemToMove.channel = newChannel;
    itemToMove.weight = newWeight;
  } else {
    // Moving between channels
    // So here's the plan.
    // We're going to temporarily remove the item we're actually moving from the plan
    // This is because its position becomes nondeterministic when we move it around.
    plan.splice(plan.indexOf(itemToMove), 1);
    itemToMove.channel = newChannel;
    itemToMove.weight = newWeight;

    // First, decrement everything between the old weight and the end of the old channel
    // (inclusive of old weight, because we've removed the item)
    const oldChannelData = plan
      .filter(x => x.channel === oldChannel)
      .sort((a, b) => a.weight - b.weight);
    for (let i = oldWeight; i < oldChannelData.length; i++) {
      const movingItem = oldChannelData[i];
      movingItem.weight -= 1;
      dec.push(itemId(movingItem));
    }

    // Then, increment everything between the new weight and the end of the new channel
    // (again, inclusive)
    const newChannelData = plan
      .filter(x => x.channel === newChannel)
      .sort((a, b) => a.weight - b.weight);
    for (let i = newWeight; i < newChannelData.length; i++) {
      const movingItem = newChannelData[i];
      movingItem.weight += 1;
      inc.push(itemId(movingItem));
    }
  }

  const ops: api.UpdateOp[] = [];
  console.log("Inc, dec:", inc, dec);

  inc.forEach(id => {
    const item = plan.find(x => itemId(x) === id)!;
    ops.push({
      op: "MoveItem",
      timeslotitemid: itemId(item),
      oldchannel: item.channel,
      oldweight: item.weight - 1,
      channel: item.channel,
      weight: item.weight
    });
  });

  dec.forEach(id => {
    const item = plan.find(x => itemId(x) === id)!;
    ops.push({
      op: "MoveItem",
      timeslotitemid: itemId(item),
      oldchannel: item.channel,
      oldweight: item.weight + 1,
      channel: item.channel,
      weight: item.weight
    });
  });

  // Then, and only then, put the item in its new place
  console.log("Moving over");
  ops.push({
    op: "MoveItem",
    timeslotitemid: (itemToMove as TimeslotItem).timeslotitemid,
    oldchannel: oldChannel,
    oldweight: oldWeight,
    channel: newChannel,
    weight: newWeight
  });

  console.log(
    "TL;DR of opset is\r\n" +
      ops
        .map(x => `${x.oldchannel}x${x.oldweight} -> ${x.channel}x${x.weight}`)
        .join(";\r\n")
  );

  dispatch(showplan.actions.applyOps(ops));
  const result = await api.updateShowplan(timeslotid, ops);
  if (!result.every(x => x.status)) {
    dispatch(showplan.actions.planSaveError("Server says no!"));
  } else {
    dispatch(showplan.actions.setPlanSaving(false));
  }
};

export const getShowplan = (timeslotId: number): AppThunk => async dispatch => {
  dispatch(showplan.actions.getShowplanStarting());
  try {
    const plan = await api.getShowplan(timeslotId);
    // Sanity check
    const ops: api.UpdateOp[] = [];

    for (let colIndex = 0; colIndex < plan.length; colIndex++) {
      // Sort the column
      plan[colIndex] = plan[colIndex].sort((a, b) => {
        const weightRes = a.weight - b.weight;
        if (weightRes !== 0) {
          return weightRes;
        }
        return parseInt(a.timeslotitemid, 10) - parseInt(b.timeslotitemid, 10);
      });
      // If anything is out of place, budge it over
      const col = plan[colIndex];
      for (let itemIndex = 0; itemIndex < col.length; itemIndex++) {
        const item = col[itemIndex];
        if (item.weight !== itemIndex) {
          // arse.
          ops.push({
            op: "MoveItem",
            timeslotitemid: item.timeslotitemid,
            oldchannel: colIndex,
            channel: colIndex,
            oldweight: item.weight,
            weight: itemIndex
          });
          plan[colIndex][itemIndex].weight = itemIndex;
        }
      }
    }

    if (ops.length > 0) {
      console.log("Repairing showplan", ops);
      const updateResult = await api.updateShowplan(timeslotId, ops);
      if (!updateResult.every(x => x.status)) {
        console.error("Repair failed!");
        dispatch(showplan.actions.getShowplanError("Repair failed!"));
        return;
      }
    }
    dispatch(showplan.actions.getShowplanSuccess(plan.flat(2)));
  } catch (e) {
    console.error(e);
    dispatch(showplan.actions.getShowplanError(e.toString()));
  }
};
