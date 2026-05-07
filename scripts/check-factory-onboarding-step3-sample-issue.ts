import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import {
  canCreateFactoryProfile,
  canFactoryEnterBusiness,
} from '../src/data/fcs/factory-onboarding-flow.ts'
import {
  getFactoryOnboardingApplicationById,
  listFactoryOnboardingApplications,
} from '../src/data/fcs/factory-onboarding-store.ts'
import { listFactoryMasterRecords } from '../src/data/fcs/factory-master-store.ts'
import {
  createSampleIssuePayload,
  issueSampleForOnboarding,
  validateSampleIssuePayload,
} from '../src/data/fcs/factory-sample-verification-flow.ts'
import {
  getSampleVerificationByApplicationId,
  listSampleVerifications,
} from '../src/data/fcs/factory-sample-verification-store.ts'
import {
  FACTORY_SAMPLE_VERIFICATION_NODE_OPTIONS,
  FACTORY_SAMPLE_VERIFICATION_STATUS_OPTIONS,
  type FactorySampleIssuePayload,
} from '../src/data/fcs/factory-sample-verification-domain.ts'

const root = process.cwd()

function read(path: string): string {
  return readFileSync(join(root, path), 'utf8')
}

function assert(condition: unknown, message: string): void {
  if (!condition) throw new Error(`工厂入驻 Step3 样衣发放检查失败：${message}`)
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
  } catch (error) {
    assert(error instanceof Error && error.message.includes(message), `错误提示应包含：${message}`)
    return
  }
  assert(false, `应抛出错误：${message}`)
}

const sampleDomainPath = 'src/data/fcs/factory-sample-verification-domain.ts'
const sampleStorePath = 'src/data/fcs/factory-sample-verification-store.ts'
const sampleFlowPath = 'src/data/fcs/factory-sample-verification-flow.ts'
const onboardingDomainPath = 'src/data/fcs/factory-onboarding-domain.ts'
const onboardingStorePath = 'src/data/fcs/factory-onboarding-store.ts'
const onboardingFlowPath = 'src/data/fcs/factory-onboarding-flow.ts'
const platformPath = 'src/pages/factory-onboarding.ts'
const pdaOnboardingPath = 'src/pages/pda-onboarding.ts'
const pdaRuntimePath = 'src/pages/pda-runtime.ts'
const pdaRoutesPath = 'src/router/routes-pda.ts'
const appShellPath = 'src/data/app-shell-config.ts'

for (const path of [sampleDomainPath, sampleStorePath, sampleFlowPath, onboardingDomainPath, onboardingStorePath, onboardingFlowPath, platformPath, pdaOnboardingPath, pdaRuntimePath]) {
  assert(existsSync(join(root, path)), `缺少文件 ${path}`)
}

assertIncludes(sampleDomainPath, [
  'FactorySampleVerification',
  'verificationId',
  'verificationNo',
  'applicationId',
  'applicationNo',
  'factoryTempId',
  'factoryCompanyName',
  'applicantName',
  'mobileOrWhatsapp',
  'sampleBatchNo',
  'styleNo',
  'sampleName',
  'sampleDescription',
  'verificationPurpose',
  'sampleQuantity',
  'issueMethod',
  'courierCompany',
  'trackingNo',
  'issuedAt',
  'issuedBy',
  'expectedReceiveAt',
  'expectedSubmitAt',
  'platformReferencePhotos',
  'platformReferenceVideos',
  'platformReferenceFiles',
  'status',
  'currentNode',
  'factoryReceivedAt',
  'factorySubmittedAt',
  'platformSampleReviewedAt',
  'sampleReviewRecords',
])

for (const status of ['待工厂确认收样', '待工厂提交样衣审核', '待平台审核样衣', '样衣审核退回', '样衣审核拒绝', '样衣审核通过'] as const) {
  assert(FACTORY_SAMPLE_VERIFICATION_STATUS_OPTIONS.includes(status), `样衣状态枚举缺少 ${status}`)
}
for (const node of ['平台发放样衣', '工厂确认收样', '工厂提交样衣审核', '平台审核样衣', '样衣验证完成'] as const) {
  assert(FACTORY_SAMPLE_VERIFICATION_NODE_OPTIONS.includes(node), `样衣节点枚举缺少 ${node}`)
}

assertIncludes(sampleStorePath, [
  'listSampleVerifications',
  'getSampleVerificationById',
  'getSampleVerificationByApplicationId',
  'createSampleVerificationFromOnboarding',
  'updateSampleVerification',
])
assertIncludes(sampleFlowPath, [
  'buildSampleVerificationNo',
  'createSampleIssuePayload',
  'validateSampleIssuePayload',
  'issueSampleForOnboarding',
  '只有待样衣验证的申请可以登记并发放样衣。',
  '当前申请已登记样衣，请勿重复发放。',
  "status: '待工厂确认收样'",
  "sampleStatus: '待工厂确认收样'",
  'sampleVerificationId',
])
assertIncludes(onboardingDomainPath, ['sampleIssuedAt', 'sampleExpectedSubmitAt', '平台登记并发放样衣'])
assertIncludes(platformPath, [
  '登记并发放样衣',
  '确认发放样衣',
  '样衣件数',
  '验证目的',
  '发放方式',
  '查看样衣',
  '样衣验证',
  '暂未登记样衣。',
])
assertIncludes(pdaOnboardingPath, [
  '样衣验证',
  '样衣批次号',
  '样衣件数',
  '待工厂确认收样',
])
assertIncludes(pdaRuntimePath, ['canFactoryEnterBusiness'])
assertIncludes(appShellPath, ['工厂入驻&登录', '工厂入驻管理'])

assertNotIncludes(platformPath, ['确认' + '合作', '生成工厂档案', 'data-factory-onboarding-action="open-transfer"', '分配任务'])
assertNotIncludes(onboardingFlowPath, ['审核通过待确认合作', '审核通过并生成工厂档案', '发放样衣并生成工厂档案'])
assertNotIncludes(onboardingStorePath, ['审核通过待确认合作', '通过并生成工厂档案'])
assertNotIncludes(pdaRoutesPath, ["'/fcs/pda/login'", '"/fcs/pda/login"'])
assertNotIncludes(appShellPath, ["href: '/fcs/pda/login'"])
assertNotIncludes(platformPath, ['PENDING', 'DONE', 'IN_PROGRESS'])
assertNotIncludes(pdaOnboardingPath, ['PENDING', 'DONE', 'IN_PROGRESS'])

const applications = listFactoryOnboardingApplications()
const waitingIssueApplications = applications.filter((item) => item.status === '待样衣验证')
const waitingReceiveApplications = applications.filter((item) => item.status === '待工厂确认收样')
assert(waitingIssueApplications.length >= 3, '待样衣验证 mock 数据不足 3 条')
assert(waitingIssueApplications.every((item) => !item.sampleVerificationId), '待样衣验证申请不应提前关联样衣验证对象')
assert(waitingReceiveApplications.length >= 3, '待工厂确认收样 mock 数据不足 3 条')
assert(waitingReceiveApplications.every((item) => item.sampleVerificationId && item.sampleStatus === '待工厂确认收样'), '待工厂确认收样申请必须有关联样衣验证对象')

const samples = listSampleVerifications()
assert(samples.length >= 6, '样衣验证对象不足 6 条')
assert(samples.filter((item) => item.issueMethod === '现场发放').length >= 3, '现场发放样衣 mock 不足 3 条')
assert(samples.filter((item) => item.issueMethod === '快递发放').length >= 3, '快递发放样衣 mock 不足 3 条')
assert(samples.filter((item) => item.platformReferencePhotos.length > 0).length >= 3, '参考照片 mock 不足 3 条')
assert(samples.filter((item) => item.platformReferenceVideos.length > 0 || item.platformReferenceFiles.length > 0).length >= 3, '参考视频或资料 mock 不足 3 条')
assert(samples.filter((item) => item.verificationPurpose.length > 1).length >= 3, '多验证目的 mock 不足 3 条')
for (const sample of samples) {
  for (const key of ['verificationId', 'verificationNo', 'applicationId', 'applicationNo', 'factoryCompanyName', 'applicantName', 'mobileOrWhatsapp', 'sampleBatchNo', 'styleNo', 'sampleName', 'sampleDescription', 'issuedAt', 'issuedBy', 'expectedSubmitAt', 'status', 'currentNode'] as const) {
    assert(Boolean(sample[key]), `${sample.verificationNo} 缺少 ${key}`)
  }
  assert(sample.sampleQuantity > 0, `${sample.verificationNo} 样衣件数必须大于 0`)
}

const payload = createSampleIssuePayload({
  sampleBatchNo: 'SY-20260506-CHECK',
  styleNo: 'HG-CHECK-001',
  sampleName: '检查脚本验证样',
  sampleDescription: '检查平台登记并发放样衣流转。',
  verificationPurpose: ['检验车缝能力', '检验质量稳定性'],
  sampleQuantity: 2,
  issueMethod: '现场发放',
  issuedAt: '2026-05-06 10:00:00',
  issuedBy: '检查脚本',
  expectedReceiveAt: '2026-05-07 10:00:00',
  expectedSubmitAt: '2026-05-09 18:00:00',
})
const issued = issueSampleForOnboarding(waitingIssueApplications[0].applicationId, payload, '检查脚本')
assert(issued.application.status === '待工厂确认收样', '发放样衣后申请状态必须为待工厂确认收样')
assert(issued.application.currentNode === '样衣验证', '发放样衣后申请 currentNode 必须为样衣验证')
assert(issued.application.sampleStatus === '待工厂确认收样', '发放样衣后 sampleStatus 必须为待工厂确认收样')
assert(Boolean(issued.application.sampleVerificationId), '发放样衣后必须写入 sampleVerificationId')
assert(issued.application.sampleIssuedAt === payload.issuedAt, '发放样衣后必须写入 sampleIssuedAt')
assert(issued.application.sampleExpectedSubmitAt === payload.expectedSubmitAt, '发放样衣后必须写入 sampleExpectedSubmitAt')
assert(issued.application.actionLogs.at(-1)?.actionName === '平台登记并发放样衣', '发放样衣后必须写入入驻申请 actionLogs')
assert(issued.application.nodeLogs.find((item) => item.nodeName === '样衣验证')?.nodeStatus === '进行中', '发放样衣后样衣验证节点必须保持进行中')
assert(!issued.application.createdFactoryId, '发放样衣后不得生成工厂档案')
assert(issued.application.adminAccount.accountStatus !== '已转正式', '发放样衣后不得转正式管理员账号')
assert(!canFactoryEnterBusiness(issued.application.status), '发放样衣后不得开放业务页')
assert(!listFactoryMasterRecords().some((factory) => factory.id === issued.application.createdFactoryId), '发放样衣后不得写入工厂档案')
assert(getSampleVerificationByApplicationId(issued.application.applicationId)?.verificationId === issued.sampleVerification.verificationId, '样衣验证对象与入驻申请关联错误')

expectError(() => issueSampleForOnboarding(issued.application.applicationId, payload, '检查脚本'), '当前申请已登记样衣，请勿重复发放。')
expectError(() => issueSampleForOnboarding(applications.find((item) => item.status === '待平台审核')!.applicationId, payload, '检查脚本'), '只有待样衣验证的申请可以登记并发放样衣。')

const expressPayload: FactorySampleIssuePayload = createSampleIssuePayload({
  ...payload,
  issueMethod: '快递发放',
  courierCompany: '',
  trackingNo: '',
})
expectError(() => validateSampleIssuePayload(expressPayload), '请填写快递公司')
expectError(() => validateSampleIssuePayload(expressPayload), '请填写快递单号')

assert(canCreateFactoryProfile('样衣审核通过待转正式'), 'canCreateFactoryProfile 只应在样衣审核通过待转正式时允许')
assert(!canCreateFactoryProfile('待工厂确认收样'), '待工厂确认收样不得创建工厂档案')
assert(!canFactoryEnterBusiness('待工厂确认收样'), '待工厂确认收样不得进入业务页')
assert(getFactoryOnboardingApplicationById(issued.application.applicationId)?.createdFactoryId === undefined, '发放后申请不得写入 createdFactoryId')

console.log('工厂入驻 Step3 样衣验证对象与平台发样衣检查通过')
