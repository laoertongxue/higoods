export type FactoryOnboardingPpicStatus = '启用' | '停用'
export type FactoryOnboardingPpicRole = 'MEMBER' | 'TEAM_LEADER'

export interface FactoryOnboardingPpicOption {
  ppicId: string
  ppicName: string
  mobilePhone: string
  status: FactoryOnboardingPpicStatus
  role: FactoryOnboardingPpicRole
}

const PPIC_TEAM_MEMBER_NAMES = [
  '王芳', '张倩', '陈琳', '刘婷', '周敏', '吴静', '赵欣', '孙悦', '黄丽', '徐佳',
  '郑雪', '何娜', '郭慧', '罗丹', '宋燕', '谢琴', '唐洁', '冯霞', '邓颖',
] as const

const PPIC_TEAM_MEMBER_OPTIONS: FactoryOnboardingPpicOption[] = PPIC_TEAM_MEMBER_NAMES.map((ppicName, index) => ({
  ppicId: `PPIC-ACTIVE-${String(index + 4).padStart(3, '0')}`,
  ppicName,
  mobilePhone: `1380000${String(index + 4).padStart(4, '0')}`,
  status: '启用',
  role: 'MEMBER',
}))

export const PPIC_TEAM_LEADER_LINGYUN: FactoryOnboardingPpicOption = {
  ppicId: 'PPIC-LEADER-LINGYUN',
  ppicName: '凌云',
  mobilePhone: '13800000000',
  status: '启用',
  role: 'TEAM_LEADER',
}

export const PPIC_TEAM_LEADER_JIEGE: FactoryOnboardingPpicOption = {
  ppicId: 'PPIC-LEADER-JIEGE',
  ppicName: '婕哥',
  mobilePhone: '13800000001',
  status: '启用',
  role: 'TEAM_LEADER',
}

export const FACTORY_ONBOARDING_PPIC_OPTIONS: FactoryOnboardingPpicOption[] = [
  PPIC_TEAM_LEADER_LINGYUN,
  PPIC_TEAM_LEADER_JIEGE,
  {
    ppicId: 'PPIC-ACTIVE-002',
    ppicName: '李敏 PPIC',
    mobilePhone: '13800000002',
    status: '启用',
    role: 'MEMBER',
  },
  ...PPIC_TEAM_MEMBER_OPTIONS,
  {
    ppicId: 'PPIC-STOP-003',
    ppicName: '停用 PPIC',
    mobilePhone: '13800000003',
    status: '停用',
    role: 'MEMBER',
  },
]

/**
 * The onboarding flow still needs a deterministic assignee in this prototype,
 * but it must be a real, enabled team member rather than a placeholder identity.
 */
export const DEFAULT_FACTORY_ONBOARDING_PPIC = FACTORY_ONBOARDING_PPIC_OPTIONS.find((item) => item.ppicId === 'PPIC-ACTIVE-004')!

export const SEWING_OUTSOURCING_DEMO_CURRENT_PPIC = FACTORY_ONBOARDING_PPIC_OPTIONS.find((item) => item.ppicId === 'PPIC-ACTIVE-006')!

export function getAvailableOnboardingPpicOptions(): FactoryOnboardingPpicOption[] {
  return FACTORY_ONBOARDING_PPIC_OPTIONS.filter((item) => item.status === '启用').map((item) => ({ ...item }))
}

export function getOnboardingPpicOptionById(ppicId: string): FactoryOnboardingPpicOption | null {
  const matched = FACTORY_ONBOARDING_PPIC_OPTIONS.find((item) => item.ppicId === ppicId)
  return matched ? { ...matched } : null
}

export function getOnboardingPpicName(ppicId: string): string {
  return getOnboardingPpicOptionById(ppicId)?.ppicName || ''
}

export function isActivePpicTeamLeader(ppicId: string): boolean {
  const matched = getOnboardingPpicOptionById(ppicId)
  return matched?.status === '启用' && matched.role === 'TEAM_LEADER'
}
