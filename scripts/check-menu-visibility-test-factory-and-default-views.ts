#!/usr/bin/env node

import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  buildSpecialCraftMenuGroups,
  buildSpecialCraftMenuGroupsForFactory,
  menusBySystem,
} from '../src/data/app-shell-config.ts'
import {
  TEST_FACTORY_ID,
  TEST_FACTORY_SCOPE,
} from '../src/data/fcs/factory-mock-data.ts'
import { listFactoryMasterRecords, listBusinessFactoryMasterRecords } from '../src/data/fcs/factory-master-store.ts'
import {
  listFactoryCapacityEntries,
  listFactoryCapacityEquipments,
  listFactoryCapacityProfiles,
} from '../src/data/fcs/factory-capacity-profile-mock.ts'
import { listPdaBiddingTendersByFactoryId } from '../src/data/fcs/pda-mobile-mock.ts'
import { listPdaGenericTasksByFactory } from '../src/data/fcs/pda-task-mock-factory.ts'
import {
  listCraftsByProcessCode,
  listProcessDefinitions,
} from '../src/data/fcs/process-craft-dict.ts'
import {
  canFactorySeeSpecialCraftOperation,
  listEnabledSpecialCraftOperationDefinitions,
  listVisibleSpecialCraftOperationsForFactoryType,
} from '../src/data/fcs/special-craft-operations.ts'
import {
  buildFactoryWarehouseProgressSnapshots,
  buildSpecialCraftProgressSnapshots,
  getCuttingProgressSnapshots,
  getProductionProgressSnapshots,
} from '../src/data/fcs/progress-statistics-linkage.ts'

const ROOT = fileURLToPath(new URL('..', import.meta.url))

function read(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8')
}

function flattenMenuItems(groups: ReturnType<typeof buildSpecialCraftMenuGroups>) {
  return groups.flatMap((group) => group.items)
}

function assertContains(source: string, token: string, message: string): void {
  assert(source.includes(token), message)
}

function assertNoToken(source: string, token: string, message: string): void {
  assert(!source.includes(token), message)
}

const packageSource = read('package.json')
const appShellSource = read('src/data/app-shell-config.ts')
const specialCraftSource = read('src/data/fcs/special-craft-operations.ts')
const progressLinkageSource = read('src/data/fcs/progress-statistics-linkage.ts')
const productionProgressContextSource = read('src/pages/progress-board/context.ts')
const productionProgressDomainSource = read('src/pages/progress-board/order-domain.ts')
const cuttingProgressSource = read('src/pages/process-factory/cutting/production-progress.ts')
const cuttingProgressModelSource = read('src/pages/process-factory/cutting/production-progress-model.ts')
const specialCraftStatisticsSource = read('src/pages/process-factory/special-craft/statistics.ts')
const factoryMobileWarehouseSource = read('src/data/fcs/factory-mobile-warehouse.ts')
const mobileWarehousePageSource = [
  read('src/pages/pda-warehouse.ts'),
  read('src/pages/pda-warehouse-shared.ts'),
  read('src/pages/pda-warehouse-wait-process.ts'),
  read('src/pages/pda-warehouse-wait-handover.ts'),
  read('src/pages/pda-warehouse-inbound-records.ts'),
  read('src/pages/pda-warehouse-outbound-records.ts'),
].join('\n')
const factoryProfilePageSource = read('src/pages/factory-profile.ts')
const factoryCapacityProfilePageSource = read('src/pages/factory-capacity-profile.ts')
const stepFieldConsumptionScriptSource = [
  read('scripts/check-progress-statistics-linkage.ts'),
  read('scripts/check-cutting-sewing-dispatch.ts'),
  read('scripts/check-factory-internal-warehouse-model.ts'),
  read('scripts/check-factory-handover-warehouse-linkage.ts'),
  read('scripts/check-tech-pack-special-craft-target-object-and-versioning.ts'),
  read('scripts/check-special-craft-task-and-fei-flow-deepening.ts'),
  read('scripts/check-pickup-handout-order-and-warehouse-foundation.ts'),
  read('scripts/check-transfer-bag-mobile-closed-loop.ts'),
].join('\n')
const stepFieldConsumptionSource = [
  progressLinkageSource,
  cuttingProgressSource,
  specialCraftStatisticsSource,
  read('src/data/fcs/cutting/sewing-dispatch.ts'),
  read('src/pages/process-factory/cutting/sewing-dispatch.ts'),
  read('src/pages/pda-handover-detail.ts'),
  read('src/pages/pda-transfer-bag-detail.ts'),
  read('src/pages/pda-warehouse-shared.ts'),
  stepFieldConsumptionScriptSource,
].join('\n')
const specialCraftGuardSource = [
  read('src/pages/process-factory/special-craft/task-orders.ts'),
  read('src/pages/process-factory/special-craft/task-detail.ts'),
  read('src/pages/process-factory/special-craft/statistics.ts'),
  read('src/pages/process-factory/special-craft/warehouse.ts'),
  read('src/pages/process-factory/special-craft/shared.ts'),
].join('\n')

assertContains(packageSource, 'check:menu-visibility-test-factory-and-default-views', 'package.json 缺少 Step 5 检查命令')

const enabledOperations = listEnabledSpecialCraftOperationDefinitions()
const pfosSpecialCraftGroup = menusBySystem.pfos.find((group) => group.title === '特殊工艺')
assert(pfosSpecialCraftGroup, 'PFOS 缺少特殊工艺菜单组')
assert(enabledOperations.length === 7, '启用特殊工艺菜单数量必须为 7')
assert(flattenMenuItems(buildSpecialCraftMenuGroups()).length === 7, 'PFOS 全局特殊工艺菜单必须继续全量显示 7 个启用菜单')
assert(flattenMenuItems(buildSpecialCraftMenuGroupsForFactory(TEST_FACTORY_ID)).length === 7, '全能力测试工厂应可见全部启用特殊工艺菜单')
assertContains(appShellSource, 'buildSpecialCraftMenuGroups()', '缺少 PFOS 全局特殊工艺菜单 helper')
assertContains(appShellSource, 'buildSpecialCraftMenuGroupsForFactory', '缺少工厂上下文特殊工艺菜单 helper')
assertContains(appShellSource, 'const specialCraftMenuGroups: MenuGroup[] = buildSpecialCraftMenuGroups()', 'PFOS 全局特殊工艺菜单不得改成工厂过滤版本')
assertContains(specialCraftSource, 'visibleFactoryTypes', '特殊工艺定义缺少工厂类型可见性字段')
assertContains(specialCraftSource, 'visibleFactoryIds', '特殊工艺定义缺少工厂 ID 可见性字段')
assertContains(specialCraftSource, 'canFactorySeeSpecialCraftOperation', '特殊工艺缺少工厂可见性判断 helper')
assertContains(specialCraftSource, 'listVisibleSpecialCraftOperationsForFactory', '特殊工艺缺少工厂上下文菜单 helper')

const washOperation = enabledOperations.find((item) => item.operationName === '洗水')
assert(washOperation, '缺少洗水特殊工艺定义')
assert(canFactorySeeSpecialCraftOperation('ID-F008', washOperation.operationId), '洗水至少应对水洗相关工厂可见')
assert(!canFactorySeeSpecialCraftOperation('ID-F011', washOperation.operationId), '洗水不应默认对普通特殊工艺厂开放')
assert(
  listVisibleSpecialCraftOperationsForFactoryType('CENTRAL_DENIM_WASH').some((item) => item.operationId === washOperation.operationId),
  '工厂类型过滤下，洗水应对水洗相关工厂可见',
)
assert(
  !listVisibleSpecialCraftOperationsForFactoryType('CENTRAL_SPECIAL').some((item) => item.operationId === washOperation.operationId),
  '工厂类型过滤下，洗水不应默认对普通特殊工艺厂开放',
)

const testFactory = listFactoryMasterRecords().find((factory) => factory.id === TEST_FACTORY_ID)
assert(testFactory, '缺少全能力测试工厂')
assert(testFactory.code === 'F090', '测试工厂编码必须为 F090')
assert(testFactory.name === '全能力测试工厂', '测试工厂名称必须为 全能力测试工厂')
assert(testFactory.isTestFactory === true, '测试工厂必须带 isTestFactory 标识')
assert(testFactory.testFactoryScope === TEST_FACTORY_SCOPE, '测试工厂 testFactoryScope 不正确')

const expectedProcesses = listProcessDefinitions().filter(
  (process) => process.isActive && (process.generatesExternalTask || process.processCode === 'POST_FINISHING'),
)
expectedProcesses.forEach((process) => {
  const ability = testFactory.processAbilities.find((item) => item.processCode === process.processCode)
  assert(ability, `测试工厂缺少能力：${process.processName}`)
  assert((ability.status ?? 'ACTIVE') !== 'DISABLED', `测试工厂能力不应停用：${process.processName}`)
  assert(ability.canReceiveTask === true, `测试工厂能力必须可接单：${process.processName}`)

  if (process.processCode === 'POST_FINISHING') {
    ;['BUTTONHOLE', 'BUTTON_ATTACH', 'IRONING', 'PACKAGING'].forEach((nodeCode) => {
      assert(ability.capacityNodeCodes?.includes(nodeCode as never), `测试工厂后道能力缺少节点：${nodeCode}`)
    })
    return
  }

  const activeCraftCodes = listCraftsByProcessCode(process.processCode).map((item) => item.craftCode)
  assert(activeCraftCodes.length > 0, `${process.processName} 缺少活跃工艺定义`)
  activeCraftCodes.forEach((craftCode) => {
    assert(ability.craftCodes.includes(craftCode), `测试工厂未覆盖工艺：${process.processCode}/${craftCode}`)
  })
})

assert(listFactoryCapacityProfiles().some((item) => item.factoryId === TEST_FACTORY_ID), '测试工厂缺少产能档案')
assert(listFactoryCapacityEntries(TEST_FACTORY_ID).length > 0, '测试工厂缺少可展示产能条目')
assert(listFactoryCapacityEquipments(TEST_FACTORY_ID).length > 0, '测试工厂缺少最小可用设备档案')
assert(listPdaGenericTasksByFactory(TEST_FACTORY_ID).length > 0, '测试工厂缺少最小可用移动端任务 mock')
assert(listPdaBiddingTendersByFactoryId(TEST_FACTORY_ID).length > 0, '测试工厂缺少最小可用移动端招标 mock')

assert(listBusinessFactoryMasterRecords().every((factory) => !factory.isTestFactory), '默认业务工厂列表必须排除测试工厂')
assert(listBusinessFactoryMasterRecords({ includeTestFactories: true }).some((factory) => factory.id === TEST_FACTORY_ID), '显式包含测试工厂时必须能返回测试工厂')
assert(getProductionProgressSnapshots().every((item) => item.factoryId !== TEST_FACTORY_ID), '默认生产进度统计必须排除测试工厂')
assert(getCuttingProgressSnapshots().every((item) => item.factoryId !== TEST_FACTORY_ID), '默认裁床进度统计必须排除测试工厂')
assert(buildSpecialCraftProgressSnapshots().every((item) => item.factoryId !== TEST_FACTORY_ID), '默认特殊工艺统计必须排除测试工厂')
assert(buildFactoryWarehouseProgressSnapshots().every((item) => item.factoryId !== TEST_FACTORY_ID), '默认仓库统计必须排除测试工厂')

assertContains(progressLinkageSource, 'includeTestFactories', '统计联动缺少 includeTestFactories 开关')
assertContains(progressLinkageSource, 'buildSpecialCraftProgressSnapshots(options: ProgressStatisticsBuildOptions = {})', '特殊工艺统计 builder 缺少 includeTestFactories 能力入口')
assertContains(progressLinkageSource, 'buildFactoryWarehouseProgressSnapshots(options: ProgressStatisticsBuildOptions = {})', '仓库统计 builder 缺少 includeTestFactories 能力入口')
assertContains(progressLinkageSource, 'sortProductionProgressByDefaultDueDate', '统计联动缺少生产进度默认交期排序 helper')
assertContains(productionProgressContextSource, 'sortProductionProgressByDefaultDueDate', '生产进度上下文未消费默认交期排序 helper')
assertContains(productionProgressDomainSource, '默认按交期排序', '生产进度页面缺少默认交期排序提示')

assertContains(cuttingProgressModelSource, "'CUT_ORDER' | 'PRODUCTION_ORDER'", '裁床进度模型缺少 CUT_ORDER / PRODUCTION_ORDER 双维度')
assertContains(cuttingProgressSource, "viewDimension: 'CUT_ORDER'", '裁床进度默认维度必须为 CUT_ORDER')
assertContains(cuttingProgressSource, '裁片单维度', '裁床进度缺少裁片单维度切换')
assertContains(cuttingProgressSource, '生产单维度', '裁床进度缺少生产单维度切换')
assertContains(cuttingProgressSource, 'originalCutOrderNo', '裁床进度裁片单维度缺少原始裁片单号来源')

;[
  'selectedTargetObject',
  'supportedTargetObjects',
  'bundleLengthCm',
  'bundleWidthCm',
  'workOrderCount',
  'originalQty',
  'currentQty',
  'scrapQty',
  'damageQty',
  'receiveDifferenceStatus',
  'returnDifferenceStatus',
  'completionStatus',
  'receiverClosedAt',
  'reviewStatus',
  'adjustmentOrderId',
  'bagMode',
  'contentItemCount',
  'contentFeiTicketCount',
  'packStatus',
  'combinedWritebackStatus',
  'receivedTransferBagCount',
  'receivedFeiTicketCount',
].forEach((token) => {
  assertContains(stepFieldConsumptionSource, token, `Step 1-4 字段尚未进入统计、看板或检查脚本消费：${token}`)
})

assertContains(specialCraftStatisticsSource, '按工艺分组', '特殊工艺统计必须默认按工艺分组')
assertNoToken(specialCraftStatisticsSource, '水洗批次', '洗水统计不应新增水洗批次维度')
assertContains(specialCraftStatisticsSource, '作用对象', '特殊工艺统计缺少作用对象消费')
assertContains(specialCraftStatisticsSource, '子工艺单数', '特殊工艺统计缺少子工艺单数字段')
assertContains(specialCraftStatisticsSource, '接收差异菲票', '特殊工艺统计缺少接收差异菲票字段')
assertContains(specialCraftStatisticsSource, '回仓差异菲票', '特殊工艺统计缺少回仓差异菲票字段')

assertContains(specialCraftGuardSource, 'resolveSpecialCraftFactoryContextGuard', '特殊工艺页面缺少工厂上下文 guard')
assertContains(specialCraftGuardSource, '当前工厂无该特殊工艺入口', '特殊工艺页面缺少工厂上下文空态')

assertContains(factoryProfilePageSource, '测试工厂', '工厂档案页缺少测试工厂标签')
assertContains(factoryCapacityProfilePageSource, '测试工厂', '工厂产能档案页缺少测试工厂标签')
assertContains(`${factoryMobileWarehouseSource}\n${mobileWarehousePageSource}`, '待收中转袋', '工厂端仓管缺少车缝轻量接收数据')
assertContains(`${factoryMobileWarehouseSource}\n${mobileWarehousePageSource}`, '待加工仓', '非车缝工厂仓管数据缺少待加工仓')
assertContains(`${factoryMobileWarehouseSource}\n${mobileWarehousePageSource}`, '待交出仓', '非车缝工厂仓管数据缺少待交出仓')

;[
  'PDA',
  'QR payload',
  'JSON.stringify',
].forEach((token) => {
  assertNoToken(
    [
      productionProgressDomainSource,
      cuttingProgressSource,
      specialCraftStatisticsSource,
      factoryProfilePageSource,
      factoryCapacityProfilePageSource,
    ].join('\n'),
    token,
    `用户可见界面不应出现：${token}`,
  )
})

;[
  '库存三态',
  '可用库存',
  '占用库存',
  '在途库存',
  '上架任务',
  '拣货波次',
  '完整库存账',
  'axios',
  'fetch(',
  'apiClient',
  '/api/',
  'i18n',
  'useTranslation',
  'echarts',
  'chart.js',
  'recharts',
].forEach((token) => {
  assertNoToken(
    `${progressLinkageSource}\n${specialCraftSource}\n${factoryMobileWarehouseSource}`,
    token,
    `Step 5 不应引入越界能力：${token}`,
  )
})

console.log(
  JSON.stringify(
    {
      pfosSpecialCraftMenuCount: flattenMenuItems(buildSpecialCraftMenuGroups()).length,
      testFactoryVisibleSpecialCraftMenuCount: flattenMenuItems(buildSpecialCraftMenuGroupsForFactory(TEST_FACTORY_ID)).length,
      testFactoryAbilityCount: testFactory.processAbilities.length,
      testFactoryCapacityEntryCount: listFactoryCapacityEntries(TEST_FACTORY_ID).length,
      testFactoryEquipmentCount: listFactoryCapacityEquipments(TEST_FACTORY_ID).length,
      testFactoryTaskCount: listPdaGenericTasksByFactory(TEST_FACTORY_ID).length,
      testFactoryBiddingCount: listPdaBiddingTendersByFactoryId(TEST_FACTORY_ID).length,
      默认统计排除测试工厂: '通过',
      默认视图收边: '通过',
    },
    null,
    2,
  ),
)
