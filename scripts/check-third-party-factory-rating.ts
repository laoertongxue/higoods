import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { indonesiaFactories } from '../src/data/fcs/indonesia-factories.ts'
import { listSewingFactoryOptions } from '../src/data/fcs/sewing-dispatch-workbench.ts'
import { listStatementBuildScopes } from '../src/data/fcs/store-domain-statement-source-adapter.ts'
import {
  getThirdPartyFactoryRatingSnapshot,
  isThirdPartyFactorySettlementBlocked,
  listThirdPartyFactoryPerformanceRecords,
  listThirdPartyFactoryRatingSnapshots,
} from '../src/data/fcs/third-party-factory-rating.ts'

const snapshots = listThirdPartyFactoryRatingSnapshots()
assert.ok(snapshots.length >= 5, '至少需要 5 个三方车缝评级样例')
assert.ok(snapshots.some((item) => item.currentGrade === 'S'), '缺少 S 级样例')
assert.ok(snapshots.some((item) => item.currentGrade === 'A'), '缺少 A 级样例')
assert.ok(snapshots.some((item) => item.currentGrade === 'B'), '缺少 B 级黄牌样例')
assert.ok(snapshots.some((item) => item.currentGrade === 'C' && item.cooperationStatusLabel === '黑名单'), '缺少 C 级黑名单样例')
assert.ok(snapshots.some((item) => item.cooperationStatusLabel === '考核中' && item.firstTrialLimitQty === 300), '缺少考核中小厂 300 件上限样例')

const blacklisted = snapshots.find((item) => item.cooperationStatusLabel === '黑名单')
assert.ok(blacklisted, '缺少黑名单工厂')
assert.equal(isThirdPartyFactorySettlementBlocked(blacklisted.factoryId), true, '黑名单工厂必须禁止发起结算')
assert.equal(isThirdPartyFactorySettlementBlocked(blacklisted.factoryCode), true, '黑名单工厂编码口径也必须禁止发起结算')
assert.equal(getThirdPartyFactoryRatingSnapshot(blacklisted.factoryId)?.dispatchPolicyLabel.includes('禁止派单'), true, '黑名单工厂必须禁止派单')
assert.equal(getThirdPartyFactoryRatingSnapshot(blacklisted.factoryCode)?.factoryId, blacklisted.factoryId, '评级快照必须兼容工厂编码查询')

const bGrade = snapshots.find((item) => item.currentGrade === 'B')
assert.ok(bGrade, '缺少 B 级工厂')
assert.equal(isThirdPartyFactorySettlementBlocked(bGrade.factoryId), false, 'B 级工厂不能禁止结算')
assert.ok(bGrade.dispatchPolicyLabel.includes('小单'), 'B 级工厂必须提示小单、简单单')

const sewingFactoryOptions = listSewingFactoryOptions()
for (const snapshot of snapshots) {
  const master = indonesiaFactories.find((item) => item.id === snapshot.factoryId && item.code === snapshot.factoryCode)
  assert.ok(master, `${snapshot.factoryId} 必须能命中工厂主档和编码`)
  assert.ok(sewingFactoryOptions.some((item) => item.id === snapshot.factoryId), `${snapshot.factoryId} 必须能命中车缝派单候选`)
  assert.ok(
    listThirdPartyFactoryPerformanceRecords(snapshot.factoryCode).every((item) => item.factoryId === snapshot.factoryId),
    `${snapshot.factoryId} 的履约记录必须兼容编码查询`,
  )
}

const buildScopes = listStatementBuildScopes()
assert.ok(
  buildScopes.some((item) => item.settlementPartyId === blacklisted.factoryId),
  '黑名单工厂必须有可演示的对账单生成范围，才能验证结算拦截',
)

const source = readFileSync(new URL('../src/data/fcs/third-party-factory-rating.ts', import.meta.url), 'utf8')
assert.ok(source.includes('近 90 天仅用于生产时效查看'), '缺少 90 天非考核期说明')
assert.ok(!source.includes('TRIAL') && !source.includes('BLACKLISTED'), '页面数据不应直接暴露英文状态码')

const factoryProfileSource = readFileSync(new URL('../src/pages/factory-profile.ts', import.meta.url), 'utf8')
assert.ok(factoryProfileSource.includes('评级与派单风控'), '工厂档案缺少评级与派单风控区块')
assert.ok(factoryProfileSource.includes('getThirdPartyFactoryRatingSnapshot'), '工厂档案未读取评级快照')
assert.ok(factoryProfileSource.includes('近 90 天仅用于生产时效查看'), '工厂档案缺少 90 天非考核期说明')
assert.ok(factoryProfileSource.includes('不能派单，不能发起结算'), '工厂档案缺少黑名单双拦截提示')

const sewingDispatchSource = readFileSync(new URL('../src/pages/sewing-dispatch-workbench.ts', import.meta.url), 'utf8')
assert.ok(sewingDispatchSource.includes('getThirdPartyFactoryRatingSnapshot'), '车缝分配工作台未读取评级快照')
assert.ok(sewingDispatchSource.includes('dispatchRiskConfirmed'), '车缝分配工作台缺少 B 级确认状态')
assert.ok(sewingDispatchSource.includes('该工厂为黄牌工厂，建议只分配小单、简单单'), '车缝分配缺少 B 级黄牌提醒')
assert.ok(sewingDispatchSource.includes('该工厂已拉黑，不能派单。请更换工厂。'), '车缝分配缺少黑名单派单拦截')
assert.ok(sewingDispatchSource.includes('该工厂还在试用期，只能接试产单。'), '车缝分配缺少考核中拦截')

const statementsSource = readFileSync(new URL('../src/pages/statements.ts', import.meta.url), 'utf8')
assert.ok(statementsSource.includes('isThirdPartyFactorySettlementBlocked'), '对账单页面未判断黑名单结算拦截')
assert.ok(statementsSource.includes('该工厂已拉黑，不能发起结算。请主管处理历史账款。'), '对账单页面缺少黑名单结算提示')
assert.ok(statementsSource.includes('blacklistSettlementBlocked'), '对账单页面缺少黑名单结算阻断变量')

console.log('check:third-party-factory-rating passed')
