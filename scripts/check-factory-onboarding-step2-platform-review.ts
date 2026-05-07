import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import {
  authenticateFactoryOnboardingAdmin,
  canCreateFactoryProfile,
  canEditOnboardingApplication,
  canFactoryEnterBusiness,
  canSubmitOnboardingApplication,
  createCapabilityFromSelection,
  createDefaultMachineDraft,
  getFactoryOnboardingLoginFailureMessage,
  listSelectableProcessCraftOptions,
  reviewFactoryOnboardingApplication,
  submitFactoryOnboardingApplication,
} from '../src/data/fcs/factory-onboarding-flow.ts'
import {
  canStartNewOnboarding,
  createEmptyFactoryOnboardingDraft,
  getLockedFactoryNameReason,
  isFactoryCompanyNameLocked,
  listFactoryOnboardingApplications,
} from '../src/data/fcs/factory-onboarding-store.ts'
import { listFactoryMasterRecords } from '../src/data/fcs/factory-master-store.ts'
import { FACTORY_ONBOARDING_STATUS_OPTIONS, type FactoryOnboardingApplication } from '../src/data/fcs/factory-onboarding-domain.ts'

const root = process.cwd()

function read(path: string): string {
  return readFileSync(join(root, path), 'utf8')
}

function assert(condition: unknown, message: string): void {
  if (!condition) throw new Error(`工厂入驻 Step2 平台初审检查失败：${message}`)
}

function assertIncludes(path: string, needles: string[]): void {
  const source = read(path)
  for (const needle of needles) assert(source.includes(needle), `${path} 缺少 ${needle}`)
}

function assertNotIncludes(path: string, needles: string[]): void {
  const source = read(path)
  for (const needle of needles) assert(!source.includes(needle), `${path} 不应包含 ${needle}`)
}

function latest<T extends { reviewedAt?: string; operatedAt?: string; reviewRoundNo?: number }>(items: T[]): T | undefined {
  return [...items].sort((left, right) => {
    const leftKey = left.reviewedAt || left.operatedAt || String(left.reviewRoundNo || 0)
    const rightKey = right.reviewedAt || right.operatedAt || String(right.reviewRoundNo || 0)
    return rightKey.localeCompare(leftKey)
  })[0]
}

function getPlatformNode(application: FactoryOnboardingApplication) {
  return application.nodeLogs.filter((item) => item.nodeName === '平台审核').at(-1)
}

function getCurrentNode(application: FactoryOnboardingApplication) {
  return application.nodeLogs.filter((item) => item.nodeName === application.currentNode).at(-1)
}

const domainPath = 'src/data/fcs/factory-onboarding-domain.ts'
const flowPath = 'src/data/fcs/factory-onboarding-flow.ts'
const storePath = 'src/data/fcs/factory-onboarding-store.ts'
const platformPath = 'src/pages/factory-onboarding.ts'
const pdaOnboardingPath = 'src/pages/pda-onboarding.ts'
const pdaLoginPath = 'src/pages/pda-login.ts'
const pdaRuntimePath = 'src/pages/pda-runtime.ts'
const appShellPath = 'src/data/app-shell-config.ts'
const pdaRoutesPath = 'src/router/routes-pda.ts'
const fcsRoutesPath = 'src/router/routes-fcs.ts'

for (const path of [domainPath, flowPath, storePath, platformPath, pdaOnboardingPath, pdaLoginPath, pdaRuntimePath]) {
  assert(existsSync(join(root, path)), `缺少文件 ${path}`)
}

assertIncludes(platformPath, [
  '已通过',
  '未通过',
  '审核意见',
  '需补充字段',
  '登录账号',
  '状态区',
  '待样衣验证',
])
assertNotIncludes(platformPath, ['不通过且允许再次申请', '不通过且不允许再次申请', '是否允许再次申请'])
assertIncludes(domainPath, ['平台初审已通过', '平台初审未通过', 'requiredFields'])
assertIncludes(flowPath, [
  "toStatus = '待样衣验证'",
  "toNode = '样衣验证'",
  "actionName = '平台初审已通过'",
  "actionName = '平台初审未通过'",
  'reviewRecords',
  'actionLogs',
  'updateNodeLogOnTransition',
  'accountLocked: false',
])
assertIncludes(storePath, ['isFactoryCompanyNameLocked', 'canStartNewOnboarding', 'getLockedFactoryNameReason', 'LOCKED_FACTORY_NAME_MESSAGE'])
assertIncludes(pdaLoginPath, ['getFactoryOnboardingLoginFailureMessage'])
assertIncludes(flowPath, ['待样衣验证'])
assertIncludes(pdaOnboardingPath, ['重新提交入驻申请', '最近审核意见', '需补充字段'])
assertIncludes(pdaRuntimePath, ['canFactoryEnterBusiness'])
assertIncludes(appShellPath, ['工厂入驻&登录', '/fcs/pda/auth/login', '/fcs/pda/auth/onboarding', '工厂入驻管理'])
assertIncludes(fcsRoutesPath, ["'/fcs/factories/onboarding'"])
assertIncludes(pdaRoutesPath, ["'/fcs/pda/auth/login'", "'/fcs/pda/auth/onboarding'"])
assertNotIncludes(platformPath, ['确认合作', '审核通过并生成工厂档案', '审核通过并转正式合作', '通过并生成工厂档案'])
assertNotIncludes(storePath, ['审核通过待确认合作', '通过并生成工厂档案'])
assertNotIncludes(flowPath, ['审核通过待确认合作', '通过并生成工厂档案'])
assertNotIncludes(pdaRoutesPath, ["'/fcs/pda/login'", '"/fcs/pda/login"'])
assertNotIncludes(appShellPath, ["href: '/fcs/pda/login'"])
assertNotIncludes(platformPath, ['PENDING', 'DONE', 'IN_PROGRESS'])
assertNotIncludes(pdaOnboardingPath, ['PENDING', 'DONE', 'IN_PROGRESS'])

const applications = listFactoryOnboardingApplications()
const pendingApplications = applications.filter((item) => item.status === '待平台审核')
assert(pendingApplications.length >= 3, '至少需要 3 条待平台审核数据用于初审结果检查')
for (const status of ['待平台审核', '平台审核退回', '平台审核拒绝', '待样衣验证'] as const) {
  assert(applications.filter((item) => item.status === status).length >= 3, `${status} mock 数据不足 3 条`)
}
for (const application of applications.filter((item) => ['待平台审核', '平台审核退回', '平台审核拒绝', '待样衣验证'].includes(item.status))) {
  assert(application.reviewRecords || application.status === '待平台审核', `${application.applicationNo} 审核记录字段缺失`)
  assert(application.actionLogs.length > 0, `${application.applicationNo} 动作记录缺失`)
  assert(application.nodeLogs.length > 0, `${application.applicationNo} 流程记录缺失`)
}

const approved = reviewFactoryOnboardingApplication({
  applicationId: pendingApplications[0].applicationId,
  reviewResult: '已通过',
  reviewOpinion: '资料齐全，进入待样衣验证。',
  reviewer: 'Step2平台审核员',
})
assert(approved.status === '待样衣验证', '平台初审通过未流转到待样衣验证')
assert(approved.currentNode === '样衣验证', '平台初审通过 currentNode 不是样衣验证')
assert(!approved.createdFactoryId, '平台初审通过不应写入 createdFactoryId')
assert(!approved.createdFactoryId || !listFactoryMasterRecords().some((factory) => factory.id === approved.createdFactoryId), '平台初审通过不应生成工厂档案')
assert(approved.adminAccount.accountStatus !== '已转正式', '平台初审通过不应转正式管理员账号')
assert(!canFactoryEnterBusiness(approved.status), '待样衣验证不允许进入业务页')
assert(latest(approved.reviewRecords)?.reviewResult === '已通过', '平台初审通过未写入 reviewRecords')
assert(latest(approved.reviewRecords)?.toStatus === '待样衣验证', '平台初审通过审核记录目标状态错误')
assert(latest(approved.actionLogs)?.actionName === '平台初审已通过', '平台初审通过未写入 actionLogs')
assert(getPlatformNode(approved)?.nodeStatus === '已完成', '平台初审通过未关闭平台审核节点')
assert(getCurrentNode(approved)?.nodeName === '样衣验证' && getCurrentNode(approved)?.nodeStatus === '进行中', '平台初审通过未开启样衣验证节点')

const returned = reviewFactoryOnboardingApplication({
  applicationId: pendingApplications[1].applicationId,
  reviewResult: '未通过',
  reviewOpinion: '请补充身份文件和机器明细。',
  reviewer: 'Step2平台审核员',
  requiredFields: ['身份证复印件/电子文件', '机器明细', '工厂简称'],
})
assert(returned.status === '平台审核退回', '平台初审退回状态错误')
assert(returned.currentNode === '填写入驻申请', '平台初审退回 currentNode 错误')
assert(!returned.accountLocked, '平台初审退回不应锁定账号')
assert(returned.adminAccount.loginId === pendingApplications[1].adminAccount.loginId, '平台初审退回应保留账号信息')
assert(canEditOnboardingApplication(returned), '平台初审退回应允许工厂编辑')
assert(canSubmitOnboardingApplication(returned), '平台初审退回应允许再次提交')
assert(latest(returned.reviewRecords)?.reviewResult === '未通过', '平台初审退回未写入 reviewRecords')
assert(latest(returned.reviewRecords)?.requiredFields?.includes('机器明细'), '平台初审退回审核记录缺少需补充字段')
assert(returned.supplementRecords.at(-1)?.status === '待补充', '平台初审退回未写入 supplementRecords')
assert(returned.supplementRecords.at(-1)?.requiredFields.includes('工厂简称'), '平台初审退回补充记录缺少工厂简称')
assert(latest(returned.actionLogs)?.actionName === '平台初审未通过', '平台初审退回未写入 actionLogs')
assert(getPlatformNode(returned)?.nodeStatus === '已退回', '平台初审退回未退回平台审核节点')
assert(getCurrentNode(returned)?.nodeName === '填写入驻申请' && getCurrentNode(returned)?.nodeStatus === '进行中', '平台初审退回未重新进入填写节点')
assert(authenticateFactoryOnboardingAdmin(returned.adminAccount.loginId, returned.adminAccount.password)?.applicationId === returned.applicationId, '平台初审退回账号应允许登录')

const resubmitDraft = {
  ...createEmptyFactoryOnboardingDraft(),
  applicationId: returned.applicationId,
  applicationNo: returned.applicationNo,
  factoryTempId: returned.factoryTempId,
  applicantName: returned.applicantName,
  identityNo: returned.identityNo,
  identityFile: returned.identityFile,
  factoryCompanyName: returned.factoryCompanyName,
  factoryShortName: returned.factoryShortName,
  factoryName: returned.factoryCompanyName,
  bossName: returned.applicantName,
  address: `${returned.address} 复核补充`,
  mobilePhone: returned.mobilePhone,
  mobileOrWhatsapp: returned.mobilePhone,
  whatsapp: returned.mobilePhone,
  sourceChannel: returned.sourceChannel,
  ppicName: returned.ppicName,
  machineTotalCount: returned.machineTotalCount,
  effectiveWorkerCount: returned.effectiveWorkerCount,
  availableStartDate: returned.availableStartDate,
  selectedCapabilities: returned.selectedCapabilities.map((item) => ({ ...item })),
  machines: returned.machines.map((item) => ({ ...item })),
  adminAccount: { ...returned.adminAccount },
}
const resubmitted = submitFactoryOnboardingApplication(resubmitDraft, returned.adminAccount.password)
assert(resubmitted.status === '待平台审核', '平台初审退回后重新提交未回到待平台审核')

const returnedAgain = reviewFactoryOnboardingApplication({
  applicationId: pendingApplications[2].applicationId,
  reviewResult: '未通过',
  reviewOpinion: '当前资料仍需补充。',
  reviewer: 'Step2平台审核员',
  requiredFields: ['工厂简称'],
})
assert(returnedAgain.status === '平台审核退回', '平台初审未通过应统一退回')
assert(returnedAgain.currentNode === '填写入驻申请', '平台初审未通过 currentNode 错误')
assert(!returnedAgain.accountLocked, '平台初审未通过不应锁定账号')
assert(!returnedAgain.factoryNameLocked, '平台初审未通过不应锁定同名工厂')
assert(authenticateFactoryOnboardingAdmin(returnedAgain.adminAccount.loginId, returnedAgain.adminAccount.password)?.applicationId === returnedAgain.applicationId, '平台初审未通过后账号应允许登录')
assert(!isFactoryCompanyNameLocked(returnedAgain.factoryCompanyName), '平台初审未通过不应触发同名工厂锁定')
assert(canStartNewOnboarding(` ${returnedAgain.factoryCompanyName} `), '平台初审未通过不应禁止同名工厂再次发起入驻')
assert(getLockedFactoryNameReason(returnedAgain.factoryCompanyName) === '', '平台初审未通过不应产生同名工厂锁定原因')

const duplicateDraft = createEmptyFactoryOnboardingDraft()
const firstProcess = listSelectableProcessCraftOptions()[0]
assert(firstProcess && firstProcess.crafts[0], '缺少测试工序工艺数据')
const firstCraft = firstProcess.crafts[0]
const capability = createCapabilityFromSelection(firstProcess.processCode, firstCraft.craftCode)
assert(capability, '无法创建测试工序工艺能力')
duplicateDraft.factoryShortName = `step2_locked_${Date.now()}`
duplicateDraft.adminAccount.loginId = duplicateDraft.factoryShortName
duplicateDraft.adminAccount.password = '123456'
duplicateDraft.adminAccount.adminName = '同名测试管理员'
duplicateDraft.adminAccount.mobilePhone = '+62-812-9000-220'
duplicateDraft.applicantName = '同名测试'
duplicateDraft.identityNo = 'ID-STEP2-LOCKED'
duplicateDraft.identityFile = { fileId: 'IDF-STEP2-COMPANY', fileName: '同名测试身份文件.pdf', fileType: 'pdf', fileSizeMb: 2, uploadedAt: '2026-05-06 10:00:00' }
duplicateDraft.factoryCompanyName = returnedAgain.factoryCompanyName
duplicateDraft.factoryName = returnedAgain.factoryCompanyName
duplicateDraft.address = '同名测试地址'
duplicateDraft.mobilePhone = '+62-812-9000-220'
duplicateDraft.mobileOrWhatsapp = duplicateDraft.mobilePhone
duplicateDraft.sourceChannel = 'PPIC 转介绍'
duplicateDraft.ppicName = 'Step2-PPIC'
duplicateDraft.machineTotalCount = 1
duplicateDraft.effectiveWorkerCount = 12
duplicateDraft.availableStartDate = '2026-05-30'
duplicateDraft.selectedCapabilities = [capability!]
const machine = createDefaultMachineDraft(1)
machine.machineName = '同名测试设备'
machine.machineCount = 1
machine.linkedProcessCode = capability!.processCode
machine.linkedProcessName = capability!.processName
machine.linkedCraftCode = capability!.craftCode
machine.linkedCraftName = capability!.craftName
duplicateDraft.machines = [machine]
const duplicateSubmitted = submitFactoryOnboardingApplication(duplicateDraft, '123456')
assert(duplicateSubmitted.status === '待平台审核', '同名工厂公司名称不应因未通过被阻止提交')

for (const status of FACTORY_ONBOARDING_STATUS_OPTIONS) {
  assert(canFactoryEnterBusiness(status) === (status === '已转正式合作'), `${status} 业务准入判断错误`)
  assert(canCreateFactoryProfile(status) === (status === '样衣审核通过待转正式'), `${status} 创建工厂档案判断错误`)
}

assert(platformPath && read(platformPath).includes('data-testid="factory-onboarding-page"'), '平台入驻管理页面不应为空白')
assert(pdaOnboardingPath && read(pdaOnboardingPath).includes('data-testid="pda-onboarding-page"'), '工厂端入驻页不应为空白')
assert(read('src/main-handlers/fcs-handlers.ts').includes('handleFactoryOnboardingEvent'), '平台菜单事件处理缺失')
assert(read('src/main-handlers/pda-handlers.ts').includes('handlePdaOnboardingEvent'), '工厂端菜单事件处理缺失')

console.log('factory onboarding step2 platform-review checks passed')
