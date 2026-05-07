import { execSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import {
  calculateOnboardingCompleteness,
  canCreateFactoryProfile,
  canFactoryEnterBusiness,
  createCapabilityFromSelection,
  createDefaultMachineDraft,
  getCompletenessLevel,
  getCompletenessMissingItems,
  getPrimaryFactoryType,
  inferFactoryTypesFromCapabilities,
  listSelectableProcessCraftOptions,
  saveFactoryOnboardingDraft,
  submitFactoryOnboardingApplication,
  validateFactoryOnboardingDraftPayload,
} from '../src/data/fcs/factory-onboarding-flow.ts'
import { createEmptyFactoryOnboardingDraft, listFactoryOnboardingApplications } from '../src/data/fcs/factory-onboarding-store.ts'

const root = process.cwd()

function assert(condition: unknown, message: string): void {
  if (!condition) throw new Error(`工厂入驻 P2 检查失败：${message}`)
}

function read(path: string): string {
  return readFileSync(join(root, path), 'utf8')
}

function assertIncludes(path: string, needles: string[]): void {
  const source = read(path)
  for (const needle of needles) assert(source.includes(needle), `${path} 缺少 ${needle}`)
}

function assertNotIncludes(path: string, needles: string[]): void {
  const source = read(path)
  for (const needle of needles) assert(!source.includes(needle), `${path} 不应包含 ${needle}`)
}

function runCheck(command: string): string {
  return execSync(command, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
}

function createCapability(processName: string, craftName: string) {
  const process = listSelectableProcessCraftOptions().find((item) => item.processName === processName)
  assert(process, `未找到工序 ${processName}`)
  const craft = process!.crafts.find((item) => item.craftName === craftName)
  assert(craft, `未找到工艺 ${processName}/${craftName}`)
  const capability = createCapabilityFromSelection(process!.processCode, craft!.craftCode)
  assert(capability, `无法创建能力 ${processName}/${craftName}`)
  return capability!
}

const p0ScriptPath = 'scripts/check-factory-onboarding-p0.ts'
const p1ScriptPath = 'scripts/check-factory-onboarding-p1.ts'
const p2ScriptPath = 'scripts/check-factory-onboarding-p2.ts'
const domainPath = 'src/data/fcs/factory-onboarding-domain.ts'
const flowPath = 'src/data/fcs/factory-onboarding-flow.ts'
const storePath = 'src/data/fcs/factory-onboarding-store.ts'
const pdaPath = 'src/pages/pda-onboarding.ts'
const platformPath = 'src/pages/factory-onboarding.ts'
const routesPdaPath = 'src/router/routes-pda.ts'

assert(existsSync(join(root, p0ScriptPath)), 'P0 检查脚本不存在')
assert(existsSync(join(root, p1ScriptPath)), 'P1 检查脚本不存在')
assert(runCheck('npx tsx scripts/check-factory-onboarding-p0.ts').includes('factory onboarding p0 checks passed'), 'P0 检查脚本不可执行')
assert(runCheck('npx tsx scripts/check-factory-onboarding-p1.ts').includes('factory onboarding p1 checks passed'), 'P1 检查脚本不可执行')

assertIncludes(domainPath, ['completenessScore', 'completenessLevel', 'completenessItems', 'inferredFactoryTypes', 'primaryFactoryType'])
assertIncludes(flowPath, ['calculateOnboardingCompleteness', 'getCompletenessLevel', 'getCompletenessMissingItems', 'inferFactoryTypesFromCapabilities', 'getPrimaryFactoryType'])
assertIncludes(pdaPath, ['资料完整性评分', '查看待补充项', '系统匹配工厂类型'])
assertIncludes(platformPath, ['已选工序工艺', '样衣状态'])
assertNotIncludes(routesPdaPath, ["'/fcs/pda/login'"])
assertNotIncludes(flowPath, ['/fcs/pda/login'])
assertNotIncludes(pdaPath, ['PENDING', 'DONE', 'IN_PROGRESS'])
assertNotIncludes(platformPath, ['PENDING', 'DONE', 'IN_PROGRESS'])

assert(getCompletenessLevel(59) === '不完整', '完整性等级 59 应为不完整')
assert(getCompletenessLevel(60) === '基本完整', '完整性等级 60 应为基本完整')
assert(getCompletenessLevel(80) === '完整', '完整性等级 80 应为完整')
assert(getCompletenessLevel(95) === '高完整', '完整性等级 95 应为高完整')

const lowDraft = createEmptyFactoryOnboardingDraft()
lowDraft.factoryShortName = `p2_low_${Date.now()}`
lowDraft.adminAccount.loginId = lowDraft.factoryShortName
lowDraft.adminAccount.adminName = 'P2低分管理员'
lowDraft.adminAccount.mobilePhone = '081234567890'
lowDraft.applicantName = '低分申请人'
lowDraft.mobilePhone = '081234567890'
lowDraft.mobileOrWhatsapp = lowDraft.mobilePhone
lowDraft.factoryCompanyName = 'P2低分工厂'
lowDraft.machineTotalCount = 0
lowDraft.effectiveWorkerCount = 0
const savedLowDraft = saveFactoryOnboardingDraft(lowDraft, '123456')
assert(savedLowDraft.completenessScore < 80, '低分草稿完整性评分应低于 80')
const lowMissingItems = getCompletenessMissingItems(savedLowDraft)
assert(lowMissingItems.length > 0, '低分草稿应存在缺失项')

let requiredBlocked = false
try {
  validateFactoryOnboardingDraftPayload(savedLowDraft, '123456')
} catch (error) {
  requiredBlocked = error instanceof Error && error.message.includes('请填写身份证号码/护照号码')
}
assert(requiredBlocked, '缺少业务必填字段时应被中文校验阻止')

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

const applications = listFactoryOnboardingApplications()
const completenessBuckets = applications.reduce<Record<string, number>>((result, item) => {
  result[item.completenessLevel] = (result[item.completenessLevel] || 0) + 1
  return result
}, {})
assert((completenessBuckets['完整'] || 0) + (completenessBuckets['高完整'] || 0) >= 12, '完整及高完整评分数据不足')

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

const waitingSampleApps = applications.filter((item) => item.status === '待样衣验证')
assert(waitingSampleApps.every((item) => !item.createdFactoryId && item.adminAccount.accountStatus !== '已转正式'), '待样衣验证不得转正式或创建档案')
const formalPendingApps = applications.filter((item) => item.status === '样衣审核通过待转正式')
assert(formalPendingApps.every((item) => canCreateFactoryProfile(item.status)), '样衣审核通过待转正式应允许创建正式档案')
assert(applications.filter((item) => item.status !== '已转正式合作').every((item) => !canFactoryEnterBusiness(item.status)), '未转正式状态不得进入业务页')
assert(applications.filter((item) => item.status === '已转正式合作').every((item) => canFactoryEnterBusiness(item.status)), '已转正式合作应进入业务页')

const submitDraft = createEmptyFactoryOnboardingDraft()
submitDraft.factoryShortName = `p2_submit_${Date.now()}`
submitDraft.adminAccount.loginId = submitDraft.factoryShortName
submitDraft.adminAccount.adminName = 'P2提交管理员'
submitDraft.adminAccount.mobilePhone = '+62-812-9999-001'
submitDraft.applicantName = 'P2提交申请人'
submitDraft.identityNo = 'ID-P2-0001'
submitDraft.identityFile = { fileId: 'IDF-P2', fileName: 'P2身份文件.pdf', fileType: 'pdf', fileSizeMb: 2, uploadedAt: '2026-05-06 10:00:00' }
submitDraft.factoryCompanyName = 'P2提交工厂'
submitDraft.address = 'P2 工业园'
submitDraft.mobilePhone = '+62-812-9999-001'
submitDraft.mobileOrWhatsapp = submitDraft.mobilePhone
submitDraft.sourceChannel = 'PPIC 转介绍'
submitDraft.ppicName = 'P2-PPIC'
submitDraft.availableStartDate = '2026-05-30'
submitDraft.effectiveWorkerCount = 20
submitDraft.machineTotalCount = 1
submitDraft.selectedCapabilities = [cuttingCapability]
const machine = createDefaultMachineDraft(1)
machine.machineName = 'P2裁剪设备'
machine.machineNo = 'P2-EQ-01'
machine.machineCount = 1
machine.linkedProcessCode = cuttingCapability.processCode
machine.linkedProcessName = cuttingCapability.processName
machine.linkedCraftCode = cuttingCapability.craftCode
machine.linkedCraftName = cuttingCapability.craftName
submitDraft.machines = [machine]
const submitted = submitFactoryOnboardingApplication(submitDraft, '123456')
assert(submitted.status === '待平台审核', '提交入驻申请后应进入待平台审核')

const storeSource = read(storePath)
assert(storeSource.includes('sampleVerificationId'), 'mock 数据应包含 sampleVerificationId')
assert(storeSource.includes('sampleStatus'), 'mock 数据应包含 sampleStatus')
assert(existsSync(join(root, p2ScriptPath)), 'P2 检查脚本不存在')

console.log('factory onboarding p2 checks passed')
