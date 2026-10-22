# HiGood 原型仓库

HiGood 服装供应链高保真原型，使用 Vite、TypeScript 和浏览器端 HTML 字符串渲染，包含页面演示、Mock 及已接入模块的本地保存。项目定位和执行边界见 [AGENTS.md](AGENTS.md)。

## 本地运行

在目标工作树根目录执行。使用与当前锁文件及脚本兼容的 Node.js、npm；排查环境问题时记录 `node --version` 和 `npm --version`。

首次安装或锁文件变化后安装依赖：

```bash
npm ci
```

启动开发服务（默认端口由 [Vite 配置](vite.config.ts)指定）：

```bash
npm run dev -- --host 127.0.0.1
```

需要查看生产构建时：

```bash
npm run build
npm run preview -- --host 127.0.0.1 --port 4173 --strictPort
```

`build` 当前依次执行工程类型检查、单元测试和 Vite 构建；`preview` 读取已生成的构建产物，不自动重新构建。开发服务和构建预览证明的环境不同，验收范围按 `AGENTS.md` 确定。

脚本定义见 [package.json](package.json)，依赖解析版本见 [package-lock.json](package-lock.json)。构建通过不包含所有专项检查、页面验收或 Production 部署核验。

## 五份常设文件

| 文件 | 职责 | 使用时机 |
| --- | --- | --- |
| [AGENTS.md](AGENTS.md) | 唯一项目级规则：范围、产品基线、存储、验证与发布 | 所有任务按适用条款执行 |
| [README.md](README.md) | 项目入口、运行方式和文档导航 | 初次进入项目或查入口 |
| [architecture.md](architecture.md) | 已核对的代码结构、渲染和数据流说明 | 定位实现或评估结构影响 |
| [原型审查记录模板](docs/prototype-review-record-template.md) | 记录本次适用检查、实际结果和证据 | 按 `REVIEW-01` 需要记录时 |
| [裁片域检查与 E2E 手册](docs/cutting-e2e.md) | 裁片专项命令、服务条件和故障定位 | 进行裁片相关验证时 |

除 `AGENTS.md` 外，其余四份只承担入口、事实说明、记录或操作手册职责，不另立项目规则。

## 业务文档与历史证据

以下目录保存具体业务或任务的需求和产物，不是新增的全局指导文件。业务目标、实现现状和历史验证的优先关系见 `AGENTS.md` 的 `SCOPE-01`；文档生命周期与证据保留也以该文件为准。

按业务模块查现行入口，阶段计划和历史审查不自动代表当前口径：

| 模块 | 现行需求入口 | 追踪说明 |
| --- | --- | --- |
| 物料、耗材配件及商品档案 | [物料与商品档案现行需求](docs/product-requirements/物料与商品档案现行需求.md) | 汇总同页建档、分类加工、页签与引用删除；原矩阵及审查版本独立保留 |
| 工厂入驻 | [工厂入驻现行需求](docs/product-requirements/工厂入驻现行需求.md) | 汇总分步调整；明确保留评分目标与当前实现差异 |
| PCS 生产工程 | [总体设计](docs/product-design/PCS生产工程管理总体设计文档.md) | 计划、矩阵、测试方案在原模块中联查；本次发现其既有专项审计失败，见整理记录 |
| 采购 PMS | [产品需求说明](docs/product-requirements/采购管理系统PMS产品需求说明文档.md) | 未完成的迁移矩阵仍保留 |
| 裁片放行 | [业务调整方案](docs/product-design/裁片放行管理与上下游产品调整方案.md) | 历史最终证据与当前需求分开 |
| 裁后换片布及菲票 | [业务调整方案](docs/product-design/裁后处理换片布菲票打印与交出联动产品调整方案-2026-09-24.md) | 实物接受未完成条目不因整理关闭 |
| 后道质检与逐项加工 | [原完整调整方案](docs/product-design/QC后道全流程系统完整调整方案.md)；[逐项加工与多次复检出货](docs/product-design/2026-10-19-后道逐项加工与多次复检出货调整方案.md) | 本期调整部分覆盖原内部整单处理规则；实施及验收状态见新方案、计划与72条矩阵，历史记录保持原版本 |
| 后道 QC 发货紧急优先级 | [需求方案](docs/product-requirements/后道QC发货紧急优先级需求方案.md) | [实施计划](docs/implementation-plans/2026-10-20-后道QC发货紧急优先级实施计划.md)与[逐项验收清单](docs/requirement-traceability/后道QC发货紧急优先级逐项验收清单.md)；按 SKU 抵扣库存及后道合格量，D01～D06 已确认，雅加达时区，实施及证据状态见清单 |
| 车缝外发与履约 | [任务分配及时效需求](docs/product-design/车缝与车缝到后道任务自定义分配及履约时效产品需求文档.md) | [每日回货与两节点调整具体方案](docs/product-design/PPIC每日回货跟进与两节点履约调整具体方案-2026-10-14.md)已完成本地原型实施与专项技术验收；未替代部分继续继承原需求 |
| 辅料工厂 | [总体设计](docs/product-design/辅料工厂管理总体产品设计文档.md) | 原计划、矩阵及检查输入保留 |
| 仓储面料需求 | [业务说明](docs/product-design/仓储管理-面料需求看板产品说明文档.md) | 不合并掉独立业务边界 |
| 生产时效 V7 | [接入设计](docs/product-design/production-fulfillment-timeliness/v7-integration-design.md) | 106 条原子矩阵、原版本和未完成门禁继续联查 |

普通检查、浏览器测试、日志和截图默认写入已忽略的 `output/`；本次调整的收集器按运行时间区分输出，相关报告的采样和断言口径不变。正式保留证据按 `AGENTS.md` 选择必要报告、原始样本和代表性图片，避免把多轮驱动转录和相同截图持续提交到文档目录。

执行 `npm run check:documents` 核查文档新断链、历史 Git 文件定位及已调整收集器的输出默认值。它单列整理前已有的缺失链接，不把旧问题当作新通过；业务验收仍使用相应专项与原子矩阵。

历史原文及完整过程资料见[瘦身前的 Git 版本](https://github.com/laoertongxue/higoods/tree/e45ceac841b15aad352fbc0fda9274a35c44e01c/docs)。历史报告内的文件路径与哈希清单按其当时版本解释；不要求当前目录保留全部过程副本，也不把历史结果重标为当前通过。本次[处理与核查记录](docs/governance/工程文档瘦身实施与核查记录.md)登记删除依据和直接验证。

| 目录 | 内容 |
| --- | --- |
| [产品需求](docs/product-requirements/) | 对象、角色、业务规则和验收口径 |
| [总体设计](docs/product-design/) | 专项业务设计、完整调整方案及替代关系 |
| [实施计划](docs/implementation-plans/) | 按依赖拆分的任务范围和实施步骤 |
| [需求追踪](docs/requirement-traceability/) | 原子需求、实现位置和证据映射 |
| [原型审查记录](docs/prototype-review-records/) | 对应版本实际执行的产品审查 |
| [验证证据](docs/verification-evidence/) | 命名版本的验证结果和附件 |
| [治理调整记录](docs/governance/) | 治理变更的方案、追踪及验证证据 |
| [专项审查](docs/reviews/) / [测试记录](docs/test-records/) | 具体任务的审查结果、日志与附件 |

具体任务的检查命令按影响选择。裁片专项、相关回归和完整 E2E 的入口见 [裁片手册](docs/cutting-e2e.md)，无需在所有项目任务中运行裁片全链检查。

## 自动部署到 Caddy

正式站点：[higood.12lab.cn](https://higood.12lab.cn)。推送 GitHub `main` 自动执行 [Deploy Caddy Production](.github/workflows/deploy.yml)：Node 24、锁文件安装、现有检查与构建、产物校验、变化文件 SSH 上传、原子切换和 HTTPS 回读；相同文件从已校验旧版本复用，整个新版本仍逐文件验证。失败保留或恢复上一版。日常无需登录服务器或手动发布。

部署用户仅有本站点发布权限，私钥与服务器主机密钥存 GitHub Actions Secrets。仓库变量 `CADDY_DEPLOY_ENABLED=true` 启用发布。具体部署目录、版本、回滚、验收与迁移状态见 [迁移记录](docs/deployment/caddy-migration-2026-10-13.md)。本地数据仍按浏览器来源隔离；旧域名数据不会因托管迁移自动出现在新域名。
