# FCS 最终验收口径

## 1. 工序工艺

- 缩水归准备阶段。
- 洗水归“特殊工艺 - 洗水”。
- 后道按一个对外任务承接。
- 开扣眼、装扣子、熨烫、包装只作为后道产能节点。
- 已删除无独立业务场景的旧工艺项，不进入活跃任务。

## 2. 任务与交出链路

- 对外任务必须有任务二维码。
- 任务开工后自动创建交出单。
- 一个交出单可包含多条交出记录。
- 每条交出记录必须有二维码。
- 页面主口径统一为“接收方回写”。
- 数量异议由工厂发起。

## 3. 后道、质检、复检

- 车缝回货先到我方后道工厂。
- 外部车缝厂不能直接回成衣仓。
- 回货质检与后道复检独立于后道任务。
- 质检方式统一显示为“数量复核 / 抽检 / 全检”。

## 4. 生产确认单

- 生产确认单使用快照。
- 支持打印预览。
- 后道只显示一个任务。
- 洗水显示为“特殊工艺 - 洗水”。
- 无图片显示“暂无图片”。

## 5. 印花

- 印花加工单创建印花任务。
- 转印完成后先待送货。
- 印花完成后先进入中转区域。
- 印花统计和大屏按任务、打印机、待送货、待回写、待审核展示。

## 6. 染色

- 染色加工单创建染色任务。
- 染色开始必须记录染缸号。
- 包装完成后先待送货。
- 染色完成后先进入中转区域。
- 染色报表按等待原因、节点耗时、染缸、差异、异议展示。

## 7. 裁床

- 菲票必须来自铺布产出矩阵。
- 菲票五维为：面料卷号、布料颜色、尺码、裁片部位、数量。
- 菲票归属原始裁片单，合并裁剪批次只作上下文。
- 同组裁片通过组装键追溯。
- 裁片单二维码一单一码，多次配料共用。
- 领料异常提交必须上传照片。
- 补料建议必须审核后生效。
- 裁片仓只做 A区 / B区 / C区 简化区域。

## 8. 技术包

- 纸样类型区分“针织 / 布料 / 暂无数据”。
- 纸样记录纸样文件、纸样版本、打版软件、尺码范围、尺寸表、公差。
- 技术包维护裁片部位库。
- 裁床部位优先引用技术包裁片部位。
- 图片来源只读真实字段，无图显示“暂无图片”。

## 9. 进度、统计、大屏

- 生产进度展示任务、交出、回写、差异、异议、质检、复检。
- 交接链路支持生产单、任务、交出单、质检、复检跳转。
- 领料/配料进度展示配置、领料、差异、补料。
- 裁床进度和裁剪总结汇总配料、领料、唛架、铺布、菲票、补料、裁片仓。
- 产能页面保留后道产能节点。
- 印花厂能力保留打印机设备口径。
- 染厂能力保留染缸设备口径。
- 特殊工艺页保留特殊工艺 - 洗水。

## 10. 菜单与路由

- 菜单 href 必须有对应 route。
- route 必须有 renderer。
- 动态详情页和打印预览页可作为隐藏路由访问。
- 不允许通过删除菜单、删除路由、降低检查强度规避验收。

## 11. FCS 与 WMS 边界

- 允许：中转区域、接收方回写、裁片仓 A/B/C 区域、面料卷标签轻量字段。
- 不允许：库存三态、完整库位、上架任务、拣货波次、完整入库、完整库存账、真实 WMS 接口。

## 12. 禁止文案清单

- 不允许回退到历史停用业务口径。
- 不允许页面直显历史英文字段码和停用工艺码。
- 不允许页面直显演示占位词和脚手架词。

## 13. 最终检查命令

- `npm run build`
- `npm run check:production-craft-dict-page`
- `npm run check:process-craft-sam-rules`
- `npm run check:process-craft-final-taxonomy`
- `npm run check:factory-capacity-profile`
- `npm run check:capacity-calendar-ia`
- `npm run check:capacity-risk-and-bottleneck`
- `npm run check:fcs-handover-domain`
- `npm run check:pda-exec-task-detail`
- `npm run check:pda-handover-pages`
- `npm run check:pda-pickup-flow`
- `npm run check:pda-task-receive-scope`
- `npm run check:post-route-qc-recheck`
- `npm run check:quality-deduction-domain`
- `npm run check:quality-deduction-lifecycle`
- `npm run check:quality-deduction-platform`
- `npm run check:production-confirmation`
- `npm run check:fcs-production-tech-pack-snapshot`
- `npm run check:fcs-tech-pack-snapshot-consumption`
- `npm run check:printing-workflow`
- `npm run check:dyeing-workflow`
- `npm run check:cutting-fei-ticket-assembly`
- `npm run check:cutting-material-prep-pickup-replenishment`
- `npm run check:cutting-marker-spreading-actions`
- `npm run check:cutting-traceability-chain`
- `npm run check:cutting-source-provenance`
- `npm run check:cutting-writeback-integrity`
- `npm run check:cutting-production-progress-columns`
- `npm run check:cutting:all`
- `npm run check:tech-pack-pattern-and-images`
- `npm run check:fcs-progress-and-routes`
- `npm run check:menu-routes`
- `npm run check:fcs-end-to-end`
- `npm run check:legacy-terminology-cleanup`
- `npm run check:fcs-final-acceptance`
