import test from 'node:test'
import assert from 'node:assert/strict'
import { resolveCentralCuttingPickupSources, centralCuttingSourceMatchesScan } from '../../src/data/fcs/cutting/central-cutting-source.ts'
const factory={id:'CENTRAL-A',factoryTier:'CENTRAL',status:'active'}
const source={cutOrderId:'formal-cut-1',cutOrderNo:'CUT-001',productionOrderId:'PO-001',cuttingTaskId:'TASK-001',cuttingTaskNo:'TASK-001',cuttingTaskAssignmentStatus:'ASSIGNED',cuttingTaskAssigneeFactoryId:'CENTRAL-A',executionRoute:'OWN_CUTTING',techPackVersionId:'TECH-1',materialSku:'FAB-001',materialName:'Black twill',materialImageUrl:'/materials/fei-ticket/black-stretch-twill.png',materialUnit:'米'}
const node={nodeId:'node-001',version:1,status:'OPEN',prepOrderId:'PREP-001',productionOrderId:'PO-001',itemCount:1,items:[{prepLineId:'LINE-001',materialSku:'FAB-001',materialType:'面料',unit:'yard',currentAvailableQty:180}]}
const projection={order:{prepOrderId:'PREP-001',productionOrderId:'PO-001',isClosed:false},lines:[{prepLineId:'LINE-001',cutOrderId:'legacy-alias',cutOrderNo:'CUT-001',materialSku:'FAB-001',unit:'yard'}]}
const tasks=[{taskId:'TASK-001__ORDER',taskNo:'TASK-001__ORDER',rootTaskNo:'TASK-001',productionOrderId:'PO-001',assignedFactoryId:'CENTRAL-A',assignmentStatus:'ASSIGNED',status:'NOT_STARTED',executionEnabled:true}]
const resolve=(n=node,p=projection,s=[source],f=factory,t=tasks)=>resolveCentralCuttingPickupSources(n as never,p as never,s as never,f,t as never)

test('C01.01: exact formal source, material, production and current execution assignment bind the whole incoming node',()=>{
 const bound=resolve()!;assert.ok(bound);assert.equal(bound[0].cutOrderId,'formal-cut-1');assert.deepEqual(bound[0].executionTaskIds,['TASK-001__ORDER'])
 assert.equal(bound[0].sourceUnit,'yard');assert.equal(bound[0].taskUnit,'米');assert.equal(node.items[0].currentAvailableQty,180)
})
test('C01.01: unassigned, other factory, cancelled, noncentral or ambiguous sources never enter an employee receive queue',()=>{
 assert.equal(resolve(node,projection,[{...source,cuttingTaskAssigneeFactoryId:'',cuttingTaskAssignmentStatus:'UNASSIGNED'}]),undefined)
 assert.equal(resolve(node,projection,[{...source,cuttingTaskAssigneeFactoryId:'CENTRAL-B'}]),undefined)
 assert.equal(resolve(node,projection,[source],{...factory,factoryTier:'THIRD_PARTY'}),undefined)
 assert.equal(resolve(node,projection,[source],factory,[{...tasks[0],status:'CANCELLED'}]),undefined)
 assert.equal(resolve(node,projection,[source,{...source,cutOrderId:'formal-cut-2'}]),undefined)
 assert.equal(resolve(node,projection,[{...source,productionOrderId:'PO-OTHER'}]),undefined)
 assert.equal(resolve(node,projection,[{...source,materialSku:'FAB-OTHER'}]),undefined)
})
test('C01.01: stale exact IDs do not fall back to another same-number source; mixed nodes are not silently split',()=>{
 assert.equal(resolve(node,{...projection,lines:[{...projection.lines[0],cutOrderId:source.cutOrderId}]},[{...source,materialSku:'FAB-OTHER'},{...source,cutOrderId:'formal-cut-2'}]),undefined)
 assert.equal(resolve({...node,itemCount:2,items:[...node.items,{...node.items[0],prepLineId:'LINE-OTHER',materialType:'辅料'}]}),undefined)
 assert.equal(resolve({...node,items:[{...node.items[0],unit:'米'}]}),undefined)
})


test('C01.01: current Web labels and trace QR retain formal source identity', async () => {
 const { buildCutOrderQrValue, encodeCutOrderQr } = await import('../../src/data/fcs/cutting/qr-codes.ts')
 assert.ok(centralCuttingSourceMatchesScan(source, buildCutOrderQrValue(source.cutOrderNo)))
 assert.ok(centralCuttingSourceMatchesScan(source, buildCutOrderQrValue(source.cutOrderId)))
 assert.ok(centralCuttingSourceMatchesScan(source, buildCutOrderQrValue('legacy-id'), ['legacy-id']))
 const value = encodeCutOrderQr({ ...source, productionOrderNo: 'PO-001', issuedAt: '2026-10-21 09:00:00' }).qrValue
 assert.ok(centralCuttingSourceMatchesScan(source, value))
 assert.equal(centralCuttingSourceMatchesScan({ ...source, productionOrderId: 'OTHER' }, value), false)
 assert.equal(centralCuttingSourceMatchesScan({ ...source, materialSku: 'OTHER' }, value), false)
 assert.equal(centralCuttingSourceMatchesScan(source, 'FCSQR:%invalid'), false)
})
