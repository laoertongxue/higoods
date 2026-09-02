# 后道 Web 兜底与 PDA 完成数量需求追踪矩阵

> 日期：2026-09-02
>
> 当前状态：第三次业务纠偏已完成本地原型验证；真实现场 PDA、扫码枪、弱网和生产数据未执行
>
> 总体设计：`docs/product-design/2026-09-02-后道Web兜底与PDA工序勾选纠偏方案.md`
>
> 实施计划：`docs/implementation-plans/2026-09-02-post-finishing-web-fallback-pda-checklist.md`

| 需求编号 | 来源 | 原子需求 | 工作包 | 实现位置 | 自动化验证 | 页面/PDA验证 | 状态 | 证据位置 | 产品确认人/版本 |
|---|---|---|---|---|---|---|---|---|---|
| PFWF-001 | §1.1、§3.1 | 待加工仓 Web 显示“扫码收货（Web 兜底）”主入口 | WP-02 | `src/pages/process-factory/post-finishing/warehouse.ts` | `check:post-finishing-web-pda-fallback` | Web待加工仓入口与弹层 | 已验证 | 审查记录§5、§7；本地浏览器扫码收货 | 用户确认/2026-09-02 |
| PFWF-002 | §3.1、§4.1 | 同一输入框支持扫码枪回车和手工输入完整送货单号 | WP-02 | `warehouse.ts`、`src/main.ts`扫码回车分发 | `check:post-finishing-web-pda-fallback`、全链表面检查 | Web扫码弹层回车/按钮 | 已验证 | 审查记录§5、§7 | 用户确认/2026-09-02 |
| PFWF-003 | §3.1 | Web 与 PDA 收货读取同一待确认记录和库存流水 | WP-01、WP-02 | `src/data/fcs/post-finishing-full-flow.ts`、`warehouse.ts` | `check:post-finishing-full-flow`（15链） | Web/PDA跨端回查 | 已验证 | 15链：15收货、30条待加工仓流水 | 用户确认/2026-09-02 |
| PFWF-004 | §1.1、§2 | PDA 是后道现场首选，Web 保留全部关键动作的应急兜底 | WP-03 | `work-orders.ts`、`work-order-detail.ts`、`pda-post-finishing-flow.ts` | `check:post-finishing-web-pda-fallback` | Web/PDA双端命名页面 | 已验证 | 双入口浏览器2/2；15链Web接管 | 用户确认/2026-09-02 |
| PFWF-005 | §4.2 | 后道单列表同时展示 PDA 优先入口和 Web 应急处理入口 | WP-03 | `src/pages/process-factory/post-finishing/work-orders.ts` | `check:post-finishing-factory-detail-actions` | Web后道单列表 | 已验证 | `post-finishing-factory-detail-actions.spec.ts` 2/2 | 用户确认/2026-09-02 |
| PFWF-006 | §3.2、§4.2 | Web 可开始、填写 SKU 完成数量、调整 SKU 结果并完成同一后道单 | WP-01、WP-03 | `post-finishing-full-flow.ts`草稿函数、`work-order-detail.ts` | `check:post-finishing-web-pda-fallback` | Web详情连续操作 | 已验证 | 共享专项1/1；跨端浏览器1/1（8.9分钟） | 用户纠偏/2026-09-02 |
| PFWF-007 | §2、§5.2 | Web 应急接管必须填写原因并记录操作人与时间 | WP-01、WP-03 | `takeOverPostFinishingPostTask`、`work-order-detail.ts` | 接管原因/错误操作人阻断 | Web接管提示与成功状态 | 已验证 | 专项`webTakeoverActor`；15链接管日志 | 用户确认/2026-09-02 |
| PFWF-008 | §1.3、§3.2、§4.3 | 加工项目沿用质检确认结果并只读展示，PDA 主动作是逐 SKU 填写完成数量 | WP-01、WP-04 | `setPostFinishingPostCompletedQuantity`、PDA任务详情 | 5 SKU 数量专项 | 360×800、400×806 | 已验证 | PDA命名浏览器1/1；完整回归9/9 | 用户纠偏/2026-09-02 |
| PFWF-009 | §3.3 | 任一 SKU 必须已填写合法完成数量，或瑕疵/返厂已覆盖全部应加工数量，才能完成后道 | WP-01、WP-04 | `completePostFinishingPostTaskFromDraft`、Web/PDA完成按钮 | 0、超量、遗漏、整批瑕疵领域契约 | PDA/Web禁用态及数量归类完成后启用 | 已验证 | 共享专项与PDA命名浏览器 | 用户纠偏/2026-09-02 |
| PFWF-010 | §4.3、§4.4 | SKU 卡片不平铺数量原因字段；加工中始终显示“调整瑕疵数量”入口和摘要，未保存完成数量时也可直接调整 | WP-04 | `src/pages/pda-post-finishing-flow.ts`任务卡片与调整页 | `check:post-finishing-full-flow-surface` | 360×800、400×806 | 已验证 | PDA命名浏览器：填数量前5个入口均可用 | 用户纠偏/2026-09-02 |
| PFWF-011 | §4.4 | 瑕疵调整进入独立 SKU 页面并可保存返回 | WP-04 | `route-renderers.ts`、`routes-pda.ts`、`pda-handlers.ts`、PDA调整页 | 路由/保存表面检查 | PDA独立调整页 | 已验证 | PDA专项浏览器：原因阻断后保存返回 | 用户确认/2026-09-02 |
| PFWF-012 | §3.3、§4.4、§5.2 | 瑕疵支持增加或减少；每种原因分别填写数量，总数由明细求和，减少不得超过该原因余额 | WP-01、WP-04 | `savePostFinishingPostSkuAdjustment`、Web/PDA调整表单 | 两原因增加/逐原因减少/超余额契约 | PDA/Web错误提示与明细 | 已验证 | 共享专项原因明细；PDA先减后增浏览器场景 | 用户纠偏/2026-09-02 |
| PFWF-013 | §3.3 | 后道合格数量由完成数量减瑕疵明细合计减返厂计算 | WP-01、WP-03、WP-04 | 完成数量函数、SKU调整函数、草稿完成函数 | 数量计算/守恒契约 | Web/PDA紧凑摘要 | 已验证 | 共享专项与全链3×5×5 | 用户纠偏/2026-09-02 |
| PFWF-014 | §1.6、§4.5 | 日志详情使用链路概览、差异与瑕疵、操作记录三个互斥标签 | WP-05 | `src/pages/process-factory/post-finishing/audit-records.ts`详情渲染 | 互斥表面检查 | Web日志三标签 | 已验证 | 浏览器专项3/3；审查记录§5 | 用户确认/2026-09-02 |
| PFWF-015 | §4.5 | 操作记录按业务阶段分组，组内按时间排序 | WP-05 | `audit-records.ts`分阶段时间线 | 阶段分组表面检查 | Web操作时间线标签 | 已验证 | 浏览器显示回货/质检/后道等折叠组 | 用户确认/2026-09-02 |
| PFWF-016 | §4.5、§5.2 | 日志详情 URL 保留业务链和当前标签，刷新不丢失 | WP-05 | `audit-records.ts`的`deliveryId`/`detailTab`查询参数 | 查询参数契约 | 三标签导航与刷新 | 已验证 | 命名浏览器详情路由 | 用户确认/2026-09-02 |
| PFWF-017 | §4.2、§4.3 | Web/PDA 继续展示与 SKU 对应的真实图片及加载/失败状态 | WP-03、WP-04 | Web详情图片块、PDA`image()` | 图片表面与构建 | 缩略图/失败态/大图 | 已验证 | 浏览器加载、大图Esc、主动失败态 | 用户确认/2026-09-02 |
| PFWF-018 | §5.2 | 完成数量重复保存覆盖同一 SKU 草稿；Web/PDA 可继续同一草稿 | WP-01 | 完成数量函数、Web/PDA局部数量更新 | 幂等覆盖、跨端接管 | PDA填数量→Web继续 | 已验证 | 跨端链2-3：PDA保存首SKU→Web接管继续 | 用户纠偏/2026-09-02 |
| PFWF-019 | §6 | 最后一次修改后重跑专项、构建、治理与命名页面 | WP-06 | 专项脚本、Playwright、审查记录 | 专项、构建、治理、任务收据均通过 | 最新纠偏命名回归3/3；此前跨端回归1/1；最终收据无阻断 | 已验证 | `/private/tmp/post-finishing-defect-before-completion-task-receipt.json` | 用户纠偏/2026-09-02 |
| PFWF-020 | §6 | 本地原型验证与真实现场 PDA/生产数据证据分开结论 | WP-06 | 设计、计划、矩阵、审查记录§6/例外 | 不适用：交付表述规则 | 真实PDA/现场扫码枪/弱网/生产数据明确未执行 | 已验证 | 审查记录结论为“有条件通过” | 用户确认/2026-09-02 |
| PFWF-021 | §1.6、§4.4 | Web/PDA 后道调整删除责任方、现场证据图片和图片地址板块 | WP-01、WP-03、WP-04 | 共享草稿提交参数、Web/PDA调整页 | 删除表面检查 | Web/PDA均不可见 | 已验证 | 表面检查；PDA命名浏览器断言0个 | 用户纠偏/2026-09-02 |
| PFWF-022 | §1.7、§3.3、§4.4 | 返厂接收责任通过可搜索候选列表选择；PDA 使用移动端候选样式 | WP-01、WP-03、WP-04 | 接收对象候选、Web/PDA调整页与保存校验 | 非候选阻断/搜索过滤 | PDA搜索与选择 | 已验证 | PDA搜索“车缝”并选择候选后保存1/1 | 用户纠偏/2026-09-02 |
| PFWF-023 | §3.3、§4.3、§4.4、§5.1 | 瑕疵调整不依赖先填完成数量；整批瑕疵/返厂时系统按应加工数量结清并生成合格 0 件结果 | WP-01、WP-03、WP-04 | `savePostFinishingPostSkuAdjustment`、`completePostFinishingPostTaskFromDraft`、Web/PDA数量归类展示 | 未填完成先增瑕疵、超量阻断、部分未归类阻断、整批瑕疵完成契约 | PDA整批瑕疵2/2；Web无前置调整1/1 | 已验证 | 专项通过；命名浏览器3/3；最终任务收据 | 用户纠偏/2026-09-02 |

## 正向与反向审查结果

- 变更记录：用户于 2026-09-02 再次纠正瑕疵前置门禁；PFWF-009、010、012、013、019 重新进入验证，新增 PFWF-023。上一轮相关自动化和任务收据不再作为当前完成证明。
- 正向：PFWF-001～PFWF-023 已全部回到总体设计章节，并由当前版本专项、命名页面与最终任务收据闭环。
- 反向：已确认不存在工序复选框、单一瑕疵总数/原因映射、责任方输入、现场证据输入和 PDA 返厂接收对象自由文本入口。
