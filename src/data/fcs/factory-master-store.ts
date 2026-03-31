import { mockFactories } from './factory-mock-data.ts'
import type { Factory } from './factory-types.ts'

function cloneFactory(factory: Factory): Factory {
  return {
    ...factory,
    processAbilities: factory.processAbilities.map((item) => ({
      processCode: item.processCode,
      craftCodes: [...item.craftCodes],
    })),
    eligibility: { ...factory.eligibility },
  }
}

let factoryMasterRecords: Factory[] = mockFactories.map((factory) => cloneFactory(factory))

export function listFactoryMasterRecords(): Factory[] {
  return factoryMasterRecords.map((factory) => cloneFactory(factory))
}

export function getFactoryMasterRecordById(factoryId: string): Factory | undefined {
  const factory = factoryMasterRecords.find((item) => item.id === factoryId)
  return factory ? cloneFactory(factory) : undefined
}

export function upsertFactoryMasterRecord(factory: Factory): void {
  const nextFactory = cloneFactory(factory)
  const currentIndex = factoryMasterRecords.findIndex((item) => item.id === nextFactory.id)

  if (currentIndex >= 0) {
    factoryMasterRecords = factoryMasterRecords.map((item, index) =>
      index === currentIndex ? nextFactory : item,
    )
    return
  }

  factoryMasterRecords = [nextFactory, ...factoryMasterRecords]
}

export function removeFactoryMasterRecord(factoryId: string): void {
  factoryMasterRecords = factoryMasterRecords.filter((item) => item.id !== factoryId)
}
