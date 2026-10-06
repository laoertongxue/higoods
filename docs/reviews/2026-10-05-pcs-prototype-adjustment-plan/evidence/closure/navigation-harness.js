// Temporary instrumentation loaded before the built app, only for local preview measurement.
// No storage writes, app calls, content changes, skipped work or hidden warmup.
(() => {
  const roots = '[data-pcs-technical-data-page],[data-tech-pack-page-root],[data-pcs-product-archive-root],[data-pcs-material-archive-page],[data-pcs-material-detail],[data-pcs-material-sku-detail],[data-pcs-material-edit],[data-pcs-material-sku-edit],[data-pcs-material-process-edit],[data-pcs-channel-page],[data-pcs-channel-stores-page],#pcs-config-workspace-root,[data-fcs-material-plan-root],[data-pms-mpo-root]';
  const frame = () => new Promise(requestAnimationFrame);
  let active = false, done = false, revision = 0;
  window.__qaNavigation = null;
  async function inspect() {
    const root = document.querySelector(roots) || (location.pathname.startsWith('/pcs/testing/') ? document.querySelector('[data-page-content-root]:has(h1)') : null);
    if (active || done || !root || !root.textContent.trim()) return;
    const token = revision;
    active = true;
    await frame();
    const images = [...root.querySelectorAll('img')].filter(img => {const box=img.getBoundingClientRect();return box.width>0&&box.height>0&&box.top<innerHeight&&box.bottom>0});
    await Promise.all(images.map(img=>img.decode().catch(()=>{})));
    await frame(); await frame();
    if (root.isConnected && token === revision) {
      window.__qaNavigation={url:location.pathname,durationMs:performance.now(),images:images.length,brokenImages:images.filter(img=>!img.naturalWidth).length,root:root.getAttributeNames().filter(name=>name.startsWith('data-')),navigationType:performance.getEntriesByType('navigation')[0]?.type};
      done=true;
    }
    active=false;
    if(!done) inspect();
  }
  new MutationObserver(()=>{revision++;inspect()}).observe(document,{subtree:true,childList:true,attributes:true,characterData:true});
})();
