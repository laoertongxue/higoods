import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  canFactoryEnterBusiness,
  canCreateFactoryProfile,
} from '../src/data/fcs/factory-onboarding-domain.ts'
import {
  canFactoryResubmitSample,
  canReviewFactorySample,
  getLatestSampleReviewRecord,
  reviewFactorySample,
  submitFactorySampleReview,
  validateSampleReviewPayload,
} from '../src/data/fcs/factory-sample-verification-flow.ts'
import {
  getLockedFactoryNameReason,
  listFactoryOnboardingApplications,
} from '../src/data/fcs/factory-onboarding-store.ts'
import { listSampleVerifications } from '../src/data/fcs/factory-sample-verification-store.ts'
import {
  getFactoryOnboardingLoginFailureMessage,
} from '../src/data/fcs/factory-onboarding-flow.ts'
import type { FactorySampleReferenceFile } from '../src/data/fcs/factory-sample-verification-domain.ts'

const root = process.cwd()
const src = (path: string) => readFileSync(resolve(root, path), 'utf8')

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`工厂入驻 Step5 平台样衣审核检查失败：${message}`)
}

function assertIncludes(path: string, snippets: string[]): void {
  const content = src(path)
  for (const snippet of snippets) {
    assert(content.includes(snippet), `${path} 缺少 ${snippet}`)
  }
}

function assertNotIncludes(path: string, snippets: string[]): void {
  const content = src(path)
  for (const snippet of snippets) {
    assert(!content.includes(snippet), `${path} 不应包含 ${snippet}`)
  }
}

function expectError(fn: () => unknown, message: string): void {
  try {
    fn()
  } catch (error) {
    assert(error instanceof Error && error.message.includes(message), `错误提示应包含：${message}`)
    return
  }
  throw new Error(`工厂入驻 Step5 平台样衣审核检查失败：预期抛错 ${message}`)
}

function file(fileName: string, fileType: FactorySampleReferenceFile['fileType']): FactorySampleReferenceFile {
  return {
    fileId: `CHECK-${fileName}`,
    fileName,
    fileType,
    fileSizeMb: 3,
    uploadedAt: '2026-05-06 18:00:00',
  }
}

const domainPath = 'src/data/fcs/factory-sample-verification-domain.ts'
const flowPath = 'src/data/fcs/factory-sample-verification-flow.ts'
const platformPath = 'src/pages/factory-onboarding.ts'
const pdaPath = 'src/pages/pda-onboarding.ts'
const pdaRoutesPath = 'src/router/routes-pda.ts'
const appShellPath = 'src/data/app-shell-config.ts'

assertIncludes(flowPath, [
  'reviewFactorySample',
  'validateSampleReviewPayload',
  'getLatestSampleReviewRecord',
  'canReviewFactorySample',
  'canFactoryResubmitSample',
  '当前状态不能进行样衣审核',
])

assertIncludes(domainPath, [
  'FactorySampleReviewRecord',
  'sampleReviewId',
  'sampleReviewRoundNo',
  'sampleReviewResult',
  'sampleReviewOpinion',
  'resubmitAllowed',
  'requiredResubmitItems',
  'reviewer',
  'reviewedAt',
  'relatedSubmissionRoundNo',
])

assertIncludes(platformPath, [
  '样衣审核',
  '平台样衣审核',
  '工厂提交资料区',
  '样衣照片',
  '样衣视频',
  '工艺说明',
  '样衣审核结果',
  '样衣审核意见',
  '样衣审核记录',
  '审核轮次',
  '对应提交轮次',
])
assertIncludes(flowPath, ['请选择需重新提交内容'])

assertIncludes(pdaPath, [
  '上次样衣审核结果',
  '上次样衣审核意见',
  '需重新提交内容',
  '重新提交样衣审核',
])

assertNotIncludes(pdaRoutesPath, ["'/fcs/pda/login'", '"/fcs/pda/login"'])
assertNotIncludes(appShellPath, ["href: '/fcs/pda/login'"])
assertNotIncludes(platformPath, ['data-factory-onboarding-action="confirm-formal"', '生成工厂档案'])
assertNotIncludes(platformPath, ['PENDING', 'DONE', 'IN_PROGRESS'])
assertNotIncludes(pdaPath, ['PENDING', 'DONE', 'IN_PROGRESS'])

const applicationsBefore = listFactoryOnboardingApplications()
const samplesBefore = listSampleVerifications()

assert(applicationsBefore.filter((item) => item.status === '待平台审核样衣').length >= 3, 'mock 数据缺少待平台审核样衣')
assert(applicationsBefore.filter((item) => item.status === '样衣审核退回').length >= 3, 'mock 数据缺少样衣审核退回')
assert(applicationsBefore.filter((item) => item.status === '样衣审核拒绝').length >= 3, 'mock 数据缺少样衣审核拒绝')
assert(applicationsBefore.filter((item) => item.status === '样衣审核通过待转正式').length >= 3, 'mock 数据缺少样衣审核通过待转正式')
assert(samplesBefore.filter((item) => item.status === '待平台审核样衣').every((item) => item.factorySamplePhotos.length >= 2 && item.factorySampleVideos.length >= 1 && Boolean(item.factoryCraftDescription)), '待平台审核样衣必须有工厂提交资料')
assert(samplesBefore.filter((item) => item.status === '样衣审核退回').every((item) => item.sampleReviewRecords.at(-1)?.sampleReviewResult === '未通过' && (item.sampleReviewRecords.at(-1)?.requiredResubmitItems.length || 0) > 0), '样衣审核退回数据必须包含未通过记录')
assert(samplesBefore.filter((item) => item.status === '样衣审核拒绝').every((item) => item.sampleReviewRecords.at(-1)?.sampleReviewResult === '未通过'), '历史样衣审核拒绝数据必须包含未通过记录')
assert(applicationsBefore.filter((item) => item.status === '样衣审核拒绝').every((item) => !item.accountLocked && !item.factoryNameLocked), '历史样衣审核拒绝 mock 数据不应因状态自动锁定')
assert(samplesBefore.filter((item) => item.status === '样衣审核通过').every((item) => item.sampleReviewRecords.at(-1)?.sampleReviewResult === '已通过'), '样衣审核通过数据必须包含已通过记录')
assert(samplesBefore.filter((item) => item.factorySubmissionRoundNo >= 2 && item.sampleReviewRecords.some((record) => record.sampleReviewRoundNo >= 2)).length >= 3, 'mock 数据缺少多轮提交和多轮审核')

for (const status of ['草稿', '待平台审核', '平台审核退回', '平台审核拒绝', '待样衣验证', '待工厂确认收样', '待工厂提交样衣审核', '待平台审核样衣', '样衣审核退回', '样衣审核拒绝', '样衣审核通过待转正式'] as const) {
  assert(!canFactoryEnterBusiness(status), `${status} 不允许进入业务页`)
}
assert(canFactoryEnterBusiness('已转正式合作'), '只有已转正式合作可以进入业务页')
assert(canCreateFactoryProfile('样衣审核通过待转正式'), '样衣审核通过待转正式是唯一可创建工厂档案的预留状态')

const reviewSamples = samplesBefore.filter((item) => item.status === '待平台审核样衣')
assert(reviewSamples.length >= 3, '运行时流转需要 3 条待平台审核样衣数据')

expectError(() => validateSampleReviewPayload({
  sampleReviewResult: '',
  sampleReviewOpinion: '',
  resubmitAllowed: false,
  requiredResubmitItems: [],
  bossIdentityFiles: [],
}), '请选择样衣审核结果')
expectError(() => validateSampleReviewPayload({
  sampleReviewResult: '未通过',
  sampleReviewOpinion: '需要补充',
  resubmitAllowed: true,
  requiredResubmitItems: [],
  bossIdentityFiles: [],
}), '请选择需重新提交内容')
expectError(() => reviewFactorySample(samplesBefore.find((item) => item.status !== '待平台审核样衣')!.verificationId, {
  sampleReviewResult: '已通过',
  sampleReviewOpinion: '非待审核状态测试',
  resubmitAllowed: false,
  requiredResubmitItems: [],
  bossIdentityFiles: [],
}, '检查脚本'), '当前状态不能进行样衣审核')

assert(canReviewFactorySample(reviewSamples[0]), '待平台审核样衣应允许平台样衣审核')

const passed = reviewFactorySample(reviewSamples[0].verificationId, {
  sampleReviewResult: '已通过',
  sampleReviewOpinion: '样衣质量和工艺表现符合要求。',
  resubmitAllowed: false,
  requiredResubmitItems: [],
  sampleQualityConclusion: '达标',
  capacityConclusion: '具备合作能力',
  bossIdentityNo: 'BOSS-CHECK-STEP5',
  bossIdentityFiles: [file('老板身份证.pdf', 'pdf')],
}, '检查脚本')
assert(passed.sampleVerification.status === '样衣审核通过', '审核通过后 verification.status 应为样衣审核通过')
assert(passed.application.status === '样衣审核通过待转正式', '审核通过后 application.status 应为样衣审核通过待转正式')
assert(passed.application.currentNode === '正式合作', '审核通过后 application.currentNode 应为正式合作')
assert(!passed.application.createdFactoryId, '审核通过后不得生成工厂档案')
assert(passed.application.adminAccount.accountStatus !== '已转正式', '审核通过后不得转正式管理员账号')
assert(!canFactoryEnterBusiness(passed.application.status), '审核通过待转正式不得进入业务页')
assert(getLatestSampleReviewRecord(passed.sampleVerification.verificationId)?.sampleReviewResult === '已通过', '应能读取最新通过审核记录')

const returned = reviewFactorySample(reviewSamples[1].verificationId, {
  sampleReviewResult: '未通过',
  sampleReviewOpinion: '样衣照片和视频需要补充关键细节。',
  resubmitAllowed: true,
  requiredResubmitItems: ['样衣照片', '样衣视频'],
  sampleQualityConclusion: '基本达标',
  capacityConclusion: '需补充验证',
  bossIdentityFiles: [],
}, '检查脚本')
assert(returned.sampleVerification.status === '样衣审核退回', '审核退回后 verification.status 应为样衣审核退回')
assert(returned.application.status === '样衣审核退回', '审核退回后 application.status 应为样衣审核退回')
assert(canFactoryResubmitSample(returned.sampleVerification), '样衣审核退回后工厂端应可重新提交')
const previousRoundNo = returned.sampleVerification.factorySubmissionRoundNo
const resubmitted = submitFactorySampleReview(returned.sampleVerification.verificationId, {
  factorySamplePhotos: [file('重新提交样衣照片-1.jpg', 'jpg'), file('重新提交样衣照片-2.jpg', 'jpg')],
  factorySampleVideos: [file('重新提交样衣视频.mp4', 'mp4')],
  factoryCraftDescription: '根据退回意见补充关键工艺细节并重新提交。',
  factoryProblemDescription: '已补充袖口和下摆视频角度。',
  factorySubmitRemark: '重新提交样衣审核。',
  factorySubmissionFiles: [file('重新提交补充说明.pdf', 'pdf')],
  factorySitePhotos: [file('重新提交工厂照片.jpg', 'jpg')],
  factorySiteVideos: [file('重新提交工厂视频.mp4', 'mp4')],
  bossIdentityNo: '',
  bossIdentityFiles: [],
}, '检查脚本工厂管理员')
assert(resubmitted.sampleVerification.status === '待平台审核样衣', '重新提交后 verification.status 应回到待平台审核样衣')
assert(resubmitted.application.status === '待平台审核样衣', '重新提交后 application.status 应回到待平台审核样衣')
assert(resubmitted.sampleVerification.factorySubmissionRoundNo === previousRoundNo + 1, '重新提交后 factorySubmissionRoundNo 应加 1')

const returnedAgain = reviewFactorySample(reviewSamples[2].verificationId, {
  sampleReviewResult: '未通过',
  sampleReviewOpinion: '样衣质量稳定性仍需补充验证。',
  resubmitAllowed: true,
  requiredResubmitItems: ['工艺说明'],
  sampleQualityConclusion: '不达标',
  capacityConclusion: '不具备合作能力',
  bossIdentityFiles: [],
}, '检查脚本')
assert(returnedAgain.sampleVerification.status === '样衣审核退回', '样衣审核未通过应统一退回')
assert(returnedAgain.application.status === '样衣审核退回', '样衣审核未通过后 application.status 应为样衣审核退回')
assert(!returnedAgain.application.accountLocked, '样衣审核未通过后账号不得锁定')
assert(!returnedAgain.application.factoryNameLocked, '样衣审核未通过后工厂名称不得锁定')

console.log('工厂入驻 Step5 平台样衣审核闭环检查通过')
