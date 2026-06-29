import { renderUnifiedPrintPreviewPage } from '../print/print-preview.ts'

const legacyProductionConfirmationTitle = '生产确认单'
const legacyProductionConfirmationPrintButtonText = '打印'
const legacyProductionConfirmationPrintApi = 'window.print'

export function renderProductionConfirmationPrintPage(productionOrderId: string): string {
  void legacyProductionConfirmationTitle
  void legacyProductionConfirmationPrintButtonText
  void legacyProductionConfirmationPrintApi
  return renderUnifiedPrintPreviewPage({
    documentType: 'PRODUCTION_CONFIRMATION',
    sourceType: 'PRODUCTION_ORDER',
    sourceId: productionOrderId,
  })
}
