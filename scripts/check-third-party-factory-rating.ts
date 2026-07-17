import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { indonesiaFactories } from '../src/data/fcs/indonesia-factories.ts'
import { getFactoryCapacityProfileByFactoryId } from '../src/data/fcs/factory-capacity-profile-mock.ts'
import { listFactoryMasterRecords } from '../src/data/fcs/factory-master-store.ts'
import { renderThirdPartyFactoryRatingPage } from '../src/pages/third-party-factory-rating.ts'
import { awardRuntimeTaskTender } from '../src/data/fcs/runtime-process-tasks.ts'
import {
  createSewingDispatchWorkbenchDraft,
  listSewingDispatchWorkbenchRows,
  listSewingFactoryOptions,
  runSewingDispatchWorkbenchTransaction,
} from '../src/data/fcs/sewing-dispatch-workbench.ts'
import {
  listStatementBuildCandidates,
  listStatementBuildScopes,
  toStatementDraftItemFromSource,
} from '../src/data/fcs/store-domain-statement-source-adapter.ts'
import {
  createStatementFromEligibleLedgers,
  listStatements,
} from '../src/data/fcs/store-domain-settlement-seeds.ts'
import { getSettlementEffectiveInfoByFactory } from '../src/data/fcs/settlement-change-requests.ts'
import { deriveSettlementCycleFields } from '../src/data/fcs/store-domain-statement-grain.ts'
import {
  evaluateThirdPartyFactoryDispatchPolicy,
  evaluateThirdPartyFactorySettlementPolicy,
  getThirdPartyFactoryDispatchPolicyLabel,
  getThirdPartyFactoryRatingSnapshot,
  getThirdPartyFactorySettlementPolicyLabel,
  isThirdPartyFactorySettlementBlocked,
  listThirdPartyFactoryPerformanceRecords,
  listThirdPartyFactoryRatingSnapshots,
  thirdPartyFactoryRatingSnapshots,
  type FactoryRatingSnapshot,
} from '../src/data/fcs/third-party-factory-rating.ts'
import {
  SEWING_FACTORY_LIABILITY_REASONS,
} from '../src/data/fcs/factory-settlement-reconciliation.ts'
import {
  calculateTrialAssessmentDefectMetrics,
  getLatestEffectiveThirdPartyFactoryTrialAssessmentRecord,
  getLatestThirdPartyFactoryTrialAssessmentRecord,
  hasOpenThirdPartyFactoryTrialAssessment,
  listThirdPartyFactoryTrialAssessmentRecords,
} from '../src/data/fcs/third-party-factory-trial-assessment.ts'

function readRequiredSource(url: URL, message: string): string {
  try {
    return readFileSync(url, 'utf8')
  } catch (error) {
    assert.fail(`${message}: ${(error as Error).message}`)
  }
}

function sliceRequiredSource(source: string, startMarker: string, endMarker: string, message: string): string {
  const startIndex = source.indexOf(startMarker)
  assert.ok(startIndex >= 0, `${message}: 缺少起始片段 ${startMarker}`)
  const endIndex = source.indexOf(endMarker, startIndex + startMarker.length)
  assert.ok(endIndex > startIndex, `${message}: 缺少结束片段 ${endMarker}`)
  return source.slice(startIndex, endIndex)
}

const snapshots = listThirdPartyFactoryRatingSnapshots()
const thirdPartySewingFactories = listFactoryMasterRecords().filter(
  (factory) =>
    factory.factoryTier === 'THIRD_PARTY' &&
    (factory.factoryType === 'THIRD_SEWING' || factory.processAbilities.some((ability) => ability.processCode === 'SEW')),
)
assert.equal(snapshots.length, thirdPartySewingFactories.length, '三方车缝评级快照必须覆盖工厂档案全部三方车缝工厂')
for (const factory of thirdPartySewingFactories) {
  const masterSeatCount = (factory as { sewingSeatCount?: number }).sewingSeatCount
  assert.ok(Number.isFinite(masterSeatCount) && masterSeatCount > 0, `${factory.id} 工厂主档必须维护三方车缝车位数`)
  const snapshot = snapshots.find((item) => item.factoryId === factory.id)
  const capacityProfile = getFactoryCapacityProfileByFactoryId(factory.id)
  assert.ok(snapshot, `${factory.id} 必须有评级快照`)
  assert.equal(capacityProfile.sewingSeatCount, masterSeatCount, `${factory.id} 产能档案车位数必须从工厂主档同步`)
  assert.equal(snapshot.sewingSeatCount, masterSeatCount, `${factory.id} 评级快照车位数必须从工厂主档/产能资料同步`)
  assert.equal(snapshot.scaleLabel, masterSeatCount >= 30 ? '大型工厂' : '小型工厂', `${factory.id} 规模必须由车缝车位数派生`)
  assert.equal(snapshot.firstTrialLimitQty, masterSeatCount >= 30 ? 1000 : 300, `${factory.id} 首单上限必须由车缝车位数派生`)
}

const trialAssessmentRecords = listThirdPartyFactoryTrialAssessmentRecords()
assert.ok(trialAssessmentRecords.length >= snapshots.length, '每个三方车缝工厂至少需要一条可追溯的试产考核记录或等待首轮试产记录')

for (const snapshot of snapshots) {
  const records = trialAssessmentRecords.filter((item) => item.factoryId === snapshot.factoryId)
  assert.ok(records.length > 0, `${snapshot.factoryId} 必须有试产考核记录`)
  const rounds = new Set(records.map((item) => item.assessmentRound))
  assert.equal(rounds.size, records.length, `${snapshot.factoryId} 每个考核轮次只能有一个试产单`)
  assert.ok(getLatestThirdPartyFactoryTrialAssessmentRecord(snapshot.factoryId), `${snapshot.factoryId} 必须能读取最新试产考核记录`)
}

for (const snapshot of snapshots) {
  const latestRecord = getLatestThirdPartyFactoryTrialAssessmentRecord(snapshot.factoryId)
  assert.ok(latestRecord, `${snapshot.factoryId} 评级快照必须能关联最新试产考核记录`)
  assert.equal(snapshot.assessmentRound, latestRecord.assessmentRound, `${snapshot.factoryId} 当前考核轮次必须读取最新试产记录`)
  assert.equal(snapshot.latestTrialOrderNo, latestRecord.trialOrderNo, `${snapshot.factoryId} 快照必须展示最新试产单号`)
  assert.equal(snapshot.latestTrialProductionOrderNo, latestRecord.productionOrderNo, `${snapshot.factoryId} 快照必须展示最新试产生产单`)
  assert.equal(snapshot.latestTrialDefectRate, latestRecord.defectRate, `${snapshot.factoryId} 快照必须展示最新试产不良率`)
}

for (const record of trialAssessmentRecords) {
  for (const item of record.factoryLiabilityDefectReasonItems) {
    assert.ok(
      SEWING_FACTORY_LIABILITY_REASONS.includes(item.reasonName),
      `${record.assessmentId} 存在字典外工厂责任瑕疵原因 ${item.reasonName}`,
    )
  }
  const metrics = calculateTrialAssessmentDefectMetrics(record)
  assert.equal(record.factoryLiabilityDefectQty, metrics.factoryLiabilityDefectQty, `${record.assessmentId} 工厂责任瑕疵数量必须由原因明细求和`)
  assert.equal(record.defectiveQty, metrics.defectiveQty, `${record.assessmentId} 不良数量必须等于返工数量 + 工厂责任瑕疵数量`)
  assert.equal(record.defectRate, metrics.defectRate, `${record.assessmentId} 不良率必须由不良数量 / 质检数量计算`)
}

assert.ok(
  trialAssessmentRecords.some((item) => item.effectiveDecision === '延长考核' && item.assessmentRound === 1),
  '必须有首轮后延长考核样例',
)
assert.ok(
  trialAssessmentRecords.some((item) => item.assessmentRound >= 2 && item.autoRatingDecision),
  '必须有延长后重新评级的试产记录',
)
assert.ok(
  trialAssessmentRecords.some((item) =>
    (item.status === 'WAIT_TRIAL_DISPATCH' || item.status === 'TRIAL_DISPATCHED' || item.status === 'WAIT_QC') &&
    hasOpenThirdPartyFactoryTrialAssessment(item.factoryId),
  ),
  '必须有未完成试产考核记录用于验证重复派单阻断',
)
const waitingTrialDispatchRecord = trialAssessmentRecords.find((item) => item.status === 'WAIT_TRIAL_DISPATCH')
assert.ok(
  waitingTrialDispatchRecord && hasOpenThirdPartyFactoryTrialAssessment(waitingTrialDispatchRecord.factoryId),
  '等待派出试产单也必须视为未完成试产考核',
)

for (const snapshot of snapshots) {
  const latestEffectiveRecord = getLatestEffectiveThirdPartyFactoryTrialAssessmentRecord(snapshot.factoryId)
  if (!latestEffectiveRecord) {
    assert.equal(snapshot.cooperationStatusLabel, '考核中', `${snapshot.factoryId} 只有考核中工厂允许缺少已生效试产结论`)
    continue
  }
  const expectedCooperationStatus = {
    转正: '正常合作',
    延长考核: '考核中',
    拉黑: '黑名单',
  }[latestEffectiveRecord.effectiveDecision]
  assert.equal(
    snapshot.cooperationStatusLabel,
    expectedCooperationStatus,
    `${snapshot.factoryId} 快照合作状态不能与最新已生效试产结论冲突`,
  )
  if (snapshot.assessmentDecision) {
    assert.equal(
      snapshot.assessmentDecision,
      latestEffectiveRecord.effectiveDecision,
      `${snapshot.factoryId} 快照考核结论必须与最新已生效试产结论一致`,
    )
  }
}
assert.ok(snapshots.some((item) => item.currentGrade === 'S'), '缺少 S 级样例')
assert.ok(snapshots.some((item) => item.currentGrade === 'A'), '缺少 A 级样例')
assert.ok(snapshots.some((item) => item.currentGrade === 'B'), '缺少 B 级黄牌样例')
assert.ok(snapshots.some((item) => item.currentGrade === 'C' && item.cooperationStatusLabel === '黑名单'), '缺少 C 级黑名单样例')
assert.ok(snapshots.some((item) => item.cooperationStatusLabel === '考核中' && item.firstTrialLimitQty === 300), '缺少考核中小厂 300 件上限样例')

const trialSnapshot = snapshots.find((item) => item.cooperationStatusLabel === '考核中')
assert.ok(trialSnapshot, '缺少考核中工厂样例')
assert.equal(trialSnapshot.dispatchControl, 'TRIAL_ONLY', '考核中工厂必须使用试产单派单规则')
assert.deepEqual(trialSnapshot.allowedDocumentTypes, ['试产单'], '考核中工厂只允许试产单')
assert.equal(trialSnapshot.canJoinBidding, true, '考核中工厂在试产额度内可以参与候选')

const extendedTrialSnapshot = snapshots.find((item) => item.cooperationStatusLabel === '考核中' && item.assessmentDecision === '延长考核')
assert.ok(extendedTrialSnapshot, '必须有延长考核期样例')
assert.equal(extendedTrialSnapshot.dispatchControl, 'TRIAL_ONLY', '延长考核期仍必须使用试产单派单规则')
assert.deepEqual(extendedTrialSnapshot.allowedDocumentTypes, ['试产单'], '延长考核期下一单仍只允许试产单')
assert.equal(extendedTrialSnapshot.nextAllowedDocumentType, '试产单', '延长考核期下一单允许单据必须是试产单')
assert.equal(extendedTrialSnapshot.nextTrialLimitQty, extendedTrialSnapshot.firstTrialLimitQty ?? 300, '延长考核期下一单上限必须沿用试产上限')
assert.ok((extendedTrialSnapshot.assessmentRound ?? 0) >= 2, '延长考核期必须记录当前考核轮次')
assert.ok(extendedTrialSnapshot.assessmentReason?.includes('延长'), '延长考核期必须记录延长原因')

const extendedLatest = snapshots.find((item) => item.assessmentDecision === '延长考核')
assert.ok(extendedLatest, '必须有延长考核快照')
assert.equal(extendedLatest.cooperationStatusLabel, '考核中', '延长考核快照必须保持考核中')
assert.equal(extendedLatest.dispatchControl, 'TRIAL_ONLY', '延长考核快照必须保持试产派单控制')
assert.equal(extendedLatest.settlementControl, 'ALLOW', '延长考核快照不能做黑名单结算拦截')

assert.equal(
  getThirdPartyFactoryDispatchPolicyLabel(trialSnapshot),
  `仅允许试产单，单次试产最多 ${trialSnapshot.nextTrialLimitQty ?? trialSnapshot.firstTrialLimitQty ?? 300} 件，完成交出和质检后再判断结论。`,
  '考核中派单策略文案必须由结构化试产上限派生',
)
assert.equal(
  getThirdPartyFactorySettlementPolicyLabel(trialSnapshot),
  '不做黑名单结算拦截。',
  '考核中结算策略文案必须由结构化规则派生',
)

const trialNoOpenSnapshot = {
  ...trialSnapshot,
  factoryId: 'CHECK-TRIAL-NO-OPEN',
  factoryCode: 'CHECK-TRIAL-NO-OPEN',
  factoryName: '试产规则检查工厂',
  firstTrialLimitQty: trialSnapshot.firstTrialLimitQty ?? 300,
  nextTrialLimitQty: trialSnapshot.nextTrialLimitQty ?? trialSnapshot.firstTrialLimitQty ?? 300,
  hasOpenTrialAssessment: false,
}
thirdPartyFactoryRatingSnapshots.push(trialNoOpenSnapshot)
const trialAllowedDecision = evaluateThirdPartyFactoryDispatchPolicy({
  factoryId: trialNoOpenSnapshot.factoryId,
  actionType: '直接派单',
  documentTypeLabel: '试产单',
  dispatchQty: trialNoOpenSnapshot.nextTrialLimitQty ?? trialNoOpenSnapshot.firstTrialLimitQty ?? 300,
  isUrgentOrder: false,
  riskConfirmed: false,
  isSupervisorAssigned: false,
})
assert.equal(trialAllowedDecision.allowed, true, '考核中工厂在试产额度内必须允许派单')
assert.equal(trialAllowedDecision.severity, 'ALLOW', '试产额度内不能显示阻断')

const trialRegularDecision = evaluateThirdPartyFactoryDispatchPolicy({
  factoryId: trialSnapshot.factoryId,
  actionType: '直接派单',
  documentTypeLabel: '常规单',
  dispatchQty: 1,
  isUrgentOrder: false,
  riskConfirmed: false,
  isSupervisorAssigned: false,
})
assert.equal(trialRegularDecision.allowed, false, '考核中工厂不能接常规单')
assert.ok(trialRegularDecision.reason.includes('只能接试产单'), '常规单阻断原因必须明确')

const trialOverLimitDecision = evaluateThirdPartyFactoryDispatchPolicy({
  factoryId: trialNoOpenSnapshot.factoryId,
  actionType: '直接派单',
  documentTypeLabel: '试产单',
  dispatchQty: (trialNoOpenSnapshot.nextTrialLimitQty ?? trialNoOpenSnapshot.firstTrialLimitQty ?? 300) + 1,
  isUrgentOrder: false,
  riskConfirmed: false,
  isSupervisorAssigned: false,
})
assert.equal(trialOverLimitDecision.allowed, false, '考核中工厂超出试产上限必须阻断')
assert.ok(trialOverLimitDecision.reason.includes('试产上限'), '超量阻断原因必须明确试产上限')

const openTrialSnapshot = snapshots.find((item) => item.dispatchControl === 'TRIAL_ONLY' && item.hasOpenTrialAssessment)
assert.ok(openTrialSnapshot, '必须有未完成试产考核工厂用于验证重复试产单阻断')
const duplicateTrialDecision = evaluateThirdPartyFactoryDispatchPolicy({
  factoryId: openTrialSnapshot.factoryId,
  actionType: '直接派单',
  documentTypeLabel: '试产单',
  dispatchQty: Math.min(openTrialSnapshot.nextTrialLimitQty ?? openTrialSnapshot.firstTrialLimitQty ?? 300, 100),
  isUrgentOrder: false,
  riskConfirmed: false,
  isSupervisorAssigned: false,
})
assert.equal(duplicateTrialDecision.allowed, false, '当前轮已有未完成试产单时必须阻断重复派试产单')
assert.ok(duplicateTrialDecision.reason.includes('已有未完成试产'), '重复试产单阻断原因必须明确')
thirdPartyFactoryRatingSnapshots.pop()

const blacklisted = snapshots.find((item) => item.cooperationStatusLabel === '黑名单')
assert.ok(blacklisted, '缺少黑名单工厂')
assert.equal(isThirdPartyFactorySettlementBlocked(blacklisted.factoryId), true, '黑名单工厂必须禁止发起结算')
assert.equal(isThirdPartyFactorySettlementBlocked(blacklisted.factoryCode), true, '黑名单工厂编码口径也必须禁止发起结算')
assert.equal(getThirdPartyFactoryDispatchPolicyLabel(blacklisted).includes('禁止派单'), true, '黑名单工厂必须禁止派单')
assert.equal(getThirdPartyFactoryRatingSnapshot(blacklisted.factoryCode)?.factoryId, blacklisted.factoryId, '评级快照必须兼容工厂编码查询')
const blacklistedSettlementDecision = evaluateThirdPartyFactorySettlementPolicy(blacklisted.factoryId)
assert.equal(blacklistedSettlementDecision.allowedToCreateNewStatement, false, '黑名单工厂结算评估必须阻断新建')
assert.equal(blacklistedSettlementDecision.historyReadable, true, '黑名单工厂历史账本必须可读')

const bGrade = snapshots.find((item) => item.currentGrade === 'B' && item.dispatchControl === 'WARN_CONFIRM')
assert.ok(bGrade, '缺少 B 级黄牌确认工厂')
assert.equal(isThirdPartyFactorySettlementBlocked(bGrade.factoryId), false, 'B 级工厂不能禁止结算')
assert.ok(getThirdPartyFactoryDispatchPolicyLabel(bGrade).includes('小单'), 'B 级工厂必须提示小单、简单单')

const sGrade = snapshots.find((item) => item.currentGrade === 'S')
assert.ok(sGrade, '缺少 S 级工厂')
const aGrade = snapshots.find((item) => item.currentGrade === 'A' && item.cooperationStatusLabel === '正常合作')
assert.ok(aGrade, '缺少 A 级正常合作工厂')
const supervisorAssignedSnapshot = snapshots.find((item) => item.dispatchControl === 'SUPERVISOR_DIRECT_ONLY')
assert.ok(supervisorAssignedSnapshot, '缺少主管指定工厂')

const unknownFactoryUnconfirmedDecision = evaluateThirdPartyFactoryDispatchPolicy({
  factoryId: 'UNKNOWN-THIRD-PARTY-FACTORY',
  actionType: '直接派单',
  documentTypeLabel: '常规单',
  dispatchQty: 1,
  isUrgentOrder: false,
  riskConfirmed: false,
  isSupervisorAssigned: false,
})
assert.equal(unknownFactoryUnconfirmedDecision.allowed, false, '无评级工厂未确认前不能派单')
assert.equal(unknownFactoryUnconfirmedDecision.requiresConfirm, true, '无评级工厂必须要求人工确认')
assert.equal(unknownFactoryUnconfirmedDecision.sortPriority, 10, '无评级工厂排序优先级必须最低可确认')

const unknownFactoryConfirmedDecision = evaluateThirdPartyFactoryDispatchPolicy({
  factoryId: 'UNKNOWN-THIRD-PARTY-FACTORY',
  actionType: '直接派单',
  documentTypeLabel: '常规单',
  dispatchQty: 1,
  isUrgentOrder: false,
  riskConfirmed: true,
  isSupervisorAssigned: false,
})
assert.equal(unknownFactoryConfirmedDecision.allowed, true, '无评级工厂人工确认后可以继续派单')
assert.equal(unknownFactoryConfirmedDecision.requiresConfirm, false, '无评级工厂确认后不能继续要求确认')
assert.equal(unknownFactoryConfirmedDecision.sortPriority, 10, '无评级工厂确认后仍保持低排序优先级')

for (const invalidDispatchQty of [Number.NaN, Number.POSITIVE_INFINITY, 0, -1]) {
  const invalidQtyDecision = evaluateThirdPartyFactoryDispatchPolicy({
    factoryId: sGrade.factoryId,
    actionType: '直接派单',
    documentTypeLabel: '常规单',
    dispatchQty: invalidDispatchQty,
    isUrgentOrder: false,
    riskConfirmed: false,
    isSupervisorAssigned: false,
  })
  assert.equal(invalidQtyDecision.allowed, false, `无效派单数量 ${String(invalidDispatchQty)} 必须阻断`)
  assert.equal(invalidQtyDecision.severity, 'BLOCK', `无效派单数量 ${String(invalidDispatchQty)} 必须显示阻断`)
}

const blacklistedDispatchDecision = evaluateThirdPartyFactoryDispatchPolicy({
  factoryId: blacklisted.factoryId,
  actionType: '直接派单',
  documentTypeLabel: '常规单',
  dispatchQty: 1,
  isUrgentOrder: false,
  riskConfirmed: false,
  isSupervisorAssigned: false,
})
assert.equal(blacklistedDispatchDecision.allowed, false, '黑名单工厂必须阻断派单')
assert.equal(blacklistedDispatchDecision.severity, 'BLOCK', '黑名单工厂必须显示阻断')
assert.equal(blacklistedDispatchDecision.sortPriority, 0, '黑名单工厂排序优先级必须为 0')

const supervisorUnconfirmedDecision = evaluateThirdPartyFactoryDispatchPolicy({
  factoryId: supervisorAssignedSnapshot.factoryId,
  actionType: '直接派单',
  documentTypeLabel: '常规单',
  dispatchQty: 1,
  isUrgentOrder: false,
  riskConfirmed: false,
  isSupervisorAssigned: false,
})
assert.equal(supervisorUnconfirmedDecision.allowed, false, '主管指定工厂未确认主管指定前不能派单')
assert.equal(supervisorUnconfirmedDecision.requiresConfirm, true, '主管指定工厂未确认时必须要求确认')
assert.equal(supervisorUnconfirmedDecision.sortPriority, 50, '主管指定工厂排序优先级必须为 50')

const supervisorConfirmedDecision = evaluateThirdPartyFactoryDispatchPolicy({
  factoryId: supervisorAssignedSnapshot.factoryId,
  actionType: '直接派单',
  documentTypeLabel: '常规单',
  dispatchQty: 1,
  isUrgentOrder: false,
  riskConfirmed: false,
  isSupervisorAssigned: true,
})
assert.equal(supervisorConfirmedDecision.allowed, true, '主管指定工厂确认主管指定后可以派单')
assert.equal(supervisorConfirmedDecision.requiresConfirm, false, '主管指定工厂确认后不能继续要求确认')
assert.equal(supervisorConfirmedDecision.sortPriority, 50, '主管指定工厂确认后排序优先级必须为 50')

const bGradeUnconfirmedDecision = evaluateThirdPartyFactoryDispatchPolicy({
  factoryId: bGrade.factoryId,
  actionType: '直接派单',
  documentTypeLabel: '常规单',
  dispatchQty: (bGrade.smallOrderLimitQty ?? 300) + 1,
  isUrgentOrder: false,
  riskConfirmed: false,
  isSupervisorAssigned: false,
})
assert.equal(bGradeUnconfirmedDecision.allowed, false, '黄牌工厂超小单阈值未确认前不能派单')
assert.equal(bGradeUnconfirmedDecision.requiresConfirm, true, '黄牌工厂超小单阈值必须要求确认')
assert.equal(bGradeUnconfirmedDecision.sortPriority, 40, '黄牌工厂排序优先级必须为 40')

const bGradeSmallOrderUnconfirmedDecision = evaluateThirdPartyFactoryDispatchPolicy({
  factoryId: bGrade.factoryId,
  actionType: '直接派单',
  documentTypeLabel: '常规单',
  dispatchQty: Math.min(bGrade.smallOrderLimitQty ?? 300, 100),
  isUrgentOrder: false,
  riskConfirmed: false,
  isSupervisorAssigned: false,
})
assert.equal(bGradeSmallOrderUnconfirmedDecision.allowed, false, '黄牌工厂小单非急单未确认前也不能派单')
assert.equal(bGradeSmallOrderUnconfirmedDecision.requiresConfirm, true, '黄牌工厂小单非急单仍必须要求确认')
assert.equal(bGradeSmallOrderUnconfirmedDecision.sortPriority, 40, '黄牌工厂小单非急单排序优先级必须为 40')

const bGradeConfirmedDecision = evaluateThirdPartyFactoryDispatchPolicy({
  factoryId: bGrade.factoryId,
  actionType: '直接派单',
  documentTypeLabel: '常规单',
  dispatchQty: (bGrade.smallOrderLimitQty ?? 300) + 1,
  isUrgentOrder: false,
  riskConfirmed: true,
  isSupervisorAssigned: false,
})
assert.equal(bGradeConfirmedDecision.allowed, true, '黄牌工厂风险确认后可以派单')
assert.equal(bGradeConfirmedDecision.requiresConfirm, false, '黄牌工厂风险确认后不能继续要求确认')
assert.equal(bGradeConfirmedDecision.sortPriority, 40, '黄牌工厂确认后排序优先级必须为 40')

const sGradeAllowedDecision = evaluateThirdPartyFactoryDispatchPolicy({
  factoryId: sGrade.factoryId,
  actionType: '直接派单',
  documentTypeLabel: '常规单',
  dispatchQty: 1,
  isUrgentOrder: false,
  riskConfirmed: false,
  isSupervisorAssigned: false,
})
assert.equal(sGradeAllowedDecision.allowed, true, 'S 级工厂必须允许派单')
assert.equal(sGradeAllowedDecision.sortPriority, 100, 'S 级优先派单排序优先级必须为 100')

const aGradeAllowedDecision = evaluateThirdPartyFactoryDispatchPolicy({
  factoryId: aGrade.factoryId,
  actionType: '直接派单',
  documentTypeLabel: '常规单',
  dispatchQty: 1,
  isUrgentOrder: false,
  riskConfirmed: false,
  isSupervisorAssigned: false,
})
assert.equal(aGradeAllowedDecision.allowed, true, 'A 级正常合作工厂必须允许派单')
assert.equal(aGradeAllowedDecision.sortPriority, 60, 'A 级正常合作排序优先级必须为 60')

const trialDefaultLimitSnapshot = {
  ...trialNoOpenSnapshot,
  factoryId: 'CHECK-TRIAL-DEFAULT-LIMIT',
  factoryCode: 'CHECK-TRIAL-DEFAULT-LIMIT',
  firstTrialLimitQty: null,
  nextTrialLimitQty: null,
  hasOpenTrialAssessment: false,
}
thirdPartyFactoryRatingSnapshots.push(trialDefaultLimitSnapshot)
const trialDefaultLimitDecision = evaluateThirdPartyFactoryDispatchPolicy({
  factoryId: trialDefaultLimitSnapshot.factoryId,
  actionType: '直接派单',
  documentTypeLabel: '试产单',
  dispatchQty: 300,
  isUrgentOrder: false,
  riskConfirmed: false,
  isSupervisorAssigned: false,
})
const trialDefaultOverLimitDecision = evaluateThirdPartyFactoryDispatchPolicy({
  factoryId: trialDefaultLimitSnapshot.factoryId,
  actionType: '直接派单',
  documentTypeLabel: '试产单',
  dispatchQty: 301,
  isUrgentOrder: false,
  riskConfirmed: false,
  isSupervisorAssigned: false,
})
thirdPartyFactoryRatingSnapshots.pop()
assert.equal(trialDefaultLimitDecision.allowed, true, '考核中工厂缺少试产上限时必须默认允许 300 件试产单')
assert.equal(trialDefaultLimitDecision.sortPriority, 70, '考核中工厂排序优先级必须为 70')
assert.equal(trialDefaultOverLimitDecision.allowed, false, '考核中工厂缺少试产上限时超过 300 件必须阻断')

const sewingFactoryOptions = listSewingFactoryOptions()
for (const snapshot of snapshots) {
  const master =
    thirdPartySewingFactories.find((item) => item.id === snapshot.factoryId && item.code === snapshot.factoryCode) ??
    indonesiaFactories.find((item) => item.id === snapshot.factoryId && item.code === snapshot.factoryCode)
  assert.ok(master, `${snapshot.factoryId} 必须能命中工厂主档和编码`)
  assert.ok(sewingFactoryOptions.some((item) => item.id === snapshot.factoryId), `${snapshot.factoryId} 必须能命中车缝派单候选`)
  assert.ok(
    listThirdPartyFactoryPerformanceRecords(snapshot.factoryCode).every((item) => item.factoryId === snapshot.factoryId),
    `${snapshot.factoryId} 的履约记录必须兼容编码查询`,
  )
}
for (const factory of thirdPartySewingFactories) {
  assert.ok(getThirdPartyFactoryRatingSnapshot(factory.id), `${factory.id} ${factory.name} 缺少评级快照`)
  assert.ok(getSettlementEffectiveInfoByFactory(factory.id), `${factory.id} 必须能用工厂主键命中结算主数据`)
  assert.ok(getSettlementEffectiveInfoByFactory(factory.code), `${factory.id} 必须能用工厂编码命中结算主数据`)
}

const buildScopes = listStatementBuildScopes()
const statements = listStatements()
assert.ok(
  buildScopes.some((item) => item.settlementPartyId === blacklisted.factoryId),
  '黑名单工厂必须有可演示的对账单生成范围，才能验证结算拦截',
)
for (const factory of thirdPartySewingFactories) {
  const hasStatement = statements.some((item) => item.settlementPartyId === factory.id)
  const hasBuildScope = buildScopes.some((item) => item.settlementPartyId === factory.id)
  assert.ok(hasStatement || hasBuildScope, `${factory.id} ${factory.name} 必须串联到对账单或待生成候选流水`)
  const cycle = deriveSettlementCycleFields(factory.id, '2026-03-06 10:00:00')
  assert.ok(cycle.settlementCycleLabel.startsWith('三旬结算'), `${factory.id} 必须按三方车缝旬结口径生成结算周期`)
}

const blockedSnapshots = snapshots.filter((item) => item.settlementBlocked)
assert.ok(blockedSnapshots.length > 0, '必须至少有一个结算拦截工厂样例')
const firstDispatchRow = listSewingDispatchWorkbenchRows()[0]
assert.ok(firstDispatchRow, '车缝分配工作台必须有可演示的 SKU 行')
const trialDispatchSnapshot = snapshots.find((item) => item.dispatchControl === 'TRIAL_ONLY')
assert.ok(trialDispatchSnapshot, '缺少试产规则工厂')
const bGradeDispatchSnapshot = snapshots.find((item) => item.dispatchControl === 'WARN_CONFIRM')
assert.ok(bGradeDispatchSnapshot, '缺少黄牌确认工厂')
const supervisorDispatchSnapshot = snapshots.find((item) => item.dispatchControl === 'SUPERVISOR_DIRECT_ONLY')
assert.ok(supervisorDispatchSnapshot, '缺少主管指定工厂')

function getAvailableDispatchRow(message: string): typeof firstDispatchRow {
  const row = listSewingDispatchWorkbenchRows().find((item) => item.remainingQty > 0 && item.completeKitQty >= item.remainingQty)
  assert.ok(row, message)
  return row
}

function getAvailableDispatchRows(count: number, message: string): typeof firstDispatchRow[] {
  const groups = new Map<string, typeof firstDispatchRow[]>()
  for (const row of listSewingDispatchWorkbenchRows().filter((item) => item.remainingQty > 0 && item.completeKitQty >= item.remainingQty)) {
    groups.set(row.taskId, [...(groups.get(row.taskId) ?? []), row])
  }
  const rows = [...groups.values()].find((items) => items.length >= count)?.slice(0, count)
  assert.ok(rows, message)
  return rows
}

function runWithDispatchRollback<T>(operation: () => T): T {
  return runSewingDispatchWorkbenchTransaction(operation, { rollbackOnSuccess: true })
}

function withTemporaryRatingSnapshot<T>(snapshot: FactoryRatingSnapshot, operation: () => T): T {
  thirdPartyFactoryRatingSnapshots.push(snapshot)
  try {
    return operation()
  } finally {
    const index = thirdPartyFactoryRatingSnapshots.findIndex((item) =>
      item.factoryId === snapshot.factoryId &&
      item.factoryCode === snapshot.factoryCode &&
      item.factoryName === snapshot.factoryName
    )
    if (index >= 0) thirdPartyFactoryRatingSnapshots.splice(index, 1)
  }
}

function createTemporaryTrialDispatchSnapshot(sewingSeatCount: number): FactoryRatingSnapshot {
  return {
    ...trialSnapshot,
    factoryId: 'ID-F001',
    factoryCode: 'ID-FAC-0001',
    factoryName: 'PT Sinar Garment Indonesia',
    sewingSeatCount,
    scaleLabel: sewingSeatCount >= 30 ? '大型工厂' : '小型工厂',
    cooperationStatusLabel: '考核中',
    currentGrade: 'A',
    dispatchControl: 'TRIAL_ONLY',
    settlementControl: 'ALLOW',
    settlementBlocked: false,
    allowedDocumentTypes: ['试产单'],
    canJoinBidding: true,
    requiresDispatchRiskConfirm: false,
    assessmentDecision: '延长考核',
    nextAllowedDocumentType: '试产单',
    hasOpenTrialAssessment: false,
  }
}

function assertDispatchBlockedMessage(message: string, detail: string): void {
  assert.ok(
    (message.includes('派单') || message.includes('车缝分配')) &&
      ['不能', '禁止', '不允许', '暂停'].some((keyword) => message.includes(keyword)),
    detail,
  )
}

const trialRegularResult = createSewingDispatchWorkbenchDraft({
  actionType: '直接派单',
  rowIds: [firstDispatchRow.rowId],
  factoryIdByRowId: { [firstDispatchRow.rowId]: trialDispatchSnapshot.factoryId },
  policyOverrideByRowId: { [firstDispatchRow.rowId]: { documentTypeLabel: '常规单', dispatchQty: 1, isUrgentOrder: false } },
  by: '对抗式核查',
})
assert.equal(trialRegularResult.ok, false, '考核中工厂常规单必须阻断')
assert.ok(trialRegularResult.message.includes('只能接试产单'), '考核中常规单阻断原因必须明确')

const trialOpenDispatchRow = getAvailableDispatchRow('车缝分配工作台必须有齐套 SKU 用于验证未完成试产阻断')
const trialOpenDispatchResult = createSewingDispatchWorkbenchDraft({
  actionType: '直接派单',
  rowIds: [trialOpenDispatchRow.rowId],
  factoryIdByRowId: { [trialOpenDispatchRow.rowId]: trialDispatchSnapshot.factoryId },
  policyOverrideByRowId: { [trialOpenDispatchRow.rowId]: { documentTypeLabel: '试产单' as const, dispatchQty: 1, isUrgentOrder: false } },
  by: '对抗式核查',
})
assert.equal(trialOpenDispatchResult.ok, false, '未完成试产工厂不能绕过页面重复创建试产派单草稿')
assert.ok(trialOpenDispatchResult.message.includes('已有未完成试产'), '未完成试产域层阻断原因必须透出')

const trialAllowedWorkbenchRow = getAvailableDispatchRow('车缝分配工作台必须有齐套 SKU 用于验证无未完成试产时额度内允许派单')
const trialAllowedWorkbenchResult = withTemporaryRatingSnapshot(createTemporaryTrialDispatchSnapshot(48), () =>
  runWithDispatchRollback(() => createSewingDispatchWorkbenchDraft({
    actionType: '直接派单',
    rowIds: [trialAllowedWorkbenchRow.rowId],
    factoryIdByRowId: { [trialAllowedWorkbenchRow.rowId]: 'ID-F001' },
    policyOverrideByRowId: { [trialAllowedWorkbenchRow.rowId]: { documentTypeLabel: '试产单' as const, dispatchQty: 1, isUrgentOrder: false } },
    mainFactoryIdByProductionOrderId: { [trialAllowedWorkbenchRow.productionOrderId]: 'ID-F001' },
    by: '对抗式核查',
  })),
)
assert.equal(trialAllowedWorkbenchResult.ok, true, '无未完成试产且真实数量在试产上限内时，工作台必须允许试产派单')

const trialOverLimitWorkbenchRow = getAvailableDispatchRow('车缝分配工作台必须有齐套 SKU 用于验证低报数量不能绕过试产上限')
const trialOverLimitWorkbenchResult = withTemporaryRatingSnapshot(createTemporaryTrialDispatchSnapshot(20), () =>
  createSewingDispatchWorkbenchDraft({
    actionType: '直接派单',
    rowIds: [trialOverLimitWorkbenchRow.rowId],
    factoryIdByRowId: { [trialOverLimitWorkbenchRow.rowId]: 'ID-F001' },
    policyOverrideByRowId: { [trialOverLimitWorkbenchRow.rowId]: { documentTypeLabel: '试产单' as const, dispatchQty: 1, isUrgentOrder: false } },
    by: '对抗式核查',
  }),
)
assert.equal(trialOverLimitWorkbenchResult.ok, false, '工作台真实派单数量超过试产上限时不能通过 dispatchQty 低报绕过')
assert.ok(trialOverLimitWorkbenchResult.message.includes('超过试产上限'), '低报数量绕过被拦截时必须明确试产上限原因')

const bGradeWithoutConfirm = createSewingDispatchWorkbenchDraft({
  actionType: '直接派单',
  rowIds: [firstDispatchRow.rowId],
  factoryIdByRowId: { [firstDispatchRow.rowId]: bGradeDispatchSnapshot.factoryId },
  policyOverrideByRowId: { [firstDispatchRow.rowId]: { documentTypeLabel: '常规单', dispatchQty: 301, isUrgentOrder: true } },
  by: '对抗式核查',
})
assert.equal(bGradeWithoutConfirm.ok, false, 'B 级黄牌未确认风险必须阻断')
assert.ok(bGradeWithoutConfirm.message.includes('黄牌'), 'B 级黄牌阻断原因必须明确')

const bGradeSmallWithoutConfirm = createSewingDispatchWorkbenchDraft({
  actionType: '直接派单',
  rowIds: [firstDispatchRow.rowId],
  factoryIdByRowId: { [firstDispatchRow.rowId]: bGradeDispatchSnapshot.factoryId },
  policyOverrideByRowId: { [firstDispatchRow.rowId]: { documentTypeLabel: '常规单', dispatchQty: 100, isUrgentOrder: false } },
  by: '对抗式核查',
})
assert.equal(bGradeSmallWithoutConfirm.ok, false, 'B 级黄牌小单非急单未确认风险必须阻断')
assert.ok(bGradeSmallWithoutConfirm.message.includes('黄牌'), 'B 级黄牌小单非急单阻断原因必须明确')

const supervisorBidding = createSewingDispatchWorkbenchDraft({
  actionType: '发起竞价',
  rowIds: [firstDispatchRow.rowId],
  policyOverrideByRowId: { [firstDispatchRow.rowId]: { documentTypeLabel: '常规单', dispatchQty: firstDispatchRow.remainingQty, isUrgentOrder: false } },
  biddingFactoryIds: [supervisorDispatchSnapshot.factoryId],
  by: '对抗式核查',
})
assert.equal(supervisorBidding.ok, false, '主管指定工厂不能参与竞价')
assert.ok(supervisorBidding.message.includes('不参与竞价'), '主管指定竞价阻断原因必须明确')

const internalFactoryRow = getAvailableDispatchRow('车缝分配工作台必须有可验证内部车缝工厂派单的齐套 SKU 行')
const internalFactoryDirectResult = runWithDispatchRollback(() => createSewingDispatchWorkbenchDraft({
  actionType: '直接派单',
  rowIds: [internalFactoryRow.rowId],
  factoryIdByRowId: { [internalFactoryRow.rowId]: 'ID-F001' },
  policyOverrideByRowId: { [internalFactoryRow.rowId]: { documentTypeLabel: '常规单', dispatchQty: internalFactoryRow.remainingQty, isUrgentOrder: false } },
  by: '对抗式核查',
}))
assert.equal(internalFactoryDirectResult.ok, true, '非三方/非评级治理车缝工厂不得因为缺少三方评级快照被阻断')

const governedMissingSnapshotIndex = thirdPartyFactoryRatingSnapshots.findIndex((item) => item.factoryId === trialDispatchSnapshot.factoryId)
assert.ok(governedMissingSnapshotIndex >= 0, '必须能临时移除一个三方车缝评级治理对象的快照')
const [governedMissingSnapshot] = thirdPartyFactoryRatingSnapshots.splice(governedMissingSnapshotIndex, 1)
try {
  const governedMissingSnapshotResult = createSewingDispatchWorkbenchDraft({
    actionType: '直接派单',
    rowIds: [firstDispatchRow.rowId],
    factoryIdByRowId: { [firstDispatchRow.rowId]: governedMissingSnapshot.factoryId },
    policyOverrideByRowId: { [firstDispatchRow.rowId]: { documentTypeLabel: '试产单', dispatchQty: 1, isUrgentOrder: false } },
    by: '对抗式核查',
  })
  assert.equal(governedMissingSnapshotResult.ok, false, '三方车缝评级治理对象缺少评级快照时必须阻断')
  assert.ok(governedMissingSnapshotResult.message.includes('缺少三方评级快照'), '治理对象缺评级快照阻断原因必须明确')
} finally {
  thirdPartyFactoryRatingSnapshots.splice(governedMissingSnapshotIndex, 0, governedMissingSnapshot)
}

const unknownNonGovernedBidding = runWithDispatchRollback(() => createSewingDispatchWorkbenchDraft({
  actionType: '发起竞价',
  rowIds: [firstDispatchRow.rowId],
  policyOverrideByRowId: { [firstDispatchRow.rowId]: { documentTypeLabel: '常规单', dispatchQty: firstDispatchRow.remainingQty, isUrgentOrder: false } },
  biddingFactoryIds: ['UNKNOWN-THIRD-PARTY-FACTORY'],
  policyContextByFactoryId: { 'UNKNOWN-THIRD-PARTY-FACTORY': { riskConfirmed: true, supervisorAssigned: true } },
  by: '对抗式核查',
}))
assert.equal(unknownNonGovernedBidding.ok, true, '不在三方评级治理集合内的显式竞价候选不得因为缺少三方评级快照被阻断')

const blacklistedAwardBlocked = runWithDispatchRollback(() => {
  const biddingRow = getAvailableDispatchRow('车缝分配工作台必须有可验证黑名单定标拦截的齐套 SKU 行')
  const biddingResult = createSewingDispatchWorkbenchDraft({
    actionType: '发起竞价',
    rowIds: [biddingRow.rowId],
    by: '对抗式核查',
  })
  assert.equal(biddingResult.ok, true, '默认发起竞价不应假装已检查未知候选')
  const [taskId] = biddingResult.runtimeTaskIds ?? []
  assert.ok(taskId, '默认发起竞价必须生成待定标任务')
  assert.throws(
    () => awardRuntimeTaskTender({
      taskId,
      factoryId: blacklisted.factoryId,
      factoryName: blacklisted.factoryName,
      awardedAt: '2026-07-16 10:00:00',
      awardedPrice: 12000,
      by: '对抗式核查',
    }),
    /禁止|不允许|暂停|派单|竞价/,
    '默认发起竞价后不能定标给黑名单或禁止派单三方工厂',
  )
  return true
})
assert.equal(blacklistedAwardBlocked, true, '黑名单定标拦截必须在真实定标入口生效')

const bGradeAwardBlocked = runWithDispatchRollback(() => {
  const biddingRow = getAvailableDispatchRow('车缝分配工作台必须有可验证黄牌定标拦截的齐套 SKU 行')
  const biddingResult = createSewingDispatchWorkbenchDraft({
    actionType: '发起竞价',
    rowIds: [biddingRow.rowId],
    by: '对抗式核查',
  })
  assert.equal(biddingResult.ok, true, '默认发起竞价后必须能进入黄牌定标拦截验证')
  const [taskId] = biddingResult.runtimeTaskIds ?? []
  assert.ok(taskId, '黄牌定标拦截验证必须有待定标任务')
  assert.throws(
    () => awardRuntimeTaskTender({
      taskId,
      factoryId: bGradeDispatchSnapshot.factoryId,
      factoryName: bGradeDispatchSnapshot.factoryName,
      awardedAt: '2026-07-16 10:05:00',
      awardedPrice: 12000,
      by: '对抗式核查',
    }),
    /黄牌|确认|风险/,
    '默认发起竞价后不能在无风险确认上下文时定标给 B 级黄牌工厂',
  )
  return true
})
assert.equal(bGradeAwardBlocked, true, '黄牌未确认定标拦截必须在真实定标入口生效')

const supervisorAwardBlocked = runWithDispatchRollback(() => {
  const biddingRow = getAvailableDispatchRow('车缝分配工作台必须有可验证主管指定定标拦截的齐套 SKU 行')
  const biddingResult = createSewingDispatchWorkbenchDraft({
    actionType: '发起竞价',
    rowIds: [biddingRow.rowId],
    by: '对抗式核查',
  })
  assert.equal(biddingResult.ok, true, '默认发起竞价后必须能进入主管指定定标拦截验证')
  const [taskId] = biddingResult.runtimeTaskIds ?? []
  assert.ok(taskId, '主管指定定标拦截验证必须有待定标任务')
  assert.throws(
    () => awardRuntimeTaskTender({
      taskId,
      factoryId: supervisorDispatchSnapshot.factoryId,
      factoryName: supervisorDispatchSnapshot.factoryName,
      awardedAt: '2026-07-16 10:08:00',
      awardedPrice: 12000,
      by: '对抗式核查',
    }),
    /主管指定|竞价/,
    '默认发起竞价后不能定标给主管指定不可竞价工厂',
  )
  return true
})
assert.equal(supervisorAwardBlocked, true, '主管指定定标拦截必须在真实定标入口生效')

const normalFactoryAwarded = runWithDispatchRollback(() => {
  const biddingRow = getAvailableDispatchRow('车缝分配工作台必须有可验证普通车缝工厂定标的齐套 SKU 行')
  const biddingResult = createSewingDispatchWorkbenchDraft({
    actionType: '发起竞价',
    rowIds: [biddingRow.rowId],
    by: '对抗式核查',
  })
  assert.equal(biddingResult.ok, true, '普通车缝工厂定标前必须能发起竞价')
  const [taskId] = biddingResult.runtimeTaskIds ?? []
  assert.ok(taskId, '普通车缝工厂定标前必须有待定标任务')
  const awarded = awardRuntimeTaskTender({
    taskId,
    factoryId: 'ID-F001',
    factoryName: 'PT Sinar Garment Indonesia',
    awardedAt: '2026-07-16 10:10:00',
    awardedPrice: 12000,
    by: '对抗式核查',
  })
  return awarded.assignedFactoryId
})
assert.equal(normalFactoryAwarded, 'ID-F001', '非三方/非评级治理车缝工厂定标不得因为缺少三方评级快照失败')

const bGradeConfirmedRow = getAvailableDispatchRow('车缝分配工作台必须有可验证黄牌确认派单的齐套 SKU 行')
const bGradeConfirmed = runWithDispatchRollback(() => createSewingDispatchWorkbenchDraft({
  actionType: '直接派单',
  rowIds: [bGradeConfirmedRow.rowId],
  factoryIdByRowId: { [bGradeConfirmedRow.rowId]: bGradeDispatchSnapshot.factoryId },
  policyOverrideByRowId: { [bGradeConfirmedRow.rowId]: { documentTypeLabel: '常规单', dispatchQty: 301, isUrgentOrder: true } },
  policyContextByFactoryId: { [bGradeDispatchSnapshot.factoryId]: { riskConfirmed: true } },
  by: '对抗式核查',
}))
assert.equal(bGradeConfirmed.ok, true, 'B 级黄牌确认风险后必须允许派单')

const bGradeSmallConfirmedRow = getAvailableDispatchRow('车缝分配工作台必须有可验证黄牌小单确认派单的齐套 SKU 行')
const bGradeSmallConfirmed = runWithDispatchRollback(() => createSewingDispatchWorkbenchDraft({
  actionType: '直接派单',
  rowIds: [bGradeSmallConfirmedRow.rowId],
  factoryIdByRowId: { [bGradeSmallConfirmedRow.rowId]: bGradeDispatchSnapshot.factoryId },
  policyOverrideByRowId: { [bGradeSmallConfirmedRow.rowId]: { documentTypeLabel: '常规单', dispatchQty: 100, isUrgentOrder: false } },
  policyContextByFactoryId: { [bGradeDispatchSnapshot.factoryId]: { riskConfirmed: true } },
  by: '对抗式核查',
}))
assert.equal(bGradeSmallConfirmed.ok, true, 'B 级黄牌小单非急单确认风险后必须允许派单')

const supervisorAssignedRow = getAvailableDispatchRow('车缝分配工作台必须有可验证主管指定派单的齐套 SKU 行')
const supervisorAssigned = runWithDispatchRollback(() => createSewingDispatchWorkbenchDraft({
  actionType: '直接派单',
  rowIds: [supervisorAssignedRow.rowId],
  factoryIdByRowId: { [supervisorAssignedRow.rowId]: supervisorDispatchSnapshot.factoryId },
  policyOverrideByRowId: { [supervisorAssignedRow.rowId]: { documentTypeLabel: '常规单', dispatchQty: supervisorAssignedRow.remainingQty, isUrgentOrder: false } },
  policyContextByFactoryId: { [supervisorDispatchSnapshot.factoryId]: { supervisorAssigned: true } },
  by: '对抗式核查',
}))
assert.equal(supervisorAssigned.ok, true, '主管指定工厂由主管指定后必须允许派单')

for (const blockedSnapshot of blockedSnapshots) {
  const blockedDispatchRow = getAvailableDispatchRow(`${blockedSnapshot.factoryId} 必须有可验证派单拦截的齐套 SKU 行`)
  const blockedDispatchResult = createSewingDispatchWorkbenchDraft({
    actionType: '直接派单',
    rowIds: [blockedDispatchRow.rowId],
    factoryIdByRowId: { [blockedDispatchRow.rowId]: blockedSnapshot.factoryId },
    by: '对抗式核查',
  })
  assert.equal(blockedDispatchResult.ok, false, `${blockedSnapshot.factoryId} 不能绕过页面直接创建车缝分配草稿`)
  assertDispatchBlockedMessage(blockedDispatchResult.message, `${blockedSnapshot.factoryId} 直接派单应返回派单拦截提示`)

  const blockedScope = buildScopes.find((item) => item.settlementPartyId === blockedSnapshot.factoryId)
  assert.ok(blockedScope, `${blockedSnapshot.factoryId} 必须有待生成对账候选范围`)
  const blockedCandidates = listStatementBuildCandidates(blockedScope.settlementPartyId, blockedScope.settlementCycleId)
  assert.ok(blockedCandidates.length > 0, `${blockedSnapshot.factoryId} 必须有待生成对账候选明细`)
  const blockedStatementResult = createStatementFromEligibleLedgers({
    statementId: `ST-CHECK-BLOCKED-${blockedSnapshot.factoryId}`,
    settlementPartyType: blockedScope.settlementPartyType,
    settlementPartyId: blockedScope.settlementPartyId,
    settlementPartyLabel: blockedScope.settlementPartyLabel,
    settlementCycleId: blockedScope.settlementCycleId,
    settlementCycleLabel: blockedScope.settlementCycleLabel,
    settlementCycleStartAt: blockedScope.settlementCycleStartAt,
    settlementCycleEndAt: blockedScope.settlementCycleEndAt,
    plannedPrepaymentAt: blockedScope.plannedPrepaymentAt,
    itemSourceIds: blockedCandidates.map((item) => item.sourceItemId),
    itemBasisIds: blockedCandidates.map((item) => item.basisId).filter(Boolean) as string[],
    items: blockedCandidates.map(toStatementDraftItemFromSource),
    by: '对抗式核查',
  })
  assert.equal(blockedStatementResult.ok, false, `${blockedSnapshot.factoryId} 不能绕过页面直接创建对账单`)
  const blockedStatementPolicy = evaluateThirdPartyFactorySettlementPolicy(blockedSnapshot.factoryId)
  assert.equal(blockedStatementPolicy.allowedToCreateNewStatement, false, `${blockedSnapshot.factoryId} 结算评估必须阻断新建`)
  assert.equal(blockedStatementPolicy.historyReadable, true, `${blockedSnapshot.factoryId} 历史账本必须可查看`)
  assert.equal(blockedStatementResult.message, blockedStatementPolicy.reason, `${blockedSnapshot.factoryId} 直接建单必须返回统一结算规则原因`)
}

const source = readRequiredSource(
  new URL('../src/data/fcs/third-party-factory-rating.ts', import.meta.url),
  '缺少三方工厂评级数据源文件',
)
assert.ok(source.includes('近 90 天仅用于生产时效查看'), '缺少 90 天非考核期说明')
assert.ok(source.includes('resolveThirdPartyFactorySewingSeatCount'), '评级快照必须从工厂主档/产能资料解析车缝车位数')
assert.ok(source.includes('getThirdPartyFactoryDispatchPolicyLabel'), '评级数据必须提供结构化派单策略文案生成函数')
assert.ok(source.includes('getThirdPartyFactorySettlementPolicyLabel'), '评级数据必须提供结构化结算策略文案生成函数')
assert.ok(source.includes('getLatestThirdPartyFactoryTrialAssessmentRecord'), '评级快照必须读取最新试产考核记录')
assert.ok(source.includes('getLatestEffectiveThirdPartyFactoryTrialAssessmentRecord'), '评级快照必须读取最新已生效试产考核记录')
assert.ok(source.includes('hasOpenThirdPartyFactoryTrialAssessment'), '评级快照必须读取未完成试产考核状态')
assert.ok(source.includes('latestTrialOrderNo'), '评级快照必须提供最新试产单摘要字段')
assert.ok(
  !source.includes("cooperationStatusLabel: 'TRIAL'") && !source.includes("cooperationStatusLabel: 'BLACKLISTED'"),
  '页面数据不应直接暴露英文合作状态码',
)

const ratingPageSource = readRequiredSource(
  new URL('../src/pages/third-party-factory-rating.ts', import.meta.url),
  '缺少三方工厂评级页文件',
)
assert.ok(ratingPageSource.includes('@page-pattern: list'), '三方工厂评级页必须声明标准列表页模式')
assert.ok(ratingPageSource.includes('renderStandardListPage'), '三方工厂评级页必须使用标准列表页外壳')
assert.ok(ratingPageSource.includes('renderStandardListTable'), '三方工厂评级页必须使用标准列表表格')
assert.ok(ratingPageSource.includes('renderTablePagination'), '三方工厂评级页必须使用标准分页')
assert.ok(ratingPageSource.includes('renderRatingPagination'), '三方工厂评级页必须增强分页导航可达性')
assert.ok(ratingPageSource.includes('data-third-party-rating-action="next-page"') && ratingPageSource.includes('data-nav="${escapeHtml(buildHref'), '三方工厂评级分页按钮必须替换为稳定导航')
assert.ok(ratingPageSource.includes('listThirdPartyFactoryRatingSnapshots'), '三方工厂评级页必须读取评级快照')
assert.ok(ratingPageSource.includes('latestTrialOrderNo'), '三方工厂评级列表必须展示最新试产单号')
assert.ok(ratingPageSource.includes('latestTrialDefectRate'), '三方工厂评级列表必须展示最新试产不良率')
assert.ok(ratingPageSource.includes('latestTrialAutoDecision'), '三方工厂评级列表必须展示系统建议')
assert.ok(ratingPageSource.includes('trialSummary'), '三方工厂评级页必须有试产单情况列')
assert.ok(ratingPageSource.includes('试产轮次'), '三方工厂评级列表必须展示试产轮次')
assert.ok(ratingPageSource.includes('不良率'), '三方工厂评级列表必须展示不良率')
assert.ok(ratingPageSource.includes("fcs.third-party-factory-rating.columns.v2"), '三方工厂评级新增列后必须升级列偏好版本，避免旧偏好隐藏试产列')
const ratingPageHtml = renderThirdPartyFactoryRatingPage()
for (const requiredText of ['试产单情况', '试产结论', '试产轮次', '不良率', '系统建议', '人工结论', '查看评级']) {
  assert.ok(ratingPageHtml.includes(requiredText), `三方工厂评级列表渲染结果必须展示 ${requiredText}`)
}
assert.ok(!ratingPageHtml.includes('WAIT_QC') && !ratingPageHtml.includes('TRIAL_DISPATCHED'), '三方工厂评级列表不得直接展示英文试产状态码')
assert.ok(ratingPageSource.includes('来源：工厂档案 / 产能资料'), '三方工厂评级页必须说明车位数来源于工厂档案/产能资料')
assert.ok(ratingPageSource.includes('xl:grid-cols-[minmax(240px,1.6fr)_repeat(5,minmax(132px,1fr))_auto]'), '三方工厂评级筛选区桌面端必须保持单行布局')

const factoryProfileSource = readRequiredSource(
  new URL('../src/pages/factory-profile.ts', import.meta.url),
  '缺少工厂档案页文件',
)
assert.ok(factoryProfileSource.includes('data-factory-field="sewingSeatCount"'), '工厂档案必须提供三方车缝车位数维护入口')
assert.ok(factoryProfileSource.includes('用于三方工厂评级规模、首单上限和派单风控同步'), '工厂档案车位数必须说明同步到评级规则')

const capacityProfileSource = readRequiredSource(
  new URL('../src/pages/factory-capacity-profile.ts', import.meta.url),
  '缺少工厂产能档案页文件',
)
assert.ok(capacityProfileSource.includes('车缝车位数'), '工厂产能档案必须展示车缝车位数')
assert.ok(!ratingPageSource.includes('随当前筛选结果实时计算'), '三方工厂评级统计卡上方不应保留说明文案')
assert.ok(ratingPageSource.includes('全部三方车缝工厂'), '三方工厂评级统计卡必须展示全部三方车缝工厂')
assert.ok(ratingPageSource.includes('查看评级'), '三方工厂评级页必须有详情入口')
assert.ok(ratingPageSource.includes('handleThirdPartyFactoryRatingSubmit'), '三方工厂评级页必须导出筛选提交处理')
assert.ok(ratingPageSource.includes('FormData'), '三方工厂评级页筛选提交必须读取表单字段')
assert.ok(ratingPageSource.includes('data-third-party-rating-field="keyword"'), '三方工厂评级页关键字筛选必须有事件字段标记')
assert.ok(ratingPageSource.includes('是否允许派单：全部'), '三方工厂评级页派单筛选必须可见表达是否允许派单')
assert.ok(ratingPageSource.includes('是否允许结算：全部'), '三方工厂评级页结算筛选必须可见表达是否允许结算')
assert.ok(ratingPageSource.includes('data-nav-from-fields="[data-third-party-rating-filters]"'), '三方工厂评级筛选按钮必须从筛选表单构造导航')
assert.ok(ratingPageSource.includes('data-nav-base="${PAGE_PATH}"'), '三方工厂评级筛选按钮必须固定导航回评级页')
assert.ok(ratingPageSource.includes('columnSettings: true') && ratingPageSource.includes('data-nav="${escapeHtml(buildHref'), '三方工厂评级列设置入口必须使用稳定导航')
assert.ok(ratingPageSource.includes('replaceAll(closeActionAttr, `data-nav="${closeHref}"`)'), '三方工厂评级列设置关闭必须使用稳定导航兜底')
assert.ok(ratingPageSource.includes('getThirdPartyFactoryDispatchPolicyLabel'), '评级页派单策略必须由结构化规则派生')
assert.ok(ratingPageSource.includes('getThirdPartyFactorySettlementPolicyLabel'), '评级页结算策略必须由结构化规则派生')
assert.ok(!/\.(dispatchPolicyLabel|settlementPolicyLabel)\b/.test(ratingPageSource), '评级页不得直接展示自由文本派单/结算策略字段')
assert.ok(ratingPageSource.includes('renderAssessmentDecisionDetail'), '评级详情必须展示考核结论区')
assert.ok(ratingPageSource.includes('延长考核中'), '评级详情必须表达延长考核仍保持考核中')
assert.ok(ratingPageSource.includes('assessmentDecision'), '评级详情必须读取考核结论字段')
assert.ok(ratingPageSource.includes('assessmentRound'), '评级详情必须读取考核轮次字段')
assert.ok(ratingPageSource.includes('nextAllowedDocumentType'), '评级详情必须读取下一单允许单据字段')
assert.ok(ratingPageSource.includes('nextTrialLimitQty'), '评级详情必须读取延长考核下一单上限字段')

const filterIndex = ratingPageSource.indexOf('data-third-party-rating-filters')
const statsIndex = ratingPageSource.indexOf('data-third-party-rating-stats')
assert.ok(filterIndex >= 0, '三方工厂评级页缺少筛选区标记')
assert.ok(statsIndex > filterIndex, '联动统计卡片必须位于筛选区下方')

assert.ok(!factoryProfileSource.includes('renderFactoryRatingPanel'), '工厂档案不应再渲染完整评级面板')
assert.ok(!factoryProfileSource.includes('评级与派单风控'), '工厂档案不应再展示评级与派单风控大卡片')
assert.ok(!factoryProfileSource.includes('listThirdPartyFactoryPerformanceRecords'), '工厂档案不应再读取评级履约记录')

const sewingDispatchSource = readRequiredSource(
  new URL('../src/pages/sewing-dispatch-workbench.ts', import.meta.url),
  '缺少车缝分配工作台文件',
)
const dispatchFactoryOptionSource = sliceRequiredSource(
  sewingDispatchSource,
  'function renderDispatchFactoryOption',
  'function getCutPieceReleaseBadgeClass',
  '车缝分配工厂选项片段缺失',
)
const pageDispatchPolicyDecisionSource = sliceRequiredSource(
  sewingDispatchSource,
  'function getPageDispatchPolicyDecision',
  'function renderDispatchFactoryOption',
  '车缝分配页面评级策略片段缺失',
)
const directDispatchDialogSource = sliceRequiredSource(
  sewingDispatchSource,
  'function renderDirectDispatchDialog',
  'function renderBiddingDialog',
  '直接派单弹窗片段缺失',
)
const confirmDispatchSource = sliceRequiredSource(
  sewingDispatchSource,
  "if (action === 'confirm-dispatch')",
  'const factoryCount',
  '确认派单事件片段缺失',
)
const policyOverrideSource = sliceRequiredSource(
  confirmDispatchSource,
  'policyOverrideByRowId',
  'businessAssignedAt',
  '确认派单页面策略覆盖片段缺失',
)
assert.ok(sewingDispatchSource.includes('evaluateThirdPartyFactoryDispatchPolicy'), '车缝分配页面必须使用统一派单规则评估')
assert.ok(sewingDispatchSource.includes('dispatchRiskConfirmedByFactoryId'), '车缝分配页面必须记录黄牌风险确认')
assert.ok(sewingDispatchSource.includes('dispatchSupervisorAssignedByFactoryId'), '车缝分配页面必须记录主管指定确认')
assert.ok(sewingDispatchSource.includes('data-sewing-dispatch-field="dispatchRiskConfirmed"'), '直接派单弹窗必须提供黄牌风险确认入口')
assert.ok(sewingDispatchSource.includes('data-sewing-dispatch-field="dispatchSupervisorAssigned"'), '直接派单弹窗必须提供主管指定确认入口')
assert.ok(pageDispatchPolicyDecisionSource.includes('缺少三方评级快照'), '页面级派单策略必须对治理对象缺评级快照显示阻断')
assert.ok(pageDispatchPolicyDecisionSource.includes("severity: 'BLOCK'"), '页面级派单策略缺评级快照时必须返回 BLOCK')
assert.ok(confirmDispatchSource.includes('policyContextByFactoryId'), '确认派单必须传入页面确认上下文')
assert.ok(confirmDispatchSource.includes('riskConfirmed'), '确认派单必须传入黄牌风险确认上下文')
assert.ok(confirmDispatchSource.includes('supervisorAssigned'), '确认派单必须传入主管指定确认上下文')
assert.ok(policyOverrideSource.includes('documentTypeLabel'), '确认派单页面策略覆盖必须传入单据类型')
assert.ok(policyOverrideSource.includes('isUrgentOrder'), '确认派单页面策略覆盖必须传入急单标记')
assert.ok(!policyOverrideSource.includes('dispatchQty:'), '确认派单页面策略覆盖不得传入 dispatchQty，数量必须由领域层读取真实行数量')
assert.ok(dispatchFactoryOptionSource.includes('getPageDispatchPolicyDecision'), '车缝分配工厂选项未消费页面级统一派单评估结果')
assert.ok(dispatchFactoryOptionSource.includes('displayBadges'), '车缝分配工厂选项未展示统一评估标签')
assert.ok(directDispatchDialogSource.includes('renderDispatchFactoryOption'), '直接派单弹窗未渲染带评级策略的工厂选项')
assert.ok(
  directDispatchDialogSource.includes('确认派单') && directDispatchDialogSource.includes('confirm-dispatch'),
  '直接派单弹窗缺少黄牌提醒后的确认派单动作入口',
)
assert.ok(!sewingDispatchSource.includes('getDispatchFactoryBlockMessage'), '车缝分配页面不应继续使用旧的工厂阻断文案 helper')
assert.ok(!sewingDispatchSource.includes("cooperationStatusLabel === '黑名单'"), '车缝分配页面不应继续用合作状态硬编码黑名单阻断')
assert.ok(!sewingDispatchSource.includes("cooperationStatusLabel === '考核中'"), '车缝分配页面不应继续用合作状态硬编码考核中阻断')

const statementsSource = readRequiredSource(new URL('../src/pages/statements.ts', import.meta.url), '缺少对账单页面文件')
const statementsBuildViewSource = sliceRequiredSource(
  statementsSource,
  'function renderBuildView',
  'export function renderStatementsPage',
  '对账单生成页渲染片段缺失',
)
const statementsGenerateSource = sliceRequiredSource(
  statementsSource,
  "if (action === 'generate')",
  "if (action === 'save-build')",
  '对账单生成动作片段缺失',
)
const statementsSaveBuildSource = sliceRequiredSource(
  statementsSource,
  "if (action === 'save-build')",
  "if (action === 'confirm-draft')",
  '对账单保存草稿动作片段缺失',
)
assert.ok(statementsSource.includes('evaluateThirdPartyFactorySettlementPolicy'), '对账单页面必须使用统一结算规则评估')
assert.ok(statementsSource.includes('settlementPolicy.reason'), '对账单页面必须展示统一结算规则返回的阻断原因')
assert.ok(statementsSource.includes('blacklistSettlementBlocked'), '对账单页面缺少黑名单结算阻断变量')
assert.ok(statementsSource.includes('@page-pattern: dashboard'), '对账单页是复合工作台，必须声明非标准列表页模式')
assert.ok(statementsBuildViewSource.includes('evaluateThirdPartyFactorySettlementPolicy'), '对账单生成页渲染必须使用统一结算规则评估')
assert.ok(statementsBuildViewSource.includes('allowedToCreateNewStatement'), '对账单生成页渲染必须按 allowedToCreateNewStatement 判断阻断')
assert.ok(statementsBuildViewSource.includes('settlementPolicy.reason'), '对账单生成页阻断提示必须展示统一规则原因')
assert.ok(statementsGenerateSource.includes('evaluateThirdPartyFactorySettlementPolicy'), '对账单生成动作必须使用统一结算规则评估')
assert.ok(statementsGenerateSource.includes('allowedToCreateNewStatement'), '对账单生成动作必须按 allowedToCreateNewStatement 阻断')
assert.ok(statementsGenerateSource.includes('settlementPolicy.reason'), '对账单生成动作必须 toast 统一规则原因')
assert.ok(statementsSaveBuildSource.includes('evaluateThirdPartyFactorySettlementPolicy'), '对账单保存草稿动作必须使用统一结算规则评估')
assert.ok(statementsSaveBuildSource.includes('allowedToCreateNewStatement'), '对账单保存草稿动作必须按 allowedToCreateNewStatement 阻断')
assert.ok(statementsSaveBuildSource.includes('settlementPolicy.reason'), '对账单保存草稿动作必须 toast 统一规则原因')
assert.ok(!statementsSource.includes('isThirdPartyFactorySettlementBlocked'), '对账单页面不应继续消费结算布尔 helper')

const settlementSeedSource = readRequiredSource(
  new URL('../src/data/fcs/store-domain-settlement-seeds.ts', import.meta.url),
  '缺少对账单域数据文件',
)
assert.ok(settlementSeedSource.includes('evaluateThirdPartyFactorySettlementPolicy'), '对账单域函数必须使用统一结算规则评估')
const settlementCreateSource = sliceRequiredSource(
  settlementSeedSource,
  'export function createStatementFromEligibleLedgers',
  'export function updateStatementDraftRemark',
  '对账单直接创建域函数片段缺失',
)
const settlementSyncSource = sliceRequiredSource(
  settlementSeedSource,
  'export function syncStatementDraftFromBuild',
  'export function buildStatementSettlementProfileSnapshot',
  '对账单保存草稿域函数片段缺失',
)
assert.ok(settlementCreateSource.includes('evaluateThirdPartyFactorySettlementPolicy'), '对账单直接创建域函数必须使用统一结算规则评估')
assert.ok(settlementCreateSource.includes('allowedToCreateNewStatement'), '对账单直接创建域函数必须按 allowedToCreateNewStatement 阻断')
assert.ok(settlementCreateSource.includes('settlementPolicy.reason'), '对账单直接创建域函数必须返回统一规则原因')
assert.ok(settlementSyncSource.includes('evaluateThirdPartyFactorySettlementPolicy'), '对账单保存草稿域函数必须使用统一结算规则评估')
assert.ok(settlementSyncSource.includes('allowedToCreateNewStatement'), '对账单保存草稿域函数必须按 allowedToCreateNewStatement 阻断')
assert.ok(settlementSyncSource.includes('settlementPolicy.reason'), '对账单保存草稿域函数必须返回统一规则原因')

const routeRendererSource = readRequiredSource(
  new URL('../src/router/route-renderers-fcs.ts', import.meta.url),
  '缺少 FCS 路由 renderer 文件',
)
assert.ok(routeRendererSource.includes('renderThirdPartyFactoryRatingPage'), '缺少三方工厂评级页 renderer')

const routesSource = readRequiredSource(new URL('../src/router/routes-fcs.ts', import.meta.url), '缺少 FCS 路由文件')
assert.ok(routesSource.includes("'/fcs/factories/third-party-rating'"), '缺少三方工厂评级路由')
assert.ok(routesSource.includes('renderThirdPartyFactoryRatingPage'), '三方工厂评级路由未绑定页面 renderer')

const appShellSource = readRequiredSource(new URL('../src/data/app-shell-config.ts', import.meta.url), '缺少应用菜单配置文件')
const profileMenuIndex = appShellSource.indexOf("key: 'factories-profile'")
const ratingMenuIndex = appShellSource.indexOf("key: 'factories-third-party-rating'")
const capacityMenuIndex = appShellSource.indexOf("key: 'factories-capacity-profile'")
assert.ok(profileMenuIndex >= 0 && ratingMenuIndex > profileMenuIndex, '三方工厂评级菜单必须位于工厂档案之后')
assert.ok(capacityMenuIndex > ratingMenuIndex, '三方工厂评级菜单必须位于工厂产能档案之前')
assert.ok(appShellSource.includes("title: '三方工厂评级'"), '菜单标题必须是三方工厂评级')

const fcsHandlersSource = readRequiredSource(
  new URL('../src/main-handlers/fcs-handlers.ts', import.meta.url),
  '缺少 FCS 事件处理文件',
)
assert.ok(fcsHandlersSource.includes('handleThirdPartyFactoryRatingSubmit'), 'FCS submit 分发必须接入三方工厂评级筛选提交')
assert.ok(
  fcsHandlersSource.indexOf('handleThirdPartyFactoryRatingSubmit(form)') >= 0,
  '三方工厂评级筛选提交必须进入 dispatchFcsPageSubmit',
)

console.log('check:third-party-factory-rating passed')
