import { expect, test } from '@playwright/test'

import { buildMarkerPlanViewModel } from '../src/pages/process-factory/cutting/marker-plan-model'
import { buildMarkerPlanSummaryBuildOptions } from '../src/pages/process-factory/cutting/marker-plan-projection'
import { buildPrintableUnitDetailViewModel } from '../src/pages/process-factory/cutting/fei-tickets-model'
import { buildFeiTicketPrintProjection } from '../src/pages/process-factory/cutting/fei-ticket-print-projection'
import { buildTransferBagsProjection } from '../src/pages/process-factory/cutting/transfer-bags-projection'
import { buildCutPieceWarehouseProjection } from '../src/pages/process-factory/cutting/cut-piece-warehouse-projection'
import { readMarkerSpreadingPrototypeData } from '../src/pages/process-factory/cutting/marker-spreading-utils'

test('裁片 viewModel alias 字段已对页面可用', async () => {
  const markerPlanViewModel = buildMarkerPlanViewModel(buildMarkerPlanSummaryBuildOptions())
  const markerPlanRow = markerPlanViewModel.plans[0]

  expect(markerPlanRow).toBeTruthy()
  expect(markerPlanRow.markerGarmentQty).toBe(markerPlanRow.totalPieces)
  expect(markerPlanRow.markerGarmentQtyText).toBe(markerPlanRow.totalPiecesText)
  expect(markerPlanRow.markerGarmentQtyFormula).toBe(markerPlanRow.totalPiecesFormula)

  const spreadingData = readMarkerSpreadingPrototypeData()
  const spreadingSession = spreadingData.store.sessions.find((session) => (session.rolls || []).length > 0)
  const spreadingRoll = spreadingSession?.rolls.find((roll) => (roll.actualCutPieceQty ?? 0) > 0)
  const spreadingOperator = spreadingSession?.operators.find((operator) => operator.handledPieceQty !== undefined && operator.handledPieceQty !== null)

  expect(spreadingSession).toBeTruthy()
  expect(spreadingSession?.actualCutGarmentQty).toBe(spreadingSession?.actualCutPieceQty)
  expect(spreadingRoll?.actualCutGarmentQty).toBe(spreadingRoll?.actualCutPieceQty)
  expect(spreadingOperator?.handledGarmentQty).toBe(spreadingOperator?.handledPieceQty)

  const feiProjection = buildFeiTicketPrintProjection()
  const printableUnit = feiProjection.printableViewModel.units.find((unit) => unit.garmentQtyTotal > 0) || feiProjection.printableViewModel.units[0]
  expect(printableUnit).toBeTruthy()
  expect(printableUnit.garmentQtyTotal).toBeGreaterThan(0)

  const printableUnitDetail = buildPrintableUnitDetailViewModel({
    unit: printableUnit,
    originalRows: feiProjection.originalRows,
    materialPrepRows: feiProjection.materialPrepRows,
    mergeBatches: feiProjection.mergeBatches,
    markerStore: feiProjection.markerStore,
    ticketRecords: feiProjection.ticketRecords,
    printJobs: feiProjection.printJobs,
  })
  const splitDetail = printableUnitDetail.splitDetails[0]
  expect(splitDetail).toBeTruthy()
  expect(splitDetail?.garmentQty).toBe(splitDetail?.quantity)

  const transferProjection = buildTransferBagsProjection()
  const transferMaster = transferProjection.viewModel.masters.find((item) => item.currentGarmentQtyTotal > 0) || transferProjection.viewModel.masters[0]
  const transferBinding = transferProjection.viewModel.bindings[0]
  const transferCandidate = transferProjection.viewModel.ticketCandidates[0]

  expect(transferMaster).toBeTruthy()
  expect(transferMaster.currentGarmentQtyTotal).toBe(transferMaster.currentTotalPieceCount)
  expect(transferBinding).toBeTruthy()
  expect(transferBinding?.garmentQty).toBe(transferBinding?.qty)
  expect(transferCandidate).toBeTruthy()
  expect(transferCandidate?.garmentQty).toBe(transferCandidate?.qty)

  const warehouseProjection = buildCutPieceWarehouseProjection()
  const warehouseItem = warehouseProjection.viewModel.items[0]
  const warehouseZone = warehouseProjection.viewModel.zoneSummary[0]

  expect(warehouseItem).toBeTruthy()
  expect(warehouseItem.pieceQty).toBe(warehouseItem.quantity)
  expect(warehouseProjection.viewModel.summary.pieceQtyTotal).toBe(warehouseProjection.viewModel.summary.totalQuantity)
  expect(warehouseZone).toBeTruthy()
  expect(warehouseZone.pieceQtyTotal).toBe(warehouseZone.quantityTotal)
})
