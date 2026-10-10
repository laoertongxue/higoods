import assert from 'node:assert/strict';
import {hasStandardListContract,parsePagePattern,assertListPage,sha256} from '/Users/laoer/.codex/worktrees/9ec5/higoods/scripts/check-list-page-governance.ts';
import {isNonStructuralListCorrection,assertHistoricalListCorrection} from '/Users/laoer/.codex/worktrees/9ec5/higoods/scripts/workflow-governance/list-page-policy.ts';
import {validatePrototypeReviewCoverage} from '/Users/laoer/.codex/worktrees/9ec5/higoods/scripts/workflow-governance/prototype-review.ts';
let count=0;const check=(name,fn)=>{fn();console.log('PASS '+name);count++};
const imports=`import {renderStandardListPage} from '../components/ui/list-page.ts'; import {renderStandardListTable} from '../components/ui/list-table.ts'; import {renderTablePagination} from '../components/ui/pagination.ts';`;
const good=`renderStandardListPage({tableHtml:renderStandardListTable({}),paginationHtml:renderTablePagination({})})`;
check('R2-01 direct returned real slots positive',()=>assert(hasStandardListContract(imports+`export function renderListPage(){return ${good}}`)));
for(const [name,expr] of [
 ['constant false conditional',`false?${good}:'<table>raw</table>'`],
 ['comma discard',`(${good},'<table>raw</table>')`],
 ['unselected property',`({unused:${good},output:'<table>raw</table>'}).output`],
 ['element selection variant',`({unused:${good},output:'<table>raw</table>'})['output']`],
 ['escaped slots',`renderStandardListPage({title:renderStandardListTable({}),className:renderTablePagination({}),filtersHtml:'',tableHtml:'<table>raw</table>',paginationHtml:''})`],
 ['inverted slots',`renderStandardListPage({tableHtml:renderTablePagination({}),paginationHtml:renderStandardListTable({})})`],
 ]) check('R2-01 '+name,()=>assert.equal(hasStandardListContract(imports+`export function renderListPage(){return ${expr}}`),false));
check('R2-01 unused exported helper',()=>assert.equal(hasStandardListContract(imports+`export function renderUnusedHelper(){return ${good}} export function renderFakePage(){return '<table>raw</table>'}`),false));
check('R2-01 two page outputs require both',()=>assert.equal(hasStandardListContract(imports+`export function renderOnePage(){return ${good}} export function renderOtherPage(){return '<table>raw</table>'}`),false));
check('R1-02 local same-name stubs',()=>assert.equal(hasStandardListContract(`function renderStandardListPage(x){return ''}function renderStandardListTable(x){return ''}function renderTablePagination(x){return ''}export function renderListPage(){return ${good}}`),false));
const wrap=text=>'export function renderOldPage(){return `<table><tbody><tr><td>'+text+'</td></tr></tbody></table>`}';
for(const [a,b] of [['10 件','-10 件'],['2 箱','2 吨'],['<span>2</span><span>盒</span>','<span>2</span><span>桶</span>'],['<span>20</span><span>尺</span>','<span>20</span><span>寸</span>'],['<b>${quantity}</b><span>盒</span>','<b>${quantity}</b><span>桶</span>']])check('R1-01/R2-02 '+a,()=>assert.equal(isNonStructuralListCorrection(wrap(a),wrap(b)),false));
check('LIST copy positive',()=>assert(isNonStructuralListCorrection(wrap('需求'),wrap('任务'))));
for(const fake of [`const tutorial='@page-pattern: detail';`,`const tutorial=\`// @page-pattern: detail\`;`,`/* @page-pattern: detail */`])check('R2-03 ignore literal/block directive '+fake.slice(0,16),()=>{assert.equal(parsePagePattern(fake),null);assert.throws(()=>assertListPage('src/pages/fake.ts',fake+`export function renderFakePage(){return '<table data-list="true"><tbody>raw</tbody></table>'}`,null,{}));});
check('R2-03 standalone positive',()=>assert.equal(parsePagePattern('// @page-pattern: list\nexport const x=1'),'list'));
check('R2-03 duplicate rejected',()=>assert.throws(()=>parsePagePattern('// @page-pattern: detail\n// @page-pattern: list')));
check('R2-03 pagination literal does not exempt',()=>assert.equal(hasStandardListContract(imports+`const text='// @list-pagination: none — 固定字典';export function renderListPage(){return renderStandardListPage({tableHtml:renderStandardListTable({}),paginationHtml:''})}`),false));
const technical=`# Technical
## 基本信息
- 日期：2026-10-10
- 任务 / 需求编号：R2-PROBE
- 验证人：Independent reviewer
## 影响判定
- 记录模式：无用户可见影响声明
- 用户可见影响：无
- 判定依据：内部类型名变化，运行输出未改
## 变更覆盖与验证
### 受管文件
- \`src/main.ts\`
### 技术证据
- 对象与结果：相同输入 HTML 与写入数量一致
- 证据：/tmp/contract-results.json 逐项比较
### 验证命令
- \`node --test tests/contract.test.ts\`：通过
`;
const verify=source=>validatePrototypeReviewCoverage(['src/main.ts'],[{path:'docs/prototype-review-records/probe.md',source}]);
check('R2-05 visible technical control',()=>verify(technical));
check('R2-05 unclosed all evidence reject',()=>assert.throws(()=>verify('<!--\n'+technical)));
check('R2-05 closed preface leaves visible evidence',()=>verify('<!-- example -->\n'+technical));
check('R1-05 indented technical reject',()=>assert.throws(()=>verify(technical.split('\n').map(x=>/^-/.test(x)?'    '+x:x).join('\n'))));
for(const suffix of ['（本次未运行）','，但实际执行失败',' (12/12)'])check('R1-04 status suffix '+suffix,()=>assert.throws(()=>verify(technical.replace('：通过','：通过'+suffix))));
const before=wrap('需求'),after=wrap('任务'),page='src/pages/old.ts';
const hashTable=`## 历史列表局部修正\n| 文件 | 基准 SHA256 | 当前 SHA256 | 依据 |\n| --- | --- | --- | --- |\n| \`${page}\` | ${sha256(before)} | ${sha256(after)} | 仅标题文本改变，保留动作与数量 |\n`;
const light=`# Light
## 基本信息
- 日期：2026-10-10
- 任务 / 需求编号：R2-PROBE
- 验证人：Independent reviewer
## 影响判定
- 记录模式：轻量可见变更
- 用户可见影响：有
- 判定依据：仅标题文本变化，输出结构未改
- 契约变化：无
## 轻量变更
- 对象 / 路由：列表 /orders
- 改了什么：需求改任务
- 保留什么：数据和动作不变
- 如何验证：实际页面核对标题和保存
- 结果：通过
## 受管文件
- \`${page}\`
## 页面证据
- 版本：fixture-r2, 1366x768, 当前工作树
- 证据：/tmp/page.png 标题和保存动作已核对
## 性能结论
- 结论：不适用
- 依据：仅页面标题文本，不改初始化布局或事件链
## 验证命令
- \`node --test tests/copy.test.ts\`：通过
`;
const historical=source=>assertHistoricalListCorrection(page,before,after,[{path:'docs/prototype-review-records/light.md',source}]);
check('R1-11 correct hash control',()=>historical(light+hashTable));
for(const [name,table] of [['closed comment','<!--\n'+hashTable+'-->'],['unclosed comment','<!--\n'+hashTable],['indented',hashTable.split('\n').map(x=>'    '+x).join('\n')],['fenced','```md\n'+hashTable+'```']])check('R1-11/R2-05 hidden hash '+name,()=>assert.throws(()=>historical(light+table)));
console.log(`TOTAL ${count} independent replay and adjacent cases passed`);
