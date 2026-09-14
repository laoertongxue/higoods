import test from 'node:test'
import assert from 'node:assert/strict'
import { dailyDemo,dailyWindow,detectDailyChange,sumKnown,materialDailySummary,dedupeGoods,linkedGoods,goodSummary,renderDailyView } from '../../src/pages/material-decision/daily'

test('日报窗口含截止日7天，重点日均独立使用前6天',()=>{
 const m=dailyDemo.materials[0],w=dailyWindow(m,'2026-09-14'),s=materialDailySummary(m,'2026-09-14')
 assert.equal(w.length,7);assert.equal(w[0].date,'2026-09-08');assert.equal(w.at(-1)?.date,'2026-09-14')
 assert.equal(s.priorMean,w.slice(0,6).reduce((a,d)=>a+d.bom,0)/6)
})
test('未知采购不填0，未BOM不输出完整确定订单需求',()=>{
 assert.equal(sumKnown([0,null,20]),null);assert.equal(sumKnown([0,0]),0)
 const s=materialDailySummary(dailyDemo.materials[0],'2026-09-13')
 assert.equal(s.order,null);assert.ok(s.knownBom>0);assert.ok(s.unknownUnits>0)
 assert.equal(materialDailySummary(dailyDemo.materials[4],'2026-09-13').purchase,null)
})
test('突变必须绝对量与比例同时达到阈值',()=>{
 assert.equal(detectDailyChange(2000,1000).spike,true)
 assert.equal(detectDailyChange(900,100).spike,false)
 assert.equal(detectDailyChange(11000,10000).spike,false)
 assert.equal(detectDailyChange(1000,2000).spike,true)
 assert.equal(detectDailyChange(2000,0).spike,false)
 assert.equal(detectDailyChange(2000,1000,false).spike,false)
})
test('截止日突变示例与未完结日不判定',()=>{
 assert.equal(materialDailySummary(dailyDemo.materials[0],'2026-09-13').change?.spike,true)
 assert.equal(materialDailySummary(dailyDemo.materials[0],'2026-09-14').change?.spike,false)
})
test('共享商品按SPU去重而不按关联行累加销量',()=>{
 const g=dailyDemo.goods[0],rows=dedupeGoods([g,g,...dailyDemo.goods])
 assert.equal(rows.length,16)
 assert.equal(linkedGoods('CNIDML074',[g,g]).length,1)
})
test('预选不产生确定用料；BOM需求保留物料归属',()=>{
 const a=goodSummary(dailyDemo.goods[0],'2026-09-13')
 assert.equal(a.estimated.length,0);assert.ok(a.preselected.length)
 const g=dailyDemo.goods[1],s=goodSummary(g,'2026-09-13')
 assert.equal(s.estimated[0].quantity,s.total*g.links[0].usage!)
 assert.equal(s.estimated[0].material,g.links[0].material)
})
test('同料BOM优先于预选，不重复关系及需量',()=>{
 const g={...dailyDemo.goods[1],links:[...dailyDemo.goods[1].links,...dailyDemo.goods[1].links,{material:dailyDemo.goods[1].links[0].material,kind:'预选' as const,usage:null}]}
 const s=goodSummary(g,'2026-09-13')
 assert.equal(s.confirmed.length,1);assert.equal(s.preselected.length,0);assert.equal(s.estimated.length,1)
})
test('两个业务页具有独立容器、标准分页与证据边界',()=>{
 for(const mode of ['daily','goods'] as const){const html=renderDailyView(mode);assert.match(html,/id="md-daily"/);assert.match(html,/data-standard-list-page/);assert.match(html,/next-page/);assert.match(html,/真实图片待提供/);assert.match(html,/数量全部为 Mock/)}
 assert.ok(dailyDemo.materials.length>10);assert.ok(dailyDemo.goods.length>10)
})
