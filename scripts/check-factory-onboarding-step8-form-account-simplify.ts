import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import {
  createCapabilityFromSelection,
  createDefaultMachineDraft,
  submitFactoryOnboardingApplication,
  listSelectableProcessCraftOptions,
} from '../src/data/fcs/factory-onboarding-flow.ts'
import {
  buildAdminAccountFromFactoryShortName,
  createEmptyFactoryOnboardingDraft,
  isFactoryShortNameTaken,
  listFactoryOnboardingApplications,
  normalizeFactoryShortName,
  validateFactoryShortNameUnique,
} from '../src/data/fcs/factory-onboarding-store.ts'
import { listFactoryMasterRecords } from '../src/data/fcs/factory-master-store.ts'

const root = process.cwd()

function read(path: string): string {
  return readFileSync(join(root, path), 'utf8')
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`工厂入驻 Step8 表单账号收口检查失败：${message}`)
}

function assertIncludes(path: string, needles: string[]): void {
  const source = read(path)
  for (const needle of needles) assert(source.includes(needle), `${path} 缺少 ${needle}`)
}

function assertNotIncludes(path: string, needles: string[]): void {
  const source = read(path)
  for (const needle of needles) assert(!source.includes(needle), `${path} 不应包含 ${needle}`)
}

function expectError(fn: () => void, message: string): void {
  try {
    fn()
    assert(false, `应抛出错误：${message}`)
  } catch (error) {
    assert(error instanceof Error && error.message.includes(message), `错误提示应包含：${message}`)
  }
}

const domainPath = 'src/data/fcs/factory-onboarding-domain.ts'
const flowPath = 'src/data/fcs/factory-onboarding-flow.ts'
const storePath = 'src/data/fcs/factory-onboarding-store.ts'
const pdaOnboardingPath = 'src/pages/pda-onboarding.ts'
const pdaLoginPath = 'src/pages/pda-login.ts'
const platformPath = 'src/pages/factory-onboarding.ts'
const profilePath = 'src/pages/factory-profile.ts'
const masterStorePath = 'src/data/fcs/factory-master-store.ts'
const routesPdaPath = 'src/router/routes-pda.ts'

for (const path of [domainPath, flowPath, storePath, pdaOnboardingPath, pdaLoginPath, platformPath, profilePath, masterStorePath]) {
  assert(existsSync(join(root, path)), `缺少文件 ${path}`)
}

assertIncludes(domainPath, ['factoryShortName', 'mobilePhone'])
assertIncludes(storePath, [
  'normalizeFactoryShortName',
  'isFactoryShortNameTaken',
  'validateFactoryShortNameUnique',
  'buildAdminAccountFromFactoryShortName',
  'adminAccount.loginId',
  'factoryShortName',
  'mobilePhone',
])
assertIncludes(flowPath, [
  'factoryShortName',
  'mobilePhone',
  'validateFactoryShortNameUnique',
  'buildAdminAccountFromFactoryShortName',
  '请填写手机号',
])
assertIncludes(storePath, ['请填写工厂简称', '工厂简称已存在，请更换'])
assertIncludes(pdaOnboardingPath, ['工厂基础信息', '工厂简称', '手机号', 'data-pda-onboarding-field="factoryShortName"', 'data-pda-onboarding-field="mobilePhone"'])
assertNotIncludes(pdaOnboardingPath, ['账号信息', '登录账户', '登录密码', '确认密码', 'WhatsApp', '手机号码/WhatsApp'])
assertIncludes(pdaLoginPath, ['登录账号', '请输入登录账号', '请输入密码'])
assertNotIncludes(pdaLoginPath, ['WhatsApp'])
assertIncludes(platformPath, ['工厂简称', '手机号'])
assertNotIncludes(platformPath, ['WhatsApp', '手机号码/WhatsApp'])
assertIncludes(profilePath, ['工厂简称', '手机号'])
assertNotIncludes(profilePath, ['WhatsApp', '手机号码/WhatsApp'])
assertIncludes(masterStorePath, ['factoryShortName', 'mobilePhone'])
assertNotIncludes(routesPdaPath, ["'/fcs/pda/login'", '"/fcs/pda/login"'])

assert(normalizeFactoryShortName('  Demo_Factory  ') === 'demo_factory', '工厂简称归一化应 trim 并忽略大小写')
expectError(() => validateFactoryShortNameUnique('   '), '请填写工厂简称')

const applications = listFactoryOnboardingApplications()
for (const application of applications) {
  assert(application.factoryShortName, `${application.applicationNo} 缺少 factoryShortName`)
  assert(application.mobilePhone, `${application.applicationNo} 缺少 mobilePhone`)
  assert(application.adminAccount.loginId === application.factoryShortName, `${application.applicationNo} adminAccount.loginId 未来源于工厂简称`)
  assert(application.adminAccount.mobilePhone === application.mobilePhone, `${application.applicationNo} adminAccount.mobilePhone 未同步手机号`)
}

const editableApplication = applications.find((item) => item.status !== '已转正式合作')
assert(editableApplication, '缺少可用于唯一性编辑校验的入驻申请')
assert(isFactoryShortNameTaken(editableApplication.factoryShortName), '入驻申请工厂简称应被识别为已存在')
validateFactoryShortNameUnique(editableApplication.factoryShortName, editableApplication.applicationId)
expectError(() => validateFactoryShortNameUnique(editableApplication.factoryShortName), '工厂简称已存在，请更换')

const officialFactory = listFactoryMasterRecords().find((item) => item.factoryShortName)
assert(officialFactory?.factoryShortName, '正式工厂档案缺少工厂简称')
assert(officialFactory.mobilePhone, '正式工厂档案缺少手机号')
assert(isFactoryShortNameTaken(officialFactory.factoryShortName), '正式工厂档案工厂简称应纳入唯一性校验')
expectError(() => validateFactoryShortNameUnique(officialFactory.factoryShortName), '工厂简称已存在，请更换')

const admin = buildAdminAccountFromFactoryShortName({
  factoryShortName: 'step8_auto_account',
  applicantName: 'Step8申请人',
  mobilePhone: '+62-812-9000-888',
})
assert(admin.loginId === 'step8_auto_account', '自动管理员账号 loginId 应等于工厂简称')
assert(admin.adminName === 'Step8申请人', '自动管理员姓名应来源于申请人')
assert(admin.mobilePhone === '+62-812-9000-888', '自动管理员手机号应来源于手机号')
assert(admin.roleName === '工厂管理员', '自动管理员角色应为工厂管理员')
assert(admin.accountStatus === '入驻中', '自动管理员账号状态应为入驻中')
assert(admin.isTemporary === true, '自动管理员账号应为临时账号')

const selectable = listSelectableProcessCraftOptions()
const firstProcess = selectable[0]
assert(firstProcess?.crafts[0], '缺少工序工艺字典数据')
const capability = createCapabilityFromSelection(firstProcess.processCode, firstProcess.crafts[0].craftCode)
assert(capability, '无法创建工序工艺能力')
const draft = createEmptyFactoryOnboardingDraft()
draft.factoryShortName = `step8_unique_${Date.now()}`
draft.applicantName = 'Step8提交申请人'
draft.identityNo = 'ID-STEP8-0001'
draft.identityFile = { fileId: 'IDF-STEP8', fileName: 'Step8身份文件.pdf', fileType: 'pdf', fileSizeMb: 2, uploadedAt: '2026-05-06 10:00:00' }
draft.factoryCompanyName = 'Step8简称唯一校验工厂'
draft.address = 'Step8 工业园'
draft.mobilePhone = '+62-812-9000-889'
draft.mobileOrWhatsapp = draft.mobilePhone
draft.sourceChannel = 'PPIC 转介绍'
draft.ppicName = 'Step8-PPIC'
draft.machineTotalCount = 1
draft.effectiveWorkerCount = 12
draft.availableStartDate = '2026-06-01'
draft.selectedCapabilities = [capability]
const machine = createDefaultMachineDraft(1)
machine.machineName = 'Step8测试设备'
machine.machineCount = 1
machine.linkedProcessCode = capability.processCode
machine.linkedProcessName = capability.processName
machine.linkedCraftCode = capability.craftCode
machine.linkedCraftName = capability.craftName
draft.machines = [machine]

const submitted = submitFactoryOnboardingApplication(draft, '123456')
assert(submitted.status === '待平台审核', '完整入驻申请应可提交')
assert(submitted.adminAccount.loginId === submitted.factoryShortName, '提交时应自动生成 adminAccount.loginId')
assert(submitted.adminAccount.mobilePhone === submitted.mobilePhone, '提交时应自动生成 adminAccount.mobilePhone')
assert(submitted.adminAccount.accountStatus === '入驻中', '提交时自动管理员状态应为入驻中')

console.log('factory onboarding step8 form-account-simplify checks passed')
