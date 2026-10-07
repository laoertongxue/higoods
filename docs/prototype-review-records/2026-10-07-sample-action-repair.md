# 样衣申请及同类操作修复审查记录

## 1. 基本信息

- 日期：2026-10-07；任务：SAMPLE-FIX-01～13。
- 模式：完整产品审查；系统：PCS 样衣管理，引用 LOS 房间资料。
- 角色：申请人、审批人、样衣仓管；端：管理端 Web。
- 基线 HEAD：450ab94193f549d73061247ac8f0881ad62d3aea；分支：codex/sample-action-repair；工作树：/Users/laoer/Documents/higoods。
- 本轮详细需求、实施包及逐项证据：[问题与交付矩阵](../reviews/2026-10-07-sample-action-repair/plan-and-issues.md)。

## 2. 影响判定

- 用户可见影响：有
- 判定依据：原先新建申请只有说明和固定前五条清单、保存与推进仅提示；改为列表、独立编辑及详情，通过真实字段和动作保存。同期收口案件、盘点、刷新、筛选、占用与统计，不改 LOS 地点维护、HG 规则或全局菜单。
- 原型仍为单浏览器 IndexedDB Mock，不接入真实审批系统或 WMS。
- 基线：AGENTS.md 第 4、5、7 节及用户本次明确要求。

## 3. 自查结论

| 项目 | 结论 | 直接证据 |
| --- | --- | --- |
| 角色与页面层次 | 通过 | 申请列表→独立编辑（申请信息/样衣清单）→详情，实际角色与记录可追溯 |
| 文案、状态、统计 | 通过 | 超期按使用中/归还中计算；草稿不预占；新申请不再冒充历史来源 |
| 图片与HG识别 | 通过 | 原有实拍图同对象；SKU级HG；缩略图、大图、失败态与重载 |
| 防错及危险确认 | 通过 | 同站点、已贴码、可用、不重复；停用房间阻断；取消/驳回/执行/关闭确认 |
| 协作和追溯 | 通过 | 提交预占→实际领用→归还→验收入库，申请/样衣/流转/台账同事务 |
| 低分辨率与恢复 | 通过 | 1366×768、1280×720；保存/读取故障保留输入和已选样衣；多标签拒绝覆盖，重新读取 |
| 路由、交互、打印及性能 | 通过 | 命名路由冷启动/刷新/SPA五轮；现有标签打印回归 |

PDA 不适用：本轮没有新增或改变 PDA 页面。附件上传、数据库迁移不适用：本轮不触及这些入口或格式。

## 4. 问题标签

已处理：选不对、点错风险、协作断裂、追溯不足、状态抽象。详细问题逐项对应 SAMPLE-FIX-01～13，不另用笼统“模块完成”替代。

## 5. 主要问题与处理

申请虚假保存、固定清单、没有使用位置和实际流程；库存绕行；退货按钮仅提示；盘点只有展示；刷新未真正读回；Mock占用与统计不一致；单据存储ID和浅拷贝；未保存保护、图片故障态；六个列表/视图缺少筛选重置，库存重置不得重复。处理方式和直接证据见逐项矩阵。

主代理最终完整 diff 对抗式审查：检查未贴码/跨站点/占用绕行、审批前后取消、重复执行、房间停用、保存中途失败与陈旧标签覆盖、历史返回结果与新动作时序、危险确认、字符串转义，以及反向追踪页面按钮对应实际业务动作。自动化、页面及五次性能证据收齐后审查通过。

## 6. 最终结论

结论：通过。本轮业务原型验收通过；最终工程检查以任务收据为准。

本次交付结论须与 [验证报告](../reviews/2026-10-07-sample-action-repair/verification.md) 的最终结果一致。先前失败尝试保留，不能作为本版本通过证据；构建通过不替代全流程、故障和性能验收。

## 7. 变更覆盖与验证

### 受管文件

- `src/data/pcs-sample-management.ts`
- `src/data/pcs-record-codec.ts`
- `src/pages/pcs-sample-management.ts`
- `src/pages/pcs-sample-workflows.ts`
- `src/router/routes-pcs.ts`
- `src/router/route-renderers.ts`

### 命名路由

/pcs/samples/inventory、/application、/application/new、/application/req-004/edit、/application/req-001、/transfer、/return、/ledger、/ledger/stocktake、/view、/detail/smp-001、/label/smp-001（除首项外均以 /pcs/samples 为前缀）。新建记录详情/编辑直达与刷新亦实测。

### 验证命令

申请/边界/既有全流程各五轮、HG打印、IndexedDB、7个相关单元测试及渐进TypeScript检查：通过，实际命令和输出见验证报告。工程治理与构建由最终workflow:verify收据记录。

- `node --import tsx --test tests/browser-contracts/pcs-sample-actions.test.ts`：通过
- `node --import tsx --test tests/browser-contracts/pcs-sample-action-boundaries.test.ts`：通过
- `node --import tsx --test tests/browser-contracts/pcs-sample-wp05.test.ts`：通过
- `node --import tsx --test tests/browser-contracts/pcs-sample-hg-label.test.ts`：通过
- `npm run build`：通过（首次workflow实际执行，589个单元测试全部通过）统一性能门禁：1550个样本全部<=1000ms，最大410.39999997615814ms，无例外。

### 真实图片验证

复用静态样衣 Mock 对应的原有服装实拍资源，不以文字编号或生成图替代；编辑已选样衣、详情与清单展示对应缩略图；可打开大图。断网图片注入验证明确“图片加载失败”，恢复后重新读取图片。HG、首次登记日期和打印内容由既有标签合同回归确认。

### 例外

- 无。性能时限 <=1000ms，不设例外；PCS 无本地资料维护工具。
