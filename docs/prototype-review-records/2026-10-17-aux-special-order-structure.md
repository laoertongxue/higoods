# 辅助、特种工艺加工单结构对齐

依据 `AGENTS.md` 的 SCOPE-02、TRACE-01、LIST-01、REVIEW-01、PERF-01、EVIDENCE-01，使用 `docs/prototype-review-record-template.md` 完整产品审查格式。

## 基本信息

- 日期：2026-10-17
- 任务 / 需求编号：CRAFT-ALIGN-01～18、CRAFT-C01～C12
- 验证人：Codex 主代理（技术验证；用户接受未发生）

## 影响判定

- 记录模式：完整产品审查
- 用户可见影响：有
- 判定依据：18 个动态加工单列表统一染色页的信息分组、查询卡片、统计、表格、分页和局部交互，按 T4 验证。

## 需求、继承与范围

用户于 2026-10-17 要求所有辅助工艺、特种工艺加工单按染色结构调整，逐项调整核对、全量核对、最后两轮对抗审查。继承 AGENTS.md LIST-01、UI-01、IMAGE-01、PERF-01 和当前业务对象契约。参照当前 HEAD `5ac7c58cbc657925541a4d2868512c2b4ad17f65` 的染色加工单，以及已有印花、横机、缝盘信息分组。

目标结构：标题与已有主操作 → 真实工厂切换（适用时）→ 查询卡片 → 紧凑统计 → 独立列表卡片与分页；表格使用加工单／商品、加工投入／上游、加工要求、处理进度、加工产出／下游、时间、数量、操作八组信息。

不新增染色专属配方、打印、导出、编辑或批量操作；本次没有新增这些业务需求。现有详情、收货、完工、交出和物料加工计划保留。业务对象、身份、持久化与数量规则保持原契约。原列表按菲票展开重复主单；改为一张加工单一行，SKU／部位信息保留在单内。普通查询只读现有事实；不改存储归属，不清理用户资料。

业务对象 → 静态源／对象仓库 → 读写入口 → 关联动作 → 旧项 → 验收：加工单读 `getSpecialCraftTaskOrders`（现有工艺运行事实与毛织投影）；商品及物料读生产单冻结技术包／毛织快照；查询、统计、排序、分页只操作页面内存；列偏好按工艺写新布局版本 localStorage 键 `higood:list-page:/fcs/craft/special-craft/work-orders:dye-layout-v1:<operationId>`（仅列键、页尺寸，单键小于 2 KiB，失败默认）；旧布局偏好不删除、不继续写入，新八列以默认完整可见开始；详情与业务动作沿用原入口。无业务迁移、备份、重置或附件写入。

## 实施计划与完成条件

1. 固定菜单清单、参照页及正常／空结果边界；建立下面矩阵。
2. 在共享列表和直接展示文件内统一骨架，保持业务处理器；依据实际订单对象显示投入与产出，不凭工艺默认值猜测。
3. 逐项启用新结构，每启用一项立即核对对应页面后再启用下一项；全部通过后删除临时切换代码。
4. 固定生产构建资产，对全部 18 页做全量核对；覆盖 1366×768、1280×720、1024×768，图片预览、查询重置、列偏好及分页。
5. 性能按等价家族至少五个有效样本，冷启、刷新、站内切换及局部动作分别记录，全部 <=1000ms；保留失败。
6. 两轮实质对抗审查：第一轮完整 diff／正向需求覆盖及业务分支；第二轮修复后反向路由／交互／证据攻击。问题逐项复验后才能关闭。
7. 整理矩阵与证据，冻结文件后运行治理及技术收据。本地交付，用户未要求推送部署。

## 清单与逐项调整记录

逐项启用新结构后立即核对，再启用下一项；全部通过后删除临时开关与旧实现。下列 18 项均有初核日志及最终生产资产全量回验，最终状态均为“已验证”。

| 编号 | 分类 | 加工单 | 路由 | 订单数 | 状态 | 初核及最终证据 |
| --- | --- | --- | --- | --- | --- | --- |
| CRAFT-ALIGN-01 | 辅助工艺 | 打揽加工单 | `/fcs/process-factory/special-craft/aux-op-dalan/work-orders` | 9 | 已验证 | `step-01.log` → `full-01.log`、`full-01-*.png` |
| CRAFT-ALIGN-02 | 辅助工艺 | 打条加工单 | `/fcs/process-factory/special-craft/aux-op-strip/work-orders` | 9 | 已验证 | `step-02.log` → `full-02.log`、`full-02-*.png` |
| CRAFT-ALIGN-03 | 辅助工艺 | 烫画加工单 | `/fcs/process-factory/special-craft/aux-op-heat-transfer/work-orders` | 9 | 已验证 | `step-03.log` → `full-03.log`、`full-03-*.png` |
| CRAFT-ALIGN-04 | 辅助工艺 | 直喷加工单 | `/fcs/process-factory/special-craft/aux-op-direct-print/work-orders` | 9 | 已验证 | `step-04.log` → `full-04.log`、`full-04-*.png` |
| CRAFT-ALIGN-05 | 辅助工艺 | 布包扣加工单 | `/fcs/process-factory/special-craft/aux-op-covered-button-making/work-orders` | 9 | 已验证 | `step-05.log` → `full-05.log`、`full-05-*.png` |
| CRAFT-ALIGN-06 | 辅助工艺 | 绣花加工单 | `/fcs/process-factory/special-craft/aux-op-embroidery/work-orders` | 18 | 已验证 | `step-06.log` → `full-06.log`、`full-06-*.png` |
| CRAFT-ALIGN-07 | 辅助工艺 | 压褶加工单 | `/fcs/process-factory/special-craft/aux-op-pleating/work-orders` | 9 | 已验证 | `step-07.log` → `full-07.log`、`full-07-*.png` |
| CRAFT-ALIGN-08 | 辅助工艺 | 贝壳绣加工单 | `/fcs/process-factory/special-craft/aux-op-shell-embroidery/work-orders` | 9 | 已验证 | `step-08.log` → `full-08.log`、`full-08-*.png` |
| CRAFT-ALIGN-09 | 辅助工艺 | 曲牙绣加工单 | `/fcs/process-factory/special-craft/aux-op-curved-teeth-embroidery/work-orders` | 22 | 已验证 | `step-09.log` → `full-09.log`、`full-09-*.png` |
| CRAFT-ALIGN-10 | 辅助工艺 | 一字贝绣花加工单 | `/fcs/process-factory/special-craft/aux-op-straight-shell-embroidery/work-orders` | 9 | 已验证 | `step-10.log` → `full-10.log`、`full-10-*.png` |
| CRAFT-ALIGN-11 | 辅助工艺 | 盘扣加工单 | `/fcs/process-factory/special-craft/aux-op-button-loop/work-orders` | 1 | 已验证 | `step-11.log` → `full-11.log`、`full-11-*.png` |
| CRAFT-ALIGN-12 | 辅助工艺 | 花朵加工单 | `/fcs/process-factory/special-craft/aux-op-flower-making/work-orders` | 9 | 已验证 | `step-12.log` → `full-12.log`、`full-12-*.png` |
| CRAFT-ALIGN-13 | 辅助工艺 | 打褶加工单 | `/fcs/process-factory/special-craft/aux-op-gathering/work-orders` | 9 | 已验证 | `step-13.log` → `full-13.log`、`full-13-*.png` |
| CRAFT-ALIGN-14 | 辅助工艺 | 烫钻加工单 | `/fcs/process-factory/special-craft/aux-op-hotfix-rhinestone/work-orders` | 9 | 已验证 | `step-14.log` → `full-14.log`、`full-14-*.png` |
| CRAFT-ALIGN-15 | 特种工艺 | 模板工序加工单 | `/fcs/process-factory/special-craft/spc-op-template-process/work-orders` | 9 | 已验证 | `step-15.log` → `full-15.log`、`full-15-*.png` |
| CRAFT-ALIGN-16 | 特种工艺 | 激光开袋加工单 | `/fcs/process-factory/special-craft/spc-op-laser-pocket/work-orders` | 9 | 已验证 | `step-16.log` → `full-16.log`、`full-16-*.png` |
| CRAFT-ALIGN-17 | 特种工艺 | 特种车缝（花样机）加工单 | `/fcs/process-factory/special-craft/spc-op-pattern-machine-sewing/work-orders` | 9 | 已验证 | `step-17.log` → `full-17.log`、`full-17-*.png` |
| CRAFT-ALIGN-18 | 特种工艺 | 橡筋定长切割加工单 | `/fcs/process-factory/special-craft/spc-op-elastic-fixed-length-cutting/work-orders` | 9 | 已验证 | `step-18.log` → `full-18.log`、`full-18-*.png` |

清单来自当前启用的工艺菜单与实际命名路由，共 14 项辅助、4 项特种，176 张加工单：成衣 18、普通已裁部位 117、毛织片 22、布包扣 9、橡筋 9、盘扣 1。当前没有整匹面料实例，未虚构其现场验收。印花、横机、缝盘与染色为现有参照，本次不修改。

## 原子矩阵

证据路径未写目录的，均位于 `output/playwright/craft-order-alignment/`。确认人均为 Codex 技术验证，确认版本为本分支未提交工作树；产品源码和生产资产逐文件 SHA256 见 `asset-version.json`，最终任务差异由独立技术收据绑定。PDA／打印未修改，不将桌面证据冒充跨端验收。

| 需求编号 | 来源章节 | 原子需求 | 工作包 | 实际文件 / 符号 | 自动化验证 | 页面 / PDA / 打印 / 性能证据或不适用理由 | 状态 | 证据位置 | 确认人和确认版本 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| CRAFT-ALIGN-01 | 用户完整清单第 1 项 | 命名加工单呈现染色八组结构及独立列表卡片 | 逐项页面 | task-orders.ts / renderSpecialCraftTaskOrdersPage；order-display.ts / createSpecialCraftDisplayColumns | 逐项及全量真实 Chromium 断言标题、八列、数量、正常／空结果／恢复 | 1366×768、1280×720、1024×768，首屏与右滚动；共用性能见 C09；PDA／打印不适用 | 已验证 | `step-01.log`、`full-01.log`、对应 PNG | Codex；asset-version.json |
| CRAFT-ALIGN-02 | 用户完整清单第 2 项 | 命名加工单呈现染色八组结构及独立列表卡片 | 逐项页面 | task-orders.ts / renderSpecialCraftTaskOrdersPage；order-display.ts / createSpecialCraftDisplayColumns | 逐项及全量真实 Chromium 断言标题、八列、数量、正常／空结果／恢复 | 1366×768、1280×720、1024×768，首屏与右滚动；共用性能见 C09；PDA／打印不适用 | 已验证 | `step-02.log`、`full-02.log`、对应 PNG | Codex；asset-version.json |
| CRAFT-ALIGN-03 | 用户完整清单第 3 项 | 命名加工单呈现染色八组结构及独立列表卡片 | 逐项页面 | task-orders.ts / renderSpecialCraftTaskOrdersPage；order-display.ts / createSpecialCraftDisplayColumns | 逐项及全量真实 Chromium 断言标题、八列、数量、正常／空结果／恢复 | 1366×768、1280×720、1024×768，首屏与右滚动；共用性能见 C09；PDA／打印不适用 | 已验证 | `step-03.log`、`full-03.log`、对应 PNG | Codex；asset-version.json |
| CRAFT-ALIGN-04 | 用户完整清单第 4 项 | 命名加工单呈现染色八组结构及独立列表卡片 | 逐项页面 | task-orders.ts / renderSpecialCraftTaskOrdersPage；order-display.ts / createSpecialCraftDisplayColumns | 逐项及全量真实 Chromium 断言标题、八列、数量、正常／空结果／恢复 | 1366×768、1280×720、1024×768，首屏与右滚动；共用性能见 C09；PDA／打印不适用 | 已验证 | `step-04.log`、`full-04.log`、对应 PNG | Codex；asset-version.json |
| CRAFT-ALIGN-05 | 用户完整清单第 5 项 | 命名加工单呈现染色八组结构及独立列表卡片 | 逐项页面 | task-orders.ts / renderSpecialCraftTaskOrdersPage；order-display.ts / createSpecialCraftDisplayColumns | 逐项及全量真实 Chromium 断言标题、八列、数量、正常／空结果／恢复 | 1366×768、1280×720、1024×768，首屏与右滚动；共用性能见 C09；PDA／打印不适用 | 已验证 | `step-05.log`、`full-05.log`、对应 PNG | Codex；asset-version.json |
| CRAFT-ALIGN-06 | 用户完整清单第 6 项 | 命名加工单呈现染色八组结构及独立列表卡片 | 逐项页面 | task-orders.ts / renderSpecialCraftTaskOrdersPage；order-display.ts / createSpecialCraftDisplayColumns | 逐项及全量真实 Chromium 断言标题、八列、数量、正常／空结果／恢复 | 1366×768、1280×720、1024×768，首屏与右滚动；共用性能见 C09；PDA／打印不适用 | 已验证 | `step-06.log`、`full-06.log`、对应 PNG | Codex；asset-version.json |
| CRAFT-ALIGN-07 | 用户完整清单第 7 项 | 命名加工单呈现染色八组结构及独立列表卡片 | 逐项页面 | task-orders.ts / renderSpecialCraftTaskOrdersPage；order-display.ts / createSpecialCraftDisplayColumns | 逐项及全量真实 Chromium 断言标题、八列、数量、正常／空结果／恢复 | 1366×768、1280×720、1024×768，首屏与右滚动；共用性能见 C09；PDA／打印不适用 | 已验证 | `step-07.log`、`full-07.log`、对应 PNG | Codex；asset-version.json |
| CRAFT-ALIGN-08 | 用户完整清单第 8 项 | 命名加工单呈现染色八组结构及独立列表卡片 | 逐项页面 | task-orders.ts / renderSpecialCraftTaskOrdersPage；order-display.ts / createSpecialCraftDisplayColumns | 逐项及全量真实 Chromium 断言标题、八列、数量、正常／空结果／恢复 | 1366×768、1280×720、1024×768，首屏与右滚动；共用性能见 C09；PDA／打印不适用 | 已验证 | `step-08.log`、`full-08.log`、对应 PNG | Codex；asset-version.json |
| CRAFT-ALIGN-09 | 用户完整清单第 9 项 | 命名加工单呈现染色八组结构及独立列表卡片 | 逐项页面 | task-orders.ts / renderSpecialCraftTaskOrdersPage；order-display.ts / createSpecialCraftDisplayColumns | 逐项及全量真实 Chromium 断言标题、八列、数量、正常／空结果／恢复 | 1366×768、1280×720、1024×768，首屏与右滚动；共用性能见 C09；PDA／打印不适用 | 已验证 | `step-09.log`、`full-09.log`、对应 PNG | Codex；asset-version.json |
| CRAFT-ALIGN-10 | 用户完整清单第 10 项 | 命名加工单呈现染色八组结构及独立列表卡片 | 逐项页面 | task-orders.ts / renderSpecialCraftTaskOrdersPage；order-display.ts / createSpecialCraftDisplayColumns | 逐项及全量真实 Chromium 断言标题、八列、数量、正常／空结果／恢复 | 1366×768、1280×720、1024×768，首屏与右滚动；共用性能见 C09；PDA／打印不适用 | 已验证 | `step-10.log`、`full-10.log`、对应 PNG | Codex；asset-version.json |
| CRAFT-ALIGN-11 | 用户完整清单第 11 项 | 命名加工单呈现染色八组结构及独立列表卡片 | 逐项页面 | task-orders.ts / renderSpecialCraftTaskOrdersPage；order-display.ts / createSpecialCraftDisplayColumns | 逐项及全量真实 Chromium 断言标题、八列、数量、正常／空结果／恢复 | 1366×768、1280×720、1024×768，首屏与右滚动；共用性能见 C09；PDA／打印不适用 | 已验证 | `step-11.log`、`full-11.log`、对应 PNG | Codex；asset-version.json |
| CRAFT-ALIGN-12 | 用户完整清单第 12 项 | 命名加工单呈现染色八组结构及独立列表卡片 | 逐项页面 | task-orders.ts / renderSpecialCraftTaskOrdersPage；order-display.ts / createSpecialCraftDisplayColumns | 逐项及全量真实 Chromium 断言标题、八列、数量、正常／空结果／恢复 | 1366×768、1280×720、1024×768，首屏与右滚动；共用性能见 C09；PDA／打印不适用 | 已验证 | `step-12.log`、`full-12.log`、对应 PNG | Codex；asset-version.json |
| CRAFT-ALIGN-13 | 用户完整清单第 13 项 | 命名加工单呈现染色八组结构及独立列表卡片 | 逐项页面 | task-orders.ts / renderSpecialCraftTaskOrdersPage；order-display.ts / createSpecialCraftDisplayColumns | 逐项及全量真实 Chromium 断言标题、八列、数量、正常／空结果／恢复 | 1366×768、1280×720、1024×768，首屏与右滚动；共用性能见 C09；PDA／打印不适用 | 已验证 | `step-13.log`、`full-13.log`、对应 PNG | Codex；asset-version.json |
| CRAFT-ALIGN-14 | 用户完整清单第 14 项 | 命名加工单呈现染色八组结构及独立列表卡片 | 逐项页面 | task-orders.ts / renderSpecialCraftTaskOrdersPage；order-display.ts / createSpecialCraftDisplayColumns | 逐项及全量真实 Chromium 断言标题、八列、数量、正常／空结果／恢复 | 1366×768、1280×720、1024×768，首屏与右滚动；共用性能见 C09；PDA／打印不适用 | 已验证 | `step-14.log`、`full-14.log`、对应 PNG | Codex；asset-version.json |
| CRAFT-ALIGN-15 | 用户完整清单第 15 项 | 命名加工单呈现染色八组结构及独立列表卡片 | 逐项页面 | task-orders.ts / renderSpecialCraftTaskOrdersPage；order-display.ts / createSpecialCraftDisplayColumns | 逐项及全量真实 Chromium 断言标题、八列、数量、正常／空结果／恢复 | 1366×768、1280×720、1024×768，首屏与右滚动；共用性能见 C09；PDA／打印不适用 | 已验证 | `step-15.log`、`full-15.log`、对应 PNG | Codex；asset-version.json |
| CRAFT-ALIGN-16 | 用户完整清单第 16 项 | 命名加工单呈现染色八组结构及独立列表卡片 | 逐项页面 | task-orders.ts / renderSpecialCraftTaskOrdersPage；order-display.ts / createSpecialCraftDisplayColumns | 逐项及全量真实 Chromium 断言标题、八列、数量、正常／空结果／恢复 | 1366×768、1280×720、1024×768，首屏与右滚动；共用性能见 C09；PDA／打印不适用 | 已验证 | `step-16.log`、`full-16.log`、对应 PNG | Codex；asset-version.json |
| CRAFT-ALIGN-17 | 用户完整清单第 17 项 | 命名加工单呈现染色八组结构及独立列表卡片 | 逐项页面 | task-orders.ts / renderSpecialCraftTaskOrdersPage；order-display.ts / createSpecialCraftDisplayColumns | 逐项及全量真实 Chromium 断言标题、八列、数量、正常／空结果／恢复 | 1366×768、1280×720、1024×768，首屏与右滚动；共用性能见 C09；PDA／打印不适用 | 已验证 | `step-17.log`、`full-17.log`、对应 PNG | Codex；asset-version.json |
| CRAFT-ALIGN-18 | 用户完整清单第 18 项 | 命名加工单呈现染色八组结构及独立列表卡片 | 逐项页面 | task-orders.ts / renderSpecialCraftTaskOrdersPage；order-display.ts / createSpecialCraftDisplayColumns | 逐项及全量真实 Chromium 断言标题、八列、数量、正常／空结果／恢复 | 1366×768、1280×720、1024×768，首屏与右滚动；共用性能见 C09；PDA／打印不适用 | 已验证 | `step-18.log`、`full-18.log`、对应 PNG | Codex；asset-version.json |
| CRAFT-C01 | 用户要求、范围、AGENTS.md | 一单一行，保留 SKU／部位及数量追溯 | 共享及差异 | task-orders.ts / expandRows；order-display.ts / inputs | 176 单计数、分页／50条边界、精确毛织查询 | 桌面实测；PDA／打印未改；性能独立见 C09 | 已验证 | full-*.log、performance-boundaries.json、extras.json | Codex；asset-version.json |
| CRAFT-C02 | 用户要求、范围、AGENTS.md | 投入与产出单位分别正确，盘扣张→个不混算 | 共享及差异 | order-display.ts / renderSpecialCraftQuantities | 盘扣、布包扣米／Yard／件、橡筋米→条等专项契约；实际页面 | 桌面实测；PDA／打印未改；性能独立见 C09 | 已验证 | craft-unit-final12.log、interactions.json | Codex；asset-version.json |
| CRAFT-C03 | 用户要求、范围、AGENTS.md | 毛织片按片和实际路线显示，不冒充菲票 | 共享及差异 | order-display.ts / inputs、progress、outputs | 22 张毛织投影契约；毛织单详情直达与身份回验 | 桌面实测；PDA／打印未改；性能独立见 C09 | 已验证 | craft-unit-final12.log、extras.json、review-r2.json | Codex；asset-version.json |
| CRAFT-C04 | 用户要求、范围、AGENTS.md | 上下游及实际交出数量、交接时间只取已有事实 | 共享及差异 | order-display.ts / resolveSpecialCraftHandedOverQty、latestSpecialCraftRecordedTime、times | 显式0、单笔、异单／异单位、多笔不合并、时间排序／时区；历史两单三视口 | 桌面实测；PDA／打印未改；性能独立见 C09 | 已验证 | craft-unit-final12.log、review-r1.json、r1-*.png | Codex；asset-version.json |
| CRAFT-C05 | 用户要求、范围、AGENTS.md | 真实商品／物料图精确对应，大图关闭、Esc、遮罩及失败态有效 | 共享及差异 | order-display.ts / product、inputs；现有 renderWoolObjectImage | 全量图片成功；成衣不把 BOM 布料当成衣；大图标题使用业务 SKU | 桌面实测；PDA／打印未改；性能独立见 C09 | 已验证 | interactions.json、review-r2.json、full-*.log | Codex；asset-version.json |
| CRAFT-C06 | 用户要求、范围、AGENTS.md | 查询／重置同步统计与总数；工厂维度来自实际订单 | 共享及差异 | task-orders.ts / renderFilters、buildFilters、renderFactoryTabs、handleSpecialCraftTaskOrdersEvent | 关键词正常／无结果；状态和日期草稿→查询→重置；实际工厂切换与越厂阻断 | 桌面实测；PDA／打印未改；性能独立见 C09 | 已验证 | full-*.log、interactions.json、performance-extra.json、performance-boundaries.json | Codex；asset-version.json |
| CRAFT-C07 | 用户要求、范围、AGENTS.md | 列设置、排序、分页局部更新，列偏好按工艺隔离 | 共享及差异 | task-orders.ts / loadPrefs、savePrefs、handleSpecialCraftTaskOrdersEvent | 根节点未替换；必需列不可隐藏；真实拖拽、冻结、回读、恢复；路由间隔离 | 桌面实测；PDA／打印未改；性能独立见 C09 | 已验证 | interactions.json、extras.json、performance-extra.json | Codex；asset-version.json |
| CRAFT-C08 | 用户要求、范围、AGENTS.md | 三个桌面视口主体无横向溢出，宽表只在容器内滚动 | 共享及差异 | task-orders.ts / renderSpecialCraftTaskOrdersPage | 18 路由×3视口，表格左右两端截图与滚动宽度断言 | 桌面实测；PDA／打印未改；性能独立见 C09 | 已验证 | full-batch-0-6.json、full-batch-6-12.json、full-batch-12-18.json | Codex；asset-version.json |
| CRAFT-C09 | 用户要求、范围、AGENTS.md | 适用性能家族各至少5有效样本且均<=1000ms | 共享及差异 | 共享列表及直接展示；浏览器实际完成时刻采集器 | 81 个细分组×5样本=405；最高809.2000000476837ms；失败原始记录保留 | 桌面实测；PDA／打印未改；性能独立见 C09 | 已验证 | performance-summary.json、4份原始数据、采样脚本、timing-diagnosis.json | Codex；asset-version.json |
| CRAFT-C10 | 用户要求、范围、AGENTS.md | 已有详情、物料加工计划及状态动作入口继续使用原业务身份 | 共享及差异 | task-orders.ts / COLUMNS；buildSpecialCraftTaskDetailPath | 菜单／业务弹窗专项检查；毛织详情实际跳转；裁片动作打开／取消，未提交业务数据 | 桌面实测；PDA／打印未改；性能独立见 C09 | 已验证 | craft-menus-tsx.log、craft-actions-tsx.log、extras.json、performance-extra.json | Codex；asset-version.json |
| CRAFT-C11 | 用户要求、范围、AGENTS.md | 逐项、全量及两轮实质对抗审查通过后才能关闭 | 共享及差异 | 本记录实施计划与两轮审查表 | 第一轮3项、第二轮1项全部修复复验；反向检查仅5个任务文件，无临时切换 | 桌面实测；PDA／打印未改；性能独立见 C09 | 已验证 | step-*.log、full-*.log、review-closure.json | Codex；asset-version.json |
| CRAFT-C12 | 用户要求、范围、AGENTS.md | 仅保存有界列偏好，不改变业务事实源或清理存量 | 共享及差异 | task-orders.ts / storageKey、getStorage、savePrefs | 单工艺新版本键；读写SecurityError默认与查询恢复；无业务写入／附件／迁移 | 桌面实测；PDA／打印未改；性能独立见 C09 | 已验证 | extras.json；最终任务 diff；asset-version.json | Codex；asset-version.json |

## 自查结论

| 检查项 | 结论 | 证据 / 问题及处理 |
| --- | --- | --- |
| 清单、逐项与全量覆盖 | 通过 | CRAFT-ALIGN-01～18：18次初核、54个最终页面场景、108张全量截图 |
| 数量、单位与历史缺省事实 | 通过 | C02、C04；12项专项契约及历史单实际页面，缺省不当零、多笔不造汇总 |
| 毛织与材料身份 | 通过 | C03、第二轮R2-01；业务SKU用于显示，内部身份仅用于关联与查图 |
| 状态与动作入口 | 通过 | C06、C10；状态／工厂筛选同步数量，原业务弹窗打开取消，不冒充提交验收 |
| 商品、物料真实图片 | 通过 | C05；冻结技术包／同款正式图片／精确物料档案来源，大图与失败态实测 |
| 布局和设备视口 | 通过 | C08；1366×768、1280×720、1024×768均核对，宽表容器内滚动 |
| 局部更新与列偏好 | 通过 | C07、C12；真实拖拽回读，SecurityError降级，不替换页面根节点 |
| 性能 | 通过 | C09；405个有效样本均低于1秒，最高809.2ms；完整小数与原始值保留 |
| 两轮对抗审查 | 通过 | 第一轮3项和第二轮1项均关闭，未关闭0项；见下面审查表与review-closure.json |
| 业务保存、迁移、附件、备份／清理 | 不适用 | 本任务只读既有业务事实和复用原动作入口；未改变业务写入、记录归属和附件生命周期 |
| PDA与打印 | 不适用 | 本次仅18个命名桌面列表结构，没有修改PDA、打印或新增其动作 |
| 真实工厂接受、多人后端与设备联调 | 不适用 | 仅同工作树本地生产预览和隔离浏览器原型验证，用户接受未发生 |

## 最终结论

结论：通过

状态为本地原型已验证、成果交付本工作树；用户接受未发生。未要求推送或部署。此结论基于下面列明的产品与审查证据；最终技术收据只证明其实际绑定的检查，不替代页面、性能或用户接受。

## 变更覆盖与验证

### 受管文件

- `src/pages/process-factory/special-craft/task-orders.ts`
- `src/pages/process-factory/special-craft/order-display.ts`

另改 `tests/unit/special-craft-order-display.test.ts`、`scripts/check-special-craft-task-and-fei-flow-deepening.ts` 与本记录，总共5个任务文件。专项检查改为区分生产需求明细与已有毛织投影，验证真实毛织身份、路线、无假菲票和数量守恒，没有伪造 demandLines。

### 页面证据

- 版本：分支 `codex/craft-order-structure`，HEAD／基准 `5ac7c58cbc657925541a4d2868512c2b4ad17f65` 加本任务未提交差异；工作树 `/Users/laoer/.codex/worktrees/dfd6/higoods`；正式服务 `http://127.0.0.1:43183`（Vite production preview）；源码及1179项生产资产逐文件哈希见 `asset-version.json`。开发诊断服务43182仅用于逐项初核，不与正式性能混报。
- 设备：本机Mac15,12／arm64，Chromium 155.0.8059.80有界面模式；三个桌面视口如上；时区Asia/Shanghai，Node v26.8.2，网络loopback，无外部业务API。环境见 `environment.json`；仅本任务停止构建与索引等重任务后串行采样，不声称控制整机其他任务。
- 证据：上方清单逐行绑定命名路由的 `step-*` 与最终 `full-*`，三批JSON汇总54个最终场景；正常／无结果／重置、列表统计与单数、八列表头、图片加载、主体无溢出、容器右滚动均通过。参照截图 `output/playwright/dye-reference-before.png`、`output/playwright/craft-before.png` 保留实施前身份。
- 差异与恢复：`interactions.json`（分页、列偏好隔离及刷新、工厂、盘扣／材料单位、大图与失败态、原动作取消、越厂阻断）；`extras.json`（真实毛织单详情、列隐藏保护／冻结／真实拖拽／刷新回读／恢复默认、列偏好读写SecurityError）；`review-r1.json`（历史数量和时间）；`review-r2.json`（毛织／BOM业务SKU与大图标题）。R1及通用交互证据保留其采集版本 `asset-version-r1.json`，R2仅改投入字段及大图标题，不改其数量、时间、事件或存储路径；最终全量与性能均在R2最终资产执行。
- 图片来源：冻结技术包商品／款式／样衣图优先；缺图款使用 `pcs-reviewed-image-catalog.ts` 中精确 `ASYSA26060310` 的同款正式映射；毛织读自身款图；BOM按精确materialSkuId读取已有档案skuImageUrl。材料图片和大图业务标题均对应档案 `ACC-ELASTIC-42CM-WHITE`。成衣不显示BOM布料图作为成衣实物，保留同一行商品识别上下文。全量无图片缺失占位或加载失败；失败态通过刻意错误图片URL验证后刷新恢复，不改静态资源。

### 性能结论

- 结论：通过
- 依据：`performance-summary.json` 汇总405个有效样本、81个细分组，每组至少5次，全部<=1000ms，最高809.2000000476837ms。原始数据为 `performance.json`、`performance-extra.json`、`performance-boundaries.json`、`performance-browser-cold.json`，脚本同名 `.js`；冷进程使用 `run-browser-cold.py`，逐次启动与关闭日志保留。

起点：整页导航／刷新为navigationStart；站内切换、点击、输入、change为真实浏览器事件；拖拽从drop开始，用户拖动等待不计。终点：目标内容、数量、状态匹配，当前所需图片complete且解码，字体就绪，运行动画完成，再经两帧绘制，由浏览器在首次完成时保存时间。工具轮询只取已经保存的时间，不进入响应耗时。无保存业务动作，因此不声称持久提交性能。

加载家族分别使用最大混合列表曲牙绣22单及多单位／多物料图布包扣9单；对应完整18页的同一列表代码、单页10条，分别覆盖裁片／毛织与材料图片成本；所有18入口已独立功能核验。1366、1024两布局分支分别五次新隔离上下文首次访问、刷新、真实侧栏切换；新上下文HTTP缓存与站点数据隔离，刷新／切换在同上下文中另记。独立浏览器进程冷态另5次，先开空白页，应用从首次导航开始计时，浏览器进程启动耗时留启动日志，未冒充应用响应或合并为同一家族。没有新增数据初始化动作。

局部家族使用同一事件处理器的最大混合数据；分页20条及50条显示全22单另验，状态、无结果、恢复、工厂、冻结／拖拽、偏好、图片、业务弹窗均分家族；等价成员为18工艺共享的同实现和完成条件，具体差异加载另列。所有统计原始小数保留，不用平均数／分位数放行。

| 性能家族 | 有效样本 | 最大值(ms，显示3位小数；原始未舍入) |
| --- | --- | --- |
| fresh-context-navigation | 20 | 739.800 |
| refresh | 20 | 647.500 |
| in-app-navigation | 20 | 197.800 |
| keyword-input | 10 | 29.200 |
| empty-query | 10 | 514.800 |
| reset-query | 10 | 198.800 |
| sort | 10 | 214.500 |
| next-page | 10 | 64.000 |
| previous-page | 10 | 49.400 |
| open-columns | 10 | 48.600 |
| hide-column | 10 | 48.500 |
| show-column | 10 | 49.500 |
| close-columns | 10 | 32.400 |
| open-image | 10 | 32.100 |
| close-image-escape | 10 | 31.600 |
| page-size-20 | 10 | 575.300 |
| page-size-10 | 10 | 46.500 |
| factory-select | 10 | 49.100 |
| factory-reset | 10 | 49.200 |
| matched-query | 10 | 198.100 |
| unfreeze-identity-column | 10 | 97.100 |
| freeze-column | 10 | 65.000 |
| unfreeze-column | 10 | 49.700 |
| drop-column | 10 | 48.600 |
| restore-columns | 10 | 199.000 |
| close-image-button | 10 | 32.900 |
| close-image-backdrop | 10 | 32.000 |
| open-existing-action | 10 | 515.000 |
| cancel-existing-action | 10 | 181.300 |
| page-size-50-all22 | 10 | 563.000 |
| page-size-10-from50 | 10 | 61.800 |
| status-draft | 10 | 32.300 |
| status-query | 10 | 199.000 |
| status-reset | 10 | 214.000 |
| time-draft | 10 | 28.700 |
| time-query-existing-contract | 10 | 214.600 |
| time-reset | 10 | 214.600 |
| browser-process-cold-navigation | 5 | 809.200 |

历史失败与采集修正：保留 `performance-r1-polling.json/.log/.js` 中1082.2ms的未通过诊断记录。旧终点是工具轮询读数，包含额外采集等待；同次采样 `timing-diagnosis.json` 证明实际完成644.5ms而读数960.5ms，相差316ms。该旧记录未被删除、改写或宣称通过；新采集器在实际完成时取时间，最终完整重新采样，使用独立版本原始数据。`full-v1/`、`full-v2/`及最终全量日志的loadMs是包含自动化往返的诊断上界，均不作为正式性能通过值。

采集器前置条件失败也保留：`performance-extra-freeze-precondition.*` 中未先解除260px身份列冻结，导致再冻结270px投入列被360px宽度上限正确禁止，未填0ms；按已实现规则调整采集步骤后完整补测。`performance-boundaries-time-expectation.*` 原假定TODAY为空，与原固定演示时钟契约不符，实际18单；确认源码与页面后按原契约补测，不修改业务过滤。两个无效采集均未计入405有效样本。初期抽屉／自定义动作弹窗定位器校准、真实拖动失败及历史日志均保留。

### 验证命令

- `npm run build`：通过
- `node --import tsx --test tests/unit/special-craft-order-display.test.ts`：通过
- `npx vite build`：通过
- `node --import tsx scripts/check-special-craft-operation-menus.ts`：通过
- `node --import tsx scripts/check-special-craft-web-action-dialog-rerender.ts`：通过
- `node --import tsx scripts/check-special-craft-task-and-fei-flow-deepening.ts`：通过
- `git diff --check`：通过
- `npm run check:prototype-design-governance -- --scope worktree --paths docs/prototype-review-records/2026-10-17-aux-special-order-structure.md,scripts/check-special-craft-task-and-fei-flow-deepening.ts,src/pages/process-factory/special-craft/task-orders.ts,src/pages/process-factory/special-craft/order-display.ts,tests/unit/special-craft-order-display.test.ts`：通过
- `npm run check:list-page-governance -- --scope worktree --paths docs/prototype-review-records/2026-10-17-aux-special-order-structure.md,scripts/check-special-craft-task-and-fei-flow-deepening.ts,src/pages/process-factory/special-craft/task-orders.ts,src/pages/process-factory/special-craft/order-display.ts,tests/unit/special-craft-order-display.test.ts`：通过

命令证据：`build.log`为初轮完整构建及1024单测；最终局部契约12项见 `craft-unit-final12.log`，最终生产资产构建见 `craft-assets-final-r2.log`。工程渐进类型检查两个受影响源码0错误，仓库全量既有13项范围外错误保留，见 `craft-types-r2.log`；不称全仓TypeScript零错误。原package专项命令使用旧Node strip-types目录解析，在当前Node触发ERR_UNSUPPORTED_DIR_IMPORT，未改无关工具；以上tsx执行相同专项断言并通过，旧失败日志保留。最终收据按实际工具路由会再执行必要检查及完整构建，此为工具限制，未绕过或假报复用。

最终冻结后技术收据位置：`/tmp/craft-task-receipt.json`；收据日志 `/tmp/craft-task-receipt.log`。生成期间不改绑定文件，运行状态在本次交付答复与独立收据中登记，不回写记录使绑定失效。

最终专项重跑日志为 `craft-menus-final.log`、`craft-actions-final.log`、`craft-flow-final.log`，三项通过。治理检查首轮因记录头缺少规范引用格式失败；补齐根 AGENTS.md 引用后两项均通过，见 `craft-prototype-governance-2.log`、`craft-list-governance-2.log`，初轮失败日志同时保留。列表静态检查覆盖1个改变结构的页面，产品治理覆盖2个运行文件，均没有排除任务路径。

### 例外

- 无性能、图片或审查门禁例外。
- CodeGraph经用户明确允许后已执行 `codegraph init -i`，完成2639文件索引；最终MCP状态无Pending sync，初始化日志 `craft-codegraph-init.log`。最终收据还会执行其自己的sync与状态核对，不把旧状态冒充新回执。
- 保留原有 `withinTimeRange` 的固定演示时钟2026-04-23及其只按时间差上界筛选的原契约，未来日期会进入“今日”；这是既有数据层行为，未扩大本次结构任务为日期语义整改，也不称真实生产日期筛选已验收。

## 两轮对抗性审查

审查人：只读子代理contract_audit，未写代码或再派代理；主代理检查完整diff、整合修复并独立真实交互复验。两轮有不同攻击目标，修复后仅复核已有问题，没有把同一结论重复计作两轮。

| 轮次／编号 | 实质问题 | 根因与修复 | 复验及结论 |
| --- | --- | --- | --- |
| 第一轮 R1-01 | 缺省交出汇总被显示0 | 保留显式数值含0；缺失时仅精确同单位单笔读取；多笔无归并身份显示“汇总未记录”，逐笔列单号数量状态，不造总量 | 单笔／无记录／异单／异单位／多笔契约与两个历史订单页面三视口；已关闭 |
| 第一轮 R1-02 | 忽略已有交出和下游实收时间 | handoverAt、receiveAt分别按实际有效发生时间比较，与节点及毛织批次事实区分本厂接收／下游实收 | 历史订单实际时间与时区／无效值契约；已关闭 |
| 第一轮 R1-03 | dragstart／dragover刷新抽屉打断真实拖拽 | 仅更新拖拽内部状态，drop后才更新DOM | 原生dragTo、表头顺序、冻结与刷新回读、恢复默认；已关闭 |
| 第二轮 R2-01 | 毛织pieceKey、BOM materialSkuId被当业务SKU | 毛织使用piece.skuCode；精确档案使用materialSkuCode，缺失退冻结materialCode并标“物料编号”；物料图片标题同样修正 | 毛织／布包扣／橡筋三视口、大图标题、两项新契约；审查人核对截图及源码／1179资产哈希；已关闭 |

第一轮正向追踪需求到完整diff与业务分支，首次不通过，3项修复复验后通过。第二轮从最终页面字段反向追踪业务身份与来源，同时攻击缺省／重复／异单位事实及路由交互，首次不通过，唯一问题2个分支及大图标题修正后通过。关闭回执见 `review-closure.json`，未关闭问题0项。

主代理最终双向核对：18个菜单／路由→单一列表实现→八组展示与动作→专项及页面证据；反向从源码、Mock分支、图片、路由和测试追到 CRAFT-ALIGN-01～18、CRAFT-C01～C12。最终仅5个任务文件；没有临时启用门、旧列表副本、第二业务事实源、新打印／导出／后台或无依据菜单变更。源码与输出哈希、54场景、405性能样本及两轮关闭证据相互对应。
