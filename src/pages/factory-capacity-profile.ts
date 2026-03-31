import {
  getFactoryMasterRecordById,
  listFactoryMasterRecords,
} from '../data/fcs/factory-master-store'
import {
  UNIT_FIELD_KEYS,
  getFactoryCapacityProfileByFactoryId,
  hasCapacityFieldValue,
  listFactoryCapacitySupportedCraftRows,
  listSamFieldKeysByCapacityScope,
  type CapacityRecordScope,
  updateFactoryCalibrationField,
  updateFactoryCapacityRecordValue,
  updateFactoryShiftCalendarField,
} from '../data/fcs/factory-capacity-profile-mock'
import {
  factoryStatusConfig,
  factoryTypeConfig,
  type CalibrationRecord,
  type Factory,
  type FactoryCapacityFieldValue,
  type FactoryCapacityProfile,
  type FactoryType,
  type ShiftCalendarRecord,
} from '../data/fcs/factory-types'
import {
  SAM_CALC_MODE_LABEL,
  getSamFactoryFieldDefinitionByKey,
  listProcessStages,
  listProcessesByStageCode,
  type ProcessCraftDictRow,
  type SamFactoryFieldKey,
} from '../data/fcs/process-craft-dict'
import { escapeHtml } from '../utils'

const PAGE_SIZE = 10

type CapacityTab = 'devices' | 'staff' | 'calendar' | 'adjustments' | 'calibration'

interface FactoryCapacityProfilePageState {
  searchKeyword: string
  statusFilter: string
  typeFilter: string
  currentPage: number
  activeFactoryId: string
  activeTab: CapacityTab
}

const state: FactoryCapacityProfilePageState = {
  searchKeyword: '',
  statusFilter: 'all',
  typeFilter: 'all',
  currentPage: 1,
  activeFactoryId: '',
  activeTab: 'devices',
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

function getSupportedProcessCount(factory: Factory): number {
  return factory.processAbilities.length
}

function getSupportedCraftCount(factory: Factory): number {
  return factory.processAbilities.reduce((total, item) => total + item.craftCodes.length, 0)
}

function getSelectedFactory(): Factory | null {
  if (!state.activeFactoryId) return null
  return getFactoryMasterRecordById(state.activeFactoryId) ?? null
}

function calculateCapacityCompletion(factory: Factory): number {
  const profile = getFactoryCapacityProfileByFactoryId(factory.id)
  const supportedRows = listFactoryCapacitySupportedCraftRows(factory.id)
  let totalFields = 0
  let filledFields = 0

  supportedRows.forEach((row) => {
    const deviceRecord = profile.processCraftDeviceRecords.find(
      (item) => item.processCode === row.processCode && item.craftCode === row.craftCode,
    )
    const staffRecord = profile.processCraftStaffRecords.find(
      (item) => item.processCode === row.processCode && item.craftCode === row.craftCode,
    )
    const adjustmentRecord = profile.processCraftAdjustmentRecords.find(
      (item) => item.processCode === row.processCode && item.craftCode === row.craftCode,
    )

    row.samFactoryFieldKeys.forEach((fieldKey) => {
      totalFields += 1
      const fieldGroup = getSamFactoryFieldDefinitionByKey(fieldKey).group
      const value =
        fieldGroup === 'DEVICE'
          ? deviceRecord?.values[fieldKey]
          : fieldGroup === 'STAFF'
            ? staffRecord?.values[fieldKey]
            : adjustmentRecord?.values[fieldKey]

      if (hasCapacityFieldValue(value)) {
        filledFields += 1
      }
    })
  })

  if (!totalFields) return 0
  return Math.round((filledFields / totalFields) * 100)
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
    <div class="space-y-1 rounded-md border bg-muted/20 px-3 py-2">
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
      const completion = calculateCapacityCompletion(factory)

      return `
        <tr class="border-b last:border-0 hover:bg-muted/30" data-capacity-factory-id="${factory.id}">
          <td class="px-3 py-3 font-medium">${escapeHtml(factory.name)}</td>
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
            >查看产能档案</button>
          </td>
        </tr>
      `
    })
    .join('')
}

function renderReadonlyProcessAbilities(factory: Factory): string {
  const supportedRows = listFactoryCapacitySupportedCraftRows(factory.id)

  return `
    <section class="space-y-4 rounded-lg border bg-card p-4" data-testid="factory-capacity-readonly-abilities">
      <div class="flex items-center justify-between gap-3">
        <div>
          <h4 class="text-sm font-medium text-foreground">工序工艺能力（来自工厂档案）</h4>
          <p class="mt-1 text-xs text-muted-foreground">产能档案只读引用工厂档案已声明的能力范围，不在此重复维护。</p>
        </div>
        <span class="rounded border border-blue-200 bg-blue-50 px-2 py-1 text-xs text-blue-700">只读引用</span>
      </div>
      <div class="space-y-4">
        ${listProcessStages()
          .map((stage) => {
            const processHtml = listProcessesByStageCode(stage.stageCode)
              .map((process) => {
                const ability = factory.processAbilities.find((item) => item.processCode === process.processCode)
                if (!ability || !ability.craftCodes.length) return ''

                const craftChips = ability.craftCodes
                  .map((craftCode) => supportedRows.find((row) => row.craftCode === craftCode))
                  .filter((row): row is ProcessCraftDictRow => Boolean(row))
                  .map(
                    (row) =>
                      `<span class="inline-flex rounded-full border border-blue-200 bg-blue-50 px-2 py-1 text-xs text-blue-700">${escapeHtml(row.craftName)}</span>`,
                  )
                  .join('')

                return `
                  <div class="space-y-2">
                    <p class="text-sm font-medium text-foreground">${escapeHtml(process.processName)}</p>
                    <div class="flex flex-wrap gap-2">${craftChips}</div>
                  </div>
                `
              })
              .filter(Boolean)
              .join('')

            if (!processHtml) return ''

            return `
              <div class="rounded-md border bg-muted/20 p-3">
                <p class="mb-3 text-sm font-medium text-foreground">${escapeHtml(stage.stageName)}</p>
                <div class="space-y-3">${processHtml}</div>
              </div>
            `
          })
          .filter(Boolean)
          .join('')}
      </div>
    </section>
  `
}

function renderTopReadonlyInfo(factory: Factory): string {
  return `
    <section class="space-y-4 rounded-lg border bg-card p-4">
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
    </section>
  `
}

function renderProcessCraftFieldInput(
  factoryId: string,
  scope: CapacityRecordScope,
  row: ProcessCraftDictRow,
  fieldKey: SamFactoryFieldKey,
  value: FactoryCapacityFieldValue | undefined,
): string {
  const field = getSamFactoryFieldDefinitionByKey(fieldKey)
  const inputType = UNIT_FIELD_KEYS.has(fieldKey) ? 'text' : 'number'
  const step = fieldKey === 'efficiencyFactor' ? '0.01' : '1'

  return `
    <label class="space-y-1.5">
      <span class="text-xs text-muted-foreground">${escapeHtml(field.label)}</span>
      <input
        type="${inputType}"
        ${inputType === 'number' ? `step="${step}"` : ''}
        data-capacity-record-scope="${scope}"
        data-capacity-process-code="${row.processCode}"
        data-capacity-craft-code="${row.craftCode}"
        data-capacity-field-key="${fieldKey}"
        value="${escapeHtml(hasCapacityFieldValue(value) ? String(value) : '')}"
        class="w-full rounded-md border px-3 py-2 text-sm"
      />
    </label>
  `
}

function renderProcessCraftEditors(
  factory: Factory,
  profile: FactoryCapacityProfile,
  scope: CapacityRecordScope,
): string {
  const scopeLabel = scope === 'device' ? '设备台账' : scope === 'staff' ? '人员台账' : '工厂工时修正'
  const supportedRows = listFactoryCapacitySupportedCraftRows(factory.id)

  const stageSections = listProcessStages()
    .map((stage) => {
      const processBlocks = listProcessesByStageCode(stage.stageCode)
        .map((process) => {
          const craftCards = supportedRows
            .filter((row) => row.stageCode === stage.stageCode && row.processCode === process.processCode)
            .map((row) => {
              const fieldKeys = listSamFieldKeysByCapacityScope(row.samFactoryFieldKeys, scope)
              if (!fieldKeys.length) return ''

              const record =
                scope === 'device'
                  ? profile.processCraftDeviceRecords.find(
                      (item) => item.processCode === row.processCode && item.craftCode === row.craftCode,
                    )
                  : scope === 'staff'
                    ? profile.processCraftStaffRecords.find(
                        (item) => item.processCode === row.processCode && item.craftCode === row.craftCode,
                      )
                    : profile.processCraftAdjustmentRecords.find(
                        (item) => item.processCode === row.processCode && item.craftCode === row.craftCode,
                      )

              return `
                <div class="rounded-md border bg-background p-3" data-capacity-craft-card="${row.craftCode}">
                  <div class="flex items-start justify-between gap-3">
                    <div>
                      <p class="text-sm font-medium text-foreground">${escapeHtml(row.craftName)}</p>
                      <p class="mt-1 text-xs text-muted-foreground">${escapeHtml(row.processName)} · ${escapeHtml(
                        SAM_CALC_MODE_LABEL[row.samCalcMode],
                      )}</p>
                    </div>
                    <span class="rounded border border-gray-200 bg-gray-50 px-2 py-1 text-xs text-muted-foreground">${fieldKeys.length} 项</span>
                  </div>
                  <div class="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    ${fieldKeys
                      .map((fieldKey) =>
                        renderProcessCraftFieldInput(factory.id, scope, row, fieldKey, record?.values[fieldKey]),
                      )
                      .join('')}
                  </div>
                </div>
              `
            })
            .filter(Boolean)
            .join('')

          if (!craftCards) return ''

          return `
            <div class="space-y-3 rounded-md border bg-muted/20 p-4">
              <div>
                <p class="text-sm font-medium text-foreground">${escapeHtml(process.processName)}</p>
                <p class="mt-1 text-xs text-muted-foreground">${escapeHtml(scopeLabel)}只展示该工序工艺真正需要维护的字段。</p>
              </div>
              <div class="space-y-3">${craftCards}</div>
            </div>
          `
        })
        .filter(Boolean)
        .join('')

      if (!processBlocks) return ''

      return `
        <section class="space-y-4 rounded-lg border bg-card p-4">
          <div>
            <h4 class="text-sm font-medium text-foreground">${escapeHtml(stage.stageName)}</h4>
          </div>
          <div class="space-y-4">${processBlocks}</div>
        </section>
      `
    })
    .filter(Boolean)
    .join('')

  return (
    stageSections ||
    `<p class="rounded-md border bg-card px-4 py-5 text-sm text-muted-foreground">当前工厂没有需要维护${escapeHtml(scopeLabel)}的工序工艺。</p>`
  )
}

function renderShiftCalendarScopeLabel(factory: Factory, record: ShiftCalendarRecord): string {
  if (record.scopeType === 'FACTORY') return '全厂'

  const process = listProcessStages()
    .flatMap((stage) => listProcessesByStageCode(stage.stageCode))
    .find((item) => item.processCode === record.scopeCode)

  if (process) return process.processName
  return record.scopeCode === factory.id ? '全厂' : record.scopeCode
}

function renderShiftCalendars(factory: Factory, profile: FactoryCapacityProfile): string {
  return `
    <section class="space-y-4 rounded-lg border bg-card p-4" data-testid="factory-capacity-calendar-tab">
      <div>
        <h4 class="text-sm font-medium text-foreground">班次日历</h4>
      </div>
      <div class="space-y-3">
        ${profile.shiftCalendars
          .map(
            (record, index) => `
              <div class="rounded-md border bg-muted/20 p-4">
                <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <label class="space-y-1.5">
                    <span class="text-xs text-muted-foreground">日期</span>
                    <input
                      type="date"
                      data-capacity-calendar-index="${index}"
                      data-capacity-calendar-field="date"
                      value="${escapeHtml(record.date)}"
                      class="w-full rounded-md border px-3 py-2 text-sm"
                    />
                  </label>
                  <label class="space-y-1.5">
                    <span class="text-xs text-muted-foreground">适用范围</span>
                    <select
                      data-capacity-calendar-index="${index}"
                      data-capacity-calendar-field="scopeType"
                      class="w-full rounded-md border px-3 py-2 text-sm"
                    >
                      <option value="FACTORY" ${record.scopeType === 'FACTORY' ? 'selected' : ''}>全厂</option>
                      <option value="PROCESS" ${record.scopeType === 'PROCESS' ? 'selected' : ''}>某工序</option>
                    </select>
                  </label>
                  <label class="space-y-1.5">
                    <span class="text-xs text-muted-foreground">适用工序</span>
                    <select
                      data-capacity-calendar-index="${index}"
                      data-capacity-calendar-field="scopeCode"
                      class="w-full rounded-md border px-3 py-2 text-sm"
                    >
                      <option value="${factory.id}" ${record.scopeType === 'FACTORY' ? 'selected' : ''}>全厂</option>
                      ${factory.processAbilities
                        .map((ability) => {
                          const process = listProcessStages()
                            .flatMap((stage) => listProcessesByStageCode(stage.stageCode))
                            .find((item) => item.processCode === ability.processCode)
                          return `<option value="${ability.processCode}" ${record.scopeCode === ability.processCode ? 'selected' : ''}>${escapeHtml(process?.processName ?? ability.processCode)}</option>`
                        })
                        .join('')}
                    </select>
                  </label>
                  <div class="rounded-md border bg-background px-3 py-2 text-sm text-muted-foreground">
                    当前显示：${escapeHtml(renderShiftCalendarScopeLabel(factory, record))}
                  </div>
                </div>
                <div class="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <label class="space-y-1.5">
                    <span class="text-xs text-muted-foreground">白班时长</span>
                    <input
                      type="number"
                      step="1"
                      data-capacity-calendar-index="${index}"
                      data-capacity-calendar-field="dayShiftMinutes"
                      value="${record.dayShiftMinutes}"
                      class="w-full rounded-md border px-3 py-2 text-sm"
                    />
                  </label>
                  <label class="space-y-1.5">
                    <span class="text-xs text-muted-foreground">夜班时长</span>
                    <input
                      type="number"
                      step="1"
                      data-capacity-calendar-index="${index}"
                      data-capacity-calendar-field="nightShiftMinutes"
                      value="${record.nightShiftMinutes}"
                      class="w-full rounded-md border px-3 py-2 text-sm"
                    />
                  </label>
                  <label class="flex items-center gap-2 rounded-md border bg-background px-3 py-2 text-sm">
                    <input
                      type="checkbox"
                      data-capacity-calendar-index="${index}"
                      data-capacity-calendar-field="isStopped"
                      ${record.isStopped ? 'checked' : ''}
                      class="h-4 w-4 rounded border"
                    />
                    <span>是否停工</span>
                  </label>
                  <label class="flex items-center gap-2 rounded-md border bg-background px-3 py-2 text-sm">
                    <input
                      type="checkbox"
                      data-capacity-calendar-index="${index}"
                      data-capacity-calendar-field="isOvertime"
                      ${record.isOvertime ? 'checked' : ''}
                      class="h-4 w-4 rounded border"
                    />
                    <span>是否加班</span>
                  </label>
                </div>
                <label class="mt-3 block space-y-1.5">
                  <span class="text-xs text-muted-foreground">备注</span>
                  <input
                    data-capacity-calendar-index="${index}"
                    data-capacity-calendar-field="note"
                    value="${escapeHtml(record.note)}"
                    class="w-full rounded-md border px-3 py-2 text-sm"
                  />
                </label>
              </div>
            `,
          )
          .join('')}
      </div>
    </section>
  `
}

function renderCalibrationRecords(factory: Factory, profile: FactoryCapacityProfile): string {
  const supportedRows = listFactoryCapacitySupportedCraftRows(factory.id)

  return `
    <section class="space-y-4 rounded-lg border bg-card p-4" data-testid="factory-capacity-calibration-tab">
      <div>
        <h4 class="text-sm font-medium text-foreground">校准记录</h4>
      </div>
      <div class="space-y-3">
        ${profile.calibrationRecords
          .map((record, index) => {
            const craftRow = supportedRows.find((row) => row.craftCode === record.craftCode)
            return `
              <div class="rounded-md border bg-muted/20 p-4">
                <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  <label class="space-y-1.5">
                    <span class="text-xs text-muted-foreground">日期 / 周期</span>
                    <input
                      data-capacity-calibration-index="${index}"
                      data-capacity-calibration-field="periodLabel"
                      value="${escapeHtml(record.periodLabel)}"
                      class="w-full rounded-md border px-3 py-2 text-sm"
                    />
                  </label>
                  <div class="rounded-md border bg-background px-3 py-2 text-sm text-muted-foreground">工序：${escapeHtml(craftRow?.processName ?? record.processCode)}</div>
                  <div class="rounded-md border bg-background px-3 py-2 text-sm text-muted-foreground">工艺：${escapeHtml(craftRow?.craftName ?? record.craftCode)}</div>
                  <label class="space-y-1.5">
                    <span class="text-xs text-muted-foreground">发布工时 SAM 参考值</span>
                    <input
                      type="number"
                      step="0.1"
                      data-capacity-calibration-index="${index}"
                      data-capacity-calibration-field="publishedSam"
                      value="${record.publishedSam}"
                      class="w-full rounded-md border px-3 py-2 text-sm"
                    />
                  </label>
                  <label class="space-y-1.5 sm:col-span-2">
                    <span class="text-xs text-muted-foreground">实际完成情况说明</span>
                    <textarea
                      data-capacity-calibration-index="${index}"
                      data-capacity-calibration-field="actualNote"
                      class="min-h-[84px] w-full rounded-md border px-3 py-2 text-sm"
                    >${escapeHtml(record.actualNote)}</textarea>
                  </label>
                  <label class="space-y-1.5 sm:col-span-2">
                    <span class="text-xs text-muted-foreground">调整建议</span>
                    <textarea
                      data-capacity-calibration-index="${index}"
                      data-capacity-calibration-field="suggestion"
                      class="min-h-[84px] w-full rounded-md border px-3 py-2 text-sm"
                    >${escapeHtml(record.suggestion)}</textarea>
                  </label>
                  <label class="flex items-center gap-2 rounded-md border bg-background px-3 py-2 text-sm">
                    <input
                      type="checkbox"
                      data-capacity-calibration-index="${index}"
                      data-capacity-calibration-field="adopted"
                      ${record.adopted ? 'checked' : ''}
                      class="h-4 w-4 rounded border"
                    />
                    <span>是否采纳</span>
                  </label>
                </div>
              </div>
            `
          })
          .join('')}
      </div>
    </section>
  `
}

function renderDetailTabContent(factory: Factory, profile: FactoryCapacityProfile): string {
  if (state.activeTab === 'devices') {
    return `<div data-testid="factory-capacity-device-tab">${renderProcessCraftEditors(factory, profile, 'device')}</div>`
  }
  if (state.activeTab === 'staff') {
    return `<div data-testid="factory-capacity-staff-tab">${renderProcessCraftEditors(factory, profile, 'staff')}</div>`
  }
  if (state.activeTab === 'calendar') {
    return renderShiftCalendars(factory, profile)
  }
  if (state.activeTab === 'adjustments') {
    return `<div data-testid="factory-capacity-adjustment-tab">${renderProcessCraftEditors(factory, profile, 'adjustment')}</div>`
  }
  return renderCalibrationRecords(factory, profile)
}

function renderCapacityDetailDrawer(): string {
  const factory = getSelectedFactory()
  if (!factory) return ''

  const profile = getFactoryCapacityProfileByFactoryId(factory.id)
  const tabs: Array<{ key: CapacityTab; label: string }> = [
    { key: 'devices', label: '设备台账' },
    { key: 'staff', label: '人员台账' },
    { key: 'calendar', label: '班次日历' },
    { key: 'adjustments', label: '工厂工时修正' },
    { key: 'calibration', label: '校准记录' },
  ]

  return `
    <div class="fixed inset-0 z-40">
      <button class="absolute inset-0 bg-black/45" data-capacity-action="close-detail" aria-label="关闭产能档案"></button>
      <section class="absolute inset-y-0 right-0 flex w-full max-w-5xl flex-col overflow-hidden border-l bg-background shadow-2xl" data-testid="factory-capacity-profile-drawer">
        <header class="flex items-start justify-between gap-4 border-b px-6 py-4">
          <div>
            <p class="text-xs uppercase tracking-wide text-muted-foreground">工厂池管理</p>
            <h2 class="mt-1 text-lg font-semibold text-foreground">产能档案</h2>
            <p class="mt-1 text-sm text-muted-foreground">${escapeHtml(factory.name)}</p>
          </div>
          <button type="button" data-capacity-action="close-detail" class="rounded-md border px-2 py-1 text-xs hover:bg-muted">关闭</button>
        </header>
        <div class="flex min-h-0 flex-1 flex-col overflow-y-auto px-6 py-5">
          <div class="space-y-4">
            ${renderTopReadonlyInfo(factory)}
            <section class="space-y-4 rounded-lg border bg-card p-4">
              <div class="flex items-center gap-2 border-b pb-3">
                ${tabs
                  .map(
                    (tab) => `
                      <button
                        type="button"
                        data-capacity-action="switch-tab"
                        data-capacity-tab="${tab.key}"
                        class="rounded px-2 py-1 text-xs ${
                          state.activeTab === tab.key
                            ? 'bg-blue-50 text-blue-700'
                            : 'text-muted-foreground hover:bg-muted'
                        }"
                      >${tab.label}</button>
                    `,
                  )
                  .join('')}
              </div>
              ${renderDetailTabContent(factory, profile)}
            </section>
          </div>
        </div>
      </section>
    </div>
  `
}

function closeDetailDrawer(): void {
  state.activeFactoryId = ''
  state.activeTab = 'devices'
}

function normalizeCapacityValue(
  fieldKey: SamFactoryFieldKey,
  value: string,
): FactoryCapacityFieldValue {
  if (UNIT_FIELD_KEYS.has(fieldKey)) return value
  if (!value.trim()) return ''
  const numericValue = Number(value)
  return Number.isFinite(numericValue) ? numericValue : value
}

function normalizeShiftCalendarValue(
  field: keyof ShiftCalendarRecord,
  target: HTMLInputElement | HTMLSelectElement,
): ShiftCalendarRecord[keyof ShiftCalendarRecord] {
  if (field === 'isStopped' || field === 'isOvertime') {
    return target instanceof HTMLInputElement ? target.checked : false
  }

  if (field === 'dayShiftMinutes' || field === 'nightShiftMinutes') {
    return Number(target.value || '0')
  }

  return target.value
}

function normalizeCalibrationValue(
  field: keyof CalibrationRecord,
  target: HTMLInputElement | HTMLTextAreaElement,
): CalibrationRecord[keyof CalibrationRecord] {
  if (field === 'adopted' && target instanceof HTMLInputElement) {
    return target.checked
  }

  if (field === 'publishedSam') {
    return Number(target.value || '0')
  }

  return target.value
}

export function renderFactoryCapacityProfilePage(): string {
  const factories = getVisibleFactories()
  const pagedFactories = getPagedFactories(factories)
  const availableTypes = getFactoryTypeOptions()

  return `
    <div class="space-y-6" data-testid="factory-capacity-profile-page">
      <div class="flex items-center justify-between gap-4">
        <div>
          <h1 class="text-2xl font-semibold text-foreground">产能档案</h1>
          <p class="mt-1 text-sm text-muted-foreground">工厂来源于工厂档案，工序工艺能力只读引用；设备、人员、班次和修正信息在此维护。</p>
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
              <th class="px-3 py-3 text-left text-xs font-medium text-muted-foreground">已支持工序数</th>
              <th class="px-3 py-3 text-left text-xs font-medium text-muted-foreground">已支持工艺数</th>
              <th class="px-3 py-3 text-left text-xs font-medium text-muted-foreground">产能档案完成度</th>
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
  const recordField = target.closest<HTMLElement>('[data-capacity-record-scope]')
  if (recordField instanceof HTMLInputElement && state.activeFactoryId) {
    const scope = recordField.dataset.capacityRecordScope as CapacityRecordScope | undefined
    const processCode = recordField.dataset.capacityProcessCode
    const craftCode = recordField.dataset.capacityCraftCode
    const fieldKey = recordField.dataset.capacityFieldKey as SamFactoryFieldKey | undefined
    if (!scope || !processCode || !craftCode || !fieldKey) return true

    updateFactoryCapacityRecordValue(
      state.activeFactoryId,
      scope,
      processCode,
      craftCode,
      fieldKey,
      normalizeCapacityValue(fieldKey, recordField.value),
    )
    return true
  }

  const calendarField = target.closest<HTMLElement>('[data-capacity-calendar-field]')
  if (
    (calendarField instanceof HTMLInputElement || calendarField instanceof HTMLSelectElement) &&
    state.activeFactoryId
  ) {
    const field = calendarField.dataset.capacityCalendarField as keyof ShiftCalendarRecord | undefined
    const index = Number(calendarField.dataset.capacityCalendarIndex ?? '-1')
    if (!field || index < 0) return true

    updateFactoryShiftCalendarField(
      state.activeFactoryId,
      index,
      field,
      normalizeShiftCalendarValue(field, calendarField),
    )
    return true
  }

  const calibrationField = target.closest<HTMLElement>('[data-capacity-calibration-field]')
  if (
    (calibrationField instanceof HTMLInputElement || calibrationField instanceof HTMLTextAreaElement) &&
    state.activeFactoryId
  ) {
    const field = calibrationField.dataset.capacityCalibrationField as keyof CalibrationRecord | undefined
    const index = Number(calibrationField.dataset.capacityCalibrationIndex ?? '-1')
    if (!field || index < 0) return true

    updateFactoryCalibrationField(
      state.activeFactoryId,
      index,
      field,
      normalizeCalibrationValue(field, calibrationField),
    )
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
    state.activeTab = 'devices'
    return true
  }

  if (action === 'close-detail') {
    closeDetailDrawer()
    return true
  }

  if (action === 'switch-tab') {
    const nextTab = actionNode.dataset.capacityTab as CapacityTab | undefined
    if (nextTab) state.activeTab = nextTab
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
