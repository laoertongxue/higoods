import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { listFactoryOnboardingApplications } from '../src/data/fcs/factory-onboarding-store.ts'
import {
  canCreateFactoryProfile,
  canFactoryEnterBusiness,
  canEditOnboardingApplication,
  canSubmitOnboardingApplication,
  reviewFactoryOnboardingApplication,
} from '../src/data/fcs/factory-onboarding-flow.ts'
import { FACTORY_ONBOARDING_STATUS_OPTIONS } from '../src/data/fcs/factory-onboarding-domain.ts'

const root = process.cwd()

function read(path: string): string {
  return readFileSync(join(root, path), 'utf8')
}

function assert(condition: unknown, message: string): void {
  if (!condition) throw new Error(`工厂入驻 Step1 检查失败：${message}`)
}

function assertIncludes(path: string, needles: string[]): void {
  const source = read(path)
  for (const needle of needles) assert(source.includes(needle), `${path} 缺少 ${needle}`)
}

function assertNotIncludes(path: string, needles: string[]): void {
  const source = read(path)
  for (const needle of needles) assert(!source.includes(needle), `${path} 不应包含 ${needle}`)
}

const domainPath = 'src/data/fcs/factory-onboarding-domain.ts'
const flowPath = 'src/data/fcs/factory-onboarding-flow.ts'
const storePath = 'src/data/fcs/factory-onboarding-store.ts'
const pdaOnboardingPath = 'src/pages/pda-onboarding.ts'
const platformPath = 'src/pages/factory-onboarding.ts'
const pdaLoginPath = 'src/pages/pda-login.ts'
const pdaRuntimePath = 'src/pages/pda-runtime.ts'
const appShellPath = 'src/data/app-shell-config.ts'
const pdaRoutesPath = 'src/router/routes-pda.ts'
const fcsRoutesPath = 'src/router/routes-fcs.ts'

assertIncludes(domainPath, [
  'applicantName',
  'identityNo',
  'identityFile',
  'factoryCompanyName',
  'factoryShortName',
  'mobilePhone',
  'sourceChannel',
  'ppicName',
  'machineTotalCount',
  'effectiveWorkerCount',
  'availableStartDate',
  'selectedCapabilities',
  'machines',
  'sampleVerificationId',
  'sampleStatus',
  'normalizeOnboardingStatus',
  'canFactoryEnterBusiness',
  'canCreateFactoryProfile',
])

for (const status of [
  '草稿',
  '待平台审核',
  '平台审核退回',
  '平台审核拒绝',
  '待样衣验证',
  '待工厂确认收样',
  '待工厂提交样衣审核',
  '待平台审核样衣',
  '样衣审核退回',
  '样衣审核拒绝',
  '样衣审核通过待转正式',
  '已转正式合作',
]) {
  assert(FACTORY_ONBOARDING_STATUS_OPTIONS.includes(status as never), `状态枚举缺少 ${status}`)
}

assertNotIncludes(flowPath, ['审核通过待确认合作', '平台审核通过.*已合作'])
assertNotIncludes(platformPath, ['审核通过待确认合作', 'data-factory-onboarding-action="open-confirm"', 'data-factory-onboarding-action="submit-confirm"'])
assertNotIncludes(pdaRoutesPath, ["'/fcs/pda/login'", '"/fcs/pda/login"'])
assertNotIncludes(appShellPath, ["href: '/fcs/pda/login'"])

assertIncludes(flowPath, [
  "toStatus = '待样衣验证'",
  "toNode = '样衣验证'",
  'accountLocked',
  'factoryNameLocked',
  'canCreateFactoryProfile',
])
assertIncludes(pdaRuntimePath, ['ensurePdaAccessForRoute', '/fcs/pda/auth/login'])
assertIncludes(pdaLoginPath, ['getFactoryOnboardingLoginFailureMessage'])
assertIncludes(flowPath, ['账号状态不可用', '平台初审未通过'])

assertIncludes(pdaOnboardingPath, [
  '姓名',
  '身份证号码/护照号码',
  '地址',
  '工厂/公司名称',
  '工厂简称',
  '机器数量',
  '手机号',
  '来源',
  '收到此通知的 PPIC 姓名',
  '上传身份证复印件/电子文件',
  '有效工人数量',
  '可开始合作时间',
  '工序工艺能力',
  '机器明细',
])
assertNotIncludes(pdaOnboardingPath, ['账号信息', '登录账户', '登录密码', '确认密码', 'WhatsApp', '手机号码/WhatsApp'])

assertIncludes(flowPath, [
  '待样衣验证',
])

assertIncludes(platformPath, [
  '入驻申请编号',
  '姓名',
  '身份证号码/护照号码',
  '工厂简称',
  '工厂/公司名称',
  '手机号',
  '来源',
  'PPIC 姓名',
  '机器数量',
  '有效工人数量',
  '已选工序工艺',
  '当前节点',
  '当前状态',
  '当前节点耗时',
  '当前节点动作次数',
  '提交时间',
  '基础资料',
  '样衣状态',
])

assertIncludes(appShellPath, ['工厂入驻&登录', '工厂入驻管理', '/fcs/pda/auth/login', '/fcs/pda/auth/onboarding', '/fcs/factories/onboarding'])
assertIncludes(fcsRoutesPath, ["'/fcs/factories/onboarding'"])
assertIncludes(pdaRoutesPath, ["'/fcs/pda/auth/login'", "'/fcs/pda/auth/onboarding'"])

const applications = listFactoryOnboardingApplications()
const statusCounts = new Map<string, number>()
for (const application of applications) {
  statusCounts.set(application.status, (statusCounts.get(application.status) || 0) + 1)
  assert(application.applicantName, `${application.applicationNo} 缺少姓名`)
  assert(application.identityNo, `${application.applicationNo} 缺少证件号码`)
  assert(application.identityFile, `${application.applicationNo} 缺少身份文件`)
  assert(application.factoryCompanyName, `${application.applicationNo} 缺少工厂/公司名称`)
  assert(application.factoryShortName, `${application.applicationNo} 缺少工厂简称`)
  assert(application.mobilePhone, `${application.applicationNo} 缺少手机号`)
  assert(application.adminAccount.loginId === application.factoryShortName, `${application.applicationNo} 登录账号未使用工厂简称`)
  assert(application.sourceChannel, `${application.applicationNo} 缺少来源`)
  assert(application.ppicName, `${application.applicationNo} 缺少 PPIC 姓名`)
  assert(application.nodeLogs.length > 0, `${application.applicationNo} 缺少节点记录`)
  assert(application.actionLogs.length > 0, `${application.applicationNo} 缺少动作记录`)
  assert(application.reviewRecords || application.status === '草稿', `${application.applicationNo} 审核记录字段缺失`)
}

for (const status of FACTORY_ONBOARDING_STATUS_OPTIONS) {
  assert((statusCounts.get(status) || 0) >= 3, `${status} 每种状态至少 3 条未满足`)
}

const pending = applications.find((item) => item.status === '待平台审核')
assert(pending, '缺少待平台审核申请')
const approved = reviewFactoryOnboardingApplication({
  applicationId: pending!.applicationId,
  reviewResult: '已通过',
  reviewOpinion: '资料齐全，进入待样衣验证。',
  reviewer: 'Step1审核员',
})
assert(approved.status === '待样衣验证', '平台初审通过未流转到待样衣验证')
assert(approved.currentNode === '样衣验证', '平台初审通过当前节点不是样衣验证')
assert(!approved.createdFactoryId, '平台初审通过不应生成正式档案')
assert(approved.adminAccount.accountStatus !== '已转正式', '平台初审通过不应转正式管理员账号')

const returned = reviewFactoryOnboardingApplication({
  applicationId: applications.find((item) => item.status === '待平台审核' && item.applicationId !== pending!.applicationId)!.applicationId,
  reviewResult: '未通过',
  reviewOpinion: '请补充身份文件和机器明细。',
  reviewer: 'Step1审核员',
  requiredFields: ['身份证复印件/电子文件', '机器明细'],
})
assert(returned.status === '平台审核退回', '平台审核退回状态错误')
assert(canEditOnboardingApplication(returned), '平台审核退回应允许编辑')
assert(canSubmitOnboardingApplication(returned), '平台审核退回应允许再次提交')

const returnedAgainSource = applications.find((item) => item.status === '待平台审核' && item.applicationId !== pending!.applicationId && item.applicationId !== returned.applicationId)
assert(returnedAgainSource, '缺少可用于未通过检查的待平台审核申请')
const returnedAgain = reviewFactoryOnboardingApplication({
  applicationId: returnedAgainSource!.applicationId,
  reviewResult: '未通过',
  reviewOpinion: '当前资料仍需补充。',
  reviewer: 'Step1审核员',
  requiredFields: ['工厂简称'],
})
assert(returnedAgain.status === '平台审核退回', '平台初审未通过应统一退回')
assert(!returnedAgain.accountLocked, '平台初审未通过不应锁定账号')
assert(!returnedAgain.factoryNameLocked, '平台初审未通过不应锁定同名工厂')

for (const status of FACTORY_ONBOARDING_STATUS_OPTIONS) {
  assert(canFactoryEnterBusiness(status) === (status === '已转正式合作'), `${status} 业务准入判断错误`)
  assert(canCreateFactoryProfile(status) === (status === '样衣审核通过待转正式'), `${status} 创建正式档案判断错误`)
}

assertNotIncludes(storePath, ['平台审核通过.*已合作'])
assertNotIncludes(pdaOnboardingPath, ['PENDING', 'DONE', 'IN_PROGRESS'])
assertNotIncludes(platformPath, ['PENDING', 'DONE', 'IN_PROGRESS'])

console.log('factory onboarding step1 model-state-form checks passed')
