import assert from 'node:assert/strict'
import test from 'node:test'
import {
  getThirdPartyPdaTaskMode,
  isCentralPdaFactory,
  isThirdPartyPdaFactory,
  isThirdPartyPdaRouteAllowed,
  type PdaTaskScope,
} from '../../src/data/fcs/pda-experience-scope.ts'

const merged = (codes: string[], declared?: string): PdaTaskScope => ({
  processCode: 'MERGED_PRODUCTION', taskUnitType: 'MERGED_PRODUCTION_TASK', mergedTaskType: declared,
  coveredProcesses: codes.map((processCode) => ({ processCode, processName: '显示名称不参与判定', sourceArtifactIds: [] })),
})

test('S08-S10: only the three actual sewing scopes qualify; order and aliases follow the current business normalizer', () => {
  assert.equal(getThirdPartyPdaTaskMode({ processCode: 'SEWING' }), 'SEWING')
  assert.equal(getThirdPartyPdaTaskMode({ processCode: 'PROC_SEW', defaultDocType: 'TASK' }), 'SEWING')
  assert.equal(getThirdPartyPdaTaskMode(merged(['IRON_PACK', 'SEWING'], 'SEWING_IRON_PACK')), 'SEWING_IRON_PACK')
  assert.equal(getThirdPartyPdaTaskMode(merged(['IRON_PACK', 'SEW', 'CUT_PANEL'], 'CUTTING_SEWING_IRON_PACK')), 'CUTTING_SEWING_IRON_PACK')
})

test('S08-S12: unknown, nonsewing, extra processes and inconsistent merged scopes fail closed', () => {
  for (const processCode of ['PRINT', 'DYE', 'WATER_SOLUBLE', 'WASHING', 'KNITTING', 'SPECIAL_SEWING', 'SEWING_PRINT', 'BUTTONHOLE', 'IRON_PACK', 'CUTTING', '', 'UNKNOWN']) {
    assert.equal(getThirdPartyPdaTaskMode({ processCode }), null, processCode)
  }
  for (const codes of [['SEWING', 'PRINT'], ['CUTTING', 'SEWING'], ['SEWING', 'IRON_PACK', 'DYE'], ['SEWING', 'IRON_PACK', 'UNKNOWN']]) {
    assert.equal(getThirdPartyPdaTaskMode(merged(codes)), null, codes.join('+'))
  }
  assert.equal(getThirdPartyPdaTaskMode(merged(['SEWING', 'IRON_PACK'], 'CUTTING_SEWING_IRON_PACK')), null)
  assert.equal(getThirdPartyPdaTaskMode({ ...merged(['SEWING', 'IRON_PACK']), processBusinessCode: 'DYE' }), null)
  assert.equal(getThirdPartyPdaTaskMode({ ...merged(['SEWING']), taskUnitType: 'SINGLE_PROCESS_TASK', processCode: 'DYE' }), null)
  assert.equal(getThirdPartyPdaTaskMode({ ...merged(['SEWING', 'IRON_PACK']), processBusinessCode: 'SEWING_IRON_PACK' }), 'SEWING_IRON_PACK')
  assert.equal(getThirdPartyPdaTaskMode({ ...merged(['SEWING', 'IRON_PACK']), taskUnitType: 'SINGLE_PROCESS_TASK' }), null)
  assert.equal(getThirdPartyPdaTaskMode({ ...merged(['CUTTING', 'SEWING', 'IRON_PACK']), taskUnitType: 'WHOLE_ORDER_TASK' }), null)
  assert.equal(getThirdPartyPdaTaskMode({ processCode: 'SEWING', executionEnabled: false }), null)
  assert.equal(getThirdPartyPdaTaskMode({ processCode: 'SEWING', mergedIntoTaskId: 'CURRENT-MERGED' }), null)
  assert.equal(getThirdPartyPdaTaskMode({ processCode: 'SEWING', defaultDocType: 'PREPARATION_ORDER' }), null)
})

test('S11: central ownership and third-party/satellite sewing ownership remain distinct', () => {
  assert.equal(isThirdPartyPdaFactory({ factoryTier: 'THIRD_PARTY', factoryType: 'THIRD_SEWING' }), true)
  assert.equal(isThirdPartyPdaFactory({ factoryTier: 'SATELLITE', factoryType: 'SATELLITE_SEWING' }), true)
  assert.equal(isThirdPartyPdaFactory({ factoryTier: 'SATELLITE', factoryType: 'SATELLITE_FINISHING' }), false)
  assert.equal(isThirdPartyPdaFactory({ factoryTier: 'CENTRAL', factoryType: 'CENTRAL_GARMENT' }), false)
  assert.equal(isThirdPartyPdaFactory({ factoryTier: 'CENTRAL', factoryType: 'THIRD_SEWING' }), false)
  assert.equal(isThirdPartyPdaFactory({ factoryTier: 'THIRD_PARTY', factoryType: 'THIRD_SEWING', isTestFactory: true }), false)
  assert.equal(isThirdPartyPdaFactory({ factoryTier: 'THIRD_PARTY', factoryType: 'THIRD_SEWING', testFactoryScope: 'ALL_PROCESS_CRAFT' }), false)
  assert.equal(isThirdPartyPdaFactory(undefined), false)
  assert.equal(isCentralPdaFactory({ factoryTier: 'CENTRAL', factoryType: 'CENTRAL_CUTTING' }), true)
  assert.equal(isCentralPdaFactory({ factoryTier: 'SATELLITE', factoryType: 'SATELLITE_FINISHING' }), false)
  assert.equal(isCentralPdaFactory({ factoryTier: 'CENTRAL', factoryType: 'CENTRAL_GARMENT', isTestFactory: true }), true)
})

test('S13: third-party deep links cannot enter warehouse/craft pages; sewing cut-piece receipt stays accessible', () => {
  for (const path of ['/fcs/pda/exec', '/fcs/pda/exec/SEW-001', '/fcs/pda/handover/HOH-001?batch=B01', '/fcs/pda/task-receive', '/fcs/pda/settlement', '/fcs/pda/cutting/simple-cut-piece-handover?taskSheetNo=RW-001']) {
    assert.equal(isThirdPartyPdaRouteAllowed(path), true, path)
  }
  for (const path of ['/fcs/pda/warehouse', '/fcs/pda/warehouse/wait-process?factoryId=other', '/fcs/pda/warehouse/outbound-records', '/fcs/pda/wool/pending-receipts', '/fcs/pda/washing', '/fcs/pda/post-finishing/execute', '/fcs/pda/cutting/spreading/CUT-001', '/fcs/pda/handover/sewing-self-return', '/fcs/pda/factory-receipts']) {
    assert.equal(isThirdPartyPdaRouteAllowed(path), false, path)
  }
})

test('WP1 integration: actual third-party/satellite factory lists retain sewing work and contain no other process', async () => {
  const [{ listFactoryMasterRecords }, { listMobileExecutionTasks }] = await Promise.all([
    import('../../src/data/fcs/factory-master-store.ts'),
    import('../../src/data/fcs/mobile-execution-task-index.ts'),
  ])
  const factories = listFactoryMasterRecords().filter(isThirdPartyPdaFactory)
  assert.ok(factories.some((factory) => factory.factoryTier === 'SATELLITE'))
  assert.ok(factories.some((factory) => factory.factoryTier === 'THIRD_PARTY'))
  let visible = 0
  for (const factory of factories) {
    for (const task of listMobileExecutionTasks({ currentFactoryId: factory.id })) {
      visible += 1
      assert.ok(getThirdPartyPdaTaskMode(task), `${factory.id}: ${task.taskId}`)
    }
  }
  assert.ok(visible > 0, 'A blank list must not make the scope test pass')
})
