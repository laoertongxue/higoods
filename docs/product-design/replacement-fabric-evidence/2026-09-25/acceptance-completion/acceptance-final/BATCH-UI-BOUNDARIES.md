# HAND-004 / HAND-005 同批多袋 UI 验收补充

- 工作树：`/private/tmp/higoods-replacement-fabric-release-20260925`
- 分支：`codex/replacement-fabric-acceptance-20260925`；基础 HEAD：`3a3d1648`，证据覆盖当前未提交修复。
- 功能现场：dev `http://127.0.0.1:43235`，独立 `hpb-batch-boundaries` 会话，1366×768，`OWN-CUTTING-001_admin`。
- 明确 Mock 前置：生产单 `PO-202603-0002` 的有效车缝分配、已打印换片布票、正式完成裁剪产生的部位票、两个装袋及入仓事实。没有预写被测交出或领取结果。

## 已确认缺陷与修复

`resolveActionBagCurrent` 原先把所有票按部位裁片 SKU 匹配，导致无对应部位 SKU 的已绑定换片布票被清空任务归属，两袋无法自动归集。现在换片布、捆条只校验明确绑定的当前有效任务、同生产单与同工厂；有效绑定保留，旧工厂或其他生产单绑定阻断，未绑定票不猜任务，仍可在 UI 显式补扫加入。

代码仅改 `src/pages/process-factory/cutting/wait-handover-actions.ts` 9 行；专用契约 `tests/unit/wait-handover-fabric-assignment.test.ts` 8 条。部位裁片原匹配路径不变。

## 实际 UI 结果

`batch-ui-boundaries-r5.json` 两个隔离场景均通过，无业务 console/pageerror：

1. 未绑定换片布袋没有自动加入。实际选择任务及 PPIC 后只归集裁片袋；点击确认提示缺换片布，完整 records / commands / meta 保持不变；逐步回退并在真实输入中扫码补袋，再确认成功。
2. 已绑定同任务的两个袋自动归集，实际确认成功。

两场均产生同一交出批次的两个交出事件、唯一换片布回执；显示及持久结果保持部位裁片 800 片、换片布 5 Yard（pieceQty 为 0），刷新一致。真实自动归集顺序为换片布袋先、裁片袋后。页面没有供用户控制处理顺序的功能，因此不制造隐藏选择值或人为顺序按钮。反向提交排列由既有领域测试覆盖。

截图：`batch-ui-r5-unbound-fabric-omission-and-retry.png`、`batch-ui-r5-both-bound-auto-aggregation.png`。

为了避免 dev HMR 双模块，测试主动关闭 Vite WebSocket；精确匹配 `[vite] failed to connect to websocket.` 的基础设施错误单列 `infrastructureErrors`（每场 4 条），原文完整保留，其余错误仍使场景失败。preview 脚本不关闭 WebSocket、不忽略任何 console error。

## 契约与相邻验证

- `batch-ui-assignment-unit-before-r2.txt`：修复前 8 条中 6 条失败，准确复现有效绑定被清空及无明确阻断问题。
- `batch-ui-assignment-unit-after.txt`：8/8 通过。
- `batch-ui-assignment-unit-final.txt`：专用 8 条 + 换片布规则及混合标签相邻契约，共 20/20 通过。
- `batch-ui-adjacent-flow.txt`：`check-cutting-wait-handover-transfer-bag-flow.ts` 266/266 通过。
- 原始 `before.txt` 未设 indexedRuntimeSnapshot，不能证明有效分配场景，已保留并以 before-r2 为有效失败基线。
- r3 为 Mock 裁片身份错误导致任务候选缺失；r4 使用正式裁片来源后发现真实已绑定 HPB 归集缺陷；全部旧失败保留。

## 交主代理的生产版严格采样脚本

`prepare-batch-ui-backups.js` 已在 dev 执行一次，每场在前置完成且断言没有交出记录后，点击真实“本机数据 → 导出裁后处理备份”。产物：

- `batch-prerequisite-unbound-fabric-omission-and-retry.higcut`
- `batch-prerequisite-both-bound-auto-aggregation.higcut`
- `batch-ui-prerequisite-export-r1.json`：两份成功、无交出前置。

`check-batch-ui-preview-five.js` 已静态语法检查，未执行。供主代理在统一 build14 后独占运行：真实 preview43236 登录 → 本机恢复文件并等待“已恢复并读回确认” → 实际待交出 UI。

每场 5 次独立 context；记录开窗、任务选择、PPIC 选择、每步下一步、缺票确认、逐步回退、扫码补袋、最终确认。从真实 DOM click/change 事件开始，到结果可读、可见图片加载完成、两帧结束；最终成功还等待 IndexedDB 两条交出事件与回执读回。保留所有原始样本、异常和 >=500ms 样本。r5 功能结果不替代该严格性能结果。

源码已冻结，无提交，无构建。性能验收仍由主代理后续执行，不能提前标记通过。
