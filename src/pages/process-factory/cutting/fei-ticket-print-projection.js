import { buildFcsCuttingDomainSnapshot, } from '../../../domain/fcs-cutting-runtime/index.ts';
import { buildFeiTicketsProjection, } from './fei-tickets-projection.ts';
export function buildFeiTicketPrintProjection(snapshot = buildFcsCuttingDomainSnapshot()) {
    return buildFeiTicketsProjection(snapshot);
}
