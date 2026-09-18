# PMS 迁移第二轮字段级补全（批次 A–F）原型审查记录

## 1. 基本信息

| 项目 | 内容 |
| --- | --- |
| 记录日期 | 2026-09-18 |
| 相关需求 / 任务 | 第二轮逐文件复查后的字段级补全，批次 A–F，覆盖 PMS-FLG-004..008、PMS-REC-004..007、PMS-PAY-008..010、PMS-INV-004..006、PMS-SUP-005..007、PMS-MD-006..007、PMS-BOM-006..007、PMS-SUB-002；缺口登记见 `docs/product-design/采购管理系统PMS迁移逐页功能验证清单.md` 第 15 节与总体设计 §11 |
| 记录模式 | 完整产品审查 |
| 涉及系统 | PMS |
| 涉及页面路径 | `/pms/first-leg-shipments`、`/pms/material-reconciliations`、`/pms/logistics-reconciliations`、`/pms/material-payment-requests`、`/pms/logistics-payment-requests`、`/pms/material-inventory`、`/pms/material-supplier-confirmations`、`/pms/material-archives`、`/pms/bom-templates/:spu`、`/pms/subject-operations` |
| 端类型 | 管理端（1366×768 验收，1280×720 兜底） |
| 主要角色与任务 | 采购员：头程提货与批量装柜出运、物料申报报关补充、BOM 业务选项与成本维护、供应商确认箱规与卷号；财务：对账双层费用与分项/批量确认、账单 9 列导入、请款单字段与付款记录、主体经营成本明细；采购主管：库存监控加工工序链与生成记录 |

## 2. 影响判定

- 用户可见影响：有
- 判定依据：本次新增/调整了头程提货与税费字段、批量装柜/出运、面辅料对账实际层与费用项部分确认、账单 9 列导入、物流对账筛选与运单/货件列、请款收款人与付款信息字段、请款/付款记录、库存加工工序链与生成记录、供应商确认箱规/包装明细/卷号参数/标签下载/上下张、物料申报报关字段、BOM 业务选项与成本字段、主体经营 9 项成本明细；同时展示与导出列随之变化。

完整产品审查的当前基线：

- `AGENTS.md` 第 4 节：印尼工厂现场产品设计基线。
- `AGENTS.md` 第 5 节：UI、列表和真实图片专项门禁。
- `AGENTS.md` 第 7 节：分层验证和证据新鲜度。

## 3. 自查结论

| 检查项 | 结论 | 说明 |
| --- | --- | --- |
| 角色、任务与页面模式 | 通过 | 全部落在既有标准列表、详情抽屉与弹窗模式内，无新页面结构 |
| 文案、状态、数量与单位 | 通过 | 全部中文业务文案；金额带币种，差异、合计与建议量由系统重算 |
| 扫码、真实图片与对象识别 | 通过 | 本次不新增款式/物料对象；物料与确认单继续使用既有真实素材与大图预览 |
| 防错、危险确认与主管兜底 | 通过 | 费用非负校验、差异与费用项双门禁、付款超额阻断、确认单锁定、非法卷号参数阻断 |
| 交接、跨端事实与异常追溯 | 通过 | 全部命令写操作日志；请款/付款记录、生成记录、费用确认与批量动作可追溯 |
| 低分辨率、PDA、弱网与上传恢复 | 通过 | 1366×768 验收；宽表在容器内滚动；无 PDA 变更 |
| 命名路由、交互、图片大图与打印 | 通过 | 路由与既有入口不变；确认单卷号、箱规随打印内容展示；详情上下张不越界 |

## 4. 问题标签

- `算不准`（已处理：实际层与费用项确认、差异口径、成本明细重算）
- `点错风险`（已处理：批量动作只处理合法状态行、付款超额与确认单锁定阻断）

## 5. 主要问题与处理

| 问题 | 标签 | 影响角色 | 处理方式 | 是否仍有风险 |
| --- | --- | --- | --- | --- |
| 头程缺少提货、税费与入库字段，且无批量装柜/出运 | 无 | 采购员 | 批次 A：新增 10 个字段与 7 项费用明细，新增批量装柜/确认出运并返回跳过明细 | 否 |
| 面辅料对账缺少实际层、费用项部分确认与 9 列账单导入 | 算不准 | 财务 | 批次 B：实际单价/货款/物流费、费用项确认与批量确认、对账三态、9 列导入错误行阻断 | 否 |
| 物流对账缺少部分确认状态、筛选与运单/货件信息 | 算不准 | 财务 | 批次 B：部分确认状态、物流商/运输方式筛选、运单货件签收列、12 列模板与校验 | 否 |
| 请款单缺少收款人、付款信息、金额信息与记录 | 无 | 财务 | 批次 C：创建与详情字段、申请付款与付款登记字段、请款/付款记录与附件删除 | 否 |
| 库存监控缺少加工工序链、坯布匹配与生成记录 | 点错风险 | 采购主管 | 批次 D：工序链、坯布库存资格、采购/调拨弹窗字段、同步加工单与生成记录、批量刷新与手动添加 | 否 |
| 供应商确认缺少卷号参数、箱规与包装明细、标签下载 | 无 | 采购员 | 批次 E：卷号前缀/每卷米数/重量/起始序号、箱规体积、包装明细、PNG 下载、上下张 | 否 |
| 物料申报报关、BOM 选项与成本、主体经营成本字段不足 | 算不准 | 采购员/财务 | 批次 F：申报报关扩展与 26 项特殊属性、BOM 8 项选项与成本字段、主体经营 9 项成本明细 | 否 |

## 6. 最终结论

结论：通过（第二轮字段级补全批次 A–F）

说明：

- G1–G11 全部实施并补充自动化断言与浏览器验收；矩阵第 15 节 25 条原子需求更新为“已验证”。
- 未复制 SRM 已确认缺陷（编辑清空费用、编辑即新增、批量打印只预览首行、查询按钮无行为等）。

## 7. 变更覆盖与验证

### 受管文件

- 第三轮新增：`src/data/pms/suppliers.ts`、`src/data/pms/warehouses.ts`、`src/data/pms/units.ts`、`src/data/pms/material-requirements.ts`、`src/data/pms/transit-warehouse.ts`、`src/data/pms/product-purchase-orders.ts`
- 第三轮新增（页面）：`src/pages/pms/suppliers.ts`、`src/pages/pms/warehouses.ts`、`src/pages/pms/units.ts`、`src/pages/pms/material-requirements.ts`、`src/pages/pms/transit-receipts.ts`、`src/pages/pms/transit-simple-lists.ts`、`src/pages/pms/product-purchase-orders.ts`、`src/pages/pms/purchase-suggestions.ts`、`src/pages/pms/settings.ts`、`src/pages/pms/result-list.ts`
- `src/data/pms/first-leg-logistics.ts`、`src/data/pms/reconciliations.ts`、`src/data/pms/payment-requests.ts`
- `src/data/pms/inventory-monitor.ts`、`src/data/pms/supplier-confirmations.ts`
- `src/data/pms/materials.ts`、`src/data/pms/bom-detail.ts`、`src/data/pms/subject-operations.ts`
- `src/pages/pms/first-leg-shipments.ts`、`src/pages/pms/material-reconciliations.ts`、`src/pages/pms/logistics-reconciliations.ts`
- `src/pages/pms/payment-requests.ts`、`src/pages/pms/material-inventory.ts`、`src/pages/pms/supplier-confirmations.ts`
- `src/pages/pms/material-archives.ts`、`src/pages/pms/bom-detail.ts`、`src/pages/pms/subject-operations.ts`

### 页面路由

- `/pms/first-leg-shipments`、`/pms/material-reconciliations`、`/pms/logistics-reconciliations`
- `/pms/material-payment-requests`、`/pms/logistics-payment-requests`
- `/pms/material-inventory`、`/pms/material-supplier-confirmations`
- `/pms/material-archives`、`/pms/bom-templates/:spu`、`/pms/subject-operations`

### 验证命令

- `npm run build`：通过
- `npm run check:pms-purchase-chain`：通过（新增批次 A–F 域命令、校验、批量动作与导入断言）
- `npx tsx --test tests/unit/pms-*.test.ts`：通过（49 项，含费用项确认、9/12 列导入、加工链、箱规、扩展字段与金额大写）
- `CUTTING_E2E_USE_PREVIEW=true npx playwright test tests/pms-*.spec.ts --workers=1`：通过（42 项，含新增头程批量、对账批量确认、筛选、请款字段、加工单记录、箱规卷号、申报与 BOM 用例）
- `npm run check:menu-routes`、`npm run check:list-page-governance`、`npm run check:prototype-design-governance -- --all`：通过
- `npm run workflow:verify -- --output /private/tmp/pms-second-phase-task-receipt.json --task-boundary "PMS 第二轮字段级补全批次 A-F（G1-G11）"`：通过（收据见 `/private/tmp/pms-second-phase-task-receipt.json`）

### 性能证据（生产预览，Chromium，1366×768，2026-09-18 最终一次）

- 最终 42 项验收内嵌 `<200ms` 断言全部通过；原始样本：`pmsSettlementPerf` 站内切换 21–39ms、主体经营 16–34ms、面辅料对账 26–34ms、物流对账 28–38ms、请款 26–35ms；`pmsMaterialPerf`、`pmsPeripheralPerf` 等同类断言均通过。
- 原始样本见测试输出 `pmsSettlementPerf.*`、`pmsMaterialPerf.*`、`pmsPeripheralPerf.*`。

### 真实图片验证

- 本次不新增款式/物料对象；物料档案、供应商确认单、头程与对账中的图片继续使用已登记真实素材，缩略图与大图预览能力未变。

### 例外

- 无

## 8. 对抗式审查修复记录（两轮，2026-09-18）

### 8.1 第一轮（业务与数据正确性）

| 编号 | 发现 | 处理 | 证据 |
| --- | --- | --- | --- |
| R1-01 | 头程导出“费用明细合计”混算 RMB/USD/IDR | 改为分币种小计 `pmsFirstLegFeeSubtotal`，导出与详情统一口径 | 单测与 `check:pms-purchase-chain`；页面详情分币种小计 |
| R1-02 | 物流对账未导入实际费用时仍显示“预计/实际差异 0.00” | 列表与详情在未导入时显示“未导入” | P3b spec 断言、专项检查 |
| R1-03 | 金额大写跨节缺“零”，且非 RMB 币种按“元”展示 | 重写分节算法（含跨节零处理），仅 RMB 展示大写 | 单测 4 例（24474、1000001、100.05、0） |
| R1-04 | 请款详情编辑缺少“款项性质” | 编辑态新增款项性质下拉并随保存写入 | 保存命令断言与页面回显 |
| R1-05 | 物流导入“货件号”被静默丢弃 | 批次行新增 `shipmentNo`，导入落库并在详情展示最近导入信息 | 单测与专项检查断言 |
| R1-06 | 文档“BOM 选项 7 组”与实际 8 项不符；矩阵/计划引用错误文件名 | 统一改为 8 项，修正 `subject-operations.ts` 文件路径 | 设计 §11.6、矩阵、清单、计划、记录 |
| R1-07 | 删除被包装明细引用的箱规产生悬空引用 | 被引用时阻断删除并提示引用条数 | 单测（引用阻断、未引用可删） |
| R1-08 | 旧 8 列物流导入模板兼容、申请付款全款/部分快捷键 | 接受不改：无历史模板用户；金额输入即可表达部分请款，记录说明 |

### 8.2 第二轮（交互、边界与证据）

| 编号 | 发现 | 处理 | 证据 |
| --- | --- | --- | --- |
| R2-01 | 头程“重置”与路由重入不清空勾选，批量动作可作用于不可见行 | 重置与页面入口清空选择并同步按钮禁用态 | P2 spec 新增“重置后批量按钮禁用”断言 |
| R2-02 | 供应商确认“卷数（自动）”不随每卷米数联动 | 输入每卷米数时局部重算卷数预览（不整页重绘） | P2 spec 断言卷数预览值为 4 |
| R2-03 | `emptyPmsFirstLegFees` 导出未使用 | 取消导出，保留内部使用 | 类型检查与引用扫描 |
| R2-04 | 工序链无显式上/下移 | 确认非缺陷：勾选顺序即工序顺序、预览联动、域命令保序 | 单测保序断言与页面预览 |
| R2-05 | 旧列偏好可能隐藏新列（提货/运单） | 接受：新列默认展示，列设置可恢复默认 | 列设置能力未变 |
| R2-06 | 请款记录时间混用 date-only 与 ISO | 接受：展示层统一格式化，原型不建持久化 | 展示格式化既有实现 |
| R2-07 | 收据链路默认用开发服务器执行 PMS 验收，与记录中的生产预览口径不一致，冷启动贴近 200ms 阈值抖动 | 统一收据链路为 `CUTTING_E2E_USE_PREVIEW=true`（构建产物验收，口径与 7.2 节及既有记录一致） | `test:workflow-governance` 94 项通过；收据复跑通过 |

### 8.3 回归

- 单测 49 项、浏览器验收 42 项、专项检查与治理脚本全部通过；收据 `/private/tmp/pms-second-phase-task-receipt.json`。

## 9. 第三轮独立复核与两轮对抗式审查（2026-09-18 晚）

### 9.1 独立复核（只读子代理 + 主代理逐条核验）

- 复核范围：SRM 全文 ↔ 迁移实现，按“菜单可达页—字段—枚举—状态—公式”逐层比对；子代理产出 40 行差异表，主代理对每条“新缺口”回读两侧源码核验后定级。
- 结论：不存在整页未迁移；真实残留 14 项（M1–M7、P3-1..7），已全部修复；SRM 缺陷与有意排除项不重复计入。

### 9.2 对抗式审查第 1 轮（实现正确性与契约）

| 编号 | 发现 | 处理 |
| --- | --- | --- |
| R1-01 | 专项检查对批次聚合只断言“是数字”，证据强度不足 | 改为断言种子精确值（260kg / 1.8m³ / 箱数 5） |
| R1-02 | 供应商列表数量断言过于宽松（≥11） | 改为精确 14（13 种子 + 1 脚本新增） |
| R1-03 | 既有单测/专项检查/浏览器验收仍引用旧供应商枚举与必填字段 | 同步更新三处调用点（category、shortName、country/city/交货方式） |
| R1-04 | 文档仍声称“BOM 7 组”“枚举直接读取 SRM”且与 §15.5 矛盾 | 统一为 8 项/精确取值，修正 §13.1-10 与矩阵文件名路径 |

### 9.3 对抗式审查第 2 轮（证据强度与跨模块一致性）

| 编号 | 发现 | 处理 |
| --- | --- | --- |
| R2-01 | 新增字段与枚举缺浏览器级证据，仅域命令与单测 | 新增/扩展 4 个 spec：商品采购单详情、仓库详情、供应商新字段、渠道/单位/需求历史列、中转状态断言（e2e 增至 44 项） |
| R2-02 | 物料币种/区域域命令缺白名单校验，非法值可写入 | 新增 `MATERIAL_CURRENCY_INVALID`、`MATERIAL_REGION_INVALID` 校验与专项检查断言 |
| R2-03 | 仓库六类枚举已对齐但种子只覆盖 4 类 | 补 加工仓、退货仓种子并断言 6 类全覆盖 |
| R2-04 | 旧枚举残留扫描 | 全量 `rg` 扫描未发现 PMS 旧值残留（仅保留负向断言与其它系统同名词） |
| R2-05 | 新建头程批次重量/体积为空 | 接受并记录（设计 §13.3，种子批次完整展示） |

### 9.4 回归与证据

- 单测 68 项、浏览器验收 44 项（生产预览）、专项检查（含第 16 节 17 条对齐断言）、菜单/列表/原型治理与 workflow 治理单测全部通过。
- 收据 `/private/tmp/pms-second-phase-task-receipt.json`（`state=verified`，无阻塞）；CodeGraph 已同步。
- 矩阵第 16 节 17 条原子需求全部“已验证”，§17 完成双向覆盖检查。

## 10. AGENTS.md 合规审查与对抗式复审（2026-09-18 夜）

### 10.1 不符合项清单（按根目录 AGENTS.md）

| 编号 | 条款 | 不符合项 | 修复 |
| --- | --- | --- | --- |
| C1 | §5.2 标准列表契约 | settings/transit-simple-lists/result-list 未声明 `@page-pattern: list` | 共享骨架 `result-list.ts` 声明并接入门禁；两个页面文件通过工厂满足契约（见 10.3 复审说明） |
| C2 | §5.1 局部更新 | kol-demands、material-purchase-orders、material-purchase-tracking、material/logistics-reconciliations、purchase-suggestions 行勾选触发整页重绘 | 全部改为 `controller.refresh({overlays:false})` + 局部同步批量按钮/计数；全量扫描残留为 0 |
| C3 | §4.2 危险操作二次确认 | 对账确认/批量确认、请款附件删除、确认单箱规/包装明细删除单击执行 | 全部改为“首次点击进入待确认态、再次点击执行”，选择变化/关闭/其它操作复位 |
| C4 | §5.3 图片硬门禁 | 面辅料/物流对账、中转收货、头程记录、库存候选、KOL 明细、采购跟踪、BOM 物料组成、请款来源行缺图 | 全部补齐 `renderPmsBusinessImage`（名称同单元格、可点击、alt/失败态），并补齐 material-archives、bom-detail、供货档案的预览接线（按钮/遮罩/Esc） |
| C5 | §3.1.5 完成门禁 | 矩阵 103 条仍为“已实现待验证” | 全部转“已验证”，表头同步 |
| C6 | §7.2 性能门禁 | 冷启动仅覆盖 P1；P2–P4 缺证据 | 新增全 34 路由×5 次冷启动用例（页内计时、独立浏览器进程）；原始样本最大 189ms |
| C7 | §4.6/§3.1.6 | 第三轮受管文件未登记 | 本节 10.1 与 §7 受管文件已补全 |

### 10.2 对抗式复审（合规修复后）

| 编号 | 复审发现 | 处理 |
| --- | --- | --- |
| A-01 | 页面文件直接声明契约导致 `check:list-page-governance` 失败（页面本身不直接引用三件套符号） | 声明收敛到共享骨架 `result-list.ts`，门禁复跑通过；两页通过工厂满足契约并记录在案 |
| A-02 | 首轮行选择扫描漏掉 `purchase-suggestions`（输出截断） | 补齐局部刷新并全量复扫，残留 0 |
| A-03 | 只对单项确认做了二次确认，批量确认仍单击 | 批量确认纳入 armed 流程并在选择变化时复位；spec 改为两击并断言提示 |
| A-04 | 冷启动测量混入编排与上下文抖动（出现 201–595ms 假超限） | 改为页内 `performance.now` 计时 + 独立浏览器 + 样本间 settle；复测全部 <200ms（最大 189ms） |
| A-05 | 请款图片/附件用例在付清后执行，此时编辑范围只读、无附件入口 | 调整用例时序到“未请款”阶段；删除断言收窄到附件列表（操作日志保留文件名属正常事实） |
| A-06 | material-archives / bom-detail / 供货档案有缩略图但无大图预览 | 补 `renderPmsImagePreview` 挂载与 common image 接线 |

### 10.3 接受项与边界

- 操作日志、二维码文本、导入预览中的名称不做缩略图：属审计轨迹/打印内容/行数据预览，不是对象识别展示位；对象展示位已全部配图。
- C1 采用“共享骨架声明”的治理形态：`result-list.ts` 是这些列表的实际标准骨架消费者，页面为薄包装；如后续要求页面级声明，可在不改行为前提下迁移。
- 冷启动用例运行时约 1 分钟，设置 240s 测试超时；收据链路已统一生产预览模式。
