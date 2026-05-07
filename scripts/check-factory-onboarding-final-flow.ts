import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import {
  FACTORY_ONBOARDING_STATUS_OPTIONS,
  canCreateFactoryProfile,
  canFactoryEnterBusiness,
  canFactorySubmitOnboarding,
  getOnboardingNodeByStatus,
  type FactoryOnboardingDraftPayload,
  type FactoryOnboardingRequiredField,
  type FactoryOnboardingStatus,
} from '../src/data/fcs/factory-onboarding-domain.ts'
import {
  activateOnboardingSession,
  authenticateFactoryOnboardingAdmin,
  canConvertOnboardingToOfficialFactory,
  convertOnboardingToOfficialFactory,
  ensurePdaAccessForRoute,
  getFactoryOnboardingLoginFailureMessage,
  logoutPdaAccess,
  reviewFactoryOnboardingApplication,
  submitFactoryOnboardingApplication,
} from '../src/data/fcs/factory-onboarding-flow.ts'
import {
  DEFAULT_FACTORY_ONBOARDING_PPIC,
  FACTORY_ONBOARDING_PPIC_OPTIONS,
  getAvailableOnboardingPpicOptions,
  canStartNewOnboarding,
  getFactoryOnboardingApplicationById,
  getLockedFactoryNameReason,
  listFactoryOnboardingApplications,
  updateOnboardingPpic,
} from '../src/data/fcs/factory-onboarding-store.ts'
import {
  FACTORY_SAMPLE_REVIEW_RESULT_OPTIONS,
  FACTORY_SAMPLE_VERIFICATION_STATUS_OPTIONS,
  type FactorySampleReferenceFile,
} from '../src/data/fcs/factory-sample-verification-domain.ts'
import {
  canFactoryResubmitSample,
  canReviewFactorySample,
  confirmFactoryReceivedSample,
  createSampleIssuePayload,
  issueSampleForOnboarding,
  reviewFactorySample,
  submitFactorySampleReview,
  validateFactorySampleSubmission,
} from '../src/data/fcs/factory-sample-verification-flow.ts'
import {
  getSampleVerificationByApplicationId,
  listSampleVerifications,
} from '../src/data/fcs/factory-sample-verification-store.ts'
import {
  listBusinessFactoryMasterRecords,
  listFactoryMasterRecords,
} from '../src/data/fcs/factory-master-store.ts'
import {
  createPdaSessionFromUser,
  findFactoryPdaUserByLoginId,
  setPdaSession,
} from '../src/data/fcs/store-domain-pda.ts'
import { listFactoryCapacityProfiles } from '../src/data/fcs/factory-capacity-profile-mock.ts'

const SCRIPT_NAME = 'check-factory-onboarding-final-flow'
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

function assertNotIncludes(path: string, snippets: string[]): void {
  const content = src(path)
  for (const snippet of snippets) assert(!content.includes(snippet), `${path} 不应包含 ${snippet}`)
}

function collectSourceFiles(dir: string): string[] {
  const current = resolve(root, dir)
  const entries = readdirSync(current)
  return entries.flatMap((entry) => {
    const absolute = join(current, entry)
    const relative = join(dir, entry)
    if (statSync(absolute).isDirectory()) return collectSourceFiles(relative)
    return absolute
  })
}

function assertNoRegexInSrc(pattern: RegExp, message: string): void {
  for (const file of collectSourceFiles('src')) {
    const content = readFileSync(file, 'utf8')
    assert(!pattern.test(content), `${message}：${file}`)
  }
}

function countByStatus(applications = listFactoryOnboardingApplications()): Record<string, number> {
  return applications.reduce<Record<string, number>>((acc, item) => {
    acc[item.status] = (acc[item.status] || 0) + 1
    return acc
  }, {})
}

function makeFile(fileName: string, fileType: FactorySampleReferenceFile['fileType']): FactorySampleReferenceFile {
  return {
    fileId: `FINAL-${fileName}`,
    fileName,
    fileType,
    fileSizeMb: fileType === 'mp4' ? 12 : 2,
    uploadedAt: '2026-05-06 12:00:00',
  }
}

function toDraftPayload(applicationId: string): FactoryOnboardingDraftPayload {
  const application = getFactoryOnboardingApplicationById(applicationId)
  assert(application, `未找到入驻申请 ${applicationId}`)
  return {
    applicationId: application.applicationId,
    applicationNo: application.applicationNo,
    factoryTempId: application.factoryTempId,
    applicantName: application.applicantName,
    identityNo: application.identityNo,
    identityFile: application.identityFile,
    factoryCompanyName: `${application.factoryCompanyName}（复提）`,
    factoryShortName: application.factoryShortName,
    address: `${application.address} 补充门牌`,
    mobilePhone: application.mobilePhone,
    mobileOrWhatsapp: application.mobilePhone,
    sourceChannel: application.sourceChannel,
    ppicName: application.ppicName,
    machineTotalCount: application.machineTotalCount,
    effectiveWorkerCount: application.effectiveWorkerCount,
    availableStartDate: application.availableStartDate,
    selectedCapabilities: application.selectedCapabilities,
    machines: application.machines,
    adminAccount: application.adminAccount,
  }
}

const appShellPath = 'src/data/app-shell-config.ts'
const pdaRoutesPath = 'src/router/routes-pda.ts'
const fcsRoutesPath = 'src/router/routes-fcs.ts'
const pdaRuntimePath = 'src/pages/pda-runtime.ts'
const pdaShellPath = 'src/pages/pda-shell.ts'
const pdaLoginPath = 'src/pages/pda-login.ts'
const pdaOnboardingPath = 'src/pages/pda-onboarding.ts'
const platformPath = 'src/pages/factory-onboarding.ts'
const domainPath = 'src/data/fcs/factory-onboarding-domain.ts'
const ppicPath = 'src/data/fcs/factory-onboarding-ppic.ts'
const sampleDomainPath = 'src/data/fcs/factory-sample-verification-domain.ts'
const sampleFlowPath = 'src/data/fcs/factory-sample-verification-flow.ts'
const onboardingFlowPath = 'src/data/fcs/factory-onboarding-flow.ts'
const factoryMasterPath = 'src/data/fcs/factory-master-store.ts'
const capacityPath = 'src/data/fcs/factory-capacity-profile-mock.ts'
const dispatchBoardPath = 'src/pages/dispatch-board/context.ts'
const dispatchTenderPath = 'src/pages/dispatch-tenders.ts'

// 第一类：路由与菜单
assertIncludes(appShellPath, ['工厂入驻&登录', '登录', '入驻', '/fcs/pda/auth/login', '/fcs/pda/auth/onboarding', '工厂入驻管理', '/fcs/factories/onboarding'])
assertIncludes(pdaRoutesPath, ['/fcs/pda/auth/login', '/fcs/pda/auth/onboarding'])
assertIncludes(fcsRoutesPath, ['/fcs/factories/onboarding'])
assertIncludes(pdaRuntimePath, ['/fcs/pda/auth/login', 'ensurePdaAccessForRoute'])
assertIncludes(pdaShellPath, ['/fcs/pda/auth/login'])
assertNotIncludes(pdaRoutesPath, ['/fcs/pda/login'])
assertNoRegexInSrc(/\/fcs\/pda\/login/, '不得存在 /fcs/pda/login 兼容跳转')
logoutPdaAccess()
for (const route of ['/fcs/pda/exec', '/fcs/pda/handover', '/fcs/pda/warehouse', '/fcs/pda/settlement']) {
  const access = ensurePdaAccessForRoute(route)
  assert(!access.allowed && access.redirectPath?.startsWith('/fcs/pda/auth/login'), `${route} 未登录时应跳登录`)
}

// 第二类：入驻申请模型与表单字段
assertIncludes(domainPath, [
  'applicationId', 'applicationNo', 'factoryTempId', 'applicantName', 'identityNo', 'identityFile', 'factoryCompanyName', 'address',
  'factoryShortName', 'mobilePhone', 'sourceChannel', 'ppicName', 'machineTotalCount', 'effectiveWorkerCount', 'availableStartDate', 'selectedCapabilities',
  'machines', 'adminAccount', 'status', 'currentNode', 'sampleVerificationId', 'sampleStatus', 'createdFactoryId', 'nodeLogs', 'actionLogs',
  'reviewRecords', 'supplementRecords', 'conversionRecords', 'accountLocked', 'accountLockedReason', 'factoryNameLocked',
  'assignedPpicId', 'assignedPpicName', 'assignedPpicPhone', 'assignedPpicAt', 'assignedPpicBy', 'ppicChangeLogs',
])
assertIncludes(pdaOnboardingPath, [
  '姓名', '身份证号码/护照号码', '身份证复印件/电子文件', '工厂简称', '工厂/公司名称', '地址', '手机号', '来源',
  '收到此通知的 PPIC 姓名', '机器数量', '有效工人数量', '可开始合作时间', '工序工艺能力', '机器明细',
  'pda-onboarding-page', 'pda-onboarding-form', 'pda-onboarding-submit',
])
assertNotIncludes(pdaOnboardingPath, ['账号信息', '登录账户', '登录密码', '确认密码', 'WhatsApp', '手机号码/WhatsApp'])
assertNotIncludes(pdaOnboardingPath, [
  '状态提示',
  '当前节点耗时、当前节点动作次数和上次动作都来自流程日志。',
  '平台已发放样衣，请确认收到样衣后再提交样衣审核资料。',
  '样衣审核资料已提交，请等待平台审核。',
  '样衣审核已通过，请等待平台转为正式合作工厂。',
  '已成为正式合作工厂，可以进入业务页面。',
  '评分来自基础资料',
  '先选工序',
  '机器必须关联',
  '需要时再展开查看',
])
assertIncludes(pdaLoginPath, ['pda-auth-login-page'])

// 第三类：状态机
const expectedStatus: FactoryOnboardingStatus[] = [
  '草稿', '待平台审核', '平台审核退回', '待样衣验证', '待工厂确认收样', '待工厂提交样衣审核',
  '待平台审核样衣', '样衣审核退回', '样衣审核通过待转正式', '已转正式合作',
]
for (const status of expectedStatus) assert(FACTORY_ONBOARDING_STATUS_OPTIONS.includes(status), `状态枚举缺少 ${status}`)
const nodeMap: Partial<Record<FactoryOnboardingStatus, string>> = {
  草稿: '填写入驻申请',
  待平台审核: '平台审核',
  平台审核退回: '填写入驻申请',
  待样衣验证: '样衣验证',
  待工厂确认收样: '样衣验证',
  待工厂提交样衣审核: '样衣验证',
  待平台审核样衣: '样衣审核',
  样衣审核退回: '样衣验证',
  样衣审核通过待转正式: '正式合作',
  已转正式合作: '完成',
}
for (const [status, node] of Object.entries(nodeMap)) assert(getOnboardingNodeByStatus(status) === node, `${status} 节点映射应为 ${node}`)
for (const status of expectedStatus) {
  assert(canFactoryEnterBusiness(status) === (status === '已转正式合作'), `${status} 业务准入不一致`)
  assert(canCreateFactoryProfile(status) === (status === '样衣审核通过待转正式'), `${status} 建档准入不一致`)
}

// 第十类：mock 数据先在流转前检查
const initialApplications = listFactoryOnboardingApplications()
const initialBuckets = countByStatus(initialApplications)
for (const status of expectedStatus) assert((initialBuckets[status] || 0) >= 3, `mock 数据 ${status} 少于 3 条`)
const initialSamples = listSampleVerifications()
assert(initialSamples.filter((item) => item.issueMethod === '现场发放').length >= 3, '样衣验证对象现场发放少于 3 条')
assert(initialSamples.filter((item) => item.issueMethod === '快递发放').length >= 3, '样衣验证对象快递发放少于 3 条')
assert(initialSamples.filter((item) => item.factorySamplePhotos.length > 0).length >= 3, '样衣验证对象有样衣照片少于 3 条')
assert(initialSamples.filter((item) => item.factorySampleVideos.length > 0).length >= 3, '样衣验证对象有样衣视频少于 3 条')
assert(initialSamples.filter((item) => (item.factorySitePhotos || []).length > 0).length >= 3, '样衣验证对象有工厂照片少于 3 条')
assert(initialSamples.filter((item) => (item.factorySiteVideos || []).length > 0).length >= 3, '样衣验证对象有工厂视频少于 3 条')
assert(initialSamples.filter((item) => item.bossIdentityNo && (item.bossIdentityFiles || []).length > 0 && item.bossIdentitySource === '工厂提交').length >= 3, '工厂端完整上传老板身份资料少于 3 条')
assert(initialSamples.filter((item) => item.bossIdentitySource === '平台补录' || item.bossIdentitySource === '工厂提交和平台补录').length >= 3, '平台补录老板身份资料少于 3 条')
assert(initialSamples.filter((item) => item.status === '样衣审核退回' && !item.bossIdentityNo && (item.bossIdentityFiles || []).length === 0).length >= 3, '身份资料为空但样衣审核未通过数据少于 3 条')
assert(initialSamples.filter((item) => item.factorySubmissionRoundNo >= 2 && item.sampleReviewRecords.some((record) => record.sampleReviewRoundNo >= 2)).length >= 3, '多轮样衣提交和审核少于 3 条')
assertIncludes(ppicPath, ['FACTORY_ONBOARDING_PPIC_OPTIONS', 'DEFAULT_FACTORY_ONBOARDING_PPIC'])
assert(FACTORY_ONBOARDING_PPIC_OPTIONS.length >= 3 && getAvailableOnboardingPpicOptions().length >= 2, 'PPIC 选项覆盖不足')
assert(initialApplications.filter((item) => ['待平台审核样衣', '样衣审核退回', '样衣审核通过待转正式', '已转正式合作'].includes(item.status) && item.assignedPpicId).length >= 12, '样衣提交后状态应覆盖默认 PPIC')
assert(initialApplications.filter((item) => !item.assignedPpicId).length >= 3, '缺少未分配 PPIC 的入驻申请')
assert(initialApplications.filter((item) => item.ppicChangeLogs.length >= 2).length >= 3, '缺少平台手动修改 PPIC 的 mock 记录')
const initialConverted = initialApplications.filter((item) => item.status === '已转正式合作')
assert(initialConverted.filter((item) => item.createdFactoryId && listFactoryMasterRecords().some((factory) => factory.id === item.createdFactoryId)).length >= 3, '已转正式合作关联工厂档案少于 3 条')
assert(initialConverted.filter((item) => item.createdFactoryId && listFactoryCapacityProfiles().some((profile) => profile.factoryId === item.createdFactoryId)).length >= 3, '已转正式合作关联产能档案少于 3 条')

// 第四类：平台初审
assertIncludes(platformPath, ['已通过', '未通过', 'factory-onboarding-review-button', 'factory-onboarding-review-dialog'])
assertNotIncludes(platformPath, [
  '不通过且允许再次申请',
  '不通过且不允许再次申请',
  '是否允许再次申请',
  '账号信息',
  '账号是否锁定',
  '锁定原因',
  '平台统一管理',
  '样衣状态占位',
  '将生成正式工厂档案',
  '将入驻账号转为正式工厂管理员账号',
  '将生成产能档案初始数据',
  '转正式后工厂可进入执行、交接、仓管、结算',
])
const reviewPass = reviewFactoryOnboardingApplication({
  applicationId: 'FOA-0004',
  reviewResult: '已通过',
  reviewOpinion: '最终检查：平台初审已通过，进入样衣验证。',
  reviewer: '最终检查员',
})
assert(reviewPass.status === '待样衣验证' && reviewPass.currentNode === '样衣验证', '初审通过应进入待样衣验证')
assert(reviewPass.reviewRecords.at(-1)?.reviewResult === '已通过' && reviewPass.actionLogs.some((item) => item.actionName === '平台初审已通过'), '初审通过应写入审核和动作记录')
assert(reviewPass.nodeLogs.some((item) => item.nodeName === '样衣验证' && item.nodeStatus === '进行中'), '初审通过应更新样衣验证节点')
assert(!reviewPass.createdFactoryId && reviewPass.adminAccount.accountStatus !== '已转正式' && !canFactoryEnterBusiness(reviewPass.status), '初审通过不得建档、转正账号或开放业务')

const reviewReturn = reviewFactoryOnboardingApplication({
  applicationId: 'FOA-0005',
  reviewResult: '未通过',
  reviewOpinion: '最终检查：请补充地址和机器明细。',
  reviewer: '最终检查员',
  requiredFields: ['地址', '机器明细'] as FactoryOnboardingRequiredField[],
})
assert(reviewReturn.status === '平台审核退回' && reviewReturn.currentNode === '填写入驻申请', '初审退回应回到填写入驻申请')
assert(reviewReturn.accountLocked === false && reviewReturn.adminAccount.loginId, '初审退回应保留账号并不锁定')
assert(reviewReturn.supplementRecords.length > 0 && reviewReturn.supplementRecords.at(-1)?.requiredFields.includes('地址'), '初审退回应记录需补充字段')
assert(canFactorySubmitOnboarding(reviewReturn.status), '初审退回应允许再次提交')
const resubmitted = submitFactoryOnboardingApplication(toDraftPayload('FOA-0005'), reviewReturn.adminAccount.password)
assert(resubmitted.status === '待平台审核' && resubmitted.currentNode === '平台审核', '退回后重新提交应回到待平台审核')

const reviewAgain = reviewFactoryOnboardingApplication({
  applicationId: 'FOA-0006',
  reviewResult: '未通过',
  reviewOpinion: '最终检查：资料仍需补充。',
  reviewer: '最终检查员',
  requiredFields: ['工厂简称', '手机号'] as FactoryOnboardingRequiredField[],
})
assert(reviewAgain.status === '平台审核退回' && reviewAgain.currentNode === '填写入驻申请', '初审未通过统一进入平台审核退回')
assert(!reviewAgain.accountLocked && !reviewAgain.factoryNameLocked, '初审未通过不得锁定账号或工厂名称')
assert(Boolean(authenticateFactoryOnboardingAdmin(reviewAgain.adminAccount.loginId, reviewAgain.adminAccount.password)), '初审未通过账号仍应允许登录')
assert(canStartNewOnboarding(reviewAgain.factoryCompanyName), '初审未通过不应禁止同名工厂再次申请')
assert(getLockedFactoryNameReason(reviewAgain.factoryCompanyName) === '', '初审未通过不应产生同名锁定提示')

// 第五类：样衣验证对象与平台发样衣
assertIncludes(sampleDomainPath, [
  'FactorySampleVerification', 'verificationId', 'verificationNo', 'applicationId', 'applicationNo', 'factoryTempId', 'factoryCompanyName',
  'applicantName', 'mobileOrWhatsapp', 'sampleBatchNo', 'styleNo', 'sampleName', 'sampleDescription', 'verificationPurpose', 'sampleQuantity',
  'issueMethod', 'courierCompany', 'trackingNo', 'issuedAt', 'issuedBy', 'expectedReceiveAt', 'expectedSubmitAt', 'platformReferencePhotos',
  'platformReferenceVideos', 'platformReferenceFiles', 'status', 'currentNode', 'factoryReceivedAt', 'factorySubmittedAt', 'sampleReviewRecords',
  'nodeLogs', 'actionLogs', 'factorySitePhotos', 'factorySiteVideos', 'bossIdentityNo', 'bossIdentityFiles', 'bossIdentitySource',
  'bossIdentityCompletedAt', 'bossIdentityCompletedBy',
])
assertIncludes(sampleFlowPath, ['issueSampleForOnboarding'])
assertIncludes(platformPath, ['登记并发放样衣', '查看样衣', 'factory-sample-issue-button', 'factory-sample-issue-dialog'])
assertIncludes(platformPath, ['<th class="px-3 py-2 text-left font-medium">PPIC</th>', 'data-factory-onboarding-field="ppicFilter"', '修改 PPIC', 'PPIC 变更记录'])
const issuePayload = createSampleIssuePayload()
issuePayload.sampleBatchNo = 'SY-FINAL-001'
issuePayload.styleNo = 'STYLE-FINAL-001'
issuePayload.sampleName = '最终验收样衣'
issuePayload.sampleDescription = '最终验收发放样衣。'
issuePayload.verificationPurpose = ['检验车缝能力', '检验质量稳定性']
issuePayload.sampleQuantity = 2
issuePayload.issueMethod = '现场发放'
issuePayload.issuedAt = '2026-05-06 12:00:00'
issuePayload.issuedBy = '最终发样员'
issuePayload.expectedSubmitAt = '2026-05-10 18:00:00'
const issueResult = issueSampleForOnboarding('FOA-0013', issuePayload, '最终发样员')
assert(issueResult.application.status === '待工厂确认收样' && issueResult.application.sampleStatus === '待工厂确认收样', '发放样衣后申请状态不正确')
assert(issueResult.application.sampleVerificationId === issueResult.sampleVerification.verificationId, '发放样衣后应写入 sampleVerificationId')
assert(!issueResult.application.createdFactoryId && !canFactoryEnterBusiness(issueResult.application.status), '发放样衣后不得建档或开放业务')
try {
  issueSampleForOnboarding('FOA-0013', issuePayload, '最终发样员')
  assert(false, '重复发放应被禁止')
} catch (error) {
  assert(error instanceof Error && error.message.includes('请勿重复发放'), '重复发放提示不正确')
}
try {
  issueSampleForOnboarding('FOA-0001', issuePayload, '最终发样员')
  assert(false, '非待样衣验证状态应禁止发放')
} catch (error) {
  assert(error instanceof Error && error.message.includes('只有待样衣验证'), '非待样衣验证发放提示不正确')
}

// 第六类：工厂端样衣确认与提交
assertIncludes(sampleFlowPath, ['confirmFactoryReceivedSample', 'submitFactorySampleReview', 'validateFactorySampleSubmission'])
assertIncludes(pdaOnboardingPath, [
  'pda-sample-card', 'pda-confirm-sample-received', 'pda-submit-sample-review', 'pda-sample-photo-upload', 'pda-sample-video-upload', 'pda-sample-craft-description',
  'factory-site-photo-upload', 'factory-site-video-upload', 'boss-identity-no-input', 'boss-identity-file-upload',
])
const receiveVerification = getSampleVerificationByApplicationId('FOA-0016')
assert(receiveVerification?.status === '待工厂确认收样', '缺少待工厂确认收样样本')
const receiveResult = confirmFactoryReceivedSample(receiveVerification.verificationId, {
  factoryReceivedAt: '2026-05-06 13:00:00',
  factoryReceivedBy: '最终收样人',
  factoryReceiveRemark: '样衣已收到。',
}, '最终收样人')
assert(receiveResult.sampleVerification.status === '待工厂提交样衣审核' && receiveResult.application.status === '待工厂提交样衣审核', '确认收样后状态不正确')
assert(receiveResult.sampleVerification.factoryReceivedAt && receiveResult.sampleVerification.factoryReceivedBy === '最终收样人', '确认收样字段未写入')
assert(receiveResult.sampleVerification.actionLogs.some((item) => item.actionName === '工厂确认收到样衣'), '确认收样应写入样衣动作记录')

const submitVerification = getSampleVerificationByApplicationId('FOA-0019')
assert(submitVerification?.status === '待工厂提交样衣审核', '缺少待工厂提交样衣审核样本')
try {
  validateFactorySampleSubmission({
    factorySamplePhotos: [],
    factorySampleVideos: [],
    factoryCraftDescription: '',
    factorySubmissionFiles: [],
    factorySitePhotos: [],
    factorySiteVideos: [],
    bossIdentityFiles: [],
  })
  assert(false, '缺少样衣资料应校验失败')
} catch (error) {
  assert(error instanceof Error && error.message.includes('请上传样衣照片') && error.message.includes('请上传样衣视频') && error.message.includes('请填写工艺说明'), '样衣提交校验提示不完整')
}
const submitResult = submitFactorySampleReview(submitVerification.verificationId, {
  factorySamplePhotos: [makeFile('最终样衣照片.jpg', 'jpg')],
  factorySampleVideos: [makeFile('最终样衣视频.mp4', 'mp4')],
  factoryCraftDescription: '最终检查工艺说明。',
  factoryProblemDescription: '无',
  factorySubmitRemark: '提交平台审核。',
  factorySubmissionFiles: [],
  factorySitePhotos: [makeFile('最终工厂照片.jpg', 'jpg')],
  factorySiteVideos: [makeFile('最终工厂视频.mp4', 'mp4')],
  bossIdentityNo: '',
  bossIdentityFiles: [],
}, '最终提交人')
assert(submitResult.sampleVerification.status === '待平台审核样衣' && submitResult.application.status === '待平台审核样衣', '提交样衣审核后状态不正确')
assert(submitResult.sampleVerification.factorySamplePhotos.length > 0 && submitResult.sampleVerification.factorySampleVideos.length > 0 && submitResult.sampleVerification.factoryCraftDescription, '提交样衣审核资料未写入')
assert(submitResult.sampleVerification.factorySitePhotos.length > 0 && submitResult.sampleVerification.factorySiteVideos.length > 0, '提交样衣审核未写入工厂照片或工厂视频')
assert(submitResult.sampleVerification.factorySubmissionRoundNo >= 1 && submitResult.sampleVerification.actionLogs.some((item) => item.actionName === '工厂提交样衣审核'), '提交轮次或动作记录不正确')
assert(submitResult.application.assignedPpicId === DEFAULT_FACTORY_ONBOARDING_PPIC.ppicId, '工厂提交样衣后应自动分配默认 PPIC')
assert(submitResult.application.ppicChangeLogs.some((item) => item.changedBy === '系统默认分配'), '默认 PPIC 分配应写入变更记录')
const nextPpic = getAvailableOnboardingPpicOptions().find((item) => item.ppicId !== DEFAULT_FACTORY_ONBOARDING_PPIC.ppicId)
assert(nextPpic, '缺少可修改的启用 PPIC')
const ppicUpdated = updateOnboardingPpic(submitResult.application.applicationId, nextPpic.ppicId, '最终平台运营员', '最终检查修改 PPIC')
assert(ppicUpdated.assignedPpicId === nextPpic.ppicId && ppicUpdated.ppicChangeLogs.some((item) => item.changedBy === '最终平台运营员'), '平台修改 PPIC 未生效或未写日志')
try {
  submitFactorySampleReview(submitVerification.verificationId, {
    factorySamplePhotos: [makeFile('重复照片.jpg', 'jpg')],
    factorySampleVideos: [makeFile('重复视频.mp4', 'mp4')],
    factoryCraftDescription: '重复提交。',
    factorySubmissionFiles: [],
    factorySitePhotos: [makeFile('重复工厂照片.jpg', 'jpg')],
    factorySiteVideos: [makeFile('重复工厂视频.mp4', 'mp4')],
    bossIdentityFiles: [],
  }, '最终提交人')
  assert(false, '待平台审核样衣状态不允许重复提交')
} catch (error) {
  assert(error instanceof Error && error.message.includes('当前状态不能提交样衣审核资料'), '重复提交提示不正确')
}

// 第七类：平台样衣审核
assertIncludes(sampleFlowPath, ['reviewFactorySample', 'FactorySampleReviewRecord', 'canReviewFactorySample', 'canFactoryResubmitSample'])
assertIncludes(platformPath, ['平台样衣审核', 'factory-sample-review-button', 'factory-sample-review-dialog'])
for (const status of FACTORY_SAMPLE_VERIFICATION_STATUS_OPTIONS) {
  const sample = listSampleVerifications().find((item) => item.status === status)
  if (sample) assert(canReviewFactorySample(sample) === (status === '待平台审核样衣'), `${status} 样衣审核准入不一致`)
}
for (const result of ['已通过', '未通过'] as const) {
  assert(FACTORY_SAMPLE_REVIEW_RESULT_OPTIONS.includes(result), `样衣审核结果缺少 ${result}`)
}
const samplePassVerification = getSampleVerificationByApplicationId('FOA-0022')
assert(samplePassVerification?.status === '待平台审核样衣', '缺少待平台审核样衣通过样本')
const samplePass = reviewFactorySample(samplePassVerification.verificationId, {
  sampleReviewResult: '已通过',
  sampleReviewOpinion: '最终检查：样衣审核通过。',
  resubmitAllowed: false,
  requiredResubmitItems: [],
  sampleQualityConclusion: '达标',
  capacityConclusion: '具备合作能力',
  bossIdentityNo: 'BOSS-FINAL-PASS',
  bossIdentityFiles: [makeFile('最终老板身份证.pdf', 'pdf')],
}, '最终样衣审核员')
assert(samplePass.sampleVerification.status === '样衣审核通过' && samplePass.application.status === '样衣审核通过待转正式', '样衣审核通过状态不正确')
assert(samplePass.sampleVerification.bossIdentityNo && samplePass.sampleVerification.bossIdentityFiles.length > 0, '样衣审核已通过前老板身份资料必须齐全')
assert(!samplePass.application.createdFactoryId && !canFactoryEnterBusiness(samplePass.application.status), '样衣审核通过不得自动建档或开放业务')

const sampleReturnVerification = getSampleVerificationByApplicationId('FOA-0023')
assert(sampleReturnVerification?.status === '待平台审核样衣', '缺少待平台审核样衣退回样本')
const beforeRound = sampleReturnVerification.factorySubmissionRoundNo
const sampleReturn = reviewFactorySample(sampleReturnVerification.verificationId, {
  sampleReviewResult: '未通过',
  sampleReviewOpinion: '最终检查：请补充样衣照片和视频。',
  resubmitAllowed: true,
  requiredResubmitItems: ['样衣照片', '样衣视频'],
  bossIdentityFiles: [],
}, '最终样衣审核员')
assert(sampleReturn.sampleVerification.status === '样衣审核退回' && sampleReturn.application.status === '样衣审核退回', '样衣审核退回状态不正确')
assert(canFactoryResubmitSample(sampleReturn.sampleVerification), '样衣审核退回应允许工厂重新提交')
const sampleResubmit = submitFactorySampleReview(sampleReturn.sampleVerification.verificationId, {
  factorySamplePhotos: [makeFile('重提照片.jpg', 'jpg')],
  factorySampleVideos: [makeFile('重提视频.mp4', 'mp4')],
  factoryCraftDescription: '按退回意见重新提交。',
  factorySubmissionFiles: [makeFile('补充说明.pdf', 'pdf')],
  factorySitePhotos: [makeFile('重提工厂照片.jpg', 'jpg')],
  factorySiteVideos: [makeFile('重提工厂视频.mp4', 'mp4')],
  bossIdentityFiles: [],
}, '最终重提人')
assert(sampleResubmit.sampleVerification.status === '待平台审核样衣' && sampleResubmit.application.status === '待平台审核样衣', '重新提交后应回到待平台审核样衣')
assert(sampleResubmit.sampleVerification.factorySubmissionRoundNo === beforeRound + 1, '重新提交轮次应递增')

const sampleReturnAgainVerification = getSampleVerificationByApplicationId('FOA-0024')
assert(sampleReturnAgainVerification?.status === '待平台审核样衣', '缺少待平台审核样衣未通过样本')
const sampleReturnAgain = reviewFactorySample(sampleReturnAgainVerification.verificationId, {
  sampleReviewResult: '未通过',
  sampleReviewOpinion: '最终检查：样衣资料仍需补充。',
  resubmitAllowed: true,
  requiredResubmitItems: ['工艺说明'],
  bossIdentityFiles: [],
}, '最终样衣审核员')
assert(sampleReturnAgain.sampleVerification.status === '样衣审核退回' && sampleReturnAgain.application.status === '样衣审核退回', '样衣审核未通过应统一退回')
assert(!sampleReturnAgain.application.accountLocked && !sampleReturnAgain.application.factoryNameLocked, '样衣审核未通过不得锁定账号或工厂名称')
assert(Boolean(authenticateFactoryOnboardingAdmin(sampleReturnAgain.application.adminAccount.loginId, sampleReturnAgain.application.adminAccount.password)), '样衣审核未通过账号仍应允许登录')
assert(canStartNewOnboarding(sampleReturnAgain.application.factoryCompanyName), '样衣审核未通过不应禁止同名工厂再次申请')

// 第八类：正式转档
assertIncludes(onboardingFlowPath, ['convertOnboardingToOfficialFactory', 'canConvertOnboardingToOfficialFactory', 'buildFactoryProfileFromOnboarding', 'convertOnboardingAdminAccountToOfficial', 'createInitialCapacityProfileFromOnboarding'])
assertIncludes(platformPath, ['转正式合作', 'factory-official-conversion-button', 'factory-official-conversion-dialog'])
const convertSource = getFactoryOnboardingApplicationById('FOA-0031')
assert(convertSource && canConvertOnboardingToOfficialFactory(convertSource), '样衣审核通过待转正式样本应允许转正式')
const conversion = await convertOnboardingToOfficialFactory('FOA-0031', '最终转档员')
assert(conversion.application.status === '已转正式合作' && conversion.application.currentNode === '完成', '转正式后申请状态不正确')
assert(conversion.application.createdFactoryId === conversion.createdFactory.id && conversion.application.conversionRecords.length > 0, '转正式后应写入 createdFactoryId 和 conversionRecords')
assert(conversion.createdFactory.onboardingApplicationId === conversion.application.applicationId, 'FactoryProfile 缺少 onboardingApplicationId')
assert(conversion.createdFactory.sampleVerificationId === conversion.application.sampleVerificationId, 'FactoryProfile 缺少 sampleVerificationId')
assert(conversion.createdFactory.factoryShortName === conversion.application.factoryShortName, 'FactoryProfile 工厂简称映射不一致')
assert(conversion.createdFactory.mobilePhone === conversion.application.mobilePhone, 'FactoryProfile 手机号映射不一致')
assert(conversion.createdFactory.assignedPpicId === conversion.application.assignedPpicId && conversion.createdFactory.assignedPpicName === conversion.application.assignedPpicName, 'FactoryProfile PPIC 映射不一致')
assert((conversion.createdFactory.selectedCapabilities?.length || 0) > 0 && (conversion.createdFactory.machines?.length || 0) > 0, 'FactoryProfile 缺少工序工艺或机器能力')
assert(conversion.createdFactory.effectiveWorkerCount === conversion.application.effectiveWorkerCount, 'FactoryProfile 缺少有效工人数量')
const officialUser = findFactoryPdaUserByLoginId(conversion.application.adminAccount.loginId)
assert(officialUser?.roleName === '工厂管理员' && officialUser.loginId === conversion.application.adminAccount.loginId && officialUser.isTemporary === false, '管理员账号未正确转正式')
assert(conversion.capacityProfile.sourceApplicationId === conversion.application.applicationId, '产能档案缺少 sourceApplicationId')
assert(conversion.capacityProfile.capabilityItems.length > 0 && conversion.capacityProfile.machineItems.length > 0, '产能档案缺少能力或机器明细')
assert(conversion.capacityProfile.defaultDailyAvailablePublishedSam === 0 && conversion.capacityProfile.calculationStatus === '待补充产能字段', '产能档案 SAM 缺省规则不正确')
assert(!('currentStatus' in conversion.capacityProfile) && !('dayShift' in conversion.capacityProfile) && !('nightShift' in conversion.capacityProfile) && !('weeklyDefaultSupply' in conversion.capacityProfile), '产能档案不应生成当前状态、班次或周默认供给')

// 第九类：平台与 PDA 权限
logoutPdaAccess()
activateOnboardingSession(samplePass.application)
for (const route of ['/fcs/pda/exec', '/fcs/pda/handover', '/fcs/pda/warehouse', '/fcs/pda/settlement']) {
  const access = ensurePdaAccessForRoute(route)
  assert(!access.allowed && access.redirectPath?.startsWith('/fcs/pda/auth/onboarding'), `${route} 待转正式应跳入驻页`)
}
logoutPdaAccess()
assert(officialUser, '缺少正式 PDA 管理员')
setPdaSession(createPdaSessionFromUser(officialUser))
for (const route of ['/fcs/pda/exec', '/fcs/pda/handover', '/fcs/pda/warehouse', '/fcs/pda/settlement']) {
  const access = ensurePdaAccessForRoute(route)
  assert(access.allowed, `${route} 已转正式合作应允许进入`)
}
const dispatchCandidates = listBusinessFactoryMasterRecords()
assert(dispatchCandidates.every((factory) => factory.status === 'active' && factory.eligibility.allowDispatch), '派单候选必须来自正式可派单工厂档案')
for (const status of ['待样衣验证', '待工厂确认收样', '待工厂提交样衣审核', '待平台审核样衣', '样衣审核退回', '样衣审核通过待转正式'] as FactoryOnboardingStatus[]) {
  const app = listFactoryOnboardingApplications().find((item) => item.status === status)
  if (app) assert(!dispatchCandidates.some((factory) => factory.name === app.factoryCompanyName), `${status} 不得进入派单候选`)
}

// 第十一类：旧口径与禁止项
assertNoRegexInSrc(/平台初审通过.*生成工厂档案/, '不得平台初审通过直接生成工厂档案')
assertNoRegexInSrc(/平台初审通过.*已转正式合作/, '不得平台初审通过直接已转正式合作')
assertNoRegexInSrc(/待样衣验证.*已转正式合作/, '不得待样衣验证直接已转正式合作')
assertNoRegexInSrc(/发放样衣.*已转正式合作/, '不得发放样衣后直接已转正式合作')
assertNoRegexInSrc(/待平台审核样衣.*已转正式合作/, '不得待平台审核样衣直接已转正式合作')
assertNoRegexInSrc(/样衣审核通过.*生成工厂档案/, '不得样衣审核通过自动生成工厂档案')
assertNoRegexInSrc(/未合作.*进入业务/, '不得出现未合作工厂进入业务页口径')
assertNotIncludes(platformPath, ['PENDING', 'DONE', 'IN_PROGRESS', '空白占位页'])
assertNotIncludes(pdaOnboardingPath, ['PENDING', 'DONE', 'IN_PROGRESS', '空白占位页'])
assertIncludes(factoryMasterPath, ['listBusinessFactoryMasterRecords'])
assertIncludes(dispatchBoardPath, ['listBusinessFactoryMasterRecords'])
assertIncludes(dispatchTenderPath, ['listBusinessFactoryMasterRecords'])

// 第十二类：文档
for (const docPath of [
  'docs/fcs-factory-onboarding-step1-model-state-form.md',
  'docs/fcs-factory-onboarding-step2-platform-review.md',
  'docs/fcs-factory-onboarding-step3-sample-issue.md',
  'docs/fcs-factory-onboarding-step4-factory-sample-submit.md',
  'docs/fcs-factory-onboarding-step5-sample-review.md',
  'docs/fcs-factory-onboarding-step6-official-conversion.md',
  'docs/fcs-factory-onboarding-final-flow.md',
]) {
  assert(existsSync(resolve(root, docPath)), `缺少文档 ${docPath}`)
}
assertIncludes('docs/fcs-factory-onboarding-final-flow.md', ['完整业务流程', '最终检查脚本', 'Playwright 覆盖'])

console.log('工厂入驻最终全链路检查通过')
