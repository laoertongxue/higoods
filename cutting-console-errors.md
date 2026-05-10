Total messages: 3 (Errors: 0, Warnings: 0)
Returning 2 messages for level "error"

[ERROR] 路由模块加载失败，进入降级页 ReferenceError: buildDemoSpreadingOutputLines is not defined
    at listSpreadingPieceOutputLines (http://localhost:5173/src/data/fcs/cutting/generated-fei-tickets.ts?t=1778391554441:557:21)
    at buildFeiRecordsFromSpreadingSessions (http://localhost:5173/src/data/fcs/cutting/generated-fei-tickets.ts?t=1778391554441:324:23)
    at getGeneratedFeiTicketDataset (http://localhost:5173/src/data/fcs/cutting/generated-fei-tickets.ts?t=1778391554441:575:39)
    at getGeneratedFeiTicketMapByOriginalCutOrderId (http://localhost:5173/src/data/fcs/cutting/generated-fei-tickets.ts?t=1778391554441:614:20)
    at buildSystemSeedFeiTicketLedger (http://localhost:5173/src/pages/process-factory/cutting/fei-tickets-model.ts?t=1778391554441:851:30)
    at buildFeiLedger (http://localhost:5173/src/pages/process-factory/cutting/runtime-projections.ts?t=1778391554441:109:27)
    at mapCuttingDomainSnapshotToSummaryBuildOptions (http://localhost:5173/src/pages/process-factory/cutting/runtime-projections.ts?t=1778391554441:151:21)
    at buildExecutionPrepProjectionContext (http://localhost:5173/src/pages/process-factory/cutting/execution-prep-projection-helpers.ts?t=1778391554441:10:14)
    at buildMarkerSpreadingProjection (http://localhost:5173/src/pages/process-factory/cutting/marker-spreading-projection.ts?t=1778391554441:219:19)
    at readMarkerSpreadingPrototypeData (http://localhost:5173/src/pages/process-factory/cutting/marker-spreading-utils.ts?t=1778391554441:466:22) @ http://localhost:5173/src/main.ts?t=1778391554441:228
[ERROR] 路由模块加载失败，进入降级页 Error: 裁片 PDA 写回种子缺少任务执行对象：TASK-CUT-000088 / CPO-20260319-B
    at createSeedBase (http://localhost:5173/src/data/fcs/cutting/pda-execution-writeback-ledger.ts?t=1778391835152:116:11)
    at createSeededPdaExecutionWritebackStore (http://localhost:5173/src/data/fcs/cutting/pda-execution-writeback-ledger.ts?t=1778391835152:149:10)
    at deserializePdaExecutionWritebackStorage (http://localhost:5173/src/data/fcs/cutting/pda-execution-writeback-ledger.ts?t=1778391835152:397:18)
    at readCuttingPdaExecutionRuntimeState (http://localhost:5173/src/data/fcs/cutting/runtime-inputs.ts?t=1778391835152:125:17)
    at readCuttingRuntimeInputs (http://localhost:5173/src/data/fcs/cutting/runtime-inputs.ts?t=1778391835152:153:36)
    at buildFcsCuttingDomainSnapshot (http://localhost:5173/src/domain/fcs-cutting-runtime/domain-snapshot.ts?t=1778391835152:3:56)
    at getSnapshot (http://localhost:5173/src/data/fcs/pda-cutting-execution-source.ts?t=1778391835152:97:22)
    at listPdaTaskFlowProjectedTasks (http://localhost:5173/src/data/fcs/pda-cutting-execution-source.ts?t=1778391835152:963:27)
    at listPdaTaskFlowTasks (http://localhost:5173/src/data/fcs/pda-cutting-execution-source.ts?t=1778391835152:967:10)
    at listPdaMobileExecutionTasks (http://localhost:5173/src/data/fcs/process-mobile-task-binding.ts?t=1778391835152:166:21) @ http://localhost:5173/src/main.ts?t=1778391835152:228