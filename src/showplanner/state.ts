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
          case "AddItem":
            // no-op
            break;
          case "RemoveItem":
            const idx = state.plan!.findIndex(x => itemId(x) === op.timeslotitemid);
            if (idx < 0) {
              throw new Error();
            }
            state.plan!.splice(idx, 1);
            break;
          default:
            throw new Error();
        }
      });
    },
    insertGhost(state, action: PayloadAction<ItemGhost>) {
      state.plan!.push(action.payload);
    },
    addItem(state, action: PayloadAction<TimeslotItem>) {
      state.plan!.push(action.payload);
    },
    replaceGhost(
      state,
      action: PayloadAction<{ ghostId: string; newItemData: TimeslotItem }>
    ) {
      const idx = state.plan!.findIndex(
        x => itemId(x) === action.payload.ghostId
      );
      if (idx < 0) {
        throw new Error();
      }
      state.plan![idx] = action.payload.newItemData;
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
  ops.push({
    op: "MoveItem",
    timeslotitemid: (itemToMove as TimeslotItem).timeslotitemid,
    oldchannel: oldChannel,
    oldweight: oldWeight,
    channel: newChannel,
    weight: newWeight
  });

  dispatch(showplan.actions.applyOps(ops));
  // const result = await api.updateShowplan(timeslotid, ops);
  // if (!result.every(x => x.status)) {
  //   dispatch(showplan.actions.planSaveError("Server says no!"));
  // } else {
    dispatch(showplan.actions.setPlanSaving(false));
  // }
};

export const addItem = (
  timeslotId: number,
  newItemData: TimeslotItem
): AppThunk => async (dispatch, getState) => {
  const plan = cloneDeep(getState().showplan.plan!);
  const ops: api.UpdateOp[] = [];

  // This is basically a simplified version of the second case above
  // Before we add the new item to the plan, we increment everything below it
  const planColumn = plan
    .filter(x => x.channel === newItemData.channel)
    .sort((a, b) => a.weight - b.weight);
  for (let i = newItemData.weight; i < planColumn.length; i++) {
    const item = planColumn[i];
    ops.push({
      op: "MoveItem",
      timeslotitemid: itemId(item),
      oldchannel: item.channel,
      oldweight: item.weight,
      channel: item.channel,
      weight: item.weight + 1
    });
    item.weight += 1;
  }

  // Okay, we have a hole.
  // Now, we're going to insert a "ghost" item into the plan while we wait for it to save
  // Note that we're going to flush the move-over operations to Redux now, so that the hole
  // is there - then, once we get a timeslotitemid, replace it with a proper item
  //
  // TODO: no we won't, we'll just insert it directly
  dispatch(showplan.actions.applyOps(ops));
  dispatch(showplan.actions.addItem(newItemData));

  // const ghostId = Math.random().toString(10);
  // const newItemTitle =
  //   newItemData.type === "central"
  //     ? newItemData.artist + "-" + newItemData.title
  //     : newItemData.title;
  // const ghost: ItemGhost = {
  //   ghostid: ghostId,
  //   channel: newItemData.channel,
  //   weight: newItemData.weight,
  //   title: newItemTitle
  // };

  // const idForServer =
  //   newItemData.type === "central"
  //     ? `${newItemData.album.recordid}-${newItemData.trackid}`
  //     : `ManagedDB-${newItemData.auxid}`;

  // dispatch(showplan.actions.insertGhost(ghost));
  // ops.push({
  //   op: "AddItem",
  //   channel: newItemData.channel,
  //   weight: newItemData.weight,
  //   id: idForServer
  // });
  // const result = await api.updateShowplan(timeslotId, ops);
  // if (!result.every(x => x.status)) {
  //   dispatch(showplan.actions.planSaveError("Server says no!"));
  //   return;
  // }
  // const lastResult = result[result.length - 1]; // this is the add op
  // const newItemId = lastResult.timeslotitemid!;

  // newItemData.timeslotitemid = newItemId;
  // dispatch(
  //   showplan.actions.replaceGhost({
  //     ghostId: "G" + ghostId,
  //     newItemData
  //   })
  // );
};

export const removeItem = (
  timeslotId: number,
  itemid: string
): AppThunk => async (dispatch, getState) => {
  // This is a simplified version of the second case of moveItem
  const plan = cloneDeep(getState().showplan.plan!);
  const item = plan.find(x => itemId(x) === itemid)!;
  const planColumn = plan
    .filter(x => x.channel === item.channel)
    .sort((a, b) => a.weight - b.weight);

  const ops: api.UpdateOp[] = [];
  ops.push({
    op: "RemoveItem",
    timeslotitemid: itemid,
    channel: item.channel,
    weight: item.weight
  });
  planColumn.splice(planColumn.indexOf(item), 1);
  for (let i = item.weight; i < planColumn.length; i++) {
    const movingItem = planColumn[i];
    ops.push({
      op: "MoveItem",
      timeslotitemid: itemId(item),
      oldchannel: item.channel,
      oldweight: item.weight,
      channel: item.channel,
      weight: item.weight - 1
    });
    movingItem.weight -= 1;
  }

  // const result = await api.updateShowplan(timeslotId, ops);
  // if (!result.every(x => x.status)) {
  //   dispatch(showplan.actions.planSaveError("Server says no!"));
  //   return;
  // }
  dispatch(showplan.actions.applyOps(ops));
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
