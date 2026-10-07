# DDS 任务详情业务修订第一版审查记录

## 1. 基本信息

| 项目 | 内容 |
| --- | --- |
| 记录日期 | 2026-10-07 |
| 相关需求 / 任务 | 本次任务详情业务核查及用户要求先修复一版看效果；原子需求见 business-review-v1.md |
| 记录模式 | 完整产品审查 |
| 涉及系统 | DDS；读取 FCS / PCS / PMS 既有原型来源 |
| 涉及页面路径 | /dds/supply-chain/production-fulfillment/tasks/DEM-202603-0001 |
| 端类型 | 管理端 |
| 主要角色与任务 | 跟单、计划和管理人员识别当前事实、优先核实事项及后续跟进 |
| 工作树 / 分支 | /Users/laoer/.codex/worktrees/d29f/higoods；codex/dds-task-business-review |
| 基础 HEAD | ff05cc5f7790e5bd70b587cd3b4f5361875303be；第一版基于此提交；浏览器报告另记源码 SHA-256，最终发布提交由发布回执核对 |
| 本地运行 | http://127.0.0.1:4179；Vite preview 读取本工作树最新构建，监听 0.0.0.0 |

## 2. 影响判定

- 用户可见影响：有
- 判定依据：默认业务概览、首屏字段与口径、未知执行状态、分支对象识别、阶段范围、来源新鲜度、跟进记录及保存失败提示均发生变化。保留路由、29 项工作和来源依赖关系；未增加真实后端或外部消息。
- 当前基线：AGENTS.md 第 4、5、7 节；未读取两份历史长文档，当前基线足以判断。

## 3. 自查结论

| 检查项 | 结论 | 说明 |
| --- | --- | --- |
| 角色、任务与页面模式 | 通过 | 默认先读业务概览，再看完整工艺网络；优先核实事项显示协调人与来源团队。 |
| 文案、状态、数量与单位 | 通过 | 需求下达计时、需求要求交期、管理时效和实际发货分开；未知执行进度不推定等待前置。已确认阻断仍保留。 |
| 扫码、真实图片与对象识别 | 不通过 | SPU-2024-001 无对应实图；部分技术路线对象资料缺失。保留缺口说明及可辨认分支，不造图片、物料或批次。管理端任务概览不适用扫码。 |
| 防错、危险确认与主管兜底 | 通过 | 跟进必填、未来预计时间、重复提交、事务中止、预计版本冲突及显式迁移确认纳入隔离浏览器检查。 |
| 交接、跨端事实与异常追溯 | 不适用 | 本次没有执行交接动作、PDA 改造或真实业务确认；来源关系继续读取现有共享事实。 |
| 低分辨率、PDA、弱网与上传恢复 | 通过 | 实际管理端 1366×768、1280×720；无新增上传或 PDA 流程。存储失败输入保留另行验证。 |
| 命名路由、交互、图片大图与打印 | 不通过 | 浏览器检查及摘要预览见第 7 节；真实图片和对应大图因素材缺失阻塞。 |

## 4. 问题标签

- 状态抽象
- 协作断裂
- 追溯不足
- 视觉干扰

## 5. 主要问题与处理

| 问题 | 标签 | 影响角色 | 处理方式 | 是否仍有风险 |
| --- | --- | --- | --- | --- |
| 无执行记录却显示等待前置 | 状态抽象 | 跟单、计划 | 区分执行未知、前置未知、已确认等待和已确认阻断 | 来源执行事实仍待核实 |
| 时间和数量口径混合 | 读不懂 | 跟单、管理 | 保留 2026-04-15 需求要求交期；220 多天说明从需求下达计起；1,500 件说明为有效生产需求 | 不能由此计算真实生产超期或发货达成 |
| 全链路图首屏识别成本高 | 视觉干扰 | 管理 | 默认概览；完整图保留，增大卡片和字体，工艺分支分别识别 | 物料对象详情缺失仍需来源补充 |
| 缺口与跟进行为分散 | 协作断裂 | 跟单 | 优先事项提供核对来源与登记跟进；最近跟进和执行更新另列 | 跟进登记不替代来源执行事实 |
| 未关联阶段被省略 | 追溯不足 | 计划 | 九阶段概览；未读取阶段显示工作范围待确认 | S08 适用工作仍待确认 |
| 跟进与预计恢复不稳定 | 追溯不足 | 跟单 | IndexedDB 单条、原子保存；预测事件按历史顺序恢复；幂等与版本核对；显式迁移读回后只清理两个自有旧键 | 其他 DDS 配置、来源关联、事项账旧存储未在本次迁移 |

## 6. 最终结论

结论：不通过

说明：本版最初为供用户看效果的本地修订。用户于 2026-10-07 在已说明资料与验收缺口后明确要求“本地合并进 main，并推送至github main”，据此发布当前第一版。实图及完整性能覆盖门禁未满足，继续保留待补状态；合并、推送和部署成功不等于全部业务验收通过或产品 accepted。最终发布 SHA 与 Production 状态以发布回执为准。

## 7. 变更覆盖与验证

### 受管文件

- `src/pages/production-fulfillment/calculations.ts`
- `src/pages/production-fulfillment/common.ts`
- `src/pages/production-fulfillment/dependency-graph.ts`
- `src/pages/production-fulfillment/followup-storage.ts`
- `src/pages/production-fulfillment/index.ts`
- `src/pages/production-fulfillment/model.ts`
- `src/pages/production-fulfillment/source-tasks.ts`
- `src/pages/production-fulfillment/source-views.css`
- `src/pages/production-fulfillment/task-detail.ts`
- `src/pages/production-fulfillment/task-overview.ts`
- `src/pages/production-fulfillment/timeline.ts`
- `src/pages/production-fulfillment/work-labels.ts`

### 页面路由

- `/dds/supply-chain/production-fulfillment/tasks/DEM-202603-0001`：主验收路由。
- `/dds/supply-chain/production-fulfillment/tasks`：返回及站内进入相邻路径。
- 本次没有修改菜单、路由总入口、公共组件或数据库业务记录。

### 验证命令

- `node --import tsx --test tests/unit/production-fulfillment*.test.ts`：通过，133 项；原始输出 output/playwright/dds-review-v1/unit-tests.log。
- `node scripts/check-typescript-scope.mjs src/pages/production-fulfillment/`：通过，范围内 0 错误；全量另有 3 项既有范围外错误，见 typecheck.log。
- `npx vite build --logLevel error`：通过，构建本工作树实际预览资源。
- `node scripts/check-dds-task-business-review.mjs`：通过，432 个样本、35 项事实断言，报告 pass=true；最慢 223.89999999990687ms。每项重复五次，冷浏览器缓存、刷新、站内切换、业务概览/依赖/甘特/弹窗/跟进/预计/打印预览，以及存储失败、迁移中断重试、跨标签页冲突。完整原始样本和源码哈希保存为 output/playwright/dds-review-v1/verification.json。
- `git diff --check`：通过。
- `node --import tsx scripts/check-prototype-design-governance.ts --all`：通过，覆盖本工作树全部本次差异，12 个用户可见受管文件、1 份记录。默认 staged 命令未覆盖未暂存改动，因此使用 --all；当前工作树没有其他任务差异。
- `codegraph sync` 与 `codegraph status`：通过，已同步，无待同步文件，2,579 个索引文件。
- `npm run workflow:verify -- --output output/playwright/dds-review-v1/task-receipt.json --task-boundary "DDS任务详情业务修订第一版"`：失败（首轮：审查记录中的此命令缺少明确结果），项目完整构建通过；格式修正后本次发布前重新执行，以 task-receipt.json 和 release-verification.log 的最终状态为准。技术收据不替代素材与完整性能门禁。

### 页面加载与交互性能

命名脚本测量范围通过：432 个样本，冷加载最大 223.89999999990687ms，全部原始样本 <=1000ms。统一限制为每次 <=1000ms，不用平均值代替。计时从导航起点或浏览器事件时间戳到预期内容、读取结果和两次动画帧就绪。保存必须读回；只出现加载状态不算就绪。报告记录实际 Chromium 版本、设备尺寸、分支、HEAD、工作树及源码哈希。

本轮范围没有完成所有既有来源关联保存入口、全部表格配置入口和跨模块来源页面的性能覆盖；PERF-001 不标记已验证。缺少对应实图也不能以当前无图片的首屏测量代替图片加载验收。此前失败样本（包含事务失败提示未中文化、全局数据库不可用及迁移故障注入引用在刷新后失效等）保留在 verification-before-abort-message-fix.json、verification-before-unavailable-fix.json、verification-migration-interrupted-before-fix.json。

### 真实图片验证

- 对象：SPU-2024-001，来源生产需求所关联正式技术包。
- 来源没有对应实图；首页明确“对应实图待补”，不使用其他款式替代。
- 同列名称与款号可读；对象图与对应大图未通过，待提供素材。
- 加工分支部分仅有对象类别，没有物料 SKU / 图片明细，标为对象明细待核实。

### 浏览器存储范围登记

| 业务对象 | 固定来源 / 对象仓库 | 读写入口与关联 | 旧存储项 | 验收 |
| --- | --- | --- | --- | --- |
| 本地跟进 | higood-dds-followups / followups | 概览、跟进 Tab、任务/工作弹窗；saveFollowup 按记录保存 | dds-pf-followups-v1 | 保存、刷新、幂等、事务中止、旧资料迁移 |
| 负责人预计 | 同一库 / forecasts + forecast-events | 原子更新当前版本并追加事件，与对应跟进同事务；按事件顺序恢复预测 | dds-pf-forecasts-v1 | 读回、刷新、冲突、迁移事件顺序 |
| 本次界面偏好 | localStorage，有界列偏好键 dds-pf-columns-v1:* | 复用现有列表偏好；不可用使用默认值 | 同左 | 禁用 / 配额失败仍可登记跟进 |
| 生产需求、技术包、执行事实 | 既有静态与共享原型来源 | 本次只读取；未写业务记录 | 不改造来源模块 | 来源契约及首屏事实 |

普通读取不导入旧资料，不写跟进或预计演示种子；旧键存在时显式提示迁移。迁移按最多 100 条一批，验证结构、冲突、读回内容及旧字节未变化后删除两个自有旧键；其他键保留。无附件新增，因此 Blob、附件复制/删除及导出备份不适用本动作。

### 例外

- 无图片规则豁免；素材门禁继续阻塞正式交付。
- 全局禁用 IndexedDB 的隔离检查触发现有跨模块 PCS 生产上下文加载失败和 PMS 读取失败提示，未进入任务详情。原始截图为 indexeddb-disabled.png。本版独立验证 DDS 跟进数据库读取失败的错误态；全局来源加载限制单独登记。
- 页面为本浏览器原型；未保存输入不承诺刷新恢复，已保存记录不会自动跨设备共享。
- 未操作测试站数据库、真实工厂数据或外部消息。用户 Chrome 线上资料未清空；故障注入和清缓存均在独立验收上下文进行。

### 第一版发布授权与回执

- 授权：2026-10-07 用户明确要求本地合并 main 并推送 GitHub main。发布范围为本次 DDS 任务详情第一版及其测试、需求/审查记录。
- 本地合并采用快进方式，推送 main 后核验同一完整 SHA 对应的 Vercel Production 部署。实际结果保存在本任务 output/playwright/dds-review-v1/release-verification.log 和 release-remote.json。
- 浏览器原始样本及两张主要截图保存在 docs/prototype-review-records/evidence/2026-10-07-dds-task-business-review/；样本绑定源码 SHA-256，不以 Git HEAD 变化冒充源码变化。
