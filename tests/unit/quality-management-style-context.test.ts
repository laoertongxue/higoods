import assert from 'node:assert/strict'
import test from 'node:test'
import { listStyleArchives } from '../../src/data/pcs-style-archive-repository.ts'
import { resolveQualityStyleContext } from '../../src/data/fcs/quality-management-style-context.ts'
import { getDefaultQualityConfigurations } from '../../src/data/fcs/quality-management-records.ts'
import { resolveInspectionStandard } from '../../src/data/fcs/quality-management-rules.ts'
import type { AdditionalInspectionStandard, InspectionSourceKind, InspectionStandard } from '../../src/data/fcs/quality-management-types.ts'
test('ST03: 三种成衣入口复用正式类别附加标准，ID及原名称均可精确匹配',()=>{
 const style=listStyleArchives().find(row=>row.productPosition && row.productConfigRefs?.productPositioning?.length)!
 assert.ok(style,'正式夹具必须含类别身份及显示名称')
 const byId=resolveQualityStyleContext({styleId:style.styleId}),byCode=resolveQualityStyleContext({styleCode:style.styleCode})
 assert.deepEqual(byId,byCode)
 const base=getDefaultQualityConfigurations().find(row=>row.kind==='BASIC') as InspectionStandard
 for(const category of [style.productPosition!,...style.productConfigRefs!.productPositioning!]){
  const extra:AdditionalInspectionStandard={...base,kind:'ADDITIONAL',id:'cross-context-extra',familyId:'cross-context-extra',name:'共用正式类别要求',level:'STYLE_CATEGORY',applicability:{sourceKinds:['PRODUCTION_RETURN','WAREHOUSE_STOCK','PRE_PRODUCTION_SAMPLE'],stages:['POST_FINISHING_QC','WAREHOUSE_STOCK_QC','PRE_PRODUCTION_SAMPLE_APPROVAL'],styleCategories:[category]},items:[],overrides:[{targetItemId:base.items[0].id,fields:['criterion'],values:{criterion:'三环节均须额外确认'}}]}
  for(const sourceKind of ['PRODUCTION_RETURN','WAREHOUSE_STOCK','PRE_PRODUCTION_SAMPLE'] as InspectionSourceKind[]){
   const result=resolveInspectionStandard({basicStandards:[base],additionalStandards:[extra],context:{sourceKind,...byId}})
   assert.equal(result.items[0].criterion,'三环节均须额外确认',`${sourceKind} / ${category}`)
  }
 }
 assert.equal(resolveQualityStyleContext({styleId:'not-exist',styleCode:'not-registered'}).styleCategory,undefined)
})
