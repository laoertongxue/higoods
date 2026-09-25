import test from 'node:test'
import assert from 'node:assert/strict'
import {getCuttingRuntimeEventProjectionRevision,installCuttingCommittedEventReader,type CuttingRuntimeEvent} from '../../src/data/fcs/cutting/cutting-runtime-event-ledger.ts'
test('部位票缓存感知已提交事件版本，重复读取同一版本不失效',()=>{
 const reader=(events:CuttingRuntimeEvent[])=>events
 const before=getCuttingRuntimeEventProjectionRevision()
 installCuttingCommittedEventReader(reader,1)
 assert.equal(getCuttingRuntimeEventProjectionRevision(),before+1)
 installCuttingCommittedEventReader(reader,1)
 assert.equal(getCuttingRuntimeEventProjectionRevision(),before+1)
 installCuttingCommittedEventReader(reader,2)
 assert.equal(getCuttingRuntimeEventProjectionRevision(),before+2)
})
