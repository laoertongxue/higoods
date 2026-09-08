import { getCurrentSewingTaskResponsibility } from '../sewing-outsourcing-responsibility.ts'

export interface CuttingHandoverPpicOption {
  ppicId: string
  ppicName: string
  receiverFactoryId: string
  receiverFactoryName: string
  status: '启用' | '停用'
}

export function buildCuttingHandoverPpicOptions(input: {
  receiverFactoryId: string
  receiverFactoryName: string
  runtimeTaskId?: string
}): CuttingHandoverPpicOption[] {
  const factoryId = input.receiverFactoryId.trim()
  const factoryName = input.receiverFactoryName.trim()
  if (!factoryId || !factoryName) return []
  if (input.runtimeTaskId?.trim()) {
    const responsibility = getCurrentSewingTaskResponsibility(input.runtimeTaskId.trim())
    if (!responsibility || responsibility.factoryId !== factoryId) return []
    return [{
      ppicId: responsibility.ppicId,
      ppicName: responsibility.ppicName,
      receiverFactoryId: responsibility.factoryId,
      receiverFactoryName: responsibility.factoryName,
      status: '启用',
    }]
  }
  return []
}

export function assertCuttingHandoverPpic(input: {
  ppicId: string
  ppicName: string
  receiverFactoryId: string
  receiverFactoryName: string
  runtimeTaskId?: string
}): CuttingHandoverPpicOption {
  const matched = buildCuttingHandoverPpicOptions(input).find((item) =>
    item.ppicId === input.ppicId.trim()
    && item.ppicName === input.ppicName.trim()
    && item.status === '启用')
  if (!matched) throw new Error('请选择当前接收车缝工厂的有效 PPIC。')
  return matched
}
