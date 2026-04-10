import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  SAMPLE_LEDGER_EVENT_TYPE_LIST,
  SAMPLE_TRANSFER_EVENT_CODE_MAP,
} from '../src/data/pcs-sample-types.ts'

function read(relativePath: string) {
  return readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8')
}

assert.equal(SAMPLE_LEDGER_EVENT_TYPE_LIST.length, 11, '样衣正式事件类型目录必须固定为 11 个')
assert.equal(SAMPLE_TRANSFER_EVENT_CODE_MAP.ARRIVAL_SIGN, 'RECEIVE_ARRIVAL', '样衣流转旧事件 ARRIVAL_SIGN 必须映射到 RECEIVE_ARRIVAL')
assert.equal(SAMPLE_TRANSFER_EVENT_CODE_MAP.CHECK_IN, 'CHECKIN_VERIFY', '样衣流转旧事件 CHECK_IN 必须映射到 CHECKIN_VERIFY')
assert.equal(SAMPLE_TRANSFER_EVENT_CODE_MAP.BORROW_OUT, 'CHECKOUT_BORROW', '样衣流转旧事件 BORROW_OUT 必须映射到 CHECKOUT_BORROW')
assert.equal(SAMPLE_TRANSFER_EVENT_CODE_MAP.RETURN_VENDOR, 'RETURN_SUPPLIER', '样衣流转旧事件 RETURN_VENDOR 必须映射到 RETURN_SUPPLIER')

const sampleLedgerPageSource = read('src/pages/pcs-sample-ledger.ts')
assert.ok(sampleLedgerPageSource.includes('listSampleLedgerViewItems'), '样衣台账页必须回读正式样衣台账事件仓储')
assert.ok(!sampleLedgerPageSource.includes('mockEvents'), '样衣台账页不允许继续使用页面内 mock 事件数组作为主来源')

const sampleTransferPageSource = read('src/pages/pcs-sample-transfer.ts')
assert.ok(sampleTransferPageSource.includes('listSampleTransferGroups'), '样衣流转页必须从正式样衣台账事件分流展示')
assert.ok(!sampleTransferPageSource.includes('transferRecords'), '样衣流转页不允许维护并行 transfer 事件数组')

const sampleApplicationPageSource = read('src/pages/pcs-sample-application.ts')
assert.ok(sampleApplicationPageSource.includes('listProjectNodes'), '样衣使用申请必须从真实项目节点中选择工作项')
assert.ok(!sampleApplicationPageSource.includes('workItemInstanceId'), '样衣使用申请不允许再用 workItemInstanceId 充当正式项目节点')
assert.ok(!sampleApplicationPageSource.includes('workItemId:'), '样衣使用申请不允许再保存假 workItemId')
assert.ok(!sampleApplicationPageSource.includes('workItemCode:'), '样衣使用申请不允许再保存假 workItemCode')

const writebackSource = read('src/data/pcs-sample-project-writeback.ts')
assert.ok(writebackSource.includes('recordSampleLedgerEvent'), '必须存在正式样衣写入服务')
assert.ok(writebackSource.includes('upsertProjectRelation'), '正式样衣写入服务必须写项目关系记录')
assert.ok(writebackSource.includes('updateProjectNodeRecord'), '正式样衣写入服务必须回写项目节点字段')

const projectDetailPageSource = read('src/pages/pcs-project-detail.ts')
assert.ok(projectDetailPageSource.includes('sampleLedgerDetail'), '项目详情页必须展示正式样衣台账事件关系')
assert.ok(projectDetailPageSource.includes('sampleAssetDetail'), '项目详情页必须展示正式样衣资产关系')

const projectNodeDetailPageSource = read('src/pages/pcs-project-work-item-detail.ts')
assert.ok(projectNodeDetailPageSource.includes('lastEventTime'), '项目节点详情页必须展示最近一次样衣事件时间')
assert.ok(projectNodeDetailPageSource.includes('sampleLedgerDetail'), '项目节点详情页必须展示正式样衣台账事件关系')

const visiblePages = [
  read('src/pages/pcs-first-order-sample.ts'),
  read('src/pages/pcs-pre-production-sample.ts'),
  read('src/pages/pcs-sample-return.ts'),
  read('src/pages/pcs-sample-ledger.ts'),
]
assert.ok(
  visiblePages.every((source) => !source.includes('首单样衣打样')),
  '页面可见文案中不允许再出现“首单样衣打样”',
)

console.log('check-pcs-sample-project-writeback.ts PASS')
