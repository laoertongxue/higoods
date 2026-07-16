import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { indonesiaFactories } from '../src/data/fcs/indonesia-factories.ts'
import { listFactoryMasterRecords } from '../src/data/fcs/factory-master-store.ts'
import {
  createSewingDispatchWorkbenchDraft,
  listSewingDispatchWorkbenchRows,
  listSewingFactoryOptions,
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
  getThirdPartyFactoryRatingSnapshot,
  isThirdPartyFactorySettlementBlocked,
  listThirdPartyFactoryPerformanceRecords,
  listThirdPartyFactoryRatingSnapshots,
} from '../src/data/fcs/third-party-factory-rating.ts'

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
for (const blockedSnapshot of blockedSnapshots) {
  const blockedDispatchResult = createSewingDispatchWorkbenchDraft({
    actionType: '直接派单',
    rowIds: [firstDispatchRow.rowId],
    factoryIdByRowId: { [firstDispatchRow.rowId]: blockedSnapshot.factoryId },
    by: '对抗式核查',
  })
  assert.equal(blockedDispatchResult.ok, false, `${blockedSnapshot.factoryId} 不能绕过页面直接创建车缝分配草稿`)
  assert.ok(blockedDispatchResult.message.includes('不能派单'), `${blockedSnapshot.factoryId} 直接派单应返回派单拦截提示`)

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
  assert.ok(blockedStatementResult.message?.includes('已拉黑'), `${blockedSnapshot.factoryId} 直接建单应返回结算拦截提示`)
}

const source = readRequiredSource(
  new URL('../src/data/fcs/third-party-factory-rating.ts', import.meta.url),
  '缺少三方工厂评级数据源文件',
)
assert.ok(source.includes('近 90 天仅用于生产时效查看'), '缺少 90 天非考核期说明')
assert.ok(!source.includes('TRIAL') && !source.includes('BLACKLISTED'), '页面数据不应直接暴露英文状态码')

const ratingPageSource = readRequiredSource(
  new URL('../src/pages/third-party-factory-rating.ts', import.meta.url),
  '缺少三方工厂评级页文件',
)
assert.ok(ratingPageSource.includes('@page-pattern: list'), '三方工厂评级页必须声明标准列表页模式')
assert.ok(ratingPageSource.includes('renderStandardListPage'), '三方工厂评级页必须使用标准列表页外壳')
assert.ok(ratingPageSource.includes('renderStandardListTable'), '三方工厂评级页必须使用标准列表表格')
assert.ok(ratingPageSource.includes('renderTablePagination'), '三方工厂评级页必须使用标准分页')
assert.ok(ratingPageSource.includes('listThirdPartyFactoryRatingSnapshots'), '三方工厂评级页必须读取评级快照')
assert.ok(ratingPageSource.includes('联动统计'), '三方工厂评级页必须表达筛选后联动统计')
assert.ok(ratingPageSource.includes('查看评级'), '三方工厂评级页必须有详情入口')

const filterIndex = ratingPageSource.indexOf('data-third-party-rating-filters')
const statsIndex = ratingPageSource.indexOf('data-third-party-rating-stats')
assert.ok(filterIndex >= 0, '三方工厂评级页缺少筛选区标记')
assert.ok(statsIndex > filterIndex, '联动统计卡片必须位于筛选区下方')

const factoryProfileSource = readRequiredSource(
  new URL('../src/pages/factory-profile.ts', import.meta.url),
  '缺少工厂档案页文件',
)
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
const directDispatchDialogSource = sliceRequiredSource(
  sewingDispatchSource,
  'function renderDirectDispatchDialog',
  'function renderBiddingDialog',
  '直接派单弹窗片段缺失',
)
assert.ok(dispatchFactoryOptionSource.includes('getThirdPartyFactoryRatingSnapshot'), '车缝分配工厂选项未读取评级快照')
assert.ok(dispatchFactoryOptionSource.includes('dispatchPolicyLabel'), '车缝分配工厂选项未展示评级派单策略')
assert.ok(directDispatchDialogSource.includes('renderDispatchFactoryOption'), '直接派单弹窗未渲染带评级策略的工厂选项')
assert.ok(
  directDispatchDialogSource.includes('确认派单') && directDispatchDialogSource.includes('confirm-dispatch'),
  '直接派单弹窗缺少黄牌提醒后的确认派单动作入口',
)
assert.ok(sewingDispatchSource.includes('该工厂为黄牌工厂，建议只分配小单、简单单'), '车缝分配缺少 B 级黄牌提醒')
assert.ok(sewingDispatchSource.includes('该工厂已拉黑，不能派单。请更换工厂。'), '车缝分配缺少黑名单派单拦截')
assert.ok(sewingDispatchSource.includes('该工厂还在试用期，只能接试产单。'), '车缝分配缺少考核中拦截')

const statementsSource = readRequiredSource(new URL('../src/pages/statements.ts', import.meta.url), '缺少对账单页面文件')
assert.ok(statementsSource.includes('isThirdPartyFactorySettlementBlocked'), '对账单页面未判断黑名单结算拦截')
assert.ok(statementsSource.includes('该工厂已拉黑，不能发起结算。请主管处理历史账款。'), '对账单页面缺少黑名单结算提示')
assert.ok(statementsSource.includes('blacklistSettlementBlocked'), '对账单页面缺少黑名单结算阻断变量')

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

console.log('check:third-party-factory-rating passed')
