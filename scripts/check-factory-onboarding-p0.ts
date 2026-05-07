import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import { listFactoryOnboardingApplications } from '../src/data/fcs/factory-onboarding-store.ts'
import {
  canCreateFactoryProfile,
  canFactoryEnterBusiness,
  ensurePdaAccessForRoute,
  getPdaFactoryAccessState,
  listFactoryOnboardingStatusBuckets,
  listSelectableProcessCraftOptions,
  normalizeOnboardingStatus,
  resolvePdaPostLoginRoute,
  reviewFactoryOnboardingApplication,
} from '../src/data/fcs/factory-onboarding-flow.ts'

const root = process.cwd()

function assert(condition: unknown, message: string): void {
  if (!condition) throw new Error(`工厂入驻与登录 P0 检查失败：${message}`)
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

const domainPath = 'src/data/fcs/factory-onboarding-domain.ts'
const storePath = 'src/data/fcs/factory-onboarding-store.ts'
const flowPath = 'src/data/fcs/factory-onboarding-flow.ts'
const pdaOnboardingPagePath = 'src/pages/pda-onboarding.ts'
const platformPagePath = 'src/pages/factory-onboarding.ts'
const appShellPath = 'src/data/app-shell-config.ts'
const pdaRoutesPath = 'src/router/routes-pda.ts'
const fcsRoutesPath = 'src/router/routes-fcs.ts'

assert(existsSync(join(root, domainPath)), '缺少 factory-onboarding-domain')
assert(existsSync(join(root, storePath)), '缺少 factory-onboarding-store')
assert(existsSync(join(root, flowPath)), '缺少 factory-onboarding-flow')

assertIncludes(domainPath, [
  'FactoryOnboardingApplication',
  'applicantName',
  'identityNo',
  'identityFile',
  'factoryCompanyName',
  'factoryShortName',
  'mobilePhone',
  'sourceChannel',
  'ppicName',
  'sampleVerificationId',
  'sampleStatus',
  'normalizeOnboardingStatus',
  'canFactoryEnterBusiness',
  'canCreateFactoryProfile',
])

assertIncludes(appShellPath, [
  "title: '工厂入驻&登录'",
  "href: '/fcs/pda/auth/login'",
  "href: '/fcs/pda/auth/onboarding'",
  "title: '工厂入驻管理'",
  "href: '/fcs/factories/onboarding'",
])
assertNotIncludes(appShellPath, ["href: '/fcs/pda/login'"])
assertIncludes(pdaRoutesPath, ["'/fcs/pda/auth/login'", "'/fcs/pda/auth/onboarding'"])
assertNotIncludes(pdaRoutesPath, ["'/fcs/pda/login'"])
assertIncludes(fcsRoutesPath, ["'/fcs/factories/onboarding'"])
assertIncludes(pdaOnboardingPagePath, ['姓名', '身份证号码/护照号码', '工厂简称', '工厂/公司名称', '手机号', '来源', '收到此通知的 PPIC 姓名', '上传身份证复印件/电子文件'])
assertNotIncludes(pdaOnboardingPagePath, ['账号信息', '登录账户', '登录密码', '确认密码', 'WhatsApp', '手机号码/WhatsApp'])
assertIncludes(platformPagePath, ['工厂入驻管理', '基础资料', '登录账号', '工序工艺能力', '机器能力', '流程记录', '审核记录', '样衣验证'])
assertNotIncludes(platformPagePath, ['data-factory-onboarding-action="open-confirm"', 'data-factory-onboarding-action="submit-confirm"'])

assert(normalizeOnboardingStatus('已提交待审核') === '待平台审核', '旧状态已提交待审核映射错误')
assert(normalizeOnboardingStatus('退回补充资料') === '平台审核退回', '旧状态退回补充资料映射错误')
assert(normalizeOnboardingStatus('审核通过待确认合作') === '待样衣验证', '旧状态审核通过映射错误')
assert(normalizeOnboardingStatus('已合作') === '已转正式合作', '旧状态已合作映射错误')

const applications = listFactoryOnboardingApplications()
const requiredStatuses = [
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
] as const
const statusCounts = new Map<string, number>()
for (const application of applications) {
  statusCounts.set(application.status, (statusCounts.get(application.status) || 0) + 1)
  assert(application.applicantName, `${application.applicationNo} 缺少姓名`)
  assert(application.identityNo, `${application.applicationNo} 缺少身份证号码/护照号码`)
  assert(application.identityFile, `${application.applicationNo} 缺少身份证复印件/电子文件`)
  assert(application.factoryCompanyName, `${application.applicationNo} 缺少工厂/公司名称`)
  assert(application.factoryShortName, `${application.applicationNo} 缺少工厂简称`)
  assert(application.mobilePhone, `${application.applicationNo} 缺少手机号`)
  assert(application.adminAccount.loginId === application.factoryShortName, `${application.applicationNo} 登录账号未使用工厂简称`)
  assert(application.sourceChannel, `${application.applicationNo} 缺少来源`)
  assert(application.ppicName, `${application.applicationNo} 缺少 PPIC 姓名`)
  assert(application.selectedCapabilities.length > 0, `${application.applicationNo} 缺少工序工艺能力`)
  assert(application.machines.length > 0, `${application.applicationNo} 缺少机器明细`)
  assert(application.nodeLogs.length > 0, `${application.applicationNo} 缺少节点日志`)
  assert(application.actionLogs.length > 0, `${application.applicationNo} 缺少动作日志`)
}
for (const status of requiredStatuses) assert((statusCounts.get(status) || 0) >= 3, `${status} mock 数据不足 3 条`)

assert(canFactoryEnterBusiness('已转正式合作'), '已转正式合作应允许进入业务页')
for (const status of requiredStatuses.filter((item) => item !== '已转正式合作')) {
  assert(!canFactoryEnterBusiness(status), `${status} 不应允许进入业务页`)
}
assert(canCreateFactoryProfile('样衣审核通过待转正式'), '只有样衣审核通过待转正式允许创建正式档案')
for (const status of requiredStatuses.filter((item) => item !== '样衣审核通过待转正式')) {
  assert(!canCreateFactoryProfile(status), `${status} 不应允许创建正式档案`)
}

const selectable = listSelectableProcessCraftOptions()
assert(selectable.length > 0, '工序工艺字典未接入入驻能力选择')

const pending = applications.find((item) => item.status === '待平台审核')
assert(pending, '缺少待平台审核申请')
const reviewed = reviewFactoryOnboardingApplication({
  applicationId: pending!.applicationId,
  reviewResult: '通过',
  reviewOpinion: '资料齐全，进入待样衣验证。',
  reviewer: 'P0审核员',
})
assert(reviewed.status === '待样衣验证', '平台初审通过后应进入待样衣验证')
assert(reviewed.currentNode === '样衣验证', '平台初审通过后当前节点应为样衣验证')
assert(!reviewed.createdFactoryId, '平台初审通过不得写入正式工厂档案编号')
assert(reviewed.adminAccount.accountStatus !== '已转正式', '平台初审通过不得转正式管理员账号')

const buckets = listFactoryOnboardingStatusBuckets()
assert(typeof buckets.待平台审核 === 'number', '平台统计卡缺少待平台审核')
assert(typeof buckets.待样衣验证 === 'number', '平台统计卡缺少待样衣验证')
assert(typeof buckets.已转正式合作 === 'number', '平台统计卡缺少已转正式合作')

const unauthAccess = ensurePdaAccessForRoute('/fcs/pda/exec')
assert(!unauthAccess.allowed && (unauthAccess.redirectPath || '').startsWith('/fcs/pda/auth/login'), '未登录访问业务页必须跳转新登录页')
assert(getPdaFactoryAccessState().reasonCode === 'UNAUTHENTICATED', '未登录访问状态判断错误')
assert(resolvePdaPostLoginRoute(null, '/fcs/pda/exec').startsWith('/fcs/pda/auth/login'), '未登录默认分流必须回到新登录页')

assertIncludes('src/main-handlers/pda-handlers.ts', ['handlePdaOnboardingEvent'])
assertIncludes('src/main-handlers/fcs-handlers.ts', ['handleFactoryOnboardingEvent'])
assertIncludes('src/main.ts', ['data-pda-onboarding-field', 'data-factory-onboarding-field'])

console.log('factory onboarding p0 checks passed')
