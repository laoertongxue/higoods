import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import ts from 'typescript'

// A fixed-version, identity-only edit contract. It does not execute the unchanged
// legacy browser drivers or prove their old UI selectors/formula workflows.
const baseline='821b9ea54040ec03662acbe6ae3d2c62608fe273'
const files=[
  'tests/factory-base-connect-chain.spec.ts','tests/factory-capacity-profile.spec.ts',
  'tests/factory-profile-process-abilities.spec.ts','tests/pattern-piece-instance-special-craft.spec.ts',
  'tests/process-craft-dictionary-rebuild.spec.ts','tests/production-craft-dict-formula-layout.spec.ts',
  'tests/production-craft-dict-output-value-rules.spec.ts',
]
const dictionary=execFileSync('git',['show',baseline+':src/data/fcs/process-craft-dict.ts'],{encoding:'utf8'})
const labels=[...dictionary.matchAll(/^\s*([^\s:\n]+): (300000[345]),/gm)].map(match=>({name:match[1],code:'CRAFT_'+match[2]}))
assert.equal(labels.length,3)
const canonicalName='缝边绣',canonicalCode='CRAFT_3000010'
const printer=ts.createPrinter({newLine:ts.NewLineKind.LineFeed})
function normalized(source:string,path:string,migrate:boolean):string {
  const ast=ts.createSourceFile(path,source,ts.ScriptTarget.Latest,true)
  const identifiers=new Map<string,string>()
  const visitDeclarations=(node:ts.Node):void=>{
    if(ts.isVariableDeclaration(node)&&ts.isIdentifier(node.name)&&node.initializer){
      const text=node.initializer.getText(ast),suffix=/(Sheet|Checkbox|Card)$/.exec(node.name.text)?.[1]
      if(suffix&&labels.some(label=>text.includes(label.name)||text.includes(label.code)))identifiers.set(node.name.text,'seam'+suffix)
    }
    ts.forEachChild(node,visitDeclarations)
  }
  if(migrate)visitDeclarations(ast)
  const result=ts.transform(ast,[context=>{
    const visit:ts.Visitor=node=>{
      if(migrate&&ts.isIdentifier(node)&&identifiers.has(node.text))return ts.factory.createIdentifier(identifiers.get(node.text)!)
      if(ts.isStringLiteral(node))return ts.factory.createStringLiteral(migrate?labels.reduce((text,label)=>text.replaceAll(label.name,canonicalName).replaceAll(label.code,canonicalCode),node.text):node.text)
      if(migrate&&ts.isArrayLiteralExpression(node)){
        const children=node.elements.map(element=>ts.visitNode(element,visit) as ts.Expression)
        let seen=false
        return ts.factory.updateArrayLiteralExpression(node,ts.factory.createNodeArray(children.filter(element=>{
          if(!ts.isStringLiteral(element)||element.text!==canonicalName)return true
          if(seen)return false;seen=true;return true
        }),node.elements.hasTrailingComma))
      }
      return ts.visitEachChild(node,visit,context)
    }
    return root=>ts.visitNode(root,visit) as ts.SourceFile
  }])
  const text=printer.printFile(result.transformed[0] as ts.SourceFile);result.dispose();return text
}
function assertIdentityOnly(previous:string,current:string,path:string):void {
  const actual=normalized(current,path,false),expected=normalized(previous,path,true)
  let at=0;while(at<Math.max(actual.length,expected.length)&&actual[at]===expected[at])at++
  assert(actual===expected,path+': identity-only coverage rejects changes to browser logic, selectors, assertions or unrelated fixtures; '+JSON.stringify({actual:actual.slice(Math.max(0,at-80),at+160),expected:expected.slice(Math.max(0,at-80),at+160)}))
}
for(const path of files)test(path+': only canonical craft identity updated; old browser driver unexecuted',()=>{
  assertIdentityOnly(execFileSync('git',['show',baseline+':'+path],{encoding:'utf8'}),readFileSync(path,'utf8'),path)
})
test('identity-only edit contract rejects an unrelated selector or weakened assertion',()=>{
  const path=files[0],source=execFileSync('git',['show',baseline+':'+path],{encoding:'utf8'}),current=readFileSync(path,'utf8')
  for(const changed of [current.replace('await expect(','await ignored('),current.replace('craft-dict-detail-sheet','unrelated-sheet')]){
    assert.notEqual(changed,current);assert.throws(()=>assertIdentityOnly(source,changed,path),/identity-only coverage rejects/)
  }
})
