# 全项目原型门槛清理审查记录

依据 `AGENTS.md` 的 SCOPE-02、REVIEW-01、PERF-01、EVIDENCE-01；使用当前 docs/prototype-review-record-template.md 完整产品审查模式。

## 基本信息

- 日期：2026-10-20
- 任务 / 需求编号：FF-01～FF-29；全项目演示门槛和资料维护入口清理
- 验证人：Codex 主代理；一位独立审查者及两个有明确文件范围的实施/验证旁路

## 影响判定

- 记录模式：完整产品审查
- 用户可见影响：有
- 判定依据：删除伪角色及维护控件、URL/DOM门槛和旧处理链；收货及批版按实际责任确认；物料主表迁入标准列表；直接事件分派、原生字段事件边界与同源只读投影优化；入驻仅排除无关PMS初始化，原PCS/FCS和处理器准备保留。范围见需求矩阵，保留真实业务校验及已有用户数据恢复。

## 自查结论

| 检查项 | 结论 | 证据 / 问题及处理 |
| --- | --- | --- |
| 用户范围和代码现状 | 通过 | docs/product-design/2026-10-20-prototype-full-function-cleanup.md FF-01～29；source-inventory.json 覆盖1405份src/index（含CSS及JSON）和24份public脚本/HTML；伪门槛精确残留为0 |
| 实际责任及角色边界 | 通过 | business-responsibility、receipt-responsibility-fix及real-pda-boundaries-summary；普通仓管、实际主管、原批版领取人、冻结PPIC责任分别核对；实际PDA工厂/账号守卫保留 |
| 数量及单位 | 通过 | 负数、超过已配、未派接收工厂、实收差异原因/凭证、上游实交硬上限、原采购计划不扩均验证；新投影与原完整结果逐字段等价 |
| 状态与令牌 | 通过 | 新水溶专项验证原生成任务和交出批次、无会话/错角色/跨厂/伪造及取消令牌无副作用；批版仅当前状态动作开放 |
| 本次保存的责任事实 | 通过 | LACE原内存receipt分开存actual receiver与supervisor；TMF原operation分开存两人并原生IDB刷新读回；sample使用原生产来源原子命令与稳定领取ID |
| 用户旧资料及失败 | 通过 | storage-tests/results.json：新浏览器直接Mock且三个模块0种子写入；伪旧事件无效；取消/事务失败保留原源，验证读回后才清理；后出现旧源也阻断写入 |
| 全站正式持久化改造 | 不适用 | 本任务清理UI门槛，未承诺全站存储迁移；LACE/通用静态Mock原会话边界保留；TMF本次真实实收已等待事务complete、保存lots并核对并发，其他旧提交/自动种子结构见tmf-storage-audit.json，不能据本记录宣称全站整改 |
| 列表结构及原生操作 | 通过 | 标准主表11列、完整范围统计/查询、分页/路由pageSize及详情返回专项；没有改治理baseline。字段click不再被消费；固定构建原生数字键选择20条，偏好/结果与真实事件一起确认。箭头选择的空白select对照失败按采集限制保留，没有为其改产品 |
| 日报及关联追溯 | 通过 | cutting-daily-projection-fix.json：15组报告完整等价、4份改前JSON哈希相同，下一snapshot即时更新；PDA四类候选的关联/歧义/未知结果与原完整索引相同，无跨动作缓存 |
| 桌面/PDA布局及图片 | 通过 | performance目录的1366×768、1280×720、1024×768及390×844截图和逐页图像decode/主体溢出记录；原图片对应/资源不更换，按用户已确认演示款图可错配但必须有图。26张正式布局记录无主体溢出；主代理抽查8张关键页面。实际文件名和视口见performance-final-evidence.json |
| 图片大图交互 | 不适用 | 本轮未改图片控件、原始资源和大图处理链；沿用原业务组件。当前加载/可见性与布局另按上一行验证，没有宣称重新验收全站图像 |
| 打印、PDA实体设备与真实工厂 | 不适用 | 本轮未改打印模板或物理设备；PDA为Chromium窄屏原型。所有事务测试仅隔离浏览器，不代表真实工厂执行或生产数据写入 |
| 源码审查及遗漏 | 通过 | independent-review.json原2个P2已定向关闭；主代理检查全部最终diff；性能delta另核读并精确记录个人实施与审查边界 |
| 完整响应性能 | 通过 | performance-final-evidence.json：63家族各5次、315有效样本，最大921.5ms；保留第一次CDR慢样本与第二次入驻刷新1164.3ms，分别修复后定向重验，不用均值覆盖。原始结果保留资产和源码哈希 |

## 最终结论

结论：通过

本次产品行为、适用保存/失败边界、设备布局和完整响应性能通过。最终冻结技术收据及发布状态独立登记在delivery.json；本记录不提前声称尚未执行的命令通过，不代填用户正式接受。

## 变更覆盖与验证

### 受管文件

- `src/data/fcs/action-permissions.ts`
- `src/data/fcs/lace-factory-domain.ts`
- `src/data/fcs/post-finishing-full-flow.ts`
- `src/data/fcs/production-object-overview.ts`
- `src/data/pms/tmf-material-purchases.ts`
- `src/main.ts`
- `src/pages/pda-handover-detail.ts`
- `src/pages/pda-onboarding.ts`
- `src/pages/process-factory/accessory/webbing/continuous-return-receipts.ts`
- `src/pages/process-factory/accessory/webbing/continuous-stock.ts`
- `src/pages/process-factory/accessory/webbing/handover-records.ts`
- `src/pages/process-factory/accessory/webbing/material-preparation.ts`
- `src/pages/process-factory/accessory/webbing/output-receipts.ts`
- `src/pages/process-factory/accessory/webbing/output-stock.ts`
- `src/pages/process-factory/accessory/webbing/pending-receipts.ts`
- `src/pages/process-factory/accessory/webbing/production-control-dialog.ts`
- `src/pages/process-factory/accessory/webbing/semi-finished-orders.ts`
- `src/pages/process-factory/accessory/webbing/supply-purchase-receipts.ts`
- `src/pages/process-factory/accessory/webbing/termination-disposition-dialog.ts`
- `src/pages/process-factory/accessory/webbing/work-orders.ts`
- `src/pages/process-factory/cutting/cutting-daily-production-report-model.ts`
- `src/pages/process-factory/cutting/cutting-daily-production-report.ts`
- `src/pages/process-factory/cutting/marker-plan-model.ts`
- `src/pages/process-factory/cutting/replacement-fabric-data-tools.ts`
- `src/pages/process-factory/cutting/replacement-fabric-fei-tickets.ts`
- `src/pages/process-factory/cutting/runtime-projections.ts`
- `src/pages/process-factory/dyeing/washing/storage-tools.ts`
- `src/pages/process-factory/dyeing/washing/work-orders.ts`
- `src/pages/process-factory/post-finishing/audit-records.ts`
- `src/pages/process-factory/post-finishing/storage-notice.ts`
- `src/pages/progress-material.ts`
- `src/pages/sewing-outsourcing/sample-approval-suggestions.ts`
- `src/pages/wls-accessory-receipts.ts`
- `src/pages/process-factory/accessory/webbing/version-replan-dialog.ts`
- `src/pages/process-factory/accessory/webbing/work-order-detail.ts`
- `src/pages/process-factory/accessory/webbing/production-demand-dialog.ts`
- `src/pages/pms/tmf-tip-purchase-form.ts`
- `src/main-infrastructure/craft-read-entry.ts`

### 页面证据

- 版本：codex/prototype-full-function-cleanup-20261020；当前整合基准6169496a675799802faee12b274eda39f196247d加本轮差异；起始ecc8af历史证据按其原身份保留。工作树/服务为 /Users/laoer/.codex/worktrees/ca23/higoods；功能采用独立随机端口fresh Vite、hmr:false及无watcher，固定构建预览 http://127.0.0.1:43272；Chromium、Asia/Jakarta。最终源码及运行资产哈希在performance原始结果和source-inventory.json，提交号变化不冒称重新执行。
- 证据：output/verification/prototype-full-function-cleanup/ 下 source-inventory、role-business-ui、receipt-responsibility-fix、storage-entrypoints、progress-list-integration、real-pda-boundaries-summary、cutting-daily-projection-fix、independent-review 及对应原始日志。最新fresh浏览器20项契约及1项PPIC真实消费场景通过（browser-complete-final.log）；含TMF事务失败、并发冲突后真实刷新恢复、lot与实际双人事实原生IDB回读及旧singleton的lots读取。早期18/19项和5秒开发模块等待不足失败继续保留，不作为当前通过依据。最后入驻PMS条件修改复测真实事件及10项入口契约通过，最终收据按同一任务范围再次执行20+1。旧onboarding和Task9驱动失败均按矩阵保留且未标通过，新直接契约与精确夹具迁移分别证明其范围。

### 性能结论

- 结论：通过
- 依据：performance-final-evidence.json。performance-final-r2的58个未受最后精确入驻条件影响的家族保留原版本复用；入驻5家族在最终构建追加5次/家族，原必填/真实文件选择和页面完成端点未变。63家族/315样本最大921.5ms，所有家族5次均<=1000ms，0采集错误/未覆盖项。环境为同树固定dist预览、Chromium、Asia/Jakarta、无节流；原始资产前后哈希稳定。TMF单列模型既有记录入口，原默认其他集合未缩小，不冒充空库首次初始化。
- 历史失败完整保留：日报1082.7/1141.5ms、入驻刷新1164.3ms；原生下拉空白对照限制及已撤直接入驻渲染的部位票依赖失败均单列。最终仅入驻PMS初始化条件变更，原PCS/FCS/部位票/来源effects及PDA处理器完整保留，绝非移除实际业务校验。

WLS分类外层表达式仅等价整理为明确分支，五类实际函数输出一致（wls-category-equivalence.json），不改变页面成本和交互。产品及列表门禁已按63条任务路径通过；冻结后收据重新核对最终记录，不靠修改baseline或扩大豁免。

### 验证命令

- `npm run build`：通过
- `npm run check:cutting:all`：通过
- `npm run check:fcs-end-to-end`：通过
- `npm run test:workflow-governance`：通过
- `node --experimental-strip-types --test tests/workflow-governance/prototype-retired-role-fixtures.test.ts`：通过
- `node --import tsx --test tests/unit/pda-sewing-detail-canonical-task.test.ts`：通过
- `node --import tsx --test tests/unit/progress-material-event-boundary.test.ts`：通过
- `node --import tsx --test tests/unit/cutting-daily-report-projection.test.ts`：通过
- `node --import tsx scripts/check-prototype-full-function-browser-contracts.ts`：通过
- `node scripts/check-prototype-full-function-performance.mjs`：通过
- `git diff --check`：通过

最终冻结后执行同范围产品/列表治理与workflow:verify，尚未执行的结果不预填；其结果与FF-17关闭状态在delivery.json补齐。实际命令范围包含本轮全部明确路径，收据会强制重跑其选择的专项和构建；这属于当前工具限制，不冒称复用了机器收据。首次1299单元、整合main后1341单元构建通过；最新TMF44项、入口/日报/PDA定向20项及完整浏览器20+1通过。最后精确条件构建成功，最终冻结工具实际检查清单、退出值、单元总数及CodeGraph状态以task-receipt.json与其日志为准。

### 例外

- 无性能豁免。类型渐进检查覆盖35份现存受影响运行文件、范围错误0；全量另有19个既存PCS错误，未称全量tsc已清零。没有授权清空用户资料、没有新增云服务/鉴权或改生产数据库。LACE和静态Mock原内存范围、TMF其他旧存储路径是明确未整体改造范围；本次实际实收已补complete等待/并发核对/lots持久化，不冒称其正式持久化或真实账号认证完成。历史仅旧驱动/旧报告按原版本保留，当前业务入口不会调用已删维护处理链。
