import { appStore } from '../../state/store.ts'
import type { PrintDocumentBuildInput } from '../../data/fcs/print-service.ts'
import { renderUnifiedPrintPreviewPage } from './print-preview.ts'

export const TASK_DELIVERY_CARD_PRINT_ENTRY_LABEL = '任务交货卡'

function decodeParam(value: string): string {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

function getCurrentPrintSearchParams(): URLSearchParams {
  const pathname = appStore.getState().pathname
  const [, query] = pathname.split('?')
  return new URLSearchParams(query ?? '')
}

function resolveHandoverRecordId(handoverRecordIdParam?: string): string {
  if (handoverRecordIdParam) return decodeParam(handoverRecordIdParam)
  return getCurrentPrintSearchParams().get('handoverRecordId') || ''
}

export function renderTaskDeliveryCardPrintPage(_handoverOrderIdParam?: string, handoverRecordIdParam?: string): string {
  const handoverRecordId = resolveHandoverRecordId(handoverRecordIdParam)
  const input: Partial<PrintDocumentBuildInput> = {
    documentType: 'TASK_DELIVERY_CARD',
    sourceType: 'HANDOVER_RECORD',
    sourceId: handoverRecordId,
    handoverRecordId,
  }
  return renderUnifiedPrintPreviewPage(input)
}
