import test from 'node:test'
import assert from 'node:assert/strict'
import { menusBySystem } from '../../src/data/app-shell-config.ts'
import { routes as centralRoutes } from '../../src/router/routes-central-pda.ts'
import { isThirdPartyPdaRouteAllowed } from '../../src/router/pda-experience-paths.ts'

test('S01/S02: the two FCS PDA groups lead to separate experiences and expose only their allowed actions',()=>{
 const groups=menusBySystem.fcs,central=groups.find(group=>group.title==='中央工厂 PDA'),third=groups.find(group=>group.title==='三方工厂 PDA')
 assert.ok(central);assert.ok(third)
 assert.equal(groups.indexOf(third),groups.indexOf(central)+1)
 assert.deepEqual(central.items.map(item=>item.title),['接收','执行','仓管'])
 for(const item of central.items){assert.ok(item.href?.startsWith('/fcs/pda/central/'));assert.ok(centralRoutes.exactRoutes?.[item.href!])}
 assert.deepEqual(third.items.map(item=>item.title),['登录','入驻','接单','执行','交接','结算'])
 for(const item of third.items)assert.ok(item.href&&isThirdPartyPdaRouteAllowed(item.href))
 assert.ok(!third.items.some(item=>/warehouse|washing|central/.test(item.href||'')))
 assert.ok(!groups.some(group=>['工厂入驻&登录','工厂端移动应用'].includes(group.title)))
})
