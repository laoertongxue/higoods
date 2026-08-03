# 裁床中转袋拆袋重装、回收与报废闭环原型审查记录

## 1. 基本信息

| 项目 | 内容 |
| --- | --- |
| 审查日期 | 2026-08-03 |
| 相关需求 / 任务 | 裁床中转袋直接交出、拆袋重装、回收、强制回收、报废和全程追溯 |
| 涉及系统 | FCS 裁床 Web、PDA、运行时事实账与中转袋详情 |
| 涉及页面路径 | `/fcs/craft/cutting/warehouse-management/wait-handover`、`/fcs/craft/cutting/transfer-bags`、`/fcs/craft/cutting/transfer-bag-detail`、`/fcs/pda/warehouse/wait-handover?scope=cutting`、`/fcs/pda/cutting/transfer-bag/repack`、`/fcs/pda/cutting/transfer-bag/recovery`、`/fcs/pda/cutting/transfer-bag/scrap`、PDA 中转袋交出与详情页 |
| 端类型 | 管理 / 主管 Web；仓管员工 PDA |
| 主要角色 | 裁床装袋员、待交出仓仓管、裁床交出员、空袋回收员、裁床主管、查询人员 |
| 主要任务 | 菲票装袋、入仓、直接交出或拆袋重装后交出、实物空袋回收、报废、详情追溯 |

## 2. 参考规范

- `docs/higood-indonesia-factory-product-design-guidelines.md`
- `docs/higood-indonesia-factory-prototype-review-checklist.md`

## 2. 审查事实与范围

### 2.1 已确认业务事实

- 中转袋只保留三个主状态：`空闲`、`使用中`、`已报废`。
- `使用中`按当前事实展示四个阶段：`菲票已装袋`、`入仓暂存中`、`待交出`、`已交出待回收`；阶段不是第四种主状态。
- 一个中转袋当前只能装一个生产单的有效菲票；同一生产单允许分装多个中转袋。
- 裁床入仓后可以直接整袋交出，也可以按车缝任务分配结果拆袋重装后交出；重装后不再要求归位或再次入仓。
- 整袋直接交出允许同一袋关联同一接收车缝工厂的多个车缝任务。系统只记录本次把哪个袋、哪些菲票交给哪个接收工厂，不管理外部车缝工厂之间借袋、调袋、协作或分包流转。
- 交出成功后解除当前袋票占用关系，但保留不可变的交出快照，阶段为`已交出待回收`。
- 后道或裁床收到实物空袋后执行回收，袋变为空闲。线上仍显示已交出时，允许在实物已收到、实物袋为空并说明原因后强制回收。
- 菲票已装袋、入仓暂存中或待交出的袋不能直接报废，必须先拆袋重装并转移全部有效菲票。空闲袋可以独立报废；已交出袋在报废页依次记录“回收为空闲”和“报废”两条事实。已报废袋永久不能再次回收、装袋或流转。
- 不增加待清洗、待维修等状态或异常标签。

### 2.2 非目标与受管边界

- 不实现真实后端、鉴权、数据库、离线队列或外部工厂袋池管理；当前为浏览器运行时事实账支撑的高保真原型。
- 不要求车缝工厂在本系统维护收袋、拆袋、装成衣、跨厂协作或空闲袋池。
- 不约束车缝工厂交给后道的中转袋必须是裁床过去交给该车缝工厂的某一只袋。
- 本次不新增打印流程，不改变款式或物料图片规则，也没有新增需要真实图片识别的款式 / 物料对象。

## 3. 对象、状态和闭环

| 对象 / 事实 | 关键约束 | 上游 | 下游 |
| --- | --- | --- | --- |
| 中转袋身份 | 袋码稳定；已报废永久停用 | 袋档案 / 扫码或手填 | 所有袋级事实与详情 |
| 当前袋票关系 | 同袋同生产单；记录张数和片数；重装守恒 | 菲票装袋、拆袋重装 | 入仓、交出资格 |
| 当前库位 | 入仓成功后由仓库、库区和库位事实确定 | 中转袋入仓、特殊工艺回仓 | 直接交出或重装 |
| 重装事实 | 多来源、多结果、允许复用来源袋；全部有效菲票必须且只能分配一次 | 入仓暂存中的袋与车缝任务分配 | 结果袋进入待交出 |
| 整袋交出事实 | 一袋一次确认；同接收工厂可包含多个任务；保存不可变菲票快照 | 入仓暂存或待交出 | 已交出待回收、交出记录 |
| 回收事实 | 实物已收到且为空；普通 / 强制回收分开说明 | 已交出待回收 | 空闲袋 |
| 报废事实 | 仅空闲可报废；已交出可先回收再报废；不可逆 | 空闲或已交出待回收 | 已报废 |

正常闭环：裁剪完成并绑菲票编号 → 菲票装袋 → 中转袋入仓 → 直接整袋交出，或拆袋重装后交出 → 已交出待回收 → 后道或裁床收到实物空袋并回收 → 空闲 → 后续再次装袋。

异常闭环示例：裁床拿到实物空袋，但系统仍显示已交出待回收 → 装袋页提示先强制回收 → 操作人确认实物已收到且为空并填写原因 → 先写回收事实变空闲 → 再继续写装袋事实。任一步失败均显示已完成与未完成部分，不能把部分成功伪装成全部成功。

## 3. 自查结论

| 检查项 | 结论 | 说明 |
| --- | --- | --- |
| 角色匹配 | 通过 | Web 面向仓管 / 主管集中处理和追溯；PDA 面向现场逐袋扫码执行。 |
| 任务清晰度 | 通过 | Web 待交出仓保留六个独立动作；PDA 六个入口全部位于裁床“待交出仓”卡片中。 |
| 信息架构与导航 | 通过 | 装袋、入仓、重装、交出、回收、报废动作名称一致；旧深链只做兼容跳转，不继续提供旧写入口。 |
| 页面模式 | 通过 | Web 使用工作台弹窗和标准列表；PDA 每页只有一个主动作，按扫描、核对、确认组织。 |
| 信息负荷 | 通过 | PDA 只展示当前袋、生产单、菲票张 / 片数、接收工厂和当前动作所需确认；不暴露外部车缝内部流转。 |
| 文案 | 通过 | 使用`菲票已装袋`、`入仓暂存中`、`待交出`、`已交出待回收`；没有`待清洗`、`待维修`和旧“交出装袋确认”动作。 |
| 数量与状态 | 通过 | 重装逐票守恒，来源与结果张数 / 片数一致；主状态与阶段分开展示。 |
| 扫码与识别 | 通过 | PDA 支持扫码 Enter，也支持手工填写；Web 支持手工填写 / 选择。识别后显示袋号、状态、生产单、菲票数量和接收工厂。 |
| 防错 | 通过 | 跨生产单结果袋、跨接收工厂整袋交出、遗漏 / 重复菲票、活动袋直接报废、已报废回收或复用均阻断。 |
| 危险确认 | 通过 | 强制回收要求实物已收到、实物为空和原因；报废要求原因、授权人和不可逆二次确认。 |
| 局部交互 | 通过 | 六个 Web 动作局部打开 / 关闭弹窗；输入不替换工作台 DOM；PDA 动作页局部更新当前内容。 |
| 列表与分页 | 通过 | 中转袋主列表使用标准列表、列设置、表内横向滚动和分页；详情各历史分区继续显示当前 / 历史事实。 |
| 协作关系 | 通过 | 交出事实明确袋、菲票快照、车缝任务和接收工厂；只记录系统可观察的交出和回收节点。 |
| 异常与追溯 | 通过 | 详情展示装袋、入仓、重装、交出、特殊工艺回仓、回收和报废事实；历史事实不被当前操作覆盖。 |
| 现场设备可用性 | 通过 | Web 按 1366×768 和 1280×720；PDA 按 390×844 验收，按钮可见或一步滚动可达。 |
| 图片门禁 | 不适用 | 本次没有新增或改变款式、物料对象展示；袋码通过编号 / 二维码识别。 |
| 打印门禁 | 不适用 | 本次不修改打印模板或打印入口。 |

## 5. 主要问题与处理

| 问题 | 标签 | 影响角色 | 处理方式 | 是否仍有风险 |
| --- | --- | --- | --- | --- |
| 旧逻辑将装袋和交出确认耦合，且限制一个袋只能绑定一个车缝任务 | `协作断裂`、`状态抽象` | 装袋员、交出员 | 拆分装袋、入仓、重装、整袋交出事实；整袋交出按同一接收工厂校验，允许多个任务 | 否 |
| 旧状态多且与现场动作不一致 | `读不懂`、`状态抽象` | 全部角色 | 统一为三个主状态和四个阶段，动作资格从共享当前事实推导 | 否 |
| 有菲票的袋可能被直接报废 | `点错风险` | 仓管、主管 | Web / PDA 都阻断并引导先拆袋重装；交出袋报废强制先写回收事实 | 否 |
| 实物空袋已回到裁床但线上仍占用 | `协作断裂`、`缺主管兜底` | 装袋员、回收员 | 提供独立回收、强制回收和装袋前强制回收；保留原因、节点、位置和操作人 | 保留人为确认实物是否为空的现场责任 |
| 外部车缝工厂协作不可观察 | `追溯不足` | 查询人员 | 明确系统边界，只追踪裁床交出快照和后续可观察回收事实，不制造外部流转记录 | 是，属于明确非受管范围 |

## 6. 受管文件

### 数据与共享事实

- `src/data/fcs/cutting/cutting-runtime-chronology.ts`
- `src/data/fcs/cutting/cutting-runtime-event-ledger.ts`
- `src/data/fcs/cutting/sewing-dispatch.ts`
- `src/data/fcs/cutting/transfer-bag-lifecycle.ts`
- `src/data/fcs/cutting/transfer-bag-operations.ts`
- `src/data/fcs/cutting/transfer-bag-runtime.ts`

### Web 页面

- `src/pages/process-factory/cutting/transfer-bag-return-model.ts`
- `src/pages/process-factory/cutting/transfer-bags-model.ts`
- `src/pages/process-factory/cutting/transfer-bags.ts`
- `src/pages/process-factory/cutting/transfer-bags/detail.ts`
- `src/pages/process-factory/cutting/transfer-bags/dialogs.ts`
- `src/pages/process-factory/cutting/transfer-bags/handlers.ts`
- `src/pages/process-factory/cutting/transfer-bags/state.ts`
- `src/pages/process-factory/cutting/wait-handover-actions.ts`
- `src/pages/process-factory/cutting/wait-handover-dialogs.ts`
- `src/pages/process-factory/cutting/wait-handover-runtime.ts`
- `src/pages/process-factory/cutting/warehouse-hub.ts`

### PDA 页面与分发

- `src/pages/pda-cutting-handover.ts`
- `src/pages/pda-cutting-inbound-projection.ts`
- `src/pages/pda-cutting-inbound.ts`
- `src/pages/pda-cutting-transfer-bag-recovery.ts`
- `src/pages/pda-cutting-transfer-bag-repack.ts`
- `src/pages/pda-cutting-transfer-bag-scrap.ts`
- `src/pages/pda-cutting-wait-handover-actions.ts`
- `src/pages/pda-transfer-bag-detail.ts`
- `src/main-handlers/pda-cutting-keydown-routing.ts`
- `src/main-handlers/pda-handlers.ts`
- `src/router/route-renderers.ts`
- `src/router/routes-pda.ts`

## 7. 验证证据

### 自动与专项检查

- `npm run check:transfer-bag-three-status`：通过。
- `npm run check:transfer-bag-repack-recovery`：通过。
- `npm run check:transfer-bag-mobile-closed-loop`：通过。
- `npm run check:web-cutting-transfer-bag-actions`：通过。
- `npm run check:pda-cutting-inbound-workflow`：通过。
- `npm run check:pda-cutting-transfer-bag-handover`：通过。
- `npm run check:pda-cutting-wait-handover-entry-routing`：通过。
- `npm run check:pda-cutting-wait-handover-route-integration`：通过。
- `npm run check:cutting:all`：通过，且包含本次三个中转袋专项门禁。
- `npm run build`：通过。

### 浏览器证据

- Web 待交出仓六动作、局部弹窗、输入 DOM 稳定、重装守恒、直接交出、回收 / 报废资格和分页：Playwright 通过。
- Web 回收后 PDA 详情立即显示空闲；PDA 报废后 Web 立即阻断重复报废：同一浏览器事实账 Playwright 通过。
- PDA 390×844 多来源重装、同工厂多任务交出、独立回收、回收后报废和已报废永久阻断：Playwright 通过。
- Web 中转袋管理在 1366×768、1280×720 下主体无横向溢出，宽表在表格容器内滚动：Playwright 通过。

### 治理与发布前检查

- `npm run check:list-page-governance`：发布前最终验证。
- `npm run check:prototype-design-governance`：发布前最终验证。
- `git diff --check`、CodeGraph 同步 / 状态、任务收据：发布前最终验证。

## 8. 例外与最终结论

例外：`src/pages/process-factory/cutting/warehouse-hub.ts`是裁床仓务工作台而非标准管理列表。本次只在既有待交出仓工作台中接入六个中转袋动作，没有把整个工作台迁移为标准列表；中转袋标准主列表仍使用标准列表组件、表内滚动、列设置和分页。外部车缝工厂内部袋流转不受本系统管理，详情只展示本系统观察到的裁床交出与后续回收事实。

结论：通过。已确认的三个主状态、四个阶段、直接交出 / 重装后交出、回收、强制回收、报废和 Web / PDA 追溯闭环均有实现与专项 / 浏览器证据；最终交付仍以最后一次完整门禁、CodeGraph 状态和远端分支回执为准。

## 6. 最终结论

结论：通过

说明：三个主状态、四个阶段、直接交出 / 重装后交出、回收、强制回收、报废和 Web / PDA 追溯闭环均已形成实现与专项 / 浏览器证据。最终交付以最后一次完整门禁、CodeGraph 状态和远端分支回执为准。

## 9. 治理索引

### 受管文件

- `src/data/fcs/cutting/cutting-runtime-chronology.ts`
- `src/data/fcs/cutting/cutting-runtime-event-ledger.ts`
- `src/data/fcs/cutting/sewing-dispatch.ts`
- `src/data/fcs/cutting/transfer-bag-lifecycle.ts`
- `src/data/fcs/cutting/transfer-bag-operations.ts`
- `src/data/fcs/cutting/transfer-bag-runtime.ts`
- `src/main-handlers/pda-cutting-keydown-routing.ts`
- `src/main-handlers/pda-handlers.ts`
- `src/pages/pda-cutting-handover.ts`
- `src/pages/pda-cutting-inbound-projection.ts`
- `src/pages/pda-cutting-inbound.ts`
- `src/pages/pda-cutting-transfer-bag-recovery.ts`
- `src/pages/pda-cutting-transfer-bag-repack.ts`
- `src/pages/pda-cutting-transfer-bag-scrap.ts`
- `src/pages/pda-cutting-wait-handover-actions.ts`
- `src/pages/pda-transfer-bag-detail.ts`
- `src/pages/process-factory/cutting/transfer-bag-return-model.ts`
- `src/pages/process-factory/cutting/transfer-bags-model.ts`
- `src/pages/process-factory/cutting/transfer-bags.ts`
- `src/pages/process-factory/cutting/transfer-bags/detail.ts`
- `src/pages/process-factory/cutting/transfer-bags/dialogs.ts`
- `src/pages/process-factory/cutting/transfer-bags/handlers.ts`
- `src/pages/process-factory/cutting/transfer-bags/state.ts`
- `src/pages/process-factory/cutting/wait-handover-actions.ts`
- `src/pages/process-factory/cutting/wait-handover-dialogs.ts`
- `src/pages/process-factory/cutting/wait-handover-runtime.ts`
- `src/pages/process-factory/cutting/warehouse-hub.ts`
- `src/router/route-renderers.ts`
- `src/router/routes-pda.ts`

### 验证命令

- `npm run check:transfer-bag-three-status`：通过
- `npm run check:transfer-bag-repack-recovery`：通过
- `npm run check:transfer-bag-mobile-closed-loop`：通过
- `npm run check:cutting:all`：通过
- `CUTTING_E2E_PORT=4187 npx playwright test tests/cutting-transfer-bag-repack-recovery.spec.ts tests/cutting-wait-handover-web-modal.spec.ts tests/cutting-transfer-bag-simplified-statuses.spec.ts tests/pda-cutting-transfer-bag-lifecycle.spec.ts`：通过
- `npm run check:list-page-governance`：通过
- `npm run check:prototype-design-governance`：通过
- `npm run build`：通过

### 例外

- `src/pages/process-factory/cutting/warehouse-hub.ts`明确声明为仓务工作台 `dashboard`，不属于标准管理列表；中转袋主列表仍完整使用标准列表组件、表内滚动、列设置和分页。
- 外部车缝工厂内部借袋、调袋、协作和分包不在系统受管范围；系统只展示可观察的裁床交出快照和后续回收事实。

## 10. 2026-08-03 逐任务复核

本轮重新按实施计划 17 个任务逐项核对实现、专项检查和浏览器证据，并修正了“代码不可达但仍保留冲突规则”的遗漏。复核结论如下：

| 任务 | 复核后的实现证据 | 直接验证证据 | 结论 |
| --- | --- | --- | --- |
| 1. 三状态四阶段 | 生命周期仅保留空闲、使用中、已报废；使用中细分菲票已装袋、入仓暂存中、待交出、已交出待回收 | `check:transfer-bag-three-status`、状态浏览器用例 | 通过 |
| 2. 统一事件合同 | 重装、回收、报废、特殊工艺回仓和多任务交出均进入统一事件账，旧事件只读兼容 | 三状态与重装回收专项 | 通过 |
| 3. 当前袋票关系 | 当前关系按事件时序折叠；重装校验票、片数和使用周期守恒 | `check:transfer-bag-repack-recovery` | 通过 |
| 4. 同工厂多任务交出 | 逐票任务允许多个，但接收工厂必须唯一；交出保存不可变袋票快照 | Web/PDA 交出专项与浏览器用例 | 通过 |
| 5. 回收、强制回收和报废 | 正常回收、强制回收、空闲报废、回收后报废分别记录事实；已报废永久阻断 | 重装回收与移动闭环专项 | 通过 |
| 6. 特殊工艺带袋回仓 | 有票回仓恢复当前关系；实物空袋走回收；来源交出事实不完整时阻断 | 重装回收专项 | 通过 |
| 7. Web 六动作工作台 | 菲票装袋、入仓、拆袋重装、交出、回收、报废均为独立动作和局部弹窗 | Web 动作专项与 Web 弹窗浏览器用例 | 通过 |
| 8. 主列表与详情 | 主列表读取统一当前事实；详情分当前袋票、交出快照、回收、报废和历史周期 | 三状态专项、详情页浏览器用例 | 通过 |
| 9. PDA 六入口 | 六个入口集中在“待交出仓”卡片，旧深链仅做路由迁移 | PDA 入口和路由专项 | 通过 |
| 10. PDA 装袋与入仓 | 装袋强制一袋一生产单；入仓只扫袋和库位；使用中袋可经确认强制回收后再用 | PDA 入仓专项 | 通过 |
| 11. PDA 拆袋重装 | 支持多来源、多结果和来源袋复用，确认前校验票数与片数守恒 | 重装专项与 390×844 浏览器用例 | 通过 |
| 12. PDA 整袋交出 | 已删除候选袋 Mock、车缝任务扫码、`boundSewingTaskNo` 和单任务写入；只扫袋并自动核对全部任务 | PDA 交出专项与局部刷新浏览器用例 | 通过 |
| 13. PDA 回收、报废、详情 | 回收和报废均有独立页面；详情只读；有票袋先重装，已报废永久阻断 | 移动闭环专项与 PDA 浏览器用例 | 通过 |
| 14. 清理旧逻辑 | 已删除旧 Web 待办表、旧统计卡、旧 PDA 单任务写路径；“交出装袋确认”只剩历史映射和过滤 | Web/PDA 源码禁止项断言 | 通过 |
| 15. 完整业务门禁 | 旧“跨生产单混装”和“单任务绑定”正向断言已删除，新增模型、Mock、详情冲突规则反向扫描 | `check:cutting:all` | 通过 |
| 16. 浏览器与治理 | Web 1366×768、1280×720；PDA 390×844；跨端事实互认、局部刷新、表内横向滚动均覆盖 | 指定 Playwright 组；截图见下 | 通过 |
| 17. 最终核查与收据 | 格式、禁止项、专项、总门禁、构建、浏览器、CodeGraph 和机器收据绑定最后一次业务改动 | 20/20 浏览器通过；CodeGraph 无待同步；机器收据在提交前生成 | 通过 |

本轮浏览器截图固定输出到：

- `output/playwright/transfer-bag-web-1366x768.png`
- `output/playwright/transfer-bag-web-1280x720.png`
- `output/playwright/transfer-bag-pda-390x844.png`

本轮额外确认：`src/data/fcs/cutting/transfer-bag-runtime.ts` 的演示袋票也遵守一袋一生产单；不再以“当前页面未渲染”作为保留冲突 Mock 或冲突文案的理由。

最终复跑结果：

- `check:transfer-bag-three-status`、`check:transfer-bag-repack-recovery`、`check:cutting:all`：退出码均为 0。
- `check:list-page-governance`、`check:prototype-design-governance`、`npm run build`：退出码均为 0。
- 指定 Web/PDA 浏览器组连同局部刷新性能用例共 20 项，20/20 通过。
- 三张截图尺寸经文件头核对分别为 1366×768、1280×720、390×844。
- `codegraph sync` 后状态为 1451 个文件、45731 个节点、171350 条边，pending added/modified/removed 均为 0，工作树匹配。
