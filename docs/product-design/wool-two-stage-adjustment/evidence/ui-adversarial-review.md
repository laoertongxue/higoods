# 毛织两阶段 UI 专项对抗式审查记录

审查时间：2026-09-18 21:29（Asia/Shanghai）。审查人：Codex / wool_stage_pages；产品接受仍由用户确认。

## 1. 版本、范围与结论边界

- 工作树：`/Users/laoer/Documents/higoods/.worktrees/work-20260918`。
- 分支：`codex/work-20260918`；基础 HEAD：`4804328a822eec3c77eee1ffa5b10911bb77c9fe`；本记录验证的是该工作树中尚未提交的当前实现，不是此基础提交单独包含的代码。
- 范围：Web 横机/缝盘列表和详情、统一待接收与备料分配、PDA 路由与动作分发、阶段打印，以及展示层读取同源数量/时间事实。核心仓储原子性、上下游全链与完整性能验收由主审另行记录。
- 方法：从需求矩阵正向检查页面行为，再从路由、处理器、共享查询、打印和测试反向检查对象、阶段、单位、真实来源及遗留入口；重放错阶段、未接收、只分配备料、乱序实收、重复提交、错误工厂、自动衔接、已完单等边界。
- 本轮发现的业务/页面缺口已修复并通过下述专项复查；这不代表浏览器视觉、完整加载性能或总体需求已经验收。性能硬门禁仍有未通过项，不能据此关闭总体任务。

## 2. 发现 → 修复 → 自动化证据

| 级别 / 需求 | 可复现发现 | 当前修复位置与行为 | 复查证据 |
|---|---|---|---|
| P1 / RECV-006 | 仓储“查看备料/关联加工单”进入 `?view=stock`，页面原先仍是普通待接收，已收未绑定纱线没有分配入口 | `pending-receipts.ts` 根据 `view=stock` 进入 `stock-allocations.ts`；只列实际接收且未绑定的 YARN，复用共享分配命令。本厂、必需 SKU、未完单横机单才可选；片和缝盘单不可任意分配 | `check-wool-stock-allocations.ts`：库存真实余量、候选限制、超过余量阻断、缝盘阻断、二次确认、共享命令、重复保存、重读不重复接收 |
| P2 / PAGE-005、PAGE-011、STATE-009 | HJ260918-001 仅由备料分配取得必需纱线，投入栏显示实收，接收筛选却仍归入“尚未接收” | `stage-orders.ts:receiptFilterState` 使用 `getWoolWorkOrderReadinessProjection` 的同源有效实收及必需纱线种类判断，不再只看直接绑定的 `yarnReceipts` | 29 项备料专项：已具备条件能够查出、尚未接收不能查出；没有把种类具备说成全部计划重量收齐 |
| P2 / PAGE-008、PAGE-009、PAGE-011 | 备料分配后的“最近接收”日期筛选遗漏原实际接收时间 | `stage-orders.ts:filterTime` 从共享实收汇总读取最近时间；`stage-display.ts:renderWoolStageTimes` 合并直接实收和备料对应的实际 receipt，按 receipt ID 去重，同时单独展示分配时间 | 29 项备料专项：原实收日期命中；新增实收后旧日期不再命中；最新日期与列表一致 |
| P2 / PAGE-009 | 同 SKU 先直接接收或先分配一笔，再分配更晚的实收时，`latestReceivedAt` 没有更新；倒序分配也可能保留错误时间 | `queries.ts:getWoolWorkOrderReadinessProjectionFromStore` 每次合并取最大实际接收时间；时间比较统一兼容 `T` 与空格分隔 | 29 项备料专项：先新后旧、直接实收加分配、同日两种时间格式均正确；实收总量分别验证 6 kg、7.5 kg，且笔数没有重复 |
| P2 / PAGE-009、PAGE-011 | 无外加工横机单自动内部交出后，时间列显示已交出，但按“最近交出”日期筛选不命中 | `stage-orders.ts:filterTime(HANDOVER)` 纳入该阶段的自动内部交出，与时间列同源 | 29 项备料专项：实际自动内部交出记录对应日期能够命中原横机单 |
| P2 / PAGE-001、PDA-001 | PDA 备料分配记录的加工单链接跳往桌面详情 | `stock-allocations.ts:allocationSummary` 在 PDA 使用真实 `order.taskId` 生成 `/fcs/pda/exec/:taskId`，保留客户端导航；Web 仍使用阶段详情 | 29 项备料专项：PDA HTML 的 `href` 与 `data-nav` 为本单执行页，不含该单桌面详情链接 |
| P1 / PDA-001、PDA-003、RECV-007 | 新 PDA 待接收页即使可渲染，原事件分发器未识别其容器时，打开/输入没有实际业务动作 | `pda-handlers.ts` 实际分发到统一待接收及备料处理器；页面使用独立 `/fcs/pda/wool/pending-receipts` 入口和本厂身份 | 13 项阶段 UI 专项和 29 项备料专项均从实际 PDA dispatcher 发出事件，确认弹窗/输入可用且尚未提前保存 |
| P1 / QTY-007、PDA-004 | 横机外发片可交余额存在，但 PDA 交出按钮曾沿用按件余额判断而不可用 | PDA 横机交出按选中片的可用片数判断；横机和缝盘交出分别展示合法对象及单位 | 13 项阶段 UI 专项：横机有可用外发片时实际渲染的保存按钮可用；两阶段数量专项验证按首厂、分批、片身份交出 |
| P2 / PAGE-001、PAGE-016、PRINT-001～003 | 详情或打印地址携带错误阶段时可能展示另一阶段单据 | `stage-order-detail.ts`、`handover-print.ts` 接收路由阶段并核验订单；错误阶段显示明确阻断且不出现打印按钮。路由及导出统一迁为 stage-orders / stage-order-detail | 13 项阶段 UI 专项：错阶段详情/打印阻断、正确阶段可读、旧页面文件不存在、路由正确传入阶段 |
| P2 / PAGE-010、PAGE-016 | 已完单仍显示剩余可填报量；缝盘数量栏缺少实际下游实收 | `stage-display.ts:renderWoolStageProgress/renderWoolStageQuantities` 已完单可填报为 0；下游实收读取真实确认数量。未具备填报条件时不把 150% 容差余量当成当前可填量 | 13 项阶段 UI 专项：已完单数量/进度同时为零，下游实收 100 件；数量与边界专项保留 150% 和最短板约束 |
| P2 / PAGE-017、PDA-003 | 毛织片沿用款式图时，操作者可能将其当成该片实拍；缝盘 PDA 曾显示必需纱线提示 | `pending-receipts.ts:renderReceivingImage` 可见标注“款式参考图 / 非片实拍”；缝盘执行投影不索要横机纱线，保留真实外加工片回货记录 | 13 项阶段 UI 专项：可见图片标注、无错误纱线/150% 文案、回货记录和新接收扫码动作正确 |

## 3. 本轮性能实现与缓存防错

以下只确认代码和数量契约，不把减少重复计算当成性能门禁通过：

1. `stage-display.ts:renderWoolStageTimes` 的列表摘要分支提前返回，详情才计算达到计划时间、需求创建时间和完整事件时间线。
2. `queries.ts:readWoolReceivingQuerySnapshot` 按共享 receiving revision 缓存防御性只读副本；列表各列不再重复完整克隆全量 sources、receipts、allocations。没有复制为新的业务事实源。
3. readiness 仅缓存当前不可变 `queryStore`，任一毛织/接收 revision 变化后失效；传入命令草稿或可变 store 的 `FromStore` 调用始终重算。
4. 对外返回独立 Map，避免某个页面清空返回 Map 后污染后续页面。缓存值被冻结；命令仍操作可变草稿。
5. 专项先在未接收时读取 readiness，再保存分配并验证立即具备条件；又向同一个可变草稿连续写 2 件、7 件，验证第二次结果是 7 件且真实已报仍为 0。缓存没有掩盖事实变化。

## 4. 最后一次修改后的执行结果

全部命令在第 1 节工作树执行，Node 技术检查使用隔离内存 storage，未打开、清理或重置用户浏览器数据。

| 命令 | 本次结果 | 证据边界 |
|---|---|---|
| `node --import tsx scripts/check-wool-stock-allocations.ts` | 29 项通过，退出码 0 | 含真实 UI handler/dispatcher、接收与分配数量、筛选、日期和 PDA 链接；不是浏览器绘制计时 |
| `node --import tsx scripts/check-wool-stage-ui.ts` | 13 项通过，退出码 0 | 阶段、打印路由、数量、图片标注、扫码与 PDA 分发契约 |
| `node --import tsx scripts/check-wool-two-stage-flow.ts` | 8 项通过，退出码 0 | 自动四事实、幂等、无料、150%、修正、外发回货、独立完单及设备限制 |
| `node --import tsx scripts/check-wool-stage-boundaries.ts` | 6 项通过，退出码 0 | 保存失败回退、跨存储原子性、重复载荷、指定下游及伪造片身份阻断 |
| `git diff --check` | 通过，退出码 0 | 当前工作树空白/冲突标记检查，不代替业务验收 |
| `npx tsc --noEmit` | 全仓退出码 2；本次 queries / stage-display / stage-orders / stock-allocations 无诊断 | 原始输出保存在 `/tmp/wool-stage-ui-types-final.log`；仍有其他域已有诊断，不能写“全仓类型检查通过” |

## 5. 剩余验收与审查结论

当前代码/专项范围没有新增未处理的 P1/P2 业务缺口；以下是明确的未完成验收，不能省略或当成通过：

- **VERIFY-003～005 性能未通过**：主审在本轮期间反馈同工作树生产预览毛织列表的五次完整就绪仍为约 275–285 ms，超过 `<200ms`。本记录没有将该反馈当成当前最终版本原始测量；最新优化后必须重新保存冷启动、刷新、站内切换和每项操作各至少五次的完整原始值。
- **最终 UI 浏览器复验待合并证据**：本轮筛选、时间排序、PDA 分配链接和缓存之后，需要在 5186 / 同工作树生产预览重放：备料分配后投入与接收筛选一致、真实日期筛选、自动交出日期筛选、PDA 分配记录进入本单执行页。源码/HTML 契约不能证明真实点击后的视觉、滚动、焦点和导航均已通过。
- **设备、图片和打印**：最终版本仍须按矩阵合并 1366×768、1280×720、适用 1024×768、PDA 360×800 / 400×806，以及各真实图片加载/失败/大图关闭和横机/缝盘打印分页证据。已有图片文件不自动构成本轮修改后的验收。
- **矩阵关闭由主审完成**：本文件只为 RECV-006、PAGE-001/005/008～011/016～020、PDA-001/003/004、PRINT-001～003 及相邻数量规则提供专项证据。不能据此将整个工作包或总体任务标记“已验证”。

性能排查还确认：`fcs-route-links.ts → print-service.ts` 不会加载后道/裁片初始化，后者只有类型 import 和纯函数，因此没有进行无收益拆分。真实路径是 `tech-pack-source.ts → runtime-process-tasks.ts → sewing-delivery-receipt-facts.ts → post-finishing-full-flow.ts`，以及 runtime → cut-piece-release 的顶层 bootstrap；本专项没有修改这些其他业务模块。
