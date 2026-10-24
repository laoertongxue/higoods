import assert from 'node:assert/strict'
import test from 'node:test'
import { renderPdaTaskReceiveDetailPage } from '../../src/pages/pda-task-receive-detail.ts'
import { acceptPdaTaskWithRuntimeFallback, rejectPdaTaskWithRuntimeFallback } from '../../src/pages/pda-task-receive.ts'
import { assertThirdPartyReceiveTaskAllowed } from '../../src/pages/pda-third-party-scope.ts'
import { createPdaSessionFromUser, getPdaSession, readFactoryPdaExecutionUsers, setPdaSession } from '../../src/data/fcs/store-domain-pda.ts'
import { getDyeWorkOrderByTaskId } from '../../src/data/fcs/dyeing-task-domain.ts'
import { appStore } from '../../src/state/store.ts'

const THIRD_FACTORY = 'ID-F021'
const CENTRAL_FACTORY = 'F090'
const NON_SEWING_TASK = 'TASK-DYE-000724'

function withSession(factoryId: string, run: () => void): void {
  const previous = getPdaSession(), previousPath = appStore.getState().pathname
  const actor = readFactoryPdaExecutionUsers(factoryId).find((user) => user.roleId === 'ROLE_ADMIN')
  assert.ok(actor, factoryId)
  setPdaSession(createPdaSessionFromUser(actor))
  appStore.navigate(`/fcs/pda/task-receive/${NON_SEWING_TASK}`)
  try { run() } finally {
    setPdaSession(previous)
    appStore.navigate(previousPath)
  }
}

test('S12: third-party detail never exposes accept, quote or reject actions for a non-sewing task', () => {
  withSession(THIRD_FACTORY, () => {
    const html = renderPdaTaskReceiveDetailPage(NON_SEWING_TASK)
    assert.ok(!html.includes('data-pda-trd-action="accept"'), 'non-sewing task must not expose accept')
    assert.ok(!html.includes('data-pda-trd-action="open-quote"'), 'non-sewing task must not expose quote')
    assert.ok(!html.includes('data-pda-trd-action="open-reject"'), 'non-sewing task must not expose reject')
    assert.ok(html.includes('未找到任务'), 'out-of-scope detail must fail closed')
  })
})

test('S12: the central owner still reads the same task detail without the third-party block', () => {
  withSession(CENTRAL_FACTORY, () => {
    const html = renderPdaTaskReceiveDetailPage(NON_SEWING_TASK)
    assert.ok(!html.includes('未找到任务'), 'central factory detail must stay available')
  })
})

test('S12: shared receive guard allows only the three third-party sewing scopes', () => {
  const merged = (codes: string[]) => ({ processCode: codes[0], taskUnitType: 'MERGED_PRODUCTION_TASK' as const, coveredProcesses: codes.map(processCode => ({ processCode })) })
  assert.doesNotThrow(() => assertThirdPartyReceiveTaskAllowed(THIRD_FACTORY, { processCode: 'SEWING' }, '接单'))
  assert.doesNotThrow(() => assertThirdPartyReceiveTaskAllowed(THIRD_FACTORY, merged(['SEWING', 'IRON_PACK']), '接单'))
  assert.doesNotThrow(() => assertThirdPartyReceiveTaskAllowed(THIRD_FACTORY, merged(['CUTTING', 'SEWING', 'IRON_PACK']), '接单'))
  assert.throws(() => assertThirdPartyReceiveTaskAllowed(THIRD_FACTORY, { processCode: 'DYE' }, '接单'), /三方工厂只能处理/)
  assert.throws(() => assertThirdPartyReceiveTaskAllowed(THIRD_FACTORY, merged(['SEWING', 'IRON_PACK', 'DYE']), '接单'), /三方工厂只能处理/)
  assert.doesNotThrow(() => assertThirdPartyReceiveTaskAllowed(CENTRAL_FACTORY, { processCode: 'DYE' }, '接单'))
})

test('S12: third-party accept and reject refuse a non-sewing task before any write', () => {
  const before = getDyeWorkOrderByTaskId(NON_SEWING_TASK)?.acceptanceStatus
  withSession(THIRD_FACTORY, () => {
    assert.throws(() => acceptPdaTaskWithRuntimeFallback(NON_SEWING_TASK, THIRD_FACTORY, '三方测试'), /三方工厂只能处理/)
    assert.equal(getDyeWorkOrderByTaskId(NON_SEWING_TASK)?.acceptanceStatus, before, 'refused accept must not change the order')
    assert.throws(() => rejectPdaTaskWithRuntimeFallback(NON_SEWING_TASK, THIRD_FACTORY, '三方测试', '2026-10-24 00:00:00', '三方测试'), /三方工厂只能处理/)
    assert.equal(getDyeWorkOrderByTaskId(NON_SEWING_TASK)?.acceptanceStatus, before, 'refused reject must not change the order')
  })
})