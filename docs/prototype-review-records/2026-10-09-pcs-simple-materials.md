# PCS 耗材与配件档案简化原型审查记录

## 1. 基本信息

| 项目 | 内容 |
| --- | --- |
| 记录日期 | 2026-10-09 |
| 相关需求 / 任务 | 简化方案 R1、实施计划、SIMPLE-001～060；两轮逐项对抗审查 |
| 记录模式 | 完整产品审查 |
| 涉及系统 | PCS，直接关联 PMS、FCS |
| 涉及页面路径 | 两类物料列表、主档/规格详情与编辑、基础配置分类与包装类型、采购草稿、技术包 BOM、标签打印 |
| 端类型 | 管理端 |
| 主要角色与任务 | 资料维护/审核人员维护普通实物规格、单位包装及标准费用；采购带入正确规格与版本 |

## 2. 影响判定

- 用户可见影响：有
- 判定依据：两类档案取消技术属性与新增加工；列表固定规格行，主档两Tab、规格三Tab；分类取消模板版本审核；导入、标签、包装采用关系、标准成本及下游选用同步防错。专业面料/辅料/纱线保持原业务范围。
- 当前治理基线：AGENTS.md 第4、5、7节；不使用旧文档或旧测试推翻用户明确业务事实。

## 3. 自查结论

SIMPLE-001～060 已逐项核对实现及最新构建证据；两轮逐项对抗审查均通过。当前结论限定本地原型及隔离 Mock 场景。完整对应关系见 [最终验收证据登记](../product-design/pcs-consumable-parts-simplification/验收证据登记.md)。

| 检查项 | 结论 | 说明 |
| --- | --- | --- |
| 角色、任务与页面模式 | 通过 | 管理端列表/详情/编辑分层，减少技术字段和模板维护 |
| 文案、状态、数量与单位 | 通过 | 型号身份、防重、审核启用、包装采用关系、成本0/未知分离 |
| 扫码、真实图片与对象识别 | 通过 | 袋、刀片、白胶带真实图片；二维码独立识读 |
| 防错、危险确认与主管兜底 | 通过 | 审核范围、已使用单位、归档引用、禁止新加工、失败输入保留 |
| 交接、跨端事实与异常追溯 | 通过 | PCS来源采购草稿与技术包采用快照、真实引用；无跨库原子承诺 |
| 低分辨率、PDA、弱网与上传恢复 | 通过 | 1366×768及1280×720；管理端任务，PDA不适用；模拟附件与存储失败 |
| 命名路由、交互、图片大图与打印 | 通过 | 命名页面五轮≤1秒完整完成，非只测忙碌状态 |

## 4. 问题标签

- 字段过载
- 选不对
- 算不准
- 追溯不足

## 5. 主要问题与处理

| 问题 | 标签 | 影响角色 | 处理方式 | 是否仍有风险 |
| --- | --- | --- | --- | --- |
| 两类普通实物被迫维护技术模板和加工 | 字段过载 | 档案维护人员 | 独立简单分类与文字型号；保存/路由/导入/交接/任务防绕过 | 否，本轮反例及最终场景均通过 |
| CSV主档/规格说明混用及停用分类历史更新失败 | 追溯不足 | 批量维护人员 | 分列保存、稳定分类身份、保留合法历史关联 | 否，本轮反例及最终场景均通过 |
| 包装类型真实标签与字典稳定ID错位 | 选不对 | 配置维护人员 | 按真实ownerSKU和稳定ID/编码/名称/历史别名解析，歧义不猜 | 否，本轮反例及最终场景均通过 |
| 包装更新重解释旧报价风险 | 算不准 | 资料和采购人员 | 保留已采用的旧含量/版本，预览并确认新选择 | 否，本轮反例及最终场景均通过 |
| 新建/不复制成本的数字默认0冒充已确认标准 | 算不准 | 档案维护人员 | simple新建未提供标准时null；显式0有效，历史原值保留 | 否，本轮反例及最终场景均通过 |
| 旧simple加工资料/原币派生费用仍能直接修改 | 追溯不足 | 资料维护人员 | 底层保存门禁拒绝修改，记录/版本/附件不变 | 否，本轮反例及最终场景均通过 |
| 列设置复选框原生状态被全局点击抑制 | 选不对 | 列表使用人员 | 当前物料列控件保留原生点击；不修改全局规则 | 否，本轮反例及最终场景均通过 |

## 6. 最终结论

结论：通过。本轮60项本地原型需求已验证，两轮逐项对抗审查均通过；638组、3215个完整动作样本全部不超过1000ms，最大552.6999999992549ms，没有性能例外。

本次是单浏览器本地原型与隔离Mock验收，不代表真实采购、生产或云端多人业务能力。未授权本轮合并/推送，保持任务分支；不吸收无关用户文档。

## 7. 变更覆盖与验证

### 受管文件

- `scripts/generate-pcs-static-baseline.ts`
- `src/data/fcs/material-process-plans.ts`
- `src/data/generated/pcs-record-baseline.json`
- `src/data/pcs-config-workspace-repository.ts`
- `src/data/pcs-engineering-bom-material-resolver.ts`
- `src/data/pcs-engineering-bom-pricing.ts`
- `src/data/pcs-engineering-bom-repository.ts`
- `src/data/pcs-engineering-master-sampling.ts`
- `src/data/pcs-material-archive-repository.ts`
- `src/data/pcs-material-archive-types.ts`
- `src/data/pcs-material-config.ts`
- `src/data/pcs-material-handoff.ts`
- `src/data/pcs-material-r1-seeds.ts`
- `src/data/pcs-material-reference-check.ts`
- `src/data/pcs-material-transfer.ts`
- `src/data/pcs-record-runtime.ts`
- `src/data/pcs-technical-data-version-repository.ts`
- `src/data/pms/material-purchase-orders.ts`
- `src/pages/pcs-config-workspace.ts`
- `src/pages/pcs-material-archives.ts`
- `src/pages/pcs-technical-data.ts`
- `src/pages/pms/material-purchase-orders.ts`
- `src/pages/tech-pack/bom-domain.ts`
- `src/pages/tech-pack/context.ts`
- `src/pages/tech-pack/events.ts`
- `src/pages/tech-pack/process-domain.ts`
- `src/router/route-renderers.ts`
- `src/router/routes-pcs.ts`
- `src/data/pcs-simple-material-categories.ts`
- `src/data/pcs-simple-material-transfer.ts`

### 页面路由

- `/pcs/materials/consumable`、`/pcs/materials/parts`，各自 `/new`、`/:materialId`、`/:materialId/edit`、`/:materialId/skus/new`、`/:materialId/skus/:skuId`、`/:materialId/skus/:skuId/edit`。
- `/pcs/settings/config-workspace`：耗材/配件分类列表、详情、编辑；包装类型使用情况；专业模板回归。
- `/pms/material-purchase-orders` 及来源采购编辑页；`/pcs/technical-data` 和技术包 BOM 编辑入口。
- 专业三类命名页面和加工入口，实际路由见专项报告。

### 验证命令

实际结果与完整输出见 [验收证据登记](../product-design/pcs-consumable-parts-simplification/验收证据登记.md) 及其中逐编号证据表。

- `node --import tsx --test`：通过，6份直接专项44/44。
- 8份命名浏览器脚本：五轮完整操作通过，638组3215样本，1366×768/1280×720。
- `pcs-record-db.test.ts` 实际IndexedDB专项：通过，事务完成/中止、配额、多页冲突、读取失败及文件引用保护。
- 30源码路径 `check-typescript-scope.mjs`：通过，范围内0错；全量既有3项范围外错误未声称通过。
- Swift Vision二维码识读、PDFKit完整型号计数及首末页渲染：通过。
- `npm run build`：通过，构建前652/652单元契约通过。
- `workflow:verify --paths`：失败，在检查执行前拒绝，原因是脚本强制覆盖全部工作区差异并要求吸收无关换片布菲票文档。按AGENTS.md第7节“全量收据无法限定任务文件时，使用独立工作树或明确说明未运行”，本次不生成整体技术收据，不更改或吸收无关文件。受影响检查按同一脚本路由独立执行，结果另存任务范围验证记录；原型60项及两轮审查的直接证据仍完整。

- `npm run check:pms-purchase-chain`：通过，最终完整输出见任务范围验证记录。
- `npm run check:menu-routes`：通过，最终完整输出见任务范围验证记录。
- `npm run check:prototype-design-governance -- --all`：通过，最终完整输出见任务范围验证记录。
- `npm run check:list-page-governance`：通过，最终完整输出见任务范围验证记录。
- `npm run build`：通过，最终完整输出见任务范围验证记录。
- `codegraph sync`、`codegraph status --json`：通过，当前工作树、0待同步文件、无工作树错配。

### 真实图片验证

- 静态来源：`public/materials/packing-bag.jpg`、`public/materials/pcs-reviewed/knife.jpg`、`public/materials/pcs-reviewed/tape.jpg`。实际查看对应透明袋、裁床刀片、白胶带；照片没有尺寸刻度，不声称从照片证明10/12英寸等尺寸。
- 真实图片在同一物料识别格显示；缩略图、大图打开及按钮/遮罩/Esc关闭已验收，图片加载失败提示可见。打印等待图像解码及字体；历史用户图片覆盖保留。两类120字长型号100份PDF各13页，完整型号各100次，首末页均已查看。源图映射与覆盖/删除标记专项通过，未用图片推断实际尺寸。

### 例外

- 性能无例外。原5000行简单物料导入完整保存超时的失败结果保留，不宣称通过；R1第11.1/12章已明确将两类支持规模调整为档案500行、单位与成本20行，超限按完整主档组拆分，专业三类范围不变。
- PDA不适用：本轮修改管理端档案、配置和直接下游选用，没有新增PDA动作。
- 实体打印机不适用：验收浏览器打印页面、PDF分页、完整文本、图片与二维码识读，未连接现场打印机。

### 最终证据版本

工作树 `/Users/laoer/Documents/higoods`，分支 `codex/consumable-parts-simplification`，HEAD `155144308f6b2931a8acb229a579e04ec99af41d` 加本轮任务差异。30源码文件冻结指纹 `2df1bfafaa89b431e8f45ef5731e710f27e68e8eb0a202645421dfe35b500146`，实际HTTP资源 `/assets/index-BPNAo-1Z.js` SHA256 `727812ce3d4f022d739d884ae1023318e5e50ec61265ee1196964882f0595979`；10组运行报告均在最后实质源码变更后生成。原始失败和旧构建记录保留，未冒充最终通过。PMS/WMS外围流程与3项不相关旧spec/全量类型既有错误按证据登记说明，未被吸收为本轮能力。
