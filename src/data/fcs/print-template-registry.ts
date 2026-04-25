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
