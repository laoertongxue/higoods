import {
  calculateFactoryCapacityCompletion,
  computeFactoryCapacityEntryResult,
  getFactoryCapacityProfileByFactoryId,
  getFactoryCapacityEquipmentSummary,
  listFactoryCapacityEntries,
  listFactoryCapacityEquipments,
  replaceFactoryCapacityEquipments,
  replaceFactoryCapacityProfileEntries,
  type FactoryCapacityEquipmentSummary,
  type FactoryCapacityResolvedEntry,
} from '../data/fcs/factory-capacity-profile-mock'
import {
  getFactoryMasterRecordById,
  listFactoryMasterRecords,
} from '../data/fcs/factory-master-store'
import {
  factoryAbilityScopeLabel,
  factoryAbilityStatusLabel,
  factoryEquipmentStatusLabel,
  factoryStatusConfig,
  factoryTypeConfig,
  type Factory,
  type FactoryCapacityEquipment,
  type FactoryCapacityFieldValue,
  type FactoryType,
} from '../data/fcs/factory-types'
import {
  SAM_CALC_MODE_LABEL,
  getCapacityProcessCraftOptions,
  getProcessDefinitionByCode,
  listProcessStages,
  listProcessesByStageCode,
  type ProcessCraftDictRow,
  type SamCurrentFieldKey,
} from '../data/fcs/process-craft-dict'
import { getSamBusinessFieldDescription, getSamBusinessFieldLabel } from '../data/fcs/sam-field-display'
import { appStore } from '../state/store'
import { escapeHtml } from '../utils'

const PAGE_SIZE = 10

interface FactoryCapacityProfilePageState {
  searchKeyword: string
  statusFilter: string
  typeFilter: string
  currentPage: number
  activeFactoryId: string
  detailMode: 'detail' | 'edit'
  draftEntries: FactoryCapacityResolvedEntry[]
  draftEquipments: FactoryCapacityEquipment[]
}

const state: FactoryCapacityProfilePageState = {
  searchKeyword: '',
  statusFilter: 'all',
  typeFilter: 'all',
  currentPage: 1,
  activeFactoryId: '',
  detailMode: 'detail',
  draftEntries: [],
  draftEquipments: [],
}

function renderTestFactoryBadge(factory: Pick<Factory, 'isTestFactory'>): string {
  return factory.isTestFactory
    ? '<span class="ml-2 inline-flex rounded border border-violet-200 bg-violet-50 px-2 py-0.5 text-[11px] text-violet-700">测试工厂</span>'
    : ''
}

function getVisibleFactories(): Factory[] {
  let result = listFactoryMasterRecords()

  if (state.searchKeyword.trim()) {
    const keyword = state.searchKeyword.trim().toLowerCase()
    result = result.filter((factory) =>
      [factory.name, factory.code, factory.contact, factory.phone].some((value) =>
        (value ?? '').toLowerCase().includes(keyword),
      ),
    )
  }

  if (state.statusFilter !== 'all') {
    result = result.filter((factory) => factory.status === state.statusFilter)
  }

  if (state.typeFilter !== 'all') {
    result = result.filter((factory) => factory.factoryType === state.typeFilter)
  }

  return result.sort((left, right) => left.code.localeCompare(right.code))
}

function getPagedFactories(factories: Factory[]): Factory[] {
  const start = (state.currentPage - 1) * PAGE_SIZE
  return factories.slice(start, start + PAGE_SIZE)
}

function getFactoryTypeOptions(): FactoryType[] {
  return [...new Set(listFactoryMasterRecords().map((factory) => factory.factoryType))]
}

function getSelectedFactory(): Factory | null {
  if (!state.activeFactoryId) return null
  return getFactoryMasterRecordById(state.activeFactoryId) ?? null
}

function cloneResolvedEntries(entries: FactoryCapacityResolvedEntry[]): FactoryCapacityResolvedEntry[] {
  return entries.map(({ row, entry }) => ({
    row,
    entry: {
      processCode: entry.processCode,
      craftCode: entry.craftCode,
      values: { ...entry.values },
      note: entry.note,
    },
  }))
}

function cloneEquipments(equipments: FactoryCapacityEquipment[]): FactoryCapacityEquipment[] {
  return equipments.map((equipment) => ({
    ...equipment,
    abilityList: equipment.abilityList.map((ability) => ({ ...ability })),
    supportedMaterialTypes: equipment.supportedMaterialTypes ? [...equipment.supportedMaterialTypes] : undefined,
  }))
}

function resetDraftState(factoryId: string): void {
  state.draftEntries = cloneResolvedEntries(listFactoryCapacityEntries(factoryId))
  state.draftEquipments = cloneEquipments(listFactoryCapacityEquipments(factoryId))
}

function getCurrentEntries(factoryId: string): FactoryCapacityResolvedEntry[] {
  return state.detailMode === 'edit' && state.activeFactoryId === factoryId
    ? state.draftEntries
    : listFactoryCapacityEntries(factoryId)
}

function getCurrentEquipments(factoryId: string): FactoryCapacityEquipment[] {
  return state.detailMode === 'edit' && state.activeFactoryId === factoryId
    ? state.draftEquipments
    : listFactoryCapacityEquipments(factoryId)
}

function isCountableEquipmentStatus(status: FactoryCapacityEquipment['status']): boolean {
  return status === 'AVAILABLE' || status === 'IN_USE'
}

function buildEquipmentSummary(
  factoryId: string,
  processCode: string,
  craftCode: string,
): FactoryCapacityEquipmentSummary {
  if (!(state.detailMode === 'edit' && state.activeFactoryId === factoryId)) {
    return getFactoryCapacityEquipmentSummary(factoryId, processCode, craftCode)
  }

  const matchedEquipments = getCurrentEquipments(factoryId).filter((equipment) =>
    equipment.abilityList.some((ability) => ability.processCode === processCode && ability.craftCode === craftCode),
  )

  const summary = matchedEquipments.reduce<FactoryCapacityEquipmentSummary>((result, equipment) => {
    const ability = equipment.abilityList.find(
      (item) => item.processCode === processCode && item.craftCode === craftCode,
    )
    if (!ability) return result

    result.totalEquipmentCount += equipment.quantity
    if (equipment.status === 'MAINTENANCE') result.maintenanceEquipmentCount += equipment.quantity
    if (equipment.status === 'STOPPED') result.stoppedEquipmentCount += equipment.quantity
    if (equipment.status === 'FROZEN') result.frozenEquipmentCount += equipment.quantity

    if (isCountableEquipmentStatus(equipment.status)) {
      const shiftMinutesTotal = equipment.quantity * equipment.singleShiftMinutes
      result.countableEquipmentCount += equipment.quantity
      result.eligibleShiftMinutesTotal += shiftMinutesTotal
      result.eligibleDeviceCapacityTotal += shiftMinutesTotal * ability.efficiencyValue
    }

    result.efficiencyUnit = result.efficiencyUnit || ability.efficiencyUnit
    result.matchedEquipments.push({
      ...equipment,
      abilityList: equipment.abilityList.map((item) => ({ ...item })),
      supportedMaterialTypes: equipment.supportedMaterialTypes ? [...equipment.supportedMaterialTypes] : undefined,
    })
    return result
  }, {
    factoryId,
    processCode,
    craftCode,
    totalEquipmentCount: 0,
    countableEquipmentCount: 0,
    maintenanceEquipmentCount: 0,
    stoppedEquipmentCount: 0,
    frozenEquipmentCount: 0,
    eligibleShiftMinutesTotal: 0,
    eligibleDeviceCapacityTotal: 0,
    averageSingleShiftMinutes: 0,
    weightedEfficiencyValue: 0,
    efficiencyUnit: '',
    matchedEquipments: [],
  })

  summary.averageSingleShiftMinutes = summary.countableEquipmentCount
    ? Number((summary.eligibleShiftMinutesTotal / summary.countableEquipmentCount).toFixed(2))
    : 0
  summary.weightedEfficiencyValue = summary.eligibleShiftMinutesTotal
    ? Number((summary.eligibleDeviceCapacityTotal / summary.eligibleShiftMinutesTotal).toFixed(4))
    : 0

  return summary
}

function getSupportedProcessCount(factory: Factory): number {
  return factory.processAbilities.filter((ability) => ability.status !== 'DISABLED' && ability.canReceiveTask !== false).length
}

function getSupportedCraftCount(factory: Factory): number {
  return factory.processAbilities.reduce(
    (total, item) => total + item.craftCodes.length + (item.capacityNodeCodes?.length ?? 0),
    0,
  )
}

function renderPagination(total: number): string {
  const totalPages = Math.ceil(total / PAGE_SIZE)
  if (totalPages <= 1) return ''

  const start = Math.max(1, state.currentPage - 2)
  const end = Math.min(totalPages, start + 4)
  const pages = Array.from({ length: end - start + 1 }, (_, index) => start + index)

  return `
    <div class="flex items-center justify-between">
      <div class="text-sm text-muted-foreground">第 ${state.currentPage} 页，共 ${totalPages} 页</div>
      <div class="flex items-center gap-1">
        <button
          data-capacity-action="prev-page"
          class="rounded-md border px-3 py-1 text-sm ${state.currentPage === 1 ? 'pointer-events-none opacity-50' : 'hover:bg-muted'}"
        >上一页</button>
        ${pages
          .map(
            (page) => `
              <button
                data-capacity-action="goto-page"
                data-page="${page}"
                class="rounded-md border px-3 py-1 text-sm ${page === state.currentPage ? 'bg-blue-600 text-white' : 'hover:bg-muted'}"
              >${page}</button>
            `,
          )
          .join('')}
        <button
          data-capacity-action="next-page"
          class="rounded-md border px-3 py-1 text-sm ${state.currentPage === totalPages ? 'pointer-events-none opacity-50' : 'hover:bg-muted'}"
        >下一页</button>
      </div>
    </div>
  `
}

function renderFieldValue(label: string, value: string): string {
  return `
    <div class="space-y-1 rounded-lg bg-muted/20 px-3 py-2">
      <p class="text-xs text-muted-foreground">${escapeHtml(label)}</p>
      <p class="text-sm font-medium text-foreground">${escapeHtml(value)}</p>
    </div>
  `
}

function renderCapacityTableRows(factories: Factory[]): string {
  if (!factories.length) {
    return `
      <tr>
        <td colspan="8" class="h-24 px-4 text-center text-muted-foreground">暂无产能档案数据</td>
      </tr>
    `
  }

  return factories
    .map((factory) => {
      const statusConfig = factoryStatusConfig[factory.status]
      const completion = calculateFactoryCapacityCompletion(factory.id)

      return `
        <tr class="border-b last:border-0 hover:bg-muted/30" data-capacity-factory-id="${factory.id}">
          <td class="px-3 py-3 font-medium">${escapeHtml(factory.name)}${renderTestFactoryBadge(factory)}</td>
          <td class="px-3 py-3 text-sm">${escapeHtml(factoryTypeConfig[factory.factoryType]?.label ?? factory.factoryType)}</td>
          <td class="px-3 py-3">
            <span class="inline-flex rounded border px-2 py-0.5 text-xs ${statusConfig.color}">${escapeHtml(statusConfig.label)}</span>
          </td>
          <td class="px-3 py-3 text-sm">${escapeHtml(factory.contact)}</td>
          <td class="px-3 py-3 text-sm">${getSupportedProcessCount(factory)}</td>
          <td class="px-3 py-3 text-sm">${getSupportedCraftCount(factory)}</td>
          <td class="px-3 py-3 text-sm">
            <div class="flex items-center gap-2">
              <div class="h-2 flex-1 rounded-full bg-muted">
                <div class="h-2 rounded-full bg-blue-600" style="width:${completion}%"></div>
              </div>
              <span class="w-10 text-right text-xs text-muted-foreground">${completion}%</span>
            </div>
          </td>
          <td class="px-3 py-3 text-right">
            <button
              class="rounded-md px-2 py-1 text-xs hover:bg-blue-50 hover:text-blue-600"
              data-capacity-action="open-detail"
              data-factory-id="${factory.id}"
            >查看工厂产能档案</button>
          </td>
        </tr>
      `
    })
    .join('')
}

function renderReadonlyProcessAbilities(factory: Factory): string {
  const abilities = factory.processAbilities
    .filter((ability) => ability.status !== 'DISABLED')
    .map((ability) => {
      const processDefinition = getProcessDefinitionByCode(ability.processCode)
      const statusLabel = factoryAbilityStatusLabel[ability.status ?? 'ACTIVE']
      const scopeLabel = factoryAbilityScopeLabel[ability.abilityScope ?? 'PROCESS']
      const title = ability.abilityName ?? ability.processName ?? processDefinition?.processName ?? ability.processCode
      const detailTags = [
        ...(ability.craftNames ?? []),
        ...((ability.capacityNodeCodes ?? []).map(
          (code) => getProcessDefinitionByCode(code)?.processName ?? code,
        )),
      ]

      return `
        <article class="rounded-lg border bg-card px-4 py-3" data-capacity-readonly-ability="${escapeHtml(ability.processCode)}">
          <div class="flex items-start justify-between gap-3">
            <div class="space-y-1">
              <p class="text-sm font-medium text-foreground">${escapeHtml(title)}</p>
              <div class="flex flex-wrap gap-2">
                <span class="inline-flex rounded border px-2 py-0.5 text-xs text-muted-foreground">${escapeHtml(scopeLabel)}</span>
                <span class="inline-flex rounded border px-2 py-0.5 text-xs text-muted-foreground">${escapeHtml(statusLabel)}</span>
              </div>
            </div>
            <span class="text-xs text-muted-foreground">${ability.canReceiveTask === false ? '仅产能维护' : '可接单'}</span>
          </div>
          ${
            detailTags.length
              ? `<div class="mt-3 flex flex-wrap gap-2">${detailTags
                  .map(
                    (tag) =>
                      `<span class="inline-flex rounded-full border border-blue-200 bg-blue-50 px-2 py-1 text-xs text-blue-700">${escapeHtml(tag)}</span>`,
                  )
                  .join('')}</div>`
              : ''
          }
        </article>
      `
    })
    .join('')

  return `
    <section class="space-y-4" data-testid="factory-capacity-readonly-abilities">
      <div class="flex items-center justify-between gap-3">
        <h4 class="text-sm font-medium text-foreground">接单能力</h4>
        <span class="rounded border border-blue-200 bg-blue-50 px-2 py-1 text-xs text-blue-700">来自工厂档案</span>
      </div>
      <div class="grid gap-3 md:grid-cols-2">${abilities || '<div class="rounded-lg border border-dashed px-4 py-6 text-sm text-muted-foreground">当前未维护接单能力。</div>'}</div>
    </section>
  `
}

function resolveEquipmentGroupLabel(equipment: FactoryCapacityEquipment): string {
  if (equipment.equipmentType === 'PRINT_MACHINE') return '印花打印机'
  if (equipment.equipmentType === 'DYE_VAT') return '染缸'
  if (equipment.equipmentType === 'POST_NODE') return '后道'
  if (equipment.abilityList.some((ability) => ability.processCode === 'POST_FINISHING')) return '后道'
  return '设备'
}

function resolveEquipmentEfficiencyDisplay(equipment: FactoryCapacityEquipment): string {
  if (!equipment.abilityList.length) return '暂无数据'
  const firstAbility = equipment.abilityList[0]
  return `${firstAbility.efficiencyValue} ${firstAbility.efficiencyUnit}`.trim()
}

function renderEquipmentAbilityText(equipment: FactoryCapacityEquipment): string {
  if (!equipment.abilityList.length) return '暂无数据'
  return equipment.abilityList
    .map((ability) => `${ability.processName} / ${ability.craftName}`)
    .join('、')
}

function getEquipmentAbilityOptions() {
  return getCapacityProcessCraftOptions().map((option) => ({
    value: `${option.processCode}::${option.craftCode}`,
    label: option.label,
  }))
}

function renderEquipmentReadonlyTable(factoryId: string): string {
  const equipments = getCurrentEquipments(factoryId)
  if (!equipments.length) {
    return '<div class="rounded-lg border border-dashed px-4 py-6 text-sm text-muted-foreground">暂无数据</div>'
  }

  return `
    <div class="overflow-hidden rounded-lg border">
      <table class="w-full text-sm">
        <thead class="bg-muted/30">
          <tr>
            <th class="px-3 py-2 text-left text-xs font-medium text-muted-foreground">设备名称</th>
            <th class="px-3 py-2 text-left text-xs font-medium text-muted-foreground">设备标号</th>
            <th class="px-3 py-2 text-left text-xs font-medium text-muted-foreground">工序工艺能力</th>
            <th class="px-3 py-2 text-left text-xs font-medium text-muted-foreground">数量</th>
            <th class="px-3 py-2 text-left text-xs font-medium text-muted-foreground">效率</th>
            <th class="px-3 py-2 text-left text-xs font-medium text-muted-foreground">单班时长</th>
            <th class="px-3 py-2 text-left text-xs font-medium text-muted-foreground">设备状态</th>
          </tr>
        </thead>
        <tbody>
          ${equipments
            .map(
              (equipment) => `
                <tr class="border-t">
                  <td class="px-3 py-3">
                    <div class="space-y-1">
                      <p class="font-medium">${escapeHtml(equipment.equipmentName || '暂无数据')}</p>
                      <span class="inline-flex rounded border px-2 py-0.5 text-xs text-muted-foreground">${escapeHtml(resolveEquipmentGroupLabel(equipment))}</span>
                    </div>
                  </td>
                  <td class="px-3 py-3">${escapeHtml(equipment.equipmentNo || '暂无数据')}</td>
                  <td class="px-3 py-3">${escapeHtml(renderEquipmentAbilityText(equipment))}</td>
                  <td class="px-3 py-3">${equipment.quantity}</td>
                  <td class="px-3 py-3">${escapeHtml(resolveEquipmentEfficiencyDisplay(equipment))}</td>
                  <td class="px-3 py-3">${equipment.singleShiftMinutes} 分钟</td>
                  <td class="px-3 py-3">${escapeHtml(factoryEquipmentStatusLabel[equipment.status])}</td>
                </tr>
              `,
            )
            .join('')}
        </tbody>
      </table>
    </div>
  `
}

function renderEquipmentEditorTable(factoryId: string): string {
  const abilityOptions = getEquipmentAbilityOptions()
  const equipments = getCurrentEquipments(factoryId)

  return `
    <div class="space-y-3">
      <div class="flex items-center justify-between gap-3">
        <div class="flex flex-wrap gap-2 text-xs text-muted-foreground">
          <span class="inline-flex rounded border px-2 py-1">印花打印机</span>
          <span class="inline-flex rounded border px-2 py-1">染缸</span>
          <span class="inline-flex rounded border px-2 py-1">后道</span>
        </div>
        <button class="rounded-md border px-3 py-2 text-xs hover:bg-muted" data-capacity-action="add-equipment">新增设备</button>
      </div>
      <div class="overflow-hidden rounded-lg border">
        <table class="w-full text-sm">
          <thead class="bg-muted/30">
            <tr>
              <th class="px-3 py-2 text-left text-xs font-medium text-muted-foreground">设备名称</th>
              <th class="px-3 py-2 text-left text-xs font-medium text-muted-foreground">设备标号</th>
              <th class="px-3 py-2 text-left text-xs font-medium text-muted-foreground">工序工艺能力</th>
              <th class="px-3 py-2 text-left text-xs font-medium text-muted-foreground">数量</th>
              <th class="px-3 py-2 text-left text-xs font-medium text-muted-foreground">效率</th>
              <th class="px-3 py-2 text-left text-xs font-medium text-muted-foreground">单班时长</th>
              <th class="px-3 py-2 text-left text-xs font-medium text-muted-foreground">设备状态</th>
              <th class="px-3 py-2 text-right text-xs font-medium text-muted-foreground">操作</th>
            </tr>
          </thead>
          <tbody>
            ${
              equipments.length
                ? equipments
                    .map((equipment) => {
                      const abilityValueSet = new Set(
                        equipment.abilityList.map((ability) => `${ability.processCode}::${ability.craftCode}`),
                      )
                      const firstAbility = equipment.abilityList[0]
                      return `
                        <tr class="border-t align-top">
                          <td class="px-3 py-3">
                            <input
                              class="w-full rounded-md border px-3 py-2 text-sm"
                              data-capacity-equipment-id="${escapeHtml(equipment.equipmentId)}"
                              data-capacity-equipment-field="equipmentName"
                              value="${escapeHtml(equipment.equipmentName)}"
                            />
                          </td>
                          <td class="px-3 py-3">
                            <input
                              class="w-full rounded-md border px-3 py-2 text-sm"
                              data-capacity-equipment-id="${escapeHtml(equipment.equipmentId)}"
                              data-capacity-equipment-field="equipmentNo"
                              value="${escapeHtml(equipment.equipmentNo)}"
                            />
                          </td>
                          <td class="px-3 py-3">
                            <select
                              multiple
                              class="min-h-[108px] w-full rounded-md border px-3 py-2 text-sm"
                              data-capacity-equipment-id="${escapeHtml(equipment.equipmentId)}"
                              data-capacity-equipment-field="abilityList"
                            >
                              ${abilityOptions
                                .map(
                                  (option) => `
                                    <option value="${escapeHtml(option.value)}" ${abilityValueSet.has(option.value) ? 'selected' : ''}>${escapeHtml(option.label)}</option>
                                  `,
                                )
                                .join('')}
                            </select>
                          </td>
                          <td class="px-3 py-3">
                            <input
                              type="number"
                              min="0"
                              class="w-full rounded-md border px-3 py-2 text-sm"
                              data-capacity-equipment-id="${escapeHtml(equipment.equipmentId)}"
                              data-capacity-equipment-field="quantity"
                              value="${equipment.quantity}"
                            />
                          </td>
                          <td class="px-3 py-3">
                            <div class="grid gap-2">
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                class="w-full rounded-md border px-3 py-2 text-sm"
                                data-capacity-equipment-id="${escapeHtml(equipment.equipmentId)}"
                                data-capacity-equipment-field="efficiencyValue"
                                value="${firstAbility?.efficiencyValue ?? ''}"
                              />
                              <input
                                class="w-full rounded-md border px-3 py-2 text-sm"
                                data-capacity-equipment-id="${escapeHtml(equipment.equipmentId)}"
                                data-capacity-equipment-field="efficiencyUnit"
                                value="${escapeHtml(firstAbility?.efficiencyUnit ?? '')}"
                              />
                            </div>
                          </td>
                          <td class="px-3 py-3">
                            <input
                              type="number"
                              min="0"
                              class="w-full rounded-md border px-3 py-2 text-sm"
                              data-capacity-equipment-id="${escapeHtml(equipment.equipmentId)}"
                              data-capacity-equipment-field="singleShiftMinutes"
                              value="${equipment.singleShiftMinutes}"
                            />
                          </td>
                          <td class="px-3 py-3">
                            <select
                              class="w-full rounded-md border px-3 py-2 text-sm"
                              data-capacity-equipment-id="${escapeHtml(equipment.equipmentId)}"
                              data-capacity-equipment-field="status"
                            >
                              ${Object.entries(factoryEquipmentStatusLabel)
                                .map(
                                  ([value, label]) =>
                                    `<option value="${escapeHtml(value)}" ${equipment.status === value ? 'selected' : ''}>${escapeHtml(label)}</option>`,
                                )
                                .join('')}
                            </select>
                          </td>
                          <td class="px-3 py-3 text-right">
                            <button
                              class="rounded-md border px-3 py-2 text-xs hover:bg-muted"
                              data-capacity-action="remove-equipment"
                              data-equipment-id="${escapeHtml(equipment.equipmentId)}"
                            >
                              删除
                            </button>
                          </td>
                        </tr>
                      `
                    })
                    .join('')
                : `
                  <tr class="border-t">
                    <td colspan="8" class="px-3 py-6 text-center text-sm text-muted-foreground">暂无数据</td>
                  </tr>
                `
            }
          </tbody>
        </table>
      </div>
    </div>
  `
}

function renderEquipmentSection(factoryId: string): string {
  return `
    <section class="space-y-3" data-testid="factory-capacity-equipment-section">
      <div class="flex items-center justify-between gap-3">
        <h4 class="text-sm font-medium text-foreground">设备维护</h4>
        <span class="text-xs text-muted-foreground">${state.detailMode === 'edit' ? '编辑' : '详情'}</span>
      </div>
      ${state.detailMode === 'edit' ? renderEquipmentEditorTable(factoryId) : renderEquipmentReadonlyTable(factoryId)}
    </section>
  `
}

function renderTopReadonlyInfo(factory: Factory): string {
  return `
    <section class="space-y-5 border-b border-slate-200 pb-6" data-capacity-detail-top>
      <div>
        <h4 class="text-sm font-medium text-foreground">工厂基础信息</h4>
      </div>
      <div class="grid grid-cols-2 gap-3">
        ${renderFieldValue('工厂名称', factory.name)}
        ${renderFieldValue('工厂类型', factoryTypeConfig[factory.factoryType]?.label ?? factory.factoryType)}
        ${renderFieldValue('工厂状态', factoryStatusConfig[factory.status].label)}
        ${renderFieldValue('联系人', factory.contact)}
      </div>
      ${renderReadonlyProcessAbilities(factory)}
      ${renderEquipmentSection(factory.id)}
    </section>
  `
}

function formatCapacityValue(value: FactoryCapacityFieldValue | undefined): string {
  return value === undefined || value === null ? '' : String(value)
}

function getCurrentPhaseFieldLabel(fieldKey: SamCurrentFieldKey): string {
  if (fieldKey === 'deviceCount') return '设备数量（来自设备档案）'
  if (fieldKey === 'deviceShiftMinutes') return '单班时长（来自设备档案）'
  if (fieldKey === 'deviceEfficiencyValue') return '效率（来自设备档案）'
  return getSamBusinessFieldLabel(fieldKey)
}

function getCurrentPhaseFieldDescription(fieldKey: SamCurrentFieldKey): string {
  return getSamBusinessFieldDescription(fieldKey)
}

function isEquipmentLinkedField(fieldKey: SamCurrentFieldKey): boolean {
  return fieldKey === 'deviceCount' || fieldKey === 'deviceShiftMinutes' || fieldKey === 'deviceEfficiencyValue'
}

function renderReadonlyFieldBlock(
  label: string,
  value: string,
  helperText: string,
): string {
  return `
    <div class="space-y-1.5">
      <span class="text-xs text-muted-foreground">${escapeHtml(label)}</span>
      <div class="rounded-md border bg-background px-3 py-2 text-sm font-medium text-foreground">${escapeHtml(value || '暂无数据')}</div>
      <span class="text-[11px] text-muted-foreground">${escapeHtml(helperText)}</span>
    </div>
  `
}

function renderCurrentFieldControl(
  factoryId: string,
  processCode: string,
  craftCode: string,
  fieldKey: SamCurrentFieldKey,
  value: FactoryCapacityFieldValue | undefined,
): string {
  if (state.detailMode === 'detail' || isEquipmentLinkedField(fieldKey)) {
    const summary = buildEquipmentSummary(factoryId, processCode, craftCode)
    const helperText = fieldKey === 'deviceCount'
      ? `可计入设备 ${summary.countableEquipmentCount}；维护中不计入 ${summary.maintenanceEquipmentCount}`
      : fieldKey === 'deviceShiftMinutes'
        ? `系统按设备档案自动汇总，停用和冻结不计入`
        : fieldKey === 'deviceEfficiencyValue'
          ? `系统按设备档案逐台汇总后自动换算`
          : getCurrentPhaseFieldDescription(fieldKey)
    return renderReadonlyFieldBlock(getCurrentPhaseFieldLabel(fieldKey), formatCapacityValue(value), helperText)
  }

  const step = fieldKey === 'efficiencyFactor' || fieldKey === 'deviceEfficiencyValue' || fieldKey === 'staffEfficiencyValue'
    ? '0.01'
    : '1'

  return `
    <label class="space-y-1.5">
      <span class="text-xs text-muted-foreground">${escapeHtml(getCurrentPhaseFieldLabel(fieldKey))}</span>
      <input
        type="number"
        step="${step}"
        data-capacity-draft-process-code="${processCode}"
        data-capacity-draft-craft-code="${craftCode}"
        data-capacity-draft-field-key="${fieldKey}"
        value="${escapeHtml(formatCapacityValue(value))}"
        class="w-full rounded-md border px-3 py-2 text-sm"
      />
      <span class="text-[11px] text-muted-foreground">${escapeHtml(getCurrentPhaseFieldDescription(fieldKey))}</span>
    </label>
  `
}

function renderCalculationLines(
  factoryId: string,
  row: ProcessCraftDictRow,
  values: Partial<Record<SamCurrentFieldKey, FactoryCapacityFieldValue>>,
): string {
  const result = computeFactoryCapacityEntryResult(
    row,
    values,
    buildEquipmentSummary(factoryId, row.processCode, row.craftCode),
  )
  return `
    <div class="space-y-0 divide-y divide-slate-200" data-capacity-calculation-lines>
      ${result.lines
        .map((line) => {
          if (line.result === null) {
            return `<p class="rounded-lg bg-amber-50 px-3 py-2 text-xs text-red-600">${escapeHtml(`${line.label}：${line.expression}`)}</p>`
          }

          return `
            <div class="py-3 text-sm first:pt-0 last:pb-0" data-capacity-calculation-line="${escapeHtml(line.label)}">
              <p class="font-medium text-foreground">${escapeHtml(line.label)}</p>
              <p class="mt-1 leading-6 text-muted-foreground">${escapeHtml(`${line.label} = ${line.expression} = ${Number(line.result.toFixed(2)).toString()}`)}</p>
            </div>
          `
        })
        .join('')}
    </div>
  `
}

function renderCapacityEntryCard(
  factoryId: string,
  row: ProcessCraftDictRow,
  values: Partial<Record<SamCurrentFieldKey, FactoryCapacityFieldValue>>,
): string {
  const equipmentSummary = buildEquipmentSummary(factoryId, row.processCode, row.craftCode)
  const result = computeFactoryCapacityEntryResult(row, values, equipmentSummary)
  const resultText = result.resultValue === null ? '待补齐字段' : Number(result.resultValue.toFixed(2)).toString()

  return `
    <article class="space-y-4 rounded-xl bg-muted/20 p-5" data-capacity-entry-card="${row.craftCode}">
      <div class="flex items-start justify-between gap-4">
        <div>
          <p class="text-sm font-medium text-foreground">${escapeHtml(row.craftName)}</p>
          <p class="mt-1 text-xs text-muted-foreground">${escapeHtml(row.processName)} · ${escapeHtml(
            SAM_CALC_MODE_LABEL[row.samCalcMode],
          )}</p>
        </div>
        <span class="rounded border border-blue-200 bg-blue-50 px-2 py-1 text-xs text-blue-700">系统自动计算结果</span>
      </div>

      <div class="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(280px,0.8fr)]">
        <section class="space-y-3 rounded-xl bg-slate-50 px-4 py-4" data-capacity-fields-panel="${row.craftCode}">
          <p class="text-xs font-medium text-amber-700">当前阶段字段</p>
          <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
            ${row.samCurrentFieldKeys
              .map((fieldKey) =>
                renderCurrentFieldControl(factoryId, row.processCode, row.craftCode, fieldKey, values[fieldKey]),
              )
              .join('')}
          </div>
        </section>

        <section class="space-y-4" data-capacity-results-panel="${row.craftCode}">
          <div class="rounded-xl border border-blue-200 bg-blue-50 px-4 py-4" data-capacity-result-block="${row.craftCode}">
            <p class="text-xs font-medium text-blue-700">默认日可供给发布工时 SAM</p>
            <p class="mt-2 text-2xl font-semibold text-foreground" data-capacity-result-value="${row.craftCode}">${escapeHtml(resultText)}</p>
          </div>
          <div class="space-y-2 rounded-xl bg-slate-50 px-4 py-4" data-capacity-formula-panel="${row.craftCode}">
            <p class="text-xs font-medium text-foreground">当前阶段公式</p>
            <div class="mt-2 space-y-1 text-sm text-muted-foreground">
              ${row.samCurrentFormulaLines.map((line) => `<p>${escapeHtml(line)}</p>`).join('')}
            </div>
          </div>
        </section>
      </div>

      <div class="mt-4 grid gap-4 xl:grid-cols-2">
        <section class="space-y-2 rounded-xl bg-slate-50 px-4 py-4" data-capacity-explanation-panel="${row.craftCode}">
          <p class="text-xs font-medium text-foreground">字段说明</p>
          <div class="mt-2 space-y-2 text-sm text-muted-foreground">
            ${row.samCurrentExplanationLines.map((line) => `<p>${escapeHtml(line)}</p>`).join('')}
          </div>
        </section>
        <section class="space-y-2 rounded-xl bg-slate-50 px-4 py-4" data-capacity-calculation-panel="${row.craftCode}">
          <p class="text-xs font-medium text-foreground">当前输入值代入后的计算过程</p>
          <div class="mt-2">${renderCalculationLines(factoryId, row, values)}</div>
        </section>
      </div>
    </article>
  `
}

function renderCurrentStageSection(factory: Factory): string {
  const entries = getCurrentEntries(factory.id)

  const stageSections = listProcessStages()
    .map((stage, stageIndex) => {
      const processBlocks = listProcessesByStageCode(stage.stageCode)
        .map((process, processIndex) => {
          const craftCards = entries
            .filter((entry) => entry.row.stageCode === stage.stageCode && entry.row.processCode === process.processCode)
            .map(({ row, entry }) => renderCapacityEntryCard(factory.id, row, entry.values))
            .join('')

          if (!craftCards) return ''

          return `
            <div class="space-y-4 ${processIndex === 0 ? '' : 'border-t border-slate-200 pt-5'}" data-capacity-process-section="${escapeHtml(process.processCode)}">
              <div>
                <p class="text-sm font-medium text-foreground">${escapeHtml(process.processName)}</p>
                <p class="mt-1 text-xs text-muted-foreground">${state.detailMode === 'edit' ? '保存后会按设备维护重新汇总设备侧能力。' : '详情'}</p>
              </div>
              <div class="space-y-3">${craftCards}</div>
            </div>
          `
        })
        .filter(Boolean)
        .join('')

      if (!processBlocks) return ''

      return `
        <section class="space-y-4 ${stageIndex === 0 ? '' : 'border-t border-slate-200 pt-6'}" data-capacity-stage-section="${escapeHtml(stage.stageCode)}">
          <div>
            <h4 class="text-sm font-semibold text-foreground">${escapeHtml(stage.stageName)}</h4>
          </div>
          <div class="space-y-4">${processBlocks}</div>
        </section>
      `
    })
    .filter(Boolean)
    .join('')

  return `
    <section class="space-y-6" data-testid="factory-capacity-current-stage-section">
      <div class="border-b border-slate-200 pb-4">
        <h4 class="text-sm font-medium text-foreground">产能字段与自动计算结果</h4>
      </div>
      <div class="space-y-6">${stageSections}</div>
    </section>
  `
}

function renderCapacityDetailDrawer(): string {
  const factory = getSelectedFactory()
  if (!factory) return ''

  getFactoryCapacityProfileByFactoryId(factory.id)

  return `
    <div class="fixed inset-0 z-40">
      <button class="absolute inset-0 bg-black/45" data-capacity-action="close-detail" aria-label="关闭工厂产能档案"></button>
      <section class="absolute inset-y-0 right-0 flex w-full max-w-6xl flex-col overflow-hidden border-l bg-background shadow-2xl" data-testid="factory-capacity-profile-drawer">
        <header class="flex items-start justify-between gap-4 border-b px-6 py-4">
          <div>
            <p class="text-xs uppercase tracking-wide text-muted-foreground">工厂池管理</p>
            <h2 class="mt-1 text-lg font-semibold text-foreground">工厂产能档案</h2>
            <p class="mt-1 text-sm text-muted-foreground">${escapeHtml(factory.name)}${renderTestFactoryBadge(factory)}</p>
          </div>
          <div class="flex items-center gap-2">
            <span class="rounded border px-2 py-1 text-xs text-muted-foreground">${state.detailMode === 'edit' ? '编辑' : '详情'}</span>
            ${
              state.detailMode === 'edit'
                ? `
                  <button type="button" data-capacity-action="save-detail" class="rounded-md border px-3 py-1 text-xs hover:bg-muted">保存</button>
                  <button type="button" data-capacity-action="cancel-edit" class="rounded-md border px-3 py-1 text-xs hover:bg-muted">取消</button>
                `
                : `<button type="button" data-capacity-action="edit-detail" class="rounded-md border px-3 py-1 text-xs hover:bg-muted">编辑</button>`
            }
            <button type="button" data-capacity-action="close-detail" class="rounded-md border px-2 py-1 text-xs hover:bg-muted">关闭</button>
          </div>
        </header>
        <div class="flex min-h-0 flex-1 flex-col overflow-y-auto px-6 py-5">
          <div class="space-y-6">
            ${renderTopReadonlyInfo(factory)}
            ${renderCurrentStageSection(factory)}
          </div>
        </div>
      </section>
    </div>
  `
}

function closeDetailDrawer(): void {
  state.activeFactoryId = ''
  state.detailMode = 'detail'
  state.draftEntries = []
  state.draftEquipments = []
}

function createEmptyEquipment(factoryId: string): FactoryCapacityEquipment {
  return {
    equipmentId: `${factoryId}::NEW::${Date.now()}::${Math.random().toString(16).slice(2, 8)}`,
    factoryId,
    equipmentName: '',
    equipmentNo: '',
    equipmentType: 'GENERAL',
    abilityList: [],
    quantity: 1,
    singleShiftMinutes: 480,
    status: 'AVAILABLE',
  }
}

function resolveEquipmentTypeByAbilities(abilityValues: string[]): FactoryCapacityEquipment['equipmentType'] {
  if (abilityValues.some((value) => value.startsWith('PRINT::'))) return 'PRINT_MACHINE'
  if (abilityValues.some((value) => value.startsWith('DYE::'))) return 'DYE_VAT'
  if (abilityValues.some((value) => value.startsWith('POST_FINISHING::'))) return 'POST_NODE'
  return 'GENERAL'
}

function updateDraftEntryValue(
  processCode: string,
  craftCode: string,
  fieldKey: SamCurrentFieldKey,
  value: FactoryCapacityFieldValue,
): void {
  const targetEntry = state.draftEntries.find(
    ({ row }) => row.processCode === processCode && row.craftCode === craftCode,
  )
  if (!targetEntry) return
  targetEntry.entry.values[fieldKey] = value
}

function updateDraftEquipmentField(
  equipmentId: string,
  field: string,
  value: string | string[],
): void {
  const targetEquipment = state.draftEquipments.find((item) => item.equipmentId === equipmentId)
  if (!targetEquipment) return

  if (field === 'equipmentName' || field === 'equipmentNo') {
    if (field === 'equipmentName') {
      targetEquipment.equipmentName = String(value)
    } else {
      targetEquipment.equipmentNo = String(value)
    }
    return
  }

  if (field === 'quantity' || field === 'singleShiftMinutes') {
    if (field === 'quantity') {
      targetEquipment.quantity = Math.max(0, Number(value) || 0)
    } else {
      targetEquipment.singleShiftMinutes = Math.max(0, Number(value) || 0)
    }
    return
  }

  if (field === 'status') {
    targetEquipment.status = String(value) as FactoryCapacityEquipment['status']
    return
  }

  if (field === 'efficiencyValue') {
    const nextValue = Math.max(0, Number(value) || 0)
    targetEquipment.abilityList = targetEquipment.abilityList.map((ability) => ({
      ...ability,
      efficiencyValue: nextValue,
    }))
    return
  }

  if (field === 'efficiencyUnit') {
    const nextValue = String(value)
    targetEquipment.abilityList = targetEquipment.abilityList.map((ability) => ({
      ...ability,
      efficiencyUnit: nextValue,
    }))
    return
  }

  if (field === 'abilityList') {
    const abilityValues = Array.isArray(value) ? value : [String(value)]
    const currentAbilityMap = new Map(
      targetEquipment.abilityList.map((ability) => [`${ability.processCode}::${ability.craftCode}`, ability] as const),
    )
    const fallbackEfficiencyValue = targetEquipment.abilityList[0]?.efficiencyValue ?? 1
    const fallbackEfficiencyUnit = targetEquipment.abilityList[0]?.efficiencyUnit ?? '件/分钟'
    const optionMap = new Map(
      getCapacityProcessCraftOptions().map((option) => [`${option.processCode}::${option.craftCode}`, option] as const),
    )

    targetEquipment.abilityList = abilityValues
      .map((optionValue) => {
        const current = currentAbilityMap.get(optionValue)
        if (current) return { ...current }
        const option = optionMap.get(optionValue)
        if (!option) return null
        return {
          processCode: option.processCode,
          processName: option.processName,
          craftCode: option.craftCode,
          craftName: option.craftName,
          efficiencyValue: fallbackEfficiencyValue,
          efficiencyUnit: fallbackEfficiencyUnit,
        }
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item))
    targetEquipment.equipmentType = resolveEquipmentTypeByAbilities(abilityValues)
  }
}

function normalizeCapacityValue(value: string): FactoryCapacityFieldValue {
  if (!value.trim()) return ''
  const numericValue = Number(value)
  return Number.isFinite(numericValue) ? numericValue : value
}

export function renderFactoryCapacityProfilePage(): string {
  const factories = getVisibleFactories()
  const pagedFactories = getPagedFactories(factories)
  const availableTypes = getFactoryTypeOptions()

  return `
    <div class="space-y-6" data-testid="factory-capacity-profile-page">
      <div class="flex items-center justify-between gap-4">
        <div>
          <h1 class="text-2xl font-semibold text-foreground">工厂产能档案</h1>
          <p class="mt-1 text-sm text-muted-foreground">接单能力来自工厂档案，产能节点与设备能力在此维护。</p>
        </div>
      </div>

      <div class="flex flex-wrap items-center gap-3">
        <label class="relative min-w-[220px] flex-1 max-w-sm">
          <input
            data-capacity-filter="search"
            value="${escapeHtml(state.searchKeyword)}"
            placeholder="搜索名称、编号、联系人..."
            class="w-full rounded-md border py-2 pl-3 pr-3 text-sm"
          />
        </label>

        <select data-capacity-filter="type" class="rounded-md border px-3 py-2 text-sm">
          <option value="all" ${state.typeFilter === 'all' ? 'selected' : ''}>全部类型</option>
          ${availableTypes
            .map(
              (type) =>
                `<option value="${type}" ${state.typeFilter === type ? 'selected' : ''}>${escapeHtml(factoryTypeConfig[type].label)}</option>`,
            )
            .join('')}
        </select>

        <select data-capacity-filter="status" class="rounded-md border px-3 py-2 text-sm">
          <option value="all" ${state.statusFilter === 'all' ? 'selected' : ''}>全部状态</option>
          ${Object.entries(factoryStatusConfig)
            .map(
              ([key, config]) =>
                `<option value="${key}" ${state.statusFilter === key ? 'selected' : ''}>${escapeHtml(config.label)}</option>`,
            )
            .join('')}
        </select>

        <button class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-capacity-action="reset">重置</button>
        <div class="ml-auto text-sm text-muted-foreground">共 ${factories.length} 家工厂</div>
      </div>

      <div class="overflow-x-auto rounded-lg border bg-card" data-testid="factory-capacity-profile-list">
        <table class="w-full min-w-[980px] text-sm">
          <thead class="border-b bg-muted/30">
            <tr>
              <th class="px-3 py-3 text-left text-xs font-medium text-muted-foreground">工厂名称</th>
              <th class="px-3 py-3 text-left text-xs font-medium text-muted-foreground">工厂类型</th>
              <th class="px-3 py-3 text-left text-xs font-medium text-muted-foreground">工厂状态</th>
              <th class="px-3 py-3 text-left text-xs font-medium text-muted-foreground">联系人</th>
              <th class="px-3 py-3 text-left text-xs font-medium text-muted-foreground">接单能力数</th>
              <th class="px-3 py-3 text-left text-xs font-medium text-muted-foreground">工艺 / 节点数</th>
              <th class="px-3 py-3 text-left text-xs font-medium text-muted-foreground">当前阶段档案完成度</th>
              <th class="px-3 py-3 text-right text-xs font-medium text-muted-foreground">操作</th>
            </tr>
          </thead>
          <tbody>
            ${renderCapacityTableRows(pagedFactories)}
          </tbody>
        </table>
      </div>

      ${renderPagination(factories.length)}
      ${renderCapacityDetailDrawer()}
    </div>
  `
}

export function handleFactoryCapacityProfileEvent(target: HTMLElement): boolean {
  const pathname = appStore.getState().pathname.split('?')[0]
  if (pathname !== '/fcs/factories/capacity-profile') return false

  const draftField = target.closest<HTMLElement>('[data-capacity-draft-field-key]')
  if (draftField instanceof HTMLInputElement && state.activeFactoryId && state.detailMode === 'edit') {
    const processCode = draftField.dataset.capacityDraftProcessCode
    const craftCode = draftField.dataset.capacityDraftCraftCode
    const fieldKey = draftField.dataset.capacityDraftFieldKey as SamCurrentFieldKey | undefined
    if (!processCode || !craftCode || !fieldKey) return true
    updateDraftEntryValue(processCode, craftCode, fieldKey, normalizeCapacityValue(draftField.value))
    return true
  }

  const equipmentField = target.closest<HTMLElement>('[data-capacity-equipment-field]')
  if (
    equipmentField instanceof HTMLInputElement
    || equipmentField instanceof HTMLSelectElement
    || equipmentField instanceof HTMLTextAreaElement
  ) {
    if (!state.activeFactoryId || state.detailMode !== 'edit') return true
    const equipmentId = equipmentField.dataset.capacityEquipmentId
    const field = equipmentField.dataset.capacityEquipmentField
    if (!equipmentId || !field) return true
    const value = equipmentField instanceof HTMLSelectElement && equipmentField.multiple
      ? [...equipmentField.selectedOptions].map((option) => option.value)
      : equipmentField.value
    updateDraftEquipmentField(equipmentId, field, value)
    return true
  }

  const filterNode = target.closest<HTMLElement>('[data-capacity-filter]')
  if (filterNode instanceof HTMLInputElement || filterNode instanceof HTMLSelectElement) {
    const filter = filterNode.dataset.capacityFilter
    if (filter === 'search') state.searchKeyword = filterNode.value
    if (filter === 'status') state.statusFilter = filterNode.value
    if (filter === 'type') state.typeFilter = filterNode.value
    state.currentPage = 1
    return true
  }

  const actionNode = target.closest<HTMLElement>('[data-capacity-action]')
  if (!actionNode) return false

  const action = actionNode.dataset.capacityAction
  if (!action) return false

  if (action === 'open-detail') {
    const factoryId = actionNode.dataset.factoryId
    if (!factoryId) return true
    state.activeFactoryId = factoryId
    state.detailMode = 'detail'
    resetDraftState(factoryId)
    return true
  }

  if (action === 'close-detail') {
    closeDetailDrawer()
    return true
  }

  if (action === 'edit-detail') {
    if (!state.activeFactoryId) return true
    state.detailMode = 'edit'
    resetDraftState(state.activeFactoryId)
    return true
  }

  if (action === 'cancel-edit') {
    if (!state.activeFactoryId) return true
    state.detailMode = 'detail'
    resetDraftState(state.activeFactoryId)
    return true
  }

  if (action === 'save-detail') {
    if (!state.activeFactoryId) return true
    replaceFactoryCapacityProfileEntries(
      state.activeFactoryId,
      state.draftEntries.map(({ entry }) => entry),
    )
    replaceFactoryCapacityEquipments(state.activeFactoryId, state.draftEquipments)
    state.detailMode = 'detail'
    resetDraftState(state.activeFactoryId)
    return true
  }

  if (action === 'add-equipment') {
    if (!state.activeFactoryId || state.detailMode !== 'edit') return true
    state.draftEquipments = [...state.draftEquipments, createEmptyEquipment(state.activeFactoryId)]
    return true
  }

  if (action === 'remove-equipment') {
    if (!state.activeFactoryId || state.detailMode !== 'edit') return true
    const equipmentId = actionNode.dataset.equipmentId
    if (!equipmentId) return true
    state.draftEquipments = state.draftEquipments.filter((item) => item.equipmentId !== equipmentId)
    return true
  }

  if (action === 'reset') {
    state.searchKeyword = ''
    state.statusFilter = 'all'
    state.typeFilter = 'all'
    state.currentPage = 1
    return true
  }

  const totalPages = Math.max(1, Math.ceil(getVisibleFactories().length / PAGE_SIZE))

  if (action === 'prev-page') {
    state.currentPage = Math.max(1, state.currentPage - 1)
    return true
  }

  if (action === 'next-page') {
    state.currentPage = Math.min(totalPages, state.currentPage + 1)
    return true
  }

  if (action === 'goto-page') {
    const page = Number(actionNode.dataset.page ?? '1')
    state.currentPage = Math.max(1, Math.min(totalPages, page))
    return true
  }

  return false
}

export function isFactoryCapacityProfileDialogOpen(): boolean {
  return Boolean(state.activeFactoryId)
}
