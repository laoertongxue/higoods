# TMF 加工单列表要求字段精简审查

## 1. 基本信息

| 项目 | 内容 |
| --- | --- |
| 记录日期 | 2026-09-24 |
| 相关需求 / 任务 | 删除截图红框中的半成品加工单、织带加工单列表字段 |
| 记录模式 | 完整产品审查 |
| 涉及系统 | FCS / TMF |
| 涉及页面路径 | `/fcs/craft/accessory/webbing/semi-finished-orders`、`/fcs/craft/accessory/webbing/work-orders` |
| 端类型 | 管理端 / 主管端 |
| 主要角色与任务 | TMF 主管快速核对加工单的核心工艺规格、进度和数量 |

## 2. 影响判定

- 用户可见影响：有
- 判定依据：两张列表的“加工要求”列减少重复或对列表执行决策无帮助的内容，保留表头、加工过程关键规格和结果要求。
- 本次仅精简列表呈现，不删除业务数据、技术包字段、加工表单校验、配方核验、采购要求或详情追溯信息。
- 基线：`AGENTS.md` 第 4、5、7 节。

## 3. 自查结论

| 检查项 | 结论 | 说明 |
| --- | --- | --- |
| 角色、任务与页面模式 | 通过 | 两页仍使用原有七列加工单列表，核心要求字段更精简。 |
| 文案、状态、数量与单位 | 通过 | 没有修改状态、数量、单位或操作动作。 |
| 扫码、真实图片与对象识别 | 不适用 | 没有修改图片、扫码和对象标识。 |
| 防错与操作规则 | 通过 | 配方、生产标准和尺码仍保留在数据模型及执行校验中；仅从列表要求摘要移除。 |
| 跨页面事实与异常追溯 | 通过 | 没有修改 PMS、技术包、库存或交接事实。 |
| 低分辨率与 PDA | 不适用 | PDA 页面未修改。 |
| 路由、交互与性能 | 通过 | 两个命名页面专项验证通过；195 个性能原始样本均低于 500ms。 |

## 4. 字段调整

| 页面 | 移除 | 保留 |
| --- | --- | --- |
| 半成品加工单 | 生产标准、原料配方、配方说明、目标仓 | 类型、品质要求 |
| 织带加工单 | 用途／尺码、切割方式 | 截断／成品长度、公差、端头类型 |

尺码和用途仍属于技术包规格及对应生产单明细；原料配方和生产标准仍用于加工、物料实收与数量核验。本次只从列表的加工要求单元格移除这些展示项。

## 5. 验证

### 验证命令

- `PLAYWRIGHT_REUSE_EXISTING_SERVER=false CUTTING_E2E_PORT=4182 npx playwright test tests/tmf-webbing-connected-lists.spec.ts tests/tmf-webbing-connected-performance.spec.ts --workers=1 --reporter=line`：通过，9/9 浏览器用例通过。
- `git diff --cached --check`：通过。
- `npm run check:prototype-design-governance`：通过。

### 证据

- `docs/product-design/tmf-webbing/evidence/2026-09-23-connected-lists-performance.json`：195 个样本均 `<500ms`，最大 257.48ms；包含五个列表加载、刷新、站内切换和适用交互的各五次样本。

## 6. 最终结论

结论：通过。

页面只隐藏红框所指的列表摘要字段；操作所依赖的业务数据与技术包规格继续保留，数量与状态规则未改。

## 7. 变更覆盖与验证

### 受管文件

- `src/pages/process-factory/accessory/webbing/semi-finished-orders.ts`
- `src/pages/process-factory/accessory/webbing/work-orders.ts`
- `tests/tmf-webbing-connected-lists.spec.ts`
- `docs/product-design/tmf-webbing/evidence/2026-09-23-connected-lists-performance.json`
- `docs/prototype-review-records/2026-09-24-tmf-order-requirement-fields.md`

### 例外

- 无。
