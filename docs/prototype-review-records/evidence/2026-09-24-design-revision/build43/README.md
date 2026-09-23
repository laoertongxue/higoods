# 设计改款剩余入口补证 — build43

## 版本和结论

2026-09-24，在 `codex/design-revision-implementation` 工作树 `/Users/laoer/.codex/worktrees/design-revision-implementation/higoods` 验证。基准 HEAD `fdce30661c1683b0212025c45dc5155cff4c314d`；包含未提交修改，以 manifest.json 的文件 SHA256 为准。生产预览 `http://127.0.0.1:4732` 与构建工作树相同；dist/index.html SHA256 `f8f62da439969fecfb651b8f279810bd8e990a2c098cf45ce02e257f9912c554`。Chromium 149.0.7827.55。

本次用户点名的工厂/PDA 入口、调拨/交接打印、筛选/拖列/跨页性能补证已验证。原总体矩阵中的其他历史边界项不以本批证据自动认定完成；未提交、推送或部署。32 个不同浏览器用例在本构建分批通过：主批 29 通过，样衣测试修正初始化等待后 1 通过，弹层批 2 通过。额外增强仓库送货单 6 类操作并通过。初始失败日志完整保留，没有将分批结果表述为一次全绿。

## 可复现证据

| 范围 | 当前证据 | 样本及结果 |
|---|---|---|
| 构建、类型、核心业务契约 | [build.log](build.log) | 426/426 单元测试，生产构建通过 |
| 工厂 12 路由全部适用筛选、工厂切换含更多菜单、排序、分页、列显示/冻结/拖动、导出 | [factory-entry](factory-entry/performance.json) | 464 类，每类 5 次；2320 样本；最大 149.40000000596046ms |
| 工厂首次进入、刷新、站内离开及返回 | [factory-routes](factory-routes/performance.json) | 12×4×5；冷进入最大 627.3999999985099ms（加工单列表授权例外），刷新最大 438.3999999985099ms；其他项均 <500ms |
| PDA 接单列表/详情、执行列表/详情、交出、收货，含中央工厂收货 | [pda-routes](pda-routes/performance.json) | 13 个工厂身份＋路由组合×2×5；冷进入最大 499.20000000298023ms，刷新最大 382ms |
| 工厂弹层、图片、Esc、备注保存、日志和条码 | [overlays](overlays/run.log) 及目录内 JSON | 染色 44 类、印花 33 类，各 5 次；最大 182.5ms |
| 接单、实际工序填报、原卷实收、交出扫码防错、状态筛选和底部导航 | [browser](browser/run.log) 及目录内逐例 JSON | 包含染→印→中央工厂三段实收；刷新持久化、重复扫码不重复入库、终态与旧汇总交出入口防错 |
| PCS 筛选、列拖动、批量复制和跨页导航 | browser 中 list-performance.json | 52 类×5；冷进入最大 302.5ms，刷新最大 114.9ms |
| 染色交出、印花交出打印及关闭 | [handover-print](handover-print/performance.json) | 各 5 次预览和 5 次关闭；预览最大 82.60000000149012ms，关闭最大 49.4ms |
| 仓库调拨送货单创建至打印 | additional-initial 中 transfer-print-performance.json | 6 类创建/选择/保存操作×5，最大 109.10000000149012ms；打印 5 次最大 66.10000000149012ms |
| 样衣存储失败回滚、保留成果、重试、刷新不重复 | [sample-retry](sample-retry/run.log) | 1/1，通过；初始错误是异步初始化前读取存储，继而误等已完成任务不存在的编辑行；仅修正测试前置等待 |
| 最低桌面宽度 | [minimum-layout](minimum-layout/minimum-layout.json) | 12 路由，1280×720，页面宽度均 1280 |

工厂路由为 `/fcs/craft/{dyeing,printing}/{work-orders,pending-receipts,pending-handover,handover-documents,wait-process-warehouse,wait-handover-warehouse}`。桌面主验收 1366×768；样衣操作 1024×768；PDA 390×844。PDA 身份 F090、FAC-FLOWER 及 DYE-GOTO-GLOBAL。没有减少完整 Mock 列表；单页数据不足以翻页的 5 个工厂页面在原始 JSON 明确记不适用，其余分页均实测。

## 计时和数据

每项以目标内容和可见图片可用为终点，包含绘制等待；确认操作核对持久化结果。冷进入在独立浏览器上下文进行，刷新、站内切换分别保留；不预热后冒充冷进入。仅染色、印花加工单列表冷进入按用户授权 ≤1000ms，其余逐样本 <500ms。列拖动记录完整手势耗时，并单列 drop 后结果响应；拖动手势人为移动时间不混入响应指标，原始 gestureDuration 保留。未用均值掩盖超时。

Fixture 为 ES-ID-DR-025 / ES-DR-025，20 Yard 同一 BOM，原卷 CHAIN-RAW-ROLL-01；来自实际原型领域动作生成的各阶段快照，隔离上下文不清用户数据。源快照 SHA256 见 manifest。旧失败样本及 CPU profile 留在前序 build 目录；本构建复验全部具名门禁通过。

## 实际修复和打印检查

1. 印花 Esc 原先加载 FCS 聚合关闭器，触发无关裁片/仓储模块初始化，造成后续约 1.2s 阻塞。`src/main.ts::closeDialogsOnEscape` 让印花本地弹层自行处理 Esc；浏览器回归同时确认不再加载无关模块。
2. 设计改款印花旧“总数量交出”入口可能绕过逐卷实物流转。数据层阻断，PDA 引导到实际产出卷交出；正式逐卷流程保持可用。染印产出就绪/已完成状态均验证。
3. 三份新增 PDF 均已栅格化目视检查：仓库→染厂显示来源任务、RAW SKU、原卷、20 Yard；染厂→印厂显示设计改款来源、ES-DR-025、20 Yard/18.29 Meter、接收 FLOWER；印厂→中央工厂显示正式产出卷、20 Yard、goto_global 和来源任务。图片与识别字段同块，无遮挡或裁切。PDF、PNG 与 raster PNG 同目录。打印不增加库存。

证据属于 Mock 原型、浏览器打印预览及 PDF，不代表实体打印机、真实面料交接或实物样衣已发生。概念样衣图持续明确标注。

## 重放入口

- `CUTTING_E2E_PORT=4732 CUTTING_E2E_USE_PREVIEW=true npx playwright test tests/pcs-design-revision-*.spec.ts --workers=1 --trace off`（可按本索引命名用例收窄）。
- `node tests/helpers/design-revision-factory-entry-performance.mjs`
- `node tests/helpers/design-revision-factory-route-performance.mjs`
- `node tests/helpers/design-revision-pda-performance.mjs`
- `node tests/helpers/design-revision-print-performance.mjs`
- `node tests/helpers/design-revision-gap-layout.mjs`

先用 `tests/unit/fcs-design-revision-result-readiness.test.ts` 的“同一 BOM 行真实”用例配合 `tests/helpers/design-revision-evidence-storage.mjs` 生成阶段 fixture；各脚本读取 `output/playwright/design-revision-gap/fixtures/`。源代码变更后须重新构建并重放受影响项。

## 最终治理

[原型治理](governance.log)：通过，67 个可见影响文件由本任务记录覆盖。[标准列表治理](list-governance.log)：通过，包含真实 Chromium 拖列、DOM 区域稳定、顺序与持久化验证。[diff-check](diff-check.log)：通过。治理在本任务隔离工作树执行；没有将主工作区其他变更纳入。
