# PMS 采购管理系统迁移（P3b：对账与请款）原型审查记录

## 1. 基本信息

| 项目 | 内容 |
| --- | --- |
| 记录日期 | 2026-09-18 |
| 相关需求 / 任务 | 采购管理系统 PMS 迁移 P3b：主体经营明细、面辅料采购对账、面辅料采购请款、物流费用对账、物流费用请款；需求矩阵 PMS-FIN-001..013 共 13 条 |
| 记录模式 | 完整产品审查 |
| 涉及系统 | PMS |
| 涉及页面路径 | `/pms/subject-operations`、`/pms/material-reconciliations`、`/pms/material-payment-requests`、`/pms/logistics-reconciliations`、`/pms/logistics-payment-requests` |
| 端类型 | 管理端（1366×768 验收，1280×720 兜底） |
| 主要角色与任务 | 财务：核对主体经营、确认对账差异、生成并确认请款、登记付款；采购主管：处理差异与作废 |

## 2. 影响判定

- 用户可见影响：有
- 判定依据：PMS 新增“采购对账”菜单组 5 个菜单项与 5 个页面路由；新增对账费用调整、差异确认、确认对账、导入实际物流费用、生成请款草稿（跨页打开创建抽屉）、提交请款、付款登记、作废并释放对账等可见交互；新增 6 条主体经营明细、8 条面辅料对账、3 条物流对账与 7 张请款单演示数据。

完整产品审查的当前基线：

- `AGENTS.md` 第 4 节：印尼工厂现场产品设计基线。
- `AGENTS.md` 第 5 节：UI、列表和真实图片专项门禁。
- `AGENTS.md` 第 7 节：分层验证和证据新鲜度。

## 3. 自查结论

| 检查项 | 结论 | 说明 |
| --- | --- | --- |
| 角色、任务与页面模式 | 通过 | 5 个管理端标准列表页；对账处理与请款详情使用抽屉，金额与状态突出 |
| 文案、状态、数量与单位 | 通过 | 中文业务状态；金额带币种（RMB/USD）；总成本、最终应付、差异、毛利率均由系统计算并展示公式 |
| 扫码、真实图片与对象识别 | 通过 | 本批为财务单据页面，不展示款式/物料图片，无图片硬门禁适用项；金额与来源对账编号可追溯 |
| 防错、危险确认与主管兜底 | 通过 | 差异未确认不能确认对账；只有已确认且未生成请款的记录可生成请款；请款/付款金额上限阻断；作废需原因且已有付款不能作废；确认与作废二次确认 |
| 交接、跨端事实与异常追溯 | 通过 | 对账→请款→付款链路同源；请款单记录来源对账、附件、操作日志与作废原因；作废后释放来源对账可重新生成 |
| 低分辨率、PDA、弱网与上传恢复 | 通过 | 1366×768/1280×720 验收通过；费用导入失败给出明确错误并可重新选择；本批无 PDA |
| 命名路由、交互、图片大图与打印 | 通过 | 5 个命名路由可直达；跨页草稿跳转进入请款页创建抽屉；本批无打印 |

## 4. 问题标签

- 无

## 5. 主要问题与处理

| 问题 | 标签 | 影响角色 | 处理方式 | 是否仍有风险 |
| --- | --- | --- | --- | --- |
| 已确认物流对账仍可导入实际费用 | 点错风险 | 财务 | 导入校验增加“已确认对账不能再导入”的阻断，专项断言覆盖 | 否 |
| 站内跳转时请款草稿被二次渲染清空 | 点错风险 | 财务 | 请款页只在消费到有效草稿时覆盖草稿状态，保证跳转后创建抽屉稳定出现；端到端用例覆盖对账→请款跳转 | 否 |
| 原 SRM 三层对账容器（应付明细池/对账单/付款记录）无入口 | 无 | 财务 | 按确认的迁移范围不迁移死视图，能力由面辅料/物流对账与请款页承载 | 否 |

## 6. 最终结论

结论：通过（P3b 批次）

说明：

- P3b 负责的 13 条原子需求达到 `已实现待验证`，证据已写入矩阵；待产品确认后转 `已验证`。
- P1/P2/P3a 需求保持 `已实现待验证`；P4 需求保持 `待实施`。

## 7. 变更覆盖与验证

### 受管文件

- `src/data/app-shell-config.ts`
- `src/data/pms/subject-operations.ts`
- `src/data/pms/reconciliations.ts`
- `src/data/pms/payment-requests.ts`
- `src/main-handlers/pms-handlers.ts`
- `src/pages/pms/subject-operations.ts`
- `src/pages/pms/material-reconciliations.ts`
- `src/pages/pms/logistics-reconciliations.ts`
- `src/pages/pms/payment-requests.ts`
- `src/router/route-renderers-pms.ts`
- `src/router/routes-pms.ts`

### 页面路由

- `/pms/subject-operations`
- `/pms/material-reconciliations`
- `/pms/material-payment-requests`
- `/pms/logistics-reconciliations`
- `/pms/logistics-payment-requests`

### 验证命令

- `npm run build`：通过
- `npm run check:pms-purchase-chain`：通过
- `npm run check:menu-routes`：通过（PMS 菜单 25 条全部精确路由覆盖）
- `npm run check:list-page-governance`：通过
- `npm run check:prototype-design-governance -- --all`：通过
- `npm test`：通过（含 `tests/unit/pms-settlement-flow.test.ts` 5 项）
- `CUTTING_E2E_USE_PREVIEW=true CUTTING_E2E_PORT=43263 npx playwright test tests/pms-purchase-chain.spec.ts tests/pms-material-flow.spec.ts tests/pms-master-data.spec.ts tests/pms-settlement-flow.spec.ts --workers=1`：通过（26 项）
- `npm run workflow:verify -- --output /private/tmp/pms-p3b-task-receipt.json --task-boundary "PMS 迁移 P3b：对账与请款（矩阵 13 条，含 P1/P2/P3a 回归）"`：通过（收据见 `/private/tmp/pms-p3b-task-receipt.json`）

### 性能证据（生产预览，Chromium，1366×768，2026-09-18）

- P3b 五个页面站内切换（25 次）：22–50ms，最大 50ms，均 < 200ms。
- 主体经营交互（明细/调整，10 次）：19–38ms。
- 面辅料对账交互（对账处理抽屉，5 次）：28–38ms。
- 物流对账交互（对账处理/导入抽屉，10 次）：28–39ms。
- 请款单交互（详情，5 次）：28–38ms。
- 原始样本见测试输出 `pmsSettlementPerf.*`；P1 冷启动 72–84ms、P2/P3a 交互最大 42ms 回归通过。

### 真实图片验证

- 本批页面为财务单据场景，不展示款式或物料对象；无图片硬门禁适用项。金额、来源对账编号与单据状态均可在页面追溯。

### 例外

- 无
