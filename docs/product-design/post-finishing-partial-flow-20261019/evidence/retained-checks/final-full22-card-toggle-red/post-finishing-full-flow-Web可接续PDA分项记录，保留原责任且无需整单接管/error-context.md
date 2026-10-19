# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: post-finishing-full-flow.spec.ts >> Web可接续PDA分项记录，保留原责任且无需整单接管
- Location: tests/post-finishing-full-flow.spec.ts:654:1

# Error details

```
Test timeout of 60000ms exceeded.
```

```
Error: locator.fill: Test timeout of 60000ms exceeded.
Call log:
  - waiting for locator('[data-post-process="开扣眼"]').locator('[data-post-process-qty]').first()
    - locator resolved to <input min="0" max="20" step="1" value="0" type="number" inputmode="numeric" data-post-process-qty="" data-skip-page-rerender="true" aria-label="开扣眼 SPU-QC-001-01 本次完成数量" class="mt-1 h-12 w-full rounded-xl border px-3 text-right text-base"/>
    - fill("5")
  - attempting fill action
    2 × waiting for element to be visible, enabled and editable
      - element is not visible
    - retrying fill action
    - waiting 20ms
    2 × waiting for element to be visible, enabled and editable
      - element is not visible
    - retrying fill action
      - waiting 100ms
    113 × waiting for element to be visible, enabled and editable
        - element is not visible
      - retrying fill action
        - waiting 500ms

```

# Page snapshot

```yaml
- generic [ref=e4]:
  - banner [ref=e5]:
    - generic [ref=e6]:
      - button "返回" [ref=e7]:
        - generic [ref=e8]: ←
        - text: 返回
      - generic [ref=e9]:
        - generic [ref=e10]: 精确扫描后道加工单 · 全能力测试工厂_操作工
        - heading "后道加工" [level=1] [ref=e11]
  - main [ref=e12]:
    - generic [ref=e13]:
      - generic [ref=e14]:
        - button "重新扫描" [ref=e15]
        - generic [ref=e16]:
          - generic [ref=e17]:
            - generic [ref=e18]: PO-QC-202608-001-2-ZJ-HD
            - generic [ref=e19]: PO-QC-202608-001 · 第 2 次回货
          - generic [ref=e20]: 待后道
        - generic [ref=e21]: 实际加工顺序：开扣眼 → 装扣子 → 熨烫 → 包装
        - generic [ref=e22]:
          - generic [ref=e23]:
            - text: 应加工
            - generic [ref=e24]: 100 件
          - generic [ref=e25]:
            - text: 全部后道完成
            - generic [ref=e26]: 0 件
          - generic [ref=e27]:
            - text: 已交复检占用
            - generic [ref=e28]: 0 件
          - generic [ref=e29]:
            - text: 可交复检
            - generic [ref=e30]: 0 件
      - generic [ref=e31]:
        - strong [ref=e32]: 后道辅料未到齐。
        - generic [ref=e33]: 后道辅料已由辅料仓备妥，请领料并完成入库。当前仅提示，不阻断登记。
      - region "各加工项数量" [ref=e34]:
        - group [ref=e35]:
          - generic "开扣眼 0 / 100 件 待加工" [active] [ref=e36] [cursor=pointer]:
            - generic [ref=e37]: 开扣眼
            - generic [ref=e38]:
              - text: 0 / 100 件
              - generic [ref=e39]: 待加工
        - group [ref=e40]:
          - generic "装扣子 0 / 100 件 待加工" [ref=e41] [cursor=pointer]:
            - generic [ref=e42]: 装扣子
            - generic [ref=e43]:
              - text: 0 / 100 件
              - generic [ref=e44]: 待加工
        - group [ref=e45]:
          - generic "熨烫 0 / 100 件 待加工" [ref=e46] [cursor=pointer]:
            - generic [ref=e47]: 熨烫
            - generic [ref=e48]:
              - text: 0 / 100 件
              - generic [ref=e49]: 待加工
        - group [ref=e50]:
          - generic "包装 0 / 100 件 待加工" [ref=e51] [cursor=pointer]:
            - generic [ref=e52]: 包装
            - generic [ref=e53]:
              - text: 0 / 100 件
              - generic [ref=e54]: 待加工
      - group [ref=e55]:
        - generic "交复检 · 当前可交 0 件" [ref=e56] [cursor=pointer]
      - generic [ref=e57]:
        - heading "复检记录（0 张）" [level=2] [ref=e58]
        - paragraph [ref=e60]: 尚未交复检。
      - generic [ref=e61]:
        - heading "出货记录（0 张）" [level=2] [ref=e62]
        - paragraph [ref=e64]: 尚未生成出货单。
```

# Test source

```ts
  560 |     return auth.getPostFinishingAuthorizationDisplay('AUTH-QC-001').scanPayload
  561 |   })
  562 |   await page.locator('[data-return-difference-reason]').fill('复点后仍少 2 件')
  563 |   await page.locator('[data-return-authorization]').fill(authorization)
  564 |   await attachPageEvidence(page, testInfo, 'pda-return-confirm-authorization')
  565 |   await page.getByRole('button', { name: '授权并确认回货' }).click()
  566 |   await expect(page.getByRole('status')).toContainText('回货确认成功')
  567 |   await expect(page.locator('body')).toContainText('回货已由 全能力测试工厂_操作工 确认')
  568 |   await expect(page.locator('body')).toContainText('质检单')
  569 |   await verifyPdaAtBothSizes(page)
  570 |   await page.setViewportSize({ width: 1366, height: 768 })
  571 |   await page.goto(`/fcs/craft/post-finishing/wait-process-warehouse?tab=returns&deliveryId=${encodeURIComponent(seed.pendingDeliveryId)}`)
  572 |   await expect(page.getByRole('heading', { name: 'SPU 技术参数在质检单统一维护' })).toHaveCount(0)
  573 |   await expect(page.locator('[data-return-readonly-line]')).toHaveCount(5)
  574 |   await expect(page.locator('[data-qc-reference-file]')).toHaveCount(0)
  575 |   await expect(page.getByRole('link', { name: '前往质检单维护' })).toHaveCount(0)
  576 |   await page.getByRole('button', { name: '确认送检出库' }).click()
  577 |   await expect(page.getByRole('status')).toContainText('送检成功')
  578 |   await expect(page.locator('[data-nav*="print?type=SEND_QC"]')).toBeVisible()
  579 | })
  580 | 
  581 | async function registerPdaItem(page: Page, processItem: string, firstQuantity?: number, skipFirst = false): Promise<void> {
  582 |   const card = page.locator(`[data-post-process="${processItem}"]`)
  583 |   if ((await card.getAttribute('open')) === null) await card.locator(':scope > summary').click()
  584 |   const inputs = card.locator('[data-post-process-qty]')
  585 |   for (let index = 0; index < await inputs.count(); index++) {
  586 |     const input = inputs.nth(index)
  587 |     if (await input.isDisabled()) continue
  588 |     const maximum = Number(await input.getAttribute('max') || '0')
  589 |     await input.fill(String(index === 0 && skipFirst ? 0 : index === 0 && firstQuantity !== undefined ? firstQuantity : maximum))
  590 |   }
  591 |   await card.locator('[data-pda-post-action="save-process-completion"]').click()
  592 |   await expect(page.locator('[data-pda-post-task] [role="status"]')).toContainText(`${processItem}本次已保存`)
  593 | }
  594 | 
  595 | async function submitPdaAvailable(page: Page): Promise<void> {
  596 |   const form = page.locator('[data-post-recheck-form]')
  597 |   if ((await form.getAttribute('open')) === null) await form.locator(':scope > summary').click()
  598 |   for (const input of await form.locator('[data-post-recheck-qty]:not([disabled])').all()) await input.fill(await input.getAttribute('max') || '0')
  599 |   page.once('dialog', dialog => dialog.accept())
  600 |   await page.locator('[data-pda-post-action="submit-for-recheck"]').click()
  601 |   await expect(page.locator('[data-pda-post-task] [role="status"]')).toContainText('已交复检')
  602 | }
  603 | 
  604 | test('PDA精确扫码后按四项增量登记，部分完成可交复检且保留正常在制', async ({ page }, testInfo) => {
  605 |   const seed = await seedBrowserFlow(page)
  606 |   await page.setViewportSize({ width: 360, height: 800 })
  607 |   await setSession(page)
  608 |   await page.goto('/fcs/pda/post-finishing/execute')
  609 |   await page.locator('[data-pda-post-field="postScan"]').fill(seed.postTaskNo)
  610 |   await page.locator('[data-pda-post-field="postScan"]').press('Enter')
  611 |   await expect(page.locator('[data-post-process]')).toHaveCount(4)
  612 |   await expect(page.locator('[data-post-processed-qty]')).toHaveCount(0)
  613 |   await expect(page.locator('[data-pda-post-action="toggle-process-item"]')).toHaveCount(0)
  614 |   const firstProcess = page.locator('[data-post-process="开扣眼"]')
  615 |   if ((await firstProcess.getAttribute('open')) === null) await firstProcess.locator(':scope > summary').click()
  616 |   await expectImagesLoaded(page)
  617 |   await page.locator('[data-pda-post-action="zoom-image"]').first().click()
  618 |   await expect(page.getByRole('dialog')).toBeVisible()
  619 |   await page.keyboard.press('Escape')
  620 |   for (const item of ['开扣眼', '装扣子', '熨烫', '包装']) await registerPdaItem(page, item, 19)
  621 |   await submitPdaAvailable(page)
  622 |   const result = await page.evaluate(async id => {
  623 |     const flow = await import('/src/data/fcs/post-finishing-full-flow.ts')
  624 |     return { task: flow.getPostFinishingFullFlowPostTask(id), progress: flow.getPostFinishingProcessProgress(id) }
  625 |   }, seed.postTaskNo)
  626 |   expect(result.task?.status).toBe('后道中')
  627 |   expect(result.progress.totalCompletedQty).toBe(99)
  628 |   expect(result.progress.totalReservedQty).toBe(99)
  629 |   expect(result.progress.records).toHaveLength(4)
  630 |   await attachPageEvidence(page, testInfo, 'pda-post-finishing-partial-99-recheck')
  631 |   await verifyPdaAtBothSizes(page)
  632 | })
  633 | 
  634 | test('PDA某SKU未加工可保留待办，不强制填写未处理原因或关闭整张加工单', async ({ page }) => {
  635 |   const seed = await seedBrowserFlow(page)
  636 |   await page.setViewportSize({ width: 360, height: 800 })
  637 |   await setSession(page)
  638 |   await page.goto(`/fcs/pda/post-finishing/execute?id=${encodeURIComponent(seed.postTaskNo)}`)
  639 |   for (const item of ['开扣眼', '装扣子', '熨烫', '包装']) await registerPdaItem(page, item, undefined, true)
  640 |   await submitPdaAvailable(page)
  641 |   const result = await page.evaluate(async id => {
  642 |     const flow = await import('/src/data/fcs/post-finishing-full-flow.ts')
  643 |     return { task: flow.getPostFinishingFullFlowPostTask(id), progress: flow.getPostFinishingProcessProgress(id) }
  644 |   }, seed.postTaskNo)
  645 |   expect(result.task?.status).toBe('后道中')
  646 |   expect(result.progress.lines[0].completedQty).toBe(0)
  647 |   expect(result.progress.totalCompletedQty).toBe(80)
  648 |   expect(result.progress.totalReservedQty).toBe(80)
  649 |   await page.goto(`/fcs/pda/post-finishing/sku-adjustment?id=${encodeURIComponent(seed.postTaskNo)}`)
  650 |   await expect(page.locator('body')).toContainText('旧整单“未处理数量”登记入口已停用')
  651 |   await expect(page.locator('[data-post-adjust-field]')).toHaveCount(0)
  652 | })
  653 | 
  654 | test('Web可接续PDA分项记录，保留原责任且无需整单接管', async ({ page }) => {
  655 |   const seed = await seedBrowserFlow(page)
  656 |   await setSession(page)
  657 |   await page.goto(`/fcs/pda/post-finishing/execute?id=${encodeURIComponent(seed.postTaskNo)}`)
  658 |   const card = page.locator('[data-post-process="开扣眼"]')
  659 |   await card.locator(':scope > summary').click()
> 660 |   await card.locator('[data-post-process-qty]').first().fill('5')
      |                                                         ^ Error: locator.fill: Test timeout of 60000ms exceeded.
  661 |   await card.locator('[data-pda-post-action="save-process-completion"]').click()
  662 |   await expect(page.locator('[data-pda-post-task] [role="status"]')).toContainText('本次已保存 5 件')
  663 |   await setCurrentWebActor(page, 'PF-USER-POST')
  664 |   await page.setViewportSize({ width: 1366, height: 768 })
  665 |   await page.goto(`/fcs/craft/post-finishing/work-orders/${encodeURIComponent(seed.postTaskNo)}`)
  666 |   await expect(page.locator('[data-web-post-takeover-reason]')).toHaveCount(0)
  667 |   for (const item of ['装扣子', '熨烫', '包装']) {
  668 |     await page.locator(`[data-post-finishing-work-order-detail-action="open-register"][data-process-item="${item}"]`).click()
  669 |     await page.locator('[data-post-entry-quantity]').first().fill('5')
  670 |     await page.locator('[data-post-finishing-work-order-detail-action="save-entry"]').click()
  671 |     await expect(page.locator('[data-post-entry-form]')).toHaveCount(0)
  672 |   }
  673 |   await page.locator('[data-post-finishing-work-order-detail-action="open-recheck"]').click()
  674 |   await page.locator('[data-post-entry-quantity]').first().fill('5')
  675 |   page.once('dialog', dialog => dialog.accept())
  676 |   await page.locator('[data-post-finishing-work-order-detail-action="save-entry"]').click()
  677 |   await expect(page.locator('[data-post-entry-form]')).toHaveCount(0)
  678 |   const result = await page.evaluate(async id => {
  679 |     const flow = await import('/src/data/fcs/post-finishing-full-flow.ts')
  680 |     return flow.getPostFinishingProcessProgress(id)
  681 |   }, seed.postTaskNo)
  682 |   expect(result.totalCompletedQty).toBe(5)
  683 |   expect(result.totalReservedQty).toBe(5)
  684 |   expect(new Set(result.records.map(row => row.recordedBy.actorId)).size).toBe(2)
  685 | })
  686 | 
  687 | test('Web 处理后交出复核精确领取、退领清空、数量授权、错码重贴并唯一生成出货单', async ({ page }, testInfo) => {
  688 |   const seed = await seedBrowserFlow(page)
  689 |   await page.setViewportSize({ width: 1366, height: 768 })
  690 |   await setCurrentWebActor(page, 'PF-USER-RC-A')
  691 |   await page.goto('/fcs/craft/post-finishing/recheck-orders')
  692 |   await page.getByRole('button', { name: '领取复检单' }).click()
  693 |   await page.locator('[data-recheck-claim-task-no]').fill(seed.recheckOrderNo)
  694 |   await page.getByRole('button', { name: '确认领取' }).click()
  695 |   await expect(page).toHaveURL(new RegExp(`id=${encodeURIComponent(seed.recheckOrderId)}`))
  696 |   await expect(page.locator('[data-recheck-result-line]')).toHaveCount(5)
  697 |   await expect(page.locator('[data-recheck-authorization]')).toBeHidden()
  698 |   await expectImagesLoaded(page)
  699 |   const firstHandover = page.locator('[data-recheck-result-line]').first().locator('[data-recheck-result-field="handoverQty"]')
  700 |   await firstHandover.fill('19')
  701 |   await expect(page.locator('[data-recheck-authorization]')).toBeVisible()
  702 |   await firstHandover.fill('20')
  703 |   await expect(page.locator('[data-recheck-authorization]')).toBeHidden()
  704 |   page.once('dialog', (dialog) => dialog.accept())
  705 |   await page.getByRole('button', { name: '退领复检单' }).click()
  706 |   await expect(page.getByRole('status')).toContainText('已退回待复检，复检数据已清空')
  707 |   await page.goto('/fcs/craft/post-finishing/recheck-orders')
  708 |   await page.getByRole('button', { name: '领取复检单' }).click()
  709 |   await page.locator('[data-recheck-claim-task-no]').fill(seed.recheckOrderNo)
  710 |   await page.getByRole('button', { name: '确认领取' }).click()
  711 | 
  712 |   const firstLine = page.locator('[data-recheck-result-line]').first()
  713 |   await firstLine.locator('[data-recheck-result-field="barcodeCorrect"]').selectOption('no')
  714 |   for (let index = 1; index < seed.recheckBarcodes.length; index += 1) {
  715 |     await page.locator('[data-recheck-result-line]').nth(index).locator('[data-recheck-result-field="barcodeCorrect"]').selectOption('yes')
  716 |   }
  717 |   await page.getByRole('button', { name: '确认数量条码并生成后道出货单' }).click()
  718 |   await expect(page.getByRole('status')).toContainText('条码错误，已阻断出货')
  719 |   await expect(page.getByRole('button', { name: '已重新贴码' })).toBeVisible()
  720 |   await page.getByRole('button', { name: '已重新贴码' }).click()
  721 |   await expect(page.locator('body')).toContainText('已重贴待复扫')
  722 |   await attachPageEvidence(page, testInfo, 'web-recheck-relabel-block')
  723 | 
  724 |   for (let index = 0; index < seed.recheckBarcodes.length; index += 1) {
  725 |     const line = page.locator('[data-recheck-result-line]').nth(index)
  726 |     await line.locator('[data-recheck-result-field="barcodeCorrect"]').selectOption('yes')
  727 |   }
  728 |   await expect(page.locator('body')).not.toContainText('错误待重贴')
  729 |   await page.getByRole('button', { name: '确认数量条码并生成后道出货单' }).click()
  730 |   await expect(page.getByRole('status')).toContainText('数量与条码复核完成，已自动生成后道出货单')
  731 |   await expect(page.locator('body')).toContainText('唯一后道出货单')
  732 | })
  733 | 
  734 | test('后道工厂 PDA 删除成衣仓收货入口，出货单只保留业务条码', async ({ page }) => {
  735 |   const seed = await seedBrowserFlow(page)
  736 |   await setSession(page)
  737 |   await page.goto('/fcs/pda/warehouse')
  738 |   await expect(page.locator('body')).not.toContainText('扫描后道出货单收货')
  739 |   await page.goto('/fcs/pda/post-finishing/outbound-receive')
  740 |   await expect(page.getByRole('heading', { name: '扫描后道出货单条码' })).toHaveCount(0)
  741 |   await page.goto(`/fcs/craft/post-finishing/print?type=OUTBOUND&id=${encodeURIComponent(seed.outboundOrderId)}`)
  742 |   await expect(page.locator('[data-business-document-barcode]')).toHaveAttribute('data-business-document-barcode', seed.outboundOrderNo)
  743 |   await expect(page.locator('[data-scan-target]')).toHaveCount(0)
  744 | })
  745 | 
  746 | test('Web 管理页、独立动态授权码、主从日志和全套打印均读取同一链路事实', async ({ page }, testInfo) => {
  747 |   test.setTimeout(180_000)
  748 |   const seed = await seedBrowserFlow(page)
  749 |   await page.setViewportSize({ width: 1366, height: 768 })
  750 |   for (const path of [
  751 |     '/fcs/craft/post-finishing/qc-orders',
  752 |     '/fcs/craft/post-finishing/work-orders',
  753 |     '/fcs/craft/post-finishing/recheck-orders',
  754 |     '/fcs/craft/post-finishing/wait-handover-warehouse',
  755 |     '/fcs/craft/post-finishing/outbound-orders',
  756 |     '/fcs/craft/post-finishing/audit-records',
  757 |   ]) {
  758 |     await page.goto(path)
  759 |     await expect(page.locator('body')).not.toContainText('次品')
  760 |     await expectNoBodyOverflow(page)
```