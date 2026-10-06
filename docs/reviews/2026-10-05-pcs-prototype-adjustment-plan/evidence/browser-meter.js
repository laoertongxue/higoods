// QA instrumentation injected into the local preview's generated dist/index.html only.
// No app storage, no skipped render, no warm-up filter. Measures visible images and three paint frames.
(() => {
  const roots = '[data-pcs-product-archive-root],[data-pcs-material-archive-page],[data-pcs-material-detail],[data-pcs-material-sku-detail],[data-pcs-material-edit],[data-pcs-material-sku-edit],[data-pcs-material-process-edit],[data-pcs-channel-page],[data-pcs-channel-stores-page],#pcs-config-workspace-root,[data-fcs-material-plan-root],[data-pms-mpo-root]';
  const metrics = window.__r1Metrics = [];
  let pending = { label: 'navigation', start: 0, predicate: () => !!document.querySelector(roots) }, processing = false;
  const paint = () => new Promise(requestAnimationFrame);
  window.__r1Arm = (label, predicate, eventType = 'click') => { window.__r1Armed = { label, predicate, eventType }; };
  for (const eventType of ['click', 'input', 'change', 'toggle']) document.addEventListener(eventType, () => {
    if (!window.__r1Armed || (window.__r1Armed.eventType && window.__r1Armed.eventType !== eventType)) return;
    pending = { ...window.__r1Armed, start: performance.now() }; window.__r1Armed = null;
    inspect();
  }, true);
  async function inspect() {
    if (!pending || processing || !pending.predicate()) return;
    const item = pending; processing = true;
    await paint();
    const root = document.querySelector(roots);
    const images = root ? [...root.querySelectorAll('img')].filter(img => { const b = img.getBoundingClientRect(); return b.width > 0 && b.height > 0 && b.top < innerHeight && b.bottom > 0; }) : [];
    await Promise.all(images.map(img => img.decode().catch(() => {})));
    await paint(); await paint();
    if (item === pending && item.predicate()) {
      const end = performance.now();
      metrics.push({ label: item.label, start: item.start, end, durationMs: end - item.start, url: location.pathname, images: images.length, brokenImages: images.filter(img => !img.naturalWidth).length });
      pending = null;
    }
    processing = false;
    if (pending && pending !== item) inspect();
  }
  new MutationObserver(inspect).observe(document, { subtree: true, childList: true, attributes: true });
})();
