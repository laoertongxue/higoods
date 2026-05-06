import { TEST_FACTORY_ID, mockFactories } from './factory-mock-data.ts'
import {
  getBrowserLocalStorage,
  readBrowserStorageItem,
  writeBrowserStorageItem,
} from '../browser-storage.ts'
import type { Factory } from './factory-types.ts'

const FACTORY_MASTER_STORE_KEY = 'fcs_factory_master_store_v1'

function cloneFactory(factory: Factory): Factory {
  return {
    ...factory,
    inferredFactoryTypes: factory.inferredFactoryTypes
      ? factory.inferredFactoryTypes.map((item) => ({
          ...item,
          matchedCapabilities: [...item.matchedCapabilities],
        }))
      : undefined,
    processAbilities: factory.processAbilities.map((item) => ({
      processCode: item.processCode,
      craftCodes: [...item.craftCodes],
      capacityNodeCodes: item.capacityNodeCodes ? [...item.capacityNodeCodes] : undefined,
      abilityId: item.abilityId,
      processName: item.processName,
      craftNames: item.craftNames ? [...item.craftNames] : undefined,
      abilityName: item.abilityName,
      abilityScope: item.abilityScope,
      canReceiveTask: item.canReceiveTask,
      capacityManaged: item.capacityManaged,
      status: item.status,
      parentProcessCode: item.parentProcessCode,
    })),
    eligibility: { ...factory.eligibility },
  }
}

function loadFactoryMasterRecords(): Factory[] {
  const storage = getBrowserLocalStorage()
  const stored = readBrowserStorageItem(storage, FACTORY_MASTER_STORE_KEY)
  if (!stored) {
    return mockFactories.map((factory) => cloneFactory(factory))
  }

  try {
    const parsed = JSON.parse(stored)
    if (!Array.isArray(parsed)) {
      return mockFactories.map((factory) => cloneFactory(factory))
    }
    return parsed.map((factory) => cloneFactory(factory as Factory))
  } catch {
    return mockFactories.map((factory) => cloneFactory(factory))
  }
}

function persistFactoryMasterRecords(): void {
  writeBrowserStorageItem(
    getBrowserLocalStorage(),
    FACTORY_MASTER_STORE_KEY,
    JSON.stringify(factoryMasterRecords.map((factory) => cloneFactory(factory))),
  )
}

let factoryMasterRecords: Factory[] = loadFactoryMasterRecords()

export function listFactoryMasterRecords(): Factory[] {
  return factoryMasterRecords.map((factory) => cloneFactory(factory))
}

export function listBusinessFactoryMasterRecords(input: { includeTestFactories?: boolean } = {}): Factory[] {
  const includeTestFactories = input.includeTestFactories === true
  return listFactoryMasterRecords().filter((factory) => includeTestFactories || !factory.isTestFactory)
}

function isSewingFactory(factory: Factory): boolean {
  if (factory.status !== 'active') return false
  if (factory.processAbilities.some((item) => item.processCode === 'SEW')) return true
  return ['CENTRAL_GARMENT', 'SATELLITE_SEWING', 'THIRD_SEWING'].includes(factory.factoryType)
}

export function listSewingFactoryMasterRecords(): Factory[] {
  const sewingFactories = factoryMasterRecords.filter((factory) => isSewingFactory(factory))
  if (sewingFactories.length) {
    return sewingFactories.map((factory) => cloneFactory(factory))
  }
  return listFactoryMasterRecords()
}

export function getFactoryMasterRecordById(factoryId: string): Factory | undefined {
  const normalizedFactoryId = factoryId === 'ID-F090' ? TEST_FACTORY_ID : factoryId
  const factory = factoryMasterRecords.find((item) => item.id === normalizedFactoryId || item.code === normalizedFactoryId)
  return factory ? cloneFactory(factory) : undefined
}

export function upsertFactoryMasterRecord(factory: Factory): void {
  const nextFactory = cloneFactory(factory)
  const currentIndex = factoryMasterRecords.findIndex((item) => item.id === nextFactory.id)

  if (currentIndex >= 0) {
    factoryMasterRecords = factoryMasterRecords.map((item, index) =>
      index === currentIndex ? nextFactory : item,
    )
    persistFactoryMasterRecords()
    return
  }

  factoryMasterRecords = [nextFactory, ...factoryMasterRecords]
  persistFactoryMasterRecords()
}

export function removeFactoryMasterRecord(factoryId: string): void {
  factoryMasterRecords = factoryMasterRecords.filter((item) => item.id !== factoryId)
  persistFactoryMasterRecords()
}
