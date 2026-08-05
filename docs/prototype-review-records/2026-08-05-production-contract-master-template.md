# FCS 生产合同母版严格一致性审查记录

## 1. 基本信息

| 项目 | 内容 |
| --- | --- |
| 记录日期 | 2026-08-05 |
| 相关需求 / 任务 | 生产合同严格使用用户提供的 `合同模板.pdf` |
| 记录模式 | 完整产品审查 |
| 涉及系统 | FCS |
| 涉及页面路径 | `/fcs/contracts/print?contractId=...`、通用打印预览 |
| 端类型 | 管理端 / 打印件 |
| 主要角色与任务 | PPIC 生成和打印合同；工厂 PIC 签署合同 |
| 验证分支 | `codex/fcs-dispatch-workbench-simplify` |

本次审查以当前 `AGENTS.md` 第 4、5、7、8 节为治理基线。

## 2. 影响判定

- 用户可见影响：有
- 判定依据：生产合同由旧的自拟中英文合同及 SKU 续页，改为用户提供的两页 SPK 母版；动态字段的语言、位置、日期和数量表达发生变化。

### 固定事实

- `public/fcs/contracts/template/production-contract-master.pdf` 是从用户文件逐字节复制的唯一母版，SHA-256 为 `faa13a7aa6942f41c30ac3651ff78ea728841dedd941a99a5ea8b5de62edff8c`。
- 固定条款与样式不由代码重排或重写，而是由母版两页 300 DPI 页面图直接承载。
- 母版本身为中印双语；删除母版中文会改变固定条款，因此固定原文全部保留。“必须是印尼文”落实到系统生成的动态描述、角色、日期、类型和缺省值；真实姓名、编号、数量保持业务原值。

## 3. 自查结论

| 检查项 | 结论 | 说明 |
| --- | --- | --- |
| 角色、任务与页面模式 | 通过 | PPIC 查看和打印，工厂 PIC 签署；失效版本禁止打印。 |
| 文案、状态、数量与单位 | 通过 | 固定内容使用原母版；任务类型、工序类型、自然日、日期、角色和缺省值使用印尼文；数量按母版 Pcs；动态字段在单元格内按长度自适应字号、行高和换行。 |
| 防错、危险确认与主管兜底 | 通过 | 只有有效合同可打印；旧合同仍可追溯但不打印。 |
| 交接、跨端事实与异常追溯 | 通过 | 合同快照冻结任务、工厂和回货规则；打印仍记录审计日志。 |
| 命名路由、交互、图片大图与打印 | 通过 | 当前分支从直接派单生成合同，实际导出 A4 纵向两页 PDF，并逐页对照母版。 |

## 4. 问题标签

- `追溯不足`
- `视觉干扰`

## 5. 主要问题与处理

| 问题 | 标签 | 影响角色 | 处理方式 | 是否仍有风险 |
| --- | --- | --- | --- | --- |
| 旧实现自拟标题、条款和版式 | 追溯不足 | PPIC / 工厂 | 删除旧渲染，统一读取用户母版 | 否 |
| 旧实现按 SKU 增加续页 | 视觉干扰 | PPIC / 工厂 | 严格固定为母版两页 | 否 |
| 合同详情打印和通用打印不一致 | 追溯不足 | PPIC | 两个入口共用同一母版渲染器 | 否 |
| 较长工厂名、角色、日期或任务备注可能在固定单元格中显示不全 | 视觉干扰 | PPIC / 工厂 | 保留母版边框与固定条款，动态覆盖层根据字段长度缩放字号，并在单元格可用高度内最多换行显示 | 否 |

## 6. 最终结论

结论：通过

说明：代码与母版指纹已形成直接约束；当前分支实际生成的合同为 A4 纵向两页，第一页动态字段覆盖区和第二页固定条款页已逐页视觉复核。

## 7. 变更覆盖与验证

### 受管文件

- `src/components/shell.ts`
- `src/data/fcs/production-contracts.ts`
- `src/data/fcs/print-template-registry.ts`
- `src/pages/production-contract-print.ts`
- `src/pages/print/templates/production-contract-template.ts`
- `src/pages/print/templates/production-contract-master-template.ts`

### 页面路由

- `/fcs/contracts/print?contractId=...`
- 通用打印预览中的生产合同文档

### 验证命令

- `npm run check:production-contract-template-fidelity`：通过；母版 PDF、两页 300 DPI 页面图指纹和共用渲染入口校验通过。
- `npm run check:fcs-unified-assignment-foundation`：通过；合同生成、回货规则和统一分配回归通过。
- `npm run check:fcs-dispatch-list-filters`、`check:fcs-dispatch-bagging`、`check:fcs-auto-dispatch`：通过。
- `npm run check:prototype-design-governance -- --all`：通过；7 个用户可见文件由 2 份审查记录覆盖。
- `npm run build`：通过。
- 浏览器从 `TASKGEN-202603-0002-002` 直接派单生成 `CONTRACT-000001`，访问 `/fcs/contracts/print?contractId=CONTRACT-000001`：通过。
- 实际打印件：`output/playwright/production-contract-master-verified-final.pdf`，`pdfinfo` 为 `Pages: 2`、`Page size: 594.96 x 841.92 pts (A4)`；逐页渲染证据为 `output/playwright/production-contract-master-verified-final-1.png` 和 `-2.png`，视觉复核通过。
- 动态字段自适应复核：`output/playwright/production-contract-adaptive-1366.png` 和 `output/playwright/production-contract-adaptive.pdf`；任务备注在单元格内换行，红框区域字段完整，PDF 仍为 A4 两页。

### 例外

- 当前生产任务事实没有采购单号和实际领料日期字段。母版对应动态单元格使用 `Tidak tersedia` 与 `Belum diambil`，避免伪造业务数据；后续上游提供真实字段后应在合同生成时冻结真实值。
