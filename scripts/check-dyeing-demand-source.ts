import assert from 'node:assert/strict'
import {listDyeWorkOrderOnlineRows,filterDyeWorkOrderOnlineRows,buildDyeWorkOrderCsv} from '../src/data/fcs/dye-work-order-online-view.ts'
import {PROCESS_WORK_ORDER_SOURCE_LABEL} from '../src/data/fcs/process-work-order-domain.ts'
import {renderCraftDyeingWorkOrdersPage} from '../src/pages/process-factory/dyeing/work-orders.ts'
import {renderDyeWorkOrderOverlay} from '../src/pages/process-factory/dyeing/work-order-overlays.ts'
import {renderCraftDyeingWorkOrderDetailPage} from '../src/pages/process-factory/dyeing/work-order-detail.ts'
import {buildDyeWorkOrderFlowCardPrintDocument,renderDyeWorkOrderFlowCardTemplate} from '../src/pages/print/templates/dye-work-order-flow-card-template.ts'

const rows=listDyeWorkOrderOnlineRows(),html=renderCraftDyeingWorkOrdersPage()
assert.equal(rows.length,22)
assert.equal((html.match(/data-dye-demand-source/g)||[]).length,10,'每一行工厂下都有需求来源')
for(const row of rows){
 assert(row.sourceLabel.trim()&&row.sourceLabel===PROCESS_WORK_ORDER_SOURCE_LABEL[row.sourceType],row.dyeOrderId)
 const document=buildDyeWorkOrderFlowCardPrintDocument(row.dyeOrderId)
 assert.equal(document.headerFields.find(f=>f.label==='需求来源 Sumber permintaan')?.value,row.sourceLabel)
 assert.equal(document.headerFields.find(f=>f.label==='需求单号 No. Permintaan')?.value,row.purchaseOrderNo)
 const card=renderDyeWorkOrderFlowCardTemplate(document)
 assert(card.includes(row.sourceLabel)&&card.includes(row.purchaseOrderNo))
 for(const kind of ['全部','投入接收','超期未完结'] as const){const csv=buildDyeWorkOrderCsv([row],kind);assert(csv.includes('需求来源'));if(kind!=='超期未完结'||row.isOverdue)assert(csv.includes(row.sourceLabel))}
}
for(const id of ['DWO-001','DWO-002','DWO-013','DYE-YARN-DEMO-1','DYE-WATER-PO-202603-081']){
 const row=rows.find(r=>r.dyeOrderId===id)!
 for(const type of ['view','edit'] as const){const overlay=renderDyeWorkOrderOverlay({type,dyeOrderId:id});assert(overlay.includes('需求来源')&&overlay.includes(row.sourceLabel),`${id}/${type}`);assert(!overlay.includes('undefined')&&!overlay.includes('NaN'))}
 const edit=renderDyeWorkOrderOverlay({type:'edit',dyeOrderId:id})
 assert(new RegExp('value="'+row.sourceLabel+'"[^>]*readonly').test(edit),'编辑来源为只读')
 const detail=renderCraftDyeingWorkOrderDetailPage(id);assert(detail.includes('需求来源')&&detail.includes(row.sourceLabel),id+'独立详情')
}
assert.equal(rows.find(r=>r.dyeOrderId==='DWO-002')!.sourceType,'PRODUCTION_ORDER','补料标签不能改变需求来源')
assert(filterDyeWorkOrderOnlineRows(rows,{keyword:'备货手动创建'}).every(row=>row.sourceType==='STOCK'))
assert.equal(filterDyeWorkOrderOnlineRows(rows,{keyword:'备货手动创建'}).length,rows.filter(r=>r.sourceType==='STOCK').length)
const batch=renderDyeWorkOrderFlowCardTemplate(buildDyeWorkOrderFlowCardPrintDocument('DWO-001,DWO-013,DWO-002'))
assert.equal((batch.match(/data-dye-flow-demand-source/g)||[]).length,3)
console.log('PASS DS-001..005: 22 complete source labels, list/view/edit/detail, read-only source, production vs stock, supplement distinction, source search and three exports, single and mixed-source batch cards')
