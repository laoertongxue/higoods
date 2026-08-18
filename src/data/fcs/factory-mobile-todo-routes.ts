export interface FactoryMobileTodoRouteInput {
  todoType: string
  detailRoute?: string
  executionProcessType?: 'WOOL' | 'SPECIAL_CRAFT'
  relatedTaskId?: string
  relatedHandoverOrderId?: string
  relatedOutboundRecordId?: string
  relatedInboundRecordId?: string
}

export function resolveFactoryMobileTodoActionRoute(todo: FactoryMobileTodoRouteInput): string {
  switch (todo.todoType) {
    case '待报价':
      return todo.detailRoute || '/fcs/pda/task-receive?tab=pending-quote'
    case '待接单':
      return todo.relatedTaskId ? `/fcs/pda/task-receive/${todo.relatedTaskId}` : '/fcs/pda/task-receive'
    case '待交出':
      if ((todo.executionProcessType === 'WOOL' || todo.executionProcessType === 'SPECIAL_CRAFT') && todo.relatedTaskId) {
        return `/fcs/pda/handover?tab=handout&taskId=${encodeURIComponent(todo.relatedTaskId)}`
      }
      return todo.relatedHandoverOrderId ? `/fcs/pda/handover/${todo.relatedHandoverOrderId}` : '/fcs/pda/handover'
    case '待接收':
      return todo.relatedHandoverOrderId ? `/fcs/pda/handover/${todo.relatedHandoverOrderId}` : '/fcs/pda/handover'
    case '待开工':
    case '待完工':
    case '待加工填报':
    case '异常待处理':
      return todo.relatedTaskId ? `/fcs/pda/exec/${todo.relatedTaskId}` : '/fcs/pda/exec'
    case '待确认接收':
      if ((todo.executionProcessType === 'WOOL' || todo.executionProcessType === 'SPECIAL_CRAFT') && todo.relatedTaskId) {
        return `/fcs/pda/handover?tab=pickup&taskId=${encodeURIComponent(todo.relatedTaskId)}`
      }
      return todo.relatedTaskId ? `/fcs/pda/exec/${todo.relatedTaskId}` : '/fcs/pda/exec'
    case '差异待处理':
      if (todo.relatedOutboundRecordId) return '/fcs/pda/warehouse/outbound-records'
      if (todo.relatedInboundRecordId) return '/fcs/pda/warehouse/inbound-records'
      return '/fcs/pda/handover'
    case '对账待确认':
      return '/fcs/pda/settlement'
    default:
      return '/fcs/pda/task-receive'
  }
}
