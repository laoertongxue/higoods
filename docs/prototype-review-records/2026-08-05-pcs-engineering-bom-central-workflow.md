# PCS 生产工程 BOM 集中维护与技术包快照原型审查记录

## 1. 基本信息

| 项目 | 内容 |
| --- | --- |
| 记录日期 | 2026-08-05 |
| 相关需求 / 任务 | BOM 自动创建、集中维护、条件任务联动与技术包快照闭环 |
| 记录模式 | 完整产品审查 |
| 涉及系统 | PCS |
| 涉及页面路径 | `/pcs/technical-data/bom-pricing`、`/pcs/technical-data/bom-pricing/:versionId`、`/pcs/engineering/masters/:masterId`、`/pcs/engineering/revision-sampling/:taskId`、`/pcs/engineering/design-sampling/:taskId` |
| 端类型 | 管理端 |
| 主要角色与任务 | 跟单创建工程主单或独立打样并确认任务方案；买手在唯一入口维护、确认 BOM 与价格；跟单从主单或打样详情查看摘要和进度 |

本记录按项目根目录 `AGENTS.md` 第 4、5、7 节的当前产品设计、真实图片、管理列表与验证基线执行。

## 2. 影响判定

- 用户可见影响：有
- 判定依据：新增 BOM 与价格集中列表和详情路由；移除独立打样内嵌 BOM 编辑和手工 BOM 编号；工程主单与独立打样详情改为按颜色展示 BOM 摘要及维护链接；补充完整物料、工艺、适用 SKU、自定义费用、双币成本、图片大图、失败态及确认反馈；BOM 保存会改变条件任务启用结果，技术包发布会显示正式快照状态。

## 3. 自查结论

| 检查项 | 结论 | 说明 |
| --- | --- | --- |
| 角色、任务与页面模式 | 通过 | 管理端采用表格；跟单负责主单／打样和任务方案，买手独占 BOM 写入。 |
| 文案、状态、数量与单位 | 通过 | 使用中文业务状态；数量带单位；标准价 CNY、自定义费用 IDR、汇率与双币合计口径统一。 |
| 扫码、真实图片与对象识别 | 通过 | 本场景不涉及扫码；款式和物料与名称／编码同块展示真实图，缩略图可查看大图。 |
| 防错、危险确认与主管兜底 | 通过 | 无价物料、非买手写入、未确认完整颜色、已发布版本均阻断；本管理端流程不需要主管兜底。 |
| 交接、跨端事实与异常追溯 | 通过 | 主单、独立打样、技术资料、专业任务和技术包读取统一 BOM 版本及来源。 |
| 低分辨率、PDA、弱网与上传恢复 | 通过 | 本次无 PDA 和上传；桌面表格在内部横向滚动，大图不超出视口。 |
| 命名路由、交互、图片大图与打印 | 通过 | 命名路由可达；保存、确认、跳转和大图均提供反馈；本次不涉及打印。 |

## 4. 问题标签

- 无

## 5. 主要问题与处理

| 问题 | 标签 | 影响角色 | 处理方式 | 是否仍有风险 |
| --- | --- | --- | --- | --- |
| BOM 创建位置不清晰且页面存在重复维护风险 | 读不懂、协作断裂 | 跟单、买手 | BOM 随业务对象自动创建，技术资料作为唯一编辑入口，其他页面只保留摘要和跳转。 | 否 |
| 空 BOM 与任务方案确认时序混淆 | 状态抽象 | 跟单、买手 | 固定任务先确认；BOM 保存后再启用条件任务，任务物料仅作投影。 | 否 |

## 6. 最终结论

结论：通过

说明：BOM 的创建、唯一维护入口、角色权限、条件任务联动和技术包快照均形成同一事实链；最终结论以本记录第 7 节最后一次验证结果为准。

## 7. 变更覆盖与验证

### 受管文件

- `src/data/pcs-engineering-bom-types.ts`
- `src/data/pcs-engineering-bom-repository.ts`
- `src/data/pcs-engineering-master-types.ts`
- `src/data/pcs-engineering-master-repository.ts`
- `src/data/pcs-engineering-master-sampling.ts`
- `src/data/pcs-engineering-master-view-model.ts`
- `src/data/pcs-engineering-tech-pack-workspace.ts`
- `src/data/pcs-tech-pack-version-activation.ts`
- `src/pages/pcs-engineering-master-detail.ts`
- `src/pages/pcs-independent-sampling.ts`
- `src/pages/pcs-technical-data.ts`
- `src/router/route-renderers.ts`
- `src/router/routes-pcs.ts`

### 页面路由

- `/pcs/technical-data/bom-pricing`
- `/pcs/technical-data/bom-pricing/:versionId`
- `/pcs/engineering/masters/:masterId`
- `/pcs/engineering/revision-sampling/:taskId`
- `/pcs/engineering/design-sampling/:taskId`

### 验证命令

- `npm test -- tests/pcs-engineering-bom-version-workflow.spec.ts`：通过。
- `npm test -- tests/pcs-independent-sampling.spec.ts`：通过。
- `npm test -- tests/pcs-tech-pack-bom-review-activation-atomic.spec.ts`：通过。
- `npm run check:pcs-engineering-core-domain`：通过。
- `npm run check:pcs-engineering-master`：通过，23/23 项门禁通过。
- `npm run check:production-preparation-timing`：通过。
- `npm run check:pcs-engineering-delivery-matrix`：通过，538 条原子需求全部唯一且具备实现、验证与状态证据。
- `npm run check:list-page-governance`：通过，静态列表、标准列表模板与完整原型治理链通过。
- `npm run check:prototype-design-governance -- --all`：通过。
- `npm run build`：通过。
- `npm run workflow:verify -- --output /tmp/pcs-engineering-bom-final/task-receipt.json --task-boundary "PCS 生产工程 BOM 自动创建、集中维护、条件任务联动与技术包快照"`：通过，任务收据状态为 `verified`，无阻塞项。
- Playwright 实测 `/pcs/technical-data/bom-pricing`、BOM 详情与工程主单详情：通过；确认列表 10 条分页、物料选择不被重绘清空、物料加入、总需求量、CNY 物料成本、IDR 自定义费用、最新汇率、双币综合成本、条件任务启用、图片大图及 `Esc` 关闭、颜色确认锁定，控制台错误为 0。

### 真实图片验证

- 款式图片来自款式档案的主图或图库首图；物料图片来自物料 SKU 或物料档案正式图片。
- 列表和详情中图片与款式名称／SPU、物料名称／编码处于同一信息块。
- 缩略图支持遮罩大图、关闭按钮和 `Esc` 关闭；加载失败显示明确文字，不以无关占位图冒充。

### 例外

- 无
