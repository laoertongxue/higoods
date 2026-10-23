import { getFactoryMasterRecordById } from './factory-master-store.ts'
import { isCentralPdaFactory } from './pda-experience-scope.ts'
import { readFactoryPdaExecutionUsers } from './store-domain-pda.ts'

export interface CentralPrintingActor { userId: string; name: string; factoryId: string }

/** A current account and factory, independent of the legacy PDA device session. */
export function assertCentralPrintingFactoryActor(factoryId: string, actor: CentralPrintingActor): void {
  const factory = getFactoryMasterRecordById(factoryId)
  const current = readFactoryPdaExecutionUsers(actor.factoryId).find(user => user.userId === actor.userId)
  if (!factory || factory.status !== 'active' || !isCentralPdaFactory(factory) || actor.factoryId !== factoryId
    || !current || current.status !== 'ACTIVE' || current.name !== actor.name) throw new Error('PRINT_wrongActor')
}
