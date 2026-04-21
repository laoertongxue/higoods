import {
  calculateFactoryCapacityCompletion,
  computeFactoryCapacityEntryResult,
  getFactoryCapacityProfileByFactoryId,
  listFactoryCapacityEntries,
  listFactoryDyeVatCapacities,
  listFactoryPostCapacityNodes,
  listFactoryPrintMachineCapacities,
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
  type FactoryCapacityFieldValue,
  type FactoryType,
} from '../data/fcs/factory-types'
import {
  SAM_CALC_MODE_LABEL,
  getProcessDefinitionByCode,
  listProcessStages,
  listProcessesByStageCode,
  type ProcessCraftDictRow,
  type SamCurrentFieldKey,
} from '../data/fcs/process-craft-dict'
import { getSamBusinessFieldDescription, getSamBusinessFieldLabel } from '../data/fcs/sam-field-display'
import { appStore } from '../state/store'
import { escapeHtml } from '../utils'
import { updateFactoryCapacityEntryValue } from '../data/fcs/factory-capacity-profile-mock'

const PAGE_SIZE = 10

interface FactoryCapacityProfilePageState {
  searchKeyword: string
  statusFilter: string
  typeFilter: string
  currentPage: number
  activeFactoryId: string
}

const state: FactoryCapacityProfilePageState = {
  searchKeyword: '',
  statusFilter: 'all',
  typeFilter: 'all',
  currentPage: 1,
  activeFactoryId: '',
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

function renderPostCapacityNodesSection(factoryId: string): string {
  const rows = listFactoryPostCapacityNodes(factoryId)
  if (!rows.length) return ''

  return `
    <section class="space-y-3" data-testid="factory-post-capacity-nodes">
      <div class="flex items-center justify-between gap-3">
        <h4 class="text-sm font-medium text-foreground">产能节点</h4>
        <span class="text-xs text-muted-foreground">后道</span>
      </div>
      <div class="overflow-hidden rounded-lg border">
        <table class="w-full text-sm">
          <thead class="bg-muted/30">
            <tr>
              <th class="px-3 py-2 text-left text-xs font-medium text-muted-foreground">节点</th>
              <th class="px-3 py-2 text-left text-xs font-medium text-muted-foreground">设备数</th>
              <th class="px-3 py-2 text-left text-xs font-medium text-muted-foreground">人员数</th>
              <th class="px-3 py-2 text-left text-xs font-medium text-muted-foreground">单班时长</th>
              <th class="px-3 py-2 text-left text-xs font-medium text-muted-foreground">标准效率</th>
              <th class="px-3 py-2 text-left text-xs font-medium text-muted-foreground">状态</th>
            </tr>
          </thead>
          <tbody>
            ${rows
              .map(
                (row) => `
                  <tr class="border-t">
                    <td class="px-3 py-3 font-medium">${escapeHtml(row.nodeName)}</td>
                    <td class="px-3 py-3">${row.machineCount}</td>
                    <td class="px-3 py-3">${row.operatorCount ?? '—'}</td>
                    <td class="px-3 py-3">${row.shiftMinutes} 分钟</td>
                    <td class="px-3 py-3">${row.efficiencyValue ? `${row.efficiencyValue} ${row.efficiencyUnit ?? ''}`.trim() : '—'}</td>
                    <td class="px-3 py-3">${escapeHtml(factoryEquipmentStatusLabel[row.status])}</td>
                  </tr>
                `,
              )
              .join('')}
          </tbody>
        </table>
      </div>
    </section>
  `
}

function renderPrintMachinesSection(factoryId: string): string {
  const rows = listFactoryPrintMachineCapacities(factoryId)
  if (!rows.length) return ''

  return `
    <section class="space-y-3" data-testid="factory-print-machine-capacity">
      <div class="flex items-center justify-between gap-3">
        <h4 class="text-sm font-medium text-foreground">印花打印机</h4>
        <span class="text-xs text-muted-foreground">${rows.length} 台</span>
      </div>
      <div class="overflow-hidden rounded-lg border">
        <table class="w-full text-sm">
          <thead class="bg-muted/30">
            <tr>
              <th class="px-3 py-2 text-left text-xs font-medium text-muted-foreground">打印机编号</th>
              <th class="px-3 py-2 text-left text-xs font-medium text-muted-foreground">打印速度</th>
              <th class="px-3 py-2 text-left text-xs font-medium text-muted-foreground">单班时长</th>
              <th class="px-3 py-2 text-left text-xs font-medium text-muted-foreground">设备状态</th>
            </tr>
          </thead>
          <tbody>
            ${rows
              .map(
                (row) => `
                  <tr class="border-t">
                    <td class="px-3 py-3 font-medium">${escapeHtml(row.printerNo)}</td>
                    <td class="px-3 py-3">${row.speedValue} ${escapeHtml(row.speedUnit)}</td>
                    <td class="px-3 py-3">${row.shiftMinutes} 分钟</td>
                    <td class="px-3 py-3">${escapeHtml(factoryEquipmentStatusLabel[row.status])}</td>
                  </tr>
                `,
              )
              .join('')}
          </tbody>
        </table>
      </div>
    </section>
  `
}

function renderDyeVatsSection(factoryId: string): string {
  const rows = listFactoryDyeVatCapacities(factoryId)
  if (!rows.length) return ''

  return `
    <section class="space-y-3" data-testid="factory-dye-vat-capacity">
      <div class="flex items-center justify-between gap-3">
        <h4 class="text-sm font-medium text-foreground">染缸</h4>
        <span class="text-xs text-muted-foreground">${rows.length} 台</span>
      </div>
      <div class="overflow-hidden rounded-lg border">
        <table class="w-full text-sm">
          <thead class="bg-muted/30">
            <tr>
              <th class="px-3 py-2 text-left text-xs font-medium text-muted-foreground">染缸编号</th>
              <th class="px-3 py-2 text-left text-xs font-medium text-muted-foreground">染缸容量</th>
              <th class="px-3 py-2 text-left text-xs font-medium text-muted-foreground">可染类型</th>
              <th class="px-3 py-2 text-left text-xs font-medium text-muted-foreground">设备状态</th>
            </tr>
          </thead>
          <tbody>
            ${rows
              .map(
                (row) => `
                  <tr class="border-t">
                    <td class="px-3 py-3 font-medium">${escapeHtml(row.dyeVatNo)}</td>
                    <td class="px-3 py-3">${row.capacityQty} ${escapeHtml(row.capacityUnit)}</td>
                    <td class="px-3 py-3">${escapeHtml(row.supportedMaterialTypes.join('、'))}</td>
                    <td class="px-3 py-3">${escapeHtml(factoryEquipmentStatusLabel[row.status])}</td>
                  </tr>
                `,
              )
              .join('')}
          </tbody>
        </table>
      </div>
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
      ${renderPostCapacityNodesSection(factory.id)}
      ${renderPrintMachinesSection(factory.id)}
      ${renderDyeVatsSection(factory.id)}
    </section>
  `
}

function formatCapacityValue(value: FactoryCapacityFieldValue | undefined): string {
  return value === undefined || value === null ? '' : String(value)
}

function getCurrentPhaseFieldLabel(fieldKey: SamCurrentFieldKey): string {
  return getSamBusinessFieldLabel(fieldKey)
}

function getCurrentPhaseFieldDescription(fieldKey: SamCurrentFieldKey): string {
  return getSamBusinessFieldDescription(fieldKey)
}

function renderCurrentFieldInput(
  processCode: string,
  craftCode: string,
  fieldKey: SamCurrentFieldKey,
  value: FactoryCapacityFieldValue | undefined,
): string {
  const step = fieldKey === 'efficiencyFactor' || fieldKey === 'deviceEfficiencyValue' || fieldKey === 'staffEfficiencyValue'
    ? '0.01'
    : '1'

  return `
    <label class="space-y-1.5">
      <span class="text-xs text-muted-foreground">${escapeHtml(getCurrentPhaseFieldLabel(fieldKey))}</span>
      <input
        type="number"
        step="${step}"
        data-capacity-process-code="${processCode}"
        data-capacity-craft-code="${craftCode}"
        data-capacity-field-key="${fieldKey}"
        value="${escapeHtml(formatCapacityValue(value))}"
        class="w-full rounded-md border px-3 py-2 text-sm"
      />
      <span class="text-[11px] text-muted-foreground">${escapeHtml(getCurrentPhaseFieldDescription(fieldKey))}</span>
    </label>
  `
}

function renderCalculationLines(row: ProcessCraftDictRow, values: Record<string, FactoryCapacityFieldValue>): string {
  const result = computeFactoryCapacityEntryResult(row, values)
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

function renderCapacityEntryCard(factoryId: string, row: ProcessCraftDictRow, values: Record<string, FactoryCapacityFieldValue>): string {
  const result = computeFactoryCapacityEntryResult(row, values)
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
                renderCurrentFieldInput(row.processCode, row.craftCode, fieldKey, values[fieldKey]),
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
          <div class="mt-2">${renderCalculationLines(row, values)}</div>
        </section>
      </div>
    </article>
  `
}

function renderCurrentStageSection(factory: Factory): string {
  const entries = listFactoryCapacityEntries(factory.id)

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
                <p class="mt-1 text-xs text-muted-foreground">当前阶段按该工艺最小必要字段维护，系统自动计算默认日可供给发布工时 SAM。</p>
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
            <p class="mt-1 text-sm text-muted-foreground">${escapeHtml(factory.name)}</p>
          </div>
          <button type="button" data-capacity-action="close-detail" class="rounded-md border px-2 py-1 text-xs hover:bg-muted">关闭</button>
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

  const recordField = target.closest<HTMLElement>('[data-capacity-field-key]')
  if (recordField instanceof HTMLInputElement && state.activeFactoryId) {
    const processCode = recordField.dataset.capacityProcessCode
    const craftCode = recordField.dataset.capacityCraftCode
    const fieldKey = recordField.dataset.capacityFieldKey as SamCurrentFieldKey | undefined
    if (!processCode || !craftCode || !fieldKey) return true

    updateFactoryCapacityEntryValue(
      state.activeFactoryId,
      processCode,
      craftCode,
      fieldKey,
      normalizeCapacityValue(recordField.value),
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
    return true
  }

  if (action === 'close-detail') {
    closeDetailDrawer()
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
