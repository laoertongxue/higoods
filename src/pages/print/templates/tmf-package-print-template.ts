import { escapeHtml as e } from '../../../utils.ts'
import { renderRealQrPlaceholder } from '../../../components/real-qr.ts'
import { renderCode128Barcode } from '../../../components/real-barcode.ts'
import { type TmfPurchaseState, type TmfOutputPackage } from '../../../data/pms/tmf-material-purchases.ts'
import { buildPrintQrPayload, type PrintDocument, type PrintDocumentBuildInput, type PrintField } from '../../../data/fcs/print-service.ts'
import { tmfPrintFactsSignature, renderTmfProcessSheetTemplate, tmfEndText, readTmfPrintState } from './tmf-process-sheet-template.ts'

const field = (label: string, value: string | number): PrintField => ({ label, value: String(value) })
const ascii = (value: string) => /^[\x20-\x7e]+$/.test(value)

function selectedIds(value: string): string[] {
  let ids: unknown
  try { ids = JSON.parse(value) } catch { throw new Error('标签选择无效，请从包装列表重新选择。') }
  if (!Array.isArray(ids) || !ids.length || ids.length > 100 || ids.some(id => typeof id !== 'string' || !id.trim()) || new Set(ids).size !== ids.length) throw new Error('请选择1至100个不重复的有效包，不允许空包号或重复标签。')
  return ids as string[]
}
function context(data: TmfPurchaseState, pkg: TmfOutputPackage) {
  const demand = data.demands.find(d => d.id === pkg.demandId)
  const output = data.cutOutputs.find(o => o.id === pkg.cutOutputId && o.demandId === pkg.demandId)
  if (!demand || !output || pkg.materialSkuId !== output.materialSkuId) throw new Error('包装缺少对应需求或产出来源，请核对原单。')
  const workId = JSON.stringify([demand.productionOrderId, demand.techPackSnapshotId, demand.routeEntryId])
  const route = `/fcs/craft/accessory/webbing/work-orders/${encodeURIComponent(workId)}?packageId=${encodeURIComponent(pkg.id)}`
  const control = data.productionControls.find(c => c.productionOrderId === demand.productionOrderId)
  return { demand, output, workId, route, control }
}
function missingImage(pkg: TmfOutputPackage) {
  return { title: `${pkg.materialSkuId} · 包 ${pkg.id}`, imageLabel: '对应加工产出实图', sourceLabel: '加工产出', fallbackLabel: '对应加工产出实图待补，当前仅可核对预览' }
}
function documentBase(input: PrintDocumentBuildInput, title: string, templateCode: string, route: string): PrintDocument {
  return { printDocumentId: `${templateCode}:${input.sourceId}`, documentType: input.documentType, sourceType: input.sourceType, sourceId: input.sourceId, templateCode,
    documentTitle: title, printTitle: title, printSubtitle: 'TMF 辅料厂', paperType: 'A4', orientation: 'portrait', headerFields: [], imageBlocks: [], qrCodes: [], barcodes: [], sections: [], tables: [], signatureBlocks: [], differenceBlocks: [], footerFields: [field('说明','打印不新增库存，实际交出、仓库实收及生产发料分别核对。')],
    printMeta: { generatedAt: new Date().toISOString(), generatedBy: '当前预览（演示）', printNotice: '按当前事实预览', returnHref: route } }
}

/** 标签数量来自选中的有效包装；一包一张，重复/失效任一项都拒绝整批。 */
export function buildTmfPackageLabelsPrintDocument(input: PrintDocumentBuildInput, data: TmfPurchaseState = readTmfPrintState()): PrintDocument {
  if (input.documentType !== 'TMF_PACKAGE_LABEL' || input.sourceType !== 'TMF_OUTPUT_PACKAGE') throw new Error('标签来源类型不符。')
  const ids = selectedIds(input.sourceId)
  const packages = ids.map(id => {
    const pkg = data.packages.find(p => p.id === id)
    if (!pkg || pkg.splitAt) throw new Error(`包 ${id} 不存在或已拆分，请使用当前有效子包。`)
    if (data.productionIssues.some(i => i.packageId === id)) throw new Error(`包 ${id} 已发生生产发料，不能按原装包数量重印整包标签；请扫码查看实际去向。`)
    return { pkg, ...context(data, pkg) }
  })
  if (new Set(packages.map(p => p.workId)).size !== 1) throw new Error('一次标签打印须来自同一加工单，请分别选择。')
  if (input.labelSize && !['LABEL_150_100','A4'].includes(input.labelSize)) throw new Error('当前仅支持150×100mm或A4预览，现场标签尺寸待确认。')
  const doc = documentBase(input, '织带／绳子包装标签', 'TMF_PACKAGE_LABEL_V1', packages[0].route)
  doc.paperType = input.labelSize || 'LABEL_150_100'
  doc.labelSize = doc.paperType
  doc.totalCopies = packages.length
  doc.relatedObjectIds = ids
  doc.labelItems = packages.map(({ pkg, demand, workId, route, control }) => {
    const blocked = control && control.status !== 'ACTIVE'
    const warning = blocked ? `受限待处理：${control.reason}；不得作为可发料凭证` : '合格装包；发料仍须核对当前需求与库存'
    const item = { labelTitle: `成品 ${pkg.actualFinishedLengthMm}mm · ${pkg.pieces} ${pkg.unit}`, labelSubtitle: `包 ${pkg.id}`, labelFields: [
      field('生产单', demand.productionOrderNo), field('用途 / 色 / 码', `${demand.specification.usage} / ${demand.garmentColor} / ${demand.garmentSize}`),
      field('半成品 SKU', pkg.materialSkuId), field('实际下料', `${pkg.actualCutLengthMm}mm`), field('实际成品', `${pkg.actualFinishedLengthMm}mm`),
      field('A端', tmfEndText(pkg.endA)), field('B端', tmfEndText(pkg.endB)), field('产出行', pkg.tipResultId || pkg.cutOutputId),
      field('采用版本 / 节点', `${demand.techPackVersionId} / ${demand.routeEntryId}`), field('装包数量', `${pkg.pieces} ${pkg.unit}`), field('包装时间', pkg.createdAt),
    ], labelWarnings: [warning, '对应加工实图待补'],
      qrCode: { title: '扫码查看当前包', value: buildPrintQrPayload({ documentType: input.documentType, sourceType: input.sourceType, sourceId: pkg.id, businessNo: pkg.id, targetRoute: route, printVersionNo: demand.techPackVersionId, extra: { packageId: pkg.id, workOrderId: workId } }), description: '扫码核对有效包和当前状态', sizeMm: 30 },
      ...(ascii(pkg.id) ? { barcode: { title: '包号', value: pkg.id } } : {}),
    }
    return item
  })
  doc.imageBlocks = packages.map(p => missingImage(p.pkg))
  doc.qrCodes = doc.labelItems.map(i => i.qrCode!)
  doc.barcodes = doc.labelItems.flatMap(i => i.barcode ? [i.barcode] : [])
  return doc
}

/** 历史交出单允许追溯已拆包来源，不能把子包再次累计为本次交出。 */
export function buildTmfHandoverPrintDocument(input: PrintDocumentBuildInput, data: TmfPurchaseState = readTmfPrintState()): PrintDocument {
  if (input.documentType !== 'TMF_HANDOVER_SHEET' || input.sourceType !== 'TMF_OUTPUT_HANDOVER') throw new Error('交出单来源类型不符。')
  const handover = data.outputHandovers.find(h => h.id === input.sourceId)
  const pkg = data.packages.find(p => p.id === handover?.packageId)
  if (!handover || !pkg) throw new Error('未找到实际交出记录，不能用计划数量生成交出单。')
  const { demand, output, route, control } = context(data, pkg)
  const sourceIssue = data.processingIssues.find(i => i.id === output.sourceIssueId)
  const actor = data.operations.find(op => op.action === '加工产出交回辅料仓' && op.objectId === pkg.id)
  const doc = documentBase(input, '织带／绳子产出交出单', 'TMF_HANDOVER_SHEET_V1', route)
  doc.headerFields = [field('交出单号', handover.id), field('生产单', demand.productionOrderNo), field('交出方', 'TMF 辅料厂'), field('交出经办人', actor?.actor.name || '原记录未保存'), field('接收仓', handover.warehouseId), field('实际交出时间', handover.dispatchedAt), field('采用版本', demand.techPackVersionId), field('生产限制', control?.status && control.status !== 'ACTIVE' ? control.reason : '无当前限制')]
  doc.sections = [{ sectionId: pkg.id, title: `包 ${pkg.id} · ${demand.specification.usage} / ${demand.garmentSize}`, fields: [field('半成品 SKU', pkg.materialSkuId), field('实际下料 / 成品', `${pkg.actualCutLengthMm}mm / ${pkg.actualFinishedLengthMm}mm`), field('A端', tmfEndText(pkg.endA)), field('B端', tmfEndText(pkg.endB)), field('产出行', pkg.tipResultId || pkg.cutOutputId), field('上游发料 / 批次', sourceIssue ? `${sourceIssue.id} / ${sourceIssue.lotId}` : '来源缺失，须核查'), field('当前包', pkg.splitAt ? '已拆分失效，原交出事实保留' : '有效包')], note: '纸面实收为生成时累计值；实际收货必须关联原交出记录。' }]
  doc.tables = [{ tableId: 'handover', title: '本单实际交接数量', headers: ['包号', '已交出', '仓库累计实收', '未实收'], rows: [[pkg.id, `${handover.dispatchedPieces} ${pkg.unit}`, `${handover.receivedPieces} ${pkg.unit}`, `${handover.dispatchedPieces-handover.receivedPieces} ${pkg.unit}`]] }]
  doc.imageBlocks = [missingImage(pkg)]
  doc.qrCodes = [{ title: '查看当前包与原单', value: buildPrintQrPayload({ ...input, businessNo: handover.id, targetRoute: route, printVersionNo: demand.techPackVersionId }), description: '交出与实收分别核对，扫码查看当前记录', sizeMm: 30 }]
  doc.barcodes = ascii(handover.id) ? [{ title: '交出单号', value: handover.id }] : []
  return doc
}

export function renderTmfPackageLabelsTemplate(doc: PrintDocument): string {
  const small = doc.paperType === 'LABEL_150_100'
  return `<div data-tmf-print-signature="${e(tmfPrintFactsSignature(doc))}"><style>
    .tmf-label-sheet{box-sizing:border-box;max-width:100%;width:${small?'150mm':'210mm'};${small?'height:100mm;':''}padding:${small?'4mm':'12mm'};background:white;margin:16px auto;border:1px solid #cbd5e1;color:#111;font-size:${small?'9px':'12px'};line-height:1.3;overflow-wrap:anywhere}
    .tmf-label-sheet h2{font-size:${small?'18px':'25px'};font-weight:700;margin:0 0 4px}.tmf-label-body{display:grid;grid-template-columns:1fr 112px;gap:10px}.tmf-label-fields{display:grid;grid-template-columns:1fr 1fr;gap:4px}.tmf-label-fields dt{color:#475569}.tmf-label-fields dd{margin:0}.tmf-label-head{margin-bottom:5px}
    @media print{@page{size:${small?'150mm 100mm':'A4 portrait'};margin:0}.tmf-label-sheet{max-width:none;margin:0;border:0;break-after:page;page-break-after:always}.tmf-label-sheet:last-child{break-after:auto;page-break-after:auto}}
    </style>${doc.labelItems!.map(item => `<article class="tmf-label-sheet" data-tmf-label-paper><h2>${e(item.labelTitle)}</h2><p class="tmf-label-head">${e(item.labelSubtitle)}</p><div class="tmf-label-body"><dl class="tmf-label-fields">${item.labelFields.map(f=>`<div><dt>${e(f.label)}</dt><dd>${e(f.value)}</dd></div>`).join('')}</dl><aside>${renderRealQrPlaceholder({value:item.qrCode!.value,size:112,title:'扫码查看包',label:'包号二维码'})}<p>扫码核对当前有效状态</p></aside></div>${item.barcode?renderCode128Barcode(item.barcode.value,'包号'):'<p>包号含中文等字符，请使用上方二维码识别。</p>'}<p>${item.labelWarnings!.map(e).join('；')}</p><p data-print-image-missing>加工产出实图待补</p></article>`).join('')}</div>`
}
export const renderTmfHandoverTemplate = renderTmfProcessSheetTemplate
