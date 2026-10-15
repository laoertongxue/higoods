# 印花操作栏发起洗水与名称统一 V1.2 审查记录

依据 [AGENTS.md](../../AGENTS.md) 的 SCOPE-02、TRACE-01、STORE-01～05、REVIEW-01、PERF-01 与 EVIDENCE-01。

## 基本信息

- 日期：2026-10-15
- 任务 / 需求编号：WASH-206～WASH-225；继承 WASH-001～205 的业务边界
- 验证人：Codex 主代理（技术验证，不代表用户产品接受或真实工厂执行）

## 影响判定

- 记录模式：完整产品审查
- 用户可见影响：有
- 判定依据：印花列表增加有条件的发起洗水弹窗；现行固定功能名称统一；可编辑技术包草稿移除残留预定洗水节点。保存沿用同库事务和旧身份，不增加服务端或配方数据。T4，本次本地交付。

## 自查结论

| 检查项 | 结论 | 证据 / 问题及处理 |
| --- | --- | --- |
| 实际完成面料批次、数量与入口条件 | 通过 | fabric-washing 单元及 row-guards；77 张单逐一比较批量判定和点击实时判定，纸张/非面料、暂停/取消阻断。 |
| 操作栏发起及局部更新 | 通过 | entry 脚本五轮覆盖三种管理视口；原查询和表格 DOM 保持；关闭后对应行入口与焦点更新。 |
| 保存与恢复 | 通过 | 缺手感、错误职责、空间不足无半套记录；失败保留手感；真实事务挂起时关闭和 Esc 无效；事务完成后判断、主单和日志可读。 |
| 去重与持久回读 | 通过 | 洗水与无需洗水两种判断，全部判断后入口隐藏，重新加载一致；保存结果链接进入同一个单据。 |
| 直接上下游及旧身份 | 通过 | 14 项基础集成、10 项边界、1 项追加入口校验；现有洗水接收、真实领用、库存、新卷码、晚匹配、备份恢复、旧升级及历史深链。 |
| Web / PDA / 打印名称与图片 | 通过 | 基础集成含 PDA 390×844、打印和真图预览；真实 IAB 管理弹窗图及工艺路线图。现有大图与 Esc 相邻行为通过。 |
| 技术包与新拆解边界 | 通过 | 存量可编辑草稿读取移除预定洗水并桥接前置，普通读取不改旧源；发布和审核锁定版本保留历史；草稿与已发布反向夹具五轮。初始拆解已有 removePredeterminedWashing 契约复核。 |
| 需求、范围及性能 | 通过 | WASH-206～225 已逐项绑定；77 个有效性能样本、13 个家族均至少 5 次，最大 894.30ms；保留全部失败与校准记录。 |

## 两轮实质审查

均由主代理执行，没有派发独立审查代理。

1. 正向沿“行入口 → 批次/卷 → 角色 → 判断 → 原子保存 → 单据/下游”审查：新建弹窗排除所有已有判断，保留原详情的纠正入口；点击重新校验，保存复用原事务；增加保存中关闭保护、图片 Esc 隔离、焦点循环和成功链接关闭父弹窗。发现逐行重复同步，改为一次列表快照判定，实时点击校验保留。
2. 反向从页面、路线、字典、持久键、打印、PDA、Mock 和断言追溯：技术包实页发现存量草稿残留固定洗水，已修复草稿读取并桥接前置；已发布/审核锁定图保留。显示更名不改变 WASH/craft-wash、WS 编号、地址、存储格式/键或历史自由文本。19 个其余运行文件的差异逐字确认仅为名称替换。助剂和配比仍在线下。

## 最终结论

结论：通过

本修订本地技术验证通过；WASH-206～225 对应当前实现与证据。原 205 条证据继续保留原版本身份；本次没有提交或发布。

## 变更覆盖与验证

### 受管文件

- `src/data/app-shell-config.ts`
- `src/data/fcs/fabric-washing-maintenance.ts`
- `src/data/fcs/fabric-washing-mock.ts`
- `src/data/fcs/fabric-washing-model.ts`
- `src/data/fcs/fabric-washing-repository.ts`
- `src/data/fcs/fabric-washing.ts`
- `src/data/fcs/factory-receiving-warehouse.ts`
- `src/data/fcs/factory-receiving.ts`
- `src/data/fcs/printing-task-domain.ts`
- `src/data/fcs/tech-packs.ts`
- `src/data/pcs-material-variant-fcs-dict.ts`
- `src/data/pcs-material-variant-types.ts`
- `src/data/production-timing/source.ts`
- `src/data/tech-pack-process-route.ts`
- `src/pages/process-factory/dyeing/pending-receipts.ts`
- `src/pages/process-factory/dyeing/warehouse.ts`
- `src/pages/process-factory/dyeing/washing/storage-tools.ts`
- `src/pages/process-factory/dyeing/washing/work-orders.ts`
- `src/pages/process-factory/printing/dialogs.ts`
- `src/pages/process-factory/printing/events.ts`
- `src/pages/process-factory/printing/work-orders.ts`
- `src/pages/production-fulfillment/order-pages.ts`
- `src/pages/production/detail-domain.ts`
- `src/pages/tech-pack/context.ts`
- `src/pages/wls/finished/basic-processor.ts`
- `src/pages/wls/raw-online/seed.ts`
- `src/pages/wls/raw/washing-stock.ts`
- `src/pages/wls/transit-online/hilon-cutting-all.ts`

### 页面证据

- 版本：codex/post-print-fabric-washing；HEAD 50ab50c61f95f158771ef56cc5c383ed50ed5505 加本修订未提交差异；同工作树 /Users/laoer/.codex/worktrees/a266/higoods；Vite production preview 127.0.0.1:43158。源码、运行资产及证据 SHA256 单列 manifest.json。
- 证据：../verification-evidence/2026-10-15-washing-entry-v1.2/；印花列表 77 张、每页 50 行，PH-WASH 12 张（六类已完成 A、六类仅纸张 B），每张 A 6 卷各 50 Yard；1366×768、1280×720、1024×768；PDA 390×844。开发服务 43157 仅用于独立领域集成，性能只用生产预览。浏览器时区 Asia/Shanghai。
- 场景与隔离：printing-row-action-final.jpg、row-initiation-final.jpg、created-from-row.png；当前技术包 tdv_demand_SPU_TSHIRT_081 的存量草稿及注入历史节点的隔离反向夹具。IAB 没有创建或改写用户业务记录，保存和故障注入只在隔离测试 context。

### 性能结论

- 结论：通过
- 依据：performance-summary.json 绑定 61 个正式入口样本、11 个保存中关闭保护样本和 5 个技术包路线样本，共 77 个，13 个家族各至少 5 次，最大 894.30ms。原始超时 1074.6 / 1017 / 1025.5ms、采集器选择器/事务挂起/锁定夹具错误及修复后的复测均保留。导航从 navigationStart 开始，动作从真实 pointerdown/keydown 开始，终点为正确 DOM、必要可见实图解码、两个绘制帧；保存额外完成原生 IndexedDB 事务回读。校准移除了等待屏外资源全部 load 的额外等待，没有改业务完成条件或缩小 77 张单、每页 50 行规模。原 205 条 1675 样本保留旧身份。

### 验证命令

- `npm run build`：通过
- `node --import tsx --test tests/unit/fabric-washing.test.ts tests/unit/fabric-washing-route-codec.test.ts`：通过
- `WASH_BASE_URL=http://127.0.0.1:43157 node scripts/check-post-print-fabric-washing.mjs`：通过
- `node scripts/check-post-print-fabric-washing-edges.mjs`：通过
- `WASH_EDGE_FILTER=WASH-208 node scripts/check-post-print-fabric-washing-edges.mjs`：通过
- `node scripts/check-printing-washing-entry.mjs`：通过
- `WASH_ENTRY_RUNS=0 node scripts/check-printing-washing-entry.mjs`：通过
- `node scripts/check-washing-draft-route.mjs`：通过
- `npm run check:list-page-governance -- --scope worktree --base HEAD`：通过
- `npm run check:prototype-design-governance -- --scope worktree --base HEAD`：通过

### 例外

- 无业务规则豁免。既有技术包中两条非洗水辅料缺图，本次没有识别或修改这些对象，不冒称全技术包图片问题已修复；洗水实际面料真图和相关交互已单独验证。
- 本次不提交、合并或发布；GitHub 和线上仍为先前已发布版本。技术收据位置为 output/printing-washing-entry-v1.2/task-receipt.json，技术收据不是产品整体接受。
