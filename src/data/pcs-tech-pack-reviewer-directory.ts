import type { TechnicalReviewRole } from './pcs-technical-data-version-types.ts'

export interface TechPackReviewer {
  reviewerId: string
  reviewerName: string
  roles: TechnicalReviewRole[]
  feishuOpenId: string
  departmentName: string
}

export interface FixedTechPackReviewers {
  buyerReviewer: TechPackReviewer
  patternMakerReviewer: TechPackReviewer
  merchandiserReviewer: TechPackReviewer
}

export const TECH_PACK_REVIEWERS: TechPackReviewer[] = [
  {
    reviewerId: 'U001',
    reviewerName: 'Budi Santoso',
    roles: ['买手', '版师', '跟单'],
    feishuOpenId: 'ou_budi_santoso',
    departmentName: '技术包审核组',
  },
  {
    reviewerId: 'BUYER-001',
    reviewerName: '买手A',
    roles: ['买手'],
    feishuOpenId: 'ou_buyer_zhang',
    departmentName: '买手组',
  },
  {
    reviewerId: 'PATTERN-001',
    reviewerName: '版师B',
    roles: ['版师'],
    feishuOpenId: 'ou_pattern_li',
    departmentName: '版房',
  },
  {
    reviewerId: 'MERCH-001',
    reviewerName: '跟单C',
    roles: ['跟单'],
    feishuOpenId: 'ou_merch_wang',
    departmentName: '跟单组',
  },
  {
    reviewerId: 'BUYER-UNBOUND',
    reviewerName: '未绑定飞书买手',
    roles: ['买手'],
    feishuOpenId: '',
    departmentName: '买手组',
  },
]

export const DEFAULT_TECH_PACK_REVIEWER_IDS: Record<TechnicalReviewRole, string> = {
  买手: 'U001',
  版师: 'U001',
  跟单: 'U001',
}

export const LEGACY_TECH_PACK_REVIEWER_IDS: Record<TechnicalReviewRole, string> = {
  买手: 'BUYER-001',
  版师: 'PATTERN-001',
  跟单: 'MERCH-001',
}

const STYLE_REVIEWER_ASSIGNMENT_IDS: Record<string, Record<TechnicalReviewRole, string>> = {
  DEFAULT: DEFAULT_TECH_PACK_REVIEWER_IDS,
}

export function listTechPackReviewersByRole(role: TechnicalReviewRole): TechPackReviewer[] {
  return TECH_PACK_REVIEWERS.filter((item) => item.roles.includes(role))
}

export function getTechPackReviewerById(reviewerId: string): TechPackReviewer | null {
  return TECH_PACK_REVIEWERS.find((item) => item.reviewerId === reviewerId) ?? null
}

export function getTechPackReviewerByName(reviewerName: string): TechPackReviewer | null {
  const normalized = reviewerName.trim()
  if (!normalized) return null
  return TECH_PACK_REVIEWERS.find((item) => item.reviewerName === normalized) ?? null
}

export function getDefaultTechPackReviewer(role: TechnicalReviewRole): TechPackReviewer {
  return getTechPackReviewerById(DEFAULT_TECH_PACK_REVIEWER_IDS[role]) ?? listTechPackReviewersByRole(role)[0]
}

export function getLegacyTechPackReviewer(role: TechnicalReviewRole): TechPackReviewer {
  return getTechPackReviewerById(LEGACY_TECH_PACK_REVIEWER_IDS[role]) ?? getDefaultTechPackReviewer(role)
}

export function getFixedTechPackReviewerIds(input?: {
  styleId?: string
  technicalVersionId?: string
}): Record<TechnicalReviewRole, string> {
  const styleAssignment = input?.styleId ? STYLE_REVIEWER_ASSIGNMENT_IDS[input.styleId] : null
  const versionAssignment = input?.technicalVersionId ? STYLE_REVIEWER_ASSIGNMENT_IDS[input.technicalVersionId] : null
  return versionAssignment || styleAssignment || STYLE_REVIEWER_ASSIGNMENT_IDS.DEFAULT
}

export function getFixedTechPackReviewers(input?: {
  styleId?: string
  technicalVersionId?: string
}): FixedTechPackReviewers {
  const assignment = getFixedTechPackReviewerIds(input)
  return {
    buyerReviewer: getTechPackReviewerById(assignment.买手) ?? getDefaultTechPackReviewer('买手'),
    patternMakerReviewer: getTechPackReviewerById(assignment.版师) ?? getDefaultTechPackReviewer('版师'),
    merchandiserReviewer: getTechPackReviewerById(assignment.跟单) ?? getDefaultTechPackReviewer('跟单'),
  }
}
