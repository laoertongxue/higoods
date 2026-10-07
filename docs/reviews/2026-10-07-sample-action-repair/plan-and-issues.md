# 样衣管理操作修复：设计、实施计划与问题清单

基线：用户 2026-10-07 要求修复申请并核查修复模块内同类问题；`PCS商品中心重构总体设计文档.md` 第 7 章；当前 main `450ab94193f549d73061247ac8f0881ad62d3aea`。

## 目标与边界

覆盖库存、申请、流转、退货与处理、台账、盘点差异、视图、详情及标签。沿用 Vanilla TS 和按记录 IndexedDB 事务。LOS 提供启用的房间身份，PCS 不另建地点。HG 仍为 SKU 级码。样衣使用申请须真正填写、选择、保存；不以提示代替记录。不建设真实审批后端或 WMS 库存调整。

## 业务场景与规则

同一站点选两条可用已贴码样衣 → 保存草稿（无预占）→ 提交（原子预占）→ 审批通过 → 确认实际领用（位置、占用、流转及台账更新）→ 发起归还 → 仓管确认实际入库（解除占用）。待审批可驳回，待领用前可取消并释放预占；使用中不得直接取消。需要选择启用的使用位置及归还仓库，记录用途、申请人、审批人、领用人、实际签收人和时间。

边界：跨责任站点、未贴码、维修/已结束/在途、其他申请占用、停用位置、无归还时间、重复动作、版本冲突及写入失败均不得产生虚假成功。失败保留输入及原记录。退货/处置新建、审批、执行分别记录，执行危险动作必须确认，完成才改变样衣状态。盘点只记录核查原因与结论，不手工改库存；仍有差异不能冒充已调整。

## 范围登记与工作包

对象为 samples / requests / returnCases / stocktakeDiffs / transfers / ledgerEvents，静态来源 `pcs-sample-management.ts`，用户覆盖经 `higood-pcs-sample-management-v1` → pcs-record-runtime / codec → IndexedDB，共享同一写事务。LOS 位置作为事务 guard。业务动作不写 localStorage。历史只读来源不删除、不自动迁移。本次没有文件上传变化。

- WP1：样衣数据文件：草稿、提交、审批、释放、领用、归还、案件、盘点动作；codec 的独立稳定 ID。验证业务契约、回滚与刷新。
- WP2：样衣页面和路由：列表/独立编辑/详情；真实表单、样衣选择、LOS 位置、明确动作与真实刷新；消除 mock-action。验证每条路由和按钮。
- WP3 `renderPcsSampleApplicationPage` / Mock：Mock 一致性、图片、统计与只读结果保护；复核完整 diff，重放正常与阻断路径。
- WP4：浏览器全流程、IndexedDB 故障与多标签、图片/打印回归及 <=1s 五次原始测量；治理与任务收据。无未验证条目方可宣称完成。

## 原子问题与交付矩阵

确认人：用户（本次需求）；确认版本：2026-10-07。来源均为本次要求、截图、总体设计第 7 章及当前源码；以下证据均在本轮源文件完成后实际执行。浏览器原始记录、源码 SHA256 和环境登记见 [验证报告](verification.md) 及 [manifest](evidence/manifest.json)。

| ID | 问题与预期结果 | 工作包 / 实现位置 | 自动化 | 页面证据 | 状态 |
| --- | --- | --- | --- | --- | --- |
| SAMPLE-FIX-01 | 新建申请没有输入与选择；改为独立可编辑页面 | WP1/2 `pcs-sample-management.ts` / `pcs-sample-workflows.ts` / routes-pcs、route-renderers | 业务契约 | 新建/编辑 | 已验证 |
| SAMPLE-FIX-02 | 保存仅提示成功；真正按记录保存并刷新可读 | WP1 `pcs-sample-management.ts` / runtime / `pcs-record-codec.ts` | 保存/回滚/去重 | 保存/刷新/失败 | 已验证 |
| SAMPLE-FIX-03 | 样衣清单仅取前5条且跨站点；搜索选择、同站点校验 | WP1/2 数据动作及页面控件 | 资格边界 | 样衣选择 | 已验证 |
| SAMPLE-FIX-04 | 使用位置未引用LOS；选择启用房间且事务校验停用/版本 | WP1/2 `liveRoomTransferGuards` / `handleSampleWorkflowAction` | 位置门禁 | 房间选择 | 已验证 |
| SAMPLE-FIX-05 | 推进流程仅提示；明确提交/审批/取消/领用/归还并同步占用台账 | WP1/2 数据动作及页面控件 | 全流程/拒绝/重复 | 详情动作 | 已验证 |
| SAMPLE-FIX-06 | 刷新只提示；重新读取持久记录并报告读取失败 | WP2 `handlePcsSampleManagementEvent` | 入口检查 | 多标签/刷新 | 已验证 |
| SAMPLE-FIX-07 | 模拟库存按钮无含义；替换为真实详情/签收入口，阻断占用绕行 | WP1/2 数据动作及页面控件 | 流转阻断 | 库存详情/流转 | 已验证 |
| SAMPLE-FIX-08 | 新建/执行退货案件只有提示；可录入、审核、执行并原子记录 | WP1/2 数据动作及页面控件 | 案件流程/危险确认 | 退货与处理 | 已验证 |
| SAMPLE-FIX-09 | 盘点差异只有只读展示；记录核查原因、处理结论和关闭，不伪造调账 | WP1/2 数据动作及页面控件 | 核查/关闭条件 | 盘点差异 | 已验证 |
| SAMPLE-FIX-10 | 申请超期卡片写死、Mock申请与样衣占用不一致、新建申请误显示历史来源 | WP3 `renderPcsSampleApplicationPage` / Mock | 统计/Mock一致性 | 卡片/清单 | 已验证 |
| SAMPLE-FIX-11 | 列表返回浅拷贝可外部修改，按自身单据ID保存避免关联ID冲突 | WP1/3 codec / 深拷贝查询 | 深拷贝/稳定ID | 刷新关联 | 已验证 |
| SAMPLE-FIX-12 | 详情/弹窗反馈、读取失败保留已选样衣与输入、离开提示、图片与HG识别、性能必须可验证 | WP2/4 新页面 / 图片 / 离开保护 | 错误/入口检查 | 图片/全路由/性能 | 已验证 |
| SAMPLE-FIX-13 | 申请、流转、退货、台账、盘点和样衣视图缺少重置入口；补齐按钮，并确保库存等每页仅一个重置入口 | WP2 `renderPcsSample*Page` / `resetFilters` | 入口检查 | 七页搜索/筛选/重置五轮 | 已验证 |

## 证据联查与正反向审查

| ID | 实现文件 / 核心入口 | 自动化及页面证据 |
| --- | --- | --- |
| 01、03 | workflows：renderPcsSampleApplicationEditPage、pickList、handleSampleWorkflowInput；routes-pcs / route-renderers | unit.log；browser-1～5.json 的 draft 字段、Tab、查询、分页、选择/取消选择；editor-1.png、editor-min-1.png |
| 02、05 | data：savePcsSampleRequestDraft、actPcsSampleRequest；workflows：handleSampleWorkflowAction | unit.log；browser-1～5.json 的草稿/故障/提交/审批/领用/归还/入库/驳回/取消/多标签；completed-1.png；wp05-1～5.json 的事务中途失败 |
| 04 | workflows 的 LOS guards / requireSampleLocation | browser-1～5.json：停用房间阻断审批，仍能取消并释放；启用房间选择 |
| 06 | 主页面 reload / workflows reload-workflow | browser-1～5.json：七页真实刷新；boundaries-1～5.json：读取失败、页面恢复及读回内容一致 |
| 07 | data：transferPcsSample；主页面详情/流转入口 | unit.log 占用绕行阻断；wp05-1～5.json 实际流转/错误目标/缺原因/重复签收；browser-1～5.json 库存抽屉 |
| 08 | data：createPcsSampleReturnCase、actPcsSampleReturnCase；workflows 案件弹窗 | browser-1～5.json：退货新建/审批/执行；boundaries-1～5.json：处置驳回/执行及刷新终态；unit.log 重复执行阻断 |
| 09 | data：resolvePcsSampleStocktake；主页面差异抽屉及 controls | browser-1～5.json：核查/关闭/刷新；unit.log：不能跳过核查，样衣库存原值不变 |
| 10 | 主页面超期统计、sampleSourceText；固定申请 Mock | unit.log、browser-1～5.json 资格及申请详情；新建申请展示实际用途 |
| 11 | codec：pcsRecordIdentity；data：mergeSampleRows、深拷贝查询 | unit.log 自身ID/外部修改无污染；browser-1～5.json 刷新关联一致；record-db.log 原子性、版本与重试 |
| 12 | workflows 未保存/历史导航保护、sampleWorkflowImage；主页面图片失败态；HG 页面保持既有契约 | browser、boundaries 五轮；hg-label.log、hg-label.json、hg-legacy.json；hg-performance.json 五次打印生成；sample-label-55x35.pdf |
| 13 | 七个列表/视图的 reset-filters | browser-1～5.json：每页搜索/筛选/重置 |

上述证据文件均位于 evidence/。产品确认人：用户，本次任务确认版本：2026-10-07；实现和证据审查人：本轮主代理。已验证指当前本地原型的结果，不等于远端部署或新的产品接受回执。

正向：总体设计 §7.6 的每项规则映射到 01～13；反向：本轮菜单/路由/页面按钮、Mock、保存入口、测试均回到这些编号，无新维护工具、真实后端或 WMS 调账。审查已排除占用绕行、陈旧标签覆盖、重复执行、假保存、假刷新及只隐藏旧按钮的风险。
