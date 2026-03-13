import {
  indonesiaFactories,
  kpiTemplateLabels,
  tierLabels,
  typeLabels,
  type KpiTemplate,
} from '../data/fcs/indonesia-factories'
import { escapeHtml } from '../utils'

const PAGE_SIZE = 10

type SortField = 'score' | 'onTimeRate' | 'defectRate'

type PerformanceLevel = 'A' | 'B' | 'C'

type DialogState =
  | { type: 'none' }
  | { type: 'detail'; factoryId: string }
  | { type: 'form'; factoryId?: string }
  | { type: 'log' }

interface FactoryPerformance {
  factoryId: string
  factoryName: string
  factoryCode: string
  tier: (typeof indonesiaFactories)[number]['tier']
  type: (typeof indonesiaFactories)[number]['type']
  kpiTemplate: KpiTemplate
  status: string
  onTimeRate: number
  defectRate: number
  rejectRate: number
  disputeRate: number
  score: number
  level: PerformanceLevel
  updatedAt: string
}

interface PerformanceRecord {
  id: string
  factoryId: string
  period: string
  onTimeRate: number
  defectRate: number
  rejectRate: number
  disputeRate: number
  score: number
  level: PerformanceLevel
  note?: string
  updatedAt: string
  updatedBy: string
}

interface ChangeLog {
  id: string
  action: 'PERFORMANCE_UPDATE'
  factoryId: string
  factoryName: string
  period: string
  detail: string
  operator: string
  timestamp: string
}

interface FormState {
  factoryId: string
  period: string
  onTimeRate: number
  defectRate: number
  rejectRate: number
  disputeRate: number
  note: string
}

interface PerformanceState {
  performanceList: FactoryPerformance[]
  recordsData: Record<string, PerformanceRecord[]>
  changeLogs: ChangeLog[]
  keyword: string
  monthFilter: string
  currentPage: number
  sortField: SortField
  sortOrder: 'asc' | 'desc'
  dialog: DialogState
  form: FormState
  formErrors: Record<string, string>
  openActionFactoryId: string | null
}

type UserRole = 'ADMIN' | 'OPS' | 'FINANCE' | 'VIEWER'

const currentUser = {
  role: 'ADMIN' as UserRole,
  name: 'Admin User',
}

const canModify = ['ADMIN', 'OPS'].includes(currentUser.role)

function calculateScore(data: {
  onTimeRate: number
  defectRate: number
  rejectRate: number
  disputeRate: number
}): number {
  const score =
    data.onTimeRate * 0.4 +
    (100 - data.defectRate) * 0.3 +
    (100 - data.rejectRate) * 0.2 +
    (100 - data.disputeRate) * 0.1

  return Math.round(score * 10) / 10
}

function calculateLevel(score: number): PerformanceLevel {
  if (score >= 90) return 'A'
  if (score >= 75) return 'B'
  return 'C'
}

function checkRisks(data: { onTimeRate: number; defectRate: number }): string[] {
  const risks: string[] = []
  if (data.onTimeRate < 90) risks.push('准时交付率低于90%')
  if (data.defectRate > 3) risks.push('残次率超过3%')
  return risks
}

function getCurrentMonth(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

function getMonthOptions(): string[] {
  const options: string[] = []
  const now = new Date()

  for (let index = 0; index < 12; index += 1) {
    const date = new Date(now.getFullYear(), now.getMonth() - index, 1)
    options.push(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`)
  }

  return options
}

function generatePerformanceData(): FactoryPerformance[] {
  return indonesiaFactories.map((factory) => {
    const score =
      factory.performanceScore ||
      calculateScore({
        onTimeRate: factory.qualityScore,
        defectRate: 100 - factory.deliveryScore,
        rejectRate: Math.random() * 5,
        disputeRate: Math.random() * 3,
      })

    return {
      factoryId: factory.id,
      factoryName: factory.name,
      factoryCode: factory.code,
      tier: factory.tier,
      type: factory.type,
      kpiTemplate: factory.kpiTemplate,
      status: factory.status,
      onTimeRate: factory.performanceScore ? 85 + Math.random() * 15 : factory.qualityScore,
      defectRate: Math.round((100 - factory.deliveryScore) * 0.1 * 10) / 10,
      rejectRate: Math.round(Math.random() * 5 * 10) / 10,
      disputeRate: Math.round(Math.random() * 3 * 10) / 10,
      score: factory.performanceScore || Math.round(score * 10) / 10,
      level: factory.performanceLevel || calculateLevel(score),
      updatedAt: factory.updatedAt,
    }
  })
}

function generateInitialRecords(): Record<string, PerformanceRecord[]> {
  const records: Record<string, PerformanceRecord[]> = {}
  indonesiaFactories.slice(0, 10).forEach((factory) => {
    const months = ['2024-12', '2024-11', '2024-10']
    records[factory.id] = months.map((period, index) => {
      const onTimeRate = 85 + Math.random() * 15
      const defectRate = Math.round(Math.random() * 5 * 10) / 10
      const rejectRate = Math.round(Math.random() * 5 * 10) / 10
      const disputeRate = Math.round(Math.random() * 3 * 10) / 10
      const score = calculateScore({ onTimeRate, defectRate, rejectRate, disputeRate })

      return {
        id: `pr-${factory.id}-${period}`,
        factoryId: factory.id,
        period,
        onTimeRate: Math.round(onTimeRate * 10) / 10,
        defectRate,
        rejectRate,
        disputeRate,
        score: Math.round(score * 10) / 10,
        level: calculateLevel(score),
        updatedAt: `2024-${12 - index}-05 10:00:00`,
        updatedBy: index === 0 ? 'Budi Admin' : 'System',
      }
    })
  })

  return records
}

const initialPerformanceList = generatePerformanceData()

const state: PerformanceState = {
  performanceList: initialPerformanceList,
  recordsData: generateInitialRecords(),
  changeLogs: [],
  keyword: '',
  monthFilter: 'all',
  currentPage: 1,
  sortField: 'score',
  sortOrder: 'desc',
  dialog: { type: 'none' },
  form: {
    factoryId: '',
    period: getCurrentMonth(),
    onTimeRate: 0,
    defectRate: 0,
    rejectRate: 0,
    disputeRate: 0,
    note: '',
  },
  formErrors: {},
  openActionFactoryId: null,
}

function getLevelBadgeClass(level: PerformanceLevel): string {
  if (level === 'A') return 'bg-green-100 text-green-700 border-green-200'
  if (level === 'B') return 'bg-blue-100 text-blue-700 border-blue-200'
  return 'bg-red-100 text-red-700 border-red-200'
}

function getScoreBadgeClass(score: number): string {
  if (score >= 90) return 'bg-green-100 text-green-800'
  if (score >= 75) return 'bg-blue-100 text-blue-800'
  return 'bg-red-100 text-red-800'
}

function getFilteredList(): FactoryPerformance[] {
  let result = [...state.performanceList]

  if (state.keyword.trim()) {
    const keyword = state.keyword.toLowerCase()
    result = result.filter(
      (factory) =>
        factory.factoryName.toLowerCase().includes(keyword) ||
        factory.factoryCode.toLowerCase().includes(keyword),
    )
  }

  result.sort((left, right) => {
    const leftValue = left[state.sortField]
    const rightValue = right[state.sortField]
    return state.sortOrder === 'asc' ? leftValue - rightValue : rightValue - leftValue
  })

  return result
}

function getPagedList(filteredList: FactoryPerformance[]): FactoryPerformance[] {
  const start = (state.currentPage - 1) * PAGE_SIZE
  return filteredList.slice(start, start + PAGE_SIZE)
}

function getSummary(filteredList: FactoryPerformance[]) {
  if (filteredList.length === 0) {
    return {
      avgOnTimeRate: 0,
      avgDefectRate: 0,
      avgRejectRate: 0,
      avgDisputeRate: 0,
      avgScore: 0,
    }
  }

  const sum = filteredList.reduce(
    (acc, factory) => ({
      onTimeRate: acc.onTimeRate + factory.onTimeRate,
      defectRate: acc.defectRate + factory.defectRate,
      rejectRate: acc.rejectRate + factory.rejectRate,
      disputeRate: acc.disputeRate + factory.disputeRate,
      score: acc.score + factory.score,
    }),
    {
      onTimeRate: 0,
      defectRate: 0,
      rejectRate: 0,
      disputeRate: 0,
      score: 0,
    },
  )

  const count = filteredList.length

  return {
    avgOnTimeRate: Math.round((sum.onTimeRate / count) * 10) / 10,
    avgDefectRate: Math.round((sum.defectRate / count) * 10) / 10,
    avgRejectRate: Math.round((sum.rejectRate / count) * 10) / 10,
    avgDisputeRate: Math.round((sum.disputeRate / count) * 10) / 10,
    avgScore: Math.round((sum.score / count) * 10) / 10,
  }
}

function findFactoryById(factoryId?: string): FactoryPerformance | null {
  if (!factoryId) return null
  return state.performanceList.find((factory) => factory.factoryId === factoryId) ?? null
}

function resetForm(factory?: FactoryPerformance): void {
  if (factory) {
    state.form = {
      factoryId: factory.factoryId,
      period: getCurrentMonth(),
      onTimeRate: factory.onTimeRate,
      defectRate: factory.defectRate,
      rejectRate: factory.rejectRate,
      disputeRate: factory.disputeRate,
      note: '',
    }
  } else {
    state.form = {
      factoryId: '',
      period: getCurrentMonth(),
      onTimeRate: 0,
      defectRate: 0,
      rejectRate: 0,
      disputeRate: 0,
      note: '',
    }
  }

  state.formErrors = {}
}

function validateForm(): boolean {
  const errors: Record<string, string> = {}

  if (!state.form.factoryId) errors.factoryId = '请选择工厂'
  if (!state.form.period) errors.period = '请选择周期'

  if (state.form.onTimeRate < 0 || state.form.onTimeRate > 100) {
    errors.onTimeRate = '需在 0-100 之间'
  }

  if (state.form.defectRate < 0 || state.form.defectRate > 100) {
    errors.defectRate = '需在 0-100 之间'
  }

  if (state.form.rejectRate < 0 || state.form.rejectRate > 100) {
    errors.rejectRate = '需在 0-100 之间'
  }

  if (state.form.disputeRate < 0 || state.form.disputeRate > 100) {
    errors.disputeRate = '需在 0-100 之间'
  }

  state.formErrors = errors
  return Object.keys(errors).length === 0
}

function closeDialog(): void {
  state.dialog = { type: 'none' }
}

function submitForm(): void {
  if (!validateForm()) return

  const now = new Date()
  const nowText = now.toLocaleString('zh-CN')
  const today = now.toISOString().split('T')[0]
  const score = calculateScore(state.form)
  const level = calculateLevel(score)

  state.performanceList = state.performanceList.map((factory) =>
    factory.factoryId === state.form.factoryId
      ? {
          ...factory,
          onTimeRate: state.form.onTimeRate,
          defectRate: state.form.defectRate,
          rejectRate: state.form.rejectRate,
          disputeRate: state.form.disputeRate,
          score,
          level,
          updatedAt: today,
        }
      : factory,
  )

  const newRecord: PerformanceRecord = {
    id: `pr-${Date.now()}`,
    factoryId: state.form.factoryId,
    period: state.form.period,
    onTimeRate: state.form.onTimeRate,
    defectRate: state.form.defectRate,
    rejectRate: state.form.rejectRate,
    disputeRate: state.form.disputeRate,
    score,
    level,
    note: state.form.note,
    updatedAt: nowText,
    updatedBy: currentUser.name,
  }

  state.recordsData = {
    ...state.recordsData,
    [state.form.factoryId]: [
      newRecord,
      ...(state.recordsData[state.form.factoryId] ?? []),
    ],
  }

  const factory = findFactoryById(state.form.factoryId)

  state.changeLogs = [
    {
      id: `log-${Date.now()}`,
      action: 'PERFORMANCE_UPDATE',
      factoryId: state.form.factoryId,
      factoryName: factory?.factoryName ?? '',
      period: state.form.period,
      detail: `绩效录入/调整，总分 ${score}，等级 ${level}`,
      operator: currentUser.name,
      timestamp: nowText,
    },
    ...state.changeLogs,
  ]

  closeDialog()
}

function renderSummaryCard(icon: string, iconClass: string, label: string, value: string): string {
  return `
    <article class="rounded-lg border bg-card">
      <div class="p-4 pt-4">
        <div class="mb-1 flex items-center gap-2 text-sm text-muted-foreground">
          <i data-lucide="${icon}" class="h-4 w-4 ${iconClass}"></i>
          ${escapeHtml(label)}
        </div>
        <div class="text-2xl font-bold">${escapeHtml(value)}</div>
      </div>
    </article>
  `
}

function renderDetailDialog(): string {
  if (state.dialog.type !== 'detail') return ''

  const factory = findFactoryById(state.dialog.factoryId)
  if (!factory) return ''

  const records = (state.recordsData[factory.factoryId] ?? []).slice(0, 10)
  const risks = checkRisks(factory)
  const riskSection =
    risks.length > 0
      ? `
        <section class="space-y-2">
          <h3 class="flex items-center gap-2 font-medium text-red-600">
            <i data-lucide="alert-triangle" class="h-4 w-4"></i>
            风险提示
          </h3>
          <ul class="list-inside list-disc space-y-1 text-sm text-red-600">
            ${risks.map((risk) => `<li>${escapeHtml(risk)}</li>`).join('')}
          </ul>
        </section>
        <div class="border-t"></div>
      `
      : ''

  return `
    <div class="fixed inset-0 z-50" data-dialog-backdrop="true">
      <button class="absolute inset-0 bg-black/45" data-perf-action="close-dialog" aria-label="关闭"></button>
      <section class="absolute inset-y-0 right-0 w-full border-l bg-background shadow-2xl sm:max-w-[600px]" data-dialog-panel="true">
        <div class="flex items-start justify-between border-b px-6 py-4">
          <div>
            <h3 class="text-lg font-semibold">绩效明细</h3>
            <p class="mt-1 text-sm text-muted-foreground">${escapeHtml(factory.factoryName)} (${escapeHtml(factory.factoryCode)})</p>
          </div>
          <button class="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-muted" data-perf-action="close-dialog" aria-label="关闭">
            <i data-lucide="x" class="h-4 w-4"></i>
          </button>
        </div>

        <div class="h-[calc(100vh-81px)] space-y-5 overflow-y-auto px-6 py-5">
          <section class="space-y-2">
            <h3 class="font-medium">工厂信息</h3>
            <div class="grid grid-cols-2 gap-2 text-sm">
              <div><span class="text-muted-foreground">层级：</span>${escapeHtml(tierLabels[factory.tier])}</div>
              <div><span class="text-muted-foreground">类型：</span>${escapeHtml(typeLabels[factory.type])}</div>
              <div><span class="text-muted-foreground">KPI模板：</span>${escapeHtml(kpiTemplateLabels[factory.kpiTemplate])}</div>
            </div>
          </section>

          <div class="border-t"></div>

          <section class="space-y-3">
            <h3 class="font-medium">当前绩效指标</h3>
            <div class="grid grid-cols-2 gap-4">
              <div class="rounded-lg bg-muted/50 p-3">
                <div class="text-sm text-muted-foreground">准时交付率</div>
                <div class="text-xl font-semibold ${factory.onTimeRate < 90 ? 'text-red-600' : ''}">
                  ${factory.onTimeRate.toFixed(1)}%
                  ${
                    factory.onTimeRate < 90
                      ? '<i data-lucide="alert-triangle" class="ml-1 inline h-4 w-4 text-red-500"></i>'
                      : ''
                  }
                </div>
              </div>
              <div class="rounded-lg bg-muted/50 p-3">
                <div class="text-sm text-muted-foreground">残次率</div>
                <div class="text-xl font-semibold ${factory.defectRate > 3 ? 'text-red-600' : ''}">
                  ${factory.defectRate.toFixed(1)}%
                  ${
                    factory.defectRate > 3
                      ? '<i data-lucide="alert-triangle" class="ml-1 inline h-4 w-4 text-red-500"></i>'
                      : ''
                  }
                </div>
              </div>
              <div class="rounded-lg bg-muted/50 p-3">
                <div class="text-sm text-muted-foreground">拒单率</div>
                <div class="text-xl font-semibold">${factory.rejectRate}%</div>
              </div>
              <div class="rounded-lg bg-muted/50 p-3">
                <div class="text-sm text-muted-foreground">争议率</div>
                <div class="text-xl font-semibold">${factory.disputeRate}%</div>
              </div>
            </div>
            <div class="flex items-center gap-4 rounded-lg bg-muted/50 p-3">
              <div>
                <div class="text-sm text-muted-foreground">绩效总分</div>
                <span class="inline-flex rounded px-2 py-0.5 text-sm ${getScoreBadgeClass(factory.score)}">${factory.score}</span>
              </div>
              <div>
                <div class="text-sm text-muted-foreground">绩效等级</div>
                <span class="inline-flex rounded border px-2 py-0.5 text-sm ${getLevelBadgeClass(factory.level)}">${factory.level}</span>
              </div>
            </div>
          </section>

          <div class="border-t"></div>

          ${riskSection}

          <section class="space-y-3">
            <h3 class="font-medium">绩效记录历史</h3>
            <table class="w-full text-sm">
              <thead class="border-b">
                <tr>
                  <th class="px-3 py-2 text-left text-xs font-medium text-muted-foreground">周期</th>
                  <th class="px-3 py-2 text-left text-xs font-medium text-muted-foreground">总分</th>
                  <th class="px-3 py-2 text-left text-xs font-medium text-muted-foreground">等级</th>
                  <th class="px-3 py-2 text-left text-xs font-medium text-muted-foreground">更新人</th>
                  <th class="px-3 py-2 text-left text-xs font-medium text-muted-foreground">时间</th>
                </tr>
              </thead>
              <tbody>
                ${
                  records.length === 0
                    ? '<tr><td colspan="5" class="py-6 text-center text-muted-foreground">暂无历史记录</td></tr>'
                    : records
                        .map(
                          (record) => `
                            <tr class="border-b last:border-0">
                              <td class="px-3 py-2">${escapeHtml(record.period)}</td>
                              <td class="px-3 py-2"><span class="inline-flex rounded px-2 py-0.5 text-xs ${getScoreBadgeClass(record.score)}">${record.score}</span></td>
                              <td class="px-3 py-2"><span class="inline-flex rounded border px-2 py-0.5 text-xs ${getLevelBadgeClass(record.level)}">${record.level}</span></td>
                              <td class="px-3 py-2">${escapeHtml(record.updatedBy)}</td>
                              <td class="px-3 py-2 text-sm">${escapeHtml(record.updatedAt)}</td>
                            </tr>
                          `,
                        )
                        .join('')
                }
              </tbody>
            </table>
          </section>
        </div>
      </section>
    </div>
  `
}

function renderFormDialog(): string {
  if (state.dialog.type !== 'form') return ''

  const editingFactory = findFactoryById(state.dialog.factoryId)
  const previewScore = calculateScore(state.form)
  const previewLevel = calculateLevel(previewScore)
  const factorySelector =
    editingFactory
      ? ''
      : `
        <div class="space-y-2">
          <label class="text-sm">选择工厂 <span class="text-red-500">*</span></label>
          <select data-perf-field="factoryId" class="w-full rounded-md border px-3 py-2 text-sm">
            <option value="">请选择工厂</option>
            ${state.performanceList
              .map(
                (factory) =>
                  `<option value="${factory.factoryId}" ${state.form.factoryId === factory.factoryId ? 'selected' : ''}>${escapeHtml(factory.factoryName)}</option>`,
              )
              .join('')}
          </select>
          ${state.formErrors.factoryId ? `<p class="text-sm text-red-500">${escapeHtml(state.formErrors.factoryId)}</p>` : ''}
        </div>
      `

  return `
    <div class="fixed inset-0 z-50" data-dialog-backdrop="true">
      <button class="absolute inset-0 bg-black/45" data-perf-action="close-dialog" aria-label="关闭"></button>
      <section class="absolute inset-y-0 right-0 w-full border-l bg-background shadow-2xl sm:max-w-[500px]" data-dialog-panel="true">
        <div class="flex items-start justify-between border-b px-6 py-4">
          <div>
            <h3 class="text-lg font-semibold">录入/调整绩效</h3>
            <p class="mt-1 text-sm text-muted-foreground">${editingFactory ? `${escapeHtml(editingFactory.factoryName)} (${escapeHtml(editingFactory.factoryCode)})` : '选择工厂后录入绩效数据'}</p>
          </div>
          <button class="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-muted" data-perf-action="close-dialog" aria-label="关闭">
            <i data-lucide="x" class="h-4 w-4"></i>
          </button>
        </div>

        <div class="h-[calc(100vh-81px)] overflow-y-auto px-6 py-5">
          <div class="space-y-4">
            ${factorySelector}

            <div class="space-y-2">
              <label class="text-sm">周期（月度）<span class="text-red-500">*</span></label>
              <select data-perf-field="period" class="w-full rounded-md border px-3 py-2 text-sm">
                ${getMonthOptions()
                  .map((month) => `<option value="${month}" ${state.form.period === month ? 'selected' : ''}>${month}</option>`)
                  .join('')}
              </select>
              ${state.formErrors.period ? `<p class="text-sm text-red-500">${escapeHtml(state.formErrors.period)}</p>` : ''}
            </div>

            <div class="border-t"></div>

            <div class="grid grid-cols-2 gap-4">
              <div class="space-y-2">
                <label class="text-sm">准时交付率 (%) <span class="text-red-500">*</span></label>
                <input type="number" min="0" max="100" step="0.1" data-perf-field="onTimeRate" value="${state.form.onTimeRate}" class="w-full rounded-md border px-3 py-2 text-sm" />
                ${state.form.onTimeRate < 90 ? '<p class="text-xs text-yellow-600">低于90%将触发风险提示</p>' : ''}
                ${state.formErrors.onTimeRate ? `<p class="text-sm text-red-500">${escapeHtml(state.formErrors.onTimeRate)}</p>` : ''}
              </div>
              <div class="space-y-2">
                <label class="text-sm">残次率 (%) <span class="text-red-500">*</span></label>
                <input type="number" min="0" max="100" step="0.1" data-perf-field="defectRate" value="${state.form.defectRate}" class="w-full rounded-md border px-3 py-2 text-sm" />
                ${state.form.defectRate > 3 ? '<p class="text-xs text-yellow-600">超过3%将触发风险提示</p>' : ''}
                ${state.formErrors.defectRate ? `<p class="text-sm text-red-500">${escapeHtml(state.formErrors.defectRate)}</p>` : ''}
              </div>
              <div class="space-y-2">
                <label class="text-sm">拒单率 (%) <span class="text-red-500">*</span></label>
                <input type="number" min="0" max="100" step="0.1" data-perf-field="rejectRate" value="${state.form.rejectRate}" class="w-full rounded-md border px-3 py-2 text-sm" />
                ${state.formErrors.rejectRate ? `<p class="text-sm text-red-500">${escapeHtml(state.formErrors.rejectRate)}</p>` : ''}
              </div>
              <div class="space-y-2">
                <label class="text-sm">争议率 (%) <span class="text-red-500">*</span></label>
                <input type="number" min="0" max="100" step="0.1" data-perf-field="disputeRate" value="${state.form.disputeRate}" class="w-full rounded-md border px-3 py-2 text-sm" />
                ${state.formErrors.disputeRate ? `<p class="text-sm text-red-500">${escapeHtml(state.formErrors.disputeRate)}</p>` : ''}
              </div>
            </div>

            <div class="rounded-lg bg-muted/50 p-3">
              <div class="mb-2 text-sm text-muted-foreground">预览计算结果</div>
              <div class="flex items-center gap-4">
                <div>
                  <span class="text-muted-foreground">总分：</span>
                  <span class="inline-flex rounded px-2 py-0.5 text-sm ${getScoreBadgeClass(previewScore)}">${previewScore.toFixed(1)}</span>
                </div>
                <div>
                  <span class="text-muted-foreground">等级：</span>
                  <span class="inline-flex rounded border px-2 py-0.5 text-sm ${getLevelBadgeClass(previewLevel)}">${previewLevel}</span>
                </div>
              </div>
              <p class="mt-2 text-xs text-muted-foreground">公式：准时率×0.4 + (100-残次率)×0.3 + (100-拒单率)×0.2 + (100-争议率)×0.1</p>
            </div>

            <div class="space-y-2">
              <label class="text-sm">备注</label>
              <textarea data-perf-field="note" class="w-full rounded-md border px-3 py-2 text-sm" rows="3" placeholder="可选备注...">${escapeHtml(state.form.note)}</textarea>
            </div>

            <div class="flex justify-end gap-2 pt-4">
              <button class="rounded-md border px-4 py-2 text-sm hover:bg-muted" data-perf-action="close-dialog">取消</button>
              <button class="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700" data-perf-action="submit-form">确认提交</button>
            </div>
          </div>
        </div>
      </section>
    </div>
  `
}

function renderLogDialog(): string {
  if (state.dialog.type !== 'log') return ''

  const content =
    state.changeLogs.length > 0
      ? `
        <table class="w-full text-sm">
          <thead class="border-b">
            <tr>
              <th class="px-3 py-2 text-left text-xs font-medium text-muted-foreground">操作类型</th>
              <th class="px-3 py-2 text-left text-xs font-medium text-muted-foreground">工厂</th>
              <th class="px-3 py-2 text-left text-xs font-medium text-muted-foreground">周期</th>
              <th class="px-3 py-2 text-left text-xs font-medium text-muted-foreground">详情</th>
              <th class="px-3 py-2 text-left text-xs font-medium text-muted-foreground">操作人</th>
              <th class="px-3 py-2 text-left text-xs font-medium text-muted-foreground">时间</th>
            </tr>
          </thead>
          <tbody>
            ${state.changeLogs
              .map(
                (log) => `
                  <tr class="border-b last:border-0">
                    <td class="px-3 py-2"><span class="inline-flex rounded border px-2 py-0.5 text-xs">绩效录入</span></td>
                    <td class="px-3 py-2">${escapeHtml(log.factoryName)}</td>
                    <td class="px-3 py-2">${escapeHtml(log.period)}</td>
                    <td class="max-w-[200px] truncate px-3 py-2" title="${escapeHtml(log.detail)}">${escapeHtml(log.detail)}</td>
                    <td class="px-3 py-2">${escapeHtml(log.operator)}</td>
                    <td class="px-3 py-2 text-sm">${escapeHtml(log.timestamp)}</td>
                  </tr>
                `,
              )
              .join('')}
          </tbody>
        </table>
      `
      : '<div class="py-8 text-center text-muted-foreground">暂无变更日志</div>'

  return `
    <div class="fixed inset-0 z-50" data-dialog-backdrop="true">
      <button class="absolute inset-0 bg-black/45" data-perf-action="close-dialog" aria-label="关闭"></button>
      <section class="absolute left-1/2 top-1/2 w-full max-w-3xl -translate-x-1/2 -translate-y-1/2 rounded-xl border bg-background shadow-2xl" data-dialog-panel="true">
        <div class="flex items-start justify-between border-b px-6 py-4">
          <div>
            <h3 class="text-lg font-semibold">变更日志</h3>
            <p class="mt-1 text-sm text-muted-foreground">所有绩效录入/调整操作的记录</p>
          </div>
          <button class="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-muted" data-perf-action="close-dialog" aria-label="关闭">
            <i data-lucide="x" class="h-4 w-4"></i>
          </button>
        </div>
        <div class="max-h-[400px] overflow-auto px-6 py-5">
          ${content}
        </div>
      </section>
    </div>
  `
}

function renderPagination(total: number): string {
  const totalPages = Math.ceil(total / PAGE_SIZE)
  const displayPages = totalPages || 1

  return `
    <div class="flex items-center gap-2">
      <button class="inline-flex h-8 w-8 items-center justify-center rounded-md border ${state.currentPage === 1 ? 'pointer-events-none opacity-50' : 'hover:bg-muted'}" data-perf-action="prev-page" aria-label="上一页">
        <i data-lucide="chevron-left" class="h-4 w-4"></i>
      </button>
      <span class="text-sm">${state.currentPage} / ${displayPages}</span>
      <button class="inline-flex h-8 w-8 items-center justify-center rounded-md border ${state.currentPage >= displayPages ? 'pointer-events-none opacity-50' : 'hover:bg-muted'}" data-perf-action="next-page" aria-label="下一页">
        <i data-lucide="chevron-right" class="h-4 w-4"></i>
      </button>
    </div>
  `
}

export function renderFactoryPerformancePage(): string {
  const filteredList = getFilteredList()
  const summary = getSummary(filteredList)
  const pagedList = getPagedList(filteredList)

  return `
    <div class="space-y-6">
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-2xl font-semibold">工厂绩效</h1>
          <p class="mt-1 text-sm text-muted-foreground">查看与维护工厂绩效指标（仅支持月度周期 YYYY-MM）</p>
        </div>
        <div class="flex items-center gap-2">
          ${
            canModify
              ? '<button class="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700" data-perf-action="open-create-form">录入/调整绩效</button>'
              : ''
          }
          <button class="inline-flex items-center rounded-md border px-4 py-2 text-sm hover:bg-muted" data-perf-action="open-log">
            <i data-lucide="file-text" class="mr-2 h-4 w-4"></i>
            变更日志
          </button>
        </div>
      </div>

      <div class="flex flex-wrap items-center gap-4 rounded-lg bg-muted/30 p-4">
        <div class="flex min-w-[200px] max-w-sm flex-1 items-center gap-2">
          <i data-lucide="search" class="h-4 w-4 text-muted-foreground"></i>
          <input data-perf-filter="keyword" value="${escapeHtml(state.keyword)}" placeholder="搜索工厂名称/编号..." class="flex-1 rounded-md border px-3 py-2 text-sm" />
        </div>
        <select data-perf-filter="month" class="w-[140px] rounded-md border px-3 py-2 text-sm">
          <option value="all" ${state.monthFilter === 'all' ? 'selected' : ''}>全部月份</option>
          ${getMonthOptions()
            .map((month) => `<option value="${month}" ${state.monthFilter === month ? 'selected' : ''}>${month}</option>`)
            .join('')}
        </select>
        <div class="flex items-center gap-2">
          <button class="rounded-md bg-secondary px-3 py-2 text-sm hover:bg-secondary/80" data-perf-action="query">查询</button>
          <button class="inline-flex items-center rounded-md px-3 py-2 text-sm hover:bg-muted" data-perf-action="reset">
            <i data-lucide="refresh-cw" class="mr-2 h-4 w-4"></i>
            重置
          </button>
        </div>
      </div>

      <div class="grid grid-cols-2 gap-4 md:grid-cols-5">
        ${renderSummaryCard('trending-up', 'text-green-500', '平均准时交付率', `${summary.avgOnTimeRate}%`)}
        ${renderSummaryCard('alert-circle', 'text-red-500', '平均残次率', `${summary.avgDefectRate}%`)}
        ${renderSummaryCard('trending-down', 'text-yellow-500', '平均拒单率', `${summary.avgRejectRate}%`)}
        ${renderSummaryCard('alert-circle', 'text-orange-500', '平均争议率', `${summary.avgDisputeRate}%`)}
        ${renderSummaryCard('target', 'text-blue-500', '平均绩效总分', `${summary.avgScore}`)}
      </div>

      <div class="overflow-x-auto rounded-lg border">
        <table class="w-full text-sm">
          <thead>
            <tr class="bg-muted/50">
              <th class="px-3 py-3 text-left text-xs font-medium text-muted-foreground">工厂名称</th>
              <th class="px-3 py-3 text-left text-xs font-medium text-muted-foreground">编号</th>
              <th class="px-3 py-3 text-left text-xs font-medium text-muted-foreground">层级</th>
              <th class="px-3 py-3 text-left text-xs font-medium text-muted-foreground">类型</th>
              <th class="px-3 py-3 text-left text-xs font-medium text-muted-foreground">KPI模板</th>
              <th class="px-3 py-3 text-left text-xs font-medium text-muted-foreground">
                <button class="inline-flex items-center gap-1 hover:text-foreground" data-perf-action="sort" data-sort-field="onTimeRate">
                  准时交付率
                  <i data-lucide="arrow-up-down" class="h-3 w-3"></i>
                </button>
              </th>
              <th class="px-3 py-3 text-left text-xs font-medium text-muted-foreground">
                <button class="inline-flex items-center gap-1 hover:text-foreground" data-perf-action="sort" data-sort-field="defectRate">
                  残次率
                  <i data-lucide="arrow-up-down" class="h-3 w-3"></i>
                </button>
              </th>
              <th class="px-3 py-3 text-left text-xs font-medium text-muted-foreground">
                <button class="inline-flex items-center gap-1 hover:text-foreground" data-perf-action="sort" data-sort-field="score">
                  总分
                  <i data-lucide="arrow-up-down" class="h-3 w-3"></i>
                </button>
              </th>
              <th class="px-3 py-3 text-left text-xs font-medium text-muted-foreground">等级</th>
              <th class="px-3 py-3 text-left text-xs font-medium text-muted-foreground">风险</th>
              <th class="w-[80px] px-3 py-3 text-left text-xs font-medium text-muted-foreground">操作</th>
            </tr>
          </thead>
          <tbody>
            ${
              pagedList.length === 0
                ? '<tr><td colspan="11" class="h-24 px-3 text-center text-muted-foreground">暂无数据</td></tr>'
                : pagedList
                    .map((factory) => {
                      const risks = checkRisks(factory)
                      return `
                        <tr class="border-b last:border-0">
                          <td class="px-3 py-3 font-medium">${escapeHtml(factory.factoryName)}</td>
                          <td class="px-3 py-3 font-mono text-sm">${escapeHtml(factory.factoryCode)}</td>
                          <td class="px-3 py-3">
                            <span class="inline-flex rounded border px-2 py-0.5 text-xs">${escapeHtml(tierLabels[factory.tier])}</span>
                          </td>
                          <td class="px-3 py-3">
                            <span class="inline-flex rounded border bg-secondary px-2 py-0.5 text-xs">${escapeHtml(typeLabels[factory.type])}</span>
                          </td>
                          <td class="px-3 py-3">
                            <span class="inline-flex rounded border px-2 py-0.5 text-xs">${escapeHtml(kpiTemplateLabels[factory.kpiTemplate])}</span>
                          </td>
                          <td class="px-3 py-3">
                            <div class="flex items-center gap-2">
                              <div class="h-2 w-16 overflow-hidden rounded-full bg-muted">
                                <div class="h-full bg-blue-600" style="width:${Math.max(0, Math.min(100, factory.onTimeRate)).toFixed(1)}%"></div>
                              </div>
                              <span class="${factory.onTimeRate < 90 ? 'font-medium text-red-600' : ''}">${factory.onTimeRate.toFixed(1)}%</span>
                            </div>
                          </td>
                          <td class="px-3 py-3">
                            <span class="${factory.defectRate > 3 ? 'font-medium text-red-600' : ''}">${factory.defectRate}%</span>
                          </td>
                          <td class="px-3 py-3">
                            <span class="inline-flex rounded px-2 py-0.5 text-xs ${getScoreBadgeClass(factory.score)}">${factory.score}</span>
                          </td>
                          <td class="px-3 py-3">
                            <span class="inline-flex rounded border px-2 py-0.5 text-xs ${getLevelBadgeClass(factory.level)}">${factory.level}</span>
                          </td>
                          <td class="px-3 py-3">
                            ${
                              risks.length > 0
                                ? `<span class="inline-flex items-center gap-1 rounded border border-red-200 bg-red-100 px-2 py-0.5 text-xs text-red-700"><i data-lucide="alert-triangle" class="h-3 w-3"></i>${risks.length}</span>`
                                : '<span class="text-muted-foreground">-</span>'
                            }
                          </td>
                          <td class="px-3 py-3">
                            <div class="relative inline-block text-left" data-perf-menu-root="true">
                              <button class="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-muted" data-perf-action="toggle-action-menu" data-factory-id="${factory.factoryId}">
                                <i data-lucide="more-horizontal" class="h-4 w-4"></i>
                              </button>
                              ${
                                state.openActionFactoryId === factory.factoryId
                                  ? `
                                    <div class="absolute right-0 z-20 mt-1 min-w-[132px] rounded-md border bg-background p-1 shadow-lg">
                                      <button class="flex w-full items-center rounded px-2 py-1.5 text-left text-sm hover:bg-muted" data-perf-action="open-detail" data-factory-id="${factory.factoryId}">
                                        <i data-lucide="eye" class="mr-2 h-4 w-4"></i>
                                        查看明细
                                      </button>
                                      ${
                                        canModify
                                          ? `
                                            <button class="flex w-full items-center rounded px-2 py-1.5 text-left text-sm hover:bg-muted" data-perf-action="open-edit-form" data-factory-id="${factory.factoryId}">
                                              <i data-lucide="edit" class="mr-2 h-4 w-4"></i>
                                              录入/调整
                                            </button>
                                          `
                                          : ''
                                      }
                                    </div>
                                  `
                                  : ''
                              }
                            </div>
                          </td>
                        </tr>
                      `
                    })
                    .join('')
            }
          </tbody>
        </table>
      </div>

      <div class="flex items-center justify-between">
        <p class="text-sm text-muted-foreground">共 ${filteredList.length} 条记录</p>
        ${renderPagination(filteredList.length)}
      </div>

      ${renderDetailDialog()}
      ${renderFormDialog()}
      ${renderLogDialog()}
    </div>
  `
}

export function handleFactoryPerformanceEvent(target: HTMLElement): boolean {
  const formField = target.closest<HTMLElement>('[data-perf-field]')
  if (
    formField instanceof HTMLInputElement ||
    formField instanceof HTMLSelectElement ||
    formField instanceof HTMLTextAreaElement
  ) {
    const field = formField.dataset.perfField
    const value = formField.value

    if (field === 'factoryId') state.form.factoryId = value
    if (field === 'period') state.form.period = value
    if (field === 'onTimeRate') state.form.onTimeRate = Number(value)
    if (field === 'defectRate') state.form.defectRate = Number(value)
    if (field === 'rejectRate') state.form.rejectRate = Number(value)
    if (field === 'disputeRate') state.form.disputeRate = Number(value)
    if (field === 'note') state.form.note = value
    return true
  }

  const filterNode = target.closest<HTMLElement>('[data-perf-filter]')
  if (filterNode instanceof HTMLInputElement || filterNode instanceof HTMLSelectElement) {
    const filter = filterNode.dataset.perfFilter
    const value = filterNode.value

    if (filter === 'keyword') state.keyword = value
    if (filter === 'month') state.monthFilter = value
    return true
  }

  const actionNode = target.closest<HTMLElement>('[data-perf-action]')
  if (!actionNode) {
    if (state.openActionFactoryId && !target.closest('[data-perf-menu-root]')) {
      state.openActionFactoryId = null
      return true
    }
    return false
  }

  const action = actionNode.dataset.perfAction
  if (!action) return false

  if (action === 'toggle-action-menu') {
    const factoryId = actionNode.dataset.factoryId
    if (!factoryId) return true
    state.openActionFactoryId = state.openActionFactoryId === factoryId ? null : factoryId
    return true
  }

  if (action === 'query') {
    state.currentPage = 1
    state.openActionFactoryId = null
    return true
  }

  if (action === 'reset') {
    state.keyword = ''
    state.monthFilter = 'all'
    state.currentPage = 1
    state.openActionFactoryId = null
    return true
  }

  if (action === 'sort') {
    const field = actionNode.dataset.sortField as SortField | undefined
    if (!field) return true

    if (state.sortField === field) {
      state.sortOrder = state.sortOrder === 'asc' ? 'desc' : 'asc'
    } else {
      state.sortField = field
      state.sortOrder = 'desc'
    }

    state.openActionFactoryId = null
    return true
  }

  const totalPages = Math.max(1, Math.ceil(getFilteredList().length / PAGE_SIZE))

  if (action === 'prev-page') {
    state.currentPage = Math.max(1, state.currentPage - 1)
    state.openActionFactoryId = null
    return true
  }

  if (action === 'next-page') {
    state.currentPage = Math.min(totalPages, state.currentPage + 1)
    state.openActionFactoryId = null
    return true
  }

  if (action === 'open-detail') {
    const factoryId = actionNode.dataset.factoryId
    if (!factoryId) return true
    state.openActionFactoryId = null
    state.dialog = { type: 'detail', factoryId }
    return true
  }

  if (action === 'open-edit-form') {
    const factoryId = actionNode.dataset.factoryId
    if (!factoryId) return true

    const factory = findFactoryById(factoryId)
    if (!factory) return true

    state.openActionFactoryId = null
    resetForm(factory)
    state.dialog = { type: 'form', factoryId }
    return true
  }

  if (action === 'open-create-form') {
    state.openActionFactoryId = null
    resetForm()
    state.dialog = { type: 'form' }
    return true
  }

  if (action === 'open-log') {
    state.openActionFactoryId = null
    state.dialog = { type: 'log' }
    return true
  }

  if (action === 'submit-form') {
    submitForm()
    return true
  }

  if (action === 'close-dialog') {
    closeDialog()
    state.openActionFactoryId = null
    return true
  }

  return false
}

export function isFactoryPerformanceDialogOpen(): boolean {
  return state.dialog.type !== 'none'
}
