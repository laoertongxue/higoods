export interface PFChildAction {
  id: string; name: string; team: string; owner: string; sourceDocumentId: string;
  requiredQty: number; qualifiedQty: number; unit: string; actualStartAt: string | null;
  actualEndAt: string | null; budgetDays: number | null; budgetState: string;
  businessState: string; includedInProductionDuration: boolean;
}
export interface PFMaterial {
  id: string; name: string; imageUrl: string; imageSource: string; unit: string;
  inputSku?: string; outputSku?: string;
}
export interface PFNode {
  sourceSummary?: { documentType:string; documentNo:string; status:string; fields:{label:string;value:string}[]; href?:string };
  inputObjectType?: string; outputObjectType?: string;
  factory?: string;
  origin?: 'preparation' | 'route' | 'execution' | 'material' | 'fulfillment' | 'decision';
  sourceEntryId?: string; inputSku?: string; outputSku?: string; dependencyNote?: string;
  quantityKnown?: boolean;
  requiredQuantityKnown?: boolean;
  quantityScope?: string;
  includedInProductionDuration?: boolean;
  id: string; taskId: string; stage: string; name: string; team: string; owner: string;
  durationDays: number | null; durationSource: string; predecessors: string[];
  sourceDocumentType: string; sourceDocumentId: string; sourceHref?: string;
  unit: string; requiredQty: number; qualifiedQty: number; standardStartDay: number;
  standardEndDay: number; baselineDueAt: string | null; standardStartAt: string | null;
  actualStartAt: string | null; actualEndAt: string | null; predictedStartAt: string | null;
  predictedEndAt: string | null; businessState: string; timeState: string;
  actualElapsedDays: number | null; actualOverdueDays: number; predictedDelayDays: number | null;
  mappingState: string; sourceUpdatedAt: string; timingKind: 'action' | 'groupProxy';
  childActions?: PFChildAction[]; allocatedCapacityPerDay?: number; remainingQty?: number;
  requiredCapacityPerDay?: number; capacityGapPerDay?: number; material?: PFMaterial;
  releaseMode?: string; releaseRequiredQty?: number; releaseRuleId?: string; releaseReason?: string;
  firstQualifiedReturnAt?: string; firstQualifiedReturnQty?: number;
  localDueAt?: string | null; neededFinishAt?: string | null; actualReadyAt?: string | null;
  upstreamDelayDays?: number; recoverDays?: number; blocker?: string;
  forecastSource?: 'manual' | 'capacity' | 'schedule'; forecastNote?: string; forecastUpdatedAt?: string;
}
export interface PFTask {
  asOf?: string;
  sourceContext?: {
    preparationId?: string; preparationType?: string; preparationState?: string;
    technicalVersionId?: string; technicalVersionLabel?: string; routeStatus?: string;
    demandHref: string; preparationHref?: string; technicalHref?: string; gaps: string[];
    timingScope?: { state:'confirmed'|'pending'; terminalNodeIds:string[]; blockingReasons:string[] };
    excludedPreparation?: { name: string; reason: string }[]; sourceKind: string;
  };
  shipmentQuantityKnown?: boolean;
  quantityKnown?: boolean;
  id: string; purchaseNo: string; demandNo: string; scenario: string; startedAt: string;
  standardDays: number | null; baselineDueAt: string | null; effectiveDueAt: string | null;
  predictedFinishAt: string | null; originalQty: number; effectiveQty: number; shippedQty: number;
  remainingQty: number; businessState: string; health: string; follower: string; accountableTeam: string;
  unit: string; styleRef: string; styleName: string; imageUrl: string; region: string; supplyMode: string;
  productionOrderNos: string[]; preparationNo: string; ruleVersion: string; baselineRuleVersion?:string; baselineStandardDays?:number|null; nodes: PFNode[];
  progressPct: number | null; hasActualShipmentOrderFacts: boolean; knownShipmentOrderScope: string;
  remainingQtyCustomerOrders: string; completedAt?: string; terminatedAt?: string;
  demandReductionQty?: number; demandChangeAt?: string; demandChangeId?: string; terminationReason?: string;
  standardRangeDays?: number[]; decisionDueAt?: string; decisionOverdueDays?: number;
  lastProgressAt?: string; missingRule?: string; uncertainty?: string; blocker?: string;
  responsibleTeam?: string; mergedProductionFollower?: string; sourceDemandIds?: string[]; relatedTaskIds?: string[];
  quantityLines?: {sku:string; effectiveQty:number; shippedQty:number; unit:string}[];
}
export interface ShipmentOrderFact {
  orderNo: string; taskId: string; orderLineId: string; shipmentId: string; placedAt: string;
  shippedAt: string; associatedAt: string; requiredQty: number; shippedQty: number; unit: string;
  requiredDays: number; actualDays: number; overdueDays: number; source: string;
  orderScopeConfirmed: boolean; allOrderLineIds: string[]; orderEffectiveQty: number;
  orderCompletedAt: string; orderCompletionType: string;
}
export interface PFStage { id: string; name: string; instanceCount: number; standardStartDay: number; standardEndDay: number }
export interface PFCatalogEntry { id: string; stage: string; name: string; condition: string; anchors: string; team: string; rule: string }
export interface TaskAssessment {
  health: string; elapsedDays: number; actualOverdueDays: number; predictedDelayDays: number | null;
  remainingDays: number | null; progressPct: number | null; active: boolean; blocker: string;
  responsibleTeam: string; activeStages: string[];
}
export interface PFFilters {
  factory?: string;
  query: string; health: string; follower: string; stage: string; team: string; region: string;
  supplyMode: string; scope: string; dateField: string; dateFrom: string; dateTo: string; issuesOnly: boolean; timezone?: string;
}
