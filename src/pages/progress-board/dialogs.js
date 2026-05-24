import { state } from './context.ts';
export function isProgressBoardDialogOpen() {
    return Boolean(state.detailTaskId || state.detailOrderId || state.blockDialogTaskId || state.confirmDialogType);
}
