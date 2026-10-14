# PPIC 六入口性能专项第三阶段本地冻结记录

依据[AGENTS.md](../../AGENTS.md)::SCOPE-02、REVIEW-01、PERF-01、EVIDENCE-01、RELEASE-01。继承[专项H01-H11](../product-design/ppic-six-entry-performance-hotfix-20261015.md)。只修剩余首开资源负担；前两正式版本失败原件保留，未以本地结果替代线上。

## 基本信息

- 日期：2026-10-15
- 任务 / 需求编号：PPIC六入口性能专项H10-H11
- 验证人：Codex技术验证，一个独立只读审查

## 影响判定

- 记录模式：完整产品审查
- 用户可见影响：有
- 判定依据：两页共享纸面呈现资产无损编码、已有四大JS首开请求优先级；布局、业务来源与保存不变。T4。

## 自查结论

| 检查项 | 结论 | 证据 / 问题及处理 |
| --- | --- | --- |
| 两页母版/历史版本 | 通过 | PNG/PDF原件与原ASSETS公开API不改；2WEBP为2481×3508且每个RGBA像素相等；主模板归一两img与新增常量后与843a484a逐字相等，旧合同分支/覆盖表/字段/打印CSS不改 |
| 真实浏览器像素/打印 | 通过 | 最终生产预览的两页canvas逐RGBA摘要均等于各自原PNG；原件追溯属性和页序正确。真实按钮先写打印事实再完成，失败不打印/无半套、5重试操作唯一事实、刷新一致 |
| 请求集合/顺序 | 通过 | VM复核3正/6反路径新旧请求集合相同、IDB首位、4大模块高优先级；执行/毛织/PF-POST/非FCS边界未扩大。真实初始化/采集终点未改 |
| 本地闭环与性能 | 通过 | 生产预览28类140样本全部≤1000ms，含指定六类各5；当前人、角色、应回、原截止、后道100/PPIC10、两节点与事务失败恢复仍通过 |
| 新正式性能/设备接受 | 不适用 | 此记录只绑定本地冻结；新正式SHA另验，不冒称物理PDA/实际纸面打印接受 |

## 最终结论

结论：通过

本地通过；843a484a正式仍有成员/合同以及邻接看板慢值，不关闭H03/H04。

## 变更覆盖与验证

### 受管文件

- `src/pages/print/templates/production-contract-master-template.ts`
- `vite.config.ts`
- `scripts/check-production-contract-template-fidelity.ts`
- `public/fcs/contracts/template/production-contract-master-1.webp`
- `public/fcs/contracts/template/production-contract-master-2.webp`

### 页面证据

- 版本：/Users/laoer/.codex/worktrees/5f34/higoods；843a484a加H10/H11；真实生产预览5529、Chromium149、Asia/Jakarta、真实时钟、原隔离来源规模不变，运行源/HTML哈希见stage3-local-summary.json。
- 证据：output/ppic-performance-hotfix-20261015内contract-lossless-pixels.json、stage3-local-summary.json、local-stage3.log、online-acceptance-stage3-local.json及online-pda-acceptance-stage3-local.json；原件目录包含真实两页截图、contract-browser-pixels.json及闭环数据；969/22旧来源未变化证据仍原身份保留，新增模板fidelity及生产包检查本阶段实际运行。

### 性能结论

- 结论：通过
- 依据：28家族140原样本均≤1000ms；起点/全部目标内容及必要图/有限动画/两次绘制保持；首五日报冷context，成员首个1024边界，PDA新文档自然缓存。合同全分辨率无损码不减图片内容，两页1326424B→408968B。前两正式慢值不丢弃，新正式另验。

### 验证命令

- `npx vite build`：通过
- `npx tsx scripts/check-production-contract-template-fidelity.ts`：通过
- `node output/ppic-performance-hotfix-20261015/encode-contract-lossless.mjs`：通过
- `node output/ppic-performance-hotfix-20261015/local-stage3-check.mjs`：通过

### 例外

- 无

收据output/ppic-performance-hotfix-20261015/task-receipt-stage3.json最终冻结后实际生成；独立审查无P1/P2；无新增依赖、业务API或图片生成/内容编辑，只无损编码原件。正式发布记录外部追加，不改此本地冻结记录冒充正式验证。
