export type PdaExecutionBindingState = 'BOUND' | 'UNBOUND'

export interface PdaCuttingExecutionSourceRecord {
  taskId: string
  taskNo: string
  executionOrderId: string
  executionOrderNo: string
  legacyCutPieceOrderNo: string
  productionOrderId: string
  productionOrderNo: string
  originalCutOrderId: string
  originalCutOrderNo: string
  mergeBatchId: string
  mergeBatchNo: string
  materialSku: string
  bindingState: PdaExecutionBindingState
}

export interface PdaCuttingTaskSourceRecord {
  taskId: string
  taskNo: string
  productionOrderId: string
  productionOrderNo: string
  executionOrderIds: string[]
  executionOrderNos: string[]
  bindingState: PdaExecutionBindingState
}

const PDA_CUTTING_EXECUTION_SOURCE_RECORDS: PdaCuttingExecutionSourceRecord[] = [
  { taskId: 'TASK-CUT-000087', taskNo: 'TASK-CUT-000087', executionOrderId: 'CPO-20260319-A', executionOrderNo: 'CPO-20260319-A', legacyCutPieceOrderNo: 'CPO-20260319-A', productionOrderId: 'PO-202603-081', productionOrderNo: 'PO-202603-081', originalCutOrderId: 'CUT-260308-081-01', originalCutOrderNo: 'CUT-260308-081-01', mergeBatchId: '', mergeBatchNo: '', materialSku: 'FAB-SKU-PRINT-001', bindingState: 'BOUND' },
  { taskId: 'TASK-CUT-000087', taskNo: 'TASK-CUT-000087', executionOrderId: 'CPO-20260319-A-02', executionOrderNo: 'CPO-20260319-A-02', legacyCutPieceOrderNo: 'CPO-20260319-A-02', productionOrderId: 'PO-202603-081', productionOrderNo: 'PO-202603-081', originalCutOrderId: 'CUT-260308-081-02', originalCutOrderNo: 'CUT-260308-081-02', mergeBatchId: '', mergeBatchNo: '', materialSku: 'FAB-SKU-PRINT-001-B', bindingState: 'BOUND' },
  { taskId: 'TASK-CUT-000087', taskNo: 'TASK-CUT-000087', executionOrderId: 'CPO-20260319-A-03', executionOrderNo: 'CPO-20260319-A-03', legacyCutPieceOrderNo: 'CPO-20260319-A-03', productionOrderId: 'PO-202603-081', productionOrderNo: 'PO-202603-081', originalCutOrderId: 'CUT-260308-081-03', originalCutOrderNo: 'CUT-260308-081-03', mergeBatchId: '', mergeBatchNo: '', materialSku: 'FAB-SKU-LINING-001', bindingState: 'BOUND' },
  { taskId: 'TASK-CUT-000088', taskNo: 'TASK-CUT-000088', executionOrderId: 'CPO-20260319-B', executionOrderNo: 'CPO-20260319-B', legacyCutPieceOrderNo: 'CPO-20260319-B', productionOrderId: 'PO-202603-082', productionOrderNo: 'PO-202603-082', originalCutOrderId: 'CUT-260309-082-01', originalCutOrderNo: 'CUT-260309-082-01', mergeBatchId: '', mergeBatchNo: '', materialSku: 'FAB-SKU-SOLID-014', bindingState: 'BOUND' },
  { taskId: 'TASK-CUT-000088', taskNo: 'TASK-CUT-000088', executionOrderId: 'CPO-20260319-B-02', executionOrderNo: 'CPO-20260319-B-02', legacyCutPieceOrderNo: 'CPO-20260319-B-02', productionOrderId: 'PO-202603-082', productionOrderNo: 'PO-202603-082', originalCutOrderId: 'CUT-260309-082-02', originalCutOrderNo: 'CUT-260309-082-02', mergeBatchId: '', mergeBatchNo: '', materialSku: 'FAB-SKU-SOLID-014-B', bindingState: 'BOUND' },
  { taskId: 'TASK-CUT-000089', taskNo: 'TASK-CUT-000089', executionOrderId: 'CPO-20260319-C', executionOrderNo: 'CPO-20260319-C', legacyCutPieceOrderNo: 'CPO-20260319-C', productionOrderId: 'PO-202603-083', productionOrderNo: 'PO-202603-083', originalCutOrderId: 'CUT-260310-083-01', originalCutOrderNo: 'CUT-260310-083-01', mergeBatchId: 'merge-batch:MB-260323-01', mergeBatchNo: 'MB-260323-01', materialSku: 'FAB-SKU-DYE-022', bindingState: 'BOUND' },
  { taskId: 'TASK-CUT-000090', taskNo: 'TASK-CUT-000090', executionOrderId: 'CPO-20260319-D', executionOrderNo: 'CPO-20260319-D', legacyCutPieceOrderNo: 'CPO-20260319-D', productionOrderId: 'PO-202603-083', productionOrderNo: 'PO-202603-083', originalCutOrderId: 'CUT-260310-083-02', originalCutOrderNo: 'CUT-260310-083-02', mergeBatchId: '', mergeBatchNo: '', materialSku: 'FAB-SKU-PRINT-008', bindingState: 'BOUND' },
  { taskId: 'TASK-CUT-000091', taskNo: 'TASK-CUT-000091', executionOrderId: 'CPO-20260319-E', executionOrderNo: 'CPO-20260319-E', legacyCutPieceOrderNo: 'CPO-20260319-E', productionOrderId: 'PO-202603-084', productionOrderNo: 'PO-202603-084', originalCutOrderId: 'CUT-260311-084-01', originalCutOrderNo: 'CUT-260311-084-01', mergeBatchId: '', mergeBatchNo: '', materialSku: 'FAB-SKU-LINING-003', bindingState: 'BOUND' },
  { taskId: 'TASK-CUT-000092', taskNo: 'TASK-CUT-000092', executionOrderId: 'CPO-20260319-F', executionOrderNo: 'CPO-20260319-F', legacyCutPieceOrderNo: 'CPO-20260319-F', productionOrderId: 'PO-202603-085', productionOrderNo: 'PO-202603-085', originalCutOrderId: 'CUT-260312-085-01', originalCutOrderNo: 'CUT-260312-085-01', mergeBatchId: '', mergeBatchNo: '', materialSku: 'FAB-SKU-SOLID-021', bindingState: 'BOUND' },
  { taskId: 'TASK-CUT-000092', taskNo: 'TASK-CUT-000092', executionOrderId: 'CPO-20260319-F-02', executionOrderNo: 'CPO-20260319-F-02', legacyCutPieceOrderNo: 'CPO-20260319-F-02', productionOrderId: 'PO-202603-085', productionOrderNo: 'PO-202603-085', originalCutOrderId: 'CUT-260312-085-02', originalCutOrderNo: 'CUT-260312-085-02', mergeBatchId: '', mergeBatchNo: '', materialSku: 'FAB-SKU-SOLID-021-B', bindingState: 'BOUND' },
  { taskId: 'TASK-CUT-000093', taskNo: 'TASK-CUT-000093', executionOrderId: 'CPO-20260319-G', executionOrderNo: 'CPO-20260319-G', legacyCutPieceOrderNo: 'CPO-20260319-G', productionOrderId: 'PO-202603-084', productionOrderNo: 'PO-202603-084', originalCutOrderId: 'CUT-260311-084-02', originalCutOrderNo: 'CUT-260311-084-02', mergeBatchId: '', mergeBatchNo: '', materialSku: 'FAB-SKU-PRINT-017', bindingState: 'BOUND' },
  { taskId: 'TASK-CUT-000094', taskNo: 'TASK-CUT-000094', executionOrderId: 'CPO-20260319-H', executionOrderNo: 'CPO-20260319-H', legacyCutPieceOrderNo: 'CPO-20260319-H', productionOrderId: 'PO-202603-086', productionOrderNo: 'PO-202603-086', originalCutOrderId: 'CUT-260313-086-01', originalCutOrderNo: 'CUT-260313-086-01', mergeBatchId: '', mergeBatchNo: '', materialSku: 'FAB-SKU-DYE-009', bindingState: 'BOUND' },
  { taskId: 'TASK-CUT-000095', taskNo: 'TASK-CUT-000095', executionOrderId: 'CPO-20260319-I', executionOrderNo: 'CPO-20260319-I', legacyCutPieceOrderNo: 'CPO-20260319-I', productionOrderId: 'PO-202603-086', productionOrderNo: 'PO-202603-086', originalCutOrderId: 'CUT-260313-086-02', originalCutOrderNo: 'CUT-260313-086-02', mergeBatchId: '', mergeBatchNo: '', materialSku: 'FAB-SKU-PRINT-021', bindingState: 'BOUND' },
  { taskId: 'TASK-CUT-000096', taskNo: 'TASK-CUT-000096', executionOrderId: 'CPO-20260319-J', executionOrderNo: 'CPO-20260319-J', legacyCutPieceOrderNo: 'CPO-20260319-J', productionOrderId: 'PO-202603-087', productionOrderNo: 'PO-202603-087', originalCutOrderId: 'CUT-260314-087-01', originalCutOrderNo: 'CUT-260314-087-01', mergeBatchId: '', mergeBatchNo: '', materialSku: 'FAB-SKU-SOLID-033', bindingState: 'BOUND' },
  { taskId: 'TASK-CUT-000097', taskNo: 'TASK-CUT-000097', executionOrderId: 'CPO-20260319-K', executionOrderNo: 'CPO-20260319-K', legacyCutPieceOrderNo: 'CPO-20260319-K', productionOrderId: 'PO-202603-087', productionOrderNo: 'PO-202603-087', originalCutOrderId: 'CUT-260314-087-02', originalCutOrderNo: 'CUT-260314-087-02', mergeBatchId: '', mergeBatchNo: '', materialSku: 'FAB-SKU-LINING-007', bindingState: 'BOUND' },
  { taskId: 'TASK-CUT-000098', taskNo: 'TASK-CUT-000098', executionOrderId: 'CPO-20260319-L', executionOrderNo: 'CPO-20260319-L', legacyCutPieceOrderNo: 'CPO-20260319-L', productionOrderId: 'PO-202603-088', productionOrderNo: 'PO-202603-088', originalCutOrderId: 'CUT-260315-088-01', originalCutOrderNo: 'CUT-260315-088-01', mergeBatchId: '', mergeBatchNo: '', materialSku: 'FAB-SKU-PRINT-031', bindingState: 'BOUND' },
  { taskId: 'TASK-CUT-BID-017', taskNo: 'TASK-CUT-BID-017', executionOrderId: 'CPO-20260321-Q', executionOrderNo: 'CPO-20260321-Q', legacyCutPieceOrderNo: 'CPO-20260321-Q', productionOrderId: 'PO-202603-088', productionOrderNo: 'PO-202603-088', originalCutOrderId: 'CUT-260315-088-02', originalCutOrderNo: 'CUT-260315-088-02', mergeBatchId: 'merge-batch:MB-260323-02', mergeBatchNo: 'MB-260323-02', materialSku: 'FAB-SKU-PRINT-033', bindingState: 'BOUND' },
  { taskId: 'TASK-CUT-BID-201', taskNo: 'TASK-CUT-BID-201', executionOrderId: 'CPO-20260322-M', executionOrderNo: 'CPO-20260322-M', legacyCutPieceOrderNo: 'CPO-20260322-M', productionOrderId: 'PO-202603-088', productionOrderNo: 'PO-202603-088', originalCutOrderId: '', originalCutOrderNo: '', mergeBatchId: '', mergeBatchNo: '', materialSku: 'FAB-SKU-PRINT-041', bindingState: 'UNBOUND' },
]

export function listPdaCuttingExecutionSourceRecords(): PdaCuttingExecutionSourceRecord[] {
  return PDA_CUTTING_EXECUTION_SOURCE_RECORDS.map((record) => ({ ...record }))
}

export function getPdaCuttingExecutionSourceRecord(taskId: string, executionOrderNo: string): PdaCuttingExecutionSourceRecord | null {
  return PDA_CUTTING_EXECUTION_SOURCE_RECORDS.find((record) => record.taskId === taskId && record.executionOrderNo === executionOrderNo) ?? null
}

export function listPdaCuttingTaskSourceRecords(): PdaCuttingTaskSourceRecord[] {
  const grouped = new Map<string, PdaCuttingTaskSourceRecord>()

  PDA_CUTTING_EXECUTION_SOURCE_RECORDS.forEach((record) => {
    const current = grouped.get(record.taskId)
    if (current) {
      if (!current.executionOrderIds.includes(record.executionOrderId)) current.executionOrderIds.push(record.executionOrderId)
      if (!current.executionOrderNos.includes(record.executionOrderNo)) current.executionOrderNos.push(record.executionOrderNo)
      if (current.bindingState !== 'UNBOUND' && record.bindingState === 'UNBOUND') {
        current.bindingState = 'UNBOUND'
      }
      return
    }

    grouped.set(record.taskId, {
      taskId: record.taskId,
      taskNo: record.taskNo,
      productionOrderId: record.productionOrderId,
      productionOrderNo: record.productionOrderNo,
      executionOrderIds: [record.executionOrderId],
      executionOrderNos: [record.executionOrderNo],
      bindingState: record.bindingState,
    })
  })

  return Array.from(grouped.values()).map((record) => ({
    ...record,
    executionOrderIds: [...record.executionOrderIds],
    executionOrderNos: [...record.executionOrderNos],
  }))
}

export function getPdaCuttingTaskSourceRecord(taskId: string): PdaCuttingTaskSourceRecord | null {
  return listPdaCuttingTaskSourceRecords().find((record) => record.taskId === taskId) ?? null
}
