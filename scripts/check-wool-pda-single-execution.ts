import assert from 'node:assert/strict'
import {readWoolStore} from '../src/data/fcs/wool-domain/store.ts'
import {resolveWoolPdaScan} from '../src/data/fcs/wool-pda-scan.ts'
import {validateWoolPdaTaskAccess} from '../src/data/fcs/wool-pda-task-access.ts'
import {buildWoolMobileTaskProjection} from '../src/data/fcs/wool-domain/mobile.ts'
import {getWoolAllowedActions} from '../src/data/fcs/wool-domain/queries.ts'
const store=readWoolStore()
for(const stage of ['KNITTING','LINKING'] as const){const o=store.workOrders[`WOOL-STAGE-010:${stage}`];const projection=buildWoolMobileTaskProjection(o.woolOrderId);assert.ok(!stage.includes('LINKING')||!getWoolAllowedActions(o.woolOrderId).includes('ASSOCIATE_MACHINE'));assert.equal(validateWoolPdaTaskAccess({taskId:o.taskId,currentFactoryId:o.factoryId}).canAccess,true);assert.equal(validateWoolPdaTaskAccess({taskId:o.taskId,currentFactoryId:'WRONG'}).canAccess,false);assert.equal(validateWoolPdaTaskAccess({taskId:o.taskId}).canAccess,false);if(stage==='LINKING'){assert.ok(projection.factRecords.some(r=>r.recordType==='PIECE_RECEIPT'));assert.ok(projection.factRecords.some(r=>r.recordType==='INTERNAL_RECEIPT'));assert.equal(resolveWoolPdaScan(o.woolOrderNo,o.factoryId,'RECEIVE').status,'MATCH')}}
const o=store.workOrders['WOOL-STAGE-008:KNITTING'];assert.equal(resolveWoolPdaScan(o.productionOrderNo,o.factoryId,'RECEIVE').status,'MULTIPLE');assert.equal(resolveWoolPdaScan(o.woolOrderNo,'WRONG','HANDOVER').status,'FORBIDDEN')
console.log('PASS A20 阶段扫码候选、回货识别、错厂/无会话阻断、缝盘无设备、移动实际接收记录')
