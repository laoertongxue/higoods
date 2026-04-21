import fs from 'node:fs'
import path from 'node:path'

import {
  auditAllFactoryCapacityProfiles,
  listFactoryCapacityEntries,
  listFactoryCapacityProfiles,
  listFactoryCapacityProfileStoreIds,
  listFactoryDyeVatCapacities,
  listFactoryPostCapacityNodes,
  listFactoryPrintMachineCapacities,
} from '../src/data/fcs/factory-capacity-profile-mock.ts'
import { listFactoryMasterRecords } from '../src/data/fcs/factory-master-store.ts'

const ROOT = '/Users/laoer/Documents/higoods'
const PAGE_PATH = path.join(ROOT, 'src/pages/factory-capacity-profile.ts')
const PROFILE_PAGE_SOURCE = fs.readFileSync(PAGE_PATH, 'utf8')
const POST_NODE_CODES = ['BUTTONHOLE', 'BUTTON_ATTACH', 'IRONING', 'PACKAGING']

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message)
  }
}

const factories = listFactoryMasterRecords()
const profiles = listFactoryCapacityProfiles()
const profileStoreIds = listFactoryCapacityProfileStoreIds()
const auditIssues = auditAllFactoryCapacityProfiles()

assert(factories.length === profiles.length, '产能档案数量必须与工厂主数据数量一致')
assert(profileStoreIds.length === profiles.length, '产能档案缓存数量必须与当前 profile 数量一致')
assert(
  auditIssues.length === 0,
  `产能档案存在一致性问题：\n${auditIssues
    .map(
      (issue) =>
        `- [${issue.category}] ${issue.factoryName} / ${issue.processName} / ${issue.craftName}：${issue.detail}`,
    )
    .join('\n')}`,
)

const activeAbilities = factories.flatMap((factory) =>
  factory.processAbilities
    .filter((ability) => (ability.status ?? 'ACTIVE') !== 'DISABLED')
    .map((ability) => ({ factory, ability })),
)

assert(
  !activeAbilities.some(({ ability }) => ['WASHING', 'HARDWARE', 'FROG_BUTTON'].includes(ability.processCode)),
  '工厂能力中仍存在活跃 WASHING / HARDWARE / FROG_BUTTON',
)
assert(
  !activeAbilities.some(({ ability }) => POST_NODE_CODES.includes(ability.processCode)),
  '开扣眼 / 装扣子 / 熨烫 / 包装仍作为可派单能力存在',
)

const washAbilities = activeAbilities.filter(({ ability }) => ability.abilityName === '特殊工艺 - 洗水')
assert(washAbilities.length > 0, '缺少“特殊工艺 - 洗水”工厂能力')
assert(
  washAbilities.every(
    ({ ability }) =>
      ability.processCode === 'SPECIAL_CRAFT'
      && ability.canReceiveTask !== false
      && JSON.stringify(ability.craftNames ?? []) === JSON.stringify(['洗水']),
  ),
  '水洗能力没有收口为 SPECIAL_CRAFT 下的“特殊工艺 - 洗水”单工艺能力',
)

const washFactories = factories.filter((factory) => factory.factoryType === 'CENTRAL_DENIM_WASH')
assert(washFactories.length > 0, '缺少水洗工厂样例')
assert(
  washFactories.every((factory) =>
    factory.processAbilities.every((ability) =>
      ability.processCode !== 'SPECIAL_CRAFT' || JSON.stringify(ability.craftNames ?? []) === JSON.stringify(['洗水']),
    ),
  ),
  '水洗工厂误拥有洗水以外的特殊工艺能力',
)

const postFactories = factories.filter((factory) =>
  factory.processAbilities.some((ability) => ability.processCode === 'POST_FINISHING'),
)
assert(postFactories.length > 0, '缺少后道能力工厂样例')
assert(
  postFactories.every((factory) =>
    factory.processAbilities.some(
      (ability) =>
        ability.processCode === 'POST_FINISHING'
        && ability.abilityName === '后道'
        && ability.canReceiveTask === true
        && (ability.capacityNodeCodes?.length ?? 0) > 0
        && (ability.capacityNodeCodes ?? []).every((code) => POST_NODE_CODES.includes(code)),
    ),
  ),
  '后道能力没有统一为“后道”对外能力并挂载合法产能节点',
)
assert(
  postFactories.some((factory) =>
    factory.processAbilities.some(
      (ability) =>
        ability.processCode === 'POST_FINISHING'
        && JSON.stringify(ability.capacityNodeCodes ?? []) === JSON.stringify(POST_NODE_CODES),
    ),
  ),
  '缺少挂载完整四个后道产能节点的工厂样例',
)
assert(
  factories.some((factory) =>
    factory.factoryType === 'THIRD_SEWING'
    && factory.processAbilities.some(
      (ability) =>
        ability.processCode === 'POST_FINISHING'
        && JSON.stringify(ability.capacityNodeCodes ?? []) === JSON.stringify(['BUTTONHOLE', 'IRONING']),
    ),
  ),
  '缺少“车缝厂带部分后道节点”的能力样例',
)

const primaryPostFactory = postFactories[0]
const postNodes = listFactoryPostCapacityNodes(primaryPostFactory.id)
assert(postNodes.length === 4, `${primaryPostFactory.name} 的后道产能节点数量不正确`)
assert(
  postNodes.every(
    (node) =>
      node.machineCount > 0
      && (node.operatorCount ?? 0) > 0
      && node.shiftMinutes > 0
      && (node.efficiencyValue ?? 0) > 0,
  ),
  '后道产能节点缺少设备数、人员数、单班时长或标准效率',
)

const printMachines = listFactoryPrintMachineCapacities('ID-F002')
assert(printMachines.length > 0, '印花工厂缺少打印机产能档案')
assert(
  printMachines.every((row) => row.printerNo.trim() && row.speedValue > 0 && row.speedUnit.trim()),
  '印花打印机档案缺少打印机编号或打印速度',
)

const dyeVats = listFactoryDyeVatCapacities('ID-F003')
assert(dyeVats.length > 0, '染厂缺少染缸产能档案')
assert(
  dyeVats.every((row) => row.dyeVatNo.trim() && row.capacityQty > 0 && row.capacityUnit.trim()),
  '染缸档案缺少染缸编号或染缸容量',
)

const disabledLegacyAbilityCount = factories.flatMap((factory) => factory.processAbilities)
  .filter((ability) => ability.status === 'DISABLED' && ['HARDWARE', 'FROG_BUTTON', 'WASHING'].includes(ability.processCode))
  .length

const sampleEntries = listFactoryCapacityEntries(primaryPostFactory.id)
assert(
  sampleEntries.some(({ row }) => row.processCode === 'POST_FINISHING' && row.craftCode === 'BUTTONHOLE'),
  '后道产能节点没有进入工厂产能档案 entries',
)

assert(PROFILE_PAGE_SOURCE.includes('工厂产能档案'), '工厂产能档案页面标题未更新')
assert(PROFILE_PAGE_SOURCE.includes('接单能力'), '工厂产能档案页面缺少“接单能力”区块')
assert(PROFILE_PAGE_SOURCE.includes('产能节点'), '工厂产能档案页面缺少“产能节点”区块')
assert(PROFILE_PAGE_SOURCE.includes('印花打印机'), '工厂产能档案页面缺少“印花打印机”区块')
assert(PROFILE_PAGE_SOURCE.includes('染缸'), '工厂产能档案页面缺少“染缸”区块')
assert(!PROFILE_PAGE_SOURCE.includes('EXTERNAL_TASK'), '工厂产能档案页面仍直接显示 EXTERNAL_TASK')
assert(!PROFILE_PAGE_SOURCE.includes('INTERNAL_CAPACITY_NODE'), '工厂产能档案页面仍直接显示 INTERNAL_CAPACITY_NODE')
assert(!PROFILE_PAGE_SOURCE.includes('印花 PDA'), '工厂产能档案页面仍出现“印花 PDA”')
assert(!PROFILE_PAGE_SOURCE.includes('染色 PDA'), '工厂产能档案页面仍出现“染色 PDA”')

console.log(
  JSON.stringify(
    {
      factoryCount: factories.length,
      profileCount: profiles.length,
      washAbilityFactoryCount: washAbilities.length,
      postFactoryCount: postFactories.length,
      samplePostNodeCount: postNodes.length,
      printMachineCount: printMachines.length,
      dyeVatCount: dyeVats.length,
      disabledLegacyAbilityCount,
    },
    null,
    2,
  ),
)
