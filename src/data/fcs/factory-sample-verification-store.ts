import type { FactoryOnboardingApplication } from './factory-onboarding-domain.ts'
import { getFactoryOnboardingApplicationById } from './factory-onboarding-store.ts'
import type {
  FactorySampleIssueMethod,
  FactorySampleIssuePayload,
  FactorySampleReferenceFile,
  FactorySampleReviewRecord,
  FactorySampleVerification,
  FactorySampleVerificationActionLog,
  FactorySampleVerificationNode,
  FactorySampleVerificationNodeLog,
  FactorySampleVerificationPurpose,
  FactorySampleVerificationStatus,
} from './factory-sample-verification-domain.ts'
import { normalizeSampleReviewResult } from './factory-sample-verification-domain.ts'

const SAMPLE_VERIFICATION_STORE_KEY = 'fcs_factory_sample_verification_store_v2'

let cachedSampleVerifications: FactorySampleVerification[] | null = null

function nowTimestamp(date = new Date()): string {
  return date.toISOString().slice(0, 19).replace('T', ' ')
}

function formatDateCode(value: string): string {
  return value.slice(0, 10).replace(/-/g, '')
}

function readStoredJson<T>(key: string): T | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(key)
    return raw ? JSON.parse(raw) as T : null
  } catch {
    return null
  }
}

function writeStoredJson<T>(key: string, value: T): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Prototype localStorage errors should not block the page.
  }
}

function cloneReferenceFile(file: FactorySampleReferenceFile): FactorySampleReferenceFile {
  return { ...file }
}

function normalizeSampleReviewRecord(record: FactorySampleReviewRecord | Record<string, unknown>): FactorySampleReviewRecord {
  const legacyResult = String(record.sampleReviewResult || record.reviewResult || '')
  const sampleReviewResult = normalizeSampleReviewResult(legacyResult === '退回' || legacyResult === '拒绝' ? '未通过' : legacyResult)
  const toStatus = String(record.toStatus || (sampleReviewResult === '已通过' ? '样衣审核通过' : '样衣审核退回')) as FactorySampleVerificationStatus
  const toNode = String(record.toNode || (sampleReviewResult === '未通过' ? '工厂提交样衣审核' : '样衣验证完成')) as FactorySampleVerificationNode
  return {
    sampleReviewId: String(record.sampleReviewId || record.reviewId || `SV-REV-${Date.now()}`),
    sampleReviewRoundNo: Number(record.sampleReviewRoundNo || record.reviewRoundNo || 1),
    sampleReviewResult,
    sampleReviewOpinion: String(record.sampleReviewOpinion || record.reviewOpinion || ''),
    resubmitAllowed: typeof record.resubmitAllowed === 'boolean' ? record.resubmitAllowed : sampleReviewResult === '未通过',
    requiredResubmitItems: Array.isArray(record.requiredResubmitItems) ? [...record.requiredResubmitItems] as FactorySampleReviewRecord['requiredResubmitItems'] : sampleReviewResult === '未通过' ? ['样衣照片'] : [],
    reviewer: String(record.reviewer || '平台样衣审核员'),
    reviewedAt: String(record.reviewedAt || nowTimestamp()),
    fromStatus: String(record.fromStatus || '待平台审核样衣') as FactorySampleVerificationStatus,
    toStatus,
    fromNode: String(record.fromNode || '平台审核样衣') as FactorySampleVerificationNode,
    toNode,
    relatedSubmissionRoundNo: Number(record.relatedSubmissionRoundNo || 1),
    sampleQualityConclusion: record.sampleQualityConclusion as FactorySampleReviewRecord['sampleQualityConclusion'],
    capacityConclusion: record.capacityConclusion as FactorySampleReviewRecord['capacityConclusion'],
    bossIdentityNoAtReview: record.bossIdentityNoAtReview ? String(record.bossIdentityNoAtReview) : undefined,
    bossIdentityFilesAtReview: Array.isArray(record.bossIdentityFilesAtReview) ? (record.bossIdentityFilesAtReview as FactorySampleReferenceFile[]).map(cloneReferenceFile) : [],
    bossIdentitySourceAtReview: record.bossIdentitySourceAtReview as FactorySampleReviewRecord['bossIdentitySourceAtReview'],
    bossIdentityCompletedByReviewer: record.bossIdentityCompletedByReviewer ? String(record.bossIdentityCompletedByReviewer) : undefined,
    remark: record.remark ? String(record.remark) : undefined,
  }
}

function cloneSampleVerification(item: FactorySampleVerification): FactorySampleVerification {
  return {
    ...item,
    verificationPurpose: [...item.verificationPurpose],
    platformReferenceFiles: item.platformReferenceFiles.map(cloneReferenceFile),
    platformReferencePhotos: item.platformReferencePhotos.map(cloneReferenceFile),
    platformReferenceVideos: item.platformReferenceVideos.map(cloneReferenceFile),
    factorySamplePhotos: (item.factorySamplePhotos || []).map(cloneReferenceFile),
    factorySampleVideos: (item.factorySampleVideos || []).map(cloneReferenceFile),
    factorySubmissionFiles: (item.factorySubmissionFiles || []).map(cloneReferenceFile),
    factorySitePhotos: (item.factorySitePhotos || []).map(cloneReferenceFile),
    factorySiteVideos: (item.factorySiteVideos || []).map(cloneReferenceFile),
    bossIdentityFiles: (item.bossIdentityFiles || []).map(cloneReferenceFile),
    sampleReviewRecords: (item.sampleReviewRecords || []).map(normalizeSampleReviewRecord),
    nodeLogs: item.nodeLogs.map((log) => ({ ...log })),
    actionLogs: item.actionLogs.map((log) => ({ ...log })),
  }
}

function buildVerificationId(seed: number | string): string {
  return `SV-${String(seed).replace(/\D/g, '').padStart(4, '0').slice(-4)}`
}

function buildVerificationNo(seed: number | string, issuedAt: string): string {
  return `SV-${formatDateCode(issuedAt)}-${String(seed).replace(/\D/g, '').padStart(3, '0').slice(-3)}`
}

function createReferenceFile(seed: number, kind: 'photo' | 'video' | 'file'): FactorySampleReferenceFile {
  const fileType = kind === 'photo' ? 'jpg' : kind === 'video' ? 'mp4' : seed % 2 === 0 ? 'pdf' : 'png'
  const suffix = kind === 'photo' ? 'jpg' : kind === 'video' ? 'mp4' : fileType
  const label = kind === 'photo' ? '参考照片' : kind === 'video' ? '参考视频' : '参考资料'
  return {
    fileId: `SREF-${kind}-${String(seed).padStart(4, '0')}`,
    fileName: `${label}-${String(seed).padStart(4, '0')}.${suffix}`,
    fileType,
    fileSizeMb: kind === 'video' ? 28 + (seed % 10) : 2 + (seed % 6),
    fileUrl: `/mock/factory-sample/${label}-${String(seed).padStart(4, '0')}.${suffix}`,
    uploadedAt: `2026-05-${String((seed % 6) + 2).padStart(2, '0')} 09:30:00`,
  }
}

function createFactorySubmissionFile(seed: number, kind: 'photo' | 'video' | 'file' | 'sitePhoto' | 'siteVideo' | 'bossFile', index = 1): FactorySampleReferenceFile {
  const isPhoto = kind === 'photo' || kind === 'sitePhoto'
  const isVideo = kind === 'video' || kind === 'siteVideo'
  const fileType = kind === 'bossFile' ? (seed % 2 === 0 ? 'pdf' : 'jpg') : isPhoto ? 'jpg' : isVideo ? 'mp4' : seed % 2 === 0 ? 'pdf' : 'png'
  const suffix = isPhoto ? 'jpg' : isVideo ? 'mp4' : fileType
  const label = kind === 'photo'
    ? '工厂样衣照片'
    : kind === 'video'
      ? '工厂样衣视频'
      : kind === 'sitePhoto'
        ? '工厂照片'
        : kind === 'siteVideo'
          ? '工厂视频'
          : kind === 'bossFile'
            ? '老板身份证复印件或照片'
            : '工厂补充文件'
  return {
    fileId: `SFAC-${kind}-${String(seed).padStart(4, '0')}-${index}`,
    fileName: `${label}-${String(seed).padStart(4, '0')}-${index}.${suffix}`,
    fileType,
    fileSizeMb: kind === 'video' ? 36 + (seed % 8) : 3 + (index % 4),
    fileUrl: `/mock/factory-sample-submit/${label}-${String(seed).padStart(4, '0')}-${index}.${suffix}`,
    uploadedAt: `2026-05-${String((seed % 6) + 7).padStart(2, '0')} 15:${String((seed * 3 + index) % 60).padStart(2, '0')}:00`,
  }
}

function createSampleNodeLog(params: {
  seed: number
  nodeName: FactorySampleVerificationNode
  nodeStatus: '未开始' | '进行中' | '已完成' | '已退回' | '已终止'
  enteredAt: string
  leftAt?: string
  operator: string
  remark: string
}): FactorySampleVerificationNodeLog {
  return {
    nodeLogId: `SV-NODE-${params.seed}-${params.nodeName}`,
    nodeName: params.nodeName,
    nodeStatus: params.nodeStatus,
    enteredAt: params.enteredAt,
    leftAt: params.leftAt,
    operator: params.operator,
    remark: params.remark,
  }
}

function createSampleActionLog(params: {
  seed: number
  seq: number
  actionName: FactorySampleVerificationActionLog['actionName']
  nodeName: FactorySampleVerificationNode
  operator: string
  operatedAt: string
  fromStatus?: FactorySampleVerificationStatus
  toStatus: FactorySampleVerificationStatus
  fromNode?: FactorySampleVerificationNode
  toNode: FactorySampleVerificationNode
  remark: string
}): FactorySampleVerificationActionLog {
  return {
    actionLogId: `SV-ACTION-${params.seed}-${String(params.seq).padStart(2, '0')}`,
    actionName: params.actionName,
    nodeName: params.nodeName,
    operator: params.operator,
    operatedAt: params.operatedAt,
    fromStatus: params.fromStatus,
    toStatus: params.toStatus,
    fromNode: params.fromNode,
    toNode: params.toNode,
    remark: params.remark,
  }
}

function fallbackApplication(seed: number): Pick<FactoryOnboardingApplication, 'applicationId' | 'applicationNo' | 'factoryTempId' | 'factoryCompanyName' | 'applicantName' | 'mobileOrWhatsapp'> {
  return {
    applicationId: `FOA-${String(seed).padStart(4, '0')}`,
    applicationNo: `FON-${String(20260500 + seed).padStart(8, '0')}`,
    factoryTempId: `FACTORY-TEMP-${String(seed).padStart(4, '0')}`,
    factoryCompanyName: `样衣验证演示工厂${seed}`,
    applicantName: `申请人${seed}`,
    mobileOrWhatsapp: `+62-812-90${String(100000 + seed).slice(-6)}`,
  }
}

function getApplicationSnapshot(seed: number) {
  return getFactoryOnboardingApplicationById(`FOA-${String(seed).padStart(4, '0')}`) || fallbackApplication(seed)
}

function getSeedPurposes(seed: number): FactorySampleVerificationPurpose[] {
  if (seed % 3 === 0) return ['检验车缝能力', '检验质量稳定性', '检验交期配合度']
  if (seed % 3 === 1) return ['检验裁床能力', '检验特殊工艺能力']
  return ['检验后道能力', '检验质量稳定性']
}

function getSeedSampleStatus(seed: number): FactorySampleVerificationStatus {
  if (seed <= 18) return '待工厂确认收样'
  if (seed <= 21) return '待工厂提交样衣审核'
  if (seed <= 24) return '待平台审核样衣'
  if (seed <= 27) return '样衣审核退回'
  if (seed <= 30) return '样衣审核拒绝'
  return '样衣审核通过'
}

function getSeedSampleNode(status: FactorySampleVerificationStatus): FactorySampleVerificationNode {
  if (status === '待工厂确认收样') return '工厂确认收样'
  if (status === '待工厂提交样衣审核' || status === '样衣审核退回') return '工厂提交样衣审核'
  if (status === '待平台审核样衣') return '平台审核样衣'
  return '样衣验证完成'
}

function getSeedBossIdentity(seed: number, status: FactorySampleVerificationStatus, hasSubmitted: boolean, hasReviewed: boolean) {
  if (!hasSubmitted) {
    return {
      bossIdentityNo: undefined,
      bossIdentityFiles: [] as FactorySampleReferenceFile[],
      bossIdentitySource: undefined,
      bossIdentityCompletedAt: undefined,
      bossIdentityCompletedBy: undefined,
    }
  }
  if (status === '样衣审核退回') {
    return {
      bossIdentityNo: undefined,
      bossIdentityFiles: [] as FactorySampleReferenceFile[],
      bossIdentitySource: undefined,
      bossIdentityCompletedAt: undefined,
      bossIdentityCompletedBy: undefined,
    }
  }
  if (status === '样衣审核通过' && seed === 31) {
    return {
      bossIdentityNo: `BOSS-PLAT-${String(880000000000 + seed)}`,
      bossIdentityFiles: [createFactorySubmissionFile(seed, 'bossFile', 1)],
      bossIdentitySource: '平台补录' as const,
      bossIdentityCompletedAt: hasReviewed ? `2026-05-${String((seed % 6) + 6).padStart(2, '0')} 16:${String((seed * 9) % 60).padStart(2, '0')}:00` : undefined,
      bossIdentityCompletedBy: '平台样衣审核员',
    }
  }
  if (status === '样衣审核通过' && seed === 32) {
    return {
      bossIdentityNo: `BOSS-NO-${String(880000000000 + seed)}`,
      bossIdentityFiles: [createFactorySubmissionFile(seed, 'bossFile', 1)],
      bossIdentitySource: '工厂提交和平台补录' as const,
      bossIdentityCompletedAt: hasReviewed ? `2026-05-${String((seed % 6) + 6).padStart(2, '0')} 16:${String((seed * 9) % 60).padStart(2, '0')}:00` : undefined,
      bossIdentityCompletedBy: '平台样衣审核员',
    }
  }
  if (status === '样衣审核通过' && seed === 33) {
    return {
      bossIdentityNo: `BOSS-FILE-${String(880000000000 + seed)}`,
      bossIdentityFiles: [createFactorySubmissionFile(seed, 'bossFile', 1)],
      bossIdentitySource: '工厂提交和平台补录' as const,
      bossIdentityCompletedAt: hasReviewed ? `2026-05-${String((seed % 6) + 6).padStart(2, '0')} 16:${String((seed * 9) % 60).padStart(2, '0')}:00` : undefined,
      bossIdentityCompletedBy: '平台样衣审核员',
    }
  }
  if (seed % 4 === 1) {
    return {
      bossIdentityNo: `BOSS-NO-${String(880000000000 + seed)}`,
      bossIdentityFiles: [] as FactorySampleReferenceFile[],
      bossIdentitySource: '工厂提交' as const,
      bossIdentityCompletedAt: undefined,
      bossIdentityCompletedBy: undefined,
    }
  }
  if (seed % 4 === 2) {
    return {
      bossIdentityNo: undefined,
      bossIdentityFiles: [createFactorySubmissionFile(seed, 'bossFile', 1)],
      bossIdentitySource: '工厂提交' as const,
      bossIdentityCompletedAt: undefined,
      bossIdentityCompletedBy: undefined,
    }
  }
  return {
    bossIdentityNo: `BOSS-FULL-${String(880000000000 + seed)}`,
    bossIdentityFiles: [createFactorySubmissionFile(seed, 'bossFile', 1)],
    bossIdentitySource: '工厂提交' as const,
    bossIdentityCompletedAt: `2026-05-${String((seed % 6) + 5).padStart(2, '0')} 15:${String((seed * 7) % 60).padStart(2, '0')}:00`,
    bossIdentityCompletedBy: `申请人${seed}`,
  }
}

function createSeedSampleVerification(seed: number): FactorySampleVerification {
  const application = getApplicationSnapshot(seed)
  const issuedAt = `2026-05-${String((seed % 6) + 3).padStart(2, '0')} 10:${String((seed * 4) % 60).padStart(2, '0')}:00`
  const receiveAt = `2026-05-${String((seed % 6) + 4).padStart(2, '0')} 11:${String((seed * 5) % 60).padStart(2, '0')}:00`
  const submitAt = `2026-05-${String((seed % 6) + 5).padStart(2, '0')} 15:${String((seed * 7) % 60).padStart(2, '0')}:00`
  const reviewAt = `2026-05-${String((seed % 6) + 6).padStart(2, '0')} 16:${String((seed * 9) % 60).padStart(2, '0')}:00`
  const expectedSubmitAt = `2026-05-${String((seed % 6) + 6).padStart(2, '0')} 17:00:00`
  const issueMethod: FactorySampleIssueMethod = seed <= 18 ? '现场发放' : '快递发放'
  const status = getSeedSampleStatus(seed)
  const currentNode = getSeedSampleNode(status)
  const hasReceived = status !== '待工厂确认收样'
  const hasSubmitted = ['待平台审核样衣', '样衣审核退回', '样衣审核拒绝', '样衣审核通过'].includes(status)
  const hasReviewed = ['样衣审核退回', '样衣审核拒绝', '样衣审核通过'].includes(status)
  const seedBossIdentity = getSeedBossIdentity(seed, status, hasSubmitted, hasReviewed)
  const nodeLogs: FactorySampleVerificationNodeLog[] = [
    createSampleNodeLog({ seed, nodeName: '平台发放样衣', nodeStatus: '已完成', enteredAt: issuedAt, leftAt: issuedAt, operator: '平台样衣员', remark: '平台已登记并发放样衣。' }),
    createSampleNodeLog({ seed, nodeName: '工厂确认收样', nodeStatus: hasReceived ? '已完成' : '进行中', enteredAt: issuedAt, leftAt: hasReceived ? receiveAt : undefined, operator: application.applicantName, remark: hasReceived ? '工厂已确认收到样衣。' : '等待工厂确认收样。' }),
  ]
  if (hasReceived) {
    nodeLogs.push(createSampleNodeLog({ seed, nodeName: '工厂提交样衣审核', nodeStatus: hasSubmitted ? '已完成' : '进行中', enteredAt: receiveAt, leftAt: hasSubmitted ? submitAt : undefined, operator: application.applicantName, remark: hasSubmitted ? '工厂已提交样衣审核资料。' : '等待工厂提交样衣审核资料。' }))
  }
  if (hasSubmitted) {
    nodeLogs.push(createSampleNodeLog({ seed, nodeName: '平台审核样衣', nodeStatus: status === '待平台审核样衣' ? '进行中' : hasReviewed ? '已完成' : '未开始', enteredAt: submitAt, leftAt: hasReviewed ? reviewAt : undefined, operator: '平台样衣审核员', remark: status === '待平台审核样衣' ? '等待平台审核样衣。' : status === '样衣审核退回' ? '样衣审核未通过，等待工厂重新提交。' : status === '样衣审核拒绝' ? '历史样衣审核记录已终止。' : '平台样衣审核已通过。' }))
  }
  if (status === '样衣审核拒绝' || status === '样衣审核通过') {
    nodeLogs.push(createSampleNodeLog({ seed, nodeName: '样衣验证完成', nodeStatus: '已完成', enteredAt: reviewAt, leftAt: reviewAt, operator: '平台样衣审核员', remark: status === '样衣审核拒绝' ? '样衣验证终止。' : '样衣验证通过，等待转正式合作。' }))
  }

  const actionLogs: FactorySampleVerificationActionLog[] = [
    createSampleActionLog({ seed, seq: 1, actionName: '平台登记并发放样衣', nodeName: '平台发放样衣', operator: '平台样衣员', operatedAt: issuedAt, toStatus: '待工厂确认收样', toNode: '工厂确认收样', remark: '根据平台初审通过结果登记并发放样衣。' }),
  ]
  if (hasReceived) {
    actionLogs.push(createSampleActionLog({ seed, seq: 2, actionName: '工厂确认收到样衣', nodeName: '工厂确认收样', operator: application.applicantName, operatedAt: receiveAt, fromStatus: '待工厂确认收样', toStatus: '待工厂提交样衣审核', fromNode: '工厂确认收样', toNode: '工厂提交样衣审核', remark: '工厂已确认收到样衣，等待提交审核资料。' }))
  }
  if (hasSubmitted) {
    actionLogs.push(createSampleActionLog({ seed, seq: 3, actionName: '工厂提交样衣审核', nodeName: '工厂提交样衣审核', operator: application.applicantName, operatedAt: submitAt, fromStatus: '待工厂提交样衣审核', toStatus: '待平台审核样衣', fromNode: '工厂提交样衣审核', toNode: '平台审核样衣', remark: '工厂提交样衣审核资料，等待平台审核。' }))
  }
  if (status === '样衣审核退回') {
    actionLogs.push(createSampleActionLog({ seed, seq: 4, actionName: '样衣审核未通过', nodeName: '平台审核样衣', operator: '平台样衣审核员', operatedAt: reviewAt, fromStatus: '待平台审核样衣', toStatus: '样衣审核退回', fromNode: '平台审核样衣', toNode: '工厂提交样衣审核', remark: '样衣审核未通过，需补充重新提交。' }))
  }
  if (status === '样衣审核拒绝') {
    actionLogs.push(createSampleActionLog({ seed, seq: 4, actionName: '样衣审核未通过', nodeName: '平台审核样衣', operator: '平台样衣审核员', operatedAt: reviewAt, fromStatus: '待平台审核样衣', toStatus: '样衣审核拒绝', fromNode: '平台审核样衣', toNode: '样衣验证完成', remark: '历史样衣审核记录已终止。' }))
  }
  if (status === '样衣审核通过') {
    actionLogs.push(createSampleActionLog({
      seed,
      seq: 4,
      actionName: '平台样衣审核通过',
      nodeName: '平台审核样衣',
      operator: '平台样衣审核员',
      operatedAt: reviewAt,
      fromStatus: '待平台审核样衣',
      toStatus: '样衣审核通过',
      fromNode: '平台审核样衣',
      toNode: '样衣验证完成',
      remark: '样衣审核通过，等待平台转正式合作。',
    }))
  }
  const sampleReviewRecords = status === '样衣审核退回' || status === '样衣审核拒绝' || status === '样衣审核通过'
    ? Array.from({ length: status === '样衣审核退回' ? 2 : 1 }, (_, index) => {
        const roundNo = index + 1
        const result = status === '样衣审核通过'
          ? '已通过'
          : '未通过'
        return {
          sampleReviewId: `SV-REV-${seed}-${roundNo}`,
          sampleReviewRoundNo: roundNo,
          sampleReviewResult: result,
          sampleReviewOpinion: status === '样衣审核退回'
            ? roundNo === 1
              ? '首轮样衣视频角度不足，请补充关键工艺细节。'
              : '样衣照片角度不足，请补充细节照片后重新提交。'
            : status === '样衣审核拒绝'
              ? '样衣质量稳定性不符合当前合作要求。'
              : '样衣质量和工艺表现符合要求。',
          resubmitAllowed: result === '未通过',
          requiredResubmitItems: result === '未通过' ? ['样衣照片', '样衣视频'] : [],
          reviewer: '平台样衣审核员',
          reviewedAt: roundNo === 1 && status === '样衣审核退回' ? `2026-05-${String((seed % 6) + 5).padStart(2, '0')} 18:${String((seed * 7) % 60).padStart(2, '0')}:00` : reviewAt,
          fromStatus: '待平台审核样衣' as FactorySampleVerificationStatus,
          toStatus: status,
          fromNode: '平台审核样衣' as FactorySampleVerificationNode,
          toNode: status === '样衣审核退回' ? '工厂提交样衣审核' as FactorySampleVerificationNode : '样衣验证完成' as FactorySampleVerificationNode,
          relatedSubmissionRoundNo: roundNo,
          sampleQualityConclusion: status === '样衣审核通过' ? '达标' : status === '样衣审核拒绝' ? '不达标' : '基本达标',
          capacityConclusion: status === '样衣审核通过' ? '具备合作能力' : status === '样衣审核拒绝' ? '不具备合作能力' : '需补充验证',
          bossIdentityNoAtReview: seedBossIdentity.bossIdentityNo,
          bossIdentityFilesAtReview: seedBossIdentity.bossIdentityFiles.map(cloneReferenceFile),
          bossIdentitySourceAtReview: seedBossIdentity.bossIdentitySource,
          bossIdentityCompletedByReviewer: seedBossIdentity.bossIdentityCompletedBy || (status === '样衣审核通过' ? '平台样衣审核员' : undefined),
          remark: status === '样衣审核退回' ? '允许工厂按退回项重新提交。' : undefined,
        } satisfies FactorySampleReviewRecord
      })
    : []
  const factorySamplePhotos = hasSubmitted ? [createFactorySubmissionFile(seed, 'photo', 1), createFactorySubmissionFile(seed, 'photo', 2)] : []
  const factorySampleVideos = hasSubmitted ? [createFactorySubmissionFile(seed, 'video', 1)] : []
  const factorySubmissionFiles = hasSubmitted && seed % 2 === 0 ? [createFactorySubmissionFile(seed, 'file', 1)] : []
  const factorySitePhotos = hasSubmitted ? [createFactorySubmissionFile(seed, 'sitePhoto', 1), createFactorySubmissionFile(seed, 'sitePhoto', 2)] : []
  const factorySiteVideos = hasSubmitted ? [createFactorySubmissionFile(seed, 'siteVideo', 1)] : []

  return {
    verificationId: buildVerificationId(seed),
    verificationNo: buildVerificationNo(seed, issuedAt),
    applicationId: application.applicationId,
    applicationNo: application.applicationNo,
    factoryTempId: application.factoryTempId,
    factoryCompanyName: application.factoryCompanyName,
    applicantName: application.applicantName,
    mobileOrWhatsapp: application.mobileOrWhatsapp,
    sampleBatchNo: `SY-20260506-${String(seed).padStart(3, '0')}`,
    styleNo: `HG-SAMPLE-${String(seed).padStart(3, '0')}`,
    sampleName: seed % 2 === 0 ? '针织上衣验证样' : '梭织短裤验证样',
    sampleDescription: '用于验证工厂当前工序工艺能力、质量稳定性和交期配合度。',
    verificationPurpose: getSeedPurposes(seed),
    sampleQuantity: 2 + (seed % 4),
    issueMethod,
    courierCompany: issueMethod === '快递发放' ? (seed % 2 === 0 ? '顺丰国际' : 'JNE') : undefined,
    trackingNo: issueMethod === '快递发放' ? `EXP${String(202605060000 + seed)}` : undefined,
    issuedAt,
    issuedBy: '平台样衣员',
    expectedReceiveAt: receiveAt,
    expectedSubmitAt,
    platformReferenceFiles: seed >= 19 ? [createReferenceFile(seed, 'file')] : [],
    platformReferencePhotos: [createReferenceFile(seed, 'photo')],
    platformReferenceVideos: seed >= 19 ? [createReferenceFile(seed, 'video')] : [],
    status,
    currentNode,
    factoryReceivedAt: hasReceived ? receiveAt : undefined,
    factoryReceivedBy: hasReceived ? application.applicantName : undefined,
    factoryReceiveRemark: hasReceived ? '样衣已收到，包装完整。' : undefined,
    receiveActionCount: hasReceived ? 1 : 0,
    factorySubmittedAt: hasSubmitted ? submitAt : undefined,
    factorySubmittedBy: hasSubmitted ? application.applicantName : undefined,
    factorySamplePhotos,
    factorySampleVideos,
    factoryCraftDescription: hasSubmitted ? '按平台参考资料完成车缝、后道和质量自检，关键部位已做加固处理。' : undefined,
    factoryProblemDescription: hasSubmitted && seed % 2 === 0 ? '袖口细节第一次返修后已重新整理。' : undefined,
    factorySubmitRemark: hasSubmitted ? '请平台审核样衣照片、视频和工艺说明。' : undefined,
    factorySubmissionRoundNo: hasSubmitted ? status === '样衣审核退回' ? 2 : 1 : 0,
    factorySubmissionFiles,
    factorySitePhotos,
    factorySiteVideos,
    bossIdentityNo: seedBossIdentity.bossIdentityNo,
    bossIdentityFiles: seedBossIdentity.bossIdentityFiles.map(cloneReferenceFile),
    bossIdentitySource: seedBossIdentity.bossIdentitySource,
    bossIdentityCompletedAt: seedBossIdentity.bossIdentityCompletedAt,
    bossIdentityCompletedBy: seedBossIdentity.bossIdentityCompletedBy,
    submissionActionCount: hasSubmitted ? status === '样衣审核退回' ? 2 : 1 : 0,
    platformSampleReviewedAt: hasReviewed ? reviewAt : undefined,
    sampleReviewRecords,
    nodeLogs,
    actionLogs,
    createdAt: issuedAt,
    updatedAt: hasReviewed ? reviewAt : hasSubmitted ? submitAt : hasReceived ? receiveAt : issuedAt,
  }
}

function createSeedSampleVerifications(): FactorySampleVerification[] {
  return Array.from({ length: 18 }, (_, index) => index + 16).map(createSeedSampleVerification)
}

function ensureSampleVerificationStore(): FactorySampleVerification[] {
  if (cachedSampleVerifications) return cachedSampleVerifications
  const stored = readStoredJson<FactorySampleVerification[]>(SAMPLE_VERIFICATION_STORE_KEY)
  if (Array.isArray(stored) && stored.length > 0) {
    cachedSampleVerifications = stored.map(cloneSampleVerification)
    return cachedSampleVerifications
  }
  cachedSampleVerifications = createSeedSampleVerifications()
  writeStoredJson(SAMPLE_VERIFICATION_STORE_KEY, cachedSampleVerifications)
  return cachedSampleVerifications
}

function persistSampleVerifications(items: FactorySampleVerification[]): void {
  cachedSampleVerifications = items.map(cloneSampleVerification)
  writeStoredJson(SAMPLE_VERIFICATION_STORE_KEY, cachedSampleVerifications)
}

export function listSampleVerifications(): FactorySampleVerification[] {
  return ensureSampleVerificationStore().map(cloneSampleVerification)
}

export function getSampleVerificationById(verificationId: string): FactorySampleVerification | null {
  const matched = ensureSampleVerificationStore().find((item) => item.verificationId === verificationId)
  return matched ? cloneSampleVerification(matched) : null
}

export function getSampleVerificationByApplicationId(applicationId: string): FactorySampleVerification | null {
  const matched = ensureSampleVerificationStore()
    .filter((item) => item.applicationId === applicationId)
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0]
  return matched ? cloneSampleVerification(matched) : null
}

export function createSampleVerificationFromOnboarding(
  application: FactoryOnboardingApplication,
  payload: FactorySampleIssuePayload,
): FactorySampleVerification {
  const operatedAt = payload.issuedAt || nowTimestamp()
  const existing = getSampleVerificationByApplicationId(application.applicationId)
  if (existing) return existing
  const idSeed = Date.now()
  const verification: FactorySampleVerification = {
    verificationId: buildVerificationId(idSeed),
    verificationNo: buildVerificationNo(idSeed, operatedAt),
    applicationId: application.applicationId,
    applicationNo: application.applicationNo,
    factoryTempId: application.factoryTempId,
    factoryCompanyName: application.factoryCompanyName,
    applicantName: application.applicantName,
    mobileOrWhatsapp: application.mobileOrWhatsapp,
    sampleBatchNo: payload.sampleBatchNo.trim(),
    styleNo: payload.styleNo.trim(),
    sampleName: payload.sampleName.trim(),
    sampleDescription: payload.sampleDescription.trim(),
    verificationPurpose: [...payload.verificationPurpose],
    sampleQuantity: Number(payload.sampleQuantity),
    issueMethod: payload.issueMethod as FactorySampleIssueMethod,
    courierCompany: payload.courierCompany?.trim() || undefined,
    trackingNo: payload.trackingNo?.trim() || undefined,
    issuedAt: operatedAt,
    issuedBy: payload.issuedBy.trim(),
    expectedReceiveAt: payload.expectedReceiveAt?.trim() || undefined,
    expectedSubmitAt: payload.expectedSubmitAt,
    platformReferenceFiles: payload.platformReferenceFiles.map(cloneReferenceFile),
    platformReferencePhotos: payload.platformReferencePhotos.map(cloneReferenceFile),
    platformReferenceVideos: payload.platformReferenceVideos.map(cloneReferenceFile),
    status: '待工厂确认收样',
    currentNode: '工厂确认收样',
    factoryReceivedAt: undefined,
    factoryReceivedBy: undefined,
    factoryReceiveRemark: undefined,
    receiveActionCount: 0,
    factorySubmittedAt: undefined,
    factorySubmittedBy: undefined,
    factorySamplePhotos: [],
    factorySampleVideos: [],
    factoryCraftDescription: undefined,
    factoryProblemDescription: undefined,
    factorySubmitRemark: undefined,
    factorySubmissionRoundNo: 0,
    factorySubmissionFiles: [],
    factorySitePhotos: [],
    factorySiteVideos: [],
    bossIdentityNo: undefined,
    bossIdentityFiles: [],
    bossIdentitySource: undefined,
    bossIdentityCompletedAt: undefined,
    bossIdentityCompletedBy: undefined,
    submissionActionCount: 0,
    platformSampleReviewedAt: undefined,
    sampleReviewRecords: [],
    nodeLogs: [
      createSampleNodeLog({ seed: idSeed, nodeName: '平台发放样衣', nodeStatus: '已完成', enteredAt: operatedAt, leftAt: operatedAt, operator: payload.issuedBy.trim(), remark: '平台登记并发放样衣。' }),
      createSampleNodeLog({ seed: idSeed, nodeName: '工厂确认收样', nodeStatus: '进行中', enteredAt: operatedAt, operator: application.applicantName, remark: '等待工厂确认收样。' }),
    ],
    actionLogs: [
      createSampleActionLog({ seed: idSeed, seq: 1, actionName: '平台登记并发放样衣', nodeName: '平台发放样衣', operator: payload.issuedBy.trim(), operatedAt, toStatus: '待工厂确认收样', toNode: '工厂确认收样', remark: '从入驻申请带出工厂资料并发放样衣。' }),
    ],
    createdAt: operatedAt,
    updatedAt: operatedAt,
  }
  persistSampleVerifications([verification, ...ensureSampleVerificationStore()])
  return cloneSampleVerification(verification)
}

export function updateSampleVerification(verificationId: string, patch: Partial<FactorySampleVerification>): FactorySampleVerification | null {
  const store = ensureSampleVerificationStore()
  const index = store.findIndex((item) => item.verificationId === verificationId)
  if (index < 0) return null
  const next = cloneSampleVerification({
    ...store[index],
    ...patch,
    verificationPurpose: patch.verificationPurpose ? [...patch.verificationPurpose] : store[index].verificationPurpose,
    platformReferenceFiles: patch.platformReferenceFiles ? patch.platformReferenceFiles.map(cloneReferenceFile) : store[index].platformReferenceFiles,
    platformReferencePhotos: patch.platformReferencePhotos ? patch.platformReferencePhotos.map(cloneReferenceFile) : store[index].platformReferencePhotos,
    platformReferenceVideos: patch.platformReferenceVideos ? patch.platformReferenceVideos.map(cloneReferenceFile) : store[index].platformReferenceVideos,
    factorySamplePhotos: patch.factorySamplePhotos ? patch.factorySamplePhotos.map(cloneReferenceFile) : (store[index].factorySamplePhotos || []),
    factorySampleVideos: patch.factorySampleVideos ? patch.factorySampleVideos.map(cloneReferenceFile) : (store[index].factorySampleVideos || []),
    factorySubmissionFiles: patch.factorySubmissionFiles ? patch.factorySubmissionFiles.map(cloneReferenceFile) : (store[index].factorySubmissionFiles || []),
    factorySitePhotos: patch.factorySitePhotos ? patch.factorySitePhotos.map(cloneReferenceFile) : (store[index].factorySitePhotos || []),
    factorySiteVideos: patch.factorySiteVideos ? patch.factorySiteVideos.map(cloneReferenceFile) : (store[index].factorySiteVideos || []),
    bossIdentityFiles: patch.bossIdentityFiles ? patch.bossIdentityFiles.map(cloneReferenceFile) : (store[index].bossIdentityFiles || []),
    updatedAt: patch.updatedAt || nowTimestamp(),
  })
  const updated = [...store]
  updated[index] = next
  persistSampleVerifications(updated)
  return cloneSampleVerification(next)
}
