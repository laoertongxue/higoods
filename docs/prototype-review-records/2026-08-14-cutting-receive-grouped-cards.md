# 裁床接收管理紧凑生产单卡片与 Web 接收原型审查记录

## 1. 基本信息

| 项目 | 内容 |
| --- | --- |
| 记录日期 | 2026-08-15 |
| 相关需求 / 任务 | 裁床接收管理三个页面使用紧凑生产单分组卡片，并允许 Web 完成整节点接收 |
| 记录模式 | 完整产品审查 |
| 涉及系统 | 工艺工厂运营系统 / 裁床管理 |
| 涉及页面路径 | `/fcs/craft/cutting/pickup-management/ready`、`/fcs/craft/cutting/pickup-management/incomplete`、`/fcs/craft/cutting/pickup-management/history` |
| 端类型 | 管理端 / 主管端 Web；关联裁床 PDA |
| 主要角色与任务 | 裁床主管、接收人员按生产单核对款式、物料、位置和数量；在 Web 或 PDA 选择裁床待加工仓库位并完成整节点接收 |
| 实施基线 | `94f287136e4cbfc045230216fea27c7ba648e9fc` |

## 2. 影响判定

- 用户可见影响：有
- 判定依据：三个接收管理页面的结果区结构、物料字段、图片大图、Web 接收动作、仓库库位选择、差异防错和 Web / PDA 共用接收行为发生变化；上方筛选区、统计卡、菜单、路由及既有数量口径保持不变。
- 下方结果区：由扁平宽表改为“一张生产单卡片 + 款式摘要 + 需求分段 + 物料明细”；三个页面共用同一骨架。
- 接收操作：可接收节点的主操作改为 Web“接收”；PDA 入口与能力保留，Web / PDA 共用同一接收协调规则。
- 图片交互：款式和物料缩略图可打开大图，并提供加载、失败和关闭反馈。
- 明确保留：上方筛选区、统计卡、菜单、路由、节点生成、数量口径、补料与正常需求关系、接收记录、仓库流水、差异处理、PDA 和打印逻辑。
- 明确删除：物料明细中的“加工状态”“加工可供”“已到仓”“超配异常”；“当前位置 / 载体”收窄为“位置 / 载体”。
- 非目标：不实现真实后端、鉴权、数据库或离线队列；不允许部分勾选或修改本轮接收量。

当前审查基线：

- `AGENTS.md` 第 4 节：印尼工厂现场产品设计基线。
- `AGENTS.md` 第 5 节：UI、标准列表和真实图片专项门禁。
- `AGENTS.md` 第 7 节：分层验证、命名页面和证据新鲜度。

## 3. 自查结论

| 检查项 | 结论 | 具体结果 |
| --- | --- | --- |
| 角色、任务与页面模式 | 通过 | 三页仍是管理 / 主管端接收列表；卡片围绕“生产单—款式—需求段—物料—接收”组织，主动作聚焦“接收”。 |
| 信息密度与核心文案 | 通过 | 生产单号、需求单号、售卖类型、节点状态和操作同区紧凑展示；款式摘要紧随其后；卡头加摘要在 1366 和 1280 视口均不超过 176px，首条物料在 768px 高度内可见。 |
| 字段、状态、数量与单位 | 通过 | 删除四个指定字段；“位置 / 载体”固定 180px；保留应配、当前配料、累计接收、本轮可接收、接收后仍缺 / 剩余及各自单位。 |
| 需求来源与分段 | 通过 | 正常需求与每一次补料维持独立分段，同 SKU 不跨需求合并；补料原因只在分段标题出现一次，来源列使用短文案。 |
| 真实图片与对象识别 | 通过 | 款式图与款号 / 款名 / SPU 同块；物料图与名称 / SKU / 颜色 / 规格同列。可见图片实际加载成功，缺图显示明确失败态，不以通用占位图冒充。 |
| 大图交互 | 通过 | 款式和物料均可点击查看大图；支持关闭按钮、遮罩和 `Esc`，大图保持比例且不溢出低分辨率视口。 |
| Web 接收核心动作 | 通过 | Ready / Incomplete 的有效节点可直接打开 Web 接收弹窗；展示整节点全部物料且不可改量，必须填写接收人、明确选择待加工仓和空闲库位后方可确认。 |
| 接收防错与恢复 | 通过 | 节点版本过期、仓库无效、库位停用 / 占用、待处理差异、空接收人、空物料及混仓均阻断；失败后保留弹窗选择并展示可恢复提示。 |
| 差异与主管兜底 | 通过 | Web 可上报接收差异；差异数量必须为正数，照片或说明至少一个；未处理差异阻断接收，处理后可恢复。 |
| Web / PDA 共享事实 | 通过 | 两端进入同一确认协调入口，共用节点版本、数量、库位、幂等键和事务；一次确认形成 1 条接收会话、N 条明细与 N 条入仓事件。 |
| 幂等、原子与回查 | 通过 | 重复确认不重复创建会话或事件；写入失败整笔回滚；PDA 接收后可在 Web 仓库事件账回查同一结果。 |
| 分页、偏好和局部更新 | 通过 | 三页底部均按生产单卡片分页，支持 10 / 20 / 50；删除列的旧偏好自动清理；筛选、弹窗图片反馈和接收失败不触发整页重绘。 |
| 低分辨率与横向滚动 | 通过 | 1366×768、1280×720 页面主体均无横向溢出；仅卡内物料表在必要时横向滚动；三个命名页面均完成当前分支验收。 |
| 打印、扫码、弱网 | 不适用 / 保持 | 本任务未改打印与扫码。原型不新增真实离线队列；失败提示和重试路径保留。 |

## 4. 问题标签

- `字段过载`
- `视觉干扰`
- `点错风险`
- `协作断裂`

## 5. 主要问题与处理

| 原问题 | 影响 | 本次处理 | 结果 |
| --- | --- | --- | --- |
| 原卡头和摘要区留白过大，重复状态和说明挤占首屏 | 用户难以快速看见物料与核心操作 | 身份、状态、操作收拢到紧凑卡头；款式摘要采用左右两块短信息；删除重复说明和嵌套操作卡 | 通过双视口尺寸与截图验收 |
| 宽表包含非接收核心字段 | 信息噪声、横向跨度过大 | 删除加工状态、加工可供、已到仓、超配异常；位置列收窄到 180px | 三页表头、列设置和旧偏好契约通过 |
| 只能从 Web 跳转 PDA 接收 | Web 端不能闭环当前任务 | 增加 Web 整节点接收弹窗、仓库与空闲库位选择、差异上报和接收结果刷新 | Web 正常、异常、幂等和记录回查通过 |
| Web / PDA 若各自写接收事实会产生口径漂移 | 会话、仓库事件或幂等不一致 | 抽出共用接收协调入口，两端仅提供来源和角色差异 | Web / PDA 联动专项通过 |
| 款式 / 物料缩略图不能完整核对 | 容易选错对象 | 同块展示对象标识，增加大图、失败态、遮罩和 `Esc` | 图片专项与浏览器操作通过 |

## 6. 最终结论

结论：通过

说明：需求追踪矩阵 `RECEIVE-UI-001`～`RECEIVE-UI-027` 均已绑定当前实现、专项自动化、双视口页面证据和最终治理门禁；本次任务达到 `verified`，未提交或发布到远端。

## 7. 变更覆盖与验证

### 受管文件

- `src/main-handlers/fcs-handlers.ts`
- `src/pages/pda-warehouse-wait-process.ts`
- `src/pages/process-factory/cutting/pickup-management-list.ts`
- `src/pages/process-factory/cutting/pickup-management-card-model.ts`
- `src/pages/process-factory/cutting/pickup-management-projection.ts`
- `src/pages/process-factory/cutting/warehouse-location-map.ts`

关联的非治理目录实现：

- `src/runtime/fcs/cutting/pickup-management-runtime.ts`
- `scripts/check-cutting-pickup-field-execution.ts`
- `scripts/check-cutting-pickup-three-list.ts`
- `scripts/check-cutting-pickup-ui-closure.ts`
- `scripts/check-cutting-prep-pickup-return-linkage.ts`
- `scripts/check-material-prep-pickup-management.ts`
- `scripts/check-pda-pickup-flow.ts`
- `scripts/check-cutting-warehouse-location-map.ts`
- `tests/cutting-pickup-node-flow.spec.ts`
- `tests/cutting-pickup-three-list.spec.ts`
- `tests/cutting-runtime-event-ledger-pda-web.spec.ts`

### 页面路由

- `/fcs/craft/cutting/pickup-management/ready`
- `/fcs/craft/cutting/pickup-management/incomplete`
- `/fcs/craft/cutting/pickup-management/history`

### 验证命令

- `git diff --check`：通过。
- 七项接收相关静态契约：全部通过，包括三页卡片、配料接收、节点数据闭环、现场字段 / 差异、UI 闭环、配料退回联动和 PDA 接收。
- `npm run check:list-page-governance:static`：通过，扫描 357 个页面，历史基线 17。
- `npm run build`：通过，构建 2344 个模块。
- `npx playwright test tests/cutting-pickup-node-flow.spec.ts tests/cutting-pickup-three-list.spec.ts --workers=1`：通过，21 / 21；照片名称局部反馈 0.1ms，筛选到 DOM 126.1ms。
- `npx playwright test tests/cutting-runtime-event-ledger-pda-web.spec.ts --grep "PDA 中转仓接收按待领节点" --workers=1`：通过，1 / 1；PDA 接收后可在 Web 事件账回查。
- 1366×768、1280×720：页面主体无横向溢出；紧凑头部高度、首条物料、分页和卡内滚动通过。
- 本地与局域网：`127.0.0.1:4214` 和 `192.168.1.35:4214` 的 ready 路由均返回 200。
- `npm run check:prototype-design-governance -- --all`：通过，覆盖 6 个用户可见文件、0 个纯技术文件和 1 份关联审查记录。
- `codegraph sync`：通过，同步 16 个变更文件，其中新增 1 个、修改 15 个，共解析 1245 个节点。
- `codegraph status`：通过，索引 1502 个文件、46337 个节点、181187 条边，无待同步文件。
- `npm run workflow:verify -- --output /private/tmp/higoods-cutting-receive-final/task-receipt.json --task-boundary "裁床接收管理紧凑生产单卡片与 Web/PDA 共用接收"`：通过，状态 `verified`，阻塞项 0；完整裁床检查、FCS 端到端、列表治理、原型治理和构建均通过。

### 截图证据

- `output/playwright/cutting-pickup-ready-1366x768.png`
- `output/playwright/cutting-pickup-incomplete-1366x768.png`
- `output/playwright/cutting-pickup-history-1366x768.png`
- `output/playwright/cutting-pickup-web-receipt-modal-1366x768.png`
- `output/playwright/cutting-pickup-web-receipt-location-map-1366x768.png`

### 真实图片验证

- 款式图读取生产单 / 补料单自身保存的对应图片；物料图读取需求行自身的 `materialImageUrl`，不使用无关通用占位图。
- 款式缩略图与款号、款名、SPU 同块；物料缩略图与名称、SKU、颜色、规格同列。
- 浏览器已验证款式和物料大图按钮、遮罩、关闭按钮、`Esc`、保持比例和加载失败提示。

### 例外

- 仓库位置图全量历史脚本在与本任务无关的“待交出仓 T1 / T2”旧场景断言失败；本次修改只涉及显式待加工仓投影和接收会话排除，不涉及待交出仓运行时。
- 事件账全文件另有 3 个与本任务无关的菲票装袋 / 特殊工艺菲票旧场景失败；本任务点名的 PDA 接收后 Web 回查用例已单独通过。
- 上述失败未被隐藏或改写，也未作为本任务通过证据；如需处理，应另立任务核查其当前业务口径。
