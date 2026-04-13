import { appStore } from '../state/store.ts'
import { escapeHtml, toClassName } from '../utils.ts'
import { createProjectArchive } from '../data/pcs-project-archive-sync.ts'
import { generateStyleArchiveShellFromProject } from '../data/pcs-project-style-archive-writeback.ts'
import { getFirstSampleTaskById } from '../data/pcs-first-sample-repository.ts'
import { getPatternTaskById } from '../data/pcs-pattern-task-repository.ts'
import { getPlateMakingTaskById } from '../data/pcs-plate-making-repository.ts'
import { getPreProductionSampleTaskById } from '../data/pcs-pre-production-sample-repository.ts'
import { getTechnicalDataVersionById } from '../data/pcs-technical-data-version-repository.ts'
import { buildTechPackVersionSourceTaskSummary } from '../data/pcs-tech-pack-task-generation.ts'
import { buildProjectNodeContractDetailViewModel } from '../data/pcs-project-node-detail-contract-view-model.ts'
import { getPcsWorkItemRuntimeCarrierDefinition } from '../data/pcs-work-item-runtime-carrier.ts'
import {
  buildProjectChannelProductChainSummary,
  generateProjectTestingSummaryFromRelations,
  invalidateProjectChannelProduct,
  launchProjectChannelProductListing,
  submitProjectTestingConclusion,
} from '../data/pcs-channel-product-project-repository.ts'
import {
  buildProjectNodeDetailViewModel,
  type ProjectNodeDetailViewModel,
} from '../data/pcs-project-view-model.ts'
import {
  resolveProjectNodeBusinessActions,
  type ProjectNodeBusinessAction,
} from './pcs-project-work-item-detail-actions.ts'
import { writeProjectChannelProductCreateBridge } from './pcs-project-detail-header-actions.ts'

type DetailTab = 'basic' | 'attachments' | 'records' | 'audit'

interface WorkItemDetailState {
  projectId: string | null
  projectNodeId: string | null
  activeTab: DetailTab
  notice: string | null
}

const state: WorkItemDetailState = {
  projectId: null,
  projectNodeId: null,
  activeTab: 'basic',
  notice: null,
}

const FLASH_NOTICE_KEY = 'pcs_project_flash_notice'

function getNodeStatusClass(status: string): string {
  if (status === '已完成') return 'border-green-200 bg-green-50 text-green-700'
  if (status === '进行中') return 'border-blue-200 bg-blue-50 text-blue-700'
  if (status === '待确认') return 'border-orange-200 bg-orange-50 text-orange-700'
  if (status === '已取消') return 'border-red-200 bg-red-50 text-red-700'
  return 'border-slate-200 bg-slate-50 text-slate-700'
}

function renderBadge(label: string, className: string): string {
  return `<span class="inline-flex items-center rounded-md border px-2 py-0.5 text-xs ${className}">${escapeHtml(label)}</span>`
}

function ensureState(projectId: string, projectNodeId: string): ProjectNodeDetailViewModel | null {
  let flashNotice: string | null = null
  if (typeof window !== 'undefined') {
    flashNotice = window.sessionStorage.getItem(FLASH_NOTICE_KEY)
    if (flashNotice) {
      window.sessionStorage.removeItem(FLASH_NOTICE_KEY)
    }
  }
  if (state.projectId !== projectId || state.projectNodeId !== projectNodeId) {
    state.projectId = projectId
    state.projectNodeId = projectNodeId
    state.activeTab = 'basic'
    state.notice = flashNotice
  } else if (flashNotice) {
    state.notice = flashNotice
  }
  return buildProjectNodeDetailViewModel(projectId, projectNodeId)
}

function renderNotFound(projectId: string, projectNodeId: string): string {
  return `
    <section class="rounded-lg border bg-card p-8 text-center">
      <i data-lucide="alert-circle" class="mx-auto h-10 w-10 text-muted-foreground/60"></i>
      <h1 class="mt-3 text-lg font-semibold">项目工作项未找到</h1>
      <p class="mt-1 text-sm text-muted-foreground">项目 ID：${escapeHtml(projectId)}，工作项节点 ID：${escapeHtml(projectNodeId)}</p>
      <div class="mt-4 flex items-center justify-center gap-2">
        <button class="inline-flex h-9 items-center rounded-md border px-3 text-sm hover:bg-muted" data-pcs-work-item-action="back-project">返回项目详情</button>
        <button class="inline-flex h-9 items-center rounded-md border px-3 text-sm hover:bg-muted" data-pcs-work-item-action="back-list">返回项目列表</button>
      </div>
    </section>
  `
}

function renderNotice(): string {
  if (!state.notice) return ''
  return `
    <section class="rounded-lg border border-blue-200 bg-blue-50 p-3">
      <div class="flex items-center justify-between gap-3">
        <p class="text-sm text-blue-700">${escapeHtml(state.notice)}</p>
        <button class="inline-flex h-7 items-center rounded-md border border-blue-300 px-2 text-xs text-blue-700 hover:bg-blue-100" data-pcs-work-item-action="close-notice">知道了</button>
      </div>
    </section>
  `
}

function renderField(label: string, value: string, muted = false): string {
  return `
    <article class="rounded-lg border bg-muted/20 p-3">
      <p class="text-xs text-muted-foreground">${escapeHtml(label)}</p>
      <p class="mt-1 text-sm ${muted ? 'text-muted-foreground' : 'font-medium'}">${escapeHtml(value)}</p>
    </article>
  `
}

function isDebugContractVisible(): boolean {
  if (typeof window === 'undefined') return false
  return window.localStorage.getItem('pcs-debug-project-node-detail') === 'true'
}

function renderResolvedActionButton(action: ProjectNodeBusinessAction): string {
  const dataset = Object.entries(action.data)
    .map(([key, value]) => `data-${key.replace(/[A-Z]/g, (char) => `-${char.toLowerCase()}`)}="${escapeHtml(value)}"`)
    .join(' ')
  return `
    <button
      class="inline-flex h-8 items-center rounded-md px-3 text-xs ${action.tone === 'primary' ? 'bg-blue-600 text-white hover:bg-blue-700' : 'border hover:bg-muted'}"
      data-pcs-work-item-action="${escapeHtml(action.action)}"
      data-pcs-node-action-key="${escapeHtml(action.key)}"
      ${dataset}
    >${escapeHtml(action.label)}</button>
  `
}

function renderActionCollection(actions: ProjectNodeBusinessAction[]): string {
  return actions.map((action) => renderResolvedActionButton(action)).join('')
}

function getTechPackSourceTaskText(technicalVersionId: string): string {
  const record = getTechnicalDataVersionById(technicalVersionId)
  if (!record) return '暂无来源任务'
  return buildTechPackVersionSourceTaskSummary(record).taskChainText
}

function renderChainSummarySection(
  title: string,
  channelChain: ReturnType<typeof buildProjectChannelProductChainSummary>,
): string {
  if (!channelChain) return ''
  return `
    <section class="rounded-lg border bg-card p-5">
      <h3 class="mb-3 text-base font-semibold">${escapeHtml(title)}</h3>
      <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        ${renderField('渠道商品编码', channelChain.currentChannelProductCode || '暂无渠道商品', !channelChain.currentChannelProductCode)}
        ${renderField('上游渠道商品编码', channelChain.currentUpstreamChannelProductCode || '尚未回填', !channelChain.currentUpstreamChannelProductCode)}
        ${renderField('渠道商品状态', channelChain.currentChannelProductStatus || '未建立', !channelChain.currentChannelProductStatus)}
        ${renderField('上游最终更新状态', channelChain.currentUpstreamSyncStatus || '无需更新', !channelChain.currentUpstreamSyncStatus)}
        ${renderField('款式档案编码', channelChain.linkedStyleCode || '尚未创建款式档案', !channelChain.linkedStyleCode)}
        ${renderField('款式档案状态', channelChain.linkedStyleStatus || '未建立', !channelChain.linkedStyleStatus)}
        ${renderField('技术包版本编码', channelChain.linkedTechPackVersionCode || '暂无技术包版本', !channelChain.linkedTechPackVersionCode)}
        ${renderField('技术包版本状态', channelChain.linkedTechPackVersionStatus || '未建立', !channelChain.linkedTechPackVersionStatus)}
      </div>
    </section>
  `
}

function renderDefinitionTable(headers: string[], rows: string[][]): string {
  return `
    <div class="overflow-x-auto">
      <table class="w-full min-w-[1180px] text-sm">
        <thead>
          <tr class="border-b bg-muted/30 text-left text-muted-foreground">
            ${headers.map((header) => `<th class="px-3 py-2 font-medium">${escapeHtml(header)}</th>`).join('')}
          </tr>
        </thead>
        <tbody>
          ${rows
            .map(
              (row) => `
                <tr class="border-b last:border-b-0 align-top">
                  ${row
                    .map(
                      (cell) => `
                        <td class="px-3 py-2">
                          <div class="whitespace-pre-wrap leading-6">${escapeHtml(cell)}</div>
                        </td>
                      `,
                    )
                    .join('')}
                </tr>
              `,
            )
            .join('')}
        </tbody>
      </table>
    </div>
  `
}

function renderBusinessDefinitionSection(detail: ReturnType<typeof buildProjectNodeContractDetailViewModel>): string {
  const { contract } = detail
  return `
    <section class="rounded-lg border bg-card p-5">
      <h3 class="mb-3 text-base font-semibold">节点业务定义</h3>
      <div class="grid gap-3 md:grid-cols-2">
        ${renderField('业务场景', contract.scenario)}
        ${renderField('节点保留原因', contract.keepReason)}
        ${renderField('上下游变动', [...contract.upstreamChanges, ...contract.downstreamChanges].join('；') || '无正式上下游变动')}
        ${renderField('主要业务规则', contract.businessRules.join('；') || '无正式业务规则')}
      </div>
    </section>
  `
}

function renderFieldDefinitionsSection(detail: ReturnType<typeof buildProjectNodeContractDetailViewModel>): string {
  return `
    <section class="rounded-lg border bg-card p-5" data-pcs-node-detail-section="field-definitions">
      <div class="mb-3 flex items-center justify-between gap-3">
        <h3 class="text-base font-semibold">节点字段清单</h3>
        <span class="text-xs text-muted-foreground">${detail.fieldRows.length} 个正式字段</span>
      </div>
      <p class="mb-3 text-xs text-muted-foreground">字段来源统一按“来源类型 / 来源引用”展示。只有真正来自配置工作台的字段才会显示为“配置工作台 / 维度编码”，其余字段按渠道主数据、本地组织主数据、样衣供应商主数据、固定枚举或本地演示主数据如实显示。</p>
      ${renderDefinitionTable(
        ['字段名称', '字段键', '字段来源', '字段定义', '业务场景', '业务逻辑', '是否必填', '是否只读', '当前实例值'],
        detail.fieldRows.map((row) => [
          row.label,
          row.fieldKey,
          row.sourceText,
          row.meaning,
          row.scenarioText,
          row.businessLogicText,
          row.requiredText,
          row.readonlyText,
          row.currentValueText,
        ]),
      )}
    </section>
  `
}

function renderOperationsSection(detail: ReturnType<typeof buildProjectNodeContractDetailViewModel>): string {
  return `
    <section class="rounded-lg border bg-card p-5" data-pcs-node-detail-section="operations">
      <div class="mb-3 flex items-center justify-between gap-3">
        <h3 class="text-base font-semibold">节点可操作项</h3>
        <span class="text-xs text-muted-foreground">${detail.operationRows.length} 个正式操作</span>
      </div>
      ${renderDefinitionTable(
        ['操作名称', '前置条件', '业务场景', '业务逻辑', '执行效果', '写回规则'],
        detail.operationRows.map((row) => [
          row.actionName,
          row.preconditionsText,
          row.businessScenarioText,
          row.businessLogicText,
          row.effectsText,
          row.writebackRulesText,
        ]),
      )}
    </section>
  `
}

function renderStatusesSection(detail: ReturnType<typeof buildProjectNodeContractDetailViewModel>): string {
  return `
    <section class="rounded-lg border bg-card p-5" data-pcs-node-detail-section="statuses">
      <div class="mb-3 flex items-center justify-between gap-3">
        <h3 class="text-base font-semibold">节点状态定义</h3>
        <span class="text-xs text-muted-foreground">${detail.statusRows.length} 个正式状态</span>
      </div>
      ${renderDefinitionTable(
        ['状态名称', '业务含义', '进入条件', '退出触发'],
        detail.statusRows.map((row) => [
          row.statusName,
          row.businessMeaningText,
          row.entryConditionsText,
          row.exitConditionsText,
        ]),
      )}
    </section>
  `
}

function renderSupplementRows(
  items: ProjectNodeDetailViewModel['attachments'] | ProjectNodeDetailViewModel['records'] | ProjectNodeDetailViewModel['audit'],
): string {
  return items
    .filter((item) => !item.isPlaceholder)
    .map(
      (item) => `
        <article class="rounded-lg border bg-muted/10 p-3">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <p class="text-sm font-medium">${escapeHtml(item.title)}</p>
            <span class="text-xs text-muted-foreground">${escapeHtml(item.time || '—')}</span>
          </div>
          <p class="mt-2 text-sm text-muted-foreground">${escapeHtml(item.summary || '—')}</p>
          ${
            item.metaRows && item.metaRows.length > 0
              ? `
                <div class="mt-3 grid gap-2 text-sm md:grid-cols-2 xl:grid-cols-3">
                  ${item.metaRows
                    .map(
                      (meta) => `
                        <div class="rounded-md border bg-background px-3 py-2">
                          <span class="text-muted-foreground">${escapeHtml(meta.label)}：</span>
                          <span class="font-medium">${escapeHtml(meta.value || '当前无实例值')}</span>
                        </div>
                      `,
                    )
                    .join('')}
                </div>
              `
              : ''
          }
        </article>
      `,
    )
    .join('')
}

function renderInlineRecordListSection(
  data: ProjectNodeDetailViewModel,
  title = '记录列表',
  maxCount?: number,
): string {
  const actualRecords = data.records.filter((item) => !item.isPlaceholder)
  const visibleRecords = typeof maxCount === 'number' ? actualRecords.slice(0, maxCount) : actualRecords
  return `
    <section class="rounded-lg border bg-card p-5" data-pcs-node-detail-section="record-list">
      <div class="mb-3 flex items-center justify-between gap-3">
        <h3 class="text-base font-semibold">${escapeHtml(title)}</h3>
        <span class="text-xs text-muted-foreground">${actualRecords.length} 条记录</span>
      </div>
      ${
        actualRecords.length > 0
          ? `<div class="space-y-3">${renderSupplementRows(visibleRecords)}</div>`
          : '<div class="rounded-lg border border-dashed bg-muted/20 p-5 text-sm text-muted-foreground">当前暂无正式记录</div>'
      }
    </section>
  `
}

function renderEmptyInstanceSection(title: string): string {
  return `
    <section class="rounded-lg border bg-card p-5">
      <h3 class="mb-3 text-base font-semibold">${escapeHtml(title)}</h3>
      <div class="rounded-lg border border-dashed bg-muted/20 p-5 text-sm text-muted-foreground">
        当前节点暂无正式实例数据。
      </div>
    </section>
  `
}

function renderRelationTestingDetails(item: ProjectNodeDetailViewModel['relationSection']['items'][number]): string {
  if (item.taskRelationDetail) {
    return `
      <div class="mt-3 rounded-lg border border-slate-200 bg-slate-50/70 p-3">
        <div class="grid gap-2 text-sm md:grid-cols-2 xl:grid-cols-4">
          <div><span class="text-muted-foreground">任务编号：</span><span class="font-medium">${escapeHtml(item.taskRelationDetail.taskCode)}</span></div>
          <div><span class="text-muted-foreground">任务标题：</span><span class="font-medium">${escapeHtml(item.taskRelationDetail.taskTitle)}</span></div>
          <div><span class="text-muted-foreground">当前状态：</span><span class="font-medium">${escapeHtml(item.taskRelationDetail.taskStatus || '—')}</span></div>
          <div><span class="text-muted-foreground">创建时间：</span><span class="font-medium">${escapeHtml(item.taskRelationDetail.createdAt || '—')}</span></div>
          <div><span class="text-muted-foreground">上游来源：</span><span class="font-medium">${escapeHtml(item.taskRelationDetail.upstreamObjectCode ? `${item.taskRelationDetail.upstreamModule || '上游任务'} / ${item.taskRelationDetail.upstreamObjectCode}` : '—')}</span></div>
        </div>
      </div>
    `
  }

  if (item.liveTestingDetail) {
    return `
      <div class="mt-3 rounded-lg border border-blue-100 bg-blue-50/50 p-3">
        <div class="grid gap-2 text-sm md:grid-cols-2 xl:grid-cols-4">
          <div><span class="text-muted-foreground">场次编号：</span><span class="font-medium">${escapeHtml(item.liveTestingDetail.liveSessionCode)}</span></div>
          <div><span class="text-muted-foreground">明细编号：</span><span class="font-medium">${escapeHtml(item.liveTestingDetail.liveLineCode)}</span></div>
          <div><span class="text-muted-foreground">商品标题：</span><span class="font-medium">${escapeHtml(item.liveTestingDetail.productTitle)}</span></div>
          <div><span class="text-muted-foreground">规格：</span><span class="font-medium">${escapeHtml(item.liveTestingDetail.sizeCode || '—')}</span></div>
          <div><span class="text-muted-foreground">颜色：</span><span class="font-medium">${escapeHtml(item.liveTestingDetail.colorCode || '—')}</span></div>
          <div><span class="text-muted-foreground">曝光量：</span><span class="font-medium">${item.liveTestingDetail.exposureQty.toLocaleString()}</span></div>
          <div><span class="text-muted-foreground">点击量：</span><span class="font-medium">${item.liveTestingDetail.clickQty.toLocaleString()}</span></div>
          <div><span class="text-muted-foreground">下单量：</span><span class="font-medium">${item.liveTestingDetail.orderQty.toLocaleString()}</span></div>
          <div><span class="text-muted-foreground">销售额：</span><span class="font-medium">${item.liveTestingDetail.gmvAmount.toLocaleString()}</span></div>
          <div><span class="text-muted-foreground">业务时间：</span><span class="font-medium">${escapeHtml(item.liveTestingDetail.businessDate || '—')}</span></div>
          <div><span class="text-muted-foreground">渠道商品编码：</span><span class="font-medium">${escapeHtml(item.liveTestingDetail.channelProductCode || '—')}</span></div>
          <div><span class="text-muted-foreground">上游渠道商品编码：</span><span class="font-medium">${escapeHtml(item.liveTestingDetail.upstreamChannelProductCode || '—')}</span></div>
        </div>
      </div>
    `
  }

  if (item.videoTestingDetail) {
    return `
      <div class="mt-3 rounded-lg border border-violet-100 bg-violet-50/50 p-3">
        <div class="grid gap-2 text-sm md:grid-cols-2 xl:grid-cols-4">
          <div><span class="text-muted-foreground">记录编号：</span><span class="font-medium">${escapeHtml(item.videoTestingDetail.videoRecordCode)}</span></div>
          <div><span class="text-muted-foreground">标题：</span><span class="font-medium">${escapeHtml(item.videoTestingDetail.videoTitle)}</span></div>
          <div><span class="text-muted-foreground">发布时间：</span><span class="font-medium">${escapeHtml(item.videoTestingDetail.publishedAt || '—')}</span></div>
          <div><span class="text-muted-foreground">渠道：</span><span class="font-medium">${escapeHtml(item.videoTestingDetail.channelName || '—')}</span></div>
          <div><span class="text-muted-foreground">曝光量：</span><span class="font-medium">${item.videoTestingDetail.exposureQty.toLocaleString()}</span></div>
          <div><span class="text-muted-foreground">点击量：</span><span class="font-medium">${item.videoTestingDetail.clickQty.toLocaleString()}</span></div>
          <div><span class="text-muted-foreground">下单量：</span><span class="font-medium">${item.videoTestingDetail.orderQty.toLocaleString()}</span></div>
          <div><span class="text-muted-foreground">销售额：</span><span class="font-medium">${item.videoTestingDetail.gmvAmount.toLocaleString()}</span></div>
          <div><span class="text-muted-foreground">业务时间：</span><span class="font-medium">${escapeHtml(item.videoTestingDetail.businessDate || '—')}</span></div>
          <div><span class="text-muted-foreground">渠道商品编码：</span><span class="font-medium">${escapeHtml(item.videoTestingDetail.channelProductCode || '—')}</span></div>
          <div><span class="text-muted-foreground">上游渠道商品编码：</span><span class="font-medium">${escapeHtml(item.videoTestingDetail.upstreamChannelProductCode || '—')}</span></div>
        </div>
      </div>
    `
  }

  if (item.channelProductDetail) {
    return `
      <div class="mt-3 rounded-lg border border-amber-100 bg-amber-50/60 p-3">
        <div class="grid gap-2 text-sm md:grid-cols-2 xl:grid-cols-4">
          <div><span class="text-muted-foreground">渠道商品编码：</span><span class="font-medium">${escapeHtml(item.channelProductDetail.channelProductCode)}</span></div>
          <div><span class="text-muted-foreground">上游渠道商品编码：</span><span class="font-medium">${escapeHtml(item.channelProductDetail.upstreamChannelProductCode || '—')}</span></div>
          <div><span class="text-muted-foreground">渠道商品状态：</span><span class="font-medium">${escapeHtml(item.channelProductDetail.channelProductStatus || '—')}</span></div>
          <div><span class="text-muted-foreground">上游更新状态：</span><span class="font-medium">${escapeHtml(item.channelProductDetail.upstreamSyncStatus || '—')}</span></div>
          <div><span class="text-muted-foreground">关联款式档案编码：</span><span class="font-medium">${escapeHtml(item.channelProductDetail.styleCode || '尚未关联')}</span></div>
          <div><span class="text-muted-foreground">作废原因：</span><span class="font-medium">${escapeHtml(item.channelProductDetail.invalidatedReason || '—')}</span></div>
          <div><span class="text-muted-foreground">生效时间：</span><span class="font-medium">${escapeHtml(item.channelProductDetail.effectiveAt || '—')}</span></div>
          <div><span class="text-muted-foreground">关联改版任务：</span><span class="font-medium">${escapeHtml(item.channelProductDetail.linkedRevisionTaskCode || '—')}</span></div>
          <div><span class="text-muted-foreground">上游最终更新时间：</span><span class="font-medium">${escapeHtml(item.channelProductDetail.upstreamSyncTime || '—')}</span></div>
          <div><span class="text-muted-foreground">渠道标题：</span><span class="font-medium">${escapeHtml(item.channelProductDetail.listingTitle || '—')}</span></div>
        </div>
      </div>
    `
  }

  if (item.upstreamSyncDetail) {
    return `
      <div class="mt-3 rounded-lg border border-emerald-100 bg-emerald-50/60 p-3">
        <div class="grid gap-2 text-sm md:grid-cols-2 xl:grid-cols-4">
          <div><span class="text-muted-foreground">渠道商品编码：</span><span class="font-medium">${escapeHtml(item.upstreamSyncDetail.channelProductCode)}</span></div>
          <div><span class="text-muted-foreground">上游渠道商品编码：</span><span class="font-medium">${escapeHtml(item.upstreamSyncDetail.upstreamChannelProductCode)}</span></div>
          <div><span class="text-muted-foreground">上游更新状态：</span><span class="font-medium">${escapeHtml(item.upstreamSyncDetail.upstreamSyncStatus)}</span></div>
          <div><span class="text-muted-foreground">上游最终更新时间：</span><span class="font-medium">${escapeHtml(item.upstreamSyncDetail.upstreamSyncTime || '—')}</span></div>
          <div class="md:col-span-2 xl:col-span-4"><span class="text-muted-foreground">更新说明：</span><span class="font-medium">${escapeHtml(item.upstreamSyncDetail.upstreamSyncLog || '—')}</span></div>
        </div>
      </div>
    `
  }

  if (item.sampleLedgerDetail) {
    return `
      <div class="mt-3 rounded-lg border border-amber-100 bg-amber-50/50 p-3">
        <div class="grid gap-2 text-sm md:grid-cols-2 xl:grid-cols-4">
          <div><span class="text-muted-foreground">事件编号：</span><span class="font-medium">${escapeHtml(item.sampleLedgerDetail.ledgerEventCode)}</span></div>
          <div><span class="text-muted-foreground">事件类型：</span><span class="font-medium">${escapeHtml(item.sampleLedgerDetail.eventName)}</span></div>
          <div><span class="text-muted-foreground">样衣编号：</span><span class="font-medium">${escapeHtml(item.sampleLedgerDetail.sampleCode)}</span></div>
          <div><span class="text-muted-foreground">样衣名称：</span><span class="font-medium">${escapeHtml(item.sampleLedgerDetail.sampleName)}</span></div>
          <div><span class="text-muted-foreground">来源单据：</span><span class="font-medium">${escapeHtml(`${item.sampleLedgerDetail.sourceDocType} / ${item.sampleLedgerDetail.sourceDocCode}`)}</span></div>
          <div><span class="text-muted-foreground">事件后状态：</span><span class="font-medium">${escapeHtml(item.sampleLedgerDetail.inventoryStatusAfter || '—')}</span></div>
          <div><span class="text-muted-foreground">业务时间：</span><span class="font-medium">${escapeHtml(item.sampleLedgerDetail.businessDate || '—')}</span></div>
        </div>
      </div>
    `
  }

  if (item.sampleAssetDetail) {
    return `
      <div class="mt-3 rounded-lg border border-emerald-100 bg-emerald-50/50 p-3">
        <div class="grid gap-2 text-sm md:grid-cols-2 xl:grid-cols-4">
          <div><span class="text-muted-foreground">样衣编号：</span><span class="font-medium">${escapeHtml(item.sampleAssetDetail.sampleCode)}</span></div>
          <div><span class="text-muted-foreground">样衣名称：</span><span class="font-medium">${escapeHtml(item.sampleAssetDetail.sampleName)}</span></div>
          <div><span class="text-muted-foreground">库存状态：</span><span class="font-medium">${escapeHtml(item.sampleAssetDetail.inventoryStatus || '—')}</span></div>
          <div><span class="text-muted-foreground">可用状态：</span><span class="font-medium">${escapeHtml(item.sampleAssetDetail.availabilityStatus || '—')}</span></div>
          <div><span class="text-muted-foreground">当前位置：</span><span class="font-medium">${escapeHtml(item.sampleAssetDetail.locationDisplay || '—')}</span></div>
          <div><span class="text-muted-foreground">最近事件：</span><span class="font-medium">${escapeHtml(item.sampleAssetDetail.lastEventType || '—')}</span></div>
          <div><span class="text-muted-foreground">最近事件时间：</span><span class="font-medium">${escapeHtml(item.sampleAssetDetail.lastEventTime || '—')}</span></div>
        </div>
      </div>
    `
  }

  if (item.styleArchiveDetail) {
    return `
      <div class="mt-3 rounded-lg border border-indigo-100 bg-indigo-50/50 p-3">
        <div class="grid gap-2 text-sm md:grid-cols-2 xl:grid-cols-4">
          <div><span class="text-muted-foreground">档案编号：</span><span class="font-medium">${escapeHtml(item.styleArchiveDetail.styleCode)}</span></div>
          <div><span class="text-muted-foreground">档案名称：</span><span class="font-medium">${escapeHtml(item.styleArchiveDetail.styleName)}</span></div>
          <div><span class="text-muted-foreground">档案状态：</span><span class="font-medium">${escapeHtml(item.styleArchiveDetail.archiveStatus || '—')}</span></div>
          <div><span class="text-muted-foreground">生成时间：</span><span class="font-medium">${escapeHtml(item.styleArchiveDetail.generatedAt || '—')}</span></div>
        </div>
      </div>
    `
  }

  if (item.technicalVersionDetail) {
    return `
      <div class="mt-3 rounded-lg border border-cyan-100 bg-cyan-50/50 p-3">
        <div class="grid gap-2 text-sm md:grid-cols-2 xl:grid-cols-4">
          <div><span class="text-muted-foreground">版本编号：</span><span class="font-medium">${escapeHtml(item.technicalVersionDetail.technicalVersionCode)}</span></div>
          <div><span class="text-muted-foreground">版本标签：</span><span class="font-medium">${escapeHtml(item.technicalVersionDetail.versionLabel)}</span></div>
          <div><span class="text-muted-foreground">版本状态：</span><span class="font-medium">${escapeHtml(item.technicalVersionDetail.versionStatus)}</span></div>
          <div><span class="text-muted-foreground">当前生效：</span><span class="font-medium">${item.technicalVersionDetail.isCurrentTechPackVersion ? '是' : '否'}</span></div>
          <div><span class="text-muted-foreground">完成度：</span><span class="font-medium">${item.technicalVersionDetail.completenessScore} 分</span></div>
          <div><span class="text-muted-foreground">核心缺失项：</span><span class="font-medium">${escapeHtml(item.technicalVersionDetail.missingItemNames.join('、') || '无')}</span></div>
          <div><span class="text-muted-foreground">创建时间：</span><span class="font-medium">${escapeHtml(item.technicalVersionDetail.createdAt || '—')}</span></div>
          <div><span class="text-muted-foreground">发布时间：</span><span class="font-medium">${escapeHtml(item.technicalVersionDetail.publishedAt || '—')}</span></div>
        </div>
      </div>
    `
  }

  if (item.projectArchiveDetail) {
    return `
      <div class="mt-3 rounded-lg border border-emerald-100 bg-emerald-50/50 p-3">
        <div class="grid gap-2 text-sm md:grid-cols-2 xl:grid-cols-4">
          <div><span class="text-muted-foreground">归档编号：</span><span class="font-medium">${escapeHtml(item.projectArchiveDetail.archiveNo)}</span></div>
          <div><span class="text-muted-foreground">归档状态：</span><span class="font-medium">${escapeHtml(item.projectArchiveDetail.archiveStatus)}</span></div>
          <div><span class="text-muted-foreground">资料数量：</span><span class="font-medium">${item.projectArchiveDetail.documentCount}</span></div>
          <div><span class="text-muted-foreground">文件数量：</span><span class="font-medium">${item.projectArchiveDetail.fileCount}</span></div>
          <div><span class="text-muted-foreground">缺失项数量：</span><span class="font-medium">${item.projectArchiveDetail.missingItemCount}</span></div>
          <div><span class="text-muted-foreground">可完成归档：</span><span class="font-medium">${item.projectArchiveDetail.readyForFinalize ? '是' : '否'}</span></div>
          <div><span class="text-muted-foreground">更新时间：</span><span class="font-medium">${escapeHtml(item.projectArchiveDetail.updatedAt || '—')}</span></div>
          <div><span class="text-muted-foreground">完成归档时间：</span><span class="font-medium">${escapeHtml(item.projectArchiveDetail.finalizedAt || '—')}</span></div>
        </div>
      </div>
    `
  }

  return ''
}

function renderRelationSection(data: ProjectNodeDetailViewModel): string {
  if (data.relationSection.totalCount === 0) {
    const emptyTitle =
      data.node.workItemTypeCode === 'LIVE_TEST'
        ? '当前没有直播测款记录'
        : data.node.workItemTypeCode === 'VIDEO_TEST'
          ? '当前没有短视频测款记录'
          : '当前节点暂无关联对象'
    const emptyText =
      data.node.workItemTypeCode === 'LIVE_TEST'
        ? '当前还没有直播测款记录'
        : data.node.workItemTypeCode === 'VIDEO_TEST'
          ? '当前还没有短视频测款记录'
          : '当前还没有关联对象'
    return `
      <section class="rounded-lg border bg-card p-5">
        <h3 class="mb-3 text-base font-semibold">关联实例</h3>
        <div class="rounded-lg border border-dashed bg-muted/20 p-6 text-center">
          <p class="text-base font-medium">${emptyTitle}</p>
          <p class="mt-1 text-sm text-muted-foreground">${emptyText}</p>
        </div>
      </section>
    `
  }

  return `
    <section class="rounded-lg border bg-card p-5">
      <div class="mb-3 flex items-center justify-between gap-3">
        <h3 class="text-base font-semibold">关联实例</h3>
        <span class="text-xs text-muted-foreground">${data.relationSection.totalCount} 条已关联对象</span>
      </div>
      <div class="space-y-3">
        ${data.relationSection.items
          .map(
            (item) => `
              <article class="rounded-lg border bg-muted/10 p-3">
                <div class="grid gap-3 text-sm md:grid-cols-2 xl:grid-cols-3">
                  <div><span class="text-muted-foreground">关联来源：</span><span class="font-medium">${escapeHtml(item.sourceModule)}</span></div>
                  <div><span class="text-muted-foreground">关联对象编号：</span><span class="font-medium">${escapeHtml(item.sourceObjectCode)}</span></div>
                  <div><span class="text-muted-foreground">关联对象名称：</span><span class="font-medium">${escapeHtml(item.sourceTitle || '—')}</span></div>
                  <div><span class="text-muted-foreground">当前状态：</span><span class="font-medium">${escapeHtml(item.sourceStatus || '—')}</span></div>
                  <div><span class="text-muted-foreground">${item.taskRelationDetail ? '创建时间' : '业务时间'}：</span><span class="font-medium">${escapeHtml((item.taskRelationDetail?.createdAt || item.businessDate) || '—')}</span></div>
                  <div><span class="text-muted-foreground">关联用途：</span><span class="font-medium">${escapeHtml(item.relationRole)}</span></div>
                </div>
                ${renderRelationTestingDetails(item)}
              </article>
            `,
          )
          .join('')}
      </div>
    </section>
  `
}

function renderPatternTaskInstanceSection(data: ProjectNodeDetailViewModel): string {
  if (data.node.workItemTypeCode !== 'PATTERN_TASK') return ''
  const relation = data.relationSection.items.find((item) => item.sourceObjectType === '制版任务')
  const task = relation ? getPlateMakingTaskById(relation.sourceObjectId) : null
  if (!task) return renderEmptyInstanceSection('制版任务实例')
  return `
    <section class="rounded-lg border bg-card p-5">
      <h3 class="mb-3 text-base font-semibold">制版任务实例</h3>
      <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        ${renderField('任务编号', task.plateTaskCode)}
        ${renderField('任务标题', task.title)}
        ${renderField('任务状态', task.status)}
        ${renderField('款式档案编码', task.productStyleCode || '当前无实例值', !task.productStyleCode)}
        ${renderField('尺码范围', task.sizeRange || '当前无实例值', !task.sizeRange)}
        ${renderField('纸样版本', task.patternVersion || '当前无实例值', !task.patternVersion)}
        ${renderField('技术包版本编号', task.linkedTechPackVersionCode || '当前无实例值', !task.linkedTechPackVersionCode)}
        ${renderField('最近写入技术包时间', task.linkedTechPackUpdatedAt || '当前无实例值', !task.linkedTechPackUpdatedAt)}
      </div>
    </section>
  `
}

function renderArtworkTaskInstanceSection(data: ProjectNodeDetailViewModel): string {
  if (data.node.workItemTypeCode !== 'PATTERN_ARTWORK_TASK') return ''
  const relation = data.relationSection.items.find((item) => item.sourceObjectType === '花型任务')
  const task = relation ? getPatternTaskById(relation.sourceObjectId) : null
  if (!task) return renderEmptyInstanceSection('花型任务实例')
  return `
    <section class="rounded-lg border bg-card p-5">
      <h3 class="mb-3 text-base font-semibold">花型任务实例</h3>
      <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        ${renderField('任务编号', task.patternTaskCode)}
        ${renderField('任务标题', task.title)}
        ${renderField('任务状态', task.status)}
        ${renderField('花型类型', task.artworkType || '当前无实例值', !task.artworkType)}
        ${renderField('花型模式', task.patternMode || '当前无实例值', !task.patternMode)}
        ${renderField('花型名称', task.artworkName || '当前无实例值', !task.artworkName)}
        ${renderField('花型版本', task.artworkVersion || '当前无实例值', !task.artworkVersion)}
        ${renderField('技术包版本编号', task.linkedTechPackVersionCode || '当前无实例值', !task.linkedTechPackVersionCode)}
      </div>
    </section>
  `
}

function renderFirstSampleInstanceSection(data: ProjectNodeDetailViewModel): string {
  if (data.node.workItemTypeCode !== 'FIRST_SAMPLE') return ''
  const relation = data.relationSection.items.find((item) => item.sourceObjectType === '首版样衣打样任务')
  const task = relation ? getFirstSampleTaskById(relation.sourceObjectId) : null
  if (!task) return renderEmptyInstanceSection('首版样衣打样实例')
  return `
    <section class="rounded-lg border bg-card p-5">
      <h3 class="mb-3 text-base font-semibold">首版样衣打样实例</h3>
      <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        ${renderField('任务编号', task.firstSampleTaskCode)}
        ${renderField('任务标题', task.title)}
        ${renderField('任务状态', task.status)}
        ${renderField('工厂', task.factoryName ? `${task.factoryName}（${task.factoryId}）` : '当前无实例值', !task.factoryId)}
        ${renderField('目标站点', task.targetSite || '当前无实例值', !task.targetSite)}
        ${renderField('预计到样时间', task.expectedArrival || '当前无实例值', !task.expectedArrival)}
        ${renderField('物流单号', task.trackingNo || '当前无实例值', !task.trackingNo)}
        ${renderField('样衣编号', task.sampleCode || '当前无实例值', !task.sampleCode)}
      </div>
    </section>
  `
}

function renderPreProductionSampleInstanceSection(data: ProjectNodeDetailViewModel): string {
  if (data.node.workItemTypeCode !== 'PRE_PRODUCTION_SAMPLE') return ''
  const relation = data.relationSection.items.find((item) => item.sourceObjectType === '产前版样衣任务')
  const task = relation ? getPreProductionSampleTaskById(relation.sourceObjectId) : null
  if (!task) return renderEmptyInstanceSection('产前版样衣实例')
  return `
    <section class="rounded-lg border bg-card p-5">
      <h3 class="mb-3 text-base font-semibold">产前版样衣实例</h3>
      <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        ${renderField('任务编号', task.preProductionSampleTaskCode)}
        ${renderField('任务标题', task.title)}
        ${renderField('任务状态', task.status)}
        ${renderField('工厂', task.factoryName ? `${task.factoryName}（${task.factoryId}）` : '当前无实例值', !task.factoryId)}
        ${renderField('目标站点', task.targetSite || '当前无实例值', !task.targetSite)}
        ${renderField('预计到样时间', task.expectedArrival || '当前无实例值', !task.expectedArrival)}
        ${renderField('纸样版本', task.patternVersion || '当前无实例值', !task.patternVersion)}
        ${renderField('花型版本', task.artworkVersion || '当前无实例值', !task.artworkVersion)}
        ${renderField('物流单号', task.trackingNo || '当前无实例值', !task.trackingNo)}
        ${renderField('样衣编号', task.sampleCode || '当前无实例值', !task.sampleCode)}
      </div>
    </section>
  `
}

function renderBasicTab(data: ProjectNodeDetailViewModel): string {
  const channelChain = buildProjectChannelProductChainSummary(data.projectId)
  const carrier = getPcsWorkItemRuntimeCarrierDefinition(
    data.node.workItemTypeCode as Parameters<typeof getPcsWorkItemRuntimeCarrierDefinition>[0],
  )
  const contractDetail = buildProjectNodeContractDetailViewModel(data)
  const debugContractDetail = isDebugContractVisible() ? contractDetail : null
  const showInlineDefinitions =
    carrier.projectDisplayRequirementCode === 'PROJECT_INLINE_SINGLE' ||
    carrier.projectDisplayRequirementCode === 'PROJECT_INLINE_RECORDS' ||
    data.node.workItemTypeCode === 'TEST_CONCLUSION'
  const showInlineRecordList = carrier.projectDisplayRequirementCode === 'PROJECT_INLINE_RECORDS'
  const showInlineCurrentRecord = carrier.projectDisplayRequirementCode === 'PROJECT_INLINE_SINGLE'
  const businessResolution = resolveProjectNodeBusinessActions(data, channelChain)
  const currentActions = businessResolution.currentActions.filter((action) => {
    if (action.key !== 'create-channel-product') return true
    return data.projectStatus !== '已终止' && data.node.currentStatus !== '已取消'
  })
  const currentActionReason =
    currentActions.length > 0
      ? ''
      : data.node.workItemTypeCode === 'CHANNEL_PRODUCT_LISTING' && data.node.currentStatus === '已取消'
        ? '当前节点已取消，仅保留查看型入口。'
        : data.node.workItemTypeCode === 'CHANNEL_PRODUCT_LISTING' && data.projectStatus === '已终止'
          ? '当前项目已终止，不再创建渠道商品。'
          : businessResolution.currentActionReason

  const styleArchiveSection =
    data.node.workItemTypeCode === 'STYLE_ARCHIVE_CREATE'
      ? `
        <section class="rounded-lg border bg-card p-5">
          <h3 class="mb-3 text-base font-semibold">款式档案情况</h3>
          <div class="grid gap-3 md:grid-cols-2">
            ${renderField('已关联款式档案编号', data.linkedStyleCode || '暂无关联', !data.linkedStyleCode)}
            ${renderField('已关联款式档案名称', data.linkedStyleName || '暂无关联', !data.linkedStyleName)}
            ${renderField('生成时间', data.linkedStyleGeneratedAt || '暂无生成时间', !data.linkedStyleGeneratedAt)}
            ${renderField('当前档案状态', data.relationSection.items.find((item) => item.styleArchiveDetail)?.styleArchiveDetail?.archiveStatus || '技术包待完善')}
            ${renderField('来源渠道商品编码', channelChain?.currentChannelProductCode || '暂无来源渠道商品', !channelChain?.currentChannelProductCode)}
            ${renderField('来源上游渠道商品编码', channelChain?.currentUpstreamChannelProductCode || '暂无来源上游编码', !channelChain?.currentUpstreamChannelProductCode)}
            ${renderField('三码关联结果', channelChain?.linkedStyleCode ? `${channelChain.linkedStyleCode} / ${channelChain.currentChannelProductCode} / ${channelChain.currentUpstreamChannelProductCode || '待回填'}` : '尚未形成三码关联', !channelChain?.linkedStyleCode)}
          </div>
        </section>
      `
      : ''

  const channelProductSection =
    data.node.workItemTypeCode === 'CHANNEL_PRODUCT_LISTING'
      ? `
        <section class="rounded-lg border bg-card p-5">
          <h3 class="mb-3 text-base font-semibold">渠道商品实例</h3>
          <div class="grid gap-3 md:grid-cols-2">
            ${renderField('渠道商品编码', channelChain?.currentChannelProductCode || '尚未创建渠道商品', !channelChain?.currentChannelProductCode)}
            ${renderField('上游渠道商品编码', channelChain?.currentUpstreamChannelProductCode || '尚未回填', !channelChain?.currentUpstreamChannelProductCode)}
            ${renderField('渠道商品状态', channelChain?.currentChannelProductStatus || '未建立', !channelChain?.currentChannelProductStatus)}
            ${renderField('上游更新状态', channelChain?.currentUpstreamSyncStatus || '无需更新', !channelChain?.currentUpstreamSyncStatus)}
            ${renderField('作废原因', channelChain?.invalidatedReason || '—', !channelChain?.invalidatedReason)}
            ${renderField('关联款式档案编码', channelChain?.linkedStyleCode || '尚未关联', !channelChain?.linkedStyleCode)}
            ${renderField('链路说明', channelChain?.summaryText || '当前项目尚未建立渠道商品链路。')}
            ${renderField('上游最终更新时间', channelChain?.currentUpstreamSyncTime || '暂无', !channelChain?.currentUpstreamSyncTime)}
          </div>
        </section>
      `
      : ''

  const testingSummarySection =
    data.node.workItemTypeCode === 'TEST_DATA_SUMMARY'
      ? `
        <section class="rounded-lg border bg-card p-5">
          <h3 class="mb-3 text-base font-semibold">测款汇总情况</h3>
          <div class="grid gap-3 md:grid-cols-2">
            ${renderField('当前渠道商品编码', channelChain?.currentChannelProductCode || '暂无渠道商品', !channelChain?.currentChannelProductCode)}
            ${renderField('当前上游渠道商品编码', channelChain?.currentUpstreamChannelProductCode || '尚未回填', !channelChain?.currentUpstreamChannelProductCode)}
            ${renderField('直播测款记录', `${data.projectTestingContext.formalLiveRelationCount} 条`, data.projectTestingContext.formalLiveRelationCount === 0)}
            ${renderField('短视频测款记录', `${data.projectTestingContext.formalVideoRelationCount} 条`, data.projectTestingContext.formalVideoRelationCount === 0)}
            ${renderField('最新汇总结果', data.node.latestResultText || '尚未提交测款汇总', !data.node.latestResultText)}
            ${renderField('下一步动作', data.node.pendingActionText || '请先建立直播或短视频测款记录')}
          </div>
        </section>
      `
      : ''

  const testingNodeSection =
    data.node.workItemTypeCode === 'LIVE_TEST' || data.node.workItemTypeCode === 'VIDEO_TEST'
      ? `
        <section class="rounded-lg border bg-card p-5">
          <h3 class="mb-3 text-base font-semibold">测款引用渠道商品</h3>
          <div class="grid gap-3 md:grid-cols-2">
            ${renderField('渠道商品编码', channelChain?.currentChannelProductCode || '暂无引用渠道商品', !channelChain?.currentChannelProductCode)}
            ${renderField('上游渠道商品编码', channelChain?.currentUpstreamChannelProductCode || '暂无上游渠道商品编码', !channelChain?.currentUpstreamChannelProductCode)}
            ${renderField('渠道商品状态', channelChain?.currentChannelProductStatus || '未建立', !channelChain?.currentChannelProductStatus)}
            ${renderField('测款链路说明', channelChain?.summaryText || '当前项目尚未形成测款链路。')}
          </div>
        </section>
      `
      : ''

  const conclusionSection =
    data.node.workItemTypeCode === 'TEST_CONCLUSION'
      ? `
        <section class="rounded-lg border bg-card p-5">
          <h3 class="mb-3 text-base font-semibold">测款结论情况</h3>
          <div class="grid gap-3 md:grid-cols-2">
            ${renderField('当前测款结论', channelChain?.currentConclusion || data.node.latestResultType || '尚未提交结论', !(channelChain?.currentConclusion || data.node.latestResultType))}
            ${renderField('直播测款记录', `${data.projectTestingContext.formalLiveRelationCount} 条`, data.projectTestingContext.formalLiveRelationCount === 0)}
            ${renderField('短视频测款记录', `${data.projectTestingContext.formalVideoRelationCount} 条`, data.projectTestingContext.formalVideoRelationCount === 0)}
            ${renderField('是否作废当前渠道商品', channelChain?.currentConclusion && channelChain.currentConclusion !== '通过' ? '是' : '否')}
            ${renderField('作废原因', channelChain?.invalidatedReason || '—', !channelChain?.invalidatedReason)}
            ${renderField('是否创建改版任务', channelChain?.linkedRevisionTaskCode ? `是 / ${channelChain.linkedRevisionTaskCode}` : '否', !channelChain?.linkedRevisionTaskCode)}
            ${renderField('是否允许创建款式档案', channelChain?.currentConclusion === '通过' ? '允许' : '不允许')}
            ${renderField('项目链路说明', channelChain?.summaryText || '当前项目尚未形成结论链路。')}
          </div>
        </section>
      `
      : ''

  const technicalVersionSection =
    data.node.workItemTypeCode === 'PROJECT_TRANSFER_PREP'
      ? `
        <section class="rounded-lg border bg-card p-5">
          <h3 class="mb-3 text-base font-semibold">技术包版本关联</h3>
          <div class="grid gap-3 md:grid-cols-2">
            ${renderField('最近关联技术包版本编号', data.linkedTechPackVersionCode || '暂无关联', !data.linkedTechPackVersionCode)}
            ${renderField('最近关联技术包版本标签', data.linkedTechPackVersionLabel || '暂无关联', !data.linkedTechPackVersionLabel)}
            ${renderField('最近关联版本状态', data.linkedTechPackVersionStatus || '未建立', !data.linkedTechPackVersionStatus)}
            ${renderField('来源任务链', data.linkedTechPackVersionId ? getTechPackSourceTaskText(data.linkedTechPackVersionId) : '暂无来源任务', !data.linkedTechPackVersionId)}
            ${renderField('当前生效版本编号', data.currentTechPackVersionCode || '暂无当前生效版本', !data.currentTechPackVersionCode)}
            ${renderField('当前生效版本标签', data.currentTechPackVersionLabel || '暂无当前生效版本', !data.currentTechPackVersionLabel)}
            ${renderField('当前生效版本状态', data.currentTechPackVersionStatus || '未启用', !data.currentTechPackVersionStatus)}
            ${renderField('来源款式档案', data.linkedStyleCode || data.linkedStyleName || '暂无来源款式档案', !data.linkedStyleId)}
            ${renderField('款式档案状态', channelChain?.linkedStyleStatus || '未建立', !channelChain?.linkedStyleStatus)}
            ${renderField('上游最终更新时间', channelChain?.currentUpstreamSyncTime || '暂无', !channelChain?.currentUpstreamSyncTime)}
            ${renderField('上游更新状态', channelChain?.currentUpstreamSyncStatus || '无需更新', !channelChain?.currentUpstreamSyncStatus)}
            ${renderField('项目链路说明', channelChain?.summaryText || '当前项目尚未形成完整转档链路。')}
          </div>
        </section>
        <section class="rounded-lg border bg-card p-5">
          <h3 class="mb-3 text-base font-semibold">项目资料归档</h3>
          <div class="grid gap-3 md:grid-cols-2">
            ${renderField('归档编号', data.projectArchiveNo || '暂无项目资料归档', !data.projectArchiveNo)}
            ${renderField('归档状态', data.projectArchiveStatus || '未建立', !data.projectArchiveStatus)}
            ${renderField('资料数量', `${data.projectArchiveDocumentCount} 条`, data.projectArchiveDocumentCount === 0)}
            ${renderField('文件数量', `${data.projectArchiveFileCount} 份`, data.projectArchiveFileCount === 0)}
            ${renderField('缺失项数量', `${data.projectArchiveMissingItemCount} 项`, data.projectArchiveMissingItemCount === 0)}
            ${renderField('归档更新时间', data.projectArchiveUpdatedAt || '暂无更新时间', !data.projectArchiveUpdatedAt)}
            ${renderField('完成归档时间', data.projectArchiveFinalizedAt || '未完成归档', !data.projectArchiveFinalizedAt)}
          </div>
        </section>
      `
      : ''

  const patternTaskSection = renderPatternTaskInstanceSection(data)
  const artworkTaskSection = renderArtworkTaskInstanceSection(data)
  const firstSampleSection = renderFirstSampleInstanceSection(data)
  const preProductionSection = renderPreProductionSampleInstanceSection(data)

  return `
    <div class="space-y-4">
      <section class="rounded-lg border bg-card p-5">
        <h3 class="mb-3 text-base font-semibold">节点基本信息</h3>
        <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          ${renderField('工作项名称', data.node.workItemTypeName)}
          ${renderField('所属项目', `${data.projectCode} · ${data.projectName}`)}
          ${renderField('所属阶段', `${data.phase.phaseName}（第 ${String(data.phase.phaseOrder || 0).padStart(2, '0')} 阶段）`)}
          ${renderField('当前状态', data.node.currentStatus)}
          ${renderField('当前负责人', data.node.currentOwnerName || '待分配', !data.node.currentOwnerName)}
          ${renderField('最近更新时间', data.node.updatedAt)}
          ${renderField('最近一次样衣事件时间', data.node.lastEventTime || '暂无样衣事件', !data.node.lastEventTime)}
        </div>
      </section>

      <section class="rounded-lg border bg-card p-5">
        <h3 class="mb-3 text-base font-semibold">当前状态说明</h3>
        <div class="space-y-3">
          <div class="rounded-lg border bg-muted/20 p-4 text-sm leading-6">${escapeHtml(businessResolution.statusText)}</div>
          <div class="grid gap-3 md:grid-cols-2">
            ${renderField('当前问题', data.node.currentIssueText || '当前无阻塞问题', !data.node.currentIssueText)}
            ${renderField('当前待处理事项', data.node.pendingActionText || '当前无待处理事项', !data.node.pendingActionText)}
            ${renderField('项目状态', data.projectStatus)}
            ${renderField('阶段状态', data.phase.phaseStatus)}
          </div>
        </div>
      </section>

      <section class="rounded-lg border bg-card p-5">
        <h3 class="mb-3 text-base font-semibold">当前处理结果</h3>
        <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          ${renderField('结果类型', data.node.latestResultType || '暂无结果类型', !data.node.latestResultType)}
          ${renderField('结果说明', data.node.latestResultText || '暂无最近结果', !data.node.latestResultText)}
          ${renderField('待处理类型', data.node.pendingActionType || '暂无待处理类型', !data.node.pendingActionType)}
          ${renderField('待处理说明', data.node.pendingActionText || '暂无待处理事项', !data.node.pendingActionText)}
          ${renderField('直播测款记录', `${data.projectTestingContext.formalLiveRelationCount} 条`, data.projectTestingContext.formalLiveRelationCount === 0)}
          ${renderField('短视频测款记录', `${data.projectTestingContext.formalVideoRelationCount} 条`, data.projectTestingContext.formalVideoRelationCount === 0)}
        </div>
      </section>

      <section class="rounded-lg border bg-card p-5">
        <div class="mb-3 flex items-center justify-between gap-3">
          <h3 class="text-base font-semibold">当前可操作</h3>
          ${
            data.node.workItemTypeCode === 'TEST_CONCLUSION' && data.node.currentStatus === '待确认'
              ? '<span class="text-xs text-muted-foreground">提交测款结论</span>'
              : ''
          }
        </div>
        ${
          currentActions.length > 0
            ? `<div class="flex flex-wrap gap-2">${renderActionCollection(currentActions)}</div>`
            : `<div class="rounded-lg border border-dashed bg-muted/20 p-4 text-sm text-muted-foreground">${escapeHtml(currentActionReason)}</div>`
        }
      </section>
      ${showInlineDefinitions ? renderFieldDefinitionsSection(contractDetail) : ''}
      ${showInlineDefinitions ? renderStatusesSection(contractDetail) : ''}
      ${showInlineDefinitions ? renderOperationsSection(contractDetail) : ''}
      ${showInlineCurrentRecord ? renderInlineRecordListSection(data, '当前正式记录', 1) : ''}
      ${showInlineRecordList ? renderInlineRecordListSection(data, '记录列表', 3) : ''}

      ${
        ['CHANNEL_PRODUCT_LISTING', 'TEST_CONCLUSION', 'STYLE_ARCHIVE_CREATE', 'PROJECT_TRANSFER_PREP'].includes(
          data.node.workItemTypeCode,
        )
          ? renderChainSummarySection('当前链路摘要', channelChain)
          : ''
      }
      ${channelProductSection}
      ${testingSummarySection}
      ${testingNodeSection}
      ${conclusionSection}
      ${styleArchiveSection}
      ${technicalVersionSection}
      ${patternTaskSection}
      ${artworkTaskSection}
      ${firstSampleSection}
      ${preProductionSection}

      <section class="rounded-lg border bg-card p-5">
        <h3 class="mb-3 text-base font-semibold">相关去向 / 查看入口</h3>
        ${
          businessResolution.destinationActions.length > 0
            ? `<div class="flex flex-wrap gap-2">${renderActionCollection(businessResolution.destinationActions)}</div>`
            : `<div class="rounded-lg border border-dashed bg-muted/20 p-4 text-sm text-muted-foreground">${escapeHtml(businessResolution.destinationReason)}</div>`
        }
      </section>

      ${renderRelationSection(data)}

      ${
        debugContractDetail
          ? `
            <section class="rounded-lg border border-dashed bg-slate-50 p-5">
              <p class="mb-4 text-xs text-slate-500">调试模式已开启，以下为节点契约说明，仅供研发排查使用。</p>
              <div class="space-y-4">
                ${renderBusinessDefinitionSection(debugContractDetail)}
                ${renderFieldDefinitionsSection(debugContractDetail)}
                ${renderOperationsSection(debugContractDetail)}
                ${renderStatusesSection(debugContractDetail)}
              </div>
            </section>
          `
          : ''
      }
    </div>
  `
}

function renderCollectionTab(
  title: string,
  items: ProjectNodeDetailViewModel['attachments'] | ProjectNodeDetailViewModel['records'] | ProjectNodeDetailViewModel['audit'],
): string {
  const actualItems = items.filter((item) => !item.isPlaceholder)
  const emptyText =
    title === '记录' ? '当前暂无正式记录' : title === '附件' ? '当前暂无附件' : '当前暂无审计记录'
  return `
    <section class="rounded-lg border bg-card p-6">
      <div class="mb-3 flex items-center justify-between gap-3">
        <h3 class="text-base font-semibold">${escapeHtml(title)}</h3>
        <span class="text-xs text-muted-foreground">${actualItems.length} 条</span>
      </div>
      ${
        actualItems.length > 0
          ? `<div class="space-y-3">${renderSupplementRows(actualItems)}</div>`
          : `<div class="rounded-lg border border-dashed bg-muted/20 p-5 text-center text-sm text-muted-foreground">${escapeHtml(emptyText)}</div>`
      }
    </section>
  `
}

function renderRecordsTab(data: ProjectNodeDetailViewModel): string {
  const carrier = getPcsWorkItemRuntimeCarrierDefinition(
    data.node.workItemTypeCode as Parameters<typeof getPcsWorkItemRuntimeCarrierDefinition>[0],
  )

  if (
    carrier.projectDisplayRequirementCode === 'PROJECT_INLINE_SINGLE' ||
    carrier.projectDisplayRequirementCode === 'PROJECT_INLINE_RECORDS'
  ) {
    return renderCollectionTab('记录', data.records)
  }

  if (carrier.projectDisplayRequirementCode === 'STANDALONE_INSTANCE_LIST') {
    return `
      <section class="rounded-lg border bg-card p-6">
        <div class="mb-3 flex items-center justify-between gap-3">
          <h3 class="text-base font-semibold">记录</h3>
        </div>
        <div class="rounded-lg border border-dashed bg-muted/20 p-5 text-center text-sm text-muted-foreground">
          当前节点以独立实例模块承载，请通过关联实例入口查看。
        </div>
      </section>
    `
  }

  return `
    <section class="rounded-lg border bg-card p-6">
      <div class="mb-3 flex items-center justify-between gap-3">
        <h3 class="text-base font-semibold">记录</h3>
      </div>
      <div class="rounded-lg border border-dashed bg-muted/20 p-5 text-center text-sm text-muted-foreground">
        当前节点通过聚合对象承载，不单独维护记录列表。
      </div>
    </section>
  `
}

function renderTabs(data: ProjectNodeDetailViewModel): string {
  const tabClass = (tab: DetailTab) =>
    toClassName(
      'inline-flex h-9 items-center rounded-md px-3 text-sm',
      state.activeTab === tab ? 'border border-blue-200 bg-blue-50 text-blue-700' : 'border hover:bg-muted',
    )

  return `
    <section class="space-y-4">
      <div class="flex flex-wrap items-center gap-2">
        <button class="${tabClass('basic')}" data-pcs-work-item-action="set-tab" data-tab="basic">节点信息</button>
        <button class="${tabClass('attachments')}" data-pcs-work-item-action="set-tab" data-tab="attachments">附件</button>
        <button class="${tabClass('records')}" data-pcs-work-item-action="set-tab" data-tab="records">记录</button>
        <button class="${tabClass('audit')}" data-pcs-work-item-action="set-tab" data-tab="audit">审计</button>
      </div>
      ${
        state.activeTab === 'basic'
          ? renderBasicTab(data)
          : state.activeTab === 'attachments'
            ? renderCollectionTab('附件', data.attachments)
            : state.activeTab === 'records'
              ? renderRecordsTab(data)
              : renderCollectionTab('审计', data.audit)
      }
    </section>
  `
}

export function renderPcsProjectWorkItemDetailPage(projectId: string, projectNodeId: string): string {
  const data = ensureState(projectId, projectNodeId)
  if (!data) return renderNotFound(projectId, projectNodeId)

  return `
    <div class="space-y-4">
      <section class="rounded-lg border bg-card p-5">
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div class="space-y-2">
            <div class="flex items-center gap-2 text-sm text-muted-foreground">
              <button class="inline-flex items-center hover:underline" data-pcs-work-item-action="back-project">${escapeHtml(data.projectCode)}</button>
              <i data-lucide="chevron-right" class="h-4 w-4"></i>
              <span>${escapeHtml(data.projectName)}</span>
            </div>
            <div class="flex flex-wrap items-center gap-2">
              <h1 class="text-xl font-semibold">${escapeHtml(data.node.workItemTypeName)}</h1>
              ${renderBadge(data.node.currentStatus, getNodeStatusClass(data.node.currentStatus))}
            </div>
            <p class="text-sm text-muted-foreground">所属阶段：${escapeHtml(data.phase.phaseName)} · 当前负责人：${escapeHtml(data.node.currentOwnerName || '待分配')} · 最近更新时间：${escapeHtml(data.node.updatedAt)}</p>
          </div>
          <div class="flex items-center gap-2">
            <button class="inline-flex h-8 items-center rounded-md border px-3 text-xs hover:bg-muted" data-pcs-work-item-action="back-project">返回项目详情</button>
            <button class="inline-flex h-8 items-center rounded-md border px-3 text-xs hover:bg-muted" data-pcs-work-item-action="back-list">返回项目列表</button>
          </div>
        </div>
      </section>
      ${renderNotice()}
      ${renderTabs(data)}
    </div>
  `
}

export function handlePcsProjectWorkItemDetailEvent(target: HTMLElement): boolean {
  const actionNode = target.closest<HTMLElement>('[data-pcs-work-item-action]')
  if (!actionNode) return false
  const action = actionNode.dataset.pcsWorkItemAction
  if (!action) return false

  if (action === 'back-project') {
    if (state.projectId) {
      appStore.navigate(`/pcs/projects/${state.projectId}`)
    } else {
      appStore.navigate('/pcs/projects')
    }
    return true
  }

  if (action === 'back-list') {
    appStore.navigate('/pcs/projects')
    return true
  }

  if (action === 'set-tab') {
    const tab = actionNode.dataset.tab as DetailTab | undefined
    if (tab) state.activeTab = tab
    return true
  }

  if (action === 'close-notice') {
    state.notice = null
    return true
  }

  if (action === 'generate-style-archive') {
    if (!state.projectId) return true
    const result = generateStyleArchiveShellFromProject(state.projectId)
    state.notice = result.message
    if (result.ok && result.style) {
      appStore.navigate(`/pcs/products/styles/${result.style.styleId}`)
    }
    return true
  }

  if (action === 'create-channel-product') {
    if (!state.projectId) return true
    writeProjectChannelProductCreateBridge(state.projectId)
    appStore.navigate('/pcs/products/channel-products')
    return true
  }

  if (action === 'launch-channel-product') {
    const channelProductId = actionNode.dataset.channelProductId
    if (!channelProductId) return true
    const result = launchProjectChannelProductListing(channelProductId, '当前用户')
    state.notice = result.message
    return true
  }

  if (action === 'go-channel-product-detail') {
    const channelProductId = actionNode.dataset.channelProductId
    if (channelProductId) {
      appStore.navigate(`/pcs/products/channel-products/${encodeURIComponent(channelProductId)}`)
    }
    return true
  }

  if (action === 'go-live-testing') {
    appStore.navigate('/pcs/testing/live')
    return true
  }

  if (action === 'go-video-testing') {
    appStore.navigate('/pcs/testing/video')
    return true
  }

  if (action === 'go-live-testing-detail') {
    const sessionId = actionNode.dataset.sessionId
    if (sessionId) {
      appStore.navigate(`/pcs/testing/live/${encodeURIComponent(sessionId)}`)
    }
    return true
  }

  if (action === 'go-video-testing-detail') {
    const recordId = actionNode.dataset.recordId
    if (recordId) {
      appStore.navigate(`/pcs/testing/video/${encodeURIComponent(recordId)}`)
    }
    return true
  }

  if (action === 'go-testing-relations') {
    const targetType = actionNode.dataset.target
    appStore.navigate(targetType === 'video' ? '/pcs/testing/video' : '/pcs/testing/live')
    return true
  }

  if (action === 'invalidate-channel-product') {
    const channelProductId = actionNode.dataset.channelProductId
    if (!channelProductId) return true
    const result = invalidateProjectChannelProduct(channelProductId, '当前用户')
    state.notice = result.message
    return true
  }

  if (action === 'submit-testing-summary' || action === 'generate-testing-summary') {
    if (!state.projectId) return true
    const result = generateProjectTestingSummaryFromRelations(state.projectId, '当前用户')
    state.notice = result.message
    return true
  }

  if (action === 'submit-testing-conclusion') {
    if (!state.projectId) return true
    const conclusion = actionNode.dataset.conclusion as '通过' | '调整' | '暂缓' | '淘汰' | undefined
    if (!conclusion) return true
    const noteMap = {
      通过: '测款通过，可进入款式档案生成。',
      调整: '测款结论为调整，需进入改版并重新测款。',
      暂缓: '测款结论为暂缓，当前项目进入阻塞状态。',
      淘汰: '测款结论为淘汰，当前项目关闭。',
    } as const
    const result = submitProjectTestingConclusion(
      state.projectId,
      {
        conclusion,
        note: noteMap[conclusion],
      },
      '当前用户',
    )
    state.notice = result.message
    return true
  }

  if (action === 'show-chain-summary') {
    if (!state.projectId) return true
    const chain = buildProjectChannelProductChainSummary(state.projectId)
    state.notice = chain
      ? `${chain.summaryText} 当前链路：${chain.linkedStyleCode || '无款式档案'} / ${chain.currentChannelProductCode || '无渠道商品'} / ${chain.currentUpstreamChannelProductCode || '无上游渠道商品编码'}`
      : '当前项目尚未建立渠道商品链路。'
    return true
  }

  if (action === 'go-project-node-detail') {
    const projectNodeId = actionNode.dataset.projectNodeId
    if (state.projectId && projectNodeId) {
      appStore.navigate(`/pcs/projects/${encodeURIComponent(state.projectId)}/work-items/${encodeURIComponent(projectNodeId)}`)
    }
    return true
  }

  if (action === 'go-style-archive') {
    const styleId = actionNode.dataset.styleId
    if (styleId) {
      appStore.navigate(`/pcs/products/styles/${styleId}`)
    }
    return true
  }

  if (action === 'go-revision-tasks') {
    appStore.navigate('/pcs/patterns/revision')
    return true
  }

  if (action === 'go-technical-version') {
    const technicalVersionId = actionNode.dataset.technicalVersionId
    const data = state.projectId && state.projectNodeId
      ? buildProjectNodeDetailViewModel(state.projectId, state.projectNodeId)
      : null
    if (technicalVersionId && data?.linkedStyleId) {
      appStore.navigate(
        `/pcs/products/styles/${encodeURIComponent(data.linkedStyleId)}/technical-data/${encodeURIComponent(technicalVersionId)}`,
      )
    }
    return true
  }

  if (action === 'create-project-archive') {
    if (!state.projectId) return true
    const result = createProjectArchive(state.projectId, '商品中心')
    state.notice = result.message
    if (result.ok && result.archive) {
      appStore.navigate(`/pcs/projects/${encodeURIComponent(state.projectId)}/archive`)
    }
    return true
  }

  if (action === 'go-project-archive') {
    if (state.projectId) {
      appStore.navigate(`/pcs/projects/${encodeURIComponent(state.projectId)}/archive`)
    }
    return true
  }

  return false
}

export function isPcsProjectWorkItemDetailDialogOpen(): boolean {
  return false
}
