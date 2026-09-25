async(page)=>{
 const c=await page.context().browser().newContext(),p=await c.newPage();
 try {await p.route('**/acceptance-fixture',r=>r.fulfill({contentType:'text/html',body:'Isolated Mock prerequisite'}));await p.goto('http://127.0.0.1:43235/fcs/dispatch/workbench?type=NON_SEWING');await p.locator('[data-unified-dispatch-page]').waitFor();const fixture=await p.evaluate(async()=>{try{return await(await import('/output/playwright/hpb/acceptance-source-ui-final/ui-fixture.ts?v=4')).setup('completion')}catch(e){return{error:e.stack}}});if(fixture.error)return fixture;return{fixture,explicitMockPrerequisite:true}}
 finally{await c.close()}
}
