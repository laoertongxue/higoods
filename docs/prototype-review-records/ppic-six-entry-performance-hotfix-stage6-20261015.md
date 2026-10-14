# PPIC 六入口性能专项第六阶段本地冻结记录

依据[AGENTS.md](../../AGENTS.md)::SCOPE-02、REVIEW-01、PERF-01、EVIDENCE-01、RELEASE-01。继承[专项H01-H15](../product-design/ppic-six-entry-performance-hotfix-20261015.md)。全部正式失败、DNS故障与本地失败保留；本记录绑定最终H15本地资产，新正式另验。

## 基本信息

- 日期：2026-10-15
- 任务 / 需求编号：PPIC六入口性能专项H15
- 验证人：Codex技术验证，一个独立只读审查

## 影响判定

- 记录模式：完整产品审查
- 用户可见影响：有
- 判定依据：共享tracking API新增默认全量谓词；个人日报按当前责任及本人历史提前限定计算。T4。任务集合/数量/时间/历史不变，团队和保存校验保持全量，未改存储。

## 自查结论

| 检查项 | 结论 | 证据 / 问题及处理 |
| --- | --- | --- |
| 个人范围及当前责任 | 通过 | 原effective/SEW筛选及Demo确保在前；谓词与原row责任同一current responsibility优先/assignment回退；22启用身份在空持久承诺、3当前任务场景完整视图逐字相同，范围明确不冒充历史验收 |
| 历史/混合人员/团队 | 通过 | 本人承诺任务即使转交仍入原map并进入个人历史；非三方/失效/未知任务本人历史保留；同task容量/承诺不按actor裁剪；团队和currentTask保存不传actor参数仍全量；26专项含实际转交/历史/未知人员/组长拒绝及R45完整row深等值通过 |
| 数量/截止/保存闭环 | 通过 | 原map逐字保留quantityBasis、历史截止和毫秒时间，不复用舍入结果；写事务/实收分摊不改。971单元及最终本地Web116/PDA21断言通过，含后道100/PPIC10、失败重试/刷新和两页合同打印 |
| 本地性能 | 通过 | 最终28类140样本全部≤1000ms，指定六类每类5最大872.9ms；首五日报冷context、成员1024边界、PDA新文档自然缓存；数据/目标内容/必要图/有限动画/两次绘制均保持 |
| 新正式/设备接受 | 不适用 | 本地不替代新正式SHA。此前92def cold1039.0有效失败和后续ENOTFOUND保留；未改变用户网络，未声明物理PDA/工厂接受 |

## 最终结论

结论：通过

最终本地通过；H03/H04仍需新正式版本闭环，不删先前失败。

## 变更覆盖与验证

### 受管文件

- `src/data/fcs/sewing-outsourcing-return-tracking.ts`
- `src/data/fcs/ppic-daily-return-records.ts`
- `tests/unit/ppic-return-quantity-basis.test.ts`

### 页面证据

- 版本：/Users/laoer/.codex/worktrees/5f34/higoods；92def95c加H15；真实生产预览5529、Chromium149、Asia/Jakarta、真实时钟、原隔离来源规模；源码和HTML摘要绑定stage6-local-summary.json。
- 证据：output/ppic-performance-hotfix-20261015内personal-scope-before/after.json、personal-scope-equivalence.json、personal-scope-stage6.log、build-stage6.log、local-stage6.log、online-acceptance-stage6-local.json、online-pda-acceptance-stage6-local.json及stage6-local-summary.json。SCC候选已有同包而未实施，DNS故障及原样本单独保留。

### 性能结论

- 结论：通过
- 依据：28类140样本均≤1000ms；六类最大480.4/184.5/412.1/872.9/515.4/206.1ms。只是提前排除原本不会显示的其他人任务计算，当前人所有任务和历史仍完整；未减夹具、改量/终点、预热冷context或更换网络。

### 验证命令

- `npm run build`：通过
- `node --import tsx --test tests/unit/ppic-return-quantity-basis.test.ts tests/unit/ppic-daily-return-summary.test.ts`：通过
- `node output/ppic-performance-hotfix-20261015/local-stage6-check.mjs`：通过

### 例外

- 无

收据output/ppic-performance-hotfix-20261015/task-receipt-stage6.json最终冻结后实际生成；独立审查无P1/P2；新正式发布另记外部部署记录，不改此冻结记录冒充正式验收。
