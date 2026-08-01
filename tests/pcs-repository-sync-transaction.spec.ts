import assert from 'node:assert/strict'

import { listStyleArchives, resetStyleArchiveRepository } from '../src/data/pcs-style-archive-repository.ts'
import {
  createEngineeringMasterOrder,
  getEngineeringMasterOrderStoreSnapshot,
  resetEngineeringMasterRepository,
  runEngineeringMasterRepositoryTransaction,
} from '../src/data/pcs-engineering-master-repository.ts'
import {
  getTechnicalDataVersionStoreSnapshot,
  pushTechnicalDataVersionPendingItem,
  resetTechnicalDataVersionRepository,
  runTechnicalDataVersionRepositoryTransaction,
} from '../src/data/pcs-technical-data-version-repository.ts'

resetStyleArchiveRepository()
resetEngineeringMasterRepository()
const style = listStyleArchives()[0]
assert.ok(style, '应存在款式档案演示数据')

const engineeringBeforeAsync = getEngineeringMasterOrderStoreSnapshot()
const asyncEngineeringOperation = (async () => {
  await Promise.resolve()
  createEngineeringMasterOrder({
    styleId: style.styleId,
    styleCode: style.styleCode,
    merchandiserName: '事务测试跟单',
  })
}) as unknown as () => unknown
assert.throws(
  () => runEngineeringMasterRepositoryTransaction(asyncEngineeringOperation),
  /仅支持同步操作.*AsyncFunction/,
  '工程主单仓储必须立即拒绝异步回调',
)
await Promise.resolve()
assert.deepEqual(
  getEngineeringMasterOrderStoreSnapshot(),
  engineeringBeforeAsync,
  '异步回调必须在执行前被拒绝，await 后不得留下任何工程主单写入',
)

const engineeringBeforeThenable = getEngineeringMasterOrderStoreSnapshot()
const engineeringThenableOperation = (() => {
  return {
    then: (resolve: (value: string) => void) => {
      createEngineeringMasterOrder({
        styleId: style.styleId,
        styleCode: style.styleCode,
        merchandiserName: 'thenable 测试跟单',
      })
      resolve('done')
    },
  }
}) as unknown as () => unknown
assert.throws(
  () => runEngineeringMasterRepositoryTransaction(engineeringThenableOperation),
  /仅支持同步操作.*Promise 或 thenable/,
  '工程主单仓储必须拒绝自定义 thenable',
)
await Promise.resolve()
assert.deepEqual(getEngineeringMasterOrderStoreSnapshot(), engineeringBeforeThenable, 'thenable 回调不得留下工程主单写入')

resetTechnicalDataVersionRepository()
const technicalBeforeAsync = getTechnicalDataVersionStoreSnapshot()
const asyncTechnicalOperation = (async () => {
  await Promise.resolve()
  pushTechnicalDataVersionPendingItem({
    pendingId: 'pending-async-transaction-test',
    rawTechnicalCode: 'TD-ASYNC-TEST',
    rawStyleField: 'SPU-ASYNC-TEST',
    rawProjectField: 'PRJ-ASYNC-TEST',
    rawVersionLabel: 'V1',
    reason: '异步事务回滚测试',
    discoveredAt: '2026-08-02 10:00:00',
  })
}) as unknown as () => unknown
assert.throws(
  () => runTechnicalDataVersionRepositoryTransaction(asyncTechnicalOperation),
  /仅支持同步操作.*AsyncFunction/,
  '技术资料仓储必须立即拒绝异步回调',
)
await Promise.resolve()
assert.deepEqual(
  getTechnicalDataVersionStoreSnapshot(),
  technicalBeforeAsync,
  '异步回调必须在执行前被拒绝，await 后不得留下任何技术资料写入',
)

const technicalBeforeThenable = getTechnicalDataVersionStoreSnapshot()
const technicalThenableOperation = (() => {
  return {
    then: (resolve: (value: string) => void) => {
      pushTechnicalDataVersionPendingItem({
        pendingId: 'pending-thenable-transaction-test',
        rawTechnicalCode: 'TD-THENABLE-TEST',
        rawStyleField: 'SPU-THENABLE-TEST',
        rawProjectField: 'PRJ-THENABLE-TEST',
        rawVersionLabel: 'V1',
        reason: 'thenable 事务回滚测试',
        discoveredAt: '2026-08-02 10:05:00',
      })
      resolve('done')
    },
  }
}) as unknown as () => unknown
assert.throws(
  () => runTechnicalDataVersionRepositoryTransaction(technicalThenableOperation),
  /仅支持同步操作.*Promise 或 thenable/,
  '技术资料仓储必须拒绝自定义 thenable',
)
await Promise.resolve()
assert.deepEqual(getTechnicalDataVersionStoreSnapshot(), technicalBeforeThenable, 'thenable 回调不得留下技术资料写入')

console.log('pcs-repository-sync-transaction.spec.ts PASS')
