import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  auditAllFactoryCapacityProfiles,
  getFactoryCapacityEquipmentSummary,
  listFactoryCapacityEntries,
  listFactoryCapacityEquipments,
  listFactoryCapacityProfileStoreIds,
  listFactoryCapacityProfiles,
  listFactoryDyeVatCapacities,
  listFactoryPostCapacityNodes,
  listFactoryPrintMachineCapacities,
} from '../src/data/fcs/factory-capacity-profile-mock.ts'
import { listFactoryMasterRecords } from '../src/data/fcs/factory-master-store.ts'
import { getCapacityProcessCraftOptions, listActiveProcessCraftDefinitions } from '../src/data/fcs/process-craft-dict.ts'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
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
const activeCraftMap = new Map(
  listActiveProcessCraftDefinitions().map((item) => [`${item.processCode}::${item.craftCode}`, item] as const),
)
const capacityOptionKeys = new Set(
  getCapacityProcessCraftOptions().map((item) => `${item.processCode}::${item.craftCode}`),
)
assert(
  !getCapacityProcessCraftOptions().some((item) => /印花工艺|染色工艺/.test(item.label) || /印花工艺|染色工艺/.test(item.craftName)),
  '工厂产能档案可选工序工艺中不应暴露印花工艺 / 染色工艺',
)

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
assert(printMachines.length > 0, '印花工厂缺少打印机档案映射结果')
assert(
  printMachines.every((row) => row.printerNo.trim() && row.speedValue > 0 && row.speedUnit.trim()),
  '印花打印机档案缺少打印机编号或打印速度',
)

const dyeVats = listFactoryDyeVatCapacities('ID-F003')
assert(dyeVats.length > 0, '染厂缺少染缸档案映射结果')
assert(
  dyeVats.every((row) => row.dyeVatNo.trim() && row.capacityQty > 0 && row.capacityUnit.trim()),
  '染缸档案缺少染缸编号或染缸容量',
)

const printEquipments = listFactoryCapacityEquipments('ID-F002')
assert(printEquipments.length >= 2, '印花厂缺少统一设备档案')
assert(
  printEquipments.every(
    (equipment) =>
      equipment.equipmentName.trim()
      && equipment.equipmentNo.trim()
      && equipment.quantity > 0
      && equipment.singleShiftMinutes > 0
      && equipment.abilityList.length > 0,
  ),
  '统一设备档案缺少设备名称、设备标号、数量、单班时长或工序工艺能力',
)
assert(
  printEquipments.every((equipment) => equipment.abilityList.every((ability) => capacityOptionKeys.has(`${ability.processCode}::${ability.craftCode}`))),
  '设备能力未完全来源于工序工艺字典',
)
assert(
  printEquipments.some((equipment) => equipment.abilityList.length > 1),
  '统一设备档案未覆盖“一个设备可关联多个工序工艺能力”',
)

const pr01 = printEquipments.find((equipment) => equipment.equipmentNo === 'PR-01')
const pr02 = printEquipments.find((equipment) => equipment.equipmentNo === 'PR-02')
assert(pr01, '缺少 PR-01 设备样例')
assert(pr02, '缺少 PR-02 设备样例')
assert(pr01.status === 'AVAILABLE', 'PR-01 应为可用设备')
assert(pr02.status === 'MAINTENANCE', 'PR-02 应为维护中设备')

const digitalAbility = pr02.abilityList.find((ability) => ability.craftName === '数码印') ?? pr02.abilityList[0]
assert(digitalAbility, 'PR-02 缺少数码印设备能力')
assert(activeCraftMap.has(`${digitalAbility.processCode}::${digitalAbility.craftCode}`), 'PR-02 数码印能力未命中字典')

const digitalSummary = getFactoryCapacityEquipmentSummary('ID-F002', digitalAbility.processCode, digitalAbility.craftCode)
assert(digitalSummary.totalEquipmentCount === 2, '印花厂数码印总设备数应为 2')
assert(digitalSummary.countableEquipmentCount === 1, 'PR-02 维护中时，数码印可计入设备数应为 1')
assert(digitalSummary.maintenanceEquipmentCount === 1, '维护中设备数量汇总不正确')
assert(digitalSummary.stoppedEquipmentCount === 0, '数码印不应出现停用设备')
assert(digitalSummary.frozenEquipmentCount === 0, '数码印不应出现冻结设备')
assert(digitalSummary.eligibleDeviceCapacityTotal > 0, '数码印设备侧能力应大于 0')

const digitalEntry = listFactoryCapacityEntries('ID-F002').find(
  ({ row }) => row.processCode === digitalAbility.processCode && row.craftCode === digitalAbility.craftCode,
)
assert(digitalEntry, '数码印产能条目缺失')
assert(digitalEntry.entry.values.deviceCount === 1, '下方设备数量没有按可计入设备自动汇总为 1')
assert((digitalEntry.entry.values.deviceShiftMinutes ?? 0) > 0, '下方单班时长没有来自设备档案')
assert((digitalEntry.entry.values.deviceEfficiencyValue ?? 0) > 0, '下方效率没有来自设备档案')

const dyeEquipments = listFactoryCapacityEquipments('ID-F003')
assert(dyeEquipments.some((equipment) => equipment.status === 'FROZEN'), '染厂缺少冻结设备样例')
const frozenAbility = dyeEquipments.flatMap((equipment) => equipment.abilityList.map((ability) => ({ equipment, ability })))
  .find(({ equipment }) => equipment.status === 'FROZEN')
assert(frozenAbility, '缺少冻结设备能力样例')
const frozenSummary = getFactoryCapacityEquipmentSummary(
  'ID-F003',
  frozenAbility.ability.processCode,
  frozenAbility.ability.craftCode,
)
assert(frozenSummary.frozenEquipmentCount > 0, '冻结设备数量汇总不正确')
assert(frozenSummary.countableEquipmentCount < frozenSummary.totalEquipmentCount, '冻结设备不应计入可供给产能')

assert(PROFILE_PAGE_SOURCE.includes('工厂产能档案'), '工厂产能档案页面标题未更新')
assert(PROFILE_PAGE_SOURCE.includes('接单能力'), '工厂产能档案页面缺少“接单能力”区块')
assert(PROFILE_PAGE_SOURCE.includes('设备维护'), '工厂产能档案页面缺少“设备维护”区块')
assert(PROFILE_PAGE_SOURCE.includes('设备名称'), '工厂产能档案页面缺少设备名称字段')
assert(PROFILE_PAGE_SOURCE.includes('设备标号'), '工厂产能档案页面缺少设备标号字段')
assert(PROFILE_PAGE_SOURCE.includes('工序工艺能力'), '工厂产能档案页面缺少工序工艺能力字段')
assert(PROFILE_PAGE_SOURCE.includes('单班时长'), '工厂产能档案页面缺少单班时长字段')
assert(PROFILE_PAGE_SOURCE.includes('设备状态'), '工厂产能档案页面缺少设备状态字段')
assert(PROFILE_PAGE_SOURCE.includes('详情'), '工厂产能档案页面缺少详情态文案')
assert(PROFILE_PAGE_SOURCE.includes('编辑'), '工厂产能档案页面缺少编辑态入口')
assert(PROFILE_PAGE_SOURCE.includes('保存'), '工厂产能档案页面缺少保存按钮')
assert(PROFILE_PAGE_SOURCE.includes('取消'), '工厂产能档案页面缺少取消按钮')
assert(PROFILE_PAGE_SOURCE.includes('设备数量（来自设备档案）'), '下方产能字段未标明来自设备档案')
assert(PROFILE_PAGE_SOURCE.includes('可计入设备'), '下方产能字段未展示可计入设备提示')
assert(PROFILE_PAGE_SOURCE.includes('维护中不计入'), '下方产能字段未提示维护中不计入')
assert(PROFILE_PAGE_SOURCE.includes('data-capacity-action="add-equipment"'), '编辑态缺少新增设备动作')
assert(PROFILE_PAGE_SOURCE.includes('data-capacity-action="save-detail"'), '编辑态缺少保存动作')
assert(PROFILE_PAGE_SOURCE.includes('data-capacity-action="cancel-edit"'), '编辑态缺少取消动作')
assert(PROFILE_PAGE_SOURCE.includes('data-capacity-equipment-field="abilityList"'), '编辑态缺少工序工艺能力多选维护')
assert(PROFILE_PAGE_SOURCE.includes("if (state.detailMode === 'detail' || isEquipmentLinkedField(fieldKey))"), '设备联动字段未强制只读')
assert(!PROFILE_PAGE_SOURCE.includes('capacityRollupMode'), '工厂产能档案页面仍直接显示 capacityRollupMode')
assert(!PROFILE_PAGE_SOURCE.includes('INTERNAL_CAPACITY_NODE'), '工厂产能档案页面仍直接显示 INTERNAL_CAPACITY_NODE')
assert(!PROFILE_PAGE_SOURCE.includes('印花 PDA'), '工厂产能档案页面仍出现“印花 PDA”')
assert(!PROFILE_PAGE_SOURCE.includes('染色 PDA'), '工厂产能档案页面仍出现“染色 PDA”')
assert(!/数码印[\s\S]{0,80}>4</.test(PROFILE_PAGE_SOURCE), '页面仍存在数码印设备数量硬编码为 4 的风险')

console.log(
  JSON.stringify(
    {
      factoryCount: factories.length,
      profileCount: profiles.length,
      postNodeCount: postNodes.length,
      printEquipmentCount: printEquipments.length,
      dyeEquipmentCount: dyeEquipments.length,
      digitalTotalEquipmentCount: digitalSummary.totalEquipmentCount,
      digitalCountableEquipmentCount: digitalSummary.countableEquipmentCount,
      frozenEquipmentCount: frozenSummary.frozenEquipmentCount,
    },
    null,
    2,
  ),
)
