# PMS 采购管理系统迁移（P1：基建 + 采购建议 + KOL + 商品采购单）原型审查记录

## 1. 基本信息

| 项目 | 内容 |
| --- | --- |
| 记录日期 | 2026-09-18 |
| 相关需求 / 任务 | 采购管理系统 PMS 迁移 P1：路由/菜单/事件基建、采购工作台、商品采购建议、KOL 采购需求、商品采购单；需求矩阵 PMS-SCOPE/MENU/ROUTE/EVT/LIST/IMG/PERF/GOV/WORK/SUG/KOL/PPO/DATA 共 40 条 |
| 记录模式 | 完整产品审查 |
| 涉及系统 | PMS |
| 涉及页面路径 | `/pms/workbench/overview`、`/pms/purchase-suggestions`、`/pms/kol-demands`、`/pms/product-purchase-orders`；保留 `/pms/purchase-order` |
| 端类型 | 管理端（1366×768 验收，1280×720 兜底） |
| 主要角色与任务 | 采购员：看建议、生成商品采购单、处理 KOL 入库；采购主管：推进采购单状态、关闭采购单、处理 BOM 阻断 |

## 2. 影响判定

- 用户可见影响：有
- 判定依据：PMS 系统新增 4 个菜单组与 4 个页面路由，默认页从花边采购订单改为采购工作台；原占位菜单“供应商管理（/pms/supplier）”“合同管理（/pms/contract）”删除；新增采购建议缺口与折扣规则、KOL 入库/驳回、商品采购单状态推进与面辅料需求生成等可见交互；Mock 数据中新增 8 个款式建议、6 张 KOL 需求、12 张商品采购单与 BOM 用量；款式图片从占位 SVG 替换为仓库内真实素材。

完整产品审查的当前基线：

- `AGENTS.md` 第 4 节：印尼工厂现场产品设计基线。
- `AGENTS.md` 第 5 节：UI、列表和真实图片专项门禁。
- `AGENTS.md` 第 7 节：分层验证和证据新鲜度。

## 3. 自查结论

| 检查项 | 结论 | 说明 |
| --- | --- | --- |
| 角色、任务与页面模式 | 通过 | 采购员/主管管理端桌面；列表页使用标准列表契约，工作台为 dashboard 模式，首屏主动作明确 |
| 文案、状态、数量与单位 | 通过 | 全部中文业务状态；数量带件/米/个/卷等单位；缺口、建议量、BOM 需求由系统计算并展示公式说明 |
| 扫码、真实图片与对象识别 | 通过 | 8 个款式全部使用 `public/` 真实素材（T恤、休闲裤、连帽卫衣、夹克、衬衫、连衣裙）；缩略图与款式名称/SKU 同列，可点击大图，加载/失败态可见 |
| 防错、危险确认与主管兜底 | 通过 | 缺口 ≤0/非做货/BOM 未匹配/草稿阻断生成；KOL 超量二次确认、批量禁超量；关闭采购单与驳回需必填原因并二次确认 |
| 交接、跨端事实与异常追溯 | 通过 | 建议→采购单→面辅料需求链路数据一致；操作日志记录操作人、时间、前后值与原因；刷新回到演示初始状态并明示 |
| 低分辨率、PDA、弱网与上传恢复 | 通过 | 1366×768/1280×720 验收通过；页面主体无横向溢出，宽表在容器内滚动；本批无 PDA 与上传 |
| 命名路由、交互、图片大图与打印 | 通过 | 4 个命名路由可直达且无占位；大图支持关闭/遮罩/Esc；本批无打印 |

## 4. 问题标签

- 无

## 5. 主要问题与处理

| 问题 | 标签 | 影响角色 | 处理方式 | 是否仍有风险 |
| --- | --- | --- | --- | --- |
| 源 SRM 的“女款半身裙”在仓库内没有对应真实素材 | 视觉干扰 | 采购员 | 为保证真实图片硬门禁，将该演示对象调整为“女款连衣裙 HG-SK-2604”并使用现有真实连衣裙素材；已在总体设计 §7 与矩阵 PMS-IMG-001 登记 | 否 |
| 旧占位菜单供应商管理/合同管理从未实现 | 无 | 采购员 | 迁移时删除菜单与路由，不保留兼容跳转；供应商能力由“商品供应商管理”在 P3a 迁移 | 否 |
| 富文本样板说明与 SRM 角色/主体切换不迁移 | 组件误用 | 采购员 | 属 P3a 范围与壳层能力，本批未实现，矩阵相应需求保持待实施 | 否 |

## 6. 最终结论

结论：通过（P1 批次）

说明：

- P1 负责的 40 条原子需求达到 `已实现待验证`，证据已写入矩阵；待产品确认后转 `已验证`。
- 未在 P1 范围内的 PMS 需求保持 `待实施`，不随本批宣称完成。

## 7. 变更覆盖与验证

### 受管文件

- `src/data/app-shell-config.ts`
- `src/data/pms/bom-templates.ts`
- `src/data/pms/images.ts`
- `src/data/pms/materials.ts`
- `src/data/pms/material-requirements.ts`
- `src/data/pms/product-purchase-orders.ts`
- `src/data/pms/purchase-suggestions.ts`
- `src/data/pms/runtime.ts`
- `src/data/pms/workbench.ts`
- `src/main-handlers/pms-handlers.ts`
- `src/pages/pms/kol-demands.ts`
- `src/pages/pms/product-purchase-orders.ts`
- `src/pages/pms/purchase-suggestions.ts`
- `src/pages/pms/shared.ts`
- `src/pages/pms/workbench.ts`
- `src/router/route-renderers-pms.ts`
- `src/router/route-utils.ts`
- `src/router/routes-pms.ts`
- `src/router/routes.ts`

### 页面路由

- `/pms/workbench/overview`
- `/pms/purchase-suggestions`
- `/pms/kol-demands`
- `/pms/product-purchase-orders`
- 回归：`/pms/purchase-order`（花边辅料采购订单保持由 FCS 处理器认领）

### 验证命令

- `npm run build`：通过（typecheck:engineering + 单元测试 + vite build）
- `npm run check:pms-purchase-chain`：通过
- `npm run check:menu-routes`：通过（pms 已纳入校验，190 条菜单 0 未覆盖、0 重复）
- `npm run check:list-page-governance:static`：通过（411 页，基线 17）
- `npm run check:list-page-governance`：通过（含真实 Chromium 标准列表模板验收与原型治理全量）
- `npm test`：通过（含 `tests/unit/pms-purchase-chain.test.ts` 8 项）
- `npx tsc --noEmit`：失败（存量 61 条错误，全部位于 `src/data/pcs-engineering-master-sampling.ts` 等历史文件；本次新增/修改文件 0 条错误）
- `CUTTING_E2E_USE_PREVIEW=true CUTTING_E2E_PORT=43233 npx playwright test tests/pms-purchase-chain.spec.ts --workers=1`：通过
- `npm run workflow:verify -- --output /private/tmp/pms-p1-task-receipt.json --task-boundary "PMS 迁移 P1：路由/菜单/事件基建、采购工作台、商品采购建议、KOL 采购需求、商品采购单（矩阵 40 条）"`：通过（`state=verified`，`blockers=[]`）

### 性能证据（生产预览，Chromium，1366×768，2026-09-18）

- 首次进入（冷启动）：工作台 123ms、采购建议 102ms、KOL 需求 82ms、商品采购单 88ms，均 < 200ms。
- 站内切换（10 次）：22–34ms，最大 34ms。
- 采购建议交互（查询/列设置/明细，15 次）：19–37ms，最大 37ms。
- KOL 交互（查询/明细，10 次）：17–29ms，最大 29ms。
- 商品采购单交互（明细/新建，10 次）：24–36ms，最大 36ms。
- 任务收据复跑（开发服务，同 spec）：冷启动 4 个页面与全部交互样本均 < 200ms，原始样本见 `/private/tmp/pms-p1-task-receipt.json` 引用的测试输出。
- 原始样本见测试输出 `pmsPerf.coldLoad/routeSwitch/suggestions/kol/ppo`；收据见 `/private/tmp/pms-p1-task-receipt.json`。

### 真实图片验证

- 来源：仓库现有 `public/tshirt-sample.jpg`、`pants-sample.jpg`、`production-confirmation-demo/grey-zip-hoodie.png`、`jacket-sample.jpg`、`shirt-sample.jpg`、`dress-sample-1.jpg`。
- 对象对应：HG-TS-2601/HG-SAM-2601 → T恤；HG-PT-2602/HG-GAR-2601 → 休闲裤；HG-HD-2603 → 连帽卫衣；HG-JK-2605 → 夹克；HG-SH-2607 → 衬衫；HG-SK-2604 → 连衣裙。
- 同列缩略图：款式名称与款号/SPU 同单元格展示。
- 加载失败态与大图弹窗：Playwright 用例验证大图打开与 Esc 关闭；失败态样式与共享渲染函数保留。
- 面辅料图片（P2/P3 使用）：`public/materials/*`，其中吊牌、纸箱、贴纸、防潮珠 4 个包材/耗材暂无对应素材，已在设计 §7.2 与矩阵 PMS-IMG-003 登记为 `已阻塞`，相关页面（P3a）不标完成。

### 例外

- 无
