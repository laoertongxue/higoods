# 采购管理系统（PMS）迁移实施计划

- 版本：2026-09-18
- 状态：现行
- 总体设计：`docs/product-design/采购管理系统PMS迁移总体设计.md`
- 需求说明：`docs/product-requirements/采购管理系统PMS产品需求说明文档.md`
- 需求矩阵：`docs/requirement-traceability/采购管理系统PMS迁移需求追踪与交付矩阵.md`
- 实施工作树：`/Users/laoer/Documents/higoods/.worktrees/pms`，分支 `codex/pms-srm-migration`，基线 `4804328a`
- 完成标准：矩阵中本批次负责的需求全部达到 `已验证` 或明确 `不适用`；页面通过命名路由浏览器验收与 `<200ms` 性能门禁；无占位页、无死链；审查记录与任务收据通过。

## 0. 执行约定

- 每个工作包开工前声明负责的需求编号；不吸收未声明编号的业务变更。
- 页面文件全部位于 `src/pages/pms/`；数据文件全部位于 `src/data/pms/`；共享组件优先复用 `src/components/ui/`。
- 每个页面完成后立即执行文件级（语法/类型）和功能级（专项检查）验证；批次结束执行运行时级与项目级验证。
- 最后一次实质修改后重跑受影响证据；旧截图、旧收据不得复用。
- 不修改现有 `/pms/purchase-order` 页面、FCS/WLS 事实源、打印测试锁定的边界。

## WP0 基建（随 P1 交付）

### WP0.1 路由与菜单

- 业务目标：PMS 菜单与路由可达，旧占位菜单删除，默认页指向工作台。
- 文件/符号：`src/router/routes-pms.ts`、`src/router/route-renderers-pms.ts`、`src/router/routes.ts`、`src/data/app-shell-config.ts`。
- 修改：
  1. 新建 `routes-pms.ts`（exact + dynamic，BOM 详情动态路由）。
  2. 新建 `route-renderers-pms.ts`，用 `createAsyncRenderer` 模式懒加载页面。
  3. `routes.ts` 增加 `pmsRoutesPromise/getPmsRoutes`，`getRoutesByPathname` 增加 `/pms` 分支，`/pms` 根路径重定向到工作台。
  4. `app-shell-config.ts`：`defaultPage` 改 `/pms/workbench/overview`；重建 pms 菜单 11 组；删除 `supplier`、`contract` 两项。
- 验证证据：`npm run check:menu-routes`（脚本更新后）；浏览器访问每个菜单路径返回 200 且非占位文案。
- 完成条件：30 个迁移路由 + 2 个子页 + BOM 动态详情全部命中 registry；旧两项菜单与路径不存在。

### WP0.2 事件接线

- 业务目标：PMS 页面交互由统一事件入口处理，不进入 FCS/PCS handler。
- 文件/符号：`src/main-handlers/pms-handlers.ts`、`src/main.ts`。
- 修改：表驱动 `PmsHandlerSpec`；main.ts 增加 loader、`getCurrentHandlerSystem` 的 `pms` 分支与 `dispatchPageEvent` 调用。
- 验证证据：构建通过；页面点击/输入/change 事件在浏览器中生效；`/pms/purchase-order` 仍由 FCS handler 认领。
- 完成条件：PMS 页面事件无遗漏、无跨系统误认领。

### WP0.3 PMS 数据域基建

- 业务目标：业务命令、日志、数量口径统一，页面不直接改域数组。
- 文件/符号：`src/data/pms/runtime.ts`、`src/data/pms/images.ts`。
- 修改：序号/actionId/审计日志/`PmsDomainError`/`roundPmsQty`；图片常量与对象映射。
- 验证证据：`tests/unit/pms-runtime.test.ts`。
- 完成条件：单测通过；后续域文件全部复用 runtime，不重复实现。

### WP0.4 治理脚本接入

- 业务目标：PMS 变更自动进入对应检查，菜单路由一致性受门禁保护。
- 文件/符号：`scripts/check-menu-routes.mjs`、`scripts/workflow-governance/affected-checks.ts`、`scripts/check-pms-purchase-chain.ts`（P1 起逐步扩展）。
- 修改：注册 pms 系统与 routes-pms；受影响检查路由规则；新增 PMS 专项检查。
- 验证证据：`npm run check:menu-routes`、`npm run check:affected` 输出包含 PMS 检查。
- 完成条件：门禁对 PMS 生效且不误伤其他系统。

## WP1 采购建议与商品采购（P1）

### WP1.1 工作台

- 业务目标：PMS 首页展示关键统计与风险提醒，可跳转高频页面。
- 需求：PMS-WORK-001/002。
- 文件/符号：`src/pages/pms/workbench.ts`、`src/data/pms/workbench.ts`。
- 修改：统计卡（待采购、待确认、待下推、待请款、异常）、风险提醒列表、快捷入口。
- 验证证据：`tests/pms-workbench.spec.ts`；截图。
- 完成条件：数据与各业务域一致；入口跳转正确；无空壳卡片。

### WP1.2 商品采购建议

- 业务目标：采购员按缺口与折扣得到建议，并生成商品采购单。
- 需求：PMS-SUG-001..005。
- 文件/符号：`src/pages/pms/purchase-suggestions.ts`、`src/data/pms/purchase-suggestions.ts`。
- 修改：SPU/SKU 展开列表、统计、折扣调整、勾选生成采购单抽屉、公式与阻断。
- 验证证据：`tests/unit/pms-purchase-suggestion.test.ts`；`tests/pms-purchase-suggestions.spec.ts`。
- 完成条件：公式与 SRM 一致；生成后进入商品采购单且数据一致；KOL 扣减正确。

### WP1.3 KOL 采购需求

- 业务目标：运营需求可入库、驳回、备注，入库数量正确回写建议。
- 需求：PMS-KOL-001..004。
- 文件/符号：`src/pages/pms/kol-demands.ts`、`src/data/pms/purchase-suggestions.ts`。
- 修改：需求列表、入库抽屉（超量二次确认）、批量入库阻断、驳回、备注、详情。
- 验证证据：`tests/unit/pms-kol-demand.test.ts`；`tests/pms-kol-demands.spec.ts`。
- 完成条件：状态机与数量规则正确；草稿/驳回不计入建议。

### WP1.4 商品采购单

- 业务目标：采购单可新建、编辑、关闭，并生成面辅料需求分析。
- 需求：PMS-PPO-001..006。
- 文件/符号：`src/pages/pms/product-purchase-orders.ts`、`src/data/pms/product-purchase-orders.ts`。
- 修改：列表与筛选、新建/编辑抽屉（SPU+SKU+价格数量）、详情、关闭确认、生成需求阻断与结果。
- 验证证据：`tests/unit/pms-product-purchase-order.test.ts`；`tests/pms-product-purchase-orders.spec.ts`。
- 完成条件：状态流转与阻断正确；面辅料状态回写正确；图片满足硬门禁（缺图对象登记）。

## WP2 面辅料采购与头程（P2）

- WP2.1 面辅料需求分析（`material-requirements.ts`）：下推、阻断、状态回写；需求 PMS-MREQ-001..004。
- WP2.2 面辅料采购单（`material-purchase-orders.ts`）：快递导入模板/解析/校验/回写；需求 PMS-MPO-001..005。
- WP2.3 面辅料采购跟踪（`material-purchase-tracking.ts`）：国内/头程拆分、加入头程校验；需求 PMS-MTRK-001..003。
- WP2.4 供应商确认单（`supplier-confirmations.ts`）：卷号/包装、标签状态、二维码打印预览、确认回写；需求 PMS-CONF-001..005。
- WP2.5 头程物流（`first-leg-shipments.ts`）：批次状态机、装柜/出运/到仓、费用快照；需求 PMS-LOG-001..004。
- WP2.6 头程物流商管理（`first-leg-carriers.ts`）：物流商/渠道、整柜规格价格、启停；需求 PMS-LOG-005..007。

每项完成后执行：专项单测 + Playwright spec + 浏览器验收（含图片大图、二维码预览）+ 批次性能证据。

## WP3 主数据与对账请款（P3a / P3b）

### WP3a 基础资料

- WP3a.1 贸易主体、商品供应商、供应商供货档案（含包装换算公式）：PMS-MD-001..004。
- WP3a.2 面辅料列表、成衣列表、样衣列表：PMS-MD-005..007。
- WP3a.3 仓库管理、单位管理：PMS-MD-008..009。
- WP3a.4 BOM/样板管理 + SPU 详情：PMS-MD-010..012。
- 验证：公式单测、图片验收、列表治理、浏览器验收。

### WP3b 对账与请款

- WP3b.1 主体经营明细（总成本、毛利、毛利率）：PMS-FIN-001。
- WP3b.2 面辅料采购对账（双层费用、差异、生成请款）：PMS-FIN-002..004。
- WP3b.3 面辅料采购请款（状态机、编辑范围、付款登记、新建草稿）：PMS-FIN-005..007。
- WP3b.4 物流费用对账（7 项费用、导入、生成请款）：PMS-FIN-008..010。
- WP3b.5 物流费用请款：PMS-FIN-011。
- 验证：金额公式单测、跨页草稿链路、浏览器验收。

## WP4 库存、中转与系统设置（P4）

- WP4.1 面辅料库存监控：阈值规则、调拨/采购资格、建单抽屉；PMS-INV-001..003。
- WP4.2 中转数据总览 + 收货单列表 + 生产单校验 + 配料任务：PMS-TRN-001..004。
- WP4.3 用户、角色、字典（结果展示页）：PMS-SET-001..003。
- 验证：筛选跳转、状态卡片、列表治理、浏览器验收。

## WP5 跨批次专项

- 图片：按总体设计 7.1 映射，7.2 缺图登记；每页验收缩略图/大图/失败态。
- 性能：`scripts/check-pms-performance.ts` 逐页采集，每交互入口 ≥5 次，严格 `<200ms`；未达标不得关闭批次。
- 兼容：`/pms/purchase-order`、FCS/WLS 联动、打印边界回归。
- 治理：每批一份完整原型审查记录；批次结束运行 CodeGraph 同步与 `workflow:verify` 收据。

## 6. 风险与待确认

| 项 | 处理 |
| --- | --- |
| 缺图对象 | 不标完成；补素材或调整 Mock 后重新验收 |
| 旧菜单删除 | 在 P1 审查记录中登记 |
| 富文本降级 | 登记例外 |
| 系统设置无权限模型 | 结果展示页，矩阵标注能力边界 |
| Excel 导入/二维码/打印为硬点 | 独立工作包，专项浏览器验收 |

## 7. 回滚与兼容

- 本计划全部为新增路由/文件，不改动现有页面行为；如需回退，删除 `src/pages/pms/`、`src/data/pms/`、`routes-pms` 与菜单新增项即可恢复现状。
- 现有 `pms-purchase-orders.ts` 不参与本次变更，保证既有链路零回归。

---

## 8. 第二轮字段级补全实施计划（WP6，批次 A–F）

目标与完成标准：逐项关闭《逐页功能验证清单》第 15 节 G1–G11；每个工作包完成后必须有域命令、页面入口、自动化断言与浏览器验收证据。范围：仅新增字段/交互与既有页面展示，不改路由与既有数据口径；非范围：SRM 演示壳、已登记不复制缺陷。

事实依据：总体设计 §11；缺口登记清单 §15；SRM 源文件逐字段读取结果。

| 工作包 | 业务目标 | 文件/符号 | 修改 | 验证证据 | 完成条件 |
| --- | --- | --- | --- | --- | --- |
| WP6.A | 头程可记录提货、税费与入库字段，支持批量装柜/出运 | `data/pms/first-leg-logistics.ts`、`pages/pms/first-leg-shipments.ts` | 新增字段与校验、批量命令、表单/详情/导出/列表展示 | `check:pms-purchase-chain` 断言、单测、P2 spec | 字段可保存重开、非法值阻断、批量动作只处理合法行 |
| WP6.B | 面辅料对账双层与部分确认、账单 9 列导入；物流对账口径一致 | `data/pms/reconciliations.ts`、`pages/pms/material-reconciliations.ts`、`pages/pms/logistics-reconciliations.ts` | 实际层字段、费用项确认、批量确认、导入升级、筛选与列扩展 | 单测（公式/门禁）、P3b spec、专项检查 | 预计/实际可切换、部分确认状态可见、导入错误行阻断 |
| WP6.C | 请款单字段完整并可记录付款 | `data/pms/payment-requests.ts`、`pages/pms/payment-requests.ts` | 创建/付款/记录字段、附件、校验 | 单测（金额上限）、P3b spec | 全款/部分付款累计到账、超额阻断、附件可见 |
| WP6.D | 库存监控支持加工工序链与生成记录 | `data/pms/inventory-monitor.ts`、`pages/pms/material-inventory.ts` | 工序链、坯布匹配、弹窗字段、生成记录、批量刷新与手动添加 | 单测、P4 spec | 生成单写入记录并可展开、调拨资格受坯布库存约束 |
| WP6.E | 供应商确认支持箱规、卷号参数与标签下载 | `data/pms/supplier-confirmations.ts`、`pages/pms/supplier-confirmations.ts` | 箱规表、卷号弹窗字段、包装明细、PNG 下载、上/下一张 | 单测、P2 spec | 卷号按参数生成、箱规可增删、上下张不越界 |
| WP6.F | 物料申报报关、BOM 选项、主体经营成本字段扩展 | `data/pms/materials.ts`、`pages/pms/material-archives.ts`、`pages/pms/bom-detail.ts`、`pages/pms/subject-operations.ts`、`data/pms/subject-operations.ts` | 字段扩展与校验、8 项选项、成本明细 | 单测、P3a/P3b spec | 字段保存回显、特殊属性持久、成本合计重算 |

依赖顺序：A、B、C 串行（共享结算事实），D/E/F 与 A–C 文件独立可并行。每一步在完成后运行 `npm run build` 与对应专项检查，最后统一跑 5 个 spec、治理脚本与任务收据。

---

## 9. WP6 完成记录（2026-09-18）

WP6.A–WP6.F 已全部实施：域命令、页面入口、单测与浏览器验收证据见 `docs/prototype-review-records/2026-09-18-pms-second-phase-field-completion.md`；原子需求与证据见矩阵第 15 节（25 条全部“已验证”）。本记录是实施回执，不替代矩阵与收据。
