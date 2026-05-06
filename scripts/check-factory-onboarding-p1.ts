import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import { createEmptyFactoryOnboardingDraft, listFactoryOnboardingApplications } from '../src/data/fcs/factory-onboarding-store.ts'
import {
  calculateNodeElapsedMinutes,
  canEditOnboardingApplication,
  canSubmitOnboardingApplication,
  createCapabilityFromSelection,
  createDefaultMachineDraft,
  formatNodeElapsedText,
  getCurrentNodeLog,
  getNodeActionCount,
  listSelectableProcessCraftOptions,
  reviewFactoryOnboardingApplication,
  saveFactoryOnboardingDraft,
  submitFactoryOnboardingApplication,
} from '../src/data/fcs/factory-onboarding-flow.ts'
import type { FactoryOnboardingApplication, FactoryOnboardingDraftPayload, FactoryOnboardingRequiredField } from '../src/data/fcs/factory-onboarding-domain.ts'

const root = process.cwd()

function assert(condition: unknown, message: string): void {
  if (!condition) {
    throw new Error(`工厂入驻 P1 检查失败：${message}`)
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

function buildDraftFromApplication(application: FactoryOnboardingApplication): FactoryOnboardingDraftPayload {
  return {
    applicationId: application.applicationId,
    applicationNo: application.applicationNo,
    factoryTempId: application.factoryTempId,
    factoryName: application.factoryName,
    bossName: application.bossName,
    whatsapp: application.whatsapp,
    address: application.address,
    machineTotalCount: application.machineTotalCount,
    effectiveWorkerCount: application.effectiveWorkerCount,
    availableStartDate: application.availableStartDate,
    selectedCapabilities: application.selectedCapabilities.map((item) => ({ ...item })),
    machines: application.machines.map((item) => ({ ...item })),
    adminAccount: { ...application.adminAccount },
  }
}

const p0ScriptPath = 'scripts/check-factory-onboarding-p0.ts'
const domainPath = 'src/data/fcs/factory-onboarding-domain.ts'
const flowPath = 'src/data/fcs/factory-onboarding-flow.ts'
const pdaOnboardingPath = 'src/pages/pda-onboarding.ts'
const platformPagePath = 'src/pages/factory-onboarding.ts'
const routesPdaPath = 'src/router/routes-pda.ts'

assert(existsSync(join(root, p0ScriptPath)), 'P0 检查脚本不存在')
assertIncludes(domainPath, ['nodeStatus', 'elapsedMinutes', 'elapsedText', 'actionCount', 'lastActionAt'])
assertIncludes(domainPath, ['actionSequenceInNode', 'fromStatus', 'toStatus', 'fromNode', 'toNode'])
assertIncludes(domainPath, ['reviewRoundNo', 'reviewResult', 'reviewOpinion', 'allowResubmit'])
assertIncludes(domainPath, ['supplementRecords', 'supplementRoundNo', 'requiredFields', 'submittedFields'])
assertIncludes(domainPath, ['validationStatus', 'validationMessage'])
assertIncludes(flowPath, ['calculateNodeElapsedMinutes', 'formatNodeElapsedText', 'getCurrentNodeLog', 'updateNodeLogOnTransition', 'getNodeActionCount'])
assertIncludes(pdaOnboardingPath, ['当前节点耗时', '当前节点动作次数', '上次动作', '需补充字段', '重新提交入驻申请'])
assertIncludes(platformPagePath, ['流程记录', '审核记录', '补充记录', '需补充字段'])
assertNotIncludes(routesPdaPath, ["'/fcs/pda/login'", "renderRouteRedirect('/fcs/pda/auth/login'"])
assertNotIncludes(flowPath, ['/fcs/pda/login'])
assertNotIncludes(pdaOnboardingPath, ['PENDING', 'DONE', 'IN_PROGRESS'])
assertNotIncludes(platformPagePath, ['PENDING', 'DONE', 'IN_PROGRESS'])

assert(calculateNodeElapsedMinutes({ nodeStatus: '进行中', enteredAt: '2026-05-06 09:00:00', leftAt: undefined }, '2026-05-06 10:30:00') === 90, '节点耗时计算错误')
assert(formatNodeElapsedText(90) === '1小时30分钟', '节点耗时格式化错误')

const applications = listFactoryOnboardingApplications()
const returnedApps = applications.filter((item) => item.status === '退回补充资料')
const resubmittedApps = applications.filter((item) => item.status === '已重新提交待审核')
const pendingApps = applications.filter((item) => item.status === '已提交待审核')
const approvedApps = applications.filter((item) => item.status === '审核通过待确认合作')
const rejectedApps = applications.filter((item) => item.status === '已拒绝')

assert(returnedApps.length >= 3, '退回补充资料 mock 数据不足 3 条')
assert(resubmittedApps.length >= 3, '已重新提交待审核 mock 数据不足 3 条')
assert(pendingApps.length >= 3, '已提交待审核 mock 数据不足 3 条')
assert(approvedApps.length >= 3, '审核通过待确认合作 mock 数据不足 3 条')
assert(rejectedApps.length >= 3, '已拒绝 mock 数据不足 3 条')

for (const application of applications) {
  application.nodeLogs.forEach((item) => {
    assert(typeof item.nodeLogId === 'string' && item.nodeLogId.length > 0, `${application.applicationNo} 节点日志缺少 nodeLogId`)
    assert(typeof item.nodeStatus === 'string', `${application.applicationNo} 节点日志缺少 nodeStatus`)
    assert(typeof item.enteredAt === 'string', `${application.applicationNo} 节点日志缺少 enteredAt`)
    assert('elapsedMinutes' in item, `${application.applicationNo} 节点日志缺少 elapsedMinutes`)
    assert('elapsedText' in item, `${application.applicationNo} 节点日志缺少 elapsedText`)
    assert('actionCount' in item, `${application.applicationNo} 节点日志缺少 actionCount`)
    assert('lastActionAt' in item, `${application.applicationNo} 节点日志缺少 lastActionAt`)
  })
  application.actionLogs.forEach((item) => {
    assert(typeof item.actionSequenceInNode === 'number', `${application.applicationNo} 动作日志缺少 actionSequenceInNode`)
    assert(typeof item.fromStatus === 'string', `${application.applicationNo} 动作日志缺少 fromStatus`)
    assert(typeof item.toStatus === 'string', `${application.applicationNo} 动作日志缺少 toStatus`)
    assert(typeof item.fromNode === 'string', `${application.applicationNo} 动作日志缺少 fromNode`)
    assert(typeof item.toNode === 'string', `${application.applicationNo} 动作日志缺少 toNode`)
  })
}

for (const application of returnedApps) {
  assert(canEditOnboardingApplication(application), `${application.applicationNo} 退回补充资料状态应允许编辑`)
  assert(canSubmitOnboardingApplication(application), `${application.applicationNo} 退回补充资料状态应允许重新提交`)
  assert(application.reviewRecords.length > 0, `${application.applicationNo} 缺少审核记录`)
  assert(application.supplementRecords.length > 0, `${application.applicationNo} 缺少补充记录`)
  assert(application.supplementRecords.some((item) => item.requiredFields.length > 0), `${application.applicationNo} 缺少需补充字段`)
}

for (const application of rejectedApps) {
  assert(!canEditOnboardingApplication(application), `${application.applicationNo} 已拒绝状态应只读`)
  assert(!canSubmitOnboardingApplication(application), `${application.applicationNo} 已拒绝状态不应允许提交`)
}

for (const application of resubmittedApps) {
  assert(application.reviewRecords.length > 0, `${application.applicationNo} 缺少退回审核记录`)
  assert(application.actionLogs.some((item) => item.actionName === '工厂重新提交'), `${application.applicationNo} 缺少工厂重新提交动作`)
  assert(getNodeActionCount(application, '平台审核') >= 2, `${application.applicationNo} 平台审核节点动作次数应至少为第2次`)
}

for (const application of pendingApps) {
  const currentNodeLog = getCurrentNodeLog(application)
  assert(currentNodeLog?.nodeName === '平台审核', `${application.applicationNo} 当前节点应为平台审核`)
  assert(currentNodeLog?.elapsedText && currentNodeLog.elapsedText !== '-', `${application.applicationNo} 平台审核节点耗时缺失`)
}

for (const application of approvedApps) {
  const currentNodeLog = getCurrentNodeLog(application)
  assert(currentNodeLog?.nodeName === '确认合作', `${application.applicationNo} 当前节点应为确认合作`)
  assert(currentNodeLog?.elapsedText && currentNodeLog.elapsedText !== '-', `${application.applicationNo} 确认合作节点耗时缺失`)
}

const missingProcessCount = applications.flatMap((item) => item.machines).filter((item) => item.validationStatus === '未关联工序').length
const missingCraftCount = applications.flatMap((item) => item.machines).filter((item) => item.validationStatus === '未关联工艺').length
const capabilityMismatchCount = applications.flatMap((item) => item.machines).filter((item) => item.validationStatus === '工序工艺未在接单能力中选择').length
assert(missingProcessCount >= 3, '机器未关联工序场景不足 3 条')
assert(missingCraftCount >= 3, '机器未关联工艺场景不足 3 条')
assert(capabilityMismatchCount >= 3, '机器工序工艺未在接单能力中选择场景不足 3 条')

const selectable = listSelectableProcessCraftOptions()
assert(selectable.length > 0, '工序工艺字典未接入')
const firstProcess = selectable[0]
const firstCraft = firstProcess?.crafts[0]
assert(firstProcess && firstCraft, '缺少可用的工序工艺字典数据')
const capability = createCapabilityFromSelection(firstProcess.processCode, firstCraft.craftCode)
assert(capability, '无法根据字典创建工序工艺能力')

const tempDraft = createEmptyFactoryOnboardingDraft()
tempDraft.adminAccount.loginId = `p1_temp_${Date.now()}`
tempDraft.adminAccount.password = '123456'
tempDraft.adminAccount.adminName = 'P1测试管理员'
tempDraft.adminAccount.whatsapp = '+62-812-9000-991'
tempDraft.factoryName = 'P1流程校验工厂'
tempDraft.bossName = 'P1老板'
tempDraft.whatsapp = '+62-812-9000-991'
tempDraft.address = 'P1 演示工业园'
tempDraft.availableStartDate = '2026-05-30'
tempDraft.effectiveWorkerCount = 26
tempDraft.machineTotalCount = 2
tempDraft.selectedCapabilities = [capability]
const machine = createDefaultMachineDraft(1)
machine.machineName = 'P1测试设备'
machine.machineNo = 'P1-EQ-01'
machine.machineCount = 2
machine.linkedProcessCode = capability.processCode
machine.linkedProcessName = capability.processName
machine.linkedCraftCode = capability.craftCode
machine.linkedCraftName = capability.craftName
machine.validationStatus = '通过'
machine.validationMessage = '校验通过'
tempDraft.machines = [machine]

const submitted = submitFactoryOnboardingApplication(tempDraft, '123456')
assert(submitted.status === '已提交待审核', '首次提交后状态应为已提交待审核')
const returned = reviewFactoryOnboardingApplication({
  applicationId: submitted.applicationId,
  reviewResult: '不通过且允许再次提交',
  reviewOpinion: '请补充机器明细与工序工艺能力说明',
  reviewer: 'P1审核员',
  requiredFields: ['机器明细', '工序工艺能力'] as FactoryOnboardingRequiredField[],
})
assert(returned.status === '退回补充资料', '退回补充后状态应为退回补充资料')
assert(returned.reviewRecords.length > submitted.reviewRecords.length, '退回补充后应新增审核记录')
assert(returned.supplementRecords.length > 0, '退回补充后应新增补充记录')
assert(returned.supplementRecords.at(-1)?.requiredFields.includes('机器明细'), '退回补充记录缺少需补充字段')

const resubmitDraft = buildDraftFromApplication(returned)
resubmitDraft.address = 'P1 演示工业园 A 栋 3 层'
const resubmitted = submitFactoryOnboardingApplication(resubmitDraft, returned.adminAccount.password)
assert(resubmitted.status === '已重新提交待审核', '重新提交后状态应为已重新提交待审核')
assert(resubmitted.actionLogs.some((item) => item.actionName === '工厂重新提交'), '重新提交后缺少工厂重新提交动作')
assert(resubmitted.supplementRecords.at(-1)?.status === '已重新提交', '重新提交后补充记录状态应为已重新提交')
assert(resubmitted.supplementRecords.at(-1)?.submittedFields.length, '重新提交后补充记录应写入 submittedFields')
assert(getCurrentNodeLog(resubmitted)?.nodeName === '平台审核', '重新提交后当前节点应变为平台审核')
assert(getCurrentNodeLog(resubmitted)?.actionCount && getCurrentNodeLog(resubmitted)!.actionCount >= 2, '重新提交后平台审核节点动作次数应递增')

console.log('factory onboarding p1 checks passed')
