import type { FactoryOnboardingApplication } from './factory-onboarding-domain.ts'
import type {
  Factory,
  FactoryCapacityProfile,
  FactoryDyeVatCapacity,
  FactoryPrintMachineCapacity,
} from './factory-types.ts'

const equipmentProfiles = new Map<string, FactoryCapacityProfile>()

const printMachines: FactoryPrintMachineCapacity[] = [
  {
    printerId: 'EQUIP-ID-F002-PR01',
    factoryId: 'ID-F002',
    printerNo: 'PR-01',
    printerName: '印花打印机 A',
    speedValue: 180,
    speedUnit: '米/小时',
    shiftMinutes: 540,
    status: 'AVAILABLE',
    remark: '主线机台',
  },
  {
    printerId: 'EQUIP-ID-F002-PR02',
    factoryId: 'ID-F002',
    printerNo: 'PR-02',
    printerName: '印花打印机 B',
    speedValue: 120,
    speedUnit: '米/小时',
    shiftMinutes: 480,
    status: 'MAINTENANCE',
    remark: '当前做喷头保养',
  },
]

const dyeVats: FactoryDyeVatCapacity[] = [
  {
    dyeVatId: 'EQUIP-F090-VAT01',
    factoryId: 'F090',
    dyeVatNo: 'VAT-F090-01',
    capacityQty: 800,
    capacityUnit: 'kg/缸',
    supportedMaterialTypes: ['棉', '涤纶', '混纺'],
    shiftMinutes: 540,
    status: 'AVAILABLE',
    remark: '全能力测试工厂染色加工单执行样本。',
  },
  {
    dyeVatId: 'EQUIP-ID-F003-VAT01',
    factoryId: 'ID-F003',
    dyeVatNo: 'VAT-01',
    capacityQty: 650,
    capacityUnit: 'kg/缸',
    supportedMaterialTypes: ['毛织棉', '涤棉'],
    shiftMinutes: 540,
    status: 'AVAILABLE',
    remark: '常规深色批次',
  },
  {
    dyeVatId: 'EQUIP-ID-F003-VAT02',
    factoryId: 'ID-F003',
    dyeVatNo: 'VAT-02',
    capacityQty: 900,
    capacityUnit: 'kg/缸',
    supportedMaterialTypes: ['牛仔布', '厚磅梭织'],
    shiftMinutes: 600,
    status: 'FROZEN',
    remark: '当前等待排期释放',
  },
]

function cloneProfile(profile: FactoryCapacityProfile): FactoryCapacityProfile {
  return {
    ...profile,
    capabilityItems: profile.capabilityItems.map((item) => ({ ...item })),
    machineItems: profile.machineItems.map((item) => ({ ...item })),
  }
}

function buildEquipmentProfile(factory: Factory): FactoryCapacityProfile {
  const now = new Date().toISOString().slice(0, 19).replace('T', ' ')
  const capabilityItems = (factory.selectedCapabilities ?? []).map((item) => ({
    processCode: item.processCode,
    processName: item.processName,
    craftCode: item.craftCode,
    craftName: item.craftName,
    canReceiveTask: item.canReceiveTask,
    capacityManaged: item.capacityManaged,
  }))
  const known = new Set(capabilityItems.map((item) => `${item.processCode}::${item.craftCode}`))
  factory.processAbilities.forEach((ability) => {
    ability.craftCodes.forEach((craftCode) => {
      const key = `${ability.processCode}::${craftCode}`
      if (known.has(key)) return
      capabilityItems.push({
        processCode: ability.processCode,
        processName: ability.processName ?? ability.processCode,
        craftCode,
        craftName: ability.craftNames?.[ability.craftCodes.indexOf(craftCode)] ?? craftCode,
        canReceiveTask: ability.canReceiveTask !== false,
        capacityManaged: ability.capacityManaged !== false,
      })
      known.add(key)
    })
  })
  return {
    capacityProfileId: `FEP-${factory.id}`,
    factoryId: factory.id,
    factoryName: factory.name,
    factoryType: factory.factoryType,
    sourceApplicationId: factory.onboardingApplicationId,
    sourceApplicationNo: factory.onboardingApplicationNo,
    effectiveWorkerCount: factory.effectiveWorkerCount ?? 0,
    machineTotalCount: factory.machineTotalCount ?? 0,
    sewingSeatCount: factory.sewingSeatCount,
    capabilityItems,
    machineItems: (factory.machines ?? []).map((machine) => ({ ...machine })),
    createdAt: now,
    updatedAt: now,
  }
}

export function createInitialCapacityProfileFromOnboarding(
  _application: FactoryOnboardingApplication,
  createdFactory: Factory,
): FactoryCapacityProfile {
  const profile = buildEquipmentProfile(createdFactory)
  equipmentProfiles.set(createdFactory.id, cloneProfile(profile))
  return cloneProfile(profile)
}

export function listFactoryCapacityProfiles(): FactoryCapacityProfile[] {
  return [...equipmentProfiles.values()].map(cloneProfile)
}

export function getFactoryCapacityProfileByFactoryId(factoryId: string): FactoryCapacityProfile {
  const profile = equipmentProfiles.get(factoryId)
  if (!profile) throw new Error(`未找到工厂设备与人员档案：${factoryId}`)
  return cloneProfile(profile)
}

export function listFactoryPrintMachineCapacities(factoryId?: string): FactoryPrintMachineCapacity[] {
  return printMachines
    .filter((machine) => !factoryId || machine.factoryId === factoryId)
    .map((machine) => ({ ...machine }))
}

export function listFactoryDyeVatCapacities(factoryId?: string): FactoryDyeVatCapacity[] {
  return dyeVats
    .filter((vat) => !factoryId || vat.factoryId === factoryId)
    .map((vat) => ({ ...vat, supportedMaterialTypes: [...vat.supportedMaterialTypes] }))
}
