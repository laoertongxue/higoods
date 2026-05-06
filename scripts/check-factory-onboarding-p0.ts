import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import { getFactoryMasterRecordById, listFactoryMasterRecords } from '../src/data/fcs/factory-master-store.ts'
import { listFactoryOnboardingApplications } from '../src/data/fcs/factory-onboarding-store.ts'
import {
  authenticateFactoryOnboardingAdmin,
  ensurePdaAccessForRoute,
  getPdaFactoryAccessState,
  listFactoryOnboardingStatusBuckets,
  listSelectableProcessCraftOptions,
  resolvePdaPostLoginRoute,
} from '../src/data/fcs/factory-onboarding-flow.ts'
import { findFactoryPdaUserByLoginId } from '../src/data/fcs/store-domain-pda.ts'

const root = process.cwd()

function assert(condition: unknown, message: string): void {
  if (!condition) {
    throw new Error(`工厂入驻与登录 P0 检查失败：${message}`)
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

const domainPath = 'src/data/fcs/factory-onboarding-domain.ts'
const storePath = 'src/data/fcs/factory-onboarding-store.ts'
const flowPath = 'src/data/fcs/factory-onboarding-flow.ts'
const pdaOnboardingPagePath = 'src/pages/pda-onboarding.ts'
const platformPagePath = 'src/pages/factory-onboarding.ts'
const appShellPath = 'src/data/app-shell-config.ts'
const pdaRoutesPath = 'src/router/routes-pda.ts'
const fcsRoutesPath = 'src/router/routes-fcs.ts'
const pdaRuntimePath = 'src/pages/pda-runtime.ts'
const pdaLoginPath = 'src/pages/pda-login.ts'
const pdaShellPath = 'src/pages/pda-shell.ts'

assert(existsSync(join(root, domainPath)), '缺少 factory-onboarding-domain')
assert(existsSync(join(root, storePath)), '缺少 factory-onboarding-store')
assert(existsSync(join(root, flowPath)), '缺少 factory-onboarding-flow')

assertIncludes(domainPath, [
  'FactoryOnboardingApplication',
  'applicationId',
  'factoryName',
  'bossName',
  'whatsapp',
  'address',
  'machineTotalCount',
  'effectiveWorkerCount',
  'availableStartDate',
  'selectedCapabilities',
  'machines',
  'adminAccount',
  'status',
  'currentNode',
  'nodeLogs',
  'actionLogs',
  'reviewRecords',
])

assertIncludes(appShellPath, [
  "title: '工厂入驻&登录'",
  "title: '登录'",
  "href: '/fcs/pda/auth/login'",
  "title: '入驻'",
  "href: '/fcs/pda/auth/onboarding'",
  "title: '工厂入驻管理'",
  "href: '/fcs/factories/onboarding'",
])
assertNotIncludes(appShellPath, ["href: '/fcs/pda/login'"])

assertIncludes(pdaRoutesPath, [
  "'/fcs/pda/auth/login'",
  "'/fcs/pda/auth/onboarding'",
])
assertNotIncludes(pdaRoutesPath, ["'/fcs/pda/login'", "renderRouteRedirect('/fcs/pda/auth/login'"])
assertIncludes(fcsRoutesPath, ["'/fcs/factories/onboarding'"])
assertIncludes(pdaRuntimePath, ['ensurePdaAccessForRoute', '/fcs/pda/auth/login'])
assertIncludes(pdaShellPath, ['ensurePdaAccessForRoute'])
assertIncludes(pdaLoginPath, ['工厂入驻&登录', '工厂登录', '去入驻', 'resolvePdaPostLoginRoute'])
assertIncludes(flowPath, ['ensurePdaAccessForRoute', 'getPdaFactoryAccessState', 'resolvePdaPostLoginRoute'])
assertIncludes(pdaOnboardingPagePath, ['填写入驻信息', '当前节点', '当前节点耗时', '当前节点动作次数', '账号信息', '工厂基础信息', '人员与机器', '工序工艺能力'])
assertIncludes(platformPagePath, ['工厂入驻管理', '基础信息', '账号信息', '工序工艺能力', '机器能力', '流程记录', '审核记录', '转档记录', '审核入驻申请', '确认合作并生成工厂档案'])
assertIncludes(flowPath, ['createFactoryPdaUser', 'upsertFactoryMasterRecord'])

const applications = listFactoryOnboardingApplications()
const statusCounts = new Map<string, number>()
for (const application of applications) {
  statusCounts.set(application.status, (statusCounts.get(application.status) || 0) + 1)
  assert(application.selectedCapabilities.length > 0, `${application.applicationNo} 缺少工序工艺能力`)
  assert(application.machines.length > 0, `${application.applicationNo} 缺少机器明细`)
  assert(application.nodeLogs.length > 0, `${application.applicationNo} 缺少节点日志`)
  assert(application.actionLogs.length > 0, `${application.applicationNo} 缺少动作日志`)
}

for (const status of ['草稿', '已提交待审核', '退回补充资料', '已重新提交待审核', '审核通过待确认合作', '已拒绝', '已合作']) {
  assert((statusCounts.get(status) || 0) >= 3, `${status} mock 数据不足 3 条`)
}

const selectable = listSelectableProcessCraftOptions()
assert(selectable.length > 0, '工序工艺字典未接入入驻能力选择')
assert(selectable.some((item) => item.processName === '裁片'), '能力选择缺少裁片工序')
assert(selectable.some((item) => item.processName === '印花'), '能力选择缺少印花工序')
assert(selectable.some((item) => item.processName === '染色'), '能力选择缺少染色工序')
assert(selectable.some((item) => item.processName === '后道'), '能力选择缺少后道工序')
assert(selectable.some((item) => item.processName === '特殊工艺'), '能力选择缺少特殊工艺工序')

const draftApplication = applications.find((item) => item.status === '草稿')
assert(draftApplication, '缺少草稿入驻申请')
const pendingApplication = applications.find((item) => item.status === '已提交待审核')
assert(pendingApplication, '缺少待审核入驻申请')
const rejectedApplication = applications.find((item) => item.status === '已拒绝')
assert(rejectedApplication, '缺少已拒绝入驻申请')
const cooperatedApplication = applications.find((item) => item.status === '已合作')
assert(cooperatedApplication, '缺少已合作入驻申请')

assert(authenticateFactoryOnboardingAdmin(draftApplication.adminAccount.loginId, draftApplication.adminAccount.password)?.applicationId === draftApplication.applicationId, '未合作工厂账号不能用于入驻登录')
assert(findFactoryPdaUserByLoginId(cooperatedApplication.adminAccount.loginId), '已合作工厂必须存在正式管理员账号')
assert(getFactoryMasterRecordById(cooperatedApplication.createdFactoryId || ''), '已合作工厂必须已生成工厂档案')

for (const application of applications.filter((item) => item.status !== '已合作')) {
  assert(!application.createdFactoryId || !listFactoryMasterRecords().some((factory) => factory.id === application.createdFactoryId), `${application.applicationNo} 未合作却进入工厂档案`)
}

const buckets = listFactoryOnboardingStatusBuckets()
assert(typeof buckets.待审核 === 'number', '平台统计卡缺少待审核')
assert(typeof buckets.退回补充 === 'number', '平台统计卡缺少退回补充')
assert(typeof buckets.待确认合作 === 'number', '平台统计卡缺少待确认合作')
assert(typeof buckets.已合作 === 'number', '平台统计卡缺少已合作')
assert(typeof buckets.已拒绝 === 'number', '平台统计卡缺少已拒绝')

const unauthAccess = ensurePdaAccessForRoute('/fcs/pda/exec')
assert(!unauthAccess.allowed && (unauthAccess.redirectPath || '').startsWith('/fcs/pda/auth/login'), '未登录访问业务页必须跳转新登录页')
assert(getPdaFactoryAccessState().reasonCode === 'UNAUTHENTICATED', '未登录访问状态判断错误')
assert(resolvePdaPostLoginRoute(null, '/fcs/pda/exec').startsWith('/fcs/pda/auth/login'), '未登录默认分流必须回到新登录页')

assertIncludes('src/main-handlers/pda-handlers.ts', ['handlePdaOnboardingEvent'])
assertIncludes('src/main-handlers/fcs-handlers.ts', ['handleFactoryOnboardingEvent'])
assertIncludes('src/main.ts', ['data-pda-onboarding-field', 'data-factory-onboarding-field'])

console.log('factory onboarding p0 checks passed')
