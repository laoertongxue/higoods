# 印花操作栏发起洗水与名称统一 V1.2

日期：2026-10-15。阶段：已验证（Codex 技术验证，用户产品接受另行记录）。基线：50ab50c61f95f158771ef56cc5c383ed50ed5505。继承 V1.1 的实际完成后现场触摸、按手感建单、染厂执行、助剂配比线下及不预设工艺路线等规则。本修订仅覆盖本会话新增的两项要求，原 205 条编号及历史证据保留原身份。

## 业务需求与范围

1. 符合条件的印花加工单在列表操作栏直接显示“发起洗水”。点击后在当前列表弹窗中选择已完成的面料卷和目标手感，提交后创建洗水加工单；不要求先进入长详情查找入口。
2. 入口依据已完成批次及实物卷，而非整单状态。面料实际完成、数量已确认且为正、未交出、未被已有判断占用、未处于交出草稿冲突，且原单没有暂停或取消限制时，才能发起。整单仍加工中但已有完成批次时，允许该批次发起；非面料和仅纸张打印完成不显示入口。
3. 弹窗复用现场触摸判断与原子建单；打开、关闭或取消均不新增判断。未选手感、重复建单、角色/工厂不符仍由原业务校验阻断。保存失败保留输入；成功后可查看对应洗水单，关闭后局部更新原行入口。
4. 名称属于显示更名。现行技术包工艺名称、加工单、菜单、Web/PDA、打印及直接接收/仓储的固定名称统一为“洗水”。WASH/craft-wash、编号、地址、存储键、对象关系不变，存量单据可继续读取。历史日志、用户自由文本、物料本名和“水洗标”等不同对象不批量改写。
5. 技术包中的名称统一不改变边界：洗水仍由实际印花完成后的现场判断产生，不恢复静态洗水节点或初始拆解自动建单。
   实页复核发现存量可编辑草稿仍带固定洗水节点，纳入本条修复：只读展示时从草稿路线中移除该节点并桥接前置关系，显式保存时才写入调整后的草稿；不改写已发布历史路线、物料加工链及原 SKU 身份。
6. 本修订先在本地实现与验证；提交、合并与再次发布须按用户后续要求记录，不继承上一次已完成发布的状态。

## 实施计划

| 工作包 | 修改对象 | 修改及完成条件 | 验证 |
| --- | --- | --- | --- |
| WP-12A | fabric-washing-model.ts、fabric-washing.ts | 提供复用原校验的可发起卷判定，不引入第二套保存事实 | 正常、部分批次、无实物、非面料、数量、重复、交出/草稿/暂停边界 |
| WP-12B | printing/work-orders.ts、dialogs.ts、events.ts；washing/work-orders.ts | 行操作打开现有弹窗，复用判断与建单，关闭/保存局部更新及焦点恢复 | 操作栏到建单/回读；取消、Esc、图片、失败输入、重复与角色边界 |
| WP-12C | 洗水现行功能固定文案及工艺名称字典 | 统一显示名，保留业务身份与历史事实 | 技术包、菜单、加工单、PDA、直接上下游和打印；旧身份回读 |
| WP-12D | 既有单元/专项验证及本修订记录 | 更新受影响断言，保留原失败，补充当前证据 | 受影响契约、列表门禁、构建、持久回读、页面及完整响应性能 |

## 增量原子需求矩阵

以下实际实现与证据对应本修订的本地技术验证。确认人：用户确认目标，Codex 技术验证；产品接受另行记录。

| 编号 | 来源 | 原子需求 | 工作包 | 实际文件/符号 | 自动化验证 | 页面/PDA/打印/性能证据 | 状态 | 证据位置 | 确认人/版本 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| WASH-206 | 本修订1 | 可发起印花行显示发起洗水入口 | WP-12A/B | printing/work-orders.ts:renderActions；fabric-washing.ts:washingInitiationOrderIds | 入口批量/实时判定一致；entry 五轮 | 六类 A 行显示，六类 B 隐藏 | 已验证 | docs/verification-evidence/2026-10-15-washing-entry-v1.2/；V1.2 审查记录 | 用户目标确认 / Codex 技术验证；50ab50c+manifest.sourceDigest |
| WASH-207 | 本修订1 | 点击操作栏在当前列表弹窗中发起 | WP-12B | printing/events.ts:initiate-washing；printing/dialogs.ts:renderPrintingDialog | entry row-open | 在当前列表弹窗选卷和手感 | 已验证 | docs/verification-evidence/2026-10-15-washing-entry-v1.2/；V1.2 审查记录 | 用户目标确认 / Codex 技术验证；50ab50c+manifest.sourceDigest |
| WASH-208 | 本修订2 | 整单加工中但有完成批次可按该批发起 | WP-12A | fabric-washing.ts:washingInitiationOrderIds/buildWashingSources | row-guards WASH-208 | 按完成批次允许加工中整单 | 已验证 | docs/verification-evidence/2026-10-15-washing-entry-v1.2/；V1.2 审查记录 | 用户目标确认 / Codex 技术验证；50ab50c+manifest.sourceDigest |
| WASH-209 | 本修订2 | 非面料或无完成实物批次不显示入口 | WP-12A | fabric-washing-model.ts:washingInitiationRolls | fabric-washing.test.ts；row-guards | 非面料与无实际批次无入口 | 已验证 | docs/verification-evidence/2026-10-15-washing-entry-v1.2/；V1.2 审查记录 | 用户目标确认 / Codex 技术验证；50ab50c+manifest.sourceDigest |
| WASH-210 | 本修订2 | 未确认/非正数量/已交出的卷不可发起 | WP-12A | fabric-washing-model.ts:washingInitiationRolls | fabric-washing.test.ts WASH-210 | 无效数量、已交出、未确认卷排除 | 已验证 | docs/verification-evidence/2026-10-15-washing-entry-v1.2/；V1.2 审查记录 | 用户目标确认 / Codex 技术验证；50ab50c+manifest.sourceDigest |
| WASH-211 | 本修订2 | 已有判断占用的卷不重复发起 | WP-12A/B | fabric-washing-model.ts:washingInitiationRolls；washing/work-orders.ts | unit WASH-211；entry 持久刷新 | 已判断卷禁选，全部判断后行入口隐藏 | 已验证 | docs/verification-evidence/2026-10-15-washing-entry-v1.2/；V1.2 审查记录 | 用户目标确认 / Codex 技术验证；50ab50c+manifest.sourceDigest |
| WASH-212 | 本修订2 | 暂停/取消及冲突交出草稿维持阻断 | WP-12A/B | fabric-washing.ts:buildWashingSources；fabric-washing-model.ts | row-guards；unit WASH-212；既有草稿冲突集成 | 暂停/取消和交出草稿阻断 | 已验证 | docs/verification-evidence/2026-10-15-washing-entry-v1.2/；V1.2 审查记录 | 用户目标确认 / Codex 技术验证；50ab50c+manifest.sourceDigest |
| WASH-213 | 本修订3 | 打开/取消/关闭弹窗不写入判断或加工单 | WP-12B | printing/dialogs.ts:closePrintingDialog | entry close-without-save / escape-without-save | 打开关闭无判断、主单或日志 | 已验证 | docs/verification-evidence/2026-10-15-washing-entry-v1.2/；V1.2 审查记录 | 用户目标确认 / Codex 技术验证；50ab50c+manifest.sourceDigest |
| WASH-214 | 本修订3 | 未选手感保存失败且可继续填写 | WP-12B | washing/work-orders.ts:handleFabricWashingEvent/save | entry reject-missing-handfeel / save-quota-failure | 缺手感阻断，保存失败手感保留 | 已验证 | docs/verification-evidence/2026-10-15-washing-entry-v1.2/；V1.2 审查记录 | 用户目标确认 / Codex 技术验证；50ab50c+manifest.sourceDigest |
| WASH-215 | 本修订3 | 成功保存判断与主单可持久回读且可查看 | WP-12B | washing/work-orders.ts:save；fabric-washing-repository.ts:executeWashingCommand | entry create-and-durable-read / view-created-order；14 项集成 | 判断、主单和日志完成事务后回读；链接直达 | 已验证 | docs/verification-evidence/2026-10-15-washing-entry-v1.2/；V1.2 审查记录 | 用户目标确认 / Codex 技术验证；50ab50c+manifest.sourceDigest |
| WASH-216 | 本修订3 | 关闭后局部更新入口及恢复焦点 | WP-12B | printing/work-orders.ts:refreshPrintingWashingActions；printing/dialogs.ts | entry pending-save-close-guard-local-refresh-and-image | 查询和表格节点保持，关闭后行入口及焦点正确 | 已验证 | docs/verification-evidence/2026-10-15-washing-entry-v1.2/；V1.2 审查记录 | 用户目标确认 / Codex 技术验证；50ab50c+manifest.sourceDigest |
| WASH-217 | 本修订3 | 保存中不能关闭丢失可恢复输入 | WP-12B | printing/dialogs.ts:closePrintingDialog；washing/work-orders.ts:isWashingSavePending | pending-final：原生事务挂起；两个家族各五次 | 保存中关闭/Esc 均保留弹窗和输入 | 已验证 | docs/verification-evidence/2026-10-15-washing-entry-v1.2/；V1.2 审查记录 | 用户目标确认 / Codex 技术验证；50ab50c+manifest.sourceDigest |
| WASH-218 | 本修订3 | 原角色及工厂范围校验继续有效 | WP-12A/B | fabric-washing-model.ts:actorRole/JUDGE；washing/work-orders.ts:actor | unit WASH-218；entry 错误职责 | 错误职责和工厂均阻断，无写入 | 已验证 | docs/verification-evidence/2026-10-15-washing-entry-v1.2/；V1.2 审查记录 | 用户目标确认 / Codex 技术验证；50ab50c+manifest.sourceDigest |
| WASH-219 | 本修订4 | 技术包工艺名称统一显示洗水 | WP-12C | pcs-material-variant-types.ts；pcs-material-variant-fcs-dict.ts；fcs/tech-packs.ts:resolveProcessEntryDictionaryFields | route-codec WASH-219；draft-route 五轮 | 现行名称洗水；历史正式标签显示洗水，原文本/身份不改 | 已验证 | docs/verification-evidence/2026-10-15-washing-entry-v1.2/；V1.2 审查记录 | 用户目标确认 / Codex 技术验证；50ab50c+manifest.sourceDigest |
| WASH-220 | 本修订4 | 菜单及 Web/PDA 固定功能名称统一洗水 | WP-12C | app-shell-config.ts；washing/work-orders.ts；washing/storage-tools.ts | 14 项集成 PDA 390×844；IAB 实页 | 菜单、Web、PDA 固定功能名称一致 | 已验证 | docs/verification-evidence/2026-10-15-washing-entry-v1.2/；V1.2 审查记录 | 用户目标确认 / Codex 技术验证；50ab50c+manifest.sourceDigest |
| WASH-221 | 本修订4 | 打印及直接接收/仓储固定名称统一洗水 | WP-12C | washing/work-orders.ts:renderWashingPrint；factory-receiving*.ts；dyeing/warehouse.ts；wls/raw/washing-stock.ts | 14 项集成打印；10 项边界仓储和深链 | 洗水单和卷标真图/手感及接收库存标签正确 | 已验证 | docs/verification-evidence/2026-10-15-washing-entry-v1.2/；V1.2 审查记录 | 用户目标确认 / Codex 技术验证；50ab50c+manifest.sourceDigest |
| WASH-222 | 本修订4 | 原业务编号/路由/存储身份及历史事实保持 | WP-12C | production-timing/source.ts:timingDocumentHref；fcs/tech-packs.ts；上述显示文案 | route-codec / timing 单元；历史深链；19 文件仅文字 diff | 原编码、编号、地址、存储键和历史自由文本不变 | 已验证 | docs/verification-evidence/2026-10-15-washing-entry-v1.2/；V1.2 审查记录 | 用户目标确认 / Codex 技术验证；50ab50c+manifest.sourceDigest |
| WASH-223 | 本修订5 | 更名不恢复技术包静态节点与初始自动建单 | WP-12C | tech-pack/context.ts:applyTechPackState；tech-pack-process-route.ts:removePredeterminedWashing | route-codec；draft-route 草稿/已发布/锁定三类反向夹具五轮 | 可编辑草稿退出固定洗水并桥接；原源逐字不改；历史保持；初始拆解不自动建单 | 已验证 | docs/verification-evidence/2026-10-15-washing-entry-v1.2/；V1.2 审查记录 | 用户目标确认 / Codex 技术验证；50ab50c+manifest.sourceDigest |
| WASH-224 | 本修订1/3 | 命名设备可操作且弹窗/列表无主体溢出 | WP-12B/D | printing/dialogs.ts:dialogShell；printing/work-orders.ts | entry 五轮 1366×768、1280×720、1024×768；相邻备注弹窗 | 无主体横向溢出；大图/Esc、焦点与相邻弹窗正常 | 已验证 | docs/verification-evidence/2026-10-15-washing-entry-v1.2/；V1.2 审查记录 | 用户目标确认 / Codex 技术验证；50ab50c+manifest.sourceDigest |
| WASH-225 | 本修订实施 | 新入口适用操作完整响应不超过1秒 | WP-12D | scripts/check-printing-washing-entry.mjs；scripts/check-washing-draft-route.mjs | performance-summary.json | 77 样本、13 家族各至少五次，最大 894.30ms；历史失败保留 | 已验证 | docs/verification-evidence/2026-10-15-washing-entry-v1.2/；V1.2 审查记录 | 用户目标确认 / Codex 技术验证；50ab50c+manifest.sourceDigest |

## 证据与复用边界

运行源码、断言、构建资源变化所影响的分支需重新验证。未变化的保存模型与上下游契约保留原版本身份；原 205 条验收、原性能样本和已发布 SHA 不自动改标为 V1.2 的证据。原审查和原始失败不覆盖。

## 直接上下游复核结果

- 印花实际产出和现场判断：原批次、实物卷、单位、数量、接收方和来源类型沿用；打开弹窗不产生判断，点击和保存重新核对来源。可编辑草稿退出预定洗水不改变已打印面料的实际完成事实。
- 技术包与生产单：草稿只做当前读取投影，显式保存才沿用原保存事务写入；移除洗水时桥接前置关系；已发布及审核锁定路线留作历史。生产初始拆解继续过滤洗水，不补建裁剪/车缝任务；实际追加洗水仍由关联视图读取。
- 染厂执行与仓储：派厂、接单、印花交出、染厂逐卷实收、投入、产出、交回和下游实收复用原事实；真实实收后才有相应库存，原卷和新卷码关联保持；没有新增助剂、配方或比例字段。
- Web/PDA/打印及维护：固定名称改为洗水；当前列表入口新增，原详情判断/纠正入口保留。原编号、路由、持久键、备份格式/文件引用和历史事件身份不变。历史“水洗”深链可读，水洗标、公司名称等不同对象不批量替换。

正式证据：`docs/verification-evidence/2026-10-15-washing-entry-v1.2/manifest.json` 和 `performance-summary.json`；审查：`docs/prototype-review-records/2026-10-15-printing-washing-entry-v1.2.md`。最终技术收据位置：`output/printing-washing-entry-v1.2/task-receipt.json`。
