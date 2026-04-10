import { renderDetailDrawer as uiDetailDrawer, renderDrawer as uiDrawer } from '../components/ui/index.ts'
import { listProjects } from '../data/pcs-project-repository.ts'
import {
  createFirstSampleTaskWithProjectRelation,
  saveFirstSampleTaskDraft,
  type FirstSampleTaskCreateInput,
} from '../data/pcs-task-project-relation-writeback.ts'
import {
  getFirstSampleTaskById,
  listFirstSampleTasks,
  updateFirstSampleTask,
} from '../data/pcs-first-sample-repository.ts'
import { recordSampleLedgerEvent } from '../data/pcs-sample-project-writeback.ts'
import type { FirstSampleTaskRecord } from '../data/pcs-first-sample-types.ts'
import { FIRST_SAMPLE_SOURCE_TYPE_LIST } from '../data/pcs-task-source-normalizer.ts'
import { escapeHtml } from '../utils.ts'

interface FirstSamplePageState {
  keyword: string
  statusFilter: string
  selectedTaskId: string | null
  detailOpen: boolean
  createOpen: boolean
  notice: string | null
  createForm: {
    projectId: string
    sourceType: string
    upstreamObjectCode: string
    upstreamObjectId: string
    targetSite: string
    factoryName: string
    ownerName: string
    priorityLevel: '高' | '中' | '低'
    expectedArrival: string
  }
}

function nowText(): string {
  const now = new Date()
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`
}

function createDefaultForm() {
  return {
    projectId: '',
    sourceType: '人工创建',
    upstreamObjectCode: '',
    upstreamObjectId: '',
    targetSite: '深圳',
    factoryName: '深圳工厂01',
    ownerName: '',
    priorityLevel: '中' as const,
    expectedArrival: '',
  }
}

let state: FirstSamplePageState = {
  keyword: '',
  statusFilter: 'all',
  selectedTaskId: null,
  detailOpen: false,
  createOpen: false,
  notice: null,
  createForm: createDefaultForm(),
}

function getTasks(): FirstSampleTaskRecord[] {
  return listFirstSampleTasks().filter((item) => {
    if (state.keyword) {
      const keyword = state.keyword.toLowerCase()
      if (
        ![
          item.firstSampleTaskCode,
          item.projectCode,
          item.projectName,
          item.sampleCode,
          item.title,
          item.factoryName,
        ].some((text) => text.toLowerCase().includes(keyword))
      ) {
        return false
      }
    }
    if (state.statusFilter !== 'all' && item.status !== state.statusFilter) return false
    return true
  })
}

function getSelectedTask(): FirstSampleTaskRecord | null {
  if (!state.selectedTaskId) return null
  return getFirstSampleTaskById(state.selectedTaskId)
}

function getSampleName(task: FirstSampleTaskRecord): string {
  return `${task.projectName}-首版样衣`
}

function updateTask(taskId: string, patch: Partial<FirstSampleTaskRecord>) {
  updateFirstSampleTask(taskId, patch)
}

function writeFirstSampleEvent(task: FirstSampleTaskRecord, eventType: 'SHIP_OUT' | 'RECEIVE_ARRIVAL' | 'CHECKIN_VERIFY') {
  recordSampleLedgerEvent({
    ledgerEventId: `${task.firstSampleTaskId}::${eventType}`,
    eventType,
    sampleCode: task.sampleCode,
    sampleName: getSampleName(task),
    sampleType: '首版样衣',
    responsibleSite: task.targetSite,
    sourcePage: '首版样衣打样',
    sourceModule: '首版样衣打样',
    sourceDocType: '首版样衣打样任务',
    sourceDocId: task.firstSampleTaskId,
    sourceDocCode: task.firstSampleTaskCode,
    projectId: task.projectId,
    projectCode: task.projectCode,
    projectName: task.projectName,
    projectNodeId: task.projectNodeId,
    workItemTypeCode: task.workItemTypeCode,
    workItemTypeName: task.workItemTypeName,
    operatorName: '当前用户',
    businessDate: nowText(),
    locationDisplay: eventType === 'SHIP_OUT' ? `${task.factoryName} → ${task.targetSite}` : `${task.targetSite}样衣区`,
    locationType: eventType === 'SHIP_OUT' ? '在途' : '仓库',
    locationCode: eventType === 'SHIP_OUT' ? 'TRANSIT' : `${task.targetSite}-SAMPLE`,
    custodianType: eventType === 'SHIP_OUT' ? '系统' : '仓管',
    custodianName: eventType === 'SHIP_OUT' ? '物流在途' : `${task.targetSite}仓管`,
  })
}

export function shipFirstOrderSampleTask(taskId: string): boolean {
  const task = getFirstSampleTaskById(taskId)
  if (!task || task.status !== '待发样') return false
  writeFirstSampleEvent(task, 'SHIP_OUT')
  updateTask(taskId, { status: '在途', trackingNo: task.trackingNo || `FS-TRACK-${task.firstSampleTaskCode}`, updatedAt: nowText(), updatedBy: '当前用户' })
  state.notice = `已为 ${task.firstSampleTaskCode} 记录发样事件，并同步回写样衣台账。`
  return true
}

export function receiveFirstOrderSampleTask(taskId: string): boolean {
  const task = getFirstSampleTaskById(taskId)
  if (!task || !['在途', '待发样'].includes(task.status)) return false
  writeFirstSampleEvent(task, 'RECEIVE_ARRIVAL')
  updateTask(taskId, { status: '已到样待入库', updatedAt: nowText(), updatedBy: '当前用户' })
  state.notice = `已为 ${task.firstSampleTaskCode} 记录到样事件，并同步回写项目节点。`
  return true
}

export function stockInFirstOrderSampleTask(taskId: string): boolean {
  const task = getFirstSampleTaskById(taskId)
  if (!task || task.status !== '已到样待入库') return false
  writeFirstSampleEvent(task, 'CHECKIN_VERIFY')
  updateTask(taskId, { status: '验收中', updatedAt: nowText(), updatedBy: '当前用户' })
  state.notice = `已为 ${task.firstSampleTaskCode} 记录入库事件，并同步生成样衣资产关系。`
  return true
}

function renderNotice(): string {
  if (!state.notice) return ''
  return `<div class="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">${escapeHtml(state.notice)}</div>`
}

function renderCreateDrawer(): string {
  if (!state.createOpen) return ''
  const projects = listProjects()
  return uiDrawer(
    {
      title: '新建首版样衣打样',
      subtitle: '正式创建后会写入任务记录、项目关系，并回写商品项目节点。',
      closeAction: { prefix: 'first-sample', action: 'close-create' },
      width: 'md',
    },
    `
      <div class="space-y-4">
        <div>
          <label class="mb-1 block text-sm font-medium">项目 <span class="text-red-500">*</span></label>
          <select class="h-9 w-full rounded-md border bg-background px-3 text-sm" data-first-sample-field="project">
            <option value="">请选择项目</option>
            ${projects.map((item) => `<option value="${item.projectId}" ${state.createForm.projectId === item.projectId ? 'selected' : ''}>${escapeHtml(`${item.projectCode} · ${item.projectName}`)}</option>`).join('')}
          </select>
        </div>
        <div class="grid gap-4 md:grid-cols-2">
          <div>
            <label class="mb-1 block text-sm font-medium">来源类型</label>
            <select class="h-9 w-full rounded-md border bg-background px-3 text-sm" data-first-sample-field="sourceType">
              ${FIRST_SAMPLE_SOURCE_TYPE_LIST.map((item) => `<option value="${item}" ${state.createForm.sourceType === item ? 'selected' : ''}>${item}</option>`).join('')}
            </select>
          </div>
          <div>
            <label class="mb-1 block text-sm font-medium">优先级</label>
            <select class="h-9 w-full rounded-md border bg-background px-3 text-sm" data-first-sample-field="priorityLevel">
              ${['高', '中', '低'].map((item) => `<option value="${item}" ${state.createForm.priorityLevel === item ? 'selected' : ''}>${item}</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="grid gap-4 md:grid-cols-2">
          <div>
            <label class="mb-1 block text-sm font-medium">目标站点</label>
            <select class="h-9 w-full rounded-md border bg-background px-3 text-sm" data-first-sample-field="site">
              <option value="深圳" ${state.createForm.targetSite === '深圳' ? 'selected' : ''}>深圳</option>
              <option value="雅加达" ${state.createForm.targetSite === '雅加达' ? 'selected' : ''}>雅加达</option>
            </select>
          </div>
          <div>
            <label class="mb-1 block text-sm font-medium">工厂</label>
            <input class="h-9 w-full rounded-md border px-3 text-sm" value="${escapeHtml(state.createForm.factoryName)}" data-first-sample-field="factoryName" />
          </div>
        </div>
        <div class="grid gap-4 md:grid-cols-2">
          <div>
            <label class="mb-1 block text-sm font-medium">负责人</label>
            <input class="h-9 w-full rounded-md border px-3 text-sm" value="${escapeHtml(state.createForm.ownerName)}" data-first-sample-field="ownerName" />
          </div>
          <div>
            <label class="mb-1 block text-sm font-medium">预计到样时间</label>
            <input class="h-9 w-full rounded-md border px-3 text-sm" type="datetime-local" value="${escapeHtml(state.createForm.expectedArrival)}" data-first-sample-field="expectedArrival" />
          </div>
        </div>
        ${state.createForm.sourceType === '人工创建' ? '' : `
          <div class="grid gap-4 md:grid-cols-2">
            <div>
              <label class="mb-1 block text-sm font-medium">上游对象编号 <span class="text-red-500">*</span></label>
              <input class="h-9 w-full rounded-md border px-3 text-sm" value="${escapeHtml(state.createForm.upstreamObjectCode)}" data-first-sample-field="upstreamObjectCode" placeholder="请输入正式上游编号" />
            </div>
            <div>
              <label class="mb-1 block text-sm font-medium">上游对象主键</label>
              <input class="h-9 w-full rounded-md border px-3 text-sm" value="${escapeHtml(state.createForm.upstreamObjectId)}" data-first-sample-field="upstreamObjectId" placeholder="可选，用于精确追溯" />
            </div>
          </div>
        `}
      </div>
    `,
    {
      cancel: { prefix: 'first-sample', action: 'close-create', label: '取消' },
      extraActions: [
        { prefix: 'first-sample', action: 'save-draft', label: '保存草稿', variant: 'secondary' },
      ],
      confirm: { prefix: 'first-sample', action: 'submit-create', label: '创建并开始', variant: 'primary' },
    },
  )
}

function renderDetailDrawer(): string {
  const task = getSelectedTask()
  if (!state.detailOpen || !task) return ''
  const actions = []
  if (task.status === '待发样') actions.push(`<button class="inline-flex h-8 items-center rounded-md bg-primary px-3 text-xs text-primary-foreground" data-first-sample-action="ship-task">发样</button>`)
  if (task.status === '在途') actions.push(`<button class="inline-flex h-8 items-center rounded-md bg-primary px-3 text-xs text-primary-foreground" data-first-sample-action="receive-task">到样签收</button>`)
  if (task.status === '已到样待入库') actions.push(`<button class="inline-flex h-8 items-center rounded-md bg-primary px-3 text-xs text-primary-foreground" data-first-sample-action="stockin-task">核对入库</button>`)
  return uiDetailDrawer(
    {
      title: '首版样衣打样详情',
      subtitle: task.firstSampleTaskCode,
      closeAction: { prefix: 'first-sample', action: 'close-detail' },
      width: 'md',
    },
    `
      <div class="grid gap-3 text-sm md:grid-cols-2">
        <div class="rounded-lg border bg-muted/20 p-3"><div class="text-xs text-muted-foreground">任务标题</div><div class="mt-1 font-medium">${escapeHtml(task.title)}</div></div>
        <div class="rounded-lg border bg-muted/20 p-3"><div class="text-xs text-muted-foreground">当前状态</div><div class="mt-1 font-medium">${escapeHtml(task.status)}</div></div>
        <div class="rounded-lg border bg-muted/20 p-3"><div class="text-xs text-muted-foreground">项目</div><div class="mt-1 font-medium">${escapeHtml(`${task.projectCode} · ${task.projectName}`)}</div></div>
        <div class="rounded-lg border bg-muted/20 p-3"><div class="text-xs text-muted-foreground">来源类型</div><div class="mt-1 font-medium">${escapeHtml(task.sourceType)}</div></div>
        <div class="rounded-lg border bg-muted/20 p-3"><div class="text-xs text-muted-foreground">上游对象编号</div><div class="mt-1 font-medium">${escapeHtml(task.upstreamObjectCode || '—')}</div></div>
        <div class="rounded-lg border bg-muted/20 p-3"><div class="text-xs text-muted-foreground">样衣编号</div><div class="mt-1 font-medium">${escapeHtml(task.sampleCode)}</div></div>
        <div class="rounded-lg border bg-muted/20 p-3"><div class="text-xs text-muted-foreground">工厂</div><div class="mt-1 font-medium">${escapeHtml(task.factoryName || '—')}</div></div>
        <div class="rounded-lg border bg-muted/20 p-3"><div class="text-xs text-muted-foreground">目标站点</div><div class="mt-1 font-medium">${escapeHtml(task.targetSite || '—')}</div></div>
        <div class="rounded-lg border bg-muted/20 p-3"><div class="text-xs text-muted-foreground">预计到样</div><div class="mt-1 font-medium">${escapeHtml(task.expectedArrival || '—')}</div></div>
        <div class="rounded-lg border bg-muted/20 p-3"><div class="text-xs text-muted-foreground">跟踪号</div><div class="mt-1 font-medium">${escapeHtml(task.trackingNo || '—')}</div></div>
        <div class="rounded-lg border bg-muted/20 p-3"><div class="text-xs text-muted-foreground">创建时间</div><div class="mt-1 font-medium">${escapeHtml(task.createdAt)}</div></div>
        <div class="rounded-lg border bg-muted/20 p-3"><div class="text-xs text-muted-foreground">最近更新时间</div><div class="mt-1 font-medium">${escapeHtml(task.updatedAt)}</div></div>
      </div>
    `,
    actions.join(''),
  )
}

function buildCreateInput(): FirstSampleTaskCreateInput {
  const project = listProjects().find((item) => item.projectId === state.createForm.projectId)
  const sourceObjectType =
    state.createForm.sourceType === '制版任务' ||
    state.createForm.sourceType === '花型任务' ||
    state.createForm.sourceType === '改版任务'
      ? state.createForm.sourceType
      : state.createForm.sourceType === '人工创建'
        ? ''
        : '首版样衣打样任务'
  return {
    projectId: state.createForm.projectId,
    title: `首版样衣打样-${project?.projectName || '待定项目'}`,
    sourceType: state.createForm.sourceType as FirstSampleTaskCreateInput['sourceType'],
    upstreamModule: state.createForm.sourceType === '人工创建' ? '' : state.createForm.sourceType,
    upstreamObjectType: sourceObjectType,
    upstreamObjectId: state.createForm.upstreamObjectId,
    upstreamObjectCode: state.createForm.upstreamObjectCode,
    targetSite: state.createForm.targetSite,
    factoryName: state.createForm.factoryName,
    ownerName: state.createForm.ownerName,
    priorityLevel: state.createForm.priorityLevel,
    expectedArrival: state.createForm.expectedArrival,
    operatorName: '当前用户',
  }
}

export function handleFirstOrderSampleEvent(target: Element): boolean {
  const actionNode = target.closest<HTMLElement>('[data-first-sample-action]')
  const action = actionNode?.dataset.firstSampleAction
  if (!action) return false

  if (action === 'open-create') {
    state.createOpen = true
    state.notice = null
    return true
  }
  if (action === 'close-create') {
    state.createOpen = false
    state.createForm = createDefaultForm()
    return true
  }
  if (action === 'open-detail') {
    const taskId = actionNode?.dataset.taskId
    if (taskId) {
      state.selectedTaskId = taskId
      state.detailOpen = true
    }
    return true
  }
  if (action === 'close-detail') {
    state.detailOpen = false
    return true
  }
  if (action === 'ship-task' && state.selectedTaskId) return shipFirstOrderSampleTask(state.selectedTaskId)
  if (action === 'receive-task' && state.selectedTaskId) return receiveFirstOrderSampleTask(state.selectedTaskId)
  if (action === 'stockin-task' && state.selectedTaskId) return stockInFirstOrderSampleTask(state.selectedTaskId)
  if (action === 'save-draft') {
    const draft = saveFirstSampleTaskDraft(buildCreateInput())
    state.notice = `已保存首版样衣打样草稿：${draft.firstSampleTaskCode}。草稿不会写入项目关系。`
    state.createOpen = false
    state.createForm = createDefaultForm()
    return true
  }
  if (action === 'submit-create') {
    const result = createFirstSampleTaskWithProjectRelation(buildCreateInput())
    state.notice = result.message
    if (result.ok) {
      state.createOpen = false
      state.createForm = createDefaultForm()
      state.selectedTaskId = result.task.firstSampleTaskId
    }
    return true
  }
  return false
}

export function handleFirstOrderSampleInput(target: Element): boolean {
  const field = (target as HTMLElement).dataset.firstSampleField
  if (!field) return false
  if (field === 'keyword') {
    state.keyword = (target as HTMLInputElement).value
    return true
  }
  if (field === 'status') {
    state.statusFilter = (target as HTMLSelectElement).value
    return true
  }
  if (field === 'project') {
    state.createForm.projectId = (target as HTMLSelectElement).value
    return true
  }
  if (field === 'sourceType') {
    state.createForm.sourceType = (target as HTMLSelectElement).value
    return true
  }
  if (field === 'site') {
    state.createForm.targetSite = (target as HTMLSelectElement).value
    if (!state.createForm.factoryName) {
      state.createForm.factoryName = state.createForm.targetSite === '雅加达' ? '雅加达工厂01' : '深圳工厂01'
    }
    return true
  }
  if (field === 'factoryName') {
    state.createForm.factoryName = (target as HTMLInputElement).value
    return true
  }
  if (field === 'ownerName') {
    state.createForm.ownerName = (target as HTMLInputElement).value
    return true
  }
  if (field === 'priorityLevel') {
    state.createForm.priorityLevel = (target as HTMLSelectElement).value as '高' | '中' | '低'
    return true
  }
  if (field === 'expectedArrival') {
    state.createForm.expectedArrival = (target as HTMLInputElement).value
    return true
  }
  if (field === 'upstreamObjectCode') {
    state.createForm.upstreamObjectCode = (target as HTMLInputElement).value
    return true
  }
  if (field === 'upstreamObjectId') {
    state.createForm.upstreamObjectId = (target as HTMLInputElement).value
    return true
  }
  return false
}

export function isFirstOrderSampleDialogOpen(): boolean {
  return state.detailOpen || state.createOpen
}

export function renderFirstOrderSamplePage(): string {
  const tasks = getTasks()
  return `
    <div class="space-y-4">
      <header class="flex items-center justify-between">
        <div>
          <p class="text-xs text-gray-500">工程开发与打样管理 / 首版样衣打样</p>
          <h1 class="text-xl font-semibold">首版样衣打样</h1>
          <p class="mt-1 text-sm text-gray-500">正式创建后会同步写入任务仓储、项目关系和项目节点，发样与到样动作继续通过样衣台账事件回写。</p>
        </div>
        <button class="inline-flex h-9 items-center rounded-md bg-blue-600 px-4 text-sm text-white hover:bg-blue-700" data-first-sample-action="open-create">新建首版样衣打样</button>
      </header>

      ${renderNotice()}

      <section class="rounded-lg border bg-white p-4">
        <div class="grid gap-4 md:grid-cols-3">
          <input class="h-9 rounded-md border px-3 text-sm" placeholder="任务编号 / 项目编号 / 样衣编号" value="${escapeHtml(state.keyword)}" data-first-sample-field="keyword" />
          <select class="h-9 rounded-md border px-3 text-sm" data-first-sample-field="status">
            ${['all', '草稿', '待发样', '在途', '已到样待入库', '验收中', '已完成', '已取消'].map((item) => `<option value="${item}" ${state.statusFilter === item ? 'selected' : ''}>${item === 'all' ? '全部状态' : item}</option>`).join('')}
          </select>
          <div class="rounded-md border border-dashed px-3 py-2 text-sm text-gray-500">当前共 ${tasks.length} 条正式任务记录</div>
        </div>
      </section>

      <section class="rounded-lg border bg-white overflow-hidden">
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b bg-gray-50 text-left text-gray-600">
              <th class="px-4 py-3 font-medium">任务编号</th>
              <th class="px-4 py-3 font-medium">项目</th>
              <th class="px-4 py-3 font-medium">来源类型</th>
              <th class="px-4 py-3 font-medium">样衣编号</th>
              <th class="px-4 py-3 font-medium">目标站点</th>
              <th class="px-4 py-3 font-medium">状态</th>
              <th class="px-4 py-3 font-medium">负责人</th>
              <th class="px-4 py-3 font-medium">最近更新</th>
              <th class="px-4 py-3 font-medium text-right">操作</th>
            </tr>
          </thead>
          <tbody>
            ${tasks.length === 0 ? `
              <tr><td colspan="9" class="px-4 py-10 text-center text-sm text-gray-500">暂无首版样衣打样任务</td></tr>
            ` : tasks.map((task) => `
              <tr class="border-b last:border-b-0 hover:bg-gray-50">
                <td class="px-4 py-3">
                  <div class="font-medium">${escapeHtml(task.firstSampleTaskCode)}</div>
                  <div class="text-xs text-gray-500">${escapeHtml(task.title)}</div>
                </td>
                <td class="px-4 py-3">
                  <div class="font-medium">${escapeHtml(task.projectCode)}</div>
                  <div class="text-xs text-gray-500">${escapeHtml(task.projectName)}</div>
                </td>
                <td class="px-4 py-3">${escapeHtml(task.sourceType)}</td>
                <td class="px-4 py-3">${escapeHtml(task.sampleCode || '待生成')}</td>
                <td class="px-4 py-3">${escapeHtml(task.targetSite || '—')}</td>
                <td class="px-4 py-3">${escapeHtml(task.status)}</td>
                <td class="px-4 py-3">${escapeHtml(task.ownerName || '—')}</td>
                <td class="px-4 py-3 text-gray-500">${escapeHtml(task.updatedAt)}</td>
                <td class="px-4 py-3">
                  <div class="flex justify-end gap-2">
                    <button class="inline-flex h-8 items-center rounded-md border px-3 text-xs hover:bg-gray-50" data-first-sample-action="open-detail" data-task-id="${task.firstSampleTaskId}">查看</button>
                  </div>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </section>

      ${renderCreateDrawer()}
      ${renderDetailDrawer()}
    </div>
  `
}
