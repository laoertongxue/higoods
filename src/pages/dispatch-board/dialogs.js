import { state } from './context.ts';
export function isDispatchBoardDialogOpen() {
    return Boolean(state.dispatchDialogTaskIds ||
        state.createTenderTaskId ||
        state.viewTenderTaskId ||
        state.priceSnapshotTaskId);
}
