export interface WoolMobileBindingEntryParams {
  sourceId: string
  currentFactoryId?: string
  taskId?: string
}

export function invokeWoolMobileTaskBinding<TResult>(
  params: WoolMobileBindingEntryParams,
  validator: (sourceId: string, currentFactoryId?: string, taskId?: string) => TResult,
): TResult {
  return validator(params.sourceId, params.currentFactoryId, params.taskId)
}
