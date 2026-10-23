import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import ts from 'typescript'
import { renderStandardListPage } from '../../src/components/ui/list-page.ts'
import { escapeHtml } from '../../src/utils.ts'

const path='src/pages/process-factory/wool/stock-allocations.ts'
function extract(source:string) {
  const ast=ts.createSourceFile(path,source,ts.ScriptTarget.Latest,true)
  const node=ast.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text==='renderWoolStockAllocationsPage')!
  return ts.transpileModule(node.getText(ast).replace(/^export /,''),{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText
}
const original=extract(execFileSync('git',['show','821b9ea54040ec03662acbe6ae3d2c62608fe273:'+path],{encoding:'utf8'}))
const current=extract(readFileSync(path,'utf8'))

test('毛织备料桌面/PDA显式分支保留原HTML、筛选状态和控制器调用次数',()=>{
  for(const pda of [false,true]) for(const loggedIn of [false,true]) {
    function render(javascript:string) {
      const calls:string[]=[]
      const state={url:'',keyword:'draft',factoryId:'draft',rowId:'draft',feedback:'draft',currentPage:3,showAll:true,reviewing:true,draft:{qty:1}}
      const dependencies={state,isPda:()=>pda,getPdaSession:()=>loggedIn?{factoryName:'历史毛织厂',userName:'仓管'}:null,
        controller:{ensurePreferencesLoaded:()=>calls.push('preferences'),installColumnDragEvents:()=>calls.push('drag'),renderColumnSettings:()=>'<section>columns</section>',getView:()=>{calls.push('desktop');return {tableHtml:'<table>actual rows</table>',paginationHtml:'<footer>actual pagination</footer>'}}},
        pdaView:()=>{calls.push('pda');return {tableHtml:'<article>actual cards</article>',paginationHtml:'<footer>pda pagination</footer>'}},
        basePath:()=>'/fcs/craft/wool/pending-receipts',renderOverlay:()=>'<section>overlay</section>',e:escapeHtml,
        filters:()=>'<section>filters</section>',stats:()=>'<section>stats</section>',button:()=>'<button>列设置</button>',renderStandardListPage,
      }
      const html=new Function('dependencies',`with(dependencies){${javascript};return renderWoolStockAllocationsPage()}`)(dependencies)
      return {html,state,calls}
    }
    assert.deepEqual(render(current),render(original),JSON.stringify({pda,loggedIn}))
    assert.deepEqual(render(current).calls,pda&&!loggedIn?[]:pda?['preferences','drag','pda']:['preferences','drag','desktop'])
  }
})

test('毛织两仓保留原排序分页和各标签HTML，仅增加原生保存中标记',()=>{
  const warehousePath='src/pages/process-factory/wool/warehouse.ts'
  function extractWarehouse(source:string) {
    const ast=ts.createSourceFile(warehousePath,source,ts.ScriptTarget.Latest,true)
    const nodes=ast.statements.filter(n=>ts.isFunctionDeclaration(n)&&['currentView','renderPageFromRuntime'].includes(n.name?.text||''))
    assert.equal(nodes.length,2)
    return ts.transpileModule(nodes.map(n=>n.getText(ast)).join('\n'),{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText
  }
  const originalWarehouse=extractWarehouse(execFileSync('git',['show','821b9ea54040ec03662acbe6ae3d2c62608fe273:'+warehousePath],{encoding:'utf8'}))
  const currentWarehouse=extractWarehouse(readFileSync(warehousePath,'utf8'))
  for(const mode of ['WAIT_PROCESS','WAIT_HANDOVER']) for(const tab of ['inventory','receipts','issues','returns','inbounds','outbounds','adjustments','transfers']) for(const total of [0,3,25]) {
    function render(javascript:string) {
      const states={ [mode]:{activeTab:tab,currentPage:3,saving:false,sort:{key:'quantity',direction:'desc'}} }
      const dependencies={states,columns:[{key:'quantity',sortValue:(row:{qty:number})=>row.qty}],
        filteredRows:()=>Array.from({length:total},(_,i)=>({qty:i+1})),
        sortStandardListRows:(rows:{qty:number}[])=>[...rows].reverse(),
        paginateStandardListRows:(rows:unknown[],page:number,size:number)=>{const totalPages=Math.max(1,Math.ceil(rows.length/size)),currentPage=Math.min(page,totalPages),from=(currentPage-1)*size;return{rows:rows.slice(from,from+size),currentPage,totalPages,total:rows.length,from:rows.length?from+1:0,to:Math.min(from+size,rows.length),pageSize:size}},
        preferences:()=>({pageSize:10}),EVENT_PREFIX:'wool-warehouse',PAGE_SIZE_OPTIONS:[10,20,50],escapeHtml,
        renderStandardListTable:(options:unknown)=>JSON.stringify(options),renderTablePagination:(options:unknown)=>JSON.stringify(options),renderStandardListPage,
        renderFeedback:()=>'<p>feedback</p>',renderFilters:()=>'<form>filters</form>',tabsForMode:()=>[{key:tab,label:tab}],renderTabBar:()=>'<nav>tabs</nav>',renderColumnOverlay:()=>'',renderBusinessOverlay:()=>'',
      }
      const html=new Function('dependencies',`with(dependencies){${javascript};return renderPageFromRuntime('${mode}')}`)(dependencies)
      return {html,states}
    }
    const actual=render(currentWarehouse), baseline=render(originalWarehouse)
    assert.ok(actual.html.includes('data-wool-warehouse-saving="false"'), '新增属性准确表示当前未保存中')
    assert.deepEqual({...actual,html:actual.html.replace(' data-wool-warehouse-saving="false"','')},baseline,JSON.stringify({mode,tab,total}))
  }
})
