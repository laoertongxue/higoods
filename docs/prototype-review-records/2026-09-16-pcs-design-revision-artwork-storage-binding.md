# PCS 设计改款花型成果与加工单绑定原型审查记录

## 1. 基本信息

| 项目 | 内容 |
| --- | --- |
| 记录日期 | 2026-09-16 |
| 相关需求 / 任务 | `ART-019`、`STORAGE-001`、`STORAGE-002`、`BIND-001`～`BIND-003` |
| 记录模式 | 完整产品审查 |
| 涉及系统 | PCS、FCS |
| 涉及页面路径 | `/pcs/production-preparation/artwork/:taskId` |
| 端类型 | 管理端 |
| 主要角色与任务 | 花型团队提交成果；买手或管理员审核；异常时恢复加工单关联 |

## 2. 影响判定

- 用户可见影响：有
- 判定依据：花型成果上传区、文件校验提示、存储失败提示、加工单绑定错误和恢复动作均发生变化；文件持久化结构同步收口为单一正文来源。

完整产品审查依据：

- `AGENTS.md` 第 4 节：印尼工厂现场产品设计基线。
- `AGENTS.md` 第 5 节：UI、列表和真实图片专项门禁。
- `AGENTS.md` 第 7 节：分层验证和证据新鲜度。

## 3. 自查结论

| 检查项 | 结论 | 说明 |
| --- | --- | --- |
| 角色、任务与页面模式 | 通过 | 花型团队提交，买手或管理员审核；仍使用现有专业任务详情页 |
| 文案、状态、数量与单位 | 通过 | 一个上传区说明多文件要求；失败指明具体加工单和恢复动作 |
| 扫码、真实图片与对象识别 | 通过 | 两张真实图片可查看大图，一份文件可下载；均显示文件名和大小 |
| 防错、危险确认与主管兜底 | 通过 | 缺图片、缺源文件、写满、错归属和缺单均阻断；管理员可操作 |
| 交接、跨端事实与异常追溯 | 通过 | PCS 成果与 FCS 加工单读取同一文件引用；恢复动作写操作日志 |
| 低分辨率、PDA、弱网与上传恢复 | 有条件通过 | 管理端上传和失败恢复已验收；本原型不实现真实弱网队列 |
| 命名路由、交互、图片大图与打印 | 通过 | 原路由和页面骨架保持；图片可查看大图；本次不涉及打印 |

## 4. 问题标签

- `读不懂`
- `状态抽象`
- `追溯不足`

## 5. 主要问题与处理

| 问题 | 标签 | 影响角色 | 处理方式 | 是否仍有风险 |
| --- | --- | --- | --- | --- |
| 花型图与花型文件分开理解 | 读不懂 | 花型团队 | 合并为一个多文件上传区，同时校验预览图和源文件 | 否 |
| 同一文件正文重复落盘导致配额错误 | 状态抽象 | 花型团队、买手 | 正文只存上传仓库，主任务和加工单保存引用并在读取时恢复 | 否 |
| “来源不一致”无法定位 | 追溯不足 | 买手、管理员 | 指出具体加工单及冲突任务；缺单提供重建或返回补充入口 | 否 |

## 6. 最终结论

结论：有条件通过

说明：当前原型的上传、刷新持久化、配额失败原子性、绑定诊断和恢复入口已经验证；产品接受待用户确认。本仓库不实现真实后端对象存储和弱网上传队列。

## 7. 变更覆盖与验证

### 受管文件

- `src/data/fcs/design-revision-process-work-order-adapter.ts`
- `src/data/fcs/dyeing-task-domain.ts`
- `src/data/fcs/printing-task-domain.ts`
- `src/data/pcs-engineering-master-sampling.ts`
- `src/data/pcs-engineering-task-upload-repository.ts`
- `src/pages/pcs-independent-sampling.ts`

### 页面路由

- `/pcs/production-preparation/artwork/ES-ID-DR-005-PATTERN_ARTWORK`

### 验证命令

- `node --import tsx tests/pcs-design-revision-result-storage-and-binding.spec.ts`：通过
- `node --import tsx tests/pcs-design-revision-production-preparation-five-flows.spec.ts`：通过，5/5
- `node --import tsx tests/pcs-design-revision-admin-override.spec.ts`：通过
- `npm run check:pcs-design-revision-consolidation`：通过
- `node --import tsx --test --test-force-exit tests/unit/fcs-design-revision-result-readiness.test.ts tests/unit/fcs-design-revision-process-work-orders.test.ts tests/unit/fcs-printing-dispatch-readiness.test.ts`：通过，10/10
- `npx tsc --noEmit --project tsconfig.engineering.json`：通过
- `npm run build`：通过，单元测试 101/101
- `npm run check:prototype-design-governance -- --all`：通过，6 个用户可见受管文件由本记录覆盖

### 真实图片验证

- 预览图：`public/lace-dress-sample.jpg`、`public/pants-sample.jpg`。
- 非图片成果文件：`public/fcs/contracts/template/production-contract-master.pdf`，用于验证同组多文件和下载能力。
- 三个文件均通过页面原生文件选择入口真实读取；页面显示文件名、大小、轮次和上传人。
- 图片提供“查看大图”，非图片提供下载；刷新页面后文件仍可用。
- 浏览器存储检查：上传仓库长度 `748224`，设计改款主记录长度 `119662`，主记录不含 JPEG Base64 正文。
- 截图：`output/playwright/pcs-design-revision-artwork-storage-binding-fixed.png`。

### 例外

- 本仓库是高保真原型，不实现真实后端文件存储、跨系统消息或弱网离线队列；验证对象为当前本地仓储和页面交互。
