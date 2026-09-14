import assert from 'node:assert/strict'
import {listPrintingWorkOrders} from '../src/data/fcs/printing-work-order-business.ts'
import {getPrintingWorkflowFacts} from '../src/data/fcs/printing-task-domain.ts'
import {renderCraftPrintingWorkOrdersPage} from '../src/pages/process-factory/printing/work-orders.ts'
import {renderCraftPrintingWorkOrderDetailPage} from '../src/pages/process-factory/printing/work-order-detail.ts'
import {printingWorkOrderTimeGroups} from '../src/pages/process-factory/printing/work-order-times.ts'
import {printingQuantityGroups} from '../src/pages/process-factory/printing/presentation.ts'
import {buildPrintingExportRows} from '../src/pages/process-factory/printing/events.ts'
import {openPrintingDialog,closePrintingDialog,renderPrintingDialog} from '../src/pages/process-factory/printing/dialogs.ts'
import {buildPrintingInfoSheetDocument,buildPrintingConfirmationDocument,renderPrintingInfoSheetDocument,renderPrintingConfirmationDocument} from '../src/pages/print/templates/printing-work-order-template.ts'
// LIST-002/005/006/009, TIME-005, QTY-001, PAR-002/003/005/007/008.
// This complements browser layout/image checks; rendering alone does not prove browser acceptance.
const rows=listPrintingWorkOrders()
const html=renderCraftPrintingWorkOrdersPage()
for (const value of ['加工单／商品','加工投入／上游','加工要求','处理进度','加工产出／下游','时间','数量','操作','加工厂切换','生产环节','是否补料','data-printing-time-groups','data-printing-quantity-groups']) assert.ok(html.includes(value),value)
assert.equal(html.includes('正式素材待核验'),false)
assert.equal(html.includes('参考图待核验'),false)
for(const row of rows){
 assert.equal(printingWorkOrderTimeGroups(row).length,4)
 assert.equal(printingQuantityGroups(row).length,4)
 const detail=renderCraftPrintingWorkOrderDetailPage(row.workOrderId)
 assert.ok(detail.includes('data-printing-demand-source'))
 const info=buildPrintingInfoSheetDocument({documentType:'PRINTING_INFO_SHEET',sourceType:'PRINTING_WORK_ORDER',sourceId:row.workOrderId})
 const confirm=buildPrintingConfirmationDocument({documentType:'PRINTING_CONFIRMATION',sourceType:'PRINTING_WORK_ORDER',sourceId:row.workOrderId})
 assert.ok(info.headerFields.some(field=>field.label==='Purchase Order (PO)'))
 assert.ok(confirm.sections.flatMap(section=>section.fields || []).some(field=>field.label==='印花来源' && field.value===(row.salesType||'—')))
 assert.ok(renderPrintingConfirmationDocument(confirm).includes('Pattern transfer<br>confirmation'))
 for(const document of [info,confirm]) {
  const printHtml=document.documentType==='PRINTING_INFO_SHEET'?renderPrintingInfoSheetDocument(document):renderPrintingConfirmationDocument(document)
  for(const image of document.imageBlocks.filter(image=>image.imageUrl))assert.ok(printHtml.includes(image.imageUrl),`${row.printOrderNo} must actually render ${image.title}`)
  assert.ok(printHtml.includes('data-pda-image-preview-url'), 'print images must support preview')
 }
}
for(const kind of ['export'] as const){
 const output=buildPrintingExportRows(kind,rows)
 for(const row of output.values)assert.equal(row.length,output.headers.length,`${kind} header alignment`)
}
assert.deepEqual(buildPrintingExportRows('export',[]).values,[])
const exportRows=buildPrintingExportRows('export',rows)
for(const label of ['本厂实收','本厂实收单位','本厂实收完整性','已核算损耗','已核算损耗完整性'])assert.ok(exportRows.headers.includes(label),label)
assert.equal(exportRows.values[0][exportRows.headers.indexOf('本厂实收')],0,'zero remains a numeric zero')
const selectedIds=[rows[0].workOrderId,rows[1].workOrderId,rows[0].workOrderId]
const batch=buildPrintingConfirmationDocument({documentType:'PRINTING_CONFIRMATION',sourceType:'PRINTING_WORK_ORDER',sourceId:selectedIds.join(',')})
assert.equal(batch.relatedObjectIds?.length,2,'batch printing deduplicates order IDs')
assert.equal((renderPrintingConfirmationDocument(batch).match(/<article /g)||[]).length,2,'each selected order renders its own paper')
openPrintingDialog({type:'edit-info',workOrderId:rows[0].workOrderId})
const editable=renderPrintingDialog()
assert.ok(editable.includes('变更影响范围：后续未开工批次'))
assert.ok(editable.includes('已完成批次保留原花型与版本'))
assert.ok(editable.includes('data-printing-dialog-field="changeReason"'))
assert.ok(!/data-printing-dialog-field="frontPatternVersion"[^>]*readonly/.test(editable),'not-started order permits a new pattern version')
const historical=rows.find(row=>row.historicalInputQuantityUnknown)
assert.ok(historical,'history gap scenario remains present')
openPrintingDialog({type:'edit-info',workOrderId:historical.workOrderId})
assert.match(renderPrintingDialog(),/data-printing-dialog-field="frontPatternVersion"[^>]*readonly/,'unknown material responsibility blocks requirement changes')
closePrintingDialog()
console.log('PASS printing factory UI: eight columns, four time/quantity groups, source/print parity, applicable transfer and CSV grain/units/completeness')
