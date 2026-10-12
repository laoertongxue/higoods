import test from 'node:test'
import assert from 'node:assert/strict'
import {renderPcsConfigWorkspacePage,handlePcsConfigWorkspaceEvent} from '../src/pages/pcs-config-workspace.ts'
const event=(action:string,data:Record<string,string>={})=>handlePcsConfigWorkspaceEvent({closest:()=>({dataset:{pcsConfigWorkspaceAction:action,...data}})} as any)
test('Current category editor has no revision, usage or conversion workflows',async()=>{
 await event('switch-dimension',{dimensionId:'templates'});let html=renderPcsConfigWorkspacePage();assert.match(html,/梭织面料/);assert.doesNotMatch(html,/当前版本|版本状态|当前引用/)
 await event('detail',{id:'material-category-fabric-SZ'});html=renderPcsConfigWorkspacePage();assert.doesNotMatch(html,/版本记录|新建版本|使用情况|版本换算依据/)
 await event('edit');assert.match(renderPcsConfigWorkspacePage(),/保存/);await event('back')
})
