async root=>{
 const results=[];
 for(const [account,path] of [['OWN-CUTTING-001_operator','/fcs/craft/cutting/warehouse-management/wait-handover'],['OWN-CUTTING-001_operator','/fcs/pda/cutting/simple-cut-piece-handover'],['ID-F001_admin','/fcs/craft/cutting/warehouse-management/wait-handover']]){
  const c=await root.context().browser().newContext(),p=await c.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
  await p.goto('http://127.0.0.1:43236/fcs/pda/auth/login');await p.getByRole('textbox',{name:'登录账号'}).fill(account);await p.getByRole('textbox',{name:'密码',exact:true}).fill('123456');await p.getByRole('button',{name:'登录',exact:true}).click();await p.waitForURL('**/fcs/pda/exec');await p.goto('http://127.0.0.1:43236'+path);
  if(!path.includes('/pda/'))await p.locator('[data-simple-cut-open]').click();await p.locator('[data-simple-cut-content]').waitFor();const text=await p.locator('[data-simple-cut-content]').innerText();const disabled=await p.locator('[data-simple-cut-action=confirm]').isDisabled();if(!disabled||!text.includes('仓管'))throw Error('非仓管可确认 '+account+' '+text);results.push({account,path,disabled,text,errors});await c.close();
 }
 return results;
}
