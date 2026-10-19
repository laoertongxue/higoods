# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: post-finishing-full-flow-cross-terminal.spec.ts >> 15条链按责任逐条跨公共PDA、唯一Web质检、可选后道处理与成衣仓交接
- Location: tests/post-finishing-full-flow-cross-terminal.spec.ts:838:1

# Error details

```
TimeoutError: locator.click: Timeout 15000ms exceeded.
Call log:
  - waiting for locator('tbody tr').filter({ hasText: 'SPU-QC-001-01' }).getByRole('button', { name: '库存明细' })
    - locator resolved to <button type="button" data-sku-id="SPU-QC-001-S" class="text-xs text-blue-600 hover:underline" data-post-finishing-action="full-flow-open-stock">库存明细</button>
  - attempting click action
    - waiting for element to be visible, enabled and stable
    - element is not stable
  - retrying click action
    - waiting for element to be visible, enabled and stable
  - element was detached from the DOM, retrying

```

# Page snapshot

```yaml
- generic [ref=e3]:
  - banner [ref=e4]:
    - generic [ref=e6]:
      - generic [ref=e7]: HG
      - generic [ref=e8]: HiGood
    - generic [ref=e10]:
      - button "商品中心系统 (PCS)" [ref=e11]:
        - generic [ref=e12]: 商品中心系统
        - generic [ref=e13]: (PCS)
      - button "采购管理系统 (PMS)" [ref=e14]:
        - generic [ref=e15]: 采购管理系统
        - generic [ref=e16]: (PMS)
      - button "工厂生产协同系统 (FCS)" [ref=e17]:
        - generic [ref=e18]: 工厂生产协同系统
        - generic [ref=e19]: (FCS)
      - button "工艺工厂运营系统 (PFOS)" [ref=e20]:
        - generic [ref=e21]: 工艺工厂运营系统
        - generic [ref=e22]: (PFOS)
      - button "仓储物流系统 (WLS)" [ref=e24]:
        - generic [ref=e25]: 仓储物流系统
        - generic [ref=e26]: (WLS)
      - button "直播运营系统 (LOS)" [ref=e27]:
        - generic [ref=e28]: 直播运营系统
        - generic [ref=e29]: (LOS)
      - button "订单管理系统 (OMS)" [ref=e30]:
        - generic [ref=e31]: 订单管理系统
        - generic [ref=e32]: (OMS)
      - button "业财一体化系统 (BFIS)" [ref=e33]:
        - generic [ref=e34]: 业财一体化系统
        - generic [ref=e35]: (BFIS)
      - button "数据决策系统 (DDS)" [ref=e36]:
        - generic [ref=e37]: 数据决策系统
        - generic [ref=e38]: (DDS)
    - generic [ref=e39]:
      - button "通知" [ref=e40]:
        - img [ref=e41]
      - button "管理员" [ref=e45]:
        - img [ref=e47]
        - generic [ref=e50]: 管理员
        - img [ref=e51]
  - generic [ref=e53]:
    - complementary [ref=e55]:
      - generic [ref=e56]:
        - generic [ref=e57]:
          - generic [ref=e58]:
            - heading "工艺工厂运营系统" [level=2] [ref=e59]
            - paragraph [ref=e60]: PFOS
          - button "收起菜单" [ref=e61]:
            - img [ref=e62]
        - generic [ref=e66]:
          - generic [ref=e67]:
            - button "裁床厂管理" [expanded] [ref=e68]:
              - img [ref=e70]
              - generic [ref=e76]: 裁床厂管理
              - img [ref=e77]
            - generic [ref=e79]:
              - button "裁床总览" [ref=e81]:
                - img [ref=e83]
                - generic [ref=e89]: 裁床总览
                - img [ref=e90]
              - button "裁前准备" [ref=e93]:
                - img [ref=e95]
                - generic [ref=e101]: 裁前准备
                - img [ref=e102]
              - button "接收管理" [ref=e105]:
                - img [ref=e107]
                - generic [ref=e112]: 接收管理
                - img [ref=e113]
              - button "铺布执行" [ref=e116]:
                - img [ref=e118]
                - generic [ref=e120]: 铺布执行
                - img [ref=e121]
              - button "裁后处理" [ref=e124]:
                - img [ref=e126]
                - generic [ref=e131]: 裁后处理
                - img [ref=e132]
              - button "裁床仓库管理" [ref=e135]:
                - img [ref=e137]
                - generic [ref=e140]: 裁床仓库管理
                - img [ref=e141]
              - button "裁床统计" [ref=e144]:
                - img [ref=e146]
                - generic [ref=e148]: 裁床统计
                - img [ref=e149]
          - generic [ref=e151]:
            - button "印花厂管理" [expanded] [ref=e152]:
              - img [ref=e154]
              - generic [ref=e160]: 印花厂管理
              - img [ref=e161]
            - button "印花管理" [ref=e165]:
              - img [ref=e167]
              - generic [ref=e173]: 印花管理
              - img [ref=e174]
          - generic [ref=e176]:
            - button "染厂管理" [expanded] [ref=e177]:
              - img [ref=e179]
              - generic [ref=e181]: 染厂管理
              - img [ref=e182]
            - button "染厂管理" [ref=e186]:
              - img [ref=e188]
              - generic [ref=e190]: 染厂管理
              - img [ref=e191]
          - generic [ref=e193]:
            - button "毛织厂管理" [expanded] [ref=e194]:
              - img [ref=e196]
              - generic [ref=e198]: 毛织厂管理
              - img [ref=e199]
            - button "毛织管理" [ref=e203]:
              - img [ref=e205]
              - generic [ref=e207]: 毛织管理
              - img [ref=e208]
          - generic [ref=e210]:
            - button "辅料工厂管理" [expanded] [ref=e211]:
              - img [ref=e213]
              - generic [ref=e216]: 辅料工厂管理
              - img [ref=e217]
            - generic [ref=e219]:
              - button "花边厂管理" [ref=e221]:
                - generic [ref=e224]: 花边厂管理
                - img [ref=e225]
              - button "织带厂管理" [ref=e228]:
                - img [ref=e230]
                - generic [ref=e233]: 织带厂管理
                - img [ref=e234]
          - generic [ref=e236]:
            - button "后道工厂管理" [expanded] [ref=e237]:
              - img [ref=e239]
              - generic [ref=e244]: 后道工厂管理
              - img [ref=e245]
            - generic [ref=e248]:
              - button "后道工厂管理" [ref=e249]:
                - img [ref=e251]
                - generic [ref=e256]: 后道工厂管理
                - img [ref=e257]
              - generic [ref=e259]:
                - button "后道生产任务" [ref=e260]:
                  - img [ref=e262]
                  - text: 后道生产任务
                - button "后道辅料调拨单" [ref=e265]:
                  - img [ref=e267]
                  - text: 后道辅料调拨单
                - button "执行质检" [ref=e271]:
                  - img [ref=e273]
                  - text: 执行质检
                - button "质检清单" [ref=e277]:
                  - img [ref=e279]
                  - text: 质检清单
                - button "后道加工单" [ref=e283]:
                  - img [ref=e285]
                  - text: 后道加工单
                - button "复检单" [ref=e288]:
                  - img [ref=e290]
                  - text: 复检单
                - button "后道待加工仓" [ref=e295]:
                  - img [ref=e297]
                  - text: 后道待加工仓
                - button "后道待交出仓" [ref=e300]:
                  - img [ref=e302]
                  - text: 后道待交出仓
                - button "后道出货单" [ref=e307]:
                  - img [ref=e309]
                  - text: 后道出货单
                - button "差异与操作日志" [ref=e314]:
                  - img [ref=e316]
                  - text: 差异与操作日志
                - button "我的动态授权码" [ref=e320]:
                  - img [ref=e322]
                  - text: 我的动态授权码
                - button "成衣 SPU 替换" [ref=e325]:
                  - img [ref=e327]
                  - text: 成衣 SPU 替换
          - generic [ref=e332]:
            - button "辅助工艺工厂管理" [expanded] [ref=e333]:
              - img [ref=e335]
              - generic [ref=e337]: 辅助工艺工厂管理
              - img [ref=e338]
            - generic [ref=e340]:
              - button "打揽加工单" [ref=e342]:
                - img [ref=e344]
                - generic [ref=e346]: 打揽加工单
              - button "打条加工单" [ref=e348]:
                - img [ref=e350]
                - generic [ref=e352]: 打条加工单
              - button "烫画加工单" [ref=e354]:
                - img [ref=e356]
                - generic [ref=e358]: 烫画加工单
              - button "直喷加工单" [ref=e360]:
                - img [ref=e362]
                - generic [ref=e364]: 直喷加工单
              - button "布包扣加工单" [ref=e366]:
                - img [ref=e368]
                - generic [ref=e370]: 布包扣加工单
              - button "绣花加工单" [ref=e372]:
                - img [ref=e374]
                - generic [ref=e376]: 绣花加工单
              - button "压褶加工单" [ref=e378]:
                - img [ref=e380]
                - generic [ref=e382]: 压褶加工单
              - button "缝边绣加工单" [ref=e384]:
                - img [ref=e386]
                - generic [ref=e388]: 缝边绣加工单
              - button "盘扣加工单" [ref=e390]:
                - img [ref=e392]
                - generic [ref=e394]: 盘扣加工单
              - button "花朵加工单" [ref=e396]:
                - img [ref=e398]
                - generic [ref=e400]: 花朵加工单
              - button "打褶加工单" [ref=e402]:
                - img [ref=e404]
                - generic [ref=e406]: 打褶加工单
              - button "烫钻加工单" [ref=e408]:
                - img [ref=e410]
                - generic [ref=e412]: 烫钻加工单
              - button "辅助工艺待加工仓" [ref=e414]:
                - img [ref=e416]
                - generic [ref=e419]: 辅助工艺待加工仓
              - button "辅助工艺待交出仓" [ref=e421]:
                - img [ref=e423]
                - generic [ref=e428]: 辅助工艺待交出仓
          - generic [ref=e429]:
            - button "特种工艺工厂管理" [expanded] [ref=e430]:
              - img [ref=e432]
              - generic [ref=e434]: 特种工艺工厂管理
              - img [ref=e435]
            - generic [ref=e437]:
              - button "模板工序加工单" [ref=e439]:
                - img [ref=e441]
                - generic [ref=e443]: 模板工序加工单
              - button "激光开袋加工单" [ref=e445]:
                - img [ref=e447]
                - generic [ref=e449]: 激光开袋加工单
              - button "特种车缝（花样机）加工单" [ref=e451]:
                - img [ref=e453]
                - generic [ref=e455]: 特种车缝（花样机）加工单
              - button "橡筋定长切割加工单" [ref=e457]:
                - img [ref=e459]
                - generic [ref=e461]: 橡筋定长切割加工单
              - button "特种工艺待加工仓" [ref=e463]:
                - img [ref=e465]
                - generic [ref=e468]: 特种工艺待加工仓
              - button "特种工艺待交出仓" [ref=e470]:
                - img [ref=e472]
                - generic [ref=e477]: 特种工艺待交出仓
    - main [ref=e478]:
      - generic [ref=e480]:
        - generic [ref=e481]:
          - button "后道待加工仓" [ref=e483]
          - button "质检清单" [ref=e485]
          - button "执行质检" [ref=e487]
          - button "后道加工单" [ref=e489]
          - button "复检单" [ref=e491]
          - generic [ref=e492]:
            - button "后道待交出仓" [ref=e493]
            - button [ref=e494]:
              - img [ref=e495]
          - button "后道出货单" [ref=e500]
        - button "全部关闭" [ref=e502]
      - generic [ref=e505]: 页面内容加载失败，请稍后重试。
  - button "查生产" [ref=e506]:
    - img [ref=e507]
```

# Test source

```ts
  677 |   }
  678 | 
  679 |   const lines = page.locator('[data-recheck-result-line]')
  680 |   const first = lines.first()
  681 |   const firstHandover = first.locator('[data-recheck-result-field="handoverQty"]')
  682 |   const firstExpected = Number(await firstHandover.inputValue())
  683 |   if (scenario.recheckScenario === 'difference') {
  684 |     const payload = await freshAuthorizationPayload(context, 'AUTH-QC-001')
  685 |     await firstHandover.fill(String(firstExpected - 1))
  686 |     await expect(page.locator('[data-recheck-authorization]')).toBeVisible()
  687 |     await page.locator('[data-recheck-difference-reason]').fill('全量跨端UI验收：复检首个SKU少1件')
  688 |     await page.locator('[data-recheck-authorization-code]').fill(payload)
  689 |     chain.authorizationStages.push('Web复检')
  690 |     await saveScreenshot(page, chain, 'recheck-authorization')
  691 |   }
  692 | 
  693 |   await page.getByRole('button', { name: '确认数量条码并生成后道出货单' }).click()
  694 |   await expect(page.locator('body')).toContainText('处理后数量与条码已复核，唯一后道出货单：')
  695 |   const outboundLink = page.locator('[data-nav*="/fcs/craft/post-finishing/outbound-orders/"]').filter({ hasText: /-CH$/ }).last()
  696 |   await expect(outboundLink).toBeVisible()
  697 |   const outboundOrderNo = (await outboundLink.textContent())?.trim() || ''
  698 |   expect(outboundOrderNo).toMatch(/-CH$/)
  699 |   const status = `数量与条码复核完成，已生成唯一后道出货单 ${outboundOrderNo}`
  700 |   addStage(chain, page, 'Web处理后交出复核完成', status, {
  701 |     recheckScenario: scenario.recheckScenario,
  702 |     barcodeErrorRecovered: scenario.barcodeError,
  703 |     outboundOrderNo,
  704 |   })
  705 |   return outboundOrderNo
  706 | }
  707 | 
  708 | async function verifyOutboundAndFactoryPdaBoundary(
  709 |   page: Page,
  710 |   scenario: CrossTerminalScenario,
  711 |   chain: ChainEvidence,
  712 |   outboundOrderNo: string,
  713 | ): Promise<void> {
  714 |   await page.setViewportSize({ width: 1366, height: 768 })
  715 |   const skuCode = `SPU-QC-${String(scenario.orderIndex + 1).padStart(3, '0')}-01`
  716 |   await page.goto('/fcs/craft/post-finishing/wait-handover-warehouse?tab=inventory')
  717 |   await expect(page.getByRole('heading', { name: '后道待交出仓' })).toBeVisible()
  718 |   await page.locator('[data-post-finishing-field="warehouse-availability"]').selectOption('available')
  719 |   await page.locator('[data-post-finishing-field="warehouse-keyword"]').fill(skuCode)
  720 |   await page.locator('[data-post-finishing-action="full-flow-query"]').click()
  721 |   const readyRow = page.locator('tbody tr').filter({ hasText: skuCode })
  722 |   if (scenario.needPost) {
  723 |     await expect(readyRow).toHaveCount(1)
  724 |     await readyRow.getByRole('button', { name: '库存明细' }).click()
  725 |     const readyDrawer = page.locator('[data-warehouse-inventory-drawer]')
  726 |     await expect(readyDrawer).toContainText(chain.deliveryOrderNo!)
  727 |     await expect(readyDrawer).toContainText(outboundOrderNo)
  728 |     await expect(readyDrawer).toContainText('待交出')
  729 |     const readyScreenshot = await saveScreenshot(page, chain, 'wait-handover-ready')
  730 |     addStage(chain, page, 'Web待交出仓入仓核对', '待交出', {
  731 |       outboundOrderNo,
  732 |       skuCount: 5,
  733 |       screenshot: readyScreenshot || '',
  734 |     })
  735 |     await page.locator('[data-post-finishing-action="full-flow-close-overlay"]').last().click()
  736 |   } else {
  737 |     if (await readyRow.count()) {
  738 |       await readyRow.getByRole('button', { name: '库存明细' }).click()
  739 |       const readyDrawer = page.locator('[data-warehouse-inventory-drawer]')
  740 |       await expect(readyDrawer).not.toContainText(chain.deliveryOrderNo!)
  741 |       await expect(readyDrawer).not.toContainText(outboundOrderNo)
  742 |       await page.locator('[data-post-finishing-action="full-flow-close-overlay"]').last().click()
  743 |     }
  744 |     addStage(chain, page, 'QC直达跳过后道待交出仓', '不适用', { outboundOrderNo })
  745 |   }
  746 | 
  747 |   await page.goto(`/fcs/craft/post-finishing/outbound-orders?keyword=${encodeURIComponent(outboundOrderNo)}`)
  748 |   await expect(page.locator('tbody tr')).toHaveCount(1)
  749 |   await page.locator('[data-nav]').filter({ hasText: /^详情$/ }).click({ noWaitAfter: true })
  750 |   await expect(page.locator('body')).toContainText(chain.deliveryOrderNo!)
  751 |   await expect(page.locator('body')).toContainText(chain.qcTaskNo!)
  752 |   if (chain.recheckOrderNo) await expect(page.locator('body')).toContainText(chain.recheckOrderNo)
  753 |   else await expect(page.locator('body')).toContainText('不适用（质检直达成衣仓）')
  754 |   if (chain.postTaskNo) await expect(page.locator('body')).toContainText(chain.postTaskNo)
  755 |   await expect(page.locator('tbody tr')).toHaveCount(5)
  756 |   await page.locator('[data-nav]').filter({ hasText: /^打印整单$/ }).click({ noWaitAfter: true })
  757 |   await expect(page.getByRole('heading', { name: '后道出货单' })).toBeVisible()
  758 |   await expect(page.locator('[data-business-document-barcode]')).toHaveAttribute('data-business-document-barcode', outboundOrderNo)
  759 |   await expect(page.locator('[data-scan-target]')).toHaveCount(0)
  760 |   addStage(chain, page, 'Web出货核对及出货单打印', undefined, { outboundOrderNo, printedSkuLines: 5 })
  761 | 
  762 |   await page.setViewportSize({ width: 390, height: 844 })
  763 |   await page.goto('/fcs/pda/warehouse')
  764 |   await expect(page.locator('body')).not.toContainText('扫描后道出货单收货')
  765 |   await page.goto('/fcs/pda/post-finishing/outbound-receive')
  766 |   await expect(page.getByRole('heading', { name: '扫描后道出货单条码' })).toHaveCount(0)
  767 |   addStage(chain, page, '后道工厂PDA收货入口已删除', '不可达', { outboundOrderNo })
  768 | 
  769 |   await page.setViewportSize({ width: 1366, height: 768 })
  770 |   if (scenario.needPost) {
  771 |     await page.goto('/fcs/craft/post-finishing/wait-handover-warehouse?tab=inventory')
  772 |     await page.locator('[data-post-finishing-field="warehouse-availability"]').selectOption('available')
  773 |     await page.locator('[data-post-finishing-field="warehouse-keyword"]').fill(skuCode)
  774 |     await page.locator('[data-post-finishing-action="full-flow-query"]').click()
  775 |     const pendingRow = page.locator('tbody tr').filter({ hasText: skuCode })
  776 |     await expect(pendingRow).toHaveCount(1)
> 777 |     await pendingRow.getByRole('button', { name: '库存明细' }).click()
      |                                                            ^ TimeoutError: locator.click: Timeout 15000ms exceeded.
  778 |     const pendingDrawer = page.locator('[data-warehouse-inventory-drawer]')
  779 |     await expect(pendingDrawer).toContainText(chain.deliveryOrderNo!)
  780 |     await expect(pendingDrawer).toContainText('待交出')
  781 |     chain.finalScreenshot = await saveScreenshot(page, chain, 'wait-handover-pending')
  782 |     addStage(chain, page, 'Web待交出仓待交出回查', '待交出', { downstreamReceipt: '成衣仓系统范围外' })
  783 |   } else {
  784 |     await page.goto(`/fcs/craft/post-finishing/outbound-orders?keyword=${encodeURIComponent(outboundOrderNo)}`)
  785 |     const directRow = page.locator('tbody tr').filter({ hasText: outboundOrderNo })
  786 |     await expect(directRow).toHaveCount(1)
  787 |     await expect(directRow).toContainText('质检直达')
  788 |     await expect(directRow).toContainText('待确认')
  789 |     chain.finalScreenshot = await saveScreenshot(page, chain, 'qc-direct-warehouse-pending')
  790 |     addStage(chain, page, 'QC直达成衣仓待接收回查', '待仓库接收', { downstreamReceipt: '尚未由成衣仓确认' })
  791 |   }
  792 | }
  793 | 
  794 | async function readFinalSnapshot(page: Page): Promise<unknown> {
  795 |   return page.evaluate(async () => {
  796 |     const flow = await import('/src/data/fcs/post-finishing-full-flow.ts')
  797 |     const logs = await import('/src/data/fcs/post-finishing-operation-log.ts')
  798 |     const authorization = await import('/src/data/fcs/post-finishing-authorization.ts')
  799 |     const deliveries = flow.listPostFinishingFactoryReturns()
  800 |     return {
  801 |       totals: {
  802 |         productionOrders: new Set(deliveries.map((item) => item.productionOrderNo)).size,
  803 |         deliveries: deliveries.length,
  804 |         skuReturnLines: deliveries.reduce((sum, item) => sum + item.lines.length, 0),
  805 |         qcTasks: flow.listPostFinishingFullFlowQcTasks().length,
  806 |         postTasks: flow.listPostFinishingFullFlowPostTasks().length,
  807 |         recheckOrders: flow.listPostFinishingFullFlowRecheckOrders().length,
  808 |         outboundOrders: flow.listPostFinishingFullFlowOutboundOrders().length,
  809 |         warehouseReceipts: flow.listPostFinishingWarehouseReceipts().length,
  810 |         waitProcessWarehouseRecords: flow.listPostFinishingWaitProcessWarehouseRecords().length,
  811 |         waitProcessWarehouseMovements: flow.listPostFinishingWaitProcessWarehouseMovements().length,
  812 |         waitHandoverWarehouseRecords: flow.listPostFinishingWaitHandoverWarehouseRecords().length,
  813 |         waitHandoverWarehouseMovements: flow.listPostFinishingWaitHandoverWarehouseMovements().length,
  814 |         defects: flow.listPostFinishingDefectRecords().length,
  815 |         operationLogs: logs.listPostFinishingOperationLogs().length,
  816 |         authorizationConsumptions: authorization.listPostFinishingAuthorizationConsumptions().length,
  817 |       },
  818 |       chains: deliveries.map((delivery) => {
  819 |         const trace = flow.tracePostFinishingFullFlow(delivery.deliveryOrderNo)
  820 |         return {
  821 |           productionOrderNo: delivery.productionOrderNo,
  822 |           returnIndex: delivery.returnIndex,
  823 |           deliveryOrderNo: delivery.deliveryOrderNo,
  824 |           qcTaskNo: trace.qcTask?.qcTaskNo,
  825 |           postTaskNo: trace.postTask?.postTaskNo,
  826 |           recheckOrderNo: trace.recheckOrder?.recheckOrderNo,
  827 |           outboundOrderNo: trace.outboundOrder?.outboundOrderNo,
  828 |           waitHandoverWarehouseRecordId: trace.waitHandoverRecord?.warehouseRecordId,
  829 |           waitHandoverStatus: trace.waitHandoverRecord?.status,
  830 |           warehouseReceiptNo: trace.receipt?.receiptNo,
  831 |           warehouseReceived: Boolean(trace.receipt),
  832 |         }
  833 |       }),
  834 |     }
  835 |   })
  836 | }
  837 | 
  838 | test('15条链按责任逐条跨公共PDA、唯一Web质检、可选后道处理与成衣仓交接', async ({ page, context }, testInfo: TestInfo) => {
  839 |   test.setTimeout(30 * 60_000)
  840 |   page.setDefaultTimeout(15_000)
  841 |   page.setDefaultNavigationTimeout(30_000)
  842 |   expect(scenarios).toHaveLength(15)
  843 |   expect(new Set(scenarios.map((scenario) => scenario.productionOrderNo)).size).toBe(3)
  844 |   for (const productionOrderNo of PRODUCTION_ORDERS) {
  845 |     expect(scenarios.filter((scenario) => scenario.productionOrderNo === productionOrderNo)).toHaveLength(5)
  846 |   }
  847 | 
  848 |   await page.goto('/fcs/pda/warehouse')
  849 |   await page.evaluate(async () => {
  850 |     const flow = await import('/src/data/fcs/post-finishing-full-flow.ts')
  851 |     const records = await import('/src/data/fcs/post-finishing-records.ts')
  852 |     await records.ensurePostFinishingRecordState()
  853 |     await records.runPostFinishingCommand(() => flow.resetPostFinishingFullFlow())
  854 |   })
  855 |   await page.reload()
  856 |   await setPdaSession(page)
  857 |   await setCurrentWebActor(page, 'PF-USER-QC-A')
  858 |   await page.goto('/fcs/craft/post-finishing/wait-process-warehouse')
  859 |   await expect(page.locator('[data-return-card]')).toHaveCount(0)
  860 | 
  861 |   for (let index = 0; index < scenarios.length; index += 1) {
  862 |     const scenario = scenarios[index]!
  863 |     const chain: ChainEvidence = {
  864 |       chainIndex: index + 1,
  865 |       productionOrderNo: scenario.productionOrderNo,
  866 |       returnIndex: scenario.returnIndex,
  867 |       label: scenario.label,
  868 |       stages: [],
  869 |       authorizationStages: [],
  870 |     }
  871 |     evidence.chains.push(chain)
  872 |     persistEvidence()
  873 | 
  874 |     chain.deliveryOrderNo = await registerReturnThroughPublicPda(page, scenario, chain)
  875 |     if (index % 2 === 0) await confirmReturnThroughWeb(page, context, scenario, chain, chain.deliveryOrderNo)
  876 |     else await confirmReturnThroughPda(page, context, scenario, chain, chain.deliveryOrderNo)
  877 |     const autoCreatedQcTask = await page.evaluate(async (deliveryOrderNo) => {
```