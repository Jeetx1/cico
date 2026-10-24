/* ================================================================ boot */
Kit.init({
  app: 'calorie-tracker', defaultTheme: 'ember', icon: appIcon,
  toolEffects: [
    { id: 'bite', kind: 'signature', tool: 'CICO', name: 'The bite', desc: 'Logged kcal fly into the day\u2019s ring; the ring swallows them with a pulse and its arc grows from the old total to the new one. Glass sends an ice droplet, Ember a spark, Prism a beam of light.' },
    { id: 'daylevel', kind: 'extra', tool: 'CICO', name: 'Day level', desc: 'The background fills like a glass as the day\u2019s kcal rise. A fine line marks the target, and the colour warms once you are past it. Takes the place of the theme\u2019s ambient light here.' }
  ],
  /* a new look: the page is redrawn quietly (no replayed animations), so colours drawn by code follow too */
  onTheme: (id, first) => { if (!first && DATA && !$('#shell').hidden){ RUHIG = true; try { malSeite(); } finally { RUHIG = false; } } pegel(); },
  onEffect: id => { if (id === 'daylevel') pegel(); },
  toast: (m, o) => toast(m, !!(o && o.type === 'error'), o && o.sub)
});
Kit.initDropdowns('select.select');
/* the chart's labels are fitted to its width: redraw on a real width change only (the iPhone fires resize
   whenever the address bar slides in or out), and quietly, without replaying the animations */
let resizeT = null, breite = window.innerWidth;
window.addEventListener('resize', () => {
  clearTimeout(resizeT);
  resizeT = setTimeout(() => {
    if (window.innerWidth === breite) return;
    breite = window.innerWidth;
    if (DATA && S.tab === 'overview'){ RUHIG = true; try { seiteOverview(); } finally { RUHIG = false; } }
  }, 250);
});
/* a tab left open over midnight moves on to the new day */
document.addEventListener('visibilitychange', () => {
  if (document.hidden || !DATA) return;
  const neu = lokalHeute(); if (neu === TODAY) return;
  if (S.tag === TODAY) S.tag = neu;
  TODAY = neu; malSeite();
});
/* hosted (GitHub Pages): home-screen icon, manifest and the offline cache. Opened as a local file, none of this
   is loaded, and the app works exactly the same. */
const GEHOSTET = location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1';
if (GEHOSTET){
  document.head.appendChild(h('link', { rel: 'manifest', href: 'manifest.webmanifest' }));
  if ('serviceWorker' in navigator){
    const hatteSchon = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.register('sw.js').catch(() => {});
    navigator.serviceWorker.addEventListener('controllerchange', () => { if (hatteSchon) toast('A new version is ready.', false, 'Close and reopen the app to use it.'); });
  }
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
}
zeigeStart();
})();
</script>
</body>
</html>
