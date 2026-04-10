import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { renderSampleInventoryPage } from '../src/pages/pcs-sample-inventory.ts'
import { renderSampleLedgerPage } from '../src/pages/pcs-sample-ledger.ts'
import { renderSampleTransferPage } from '../src/pages/pcs-sample-transfer.ts'
import { renderSampleViewPage } from '../src/pages/pcs-sample-view.ts'
import { clearProjectRelationStore } from '../src/data/pcs-project-relation-repository.ts'
import { resetProjectRepository } from '../src/data/pcs-project-repository.ts'
import { resetSampleAssetRepository } from '../src/data/pcs-sample-asset-repository.ts'
import { resetSampleLedgerRepository } from '../src/data/pcs-sample-ledger-repository.ts'

function read(relativePath: string) {
  return readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8')
}

const sampleLedgerPageSource = read('src/pages/pcs-sample-ledger.ts')
assert.ok(sampleLedgerPageSource.includes('listSampleLedgerViewItems'), '样衣台账页应读取正式样衣台账事件视图')
assert.ok(!sampleLedgerPageSource.includes('mockEvents'), '样衣台账页不应再以内置 mockEvents 作为主来源')

const sampleInventoryPageSource = read('src/pages/pcs-sample-inventory.ts')
assert.ok(sampleInventoryPageSource.includes('listSampleInventoryViewItems'), '样衣库存页应读取正式样衣资产视图')
assert.ok(!sampleInventoryPageSource.includes('mockSamples'), '样衣库存页不应再以内置样衣数组作为主来源')

const sampleTransferPageSource = read('src/pages/pcs-sample-transfer.ts')
assert.ok(sampleTransferPageSource.includes('listSampleTransferGroups'), '样衣流转页应从正式样衣台账事件分流展示')
assert.ok(!sampleTransferPageSource.includes('transferRecords'), '样衣流转页不应再维护并行流转数组')

const sampleViewPageSource = read('src/pages/pcs-sample-view.ts')
assert.ok(sampleViewPageSource.includes('listSampleInventoryViewItems'), '样衣视图页应读取正式样衣资产视图')
assert.ok(!sampleViewPageSource.includes('workItemInstanceId'), '样衣视图页不应再主展示 workItemInstanceId')

const sampleApplicationPageSource = read('src/pages/pcs-sample-application.ts')
assert.ok(sampleApplicationPageSource.includes('ALLOWED_NODE_CODES'), '样衣使用申请应限制为正式项目节点选择')
assert.ok(!sampleApplicationPageSource.includes('workItemInstanceId'), '样衣使用申请不应再使用 workItemInstanceId 作为正式字段')

const firstSamplePageSource = read('src/pages/pcs-first-order-sample.ts')
assert.ok(!firstSamplePageSource.includes('首单样衣打样'), '首版样衣打样页面不应再出现首单文案')

resetProjectRepository()
clearProjectRelationStore()
resetSampleAssetRepository()
resetSampleLedgerRepository()

const ledgerHtml = renderSampleLedgerPage()
assert.ok(ledgerHtml.includes('LE-20260110-001'), '样衣台账页应能回读正式样衣台账事件')

const inventoryHtml = renderSampleInventoryPage()
assert.ok(inventoryHtml.includes('SY-SZ-00021'), '样衣库存页应能回读正式样衣资产')

const transferHtml = renderSampleTransferPage()
assert.ok(transferHtml.includes('入库流'), '样衣流转页应按正式事件类型分流展示')
assert.ok(transferHtml.includes('LE-20260110-001'), '样衣流转页应能回读正式台账事件编号')

const sampleViewHtml = renderSampleViewPage()
assert.ok(sampleViewHtml.includes('未绑定项目') || sampleViewHtml.includes('PRJ-'), '样衣视图页项目标签应来自正式样衣资产记录')

console.log('pcs-sample-pages-real-source.spec.ts PASS')
