import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import {
  canFactoryEnterBusiness,
  canFactorySubmitOnboarding,
  normalizeReviewResult,
} from '../src/data/fcs/factory-onboarding-domain.ts'
import {
  reviewFactoryOnboardingApplication,
} from '../src/data/fcs/factory-onboarding-flow.ts'
import {
  listFactoryOnboardingApplications,
} from '../src/data/fcs/factory-onboarding-store.ts'
import {
  normalizeSampleReviewResult,
} from '../src/data/fcs/factory-sample-verification-domain.ts'
import {
  canFactoryResubmitSample,
  reviewFactorySample,
} from '../src/data/fcs/factory-sample-verification-flow.ts'
import {
  listSampleVerifications,
} from '../src/data/fcs/factory-sample-verification-store.ts'

const root = process.cwd()

function read(path: string): string {
  return readFileSync(join(root, path), 'utf8')
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`工厂入驻 Step9 审核结果收口检查失败：${message}`)
}

function assertIncludes(path: string, snippets: string[]): void {
  const content = read(path)
  for (const snippet of snippets) assert(content.includes(snippet), `${path} 缺少 ${snippet}`)
}

function assertNotIncludes(path: string, snippets: string[]): void {
  const content = read(path)
  for (const snippet of snippets) assert(!content.includes(snippet), `${path} 不应包含 ${snippet}`)
}

const onboardingDomainPath = 'src/data/fcs/factory-onboarding-domain.ts'
const onboardingFlowPath = 'src/data/fcs/factory-onboarding-flow.ts'
const sampleDomainPath = 'src/data/fcs/factory-sample-verification-domain.ts'
const sampleFlowPath = 'src/data/fcs/factory-sample-verification-flow.ts'
const platformPath = 'src/pages/factory-onboarding.ts'
const pdaOnboardingPath = 'src/pages/pda-onboarding.ts'
const routesPdaPath = 'src/router/routes-pda.ts'

for (const path of [onboardingDomainPath, onboardingFlowPath, sampleDomainPath, sampleFlowPath, platformPath, pdaOnboardingPath]) {
  assert(existsSync(join(root, path)), `缺少文件 ${path}`)
}

assertIncludes(onboardingDomainPath, ['FACTORY_ONBOARDING_REVIEW_RESULTS', '已通过', '未通过', 'normalizeReviewResult', 'canFactoryResubmitAfterReviewFailed'])
assertIncludes(sampleDomainPath, ['FACTORY_SAMPLE_REVIEW_RESULT_OPTIONS', '已通过', '未通过', 'normalizeSampleReviewResult', '工厂照片', '工厂视频'])
assertIncludes(sampleFlowPath, ['reviewFactorySample', '样衣审核未通过', 'sampleReviewResult'])
assertIncludes(onboardingFlowPath, ['平台初审已通过', '平台初审未通过', 'toStatus = \'平台审核退回\'', 'toStatus = \'待样衣验证\''])
assertIncludes(platformPath, ['已通过', '未通过', '需补充字段', '需重新提交内容', 'factory-onboarding-review-dialog', 'factory-sample-review-dialog'])
assertIncludes(pdaOnboardingPath, ['审核结果：', '样衣审核结果：', '重新提交入驻申请', '重新提交样衣审核'])

const oldVisibleReviewPhrases = [
  '不通过且允许再次申请',
  '不通过且不允许再次申请',
  '不通过且允许再次提交',
  '不通过且不允许再次提交',
  '是否允许再次申请',
  '是否允许再次提交',
]
assertNotIncludes(platformPath, oldVisibleReviewPhrases)
assertNotIncludes(pdaOnboardingPath, oldVisibleReviewPhrases)
assertNotIncludes(onboardingFlowPath, ['toStatus = \'平台审核拒绝\'', 'accountLocked: locked ? true'])
assertNotIncludes(sampleFlowPath, ['toStatus = \'样衣审核拒绝\'', 'accountLocked: isRejected ? true'])
assertNotIncludes(routesPdaPath, ['/fcs/pda/login'])

assert(normalizeReviewResult('通过') === '已通过', '旧平台审核通过应归一为已通过')
assert(normalizeReviewResult('不通过且允许再次申请') === '未通过', '旧平台退回应归一为未通过')
assert(normalizeReviewResult('不通过且不允许再次申请') === '未通过', '旧平台拒绝应归一为未通过')
assert(normalizeSampleReviewResult('通过') === '已通过', '旧样衣审核通过应归一为已通过')
assert(normalizeSampleReviewResult('不通过且允许再次提交') === '未通过', '旧样衣退回应归一为未通过')
assert(normalizeSampleReviewResult('不通过且不允许再次提交') === '未通过', '旧样衣拒绝应归一为未通过')

const waitingApplications = listFactoryOnboardingApplications().filter((item) => item.status === '待平台审核')
assert(waitingApplications.length >= 2, '缺少待平台审核申请用于验证已通过/未通过')

const approved = reviewFactoryOnboardingApplication({
  applicationId: waitingApplications[0].applicationId,
  reviewResult: '已通过',
  reviewOpinion: '资料完整，进入样衣验证。',
  reviewer: 'Step9检查员',
})
assert(approved.status === '待样衣验证', '平台初审已通过应进入待样衣验证')
assert(approved.currentNode === '样衣验证', '平台初审已通过 currentNode 应为样衣验证')
assert(approved.reviewRecords.at(-1)?.reviewResult === '已通过', '平台初审已通过应写入已通过')
assert(approved.actionLogs.some((item) => item.actionName === '平台初审已通过'), '平台初审已通过应写入 actionLogs')
assert(!approved.createdFactoryId, '平台初审已通过不得生成工厂档案')
assert(!canFactoryEnterBusiness(approved.status), '平台初审已通过不得开放业务页')

const returned = reviewFactoryOnboardingApplication({
  applicationId: waitingApplications[1].applicationId,
  reviewResult: '未通过',
  reviewOpinion: '资料需补充后重新提交。',
  reviewer: 'Step9检查员',
  requiredFields: ['姓名', '工厂简称'],
})
assert(returned.status === '平台审核退回', '平台初审未通过应进入平台审核退回')
assert(returned.currentNode === '填写入驻申请', '平台初审未通过 currentNode 应为填写入驻申请')
assert(returned.reviewRecords.at(-1)?.reviewResult === '未通过', '平台初审未通过应写入未通过')
assert(returned.supplementRecords.at(-1)?.status === '待补充', '平台初审未通过应写入补充记录')
assert(returned.accountLocked === false, '平台初审未通过不得锁定账号')
assert(canFactorySubmitOnboarding(returned.status), '平台初审未通过应允许重新提交入驻申请')

const sampleWaiting = listSampleVerifications().filter((item) => item.status === '待平台审核样衣')
assert(sampleWaiting.length >= 2, '缺少待平台审核样衣记录用于验证已通过/未通过')

const sampleReturned = reviewFactorySample(sampleWaiting[0].verificationId, {
  sampleReviewResult: '未通过',
  sampleReviewOpinion: '照片角度不足，请补充后重新提交。',
  resubmitAllowed: true,
  requiredResubmitItems: ['样衣照片', '样衣视频'],
  sampleQualityConclusion: '基本达标',
  capacityConclusion: '需补充验证',
  bossIdentityFiles: [],
  remark: '',
}, 'Step9样衣审核员')
assert(sampleReturned.sampleVerification.status === '样衣审核退回', '样衣审核未通过应进入样衣审核退回')
assert(sampleReturned.application.status === '样衣审核退回', '样衣审核未通过应同步入驻状态为样衣审核退回')
assert(sampleReturned.sampleReviewRecord.sampleReviewResult === '未通过', '样衣审核未通过应写入未通过')
assert(sampleReturned.application.accountLocked === false, '样衣审核未通过不得锁定账号')
assert(canFactoryResubmitSample(sampleReturned.sampleVerification), '样衣审核未通过应允许重新提交样衣审核')

const sampleApproved = reviewFactorySample(sampleWaiting[1].verificationId, {
  sampleReviewResult: '已通过',
  sampleReviewOpinion: '样衣资料和工艺说明符合要求。',
  resubmitAllowed: false,
  requiredResubmitItems: [],
  sampleQualityConclusion: '达标',
  capacityConclusion: '具备合作能力',
  bossIdentityNo: 'BOSS-STEP9-PASS',
  bossIdentityFiles: [{
    fileId: 'BOSS-STEP9-FILE',
    fileName: '老板身份证.pdf',
    fileType: 'pdf',
    fileSizeMb: 2,
    uploadedAt: '2026-05-06 12:00:00',
  }],
  remark: '',
}, 'Step9样衣审核员')
assert(sampleApproved.sampleVerification.status === '样衣审核通过', '样衣审核已通过应进入样衣审核通过')
assert(sampleApproved.application.status === '样衣审核通过待转正式', '样衣审核已通过应进入样衣审核通过待转正式')
assert(!sampleApproved.application.createdFactoryId, '样衣审核已通过不得自动生成工厂档案')
assert(!canFactoryEnterBusiness(sampleApproved.application.status), '样衣审核已通过待转正式不得开放业务页')

const records = listFactoryOnboardingApplications().flatMap((item) => item.reviewRecords)
assert(records.some((item) => item.reviewResult === '已通过'), 'mock 或流转缺少平台初审已通过记录')
assert(records.some((item) => item.reviewResult === '未通过'), 'mock 或流转缺少平台初审未通过记录')
const sampleRecords = listSampleVerifications().flatMap((item) => item.sampleReviewRecords)
assert(sampleRecords.some((item) => item.sampleReviewResult === '已通过'), 'mock 或流转缺少样衣审核已通过记录')
assert(sampleRecords.some((item) => item.sampleReviewResult === '未通过'), 'mock 或流转缺少样衣审核未通过记录')

console.log('factory onboarding step9 review-result-simplify checks passed')
