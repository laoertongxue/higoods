export interface CuttingHandoverPpicOption {
  ppicId: string
  ppicName: string
  receiverFactoryId: string
  receiverFactoryName: string
  status: '启用' | '停用'
}

const FACTORY_PPIC_NAMES = ['Ayu', 'Budi']

export function buildCuttingHandoverPpicOptions(input: {
  receiverFactoryId: string
  receiverFactoryName: string
}): CuttingHandoverPpicOption[] {
  const factoryId = input.receiverFactoryId.trim()
  const factoryName = input.receiverFactoryName.trim()
  if (!factoryId || !factoryName) return []
  return FACTORY_PPIC_NAMES.map((name, index) => ({
    ppicId: `CUTTING-PPIC-${factoryId}-${index + 1}`,
    ppicName: `${name} PPIC`,
    receiverFactoryId: factoryId,
    receiverFactoryName: factoryName,
    status: '启用',
  }))
}

export function assertCuttingHandoverPpic(input: {
  ppicId: string
  ppicName: string
  receiverFactoryId: string
  receiverFactoryName: string
}): CuttingHandoverPpicOption {
  const matched = buildCuttingHandoverPpicOptions(input).find((item) =>
    item.ppicId === input.ppicId.trim()
    && item.ppicName === input.ppicName.trim()
    && item.status === '启用')
  if (!matched) throw new Error('请选择当前接收车缝工厂的有效 PPIC。')
  return matched
}
