import { indonesiaFactories } from '../data/fcs/indonesia-factories'
import { processTasks } from '../data/fcs/process-tasks'
import { applyQualitySeedBootstrap } from '../data/fcs/store-domain-quality-bootstrap'
import { initialDeductionBasisItems } from '../data/fcs/store-domain-quality-seeds'
import type {
  DeductionBasisItem,
  DeductionBasisSourceType,
  DeductionBasisStatus,
} from '../data/fcs/store-domain-quality-types'
import { escapeHtml, formatDateTime, toClassName } from '../utils'

applyQualitySeedBootstrap()

type ListTab = 'basis' | 'trial' | 'output'
type SourceProcessFilter = 'ALL' | 'DYE_PRINT'
type SettlementFilter = 'ALL' | 'READY' | 'FROZEN'
type SourceTypeFilter = 'ALL' | DeductionBasisSourceType
type StatusFilter = 'ALL' | DeductionBasisStatus

interface DeductionCalcListState {
  activeTab: ListTab
  keyword: string
  sourceTypeFilter: SourceTypeFilter
  statusFilter: StatusFilter
  factoryFilter: string
  sourceProcessFilter: SourceProcessFilter
  settlementFilter: SettlementFilter
}

const SOURCE_TYPE_LABEL: Record<DeductionBasisSourceType, string> = {
  QC_FAIL: '质检不合格',
  QC_DEFECT_ACCEPT: '瑕疵接受',
  HANDOVER_DIFF: '交接差异',
}

const SOURCE_TYPE_CLASS: Record<DeductionBasisSourceType, string> = {
  QC_FAIL: 'bg-red-100 text-red-700 border-red-200',
  QC_DEFECT_ACCEPT: 'bg-blue-100 text-blue-700 border-blue-200',
  HANDOVER_DIFF: 'bg-orange-100 text-orange-700 border-orange-200',
}

const STATUS_LABEL: Record<DeductionBasisStatus, string> = {
  DRAFT: '草稿',
  CONFIRMED: '已确认',
  DISPUTED: '争议中',
  VOID: '已作废',
}

const STATUS_CLASS: Record<DeductionBasisStatus, string> = {
  DRAFT: 'bg-gray-100 text-gray-700 border-gray-200',
  CONFIRMED: 'bg-green-100 text-green-700 border-green-200',
  DISPUTED: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  VOID: 'bg-slate-100 text-slate-500 border-slate-200',
}

const SETTLEMENT_PARTY_LABEL: Record<string, string> = {
  FACTORY: '工厂',
  PROCESSOR: '加工厂',
  SUPPLIER: '供应商',
  GROUP_INTERNAL: '集团内部',
  OTHER: '其他',
}

const DISPOSITION_LABEL: Record<string, string> = {
  ACCEPT_AS_DEFECT: '接受（瑕疵品）',
  SCRAP: '报废',
  ACCEPT: '接受（无扣款）',
}

const ACTION_LABEL: Record<string, string> = {
  CREATE_FROM_DYE_PRINT_FAIL: '由染印不合格回货创建',
  SYNC_SETTLEMENT_READY_FROM_QC: '结案同步结算状态',
  CONFIRM_LIABILITY_FROM_QC: '判责确认同步',
  DISPUTE_LIABILITY_FROM_QC: '争议同步',
  CREATE_BASIS_FROM_QC: '由质检单创建',
  UPDATE_BASIS_FROM_QC: '由质检单更新',
  GENERATE_DEDUCTION_BASIS: '生成扣款依据',
}

const listState: DeductionCalcListState = {
  activeTab: 'basis',
  keyword: '',
  sourceTypeFilter: 'ALL',
  statusFilter: 'ALL',
  factoryFilter: 'ALL',
  sourceProcessFilter: 'ALL',
  settlementFilter: 'ALL',
}

const deductionAmountDraftByBasisId: Record<string, string> = {}

function nowTimestamp(date: Date = new Date()): string {
  return date.toISOString().replace('T', ' ').slice(0, 19)
}

function getFactoryName(factoryId: string): string {
  const factory = indonesiaFactories.find((item) => item.id === factoryId)
  return factory?.name ?? factoryId
}

function getReasonLabel(code: string): string {
  const map: Record<string, string> = {
    QUALITY_FAIL: '质量不合格',
    QC_FAIL_DEDUCTION: '质检扣款',
    HANDOVER_SHORTAGE: '交接短缺',
    HANDOVER_OVERAGE: '交接溢出',
    HANDOVER_DAMAGE: '交接破损',
    HANDOVER_MIXED_BATCH: '交接混批',
    HANDOVER_DIFF: '交接差异',
  }
  return map[code] ?? code
}

function getFactoryOptions(items: DeductionBasisItem[]): Array<{ id: string; label: string }> {
  const ids = Array.from(new Set(items.map((item) => item.factoryId)))
  return ids.map((id) => ({ id, label: getFactoryName(id) }))
}

function getFilteredBasisItems(items: DeductionBasisItem[]): DeductionBasisItem[] {
  const keyword = listState.keyword.trim().toLowerCase()

  return items.filter((item) => {
    if (listState.sourceTypeFilter !== 'ALL' && item.sourceType !== listState.sourceTypeFilter) {
      return false
    }
    if (listState.statusFilter !== 'ALL' && item.status !== listState.statusFilter) {
      return false
    }
    if (listState.factoryFilter !== 'ALL' && item.factoryId !== listState.factoryFilter) {
      return false
    }
    if (listState.sourceProcessFilter === 'DYE_PRINT' && item.sourceProcessType !== 'DYE_PRINT') {
      return false
    }
    if (listState.settlementFilter === 'READY' && item.settlementReady !== true) {
      return false
    }
    if (listState.settlementFilter === 'FROZEN' && item.settlementReady === true) {
      return false
    }
    if (keyword) {
      const matched =
        item.basisId.toLowerCase().includes(keyword) ||
        item.productionOrderId.toLowerCase().includes(keyword) ||
        (item.taskId ?? '').toLowerCase().includes(keyword) ||
        item.sourceRefId.toLowerCase().includes(keyword)
      if (!matched) return false
    }
    return true
  })
}

function renderFieldRow(label: string, value: string): string {
  return `
    <div class="flex items-start gap-4 py-2">
      <span class="w-36 shrink-0 text-sm text-muted-foreground">${escapeHtml(label)}</span>
      <span class="flex-1 break-all text-sm text-foreground">${value}</span>
    </div>
  `
}

function resolveFreezeHint(basis: DeductionBasisItem): string | null {
  if (basis.deductionAmountEditable === true) return null
  if (basis.settlementFreezeReason === '质检未结案') return '质检尚未结案，当前不可录入扣款金额'
  if (basis.settlementFreezeReason === '争议中，冻结结算') return '当前处于争议中，结算已冻结'
  return '判责未确认或未满足结算条件，暂不可录入扣款金额'
}

export function renderDeductionCalcPage(): string {
  const items = initialDeductionBasisItems
  const filtered = getFilteredBasisItems(items)
  const factoryOptions = getFactoryOptions(items)

  return `
    <div class="flex flex-col gap-6 p-6">
      <div>
        <h1 class="text-2xl font-semibold text-foreground">扣款计算（依据台账）</h1>
        <p class="mt-1 text-sm text-muted-foreground">质检不合格和交接差异形成的扣款依据只读台账</p>
      </div>

      <section>
        <div class="inline-flex rounded-md bg-muted p-1">
          <button
            class="${toClassName(
              'rounded-md px-3 py-1.5 text-sm transition-colors',
              listState.activeTab === 'basis'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}"
            data-dcalc-tab="basis"
          >
            扣款依据
          </button>
          <button
            class="${toClassName(
              'rounded-md px-3 py-1.5 text-sm transition-colors',
              listState.activeTab === 'trial'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}"
            data-dcalc-tab="trial"
          >
            规则试算
          </button>
          <button
            class="${toClassName(
              'rounded-md px-3 py-1.5 text-sm transition-colors',
              listState.activeTab === 'output'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}"
            data-dcalc-tab="output"
          >
            结果输出
          </button>
        </div>
      </section>

      ${
        listState.activeTab === 'basis'
          ? `
            <section class="rounded-md border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
              当前页面为扣款依据只读台账。依据条目来自质检/交接流程自动生成，状态、数量和结算冻结信息由上一步流程驱动。
            </section>

            <section class="flex flex-wrap items-center gap-3">
              <div class="relative min-w-[200px] max-w-sm flex-1">
                <i data-lucide="search" class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"></i>
                <input
                  class="h-9 w-full rounded-md border bg-background pl-9 pr-3 text-sm"
                  data-dcalc-filter="keyword"
                  value="${escapeHtml(listState.keyword)}"
                  placeholder="依据号 / 生产单号 / 任务ID / 来源单号"
                />
              </div>

              <select class="h-9 w-[150px] rounded-md border bg-background px-3 text-sm" data-dcalc-filter="source-process">
                <option value="ALL" ${listState.sourceProcessFilter === 'ALL' ? 'selected' : ''}>全部来源</option>
                <option value="DYE_PRINT" ${listState.sourceProcessFilter === 'DYE_PRINT' ? 'selected' : ''}>染印加工单</option>
              </select>

              <select class="h-9 w-[150px] rounded-md border bg-background px-3 text-sm" data-dcalc-filter="settlement">
                <option value="ALL" ${listState.settlementFilter === 'ALL' ? 'selected' : ''}>全部结算状态</option>
                <option value="READY" ${listState.settlementFilter === 'READY' ? 'selected' : ''}>可进入结算</option>
                <option value="FROZEN" ${listState.settlementFilter === 'FROZEN' ? 'selected' : ''}>冻结中</option>
              </select>

              <select class="h-9 w-[130px] rounded-md border bg-background px-3 text-sm" data-dcalc-filter="source-type">
                <option value="ALL" ${listState.sourceTypeFilter === 'ALL' ? 'selected' : ''}>全部来源类型</option>
                <option value="QC_FAIL" ${listState.sourceTypeFilter === 'QC_FAIL' ? 'selected' : ''}>质检不合格</option>
                <option value="QC_DEFECT_ACCEPT" ${listState.sourceTypeFilter === 'QC_DEFECT_ACCEPT' ? 'selected' : ''}>瑕疵接受</option>
                <option value="HANDOVER_DIFF" ${listState.sourceTypeFilter === 'HANDOVER_DIFF' ? 'selected' : ''}>交接差异</option>
              </select>

              <select class="h-9 w-[120px] rounded-md border bg-background px-3 text-sm" data-dcalc-filter="status">
                <option value="ALL" ${listState.statusFilter === 'ALL' ? 'selected' : ''}>全部状态</option>
                <option value="DRAFT" ${listState.statusFilter === 'DRAFT' ? 'selected' : ''}>草稿</option>
                <option value="CONFIRMED" ${listState.statusFilter === 'CONFIRMED' ? 'selected' : ''}>已确认</option>
                <option value="DISPUTED" ${listState.statusFilter === 'DISPUTED' ? 'selected' : ''}>争议中</option>
                <option value="VOID" ${listState.statusFilter === 'VOID' ? 'selected' : ''}>已作废</option>
              </select>

              <select class="h-9 w-[150px] rounded-md border bg-background px-3 text-sm" data-dcalc-filter="factory">
                <option value="ALL" ${listState.factoryFilter === 'ALL' ? 'selected' : ''}>全部工厂</option>
                ${factoryOptions
                  .map(
                    (option) =>
                      `<option value="${escapeHtml(option.id)}" ${listState.factoryFilter === option.id ? 'selected' : ''}>${escapeHtml(option.label)}</option>`,
                  )
                  .join('')}
              </select>

              <button class="inline-flex h-9 w-9 items-center justify-center rounded-md border hover:bg-muted" data-dcalc-action="reset-filters">
                <i data-lucide="rotate-ccw" class="h-4 w-4"></i>
              </button>

              <span class="ml-auto text-sm text-muted-foreground">共 ${filtered.length} 条</span>
            </section>

            ${
              filtered.length === 0
                ? `
                  <section class="rounded-lg border border-dashed py-16 text-center">
                    <p class="text-sm font-medium text-muted-foreground">暂无扣款依据数据</p>
                    <p class="mt-1 text-xs text-muted-foreground">当质检失败或交接差异触发后会自动生成扣款依据</p>
                  </section>
                `
                : `
                  <section class="overflow-x-auto rounded-lg border">
                    <table class="w-full min-w-[1500px] text-sm">
                      <thead>
                        <tr class="border-b bg-muted/40 text-left">
                          <th class="px-4 py-2 font-medium">依据号</th>
                          <th class="px-4 py-2 font-medium">来源类型</th>
                          <th class="px-4 py-2 font-medium">来源流程</th>
                          <th class="px-4 py-2 font-medium">生产单号</th>
                          <th class="px-4 py-2 font-medium">任务ID</th>
                          <th class="px-4 py-2 font-medium">工厂</th>
                          <th class="px-4 py-2 font-medium">原因</th>
                          <th class="px-4 py-2 font-medium">数量</th>
                          <th class="px-4 py-2 font-medium">依据状态</th>
                          <th class="px-4 py-2 font-medium">结算状态</th>
                          <th class="px-4 py-2 font-medium">冻结原因</th>
                          <th class="px-4 py-2 text-center font-medium">证据</th>
                          <th class="px-4 py-2 font-medium">时间</th>
                          <th class="px-4 py-2 text-right font-medium">操作</th>
                        </tr>
                      </thead>
                      <tbody>
                        ${filtered
                          .map(
                            (item) => `
                              <tr class="border-b last:border-b-0">
                                <td class="px-4 py-3 font-mono text-xs">
                                  <button class="text-primary hover:underline" data-nav="/fcs/quality/deduction-calc/${escapeHtml(item.basisId)}">${escapeHtml(item.basisId)}</button>
                                </td>
                                <td class="px-4 py-3">
                                  <span class="inline-flex rounded-md border px-2 py-0.5 text-xs ${SOURCE_TYPE_CLASS[item.sourceType]}">${SOURCE_TYPE_LABEL[item.sourceType]}</span>
                                </td>
                                <td class="px-4 py-3 text-sm">
                                  ${
                                    item.sourceProcessType === 'DYE_PRINT'
                                      ? '<span class="inline-flex rounded-md border border-purple-200 bg-purple-50 px-2 py-0.5 text-xs text-purple-700">染印加工单</span>'
                                      : '<span class="text-xs text-muted-foreground">—</span>'
                                  }
                                </td>
                                <td class="px-4 py-3 font-mono text-xs">${escapeHtml(item.productionOrderId)}</td>
                                <td class="px-4 py-3 font-mono text-xs">${escapeHtml(item.taskId ?? '—')}</td>
                                <td class="px-4 py-3 text-sm">${escapeHtml(getFactoryName(item.factoryId))}</td>
                                <td class="px-4 py-3 text-sm">${escapeHtml(getReasonLabel(item.reasonCode))}</td>
                                <td class="px-4 py-3 text-sm">${item.qty} ${escapeHtml(item.uom)}</td>
                                <td class="px-4 py-3">
                                  <span class="inline-flex rounded-md border px-2 py-0.5 text-xs ${STATUS_CLASS[item.status]}">${STATUS_LABEL[item.status]}</span>
                                </td>
                                <td class="px-4 py-3">
                                  ${
                                    item.settlementReady !== undefined
                                      ? `<span class="inline-flex rounded-md border px-2 py-0.5 text-xs ${
                                          item.settlementReady
                                            ? 'border-green-200 bg-green-50 text-green-700'
                                            : 'border-orange-200 bg-orange-50 text-orange-700'
                                        }">${item.settlementReady ? '可进入结算' : '冻结中'}</span>`
                                      : '<span class="text-xs text-muted-foreground">—</span>'
                                  }
                                </td>
                                <td class="max-w-[140px] truncate px-4 py-3 text-xs text-muted-foreground" title="${escapeHtml(item.settlementFreezeReason ?? '')}">
                                  ${escapeHtml(item.settlementFreezeReason || '—')}
                                </td>
                                <td class="px-4 py-3 text-center text-sm text-muted-foreground">${item.evidenceRefs.length}</td>
                                <td class="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">${escapeHtml(formatDateTime(item.updatedAt ?? item.createdAt))}</td>
                                <td class="px-4 py-3 text-right">
                                  <div class="flex items-center justify-end gap-1">
                                    <button class="inline-flex h-7 items-center rounded-md px-2 text-xs hover:bg-muted" data-nav="/fcs/quality/deduction-calc/${escapeHtml(item.basisId)}">
                                      <i data-lucide="eye" class="mr-1 h-3.5 w-3.5"></i>
                                      详情
                                    </button>
                                    ${
                                      item.sourceProcessType === 'DYE_PRINT'
                                        ? `
                                          <button class="inline-flex h-7 items-center rounded-md px-2 text-xs text-indigo-600 hover:bg-indigo-50 hover:text-indigo-700" data-nav="/fcs/process/dye-orders">
                                            查看加工单
                                          </button>
                                        `
                                        : ''
                                    }
                                  </div>
                                </td>
                              </tr>
                            `,
                          )
                          .join('')}
                      </tbody>
                    </table>
                  </section>
                `
            }
          `
          : listState.activeTab === 'trial'
            ? `
              <section class="rounded-lg border border-dashed py-24 text-center">
                <p class="text-sm text-muted-foreground">规则试算功能开发中...</p>
              </section>
            `
            : `
              <section class="rounded-lg border border-dashed py-24 text-center">
                <p class="text-sm text-muted-foreground">生成扣款结果功能开发中...</p>
              </section>
            `
      }
    </div>
  `
}

export function renderDeductionCalcDetailPage(basisId: string): string {
  const basis = initialDeductionBasisItems.find((item) => item.basisId === basisId)
  if (!basis) {
    return `
      <div class="flex flex-col items-center justify-center gap-4 py-32">
        <p class="text-lg font-medium text-muted-foreground">未找到扣款依据</p>
        <button class="inline-flex h-9 items-center rounded-md border px-3 text-sm hover:bg-muted" data-nav="/fcs/quality/deduction-calc">
          <i data-lucide="arrow-left" class="mr-2 h-4 w-4"></i>
          返回扣款计算
        </button>
      </div>
    `
  }

  const linkedTask = basis.taskId
    ? processTasks.find((item) => item.taskId === basis.taskId)
    : undefined
  const isDyePrint = basis.sourceProcessType === 'DYE_PRINT'
  const canEditAmount = basis.deductionAmountEditable === true
  const freezeHint = resolveFreezeHint(basis)
  const amountInput = deductionAmountDraftByBasisId[basisId] ?? ''

  const settlementPartyText = basis.settlementPartyType
    ? `${SETTLEMENT_PARTY_LABEL[basis.settlementPartyType] ?? basis.settlementPartyType} / ${basis.settlementPartyId ?? '—'}`
    : '—'

  return `
    <div class="flex flex-col gap-6 p-6">
      <div class="flex items-center gap-3">
        <button class="inline-flex h-8 items-center rounded-md px-2 text-sm hover:bg-muted" data-nav="/fcs/quality/deduction-calc">
          <i data-lucide="arrow-left" class="mr-1 h-4 w-4"></i>
          返回扣款计算
        </button>
        <div class="h-4 border-l"></div>
        <h1 class="text-xl font-semibold text-foreground">扣款依据详情</h1>
        <span class="inline-flex rounded-md border px-2 py-0.5 text-xs ${STATUS_CLASS[basis.status]}">${STATUS_LABEL[basis.status]}</span>
        <span class="inline-flex rounded-md border px-2 py-0.5 text-xs ${SOURCE_TYPE_CLASS[basis.sourceType]}">${SOURCE_TYPE_LABEL[basis.sourceType]}</span>
      </div>

      ${
        isDyePrint || basis.settlementReady !== undefined
          ? `
            <section class="rounded-md border border-indigo-200 bg-indigo-50/40">
              <header class="px-4 pb-2 pt-4">
                <h2 class="text-base font-semibold text-indigo-800">结算视角</h2>
              </header>
              <div class="divide-y divide-indigo-100 px-4 pb-4">
                ${renderFieldRow(
                  '来源流程',
                  isDyePrint
                    ? '<span class="inline-flex rounded-md border border-purple-200 bg-purple-50 px-2 py-0.5 text-xs text-purple-700">染印加工单</span>'
                    : '—',
                )}
                ${
                  isDyePrint
                    ? renderFieldRow('染印加工单号', basis.sourceOrderId ? `<span class="font-mono">${escapeHtml(basis.sourceOrderId)}</span>` : '—')
                    : ''
                }
                ${
                  isDyePrint
                    ? renderFieldRow('承接主体', escapeHtml(basis.processorFactoryId ?? '—'))
                    : ''
                }
                ${renderFieldRow('结算对象', escapeHtml(settlementPartyText))}
                ${renderFieldRow(
                  '结算状态',
                  basis.settlementReady !== undefined
                    ? `<span class="inline-flex rounded-md border px-2 py-0.5 text-xs ${
                        basis.settlementReady
                          ? 'border-green-200 bg-green-50 text-green-700'
                          : 'border-orange-200 bg-orange-50 text-orange-700'
                      }">${basis.settlementReady ? '可进入结算' : '冻结中'}</span>`
                    : '—',
                )}
                ${renderFieldRow('冻结原因', escapeHtml(basis.settlementFreezeReason || '—'))}
              </div>
            </section>
          `
          : ''
      }

      ${
        !canEditAmount && freezeHint
          ? `
            <section class="rounded-md border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-800">
              <div class="flex items-center gap-2">
                <i data-lucide="lock" class="h-4 w-4 text-orange-600"></i>
                ${escapeHtml(freezeHint)}
              </div>
            </section>
          `
          : ''
      }

      <section class="rounded-md border bg-card">
        <header class="border-b px-4 pb-2 pt-4">
          <h2 class="text-base font-semibold">基本信息</h2>
        </header>
        <div class="divide-y px-4 pb-4">
          ${renderFieldRow('依据号', `<span class="font-mono">${escapeHtml(basis.basisId)}</span>`)}
          ${renderFieldRow(
            '来源类型',
            `<span class="inline-flex rounded-md border px-2 py-0.5 text-xs ${SOURCE_TYPE_CLASS[basis.sourceType]}">${SOURCE_TYPE_LABEL[basis.sourceType]}</span>`,
          )}
          ${renderFieldRow('来源单号', `<span class="font-mono">${escapeHtml(basis.sourceRefId)}</span>`)}
          ${renderFieldRow('生产单号', `<span class="font-mono">${escapeHtml(basis.productionOrderId)}</span>`)}
          ${renderFieldRow('任务ID', basis.taskId ? `<span class="font-mono">${escapeHtml(basis.taskId)}</span>` : '—')}
          ${renderFieldRow('工厂', escapeHtml(getFactoryName(basis.factoryId)))}
          ${renderFieldRow('原因代码', escapeHtml(getReasonLabel(basis.reasonCode)))}
          ${
            basis.decisionStage
              ? renderFieldRow(
                  '判定阶段',
                  escapeHtml(
                    basis.decisionStage === 'SEW_RETURN_INBOUND_FINAL'
                      ? '车缝回货入仓最终判定'
                      : '一般判定',
                  ),
                )
              : ''
          }
          ${
            basis.responsiblePartyTypeSnapshot || basis.responsiblePartyIdSnapshot
              ? renderFieldRow(
                  '责任方快照',
                  escapeHtml(
                    `${basis.responsiblePartyTypeSnapshot ? SETTLEMENT_PARTY_LABEL[basis.responsiblePartyTypeSnapshot] ?? basis.responsiblePartyTypeSnapshot : '-'} / ${basis.responsiblePartyIdSnapshot ?? '-'}${basis.responsiblePartyNameSnapshot ? `（${basis.responsiblePartyNameSnapshot}）` : ''}`,
                  ),
                )
              : ''
          }
          ${
            basis.dispositionSnapshot
              ? renderFieldRow(
                  '处理方式快照',
                  escapeHtml(DISPOSITION_LABEL[basis.dispositionSnapshot] ?? basis.dispositionSnapshot),
                )
              : ''
          }
          ${
            basis.deductionDecisionSnapshot
              ? renderFieldRow(
                  '扣款决定快照',
                  escapeHtml(
                    basis.deductionDecisionSnapshot === 'DEDUCT'
                      ? '扣款'
                      : '不扣款',
                  ),
                )
              : ''
          }
          ${
            basis.deductionAmountSnapshot !== undefined
              ? renderFieldRow(
                  '扣款金额快照',
                  `${basis.deductionAmountSnapshot} CNY`,
                )
              : ''
          }
          ${renderFieldRow(
            '数量',
            `
              <div class="space-y-1">
                <span>${basis.qty} ${escapeHtml(basis.uom)}</span>
                ${
                  basis.deductionQty !== undefined
                    ? `
                      <div class="space-y-0.5">
                        <p class="text-sm font-medium text-foreground">
                          可扣款数量：
                          ${
                            basis.deductionQty === 0
                              ? '<span class="text-muted-foreground">当前无可扣款数量</span>'
                              : `<span class="font-semibold">${basis.deductionQty} ${escapeHtml(basis.uom)}</span>`
                          }
                        </p>
                        <p class="text-xs text-muted-foreground">可扣款数量 = 不合格处置合计 - 接受（无扣款）数量（由质检处置拆分自动同步）</p>
                      </div>
                    `
                    : ''
                }
              </div>
            `,
          )}
          <div class="flex items-start gap-4 py-2">
            <span class="w-36 shrink-0 text-sm text-muted-foreground">扣款金额录入</span>
            <div class="flex-1">
              <input
                class="h-9 w-full rounded-md border px-3 text-sm ${
                  canEditAmount
                    ? 'border-input bg-background text-foreground'
                    : 'cursor-not-allowed border-input bg-muted text-muted-foreground opacity-60'
                }"
                type="number"
                min="0"
                data-dcalc-field="deduction-amount"
                data-basis-id="${escapeHtml(basisId)}"
                value="${escapeHtml(amountInput)}"
                placeholder="${canEditAmount ? '请输入扣款金额（元）' : '暂不可录入'}"
                ${canEditAmount ? '' : 'disabled'}
              />
              ${
                !canEditAmount && freezeHint
                  ? `<p class="mt-1 text-xs text-muted-foreground">${escapeHtml(freezeHint)}</p>`
                  : ''
              }
            </div>
          </div>
          ${
            basis.disposition
              ? renderFieldRow('处置方式', escapeHtml(DISPOSITION_LABEL[basis.disposition] ?? basis.disposition))
              : ''
          }
          ${renderFieldRow('创建时间', escapeHtml(basis.createdAt))}
          ${renderFieldRow('创建人', escapeHtml(basis.createdBy))}
          ${
            basis.updatedAt
              ? renderFieldRow('更新时间', escapeHtml(basis.updatedAt))
              : ''
          }
          ${
            basis.updatedBy
              ? renderFieldRow('更新人', escapeHtml(basis.updatedBy))
              : ''
          }
          ${renderFieldRow('状态', '<span class="text-xs italic text-muted-foreground">状态由上一步流程自动维护</span>')}
        </div>
      </section>

      <section class="rounded-md border bg-card">
        <header class="border-b px-4 pb-2 pt-4">
          <h2 class="text-base font-semibold">证据清单</h2>
        </header>
        <div class="px-4 py-4">
          ${
            basis.evidenceRefs.length === 0
              ? '<p class="text-sm text-muted-foreground">暂无证据附件</p>'
              : `
                <ul class="space-y-2">
                  ${basis.evidenceRefs
                    .map(
                      (evidence) => `
                        <li class="flex items-center gap-2 text-sm">
                          <i data-lucide="file-text" class="h-4 w-4 shrink-0 text-muted-foreground"></i>
                          ${
                            evidence.url
                              ? `<a href="${escapeHtml(evidence.url)}" target="_blank" rel="noreferrer" class="inline-flex items-center gap-1 text-primary hover:underline">${escapeHtml(evidence.name)}<i data-lucide="external-link" class="h-3 w-3"></i></a>`
                              : `<span class="text-foreground">${escapeHtml(evidence.name)}</span>`
                          }
                          ${
                            evidence.type
                              ? `<span class="text-xs text-muted-foreground">(${escapeHtml(evidence.type)})</span>`
                              : ''
                          }
                        </li>
                      `,
                    )
                    .join('')}
                </ul>
              `
          }
        </div>
      </section>

      <section class="rounded-md border bg-card">
        <header class="border-b px-4 pb-2 pt-4">
          <h2 class="text-base font-semibold">关联来源</h2>
        </header>
        <div class="flex flex-wrap gap-3 px-4 py-4">
          ${
            basis.sourceType === 'QC_FAIL' || basis.sourceType === 'QC_DEFECT_ACCEPT'
              ? `
                <button class="inline-flex h-8 items-center rounded-md border px-3 text-sm hover:bg-muted" data-nav="/fcs/quality/qc-records/${escapeHtml(basis.sourceRefId)}">
                  <i data-lucide="external-link" class="mr-1.5 h-4 w-4"></i>
                  查看质检
                </button>
              `
              : ''
          }
          ${
            basis.sourceType === 'HANDOVER_DIFF'
              ? `
                <button class="inline-flex h-8 items-center rounded-md border px-3 text-sm hover:bg-muted" data-nav="/fcs/progress/handover?eventId=${escapeHtml(basis.sourceRefId)}">
                  <i data-lucide="external-link" class="mr-1.5 h-4 w-4"></i>
                  查看交接
                </button>
              `
              : ''
          }
          ${
            isDyePrint
              ? `
                <button class="inline-flex h-8 items-center rounded-md border border-indigo-300 px-3 text-sm text-indigo-700 hover:bg-indigo-50" data-nav="/fcs/process/dye-orders">
                  <i data-lucide="external-link" class="mr-1.5 h-4 w-4"></i>
                  查看染印加工单
                </button>
              `
              : ''
          }
        </div>
      </section>

      ${
        basis.taskId || basis.productionOrderId
          ? `
            <section class="rounded-md border bg-card">
              <header class="border-b px-4 pb-2 pt-4">
                <h2 class="text-base font-semibold">关联任务</h2>
              </header>
              <div class="flex flex-wrap gap-3 px-4 py-4">
                <button class="inline-flex h-8 items-center rounded-md border px-3 text-sm hover:bg-muted" data-nav="/fcs/progress/board?taskId=${escapeHtml(basis.taskId ?? '')}&po=${escapeHtml(basis.productionOrderId)}">
                  <i data-lucide="external-link" class="mr-1.5 h-4 w-4"></i>
                  查看进度看板
                </button>
                ${
                  basis.taskId
                    ? `
                      <button class="inline-flex h-8 items-center rounded-md border px-3 text-sm hover:bg-muted" data-nav="/fcs/pda/exec/${escapeHtml(basis.taskId)}">
                        <i data-lucide="external-link" class="mr-1.5 h-4 w-4"></i>
                        查看PDA执行
                        ${
                          linkedTask
                            ? `<span class="ml-1 font-mono text-xs text-muted-foreground">(${escapeHtml(basis.taskId)})</span>`
                            : ''
                        }
                      </button>
                    `
                    : ''
                }
              </div>
            </section>
          `
          : ''
      }

      <section class="rounded-md border bg-card">
        <header class="border-b px-4 pb-2 pt-4">
          <h2 class="text-base font-semibold">审计日志</h2>
        </header>
        <div class="px-4 py-4">
          ${
            !basis.auditLogs || basis.auditLogs.length === 0
              ? '<p class="text-sm text-muted-foreground">暂无审计日志</p>'
              : `
                <ol class="relative ml-2 space-y-4 border-l border-border">
                  ${basis.auditLogs
                    .map(
                      (log, index) => `
                        <li class="ml-4">
                          <div class="absolute -left-1.5 mt-1 h-3 w-3 rounded-full border border-background bg-muted-foreground/40"></div>
                          <div class="flex items-start justify-between gap-2">
                            <div>
                              <p class="text-sm font-medium text-foreground">${escapeHtml(ACTION_LABEL[log.action] ?? log.action)}</p>
                              <p class="mt-0.5 text-xs text-muted-foreground">${escapeHtml(log.detail)}</p>
                            </div>
                            <div class="shrink-0 text-right">
                              <p class="whitespace-nowrap text-xs text-muted-foreground">${escapeHtml(log.at)}</p>
                              <p class="text-xs text-muted-foreground">${escapeHtml(log.by)}</p>
                            </div>
                          </div>
                        </li>
                      `,
                    )
                    .join('')}
                </ol>
              `
          }
        </div>
      </section>
    </div>
  `
}

export function handleDeductionCalcEvent(target: HTMLElement): boolean {
  const tabNode = target.closest<HTMLElement>('[data-dcalc-tab]')
  if (tabNode) {
    const tab = tabNode.dataset.dcalcTab as ListTab | undefined
    if (tab === 'basis' || tab === 'trial' || tab === 'output') {
      listState.activeTab = tab
    }
    return true
  }

  const filterNode = target.closest<HTMLElement>('[data-dcalc-filter]')
  if (filterNode instanceof HTMLInputElement || filterNode instanceof HTMLSelectElement) {
    const field = filterNode.dataset.dcalcFilter
    if (field === 'keyword') {
      listState.keyword = filterNode.value
      return true
    }
    if (field === 'source-process') {
      listState.sourceProcessFilter = filterNode.value as SourceProcessFilter
      return true
    }
    if (field === 'settlement') {
      listState.settlementFilter = filterNode.value as SettlementFilter
      return true
    }
    if (field === 'source-type') {
      listState.sourceTypeFilter = filterNode.value as SourceTypeFilter
      return true
    }
    if (field === 'status') {
      listState.statusFilter = filterNode.value as StatusFilter
      return true
    }
    if (field === 'factory') {
      listState.factoryFilter = filterNode.value
      return true
    }
    return true
  }

  const fieldNode = target.closest<HTMLElement>('[data-dcalc-field]')
  if (fieldNode instanceof HTMLInputElement) {
    const field = fieldNode.dataset.dcalcField
    if (field !== 'deduction-amount') return true

    const basisId = fieldNode.dataset.basisId
    if (!basisId) return true
    const basis = initialDeductionBasisItems.find((item) => item.basisId === basisId)
    if (!basis) return true
    if (basis.deductionAmountEditable !== true) return true

    deductionAmountDraftByBasisId[basisId] = fieldNode.value

    const raw = fieldNode.value.trim()
    if (!raw) {
      delete (basis as DeductionBasisItem & { deductionAmount?: number }).deductionAmount
    } else {
      const amount = Number(raw)
      if (Number.isFinite(amount) && amount >= 0) {
        ;(basis as DeductionBasisItem & { deductionAmount?: number }).deductionAmount = amount
      }
    }
    basis.updatedAt = nowTimestamp()
    basis.updatedBy = '管理员'
    return true
  }

  const actionNode = target.closest<HTMLElement>('[data-dcalc-action]')
  if (!actionNode) return false

  const action = actionNode.dataset.dcalcAction
  if (!action) return false

  if (action === 'reset-filters') {
    listState.keyword = ''
    listState.sourceTypeFilter = 'ALL'
    listState.statusFilter = 'ALL'
    listState.factoryFilter = 'ALL'
    listState.sourceProcessFilter = 'ALL'
    listState.settlementFilter = 'ALL'
    return true
  }

  return true
}

export function isDeductionCalcDialogOpen(): boolean {
  return false
}
