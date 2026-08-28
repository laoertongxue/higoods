import type {
  PrintDocument,
  PrintDocumentBuildInput,
  PrintDocumentType,
  PrintSourceType,
} from './print-service.ts'
import {
  buildCuttingMarkerPlanSourceRouteCardPrintDocument,
  buildCuttingCutOrderRouteCardPrintDocument,
  buildDyeingWorkOrderRouteCardPrintDocument,
  buildLegacyTaskRouteCardPrintDocument,
  buildPostFinishingTaskRouteCardPrintDocument,
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
  buildPostFinishingQcOrderPrintDocument,
  buildProductionQcMasterPrintDocument,
  renderPostFinishingQcPrintTemplate,
} from '../../pages/print/templates/post-finishing-qc-print-template.ts'
import {
  buildTaskDeliveryCardPrintDocument,
  renderTaskDeliveryCardTemplate,
} from '../../pages/print/templates/task-delivery-card-template.ts'
import {
  buildIssueSlipPrintDocument,
  buildMaterialPrepSlipPrintDocument,
  buildPickupSlipPrintDocument,
  renderMaterialSlipTemplate,
} from '../../pages/print/templates/material-slip-template.ts'
import {
  buildCuttingOrderQrLabelPrintDocument,
  buildFeiTicketLabelPrintDocument,
  buildFeiTicketReprintLabelPrintDocument,
  buildHandoverQrLabelPrintDocument,
  buildTransferBagGoodsLabelPrintDocument,
  buildTransferBagLabelPrintDocument,
  renderLabelPrintTemplate,
} from '../../pages/print/templates/label-print-template.ts'
import {
  buildProductionConfirmationPrintDocument,
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
import { renderDyeWorkOrderFlowCardTemplate } from '../../pages/print/templates/dye-work-order-flow-card-template.ts'
import { buildProductionContractPrintDocument, renderProductionContractTemplate } from '../../pages/print/templates/production-contract-template.ts'
import { PRODUCTION_CONTRACT_MASTER_TEMPLATE_CODE } from '../../pages/print/templates/production-contract-master-template.ts'
import {
  buildPrintingConfirmationDocument,
  buildPrintingInfoSheetDocument,
  buildPrintingRollLabelDocument,
  renderPrintingConfirmationDocument,
  renderPrintingInfoSheetDocument,
  renderPrintingRollLabelDocument,
} from '../../pages/print/templates/printing-work-order-template.ts'
import {
  buildGarmentSkuLabelPrintDocument,
  renderGarmentSkuLabelTemplate,
} from '../../pages/print/templates/garment-sku-label-template.ts'
import {
  buildPostFinishingOutboundBarcodePrintDocument,
  buildPostFinishingOutboundOrderPrintDocument,
  renderPostFinishingOutboundBarcodeTemplate,
  renderPostFinishingOutboundOrderTemplate,
} from '../../pages/print/templates/post-finishing-outbound-template.ts'

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
    templateCode: 'POST_FINISHING_OUTBOUND_ORDER_V1',
    templateName: '后道出货单',
    documentType: 'POST_FINISHING_OUTBOUND_ORDER',
    supportedSourceTypes: ['POST_FINISHING_OUTBOUND_ORDER'],
    buildDocument: buildPostFinishingOutboundOrderPrintDocument,
    render: renderPostFinishingOutboundOrderTemplate,
  },
  {
    templateCode: 'POST_FINISHING_OUTBOUND_BARCODE_V1',
    templateName: '后道出货单 SKU 条码',
    documentType: 'POST_FINISHING_OUTBOUND_BARCODE',
    supportedSourceTypes: ['POST_FINISHING_OUTBOUND_ORDER'],
    buildDocument: buildPostFinishingOutboundBarcodePrintDocument,
    render: renderPostFinishingOutboundBarcodeTemplate,
  },
  {
    templateCode: 'GARMENT_SKU_BARCODE_V2',
    templateName: '成衣 SKU 条码',
    documentType: 'GARMENT_SKU_BARCODE',
    supportedSourceTypes: ['PRODUCTION_ORDER', 'GARMENT_WAREHOUSE_RELABEL_TASK'],
    buildDocument: buildGarmentSkuLabelPrintDocument,
    render: renderGarmentSkuLabelTemplate,
  },
  {
    templateCode: 'GARMENT_HANGTAG_V2',
    templateName: '成衣吊牌',
    documentType: 'GARMENT_HANGTAG',
    supportedSourceTypes: ['PRODUCTION_ORDER', 'GARMENT_WAREHOUSE_RELABEL_TASK'],
    buildDocument: buildGarmentSkuLabelPrintDocument,
    render: renderGarmentSkuLabelTemplate,
  },
  {
    templateCode: 'PRINTING_INFO_SHEET_V2',
    templateName: '印花信息单',
    documentType: 'PRINTING_INFO_SHEET',
    supportedSourceTypes: ['PRINTING_WORK_ORDER'],
    buildDocument: buildPrintingInfoSheetDocument,
    render: renderPrintingInfoSheetDocument,
  },
  {
    templateCode: 'PRINTING_CONFIRMATION_V2',
    templateName: '印花确认单',
    documentType: 'PRINTING_CONFIRMATION',
    supportedSourceTypes: ['PRINTING_WORK_ORDER'],
    buildDocument: buildPrintingConfirmationDocument,
    render: renderPrintingConfirmationDocument,
  },
  {
    templateCode: 'PRINTING_ROLL_LABEL_V2',
    templateName: '加工产出卷条码',
    documentType: 'PRINTING_ROLL_LABEL',
    supportedSourceTypes: ['PRINTING_ROLL_RECORD'],
    buildDocument: buildPrintingRollLabelDocument,
    render: renderPrintingRollLabelDocument,
  },
  {
    templateCode: PRODUCTION_CONTRACT_MASTER_TEMPLATE_CODE,
    templateName: 'SPK & Komitmen Jadwal Pengembalian',
    documentType: 'PRODUCTION_CONTRACT',
    supportedSourceTypes: ['PRODUCTION_CONTRACT_RECORD'],
    buildDocument: buildProductionContractPrintDocument,
    render: renderProductionContractTemplate,
  },
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
    templateCode: 'FEI_TICKET_WHITE_THERMAL',
    templateName: '普通部位菲票白色热敏纸模板',
    documentType: 'FEI_TICKET_LABEL',
    supportedSourceTypes: ['FEI_TICKET_RECORD'],
    buildDocument: buildFeiTicketLabelPrintDocument,
    render: renderLabelPrintTemplate,
  },
  {
    templateCode: 'FEI_TICKET_YELLOW_THERMAL',
    templateName: '特殊工艺部位菲票黄色热敏纸模板',
    documentType: 'FEI_TICKET_LABEL',
    supportedSourceTypes: ['FEI_TICKET_RECORD'],
    buildDocument: buildFeiTicketLabelPrintDocument,
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
    templateCode: 'TRANSFER_BAG_GOODS_LABEL',
    templateName: '中转袋货物标识（100mm × 100mm 黑白热敏）',
    documentType: 'TRANSFER_BAG_GOODS_LABEL',
    supportedSourceTypes: ['TRANSFER_BAG_USAGE_RECORD'],
    buildDocument: buildTransferBagGoodsLabelPrintDocument,
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
    templateName: '接收单',
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
    templateCode: 'POST_FINISHING_TASK_ROUTE_CARD',
    templateName: '后道任务流转卡',
    documentType: 'TASK_ROUTE_CARD',
    supportedSourceTypes: ['POST_FINISHING_TASK'],
    buildDocument: buildPostFinishingTaskRouteCardPrintDocument,
    render: renderTaskRouteCardTemplate,
  },
  {
    templateCode: 'PRODUCTION_QC_MASTER',
    templateName: '生产单质检总单',
    documentType: 'PRODUCTION_QC_MASTER',
    supportedSourceTypes: ['POST_FINISHING_TASK'],
    buildDocument: buildProductionQcMasterPrintDocument,
    render: renderPostFinishingQcPrintTemplate,
  },
  {
    templateCode: 'POST_FINISHING_QC_ORDER',
    templateName: '质检单',
    documentType: 'POST_FINISHING_QC_ORDER',
    supportedSourceTypes: ['POST_FINISHING_QC_ORDER'],
    buildDocument: buildPostFinishingQcOrderPrintDocument,
    render: renderPostFinishingQcPrintTemplate,
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
      'CUTTING_ORDER',
      'CUTTING_MARKER_PLAN',
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
    templateCode: 'DYEING_WORK_ORDER_FLOW_CARD',
    templateName: '染整生产流程卡',
    documentType: 'TASK_ROUTE_CARD',
    supportedSourceTypes: ['DYEING_WORK_ORDER'],
    buildDocument: buildDyeingWorkOrderRouteCardPrintDocument,
    render: renderDyeWorkOrderFlowCardTemplate,
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
    templateCode: 'CUTTING_ORDER_ROUTE_CARD',
    templateName: '裁片单任务流转卡',
    documentType: 'TASK_ROUTE_CARD',
    supportedSourceTypes: ['CUTTING_ORDER'],
    buildDocument: buildCuttingCutOrderRouteCardPrintDocument,
    render: renderTaskRouteCardTemplate,
  },
  {
    templateCode: 'CUTTING_MARKER_PLAN_ROUTE_CARD',
    templateName: '唛架方案任务流转卡',
    documentType: 'TASK_ROUTE_CARD',
    supportedSourceTypes: ['CUTTING_MARKER_PLAN'],
    buildDocument: buildCuttingMarkerPlanSourceRouteCardPrintDocument,
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
  'POST_FINISHING_OUTBOUND_ORDER',
  'POST_FINISHING_OUTBOUND_BARCODE',
  'GARMENT_SKU_BARCODE',
  'GARMENT_HANGTAG',
  'PRODUCTION_CONTRACT',
  'PRINTING_INFO_SHEET',
  'PRINTING_CONFIRMATION',
  'PRINTING_ROLL_LABEL',
  'TASK_ROUTE_CARD',
  'TASK_DELIVERY_CARD',
  'MATERIAL_PREP_SLIP',
  'PICKUP_SLIP',
  'ISSUE_SLIP',
  'FEI_TICKET_LABEL',
  'FEI_TICKET_REPRINT_LABEL',
  'TRANSFER_BAG_LABEL',
  'CUTTING_ORDER_QR_LABEL',
  'HANDOVER_QR_LABEL',
  'PRODUCTION_CONFIRMATION',
  'SETTLEMENT_CHANGE_REQUEST',
  'HANDOVER_DIFFERENCE_REQUEST',
  'QUALITY_DEDUCTION_CONFIRMATION',
  'QUALITY_DISPUTE_PROCESSING',
  'PRODUCTION_QC_MASTER',
  'POST_FINISHING_QC_ORDER',
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
