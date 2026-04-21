import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  getFactoryCapacityEquipmentSummary,
  listFactoryCapacityEntries,
  listFactoryCapacityEquipments,
} from '../src/data/fcs/factory-capacity-profile-mock.ts'
import { getCapacityProcessCraftOptions } from '../src/data/fcs/process-craft-dict.ts'

const ROOT = fileURLToPath(new URL('..', import.meta.url))

function read(relativePath: string): string {
  return fs.readFileSync(path.resolve(ROOT, relativePath), 'utf8')
}

const pageSource = read('src/pages/factory-capacity-profile.ts')
const capacityPageSource = read('src/pages/capacity.ts')
const dataSource = read('src/data/fcs/factory-capacity-profile-mock.ts')
const routesSource =
  read('src/data/app-shell-config.ts')
  + read('src/router/routes-fcs.ts')
  + read('src/router/route-renderers-fcs.ts')

const equipmentOptions = new Set(
  getCapacityProcessCraftOptions().map((item) => `${item.processCode}::${item.craftCode}`),
)

assert(pageSource.includes('详情'), '工厂产能档案缺少详情态文案')
assert(pageSource.includes('编辑'), '工厂产能档案缺少编辑态文案')
assert(pageSource.includes('保存'), '工厂产能档案缺少保存文案')
assert(pageSource.includes('取消'), '工厂产能档案缺少取消文案')
assert(pageSource.includes('设备维护'), '工厂产能档案缺少设备维护区域')

;['设备名称', '设备标号', '工序工艺能力', '数量', '效率', '单班时长', '设备状态'].forEach((token) => {
  assert(pageSource.includes(token), `工厂产能档案缺少设备字段：${token}`)
})

assert(dataSource.includes('FactoryCapacityEquipment'), '缺少统一设备维护模型')
assert(dataSource.includes('abilityList'), '统一设备维护模型缺少 abilityList')
assert(dataSource.includes('singleShiftMinutes'), '统一设备维护模型缺少单班时长')
assert(dataSource.includes("status: 'MAINTENANCE'"), '缺少维护中设备样例')
assert(dataSource.includes("status: 'FROZEN'"), '缺少冻结设备样例')

const printEquipments = listFactoryCapacityEquipments('ID-F002')
assert(printEquipments.some((equipment) => equipment.abilityList.length > 1), '一个设备未能关联多个工序工艺能力')
assert(
  printEquipments.every((equipment) => equipment.abilityList.every((ability) => equipmentOptions.has(`${ability.processCode}::${ability.craftCode}`))),
  '设备能力存在字典外的工序工艺值',
)

const pr02 = printEquipments.find((equipment) => equipment.equipmentNo === 'PR-02')
assert(pr02, '缺少 PR-02 维护中设备样例')
assert(pr02.status === 'MAINTENANCE', 'PR-02 应为维护中设备')

const digitalAbility = pr02.abilityList.find((ability) => ability.craftName === '数码印') ?? pr02.abilityList[0]
const digitalSummary = getFactoryCapacityEquipmentSummary('ID-F002', digitalAbility.processCode, digitalAbility.craftCode)
assert.equal(digitalSummary.totalEquipmentCount, 2, '印花厂数码印总设备数应为 2')
assert.equal(digitalSummary.countableEquipmentCount, 1, 'PR-02 维护中时，数码印可计入设备数应为 1')
assert.equal(digitalSummary.maintenanceEquipmentCount, 1, '维护中设备数量汇总不正确')
assert.equal(digitalSummary.stoppedEquipmentCount, 0, '停用设备数量汇总不正确')
assert.equal(digitalSummary.frozenEquipmentCount, 0, '冻结设备数量汇总不正确')

const digitalEntry = listFactoryCapacityEntries('ID-F002').find(
  ({ row }) => row.processCode === digitalAbility.processCode && row.craftCode === digitalAbility.craftCode,
)
assert(digitalEntry, '缺少数码印产能条目')
assert.equal(digitalEntry.entry.values.deviceCount, 1, '下方设备数量没有来自设备档案')

assert(pageSource.includes('设备数量（来自设备档案）'), '下方设备数量未标记来自设备档案')
assert(pageSource.includes('可计入设备'), '下方缺少可计入设备提示')
assert(pageSource.includes('维护中不计入'), '下方缺少维护中不计入提示')
assert(pageSource.includes("if (state.detailMode === 'detail' || isEquipmentLinkedField(fieldKey))"), '下方设备数量仍可被手动覆盖')
assert(!/数码印[\s\S]{0,80}>4</.test(pageSource), '页面仍存在数码印设备数量硬编码为 4 的风险')

;['打印机编号', '打印速度', '染缸编号', '染缸容量', '待送货量', '待审核量', '节点等待', '排染缸'].forEach((token) => {
  assert(!capacityPageSource.includes(token), `任务工时风险页仍展示专属细维度：${token}`)
})

assert(!capacityPageSource.includes('裁片 - 定位裁'), '工艺瓶颈榜仍固定展示“裁片 - 定位裁”右侧卡片')
assert(!capacityPageSource.includes('selectedBottleneck'), '工艺瓶颈榜仍保留固定右侧详情状态')

;['fetch(', 'axios', 'apiClient', '/api/', 'useTranslation', 'i18n', 'locales'].forEach((token) => {
  assert(!pageSource.includes(token), `本次范围内不应新增接口或 i18n：${token}`)
})
;['库存三态', '库位上架', '拣货波次', '完整入库'].forEach((token) => {
  assert(!pageSource.includes(token), `本次范围内不应新增 WMS 越界：${token}`)
})

assert(routesSource.includes('/fcs/factories/capacity-profile'), '工厂产能档案路由缺失')

console.log(
  JSON.stringify(
    {
      设备维护模型: '通过',
      设备联动计算: '通过',
      风险页统一口径: '通过',
      工艺瓶颈右侧卡片: '已移除',
      路由注册: '通过',
    },
    null,
    2,
  ),
)
