import { printingDemandFields, printingNeedsTransfer, printingPresentationFacts } from '../../process-factory/printing/presentation.ts'
import { printingMaterialCode } from '../../process-factory/printing/relations.ts'
import { getPrintingWorkOrderById, type PrintingWorkOrderBusinessRecord } from '../../../data/fcs/printing-work-order-business.ts'
import { buildPrintQrPayload, createPrintDocumentId, getPrintGeneratedAt, type PrintDocument, type PrintDocumentBuildInput, type PrintField } from '../../../data/fcs/print-service.ts'
import { renderRealQrPlaceholder } from '../../../components/real-qr.ts'
import { escapeHtml } from '../../../utils.ts'
import { localProductFixtureImageUrl } from '../../../data/pcs-product-archive-fixtures.ts'

const INFO_TEMPLATE = 'PRINTING_INFO_SHEET_V3'
const CONFIRMATION_TEMPLATE = 'PRINTING_CONFIRMATION_V3'
type Order = PrintingWorkOrderBusinessRecord
type SheetType = 'PRINTING_INFO_SHEET' | 'PRINTING_CONFIRMATION'
const fields = (rows: Array<[string,string,boolean?]>): PrintField[] => rows.map(([label,value,emphasized])=>({label,value,emphasized}))
const number = (value:number) => String(Number(value.toFixed(4)))

function requireOrders(sourceId:string): Order[] {
  const ids = [...new Set(sourceId.split(',').map(id=>decodeURIComponent(id.trim())).filter(Boolean))]
  if (!ids.length) throw new Error('未找到印花加工单，无法生成打印单据')
  return ids.map(id=>{const order=getPrintingWorkOrderById(id);if(!order)throw new Error(`所选印花加工单不存在：${id}，请重新选择`);return order})
}
function qrPayload(order:Order,documentType:SheetType):string {
  return buildPrintQrPayload({documentType,sourceType:'PRINTING_WORK_ORDER',sourceId:order.workOrderId,businessNo:order.printOrderNo,targetRoute:`/fcs/craft/printing/work-orders/${encodeURIComponent(order.workOrderId)}`,extra:{taskNo:order.taskNo,outputSku:order.output.sku}})
}
export function printingSheetQuantities(order:Order):[string,string] {
  const qty=order.plannedInput.plannedQty, unit=order.plannedInput.qtyUnit
  if (/^(yard|码)$/i.test(unit)) return [`${number(qty)} Yard`,`${number(qty*0.9144)} Meter`]
  if (/^(m|meter|米)$/i.test(unit)) return [`${number(qty/0.9144)} Yard`,`${number(qty)} Meter`]
  return [`${number(qty)} ${unit}`,'—']
}
function sheetImages(order:Order,type:SheetType):PrintDocument['imageBlocks'] {
  const toImage=(title:string,image:{imageUrl:string;imageAlt:string},sourceLabel:string)=>({title,...image,imageUrl:localProductFixtureImageUrl(image.imageUrl),imageLabel:image.imageAlt,sourceLabel,fallbackLabel:`${title}待补充`})
  if(type==='PRINTING_CONFIRMATION'&&order.demandSource.type==='DESIGN_REVISION')return [toImage('正',order.requirement.frontPattern,order.requirement.frontPattern.patternNo),...(order.requirement.printSide==='双面'&&order.requirement.insidePattern?[toImage('里',order.requirement.insidePattern,order.requirement.insidePattern.patternNo)]:[])]
  if(type==='PRINTING_CONFIRMATION'&&order.requirement.printSide==='双面')return [toImage('正',order.requirement.frontPattern,order.requirement.frontPattern.patternNo),...(order.requirement.insidePattern?[toImage('里',order.requirement.insidePattern,order.requirement.insidePattern.patternNo)]:[{title:'里',imageUrl:'',imageLabel:'里面花型待补充',sourceLabel:'',fallbackLabel:'里面花型待补充'}])]
  return order.demandSource.type==='STOCK' ? [toImage('Photo',order.output,order.output.sku)] : [toImage('Photo',order.product,order.product.spu)]
}
function buildSheet(input:PrintDocumentBuildInput,type:SheetType):PrintDocument {
  const orders=requireOrders(input.sourceId),order=orders[0], confirmation=type==='PRINTING_CONFIRMATION'
  const generatedAt=getPrintGeneratedAt(),template=confirmation?CONFIRMATION_TEMPLATE:INFO_TEMPLATE
  const title=confirmation?'印花确认单':'印花信息单', quantity=printingSheetQuantities(order), demand=new Map(printingDemandFields(order))
  const designRevision = order.demandSource.type === 'DESIGN_REVISION'
  const sourceRef = designRevision ? demand.get('设计改款任务') || order.demandSource.sourceNo : demand.get(confirmation ? '需求单' : '生产单')
  return {
    printDocumentId:createPrintDocumentId(input,template),documentType:type,documentTitle:orders.length>1?`${title}（批量 ${orders.length} 张）`:title,sourceType:'PRINTING_WORK_ORDER',sourceId:input.sourceId,
    templateCode:template,paperType:'A4',orientation:'portrait',printTitle:title,printSubtitle:'',relatedObjectIds:orders.map(o=>o.workOrderId),
    headerFields:fields([['Printing order',order.printOrderNo],['Printing order time',order.orderedAt],['SPU',order.product.spu||'—'],['Requirement / Need',quantity.join(' / ')],['Fabric',order.plannedInput.materialName],[designRevision?'设计改款任务号':confirmation?'需求单号':'Purchase Order (PO)',sourceRef||'—'],[confirmation?'面料 SKU':'Fabric SKU',printingMaterialCode(order.output.sku,true)]]),
    imageBlocks:sheetImages(order,type),qrCodes:[{title:'QR',value:qrPayload(order,type),description:'扫码查看印花加工单',sizeMm:confirmation?25:26}],barcodes:[],
    sections:confirmation?[{sectionId:'source',title:'印花来源',fields:fields([['印花来源',order.salesType||'—'],['工艺名称',order.requirement.craftName],[designRevision?'计划接收方':'收货人',designRevision?order.receivingTargetName||'—':order.handover.receiverName||'—']])}]:[{sectionId:'usage',title:'原料使用',fields:fields([['The quantity of raw materials used',`${number(order.actualInput.usedQty)} ${order.plannedInput.qtyUnit}`],['The roll of raw materials used',order.historicalRollQuantitiesUnknown || (order.actualInput.usedQty>0&&!order.actualInput.usedRollCount)?'—':String(order.actualInput.usedRollCount)]])}],
    tables:[],signatureBlocks:[],differenceBlocks:[],footerFields:[],printMeta:{generatedAt,generatedBy:'Web 打印操作员',printNotice:'按线上印花纸单打印；签字格留给现场签认。',returnHref:`/fcs/craft/printing/work-orders/${encodeURIComponent(order.workOrderId)}`},
  }
}
export const buildPrintingInfoSheetDocument=(input:PrintDocumentBuildInput)=>buildSheet(input,'PRINTING_INFO_SHEET')
export const buildPrintingConfirmationDocument=(input:PrintDocumentBuildInput)=>buildSheet(input,'PRINTING_CONFIRMATION')

function image(image:PrintDocument['imageBlocks'][number]):string {
  return image.imageUrl?`<button type="button" data-skip-page-rerender="true" data-pda-image-preview-url="${escapeHtml(image.imageUrl)}" data-pda-image-preview-title="${escapeHtml(image.imageLabel)}" aria-label="查看${escapeHtml(image.imageLabel)}大图" style="border:0;background:white;max-width:100%;padding:0"><img src="${escapeHtml(image.imageUrl)}" alt="${escapeHtml(image.imageLabel)}" style="max-width:100%;max-height:76pt;object-fit:contain" onload="this.nextElementSibling.hidden=true" onerror="this.hidden=true;this.nextElementSibling.textContent='图片加载失败'"><span>加载中</span></button>`:`<span>${escapeHtml(image.fallbackLabel||'图片待补充')}</span>`
}
function qr(order:Order,type:SheetType):string{return renderRealQrPlaceholder({value:qrPayload(order,type),size:100,title:'QR',label:`${order.printOrderNo} QR`})}
const cell=(value:string,colspan=1,rowspan=1,cls='')=>`<td colspan="${colspan}" rowspan="${rowspan}" class="${cls}">${value}</td>`
const val=(value:string|undefined)=>escapeHtml(value||'—')
function confirmation(order:Order):string {
  const f=printingPresentationFacts(order),demand=new Map(printingDemandFields(order)),[yards,meters]=printingSheetQuantities(order),double=order.requirement.printSide==='双面'
  const designRevision = order.demandSource.type === 'DESIGN_REVISION'
  const photos=sheetImages(order,'PRINTING_CONFIRMATION').map(img=>`<div class="pp-photo">${image(img)}${double?`<div>${img.title}</div>`:''}</div>`).join('')
  const time=(stage:'ARTWORK'|'PRINT'|'TRANSFER',action:'START'|'FINISH')=>val(stage==='ARTWORK' ? (action==='FINISH'?order.artworkConfirmedAt:order.productionActions?.filter(record=>record.stage===stage&&record.action===action&&(record.requirementVersion||1)===(order.requirementVersion||1)).at(-1)?.at) : stage==='PRINT' ? (action==='START'?f.printStartedAt:f.printFinishedAt) : (action==='START'?f.transferStartedAt:f.transferFinishedAt))
  const transfer=printingNeedsTransfer(order)
  const supplement=demand.get('是否补料')==='是'
  return `<article class="pp-confirm" data-printing-confirmation="${escapeHtml(order.workOrderId)}">${supplement?'<div class="pp-supplement">补料 / Bahan Tambahan</div><div class="pp-stamp">补料 / Bahan Tambahan</div>':''}<table class="pp-confirm-table"><colgroup>${Array(7).fill('<col>').join('')}</colgroup><tbody>
    <tr>${cell('Printing order')}${cell(val(order.printOrderNo))}${cell('Printing order time')}${cell(val(order.orderedAt),2)}<td colspan="2" rowspan="8" class="pp-media"><div class="pp-photos ${double?'pp-double':''}">${photos}</div><div class="pp-qr">${qr(order,'PRINTING_CONFIRMATION')}</div></td></tr>
    <tr>${cell('SPU')}${cell(val(order.product.spu))}${cell('Requirement / Need')}${cell(yards)}${cell(meters)}</tr>
    <tr>${cell('Fabric')}${cell(val(order.plannedInput.materialName))}${cell(designRevision?'设计改款任务号':'需求单号')}${cell(`${designRevision?'设计改款任务号':'需求单号'}：${val(designRevision?demand.get('设计改款任务'):demand.get('需求单'))}`,2)}</tr>
    <tr>${cell('面料 SKU')}${cell(val(printingMaterialCode(order.output.sku,true)),4)}</tr>
    <tr><td colspan="5" class="pp-source"><div>${['印花来源',val(order.salesType),'工艺名称',val(order.requirement.craftName),designRevision?'计划接收方':'收货人',val(designRevision?order.receivingTargetName:order.handover.receiverName)].map(x=>`<span>${x}</span>`).join('')}</div></td></tr>
    <tr>${cell('Urgent')}${cell('')}${cell('Printing accuracy')}${cell('—',2)}</tr>
    <tr>${cell(designRevision?'目标花型由 SKU 确定':'Edit confirmation',1,2,'pp-section')}${cell(designRevision?val(order.requirement.frontPattern.patternNo):'',1,2)}${cell(designRevision?'目标 SKU':'Confirmation time')}${cell(designRevision?val(order.output.sku):time('ARTWORK','START'),2)}</tr>
    <tr>${cell(designRevision?'花型编号':'Completion time')}${cell(designRevision?val(order.requirement.frontPattern.patternNo):time('ARTWORK','FINISH'),2)}</tr>
    <tr>${cell('Print confirmation',1,2,'pp-section')}${cell('',1,2)}${cell('Confirmation time')}${cell(time('PRINT','START'))}${cell('Printing length')}${cell('Printing width')}${cell('Qty (roll)')}</tr>
    <tr>${cell('Confirmation time')}${cell(time('PRINT','FINISH'))}${cell('M',1,1,'pp-unit')}${cell('CM',1,1,'pp-unit')}${cell('')}</tr>
    <tr>${cell('Pattern transfer<br>confirmation',1,2,'pp-section')}${cell('',1,2)}${cell('Confirmation time')}${cell(transfer?time('TRANSFER','START'):'—')}${cell('Printing length')}${cell('Printing width')}${cell('Qty (roll)')}</tr>
    <tr>${cell('Completion time')}${cell(transfer?time('TRANSFER','FINISH'):'—')}${cell('M',1,1,'pp-unit')}${cell('CM',1,1,'pp-unit')}${cell('')}</tr>
    <tr>${cell('Storage time')}${cell(val(order.barcodes.map(roll=>roll.inboundAt).filter((at):at is string=>Boolean(at)).sort().at(-1)))}${cell('Gudang')}${cell(val(order.barcodes.find(roll=>roll.warehouseName)?.warehouseName))}${cell('M',1,1,'pp-unit')}${cell('')}${cell('')}</tr>
    <tr class="pp-remark">${cell('Remark')}${cell(escapeHtml(order.remark||''),6)}</tr>
  </tbody></table></article>`
}
function information(order:Order):string {
  const [yards,meters]=printingSheetQuantities(order), demand=new Map(printingDemandFields(order))
  const designRevision = order.demandSource.type === 'DESIGN_REVISION'
  return `<article class="pp-info" data-printing-info="${escapeHtml(order.workOrderId)}"><table><tbody>
    <tr>${cell('Printing order')}${cell(val(order.printOrderNo))}${cell('Printing order time')}${cell(val(order.orderedAt),2)}${cell('Photo',2)}</tr>
    <tr>${cell('SPU')}${cell(val(order.product.spu))}${cell('Requirement / Need')}${cell(yards)}${cell(meters)}<td colspan="2" rowspan="4"><div class="pp-info-media">${qr(order,'PRINTING_INFO_SHEET')}${sheetImages(order,'PRINTING_INFO_SHEET').map(image).join('')}</div></td></tr>
    <tr>${cell('Fabric')}${cell(val(order.plannedInput.materialName))}${cell(designRevision?'设计改款任务号':'Purchase Order (PO)')}${cell(val(designRevision?demand.get('设计改款任务'):demand.get('生产单')),2)}</tr>
    <tr>${cell('Fabric SKU')}${cell(val(printingMaterialCode(order.output.sku,true)),4)}</tr>
    <tr>${cell('The quantity of raw materials used')}${cell(`${number(order.actualInput.usedQty)} ${escapeHtml(order.plannedInput.qtyUnit)}`)}${cell('The roll of raw materials used')}${cell(order.historicalRollQuantitiesUnknown || (order.actualInput.usedQty>0&&!order.actualInput.usedRollCount)?'—':String(order.actualInput.usedRollCount),2)}</tr>
  </tbody></table></article>`
}
function sheetStyles():string {
  return `<style>
  @page { size:A4 portrait; margin:0 }
  .pp-confirm,.pp-info {
    box-sizing:border-box; color:#1f2937; background:#fff;
    font-family:Arial,"PingFang SC","Microsoft YaHei",sans-serif;
    font-variant-numeric:tabular-nums; margin:0 auto; position:relative; break-inside:avoid;
  }
  .pp-confirm {
    width:210mm; height:148.5mm; padding:2.5mm 3mm;
    display:flex; flex-direction:column;
  }
  .pp-confirm-table {
    table-layout:fixed; width:100%; border-collapse:collapse;
    border:1pt solid #475569; flex:1 1 0; height:0; min-height:0;
    max-height:calc(100% - 1px); font-size:8pt; line-height:1.35;
  }
  .pp-confirm-table td {
    border:.6pt solid #94a3b8; padding:2pt 3pt; word-break:normal; overflow-wrap:anywhere;
    text-align:center; vertical-align:middle; height:20pt;
  }
  .pp-confirm-table tr:nth-child(-n+6)>td { height:24pt }
  .pp-confirm-table tr>td:first-child,
  .pp-confirm-table tr:nth-child(-n+3)>td:nth-child(3),
  .pp-confirm-table tr:nth-child(6)>td:nth-child(3),
  .pp-confirm-table tr:nth-child(7)>td:nth-child(3),
  .pp-confirm-table tr:nth-child(9)>td:nth-child(n+3),
  .pp-confirm-table tr:nth-child(11)>td:nth-child(n+3),
  .pp-confirm-table tr:nth-child(13)>td:nth-child(3) {
    color:#475569; font-weight:600;
  }
  .pp-confirm-table tr:first-child>td:nth-child(2),
  .pp-confirm-table tr:nth-child(4)>td:nth-child(2) { color:#111827; font-weight:600 }
  .pp-confirm-table .pp-section { color:#334155; font-weight:600; background:#f1f5f9 }
  .pp-confirm-table .pp-unit { text-align:right; color:#64748b; padding-right:5pt }
  .pp-confirm-table .pp-media { padding:0; vertical-align:top }
  .pp-photos { height:126pt; display:flex; align-items:center; justify-content:center; padding:4pt; box-sizing:border-box }
  .pp-photos.pp-double { flex-direction:column; gap:3pt }
  .pp-double .pp-photo img { max-height:36pt!important }
  .pp-double .pp-photo { font-size:7pt; line-height:1.25 }
  .pp-qr { border-top:.6pt solid #94a3b8; display:flex; justify-content:center; padding:2pt 0; height:54pt; box-sizing:border-box }
  .pp-qr svg { width:50pt; height:50pt }
  .pp-confirm-table .pp-source { padding:0 }
  .pp-source>div { display:flex; height:100%; min-height:24pt }
  .pp-source span { display:flex; align-items:center; justify-content:center; flex:1; border-right:.6pt solid #94a3b8; padding:2pt 3pt }
  .pp-source span:nth-child(odd) { font-weight:600; color:#475569; background:#f8fafc }
  .pp-source span:last-child { border:0 }
  .pp-confirm-table .pp-remark td { height:68pt; vertical-align:top; text-align:left; padding:6pt; line-height:1.5 }
  .pp-supplement { background:#fff1f2; color:#9f1239; border:.6pt solid #fda4af; font-size:10pt; line-height:1.4; font-weight:700; text-align:center; padding:1pt 0; margin-bottom:1.5mm }
  .pp-stamp { position:absolute; right:58pt; top:28pt; color:#b91c1c; border:1.5pt solid #b91c1c; border-radius:2pt; transform:rotate(-12deg); font-size:8pt; font-weight:700; padding:3pt 6pt; background:#fff; z-index:1 }

  .pp-info { width:191.7mm; min-height:150mm; padding:4mm }
  .pp-info table { table-layout:fixed; border-collapse:collapse; width:100%; height:150mm; border:1pt solid #475569; text-align:center; font-size:11pt; line-height:1.55; margin:0 }
  .pp-info td { border:.6pt solid #94a3b8; padding:7pt 6pt; vertical-align:middle; word-break:normal; overflow-wrap:anywhere }
  .pp-info tr:first-child>td:nth-child(1) { width:16% }
  .pp-info tr:first-child>td:nth-child(2) { width:20% }
  .pp-info tr:first-child>td:nth-child(3) { width:21% }
  .pp-info tr:first-child>td:nth-child(4) { width:22%; font-size:10.5pt }
  .pp-info tr:first-child>td:nth-child(5) { width:21% }
  .pp-info td:first-child,.pp-info tr:nth-child(-n+3)>td:nth-child(3),
  .pp-info tr:last-child>td:nth-child(3),.pp-info tr:first-child>td:last-child {
    font-size:10pt; font-weight:600; color:#475569; background:#f8fafc;
  }
  .pp-info tr:first-child>td:nth-child(2),.pp-info tr:nth-child(2)>td:nth-child(2),
  .pp-info tr:nth-child(4)>td:nth-child(2) { font-weight:600; color:#111827 }
  .pp-info tr:nth-child(4)>td:nth-child(2) { text-align:left; padding-left:10pt }
  .pp-info tr:nth-child(2)>td:nth-child(4),.pp-info tr:nth-child(2)>td:nth-child(5) { font-size:10.5pt; padding:7pt 3pt }
  .pp-info tr:last-child>td:nth-child(even) { font-size:12pt; font-weight:600; color:#111827 }
  .pp-info-media { width:100%; display:flex; flex-direction:column; align-items:center; gap:12pt }
  .pp-info-media img { max-height:80pt!important; max-width:100%!important }
  .pp-info-media svg { max-width:100%; height:auto }

  .pp-confirm:nth-of-type(2n),.pp-confirm:last-child { margin-bottom:12px }
  @media screen { .pp-confirm,.pp-info { box-shadow:0 1px 5px rgb(15 23 42 / 10%) } }
  @media print {
    .pp-confirm,.pp-info { margin:0 auto!important; box-shadow:none; -webkit-print-color-adjust:exact; print-color-adjust:exact }
    .pp-confirm:nth-of-type(2n) { break-after:page }
    .pp-confirm:last-child { break-after:auto }
    .pp-info { break-after:page }
    .pp-info:last-child { break-after:auto }
  }
  </style>`
}
export function renderPrintingInfoSheetDocument(document:PrintDocument):string {return sheetStyles()+requireOrders(document.sourceId).map(information).join('')}
export function renderPrintingConfirmationDocument(document:PrintDocument):string {return sheetStyles()+requireOrders(document.sourceId).map(confirmation).join('')}
