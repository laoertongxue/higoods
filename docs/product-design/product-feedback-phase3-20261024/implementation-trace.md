# 商品反馈管理三期实施追踪

- 依据：[三期V1.1](../商品反馈管理三期完整方案-2026-10-24.md)，D31～D40全部已确认。
- 授权：完整页面、交互、合法Mock与业务/产品对抗式审查，直接修复；暂不发布。
- 基线：`297cdf4ffb83a4b174a37221e5aafcc7774d5c6d`；分支`codex/product-feedback-phase3`。
- 工作区：`/Users/laoer/.codex/worktrees/feedback-verification/higoods`，复用已附着干净工作区；主工作区19项原差异（含两份三期文档）哈希见`output/playwright/product-feedback-phase3-20261024/initial-main-workspace.json`。
- 边界：单浏览器Mock；不接真实采集/数据库/AI/共享服务，不加入退货、Shopee首批、权限或业务维护工具。

| 编号 | 需求及独立结果 | 实现计划 | 验证与结束条件 | 状态 |
| --- | --- | --- | --- | --- |
| I31 | D31/32 细分、原文依据、逐条确认与固定队列 | phase3-types/model、comments、processing | 五桶守恒、草稿不影响正式、来源失效、刷新恢复 | 已验证 |
| I32 | D33/34 共性发现、专题成员固定元组及关联覆盖 | phase3-model、topics、analysis | 两款门槛、窄范围、重核、归档不代关单 | 已验证 |
| I33 | D35/36 当前关单复盘来源、经验修订与引用 | phase3-model、topics/experience、issues | 旧复盘阻断、来源更新全入口阻断、复制仅草稿 | 已验证 |
| I34 | D37/38 商品对比及原分母快照 | phase3-model、products/comparison | 2～4款、0/未知、构成差异、完整依赖与保存回读 | 已验证 |
| I35 | D39 七页、路由、直达与局部交互 | routes/handlers/menu/main、相关页 | 1366/1280、图片、分页、焦点、返回、简洁提示 | 已验证 |
| I36 | 同库原子保存、版本冲突、定向演示切换 | repository、phase3-mock | 事务失败/并发/重复、旧写者隔离、标记一次、无整包种子 | 已验证 |
| I37 | 完整合法Mock及一期二期直接回归 | phase3-mock、unit contracts、浏览器 | 默认≤40条/两页，所有评论者存在，M31～M50与算例 | 已验证 |
| I38 | 业务与产品对抗审查、修复、性能 | 产品审查记录与浏览器证据 | 独立反例关闭，等价家族5样本≤1000ms，治理通过 | 已验证 |

## 验证安排

先数据合同（细分、队列、范围、来源、分母）→页面实际流程（含保存回读）→隔离存储失败/旧数据切换→相邻一期二期回归→正式性能→独立业务与产品审查及修复复核→构建和适用治理。重型检查串行，不扩大默认Mock规模。

代码结构索引读取主工作区同一基线；修改后的具体文件以本隔离工作区实际源码为准。CodeGraph候选有无关同名符号时，只读取已经明确的商品反馈文件，不据无关候选推断事实。

## 数据切换登记

IndexedDB `higood-product-feedback-v1` 从v4切换到v5；一次性完成标记`meta:phase3-cutover`=`feedback-phase3-v1.1-20261024-1`。只清理本模块旧Mock records/attachments，其它库不动；旧连接versionchange后关闭，旧v4写者不能重开v5。正常读取仅投影静态Mock和逐记录结果，不整包写种子、不重复清理。隔离浏览器中验证了v4→v5、两项标记、无关库保留、失败不写和成功回读。

## 实现与证据归档

I31～I38均已实现并验证，结论及受管文件统一记在[产品审查](../../prototype-review-records/2026-10-24-product-feedback-phase3.md)；逐文件身份、原始性能值与关键业务结果在[验证摘要](verification-summary.json)，业务与产品反例闭环在[实现对抗审查](implementation-adversarial-review.md)。

交付入口：http://127.0.0.1:4187/pcs/product-feedback/topics 。本地生产构建服务；没有合并、推送或部署。未代表用户接受，也不代表真实采集或多人共享服务。

原主工作区期间仍有其它质量模块变化；本任务全部写入隔离工作树，未复制或覆盖主工作区差异。

## 用户要求的第二轮独立审查

2026-10-24再次完整回放五条业务链，新增反例、修复和逐项原子结果统一记录在[第二轮产品审查](../../prototype-review-records/2026-10-24-product-feedback-phase3-round2.md)，不覆盖本文件原版本证据。最终源文件身份及现场结果见[第二轮验证摘要](../product-feedback-phase3-round2-20261024/verification-summary.json)。本轮未提交或发布。
