import test from 'node:test'
import assert from 'node:assert/strict'
import { isThirdPartyPdaHandoverScope } from '../../src/data/fcs/pda-experience-scope.ts'

test('S12.01: actual recipient sewing task allows upstream cut pieces, without authorizing an independent cutting task',()=>{
 const head={factoryId:'THIRD-ONE'},sewing={processCode:'SEWING'}
 assert.equal(isThirdPartyPdaHandoverScope(head,'THIRD-ONE',sewing),true)
 assert.equal(isThirdPartyPdaHandoverScope(head,'THIRD-TWO',sewing),false)
 assert.equal(isThirdPartyPdaHandoverScope(head,'THIRD-ONE',{processCode:'CUTTING'}),false)
 assert.equal(isThirdPartyPdaHandoverScope(head,'THIRD-ONE',{processCode:'WATER_SOLUBLE'}),false)
 assert.equal(isThirdPartyPdaHandoverScope(head,'THIRD-ONE',null),false)
 assert.equal(isThirdPartyPdaHandoverScope(undefined,'THIRD-ONE',sewing),false)
})
test('S12.01: both frozen merged sewing scopes remain supported; withdrawn or mismatched scopes fail closed',()=>{
 const head={factoryId:'SATELLITE'},merged=(codes:string[])=>({processCode:codes[0],taskUnitType:'MERGED_PRODUCTION_TASK' as const,coveredProcesses:codes.map(processCode=>({processCode}))})
 assert.equal(isThirdPartyPdaHandoverScope(head,'SATELLITE',merged(['SEWING','IRON_PACK'])),true)
 assert.equal(isThirdPartyPdaHandoverScope(head,'SATELLITE',merged(['CUTTING','SEWING','IRON_PACK'])),true)
 assert.equal(isThirdPartyPdaHandoverScope(head,'SATELLITE',merged(['SEWING','IRON_PACK','DYE'])),false)
 assert.equal(isThirdPartyPdaHandoverScope(head,'SATELLITE',{...merged(['SEWING','IRON_PACK']),mergedIntoTaskId:'NEW'}),false)
 assert.equal(isThirdPartyPdaHandoverScope(head,'SATELLITE',{processCode:'SEWING',executionEnabled:false}),false)
})

import { createPdaSessionFromUser, getPdaSession, readFactoryPdaExecutionUsers, setPdaSession } from '../../src/data/fcs/store-domain-pda.ts'
import { renderPdaFrame } from '../../src/pages/pda-shell.ts'
import { appStore } from '../../src/state/store.ts'
test('S13.01: ordinary, satellite and special KOL third-party accounts never receive a warehouse tab',()=>{
 const previous=getPdaSession(),previousPath=appStore.getState().pathname
 appStore.navigate('/fcs/pda/exec')
 try{for(const factoryId of ['ID-F021','ID-F011','KOL-GOTO-001']){
  const actor=readFactoryPdaExecutionUsers(factoryId).find(u=>u.roleId==='ROLE_ADMIN')!
  assert.ok(actor,factoryId)
  setPdaSession(createPdaSessionFromUser(actor))
  const html=renderPdaFrame('<main>Current task</main>','exec',{disableTodoAutoOpen:true})
  assert.ok(!html.includes('data-pda-tab="warehouse"'),factoryId)
  assert.ok(html.includes('data-pda-tab="exec"')&&html.includes('data-pda-tab="handover"'),factoryId)
 }}finally{setPdaSession(previous);appStore.navigate(previousPath)}
})

import { isThirdPartyPdaRouteAllowed } from '../../src/router/pda-experience-paths.ts'
test('S12.05: craft-only source-specific execution routes are not third-party sewing task routes',()=>{
 for(const path of ['/fcs/pda/exec/SPECIAL_CRAFT/CRAFT-ONE','/fcs/pda/exec/BINDING_PROCESS_ORDER/BIND-ONE','/fcs/pda/exec/UNKNOWN/ONE'])assert.equal(isThirdPartyPdaRouteAllowed(path),false,path)
 for(const path of ['/fcs/pda/exec/TASK-SEW-ONE','/fcs/pda/exec/MERGED-SEW-IRON','/fcs/pda/exec/MERGED-CUT-SEW-IRON'])assert.equal(isThirdPartyPdaRouteAllowed(path),true,path)
})
