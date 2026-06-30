import { KOL_GOTO_FACTORY_ID, TEST_FACTORY_ID, mockFactories } from './factory-mock-data.ts'
import {
  getBrowserLocalStorage,
  readBrowserStorageItem,
  writeBrowserStorageItem,
} from '../browser-storage.ts'
import { DEFAULT_FACTORY_ONBOARDING_PPIC } from './factory-onboarding-ppic.ts'
import type { Factory } from './factory-types.ts'

const FACTORY_MASTER_STORE_KEY = 'fcs_factory_master_store_v1'

function cloneTaskAcceptanceConfig(config: Factory['taskAcceptanceConfig']): Factory['taskAcceptanceConfig'] {
  if (!config) return undefined
  return {
    singleProcessEnabled: config.singleProcessEnabled,
    continuousProcessEnabled: config.continuousProcessEnabled,
    wholeOrderEnabled: config.wholeOrderEnabled,
    continuousRules: config.continuousRules.map((rule) => ({
      ...rule,
      coveredProcessCodes: [...rule.coveredProcessCodes],
      coveredCraftCodes: rule.coveredCraftCodes ? [...rule.coveredCraftCodes] : undefined,
      applicableSaleTypes: [...rule.applicableSaleTypes],
      excludedProcessCodes: [...rule.excludedProcessCodes],
    })),
    wholeOrderRule: config.wholeOrderRule
      ? {
          ...config.wholeOrderRule,
          applicableSaleTypes: [...config.wholeOrderRule.applicableSaleTypes],
          excludedProcessCodes: [...config.wholeOrderRule.excludedProcessCodes],
        }
      : undefined,
  }
}

function stripLegacyWholeOrderConfig(factory: Factory): Factory {
  if (!factory.taskAcceptanceConfig) return factory
  if (!['ID-F002', 'ID-F005', 'ID-F011'].includes(factory.id)) return factory
  return {
    ...factory,
    taskAcceptanceConfig: {
      ...factory.taskAcceptanceConfig,
      wholeOrderEnabled: false,
      wholeOrderRule: undefined,
    },
  }
}

function normalizeKolGotoFactoryProfile(factory: Factory): Factory {
  if (factory.id !== KOL_GOTO_FACTORY_ID) return factory
  return {
    ...factory,
    cooperationMode: 'general',
    factoryTier: 'THIRD_PARTY',
    factoryType: 'THIRD_SEWING',
  }
}

function withDefaultTaskAcceptanceConfig(factory: Factory): Factory {
  factory = stripLegacyWholeOrderConfig(normalizeKolGotoFactoryProfile(factory))
  if (factory.taskAcceptanceConfig) return factory
  if (factory.id === KOL_GOTO_FACTORY_ID) {
    return {
      ...factory,
      taskAcceptanceConfig: {
        singleProcessEnabled: true,
        continuousProcessEnabled: false,
        wholeOrderEnabled: true,
        continuousRules: [],
        wholeOrderRule: {
          enabled: true,
          applicableSaleTypes: ['KOL样衣', 'KOL样品小单'],
          excludedProcessCodes: ['PRINT', 'DYE'],
          defaultTaskName: 'KOL整单任务',
          allowRuleRecommendation: true,
          handoverReceiverKind: 'WAREHOUSE',
          handoverReceiverName: '仓库',
          pdaStepTemplateCode: 'SIMPLE_FIVE_STEP',
          remark: 'KOL 样衣和样品小单整单承接；印花、染色保持独立需求链路。',
        },
      },
    }
  }
  if (factory.id === 'ID-F014') {
    return {
      ...factory,
      taskAcceptanceConfig: {
        singleProcessEnabled: true,
        continuousProcessEnabled: true,
        wholeOrderEnabled: false,
        continuousRules: [{
          combinationId: 'combo-sew-post',
          combinationName: '车缝+后道',
          enabled: true,
          coveredProcessCodes: ['SEW', 'POST_FINISHING'],
          applicableSaleTypes: ['虾皮样品', 'JKT复购'],
          excludedProcessCodes: ['PRINT', 'DYE'],
          defaultTaskName: '车缝+后道组合任务',
          handoverReceiverKind: 'WAREHOUSE',
          handoverReceiverName: '仓库',
          pdaStepTemplateCode: 'SIMPLE_FIVE_STEP',
        }],
      },
    }
  }
  return {
    ...factory,
    taskAcceptanceConfig: {
      singleProcessEnabled: true,
      continuousProcessEnabled: false,
      wholeOrderEnabled: false,
      continuousRules: [],
    },
  }
}

function cloneFactory(factory: Factory): Factory {
  const normalizedFactory = withDefaultTaskAcceptanceConfig(factory)
  return {
    ...normalizedFactory,
    factoryShortName: normalizedFactory.factoryShortName || normalizedFactory.code || normalizedFactory.name,
    mobilePhone: normalizedFactory.mobilePhone || normalizedFactory.phone,
    inferredFactoryTypes: normalizedFactory.inferredFactoryTypes
      ? normalizedFactory.inferredFactoryTypes.map((item) => ({
          ...item,
          matchedCapabilities: [...item.matchedCapabilities],
        }))
      : undefined,
    identityFile: normalizedFactory.identityFile ? { ...normalizedFactory.identityFile } : normalizedFactory.identityFile,
    selectedCapabilities: normalizedFactory.selectedCapabilities ? normalizedFactory.selectedCapabilities.map((item) => ({ ...item })) : undefined,
    machines: normalizedFactory.machines ? normalizedFactory.machines.map((item) => ({ ...item })) : undefined,
    processAbilities: normalizedFactory.processAbilities.map((item) => ({
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
    eligibility: { ...normalizedFactory.eligibility },
    taskAcceptanceConfig: cloneTaskAcceptanceConfig(normalizedFactory.taskAcceptanceConfig),
  }
}

function createOnboardingOfficialSeedFactories(): Factory[] {
  return [34, 35, 36].map((seed, index) => {
    const craftName = index === 0 ? '定向裁' : index === 1 ? '定位裁' : '数码印'
    const processName = index === 2 ? '印花' : '裁片'
    const processCode = index === 2 ? 'PRINT' : 'CUT_PANEL'
    const craftCode = index === 2 ? 'DIGITAL_PRINT' : index === 0 ? 'DIRECTIONAL_CUT' : 'POSITION_CUT'
    const factoryId = `FACTORY-ONBOARD-${String(seed).padStart(4, '0')}`
    const applicationNo = `FON-${String(20260500 + seed).padStart(8, '0')}`
    const capability = {
      processCode,
      processName,
      craftCode,
      craftName,
      abilityScope: 'CRAFT' as const,
      canReceiveTask: true,
      capacityManaged: true,
      remark: '入驻转正式带入接单能力',
    }
    const machine = {
      machineId: `MCH-${seed}`,
      machineName: `${craftName}设备`,
      machineNo: `EQ-${seed}`,
      machineCount: index + 2,
      linkedProcessCode: processCode,
      linkedProcessName: processName,
      linkedCraftCode: craftCode,
      linkedCraftName: craftName,
      condition: '可用' as const,
      remark: '入驻转正式带入机器能力',
      validationStatus: '通过' as const,
      validationMessage: '校验通过',
    }
    return {
      id: factoryId,
      code: `FOF-${String(seed).padStart(4, '0')}`,
      name: `${craftName}演示工厂${seed}`,
      factoryShortName: `onboarding_${seed}`,
      address: `雅加达示范工业园 ${seed} 号楼 ${seed % 6 + 1} 层`,
      contact: `申请人${seed}`,
      mobilePhone: `+62-812-90${String(100000 + seed).slice(-6)}`,
      phone: `+62-812-90${String(100000 + seed).slice(-6)}`,
      status: 'active',
      cooperationMode: 'general',
      processAbilities: [{
        processCode,
        craftCodes: [craftCode],
        abilityId: `ONBOARDING-${seed}-${processCode}`,
        processName,
        craftNames: [craftName],
        abilityName: `${processName}/${craftName}`,
        abilityScope: 'CRAFT',
        canReceiveTask: true,
        capacityManaged: true,
        status: 'ACTIVE',
      }],
      qualityScore: 0,
      deliveryScore: 0,
      createdAt: '2026-05-09 16:00:00',
      updatedAt: '2026-05-09 16:00:00',
      factoryTier: 'CENTRAL',
      factoryType: index === 2 ? 'CENTRAL_PRINT' : 'CENTRAL_CUTTING',
      pdaEnabled: true,
      pdaTenantId: factoryId,
      onboardingApplicationId: `FOA-${String(seed).padStart(4, '0')}`,
      onboardingApplicationNo: applicationNo,
      sourceChannel: seed % 3 === 0 ? 'PPIC 转介绍' : seed % 3 === 1 ? '平台招商消息' : '合作工厂推荐',
      ppicName: `PPIC-${seed}`,
      assignedPpicId: DEFAULT_FACTORY_ONBOARDING_PPIC.ppicId,
      assignedPpicName: DEFAULT_FACTORY_ONBOARDING_PPIC.ppicName,
      assignedPpicPhone: DEFAULT_FACTORY_ONBOARDING_PPIC.mobilePhone,
      identityNo: seed % 2 === 0 ? `ID-${String(3200000000000000 + seed)}` : `P-${String(88000000 + seed)}`,
      identityFile: {
        fileId: `IDF-${String(seed).padStart(4, '0')}`,
        fileName: `身份文件-${String(seed).padStart(4, '0')}.jpg`,
        fileType: 'jpg',
        fileSizeMb: 3,
        uploadedAt: '2026-05-06 08:30:00',
      },
      machineTotalCount: machine.machineCount,
      effectiveWorkerCount: 18 + seed,
      availableStartDate: `2026-05-${String((seed % 9) + 10).padStart(2, '0')}`,
      selectedCapabilities: [capability],
      machines: [machine],
      sampleVerificationId: `SV-${String(seed).padStart(4, '0')}`,
      sampleStatus: '已转正式合作',
      eligibility: {
        allowDispatch: true,
        allowBid: true,
        allowExecute: true,
        allowSettle: true,
      },
    }
  })
}

function mergeSeedFactories(factories: Factory[]): Factory[] {
  const existingIds = new Set(factories.map((factory) => factory.id))
  const missingMockSeeds = mockFactories.filter((factory) => !existingIds.has(factory.id))
  missingMockSeeds.forEach((factory) => existingIds.add(factory.id))
  const missingOfficialSeeds = createOnboardingOfficialSeedFactories().filter((factory) => !existingIds.has(factory.id))
  return [...factories, ...missingMockSeeds, ...missingOfficialSeeds]
}

function loadFactoryMasterRecords(): Factory[] {
  const storage = getBrowserLocalStorage()
  const stored = readBrowserStorageItem(storage, FACTORY_MASTER_STORE_KEY)
  if (!stored) {
    return mergeSeedFactories(mockFactories).map((factory) => cloneFactory(factory))
  }

  try {
    const parsed = JSON.parse(stored)
    if (!Array.isArray(parsed)) {
      return mergeSeedFactories(mockFactories).map((factory) => cloneFactory(factory))
    }
    return mergeSeedFactories(parsed as Factory[]).map((factory) => cloneFactory(factory))
  } catch {
    return mergeSeedFactories(mockFactories).map((factory) => cloneFactory(factory))
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
  return listFactoryMasterRecords().filter((factory) =>
    (includeTestFactories || !factory.isTestFactory)
    && factory.status === 'active'
    && factory.eligibility.allowDispatch,
  )
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
