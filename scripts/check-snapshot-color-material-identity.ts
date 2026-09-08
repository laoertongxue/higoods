// E2E-003/005: a confirmed color-specific material must survive demand snapshot alignment.
import assert from 'node:assert/strict'
import { alignWoolColorMaterialMappingsForDemand } from '../src/data/fcs/production-tech-pack-snapshot-builder.ts'
const mappings = ['Black','White'].map((color, i) => ({
  id:`COLOR-${i}`,spuCode:'ACCEPT-SPU',colorCode:color,colorName:color,status:'CONFIRMED',generatedMode:'AUTO',
  lines:[{id:`LINE-${i}`,bomItemId:'BOM-MAIN',materialCode:`RAW-${color}`,materialName:`${color} cotton`,materialType:'面料',patternId:'PATTERN',patternName:'纸样',pieceId:'FRONT',pieceName:'前片',pieceCountPerUnit:1,unit:'米',applicableSkuCodes:[`OLD-${i}`],sourceMode:'AUTO'}]
}))
const out=alignWoolColorMaterialMappingsForDemand({mappings:mappings as any,demandSkuLines:[{skuCode:'NEW-BLACK-S',colorCode:'Black',colorName:'Black'},{skuCode:'NEW-WHITE-M',colorCode:'White',colorName:'White'}],fallbackBomItemId:'BOM-MAIN',mappingIdPrefix:'SNAP',resolveMaterialInfo:()=>({code:'BOM-MAIN',name:'主面料'})})
assert.deepEqual(out.map(m=>m.lines[0].materialCode),['RAW-Black','RAW-White'],'冻结不能将已确认的按色物料码覆盖成BOM行ID')
assert.deepEqual(out.map(m=>m.lines[0].applicableSkuCodes),[['NEW-BLACK-S'],['NEW-WHITE-M']])
assert.deepEqual(out.map(m=>m.lines[0].materialName),['Black cotton','White cotton'])
assert.deepEqual(mappings[0].lines[0].applicableSkuCodes,['OLD-0'],'不得改发布源')
console.log('PASS confirmed color-specific material identity retained; demand SKU alignment and source immutability')
