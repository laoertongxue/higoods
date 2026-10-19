# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: post-finishing-full-flow.spec.ts >> 车缝自助回货只进入当前专用确认页，不再注入通用交接旧事实
- Location: tests/post-finishing-full-flow.spec.ts:508:1

# Error details

```
Error: expect(locator).toContainText(expected) failed

Locator: locator('body')
- Expected substring  -  1
+ Received string     + 67

- PO-QC-202608-001-5
+
+     
+       
+         
+     
+       
+         
+         
+       
+       
+         
+           
+           
+             
+             
+             
+             
+           
+         
+         
+           
+           
+           
+             
+             
+             
+             
+           
+         
+       
+       
+         
+               
+                 
+                 接单
+               
+             
+               
+                 
+                 执行
+               
+             
+               
+                 
+                 交接
+               
+             
+               
+                 
+                 仓管
+               
+             
+               
+                 
+                 结算
+               
+             
+       
+     
+   
+       
+     
+     
+     
+   
+
+

Call log:
  - Expect "toContainText" with timeout 10000ms
  - waiting for locator('body')
    5 × locator resolved to <body>…</body>
      - unexpected value "
    
      
        
    
      
        
        
      
      
        
          
          
            
            
            
            
          
        
        
          
          
          
            
            
            
            
          
        
      
      
        
              
                
                接单
              
            
              
                
                执行
              
            
              
                
                交接
              
            
              
                
                仓管
              
            
              
                
                结算
              
            
      
    
  
      
    
    
    
  

"

```

```yaml
- main
- navigation: 接单 执行 交接 仓管 结算
```

# Test source

```ts
  424 | 
  425 |   await setCurrentWebActor(page, 'PF-USER-QC-B')
  426 |   await page.goto('/fcs/craft/post-finishing/qc-workbench')
  427 |   await page.locator('[data-post-finishing-field="qc-task-input"]').fill(seed.qcTaskNo)
  428 |   await page.getByRole('button', { name: '领取质检单', exact: true }).click()
  429 |   await expect(page.getByRole('alert')).toContainText('已由 李质检员 质检中')
  430 |   await expect(page.locator('[data-post-finishing-field="qc-task-input"]')).toHaveValue(seed.qcTaskNo)
  431 |   await setCurrentWebActor(page, 'PF-USER-QC-A')
  432 |   await page.goto('/fcs/craft/post-finishing/qc-workbench')
  433 |   await expect(page.locator('[data-qc-workbench-task]')).toBeVisible()
  434 |   await expect(page.getByRole('button', { name: '错误领取，退回待质检' })).toHaveCount(0)
  435 | })
  436 | 
  437 | test('公共 PDA 回货登记允许部分 SKU，阻断负数并展示真实图片', async ({ page }, testInfo) => {
  438 |   const seed = await seedBrowserFlow(page)
  439 |   await page.setViewportSize({ width: 360, height: 800 })
  440 |   await setSession(page)
  441 |   await page.goto('/fcs/pda/handover/sewing-self-return')
  442 |   await page.locator('[data-pda-sewing-self-return-field="scanValue"]').fill(seed.returnScan)
  443 |   await page.locator('[data-pda-sewing-self-return-field="scanValue"]').press('Enter')
  444 |   await expect(page.locator('[data-return-sku-card]')).toHaveCount(5)
  445 |   await expect(page.locator('body')).toContainText('来源任务')
  446 |   await expect(page.locator('body')).toContainText('暂存')
  447 |   await expect(page.locator('body')).toContainText('本来源可登记')
  448 |   await expect(page.getByRole('button', { name: '管理员退出' })).toBeVisible()
  449 |   await expectImagesLoaded(page)
  450 |   const quantities = page.locator('[data-pda-sewing-self-return-field="quantity"]')
  451 |   await quantities.first().fill('-1')
  452 |   await expect(page.locator('[data-return-quantity-error]')).toContainText('不小于 0')
  453 |   await expect(quantities.first()).toHaveAttribute('aria-invalid', 'true')
  454 |   for (let index = 0; index < 5; index += 1) await quantities.nth(index).fill('20')
  455 |   await quantities.first().fill('0')
  456 |   await expect(quantities.first()).toHaveAttribute('aria-invalid', 'false')
  457 |   await page.locator('[data-pda-sewing-self-return-field="deliveryPersonName"]').fill('苏车缝送货员')
  458 |   await page.locator('[data-pda-sewing-self-return-field="deliveryPersonPhone"]').fill('0812888888')
  459 |   await page.getByRole('button', { name: '加载原型验收凭证' }).click()
  460 |   await attachPageEvidence(page, testInfo, 'public-pda-return-registration')
  461 |   await page.getByRole('button', { name: '提交本次回货登记' }).click()
  462 |   await expect(page.getByRole('status')).toContainText('登记成功')
  463 |   const latestReturn = page.locator('[data-self-return-recent]').first()
  464 |   await expect(latestReturn.getByText('SKU 明细（5）')).toBeVisible()
  465 |   await expect(latestReturn.locator('img')).toHaveCount(5)
  466 |   await expect(latestReturn.getByRole('button', { name: '查看并确认' })).toBeVisible()
  467 |   let promptHandled = false
  468 |   page.on('dialog', async (dialog) => {
  469 |     if (dialog.type() === 'prompt') {
  470 |       promptHandled = true
  471 |       await dialog.accept('车缝工厂登记错了回货批次')
  472 |       return
  473 |     }
  474 |     await dialog.accept()
  475 |   })
  476 |   await latestReturn.getByRole('button', { name: '废弃本次回货' }).click()
  477 |   expect(promptHandled).toBe(true)
  478 |   await expect(page.getByRole('status')).toContainText('已废弃')
  479 |   await expect(page.locator('[data-self-return-recent]').first()).toContainText('车缝工厂登记错了回货批次')
  480 |   await verifyPdaAtBothSizes(page)
  481 |   await page.getByRole('button', { name: '管理员退出' }).click()
  482 |   await expect(page).toHaveURL(/\/fcs\/pda\/handover\?tab=pickup/)
  483 | })
  484 | 
  485 | test('Web 回货详情在最终确认后仍展示逐 SKU 明细，未确认记录可废弃', async ({ page }, testInfo) => {
  486 |   const seed = await seedBrowserFlow(page)
  487 |   await page.setViewportSize({ width: 1366, height: 768 })
  488 |   await page.goto(`/fcs/craft/post-finishing/wait-process-warehouse?tab=returns&deliveryId=${encodeURIComponent(seed.pendingDeliveryId)}`)
  489 |   await expect(page.locator('[data-return-count-line]')).toHaveCount(5)
  490 |   await expect(page.locator('body')).toContainText('回货方式')
  491 |   await expect(page.getByRole('button', { name: '废弃回货记录' })).toBeVisible()
  492 |   page.on('dialog', async (dialog) => {
  493 |     if (dialog.type() === 'prompt') {
  494 |       await dialog.accept('Web 核对发现回货批次登记错误')
  495 |       return
  496 |     }
  497 |     await dialog.accept()
  498 |   })
  499 |   await page.getByRole('button', { name: '废弃回货记录' }).click()
  500 |   await expect(page.getByRole('status')).toContainText('回货记录已废弃')
  501 |   await expect(page.locator('[data-return-readonly-line]')).toHaveCount(5)
  502 |   await expect(page.locator('body')).toContainText('Web 核对发现回货批次登记错误')
  503 |   await expect(page.locator('body')).toContainText('未形成最终确认')
  504 |   await expect(page.getByRole('button', { name: '确认送检出库' })).toHaveCount(0)
  505 |   await attachPageEvidence(page, testInfo, 'web-return-discarded-sku-detail')
  506 | })
  507 | 
  508 | test('车缝自助回货只进入当前专用确认页，不再注入通用交接旧事实', async ({ page }) => {
  509 |   const seed = await seedBrowserFlow(page)
  510 |   await page.goto('/fcs/pda/warehouse')
  511 |   await setSession(page, {
  512 |     ...PDA_SESSION,
  513 |     userId: 'PF-DEDICATED-001_admin',
  514 |     loginId: 'PF-DEDICATED-001_admin',
  515 |     userName: 'HiGood 后道工厂_管理员',
  516 |     roleId: 'ROLE_ADMIN',
  517 |     factoryId: 'PF-DEDICATED-001',
  518 |     factoryName: 'HiGood 后道工厂',
  519 |   })
  520 |   await page.goto('/fcs/pda/handover?tab=pickup')
  521 |   await expect(page.locator('body')).not.toContainText(seed.pendingDeliveryNo)
  522 | 
  523 |   await page.goto('/fcs/pda/warehouse/wait-process')
> 524 |   await expect(page.locator('body')).toContainText(seed.pendingDeliveryNo)
      |                                      ^ Error: expect(locator).toContainText(expected) failed
  525 |   await expect(page.locator('[data-nav="/fcs/pda/post-finishing/return-confirm"]').filter({ hasText: '扫描送货单确认回货' }).first()).toBeVisible()
  526 |   await expect(page.getByRole('button', { name: '确认入库', exact: true })).toHaveCount(0)
  527 | })
  528 | 
  529 | test('PDA 回货确认执行超 5%二次点数、授权和真实账号记录', async ({ page }, testInfo) => {
  530 |   const seed = await seedBrowserFlow(page)
  531 |   await page.setViewportSize({ width: 400, height: 806 })
  532 |   await setSession(page)
  533 |   await page.goto('/fcs/pda/post-finishing/return-confirm')
  534 |   const scanner = page.locator('[data-pda-post-field="returnScan"]')
  535 |   await scanner.fill(seed.pendingDeliveryNo.slice(0, -1))
  536 |   await scanner.press('Enter')
  537 |   await expect(page.getByRole('status')).toContainText('未找到完整后道送货单号')
  538 |   await page.locator('[data-pda-post-field="returnScan"]').fill(seed.pendingDeliveryNo)
  539 |   await page.getByRole('button', { name: '查询' }).click()
  540 |   await expect(page.locator('[data-return-confirm-line]')).toHaveCount(5)
  541 |   await expect(page.locator('body')).toContainText('分母固定为工厂登记数量')
  542 |   await expect(page.locator('[data-difference-authorization-block="return"]')).toBeHidden()
  543 |   await expectImagesLoaded(page)
  544 |   await page.locator('[data-return-first-count]').first().fill('18')
  545 |   await expect(page.locator('[data-quantity-summary="return-line"]').first()).toContainText('差异率 10.00%')
  546 |   await page.getByRole('button', { name: '提交第一次点数' }).click()
  547 |   await expect(page.getByRole('status')).toContainText('请重新点数')
  548 |   await expect(page.getByRole('button', { name: '提交第二次点数' })).toBeVisible()
  549 |   await page.getByRole('button', { name: '提交第二次点数' }).click()
  550 |   await expect(page.getByRole('status')).toContainText('必须扫描动态授权码')
  551 |   await expect(page.locator('[data-difference-authorization-block="return"]')).toBeVisible()
  552 | 
  553 |   const authorization = await page.evaluate(async () => {
  554 |     const auth = await import('/src/data/fcs/post-finishing-authorization.ts')
  555 |     return auth.getPostFinishingAuthorizationDisplay('AUTH-QC-001').scanPayload
  556 |   })
  557 |   await page.locator('[data-return-difference-reason]').fill('复点后仍少 2 件')
  558 |   await page.locator('[data-return-authorization]').fill(authorization)
  559 |   await attachPageEvidence(page, testInfo, 'pda-return-confirm-authorization')
  560 |   await page.getByRole('button', { name: '授权并确认回货' }).click()
  561 |   await expect(page.getByRole('status')).toContainText('回货确认成功')
  562 |   await expect(page.locator('body')).toContainText('回货已由 全能力测试工厂_操作工 确认')
  563 |   await expect(page.locator('body')).toContainText('质检单')
  564 |   await verifyPdaAtBothSizes(page)
  565 |   await page.setViewportSize({ width: 1366, height: 768 })
  566 |   await page.goto(`/fcs/craft/post-finishing/wait-process-warehouse?tab=returns&deliveryId=${encodeURIComponent(seed.pendingDeliveryId)}`)
  567 |   await expect(page.getByRole('heading', { name: 'SPU 技术参数在质检单统一维护' })).toHaveCount(0)
  568 |   await expect(page.locator('[data-return-readonly-line]')).toHaveCount(5)
  569 |   await expect(page.locator('[data-qc-reference-file]')).toHaveCount(0)
  570 |   await expect(page.getByRole('link', { name: '前往质检单维护' })).toHaveCount(0)
  571 |   await page.getByRole('button', { name: '确认送检出库' }).click()
  572 |   await expect(page.getByRole('status')).toContainText('送检成功')
  573 |   await expect(page.locator('[data-nav*="print?type=SEND_QC"]')).toBeVisible()
  574 | })
  575 | 
  576 | async function registerPdaItem(page: Page, processItem: string, firstQuantity?: number, skipFirst = false): Promise<void> {
  577 |   const card = page.locator(`[data-post-process="${processItem}"]`)
  578 |   if ((await card.getAttribute('open')) === null) await card.locator(':scope > summary').click()
  579 |   const inputs = card.locator('[data-post-process-qty]')
  580 |   for (let index = 0; index < await inputs.count(); index++) {
  581 |     const input = inputs.nth(index)
  582 |     if (await input.isDisabled()) continue
  583 |     const maximum = Number(await input.getAttribute('max') || '0')
  584 |     await input.fill(String(index === 0 && skipFirst ? 0 : index === 0 && firstQuantity !== undefined ? firstQuantity : maximum))
  585 |   }
  586 |   await card.locator('[data-pda-post-action="save-process-completion"]').click()
  587 |   await expect(page.locator('[data-pda-post-task] [role="status"]')).toContainText(`${processItem}本次已保存`)
  588 | }
  589 | 
  590 | async function submitPdaAvailable(page: Page): Promise<void> {
  591 |   const form = page.locator('[data-post-recheck-form]')
  592 |   if ((await form.getAttribute('open')) === null) await form.locator(':scope > summary').click()
  593 |   for (const input of await form.locator('[data-post-recheck-qty]:not([disabled])').all()) await input.fill(await input.getAttribute('max') || '0')
  594 |   page.once('dialog', dialog => dialog.accept())
  595 |   await page.locator('[data-pda-post-action="submit-for-recheck"]').click()
  596 |   await expect(page.locator('[data-pda-post-task] [role="status"]')).toContainText('已交复检')
  597 | }
  598 | 
  599 | test('PDA精确扫码后按四项增量登记，部分完成可交复检且保留正常在制', async ({ page }, testInfo) => {
  600 |   const seed = await seedBrowserFlow(page)
  601 |   await page.setViewportSize({ width: 360, height: 800 })
  602 |   await setSession(page)
  603 |   await page.goto('/fcs/pda/post-finishing/execute')
  604 |   await page.locator('[data-pda-post-field="postScan"]').fill(seed.postTaskNo)
  605 |   await page.locator('[data-pda-post-field="postScan"]').press('Enter')
  606 |   await expect(page.locator('[data-post-process]')).toHaveCount(4)
  607 |   await expect(page.locator('[data-post-processed-qty]')).toHaveCount(0)
  608 |   await expect(page.locator('[data-pda-post-action="toggle-process-item"]')).toHaveCount(0)
  609 |   const firstProcess = page.locator('[data-post-process="开扣眼"]')
  610 |   if ((await firstProcess.getAttribute('open')) === null) await firstProcess.locator(':scope > summary').click()
  611 |   await expectImagesLoaded(page)
  612 |   await page.locator('[data-pda-post-action="zoom-image"]').first().click()
  613 |   await expect(page.getByRole('dialog')).toBeVisible()
  614 |   await page.keyboard.press('Escape')
  615 |   for (const item of ['开扣眼', '装扣子', '熨烫', '包装']) await registerPdaItem(page, item, 19)
  616 |   await submitPdaAvailable(page)
  617 |   const result = await page.evaluate(async id => {
  618 |     const flow = await import('/src/data/fcs/post-finishing-full-flow.ts')
  619 |     return { task: flow.getPostFinishingFullFlowPostTask(id), progress: flow.getPostFinishingProcessProgress(id) }
  620 |   }, seed.postTaskNo)
  621 |   expect(result.task?.status).toBe('后道中')
  622 |   expect(result.progress.totalCompletedQty).toBe(99)
  623 |   expect(result.progress.totalReservedQty).toBe(99)
  624 |   expect(result.progress.records).toHaveLength(4)
```