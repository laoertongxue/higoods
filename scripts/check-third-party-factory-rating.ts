import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  getThirdPartyFactoryRatingSnapshot,
  isThirdPartyFactorySettlementBlocked,
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
assert.equal(getThirdPartyFactoryRatingSnapshot(blacklisted.factoryId)?.dispatchPolicyLabel.includes('禁止派单'), true, '黑名单工厂必须禁止派单')

const bGrade = snapshots.find((item) => item.currentGrade === 'B')
assert.ok(bGrade, '缺少 B 级工厂')
assert.equal(isThirdPartyFactorySettlementBlocked(bGrade.factoryId), false, 'B 级工厂不能禁止结算')
assert.ok(bGrade.dispatchPolicyLabel.includes('小单'), 'B 级工厂必须提示小单、简单单')

const source = readFileSync(new URL('../src/data/fcs/third-party-factory-rating.ts', import.meta.url), 'utf8')
assert.ok(source.includes('近 90 天仅用于生产时效查看'), '缺少 90 天非考核期说明')
assert.ok(!source.includes('TRIAL') && !source.includes('BLACKLISTED'), '页面数据不应直接暴露英文状态码')

console.log('check:third-party-factory-rating passed')
