import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  canCreateFactoryProfile,
  canFactoryEnterBusiness,
} from '../src/data/fcs/factory-onboarding-domain.ts'
import {
  buildFactoryProfileFromOnboarding,
  buildOfficialFactoryConversionRecord,
  canConvertOnboardingToOfficialFactory,
  convertOnboardingAdminAccountToOfficial,
  convertOnboardingToOfficialFactory,
  createInitialCapacityProfileFromOnboarding,
  validateOfficialFactoryConversion,
} from '../src/data/fcs/factory-onboarding-flow.ts'
import {
  listFactoryOnboardingApplications,
} from '../src/data/fcs/factory-onboarding-store.ts'
import {
  getSampleVerificationByApplicationId,
} from '../src/data/fcs/factory-sample-verification-store.ts'
import {
  listBusinessFactoryMasterRecords,
  listFactoryMasterRecords,
} from '../src/data/fcs/factory-master-store.ts'
import {
  findFactoryPdaUserByLoginId,
} from '../src/data/fcs/store-domain-pda.ts'
import {
  listFactoryCapacityProfiles,
} from '../src/data/fcs/factory-capacity-profile-mock.ts'

const root = process.cwd()
const src = (path: string) => readFileSync(resolve(root, path), 'utf8')

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`工厂入驻 Step6 正式转档检查失败：${message}`)
}

function assertIncludes(path: string, snippets: string[]): void {
  const content = src(path)
  for (const snippet of snippets) {
    assert(content.includes(snippet), `${path} 缺少 ${snippet}`)
  }
}

function assertNotIncludes(path: string, snippets: string[]): void {
  const content = src(path)
  for (const snippet of snippets) {
    assert(!content.includes(snippet), `${path} 不应包含 ${snippet}`)
  }
}

const flowPath = 'src/data/fcs/factory-onboarding-flow.ts'
const domainPath = 'src/data/fcs/factory-onboarding-domain.ts'
const platformPath = 'src/pages/factory-onboarding.ts'
const pdaPath = 'src/pages/pda-onboarding.ts'
const pdaRoutesPath = 'src/router/routes-pda.ts'
const factoryMasterPath = 'src/data/fcs/factory-master-store.ts'
const capacityPath = 'src/data/fcs/factory-capacity-profile-mock.ts'
const dispatchBoardContextPath = 'src/pages/dispatch-board/context.ts'
const dispatchTenderPath = 'src/pages/dispatch-tenders.ts'

assertIncludes(flowPath, [
  'convertOnboardingToOfficialFactory',
  'canConvertOnboardingToOfficialFactory',
  'validateOfficialFactoryConversion',
  'buildFactoryProfileFromOnboarding',
  'convertOnboardingAdminAccountToOfficial',
  'createInitialCapacityProfileFromOnboarding',
  'buildOfficialFactoryConversionRecord',
  '只有样衣审核通过待转正式的申请可以转为正式合作工厂。',
])
assertIncludes(domainPath, [
  'conversionRecords',
  'FactoryOnboardingConversionRecord',
  'createdFactoryNo',
  'officialAdminAccountId',
  'capacityProfileCreated',
])
assertIncludes(platformPath, [
  '转正式合作',
  '样衣通过后转正式合作',
  '工厂档案：生成',
  '管理员账号：转正',
  '产能档案：生成',
  'PDA 权限：开放',
  '查看工厂档案',
  '转档记录',
])
assertIncludes(flowPath, ['已转正式合作'])
assertIncludes(pdaPath, ['已转正式合作', '进入执行'])
assertIncludes(factoryMasterPath, ['listBusinessFactoryMasterRecords', 'allowDispatch'])
assertIncludes(dispatchBoardContextPath, ['listBusinessFactoryMasterRecords'])
assertIncludes(dispatchTenderPath, ['listBusinessFactoryMasterRecords'])
assertIncludes(capacityPath, [
  'sourceApplicationId',
  'capabilityItems',
  'machineItems',
  'defaultDailyOutputValue: 0',
  "calculationStatus: '待补充产能字段'",
])
assertNotIncludes(pdaRoutesPath, ["'/fcs/pda/login'", '"/fcs/pda/login"'])
assertNotIncludes(platformPath, ['平台初审通过直接转正式', '发放样衣后直接转正式', '待平台审核样衣直接转正式'])
assertNotIncludes(platformPath, ['PENDING', 'DONE', 'IN_PROGRESS'])
assertNotIncludes(pdaPath, ['PENDING', 'DONE', 'IN_PROGRESS'])

for (const status of ['草稿', '待平台审核', '平台审核退回', '平台审核拒绝', '待样衣验证', '待工厂确认收样', '待工厂提交样衣审核', '待平台审核样衣', '样衣审核退回', '样衣审核拒绝'] as const) {
  const application = listFactoryOnboardingApplications().find((item) => item.status === status)
  assert(application, `mock 数据缺少非法转档状态：${status}`)
  assert(!canConvertOnboardingToOfficialFactory(application), `${status} 不允许转正式`)
  assert(!canFactoryEnterBusiness(status), `${status} 不允许进入业务页`)
}
assert(!canFactoryEnterBusiness('样衣审核通过待转正式'), '样衣审核通过待转正式转档前不允许进入业务页')
assert(canFactoryEnterBusiness('已转正式合作'), '已转正式合作才允许进入业务页')
assert(canCreateFactoryProfile('样衣审核通过待转正式'), '只有样衣审核通过待转正式允许创建工厂档案')

const pendingConversions = listFactoryOnboardingApplications().filter((item) => item.status === '样衣审核通过待转正式')
assert(pendingConversions.length >= 3, 'mock 数据缺少 3 条样衣审核通过待转正式')
assert(pendingConversions.every((item) => !item.createdFactoryId && item.adminAccount.accountStatus !== '已转正式'), '待转正式 mock 不应提前生成档案或转正账号')

const convertedSeeds = listFactoryOnboardingApplications().filter((item) => item.status === '已转正式合作')
assert(convertedSeeds.length >= 3, 'mock 数据缺少 3 条已转正式合作')
assert(convertedSeeds.every((item) => item.createdFactoryId && item.conversionRecords.length > 0 && item.adminAccount.accountStatus === '已转正式'), '已转正式合作 mock 必须有工厂档案、转档记录和正式账号状态')

const target = pendingConversions[0]
const targetSample = getSampleVerificationByApplicationId(target.applicationId)
assert(targetSample?.status === '样衣审核通过', '待转正式申请必须关联已通过样衣验证')
assert(canConvertOnboardingToOfficialFactory(target), '样衣审核通过待转正式且样衣通过时应允许转档')

const illegalStatusApplication = listFactoryOnboardingApplications().find((item) => item.status === '待平台审核样衣')
assert(illegalStatusApplication, '缺少待平台审核样衣非法转档样本')
assert(validateOfficialFactoryConversion(illegalStatusApplication).includes('只有样衣审核通过待转正式的申请可以转为正式合作工厂。'), '非法状态应返回中文错误')

const result = await convertOnboardingToOfficialFactory(target.applicationId, '检查脚本转档员')
assert(result.application.status === '已转正式合作', '转正式后 application.status 应为已转正式合作')
assert(result.application.currentNode === '完成', '转正式后 currentNode 应为完成')
assert(Boolean(result.application.createdFactoryId), '转正式后必须写入 createdFactoryId')
assert(result.application.conversionRecords.length > 0, '转正式后必须写入 conversionRecords')
assert(result.application.actionLogs.some((item) => item.actionName === '样衣通过后转正式合作'), '转正式后必须写入 actionLogs')
assert(result.application.nodeLogs.some((item) => item.nodeName === '完成' && item.nodeStatus === '已完成'), '转正式后必须更新完成节点')
assert(result.createdFactory.onboardingApplicationId === target.applicationId, 'FactoryProfile 必须包含 onboardingApplicationId')
assert(result.createdFactory.sampleVerificationId === target.sampleVerificationId, 'FactoryProfile 必须包含 sampleVerificationId')
assert((result.createdFactory.selectedCapabilities?.length || 0) > 0, 'FactoryProfile 必须包含工序工艺能力')
assert((result.createdFactory.machines?.length || 0) > 0, 'FactoryProfile 必须包含机器能力')
assert(result.createdFactory.effectiveWorkerCount === target.effectiveWorkerCount, 'FactoryProfile 必须包含有效工人数量')
assert(result.capacityProfile.sourceApplicationId === target.applicationId, '产能档案必须包含 sourceApplicationId')
assert(result.capacityProfile.capabilityItems.length > 0, '产能档案必须包含 capabilityItems')
assert(result.capacityProfile.machineItems.length > 0, '产能档案必须包含 machineItems')
assert(result.capacityProfile.defaultDailyOutputValue === 0, '缺字段时 defaultDailyOutputValue 必须为 0')
assert(result.capacityProfile.calculationStatus === '待补充产能字段', '缺字段时 calculationStatus 必须为待补充产能字段')
assert(!('currentStatus' in result.capacityProfile), '不得生成产能当前状态')
assert(!('dayShift' in result.capacityProfile), '不得生成白班')
assert(!('nightShift' in result.capacityProfile), '不得生成夜班')
assert(!('weeklyDefaultSupply' in result.capacityProfile), '不得生成按周默认供给能力')

const officialUser = findFactoryPdaUserByLoginId(target.adminAccount.loginId)
assert(officialUser?.factoryId === result.createdFactory.id, '管理员账号必须转为正式工厂管理员')
assert(officialUser.loginId === target.adminAccount.loginId, '转正式后登录账号必须保持原 loginId')
assert(officialUser.roleName === '工厂管理员', '正式管理员账号 roleName 必须为工厂管理员')
assert(officialUser.isTemporary === false, '正式管理员账号 isTemporary 必须为 false')

const factories = listFactoryMasterRecords()
assert(factories.some((item) => item.id === result.createdFactory.id), '工厂档案列表必须包含转正式工厂')
assert(listFactoryCapacityProfiles().some((item) => item.factoryId === result.createdFactory.id && item.sourceApplicationId === target.applicationId), '产能档案列表必须包含转正式初始数据')
const dispatchableFactories = listBusinessFactoryMasterRecords()
assert(dispatchableFactories.some((item) => item.id === result.createdFactory.id), '已转正式工厂应进入派单候选')
assert(!dispatchableFactories.some((item) => item.name === pendingConversions[1]?.factoryCompanyName), '样衣审核通过待转正式但未转档工厂不得进入派单候选')
assert(!dispatchableFactories.some((item) => item.name === listFactoryOnboardingApplications().find((app) => app.status === '待样衣验证')?.factoryCompanyName), '待样衣验证工厂不得进入派单候选')

const builtProfile = buildFactoryProfileFromOnboarding(result.application)
const builtCapacity = createInitialCapacityProfileFromOnboarding(result.application, builtProfile)
const rebuiltRecord = buildOfficialFactoryConversionRecord(result.application, builtProfile, builtCapacity, '检查脚本')
assert(rebuiltRecord.toStatus === '已转正式合作', '转档记录 toStatus 必须为已转正式合作')
await convertOnboardingAdminAccountToOfficial(result.application, builtProfile)

console.log('工厂入驻 Step6 样衣通过后正式转档检查通过')
