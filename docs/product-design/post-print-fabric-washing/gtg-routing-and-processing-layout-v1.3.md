# GTG 固定承接与洗水加工单信息结构 V1.3

发布复核补充：V1.3 的源码、矩阵与证据保留原版本身份。GTG 仓库摘要在生产回放中发现的数量漏算，按 [发布复核修复记录](../../prototype-review-records/2026-10-15-washing-gtg-release-followup.md) 的 WASH-267～269 继续落实，不以旧报告覆盖本次复核结果。

日期：2026-10-15。阶段：六项业务更正已实施并完成专项技术验证；产品接受另行登记。基线：09881217da6db7ae5bd79fa286165e1c3a02caa5。继承 V1.1 和 V1.2 未被本次替代的实物触摸、按手感、助剂配比线下和不提前预建洗水规则。本次改变承接厂选择、发起后的实际去向与工艺路线展示、追溯入口及加工单信息结构；历史原子条目与验收保留原版本身份。

## 业务需求与明确边界

- U1：洗水由 GTG 承接。发起即固定交给 GTG，不出现任意选厂/另行派厂步骤，仍须染厂接单和实物交接。拒单协调后可在原单重新交由 GTG 承接，保留拒单历史。GTG 为现有 ID-F003；旧演示档案标为暂停，与本次可执行流程冲突，本次仅将该演示档案对齐启用。用户持久设置的暂停仍阻断新建，不覆盖人工档案，不回退其他厂。既往其他厂真实已发生的事实保留；未交出旧单可明确调整到 GTG。
- U2：发起成功后，该洗水范围内的印花面料下游是 GTG；洗水下游保留发起前的原下游。部分卷洗水时分别展示范围。关联技术包的工艺路线在实际发起后展示“印花 → 洗水 (GTG) → 原下游”，带本次手感和单据；范围是本次实际加工，不将其变成以后所有生产单预设工序。仅精确版本关联，生产单技术包入口再按生产单限定。无技术包关联的备货等来源可洗水但不虚构技术包，不按同款猜测关系。已发布基准路线不被静默改写，实际追加事实与基准路线共同展示。
- U3/U5：删除两张截图红框中的当前人员、职责、现场及原型上下文整块内容。入口和实际工厂决定动作职责，操作日志保留实际操作身份。
- U4：印花单显示已发起洗水；日志可查何人何时、何种手感、哪些卷及哪张洗水单；操作栏逐单提供“查看洗水加工单”，新窗口打开。无需洗水和作废不伪装有效洗水。
- U6：洗水加工单参照染色加工单的七组信息：加工单/商品、加工投入/上游、加工要求、处理进度、加工产出/下游、时间、数量。管理列表与详情信息一致；PDA 仍按小屏任务卡执行。只展示已有真实字段，不编造计划时点、产出 SKU 或助剂信息。

## 实施计划与数据边界

| 工作包 | 业务目标 → 文件/符号 | 修改 → 验证与完成条件 |
| --- | --- | --- |
| A | GTG 固定承接 → fabric-washing-model.ts、fabric-washing.ts、indonesia-factories.ts | 创建原子写入 GTG 与待接单；移除任意厂派发；核查暂停、纠正、旧单及完整执行 |
| B | 印花去向与追溯 → fabric-washing-views.ts、printing/relations.ts、work-orders.ts、dialogs.ts | 从已提交洗水事实读出范围、标识、日志、链接；局部刷新行；验证多单、部分卷、新窗口及刷新 |
| C | 技术包实际路线 → fabric-washing-views.ts、tech-pack/process-domain.ts、routes-pcs.ts、fcs-production-tech-pack-snapshot.ts | 精确版本和生产单关联；直接打开独立读回；不写第二套技术包事实，不触发初始拆解；验证发起前后、版本隔离、重复和作废 |
| D | 移除上下文控件 → washing/work-orders.ts | 删除内容、状态和处理器，按动作决定职责与实际工厂；验证 Web/PDA 正常与错误工厂 |
| E | 七组加工单信息 → washing/order-presentation.ts、work-orders.ts | 复用标准列表和分页，列表与详情共享业务呈现；验证图片、列设置、筛选、数量及设备 |
| F | 验证和交付 → 单元/专项脚本、矩阵、审查记录 | 正常、边界、持久失败/冲突、Web/PDA/打印、性能、两轮审查、构建和收据；本轮先实施验证，不自动继承上一轮发布结果 |

洗水对象仍使用现有 IndexedDB 按记录库：主单、卷判断、动作及必需印花/接收关联同事务成功。印花标识/日志、实际下游、技术包实际追加由这些提交事实读取，不再顺序写入另一技术包库。技术包的基准历史和实际追加有明确来源；打开页面不写业务数据。新补充的商品、材质及技术包关联快照仅附于本次必要来源，不复制整个技术包或工作区。旧源、桥接和附件生命周期继续遵循现有专用仓库。GTG PDA 两仓使用原实物记录并跳转确切洗水单。为关闭实测超时，提前加工演示初始化采用一次读取索引，印花同步渲染共享单次提交快照，PDA 身份读取延迟摘要，纯染厂不构建不适用的裁剪/车缝中转袋统计；不改变其他工厂的有效任务事实。

直接上下游：上游保持实际完成与原实物卷；印花普通交出继续防止已洗水卷重复流转；染厂由固定 GTG 接单并实收后形成库存；洗后回原接收方；印花筛选/导出及适用纸单从同一实际接收方推导；未匹配的提前印花也先显示 GTG。生产单与技术包只增加实际关联，既有裁剪/车缝初始拆解不重复；打印与各端同源。影响 GTG 演示档案的启用状态，需额外核对染厂候选与 PDA 登录；其他工厂档案不调整。

## 增量原子矩阵

确认目标：本次用户六项更正；技术确认人：Codex 主代理。证据版本：09881217 + source-manifest.json 摘要 b9534f5c3305dd80206a783a71eca0172e6bddd3df7ca630dc017496faead824。产品接受待用户。

| 编号 | 来源 | 原子需求 | 工作包 | 实际文件/符号 | 自动化验证 | 页面/PDA/打印/性能证据或不适用理由 | 状态 | 证据位置 | 确认人/版本 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| WASH-226 | U1 | 新建洗水单直接分配 GTG 并进入待接单，不再等待选厂。 | WP-13A | fabric-washing-model.ts / applyWashingCommand | 定向单测 + domain-final.log | 正式 Web/PDA 回放；performance-final.json 对应家族 | 已验证 | [V1.3 验收](../../verification-evidence/2026-10-15-washing-gtg-v1.3/acceptance-v1.3.md) | 技术验证：Codex；目标：用户六项；09881217 + b9534f5c3305；接受待用户 |
| WASH-227 | U1 | 任何新派厂或重派厂只能指向 GTG。 | WP-13A | fabric-washing.ts / submitWashingCommand | 定向单测 + domain-final.log | 正式 Web/PDA 回放；performance-final.json 对应家族 | 已验证 | [V1.3 验收](../../verification-evidence/2026-10-15-washing-gtg-v1.3/acceptance-v1.3.md) | 技术验证：Codex；目标：用户六项；09881217 + b9534f5c3305；接受待用户 |
| WASH-228 | U1 | GTG 演示档案对齐启用；用户实际暂停或禁止执行时阻断建单，不改派。 | WP-13A | indonesia-factories.ts；fabric-washing.ts | 定向单测 + domain-final.log | 正式 Web/PDA 回放；performance-final.json 对应家族 | 已验证 | [V1.3 验收](../../verification-evidence/2026-10-15-washing-gtg-v1.3/acceptance-v1.3.md) | 技术验证：Codex；目标：用户六项；09881217 + b9534f5c3305；接受待用户 |
| WASH-229 | U1 | 历史其他承接厂与已发生交接不被普通读取改写；未交出旧单提供固定 GTG 的明确调整动作。 | WP-13A | fabric-washing-model.ts；washing/work-orders.ts | 定向单测 + domain-final.log | 正式 Web/PDA 回放；performance-final.json 对应家族 | 已验证 | [V1.3 验收](../../verification-evidence/2026-10-15-washing-gtg-v1.3/acceptance-v1.3.md) | 技术验证：Codex；目标：用户六项；09881217 + b9534f5c3305；接受待用户 |
| WASH-230 | U2 | 已发起洗水的印花面料下游显示 GTG 及对应洗水单。 | WP-13B | printing/relations.ts | 定向单测 + domain-final.log | 正式 Web/PDA 回放；performance-final.json 对应家族 | 已验证 | [V1.3 验收](../../verification-evidence/2026-10-15-washing-gtg-v1.3/acceptance-v1.3.md) | 技术验证：Codex；目标：用户六项；09881217 + b9534f5c3305；接受待用户 |
| WASH-231 | U2/U6 | 洗水单保留发起时印花原接收方作为洗水下游。 | WP-13A | fabric-washing.ts / buildWashingSources | 定向单测 + domain-final.log | 正式 Web/PDA 回放；performance-final.json 对应家族 | 已验证 | [V1.3 验收](../../verification-evidence/2026-10-15-washing-gtg-v1.3/acceptance-v1.3.md) | 技术验证：Codex；目标：用户六项；09881217 + b9534f5c3305；接受待用户 |
| WASH-232 | U2 | 部分卷洗水时按卷范围区分 GTG 与原去向，不把未洗水卷重定向。 | WP-13B | fabric-washing-views.ts；printing/relations.ts | 定向单测 + domain-final.log | 正式 Web/PDA 回放；performance-final.json 对应家族 | 已验证 | [V1.3 验收](../../verification-evidence/2026-10-15-washing-gtg-v1.3/acceptance-v1.3.md) | 技术验证：Codex；目标：用户六项；09881217 + b9534f5c3305；接受待用户 |
| WASH-233 | U2 | 技术包工艺路线在实际发起后追加洗水、GTG、手感及单据关联。 | WP-13C | tech-pack/process-domain.ts；fabric-washing-views.ts | 视图/路线单测；五次确切版本与生产单隔离 | report-2026-10-15T06-25-00.293Z.json；工艺路线实际追加 | 已验证 | [V1.3 验收](../../verification-evidence/2026-10-15-washing-gtg-v1.3/acceptance-v1.3.md) | 技术验证：Codex；目标：用户六项；09881217 + b9534f5c3305；接受待用户 |
| WASH-234 | U2 | 实际追加只关联确切技术包版本，不按同款向其他版本传播。 | WP-13C | fabric-washing.ts；fabric-washing-views.ts | 视图/路线单测；五次确切版本与生产单隔离 | report-2026-10-15T06-25-00.293Z.json；工艺路线实际追加 | 已验证 | [V1.3 验收](../../verification-evidence/2026-10-15-washing-gtg-v1.3/acceptance-v1.3.md) | 技术验证：Codex；目标：用户六项；09881217 + b9534f5c3305；接受待用户 |
| WASH-235 | U2 | 生产单技术包查看入口显示本生产单实际追加洗水。 | WP-13C | fcs-production-tech-pack-snapshot.ts | 视图/路线单测；五次确切版本与生产单隔离 | report-2026-10-15T06-25-00.293Z.json；工艺路线实际追加 | 已验证 | [V1.3 验收](../../verification-evidence/2026-10-15-washing-gtg-v1.3/acceptance-v1.3.md) | 技术验证：Codex；目标：用户六项；09881217 + b9534f5c3305；接受待用户 |
| WASH-236 | U2 | 发起前、无需洗水及初始生产拆解不预建洗水节点或加工单。 | WP-13C | tech-pack-process-route.ts；process-domain.ts | 视图/路线单测；五次确切版本与生产单隔离 | report-2026-10-15T06-25-00.293Z.json；工艺路线实际追加 | 已验证 | [V1.3 验收](../../verification-evidence/2026-10-15-washing-gtg-v1.3/acceptance-v1.3.md) | 技术验证：Codex；目标：用户六项；09881217 + b9534f5c3305；接受待用户 |
| WASH-237 | U2 | 重复保存或刷新不重复追加；作废保留历史并退出有效实际路线。 | WP-13A/C | fabric-washing-model.ts；fabric-washing-views.ts | 视图/路线单测；五次确切版本与生产单隔离 | report-2026-10-15T06-25-00.293Z.json；工艺路线实际追加 | 已验证 | [V1.3 验收](../../verification-evidence/2026-10-15-washing-gtg-v1.3/acceptance-v1.3.md) | 技术验证：Codex；目标：用户六项；09881217 + b9534f5c3305；接受待用户 |
| WASH-238 | U3 | 发起弹窗移除人员、职责、现场和本地原型职责上下文整块内容。 | WP-13D | washing/work-orders.ts / renderWashingJudgmentPanel | 定向单测 + domain-final.log | 正式 Web/PDA 回放；performance-final.json 对应家族 | 已验证 | [V1.3 验收](../../verification-evidence/2026-10-15-washing-gtg-v1.3/acceptance-v1.3.md) | 技术验证：Codex；目标：用户六项；09881217 + b9534f5c3305；接受待用户 |
| WASH-239 | U5 | 洗水详情移除同一职责切换整块内容。 | WP-13D | washing/work-orders.ts / detailContent | 定向单测 + domain-final.log | 正式 Web/PDA 回放；performance-final.json 对应家族 | 已验证 | [V1.3 验收](../../verification-evidence/2026-10-15-washing-gtg-v1.3/acceptance-v1.3.md) | 技术验证：Codex；目标：用户六项；09881217 + b9534f5c3305；接受待用户 |
| WASH-240 | U3/U5 | 动作根据入口和实际 PDA 工厂确定职责，移除页面角色与工厂切换处理器。 | WP-13D | washing/work-orders.ts / actor、handleFabricWashingEvent | 定向单测 + domain-final.log | 正式 Web/PDA 回放；performance-final.json 对应家族 | 已验证 | [V1.3 验收](../../verification-evidence/2026-10-15-washing-gtg-v1.3/acceptance-v1.3.md) | 技术验证：Codex；目标：用户六项；09881217 + b9534f5c3305；接受待用户 |
| WASH-241 | U4 | 发起人取当前操作身份，缺少真实命名时如实使用当前 Web 操作员，不伪造现场姓名。 | WP-13D | washing/work-orders.ts / actor | 定向单测 + domain-final.log | 正式 Web/PDA 回放；performance-final.json 对应家族 | 已验证 | [V1.3 验收](../../verification-evidence/2026-10-15-washing-gtg-v1.3/acceptance-v1.3.md) | 技术验证：Codex；目标：用户六项；09881217 + b9534f5c3305；接受待用户 |
| WASH-242 | U4 | 印花行可见已发起洗水标识和单据数量。 | WP-13B | printing/work-orders.ts | 定向单测 + domain-final.log | 正式 Web/PDA 回放；performance-final.json 对应家族 | 已验证 | [V1.3 验收](../../verification-evidence/2026-10-15-washing-gtg-v1.3/acceptance-v1.3.md) | 技术验证：Codex；目标：用户六项；09881217 + b9534f5c3305；接受待用户 |
| WASH-243 | U4 | 印花日志包含发起人、发起时间、洗水单、手感和面料卷范围。 | WP-13B | printing/dialogs.ts；fabric-washing-views.ts | 定向单测 + domain-final.log | 正式 Web/PDA 回放；performance-final.json 对应家族 | 已验证 | [V1.3 验收](../../verification-evidence/2026-10-15-washing-gtg-v1.3/acceptance-v1.3.md) | 技术验证：Codex；目标：用户六项；09881217 + b9534f5c3305；接受待用户 |
| WASH-244 | U4 | 印花日志按时间排序并保持原日志，不重复生成日志记录。 | WP-13B | printing/dialogs.ts | 定向单测 + domain-final.log | 正式 Web/PDA 回放；performance-final.json 对应家族 | 已验证 | [V1.3 验收](../../verification-evidence/2026-10-15-washing-gtg-v1.3/acceptance-v1.3.md) | 技术验证：Codex；目标：用户六项；09881217 + b9534f5c3305；接受待用户 |
| WASH-245 | U4 | 操作栏查看洗水加工单以新窗口打开确切单据。 | WP-13B | printing/work-orders.ts | 定向单测 + domain-final.log | 正式 Web/PDA 回放；performance-final.json 对应家族 | 已验证 | [V1.3 验收](../../verification-evidence/2026-10-15-washing-gtg-v1.3/acceptance-v1.3.md) | 技术验证：Codex；目标：用户六项；09881217 + b9534f5c3305；接受待用户 |
| WASH-246 | U4 | 一张印花单多张洗水单时逐单提供对应查看入口。 | WP-13B | printing/work-orders.ts | 定向单测 + domain-final.log | 正式 Web/PDA 回放；performance-final.json 对应家族 | 已验证 | [V1.3 验收](../../verification-evidence/2026-10-15-washing-gtg-v1.3/acceptance-v1.3.md) | 技术验证：Codex；目标：用户六项；09881217 + b9534f5c3305；接受待用户 |
| WASH-247 | U4 | 无需洗水不显示已发起洗水，不生成假洗水链接。 | WP-13B | fabric-washing-views.ts | 定向单测 + domain-final.log | 正式 Web/PDA 回放；performance-final.json 对应家族 | 已验证 | [V1.3 验收](../../verification-evidence/2026-10-15-washing-gtg-v1.3/acceptance-v1.3.md) | 技术验证：Codex；目标：用户六项；09881217 + b9534f5c3305；接受待用户 |
| WASH-248 | U6 | 洗水管理列表提供加工单/商品，含 GTG、来源单、生产单及对应商品图。 | WP-13E | washing/order-presentation.ts | 视图/列偏好单测；36 单七组列表专项 | report-2026-10-15T06-05-12.095Z.json 列表分支；实际 1280/1024 页面 | 已验证 | [V1.3 验收](../../verification-evidence/2026-10-15-washing-gtg-v1.3/acceptance-v1.3.md) | 技术验证：Codex；目标：用户六项；09881217 + b9534f5c3305；接受待用户 |
| WASH-249 | U6 | 列表提供加工投入/上游，展示实际印花面料及来源印花厂、印花单。 | WP-13E | washing/order-presentation.ts | 视图/列偏好单测；36 单七组列表专项 | report-2026-10-15T06-05-12.095Z.json 列表分支；实际 1280/1024 页面 | 已验证 | [V1.3 验收](../../verification-evidence/2026-10-15-washing-gtg-v1.3/acceptance-v1.3.md) | 技术验证：Codex；目标：用户六项；09881217 + b9534f5c3305；接受待用户 |
| WASH-250 | U6 | 列表提供加工要求，展示洗水和目标手感。 | WP-13E | washing/order-presentation.ts | 视图/列偏好单测；36 单七组列表专项 | report-2026-10-15T06-05-12.095Z.json 列表分支；实际 1280/1024 页面 | 已验证 | [V1.3 验收](../../verification-evidence/2026-10-15-washing-gtg-v1.3/acceptance-v1.3.md) | 技术验证：Codex；目标：用户六项；09881217 + b9534f5c3305；接受待用户 |
| WASH-251 | U6 | 列表提供处理进度，区分接收、加工和交出责任。 | WP-13E | washing/order-presentation.ts | 视图/列偏好单测；36 单七组列表专项 | report-2026-10-15T06-05-12.095Z.json 列表分支；实际 1280/1024 页面 | 已验证 | [V1.3 验收](../../verification-evidence/2026-10-15-washing-gtg-v1.3/acceptance-v1.3.md) | 技术验证：Codex；目标：用户六项；09881217 + b9534f5c3305；接受待用户 |
| WASH-252 | U6 | 列表提供加工产出/下游，展示洗后面料及原接收方。 | WP-13E | washing/order-presentation.ts | 视图/列偏好单测；36 单七组列表专项 | report-2026-10-15T06-05-12.095Z.json 列表分支；实际 1280/1024 页面 | 已验证 | [V1.3 验收](../../verification-evidence/2026-10-15-washing-gtg-v1.3/acceptance-v1.3.md) | 技术验证：Codex；目标：用户六项；09881217 + b9534f5c3305；接受待用户 |
| WASH-253 | U6 | 列表提供时间，来自真实创建、接单、交接、投入、产出及完单事实。 | WP-13E | washing/order-presentation.ts | 视图/列偏好单测；36 单七组列表专项 | report-2026-10-15T06-05-12.095Z.json 列表分支；实际 1280/1024 页面 | 已验证 | [V1.3 验收](../../verification-evidence/2026-10-15-washing-gtg-v1.3/acceptance-v1.3.md) | 技术验证：Codex；目标：用户六项；09881217 + b9534f5c3305；接受待用户 |
| WASH-254 | U6 | 列表提供数量，原量、实收、用料、完成、损耗、交出及下游实收单位明确。 | WP-13E | washing/order-presentation.ts | 视图/列偏好单测；36 单七组列表专项 | report-2026-10-15T06-05-12.095Z.json 列表分支；实际 1280/1024 页面 | 已验证 | [V1.3 验收](../../verification-evidence/2026-10-15-washing-gtg-v1.3/acceptance-v1.3.md) | 技术验证：Codex；目标：用户六项；09881217 + b9534f5c3305；接受待用户 |
| WASH-255 | U6 | 详情复用同七组业务信息，执行、卷明细及打印入口仍可用。 | WP-13E | washing/work-orders.ts | 视图/列偏好单测；36 单七组列表专项 | report-2026-10-15T06-05-12.095Z.json 列表分支；实际 1280/1024 页面 | 已验证 | [V1.3 验收](../../verification-evidence/2026-10-15-washing-gtg-v1.3/acceptance-v1.3.md) | 技术验证：Codex；目标：用户六项；09881217 + b9534f5c3305；接受待用户 |
| WASH-256 | U6 | 商品与面料使用对应真实图片，保留加载、失败和大图操作。 | WP-13E | washing/order-presentation.ts；work-orders.ts | 视图/列偏好单测；36 单七组列表专项 | report-2026-10-15T06-05-12.095Z.json 列表分支；实际 1280/1024 页面 | 已验证 | [V1.3 验收](../../verification-evidence/2026-10-15-washing-gtg-v1.3/acceptance-v1.3.md) | 技术验证：Codex；目标：用户六项；09881217 + b9534f5c3305；接受待用户 |
| WASH-257 | U6 | 查询、统计、排序、列设置、冻结和分页与筛选范围一致。 | WP-13E | washing/work-orders.ts | 视图/列偏好单测；36 单七组列表专项 | report-2026-10-15T06-05-12.095Z.json 列表分支；实际 1280/1024 页面 | 已验证 | [V1.3 验收](../../verification-evidence/2026-10-15-washing-gtg-v1.3/acceptance-v1.3.md) | 技术验证：Codex；目标：用户六项；09881217 + b9534f5c3305；接受待用户 |
| WASH-258 | 存储 | 洗水单、判断和操作事实同事务提交，各端从该事实读回标识、日志、去向和实际路线。 | WP-13A/F | fabric-washing-repository.ts；fabric-washing-views.ts | domain-final.log CT-08/09/10；原子中止/冲突/回读 | 事务故障、双标签、刷新与原生回读；适用性能见清单 | 已验证 | [V1.3 验收](../../verification-evidence/2026-10-15-washing-gtg-v1.3/acceptance-v1.3.md) | 技术验证：Codex；目标：用户六项；09881217 + b9534f5c3305；接受待用户 |
| WASH-259 | 存储 | 失败或事务中止不出现半套单据、日志、下游或路线，保留可重试输入。 | WP-13F | fabric-washing-repository.ts；专项 | domain-final.log CT-08/09/10；原子中止/冲突/回读 | 事务故障、双标签、刷新与原生回读；适用性能见清单 | 已验证 | [V1.3 验收](../../verification-evidence/2026-10-15-washing-gtg-v1.3/acceptance-v1.3.md) | 技术验证：Codex；目标：用户六项；09881217 + b9534f5c3305；接受待用户 |
| WASH-260 | 存储 | 多标签冲突和重复提交保持原守卫，普通读取不迁移或覆盖用户数据。 | WP-13F | fabric-washing-repository.ts；专项 | domain-final.log CT-08/09/10；原子中止/冲突/回读 | 事务故障、双标签、刷新与原生回读；适用性能见清单 | 已验证 | [V1.3 验收](../../verification-evidence/2026-10-15-washing-gtg-v1.3/acceptance-v1.3.md) | 技术验证：Codex；目标：用户六项；09881217 + b9534f5c3305；接受待用户 |
| WASH-261 | 直接下游 | GTG PDA 接单、现场交出、染厂实收、加工、交回和原下游实收可完成。 | WP-13F | washing/work-orders.ts；factory-receiving.ts；src/pages/pda-warehouse-shared.ts；src/data/fcs/factory-mobile-warehouse.ts | GTG 两仓与原工厂/中央仓两分支闭环 | direct-report-2026-10-15T06-24-23.206Z.json；主流程 200 样本 | 已验证 | [V1.3 验收](../../verification-evidence/2026-10-15-washing-gtg-v1.3/acceptance-v1.3.md) | 技术验证：Codex；目标：用户六项；09881217 + b9534f5c3305；接受待用户 |
| WASH-262 | 打印 | 加工单、交接单、卷标正确显示 GTG、原下游、手感、图片与数量。 | WP-13F | washing/work-orders.ts / renderWashingPrint | 两原下游打印/卷码专项；纸单直达 | Web/PDA 打印五次分支；washing-transfer-preview-cua.jpg | 已验证 | [V1.3 验收](../../verification-evidence/2026-10-15-washing-gtg-v1.3/acceptance-v1.3.md) | 技术验证：Codex；目标：用户六项；09881217 + b9534f5c3305；接受待用户 |
| WASH-263 | 性能 | 受影响页面与新动作完整响应 <=1000ms，每个适用家族至少五个样本。 | WP-13F | src/data/fcs/production-demand-early-process-work-orders.ts；fabric-washing-views.ts；factory-mobile-warehouse.ts；performance-final.json | 82 家族、461 样本；失败保留并定向修复 | 最大 946.8000000119209ms；未关闭超时 0 | 已验证 | [V1.3 验收](../../verification-evidence/2026-10-15-washing-gtg-v1.3/acceptance-v1.3.md) | 技术验证：Codex；目标：用户六项；09881217 + b9534f5c3305；接受待用户 |
| WASH-264 | 交付 | 直接上下游复核、两轮实质审查、构建和范围内治理通过后交付。 | WP-13F | 专项审查记录与技术收据 | 两轮实质审查、构建与范围治理 | 产品审查记录；技术收据按其实际状态单独登记 | 已验证 | [V1.3 验收](../../verification-evidence/2026-10-15-washing-gtg-v1.3/acceptance-v1.3.md) | 技术验证：Codex；目标：用户六项；09881217 + b9534f5c3305；接受待用户 |
| WASH-265 | 边界 | 助剂配比仍在线下；不新建后端、登录体系或通用状态机。 | WP-13A-F | 本修订全部文件 | 最终完整任务 diff 语义复核 | 不适用额外配方页面：助剂/配比在线下，无此系统入口 | 已验证 | [V1.3 验收](../../verification-evidence/2026-10-15-washing-gtg-v1.3/acceptance-v1.3.md) | 技术验证：Codex；目标：用户六项；09881217 + b9534f5c3305；接受待用户 |
| WASH-266 | 兼容 | 旧业务身份、地址、存储与已保存单据可读，旧列偏好正常归一，不覆盖业务数据。 | WP-13E/F | washing/work-orders.ts；现有仓库 | 旧身份/精确版本/偏好升级单测；旧未派厂原生前后对比 | legacy 分支五次；普通读取不改写 + 明确承接后 GTG | 已验证 | [V1.3 验收](../../verification-evidence/2026-10-15-washing-gtg-v1.3/acceptance-v1.3.md) | 技术验证：Codex；目标：用户六项；09881217 + b9534f5c3305；接受待用户 |

## 变更记录

V1.3：用户六项更正替代原任意染厂派发、角色切换展示及简化列表结构。发起前不预设洗水仍有效；发起后新增本次实际路线，不覆盖技术包历史。旧验收只复用不受新行为影响的分支，受影响断言和页面重新验证。

验证索引：[V1.3 专项结果](../../verification-evidence/2026-10-15-washing-gtg-v1.3/acceptance-v1.3.md)。V1.3 实施阶段当时未提交、未推送、未发布；后续提交和部署以发布回执为准。
