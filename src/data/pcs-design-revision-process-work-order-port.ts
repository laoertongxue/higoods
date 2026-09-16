export interface DesignRevisionProcessWorkOrderLineInput {
  processType: 'DYEING' | 'PRINTING'
  professionalTaskId: string
  professionalTaskNo: string
  targetSpuImageUrl: string
  targetColorId: string
  targetColor: string
  bomVersionId: string
  bomVersionLabel: string
  bomItemId: string
  materialId: string
  materialSkuId: string
  materialSkuCode: string
  materialName: string
  materialType: string
  materialReceivingKind: 'FABRIC' | 'ACCESSORY' | 'YARN'
  materialImageUrl: string
  materialComposition: string
  materialSpecification: string
  plannedQty: number
  qtyUnit: string
}

export interface DesignRevisionProcessWorkOrderRequest {
  designRevisionTaskId: string
  designRevisionTaskNo: string
  targetSpuCode: string
  targetSpuName: string
  createdAt: string
  createdBy: string
  receivingTeamId: string
  receivingTeamName: string
  receivingFactoryId: string
  receivingFactoryName: string
  receivingLocationId: string
  receivingLocationName: string
  lines: DesignRevisionProcessWorkOrderLineInput[]
}

export interface DesignRevisionProcessWorkOrderReference {
  processType: 'PRINTING' | 'DYEING'
  processOrderId: string
  processOrderCode: string
  sourceKey: string
  targetColor: string
  bomVersionId: string
  bomItemId: string
  materialSkuId: string
  professionalTaskId: string
  prerequisiteProcessOrderId: string
}

export interface DesignRevisionProfessionalResultAttachment {
  fileId: string
  fileName: string
  mimeType: string
  sizeBytes: number
  dataUrl: string
}

export interface DesignRevisionApprovedProfessionalResultInput {
  designRevisionTaskId: string
  professionalTaskId: string
  professionalResultId: string
  professionalResultVersion: string
  approvedAt: string
  approvedBy: string
  attachments: DesignRevisionProfessionalResultAttachment[]
  processWorkOrderRefs: Array<Pick<DesignRevisionProcessWorkOrderReference, 'processType' | 'processOrderId' | 'sourceKey'>>
}

export type DesignRevisionProcessWorkOrderBusinessStatus =
  | 'WAIT_PROFESSIONAL_RESULT'
  | 'WAIT_PREREQUISITE_PROCESS'
  | 'WAIT_ASSIGNMENT'
  | 'WAIT_FACTORY_ACCEPTANCE'
  | 'WAIT_MATERIAL'
  | 'READY_TO_PROCESS'
  | 'PROCESSING'
  | 'WAIT_HANDOVER'
  | 'COMPLETED'
  | 'BLOCKED'
  | 'NOT_FOUND'

export interface DesignRevisionProcessWorkOrderStatusView {
  processType: 'PRINTING' | 'DYEING'
  processOrderId: string
  processOrderCode: string
  status: DesignRevisionProcessWorkOrderBusinessStatus
  statusLabel: string
  blockReason: string
  professionalResultId: string
  professionalResultVersion: string
  prerequisiteProcessOrderId: string
}

export interface PreparedDesignRevisionProcessWorkOrders {
  refs: DesignRevisionProcessWorkOrderReference[]
  commit(): DesignRevisionProcessWorkOrderReference[]
  rollback(): void
}

export interface DesignRevisionProcessWorkOrderPort {
  prepare(request: DesignRevisionProcessWorkOrderRequest): PreparedDesignRevisionProcessWorkOrders
  bindApprovedResult(input: DesignRevisionApprovedProfessionalResultInput): DesignRevisionProcessWorkOrderStatusView[]
  readStatuses(refs: Array<Pick<DesignRevisionProcessWorkOrderReference, 'processType' | 'processOrderId'>>): DesignRevisionProcessWorkOrderStatusView[]
}

let registeredPort: DesignRevisionProcessWorkOrderPort | null = null

export function registerDesignRevisionProcessWorkOrderPort(port: DesignRevisionProcessWorkOrderPort): void {
  registeredPort = port
}

export function prepareDesignRevisionProcessWorkOrders(
  request: DesignRevisionProcessWorkOrderRequest,
): PreparedDesignRevisionProcessWorkOrders {
  if (!registeredPort) throw new Error('印花／染色加工单服务尚未就绪，本次方案未确认，请重试。')
  return registeredPort.prepare(request)
}

export function bindDesignRevisionApprovedProfessionalResult(
  input: DesignRevisionApprovedProfessionalResultInput,
): DesignRevisionProcessWorkOrderStatusView[] {
  if (!registeredPort) throw new Error('印花／染色加工单服务尚未就绪，专业成果未绑定，请重试。')
  return registeredPort.bindApprovedResult(input)
}

export function readDesignRevisionProcessWorkOrderStatuses(
  refs: Array<Pick<DesignRevisionProcessWorkOrderReference, 'processType' | 'processOrderId'>>,
): DesignRevisionProcessWorkOrderStatusView[] {
  if (!registeredPort) return refs.map((ref) => ({
    ...ref,
    processOrderCode: '',
    status: 'BLOCKED',
    statusLabel: '加工单服务未就绪',
    blockReason: '印花／染色加工单服务尚未就绪，请刷新后重试。',
    professionalResultId: '',
    professionalResultVersion: '',
    prerequisiteProcessOrderId: '',
  }))
  return registeredPort.readStatuses(refs)
}

export function clearDesignRevisionProcessWorkOrderPortForTest(): void {
  registeredPort = null
}
