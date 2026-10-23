import test from 'node:test'
import assert from 'node:assert/strict'
import {
  captureStyleArchiveRepositoryState, restoreStyleArchiveRepositoryState,
  getStyleArchiveById, getStyleArchiveStoreSnapshot, commitStyleArchiveStoreSnapshot,
  getStyleCurrentTechPackVersionId,
} from '../../src/data/pcs-style-archive-repository.ts'

test('C01.LOAD.1: the current technical link comes from each formal style record, not a style-code fallback',()=>{
  const snapshot=getStyleArchiveStoreSnapshot()
  assert.ok(snapshot.records.length>0)
  for(const row of snapshot.records)assert.equal(getStyleCurrentTechPackVersionId(row.styleId),getStyleArchiveById(row.styleId)?.currentTechPackVersionId||null)
  assert.equal(getStyleCurrentTechPackVersionId('unknown-formal-style'),null)
})

test('C01.LOAD.1: a changed or cleared formal link is read on the next call without retaining an old version',()=>{
  const saved=captureStyleArchiveRepositoryState()
  try{
    const snapshot=getStyleArchiveStoreSnapshot(),id=snapshot.records[0].styleId
    snapshot.records[0].currentTechPackVersionId='actual-current-reference-one'
    commitStyleArchiveStoreSnapshot(snapshot);assert.equal(getStyleCurrentTechPackVersionId(id),'actual-current-reference-one')
    snapshot.records[0].currentTechPackVersionId='actual-current-reference-two'
    commitStyleArchiveStoreSnapshot(snapshot);assert.equal(getStyleCurrentTechPackVersionId(id),'actual-current-reference-two')
    snapshot.records[0].currentTechPackVersionId=undefined
    commitStyleArchiveStoreSnapshot(snapshot);assert.equal(getStyleCurrentTechPackVersionId(id),null)
  }finally{restoreStyleArchiveRepositoryState(saved,false)}
})
