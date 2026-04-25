import { renderUnifiedPrintPreviewPage } from '../print/print-preview.ts'

const legacyProductionConfirmationTitle = '生产确认单'

export function renderProductionConfirmationPrintPage(productionOrderId: string): string {
  void legacyProductionConfirmationTitle
  return renderUnifiedPrintPreviewPage({
    documentType: 'PRODUCTION_CONFIRMATION',
    sourceType: 'PRODUCTION_ORDER',
    sourceId: productionOrderId,
  })
}
