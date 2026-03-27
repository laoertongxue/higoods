import {
  buildFcsCuttingDomainSnapshot,
  type CuttingDomainSnapshot,
} from '../../../domain/fcs-cutting-runtime/index.ts'
import {
  buildFeiTicketsProjection,
} from './fei-tickets-projection'

export function buildFeiTicketPrintProjection(
  snapshot: CuttingDomainSnapshot = buildFcsCuttingDomainSnapshot(),
) {
  return buildFeiTicketsProjection(snapshot)
}
