// @page-pattern: detail

import { getProductionContract } from '../../../data/fcs/production-contracts.ts'
import { createPrintDocumentId, type PrintDocument, type PrintDocumentBuildInput } from '../../../data/fcs/print-service.ts'
import { escapeHtml } from '../../../utils.ts'

export function buildProductionContractPrintDocument(input: PrintDocumentBuildInput): PrintDocument {
  const contract = getProductionContract(input.sourceId)
  if (!contract) throw new Error('未找到生产合同版本')
  return {
    printDocumentId: createPrintDocumentId(input, 'PRODUCTION_CONTRACT_V1'),
    documentType: 'PRODUCTION_CONTRACT',
    documentTitle: '生产加工合同',
    sourceType: 'PRODUCTION_CONTRACT_RECORD',
    sourceId: contract.contractId,
    templateCode: 'PRODUCTION_CONTRACT_V1',
    paperType: 'A4',
    orientation: 'portrait',
    printTitle: '生产加工合同 / PRODUCTION PROCESSING CONTRACT',
    printSubtitle: `${contract.contractNo} · V${contract.version}`,
    headerFields: [
      { label: '加工厂', value: contract.factoryName },
      { label: '生产单', value: contract.productionOrderNo || contract.productionOrderId },
      { label: '任务', value: contract.taskNo || contract.runtimeTaskId },
      { label: '分配日期', value: contract.assignmentDate },
    ],
    imageBlocks: [], qrCodes: [], barcodes: [], sections: [], differenceBlocks: [],
    tables: [
      { tableId: 'sku-lines', title: 'SKU明细', headers: ['SKU', '颜色', '尺码', '数量'], rows: contract.skuLines.map((line) => [line.skuCode, line.color, line.size, `${line.qty}件`]) },
      { tableId: 'return-rules', title: '自然日回货规则', headers: ['节点', '累计比例', '应回数量', '应回日期'], rows: contract.returnRuleSnapshot.milestones.map((node) => [`第${node.naturalDay}自然日`, `${node.ratio * 100}%`, `${node.targetQty}件`, node.deadlineDate]) },
    ],
    signatureBlocks: [{ label: '甲方签署', signerRole: 'PPIC' }, { label: '乙方签署', signerRole: '加工厂负责人' }],
    footerFields: [{ label: '合同版本', value: `V${contract.version}` }],
    printMeta: { generatedAt: contract.generatedAt, generatedBy: contract.generatedBy, printNotice: '合同节点仅打印日期；打印读取当前合同版本快照。', returnHref: '/fcs/contracts' },
    printVersionNo: `V${contract.version}`,
    relatedObjectIds: [contract.assignmentId, contract.productionOrderId, contract.runtimeTaskId],
    isVoid: contract.status === 'INVALIDATED',
  }
}

export function renderProductionContractTemplate(document: PrintDocument): string {
  return `<article class="print-document"><h1>${escapeHtml(document.printTitle)}</h1><p>${escapeHtml(document.printSubtitle)}</p>${document.tables.map((table) => `<h2>${escapeHtml(table.title)}</h2><table><thead><tr>${table.headers.map((header) => `<th>${escapeHtml(header)}</th>`).join('')}</tr></thead><tbody>${table.rows.map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join('')}</tr>`).join('')}</tbody></table>`).join('')}</article>`
}
