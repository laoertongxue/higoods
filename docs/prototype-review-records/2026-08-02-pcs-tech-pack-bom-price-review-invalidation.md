# 技术包 BOM 与价格变化精确复审审查记录

## 1. 基本信息

| 项目 | 内容 |
| --- | --- |
| 审查日期 | 2026-08-02 |
| 相关需求 / 任务 | Task 10 阶段②A：BOM 与价格变化仅触发买手复审，覆盖技术包 BOM 弹窗通用保存链，并补齐审核生命周期证据 |
| 涉及系统 | PCS |
| 涉及页面路径 | 既有技术包 BOM 与价格维护、技术包审核和发布入口 |
| 端类型 | 管理端 |
| 主要角色 | 买手、版师、跟单 |
| 主要任务 | 价格发生真实变化后，只重新审核 BOM 与价格，不重复审核未变化的专业模块 |

## 2. 参考规范

- `docs/higood-indonesia-factory-product-design-guidelines.md`
- `docs/higood-indonesia-factory-prototype-review-checklist.md`

## 3. 自查结论

| 检查项 | 结论 | 说明 |
| --- | --- | --- |
| 角色匹配 | 通过 | BOM 与价格仍由买手负责；版师和跟单已完成的审核不因价格变化失效。 |
| 任务清晰度 | 通过 | 价格变化只形成一次明确的买手复审，不增加新的操作入口。 |
| 信息架构与导航 | 通过 | 未新增页面、菜单或路由。 |
| 页面模式 | 通过 | 复用既有技术包审核状态与模块编辑门禁。 |
| 信息负荷 | 通过 | 未增加说明性页面文案。 |
| 文案 | 通过 | 非法价格变化使用中文阻断提示。 |
| 数量与状态 | 通过 | 标准单价、自定义印尼盾费用、汇率、单位用量、打样数量、损耗率、用量单位及物料 SKU 身份发生真实变化时，买手审核重置为待审核；即使新旧 SKU 标准价相同也必须复审，用量单位按“米 / Yard”等字段身份直接判断；数值与身份均未变化时不失效审核。 |
| 扫码与识别 | 通过 | 本次不涉及扫码。 |
| 防错 | 通过 | 复审期间仅 BOM、价格可编辑且禁止发布；其他模块保持锁定。 |
| UI 样式 | 通过 | 本次未改 UI。 |
| 组件交互 | 通过 | 本次未改组件。 |
| 协作关系 | 通过 | 版师、跟单审核结论保持；已进入审核生命周期的版本在 BOM 与价格变化后重建买手差异快照、追加日志并通知原指定买手；买手复审通过后直接恢复待发布。 |
| 异常与追溯 | 通过 | 未提交、待审核、审核中的版本不重置审核节点，也不生成复审日志或通知；无变化不失效；非法变化数据在任何写入前阻断；审核失效或后续工程联动失败时，同步恢复技术版本、差异节点、版本日志和审核通知。 |
| 现场设备可用性 | 通过 | 管理端审核规则，不涉及现场设备。 |

## 4. 问题标签

- `算不准`
- `点错风险`
- `协作断裂`

## 5. 主要问题与处理

| 问题 | 标签 | 影响角色 | 处理方式 | 是否仍有风险 |
| --- | --- | --- | --- | --- |
| 价格变化后若整包重审，会让未变化的纸样、工艺等审核重复失效 | 协作断裂 | 买手、版师、跟单 | 只重置买手审核，只开放 BOM 与价格模块，保留版师及跟单审核事实 | 否 |
| 跟单已通过状态会按旧规则阻止任何模块编辑 | 点错风险 | 买手 | 显式复审模块优先于整体锁定，仅允许买手维护 BOM 与价格 | 否 |
| 跟单审核仍为通过时可能绕过买手复审直接发布 | 算不准 | 跟单 | 发布门禁同时校验买手、版师、跟单均已完成且不存在临时解锁模块 | 否 |
| 买手复审完成后旧流程会再次重置跟单审核 | 协作断裂 | 跟单 | 识别 BOM 与价格的选择性复审，保留跟单审核并直接恢复待发布 | 否 |
| 真实保存入口与审核失效规则脱节 | 算不准 | 买手 | 单位用量、损耗、自定义费用、标准单价、汇率和物料 SKU 替换均在既有保存入口内比较前后值并触发精确复审 | 否 |
| 汇率变化只覆盖含物料行的技术包 | 算不准 | 买手 | 汇率传播同时覆盖含物料 SKU 或正数自定义印尼盾费用的草稿版本 | 否 |
| 物料或汇率已写入后审核失效失败 | 协作断裂 | 买手、跟单 | 跨仓操作使用技术资料仓事务，并显式恢复物料仓或汇率配置，确保内容与审核共同回滚 | 否 |
| BOM 弹窗新增、删除和编辑通过通用技术资料保存，可能绕过专用价格保存器 | 算不准 | 买手 | 通用保存链统一比较保存前后的 BOM 价格事实；新增、删除、换 SKU、单位用量及损耗率变化均在同一事务中触发买手复审 | 否 |
| 同价换 SKU 被数值相等过滤 | 算不准 | 买手 | 增加独立的“物料 SKU 变化”事实，使用真实新旧 SKU 身份判断，不再伪装为标准单价变化 | 否 |
| 打样数量或用量单位改变后，成本已经变化但审核保持有效 | 算不准 | 买手 | 统一比较器增加“打样数量变化”和“用量单位变化”事实；单位按字段身份比较，不以换算结果是否相同代替业务变化 | 否 |
| 通用保存已写技术资料，但审核失效写入失败 | 协作断裂 | 买手、跟单 | 审核失效纳入技术版本仓、工程主单仓及关系、款式、项目、归档四个旁路仓的同一原子边界；失败恢复六仓 | 否 |
| BOM 与价格变化只重置状态，沿用旧差异快照且没有日志、通知 | 协作断裂 | 买手、跟单 | 抽取并复用审核生命周期能力；每次失效重建当前买手差异快照、更新差异摘要、追加版本日志并发送买手复审通知 | 否 |
| 未提交草稿因标准价、汇率或直接 BOM 保存被推进到第一阶段审核 | 点错风险 | 买手、跟单 | 以“是否已经进入审核生命周期”为失效门禁；未提交草稿只保存业务内容，继续通过正式提交入口分配审核人并生成审核事实 | 否 |
| 买手正在等待审核或审核中时再次生成复审事实 | 点错风险 | 买手 | 只有买手状态已有“审核-已通过／审核-未通过”明确结论时才能失效；待审核、审核中沿用当前节点，不重复生成日志和通知 | 否 |
| 技术版本事务回滚后仍残留复审日志或飞书通知 | 协作断裂 | 买手、跟单 | 日志仓、通知仓增加快照与恢复能力，并统一纳入技术版本事务；专用 BOM 保存和通用六仓联动共享该回滚边界 | 否 |

## 6. 最终结论

结论：通过

说明：本次把已确认的精确复审规则同时接入专用 BOM 与价格保存器和技术包 BOM 弹窗通用保存链，并将差异快照、审核日志、飞书通知抽取为审核生命周期公共能力；只有买手已有通过或未通过结论时才失效，未提交、待审核、审核中的版本不被重复送审。技术版本事务同时覆盖差异节点、版本日志和审核通知，后续工程联动失败不会遗留孤儿副作用。测试覆盖新增、删除、同价换 SKU、单位用量、打样数量、损耗率、用量单位、标准价、汇率、同值保存、不相关内容、三类无结论状态及六仓失败回滚；没有新增页面，也没有涉及专业任务返工、正式快照、工程主单关闭或历史任务。

## 7. 变更覆盖与验证

### 受管文件

- `src/data/pcs-tech-pack-review.ts`
- `src/data/pcs-tech-pack-review-lifecycle.ts`
- `src/data/pcs-tech-pack-review-feishu.ts`
- `src/data/pcs-tech-pack-bom-price-review-invalidation.ts`
- `src/data/pcs-tech-pack-version-log-types.ts`
- `src/data/pcs-tech-pack-version-log-repository.ts`
- `src/data/pcs-tech-pack-review-notification-repository.ts`
- `src/data/pcs-technical-data-version-repository.ts`
- `src/data/pcs-engineering-bom-pricing.ts`
- `src/pages/tech-pack/context.ts`
- `src/data/pcs-material-archive-repository.ts`
- `src/data/pcs-exchange-rate-config.ts`
- `tests/pcs-tech-pack-bom-price-review-invalidation.spec.ts`
- `tests/pcs-engineering-bom-task-linkage-page.spec.ts`

### 页面路由

- 既有技术包 BOM 与价格、审核及发布入口，无新增路由。

### 验证命令

- `npx tsx tests/pcs-tech-pack-bom-price-review-invalidation.spec.ts`：通过
- `npx tsx scripts/check-tech-pack-review-domain.ts`：通过
- `npx tsx scripts/check-tech-pack-review-module-locks.ts`：通过
- `npx tsx scripts/check-tech-pack-review-page-and-release.ts`：通过
- `npx tsx tests/pcs-engineering-bom-pricing.spec.ts`：通过
- `npx tsx tests/pcs-tech-pack-bom-pricing-page.spec.ts`：通过
- `npx tsx tests/pcs-tech-pack-bom-review-activation-atomic.spec.ts`：通过
- `node --import tsx scripts/check-tech-pack-review-assignee-opinion-diff.ts`：通过
- `node --import tsx scripts/check-tech-pack-review-feishu-notification.ts`：通过
- `node --import tsx scripts/check-tech-pack-review-logs.ts`：通过
- `npx tsx tests/pcs-engineering-bom-task-linkage.spec.ts`：通过
- `npx tsx tests/pcs-engineering-bom-task-linkage-page.spec.ts`：通过
- `npm run check:prototype-design-governance -- --all`：通过
- `npm run build`：通过

### 例外

- 无。
