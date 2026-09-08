import assert from 'node:assert/strict'
import {listBusinessFactoryMasterRecords} from '../src/data/fcs/factory-master-store.ts'
import {listFactoryPdaUsers} from '../src/data/fcs/store-domain-pda.ts'
import {resolveCuttingTaskExecutionRoute} from '../src/data/fcs/cutting/cutting-task-routing.ts'
const own=listBusinessFactoryMasterRecords().find(factory=>factory.id==='OWN-CUTTING-001')
assert.ok(own,'own cutting execution requires an eligible business prototype factory, not excluded F090')
assert.equal(own.isTestFactory,false)
assert.ok(own.taskAcceptanceConfig?.singleProcessEnabled)
assert.ok(own.processAbilities.some(ability=>ability.processCode==='CUT_PANEL'&&ability.status!=='DISABLED'))
assert.ok(listFactoryPdaUsers(own.id).some(user=>user.roleId==='ROLE_ADMIN'&&user.status==='ACTIVE'))
assert.equal(resolveCuttingTaskExecutionRoute(own.id),'OWN_CUTTING')
assert.ok(!listBusinessFactoryMasterRecords().some(factory=>factory.id==='F090'),'test factory exclusion remains')
console.log('PASS own cutting factory: eligible original dispatch source, active PDA role, own execution route; F090 stays excluded')
