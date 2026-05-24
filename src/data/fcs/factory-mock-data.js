import { generateFactoryCode as genCode, indonesiaFactories, isFactoryPoolOrganization, } from './indonesia-factories.ts';
import { getProcessDefinitionByCode, listCraftsByProcessCode, listProcessDefinitions, } from './process-craft-dict.ts';
import { specialCraftDedicatedFactorySeeds } from './special-craft-dedicated-factories.ts';
const POST_CAPACITY_NODE_CODES = ['BUTTONHOLE', 'BUTTON_ATTACH', 'IRONING', 'PACKAGING'];
const DEDICATED_POST_ACTION_NAMES = ['质检', '后道', '复检'];
const BASIC_POST_ACTION_NAMES = ['后道'];
export const TEST_FACTORY_ID = 'F090';
export const TEST_FACTORY_CODE = 'F090';
export const TEST_FACTORY_NAME = '全能力测试工厂';
export const TEST_FACTORY_DISPLAY_NAME = `${TEST_FACTORY_NAME}（${TEST_FACTORY_CODE}）`;
export const TEST_FACTORY_SCOPE = 'ALL_PROCESS_CRAFT';
export const OWN_WOOL_FACTORY_ID = 'OWN_WOOL_FACTORY';
export const OWN_WOOL_FACTORY_CODE = 'WOOL-OWN-001';
export const OWN_WOOL_FACTORY_NAME = '周哥毛织厂';
export function formatFactoryDisplayName(factoryName, factoryCodeOrId) {
    const normalizedName = factoryName?.trim() || '';
    const normalizedCode = factoryCodeOrId?.trim() || '';
    if (!normalizedName && !normalizedCode)
        return '';
    if (normalizedName.includes(`（${TEST_FACTORY_CODE}）`))
        return normalizedName;
    if (normalizedName === TEST_FACTORY_NAME
        || normalizedCode === TEST_FACTORY_ID
        || normalizedCode === TEST_FACTORY_CODE
        || normalizedCode === 'ID-F090') {
        return TEST_FACTORY_DISPLAY_NAME;
    }
    return normalizedCode ? `${normalizedName || normalizedCode}（${normalizedCode}）` : normalizedName;
}
const legacyTagProcessMap = {
    印花: ['PRINT'],
    绣花: ['EMBROIDERY'],
    水洗: ['WASHING'],
    染色: ['DYE'],
    车缝: ['SEW'],
    后整: ['POST_FINISHING'],
};
const factoryTypeProcessMap = {
    CENTRAL_GARMENT: ['SEW'],
    CENTRAL_PRINT: ['PRINT'],
    CENTRAL_DYE: ['DYE'],
    CENTRAL_CUTTING: ['CUT_PANEL'],
    CENTRAL_SPECIAL: ['SPECIAL_CRAFT'],
    CENTRAL_AUX: ['POST_FINISHING', 'SPECIAL_CRAFT'],
    CENTRAL_LACE: ['POST_FINISHING'],
    CENTRAL_WOOL: ['SEW', 'PLEATING'],
    CENTRAL_DENIM_WASH: ['WASHING', 'SHRINKING'],
    SATELLITE_SEWING: ['SEW'],
    SATELLITE_FINISHING: ['POST_FINISHING', 'PLEATING', 'SPECIAL_CRAFT'],
    THIRD_SEWING: ['SEW'],
};
function createProcessAbility(processCode, options) {
    const process = getProcessDefinitionByCode(processCode);
    if (!process || !process.isActive)
        return null;
    if (processCode === 'POST_FINISHING') {
        const isDedicatedPostFactory = options?.factoryType === 'SATELLITE_FINISHING';
        return {
            processCode,
            craftCodes: [],
            capacityNodeCodes: [...POST_CAPACITY_NODE_CODES],
            abilityId: `ABILITY_${processCode}`,
            processName: process.processName,
            craftNames: [...(isDedicatedPostFactory ? DEDICATED_POST_ACTION_NAMES : BASIC_POST_ACTION_NAMES)],
            abilityName: process.processName,
            abilityScope: 'PROCESS',
            canReceiveTask: true,
            capacityManaged: true,
            status: 'ACTIVE',
        };
    }
    const crafts = listCraftsByProcessCode(processCode);
    const craftCodes = crafts.map((item) => item.craftCode);
    if (!craftCodes.length)
        return null;
    return {
        processCode,
        craftCodes,
        abilityId: `ABILITY_${processCode}`,
        processName: process.processName,
        craftNames: crafts.map((item) => item.craftName),
        abilityName: process.processName,
        abilityScope: craftCodes.length === 1 ? 'CRAFT' : 'PROCESS',
        canReceiveTask: process.generatesExternalTask,
        capacityManaged: process.capacityEnabled,
        status: process.isActive ? 'ACTIVE' : 'DISABLED',
    };
}
function buildProcessAbilities(tags, factoryType) {
    const processCodes = new Set();
    tags.forEach((tag) => {
        ;
        (legacyTagProcessMap[tag] ?? []).forEach((processCode) => processCodes.add(processCode));
    });
    (factoryTypeProcessMap[factoryType] ?? []).forEach((processCode) => processCodes.add(processCode));
    return [...processCodes]
        .map((processCode) => createProcessAbility(processCode, { tags, factoryType }))
        .filter((item) => Boolean(item));
}
function buildAllProcessAbilitiesForTestFactory() {
    const processCodes = listProcessDefinitions()
        .filter((process) => process.isActive && (process.generatesExternalTask || process.processCode === 'POST_FINISHING'))
        .map((process) => process.processCode);
    return processCodes
        .map((processCode) => createProcessAbility(processCode, { tags: [], factoryType: 'CENTRAL_AUX' }))
        .filter((item) => Boolean(item))
        .map((item) => ({
        ...item,
        craftCodes: [...item.craftCodes],
        capacityNodeCodes: item.capacityNodeCodes ? [...item.capacityNodeCodes] : undefined,
        craftNames: item.craftNames ? [...item.craftNames] : undefined,
        canReceiveTask: true,
        status: 'ACTIVE',
    }));
}
function adjustProcessAbilitiesForFactory(factoryId, abilities) {
    if (factoryId !== 'ID-F024')
        return abilities;
    return abilities.map((ability) => {
        if (ability.processCode !== 'POST_FINISHING')
            return ability;
        const capacityNodeCodes = ['BUTTONHOLE', 'IRONING'];
        return {
            ...ability,
            capacityNodeCodes,
            craftNames: [...BASIC_POST_ACTION_NAMES],
        };
    });
}
function mapStatus(status) {
    const statusMap = {
        ACTIVE: 'active',
        SUSPENDED: 'paused',
        BLACKLISTED: 'blacklist',
        INACTIVE: 'inactive',
    };
    return statusMap[status] || 'active';
}
function mapTier(tier) {
    if (tier === 'SATELLITE')
        return 'SATELLITE';
    if (tier === 'THIRD_PARTY')
        return 'THIRD_PARTY';
    return 'CENTRAL';
}
function mapType(tier, type, index) {
    const typeMap = {
        CENTRAL_FACTORY: 'CENTRAL_GARMENT',
        PRINTING: 'CENTRAL_PRINT',
        DYEING: 'CENTRAL_DYE',
        CUTTING: 'CENTRAL_CUTTING',
        AUX_PROCESS: 'CENTRAL_AUX',
        SPECIAL_PROCESS: 'CENTRAL_SPECIAL',
        TRIM_SUPPLIER: 'CENTRAL_LACE',
        WOOL: 'CENTRAL_WOOL',
        DENIM_WASH: 'CENTRAL_DENIM_WASH',
        POD: 'CENTRAL_POD',
        SATELLITE_CLUSTER: 'SATELLITE_SEWING',
        MICRO_SEWING: 'THIRD_SEWING',
    };
    if (tier === 'SATELLITE')
        return index % 2 === 0 ? 'SATELLITE_SEWING' : 'SATELLITE_FINISHING';
    if (tier === 'THIRD_PARTY')
        return 'THIRD_SEWING';
    return typeMap[type] || 'CENTRAL_GARMENT';
}
function getDefaultParentId(tier) {
    if (tier === 'SATELLITE' || tier === 'THIRD_PARTY')
        return 'ID-F001';
    return undefined;
}
const factoryPoolSourceRecords = indonesiaFactories.filter(isFactoryPoolOrganization);
const generatedFactories = factoryPoolSourceRecords.map((factory, index) => {
    const factoryTier = mapTier(factory.tier);
    const factoryType = mapType(factory.tier, factory.type, index);
    const processAbilities = adjustProcessAbilitiesForFactory(factory.id, buildProcessAbilities(factory.tags, factoryType));
    return {
        id: factory.id,
        code: factory.code,
        name: factory.name,
        address: `${factory.address}, ${factory.city}, ${factory.province}`,
        contact: factory.contactName,
        phone: factory.contactPhone,
        status: mapStatus(factory.status),
        cooperationMode: index % 3 === 0 ? 'exclusive' : index % 3 === 1 ? 'preferred' : 'general',
        processAbilities,
        qualityScore: factory.qualityScore,
        deliveryScore: factory.deliveryScore,
        createdAt: factory.createdAt,
        updatedAt: factory.updatedAt,
        factoryTier,
        factoryType,
        parentFactoryId: getDefaultParentId(factory.tier),
        pdaEnabled: true,
        pdaTenantId: factory.id,
        eligibility: {
            allowDispatch: factory.status === 'ACTIVE',
            allowBid: factory.status === 'ACTIVE',
            allowExecute: factory.status === 'ACTIVE',
            allowSettle: factory.status === 'ACTIVE' && (factory.hasSettlement ?? false),
        },
    };
});
const allProcessCraftTestFactory = {
    id: TEST_FACTORY_ID,
    code: TEST_FACTORY_CODE,
    name: TEST_FACTORY_NAME,
    address: 'Jakarta Test Lane 90, Jakarta, DKI Jakarta',
    contact: '联调负责人',
    phone: '+62 21 9000 0090',
    status: 'active',
    cooperationMode: 'general',
    processAbilities: buildAllProcessAbilitiesForTestFactory(),
    qualityScore: 100,
    deliveryScore: 100,
    createdAt: '2026-04-24 09:00:00',
    updatedAt: '2026-04-24 09:00:00',
    factoryTier: 'CENTRAL',
    factoryType: 'CENTRAL_AUX',
    pdaEnabled: true,
    pdaTenantId: TEST_FACTORY_ID,
    isTestFactory: true,
    testFactoryScope: TEST_FACTORY_SCOPE,
    eligibility: {
        allowDispatch: true,
        allowBid: true,
        allowExecute: true,
        allowSettle: true,
    },
};
const ownWoolFactory = {
    id: OWN_WOOL_FACTORY_ID,
    code: OWN_WOOL_FACTORY_CODE,
    name: OWN_WOOL_FACTORY_NAME,
    address: '浙江绍兴毛织园区 9 号楼',
    contact: '周哥',
    phone: '+86 138 0000 2605',
    status: 'active',
    cooperationMode: 'exclusive',
    processAbilities: [
        {
            processCode: 'PROC_WOOL',
            craftCodes: ['WHOLE_GARMENT_WOOL', 'PART_PANEL_WOOL'],
            abilityId: 'ABILITY_PROC_WOOL_OWN',
            processName: '毛织',
            craftNames: ['整件毛织', '部位毛织'],
            abilityName: '毛织 / 整件与部位',
            abilityScope: 'PROCESS',
            canReceiveTask: true,
            capacityManaged: true,
            status: 'ACTIVE',
        },
    ],
    qualityScore: 92,
    deliveryScore: 90,
    createdAt: '2026-05-09 09:00:00',
    updatedAt: '2026-05-09 09:00:00',
    factoryTier: 'CENTRAL',
    factoryType: 'CENTRAL_WOOL',
    pdaEnabled: true,
    pdaTenantId: OWN_WOOL_FACTORY_ID,
    eligibility: {
        allowDispatch: true,
        allowBid: false,
        allowExecute: true,
        allowSettle: true,
    },
};
export const specialCraftDedicatedFactories = specialCraftDedicatedFactorySeeds.map((seed) => {
    const processName = seed.managementDomain === 'AUXILIARY_CRAFT_FACTORY' ? '辅助工艺' : '特种工艺';
    return {
        id: seed.factoryId,
        code: seed.factoryCode,
        name: seed.factoryName,
        factoryShortName: seed.craftName,
        address: `印尼雅加达 ${seed.craftName}工艺园区`,
        contact: `${seed.craftName}负责人`,
        phone: '+62 21 8800 0001',
        status: 'active',
        cooperationMode: 'exclusive',
        processAbilities: [
            {
                processCode: 'SPECIAL_CRAFT',
                craftCodes: [seed.craftCode],
                abilityId: `ABILITY_${seed.factoryId}`,
                processName,
                craftNames: [seed.craftName],
                abilityName: `${seed.craftName}专属加工`,
                abilityScope: 'CRAFT',
                canReceiveTask: true,
                capacityManaged: true,
                status: 'ACTIVE',
            },
        ],
        qualityScore: 90,
        deliveryScore: 90,
        createdAt: '2026-05-21 09:00:00',
        updatedAt: '2026-05-21 09:00:00',
        factoryTier: 'CENTRAL',
        factoryType: seed.factoryType,
        pdaEnabled: true,
        pdaTenantId: seed.factoryId,
        eligibility: {
            allowDispatch: true,
            allowBid: false,
            allowExecute: true,
            allowSettle: true,
        },
    };
});
export const mockFactories = [
    ...generatedFactories,
    allProcessCraftTestFactory,
    ownWoolFactory,
    ...specialCraftDedicatedFactories,
];
export { genCode as generateFactoryCode };
