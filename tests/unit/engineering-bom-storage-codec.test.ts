import assert from 'node:assert/strict'
import test from 'node:test'
import {parseEngineeringBomSnapshot as parse, serializeEngineeringBomSnapshot as serialize} from '../../src/data/pcs-engineering-bom-storage.ts'

test('BOM dictionary preserves old JSON and all snapshot values without mutating input',()=>{
 const value={version:2,records:Array.from({length:134},(_,i)=>({id:`BOM-${i}`,ownerId:'ES-ID-DR-001',styleCode:'STYLE-PRJ-202603-012',styleImageUrl:'/dress-sample-1.jpg',customCosts:[{title:'车位费',amount:12000}],materialLines:[{usage:1.25,optional:undefined,items:[],flag:false,note:null}]})),plans:[]}
 const original=JSON.stringify(value)
 assert.deepEqual(parse(original),JSON.parse(original))
 const compact=serialize(value)
 assert.ok(compact.length<original.length*0.7)
 assert.deepEqual(parse(compact),JSON.parse(original))
 assert.equal(JSON.stringify(value),original)
 assert.deepEqual(parse(serialize({version:2,records:[],plans:[]})),{version:2,records:[],plans:[]})
})

test('BOM dictionary rejects missing references instead of replacing data silently',()=>{
 assert.throws(()=>parse(JSON.stringify({format:'higood-bom-dictionary-v1',strings:[],data:[2,0]})),/引用缺失/)
})
