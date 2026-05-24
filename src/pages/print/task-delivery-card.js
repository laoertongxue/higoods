import { appStore } from '../../state/store.ts';
import { renderUnifiedPrintPreviewPage } from './print-preview.ts';
export const TASK_DELIVERY_CARD_PRINT_ENTRY_LABEL = '任务交货卡';
function decodeParam(value) {
    try {
        return decodeURIComponent(value);
    }
    catch {
        return value;
    }
}
function getCurrentPrintSearchParams() {
    const pathname = appStore.getState().pathname;
    const [, query] = pathname.split('?');
    return new URLSearchParams(query ?? '');
}
function resolveHandoverRecordId(handoverRecordIdParam) {
    if (handoverRecordIdParam)
        return decodeParam(handoverRecordIdParam);
    return getCurrentPrintSearchParams().get('handoverRecordId') || '';
}
export function renderTaskDeliveryCardPrintPage(_handoverOrderIdParam, handoverRecordIdParam) {
    const handoverRecordId = resolveHandoverRecordId(handoverRecordIdParam);
    const input = {
        documentType: 'TASK_DELIVERY_CARD',
        sourceType: 'HANDOVER_RECORD',
        sourceId: handoverRecordId,
        handoverRecordId,
    };
    return renderUnifiedPrintPreviewPage(input);
}
