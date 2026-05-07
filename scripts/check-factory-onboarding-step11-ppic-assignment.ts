import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import type { FactorySampleReferenceFile, FactorySampleSubmissionPayload } from '../src/data/fcs/factory-sample-verification-domain.ts'
import {
  DEFAULT_FACTORY_ONBOARDING_PPIC,
  FACTORY_ONBOARDING_PPIC_OPTIONS,
  assignDefaultPpicForOnboarding,
  getAvailableOnboardingPpicOptions,
  listFactoryOnboardingApplications,
  updateOnboardingPpic,
} from '../src/data/fcs/factory-onboarding-store.ts'
import { submitFactorySampleReview } from '../src/data/fcs/factory-sample-verification-flow.ts'
import { listSampleVerifications } from '../src/data/fcs/factory-sample-verification-store.ts'
import { convertOnboardingToOfficialFactory } from '../src/data/fcs/factory-onboarding-flow.ts'
import { getFactoryMasterRecordById } from '../src/data/fcs/factory-master-store.ts'

const SCRIPT_NAME = 'check-factory-onboarding-step11-ppic-assignment'
const root = process.cwd()

if (typeof globalThis.localStorage === 'undefined') {
  const memory = new Map<string, string>()
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem(key: string) {
        return memory.has(key) ? memory.get(key)! : null
      },
      setItem(key: string, value: string) {
        memory.set(key, value)
      },
      removeItem(key: string) {
        memory.delete(key)
      },
      clear() {
        memory.clear()
      },
    },
  })
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`${SCRIPT_NAME} 检查失败：${message}`)
}

function src(path: string): string {
  return readFileSync(resolve(root, path), 'utf8')
}

function assertIncludes(path: string, snippets: string[]): void {
  const content = src(path)
  for (const snippet of snippets) assert(content.includes(snippet), `${path} 缺少 ${snippet}`)
}

function collectSourceFiles(dir: string): string[] {
  const current = resolve(root, dir)
  return readdirSync(current).flatMap((entry) => {
    const absolute = join(current, entry)
    const relative = join(dir, entry)
    return statSync(absolute).isDirectory() ? collectSourceFiles(relative) : absolute
  })
}

function assertNoRegexInSrc(pattern: RegExp, message: string): void {
  for (const file of collectSourceFiles('src')) {
    assert(!pattern.test(readFileSync(file, 'utf8')), `${message}：${file}`)
  }
}

function expectError(action: () => unknown, expected: string): void {
  try {
    action()
  } catch (error) {
    assert(error instanceof Error && error.message.includes(expected), `错误提示应包含：${expected}`)
    return
  }
  assert(false, `应抛出错误：${expected}`)
}

function file(fileName: string, fileType: FactorySampleReferenceFile['fileType']): FactorySampleReferenceFile {
  return {
    fileId: `STEP11-${fileName}`,
    fileName,
    fileType,
    fileSizeMb: fileType === 'mp4' ? 16 : 2,
    uploadedAt: '2026-05-07 12:00:00',
  }
}

const domainPath = 'src/data/fcs/factory-onboarding-domain.ts'
const ppicPath = 'src/data/fcs/factory-onboarding-ppic.ts'
const storePath = 'src/data/fcs/factory-onboarding-store.ts'
const sampleFlowPath = 'src/data/fcs/factory-sample-verification-flow.ts'
const platformPath = 'src/pages/factory-onboarding.ts'
const pdaPath = 'src/pages/pda-onboarding.ts'
const flowPath = 'src/data/fcs/factory-onboarding-flow.ts'

assertIncludes(domainPath, [
  'assignedPpicId',
  'assignedPpicName',
  'assignedPpicPhone',
  'assignedPpicAt',
  'assignedPpicBy',
  'ppicChangeLogs',
  'FactoryOnboardingPpicChangeLog',
])
assertIncludes(ppicPath, ['FACTORY_ONBOARDING_PPIC_OPTIONS', 'DEFAULT_FACTORY_ONBOARDING_PPIC', '启用', '停用'])
assertIncludes(storePath, [
  'assignDefaultPpicForOnboarding',
  'updateOnboardingPpic',
  'getAvailableOnboardingPpicOptions',
  'getOnboardingPpicName',
  '工厂提交样衣审核资料后自动分配默认 PPIC',
])
assertIncludes(sampleFlowPath, ['assignDefaultPpicForOnboarding'])
assertIncludes(platformPath, ['<th class="px-3 py-2 text-left font-medium">PPIC</th>', 'data-factory-onboarding-field="ppicFilter"', '修改 PPIC', 'PPIC 变更记录'])
assertIncludes(pdaPath, ['PPIC：'])
assertIncludes(flowPath, ['assignedPpicId', 'assignedPpicName', 'assignedPpicPhone'])

assert(FACTORY_ONBOARDING_PPIC_OPTIONS.length >= 3, 'PPIC 选项不足 3 个')
assert(getAvailableOnboardingPpicOptions().length >= 2, '启用 PPIC 选项不足 2 个')
assert(FACTORY_ONBOARDING_PPIC_OPTIONS.some((item) => item.status === '停用'), '缺少停用 PPIC')
assert(DEFAULT_FACTORY_ONBOARDING_PPIC.ppicId === 'PPIC-DEFAULT-001', '默认 PPIC 不正确')

const submissionPayload: FactorySampleSubmissionPayload = {
  factorySamplePhotos: [file('样衣照片.jpg', 'jpg')],
  factorySampleVideos: [file('样衣视频.mp4', 'mp4')],
  factoryCraftDescription: '样衣工艺说明完整。',
  factoryProblemDescription: '',
  factorySubmitRemark: '',
  factorySubmissionFiles: [],
  factorySitePhotos: [file('工厂照片.jpg', 'jpg')],
  factorySiteVideos: [file('工厂视频.mp4', 'mp4')],
  bossIdentityNo: '',
  bossIdentityFiles: [],
}

const waitingSubmit = listSampleVerifications().find((item) => item.status === '待工厂提交样衣审核')
assert(waitingSubmit, '缺少待工厂提交样衣审核样本')
const submitted = submitFactorySampleReview(waitingSubmit.verificationId, submissionPayload, 'Step11工厂管理员')
assert(submitted.application.status === '待平台审核样衣', '提交样衣后状态应为待平台审核样衣')
assert(submitted.application.assignedPpicId === DEFAULT_FACTORY_ONBOARDING_PPIC.ppicId, '提交样衣后未自动分配默认 PPIC')
assert(submitted.application.assignedPpicName === DEFAULT_FACTORY_ONBOARDING_PPIC.ppicName, '默认 PPIC 姓名未写入')
assert(submitted.application.assignedPpicBy === '系统默认分配', '默认 PPIC 分配人不正确')
assert(submitted.application.ppicChangeLogs.some((log) => log.changedBy === '系统默认分配'), '默认分配未写入 PPIC 变更记录')

const activePpic = getAvailableOnboardingPpicOptions().find((item) => item.ppicId !== DEFAULT_FACTORY_ONBOARDING_PPIC.ppicId)
assert(activePpic, '缺少可用于平台修改的启用 PPIC')
const changed = updateOnboardingPpic(submitted.application.applicationId, activePpic.ppicId, 'Step11平台运营员', '调整跟进人')
assert(changed.assignedPpicId === activePpic.ppicId, '平台修改 PPIC 未生效')
assert(changed.ppicChangeLogs.some((log) => log.changedBy === 'Step11平台运营员' && log.toPpicId === activePpic.ppicId), '平台修改 PPIC 未写入变更记录')
const unchanged = assignDefaultPpicForOnboarding(changed.applicationId, '系统默认分配')
assert(unchanged.assignedPpicId === activePpic.ppicId, '已有 PPIC 不应被默认 PPIC 覆盖')
assert(unchanged.ppicChangeLogs.length === changed.ppicChangeLogs.length, '已有 PPIC 时不应新增重复默认分配记录')

const stoppedPpic = FACTORY_ONBOARDING_PPIC_OPTIONS.find((item) => item.status === '停用')
assert(stoppedPpic, '缺少停用 PPIC')
expectError(() => updateOnboardingPpic(changed.applicationId, stoppedPpic.ppicId, 'Step11平台运营员'), '该 PPIC 不可用，请重新选择')
expectError(() => updateOnboardingPpic(changed.applicationId, '', 'Step11平台运营员'), '请选择 PPIC')

const applications = listFactoryOnboardingApplications()
assert(applications.filter((item) => ['待平台审核样衣', '样衣审核退回', '样衣审核通过待转正式', '已转正式合作'].includes(item.status) && item.assignedPpicId).length >= 12, '样衣提交后状态 mock 未覆盖默认 PPIC')
assert(applications.filter((item) => !item.assignedPpicId).length >= 3, 'mock 缺少未分配 PPIC 的入驻申请')
assert(applications.filter((item) => item.ppicChangeLogs.length >= 2).length >= 3, 'mock 缺少平台手动修改 PPIC 记录')

const convertible = applications.find((item) => item.status === '样衣审核通过待转正式' && item.assignedPpicId)
assert(convertible, '缺少可转正式且已分配 PPIC 的样本')
const converted = await convertOnboardingToOfficialFactory(convertible.applicationId, 'Step11转档员')
const createdFactory = getFactoryMasterRecordById(converted.createdFactory.id)
assert(createdFactory?.assignedPpicId === convertible.assignedPpicId, '转正式后工厂档案未携带 assignedPpicId')
assert(createdFactory?.assignedPpicName === convertible.assignedPpicName, '转正式后工厂档案未携带 assignedPpicName')

assertNoRegexInSrc(/\/fcs\/pda\/login/, '不得存在 /fcs/pda/login 兼容跳转')
assert(!/PPIC.*说明/.test(src(platformPath)), '平台页面不得出现 PPIC 大段说明文案')
assert(!/PPIC.*说明/.test(src(pdaPath)), '工厂端不得出现 PPIC 大段说明文案')

console.log('工厂入驻 Step11 PPIC 默认分配与平台修改检查通过')
