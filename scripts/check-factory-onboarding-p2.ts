import { execSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import { getFactoryCapacityProfileByFactoryId } from '../src/data/fcs/factory-capacity-profile-mock.ts'
import {
  calculateOnboardingCompleteness,
  confirmFactoryOnboardingCooperation,
  createCapabilityFromSelection,
  getCompletenessLevel,
  getCompletenessMissingItems,
  getPrimaryFactoryType,
  inferFactoryTypesFromCapabilities,
  listSelectableProcessCraftOptions,
  saveFactoryOnboardingDraft,
  submitFactoryOnboardingApplication,
} from '../src/data/fcs/factory-onboarding-flow.ts'
import { createEmptyFactoryOnboardingDraft, listFactoryOnboardingApplications } from '../src/data/fcs/factory-onboarding-store.ts'
import { normalizeWhatsApp, validateWhatsApp } from '../src/data/fcs/whatsapp-validator.ts'

const root = process.cwd()

function assert(condition: unknown, message: string): void {
  if (!condition) {
    throw new Error(`工厂入驻 P2 检查失败：${message}`)
  }
}

function read(path: string): string {
  return readFileSync(join(root, path), 'utf8')
}

function assertIncludes(path: string, needles: string[]): void {
  const source = read(path)
  for (const needle of needles) {
    assert(source.includes(needle), `${path} 缺少 ${needle}`)
  }
}

function assertNotIncludes(path: string, needles: string[]): void {
  const source = read(path)
  for (const needle of needles) {
    assert(!source.includes(needle), `${path} 不应包含 ${needle}`)
  }
}

function runCheck(command: string): string {
  return execSync(command, {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  })
}

function createCapability(processName: string, craftName: string) {
  const process = listSelectableProcessCraftOptions().find((item) => item.processName === processName)
  assert(process, `未找到工序 ${processName}`)
  const craft = process!.crafts.find((item) => item.craftName === craftName)
  assert(craft, `未找到工艺 ${processName}/${craftName}`)
  const capability = createCapabilityFromSelection(process!.processCode, craft!.craftCode)
  assert(capability, `无法创建能力 ${processName}/${craftName}`)
  return capability
}

async function main() {
  const p0ScriptPath = 'scripts/check-factory-onboarding-p0.ts'
  const p1ScriptPath = 'scripts/check-factory-onboarding-p1.ts'
  const p2ScriptPath = 'scripts/check-factory-onboarding-p2.ts'
  const domainPath = 'src/data/fcs/factory-onboarding-domain.ts'
  const flowPath = 'src/data/fcs/factory-onboarding-flow.ts'
  const storePath = 'src/data/fcs/factory-onboarding-store.ts'
  const pdaPath = 'src/pages/pda-onboarding.ts'
  const platformPath = 'src/pages/factory-onboarding.ts'
  const capacityPath = 'src/pages/factory-capacity-profile.ts'
  const routesPdaPath = 'src/router/routes-pda.ts'
  const whatsappPath = 'src/data/fcs/whatsapp-validator.ts'
  const capacityMockPath = 'src/data/fcs/factory-capacity-profile-mock.ts'

  assert(existsSync(join(root, p0ScriptPath)), 'P0 检查脚本不存在')
  assert(existsSync(join(root, p1ScriptPath)), 'P1 检查脚本不存在')
  assert(runCheck('npx tsx scripts/check-factory-onboarding-p0.ts').includes('factory onboarding p0 checks passed'), 'P0 检查脚本不可执行')
  assert(runCheck('npx tsx scripts/check-factory-onboarding-p1.ts').includes('factory onboarding p1 checks passed'), 'P1 检查脚本不可执行')

  assertIncludes(domainPath, ['completenessScore', 'completenessLevel', 'completenessItems', 'inferredFactoryTypes', 'primaryFactoryType'])
  assertIncludes(flowPath, ['calculateOnboardingCompleteness', 'getCompletenessLevel', 'getCompletenessMissingItems', 'inferFactoryTypesFromCapabilities', 'getPrimaryFactoryType'])
  assertIncludes(capacityMockPath, ['createInitialCapacityProfileFromOnboarding', 'sourceApplicationId', 'machineTotalCount', 'defaultDailyAvailablePublishedSam', '待补充产能字段'])
  assertIncludes(whatsappPath, ['normalizeWhatsApp', 'validateWhatsApp', 'formatWhatsAppForDisplay'])
  assertIncludes(pdaPath, ['资料完整性评分', '查看待补充项', '系统匹配工厂类型'])
  assertIncludes(platformPath, ['资料完整性评分', '匹配工厂类型', '缺失项', '系统匹配工厂类型'])
  assertIncludes(capacityPath, ['SAM 计算状态', '匹配工厂类型'])
  assertNotIncludes(routesPdaPath, ["'/fcs/pda/login'", "renderRouteRedirect('/fcs/pda/auth/login'"])
  assertNotIncludes(flowPath, ['/fcs/pda/login'])
  assertNotIncludes(pdaPath, ['PENDING', 'DONE', 'IN_PROGRESS'])
  assertNotIncludes(platformPath, ['PENDING', 'DONE', 'IN_PROGRESS'])

  assert(getCompletenessLevel(59) === '不完整', '完整性等级 59 应为不完整')
  assert(getCompletenessLevel(60) === '基本完整', '完整性等级 60 应为基本完整')
  assert(getCompletenessLevel(80) === '完整', '完整性等级 80 应为完整')
  assert(getCompletenessLevel(95) === '高完整', '完整性等级 95 应为高完整')

  const lowDraft = createEmptyFactoryOnboardingDraft()
  lowDraft.adminAccount.loginId = `p2_low_${Date.now()}`
  lowDraft.adminAccount.password = '123456'
  lowDraft.adminAccount.adminName = 'P2低分管理员'
  lowDraft.adminAccount.whatsapp = '081234567890'
  lowDraft.factoryName = 'P2低分工厂'
  lowDraft.bossName = '低分老板'
  lowDraft.whatsapp = '081234567890'
  lowDraft.machineTotalCount = 0
  lowDraft.effectiveWorkerCount = 0
  const savedLowDraft = saveFactoryOnboardingDraft(lowDraft, '123456')
  assert(savedLowDraft.completenessScore < 80, '低分草稿完整性评分应低于 80')
  const lowMissingItems = getCompletenessMissingItems(savedLowDraft)
  assert(lowMissingItems.length > 0, '低分草稿应存在缺失项')
  let lowScoreBlocked = false
  try {
    submitFactoryOnboardingApplication({
      applicationId: savedLowDraft.applicationId,
      applicationNo: savedLowDraft.applicationNo,
      factoryTempId: savedLowDraft.factoryTempId,
      factoryName: savedLowDraft.factoryName,
      bossName: savedLowDraft.bossName,
      whatsapp: savedLowDraft.whatsapp,
      address: savedLowDraft.address,
      machineTotalCount: savedLowDraft.machineTotalCount,
      effectiveWorkerCount: savedLowDraft.effectiveWorkerCount,
      availableStartDate: savedLowDraft.availableStartDate,
      selectedCapabilities: savedLowDraft.selectedCapabilities.map((item) => ({ ...item })),
      machines: savedLowDraft.machines.map((item) => ({ ...item })),
      adminAccount: { ...savedLowDraft.adminAccount },
    }, '123456')
  } catch (error) {
    lowScoreBlocked = error instanceof Error && error.message.includes('资料完整性不足 80 分，请先补充必填信息后再提交。')
  }
  assert(lowScoreBlocked, '完整性评分低于 80 时提交应被阻止')

  const cuttingCapability = createCapability('裁片', '定位裁')
  const printingCapability = createCapability('印花', '数码印')
  const dyeCapability = createCapability('染色', '匹染')
  const postCapability = createCapability('后道', '包装')
  const specialCapability = createCapability('特殊工艺', '打揽')

  assert(inferFactoryTypesFromCapabilities([cuttingCapability])[0]?.factoryTypeCode === 'CUTTING_FACTORY', '裁床能力应匹配裁床厂')
  assert(inferFactoryTypesFromCapabilities([printingCapability])[0]?.factoryTypeCode === 'PRINTING_FACTORY', '印花能力应匹配印花厂')
  assert(inferFactoryTypesFromCapabilities([dyeCapability])[0]?.factoryTypeCode === 'DYEING_FACTORY', '染色能力应匹配染厂')
  assert(inferFactoryTypesFromCapabilities([postCapability])[0]?.factoryTypeCode === 'POST_FINISHING_FACTORY', '后道能力应匹配后道工厂')
  assert(inferFactoryTypesFromCapabilities([specialCapability])[0]?.factoryTypeCode === 'SPECIAL_CRAFT_FACTORY', '特殊工艺能力应匹配特殊工艺厂')
  assert(getPrimaryFactoryType(inferFactoryTypesFromCapabilities([cuttingCapability, printingCapability, dyeCapability])) === 'MULTI_CAPABILITY_FACTORY', '多能力应匹配全能力工厂')

  assert(normalizeWhatsApp('081234567890') === '+6281234567890', '081234567890 应归一为 +6281234567890')
  assert(normalizeWhatsApp('6281234567890') === '+6281234567890', '6281234567890 应归一为 +6281234567890')
  assert(normalizeWhatsApp('+6281234567890') === '+6281234567890', '+6281234567890 应保持归一结果')
  assert(validateWhatsApp('08中文-1').errorMessage === 'WhatsApp 格式不正确，请填写印尼手机号，例如 +6281234567890', '非法 WhatsApp 应返回中文错误')

  const applications = listFactoryOnboardingApplications()
  const completenessBuckets = applications.reduce<Record<string, number>>((result, item) => {
    result[item.completenessLevel] = (result[item.completenessLevel] || 0) + 1
    return result
  }, {})
  assert((completenessBuckets['不完整'] || 0) >= 3, '不完整评分数据不足 3 条')
  assert((completenessBuckets['基本完整'] || 0) >= 3, '基本完整评分数据不足 3 条')
  assert((completenessBuckets['完整'] || 0) >= 3, '完整评分数据不足 3 条')
  assert((completenessBuckets['高完整'] || 0) >= 3, '高完整评分数据不足 3 条')

  const typeBuckets = applications.reduce<Record<string, number>>((result, item) => {
    result[item.primaryFactoryType] = (result[item.primaryFactoryType] || 0) + 1
    return result
  }, {})
  assert((typeBuckets['CUTTING_FACTORY'] || 0) >= 3, '裁床厂匹配数据不足 3 条')
  assert((typeBuckets['PRINTING_FACTORY'] || 0) >= 3, '印花厂匹配数据不足 3 条')
  assert((typeBuckets['DYEING_FACTORY'] || 0) >= 3, '染厂匹配数据不足 3 条')
  assert((typeBuckets['POST_FINISHING_FACTORY'] || 0) >= 3, '后道工厂匹配数据不足 3 条')
  assert((typeBuckets['SPECIAL_CRAFT_FACTORY'] || 0) >= 3, '特殊工艺厂匹配数据不足 3 条')
  assert((typeBuckets['MULTI_CAPABILITY_FACTORY'] || 0) >= 3, '全能力工厂匹配数据不足 3 条')

  const cooperatedApps = applications.filter((item) => item.status === '已合作' && item.transferRecords.some((record) => record.capacityProfileGenerated))
  assert(cooperatedApps.length >= 3, '已合作且已生成产能档案数据不足 3 条')

  const approvedApplication = applications.find((item) => item.status === '审核通过待确认合作')
  assert(approvedApplication, '缺少审核通过待确认合作申请')
  const confirmed = await confirmFactoryOnboardingCooperation({
    applicationId: approvedApplication!.applicationId,
    operator: 'P2检查员',
  })
  assert(confirmed.status === '已合作', '确认合作后状态应变为已合作')
  assert(typeof confirmed.createdFactoryId === 'string' && confirmed.createdFactoryId.length > 0, '确认合作后应写入 createdFactoryId')
  assert(confirmed.primaryFactoryType.length > 0, '确认合作后工厂档案应写入工厂类型')
  const latestTransfer = confirmed.transferRecords.at(-1)
  assert(latestTransfer?.factoryProfileGenerated, '确认合作后应生成工厂档案')
  assert(latestTransfer?.adminAccountGenerated, '确认合作后应生成管理员账号')
  assert(latestTransfer?.capacityProfileGenerated, '确认合作后应生成产能档案')
  assert(typeof latestTransfer?.capacityProfileId === 'string' && latestTransfer.capacityProfileId.length > 0, '确认合作后应生成产能档案编号')

  const profile = getFactoryCapacityProfileByFactoryId(confirmed.createdFactoryId!)
  assert(profile.sourceApplicationId === confirmed.applicationId, '产能档案应写入 sourceApplicationId')
  assert(profile.sourceApplicationNo === confirmed.applicationNo, '产能档案应写入 sourceApplicationNo')
  assert(profile.effectiveWorkerCount === confirmed.effectiveWorkerCount, '产能档案应写入有效工人数量')
  assert(profile.machineTotalCount === confirmed.machineTotalCount, '产能档案应写入机器总数')
  assert(profile.capabilityItems.length > 0, '产能档案应写入 capabilityItems')
  assert(profile.machineItems.length > 0, '产能档案应写入 machineItems')
  assert(profile.defaultDailyAvailablePublishedSam === 0, '默认日可供给发布工时 SAM 当前应为 0')
  assert(profile.calculationStatus === '待补充产能字段', '缺少计算字段时 calculationStatus 应为待补充产能字段')
  assert(profile.calculationNotes.includes('待补充字段后计算'), '产能档案应写入待补充字段说明')
  assert(!('currentStatus' in profile), '不应生成产能当前状态')
  assert(!('dayShift' in profile), '不应生成白班字段')
  assert(!('nightShift' in profile), '不应生成夜班字段')
  assert(!('weeklyDefaultSupply' in profile), '不应生成按周默认供给能力')

  const storeSource = read(storePath)
  assert(storeSource.includes('08中文-'), 'mock 数据应覆盖非法 WhatsApp 场景')
  assert(storeSource.includes('0812345678'), 'mock 数据应覆盖 0 开头 WhatsApp 输入')
  assert(storeSource.includes('62812345678'), 'mock 数据应覆盖 62 开头 WhatsApp 输入')
  assert(storeSource.includes('+62812345678'), 'mock 数据应覆盖 +62 开头 WhatsApp 输入')

  assert(existsSync(join(root, p2ScriptPath)), 'P2 检查脚本不存在')
  console.log('factory onboarding p2 checks passed')
}

await main()
