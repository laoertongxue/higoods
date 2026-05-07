export type FactoryOnboardingPpicStatus = '启用' | '停用'

export interface FactoryOnboardingPpicOption {
  ppicId: string
  ppicName: string
  mobilePhone: string
  status: FactoryOnboardingPpicStatus
}

export const FACTORY_ONBOARDING_PPIC_OPTIONS: FactoryOnboardingPpicOption[] = [
  {
    ppicId: 'PPIC-DEFAULT-001',
    ppicName: '默认跟进 PPIC',
    mobilePhone: '13800000001',
    status: '启用',
  },
  {
    ppicId: 'PPIC-ACTIVE-002',
    ppicName: '李敏 PPIC',
    mobilePhone: '13800000002',
    status: '启用',
  },
  {
    ppicId: 'PPIC-STOP-003',
    ppicName: '停用 PPIC',
    mobilePhone: '13800000003',
    status: '停用',
  },
]

export const DEFAULT_FACTORY_ONBOARDING_PPIC = FACTORY_ONBOARDING_PPIC_OPTIONS[0]

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
