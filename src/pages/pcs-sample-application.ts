import { renderDetailDrawer as uiDetailDrawer, renderDrawer as uiDrawer } from '../components/ui/index.ts'
import { listProjects, listProjectNodes } from '../data/pcs-project-repository.ts'
import { getSampleAssetById, listSampleAssets } from '../data/pcs-sample-asset-repository.ts'
import { ensureSampleBootstrapInitialized, recordSampleLedgerEvent } from '../data/pcs-sample-project-writeback.ts'
import { escapeHtml } from '../utils.ts'

type RequestStatus = 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'ACTIVE' | 'RETURNING' | 'COMPLETED' | 'REJECTED' | 'CANCELLED'

interface RequestLog {
  time: string
  action: string
  operator: string
  remark?: string
}

interface SampleUseRequestRecord {
  id: string
  code: string
  status: RequestStatus
  projectId: string
  projectCode: string
  projectName: string
  projectNodeId: string
  workItemTypeCode: string
  workItemTypeName: string
  responsibleSite: string
  expectedReturnAt: string
  scenario: string
  pickupMethod: '仓库自取' | '仓管交接' | '快递寄送'
  custodianName: string
  requesterName: string
  approverName: string
  sampleAssetIds: string[]
  updatedAt: string
  remark: string
  logs: RequestLog[]
}

interface SampleApplicationPageState {
  keyword: string
  statusFilter: string
  siteFilter: string
  selectedRequestId: string | null
  detailOpen: boolean
  createDrawerOpen: boolean
  newProjectId: string
  newProjectNodeId: string
  newExpectedReturnAt: string
  newScenario: string
  newPickupMethod: '仓库自取' | '仓管交接' | '快递寄送'
  newCustodianName: string
  newRemark: string
  newSelectedSampleIds: string[]
}

const ALLOWED_NODE_CODES = ['LIVE_TEST', 'VIDEO_TEST', 'SAMPLE_SHOOT_FIT', 'PATTERN_TASK']
const STATUS_LABELS: Record<RequestStatus, string> = {
  DRAFT: '草稿',
  SUBMITTED: '待审批',
  APPROVED: '已批准',
  ACTIVE: '使用中',
  RETURNING: '归还中',
  COMPLETED: '已完成',
  REJECTED: '已驳回',
  CANCELLED: '已取消',
}

function nowText(): string {
  const now = new Date()
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`
}

function createSeedRequests(): SampleUseRequestRecord[] {
  ensureSampleBootstrapInitialized()
  const projects = listProjects()
  const projectOne = projects[0]
  const projectTwo = projects[1] || projects[0]
  const projectOneNode = listProjectNodes(projectOne.projectId).find((node) => node.workItemTypeCode === 'LIVE_TEST')
  const projectTwoNode = listProjectNodes(projectTwo.projectId).find((node) => node.workItemTypeCode === 'VIDEO_TEST') || projectOneNode
  const projectThreeNode = listProjectNodes(projectOne.projectId).find((node) => node.workItemTypeCode === 'PATTERN_TASK') || projectOneNode
  const sampleAssets = listSampleAssets()
  const sampleOne = sampleAssets[0]
  const sampleTwo = sampleAssets[1] || sampleAssets[0]

  return [
    {
      id: 'app_seed_001',
      code: 'APP-20260111-001',
      status: 'ACTIVE',
      projectId: projectOne.projectId,
      projectCode: projectOne.projectCode,
      projectName: projectOne.projectName,
      projectNodeId: projectOneNode?.projectNodeId || '',
      workItemTypeCode: projectOneNode?.workItemTypeCode || 'LIVE_TEST',
      workItemTypeName: projectOneNode?.workItemTypeName || '直播测款',
      responsibleSite: '深圳',
      expectedReturnAt: '2026-01-13 18:00:00',
      scenario: '直播测款',
      pickupMethod: '仓管交接',
      custodianName: '直播团队',
      requesterName: '张丽',
      approverName: '周芳',
      sampleAssetIds: sampleOne ? [sampleOne.sampleAssetId] : [],
      updatedAt: '2026-01-11 11:20:00',
      remark: '直播测款使用样衣。',
      logs: [
        { time: '2026-01-11 08:30:00', action: '创建申请', operator: '张丽' },
        { time: '2026-01-11 09:00:00', action: '审批通过', operator: '周芳', remark: '已生成预占锁定事件' },
        { time: '2026-01-11 11:20:00', action: '确认领用', operator: '张丽', remark: '已生成领用出库事件' },
      ],
    },
    {
      id: 'app_seed_002',
      code: 'APP-20260112-002',
      status: 'SUBMITTED',
      projectId: projectTwo.projectId,
      projectCode: projectTwo.projectCode,
      projectName: projectTwo.projectName,
      projectNodeId: projectTwoNode?.projectNodeId || '',
      workItemTypeCode: projectTwoNode?.workItemTypeCode || 'VIDEO_TEST',
      workItemTypeName: projectTwoNode?.workItemTypeName || '短视频测款',
      responsibleSite: '雅加达',
      expectedReturnAt: '2026-01-14 18:00:00',
      scenario: '短视频拍摄',
      pickupMethod: '快递寄送',
      custodianName: '短视频团队',
      requesterName: '李娜',
      approverName: '',
      sampleAssetIds: sampleTwo ? [sampleTwo.sampleAssetId] : [],
      updatedAt: '2026-01-12 09:30:00',
      remark: '等待审批。',
      logs: [
        { time: '2026-01-12 09:00:00', action: '创建申请', operator: '李娜' },
        { time: '2026-01-12 09:30:00', action: '提交申请', operator: '李娜' },
      ],
    },
    {
      id: 'app_seed_003',
      code: 'APP-20260112-003',
      status: 'APPROVED',
      projectId: projectOne.projectId,
      projectCode: projectOne.projectCode,
      projectName: projectOne.projectName,
      projectNodeId: projectThreeNode?.projectNodeId || '',
      workItemTypeCode: projectThreeNode?.workItemTypeCode || 'PATTERN_TASK',
      workItemTypeName: projectThreeNode?.workItemTypeName || '制版任务',
      responsibleSite: '深圳',
      expectedReturnAt: '2026-01-14 20:00:00',
      scenario: '制版对样',
      pickupMethod: '仓管交接',
      custodianName: '版房团队',
      requesterName: '赵云',
      approverName: '周芳',
      sampleAssetIds: sampleTwo ? [sampleTwo.sampleAssetId] : [],
      updatedAt: '2026-01-12 14:20:00',
      remark: '已批准，等待仓管交接。',
      logs: [
        { time: '2026-01-12 13:30:00', action: '创建申请', operator: '赵云' },
        { time: '2026-01-12 13:40:00', action: '提交申请', operator: '赵云' },
        { time: '2026-01-12 14:20:00', action: '审批通过', operator: '周芳', remark: '等待仓管交接' },
      ],
    },
  ]
}

let requestStore = createSeedRequests()

let state: SampleApplicationPageState = {
  keyword: '',
  statusFilter: 'all',
  siteFilter: 'all',
  selectedRequestId: null,
  detailOpen: false,
  createDrawerOpen: false,
  newProjectId: '',
  newProjectNodeId: '',
  newExpectedReturnAt: '',
  newScenario: '直播测款',
  newPickupMethod: '仓库自取',
  newCustodianName: '',
  newRemark: '',
  newSelectedSampleIds: [],
}

function getProjectNodeOptions(projectId: string) {
  return listProjectNodes(projectId).filter((node) => ALLOWED_NODE_CODES.includes(node.workItemTypeCode))
}

function getRequests() {
  return requestStore.filter((item) => {
    if (state.keyword) {
      const keyword = state.keyword.toLowerCase()
      const matched = [item.code, item.projectCode, item.projectName, item.workItemTypeName, item.requesterName]
        .some((text) => text.toLowerCase().includes(keyword))
      if (!matched) return false
    }
    if (state.statusFilter !== 'all' && item.status !== state.statusFilter) return false
    if (state.siteFilter !== 'all' && item.responsibleSite !== state.siteFilter) return false
    return true
  })
}

function getSelectedRequest() {
  if (!state.selectedRequestId) return null
  return requestStore.find((item) => item.id === state.selectedRequestId) || null
}

function appendLog(requestId: string, action: string, operator: string, remark = '') {
  requestStore = requestStore.map((item) =>
    item.id === requestId
      ? {
          ...item,
          updatedAt: nowText(),
          logs: [...item.logs, { time: nowText(), action, operator, remark }],
        }
      : item,
  )
}

function updateRequest(requestId: string, patch: Partial<SampleUseRequestRecord>) {
  requestStore = requestStore.map((item) =>
    item.id === requestId
      ? {
          ...item,
          ...patch,
          updatedAt: patch.updatedAt || nowText(),
        }
      : item,
  )
}

function writeRequestSampleEvents(request: SampleUseRequestRecord, eventType: 'RESERVE_LOCK' | 'CANCEL_RESERVE' | 'CHECKOUT_BORROW' | 'SHIP_OUT' | 'RETURN_CHECKIN') {
  request.sampleAssetIds.forEach((sampleAssetId) => {
    const asset = getSampleAssetById(sampleAssetId)
    if (!asset) return
    recordSampleLedgerEvent({
      ledgerEventId: `${request.id}::${sampleAssetId}::${eventType}`,
      eventType,
      sampleAssetId: asset.sampleAssetId,
      sampleCode: asset.sampleCode,
      sampleName: asset.sampleName,
      sampleType: asset.sampleType,
      responsibleSite: request.responsibleSite,
      sourcePage: '样衣使用申请',
      sourceModule: '样衣使用申请',
      sourceDocType: '样衣使用申请',
      sourceDocId: request.id,
      sourceDocCode: request.code,
      projectId: request.projectId,
      projectCode: request.projectCode,
      projectName: request.projectName,
      projectNodeId: request.projectNodeId,
      workItemTypeCode: request.workItemTypeCode,
      workItemTypeName: request.workItemTypeName,
      operatorName: '当前用户',
      businessDate: nowText(),
      note: request.remark,
      locationDisplay: asset.locationDisplay,
      custodianName: request.custodianName || asset.custodianName,
    })
  })
}

export function approveSampleApplicationRequest(requestId: string): boolean {
  const request = requestStore.find((item) => item.id === requestId)
  if (!request || request.status !== 'SUBMITTED') return false
  writeRequestSampleEvents(request, 'RESERVE_LOCK')
  updateRequest(requestId, {
    status: 'APPROVED',
    approverName: '当前用户',
  })
  appendLog(requestId, '审批通过', '当前用户', '已生成预占锁定事件')
  return true
}

export function checkoutSampleApplicationRequest(requestId: string): boolean {
  const request = requestStore.find((item) => item.id === requestId)
  if (!request || request.status !== 'APPROVED') return false
  const eventType = request.pickupMethod === '快递寄送' ? 'SHIP_OUT' : 'CHECKOUT_BORROW'
  writeRequestSampleEvents(request, eventType)
  updateRequest(requestId, { status: 'ACTIVE' })
  appendLog(requestId, eventType === 'SHIP_OUT' ? '已寄送' : '确认领用', '当前用户', '已生成正式样衣台账事件')
  return true
}

export function requestSampleApplicationReturn(requestId: string): boolean {
  const request = requestStore.find((item) => item.id === requestId)
  if (!request || request.status !== 'ACTIVE') return false
  updateRequest(requestId, { status: 'RETURNING' })
  appendLog(requestId, '发起归还', '当前用户')
  return true
}

export function confirmSampleApplicationReturn(requestId: string): boolean {
  const request = requestStore.find((item) => item.id === requestId)
  if (!request || request.status !== 'RETURNING') return false
  writeRequestSampleEvents(request, 'RETURN_CHECKIN')
  updateRequest(requestId, { status: 'COMPLETED' })
  appendLog(requestId, '确认归还入库', '当前用户', '已生成归还入库事件')
  return true
}

export function cancelSampleApplicationRequest(requestId: string): boolean {
  const request = requestStore.find((item) => item.id === requestId)
  if (!request || ['COMPLETED', 'CANCELLED', 'REJECTED'].includes(request.status)) return false
  if (request.status === 'APPROVED') {
    writeRequestSampleEvents(request, 'CANCEL_RESERVE')
  }
  updateRequest(requestId, { status: 'CANCELLED' })
  appendLog(requestId, '取消申请', '当前用户', request.status === 'APPROVED' ? '已生成取消预占事件' : '')
  return true
}

function resetCreateForm() {
  state.newProjectId = ''
  state.newProjectNodeId = ''
  state.newExpectedReturnAt = ''
  state.newScenario = '直播测款'
  state.newPickupMethod = '仓库自取'
  state.newCustodianName = ''
  state.newRemark = ''
  state.newSelectedSampleIds = []
}

function renderCreateDrawer(): string {
  if (!state.createDrawerOpen) return ''
  const projectOptions = listProjects()
  const projectNodeOptions = getProjectNodeOptions(state.newProjectId)
  const selectableSamples = listSampleAssets().filter((item) => item.availabilityStatus === '可用')
  return uiDrawer(
    {
      title: '新建样衣使用申请',
      subtitle: '申请单会正式绑定商品项目与项目节点，并驱动样衣台账事件。',
      closeAction: { prefix: 'sample-application', action: 'close-create' },
      width: 'md',
    },
    `
      <div class="space-y-5">
        <div class="grid gap-4 md:grid-cols-2">
          <div>
            <label class="mb-1 block text-sm font-medium">项目</label>
            <select class="h-9 w-full rounded-md border bg-background px-3 text-sm" data-sample-application-field="new-project">
              <option value="">请选择项目</option>
              ${projectOptions.map((item) => `<option value="${item.projectId}" ${state.newProjectId === item.projectId ? 'selected' : ''}>${escapeHtml(`${item.projectCode} · ${item.projectName}`)}</option>`).join('')}
            </select>
          </div>
          <div>
            <label class="mb-1 block text-sm font-medium">工作项</label>
            <select class="h-9 w-full rounded-md border bg-background px-3 text-sm" data-sample-application-field="new-project-node">
              <option value="">请选择工作项</option>
              ${projectNodeOptions.map((item) => `<option value="${item.projectNodeId}" ${state.newProjectNodeId === item.projectNodeId ? 'selected' : ''}>${escapeHtml(`${item.workItemTypeName} / ${item.workItemTypeCode}`)}</option>`).join('')}
            </select>
          </div>
          <div>
            <label class="mb-1 block text-sm font-medium">预计归还时间</label>
            <input class="h-9 w-full rounded-md border bg-background px-3 text-sm" value="${escapeHtml(state.newExpectedReturnAt)}" data-sample-application-field="new-return-at" placeholder="2026-04-15 18:00:00" />
          </div>
          <div>
            <label class="mb-1 block text-sm font-medium">交接方式</label>
            <select class="h-9 w-full rounded-md border bg-background px-3 text-sm" data-sample-application-field="new-pickup">
              ${['仓库自取', '仓管交接', '快递寄送'].map((item) => `<option value="${item}" ${state.newPickupMethod === item ? 'selected' : ''}>${item}</option>`).join('')}
            </select>
          </div>
          <div>
            <label class="mb-1 block text-sm font-medium">使用场景</label>
            <input class="h-9 w-full rounded-md border bg-background px-3 text-sm" value="${escapeHtml(state.newScenario)}" data-sample-application-field="new-scenario" />
          </div>
          <div>
            <label class="mb-1 block text-sm font-medium">保管人</label>
            <input class="h-9 w-full rounded-md border bg-background px-3 text-sm" value="${escapeHtml(state.newCustodianName)}" data-sample-application-field="new-custodian" />
          </div>
        </div>
        <div>
          <label class="mb-1 block text-sm font-medium">样衣清单</label>
          <div class="space-y-2">
            ${selectableSamples.map((asset) => `
              <label class="flex items-center gap-3 rounded-lg border p-3">
                <input type="checkbox" ${state.newSelectedSampleIds.includes(asset.sampleAssetId) ? 'checked' : ''} data-sample-application-action="toggle-sample" data-sample-id="${asset.sampleAssetId}" />
                <div class="flex-1">
                  <div class="font-medium">${escapeHtml(asset.sampleCode)} · ${escapeHtml(asset.sampleName)}</div>
                  <div class="text-xs text-muted-foreground">${escapeHtml(asset.inventoryStatus)} / ${escapeHtml(asset.locationDisplay)}</div>
                </div>
              </label>
            `).join('')}
          </div>
        </div>
        <div>
          <label class="mb-1 block text-sm font-medium">备注</label>
          <textarea class="min-h-[80px] w-full rounded-md border bg-background px-3 py-2 text-sm" data-sample-application-field="new-remark">${escapeHtml(state.newRemark)}</textarea>
        </div>
      </div>
    `,
    {
      cancel: { prefix: 'sample-application', action: 'close-create', label: '取消' },
      confirm: { prefix: 'sample-application', action: 'submit-create', label: '提交申请', variant: 'primary' },
    },
  )
}

function renderDetailDrawer(): string {
  const request = getSelectedRequest()
  if (!state.detailOpen || !request) return ''
  const samples = request.sampleAssetIds.map((item) => getSampleAssetById(item)).filter(Boolean)
  const actions = []
  if (request.status === 'SUBMITTED') actions.push(`<button class="inline-flex h-8 items-center rounded-md bg-primary px-3 text-xs text-primary-foreground" data-sample-application-action="approve-request">审批通过</button>`)
  if (request.status === 'APPROVED') actions.push(`<button class="inline-flex h-8 items-center rounded-md bg-primary px-3 text-xs text-primary-foreground" data-sample-application-action="checkout-request">完成交接</button>`)
  if (request.status === 'ACTIVE') actions.push(`<button class="inline-flex h-8 items-center rounded-md bg-primary px-3 text-xs text-primary-foreground" data-sample-application-action="request-return">发起归还</button>`)
  if (request.status === 'RETURNING') actions.push(`<button class="inline-flex h-8 items-center rounded-md bg-primary px-3 text-xs text-primary-foreground" data-sample-application-action="confirm-return">确认归还入库</button>`)
  if (['DRAFT', 'SUBMITTED', 'APPROVED'].includes(request.status)) actions.push(`<button class="inline-flex h-8 items-center rounded-md border px-3 text-xs hover:bg-muted" data-sample-application-action="cancel-request">取消申请</button>`)

  return uiDetailDrawer(
    {
      title: '样衣使用申请详情',
      subtitle: request.code,
      closeAction: { prefix: 'sample-application', action: 'close-detail' },
      width: 'md',
    },
    `
      <div class="space-y-5 text-sm">
        <section class="grid gap-3 md:grid-cols-2">
          <div class="rounded-lg border bg-muted/20 p-3"><div class="text-xs text-muted-foreground">当前状态</div><div class="mt-1 font-medium">${STATUS_LABELS[request.status]}</div></div>
          <div class="rounded-lg border bg-muted/20 p-3"><div class="text-xs text-muted-foreground">责任站点</div><div class="mt-1 font-medium">${escapeHtml(request.responsibleSite)}</div></div>
          <div class="rounded-lg border bg-muted/20 p-3"><div class="text-xs text-muted-foreground">项目</div><div class="mt-1 font-medium">${escapeHtml(`${request.projectCode} · ${request.projectName}`)}</div></div>
          <div class="rounded-lg border bg-muted/20 p-3"><div class="text-xs text-muted-foreground">工作项</div><div class="mt-1 font-medium">${escapeHtml(`${request.workItemTypeName} / ${request.workItemTypeCode}`)}</div></div>
          <div class="rounded-lg border bg-muted/20 p-3"><div class="text-xs text-muted-foreground">预计归还时间</div><div class="mt-1 font-medium">${escapeHtml(request.expectedReturnAt)}</div></div>
          <div class="rounded-lg border bg-muted/20 p-3"><div class="text-xs text-muted-foreground">交接方式</div><div class="mt-1 font-medium">${escapeHtml(request.pickupMethod)}</div></div>
        </section>
        <section>
          <h3 class="mb-2 font-semibold">样衣清单</h3>
          <div class="space-y-2">
            ${samples.map((asset) => `
              <div class="rounded-lg border p-3">
                <div class="font-medium">${escapeHtml(asset!.sampleCode)} · ${escapeHtml(asset!.sampleName)}</div>
                <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(asset!.inventoryStatus)} / ${escapeHtml(asset!.locationDisplay)}</div>
              </div>
            `).join('')}
          </div>
        </section>
        <section>
          <h3 class="mb-2 font-semibold">申请日志</h3>
          <div class="space-y-2">
            ${request.logs.map((item) => `
              <div class="rounded-lg border bg-muted/20 p-3">
                <div class="font-medium">${escapeHtml(item.action)}</div>
                <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(item.time)} / ${escapeHtml(item.operator)}</div>
                ${item.remark ? `<div class="mt-1 text-xs text-muted-foreground">${escapeHtml(item.remark)}</div>` : ''}
              </div>
            `).join('')}
          </div>
        </section>
      </div>
    `,
    actions.join(''),
  )
}

export function handleSampleApplicationEvent(target: Element): boolean {
  const actionNode = target.closest<HTMLElement>('[data-sample-application-action]')
  const action = actionNode?.dataset.sampleApplicationAction
  if (!action) return false

  if (action === 'open-detail') {
    const requestId = actionNode?.dataset.requestId
    if (requestId) {
      state.selectedRequestId = requestId
      state.detailOpen = true
    }
    return true
  }
  if (action === 'close-detail') {
    state.detailOpen = false
    return true
  }
  if (action === 'open-create') {
    state.createDrawerOpen = true
    return true
  }
  if (action === 'close-create') {
    state.createDrawerOpen = false
    resetCreateForm()
    return true
  }
  if (action === 'toggle-sample') {
    const sampleId = actionNode?.dataset.sampleId
    if (sampleId) {
      state.newSelectedSampleIds = state.newSelectedSampleIds.includes(sampleId)
        ? state.newSelectedSampleIds.filter((item) => item !== sampleId)
        : [...state.newSelectedSampleIds, sampleId]
    }
    return true
  }
  if (action === 'submit-create') {
    const project = listProjects().find((item) => item.projectId === state.newProjectId)
    const node = getProjectNodeOptions(state.newProjectId).find((item) => item.projectNodeId === state.newProjectNodeId)
    if (!project || !node || state.newSelectedSampleIds.length === 0) return true
    const request: SampleUseRequestRecord = {
      id: `app_manual_${String(requestStore.length + 1).padStart(3, '0')}`,
      code: `APP-${nowText().slice(0, 10).replace(/-/g, '')}-${String(requestStore.length + 1).padStart(3, '0')}`,
      status: 'SUBMITTED',
      projectId: project.projectId,
      projectCode: project.projectCode,
      projectName: project.projectName,
      projectNodeId: node.projectNodeId,
      workItemTypeCode: node.workItemTypeCode,
      workItemTypeName: node.workItemTypeName,
      responsibleSite: '深圳',
      expectedReturnAt: state.newExpectedReturnAt || `${nowText().slice(0, 10)} 18:00:00`,
      scenario: state.newScenario,
      pickupMethod: state.newPickupMethod,
      custodianName: state.newCustodianName,
      requesterName: '当前用户',
      approverName: '',
      sampleAssetIds: [...state.newSelectedSampleIds],
      updatedAt: nowText(),
      remark: state.newRemark,
      logs: [{ time: nowText(), action: '创建申请', operator: '当前用户' }, { time: nowText(), action: '提交申请', operator: '当前用户' }],
    }
    requestStore = [request, ...requestStore]
    state.createDrawerOpen = false
    resetCreateForm()
    return true
  }
  if (action === 'approve-request' && state.selectedRequestId) return approveSampleApplicationRequest(state.selectedRequestId)
  if (action === 'checkout-request' && state.selectedRequestId) return checkoutSampleApplicationRequest(state.selectedRequestId)
  if (action === 'request-return' && state.selectedRequestId) return requestSampleApplicationReturn(state.selectedRequestId)
  if (action === 'confirm-return' && state.selectedRequestId) return confirmSampleApplicationReturn(state.selectedRequestId)
  if (action === 'cancel-request' && state.selectedRequestId) return cancelSampleApplicationRequest(state.selectedRequestId)
  if (action === 'reset') {
    state.keyword = ''
    state.statusFilter = 'all'
    state.siteFilter = 'all'
    return true
  }
  return false
}

export function handleSampleApplicationInput(target: Element): boolean {
  const field = (target as HTMLElement).dataset.sampleApplicationField
  if (!field) return false
  if (field === 'keyword') {
    state.keyword = (target as HTMLInputElement).value
    return true
  }
  if (field === 'status') {
    state.statusFilter = (target as HTMLSelectElement).value
    return true
  }
  if (field === 'site') {
    state.siteFilter = (target as HTMLSelectElement).value
    return true
  }
  if (field === 'new-project') {
    state.newProjectId = (target as HTMLSelectElement).value
    state.newProjectNodeId = ''
    return true
  }
  if (field === 'new-project-node') {
    state.newProjectNodeId = (target as HTMLSelectElement).value
    return true
  }
  if (field === 'new-return-at') {
    state.newExpectedReturnAt = (target as HTMLInputElement).value
    return true
  }
  if (field === 'new-scenario') {
    state.newScenario = (target as HTMLInputElement).value
    return true
  }
  if (field === 'new-pickup') {
    state.newPickupMethod = (target as HTMLSelectElement).value as SampleApplicationPageState['newPickupMethod']
    return true
  }
  if (field === 'new-custodian') {
    state.newCustodianName = (target as HTMLInputElement).value
    return true
  }
  if (field === 'new-remark') {
    state.newRemark = (target as HTMLTextAreaElement).value
    return true
  }
  return false
}

export function isSampleApplicationDialogOpen(): boolean {
  return state.detailOpen || state.createDrawerOpen
}

export function renderSampleApplicationPage(): string {
  ensureSampleBootstrapInitialized()
  const requests = getRequests()
  const siteOptions = Array.from(new Set(requestStore.map((item) => item.responsibleSite)))

  return `
    <div class="space-y-4">
      <header class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 class="text-xl font-semibold">样衣使用申请</h1>
          <p class="mt-1 text-sm text-muted-foreground">申请单正式绑定商品项目节点，审批、交接、归还、取消都会写正式样衣台账事件。</p>
        </div>
        <button class="inline-flex h-9 items-center rounded-md bg-primary px-3 text-sm text-primary-foreground" data-sample-application-action="open-create">新建申请</button>
      </header>

      <section class="rounded-lg border bg-card p-4">
        <div class="grid gap-3 lg:grid-cols-[2fr,1fr,1fr,auto]">
          <input class="h-9 rounded-md border bg-background px-3 text-sm" placeholder="搜索申请单号/项目/工作项/申请人" value="${escapeHtml(state.keyword)}" data-sample-application-field="keyword" />
          <select class="h-9 rounded-md border bg-background px-3 text-sm" data-sample-application-field="status">
            <option value="all" ${state.statusFilter === 'all' ? 'selected' : ''}>全部状态</option>
            ${Object.entries(STATUS_LABELS).map(([code, label]) => `<option value="${code}" ${state.statusFilter === code ? 'selected' : ''}>${label}</option>`).join('')}
          </select>
          <select class="h-9 rounded-md border bg-background px-3 text-sm" data-sample-application-field="site">
            <option value="all" ${state.siteFilter === 'all' ? 'selected' : ''}>全部站点</option>
            ${siteOptions.map((item) => `<option value="${escapeHtml(item)}" ${state.siteFilter === item ? 'selected' : ''}>${escapeHtml(item)}</option>`).join('')}
          </select>
          <button class="inline-flex h-9 items-center rounded-md border px-3 text-sm hover:bg-muted" data-sample-application-action="reset">重置</button>
        </div>
      </section>

      <section class="overflow-hidden rounded-lg border bg-card">
        <div class="overflow-x-auto">
          <table class="w-full min-w-[1200px] text-sm">
            <thead>
              <tr class="border-b bg-muted/30 text-left text-muted-foreground">
                <th class="px-3 py-2 font-medium">申请单号</th>
                <th class="px-3 py-2 font-medium">状态</th>
                <th class="px-3 py-2 font-medium">项目</th>
                <th class="px-3 py-2 font-medium">工作项</th>
                <th class="px-3 py-2 font-medium">样衣数量</th>
                <th class="px-3 py-2 font-medium">责任站点</th>
                <th class="px-3 py-2 font-medium">预计归还</th>
                <th class="px-3 py-2 font-medium">申请人</th>
                <th class="px-3 py-2 font-medium">更新时间</th>
                <th class="px-3 py-2 font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              ${requests.length > 0 ? requests.map((item) => `
                <tr class="border-b last:border-b-0 hover:bg-muted/30">
                  <td class="px-3 py-3 font-medium text-primary">${escapeHtml(item.code)}</td>
                  <td class="px-3 py-3">${STATUS_LABELS[item.status]}</td>
                  <td class="px-3 py-3">${escapeHtml(`${item.projectCode} · ${item.projectName}`)}</td>
                  <td class="px-3 py-3">${escapeHtml(`${item.workItemTypeName} / ${item.workItemTypeCode}`)}</td>
                  <td class="px-3 py-3">${item.sampleAssetIds.length}</td>
                  <td class="px-3 py-3">${escapeHtml(item.responsibleSite)}</td>
                  <td class="px-3 py-3">${escapeHtml(item.expectedReturnAt)}</td>
                  <td class="px-3 py-3">${escapeHtml(item.requesterName)}</td>
                  <td class="px-3 py-3">${escapeHtml(item.updatedAt)}</td>
                  <td class="px-3 py-3"><button class="inline-flex h-7 items-center rounded-md border px-2 text-xs hover:bg-muted" data-sample-application-action="open-detail" data-request-id="${item.id}">查看</button></td>
                </tr>
              `).join('') : '<tr><td colspan="10" class="px-4 py-12 text-center text-muted-foreground">暂无样衣使用申请</td></tr>'}
            </tbody>
          </table>
        </div>
      </section>

      ${renderDetailDrawer()}
      ${renderCreateDrawer()}
    </div>
  `
}
