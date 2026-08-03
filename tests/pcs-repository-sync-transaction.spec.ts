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
import {
  getTechPackVersionLogStoreSnapshot,
  resetTechPackVersionLogRepository,
} from '../src/data/pcs-tech-pack-version-log-repository.ts'
import {
  getTechPackReviewNotificationStoreSnapshot,
  resetTechPackReviewNotificationRepository,
} from '../src/data/pcs-tech-pack-review-notification-repository.ts'

const TECHNICAL_VERSION_STORAGE_KEY = 'higood-pcs-technical-data-version-store-v5'
const REVIEW_LOG_STORAGE_KEY = 'higood-pcs-tech-pack-version-log-store-v1'
const REVIEW_NOTIFICATION_STORAGE_KEY = 'higood-pcs-tech-pack-review-notification-store-v1'

function installCountingLocalStorage(): { getSetCount: (key?: string) => number; restore: () => void } {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
  const values = new Map<string, string>()
  let setCount = 0
  const setCountByKey = new Map<string, number>()
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => {
        setCount += 1
        setCountByKey.set(key, (setCountByKey.get(key) ?? 0) + 1)
        values.set(key, value)
      },
      removeItem: (key: string) => values.delete(key),
    },
  })
  return {
    getSetCount: (key?: string) => key ? setCountByKey.get(key) ?? 0 : setCount,
    restore: () => {
      if (previous) Object.defineProperty(globalThis, 'localStorage', previous)
      else Reflect.deleteProperty(globalThis, 'localStorage')
    },
  }
}

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
const engineeringStorage = installCountingLocalStorage()
const engineeringWritesBeforeThenable = engineeringStorage.getSetCount()
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
assert.equal(
  engineeringStorage.getSetCount() - engineeringWritesBeforeThenable,
  1,
  '工程主单 thenable 事务只需回滚一次，不得重复恢复同一快照',
)
engineeringStorage.restore()

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

const technicalStorage = installCountingLocalStorage()
resetTechnicalDataVersionRepository()
resetTechPackVersionLogRepository()
resetTechPackReviewNotificationRepository()
const technicalBeforeThenable = getTechnicalDataVersionStoreSnapshot()
const snapshotReadCounts = {
  technical: technicalStorage.getSetCount(TECHNICAL_VERSION_STORAGE_KEY),
  logs: technicalStorage.getSetCount(REVIEW_LOG_STORAGE_KEY),
  notifications: technicalStorage.getSetCount(REVIEW_NOTIFICATION_STORAGE_KEY),
}
getTechnicalDataVersionStoreSnapshot()
getTechPackVersionLogStoreSnapshot()
getTechPackReviewNotificationStoreSnapshot()
assert.deepEqual({
  technical: technicalStorage.getSetCount(TECHNICAL_VERSION_STORAGE_KEY),
  logs: technicalStorage.getSetCount(REVIEW_LOG_STORAGE_KEY),
  notifications: technicalStorage.getSetCount(REVIEW_NOTIFICATION_STORAGE_KEY),
}, snapshotReadCounts, '事务快照读取不得被误计为仓储恢复写入')
const technicalWritesBeforeThenable = {
  technical: technicalStorage.getSetCount(TECHNICAL_VERSION_STORAGE_KEY),
  logs: technicalStorage.getSetCount(REVIEW_LOG_STORAGE_KEY),
  notifications: technicalStorage.getSetCount(REVIEW_NOTIFICATION_STORAGE_KEY),
}
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
assert.equal(
  technicalStorage.getSetCount(TECHNICAL_VERSION_STORAGE_KEY) - technicalWritesBeforeThenable.technical,
  1,
  'thenable 未执行内部业务写入时，技术版本仓只允许恢复一次',
)
assert.equal(
  technicalStorage.getSetCount(REVIEW_LOG_STORAGE_KEY) - technicalWritesBeforeThenable.logs,
  1,
  '版本日志仓未发生业务写入时只允许恢复一次',
)
assert.equal(
  technicalStorage.getSetCount(REVIEW_NOTIFICATION_STORAGE_KEY) - technicalWritesBeforeThenable.notifications,
  1,
  '审核通知仓未发生业务写入时只允许恢复一次',
)
technicalStorage.restore()

console.log('pcs-repository-sync-transaction.spec.ts PASS')
