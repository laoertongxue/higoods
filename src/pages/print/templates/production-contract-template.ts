// @page-pattern: detail

import { getProductionContract } from '../../../data/fcs/production-contracts.ts'
import { createPrintDocumentId, type PrintDocument, type PrintDocumentBuildInput } from '../../../data/fcs/print-service.ts'
import {
  PRODUCTION_CONTRACT_MASTER_TEMPLATE_CODE,
  renderProductionContractMasterTemplate,
} from './production-contract-master-template.ts'

export function buildProductionContractPrintDocument(input: PrintDocumentBuildInput): PrintDocument {
  const contract = getProductionContract(input.sourceId)
  if (!contract) throw new Error('未找到生产合同版本')
  return {
    printDocumentId: createPrintDocumentId(input, PRODUCTION_CONTRACT_MASTER_TEMPLATE_CODE),
    documentType: 'PRODUCTION_CONTRACT',
    documentTitle: 'Surat Perintah Kerja (SPK) & Komitmen Jadwal Pengembalian',
    sourceType: 'PRODUCTION_CONTRACT_RECORD',
    sourceId: contract.contractId,
    templateCode: PRODUCTION_CONTRACT_MASTER_TEMPLATE_CODE,
    paperType: 'A4',
    orientation: 'portrait',
    printTitle: 'SURAT PERINTAH KERJA (SPK) & KOMITMEN JADWAL PENGEMBALIAN',
    printSubtitle: `${contract.contractNo} · V${contract.version}`,
    headerFields: [
      { label: 'Nama Pabrik/Maklon', value: contract.factoryName },
      { label: 'No. SPK Produksi', value: contract.productionOrderNo || contract.productionOrderId },
      { label: 'Nomor Tugas', value: contract.taskNo || contract.runtimeTaskId },
      { label: 'Tanggal Pembagian Tugas', value: contract.assignmentDate },
    ],
    imageBlocks: [], qrCodes: [], barcodes: [], sections: [], differenceBlocks: [],
    tables: [
      { tableId: 'task-details', title: 'Rincian Tugas Produksi', headers: ['Nomor SPU', 'No. PO Pembelian', 'No. SPK Produksi', 'Kendala/Catatan', 'Jumlah (Pcs)'], rows: contract.templateSnapshot.taskDetails.map((line) => [line.spuNo, line.purchaseOrderNo, line.productionSpkNo, line.note, `${line.qty}`]) },
      { tableId: 'return-rules', title: 'Jadwal Pengembalian Bertahap', headers: ['Tahap', 'Hari Ke-', 'Batas Waktu', 'Target Kumulatif', 'Jumlah Kumulatif'], rows: contract.returnRuleSnapshot.milestones.map((node, index) => [`${index + 1}`, `${node.naturalDay}`, node.deadlineDate, `${node.ratio * 100}%`, `${node.targetQty}`]) },
    ],
    signatureBlocks: [{ label: 'Diserahkan oleh', signerRole: 'PPIC' }, { label: 'Diterima & Disetujui oleh', signerRole: 'Maklon' }],
    footerFields: [{ label: 'Versi', value: `V${contract.version}` }],
    printMeta: { generatedAt: contract.generatedAt, generatedBy: contract.generatedBy, printNotice: 'Dokumen dicetak dari snapshot kontrak yang berlaku.', returnHref: '/fcs/contracts' },
    printVersionNo: `V${contract.version}`,
    relatedObjectIds: [contract.assignmentId, contract.productionOrderId, contract.runtimeTaskId],
    isVoid: contract.status === 'INVALIDATED',
  }
}

export function renderProductionContractTemplate(document: PrintDocument): string {
  const contract = getProductionContract(document.sourceId)
  if (!contract) throw new Error('Kontrak produksi tidak ditemukan')
  return renderProductionContractMasterTemplate(contract, {
    printedAt: document.printMeta.generatedAt,
    printedBy: document.printMeta.generatedBy,
  })
}
