async(page)=>{
 const context=await page.context().browser().newContext();const p=await context.newPage();const errors=[];p.on('pageerror',e=>errors.push(String(e)));
 await p.addInitScript(()=>{const get=Storage.prototype.getItem,set=Storage.prototype.setItem;Storage.prototype.getItem=function(){throw new DOMException('验收：禁止 localStorage','SecurityError')};Storage.prototype.setItem=function(){throw new DOMException('验收：容量不足','QuotaExceededError')};});
 await p.goto('http://127.0.0.1:43226/fcs/craft/cutting/replacement-fabric-fei-tickets');
 let present=false;try{await p.locator('[data-hpb-page]').waitFor({timeout:10000});present=true}catch{}
 const body=(await p.locator('body').innerText()).slice(-1600);await context.close();return{present,errors,body};
}
