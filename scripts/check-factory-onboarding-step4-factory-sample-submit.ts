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
  confirmFactoryReceivedSample,
  getFactorySampleVerificationForOnboarding,
  submitFactorySampleReview,
  validateFactorySampleSubmission,
} from '../src/data/fcs/factory-sample-verification-flow.ts'
import {
  getSampleVerificationByApplicationId,
  listSampleVerifications,
} from '../src/data/fcs/factory-sample-verification-store.ts'
import type { FactorySampleReferenceFile, FactorySampleSubmissionPayload } from '../src/data/fcs/factory-sample-verification-domain.ts'

const root = process.cwd()

function read(path: string): string {
  return readFileSync(join(root, path), 'utf8')
}

function assert(condition: unknown, message: string): void {
  if (!condition) throw new Error(`工厂入驻 Step4 工厂样衣提交检查失败：${message}`)
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

function file(fileName: string, fileType: FactorySampleReferenceFile['fileType']): FactorySampleReferenceFile {
  return {
    fileId: `STEP4-${fileName}`,
    fileName,
    fileType,
    fileSizeMb: 2,
    uploadedAt: '2026-05-06 12:00:00',
  }
}

const sampleDomainPath = 'src/data/fcs/factory-sample-verification-domain.ts'
const sampleStorePath = 'src/data/fcs/factory-sample-verification-store.ts'
const sampleFlowPath = 'src/data/fcs/factory-sample-verification-flow.ts'
const onboardingFlowPath = 'src/data/fcs/factory-onboarding-flow.ts'
const onboardingStorePath = 'src/data/fcs/factory-onboarding-store.ts'
const platformPath = 'src/pages/factory-onboarding.ts'
const pdaOnboardingPath = 'src/pages/pda-onboarding.ts'
const pdaRuntimePath = 'src/pages/pda-runtime.ts'
const pdaRoutesPath = 'src/router/routes-pda.ts'
const appShellPath = 'src/data/app-shell-config.ts'

for (const path of [sampleDomainPath, sampleStorePath, sampleFlowPath, onboardingFlowPath, onboardingStorePath, platformPath, pdaOnboardingPath, pdaRuntimePath]) {
  assert(existsSync(join(root, path)), `缺少文件 ${path}`)
}

assertIncludes(sampleFlowPath, [
  'confirmFactoryReceivedSample',
  'submitFactorySampleReview',
  'validateFactorySampleSubmission',
  'getFactorySampleVerificationForOnboarding',
  '当前状态不能确认收到样衣。',
  '当前状态不能提交样衣审核资料。',
])
assertIncludes(sampleDomainPath, [
  'factoryReceivedAt',
  'factoryReceivedBy',
  'factoryReceiveRemark',
  'receiveActionCount',
  'factorySubmittedAt',
  'factorySubmittedBy',
  'factorySamplePhotos',
  'factorySampleVideos',
  'factoryCraftDescription',
  'factoryProblemDescription',
  'factorySubmitRemark',
  'factorySubmissionRoundNo',
  'factorySubmissionFiles',
  'submissionActionCount',
])
assertIncludes(pdaOnboardingPath, [
  '确认收到样衣',
  '确认收样时间',
  '确认收样人',
  '收样备注',
  '提交样衣审核资料',
  '上传样衣照片',
  '上传样衣视频',
  '工艺说明',
  '问题说明',
  '待平台审核样衣',
])
assertIncludes(platformPath, [
  '工厂已确认收样',
  '确认收样时间',
  '确认收样人',
  '工厂已提交样衣审核资料',
  '样衣照片',
  '样衣视频',
  '工艺说明',
])
assertNotIncludes(platformPath, ['生成工厂档案'])
assertNotIncludes(pdaRoutesPath, ["'/fcs/pda/login'", '"/fcs/pda/login"'])
assertNotIncludes(appShellPath, ["href: '/fcs/pda/login'"])
assertNotIncludes(platformPath, ['PENDING', 'DONE', 'IN_PROGRESS'])
assertNotIncludes(pdaOnboardingPath, ['PENDING', 'DONE', 'IN_PROGRESS'])

const applications = listFactoryOnboardingApplications()
const samples = listSampleVerifications()

for (const status of ['待工厂确认收样', '待工厂提交样衣审核', '待平台审核样衣', '样衣审核退回', '样衣审核拒绝', '样衣审核通过待转正式'] as const) {
  assert(applications.filter((item) => item.status === status).length >= 3, `${status} mock 数据不足 3 条`)
}
assert(samples.filter((item) => item.status === '待工厂确认收样').length >= 3, '待工厂确认收样样衣对象不足 3 条')
assert(samples.filter((item) => item.status === '待工厂提交样衣审核').length >= 3, '待工厂提交样衣审核样衣对象不足 3 条')
assert(samples.filter((item) => item.status === '待平台审核样衣').length >= 3, '待平台审核样衣样衣对象不足 3 条')
assert(samples.filter((item) => item.status === '样衣审核退回').length >= 3, '样衣审核退回样衣对象不足 3 条')
assert(samples.filter((item) => item.status === '样衣审核拒绝').length >= 3, '样衣审核拒绝样衣对象不足 3 条')
assert(samples.filter((item) => item.status === '样衣审核通过').length >= 3, '样衣审核通过样衣对象不足 3 条')

for (const sample of samples.filter((item) => item.status === '待平台审核样衣')) {
  assert(sample.factorySamplePhotos.length >= 2, `${sample.verificationNo} 至少需要 2 张样衣照片`)
  assert(sample.factorySampleVideos.length >= 1, `${sample.verificationNo} 至少需要 1 个样衣视频`)
  assert(Boolean(sample.factoryCraftDescription), `${sample.verificationNo} 缺少工艺说明`)
  assert(Boolean(sample.factorySubmittedAt), `${sample.verificationNo} 缺少提交时间`)
  assert(Boolean(sample.factorySubmittedBy), `${sample.verificationNo} 缺少提交人`)
}
assert(samples.filter((item) => item.status === '样衣审核退回').every((item) => item.sampleReviewRecords.at(-1)?.sampleReviewOpinion), '样衣审核退回数据必须有退回原因')
assert(applications.filter((item) => item.status === '样衣审核拒绝').every((item) => !item.accountLocked), '历史样衣审核拒绝申请不应因状态自动锁定账号')
assert(applications.filter((item) => item.status === '样衣审核通过待转正式').every((item) => !item.createdFactoryId), '样衣审核通过待转正式不得提前生成档案')

const receiveSample = samples.find((item) => item.status === '待工厂确认收样')
assert(receiveSample, '缺少待工厂确认收样样衣对象')
expectError(() => submitFactorySampleReview(receiveSample!.verificationId, {
  factorySamplePhotos: [file('未确认照片.jpg', 'jpg')],
  factorySampleVideos: [file('未确认视频.mp4', 'mp4')],
  factoryCraftDescription: '未确认收样直接提交测试',
  factorySubmissionFiles: [],
  factorySitePhotos: [file('未确认工厂照片.jpg', 'jpg')],
  factorySiteVideos: [file('未确认工厂视频.mp4', 'mp4')],
  bossIdentityFiles: [],
}, '检查脚本'), '当前状态不能提交样衣审核资料。')

const confirmed = confirmFactoryReceivedSample(receiveSample!.verificationId, {
  factoryReceivedAt: '2026-05-06 13:00:00',
  factoryReceivedBy: '检查脚本工厂管理员',
  factoryReceiveRemark: '已收到样衣。',
}, '检查脚本工厂管理员')
assert(confirmed.sampleVerification.status === '待工厂提交样衣审核', '确认收样后 verification.status 错误')
assert(confirmed.application.status === '待工厂提交样衣审核', '确认收样后 application.status 错误')
assert(confirmed.sampleVerification.actionLogs.at(-1)?.actionName === '工厂确认收到样衣', '确认收样未写入样衣 actionLogs')
assert(confirmed.application.actionLogs.at(-1)?.actionName === '工厂确认收到样衣', '确认收样未写入入驻 actionLogs')
assert(confirmed.sampleVerification.nodeLogs.some((item) => item.nodeName === '工厂提交样衣审核' && item.nodeStatus === '进行中'), '确认收样未更新样衣 nodeLogs')
assert(confirmed.application.nodeLogs.some((item) => item.nodeName === '样衣验证' && item.nodeStatus === '进行中'), '确认收样未更新入驻 nodeLogs')

const invalidSubmission: FactorySampleSubmissionPayload = {
  factorySamplePhotos: [],
  factorySampleVideos: [],
  factoryCraftDescription: '',
  factorySubmissionFiles: [],
  factorySitePhotos: [],
  factorySiteVideos: [],
  bossIdentityFiles: [],
}
expectError(() => validateFactorySampleSubmission(invalidSubmission), '请上传样衣照片')
expectError(() => validateFactorySampleSubmission({ ...invalidSubmission, factorySamplePhotos: [file('照片.jpg', 'jpg')] }), '请上传样衣视频')
expectError(() => validateFactorySampleSubmission({ ...invalidSubmission, factorySamplePhotos: [file('照片.jpg', 'jpg')], factorySampleVideos: [file('视频.mp4', 'mp4')] }), '请填写工艺说明')
expectError(() => validateFactorySampleSubmission({
  factorySamplePhotos: [file('错误.pdf', 'pdf')],
  factorySampleVideos: [file('视频.mp4', 'mp4')],
  factoryCraftDescription: '工艺说明',
  factorySubmissionFiles: [],
  factorySitePhotos: [file('工厂照片.jpg', 'jpg')],
  factorySiteVideos: [file('工厂视频.mp4', 'mp4')],
  bossIdentityFiles: [],
}), '文件格式不支持，请重新上传')

const submitted = submitFactorySampleReview(confirmed.sampleVerification.verificationId, {
  factorySamplePhotos: [file('样衣正面.jpg', 'jpg'), file('样衣细节.png', 'png')],
  factorySampleVideos: [file('样衣过程.mp4', 'mp4')],
  factoryCraftDescription: '按平台参考资料完成样衣制作并完成自检。',
  factoryProblemDescription: '暂无明显问题。',
  factorySubmitRemark: '请平台审核。',
  factorySubmissionFiles: [file('补充说明.pdf', 'pdf')],
  factorySitePhotos: [file('工厂现场.jpg', 'jpg')],
  factorySiteVideos: [file('工厂现场.mp4', 'mp4')],
  bossIdentityNo: '',
  bossIdentityFiles: [],
}, '检查脚本工厂管理员')
assert(submitted.sampleVerification.status === '待平台审核样衣', '提交后 verification.status 错误')
assert(submitted.application.status === '待平台审核样衣', '提交后 application.status 错误')
assert(submitted.application.currentNode === '样衣审核', '提交后 application.currentNode 错误')
assert(submitted.sampleVerification.actionLogs.at(-1)?.actionName === '工厂提交样衣审核', '提交后未写入样衣 actionLogs')
assert(submitted.application.actionLogs.at(-1)?.actionName === '工厂提交样衣审核', '提交后未写入入驻 actionLogs')
assert(submitted.sampleVerification.nodeLogs.some((item) => item.nodeName === '平台审核样衣' && item.nodeStatus === '进行中'), '提交后未更新样衣 nodeLogs')
assert(submitted.application.nodeLogs.some((item) => item.nodeName === '样衣审核' && item.nodeStatus === '进行中'), '提交后未更新入驻 nodeLogs')
expectError(() => submitFactorySampleReview(submitted.sampleVerification.verificationId, {
  factorySamplePhotos: [file('重复.jpg', 'jpg')],
  factorySampleVideos: [file('重复.mp4', 'mp4')],
  factoryCraftDescription: '重复提交',
  factorySubmissionFiles: [],
  factorySitePhotos: [file('重复工厂照片.jpg', 'jpg')],
  factorySiteVideos: [file('重复工厂视频.mp4', 'mp4')],
  bossIdentityFiles: [],
}, '检查脚本'), '当前状态不能提交样衣审核资料。')

assert(getFactorySampleVerificationForOnboarding(submitted.application.applicationId)?.verificationId === submitted.sampleVerification.verificationId, '按入驻申请获取样衣验证对象失败')
assert(getSampleVerificationByApplicationId(submitted.application.applicationId)?.verificationId === submitted.sampleVerification.verificationId, '样衣对象关联错误')
assert(!submitted.application.createdFactoryId, '提交样衣审核后不得生成工厂档案')
assert(submitted.application.adminAccount.accountStatus !== '已转正式', '提交样衣审核后不得转正式管理员账号')
assert(!listFactoryMasterRecords().some((factory) => factory.id === submitted.application.createdFactoryId), '提交样衣审核后不得写入工厂档案')
assert(!canFactoryEnterBusiness(submitted.application.status), '待平台审核样衣不得进入业务页')
assert(canCreateFactoryProfile('样衣审核通过待转正式'), 'canCreateFactoryProfile 规则丢失')

for (const status of ['待工厂确认收样', '待工厂提交样衣审核', '待平台审核样衣', '样衣审核退回', '样衣审核拒绝', '样衣审核通过待转正式'] as const) {
  assert(!canFactoryEnterBusiness(status), `${status} 不得进入业务页`)
}
assert(canFactoryEnterBusiness('已转正式合作'), '只有已转正式合作可进入业务页')

assert(getFactoryOnboardingApplicationById(submitted.application.applicationId)?.status === '待平台审核样衣', '入驻申请保存失败')
assert(read('src/main-handlers/pda-handlers.ts').includes('handlePdaOnboardingEvent'), '工厂端菜单事件处理缺失')
assert(read('src/main-handlers/fcs-handlers.ts').includes('handleFactoryOnboardingEvent'), '平台菜单事件处理缺失')

console.log('工厂入驻 Step4 工厂样衣确认与提交检查通过')
