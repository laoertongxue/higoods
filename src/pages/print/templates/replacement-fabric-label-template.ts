import { escapeHtml as e } from '../../../utils.ts'
import { renderRealQrPlaceholder } from '../../../components/real-qr.ts'
import { replacementTicketCode, type ReplacementFabricTicket } from '../../../data/fcs/cutting/replacement-fabric-fei-tickets.ts'
import { readReplacementFabricState } from '../../../data/fcs/cutting/replacement-fabric-repository.ts'
import { listReplacementFabricOrderRows } from '../../../data/fcs/cutting/replacement-fabric-source.ts'
import { assertReplacementTicketCurrent } from '../../../data/fcs/cutting/replacement-fabric-fei-tickets.ts'
import type { PrintDocument, PrintDocumentBuildInput } from '../../../data/fcs/print-service.ts'

export function buildReplacementFabricPrintDocument(input: PrintDocumentBuildInput): PrintDocument {
  const state = readReplacementFabricState()
  const scopes = listReplacementFabricOrderRows().flatMap(row => row.scopes)
  const ids = [...new Set(input.sourceId.split(',').filter(Boolean))]
  if (!ids.length) throw new Error('请先选择换片布票。')
  const tickets = ids.map(id => {
    const ticket = state.tickets.find(ticket => ticket.id === id)
    if (!ticket) throw new Error('换片布票不存在，请刷新后重试。')
    if (!state.receipts.some(receipt => receipt.ticket.id === id)) assertReplacementTicketCurrent(ticket, scopes)
    return structuredClone(ticket)
  })
  return { printDocumentId: `HPB:${ids.join(',')}`, documentType: 'REPLACEMENT_FABRIC_LABEL', documentTitle: '换片布菲票',
    sourceType: 'FEI_TICKET_RECORD', sourceId: input.sourceId, templateCode: 'REPLACEMENT_FABRIC_LABEL_V1',
    paperType: 'LABEL_100_100', orientation: 'portrait', printTitle: '换片布菲票', printSubtitle: '每张 5 Yard',
    headerFields: [], imageBlocks: [], qrCodes: [], barcodes: [], sections: [], tables: [], signatureBlocks: [],
    differenceBlocks: [], footerFields: [], replacementFabricTickets: tickets,
    printMeta: { generatedAt: new Date().toISOString(), generatedBy: '裁床打票员', printNotice: '核对实际出纸后确认打印结果。', returnHref: '/fcs/craft/cutting/replacement-fabric-fei-tickets' } }
}
export function renderReplacementFabricPrintDocument(document: PrintDocument): string {
  if (!document.replacementFabricTickets?.length) throw new Error('换片布打印内容为空。')
  return replacementFabricPrintStyles() + document.replacementFabricTickets.map(renderReplacementFabricLabel).join('')
}

export function renderReplacementFabricLabel(ticket: ReplacementFabricTicket): string {
  return `<article class="hpb-label${ticket.material.name.length > 30 || ticket.productionOrderNo.length > 30 || ticket.ticketNo.length > 120 ? ' hpb-label-long' : ''}" data-hpb-label="${e(ticket.id)}"><header><strong>换片布菲票</strong><b>HPB</b></header><div class="hpb-order">${e(ticket.productionOrderNo)}</div><div class="hpb-material"><strong>${e(ticket.material.name)}</strong><span>${e(ticket.material.code)} · ${e(ticket.material.color)}</span></div><div class="hpb-label-body"><div class="hpb-label-image">${ticket.material.imageUrl ? `<button data-pda-image-preview-url="${e(ticket.material.imageUrl)}" data-pda-image-preview-title="${e(ticket.material.name)}"><img src="${e(ticket.material.imageUrl)}" alt="${e(ticket.material.name + ' ' + ticket.material.color)}" onerror="this.hidden=true;this.nextElementSibling.hidden=false"><span hidden>面料图片加载失败</span></button>` : '<p>缺少对应面料图</p>'}</div><div><strong class="hpb-sequence">第 ${ticket.sequence} 张</strong><strong class="hpb-length">5 Yard</strong><p>换片备用布</p></div>${renderRealQrPlaceholder({ value: replacementTicketCode(ticket), batch: true, size: 116, title: '换片布菲票二维码', label: ticket.ticketNo })}</div><footer>${e(ticket.ticketNo)}</footer></article>`
}
export function replacementFabricPrintStyles(): string {
  return `<style>
  .hpb-label{width:100mm;min-height:100mm;padding:5mm;border:1px solid #000;background:white;color:#000;box-sizing:border-box;display:flex;flex-direction:column;gap:3mm;margin:12px auto;break-inside:avoid;font-family:Arial,"Microsoft YaHei",sans-serif}
  .hpb-label header{display:flex;align-items:center;justify-content:space-between;border:2px solid #000;padding:2mm;font-size:22px}.hpb-label header b{border-left:2px solid #000;padding-left:3mm}
  .hpb-order{font-size:18px;font-weight:700;overflow-wrap:anywhere}.hpb-material{display:flex;flex-direction:column;overflow-wrap:anywhere}.hpb-material strong{font-size:18px}.hpb-material span{font-size:12px}
  .hpb-label-body{display:flex;align-items:center;justify-content:space-between;gap:2mm;flex:1}.hpb-label-image{width:24mm;height:24mm;flex-shrink:0}.hpb-label-image button,.hpb-label-image img{width:100%;height:100%;object-fit:contain}.hpb-sequence{display:block;font-size:20px}.hpb-length{display:block;font-size:22px}.hpb-label-body p{font-size:12px}.hpb-label footer{border-top:1px solid #000;padding-top:2mm;font-size:10px;overflow-wrap:anywhere}
  .hpb-label-long{padding:3mm;gap:1.5mm}.hpb-label-long header{font-size:18px;padding:1mm}.hpb-label-long .hpb-order{font-size:13px}.hpb-label-long .hpb-material strong{font-size:12px;line-height:1.25}.hpb-label-long .hpb-material span{font-size:10px;line-height:1.2}.hpb-label-long footer{font-size:8px;line-height:1.15;padding-top:1mm}.hpb-label-long .hpb-label-body{flex:0 0 32mm}
  @media print{@page{size:100mm 100mm;margin:0}.hpb-print-controls{display:none!important}.hpb-print-root{padding:0!important;background:white!important}.hpb-label{height:100mm;min-height:0;max-height:100mm;border:0;margin:0;break-after:page}.hpb-label:last-child{break-after:auto}body{margin:0!important}}
  </style>`
}
