import { state } from './context';
export function isSettlementDialogOpen() {
    return state.dialog.type !== 'none';
}
