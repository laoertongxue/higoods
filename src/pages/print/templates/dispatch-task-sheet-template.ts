import { renderCode128Barcode } from '../../../components/real-barcode.ts'
import { renderRealQrPlaceholder } from '../../../components/real-qr.ts'
import { buildDispatchTaskSheetData, type DispatchTaskSheetData } from '../../../data/fcs/dispatch-task-sheet.ts'
import { normalizeProductionExecutionProcessCode } from '../../../data/fcs/merged-production-task.ts'
import { getProcessTaskQtyDisplayUnit } from '../../../data/fcs/process-tasks.ts'
import { createPrintDocumentId, getPrintGeneratedAt, type PrintDocument, type PrintDocumentBuildInput, type PrintTable } from '../../../data/fcs/print-service.ts'
import type { TechPackPatternFileSnapshot } from '../../../data/fcs/production-tech-pack-snapshot-types.ts'
import { escapeHtml } from '../../../utils.ts'

const normalizeProcess = (value: string) => normalizeProductionExecutionProcessCode(value.replace(/^PROC_/, ''))
const numberText = (value: number) => Number.isFinite(value) ? String(Number(value.toFixed(8))) : '未维护'
const normalized = (value: string) => value.trim().toLowerCase()
const appliesTo = (values: string[] | undefined, selected: Set<string>) => !values?.length || values.some((value) => ['all', '全部', '通用', '*'].includes(normalized(value)) || selected.has(normalized(value)))

/** Scope technical information using this assignment, never the whole PO quantity. */
export function selectDispatchTaskSheetTechnicalScope(data: DispatchTaskSheetData) {
  const codes = new Set(data.assignment.processCodes.map(normalizeProcess))
  const skuCodes = new Set(data.assignment.skuLines.map((line) => normalized(line.skuCode)))
  const colors = new Set(data.assignment.skuLines.map((line) => normalized(line.color)))
  const sizes = new Set(data.assignment.skuLines.map((line) => normalized(line.size)))
  const sewing = codes.has('SEWING')
  const withFinishing = sewing && codes.has('IRON_PACK')
  const fullMerged = withFinishing && codes.has('CUTTING')
  if (withFinishing) { codes.add('BUTTONHOLE'); codes.add('BUTTON_ATTACH') }
  const parts = (data.techPack?.cutPieceParts || []).filter((part) =>
    (sewing || codes.has('CUTTING')) && appliesTo(part.applicableColorList, colors) && appliesTo(part.applicableSizeList, sizes))
  const partMaterialIds = new Set(parts.map((part) => part.materialSku))
  const materials = (data.techPack?.bomItems || []).filter((item) => {
    if (!appliesTo(item.applicableSkuCodes, skuCodes)) return false
    if (!withFinishing && item.type === '包装材料' && !codes.has('IRON_PACK')) return false
    if (sewing && [item.id, item.materialSkuId, item.materialCode].some((id) => id && partMaterialIds.has(id))) return true
    if (!item.usageProcessCodes?.length) return true
    return item.usageProcessCodes.some((code) => codes.has(normalizeProcess(code)))
      || (fullMerged && item.type !== '成衣')
  })
  const materialIds = new Set(materials.map((item) => item.id))
  const materialCodes = new Set(materials.flatMap((item) => [item.id, item.materialSkuId, item.materialCode].filter((value): value is string => Boolean(value))))
  const processes = (data.techPack?.processEntries || []).filter((entry) => {
    if (!codes.has(normalizeProcess(entry.processCode)) && !(fullMerged && entry.isSpecialCraft && entry.selectedTargetObject !== '完整面料')) return false
    return !entry.linkedBomItemIds?.length || entry.linkedBomItemIds.some((id) => materialIds.has(id))
  })
  const patternIds = new Set([...materials.flatMap((item) => item.linkedPatternIds || []), ...processes.flatMap((entry) => entry.linkedPatternIds || [])])
  const patterns = (data.techPack?.patternFiles || []).filter((pattern) => {
    if (!appliesTo(pattern.selectedSizeCodes?.length ? pattern.selectedSizeCodes : pattern.rulSizeList, sizes)) return false
    const linkedMaterial = pattern.linkedBomItemId || pattern.linkedMaterialSku || pattern.linkedMaterialId
    if (linkedMaterial) return materialIds.has(linkedMaterial) || materialCodes.has(linkedMaterial)
    return patternIds.size ? patternIds.has(pattern.id) || patternIds.has(pattern.patternFileId) : sewing || codes.has('CUTTING')
  })
  const measurements = (data.techPack?.sizeMeasurements || []).filter((measurement) => sizes.has(normalized(measurement.sizeCode)))
  return { materials, processes, parts, patterns, measurements }
}

type TechnicalScope = ReturnType<typeof selectDispatchTaskSheetTechnicalScope>
interface DispatchTaskSheetPrintDocument extends PrintDocument {
  taskSheet: { data: DispatchTaskSheetData; technical: TechnicalScope; quantityUnit: string }
}

export function buildDispatchTaskSheetPrintDocument(input: PrintDocumentBuildInput): DispatchTaskSheetPrintDocument {
  if (input.documentType !== 'DISPATCH_TASK_SHEET' || input.sourceType !== 'EFFECTIVE_TASK_ASSIGNMENT') throw new Error('请选择具体有效分配打印任务单。')
  const data = buildDispatchTaskSheetData(input.sourceId)
  const technical = selectDispatchTaskSheetTechnicalScope(data)
  const hasSewing = data.assignment.processCodes.some((code) => normalizeProcess(code) === 'SEWING')
  const quantityUnit = hasSewing ? '件' : data.runtime ? getProcessTaskQtyDisplayUnit(data.runtime) : '单位未维护'
  const totalQty = data.assignment.skuLines.reduce((sum, line) => sum + line.qty, 0)
  const generatedAt = getPrintGeneratedAt()
  const templateCode = 'DISPATCH_TASK_SHEET_V1'
  return {
    printDocumentId: createPrintDocumentId(input, templateCode), documentType: 'DISPATCH_TASK_SHEET',
    documentTitle: `任务单 — ${data.taskSheetNo}`, sourceType: input.sourceType, sourceId: input.sourceId,
    templateCode, paperType: 'A4', orientation: 'portrait', printTitle: '任务单', printSubtitle: data.taskTypeLabel,
    headerFields: [
      { label: '任务单号', value: data.taskSheetNo }, { label: '生产单号', value: data.productionOrderNo },
      { label: '任务编号', value: data.taskNo }, { label: 'SPU／款号', value: data.styleCode },
      { label: '承接工厂', value: data.assignment.factoryName },
      { label: 'PPIC', value: data.ppicName || (hasSewing ? '未维护；领取前须补齐' : '不适用') },
      { label: '分配日期', value: data.assignment.businessAssignedAt || '未维护' },
      { label: '要求完成日期', value: data.runtime?.taskDeadline || '未维护' },
    ],
    imageBlocks: [{ title: '款式', imageUrl: data.styleImageUrl, imageLabel: `${data.styleCode} ${data.styleName}`, sourceLabel: '任务技术资料', fallbackLabel: '款式图片未维护' },
      ...technical.materials.map((material) => ({ title: material.type, imageUrl: material.materialImageUrl, imageLabel: `${material.name} ${material.materialSkuId || material.materialCode || material.id}`, sourceLabel: '任务技术资料', fallbackLabel: `${material.name}图片未维护` }))],
    qrCodes: [{ title: '任务二维码', value: data.qrValue, description: data.supportsCutPieceHandover ? '仓库扫码核对本任务裁片' : '扫码查看本任务单', sizeMm: 34 }],
    barcodes: [{ title: '任务单条码', value: data.taskSheetNo }],
    sections: [
      { sectionId: 'task-responsibility', title: '任务内容', fields: [{ label: '任务类型', value: data.taskTypeLabel }, { label: '承担内容', value: data.taskContent }] },
      { sectionId: 'task-pickup', title: '领取说明', fields: [{ label: '领取对象', value: data.pickupObject }, { label: '领取地点', value: data.pickupLocation }] },
    ],
    tables: [{ tableId: 'task-sku-scope', title: '本工厂分配范围', headers: ['SKU', '颜色', '尺码', '分配数量'], rows: [
      ...data.assignment.skuLines.map((line) => [line.skuCode, line.color || '未维护', line.size || '未维护', `${numberText(line.qty)} ${quantityUnit}`]),
      ['合计', '', '', `${numberText(totalQty)} ${quantityUnit}`],
    ] }],
    signatureBlocks: [], differenceBlocks: [], footerFields: [{ label: '打印时间', value: generatedAt }],
    printMeta: { generatedAt, generatedBy: '任务分配', printNotice: '请使用当前有效任务单；实际交出以仓库确认记录为准。', returnHref: '/fcs/dispatch/workbench' },
    barcodePayload: data.taskSheetNo, qrPayload: data.qrValue, printVersionNo: data.version,
    taskSheet: { data, technical, quantityUnit },
  }
}

function image(url: string | undefined, label: string, size = 'material'): string {
  if (!url) return `<span class="task-sheet-image-missing" data-print-image-missing>${escapeHtml(label)}图片未维护</span>`
  return `<span data-print-image-frame><button type="button" class="task-sheet-image task-sheet-image-${size}" data-print-image-url="${escapeHtml(url)}" data-print-image-title="${escapeHtml(label)}" aria-label="查看${escapeHtml(label)}大图"><img data-print-image src="${escapeHtml(url)}" alt="${escapeHtml(label)}" loading="eager"></button><span data-print-image-loading class="print-hidden">图片加载中…</span><span data-print-image-error hidden class="print-hidden">图片加载失败：${escapeHtml(label)} <button type="button" data-print-image-retry>重试图片</button></span></span>`
}

function table(title: string, headers: string[], rows: string[][], id: string): string {
  return `<section class="task-sheet-section" data-task-sheet-section="${id}"><h2>${escapeHtml(title)}</h2><table><thead><tr>${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join('')}</tr></thead><tbody>${rows.length ? rows.map((row) => `<tr>${row.map((cell) => `<td>${cell}</td>`).join('')}</tr>`).join('') : `<tr><td colspan="${headers.length}">暂无适用资料</td></tr>`}</tbody></table></section>`
}

function textTable(input: PrintTable): string {
  return table(input.title, input.headers, input.rows.map((row) => row.map(escapeHtml)), input.tableId)
}

function patternLinks(pattern: TechPackPatternFileSnapshot): string {
  const files = [
    { label: 'DXF', file: pattern.dxfFile }, { label: 'RUL', file: pattern.rulFile }, { label: 'PRJ', file: pattern.prjFile },
  ].flatMap(({ label, file }) => file?.dataUrl || file?.previewUrl ? [{ label, name: file.fileName, url: file.dataUrl || file.previewUrl || '' }] : [])
  if (!files.length && pattern.fileUrl && pattern.fileUrl !== '#') files.push({ label: '纸样文件', name: pattern.patternFileName || pattern.fileName, url: pattern.fileUrl })
  return files.length ? files.map((file) => `<a href="${escapeHtml(file.url)}" target="_blank" rel="noopener" title="${escapeHtml(file.name)}">${escapeHtml(file.label)}</a>`).join(' · ') : '附件未维护'
}

export function renderDispatchTaskSheetTemplate(document: PrintDocument): string {
  const { data, technical, quantityUnit } = (document as DispatchTaskSheetPrintDocument).taskSheet
  const skuSet = new Set(data.assignment.skuLines.map((line) => normalized(line.skuCode)))
  const materialRows = technical.materials.map((material) => {
    const applicableLines = data.assignment.skuLines.filter((line) => appliesTo(material.applicableSkuCodes, new Set([normalized(line.skuCode)])))
    const scopedGarmentQty = applicableLines.reduce((sum, line) => sum + line.qty, 0)
    const usageUnit = material.unit || '单位未维护'
    const lossRate = material.lossRate > 1 ? material.lossRate / 100 : material.lossRate || 0
    const plannedQty = material.unitConsumption * scopedGarmentQty * (1 + lossRate)
    const identity = `${material.name} ${material.materialSkuId || material.materialCode || material.id}`
    const materialNote = [material.spec, material.colorLabel, material.remark].filter(Boolean).join('；')
    return [`<div class="task-sheet-object">${image(material.materialImageUrl, identity)}<div><b>${escapeHtml(material.name)}</b><p>${escapeHtml(material.materialSkuId || material.materialCode || material.id)}</p><p>${escapeHtml(material.type)}${materialNote ? ` · ${escapeHtml(materialNote)}` : ''}</p></div></div>`,
      `${numberText(material.unitConsumption)} ${escapeHtml(usageUnit)}/${escapeHtml(quantityUnit)}`,
      `${numberText(plannedQty)} ${escapeHtml(usageUnit)}${lossRate ? `<br><small>含损耗 ${numberText(lossRate * 100)}%</small>` : ''}`,
      escapeHtml(material.applicableSkuCodes?.length ? material.applicableSkuCodes.filter((code) => skuSet.has(normalized(code))).join('、') : '本次分配 SKU')]
  })
  const partRows = technical.parts.map((part) => [part.partCode, part.partNameCn, `${numberText(part.pieceCountPerGarment)} 片/件`, part.applicableColorList.length ? data.assignment.skuLines.filter((line) => appliesTo(part.applicableColorList, new Set([normalized(line.color)]))).map((line) => `${line.color} ${line.size}`).filter((value, index, values) => values.indexOf(value) === index).join('、') : '本次分配范围'].map(escapeHtml))
  const patternRows = technical.patterns.map((pattern) => [
    `<div class="task-sheet-object">${image(pattern.imageUrl || pattern.markerImage?.previewUrl || pattern.markerImage?.dataUrl, pattern.patternName || pattern.patternFileName)}<div><b>${escapeHtml(pattern.patternName || pattern.patternFileName)}</b><p>${escapeHtml(pattern.linkedMaterialName || pattern.patternMaterialTypeLabel)}</p></div></div>`,
    escapeHtml(pattern.patternVersion || '未维护'),
    escapeHtml(data.assignment.skuLines.map((line) => line.size).filter((value, index, values) => values.indexOf(value) === index).join('、')),
    patternLinks(pattern),
  ])
  const processRows = technical.processes.map((entry) => [entry.processName, entry.craftName || '按技术资料执行', entry.manualNotes || entry.ruleSource || '按冻结工艺要求执行'].map(escapeHtml))
  const measurementRows = technical.measurements.map((measurement) => [measurement.sizeCode, measurement.measurementPart, `${measurement.measurementValue} ${measurement.measurementUnit}`, measurement.tolerance === undefined ? '未维护' : `±${measurement.tolerance} ${measurement.measurementUnit}`].map(escapeHtml))
  const qr = document.qrCodes[0]
  return `<style>
    .dispatch-task-sheet { padding: 8mm; font: 10pt/1.45 Arial,"Microsoft YaHei",sans-serif; color:#111; }
    .dispatch-task-sheet h1 { font-size:23pt; margin:0; font-weight:700; }
    .dispatch-task-sheet h2 { font-size:12pt; font-weight:700; margin:4mm 0 1.5mm; break-after:avoid; }
    .dispatch-task-sheet p { margin:.5mm 0; }
    .task-sheet-header { display:flex; justify-content:space-between; gap:6mm; align-items:flex-start; break-inside:avoid; }
    .task-sheet-barcode { width:118mm; margin-top:2mm; }
    .task-sheet-barcode svg { width:100%; height:14mm; display:block; }
    .task-sheet-qr { width:34mm; flex:none; text-align:center; font-size:8pt; }
    .task-sheet-qr [data-real-qr], .task-sheet-qr svg { width:34mm!important; height:34mm!important; }
    .task-sheet-number { font-size:11pt; letter-spacing:.2mm; margin-top:1mm!important; }
    .task-sheet-responsibility { border:1.5px solid #111; padding:3mm; margin-top:3mm; break-inside:avoid; }
    .task-sheet-responsibility strong { font-size:15pt; }
    .dispatch-task-sheet table { width:100%; border-collapse:collapse; table-layout:fixed; }
    .dispatch-task-sheet th,.dispatch-task-sheet td { border:1px solid #111; padding:1.7mm; vertical-align:middle; text-align:left; overflow-wrap:anywhere; }
    .dispatch-task-sheet th { font-weight:700; background:#f7f7f7; }
    .dispatch-task-sheet tr { break-inside:avoid; page-break-inside:avoid; }
    .dispatch-task-sheet thead { display:table-header-group; }
    .task-sheet-main { margin-top:3mm; }
    .task-sheet-main th { width:23%; font-size:9pt; }
    .task-sheet-main .task-sheet-style-cell { width:36mm; text-align:center; }
    .task-sheet-object { display:flex; gap:2mm; align-items:center; }
    .task-sheet-object p { font-size:8pt; }
    .task-sheet-image { border:0; background:transparent; padding:0; flex:none; cursor:zoom-in; }
    .task-sheet-image img { display:block; object-fit:contain; width:22mm; height:23mm; }
    .task-sheet-image-style img { width:30mm; height:39mm; }
    .task-sheet-image [data-print-image-error],.task-sheet-image-missing { font-size:8pt; color:#b91c1c; }
    .task-sheet-section[data-task-sheet-section="task-materials"] th:first-child { width:47%; }
    .task-sheet-section[data-task-sheet-section="task-patterns"] th:first-child { width:49%; }
    .task-sheet-section a { text-decoration:underline; }
    .task-sheet-note { margin-top:3mm; font-size:9pt; break-inside:avoid; }
    @media print { .dispatch-task-sheet { padding:0; width:auto; min-height:0; box-shadow:none; } .task-sheet-image { cursor:default; } .dispatch-task-sheet a { color:#111; } }
  </style><article class="print-paper-a4 dispatch-task-sheet" data-dispatch-task-sheet data-task-sheet-number="${escapeHtml(data.taskSheetNo)}">
    <header class="task-sheet-header"><div><h1>任务单</h1><p>任务单号</p><div class="task-sheet-barcode">${renderCode128Barcode(data.taskSheetNo, `任务单条码 ${data.taskSheetNo}`)}</div><p class="task-sheet-number">${escapeHtml(data.taskSheetNo)}</p></div><div class="task-sheet-qr">${renderRealQrPlaceholder({ value: qr.value, size: 148, title: qr.title, label: qr.title })}<p>${escapeHtml(qr.description)}</p></div></header>
    <section class="task-sheet-responsibility"><strong>${escapeHtml(data.taskTypeLabel)}</strong><p>${escapeHtml(data.taskContent)}</p></section>
    <table class="task-sheet-main"><tbody><tr><th>生产单号／任务编号</th><td>${escapeHtml(data.productionOrderNo)}<br>${escapeHtml(data.taskNo)}</td><td rowspan="4" class="task-sheet-style-cell">${image(data.styleImageUrl, `${data.styleCode} ${data.styleName}`, 'style')}<p>${escapeHtml(data.styleCode)}</p><p>${escapeHtml(data.styleName)}</p></td></tr><tr><th>承接工厂</th><td>${escapeHtml(data.assignment.factoryName)}</td></tr><tr><th>PPIC</th><td>${escapeHtml(document.headerFields.find((field) => field.label === 'PPIC')!.value)}</td></tr><tr><th>分配日期／要求完成</th><td>${escapeHtml(data.assignment.businessAssignedAt || '未维护')}<br>${escapeHtml(data.runtime?.taskDeadline || '未维护')}</td></tr><tr><th>领取对象／地点</th><td colspan="2"><b>${escapeHtml(data.pickupObject)}</b> · ${escapeHtml(data.pickupLocation)}</td></tr></tbody></table>
    ${document.tables.map(textTable).join('')}
    ${table('本任务部位资料', ['部位编码', '部位名称', '每件裁片数', '适用范围'], partRows, 'task-parts')}
    ${table('本任务面辅料资料（计划用量）', ['名称／编码／图片', '单耗', '本分配计划用量', '适用 SKU'], materialRows, 'task-materials')}
    ${table('本任务纸样资料', ['纸样／物料／图片', '版本', '尺码', '附件'], patternRows, 'task-patterns')}
    ${table('本任务工艺要求', ['工序', '工艺', '要求'], processRows, 'task-processes')}
    ${table('本任务成衣尺寸', ['尺码', '测量部位', '尺寸', '公差'], measurementRows, 'task-measurements')}
    ${data.runtime?.qcPoints?.length ? `<section class="task-sheet-note"><b>工艺注意事项</b><p>${data.runtime.qcPoints.map(escapeHtml).join('；')}</p></section>` : ''}
    <footer class="task-sheet-note"><p>本单确认任务内容和分配范围。实际交出菲票及数量，以仓库识别本单后确认的交出记录为准。</p><p>改派或领取责任调整后，请使用当前有效任务单。打印时间：${escapeHtml(document.printMeta.generatedAt)}</p></footer>
  </article>`
}
