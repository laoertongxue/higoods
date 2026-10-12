# 当前物料验收证据

同一最终源码及生产构建的正式验收。Node v26.8.2、npm 11.19.1；本机 macOS，Chromium 浏览器版本见各原始报告。地址 http://127.0.0.1:43222，PID96414 所在工作树 simple-materials-main-integration/higoods；禁止验收期间改写 dist，构建及全量测试与正式采样串行。浏览器隔离 context、Asia/Shanghai、HTTP缓存关闭，不触碰用户浏览器资料。

| 报告 | 样本/家族 | 最大ms |
|---|---|---|
| pages.json | 610 / 122（每家族5轮） | 230.800 |
| process.json | 555 / 111（每家族5轮） | 219.600 |
| layout.json | 170 / 34（每家族5轮） | 265.900 |

测量从真实 pointer/input/change/wheel 或导航开始；目标数量、状态、图片、字体与两次绘制完成后结束，保存还断言持久记录，打印等生成窗口及标签就绪。cold 是命名页面完整导航，reload 是整页刷新，SPA 单独命名；没有把浏览器进程启动时间混入页面指标。打印PDF是页面版式证据，不代表真实打印机输出。

parts/consumable列表使用实际静态例及各2～3规格新档，批量审核包含已通过主档新增草稿规格；导入代表为10 SPU、每档5 SKU，共50行。实际加工使用同一父SKU分别创建6种方式，费用1～6；AB在独立context花型库中使用两种有效授权示例及V3/V2版本。历史单位夹具明确根档与投入SKU都是1500mm，详情/编辑/加工不猜换单位。

图片来自仓库既有实物照片：packing-bag、pcs-reviewed/knife、process-orders/white-black-cotton-jersey，以及隔离花型示例 dress-floral-black / shirt-floral-blue。图片与SKU名称/型号及打印逐项对应；大图与所有可见图片完成态已断言。

logs保留过程失败和最终通过原输出。material-adjacent-final.log是旧测试夹具使用无效花型导致58/60失败；更新为真正有效花型关系后material-adjacent-final-fixed.log为60/60通过，未放宽生产门禁。material-last-normalizer-tests.log保留旧测试期待规格名改写的失败，最终契约改为保留明确规格名及独立历史规格文本。material-process-calibration7.log是冲突提示匹配器没有覆盖“其他标签页”的采集失败，未计入正式通过样本。layout-before-fixture-clarification.json保留前一夹具版本：根档改为mm而投入SKU仍是150，最终夹具明确双方1500并新增数值断言。其余过程日志均保持原身份，不能当作当前资产通过证明。

acceptance.json绑定当前运行源码、三测试契约、三报告原字节及入口构建，不修改旧日志/哈希冒充新运行。只代表当前验收规模和原型，不声称全支持上限压力或工厂真实业务已验收。

最终治理检查发现FCS页面原有多值@page-pattern不符合现有单值解析，仅修正注释为list；运行语句和已验收资产没有改变。验收清单登记这个非运行差异，技术收据再次构建将核对资产一致，不据此重复业务采样。

源码聚合清单SHA口径：Python json.dumps(sourceHashes, sort_keys=True)，默认ensure_ascii=True及带空格分隔符、UTF-8、不追加换行；不能用紧凑JSON推算该聚合值。每个源文件自身SHA与聚合格式无关，可逐项独立核验。

技术收据首跑所有已路由检查退出0，但八个旧目录node:test契约未登记专项路由，状态为implemented。它们此前已独立60/60通过；现补按实际文件执行的八条路由并验证，不以构建替代。首跑收据保留logs/task-receipt-before-routing.json。聚合工具没有复用已有构建的选项，补路由后的最终收据按现有工具再次执行既定检查；不重复页面采样。
