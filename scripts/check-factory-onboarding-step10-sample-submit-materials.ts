import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import type { FactorySampleReferenceFile, FactorySampleSubmissionPayload } from '../src/data/fcs/factory-sample-verification-domain.ts'
import {
  reviewFactorySample,
  submitFactorySampleReview,
  validateFactorySampleSubmission,
  validateSampleReviewPayload,
} from '../src/data/fcs/factory-sample-verification-flow.ts'
import {
  getSampleVerificationById,
  listSampleVerifications,
} from '../src/data/fcs/factory-sample-verification-store.ts'

const SCRIPT_NAME = 'check-factory-onboarding-step10-sample-submit-materials'
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

function read(path: string): string {
  return readFileSync(resolve(root, path), 'utf8')
}

function assertIncludes(path: string, snippets: string[]): void {
  const content = read(path)
  for (const snippet of snippets) assert(content.includes(snippet), `${path} 缺少 ${snippet}`)
}

function assertNotIncludes(path: string, snippets: string[]): void {
  const content = read(path)
  for (const snippet of snippets) assert(!content.includes(snippet), `${path} 不应包含 ${snippet}`)
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
    fileId: `STEP10-${fileName}`,
    fileName,
    fileType,
    fileSizeMb: fileType === 'mp4' ? 18 : 2,
    uploadedAt: '2026-05-07 10:00:00',
  }
}

const sampleDomainPath = 'src/data/fcs/factory-sample-verification-domain.ts'
const sampleFlowPath = 'src/data/fcs/factory-sample-verification-flow.ts'
const sampleStorePath = 'src/data/fcs/factory-sample-verification-store.ts'
const pdaOnboardingPath = 'src/pages/pda-onboarding.ts'
const platformPath = 'src/pages/factory-onboarding.ts'

assertIncludes(sampleDomainPath, [
  'factorySitePhotos',
  'factorySiteVideos',
  'bossIdentityNo',
  'bossIdentityFiles',
  'bossIdentitySource',
  'bossIdentityCompletedAt',
  'bossIdentityCompletedBy',
  'bossIdentityNoAtReview',
  'bossIdentityFilesAtReview',
])
assertIncludes(sampleFlowPath, [
  '请上传工厂照片',
  '请上传工厂视频',
  '请填写老板身份证号码/护照号码',
  '请上传老板身份证复印件或照片',
])
assertIncludes(sampleStorePath, ['factorySitePhotos', 'factorySiteVideos', 'bossIdentitySource'])
assertIncludes(pdaOnboardingPath, [
  '上传工厂照片',
  '上传工厂视频',
  '老板身份证号码/护照号码',
  '老板身份证复印件或照片',
])
assertIncludes(platformPath, [
  '工厂照片',
  '工厂视频',
  '老板身份证号码/护照号码',
  '老板身份证复印件或照片',
  '老板身份资料',
])

const validBase: FactorySampleSubmissionPayload = {
  factorySamplePhotos: [file('样衣照片.jpg', 'jpg')],
  factorySampleVideos: [file('样衣视频.mp4', 'mp4')],
  factoryCraftDescription: '工艺说明完整。',
  factoryProblemDescription: '',
  factorySubmitRemark: '',
  factorySubmissionFiles: [],
  factorySitePhotos: [file('工厂照片.jpg', 'jpg')],
  factorySiteVideos: [file('工厂视频.mp4', 'mp4')],
  bossIdentityNo: '',
  bossIdentityFiles: [],
}
expectError(() => validateFactorySampleSubmission({ ...validBase, factorySitePhotos: [] }), '请上传工厂照片')
expectError(() => validateFactorySampleSubmission({ ...validBase, factorySiteVideos: [] }), '请上传工厂视频')
validateFactorySampleSubmission(validBase)

const waitingSubmit = listSampleVerifications().find((item) => item.status === '待工厂提交样衣审核')
assert(waitingSubmit, '缺少待工厂提交样衣审核样本')
const submitted = submitFactorySampleReview(waitingSubmit.verificationId, validBase, 'Step10工厂管理员')
assert(submitted.sampleVerification.status === '待平台审核样衣', '工厂端缺省老板身份资料也应能提交样衣审核')
assert(submitted.sampleVerification.factorySitePhotos.length > 0, '提交后缺少工厂照片')
assert(submitted.sampleVerification.factorySiteVideos.length > 0, '提交后缺少工厂视频')
assert(!submitted.sampleVerification.bossIdentityNo && submitted.sampleVerification.bossIdentityFiles.length === 0, '老板身份资料在工厂端应保持可选')

expectError(() => validateSampleReviewPayload({
  sampleReviewResult: '已通过',
  sampleReviewOpinion: '通过校验',
  resubmitAllowed: false,
  requiredResubmitItems: [],
  bossIdentityFiles: [],
}), '请填写老板身份证号码/护照号码')
expectError(() => validateSampleReviewPayload({
  sampleReviewResult: '已通过',
  sampleReviewOpinion: '通过校验',
  resubmitAllowed: false,
  requiredResubmitItems: [],
  bossIdentityNo: 'BOSS-ONLY-NO',
  bossIdentityFiles: [],
}), '请上传老板身份证复印件或照片')
validateSampleReviewPayload({
  sampleReviewResult: '未通过',
  sampleReviewOpinion: '退回补充',
  resubmitAllowed: true,
  requiredResubmitItems: ['工厂照片'],
  bossIdentityFiles: [],
})

const waitingReview = listSampleVerifications().find((item) => item.status === '待平台审核样衣' && !item.bossIdentityNo && item.bossIdentityFiles.length > 0)
assert(waitingReview, '缺少工厂只上传身份证附件、需平台补录号码的待审核样本')
const reviewed = reviewFactorySample(waitingReview.verificationId, {
  sampleReviewResult: '已通过',
  sampleReviewOpinion: '老板身份资料已补齐，样衣审核通过。',
  resubmitAllowed: false,
  requiredResubmitItems: [],
  bossIdentityNo: 'BOSS-PLATFORM-SUPPLEMENT',
  bossIdentityFiles: [],
  sampleQualityConclusion: '达标',
  capacityConclusion: '具备合作能力',
}, 'Step10平台审核员')
assert(reviewed.sampleVerification.status === '样衣审核通过', '补录身份资料后应允许样衣审核已通过')
assert(reviewed.sampleVerification.bossIdentityNo === 'BOSS-PLATFORM-SUPPLEMENT', '平台补录身份证号码未写入')
assert(reviewed.sampleVerification.bossIdentityFiles.length > 0, '平台审核记录应保留工厂已提交身份证附件')
assert(reviewed.sampleVerification.bossIdentitySource === '工厂提交和平台补录', '平台补录后身份资料来源不正确')
assert(Boolean(reviewed.sampleVerification.bossIdentityCompletedAt), '身份资料补齐时间未写入')
assert(reviewed.sampleReviewRecord.bossIdentityNoAtReview === 'BOSS-PLATFORM-SUPPLEMENT', '审核记录未记录老板身份证号码')

const emptyIdentityReturned = getSampleVerificationById(submitted.sampleVerification.verificationId)
assert(emptyIdentityReturned?.status === '待平台审核样衣', '缺少未上传身份资料的待审核样本')
const returned = reviewFactorySample(emptyIdentityReturned.verificationId, {
  sampleReviewResult: '未通过',
  sampleReviewOpinion: '工厂照片角度需补充。',
  resubmitAllowed: true,
  requiredResubmitItems: ['工厂照片', '工厂视频'],
  bossIdentityFiles: [],
}, 'Step10平台审核员')
assert(returned.sampleVerification.status === '样衣审核退回', '样衣审核未通过时应退回')
assert(!returned.sampleVerification.bossIdentityNo && returned.sampleVerification.bossIdentityFiles.length === 0, '样衣审核未通过时不应强制老板身份资料')

const samples = listSampleVerifications()
assert(samples.filter((item) => item.bossIdentityNo && item.bossIdentityFiles.length > 0 && item.bossIdentitySource === '工厂提交').length >= 3, 'mock 缺少工厂端完整上传身份资料')
assert(samples.filter((item) => item.bossIdentitySource === '平台补录' || item.bossIdentitySource === '工厂提交和平台补录').length >= 3, 'mock 缺少平台补录身份资料')
assert(samples.filter((item) => item.status === '样衣审核退回' && !item.bossIdentityNo && item.bossIdentityFiles.length === 0).length >= 3, 'mock 缺少身份资料为空但样衣审核未通过数据')
assert(samples.filter((item) => item.factorySitePhotos.length > 0 && item.factorySiteVideos.length > 0).length >= 3, 'mock 缺少工厂照片与工厂视频完整数据')

assertNoRegexInSrc(/\/fcs\/pda\/login/, '不得存在 /fcs/pda/login 兼容跳转')
assertNotIncludes(pdaOnboardingPath, ['老板身份证号码/护照号码 *', '老板身份证复印件或照片 *', 'WhatsApp', '空白占位页'])
assertNotIncludes(platformPath, ['WhatsApp', '空白占位页', 'PENDING', 'DONE', 'IN_PROGRESS'])

console.log('工厂入驻 Step10 样衣提交资料扩展检查通过')
