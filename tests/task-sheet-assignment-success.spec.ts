import { test, expect } from '@playwright/test'
import fs from 'node:fs/promises'

// Isolated command-to-render acceptance: calls the same fact commands as the workbench.
// It does not claim that the dispatch form or automatic-config buttons were clicked.
for (const mode of ['DIRECT', 'AUTO', 'AWARD', 'HISTORY'] as const) {
  test(`TASK003-007 ${mode}: successful assignment immediately enables actual print entry`, async ({ page }) => {
    test.setTimeout(180000)
    await fs.mkdir('output/playwright/task-sheet-assignment-success', {recursive:true})
    await page.goto('/fcs/dispatch/workbench?keyword=PO-DEMO-')
    await expect(page.locator('[data-unified-action="print-task-sheet"]').first()).toBeVisible({timeout:120000})
    const evidence = await page.evaluate(async mode => {
      const load=(name:string)=>import(/* @vite-ignore */ `/src/${name}.ts`)
      const runtime=await load('data/fcs/runtime-process-tasks')
      const effective=await load('data/fcs/effective-task-assignments')
      const policy=await load('data/fcs/task-fulfillment-policy')
      const merged=await load('data/fcs/merged-production-task')
      const factories=await load('data/fcs/factory-master-store')
      const pageModule=await load('pages/unified-dispatch-workbench')
      const sheets=await load('data/fcs/dispatch-task-sheet')
      let selected:any
      let before:any
      let operation=''
      if(mode==='HISTORY') {
        selected=runtime.listRuntimeProcessTasks().find((t:any)=>t.taskId==='TASK-SIMPLE-0916-PROC_SEW-A01')
        if(!selected)throw new Error('Missing historical sewing task')
        before=structuredClone(selected)
        const state=effective.captureEffectiveTaskAssignmentState()
        // Remove only the new index, retaining the existing authoritative assigned runtime fact.
        state.assignments=state.assignments.filter(([,a]:any)=>a.runtimeTaskId!==selected.taskId)
        state.current=state.current.filter(([id]:any)=>id!==selected.taskId)
        state.stored=JSON.stringify({version:2,assignments:state.assignments,current:state.current,auditLogs:state.auditLogs,assignmentSeq:state.assignmentSeq,auditSeq:state.auditSeq})
        effective.restoreEffectiveTaskAssignmentState(state)
        if(effective.listEffectiveTaskAssignments(selected.taskId).length)throw new Error('Historical index was not removed')
        operation='existing assigned runtime fact, missing newly introduced assignment index'
      } else {
        const tasks=runtime.listRuntimeProcessTasks().filter((t:any)=>{
          const p=policy.classifyTaskFulfillmentPolicy(t)
          return t.assignmentStatus==='UNASSIGNED' && merged.isAssignableProductionExecutionTask(t) && p.isIndependentTask && !p.startsWithSewing && t.taskUnitType==='SINGLE_PROCESS_TASK' && t.allowAutoDispatch!==false && t.standardPrice>0
        })
        const errors:string[]=[]
        outer: for(const task of tasks) {
          const codes=new Set(policy.classifyTaskFulfillmentPolicy(task).normalizedProcessCodes.map(merged.normalizeProductionExecutionProcessCode))
          for(const factory of factories.listBusinessFactoryMasterRecords().filter((f:any)=>f.status==='active'&&f.eligibility.allowDispatch&&f.taskAcceptanceConfig?.singleProcessEnabled&&f.processAbilities.some((a:any)=>a.status!=='DISABLED'&&a.canReceiveTask!==false&&codes.has(merged.normalizeProductionExecutionProcessCode(a.processCode)))&&(mode!=='AWARD'||f.eligibility.allowBid&&f.pdaEnabled))) {
            const input={taskId:task.taskId,factoryId:factory.id,factoryName:factory.name,acceptDeadline:'',taskDeadline:'2026-09-30 18:00:00',remark:'任务单可打印验收',by:mode==='AUTO'?'生产计划员（自动分配）':'任务单验收计划员',dispatchPrice:task.standardPrice,dispatchPriceCurrency:task.standardPriceCurrency||'IDR',dispatchPriceUnit:task.standardPriceUnit||'件',priceDiffReason:'',businessAssignedAt:'2026-09-16 10:00:00',operatedAt:'2026-09-16 10:00:00',autoAccept:false}
            try { runtime.prepareRuntimeDirectDispatchMeta(input) } catch(e) {errors.push(String(e));continue}
            before=structuredClone(task)
            if(mode==='AWARD') {
              runtime.upsertRuntimeTaskTender(task.taskId,{tenderId:`PRINT-ACCEPTANCE-${task.taskId}`,biddingDeadline:'2026-09-16 09:00:00',taskDeadline:input.taskDeadline,businessAssignedAt:input.businessAssignedAt,assignmentOperatedAt:input.operatedAt},input.by)
              selected=runtime.awardRuntimeTaskTender({taskId:task.taskId,factoryId:factory.id,factoryName:factory.name,awardedAt:input.operatedAt,awardedPrice:task.standardPrice,by:input.by,riskConfirmed:true,supervisorAssigned:true})
              operation='upsertRuntimeTaskTender → awardRuntimeTaskTender'
            } else {selected=runtime.applyRuntimeDirectDispatchMeta(input);operation='applyRuntimeDirectDispatchMeta (same command as executeAutomaticDispatch when AUTO)'}
            break outer
          }
        }
        if(!selected)throw new Error(`No legal task candidate: ${errors.slice(0,5).join(';')}`)
      }
      history.replaceState(null,'',`/fcs/dispatch/workbench?keyword=${encodeURIComponent(selected.taskNo||selected.taskId)}`)
      // Call the actual current page renderer in the same command turn, before reload or acceptance/start.
      const html=pageModule.renderUnifiedDispatchWorkbenchPage()
      const doc=new DOMParser().parseFromString(html,'text/html')
      const button=doc.querySelector<HTMLButtonElement>(`[data-unified-action="print-task-sheet"][data-task-id="${selected.taskId}"]`)
      if(!button || button.disabled)throw new Error('Print entry unavailable immediately after fact command')
      const assignment=sheets.listDispatchTaskSheetAssignments(selected.taskId)[0]
      const data=sheets.buildDispatchTaskSheetData(assignment.assignmentId)
      const contracts=await load('data/fcs/production-contracts')
      const responsibility=await load('data/fcs/sewing-cut-piece-responsibility')
      const signedScanCount=contracts.listProductionContracts({runtimeTaskId:selected.taskId}).reduce((sum:number,c:any)=>sum+c.scans.length,0)
      const cutReceiptCount=responsibility.listSewingCutPieceHandoverEvents(assignment.assignmentId).length
      return {mode,operation,signedScanCount,cutReceiptCount,taskId:selected.taskId,taskNo:selected.taskNo,orderId:selected.productionOrderId,beforeStatus:before.assignmentStatus,status:runtime.getRuntimeTaskById(selected.taskId).assignmentStatus,acceptanceStatus:runtime.getRuntimeTaskById(selected.taskId).acceptanceStatus,executionStatus:runtime.getRuntimeTaskById(selected.taskId).status,startedAt:runtime.getRuntimeTaskById(selected.taskId).startedAt||null,indexedRuntimeSnapshot:assignment.indexedRuntimeSnapshot||false,source:assignment.source,operatedBy:assignment.operatedBy,taskSheetNo:data.taskSheetNo,printImmediatelyEnabled:!button.disabled}
    },mode)
    expect(evidence.printImmediatelyEnabled).toBe(true)
    if(mode==='AWARD')expect(evidence.source).toBe('TENDER_AWARD')
    if(mode==='AUTO')expect(evidence.operatedBy).toContain('自动分配')
    if(mode==='HISTORY') {
      expect(evidence.indexedRuntimeSnapshot).toBe(true)
      expect(evidence.acceptanceStatus).toBe('PENDING')
      expect(evidence.executionStatus).toBe('NOT_STARTED')
      expect(evidence.startedAt).toBeNull()
      expect(evidence.signedScanCount).toBe(0)
      expect(evidence.cutReceiptCount).toBe(0)
    }
    await fs.writeFile(`output/playwright/task-sheet-assignment-success/${mode}.json`,JSON.stringify(evidence,null,2))
    await page.goto(`/fcs/dispatch/workbench?keyword=${encodeURIComponent(evidence.taskNo||evidence.taskId)}`)
    const button=page.locator(`[data-unified-action="print-task-sheet"][data-task-id="${evidence.taskId}"]`)
    await expect(button).toBeEnabled({timeout:120000})
    await page.screenshot({path:`output/playwright/task-sheet-assignment-success/${mode}-entry.png`,fullPage:true})
    await button.click()
    await expect(page.locator('body')).toContainText(evidence.taskSheetNo,{timeout:120000})
    await expect(page).toHaveURL(/documentType=DISPATCH_TASK_SHEET/)
    await page.screenshot({path:`output/playwright/task-sheet-assignment-success/${mode}-print.png`,fullPage:true})
  })
}
