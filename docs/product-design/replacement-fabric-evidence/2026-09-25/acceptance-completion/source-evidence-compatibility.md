# 最终源码与证据对应

最终build21基线`5ba805510f3cf70339db6e3ddd072b9c5d255a01`、1240个src，源码指纹`04165095824efc064c2e26ef942150c79e1b17f814c2e886ddf7346a0f2f0913`。主代理逐文件确认与当前源码一致，并审查全部相关diff。

所有28组命名浏览器场景已在build21同版重新执行，1280计时样本max463ms、issues=[]。因此当前UI/性能结论直接绑定build21，不需要用旧build7/8/9性能替代。来源七组动作90、部位票155、主链/来源各135、三类袋与增强打印、双袋均包括在内。

核心领域/迁移/附件/失败注入和明确业务边界保留原始专项版本；其实现经当前566单元、主代理影响审查及build21真实动作共同核对。历史散列比较仅用于解释复用范围，见[source-evidence-compatibility-history](source-evidence-compatibility-history.md)，未包含的文件从未被推定全等。

最后源修改仅print-preview图片overlay的Escape传播处理；web-detail115包括新增五次window-capture Esc、随后图片失败反馈、显式重试、实际打印/PDF和三种关闭方式。当前最大158.1ms。坏图门禁与真实原周期3页身份/数量均保留；软件证据不替代D04实物。

文档与归档冻结后的最终workflow须以最后diffHash生成output中的task-receipt-final-frozen.json，不将最终收据复制进tracked。发布及产品accepted单独核对。
