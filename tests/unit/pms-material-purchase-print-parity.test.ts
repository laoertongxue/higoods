import test from 'node:test'
import assert from 'node:assert/strict'
import { buildMpoParityExport, buildMpoPurchasePrintHtml, renderMpoCostSummary } from '../../src/pages/pms/material-purchase-order-parity.ts'
import { getPmsMaterialPurchaseOrder, type PmsMaterialPurchaseOrder } from '../../src/data/pms/material-purchase-orders.ts'

function order():PmsMaterialPurchaseOrder {
 const base=structuredClone(getPmsMaterialPurchaseOrder('CGF-2026-0001')!)
 base.purchaseOrderNo='CGF-PRINT-PARITY';base.unit='多单位';base.orderedQty=0;base.unitPrice=0;base.dyeFee=20
 base.lines=[{lineId:'PRINT:L1',materialCode:'FABRIC-A',materialName:'白色棉布',materialSpu:'FABRIC',imageUrl:'/materials/white.jpg',unit:'Yard',orderedQty:100,plannedRolls:2,unitPrice:3,actualPurchasedQty:98,sellerReceivedQty:90,inboundQty:80,priceConfirmed:true},{lineId:'PRINT:L2',materialCode:'YARN-B',materialName:'蓝色纱线',materialSpu:'YARN',imageUrl:'/materials/yarn.jpg',unit:'kg',orderedQty:20,plannedRolls:0,unitPrice:5,actualPurchasedQty:19,sellerReceivedQty:10,inboundQty:0,priceConfirmed:false}]
 return base
}

test('采购明细导出逐SKU，保留各单位与数量，不能取聚合头0值',()=>{
 const sample=order(),result=buildMpoParityExport([sample],'订单明细'),index=(name:string)=>result.headers.indexOf(name)
 assert.equal(result.rows.length,2)
 assert.deepEqual(result.rows.map(row=>row[index('SKU')]),['FABRIC-A','YARN-B'])
 assert.deepEqual(result.rows.map(row=>row[index('单位')]),['Yard','kg'])
 assert.deepEqual(result.rows.map(row=>row[index('计划数量')]),[100,20])
 assert.deepEqual(result.rows.map(row=>row[index('计划金额')]),[300,100])
 assert.equal(result.rows.reduce((sum,row)=>sum+Number(row[index('染色费用')]),0),20)
})
test('结算明细使用实采，未确认价格显示待确认，不能冒充计划结算',()=>{
 const result=buildMpoParityExport([order()],'结算单'),index=result.headers.indexOf('实际采购费用')
 assert.equal(result.rows[0][index],294)
 assert.equal(result.rows[1][index],'待确认')
})
test('订单导出按单位分组，不相加不同单位；空筛选不生成行',()=>{
 const result=buildMpoParityExport([order()],'订单'),index=(name:string)=>result.headers.indexOf(name)
 assert.equal(result.rows.length,1)
 assert.equal(result.rows[0][index('SKU数量')],2)
 assert.match(String(result.rows[0][index('计划采购量')]),/100 Yard.*20 kg/)
 assert.equal(result.rows[0][index('计划金额')],400)
 assert.equal(buildMpoParityExport([],'订单明细').rows.length,0)
})
test('打印逐SKU对应图片、计划与实际量，预览不改变任何业务事实',()=>{
 const sample=order(),before=structuredClone(sample),html=buildMpoPurchasePrintHtml(sample)
 assert.match(html,/FABRIC-A/);assert.match(html,/YARN-B/)
 assert.match(html,/src="\/materials\/white.jpg"/);assert.match(html,/src="\/materials\/yarn.jpg"/)
 assert.match(html,/100 Yard/);assert.match(html,/98 Yard/);assert.match(html,/19 kg/)
 assert.match(html,/计划金额：400.00 RMB/)
 assert.deepEqual(sample,before)
 sample.remark='<script>alert(1)</script>'
 assert.ok(!buildMpoPurchasePrintHtml(sample).includes('<script>alert'))
})


test('成本数据按实采价计算，跨币种费用分别展示，不把RMB费用加到IDR货款',()=>{
 const sample=order();sample.currency='IDR';sample.lines!.forEach(line=>line.priceConfirmed=true)
 sample.transferVouchers=[{voucherId:'voucher',transferDate:'2026-10-14',transferFee:25,fileIds:[],operator:'采购员',createdAt:'2026-10-14'}]
 const html=renderMpoCostSummary(sample)
 assert.match(html,/国内运费/);assert.match(html,/转运费用/);assert.match(html,/染色费用/)
 assert.match(html,/Rp 389/);assert.match(html,/¥45.00/);assert.ok(!html.includes('Rp 434'))
 sample.lines![1].priceConfirmed=false
 assert.match(renderMpoCostSummary(sample),/采购费用待确认/)
})
