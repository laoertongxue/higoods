# PMS 采购管理系统迁移（P2：面辅料需求、采购、跟踪、确认、头程物流）原型审查记录

## 1. 基本信息

| 项目 | 内容 |
| --- | --- |
| 记录日期 | 2026-09-18 |
| 相关需求 / 任务 | 采购管理系统 PMS 迁移 P2：面辅料需求分析、面辅料采购单（快递导入）、面辅料采购跟踪、面辅料供应商确认单、头程物流、头程物流商管理；需求矩阵 PMS-MREQ/MPO/MTRK/CONF/LOG 共 24 条 |
| 记录模式 | 完整产品审查 |
| 涉及系统 | PMS |
| 涉及页面路径 | `/pms/material-requirements`、`/pms/material-purchase-orders`、`/pms/material-purchase-tracking`、`/pms/material-supplier-confirmations`、`/pms/first-leg-shipments`、`/pms/first-leg-carriers` |
| 端类型 | 管理端（1366×768 验收，1280×720 兜底） |
| 主要角色与任务 | 采购员：下推面辅料采购单、导入快递、签收与加入头程、维护供应商确认与标签；采购主管：推进头程节点、启停物流商与渠道 |

## 2. 影响判定

- 用户可见影响：有
- 判定依据：PMS 新增 3 个菜单组（面辅料采购、面辅料供应商确认、头程物流）与 6 个页面路由；新增面辅料需求下推、快递信息导入、物流签收、加入头程、头程状态推进、标签二维码预览与供应商确认等可见交互；新增 8 张面辅料采购单、6 条物流记录、3 张供应商确认单、5 家头程物流商、8 条渠道与 3 张头程单的演示数据。

完整产品审查的当前基线：

- `AGENTS.md` 第 4 节：印尼工厂现场产品设计基线。
- `AGENTS.md` 第 5 节：UI、列表和真实图片专项门禁。
- `AGENTS.md` 第 7 节：分层验证和证据新鲜度。

## 3. 自查结论

| 检查项 | 结论 | 说明 |
| --- | --- | --- |
| 角色、任务与页面模式 | 通过 | 六个管理端标准列表页，页面标题与主操作、查询卡片、统计卡片、列表与分页层级完整 |
| 文案、状态、数量与单位 | 通过 | 中文业务状态；数量带件/米/个/卷/公斤/箱；建议采购量、BOM 需求、差异均由系统计算并展示公式 |
| 扫码、真实图片与对象识别 | 通过 | 物料图使用 `public/materials/*` 真实素材，款式图复用款式实拍图；缩略图与物料名称/编码同列，大图与失败态沿用共享渲染 |
| 防错、危险确认与主管兜底 | 通过 | 建议量为 0/缺供应商/重复下推阻断；物流单号重复与未知采购单阻断；未签收不能加入头程、超量加入阻断；供应商确认需标签齐备并二次点击；启停与关闭二次确认 |
| 交接、跨端事实与异常追溯 | 通过 | 需求→采购单→物流→头程→确认链路同源；操作日志记录操作人、时间、前后值；到仓自动签收头程 |
| 低分辨率、PDA、弱网与上传恢复 | 通过 | 1366×768/1280×720 验收通过，宽表容器内滚动；导入解析失败提供明确文案，可重新选择文件；本批无 PDA |
| 命名路由、交互、图片大图与打印 | 通过 | 6 个命名路由可直达；标签二维码使用隔离 React 挂载点；打印预览支持重新打印并可 Esc 关闭 |

## 4. 问题标签

- 无

## 5. 主要问题与处理

| 问题 | 标签 | 影响角色 | 处理方式 | 是否仍有风险 |
| --- | --- | --- | --- | --- |
| 包材/耗材 4 个对象没有对应真实素材 | 视觉干扰 | 采购员 | 已在总体设计 §7.2 与矩阵 PMS-IMG-003 登记为 `已阻塞`；本批演示数据未使用这些物料作为图片主体，P3a 物料档案页不标完成 | 是（待补素材） |
| 头程物流商管理原 SRM 为三栏页面 | 组件误用 | 采购员 | 改为“物流商标准列表 + 渠道管理抽屉 + 渠道表单”结构，复用标准列表契约与既有抽屉组件 | 否 |
| 标签打印为浏览器预览而非真实打印 | 无 | 采购员 | 原型范围内提供二维码预览与打印次数/重打记录，不接真实打印机 | 否 |

## 6. 最终结论

结论：通过（P2 批次）

说明：

- P2 负责的 24 条原子需求达到 `已实现待验证`，证据已写入矩阵；待产品确认后转 `已验证`。
- P1 的 40 条需求保持 `已实现待验证`；P3–P4 需求保持 `待实施`。

## 7. 变更覆盖与验证

### 受管文件

- `src/data/app-shell-config.ts`
- `src/data/pms/material-purchase-orders.ts`
- `src/data/pms/material-requirements.ts`
- `src/data/pms/first-leg-logistics.ts`
- `src/data/pms/supplier-confirmations.ts`
- `src/main-handlers/pms-handlers.ts`
- `src/pages/pms/material-requirements.ts`
- `src/pages/pms/material-purchase-orders.ts`
- `src/pages/pms/material-purchase-tracking.ts`
- `src/pages/pms/supplier-confirmations.ts`
- `src/pages/pms/first-leg-shipments.ts`
- `src/pages/pms/first-leg-carriers.ts`
- `src/pages/pms/shared.ts`（图片/反馈共享工具）
- `src/router/route-renderers-pms.ts`
- `src/router/routes-pms.ts`

### 页面路由

- `/pms/material-requirements`
- `/pms/material-purchase-orders`
- `/pms/material-purchase-tracking`
- `/pms/material-supplier-confirmations`
- `/pms/first-leg-shipments`
- `/pms/first-leg-carriers`

### 验证命令

- `npm run build`：通过
- `npm run check:pms-purchase-chain`：通过
- `npm run check:menu-routes`：通过（PMS 菜单 11 条全部精确路由覆盖）
- `npm run check:list-page-governance`：通过
- `npm run check:prototype-design-governance -- --all`：通过
- `npm test`：通过（含 `tests/unit/pms-material-flow.test.ts` 5 项）
- `CUTTING_E2E_USE_PREVIEW=true CUTTING_E2E_PORT=43243 npx playwright test tests/pms-purchase-chain.spec.ts tests/pms-material-flow.spec.ts --workers=1`：通过（13 项）
- `npm run workflow:verify -- --output /private/tmp/pms-p2-task-receipt.json --task-boundary "PMS 迁移 P2：面辅料需求、采购、跟踪、供应商确认、头程物流（矩阵 24 条）"`：通过（收据见 `/private/tmp/pms-p2-task-receipt.json`）

### 性能证据（生产预览，Chromium，1366×768，2026-09-18）

- P2 六个页面站内切换（30 次）：20–57ms，最大 57ms，均 < 200ms。
- 需求分析交互（查询/下推，10 次）：22–30ms。
- 面辅料采购单交互（导入/详情，10 次）：22–36ms。
- 采购跟踪交互（查询/大图，10 次）：26–30ms。
- 供应商确认交互（包装与标签抽屉，5 次）：29–40ms。
- 头程物流交互（详情/新建，10 次）：29–40ms。
- 物流商交互（渠道抽屉/新增表单，10 次）：30–42ms。
- 原始样本见测试输出 `pmsMaterialPerf.*`；P1 回归见 `pmsPerf.*`（冷启动 68–79ms）。

### 真实图片验证

- 来源：`public/materials/` 的布料、纱线、拉链、纽扣、织唛、缝纫线、胶袋真实素材与款式实拍图。
- 对象对应：面辅料采购单/需求行/物流行/确认单的物料图片与物料编码一一对应，款式图与款式名称同信息块。
- 同列缩略图：物料图片与名称/编码在同一单元格组合展示。
- 加载失败态与大图弹窗：共享渲染函数提供加载中、失败重试与 Esc 关闭。
- 缺图登记：牛皮纸吊牌、五层出口纸箱、印花包装贴纸、防潮珠 4 个对象仍为 `已阻塞`（P3a 处理）。

### 例外

- 无
