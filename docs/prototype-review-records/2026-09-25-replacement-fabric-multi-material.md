# 同一生产单多面料 Mock 补齐

## 1. 基本信息

2026-09-25；main @ e7aa82b5；工作树 /Users/laoer/Documents/higoods；preview43236；管理端裁床打票员。用户要求补齐一个生产单使用多种面料的演示数据。

## 2. 影响判定

- 用户可见影响：有
- 判定依据：PO-202603-0002 从单面料变为三面料。仅该固定演示生产单的技术资料变化，不写入用户存储，不修改其他生产单。
- 基线：AGENTS.md 第4、5、7节。

## 3. 自查结论

| 检查项 | 结论 | 证据 |
| --- | --- | --- |
| 来源一致 | 通过 | BOM、颜色用料映射、纸样部位、裁片、物料图引用同步补齐；换片布页读取统一来源，issues为空 |
| 数量与识别 | 通过 | 灰色主面料、黑色拼接面料、白色府绸袋布，各有一张唯一待打印票，均为5 Yard，共15 Yard |
| 图片 | 通过 | 复用正式物料图 grey-main-fabric、black-splice-fabric、white-poplin；三图均加载成功，各大图可打开关闭 |
| 票面与选票 | 通过 | 三张实际票面及独立放大预览；选两票产生两张预览，整单产生三张预览；不点击打印结果确认 |
| 设备与性能 | 通过 | 1366×768、1280×720、1024×768无主体横溢；110个样本全部<500ms，最大382.19999998807907ms |

## 4. 问题标签

- Mock 场景遗漏

## 5. 主要问题与处理

原默认演示只包含一种面料，无法展示用户已确认的多面料同单关系。补充黑色拼接面料与白色府绸袋布，分别建立两片用量、对应纸样和映射；保留原主面料身份，既有票据不删除。新增物料仅为原型演示场景，不代表真实订单新增用料。

## 6. 最终结论

结论：通过。本次多面料 Mock 页面验收通过。此次没有提交或发布。实物出纸、现场扫码不属于本次数据补齐的验收范围。

## 7. 变更覆盖与验证

### 受管文件

- `src/data/fcs/production-order-demo-tech-packs.json`

### 页面路由

- `/fcs/craft/cutting/replacement-fabric-fei-tickets`
- `/fcs/print/preview?documentType=REPLACEMENT_FABRIC_LABEL`

### 验证命令

- `npm run build`：通过，566项测试通过，Vite 9.85秒。
- `playwright-cli run-code --filename output/playwright/hpb-multi-material/check.js`：通过，105个样本，含三种面料详情、独立票面、大图、单选/多选与整单打印预览。
- `playwright-cli run-code --filename output/playwright/hpb-multi-material/navigation.js`：通过，5次站内切换。
- 结构差异核对：通过，JSON只有PO-202603-0002变化，其余生产单保持相同。


### 例外

- 无性能例外；没有更改页面处理器、存储格式或交出规则。未清除用户浏览器数据。

### 证据

[evidence/2026-09-25-hpb-multi-material](evidence/2026-09-25-hpb-multi-material) 保存脚本、每次原始耗时、三尺寸截图、实际打印预览、构建日志及源文件指纹。

workflow收据：`output/playwright/hpb-multi-material/task-receipt.json`。首次治理检查因记录结果格式不符合解析要求失败，已修正文档格式并重验；未更改数据或检查规则。

2026-10-01 续验：代码与原浏览器验收指纹一致；仅修正例外说明的列表格式，重新执行治理及收据检查。
