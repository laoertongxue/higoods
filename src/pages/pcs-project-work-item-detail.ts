import { appStore } from '../state/store'
import type { ProjectDetailData, WorkItem, WorkItemStatus } from './pcs-project-detail'
import { getPcsProjectDetailSnapshot } from './pcs-project-detail'
import { escapeHtml, toClassName } from '../utils'
import { renderFormDialog } from '../components/ui/dialog'

type DetailTab = 'full-info' | 'records' | 'attachments' | 'audit'
type DecisionValue = '' | 'pass' | 'revision' | 'reject'

interface FullField {
  k: string
  v: string
}

interface FullSection {
  title: string
  fields?: FullField[]
  type?: 'table'
  columns?: string[]
  rows?: string[][]
}

interface RecordItem {
  id: string
  cols: Record<string, string>
  time: string
}

interface AttachmentItem {
  name: string
  type: 'file'
  time: string
}

interface LinkItem {
  name: string
  url: string
}

interface AuditItem {
  time: string
  action: string
  by: string
  note: string
}

interface WorkItemFullData {
  sections: FullSection[]
  records: RecordItem[]
  attachments: AttachmentItem[]
  links: LinkItem[]
  audit: AuditItem[]
}

type WorkItemWithFull = WorkItem & { full: WorkItemFullData }

interface WorkItemDetailState {
  projectId: string | null
  workItemId: string | null
  projectData: ProjectDetailData | null
  workItem: WorkItemWithFull | null
  activeTab: DetailTab
  showDecisionDialog: boolean
  showRecordDialog: boolean
  decisionValue: DecisionValue
  decisionNote: string
  recordNote: string
  notice: string | null
}

const FULL_DATA_SEED: Record<string, WorkItemFullData> = {
  wi_01: {
    sections: [
      {
        title: '立项信息',
        fields: [
          { k: '项目负责人', v: '张丽' },
          { k: '目标市场', v: '印尼' },
          { k: '目标渠道', v: 'TikTok / Shopee' },
          { k: '款式类型', v: '基础款' },
          { k: '目标价位带', v: 'IDR 149k-199k' },
          { k: '目标毛利要求', v: '≥ 45%' },
        ],
      },
      {
        title: '风险与假设',
        fields: [
          { k: '关键风险', v: '面料缩水导致版型偏差；腰线位置可能影响受众' },
          { k: '验证方式', v: '试穿反馈 + 直播测款退换/差评观察' },
          { k: '备选策略', v: '若退换偏高，进入反馈改版（腰线/面料克重）' },
        ],
      },
    ],
    records: [],
    attachments: [
      { name: '立项说明.pdf', type: 'file', time: '2025-12-15 09:45' },
      { name: '竞品对标.png', type: 'file', time: '2025-12-15 09:50' },
    ],
    links: [{ name: '竞品链接', url: 'https://example.com/comp_1' }],
    audit: [{ time: '2025-12-15 10:02', action: '标记完成', by: '张丽', note: '立项信息已补齐' }],
  },
  wi_02: {
    sections: [
      {
        title: '获取需求',
        fields: [
          { k: '获取方式', v: '深圳前置打版' },
          { k: '样衣目的', v: '用于试穿 + 测款' },
          { k: '尺码范围', v: 'S/M' },
          { k: '数量', v: '2 件' },
          { k: '交期要求', v: '≤ 2 天' },
        ],
      },
      {
        title: '供应与费用',
        fields: [
          { k: '打版方', v: '深圳版房 A' },
          { k: '费用', v: 'CNY 260' },
          { k: '物流方式', v: '顺丰' },
          { k: '运单号', v: 'SF123456' },
        ],
      },
    ],
    records: [
      {
        id: 'rec_wi02_1',
        cols: { 动作: '完成打版并发出', 结果: '已发货', 备注: '预计次日到样' },
        time: '2025-12-15 10:20',
      },
    ],
    attachments: [
      { name: '打版需求单.docx', type: 'file', time: '2025-12-15 09:55' },
      { name: '尺寸表.xlsx', type: 'file', time: '2025-12-15 09:56' },
      { name: '参考图.png', type: 'file', time: '2025-12-15 09:58' },
    ],
    links: [],
    audit: [{ time: '2025-12-15 10:35', action: '标记完成', by: '王明', note: '样衣已发出' }],
  },
  wi_09: {
    sections: [
      {
        title: '测款结果',
        fields: [
          { k: '测款目标', v: '验证兴趣与点击，筛选有效内容方向' },
          { k: '投放渠道', v: 'TikTok 短视频' },
          { k: '执行节奏', v: '按日连发，3 条素材并行' },
          { k: '当前结论', v: '继续放量并观察收藏加购' },
        ],
      },
      {
        title: '短视频实例表现',
        type: 'table',
        columns: ['实例编号', '主题', '曝光', '点击率', '收藏率', '发布时间'],
        rows: [
          ['SV-20251215-01', '穿搭场景测试', '52k', '4.1%', '2.7%', '2025-12-15 10:30'],
          ['SV-20251215-02', '面料与腰线卖点测试', '38k', '3.8%', '2.1%', '2025-12-15 11:20'],
          ['SV-20251215-03', '模特试穿反馈向', '36k', '3.7%', '2.3%', '2025-12-15 12:28'],
        ],
      },
    ],
    records: [
      {
        id: 'sv_01',
        cols: { 实例编号: 'SV-20251215-01', 结论: '表现稳定', 备注: '建议保留面料细节镜头' },
        time: '2025-12-15 10:30',
      },
      {
        id: 'sv_02',
        cols: { 实例编号: 'SV-20251215-02', 结论: '收藏率偏低', 备注: '文案需增强利益点' },
        time: '2025-12-15 11:20',
      },
    ],
    attachments: [
      { name: '短视频A.mp4', type: 'file', time: '2025-12-15 10:30' },
      { name: '短视频B.mp4', type: 'file', time: '2025-12-15 11:20' },
      { name: '短视频C.mp4', type: 'file', time: '2025-12-15 12:28' },
    ],
    links: [
      { name: '视频链接 A', url: 'https://example.com/video_a' },
      { name: '视频链接 B', url: 'https://example.com/video_b' },
      { name: '视频链接 C', url: 'https://example.com/video_c' },
    ],
    audit: [{ time: '2025-12-15 12:28', action: '新增记录', by: '短视频运营-小雅', note: '补充第 3 条数据' }],
  },
  wi_12: {
    sections: [
      {
        title: '决策信息',
        fields: [
          { k: '决策对象', v: '测款结论判定' },
          { k: '可选结论', v: '通过 / 改版 / 淘汰' },
          { k: '对下一步的影响', v: '决定后续工程准备工作项是否解锁' },
          { k: '当前建议', v: '通过后进入工程准备' },
        ],
      },
      {
        title: '决策依据摘录',
        type: 'table',
        columns: ['数据来源', '核心指标', '结果'],
        rows: [
          ['短视频测款', '累计曝光 126k，点击率 3.9%', '兴趣度有效'],
          ['直播测款', '平均转化 4.2%，退款率 1.8%', '转化可接受'],
          ['测款汇总', '维度完整，样本量达标', '可进入结论判定'],
        ],
      },
    ],
    records: [{ id: 'decision_pending_1', cols: { 提醒: '需在今日内完成结论判定', 责任人: '张丽' }, time: '2025-12-15 12:32' }],
    attachments: [],
    links: [],
    audit: [{ time: '2025-12-15 12:32', action: '进入待决策', by: '系统', note: '等待结论判定' }],
  },
}

const state: WorkItemDetailState = {
  projectId: null,
  workItemId: null,
  projectData: null,
  workItem: null,
  activeTab: 'full-info',
  showDecisionDialog: false,
  showRecordDialog: false,
  decisionValue: '',
  decisionNote: '',
  recordNote: '',
  notice: null,
}

function cloneFullData(data: WorkItemFullData): WorkItemFullData {
  return JSON.parse(JSON.stringify(data)) as WorkItemFullData
}

function nowText(): string {
  const now = new Date()
  const yyyy = now.getFullYear()
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const dd = String(now.getDate()).padStart(2, '0')
  const hh = String(now.getHours()).padStart(2, '0')
  const mi = String(now.getMinutes()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}`
}

function getStatusClass(status: WorkItemStatus): string {
  if (status === '已完成') return 'border-green-200 bg-green-50 text-green-700'
  if (status === '进行中') return 'border-blue-200 bg-blue-50 text-blue-700'
  if (status === '待决策') return 'border-orange-200 bg-orange-50 text-orange-700'
  if (status === '未解锁') return 'border-slate-200 bg-slate-100 text-slate-500'
  return 'border-slate-200 bg-slate-50 text-slate-700'
}

function renderBadge(label: string, className: string): string {
  return `<span class="inline-flex items-center rounded-md border px-2 py-0.5 text-xs ${className}">${escapeHtml(label)}</span>`
}

function createFallbackFullData(workItem: WorkItem): WorkItemFullData {
  return {
    sections: [
      {
        title: '工作项信息',
        fields: [
          { k: '工作项名称', v: workItem.name },
          { k: '工作项性质', v: workItem.nature },
          { k: '当前状态', v: workItem.status },
          { k: '负责人', v: workItem.owner },
          { k: '更新时间', v: workItem.updatedAt },
        ],
      },
      {
        title: '关键产出',
        fields: workItem.summary.keyOutputs.map((item) => ({ k: item.label, v: item.value })),
      },
    ],
    records: workItem.summary.latestRecords.map((item, index) => ({
      id: `${workItem.id}-record-${index + 1}`,
      cols: { 标题: item.title, 概况: item.meta },
      time: item.time,
    })),
    attachments: [],
    links: [],
    audit: [{ time: workItem.updatedAt, action: '状态同步', by: workItem.owner, note: '当前为原型演示数据' }],
  }
}

function buildWorkItemWithFull(projectId: string, workItemId: string): {
  projectData: ProjectDetailData | null
  workItem: WorkItemWithFull | null
} {
  const projectData = getPcsProjectDetailSnapshot(projectId)
  if (!projectData) return { projectData: null, workItem: null }

  const base = projectData.workItems[workItemId]
  if (!base) return { projectData, workItem: null }

  const full = cloneFullData(FULL_DATA_SEED[workItemId] ?? createFallbackFullData(base))
  return {
    projectData,
    workItem: {
      ...base,
      full,
    },
  }
}

function ensureState(projectId: string, workItemId: string): void {
  if (state.projectId === projectId && state.workItemId === workItemId && state.workItem && state.projectData) {
    return
  }

  const { projectData, workItem } = buildWorkItemWithFull(projectId, workItemId)
  state.projectId = projectId
  state.workItemId = workItemId
  state.projectData = projectData
  state.workItem = workItem
  state.activeTab = 'full-info'
  state.showDecisionDialog = false
  state.showRecordDialog = false
  state.decisionValue = ''
  state.decisionNote = ''
  state.recordNote = ''
  state.notice = null
}

function renderNotFound(projectId: string, workItemId: string): string {
  return `
    <section class="rounded-lg border bg-card p-8 text-center">
      <i data-lucide="alert-circle" class="mx-auto h-10 w-10 text-muted-foreground/60"></i>
      <h1 class="mt-3 text-lg font-semibold">工作项未找到</h1>
      <p class="mt-1 text-sm text-muted-foreground">项目 ID：${escapeHtml(projectId)}，工作项 ID：${escapeHtml(workItemId)}</p>
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

function renderSectionFields(fields: FullField[]): string {
  return `
    <div class="grid gap-x-8 gap-y-4 sm:grid-cols-2">
      ${fields
        .map(
          (field) => `
            <article class="space-y-1">
              <p class="text-sm text-muted-foreground">${escapeHtml(field.k)}</p>
              <p class="text-sm font-medium">${escapeHtml(field.v)}</p>
            </article>
          `,
        )
        .join('')}
    </div>
  `
}

function renderSectionTable(section: FullSection): string {
  if (!section.columns || !section.rows) return ''
  return `
    <div class="overflow-x-auto rounded-lg border">
      <table class="min-w-full text-left text-sm">
        <thead class="bg-muted/40 text-muted-foreground">
          <tr>
            ${section.columns.map((column) => `<th class="px-3 py-2 font-medium">${escapeHtml(column)}</th>`).join('')}
          </tr>
        </thead>
        <tbody>
          ${section.rows
            .map(
              (row) => `
                <tr class="border-t">
                  ${row.map((value) => `<td class="px-3 py-2">${escapeHtml(value)}</td>`).join('')}
                </tr>
              `,
            )
            .join('')}
        </tbody>
      </table>
    </div>
  `
}

function renderFullInfo(workItem: WorkItemWithFull): string {
  if (workItem.status === '未解锁') {
    return `
      <section class="rounded-lg border bg-muted/40 p-6">
        <p class="inline-flex items-center gap-2 text-sm text-muted-foreground"><i data-lucide="lock" class="h-4 w-4"></i>等待测款结论判定通过后解锁</p>
      </section>
    `
  }

  return workItem.full.sections
    .map(
      (section) => `
        <section class="rounded-lg border bg-card p-5">
          <h3 class="mb-4 text-base font-semibold">${escapeHtml(section.title)}</h3>
          ${section.fields ? renderSectionFields(section.fields) : ''}
          ${section.type === 'table' ? renderSectionTable(section) : ''}
        </section>
      `,
    )
    .join('')
}

function renderRecords(workItem: WorkItemWithFull): string {
  const records = workItem.full.records
  if (!records.length) {
    return `
      <section class="rounded-lg border bg-card p-6 text-center text-sm text-muted-foreground">暂无记录</section>
    `
  }

  const columns = Object.keys(records[0].cols)

  return `
    <section class="rounded-lg border bg-card p-5">
      <div class="mb-3 flex items-center justify-between">
        <h3 class="text-base font-semibold">执行记录</h3>
        ${
          workItem.status === '进行中' && workItem.isMultiInstance
            ? '<button class="inline-flex h-8 items-center rounded-md border px-3 text-xs hover:bg-muted" data-pcs-work-item-action="open-record-dialog"><i data-lucide="plus" class="mr-1 h-3.5 w-3.5"></i>新增记录</button>'
            : ''
        }
      </div>
      <div class="overflow-x-auto rounded-lg border">
        <table class="min-w-full text-left text-sm">
          <thead class="bg-muted/40 text-muted-foreground">
            <tr>
              ${columns.map((column) => `<th class="px-3 py-2 font-medium">${escapeHtml(column)}</th>`).join('')}
              <th class="px-3 py-2 font-medium">时间</th>
            </tr>
          </thead>
          <tbody>
            ${records
              .map(
                (record) => `
                  <tr class="border-t">
                    ${columns.map((column) => `<td class="px-3 py-2">${escapeHtml(record.cols[column] ?? '-')}</td>`).join('')}
                    <td class="px-3 py-2 text-muted-foreground">${escapeHtml(record.time)}</td>
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

function renderAttachments(workItem: WorkItemWithFull): string {
  const attachmentCount = workItem.full.attachments.length
  const linkCount = workItem.full.links.length

  return `
    <section class="space-y-4 rounded-lg border bg-card p-5">
      <div class="grid gap-4 md:grid-cols-2">
        <article class="rounded-lg border p-4">
          <h3 class="mb-3 text-base font-semibold">附件（${attachmentCount}）</h3>
          ${
            attachmentCount
              ? `<div class="space-y-2">
                  ${workItem.full.attachments
                    .map(
                      (attachment) => `
                        <div class="flex items-center justify-between rounded-md border bg-muted/20 px-3 py-2">
                          <div>
                            <p class="text-sm font-medium">${escapeHtml(attachment.name)}</p>
                            <p class="text-xs text-muted-foreground">${escapeHtml(attachment.time)}</p>
                          </div>
                          <button class="inline-flex h-7 items-center rounded-md border px-2 text-xs hover:bg-muted" data-pcs-work-item-action="download-attachment" data-file-name="${escapeHtml(attachment.name)}">
                            <i data-lucide="download" class="mr-1 h-3.5 w-3.5"></i>下载
                          </button>
                        </div>
                      `,
                    )
                    .join('')}
                </div>`
              : '<p class="text-sm text-muted-foreground">暂无附件</p>'
          }
        </article>

        <article class="rounded-lg border p-4">
          <h3 class="mb-3 text-base font-semibold">引用链接（${linkCount}）</h3>
          ${
            linkCount
              ? `<div class="space-y-2">
                  ${workItem.full.links
                    .map(
                      (link) => `
                        <div class="flex items-center justify-between rounded-md border bg-muted/20 px-3 py-2">
                          <p class="text-sm font-medium">${escapeHtml(link.name)}</p>
                          <button class="inline-flex h-7 items-center rounded-md border px-2 text-xs hover:bg-muted" data-pcs-work-item-action="open-link" data-link-name="${escapeHtml(link.name)}" data-link-url="${escapeHtml(link.url)}">
                            <i data-lucide="external-link" class="mr-1 h-3.5 w-3.5"></i>查看
                          </button>
                        </div>
                      `,
                    )
                    .join('')}
                </div>`
              : '<p class="text-sm text-muted-foreground">暂无引用链接</p>'
          }
        </article>
      </div>
    </section>
  `
}

function renderAudit(workItem: WorkItemWithFull): string {
  if (!workItem.full.audit.length) {
    return '<section class="rounded-lg border bg-card p-6 text-center text-sm text-muted-foreground">暂无操作日志</section>'
  }

  return `
    <section class="rounded-lg border bg-card p-5">
      <h3 class="mb-3 text-base font-semibold">操作日志</h3>
      <div class="space-y-3">
        ${workItem.full.audit
          .map(
            (log) => `
              <article class="relative border-l pl-4">
                <span class="absolute -left-[5px] top-1 h-2 w-2 rounded-full bg-blue-500"></span>
                <p class="text-xs text-muted-foreground">${escapeHtml(log.time)}</p>
                <p class="text-sm font-medium">${escapeHtml(log.action)} · ${escapeHtml(log.by)}</p>
                <p class="text-xs text-muted-foreground">${escapeHtml(log.note)}</p>
              </article>
            `,
          )
          .join('')}
      </div>
    </section>
  `
}

function renderTabs(workItem: WorkItemWithFull): string {
  const tabClass = (tab: DetailTab) =>
    toClassName(
      'inline-flex h-9 items-center rounded-md px-3 text-sm',
      state.activeTab === tab ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'border hover:bg-muted',
    )

  const attachmentsCount = workItem.full.attachments.length + workItem.full.links.length

  return `
    <section class="space-y-4">
      <div class="flex flex-wrap items-center gap-2">
        <button class="${tabClass('full-info')}" data-pcs-work-item-action="set-tab" data-tab="full-info">全量信息</button>
        <button class="${tabClass('records')}" data-pcs-work-item-action="set-tab" data-tab="records">记录${workItem.full.records.length ? `（${workItem.full.records.length}）` : ''}</button>
        <button class="${tabClass('attachments')}" data-pcs-work-item-action="set-tab" data-tab="attachments">附件与引用${attachmentsCount ? `（${attachmentsCount}）` : ''}</button>
        <button class="${tabClass('audit')}" data-pcs-work-item-action="set-tab" data-tab="audit">操作日志${workItem.full.audit.length ? `（${workItem.full.audit.length}）` : ''}</button>
      </div>

      ${
        state.activeTab === 'full-info'
          ? renderFullInfo(workItem)
          : state.activeTab === 'records'
            ? renderRecords(workItem)
            : state.activeTab === 'attachments'
              ? renderAttachments(workItem)
              : renderAudit(workItem)
      }
    </section>
  `
}

function renderDecisionDialog(): string {
  if (!state.showDecisionDialog) return ''
  return `
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4" data-dialog-backdrop="true">
      <section class="w-full max-w-xl rounded-lg border bg-background shadow-2xl">
        <header class="border-b px-4 py-3">
          <h3 class="text-base font-semibold">测款结论判定</h3>
          <p class="mt-1 text-xs text-muted-foreground">请根据当前数据做出决策，结果将影响后续工作项状态。</p>
        </header>
        <div class="space-y-3 p-4">
          <button class="${toClassName('w-full rounded-lg border p-3 text-left hover:bg-muted/40', state.decisionValue === 'pass' && 'border-blue-300 bg-blue-50')}" data-pcs-work-item-action="set-decision" data-decision-value="pass">
            <p class="font-medium">通过</p>
            <p class="text-xs text-muted-foreground">解锁工程准备（转档、制版、打样）</p>
          </button>
          <button class="${toClassName('w-full rounded-lg border p-3 text-left hover:bg-muted/40', state.decisionValue === 'revision' && 'border-blue-300 bg-blue-50')}" data-pcs-work-item-action="set-decision" data-decision-value="revision">
            <p class="font-medium">改版</p>
            <p class="text-xs text-muted-foreground">回流改版任务，改版后重新测款</p>
          </button>
          <button class="${toClassName('w-full rounded-lg border p-3 text-left hover:bg-muted/40', state.decisionValue === 'reject' && 'border-blue-300 bg-blue-50')}" data-pcs-work-item-action="set-decision" data-decision-value="reject">
            <p class="font-medium">淘汰</p>
            <p class="text-xs text-muted-foreground">终止项目，样衣进入退货处理</p>
          </button>
          <div>
            <label class="mb-1 block text-xs text-muted-foreground">决策备注</label>
            <textarea class="min-h-[90px] w-full rounded-md border bg-background px-3 py-2 text-sm" placeholder="请输入决策说明..." data-pcs-work-item-field="decisionNote">${escapeHtml(state.decisionNote)}</textarea>
          </div>
        </div>
        <footer class="flex items-center justify-end gap-2 border-t px-4 py-3">
          <button class="inline-flex h-9 items-center rounded-md border px-3 text-sm hover:bg-muted" data-pcs-work-item-action="close-decision-dialog">取消</button>
          <button class="inline-flex h-9 items-center rounded-md border border-blue-300 px-3 text-sm text-blue-700 hover:bg-blue-50 ${state.decisionValue ? '' : 'cursor-not-allowed opacity-60'}" data-pcs-work-item-action="submit-decision" ${state.decisionValue ? '' : 'disabled'}>提交决策</button>
        </footer>
      </section>
    </div>
  `
}

function renderRecordDialog(): string {
  if (!state.showRecordDialog) return ''

  const formContent = `
    <div>
      <label class="mb-1 block text-xs text-muted-foreground">记录说明</label>
      <textarea class="min-h-[110px] w-full rounded-md border bg-background px-3 py-2 text-sm" placeholder="请输入记录内容..." data-pcs-work-item-field="recordNote">${escapeHtml(state.recordNote)}</textarea>
    </div>
    <p class="text-xs text-muted-foreground">当前为原型演示态，新增记录将仅写入本地页面状态。</p>
  `

  return renderFormDialog(
    {
      title: '新增记录',
      closeAction: { prefix: 'pcs-work-item', action: 'close-record-dialog' },
      submitAction: { prefix: 'pcs-work-item', action: 'submit-record', label: '保存记录' },
      width: 'md',
    },
    formContent
  )
}

export function renderPcsProjectWorkItemDetailPage(projectId: string, workItemId: string): string {
  ensureState(projectId, workItemId)

  const data = state.projectData
  const workItem = state.workItem
  if (!data || !workItem) {
    return renderNotFound(projectId, workItemId)
  }

  return `
    <div class="space-y-4">
      <section class="rounded-lg border bg-card p-5">
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div class="space-y-2">
            <div class="flex items-center gap-2 text-sm text-muted-foreground">
              <button class="inline-flex items-center hover:underline" data-pcs-work-item-action="back-project">${escapeHtml(data.project.code)}</button>
              <i data-lucide="chevron-right" class="h-4 w-4"></i>
              <span>${escapeHtml(data.project.name)}</span>
            </div>
            <div class="flex flex-wrap items-center gap-2">
              <h1 class="text-xl font-semibold">${escapeHtml(workItem.name)}</h1>
              ${renderBadge(workItem.nature, 'border-slate-200 bg-slate-50 text-slate-700')}
              ${renderBadge(workItem.status, getStatusClass(workItem.status))}
            </div>
            <p class="text-sm text-muted-foreground">负责人：${escapeHtml(workItem.owner)} · 更新时间：${escapeHtml(workItem.updatedAt)}</p>
          </div>

          <div class="flex items-center gap-2">
            <button class="inline-flex h-8 items-center rounded-md border px-3 text-xs hover:bg-muted" data-pcs-work-item-action="back-project">
              <i data-lucide="arrow-left" class="mr-1 h-3.5 w-3.5"></i>返回项目
            </button>
            ${
              workItem.status === '待决策'
                ? '<button class="inline-flex h-8 items-center rounded-md border border-orange-300 px-3 text-xs text-orange-700 hover:bg-orange-50" data-pcs-work-item-action="open-decision-dialog"><i data-lucide="alert-circle" class="mr-1 h-3.5 w-3.5"></i>做出决策</button>'
                : ''
            }
            ${
              workItem.status === '进行中' && workItem.isMultiInstance
                ? '<button class="inline-flex h-8 items-center rounded-md border px-3 text-xs hover:bg-muted" data-pcs-work-item-action="open-record-dialog"><i data-lucide="plus" class="mr-1 h-3.5 w-3.5"></i>新增记录</button>'
                : ''
            }
            ${
              workItem.status === '进行中'
                ? '<button class="inline-flex h-8 items-center rounded-md border border-green-300 px-3 text-xs text-green-700 hover:bg-green-50" data-pcs-work-item-action="mark-complete"><i data-lucide="check-circle-2" class="mr-1 h-3.5 w-3.5"></i>标记完成</button>'
                : ''
            }
            ${
              workItem.status === '未解锁'
                ? '<button class="inline-flex h-8 items-center rounded-md border px-3 text-xs text-muted-foreground" disabled><i data-lucide="lock" class="mr-1 h-3.5 w-3.5"></i>等待解锁</button>'
                : ''
            }
          </div>
        </div>
      </section>

      ${renderNotice()}
      ${renderTabs(workItem)}
      ${renderDecisionDialog()}
      ${renderRecordDialog()}
    </div>
  `
}

function closeDialogs(): void {
  if (state.showDecisionDialog) {
    state.showDecisionDialog = false
    return
  }
  if (state.showRecordDialog) {
    state.showRecordDialog = false
  }
}

function submitDecision(): void {
  if (!state.projectId || !state.workItem || !state.decisionValue) return

  const statusByDecision: Record<Exclude<DecisionValue, ''>, WorkItemStatus> = {
    pass: '已完成',
    revision: '进行中',
    reject: '已完成',
  }

  state.workItem.status = statusByDecision[state.decisionValue]
  state.workItem.updatedAt = nowText()

  state.workItem.full.audit.unshift({
    time: nowText(),
    action: '提交决策',
    by: state.workItem.owner,
    note: `${state.decisionValue === 'pass' ? '通过' : state.decisionValue === 'revision' ? '改版' : '淘汰'}；${state.decisionNote.trim() || '无备注'}`,
  })

  state.showDecisionDialog = false
  state.decisionValue = ''
  state.decisionNote = ''
  appStore.navigate(`/pcs/projects/${state.projectId}`)
}

function submitRecord(): void {
  if (!state.workItem) return

  state.workItem.full.records.unshift({
    id: `${state.workItem.id}-new-${Date.now()}`,
    cols: {
      标题: '新增记录',
      内容: state.recordNote.trim() || '无补充说明',
    },
    time: nowText(),
  })

  state.workItem.full.audit.unshift({
    time: nowText(),
    action: '新增记录',
    by: state.workItem.owner,
    note: state.recordNote.trim() || '新增记录（演示态）',
  })

  state.recordNote = ''
  state.showRecordDialog = false
  state.notice = '记录已新增（演示态）。'
}

export function handlePcsProjectWorkItemDetailEvent(target: HTMLElement): boolean {
  const fieldNode = target.closest<HTMLElement>('[data-pcs-work-item-field]')
  if (fieldNode instanceof HTMLTextAreaElement) {
    const field = fieldNode.dataset.pcsWorkItemField
    if (field === 'decisionNote') {
      state.decisionNote = fieldNode.value
      return true
    }
    if (field === 'recordNote') {
      state.recordNote = fieldNode.value
      return true
    }
  }

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

  if (action === 'open-decision-dialog') {
    state.showDecisionDialog = true
    return true
  }

  if (action === 'close-decision-dialog') {
    state.showDecisionDialog = false
    return true
  }

  if (action === 'set-decision') {
    const value = actionNode.dataset.decisionValue as DecisionValue | undefined
    if (value) state.decisionValue = value
    return true
  }

  if (action === 'submit-decision') {
    submitDecision()
    return true
  }

  if (action === 'open-record-dialog') {
    state.showRecordDialog = true
    return true
  }

  if (action === 'close-record-dialog') {
    state.showRecordDialog = false
    return true
  }

  if (action === 'submit-record') {
    submitRecord()
    return true
  }

  if (action === 'mark-complete') {
    if (state.workItem) {
      state.workItem.status = '已完成'
      state.workItem.updatedAt = nowText()
      state.workItem.full.audit.unshift({
        time: nowText(),
        action: '标记完成',
        by: state.workItem.owner,
        note: '工作项已标记完成（演示态）',
      })
      state.notice = `工作项 ${state.workItem.name} 已标记完成。`
    }
    return true
  }

  if (action === 'download-attachment') {
    const fileName = actionNode.dataset.fileName
    state.notice = fileName ? `已触发附件下载：${fileName}（演示态）` : '已触发附件下载（演示态）'
    return true
  }

  if (action === 'open-link') {
    const linkName = actionNode.dataset.linkName
    state.notice = linkName ? `已打开链接：${linkName}（演示态）` : '已打开链接（演示态）'
    return true
  }

  if (action === 'close-notice') {
    state.notice = null
    return true
  }

  if (action === 'close-dialog') {
    closeDialogs()
    return true
  }

  return false
}

export function isPcsProjectWorkItemDetailDialogOpen(): boolean {
  return state.showDecisionDialog || state.showRecordDialog
}
