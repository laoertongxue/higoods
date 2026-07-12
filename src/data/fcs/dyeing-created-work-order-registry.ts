import type { DyeWorkOrder } from './dyeing-task-domain.ts'

let reader: () => DyeWorkOrder[] = () => []

export function registerCreatedDyeWorkOrderReader(nextReader: () => DyeWorkOrder[]): void {
  reader = nextReader
}

export function listRegisteredCreatedDyeWorkOrders(): DyeWorkOrder[] {
  return reader()
}
