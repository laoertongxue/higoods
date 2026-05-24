import { appStore } from '../../state/store.ts';
import { renderUnifiedPrintPreviewPage } from './print-preview.ts';
function decodeParam(value) {
    try {
        return decodeURIComponent(value);
    }
    catch {
        return value;
    }
}
function resolveSourceParams(sourceTypeParam, sourceIdParam) {
    const pathname = appStore.getState().pathname;
    const [, query] = pathname.split('?');
    const params = new URLSearchParams(query ?? '');
    return {
        sourceType: sourceTypeParam ? decodeParam(sourceTypeParam) : params.get('sourceType') || '',
        sourceId: sourceIdParam ? decodeParam(sourceIdParam) : params.get('sourceId') || '',
    };
}
export function renderTaskRouteCardPrintPage(sourceTypeParam, sourceIdParam) {
    const { sourceType, sourceId } = resolveSourceParams(sourceTypeParam, sourceIdParam);
    return renderUnifiedPrintPreviewPage({
        documentType: 'TASK_ROUTE_CARD',
        sourceType: sourceType,
        sourceId,
    });
}
