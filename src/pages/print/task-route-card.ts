import type { PrintSourceType } from '../../data/fcs/print-service.ts'
import { appStore } from '../../state/store.ts'
import { renderUnifiedPrintPreviewPage } from './print-preview.ts'

function decodeParam(value: string): string {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

function resolveSourceParams(sourceTypeParam?: string, sourceIdParam?: string): {
  sourceType: string
  sourceId: string
} {
  const pathname = appStore.getState().pathname
  const [, query] = pathname.split('?')
  const params = new URLSearchParams(query ?? '')
  return {
    sourceType: sourceTypeParam ? decodeParam(sourceTypeParam) : params.get('sourceType') || '',
    sourceId: sourceIdParam ? decodeParam(sourceIdParam) : params.get('sourceId') || '',
  }
}

export function renderTaskRouteCardPrintPage(sourceTypeParam?: string, sourceIdParam?: string): string {
  const { sourceType, sourceId } = resolveSourceParams(sourceTypeParam, sourceIdParam)
  return renderUnifiedPrintPreviewPage({
    documentType: 'TASK_ROUTE_CARD',
    sourceType: sourceType as PrintSourceType,
    sourceId,
  })
}
