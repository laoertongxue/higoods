import { escapeHtml as e } from '../../../utils.ts'
import { renderRealQrPlaceholder } from '../../../components/real-qr.ts'
import { renderCode128Barcode } from '../../../components/real-barcode.ts'
import { getTmfPurchaseState, reloadTmfPurchaseRuntime, type TmfPurchaseState } from '../../../data/pms/tmf-material-purchases.ts'
import { projectTmfWorkOrders } from '../../../data/fcs/tmf-work-order-view.ts'
import { resolveProcessRouteLaneOrder } from '../../../data/tech-pack-process-route.ts'
import type { WebbingEndRequirement } from '../../../data/fcs/webbing-specifications.ts'
import { buildPrintQrPayload, type PrintDocument, type PrintDocumentBuildInput, type PrintField } from '../../../data/fcs/print-service.ts'

export const tmfEndText = (end: WebbingEndRequirement) => `${({ NONE: '无需打头', METAL: '金属头', PLASTIC_WRAP: '塑料包头', SILICONE_DIP: '硅胶浸头' })[end.method]}${end.specification ? `；${end.specification}` : ''}${end.materialBomItemId ? `；辅材 ${end.materialBomItemId}（${end.materialUnit}）` : ''}${end.coverageMm ? `；覆盖 ${end.coverageMm}mm` : ''}`
const field = (label: string, value: string | number): PrintField => ({ label, value: String(value) })

/** 其他标签页可能已收货或拆包；重新读已保存事实，不修改库存。 */
export function readTmfPrintState(): TmfPurchaseState {
  if (typeof window !== 'undefined') reloadTmfPurchaseRuntime()
  return getTmfPurchaseState()
}

/** 一次读取同一库存/需求快照；打印不产生收发、完工或库存记录。 */
export function buildTmfProcessSheetPrintDocument(input: PrintDocumentBuildInput, data: TmfPurchaseState = readTmfPrintState()): PrintDocument {
  if (input.documentType !== 'TMF_PROCESS_SHEET' || input.sourceType !== 'TMF_WORK_ORDER') throw new Error('织带加工明细单的来源类型不符。')
  const order = projectTmfWorkOrders(data).find(o => o.id === input.sourceId)
  if (!order) throw new Error('加工单不存在或来源需求已变化，请返回加工单重新打开。')
  const targetRoute = `/fcs/craft/accessory/webbing/work-orders/${encodeURIComponent(order.id)}`
  const demandLabel = (id: string) => { const d = order.demands.find(item => item.id === id); return d ? `${d.specification.usage} / ${d.garmentColor} / ${d.garmentSize}` : '来源需求缺失' }
  const sections = order.demands.map(d => {
    const s = d.specification
    const material = data.orders.find(p => p.materialSkuId === d.materialSkuId)
    const unit = material?.accessoryType === '绳子' ? '根' : material?.accessoryType === '织带' ? '条' : '条/根（品类待核对）'
    return { sectionId: d.id, title: `${s.usage} · ${d.garmentColor} · ${d.garmentSize}`, fields: [
      field('半成品 SKU', d.materialSkuId), field('来源 BOM', d.bomItemId), field('对应成衣 SKU', d.garmentSkuCode),
      field('需求量', `${d.requiredPieces} ${unit}`), field('理论下料', `${d.theoreticalCutMeters} 米`),
      field('下料长度', `${s.cutLengthMm}mm`), field('成品长度', `${s.finishedLengthMm}mm`), field('公差', `±${s.toleranceMm}mm`),
      field('长度口径', s.lengthBasis === 'INCLUDING_ENDS' ? '含端头' : '不含端头'), field('测量条件', s.measurementCondition),
      field('截断方式', s.cuttingMethod), field('验收要求', s.acceptanceRequirement), field('A端', tmfEndText(s.endA)), field('B端', tmfEndText(s.endB)),
      field('要求交期', d.requiredDeliveryDate || '未指定'), field('工艺路线', resolveProcessRouteLaneOrder(d.routeSnapshot).entries.map(r => r.processName).join(' → ')),
    ], note: '按本行规格核对；其他长度或端头产出不能抵消本行缺口。' }
  })
  return {
    printDocumentId: `TMF_PROCESS_SHEET:${order.id}`, documentType: input.documentType, sourceType: input.sourceType, sourceId: input.sourceId,
    templateCode: 'TMF_PROCESS_SHEET_V1', documentTitle: '织带加工明细单', paperType: 'A4', orientation: 'portrait',
    printTitle: '织带／绳子加工明细单', printSubtitle: `${order.productionOrderNo} · TMF 辅料厂`,
    headerFields: [field('采用版本', order.versionId), field('采用快照', order.snapshotId), field('工艺节点', order.routeEntryId),
      field('接收 / 加工 / 交出', `${order.receiptStatus} / ${order.processingStatus} / ${order.handoverStatus}`),
      field('生产限制', order.control?.status && order.control.status !== 'ACTIVE' ? order.control.reason : '无当前限制')],
    // 当前物料来源仅有参考图，未有经确认的实际规格图，不冒充打印已具备真实素材。
    imageBlocks: order.demands.map(d => ({ title: `${d.materialSkuId} · ${d.specification.usage} / ${d.garmentSize}`, imageLabel: '对应物料及加工规格实图', sourceLabel: '采用技术资料', fallbackLabel: '对应物料及加工规格实图待补，当前仅可核对预览' })),
    qrCodes: [{ title: '查看当前加工单', value: buildPrintQrPayload({ ...input, businessNo: order.productionOrderNo, targetRoute, printVersionNo: order.versionId }), description: '扫码核对当前要求及执行状态，纸面不替代实收记录。', sizeMm: 30 }],
    barcodes: [{ title: '生产单号', value: encodeURIComponent(order.productionOrderNo), description: '加工单唯一来源请扫上方二维码' }],
    sections,
    tables: [
      { tableId: 'inputs', title: '加工投入（米）', headers: ['来源发料 / 批次', '对应需求', '半成品 SKU', '上游已发', '本厂实收'], rows: order.inputs.map(i => [i.id + ' / ' + i.lotId, demandLabel(i.demandId), i.materialSkuId, String(i.dispatchedMeters), String(i.receivedMeters)]) },
      { tableId: 'outputs', title: '实际产出', headers: ['产出 / 需求', '实际下料 / 成品', '合格', '待打头', '不良'], rows: order.outputs.map(o => [o.id + ' / ' + demandLabel(o.demandId), `${o.actualCutLengthMm}mm / ${o.specification.tippingRequired ? '见打头结果' : o.actualFinishedLengthMm == null ? '未记录' : `${o.actualFinishedLengthMm}mm`}`, `${o.goodPieces} ${o.unit}`, `${o.pendingTipPieces} ${o.unit}`, `${o.defectivePieces} ${o.unit}`]) },
      { tableId: 'tipping', title: '实际打头结果', headers: ['结果 / 来源截断', '实际成品长度', '实际 A端 / B端', '合格 / 不良'], rows: data.tipResults.filter(t => order.outputs.some(o => o.id === t.cutOutputId)).map(t => { const o = order.outputs.find(o => o.id === t.cutOutputId)!; return [t.id + ' / ' + t.cutOutputId, `${t.actualFinishedLengthMm}mm`, `A：${tmfEndText(t.endA)}；B：${tmfEndText(t.endB)}`, `${t.goodPieces} / ${t.defectivePieces} ${o.unit}`] }) },
      { tableId: 'handovers', title: '产出交仓（实际交出不等于已实收）', headers: ['交出 / 包号', '接收仓', '已交出（条/根）', '仓库实收（条/根）'], rows: order.handovers.map(h => [h.id + ' / ' + h.packageId, h.warehouseId, String(h.dispatchedPieces), String(h.receivedPieces)]) },
    ], signatureBlocks: [], differenceBlocks: [], footerFields: [field('说明', '长度与端头不新增半成品 SKU；此单不是库存凭证。')],
    printMeta: { generatedAt: new Date().toISOString(), generatedBy: '当前预览（演示）', printNotice: '按实际来源快照预览', returnHref: targetRoute },
  }
}

export function tmfPrintFactsSignature(doc: PrintDocument): string {
  return JSON.stringify([doc.sourceId, doc.headerFields, doc.sections, doc.tables, doc.imageBlocks, doc.paperType, doc.labelItems, doc.relatedObjectIds])
}

export function renderTmfProcessSheetTemplate(doc: PrintDocument): string {
  const fields = (values: PrintField[]) => `<dl style="display:grid;grid-template-columns:1fr 1fr;gap:6px">${values.map(f => `<div style="overflow-wrap:anywhere"><dt style="color:#475569;font-size:11px">${e(f.label)}</dt><dd style="margin:0">${e(f.value)}</dd></div>`).join('')}</dl>`
  return `<article class="print-paper-a4" data-tmf-print-signature="${e(tmfPrintFactsSignature(doc))}"><div class="print-card-sheet">
    <header><h1 class="print-card-title">${e(doc.printTitle)}</h1><p>${e(doc.printSubtitle)}</p></header>${fields(doc.headerFields)}
    ${doc.imageBlocks.map(i => `<p data-print-image-missing class="text-amber-700">${e(i.title)}：${e(i.fallbackLabel)}</p>`).join('')}
    <div class="print-avoid-break">${renderRealQrPlaceholder({ value: doc.qrCodes[0].value, size: 112, title: doc.qrCodes[0].title, label: doc.qrCodes[0].title })}<p>${e(doc.qrCodes[0].description)}</p>${doc.barcodes[0] ? renderCode128Barcode(doc.barcodes[0].value, doc.barcodes[0].title) : '<p>请使用二维码追溯原单。</p>'}</div>
    ${doc.sections.map(s => `<section class="print-section print-avoid-break"><h2 class="print-section-title">${e(s.title)}</h2>${fields(s.fields)}<p class="print-note">${e(s.note)}</p></section>`).join('')}
    ${doc.tables.map(t => `<section class="print-section"><h2 class="print-section-title">${e(t.title)}</h2><table class="print-table" style="table-layout:fixed;width:100%"><thead><tr>${t.headers.map(h => `<th>${e(h)}</th>`).join('')}</tr></thead><tbody>${t.rows.length ? t.rows.map(r => `<tr>${r.map(c => `<td style="overflow-wrap:anywhere">${e(c)}</td>`).join('')}</tr>`).join('') : `<tr><td colspan="${t.headers.length}">暂无实际记录</td></tr>`}</tbody></table></section>`).join('')}
    <footer class="print-note">${e(doc.footerFields[0].value)}<br>预览生成时间：${e(doc.printMeta.generatedAt)}</footer></div></article>`
}
