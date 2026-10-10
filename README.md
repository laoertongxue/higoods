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
