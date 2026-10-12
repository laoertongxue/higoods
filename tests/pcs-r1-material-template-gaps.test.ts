import test from 'node:test'
import assert from 'node:assert/strict'
import {getMaterialTemplate,saveMaterialTemplate} from '../src/data/pcs-material-config.ts'
import {validateMaterialTemplateValues,validateMaterialBoundFields} from '../src/data/pcs-material-attributes.ts'
test('Current classification fields keep conditional fastening and fixed package/process bindings',()=>{
 const t=getMaterialTemplate('accessory','扣合类')
 assert.throws(()=>validateMaterialTemplateValues(t,'root',{material:'钢',installationType:'机打',fastening:'孔式',holeCount:1.5},true),/整数/)
 assert.throws(()=>validateMaterialTemplateValues(t,'root',{material:'钢',installationType:'机打',fastening:'脚式',holeCount:2},false),/孔数/)
 assert.throws(()=>saveMaterialTemplate({...t,fields:t.fields.map(f=>f.modelBinding==='process.inputSkuId'?{...f,required:false}:f)},'管理员'),/不能改变/)
 assert.throws(()=>validateMaterialBoundFields(t,'process',{},true,'DYEING'),/直接投入/)
 assert.throws(()=>saveMaterialTemplate({...t,categoryNames:{zh:'错误分类'}},'管理员'),/中文分类名称/)
})
