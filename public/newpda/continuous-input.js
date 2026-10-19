
'use strict';
(()=>{
const scanner=e=>e instanceof HTMLInputElement&&(e.closest('.cf-scan,.kl-scan,.dpw-scan')||['asa-scan','wb-code','wb-outCode','pf-scan','pf-material-code','scan-input'].includes(e.id)||e.id.startsWith('pf-code-'));
function focusAgain(id){queueMicrotask(()=>{const input=document.getElementById(id);if(!input||input.disabled||input.type==='hidden')return;input.focus({preventScroll:true});input.select();});}
window.addEventListener('keydown',e=>{if(e.key==='Enter'&&scanner(e.target)){window.pdaFloorRememberOrigin?.();focusAgain(e.target.id);}},true);
window.addEventListener('click',e=>{
 const b=e.target.closest('button');if(!b)return;if(b.closest('#content'))window.pdaFloorRememberOrigin?.();
 const scanButton=b.matches('[data-cf^="scan:"],[data-kl^="scan:"],[data-dpw^="scan:"],[data-asa="scan"],[data-wb="scan"],[data-wb="water-scan"],[data-pf^="scan"],[data-pf="material-scan"],[data-action="scan-confirm"]');
 if(scanButton){const i=b.closest('.cf-scan,.kl-scan,.dpw-scan,.input-box')?.querySelector('input')||document.querySelector('#asa-scan,#wb-code,#wb-outCode,#pf-scan,#scan-input');if(i)focusAgain(i.id);}
 if(window.pdaFloorResumeTarget?.(b)){e.preventDefault();e.stopImmediatePropagation();return;}
 const root=b.dataset.go;if(window.pdaFloorNavigate&&(b.matches('[data-cf="back"],[data-pf="back"],[data-kl="back"],[data-dpw="back"],[data-asa="back"]')||b.matches('[data-wb^="home:"]')||['receive-list','process-list','warehouse-home'].includes(root))){
  e.preventDefault();e.stopImmediatePropagation();window.pdaFloorNavigate((b.classList.contains('back')?window.pdaFloorOrigin?.():null)||root||b.dataset.wb?.slice(5));
 }
},true);
window.addEventListener('change',e=>{if(['cf-role','kl-role','dpw-role','pf-role','asa-role','wb-role','asa-factory','wb-factory','dpw-factory-select'].includes(e.target.id)&&window.pdaFloorHandoff?.(e.target.id,e.target.value)){e.preventDefault();e.stopImmediatePropagation();}},true);
window.addEventListener('input',e=>{const el=e.target;if(scanner(el)){const wasDirty=dirty;queueMicrotask(()=>{dirty=wasDirty;if(el.id==='wb-code'&&!wasDirty){for(const f of Object.values(window.waterBindingFlow?.forms||{}))if(Object.keys(f).every(k=>['_dirty','code'].includes(k)))delete f._dirty;}});return;}if(!(el instanceof HTMLInputElement)||!['numeric','decimal'].includes(el.inputMode)||!el.closest('#app'))return;
 // A single decimal comma is a decimal separator, never a grouping separator.
 if(/^-?\d*,\d*$/.test(el.value)){el.value=el.value.replace(',','.');}
},true);
})();

// V18: the device Back key uses the same in-memory continuation as the visible Back button.
window.addEventListener('DOMContentLoaded',()=>{
 const roots=['receive-list','process-list','warehouse-home'];
 let currentURL=location.href;
 const replace=history.replaceState.bind(history);
 history.replaceState=function(data,unused,url){if(url){const u=new URL(url,location.href);if(u.pathname.endsWith('/index.html'))u.searchParams.set('v','34');url=u;}replace(data,unused,url);currentURL=location.href;};
 history.pushState({pdaDeviceBack:true},'',currentURL);
 window.addEventListener('popstate',()=>{
  const overlay=document.querySelector('#overlay .sheet');
  if(overlay||!window.pdaSessionLoggedIn||window.sewingReturn?.locked||!roots.includes(screen)&&window.pdaSessionLoggedIn){
   history.pushState({pdaDeviceBack:true},'',currentURL);
   if(overlay){closeSheet();return;}
   if(!window.pdaSessionLoggedIn)return;
   if(window.sewingReturn?.locked){document.querySelector('[data-sr-exit]')?.click();return;}
   window.pdaFloorNavigate?.();
  }else history.back();
 });
});
// Focus is restored after a device return; an Enter suffix identifies only, never submits quantity.
window.pdaFocusScanner=()=>queueMicrotask(()=>{if(!window.pdaSessionLoggedIn||document.querySelector('#overlay .sheet'))return;const input=document.querySelector('#content .cf-scan input,#content .kl-scan input,#content .dpw-scan input,#asa-scan,#pf-scan,#pf-material-code,[id^=pf-code-],#wb-code,#wb-outCode');if(input&&!input.disabled){input.focus({preventScroll:true});input.select();}});
