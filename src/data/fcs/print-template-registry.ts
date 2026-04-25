import type {
  PrintDocument,
  PrintDocumentBuildInput,
  PrintDocumentType,
  PrintSourceType,
} from './print-service.ts'
import {
  buildCuttingMergeBatchRouteCardPrintDocument,
  buildCuttingOriginalOrderRouteCardPrintDocument,
  buildDyeingWorkOrderRouteCardPrintDocument,
  buildLegacyTaskRouteCardPrintDocument,
  buildPrintingWorkOrderRouteCardPrintDocument,
  buildRuntimeTaskRouteCardPrintDocument,
  buildSpecialCraftTaskOrderRouteCardPrintDocument,
  renderTaskRouteCardTemplate,
} from '../../pages/print/templates/task-route-card-template.ts'
import {
  buildPostFinishingRouteCardPrintDocument,
  renderPostFinishingRouteCardTemplate,
} from '../../pages/print/templates/post-finishing-route-card-template.ts'
import {
  buildTaskDeliveryCardPrintDocument,
  renderTaskDeliveryCardTemplate,
} from '../../pages/print/templates/task-delivery-card-template.ts'
import {
  buildIssueSlipPrintDocument,
  buildMaterialPrepSlipPrintDocument,
  buildPickupSlipPrintDocument,
  buildSupplementMaterialSlipPrintDocument,
  renderMaterialSlipTemplate,
} from '../../pages/print/templates/material-slip-template.ts'
import {
  buildCuttingOrderQrLabelPrintDocument,
  buildFeiTicketLabelPrintDocument,
  buildFeiTicketReprintLabelPrintDocument,
  buildFeiTicketVoidLabelPrintDocument,
  buildHandoverQrLabelPrintDocument,
  buildTransferBagLabelPrintDocument,
  renderLabelPrintTemplate,
} from '../../pages/print/templates/label-print-template.ts'
import {
  buildMakeGoodsConfirmationPrintDocument,
  buildProductionConfirmationPrintDocument,
  renderMakeGoodsConfirmationTemplate,
  renderProductionConfirmationTemplate,
} from '../../pages/print/templates/production-material-confirmation-template.ts'
import {
  buildHandoverDifferenceRequestPrintDocument,
  buildMasterDataChangeRequestPrintDocument,
  buildQualityDeductionConfirmationPrintDocument,
  buildQualityDisputeProcessingPrintDocument,
  buildSettlementChangeRequestPrintDocument,
  renderHandoverDifferenceRequestTemplate,
  renderMasterDataChangeRequestTemplate,
  renderQualityDeductionConfirmationTemplate,
  renderQualityDisputeProcessingTemplate,
  renderSettlementChangeRequestTemplate,
} from '../../pages/print/templates/business-request-form-template.ts'

export interface PrintTemplateRegistration {
  templateCode: string
  templateName: string
  documentType: PrintDocumentType
  supportedSourceTypes: PrintSourceType[]
  buildDocument: (input: PrintDocumentBuildInput) => PrintDocument
  render: (document: PrintDocument) => string
}

export const printTemplateRegistry: PrintTemplateRegistration[] = [
  {
    templateCode: 'SETTLEMENT_CHANGE_REQUEST',
    templateName: '结算信息变更申请单',
    documentType: 'SETTLEMENT_CHANGE_REQUEST',
    supportedSourceTypes: ['SETTLEMENT_CHANGE_REQUEST_RECORD'],
    buildDocument: buildSettlementChangeRequestPrintDocument,
    render: renderSettlementChangeRequestTemplate,
  },
  {
    templateCode: 'HANDOVER_DIFFERENCE_REQUEST',
    templateName: '差异处理申请单',
    documentType: 'HANDOVER_DIFFERENCE_REQUEST',
    supportedSourceTypes: ['HANDOVER_DIFFERENCE_RECORD'],
    buildDocument: buildHandoverDifferenceRequestPrintDocument,
    render: renderHandoverDifferenceRequestTemplate,
  },
  {
    templateCode: 'QUALITY_DEDUCTION_CONFIRMATION',
    templateName: '质量扣款确认单',
    documentType: 'QUALITY_DEDUCTION_CONFIRMATION',
    supportedSourceTypes: ['QUALITY_DEDUCTION_PENDING_RECORD'],
    buildDocument: buildQualityDeductionConfirmationPrintDocument,
    render: renderQualityDeductionConfirmationTemplate,
  },
  {
    templateCode: 'QUALITY_DISPUTE_PROCESSING',
    templateName: '质量异议处理单',
    documentType: 'QUALITY_DISPUTE_PROCESSING',
    supportedSourceTypes: ['QUALITY_DISPUTE_RECORD'],
    buildDocument: buildQualityDisputeProcessingPrintDocument,
    render: renderQualityDisputeProcessingTemplate,
  },
  {
    templateCode: 'MASTER_DATA_CHANGE_REQUEST',
    templateName: '资料变更申请单',
    documentType: 'MASTER_DATA_CHANGE_REQUEST',
    supportedSourceTypes: ['MASTER_DATA_CHANGE_REQUEST_RECORD'],
    buildDocument: buildMasterDataChangeRequestPrintDocument,
    render: renderMasterDataChangeRequestTemplate,
  },
  {
    templateCode: 'PRODUCTION_CONFIRMATION',
    templateName: '生产确认单',
    documentType: 'PRODUCTION_CONFIRMATION',
    supportedSourceTypes: ['PRODUCTION_ORDER'],
    buildDocument: buildProductionConfirmationPrintDocument,
    render: renderProductionConfirmationTemplate,
  },
  {
    templateCode: 'MAKE_GOODS_CONFIRMATION',
    templateName: '做货确认单',
    documentType: 'MAKE_GOODS_CONFIRMATION',
    supportedSourceTypes: ['PRODUCTION_ORDER'],
    buildDocument: buildMakeGoodsConfirmationPrintDocument,
    render: renderMakeGoodsConfirmationTemplate,
  },
  {
    templateCode: 'FEI_TICKET_LABEL',
    templateName: '菲票标签',
    documentType: 'FEI_TICKET_LABEL',
    supportedSourceTypes: ['FEI_TICKET_RECORD'],
    buildDocument: buildFeiTicketLabelPrintDocument,
    render: renderLabelPrintTemplate,
  },
  {
    templateCode: 'FEI_TICKET_REPRINT_LABEL',
    templateName: '菲票补打标签',
    documentType: 'FEI_TICKET_REPRINT_LABEL',
    supportedSourceTypes: ['FEI_TICKET_RECORD'],
    buildDocument: buildFeiTicketReprintLabelPrintDocument,
    render: renderLabelPrintTemplate,
  },
  {
    templateCode: 'FEI_TICKET_VOID_LABEL',
    templateName: '菲票作废标识',
    documentType: 'FEI_TICKET_VOID_LABEL',
    supportedSourceTypes: ['FEI_TICKET_RECORD'],
    buildDocument: buildFeiTicketVoidLabelPrintDocument,
    render: renderLabelPrintTemplate,
  },
  {
    templateCode: 'TRANSFER_BAG_LABEL',
    templateName: '中转袋 / 周转口袋 / 周转箱二维码',
    documentType: 'TRANSFER_BAG_LABEL',
    supportedSourceTypes: ['TRANSFER_BAG_RECORD'],
    buildDocument: buildTransferBagLabelPrintDocument,
    render: renderLabelPrintTemplate,
  },
  {
    templateCode: 'CUTTING_ORDER_QR_LABEL',
    templateName: '裁片单二维码',
    documentType: 'CUTTING_ORDER_QR_LABEL',
    supportedSourceTypes: ['CUTTING_ORDER_RECORD'],
    buildDocument: buildCuttingOrderQrLabelPrintDocument,
    render: renderLabelPrintTemplate,
  },
  {
    templateCode: 'HANDOVER_QR_LABEL',
    templateName: '交出记录二维码',
    documentType: 'HANDOVER_QR_LABEL',
    supportedSourceTypes: ['HANDOVER_RECORD'],
    buildDocument: buildHandoverQrLabelPrintDocument,
    render: renderLabelPrintTemplate,
  },
  {
    templateCode: 'MATERIAL_PREP_SLIP',
    templateName: '配料单',
    documentType: 'MATERIAL_PREP_SLIP',
    supportedSourceTypes: ['MATERIAL_PREP_RECORD'],
    buildDocument: buildMaterialPrepSlipPrintDocument,
    render: renderMaterialSlipTemplate,
  },
  {
    templateCode: 'PICKUP_SLIP',
    templateName: '领料单',
    documentType: 'PICKUP_SLIP',
    supportedSourceTypes: ['PICKUP_SLIP_RECORD'],
    buildDocument: buildPickupSlipPrintDocument,
    render: renderMaterialSlipTemplate,
  },
  {
    templateCode: 'ISSUE_SLIP',
    templateName: '发料单',
    documentType: 'ISSUE_SLIP',
    supportedSourceTypes: ['ISSUE_SLIP_RECORD'],
    buildDocument: buildIssueSlipPrintDocument,
    render: renderMaterialSlipTemplate,
  },
  {
    templateCode: 'SUPPLEMENT_MATERIAL_SLIP',
    templateName: '补料单',
    documentType: 'SUPPLEMENT_MATERIAL_SLIP',
    supportedSourceTypes: ['SUPPLEMENT_MATERIAL_RECORD'],
    buildDocument: buildSupplementMaterialSlipPrintDocument,
    render: renderMaterialSlipTemplate,
  },
  {
    templateCode: 'TASK_DELIVERY_CARD',
    templateName: '任务交货卡',
    documentType: 'TASK_DELIVERY_CARD',
    supportedSourceTypes: ['HANDOVER_RECORD'],
    buildDocument: buildTaskDeliveryCardPrintDocument,
    render: renderTaskDeliveryCardTemplate,
  },
  {
    templateCode: 'POST_FINISHING_ROUTE_CARD',
    templateName: '后道任务流转卡',
    documentType: 'TASK_ROUTE_CARD',
    supportedSourceTypes: ['POST_FINISHING_WORK_ORDER'],
    buildDocument: buildPostFinishingRouteCardPrintDocument,
    render: renderPostFinishingRouteCardTemplate,
  },
  {
    templateCode: 'TASK_ROUTE_CARD',
    templateName: '任务流转卡通用模板',
    documentType: 'TASK_ROUTE_CARD',
    supportedSourceTypes: [
      'RUNTIME_TASK',
      'PRINTING_WORK_ORDER',
      'DYEING_WORK_ORDER',
      'SPECIAL_CRAFT_TASK_ORDER',
      'CUTTING_ORIGINAL_ORDER',
      'CUTTING_MERGE_BATCH',
    ],
    buildDocument: buildLegacyTaskRouteCardPrintDocument,
    render: renderTaskRouteCardTemplate,
  },
  {
    templateCode: 'RUNTIME_TASK_ROUTE_CARD',
    templateName: '通用任务流转卡',
    documentType: 'TASK_ROUTE_CARD',
    supportedSourceTypes: ['RUNTIME_TASK'],
    buildDocument: buildRuntimeTaskRouteCardPrintDocument,
    render: renderTaskRouteCardTemplate,
  },
  {
    templateCode: 'PRINTING_WORK_ORDER_ROUTE_CARD',
    templateName: '印花任务流转卡',
    documentType: 'TASK_ROUTE_CARD',
    supportedSourceTypes: ['PRINTING_WORK_ORDER'],
    buildDocument: buildPrintingWorkOrderRouteCardPrintDocument,
    render: renderTaskRouteCardTemplate,
  },
  {
    templateCode: 'DYEING_WORK_ORDER_ROUTE_CARD',
    templateName: '染色任务流转卡',
    documentType: 'TASK_ROUTE_CARD',
    supportedSourceTypes: ['DYEING_WORK_ORDER'],
    buildDocument: buildDyeingWorkOrderRouteCardPrintDocument,
    render: renderTaskRouteCardTemplate,
  },
  {
    templateCode: 'SPECIAL_CRAFT_TASK_ORDER_ROUTE_CARD',
    templateName: '特殊工艺任务流转卡',
    documentType: 'TASK_ROUTE_CARD',
    supportedSourceTypes: ['SPECIAL_CRAFT_TASK_ORDER'],
    buildDocument: buildSpecialCraftTaskOrderRouteCardPrintDocument,
    render: renderTaskRouteCardTemplate,
  },
  {
    templateCode: 'CUTTING_ORIGINAL_ORDER_ROUTE_CARD',
    templateName: '原始裁片单任务流转卡',
    documentType: 'TASK_ROUTE_CARD',
    supportedSourceTypes: ['CUTTING_ORIGINAL_ORDER'],
    buildDocument: buildCuttingOriginalOrderRouteCardPrintDocument,
    render: renderTaskRouteCardTemplate,
  },
  {
    templateCode: 'CUTTING_MERGE_BATCH_ROUTE_CARD',
    templateName: '裁片批次任务流转卡',
    documentType: 'TASK_ROUTE_CARD',
    supportedSourceTypes: ['CUTTING_MERGE_BATCH'],
    buildDocument: buildCuttingMergeBatchRouteCardPrintDocument,
    render: renderTaskRouteCardTemplate,
  },
]

export function getPrintTemplateForRequest(input: PrintDocumentBuildInput): PrintTemplateRegistration | undefined {
  const matches = printTemplateRegistry.filter((template) =>
    template.documentType === input.documentType
    && template.supportedSourceTypes.includes(input.sourceType),
  )
  return matches.find((template) => template.templateCode !== 'TASK_ROUTE_CARD') || matches[0]
}

export function buildPrintDocument(input: PrintDocumentBuildInput): PrintDocument {
  const template = getPrintTemplateForRequest(input)
  if (!template) {
    throw new Error(`未找到打印模板：${input.documentType} / ${input.sourceType}`)
  }
  return template.buildDocument(input)
}

export function renderPrintDocument(document: PrintDocument): string {
  const template = printTemplateRegistry.find((item) => item.templateCode === document.templateCode)
  if (!template) {
    throw new Error(`未找到打印模板渲染器：${document.templateCode}`)
  }
  return template.render(document)
}

export const requiredPrintDocumentTypes: PrintDocumentType[] = [
  'TASK_ROUTE_CARD',
  'TASK_DELIVERY_CARD',
  'MATERIAL_PREP_SLIP',
  'PICKUP_SLIP',
  'ISSUE_SLIP',
  'SUPPLEMENT_MATERIAL_SLIP',
  'FEI_TICKET_LABEL',
  'FEI_TICKET_REPRINT_LABEL',
  'FEI_TICKET_VOID_LABEL',
  'TRANSFER_BAG_LABEL',
  'CUTTING_ORDER_QR_LABEL',
  'HANDOVER_QR_LABEL',
  'PRODUCTION_CONFIRMATION',
  'MAKE_GOODS_CONFIRMATION',
  'SETTLEMENT_CHANGE_REQUEST',
  'HANDOVER_DIFFERENCE_REQUEST',
  'QUALITY_DEDUCTION_CONFIRMATION',
  'QUALITY_DISPUTE_PROCESSING',
  'MASTER_DATA_CHANGE_REQUEST',
]

export function validatePrintTemplateRegistry(): string[] {
  const issues: string[] = []
  for (const documentType of requiredPrintDocumentTypes) {
    const templates = printTemplateRegistry.filter((template) => template.documentType === documentType)
    if (templates.length === 0) {
      issues.push(`缺少模板注册：${documentType}`)
      continue
    }
    for (const template of templates) {
      if (!template.templateCode) issues.push(`模板缺少编码：${documentType}`)
      if (!template.templateName || /^[A-Za-z0-9_ -]+$/.test(template.templateName)) {
        issues.push(`模板缺少中文名称：${template.templateCode}`)
      }
      if (template.supportedSourceTypes.length === 0) issues.push(`模板缺少来源类型：${template.templateCode}`)
      if (typeof template.buildDocument !== 'function') issues.push(`模板缺少文档构建函数：${template.templateCode}`)
      if (typeof template.render !== 'function') issues.push(`模板缺少渲染函数：${template.templateCode}`)
    }
  }
  return issues
}
