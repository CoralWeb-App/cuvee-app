
console.log('APP_JS_VERSION: ' + (document.currentScript?.src || 'unknown')); // src include ?v=N, sempre aggiornato da solo
const stack=[];

// ── Boot splash ───────────────────────────────────────────────────────
// Copre v-splash (che ha i pulsanti "Entra"/"Accedi") finché initAuth() non
// ha determinato se l'utente è già loggato, per evitare che si veda per un
// istante la schermata sbagliata prima dello switch automatico alla Home.
const _bootStart = Date.now();
const BOOT_SPLASH_MIN_MS = 600; // dura almeno così tanto, anche se la sessione risulta già pronta subito (niente lampeggio del logo)
let _bootSplashHidden = false;
function hideBootSplash() {
  if (_bootSplashHidden) return;
  _bootSplashHidden = true;
  const el = document.getElementById('boot-splash');
  if (!el) return;
  const wait = Math.max(0, BOOT_SPLASH_MIN_MS - (Date.now() - _bootStart));
  setTimeout(() => { el.classList.add('hide'); }, wait);
}
// Rete di sicurezza: se la catena di avvio si blocca per qualche motivo
// (rete lenta, errore imprevisto), non lasciare l'utente bloccato sullo
// splash all'infinito.
setTimeout(hideBootSplash, 7000);
function go(id){
  // La registrazione richiede prima la conferma di avere almeno 18 anni,
  // così chi rifiuta non arriva mai al form (nessun account creato da annullare).
  if(id === 'v-reg' && !_ageGateOk){
    id = 'v-age-gate-pre';
  }
  // Viste protette: richiedono login
  const protectedViews = ['v-home','v-guida','v-maison','v-carnet','v-profile',
    'v-detail','v-carnet-new','v-carnet-detail','v-salvati','v-wishlist',
    'v-bottiglie','v-bottiglia-detail',
    'v-subscription','v-paywall','v-scan-history','v-age-gate','v-complete-profile',
    'v-zone-montagne','v-zone-blancs','v-zone-marne','v-zone-bar','v-zone-sezanne',
    'v-guida-metodo','v-guida-glossario','v-guida-conservazione','v-guida-zone','v-guida-uve','v-guida-dosaggi','v-guida-service','v-guida-formati',
    'v-notifications'];
  if(protectedViews.includes(id) && !currentUser){
    id = 'v-splash';
  }
  const cur=document.querySelector('.view.active');
  if(cur)stack.push(cur.id);
  document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));
  const target=document.getElementById(id);
  if(target){target.classList.add('active');}
  const scrl=document.querySelector('#'+id+' .scroll');
  if(scrl)scrl.scrollTo(0,0);
  // Load dynamic data when entering certain views
  if(id==='v-onb'){ onbIdx=0; onbApplySlide(onbData[0]); }
  if(id==='v-home'){ updatePremiumUI(); updateHomeScanCount(); checkUnreadNotifications(); checkWelcomeNotification(); }
  if(id==='v-notifications') renderNotificationsUI();
  if(id==='v-guida-glossario') loadGlossario();
  if(id==='v-paywall'){ loadPaywallOfferings(); }
  if(id==='v-scan-history') {
    const backLabels = { 'v-home':'Home', 'v-profile':'Il mio profilo' };
    const prevId = cur ? cur.id : 'v-home';
    const lbl = document.getElementById('scan-history-back-label');
    if(lbl) lbl.textContent = backLabels[prevId] || 'Indietro';
    renderScanHistoryUI();
  }
  if(id==='v-carnet'){
    activeCaliceFilter = 0;
    activeSearchQuery = '';
    activeTypeFilter = 'tutti';
    const si = document.getElementById('carnet-search');
    if(si) si.value = '';
    const clr = document.getElementById('carnet-search-clear');
    if(clr) clr.style.display = 'none';
    document.querySelectorAll('.calice-btn').forEach(b => b.classList.remove('on'));
    const allBtn = document.getElementById('cf-all');
    if(allBtn) allBtn.classList.add('on');
    updateCarnetUI();
  }
  if(id.indexOf('v-zone-')===0) applyCruPremiumGating(id);
  if(id==='v-maison') loadAndRenderMaison();
  if(id==='v-bottiglie') loadAndRenderBottiglie();
  if(id==='v-salvati') updateSalvatiUI();
  if(id==='v-subscription') loadSubscriptionScreen();
  if(id==='v-profile') updateScanStatsUI().catch(() => {});
  if(id==='v-wishlist') updateWishlistUI();
  // Aggiorna tab attivo nella bottom nav condivisa
  updateBottomNav(id);
}
function updateBottomNav(id){
  // View senza bottom nav (fuori dall'app: splash, onboarding, auth, paywall)
  const noNav = ['v-splash','v-onb','v-reg','v-login','v-success','v-paywall','v-age-gate','v-age-gate-pre','v-complete-profile'];
  const nav = document.getElementById('shared-bottom-nav');
  if(nav) nav.style.display = noNav.includes(id) ? 'none' : 'flex';

  const map = {
    'bn-home':       ['v-home','v-scan-history'],
    'bn-produttori': ['v-maison','v-detail'],
    'bn-scan':       ['v-scan-result'],
    'bn-champagne':  ['v-bottiglie','v-bottiglia-detail'],
    'bn-carnet-nav': ['v-carnet','v-carnet-new','v-carnet-detail']
  };
  Object.entries(map).forEach(([btnId, views])=>{
    const el = document.getElementById(btnId);
    if(!el) return;
    el.classList.toggle('on', views.includes(id));
  });
}
function goBack(){
  if(stack.length>0){
    const p=stack.pop();
    document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));
    const t=document.getElementById(p);
    if(t)t.classList.add('active');
    updateBottomNav(p);
  }
}
function goGuida(tab){
  go('v-guida-'+tab);
}
function goConservazione(){
  go(isPremium() ? 'v-guida-conservazione' : 'v-paywall');
}
// Icona a grappolo (non presente nel webfont ti-*, quindi SVG inline) — usata
// per la slide "Maison & Vigneron" al posto della generica ti-building.
const ONB_GRAPE_SVG = '<svg width="56" height="70" viewBox="0 0 44.309 55.104" fill="{{color}}" style="opacity:.85;">'
  + '<g><path d="M38.691,7.996c-2.373-1.104-4.788-0.948-5.4,0.349c-0.608,1.294,0.82,3.239,3.194,4.345c2.375,1.106,7.147,2.046,7.757,0.75C44.852,12.143,41.063,9.101,38.691,7.996z"/><path d="M25.552,25.806c-0.864,0.293-1.79,0.454-2.752,0.454c-1.258,0-2.446-0.272-3.524-0.756c-0.049-0.019-0.104-0.046-0.152-0.067c-1.278,1.134-2.115,2.764-2.195,4.583c-0.005,0.103-0.009,0.204-0.009,0.308c0,0.951,0.205,1.854,0.572,2.672c0.165,0.37,0.366,0.722,0.594,1.05c0.332,0.482,0.729,0.912,1.173,1.282c0.626,0.528,1.353,0.938,2.147,1.206c0.541,0.179,1.113,0.293,1.703,0.322c0.13,0.013,0.259,0.015,0.394,0.015c0.276,0,0.551-0.02,0.818-0.055c2.639-0.32,4.789-2.192,5.505-4.676C27.531,30.845,25.9,28.524,25.552,25.806z"/><path d="M16.218,17.4c-0.004,0.103-0.008,0.199-0.008,0.303c0,0.377,0.031,0.742,0.095,1.104v0.005c0.24,1.415,0.939,2.674,1.933,3.622c0.23,0.223,0.482,0.426,0.746,0.619c0.13,0.088,0.258,0.172,0.393,0.251c0.196,0.122,0.397,0.229,0.608,0.331c0.447,0.21,0.926,0.368,1.422,0.475c0.448,0.098,0.914,0.146,1.392,0.146c0.729,0,1.432-0.119,2.089-0.337c0.224-0.075,0.446-0.158,0.657-0.261c0.022-0.195,0.054-0.394,0.095-0.584c0.062-0.328,0.147-0.654,0.245-0.967c0.608-1.885,1.857-3.485,3.489-4.55c-0.041-1.894-0.886-3.593-2.218-4.757c0.165-0.222,0.363-0.475,0.577-0.748c0.191-0.24,0.407-0.502,0.626-0.768c2.522-3.035,7.402-8.186,11.73-8.616c0.738-0.077,1.276-0.73,1.197-1.466c-0.071-0.733-0.724-1.263-1.467-1.197c-5.02,0.507-10.13,5.486-13.533,9.58c-0.23,0.285-0.447,0.556-0.647,0.806c-0.081,0.099-0.162,0.195-0.238,0.293l-0.401,0.523c-0.071,0.088-0.139,0.179-0.201,0.258c-0.632-0.21-1.304-0.314-2-0.314c-1.592,0-3.05,0.559-4.187,1.494c-1.387,1.133-2.299,2.823-2.394,4.726V17.4z"/><path d="M9.039,44.346c-0.777,0.23-1.602,0.356-2.451,0.356c-1.553,0-3.015-0.414-4.272-1.134C0.899,44.77,0,46.553,0,48.552c0,3.619,2.952,6.552,6.588,6.552c3.452,0,6.284-2.641,6.557-6.005C11.238,48.098,9.754,46.399,9.039,44.346z"/><path d="M2.266,41.096c0.286,0.249,0.6,0.478,0.926,0.672c0.397,0.24,0.824,0.436,1.271,0.587c0.666,0.229,1.383,0.348,2.125,0.348c0.702,0,1.383-0.11,2.018-0.311c-0.004-0.023-0.009-0.052-0.009-0.077C8.574,42.061,8.56,41.803,8.56,41.54c0-0.103,0-0.204,0.009-0.308c0.009-0.352,0.045-0.695,0.099-1.035c0.411-2.587,1.995-4.788,4.187-6.055c-0.193-0.596-0.471-1.16-0.812-1.665c-0.401,0.059-0.808,0.088-1.229,0.088c-2.447,0-4.655-1.021-6.222-2.659C1.931,30.747,0,33.226,0,36.151C0,38.127,0.876,39.899,2.266,41.096z"/><path d="M14.28,18.87c-1.234,0.684-2.655,1.077-4.17,1.077c-1.314,0-2.562-0.297-3.676-0.824c-1.356,1.196-2.205,2.944-2.205,4.888c0,1.361,0.416,2.625,1.128,3.675c0.228,0.33,0.481,0.641,0.769,0.924c0.398,0.407,0.854,0.762,1.355,1.053c0.733,0.431,1.561,0.724,2.441,0.84c0.291,0.04,0.587,0.062,0.891,0.062c0.271,0,0.545-0.019,0.811-0.054c0.41-0.044,0.809-0.132,1.188-0.253c0.81-0.258,1.548-0.663,2.187-1.185c0.269-1.832,1.123-3.482,2.375-4.741C15.725,22.998,14.58,21.067,14.28,18.87z"/><path d="M6.302,16.734c0.312,0.229,0.651,0.424,1.006,0.586c0.45,0.215,0.926,0.374,1.427,0.478c0.442,0.098,0.903,0.146,1.377,0.146c0.729,0,1.431-0.114,2.085-0.333c0.482-0.159,0.938-0.375,1.364-0.635c0.254-0.156,0.5-0.33,0.731-0.517c0.01-0.086,0.022-0.165,0.041-0.244c0.306-1.751,1.149-3.312,2.354-4.521c0.003-0.102,0.008-0.201,0.008-0.302c0-3.617-2.947-6.55-6.583-6.55c-3.637,0-6.588,2.933-6.588,6.55C3.524,13.598,4.62,15.551,6.302,16.734z"/><path d="M17.388,24.316c-0.006,0.003-0.01,0.009-0.015,0.018c0.005,0.009,0.009,0.014,0.015,0.014V24.316z"/><path d="M34.075,18.167c-0.983,0-1.914,0.212-2.75,0.601c-0.403,0.183-0.788,0.405-1.141,0.663c-1.153,0.845-2.026,2.055-2.434,3.461c-0.062,0.211-0.116,0.436-0.151,0.663c-0.026,0.124-0.045,0.249-0.059,0.377c-0.031,0.258-0.05,0.517-0.05,0.782c0,0.051,0,0.097,0.005,0.148c0,0.09,0.004,0.174,0.009,0.262c0.122,1.953,1.101,3.675,2.567,4.797c0.317,0.239,0.657,0.453,1.015,0.635c0.312,0.161,0.645,0.294,0.984,0.405c0.63,0.201,1.306,0.307,2.004,0.307c3.636,0,6.583-2.932,6.583-6.554C40.658,21.1,37.711,18.167,34.075,18.167z"/><path d="M16.337,35.043c-0.412,0.051-0.812,0.139-1.197,0.263c-0.342,0.107-0.662,0.242-0.977,0.4c-0.353,0.18-0.683,0.389-0.997,0.624c-1.427,1.087-2.393,2.726-2.562,4.602c-0.02,0.143-0.027,0.285-0.027,0.432c-0.006,0.058-0.006,0.12-0.006,0.177c0,0.19,0.009,0.384,0.028,0.575c0.008,0.137,0.026,0.281,0.049,0.413c0.053,0.352,0.133,0.693,0.241,1.021c0.005,0.019,0.015,0.042,0.019,0.059c0.376,1.127,1.047,2.114,1.927,2.875c0.386,0.333,0.815,0.626,1.271,0.863c0.35,0.182,0.716,0.333,1.096,0.454c0.617,0.19,1.275,0.293,1.959,0.293c3.636,0,6.582-2.932,6.582-6.554c0-0.952-0.205-1.858-0.571-2.672C20.323,38.761,17.823,37.266,16.337,35.043z"/></g>'
  + '</svg>';
const onbData=[
  {title:'Il mondo dello Champagne, tutto in un posto',sub:'Dalle grandi Maison ai piccoli vigneron — ogni bottiglia racconta una storia unica. Scoprila.',loc:'Maison & Vigneron',iconSvg:ONB_GRAPE_SVG,bg:'linear-gradient(135deg,#F5EFE4 0%,#E8D5A3 100%)',iconColor:'#8a6a1e',btn:'Continua'},
  {title:'Scansiona, scopri',sub:"Inquadra l'etichetta: riconoscimento immediato e un'analisi da Sommelier — profilo, abbinamenti e punteggio, come averne uno al tuo fianco.",loc:'Scansione Sommelier',icon:'ti-scan',bg:'linear-gradient(135deg,#1A1F2E 0%,#252B3D 100%)',iconColor:'#8BA8E0',btn:'Continua'},
  {title:'Il tuo Carnet de dégustation',sub:'Salva ogni assaggio con note, aromi e punteggio personale. La tua storia di degustazioni, sempre con te.',loc:'Carnet personale',icon:'ti-notebook',bg:'linear-gradient(135deg,#1E1208 0%,#3A2814 100%)',iconColor:'#C8A03A',btn:'Continua'},
  {title:'Impara ed esplora',sub:'Glossario completo, guida al metodo champenoise, terroir e formati — tutto lo Champagne, spiegato bene.',loc:'Guida & Glossario',icon:'ti-books',bg:'linear-gradient(135deg,#FBF4E4 0%,#F0E2C0 100%)',iconColor:'#8a6a1e',btn:'Inizia gratis'},
];
let onbIdx=0;
function onbApplySlide(d){
  document.getElementById('onb-title').textContent=d.title;
  document.getElementById('onb-sub').textContent=d.sub;
  document.getElementById('onb-loc').textContent=d.loc;
  document.getElementById('onb-btn').textContent=d.btn;
  const ph=document.getElementById('onb-img-ph');
  ph.style.background=d.bg;
  ph.innerHTML = d.iconSvg
    ? d.iconSvg.replace('{{color}}', d.iconColor)
    : '<i class="ti '+d.icon+'" id="onb-img-icon" style="color:'+d.iconColor+'"></i>';
  [0,1,2,3].forEach(i=>document.getElementById('od'+i).classList.toggle('on',i===onbIdx));
  [document.getElementById('onb-img-wrap'),document.getElementById('onb-title'),document.getElementById('onb-sub'),document.getElementById('onb-loc')].forEach(el=>{
    el.classList.remove('onb-anim'); void el.offsetWidth; el.classList.add('onb-anim');
  });
  const backBtn=document.getElementById('onb-back-btn');
  if(backBtn) backBtn.style.display = onbIdx>0 ? 'flex' : 'none';
}
function onbNext(){
  if(onbIdx>=onbData.length-1){go('v-reg');return;}
  onbIdx++;
  onbApplySlide(onbData[onbIdx]);
}
function onbPrev(){
  if(onbIdx<=0) return;
  onbIdx--;
  onbApplySlide(onbData[onbIdx]);
}
function onbGoTo(i){
  if(i===onbIdx || i<0 || i>=onbData.length) return;
  onbIdx=i;
  onbApplySlide(onbData[onbIdx]);
}
function backToOnboardingEnd(){
  go('v-onb');
  onbIdx=onbData.length-1;
  onbApplySlide(onbData[onbIdx]);
}
(function(){
  let touchStartX=0, touchStartY=0;
  document.addEventListener('touchstart', function(e){
    if(!e.target.closest('#v-onb')) return;
    touchStartX=e.touches[0].clientX;
    touchStartY=e.touches[0].clientY;
  }, {passive:true});
  document.addEventListener('touchend', function(e){
    if(!e.target.closest('#v-onb')) return;
    const dx=e.changedTouches[0].clientX-touchStartX;
    const dy=e.changedTouches[0].clientY-touchStartY;
    if(Math.abs(dx)<50 || Math.abs(dx)<Math.abs(dy)) return;
    if(dx<0) onbNext(); else onbPrev();
  }, {passive:true});
})();

// ═══ GLOSSARIO — dinamico da DB ═══
let allGlossario = [];
let currentGlossLetter = 'tutti';

async function loadGlossario() {
  if (allGlossario.length > 0) { renderGlossario(); return; }
  const listEl = document.getElementById('gloss-list');
  try {
    const { data, error } = await supa
      .from('glossario')
      .select('termine, definizione, lettera, livello, categoria')
      .eq('is_published', true)
      .order('lettera', { ascending: true })
      .order('termine', { ascending: true });
    if (error) throw error;
    allGlossario = data || [];
    // Voce "Sans Année" — termine ufficiale francese, iniettata lato client
    // (rimane finché non viene aggiunta direttamente nel DB Supabase)
    if (!allGlossario.find(t => normalizeStr(t.termine).startsWith('sans ann'))) {
      allGlossario.push({
        termine: 'Sans Année (SA)',
        definizione: 'Termine ufficiale francese per gli Champagne prodotti assemblando vins de base di più annate, senza indicazione di millésime in etichetta. È la tipologia più diffusa — il vino "firma" di ogni maison, pensato per mantenere uno stile costante nel tempo grazie all\'aggiunta di vins de réserve. L\'espressione anglosassone "Non Vintage" (NV), ancora diffusa, è oggi scoraggiata in Champagne: dal 2009 l\'appellation utilizza ufficialmente "Sans Année" e la sigla SA.',
        lettera: 'S',
        livello: 'base',
        categoria: 'tipologie'
      });
      allGlossario.sort((a, b) => a.lettera.localeCompare(b.lettera) || a.termine.localeCompare(b.termine));
    }
    buildGlossFilters();
    renderGlossario();
  } catch(e) {
    console.log('loadGlossario error:', e);
    if (listEl) listEl.innerHTML = '<div style="padding:40px;text-align:center;font-family:var(--sans);font-size:15px;color:var(--ink-4);">Errore caricamento. Riprova.</div>';
  }
}

function buildGlossFilters() {
  const row = document.getElementById('gloss-filters');
  if (!row) return;
  const letters = [...new Set(allGlossario.map(t => t.lettera))].sort();
  let html = '<button class="f-btn on" onclick="filterGloss(this,\'tutti\')">Tutti</button>';
  letters.forEach(l => {
    html += '<button class="f-btn" onclick="filterGloss(this,\'' + l + '\')">' + l + '</button>';
  });
  row.innerHTML = html;
}

function filterGloss(btn, letter) {
  document.querySelectorAll('#gloss-filters .f-btn').forEach(b => b.classList.remove('on'));
  btn.classList.add('on');
  currentGlossLetter = letter;
  renderGlossario();
}

function renderGlossario() {
  const el = document.getElementById('gloss-list');
  if (!el) return;
  const premium = isPremium();
  const filtered = currentGlossLetter === 'tutti'
    ? allGlossario
    : allGlossario.filter(t => t.lettera === currentGlossLetter);

  // Raggruppa per lettera
  const groups = {};
  filtered.forEach(t => {
    if (!groups[t.lettera]) groups[t.lettera] = [];
    groups[t.lettera].push(t);
  });

  const livelloBadge = {
    'base':     'badge-rm',
    'avanzato': 'badge-pres',
    'premium':  'badge-prem'
  };
  const livelloLabel = { 'base':'Base', 'avanzato':'Avanzato', 'premium':'Premium' };

  el.innerHTML = Object.keys(groups).sort().map((letter, gi) => {
    return '<div data-g="' + letter + '">' +
      '<div style="font-family:var(--serif);font-size:24px;color:var(--gold);font-weight:500;margin-bottom:8px;' + (gi > 0 ? 'margin-top:8px;' : '') + '">' + letter + '</div>' +
      groups[letter].map(t => {
        const locked = t.livello === 'premium' && !premium;
        if (locked) return _lockedSearchCard(t.termine, 'Disponibile con Piano Premium');
        return '<div class="card" style="padding:13px 14px;margin-bottom:8px;">' +
          '<div style="font-family:var(--sans);font-size:15px;color:var(--ink);font-weight:500;margin-bottom:4px;display:flex;justify-content:space-between;align-items:center;">' +
            '<span>' + t.termine + '</span>' +
          '</div>' +
          '<div style="font-family:var(--sans);font-size:14px;color:var(--ink-3);line-height:1.65;">' +
            t.definizione +
          '</div>' +
          '<div style="margin-top:7px;display:flex;align-items:center;gap:6px;">' +
            '<span class="badge ' + (livelloBadge[t.livello] || 'badge-rm') + '">' + (livelloLabel[t.livello] || 'Base') + '</span>' +
            (t.categoria ? '<span style="font-family:var(--sans);font-size:12px;color:var(--ink-5);">' + t.categoria + '</span>' : '') +
          '</div>' +
        '</div>';
      }).join('') +
    '</div>';
  }).join('') || '<div style="padding:40px;text-align:center;font-family:var(--sans);font-size:15px;color:var(--ink-4);">Nessun termine trovato.</div>';
}
function togStep(el){
  const body=el.nextElementSibling;
  const chev=el.querySelector('.step-chev');
  const open=body.style.display==='block';
  body.style.display=open?'none':'block';
  chev.classList.toggle('open',!open);
}
document.querySelectorAll('.filter-row .f-btn').forEach(b=>{
  b.addEventListener('click',function(){
    this.closest('.filter-row').querySelectorAll('.f-btn').forEach(x=>x.classList.remove('on'));
    this.classList.add('on');
  });
});
document.querySelectorAll('.chips-row .chip').forEach(c=>{
  c.addEventListener('click',function(){
    this.closest('.chips-row').querySelectorAll('.chip').forEach(x=>x.classList.remove('on'));
    this.classList.add('on');
  });
});
function selectPlan(el){
  document.querySelectorAll('.plan-card').forEach(p=>p.classList.remove('selected'));
  el.classList.add('selected');
  if (_rcOfferings) _selectedRcPackage = _rcPackageForType(el.dataset.rcPlan);
}
// CARNET
let currentRating=0;
let _noteTypes=[];  // array — supporta selezione multipla
let _pendingPhotos=[];      // {id,dataUrl,blob,ext} – new photos to upload
let _existingPhotoUrls=[];  // URLs already saved (edit mode)
let _lightboxPhotos=[];
let _lightboxIdx=0;

function setNoteTipo(el, tipo){
  if (tipo === 'non_so') {
    // "Non so" è esclusivo — deseleziona tutto il resto
    _noteTypes = _noteTypes.includes('non_so') ? [] : ['non_so'];
  } else {
    // Rimuovi "non so" se era attivo
    _noteTypes = _noteTypes.filter(t => t !== 'non_so');
    const idx = _noteTypes.indexOf(tipo);
    if (idx >= 0) { _noteTypes.splice(idx, 1); }
    else          { _noteTypes.push(tipo); }
  }
  _syncTipoChips();
}
function _syncTipoChips() {
  document.querySelectorAll('.tipo-chip').forEach(c => {
    const m = /,'([^']+)'\)/.exec(c.getAttribute('onclick') || '');
    c.classList.toggle('on', !!(m && _noteTypes.includes(m[1])));
  });
}

// Chiamata dal pulsante Carnet nella bottom nav:
// controlla SEMPRE il limite prima di aprire il form — locale se disponibile, DB altrimenti
async function quickNewNote(){
  if(!isPremium()){
    let count;
    if(window._carnetNotes != null){
      // Cache locale già disponibile (carnet già visitato in sessione)
      count = window._carnetNotes.length;
    } else {
      // Prima visita al carnet: query veloce solo per il conteggio
      try {
        const { count: dbCount } = await supa
          .from('carnet_notes')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', currentUser.id);
        count = dbCount || 0;
      } catch(e) {
        count = 0; // in caso di errore di rete, lascia aprire il form
      }
    }
    if(count >= 3){
      go('v-paywall');
      return;
    }
  }
  checkAndNewNote();
}

function checkAndNewNote(){
  currentEditId = null;
  const hiddenId = document.getElementById('edit-note-id');
  if (hiddenId) hiddenId.value = '';
  const bottIdEl = document.getElementById('note-bottiglia-id');
  if (bottIdEl) bottIdEl.value = '';
  currentRating = 0;
  _noteTypes = [];
  _syncTipoChips();
  // Reset form
  ['note-maison','note-cuvee','note-annata','note-dosage','note-luogo','note-text','note-prezzo','note-sboccatura','note-aromi-custom'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  const _dateDegEl = document.getElementById('note-data-deg');
  if (_dateDegEl) _dateDegEl.value = new Date().toISOString().split('T')[0];
  document.querySelectorAll('#aromi-grid .aromi-pill').forEach(p => p.classList.remove('on'));
  setRating(0);
  resetPhotoStrip();
  const title = document.querySelector('#v-carnet-new .topbar [style*="font-family:var(--serif)"]');
  if (title) title.textContent = 'Nuova degustazione';
  const btn = document.getElementById('save-note-btn');
  if (btn) btn.textContent = 'Salva nel Carnet';
  go('v-carnet-new');
  requestAnimationFrame(() => initAllSliders(5));
}
function openNewNoteFromBottiglia(bottId) {
  if (!currentUser) { go('v-login'); return; }
  const b = allBottiglie.find(x => x.id === bottId) || currentBottiglia;
  if (!b) return;

  // Reset completo
  currentEditId = null;
  const hiddenId = document.getElementById('edit-note-id');
  if (hiddenId) hiddenId.value = '';
  const bottIdEl = document.getElementById('note-bottiglia-id');
  if (bottIdEl) bottIdEl.value = bottId;
  currentRating = 0;
  _noteTypes = [];
  _syncTipoChips();
  ['note-maison','note-cuvee','note-annata','note-dosage','note-luogo','note-text','note-prezzo','note-sboccatura','note-aromi-custom'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  const _dateDegElB = document.getElementById('note-data-deg');
  if (_dateDegElB) _dateDegElB.value = new Date().toISOString().split('T')[0];
  document.querySelectorAll('#aromi-grid .aromi-pill').forEach(p => p.classList.remove('on'));
  setRating(0);

  // Pre-compila con i dati del catalogo
  const maisonEl = document.getElementById('note-maison');
  if (maisonEl) maisonEl.value = b.maison?.nome || '';
  const cuveeEl = document.getElementById('note-cuvee');
  if (cuveeEl) cuveeEl.value = b.nome || '';
  const annataEl = document.getElementById('note-annata');
  if (annataEl) annataEl.value = b.annata || '';
  const dosageEl = document.getElementById('note-dosage');
  if (dosageEl) dosageEl.value = b.dosaggio_tipo || '';

  // Tipo chip (da catalogo)
  if (b.tipo) {
    _noteTypes = Array.isArray(b.tipo) ? [...b.tipo] : [b.tipo];
    if (b.annata && !b.is_sa && !_noteTypes.includes('millesimato')) _noteTypes.push('millesimato');
    _syncTipoChips();
    if (false) { // keep old pattern reference
      document.querySelectorAll('.tipo-chip').forEach(c => {
      });
    }
  }

  // Foto dal catalogo come foto iniziale
  resetPhotoStrip();
  if (b.foto_url) _existingPhotoUrls = [b.foto_url];

  const title = document.querySelector('#v-carnet-new .topbar [style*="font-family:var(--serif)"]');
  if (title) title.textContent = 'Nuova degustazione';
  const btn = document.getElementById('save-note-btn');
  if (btn) btn.textContent = 'Salva nel Carnet';

  go('v-carnet-new');
  requestAnimationFrame(() => { initAllSliders(5); renderPhotoStrip(); });
}

/* ── Slider fill ──────────────────────────────────────────────────── */
const _sliderColors = {
  acidite: ['#4A8FA8','#E0EDF2'],
  eff:     ['#9B7DC8','#EDE8F6'],
  comp:    ['#C8962A','#F5EDD5'],
  lung:    ['#4A8A5A','#DFF0E4']
};
let _activeSliders = new Set(); // slider toccati dall'utente

function updSlider(el, key, displayId) {
  const min = parseFloat(el.min), max = parseFloat(el.max), val = parseFloat(el.value);
  const pct = (val - min) / (max - min);
  const thumbW = 28;
  const trackW = el.offsetWidth > 0 ? el.offsetWidth : 340;
  const adj = ((pct * (trackW - thumbW)) + thumbW * 0.5) / trackW * 100;
  const [fill, empty] = _sliderColors[key] || ['#888','#ddd'];
  el.style.background = `linear-gradient(to right,${fill} ${adj.toFixed(1)}%,${empty} ${adj.toFixed(1)}%)`;
  if (displayId) document.getElementById(displayId).textContent = el.value;
}
// Chiamata dall'oninput dell'utente: attiva lo slider + aggiorna visuale
function touchSlider(el, key, displayId) {
  _activeSliders.add(key);
  const wrap = el.closest('.slider-wrap');
  if (wrap) wrap.classList.add('slider-active');
  updSlider(el, key, displayId);
}
function initAllSliders(defaultVal) {
  const map = [
    ['val-acidite','acidite'], ['val-eff','eff'],
    ['val-comp','comp'],       ['val-lung','lung']
  ];
  // Nuova nota (defaultVal=5): resetta tutto, slider disattivati
  if (defaultVal != null) _activeSliders = new Set();
  map.forEach(([displayId, key]) => {
    const display = document.getElementById(displayId);
    if (!display) return;
    const wrap = display.closest('.slider-wrap');
    if (!wrap) return;
    const inp = wrap.querySelector('input[type=range]');
    if (!inp) return;
    if (defaultVal != null) {
      inp.value = defaultVal;
      wrap.classList.remove('slider-active'); // dim: non ancora toccato
    } else {
      // Edit mode: attiva visualmente solo gli slider già popolati
      if (_activeSliders.has(key)) wrap.classList.add('slider-active');
    }
    updSlider(inp, key, displayId);
  });
}

function setRating(n){
  currentRating=n;
  const labels=['Tocca per valutare *','Deludente','Nella media','Buono','Ottimo','Eccellente — da ricordare!','Fantastico — il mio preferito!'];
  const glassN = Math.min(n, 5);
  document.querySelectorAll('.rating-star').forEach((s,i)=>{
    s.className='ti ti-glass-full rating-star' + (i<glassN?' on':'');
    s.style.color='var(--gold)';
    s.style.opacity=i<glassN?'1':'0.25';
  });
  // Cuore Fantastico (6° livello)
  const heart = document.getElementById('rating-heart');
  const heartLbl = document.getElementById('rating-top-label');
  if (heart) {
    if (n >= 6) {
      heart.className = 'ti ti-heart-filled rating-heart on';
      heart.style.color = '#E05252';
      heart.style.opacity = '1';
    } else {
      heart.className = 'ti ti-heart rating-heart';
      heart.style.color = 'var(--ink-4)';
      heart.style.opacity = '0.25';
    }
  }
  if (heartLbl) heartLbl.style.display = n >= 6 ? 'inline' : 'none';
  const lbl=document.getElementById('rating-label');
  if(lbl)lbl.textContent=n===0?'Tocca per valutare *':(labels[n]||'');
}
function toggleFavoriteRating(){
  setRating(currentRating === 6 ? 5 : 6);
}
function togAroma(el){el.classList.toggle('on');}
function previewPhoto(input){
  if(!input.files||!input.files[0])return;
  const file = input.files[0];
  input._compressedBlob = null;
  input._compressedExt = null;

  const reader = new FileReader();
  reader.onload = function(e){
    const img = new Image();
    img.onload = function(){
      // Ridimensiona a max 900px — sufficiente per anteprima su mobile
      const MAX = 900;
      let w = img.width, h = img.height;
      if(w > h){
        if(w > MAX){ h = Math.round(h * MAX / w); w = MAX; }
      } else {
        if(h > MAX){ w = Math.round(w * MAX / h); h = MAX; }
      }

      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);

      // Prova WebP prima, fallback JPEG (iOS Safari non supporta WebP su canvas)
      let dataUrl = canvas.toDataURL('image/webp', 0.78);
      let mimeType = 'image/webp';
      let ext = 'webp';

      // Se il browser non supporta WebP nel canvas, toDataURL restituisce PNG
      // In quel caso usa JPEG che è sempre supportato
      if(!dataUrl.startsWith('data:image/webp')){
        dataUrl = canvas.toDataURL('image/jpeg', 0.78);
        mimeType = 'image/jpeg';
        ext = 'jpg';
      }

      // Mostra preview
      const box = document.getElementById('photo-box');
      if(box) box.innerHTML = '<img src="' + dataUrl + '" style="width:100%;height:160px;object-fit:cover;border-radius:12px;"/>';

      // dataURL → Blob sincrono via atob
      const base64 = dataUrl.split(',')[1];
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for(let i = 0; i < binary.length; i++){
        bytes[i] = binary.charCodeAt(i);
      }
      const blob = new Blob([bytes], {type: mimeType});
      input._compressedBlob = blob;
      input._compressedExt = ext;

      const origKB = Math.round(file.size / 1024);
      const compKB = Math.round(blob.size / 1024);
      console.log('Compresso (' + ext.toUpperCase() + ' ' + w + 'x' + h + '): ' + compKB + 'KB da ' + origKB + 'KB (-' + Math.round((1 - compKB/origKB)*100) + '%)');
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

function waitForCompression(input){ return Promise.resolve(); }

/* ── Multi-photo strip ─────────────────────────────────────── */
function addPhoto(input) {
  if (!input.files || !input.files.length) return;
  // IMPORTANTE: cattura i File PRIMA di resettare input.value
  // (su mobile input.value='' svuota input.files)
  const files = Array.from(input.files);
  input.value = '';

  const slots = 3 - (_existingPhotoUrls.length + _pendingPhotos.length);
  if (slots <= 0) return;

  // Processa in sequenza: ogni foto aspetta la precedente (conteggio sempre aggiornato)
  let idx = 0;
  function processNext() {
    if (idx >= files.length) return;
    if ((_existingPhotoUrls.length + _pendingPhotos.length) >= 3) {
      if (files.length > slots) showAppToast('Aggiunte ' + slots + ' foto su ' + files.length + ' selezionate — max 3');
      return;
    }
    const file = files[idx++];
    const reader = new FileReader();
    reader.onload = function(e) {
      const img = new Image();
      img.onload = function() {
        const MAX = 900;
        let w = img.width, h = img.height;
        if (w > h) { if (w > MAX) { h = Math.round(h*MAX/w); w = MAX; } }
        else       { if (h > MAX) { w = Math.round(w*MAX/h); h = MAX; } }
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        let dataUrl = canvas.toDataURL('image/webp', 0.78);
        let mimeType = 'image/webp', ext = 'webp';
        if (!dataUrl.startsWith('data:image/webp')) {
          dataUrl = canvas.toDataURL('image/jpeg', 0.78);
          mimeType = 'image/jpeg'; ext = 'jpg';
        }
        const base64 = dataUrl.split(',')[1];
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i=0;i<binary.length;i++) bytes[i]=binary.charCodeAt(i);
        const blob = new Blob([bytes],{type:mimeType});
        _pendingPhotos.push({id:Date.now()+Math.random(), dataUrl, blob, ext});
        renderPhotoStrip();
        processNext(); // foto successiva solo dopo che questa è pronta
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }
  processNext();
}
function renderPhotoStrip() {
  const emptyEl = document.getElementById('photo-empty');
  const stripEl = document.getElementById('photo-strip');
  if (!stripEl) return;
  const allCount = _existingPhotoUrls.length + _pendingPhotos.length;
  if (allCount === 0) {
    if (emptyEl) emptyEl.style.display = '';
    stripEl.style.display = 'none';
    return;
  }
  if (emptyEl) emptyEl.style.display = 'none';
  stripEl.style.display = 'flex';
  let html = '';
  _existingPhotoUrls.forEach((url, i) => {
    html += '<div class="photo-thumb" onclick="openLightbox(_existingPhotoUrls,'+i+')">' +
      '<img src="'+url+'"/>' +
      '<button class="photo-thumb-del" onclick="event.stopPropagation();removeExistingPhoto('+i+')">×</button>' +
    '</div>';
  });
  _pendingPhotos.forEach(p => {
    html += '<div class="photo-thumb" onclick="openLightbox([\''+p.dataUrl+'\'],0)">' +
      '<img src="'+p.dataUrl+'"/>' +
      '<button class="photo-thumb-del" onclick="event.stopPropagation();removePhoto(\''+p.id+'\')">×</button>' +
    '</div>';
  });
  if (allCount < 3) {
    html += '<div class="photo-add-btn" onclick="document.getElementById(\'photo-input\').click()">' +
      '<i class="ti ti-camera-plus"></i><span>Aggiungi</span></div>';
  }
  stripEl.innerHTML = html;
}
function removePhoto(id) {
  _pendingPhotos = _pendingPhotos.filter(p => String(p.id) !== String(id));
  renderPhotoStrip();
}
function removeExistingPhoto(idx) {
  _existingPhotoUrls.splice(idx, 1);
  renderPhotoStrip();
}
function resetPhotoStrip() {
  _pendingPhotos = [];
  _existingPhotoUrls = [];
  const emptyEl = document.getElementById('photo-empty');
  const stripEl = document.getElementById('photo-strip');
  if (emptyEl) emptyEl.style.display = '';
  if (stripEl) { stripEl.innerHTML=''; stripEl.style.display='none'; }
}

/* ── Lightbox ──────────────────────────────────────────────── */
function openLightbox(photos, idx) {
  _lightboxPhotos = Array.isArray(photos) ? photos : [photos];
  _lightboxIdx = idx || 0;
  const lb  = document.getElementById('lightbox');
  const img = document.getElementById('lightbox-img');
  if (!lb || !img) return;
  img.src = _lightboxPhotos[_lightboxIdx];
  lb.style.display = 'flex';
  const nav     = document.getElementById('lightbox-nav');
  const counter = document.getElementById('lightbox-counter');
  if (_lightboxPhotos.length > 1) {
    if (nav) nav.style.display = 'flex';
    if (counter) counter.textContent = (_lightboxIdx+1)+'/'+_lightboxPhotos.length;
  } else {
    if (nav) nav.style.display = 'none';
  }
}
function closeLightbox() {
  const lb = document.getElementById('lightbox');
  if (lb) lb.style.display = 'none';
}
function lightboxPrev() {
  if (_lightboxPhotos.length <= 1) return;
  _lightboxIdx = (_lightboxIdx-1+_lightboxPhotos.length) % _lightboxPhotos.length;
  document.getElementById('lightbox-img').src = _lightboxPhotos[_lightboxIdx];
  const c = document.getElementById('lightbox-counter');
  if (c) c.textContent = (_lightboxIdx+1)+'/'+_lightboxPhotos.length;
}
function lightboxNext() {
  if (_lightboxPhotos.length <= 1) return;
  _lightboxIdx = (_lightboxIdx+1) % _lightboxPhotos.length;
  document.getElementById('lightbox-img').src = _lightboxPhotos[_lightboxIdx];
  const c = document.getElementById('lightbox-counter');
  if (c) c.textContent = (_lightboxIdx+1)+'/'+_lightboxPhotos.length;
}
async function saveNote(editId = null){
  // Read from hidden input as reliable fallback
  const hiddenId = document.getElementById('edit-note-id');
  if (!editId && hiddenId && hiddenId.value) editId = hiddenId.value;
  
  const saveBtn = document.getElementById('save-note-btn');
  if (saveBtn) { saveBtn.textContent = 'Salvataggio...'; saveBtn.disabled = true; }

  const nota = {
    maison_nome: document.getElementById('note-maison')?.value?.trim() || '',
    cuvee_nome: document.getElementById('note-cuvee')?.value?.trim() || '',
    annata: document.getElementById('note-annata')?.value?.trim() || '',
    dosage_testo: document.getElementById('note-dosage')?.value?.trim() || '',
    luogo: document.getElementById('note-luogo')?.value?.trim() || '',
    rating: currentRating || null,
    note_libere: document.getElementById('note-text')?.value?.trim() || '',
    prezzo_pagato: document.getElementById('note-prezzo')?.value ? parseFloat(document.getElementById('note-prezzo').value) : null,
    acidite:      _activeSliders.has('acidite') ? (parseInt(document.getElementById('val-acidite')?.textContent) || null) : null,
    effervescence:_activeSliders.has('eff')     ? (parseInt(document.getElementById('val-eff')?.textContent)     || null) : null,
    complexite:   _activeSliders.has('comp')    ? (parseInt(document.getElementById('val-comp')?.textContent)    || null) : null,
    longueur:     _activeSliders.has('lung')    ? (parseInt(document.getElementById('val-lung')?.textContent)    || null) : null,
    aromi: (() => {
      const selected = Array.from(document.querySelectorAll('#aromi-grid .aromi-pill.on')).map(el => el.textContent);
      const customRaw = document.getElementById('note-aromi-custom')?.value?.trim() || '';
      const custom = customRaw ? customRaw.split(',').map(a => a.trim()).filter(Boolean) : [];
      return [...selected, ...custom];
    })(),
    sboccatura: document.getElementById('note-sboccatura')?.value?.trim() || null,
    data_degustazione: document.getElementById('note-data-deg')?.value || new Date().toISOString().split('T')[0],
    tipo: _noteTypes.length ? _noteTypes : null
  };

  if (!nota.maison_nome || !nota.cuvee_nome) {
    showNoteError('Inserisci il nome della maison e della cuvée');
    if (saveBtn) { saveBtn.textContent = 'Salva nel Carnet'; saveBtn.disabled = false; }
    return;
  }
  if (!nota.rating || nota.rating < 1) {
    showNoteError('Seleziona almeno un calice per il punteggio');
    if (saveBtn) { saveBtn.textContent = 'Salva nel Carnet'; saveBtn.disabled = false; }
    // Highlight rating section
    const ratingRow = document.getElementById('rating-stars');
    if (ratingRow) {
      ratingRow.style.animation = 'shake .4s ease';
      setTimeout(() => { ratingRow.style.animation = ''; }, 400);
    }
    return;
  }

  // Upload all pending photos + gestione foto esistenti
  const allPhotoUrls = [];

  // Foto esistenti: copia quelle del catalogo (champagne-photos) nel bucket personale
  // → ogni nota carnet ha copia indipendente; eliminare la nota non tocca il catalogo
  for (const url of _existingPhotoUrls) {
    if (url && url.includes('/champagne-photos/')) {
      // Scarica dal bucket catalogo e ricarica nel bucket personale
      try {
        const marker = '/champagne-photos/';
        const idx = url.indexOf(marker);
        const storagePath = idx !== -1 ? url.substring(idx + marker.length).split('?')[0] : null;
        let copied = false;
        if (storagePath) {
          const { data: fileBlob, error: dlErr } = await supa.storage
            .from('champagne-photos').download(storagePath);
          if (!dlErr && fileBlob) {
            const carnetPath = `${currentUser.id}/${Date.now()}_${Math.random().toString(36).substr(2,5)}.jpg`;
            const { error: upErr } = await supa.storage
              .from('carnet-photos')
              .upload(carnetPath, fileBlob, { contentType: 'image/jpeg', upsert: true });
            if (!upErr) {
              const { data: urlData } = supa.storage.from('carnet-photos').getPublicUrl(carnetPath);
              if (urlData?.publicUrl) { allPhotoUrls.push(urlData.publicUrl); copied = true; }
            }
          }
        }
        if (!copied) allPhotoUrls.push(url); // fallback: usa URL originale
      } catch(e) {
        console.log('Catalog photo copy error:', e);
        allPhotoUrls.push(url); // fallback sicuro
      }
    } else {
      allPhotoUrls.push(url); // già in carnet-photos, tenere com'è
    }
  }

  // Nuove foto scattate dall'utente
  for (const photo of _pendingPhotos) {
    try {
      const path = currentUser.id+'/'+Date.now()+'_'+Math.random().toString(36).substr(2,5)+'.'+photo.ext;
      const { error: uploadError } = await supa.storage
        .from('carnet-photos')
        .upload(path, photo.blob, { upsert: true, contentType: photo.blob.type });
      if (!uploadError) {
        const { data: urlData } = supa.storage.from('carnet-photos').getPublicUrl(path);
        if (urlData?.publicUrl) allPhotoUrls.push(urlData.publicUrl);
      } else { console.log('Upload error:', uploadError); }
    } catch(e) { console.log('Photo upload error:', e); }
  }
  nota.foto_url  = allPhotoUrls[0] || null;
  nota.foto_urls = allPhotoUrls.length > 0 ? allPhotoUrls : null;

  // Update or insert
  let result;
  if (editId) {
    console.log('Updating note:', editId);
    const { data, error } = await supa
      .from('carnet_notes')
      .update({ ...nota, updated_at: new Date().toISOString() })
      .eq('id', editId)
      .eq('user_id', currentUser.id)
      .select()
      .single();
    if (error) {
      console.log('Update error:', error);
      alert('Errore nella modifica: ' + error.message);
      if (saveBtn) { saveBtn.textContent = 'Salva modifiche'; saveBtn.disabled = false; }
      return;
    }
    result = data;
  } else {
    result = await saveCarnetNote({ ...nota, scan_result_json: window._pendingScanResult || null });
  }

  if (saveBtn) { saveBtn.textContent = 'Salva nel Carnet'; saveBtn.disabled = false; }
  if (result) {
    window._pendingScanResult = null;
    const wasEdit = !!editId;
    currentEditId = null;
    currentRating = 0;
    const hiddenIdReset = document.getElementById('edit-note-id');
    if (hiddenIdReset) hiddenIdReset.value = '';
    resetPhotoStrip();
    // Aggiorna la cache locale
    if (Array.isArray(allCarnetNotes)) {
      const idx = allCarnetNotes.findIndex(n => n.id === result.id);
      if (idx !== -1) allCarnetNotes[idx] = result;
      window._carnetNotes = allCarnetNotes;
    }
    if (wasEdit) {
      openNoteDetail(result);
    } else {
      updateCarnetUI().catch(() => {});
      go('v-carnet');
    }
  }
}
// ═══ STORICO SCANSIONI ═══

async function _compressDataUrl(dataUrl, maxW = 900, quality = 0.78) {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxW / img.width);
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

async function saveScanToHistory(result, photoDataUrl) {
  if (!currentUser) return;
  const b = result.matched_bottle || {};

  // Carica foto utente su scan-photos (compressa)
  let fotoUrl = null;
  if (photoDataUrl && photoDataUrl.startsWith('data:')) {
    try {
      const compressed = await _compressDataUrl(photoDataUrl, 900, 0.78);
      const res  = await fetch(compressed);
      const blob = await res.blob();
      const path = `${currentUser.id}/${Date.now()}.jpg`;
      const { error: upErr } = await supa.storage
        .from('scan-photos')
        .upload(path, blob, { contentType: 'image/jpeg', upsert: false });
      if (!upErr) {
        const { data: urlData } = supa.storage.from('scan-photos').getPublicUrl(path);
        fotoUrl = urlData?.publicUrl || null;
      }
    } catch(e) { console.log('scan photo upload error:', e); }
  }

  const record = {
    user_id:          currentUser.id,
    maison_nome:      result.maison || b.maison?.nome || null,
    cuvee_nome:       result.cuvee  || b.nome         || null,
    annata:           result.is_sa ? 'SA' : (result.annata || b.annata || null),
    dosage_testo:     result.dosage || b.dosaggio_tipo || null,
    is_in_catalog:    result.is_in_catalog || false,
    matched_bottle_id:result.matched_bottle_id || null,
    foto_url:         fotoUrl,
    score_medio:      result.score_medio ?? b.score_medio ?? null,
    note_degustazione:result.note_degustazione || b.note_degustazione || null,
    result_json:      result
  };
  await supa.from('scan_history').insert(record);
}

let _scanHistoryCache = null;
let _currentHistoryIdx = null;

function _normalizeSearch(str) {
  return String(str ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function _buildScanHistoryCard(s, idx) {
  const isLocked = !!s._locked;
  const date = s.created_at
    ? new Date(s.created_at).toLocaleDateString('it-IT', { day:'numeric', month:'short', year:'numeric' })
    : '';
  const photo = s.foto_url
    ? '<img src="'+s.foto_url+'" style="width:100%;height:100%;object-fit:cover;" onerror="this.style.display=\'none\'">'
    : '<svg width="28" height="28" viewBox="0 0 512 512" fill="rgba(139,168,224,.3)"><path fill-rule="evenodd" clip-rule="evenodd" d="M217.6,0 L294.4,0 L294.4,76.8 C294.4,256 371.2,217.6 371.2,396.8 L371.2,512 L140.8,512 L140.8,396.8 C140.8,217.6 217.6,256 217.6,76.8 Z M335.057,240.943 L256,320 L176.943,240.943 L176.943,258.943 L256,338 L335.057,258.943 Z M204.8,396.8 L307.2,396.8 L307.2,435.2 L204.8,435.2 Z"/></svg>';
  const annata = s.annata && s.annata !== 'SA' ? s.annata : (s.annata === 'SA' ? 'S.A.' : '');
  // Le bottiglie di catalogo hanno spesso l'anno già scritto dentro il nome
  // (es. "Cristal 2010") — non ripeterlo se il nome finisce già con quell'anno.
  const cuveeAlreadyHasYear = annata && String(s.cuvee_nome || '').trim().endsWith(String(annata));
  // Badge fonte scansione (catalogo/AI): nota interna, visibile solo per admin
  const badge = !isAdmin() ? '' : (s.is_in_catalog
    ? '<span style="font-family:var(--sans);font-size:10px;background:#EDF7EE;color:#2A7A3A;border:0.5px solid #B8DDB8;border-radius:4px;padding:2px 6px;">✓ Catalogo</span>'
    : '<span style="font-family:var(--sans);font-size:10px;background:#EEF2FF;color:#4A5AB8;border:0.5px solid #C0C8F0;border-radius:4px;padding:2px 6px;">✦ AI</span>');
  const scoreHtml = s.score_medio
    ? '<span style="font-family:var(--sans);font-size:13px;font-weight:700;color:var(--gold);">'+s.score_medio+'</span><span style="font-family:var(--sans);font-size:11px;color:var(--ink-5);">/100</span>'
    : '';
  return '<div class="scan-history-card' + (isLocked ? ' locked' : '') + '" onclick="' + (isLocked ? "go('v-paywall')" : "openScanFromHistory("+idx+")") + '" style="display:flex;gap:0;background:' + (isLocked ? '#f2ead9' : 'var(--white)') + ';border-radius:14px;overflow:hidden;box-shadow:0 2px 10px rgba(0,0,0,.06);margin-bottom:10px;cursor:pointer;-webkit-tap-highlight-color:transparent;">' +
    '<div class="scan-history-photo" style="width:90px;flex-shrink:0;background:linear-gradient(150deg,#1A1F2E,#252B3D);display:flex;align-items:center;justify-content:center;overflow:hidden;position:relative;">' +
      photo +
      (isLocked ? '<div class="lock-over"><i class="ti ti-lock"></i>Premium</div>' : '') +
    '</div>' +
    '<div style="flex:1;padding:13px 14px;min-width:0;">' +
      '<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px;margin-bottom:4px;">' +
        '<div style="font-family:var(--sans);font-size:11px;color:var(--gold);font-weight:600;text-transform:uppercase;letter-spacing:.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">'+(s.maison_nome||'')+'</div>' +
        (!isLocked && scoreHtml ? '<div style="flex-shrink:0;">'+scoreHtml+'</div>' : '') +
      '</div>' +
      '<div style="font-family:var(--serif);font-size:17px;color:var(--ink);font-weight:500;line-height:1.25;margin-bottom:7px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">'+(s.cuvee_nome||'')+(annata && !cuveeAlreadyHasYear ? ' '+annata : '')+'</div>' +
      (isLocked ? '' :
        (badge || s.dosage_testo ?
        '<div style="display:flex;align-items:center;gap:6px;">' +
          badge +
          (s.dosage_testo ? '<span style="font-family:var(--sans);font-size:11px;color:var(--ink-5);">'+(badge ? '· ' : '')+s.dosage_testo+'</span>' : '') +
        '</div>' : '') +
        '<div style="display:flex;align-items:center;justify-content:space-between;margin-top:6px;">' +
          '<div style="font-family:var(--sans);font-size:11px;color:var(--ink-5);">'+date+'</div>' +
          '<button onclick="event.stopPropagation();deleteScanFromHistory('+idx+')" style="background:none;border:none;padding:2px 0 2px 8px;cursor:pointer;color:var(--ink-5);display:flex;align-items:center;line-height:1;" aria-label="Elimina"><i class="ti ti-trash" style="font-size:15px;"></i></button>' +
        '</div>'
      ) +
    '</div>' +
  '</div>';
}

function filterScanHistory(q) {
  const listEl = document.getElementById('scan-history-list');
  if (!listEl || !_scanHistoryCache) return;
  const norm = _normalizeSearch(q);
  if (!norm) {
    listEl.innerHTML = _scanHistoryCache.map((s, i) => _buildScanHistoryCard(s, i)).join('');
    return;
  }
  const filtered = _scanHistoryCache
    .map((s, i) => ({ s, i }))
    .filter(({ s }) => matchesAllTerms(q, s.maison_nome, s.cuvee_nome));
  if (!filtered.length) {
    listEl.innerHTML = '<div style="text-align:center;padding:40px 20px;font-family:var(--sans);font-size:14px;color:var(--ink-4);">Nessun risultato per «'+q+'»</div>';
    return;
  }
  listEl.innerHTML = filtered.map(({ s, i }) => _buildScanHistoryCard(s, i)).join('');
}

async function loadScanHistory() {
  if (!currentUser) return [];
  try {
    const { data, error } = await supa
      .from('scan_history')
      .select('*')
      .eq('user_id', currentUser.id)
      .order('created_at', { ascending: false })
      .limit(50);
    if (error) throw error;
    _scanHistoryCache = data || [];
    // Le prime 3 scansioni (piu recenti) restano libere; se l'utente non e
    // premium, le successive vengono offuscate anche se erano state fatte
    // durante un periodo premium.
    const premium = isPremium();
    _scanHistoryCache.forEach((s, i) => { s._locked = !premium && i >= 3; });
    return _scanHistoryCache;
  } catch(e) {
    console.log('loadScanHistory error:', e);
    return [];
  }
}

async function updateHomeScanCount() {
  const el = document.getElementById('home-scan-count');
  if (!el || !currentUser) return;
  try {
    const { count } = await supa
      .from('scan_history')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', currentUser.id);
    el.textContent = count ? count + (count === 1 ? ' scansione' : ' scansioni') : '';
  } catch(e) {}
}

async function renderScanHistoryUI() {
  const listEl = document.getElementById('scan-history-list');
  if (!listEl) return;
  const searchEl = document.getElementById('scan-history-search');
  if (searchEl) searchEl.value = '';
  const premBanner = document.getElementById('scan-history-premium-banner');
  listEl.innerHTML = '<div style="text-align:center;padding:40px 0;font-family:var(--sans);font-size:14px;color:var(--ink-4);">Caricamento…</div>';
  if (premBanner) premBanner.style.display = 'none';
  const scans = await loadScanHistory();
  if (!scans.length) {
    listEl.innerHTML =
      '<div style="text-align:center;padding:60px 20px;">' +
        '<i class="ti ti-scan" style="font-size:48px;color:var(--ink-5);display:block;margin-bottom:16px;"></i>' +
        '<div style="font-family:var(--serif);font-size:20px;color:var(--ink-3);margin-bottom:8px;">Nessuna scansione</div>' +
        '<div style="font-family:var(--sans);font-size:14px;color:var(--ink-5);line-height:1.6;">Scansiona una bottiglia con la fotocamera<br>e la troverai qui.</div>' +
      '</div>';
  } else {
    listEl.innerHTML = scans.map((s, i) => _buildScanHistoryCard(s, i)).join('');
  }
  const premium = isPremium();
  if (premBanner) {
    premBanner.style.display = premium ? 'none' : 'block';
    const msgEl = document.getElementById('scan-history-banner-msg');
    if (!premium && msgEl) {
      const used = Math.min(scans.length, 3);
      const remaining = 3 - used;
      if (used === 0) {
        msgEl.innerHTML = 'Hai <strong style="color:#8a6a1e;">3 scansioni salvate</strong> disponibili. Con Premium lo storico scansioni è illimitato.';
      } else if (remaining > 0) {
        msgEl.innerHTML = 'Ti restano <strong style="color:#8a6a1e;">' + remaining + ' scansioni salvate</strong>. Con Premium lo storico scansioni è illimitato.';
      } else {
        msgEl.innerHTML = 'Hai salvato le <strong style="color:#8a6a1e;">3 scansioni gratuite</strong>. Con Premium lo storico scansioni è illimitato.';
      }
    }
  }
}

function openScanFromHistory(idx) {
  const s = _scanHistoryCache && _scanHistoryCache[idx];
  if (!s || !s.result_json) return;
  if (s._locked) { go('v-paywall'); return; }
  _scanResult = s.result_json;
  _scanPhotoDataUrl = s.foto_url || null;
  _showScanResultPage(s.result_json, s.foto_url || null);
  // Mostra cestino nel topbar (dopo _showScanResultPage che lo nasconde)
  _currentHistoryIdx = idx;
  const btn = document.getElementById('scan-result-delete-btn');
  const spacer = document.getElementById('scan-result-topbar-spacer');
  if (btn) btn.style.display = 'flex';
  if (spacer) spacer.style.display = 'none';
}

async function _deleteScanRecord(s) {
  if (s.foto_url) {
    const marker = '/scan-photos/';
    const mIdx = s.foto_url.indexOf(marker);
    if (mIdx !== -1) {
      const storagePath = s.foto_url.slice(mIdx + marker.length);
      await supa.storage.from('scan-photos').remove([storagePath]);
    }
  }
  await supa.from('scan_history').delete().eq('id', s.id).eq('user_id', currentUser.id);
}

async function deleteScanFromHistory(idx) {
  const s = _scanHistoryCache && _scanHistoryCache[idx];
  if (!s) return;
  if (!confirm('Eliminare questa scansione?')) return;
  try {
    await _deleteScanRecord(s);
    await renderScanHistoryUI();
    updateHomeScanCount();
  } catch(e) {
    console.error('deleteScanFromHistory error:', e);
  }
}

async function deleteScanFromHistoryAndGoBack() {
  if (_currentHistoryIdx === null) return;
  const s = _scanHistoryCache && _scanHistoryCache[_currentHistoryIdx];
  if (!s) return;
  if (!confirm('Eliminare questa scansione?')) return;
  try {
    await _deleteScanRecord(s);
    _currentHistoryIdx = null;
    updateHomeScanCount();
    go('v-scan-history'); // triggers renderScanHistoryUI which resets the button
  } catch(e) {
    console.error('deleteScanFromHistoryAndGoBack error:', e);
  }
}

// PWA manifest
const manifest={name:'Cuvée — Guida allo Champagne',short_name:'Cuvée',description:'La guida italiana allo Champagne',start_url:'/',display:'standalone',background_color:'#faf8f5',theme_color:'#faf8f5',orientation:'portrait',icons:[{src:'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 192 192"><rect width="192" height="192" fill="%23faf8f5" rx="40"/><ellipse cx="96" cy="72" rx="32" ry="52" stroke="%23b8922a" stroke-width="4" fill="none"/><line x1="96" y1="124" x2="96" y2="155" stroke="%23b8922a" stroke-width="4"/><line x1="68" y1="155" x2="124" y2="155" stroke="%23b8922a" stroke-width="4"/></svg>',sizes:'192x192',type:'image/svg+xml'}]};
const mblob=new Blob([JSON.stringify(manifest)],{type:'application/json'});
document.querySelector('link[rel="manifest"]').href=URL.createObjectURL(mblob);
// Service Worker
if('serviceWorker' in navigator){
  const sw=`const C='cuvee-v6';self.addEventListener('install',e=>{self.skipWaiting();});self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==C).map(k=>caches.delete(k)))));self.clients.claim();});self.addEventListener('fetch',e=>{if(e.request.mode==='navigate'){e.respondWith(fetch(e.request).catch(()=>caches.match('/')));return;}e.respondWith(fetch(e.request).then(r=>{const rc=r.clone();caches.open(C).then(c=>c.put(e.request,rc));return r;}).catch(()=>caches.match(e.request)));});`;
  navigator.serviceWorker.register(URL.createObjectURL(new Blob([sw],{type:'application/javascript'})));
}





// ═══════════════════════════════════════════════════════════
//  AUTH — Supabase
// ═══════════════════════════════════════════════════════════

let currentUser = null;

// ── RevenueCat (acquisti in-app) ──────────────────────────────────
// Attivo SOLO dentro l'app nativa iOS/Android: nel sito da browser
// window.Capacitor non esiste, quindi queste funzioni non fanno nulla —
// stesso file di codice condiviso tra sito e app.
const REVENUECAT_API_KEY_IOS = 'appl_QwJMoulDdrgyYiqlItXemDnyFkJ';
let _rcConfigured = false;

function _rcPlugin() {
  return window.Capacitor?.Plugins?.Purchases || null;
}

async function initRevenueCat() {
  if (_rcConfigured) return;
  if (!window.Capacitor?.isNativePlatform?.()) return; // solo app nativa
  const platform = window.Capacitor.getPlatform(); // 'ios' | 'android'
  const apiKey = platform === 'ios' ? REVENUECAT_API_KEY_IOS : null;
  if (!apiKey) { console.log('RevenueCat: nessuna API key configurata per ' + platform); return; }
  const RC = _rcPlugin();
  if (!RC) { console.log('RevenueCat: plugin non trovato'); return; }
  try {
    await RC.configure({ apiKey });
    _rcConfigured = true;
    console.log('RevenueCat configurato (' + platform + ')');
    if (currentUser) await _rcIdentifyUser();
  } catch(e) {
    console.log('RevenueCat configure error:', e);
  }
}

// Collega l'utente Supabase loggato all'utente RevenueCat, così lo stato
// Premium risulta legato al suo account e non al singolo dispositivo.
async function _rcIdentifyUser() {
  if (!currentUser || !_rcConfigured) return;
  const RC = _rcPlugin();
  if (!RC) return;
  try {
    const result = await RC.logIn({ appUserID: currentUser.id });
    await _syncPremiumFromCustomerInfo(result.customerInfo);
  } catch(e) {
    console.log('RevenueCat logIn error:', e);
  }
}

// ── Login social nativo (Apple / Google) ──────────────────────────
// Attivo SOLO dentro l'app nativa: nel sito da browser resta il vecchio
// flusso OAuth via redirect di Supabase (signInWithOAuth più sotto).
const APPLE_BUNDLE_ID = 'com.coralweb.cuvee';
// Client ID "Web" — usato anche come iOSServerClientId, perché è quello che
// Supabase verifica come audience del token (non l'iOS Client ID).
const GOOGLE_WEB_CLIENT_ID = '705669492478-gtr3ebj69g1gcm8i7jbro87on876lees.apps.googleusercontent.com';
const GOOGLE_IOS_CLIENT_ID = '705669492478-dkivm7d3mb42ehb0nhmkl7m7f2tq3o1a.apps.googleusercontent.com';
let _socialLoginConfigured = false;

function _socialLoginPlugin() {
  return window.Capacitor?.Plugins?.SocialLogin || null;
}

async function initSocialLogin() {
  if (_socialLoginConfigured) return;
  if (!window.Capacitor?.isNativePlatform?.()) return; // solo app nativa
  const SL = _socialLoginPlugin();
  if (!SL) { console.log('SocialLogin: plugin non trovato'); return; }
  try {
    await SL.initialize({
      apple: { clientId: APPLE_BUNDLE_ID },
      google: {
        webClientId: GOOGLE_WEB_CLIENT_ID,
        iOSClientId: GOOGLE_IOS_CLIENT_ID,
        iOSServerClientId: GOOGLE_WEB_CLIENT_ID,
        mode: 'online',
      },
    });
    _socialLoginConfigured = true;
    console.log('SocialLogin configurato');
  } catch(e) {
    console.log('SocialLogin initialize error:', e);
  }
}

// Contiene nome/cognome restituiti da Apple/Google al primo accesso (solo la
// primissima volta: i provider social non li ripetono ai login successivi),
// usato per precompilare v-complete-profile subito dopo il routing.
let _pendingSocialName = '';

// Controlla sessione all avvio
// Dopo un login (email, riapertura app, Apple, Google) instrada verso l'app
// solo se l'utente ha già confermato di essere maggiorenne — altrimenti lo
// blocca su v-age-gate. Vale per ogni percorso di accesso, non solo la
// registrazione via form, quindi copre anche Apple/Google e gli account
// creati prima dell'introduzione di questo controllo.
// Chi arriva da un provider social senza un nome salvato (Apple/Google non lo
// comunicano sempre, e mai più dopo il primo accesso) passa prima da
// v-complete-profile: senza un nome vero, avatar e Carnet mostrerebbero solo
// l'indirizzo email generato dal relay di Apple.
async function _routeAfterAuth() {
  try { await loadUserProfile(); } catch(e) { console.log('Profile load:', e); }
  _rcIdentifyUser().catch(e => console.log('RevenueCat identify:', e));
  // Chi ha già confermato l'età su v-age-gate-pre (prima della registrazione)
  // non deve rivederla su v-age-gate: la segniamo qui sul DB, così quella
  // resta solo una rete di sicurezza per gli account creati prima di questo.
  if (_ageGateOk && currentUser?.profile && currentUser.profile.age_confirmed !== true) {
    currentUser.profile.age_confirmed = true;
    currentUser.profile.newsletter_opt_in = _pendingNewsletterOptIn;
    supa.from('users').update({ age_confirmed: true, newsletter_opt_in: _pendingNewsletterOptIn }).eq('id', currentUser.id)
      .then(({ error }) => { if (error) console.log('Age confirm sync error:', error); });
  }
  if (!currentUser?.profile?.full_name?.trim()) {
    const nameInput = document.getElementById('complete-profile-name');
    if (nameInput) nameInput.value = _pendingSocialName || '';
    const backBtn = document.getElementById('complete-profile-back');
    if (backBtn) backBtn.style.display = 'none'; // niente da annullare: senza nome non si può entrare
    go('v-complete-profile');
  } else if (currentUser?.profile?.age_confirmed === true) {
    go('v-home');
  } else {
    go('v-age-gate');
  }
  hideBootSplash();
}

// Riapre v-complete-profile per cambiare il nome in un secondo momento
// (matita accanto al nome nel profilo), a differenza del primo accesso qui
// si può anche annullare senza salvare nulla.
let _editingProfileName = false;
function openEditProfileName() {
  _editingProfileName = true;
  const nameInput = document.getElementById('complete-profile-name');
  if (nameInput) nameInput.value = currentUser?.profile?.full_name || '';
  const backBtn = document.getElementById('complete-profile-back');
  if (backBtn) backBtn.style.display = 'flex';
  go('v-complete-profile');
}

async function saveProfileName() {
  if (!currentUser) return;
  const input = document.getElementById('complete-profile-name');
  const name = input?.value?.trim();
  if (!name) { input?.focus(); return; }
  const { error } = await supa.from('users').update({ full_name: name }).eq('id', currentUser.id);
  if (error) {
    console.log('Save profile name error:', error);
    alert('Errore nel salvare il nome: ' + error.message);
    return;
  }
  if (currentUser.profile) currentUser.profile.full_name = name;
  updateProfileUI(currentUser.profile); // aggiorna subito nome/avatar in giro per l'app
  if (_editingProfileName) {
    _editingProfileName = false;
    go('v-profile');
    return;
  }
  if (currentUser?.profile?.age_confirmed === true) {
    go('v-home');
  } else {
    go('v-age-gate');
  }
}

async function initAuth() {
  try {
    // Controllo diretto sull'URL: se arriviamo dal link "reset password"
    // dell'email, il hash contiene type=recovery. Non ci affidiamo solo
    // all'evento PASSWORD_RECOVERY perché supa.auth (creato inline in
    // index.html) può già aver processato l'URL prima che questo script
    // (caricato dopo) registri il listener onAuthStateChange — in quel
    // caso l'evento è già passato e nessuno lo ha intercettato.
    const isRecoveryLink = /type=recovery/.test(window.location.hash) || /type=recovery/.test(window.location.search);

    const { data: { session } } = await supa.auth.getSession();
    if (session) {
      currentUser = session.user;
      if (isRecoveryLink) {
        go('v-set-new-password');
        return;
      }
      await _routeAfterAuth();
    } else {
      hideBootSplash(); // nessuna sessione: resta/torna sulla v-splash con i pulsanti
    }
  } catch(e) {
    console.log('Auth init error:', e);
    hideBootSplash();
  }
}

// Ascolta cambiamenti auth
supa.auth.onAuthStateChange(async (event, session) => {
  if (event === 'PASSWORD_RECOVERY' && session) {
    // Utente arrivato dal link "Reimposta la password" nell'email:
    // Supabase ha già creato una sessione temporanea, gli chiediamo
    // subito la nuova password invece di instradarlo come un login normale.
    currentUser = session.user;
    go('v-set-new-password');
    return;
  }
  if (event === 'SIGNED_IN' && session) {
    // Supabase riemette SIGNED_IN anche solo tornando col focus sulla tab/app
    // o al refresh automatico del token — non è un nuovo accesso. Se è già
    // lo stesso utente con profilo già caricato, non rifare tutto da capo:
    // altrimenti ogni volta si ricarica il profilo (diverse query) e si
    // strappa l'utente qualunque pagina stesse usando riportandolo in home,
    // e se il rifiro capita più volte ravvicinato mentre naviga, i caricamenti
    // si accumulano uno sull'altro rallentando sempre di più l'app.
    if (currentUser?.id === session.user.id && currentUser.profile) {
      return; // stesso utente già caricato: non toccare currentUser.profile
    }
    stopVerifyPolling();
    currentUser = session.user;
    await _routeAfterAuth();
  } else if (event === 'SIGNED_OUT') {
    stopVerifyPolling();
    currentUser = null;
    const RC = _rcPlugin();
    if (RC && _rcConfigured) RC.logOut().catch(e => console.log('RevenueCat logOut:', e));
    go('v-splash');
  }
});

async function confirmAge18() {
  if (!currentUser) return;
  try {
    await supa.from('users').update({ age_confirmed: true }).eq('id', currentUser.id);
    if (currentUser.profile) currentUser.profile.age_confirmed = true;
  } catch(e) { console.log('Age confirm error:', e); }
  go('v-home');
}

async function declineAge18() {
  try { await supa.auth.signOut(); } catch(e) { console.log('Sign out error:', e); }
  alert('Cuvée è dedicata al mondo dello Champagne ed è riservata a chi ha già compiuto 18 anni. Potrai registrarti quando li avrai compiuti.');
}

// ── Conferma età PRIMA della registrazione ─────────────────────────
// v-age-gate (sopra) resta un controllo post-login, utile come rete di
// sicurezza per account creati prima di questa modifica: ma per le
// registrazioni nuove va chiesto PRIMA che l'account venga creato davvero,
// altrimenti chi rifiuta si ritrova comunque con dati salvati su Supabase.
// go('v-reg') passa sempre da qui finché non si conferma una volta a sessione;
// _pendingSocialProvider copre anche Apple/Google, che possono creare un
// account nuovo anche dal pulsante nella schermata di login, non solo da
// quella di registrazione.
let _ageGateOk = false;
let _pendingSocialProvider = null;
// Checkbox newsletter su v-age-gate-pre — non preselezionato (consenso
// marketing pre-spuntato non è valido secondo il GDPR). Letto qui e non sul
// form di registrazione perché v-age-gate-pre è l'unico passaggio comune a
// TUTTI i percorsi di creazione account: email, Apple e Google, sia dalla
// schermata di registrazione sia da quella di login.
let _pendingNewsletterOptIn = false;

function confirmAge18Pre() {
  _ageGateOk = true;
  const cb = document.getElementById('reg-age18');
  if (cb) cb.checked = true;
  _pendingNewsletterOptIn = document.getElementById('pre-newsletter')?.checked || false;
  if (_pendingSocialProvider) {
    const provider = _pendingSocialProvider;
    _pendingSocialProvider = null;
    signInWithProvider(provider);
  } else {
    go('v-reg');
  }
}

function declineAge18Pre() {
  _pendingSocialProvider = null;
  alert('Cuvée è dedicata al mondo dello Champagne ed è riservata a chi ha già compiuto 18 anni. Potrai registrarti quando li avrai compiuti.');
  go('v-splash');
}

// SIGNUP
async function signUp() {
  const name = document.getElementById('reg-nome')?.value?.trim() || '';
  const email = document.getElementById('reg-email')?.value?.trim() || '';
  const password = document.getElementById('reg-password')?.value || '';
  const errEl = document.getElementById('reg-error');
  const btn = document.getElementById('reg-btn');

  if (!email || !password) {
    showError(errEl, 'Inserisci email e password');
    return;
  }
  if (password.length < 8) {
    showError(errEl, 'Password troppo corta — minimo 8 caratteri');
    return;
  }
  if (!document.getElementById('reg-age18')?.checked) {
    showError(errEl, 'Devi confermare di avere almeno 18 anni per registrarti');
    return;
  }

  btn.textContent = 'Registrazione in corso...';
  btn.disabled = true;
  errEl.style.display = 'none';

  try {
    const { data, error } = await supa.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: name },
        emailRedirectTo: 'https://coralweb-app.github.io/cuvee-app/'
      }
    });
    if (error) throw error;

    // Caso 1: conferma email disabilitata → session attiva subito
    if (data.session) {
      currentUser = data.session.user;
      await _routeAfterAuth();
      return;
    }

    // Caso 2: conferma email abilitata → schermata verifica con polling
    if (data.user && !data.session) {
      btn.textContent = 'Registrati';
      btn.disabled = false;
      startEmailVerification(email);
      return;
    }

    go('v-home');
  } catch(e) {
    showError(errEl, translateAuthError(e.message));
    btn.textContent = 'Registrati';
    btn.disabled = false;
  }
}

// SIGNIN
async function signIn() {
  const email = document.getElementById('login-email')?.value?.trim() || '';
  const password = document.getElementById('login-password')?.value || '';
  const errEl = document.getElementById('login-error');
  const btn = document.getElementById('login-btn');

  if (!email || !password) {
    showError(errEl, 'Inserisci email e password');
    return;
  }

  btn.textContent = 'Accesso in corso...';
  btn.disabled = true;
  errEl.style.display = 'none';

  try {
    const { data, error } = await supa.auth.signInWithPassword({ email, password });
    if (error) throw error;
    if (data.session) {
      currentUser = data.session.user;
      // Load profile but don't block navigation if it fails
      loadUserProfile().catch(e => console.log('Profile load failed:', e));
      go('v-home');
    } else {
      // No session returned - shouldn't happen but handle it
      showError(errEl, 'Accesso non riuscito. Riprova.');
      btn.textContent = 'Accedi';
      btn.disabled = false;
    }
  } catch(e) {
    showError(errEl, translateAuthError(e.message));
    btn.textContent = 'Accedi';
    btn.disabled = false;
  }
}

// Avvio OAuth dalla schermata di REGISTRAZIONE: a differenza del login, qui
// stiamo potenzialmente creando un account nuovo, quindi va bloccato con lo
// stesso controllo del form email — non deve nemmeno partire il redirect
// se la conferma età non è stata data.
function attemptOAuthSignup(provider) {
  if (!document.getElementById('reg-age18')?.checked) {
    const errEl = document.getElementById('reg-error');
    showError(errEl, 'Devi confermare di avere almeno 18 anni per registrarti');
    return;
  }
  signInWithProvider(provider);
}

// SOCIAL LOGIN
async function signInWithProvider(provider) {
  // Apple/Google possono creare un account nuovo anche dal pulsante nella
  // schermata di LOGIN (non solo da quella di registrazione) — quindi anche
  // qui va chiesta la conferma età prima, non dopo che l'account esiste già.
  if (!_ageGateOk) {
    _pendingSocialProvider = provider;
    go('v-age-gate-pre');
    return;
  }
  const isNative = window.Capacitor?.isNativePlatform?.();
  const SL = _socialLoginPlugin();

  // Dentro l'app nativa, Apple usa il flusso di sistema (AuthenticationServices)
  // invece del redirect OAuth via browser, che nella WebView non funziona bene
  // ed è anche il flusso raccomandato/richiesto da Apple in fase di review.
  if (isNative && SL && provider === 'apple') {
    try {
      const res = await SL.login({ provider: 'apple', options: { scopes: ['email', 'name'] } });
      const idToken = res?.result?.idToken;
      if (!idToken) throw new Error('Nessun token ricevuto da Apple');
      // Apple restituisce nome/cognome solo la primissima volta che l'utente
      // autorizza questa app — va salvato subito, non arriverà più ai login successivi.
      const p = res?.result?.profile;
      _pendingSocialName = [p?.givenName, p?.familyName].filter(Boolean).join(' ').trim();
      const { error } = await supa.auth.signInWithIdToken({ provider: 'apple', token: idToken });
      if (error) throw error;
    } catch(e) {
      if (e?.code === 'USER_CANCELLED') return;
      console.log('Apple sign in error:', e);
      alert('Errore: ' + (e?.message || 'accesso con Apple non riuscito'));
    }
    return;
  }

  // Stesso discorso di Apple: dentro l'app nativa Google usa il flusso di
  // sistema (Credential Manager) invece del redirect OAuth via browser.
  if (isNative && SL && provider === 'google') {
    try {
      // Il token di Google include sempre un nonce: va passato anche a
      // Supabase, altrimenti il controllo nonce fallisce (non basta ometterlo).
      // forcePrompt:true è necessario perché, se esiste già un accesso Google
      // precedente sul dispositivo, il plugin lo ripristina silenziosamente
      // (restorePreviousSignIn) SENZA passare il nonce — il token restituito
      // avrebbe quindi un nonce diverso (o nessuno), causando un mismatch.
      // Supabase verifica sha256(nonce grezzo) contro il nonce nel token: a
      // Google va passato l'hash (il plugin lo inoltra così com'è, senza
      // hasharlo lui), a Supabase invece va passato il nonce originale — lo
      // stesso schema che Apple applica già in automatico.
      const rawNonce = Math.random().toString(36).slice(2) + Date.now().toString(36) + Math.random().toString(36).slice(2);
      const hashedNonce = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(rawNonce))))
        .map(b => b.toString(16).padStart(2, '0')).join('');
      const res = await SL.login({ provider: 'google', options: { scopes: ['email', 'profile'], nonce: hashedNonce, forcePrompt: true } });
      const idToken = res?.result?.idToken;
      if (!idToken) throw new Error('Nessun token ricevuto da Google');
      const p = res?.result?.profile;
      _pendingSocialName = p?.name || [p?.givenName, p?.familyName].filter(Boolean).join(' ').trim();
      const { error } = await supa.auth.signInWithIdToken({ provider: 'google', token: idToken, nonce: rawNonce });
      if (error) throw error;
    } catch(e) {
      if (e?.code === 'USER_CANCELLED') return;
      console.log('Google sign in error:', e);
      alert('Errore: ' + (e?.message || 'accesso con Google non riuscito'));
    }
    return;
  }

  // Sito da browser (nessun plugin nativo disponibile): flusso invariato.
  try {
    const { error } = await supa.auth.signInWithOAuth({
      provider,
      options: { redirectTo: window.location.href }
    });
    if (error) throw error;
  } catch(e) {
    alert('Errore: ' + e.message);
  }
}

// RESET PASSWORD
async function resetPassword() {
  const email = document.getElementById('login-email')?.value?.trim();
  if (!email) {
    alert('Inserisci prima la tua email nel campo sopra');
    return;
  }
  const { error } = await supa.auth.resetPasswordForEmail(email, {
    redirectTo: 'https://coralweb-app.github.io/cuvee-app/'
  });
  if (!error) alert('Email di reset inviata! Controlla la tua casella.');
}

// Conferma nuova password (dopo click sul link di reset via email)
async function submitNewPassword() {
  const pass = document.getElementById('newpass-password')?.value || '';
  const pass2 = document.getElementById('newpass-password-confirm')?.value || '';
  const errEl = document.getElementById('newpass-error');
  const btn = document.getElementById('newpass-btn');
  errEl.style.display = 'none';

  if (pass.length < 8) {
    showError(errEl, 'Password troppo corta — minimo 8 caratteri');
    return;
  }
  if (pass !== pass2) {
    showError(errEl, 'Le due password non coincidono');
    return;
  }

  btn.textContent = 'Salvataggio...';
  btn.disabled = true;
  try {
    const { error } = await supa.auth.updateUser({ password: pass });
    if (error) throw error;
    btn.textContent = 'Salva nuova password';
    btn.disabled = false;
    alert('Password aggiornata! Da ora puoi accedere con la nuova password.');
    await _routeAfterAuth();
  } catch(e) {
    showError(errEl, translateAuthError(e.message));
    btn.textContent = 'Salva nuova password';
    btn.disabled = false;
  }
}

// LOGOUT
async function signOut() {
  try {
    await supa.auth.signOut();
  } catch(e) {
    console.log('signOut error:', e);
  }
  // Reset stato locale completo
  currentUser = null;
  allMaison = [];
  allCarnetNotes = [];
  maisonFavorites = new Set();
  currentNote = null;
  currentMaisonDetail = null;
  currentEditId = null;
  currentRating = 0;
  activeCaliceFilter = 0;
  activeSearchQuery = '';
  currentMaisonFilter = 'tutti';
  currentMaisonLetter = 'tutti';
  currentMaisonSearch = '';
  currentBottFilters     = new Set();
  currentBottLetter      = 'tutti';
  currentBottSearch      = '';
  currentBottPriceFilter = 'tutti';
  // Svuota stack navigazione
  stack.length = 0;
  // Nascondi bottom nav
  // Vai alla splash
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  const splash = document.getElementById('v-splash');
  if (splash) splash.classList.add('active');
  updateBottomNav('v-splash');
}

// LOAD USER PROFILE
async function loadUserProfile() {
  if (!currentUser) return;
  try {
    const { data, error } = await supa
      .from('users')
      .select('*')
      .eq('id', currentUser.id)
      .maybeSingle(); // usa maybeSingle - non lancia errore se la riga non esiste

    if (data) {
      currentUser.profile = data;
    } else {
      // Profile row might not exist yet (trigger delay) - create a minimal one
      currentUser.profile = {
        id: currentUser.id,
        email: currentUser.email,
        full_name: currentUser.user_metadata?.full_name || '',
        is_premium: false
      };
    }

    updateProfileUI(currentUser.profile);
    updatePremiumUI();

    // Load counts in background - don't block
    updateCarnetUI().catch(() => {});
    loadSalvati().then(items => {
      const el = document.getElementById('profile-fav-count');
      if (el) el.textContent = items.length + (items.length === 1 ? ' salvato' : ' salvati');
    }).catch(() => {});
    loadWishlist().then(items => {
      const el = document.getElementById('profile-wish-count');
      if (el) el.textContent = items.length + (items.length === 1 ? ' salvato' : ' salvati');
    }).catch(() => {});
    supa.from('scan_history').select('*', { count: 'exact', head: true }).eq('user_id', currentUser.id).then(({ count }) => {
      const el = document.getElementById('profile-scan-count');
      if (el) el.textContent = count ? count + (count === 1 ? ' scansione' : ' scansioni') : '';
    }).catch(() => {});
    updateScanStatsUI().catch(() => {});

  } catch(e) {
    console.log('Profile load error:', e);
    // Even if profile fails, set minimal data from auth
    currentUser.profile = {
      id: currentUser.id,
      email: currentUser.email,
      full_name: currentUser.user_metadata?.full_name || '',
      is_premium: false
    };
    updateProfileUI(currentUser.profile);
  }
}

function updateProfileUI(profile) {
  const email = profile.email || currentUser?.email || '';
  const name = profile.full_name || email.split('@')[0] || 'Utente';
  const firstName = name.split(' ')[0];
  const initial = name.charAt(0).toUpperCase();

  // Nome profilo
  const nameEl = document.getElementById('profile-name');
  if (nameEl) nameEl.textContent = name;

  // Avatar profilo
  const avatarEl = document.getElementById('profile-avatar');
  if (avatarEl) {
    if (profile.avatar_url) {
      avatarEl.innerHTML = '<img src="' + profile.avatar_url + '" style="width:100%;height:100%;object-fit:cover;">';
    } else {
      avatarEl.textContent = initial;
    }
  }

  // Avatar hero home
  const homeAvatar = document.getElementById('home-hero-avatar');
  if (homeAvatar) {
    if (profile.avatar_url) {
      homeAvatar.innerHTML = '<img src="' + profile.avatar_url + '" style="width:100%;height:100%;object-fit:cover;">';
    } else {
      homeAvatar.innerHTML = '<span style="font-size:20px;font-weight:700;color:var(--gold);">' + initial + '</span>';
    }
  }

  // Avatar topbar (tutte le pagine tranne home)
  document.querySelectorAll('.topbar-avatar-btn').forEach(btn => {
    if (profile.avatar_url) {
      btn.innerHTML = '<img src="' + profile.avatar_url + '" style="width:100%;height:100%;object-fit:cover;">';
    } else {
      btn.innerHTML = '<span style="font-size:13px;font-weight:700;color:var(--gold);">' + initial + '</span>';
    }
  });

  // Saluto in home
  const greetEl = document.getElementById('home-greet');
  if (greetEl) {
    const hour = new Date().getHours();
    const greeting = hour < 12 ? 'Buongiorno' : hour < 18 ? 'Buon pomeriggio' : 'Buonasera';
    greetEl.textContent = greeting + ', ' + firstName;
  }

  // Premium badge nel profilo
  const premBadge = document.querySelector('#v-profile .ti-crown')?.closest('div[style*="inline-flex"]');
  if (premBadge) {
    if (isPremium()) {
      premBadge.style.display = 'inline-flex';
    } else {
      premBadge.style.display = 'none';
    }
  }
}

// Ritaglia al centro in quadrato poi ridimensiona — ideale per avatar circolari
function resizeImage(file, maxSize = 250) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      // Crop centrato: usa il lato più corto come lato del quadrato
      const cropSize = Math.min(img.width, img.height);
      const sx = (img.width - cropSize) / 2;
      const sy = (img.height - cropSize) / 2;
      const canvas = document.createElement('canvas');
      canvas.width = maxSize;
      canvas.height = maxSize;
      canvas.getContext('2d').drawImage(img, sx, sy, cropSize, cropSize, 0, 0, maxSize, maxSize);
      canvas.toBlob(b => b ? resolve(b) : reject(new Error('toBlob failed')), 'image/jpeg', 0.88);
    };
    img.onerror = reject;
    img.src = url;
  });
}

async function uploadAvatar(input) {
  if (!input.files || !input.files[0] || !currentUser) return;
  const avatarEl = document.getElementById('profile-avatar');
  const homeAvatar = document.getElementById('home-hero-avatar');
  if (avatarEl) avatarEl.style.opacity = '0.4';

  try {
    // Ridimensiona e ritaglia al quadrato prima dell'upload
    const blob = await resizeImage(input.files[0], 250);

    // Mostra subito l'immagine localmente — nessuna attesa
    const localUrl = URL.createObjectURL(blob);
    const imgTag = '<img src="' + localUrl + '" style="width:100%;height:100%;object-fit:cover;">';
    if (avatarEl) avatarEl.innerHTML = imgTag;
    if (homeAvatar) homeAvatar.innerHTML = imgTag;
    document.querySelectorAll('.topbar-avatar-btn').forEach(btn => btn.innerHTML = imgTag);

    // Upload in background
    const path = currentUser.id + '/avatar.jpg';

    const { error: uploadError } = await supa.storage
      .from('avatars')
      .upload(path, blob, { upsert: true, contentType: 'image/jpeg' });
    if (uploadError) throw uploadError;

    const { data: urlData } = supa.storage.from('avatars').getPublicUrl(path);
    const avatarUrl = urlData.publicUrl + '?t=' + Date.now();

    // Salva URL definitivo nel DB e nel profilo locale
    await supa.from('users').update({ avatar_url: avatarUrl }).eq('id', currentUser.id);
    if (currentUser.profile) currentUser.profile.avatar_url = avatarUrl;

    // Sostituisce l'objectURL con quello definitivo (libera memoria)
    URL.revokeObjectURL(localUrl);
    const finalTag = '<img src="' + avatarUrl + '" style="width:100%;height:100%;object-fit:cover;">';
    if (avatarEl) avatarEl.innerHTML = finalTag;
    if (homeAvatar) homeAvatar.innerHTML = finalTag;
    document.querySelectorAll('.topbar-avatar-btn').forEach(btn => btn.innerHTML = finalTag);

  } catch(e) {
    console.log('Avatar upload error:', e);
  }

  if (avatarEl) avatarEl.style.opacity = '1';
  input.value = '';
}

// ═══════════════════════════════════════════════════════════
//  DATABASE — Caricamento dati reali
// ═══════════════════════════════════════════════════════════

// Carica maison dal database
async function loadMaison(filters = {}) {
  try {
    let query = supa
      .from('maison')
      .select('*, zone(nome, colore)')
      .order('ordine', { ascending: true });

    if (filters.zona) query = query.eq('zona_id', filters.zona);
    if (filters.tipo) query = query.contains('tipo', [filters.tipo]);
    if (filters.featured) query = query.eq('is_featured', true);
    if (filters.search) query = query.textSearch('search_vector', filters.search);

    const { data, error } = await query.limit(filters.limit || 20);
    if (error) throw error;
    return data || [];
  } catch(e) {
    console.log('loadMaison error:', e);
    return [];
  }
}

// Carica bottiglie di una maison
async function loadBottiglie(maisonId) {
  try {
    const { data, error } = await supa
      .from('bottiglie')
      .select('*, link_acquisto(*, partners(nome, url_base))')
      .eq('maison_id', maisonId)
      .eq('needs_review', false)
      .order('is_featured', { ascending: false })
      .order('created_at', { ascending: true });
    if (error) throw error;
    return data || [];
  } catch(e) {
    console.log('loadBottiglie error:', e);
    return [];
  }
}

// Carica note carnet utente
async function loadCarnetNotes() {
  if (!currentUser) return [];
  try {
    const { data, error } = await supa
      .from('carnet_notes')
      .select('*')
      .eq('user_id', currentUser.id)
      .order('data_degustazione', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  } catch(e) {
    console.log('loadCarnet error:', e);
    return [];
  }
}

// Salva nota carnet
async function saveCarnetNote(nota) {
  if (!currentUser) { go('v-login'); return; }
  try {
    // Check limite note gratis (3)
    if (!currentUser.profile?.is_premium) {
      const { count } = await supa
        .from('carnet_notes')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', currentUser.id);
      if (count >= 3) {
        go('v-paywall');
        return;
      }
    }
    const { data, error } = await supa
      .from('carnet_notes')
      .insert({ ...nota, user_id: currentUser.id })
      .select()
      .single();
    if (error) throw error;
    return data;
  } catch(e) {
    console.log('saveNote error:', e);
    alert('Errore nel salvataggio: ' + e.message);
  }
}

// Toggle preferito maison
async function toggleFavorite(maisonId) {
  if (!currentUser) { go('v-login'); return; }
  try {
    const { data: existing } = await supa
      .from('favorites')
      .select('id')
      .eq('user_id', currentUser.id)
      .eq('maison_id', maisonId)
      .single();

    if (existing) {
      await supa.from('favorites').delete().eq('id', existing.id);
      return false; // rimosso
    } else {
      await supa.from('favorites').insert({ user_id: currentUser.id, maison_id: maisonId });
      return true; // aggiunto
    }
  } catch(e) {
    console.log('toggleFavorite error:', e);
  }
}

// ═══ HELPERS ═══
function updateProfileCounters() {
  const n = maisonFavorites.size;
  const favEl = document.getElementById('profile-fav-count');
  if (favEl) favEl.textContent = n + (n === 1 ? ' salvato' : ' salvati');
  const w = wishlistIds.size;
  const wishEl = document.getElementById('profile-wish-count');
  if (wishEl) wishEl.textContent = w + (w === 1 ? ' salvato' : ' salvati');
}

function showError(el, msg) {
  if (!el) return;
  el.textContent = msg;
  el.style.display = 'block';
}

function translateAuthError(msg) {
  const errors = {
    'Invalid login credentials': 'Email o password non corretti',
    'Email not confirmed': 'Controlla la tua email per confermare l\'account',
    'User already registered': "Questa email è già registrata. Prova ad accedere.",
    'Password should be at least 6 characters': 'Password troppo corta, minimo 8 caratteri',
    'Unable to validate email address': 'Indirizzo email non valido',
  };
  return errors[msg] || msg;
}

// Mostra la versione reale dell'app (da Info.plist/build.gradle, la stessa
// pubblicata su App Store/Play Store) invece di un numero scritto a mano.
// Nel sito da browser (non app nativa) il concetto non si applica: si nasconde.
async function initAppVersionLabel() {
  const block = document.getElementById('app-version-block');
  if (!block) return;
  if (!window.Capacitor?.isNativePlatform?.()) { block.remove(); return; }
  const AppInfo = window.Capacitor?.Plugins?.App;
  if (!AppInfo) { block.remove(); return; }
  try {
    const info = await AppInfo.getInfo();
    document.getElementById('app-version-label').textContent = info.version;
  } catch(e) {
    console.log('App.getInfo error:', e);
    block.remove();
  }
}

// Aggiorna il pulsante logout nel profilo
document.addEventListener('DOMContentLoaded', function() {
  const logoutBtn = document.querySelector('#v-profile .btn-outline');
  if (logoutBtn) logoutBtn.onclick = signOut;
  initAuth();
  loadHomeCounts();
  initRevenueCat();
  initSocialLogin();
  initAppVersionLabel();
});

// Arrotonda per difetto alla decina e aggiunge "+" — mostra un numero
// approssimativo invece del conteggio esatto (es. 197 → "190+"), usato
// ovunque in app compaia il totale di produttori/champagne a catalogo.
function _approxCount(n) {
  return Math.floor((n || 0) / 10) * 10 + '+';
}

async function loadHomeCounts() {
  const elP = document.getElementById('home-count-produttori');
  const elC = document.getElementById('home-count-champagne');
  try {
    const [{ data: dp }, { data: dc }] = await Promise.all([
      supa.from('maison').select('id').eq('is_published', true),
      supa.from('bottiglie').select('id').eq('is_published', true)
    ]);
    if (elP) elP.textContent = _approxCount(dp?.length) + ' produttori';
    if (elC) elC.textContent = _approxCount(dc?.length) + ' cuvée';
  } catch(e) {
    if (elP) elP.textContent = 'Esplora';
    if (elC) elC.textContent = 'Esplora';
  }
}



// ═══ EMAIL VERIFICATION POLLING ═══
let verifyInterval = null;
let verifyEmail = '';
let verifyAttempts = 0;

function startEmailVerification(email) {
  verifyEmail = email;
  verifyAttempts = 0;

  // Show email on screen
  const emailEl = document.getElementById('verify-email-show');
  if (emailEl) emailEl.textContent = email;

  // Go to verify screen
  go('v-verify');

  // Start polling every 3 seconds
  stopVerifyPolling(); // clear any existing
  verifyInterval = setInterval(checkEmailVerified, 3000);
}

async function checkEmailVerified() {
  verifyAttempts++;
  const statusEl = document.getElementById('verify-status');

  try {
    // Refresh the session - if email confirmed, session will be active
    const { data, error } = await supa.auth.getSession();

    if (data?.session?.user?.email_confirmed_at) {
      // Email confirmed!
      stopVerifyPolling();
      currentUser = data.session.user;

      // Show success feedback briefly
      if (statusEl) {
        statusEl.textContent = 'Email confermata! Accesso in corso...';
        statusEl.style.color = '#085041';
      }

      // Small delay for UX then go to home
      setTimeout(async () => {
        await loadUserProfile();
        go('v-home');
      }, 1200);
      return;
    }

    // Also try refreshing the session explicitly
    if (verifyAttempts % 5 === 0) {
      await supa.auth.refreshSession();
    }

    // Update status message
    const mins = Math.floor((verifyAttempts * 3) / 60);
    const secs = (verifyAttempts * 3) % 60;
    const timeStr = mins > 0 ? mins + 'm ' + secs + 's' : secs + 's';
    if (statusEl) statusEl.textContent = 'In attesa... (' + timeStr + ')';

    // After 10 minutes, slow down polling
    if (verifyAttempts > 200) {
      stopVerifyPolling();
      verifyInterval = setInterval(checkEmailVerified, 10000);
      if (statusEl) statusEl.textContent = 'Ancora in attesa — ricontrolla la tua email';
    }

  } catch(e) {
    console.log('Verify check error:', e);
  }
}

function stopVerifyPolling() {
  if (verifyInterval) {
    clearInterval(verifyInterval);
    verifyInterval = null;
  }
}

async function resendVerification() {
  if (!verifyEmail) return;
  try {
    const { error } = await supa.auth.resend({
      type: 'signup',
      email: verifyEmail
    });
    const statusEl = document.getElementById('verify-status');
    if (!error && statusEl) {
      statusEl.textContent = 'Email inviata di nuovo!';
      statusEl.style.color = '#085041';
      setTimeout(() => {
        if (statusEl) {
          statusEl.textContent = 'In attesa di conferma...';
          statusEl.style.color = '';
        }
      }, 3000);
    }
  } catch(e) {
    console.log('Resend error:', e);
  }
}

// Handle email confirmation redirect (when user clicks link and comes back)
// Supabase fires SIGNED_IN event when email is confirmed via magic link



// ═══ CARNET DETAIL — render nota selezionata ═══
let currentNote = null;

function openNoteDetail(note) {
  currentNote = note;
  const container = document.getElementById('detail-content');
  if (!container) { go('v-carnet-detail'); return; }

  const _tipoLabel = {nv:'Sans Année',millesimato:'Millésimé',rose:'Rosé',blanc_de_blancs:'Blanc de Blancs',blanc_de_noirs:'Blanc de Noirs',prestige:'Prestige Cuvée',nature:'Brut Nature'};
  const tipoArr = Array.isArray(note.tipo) ? note.tipo : (note.tipo ? [note.tipo] : []);
  const tipoLabel = tipoArr.filter(t => t !== 'non_so').map(t => _tipoLabel[t]||t).join(' · ');

  const paramDefs = [
    {key:'acidite',      label:'Acidité',             color:'#4A8FA8',bg:'#E0EDF2',icon:'ti-droplet'},
    {key:'effervescence',label:'Effervescence',        color:'#9B7DC8',bg:'#EDE8F6',icon:'ti-wind'},
    {key:'complexite',   label:'Complexité aromatique',color:'#C8962A',bg:'#F5EDD5',icon:'ti-sparkles'},
    {key:'longueur',     label:'Longueur en bouche',   color:'#4A8A5A',bg:'#DFF0E4',icon:'ti-arrow-right'}
  ].filter(p => note[p.key] != null && note[p.key] !== '');

  const date = note.data_degustazione
    ? new Date(note.data_degustazione).toLocaleDateString('it-IT',{day:'numeric',month:'long',year:'numeric'})
    : '';

  const noteRating = note.rating || 0;
  const glasses = Array.from({length:5},(_,i) =>
    '<i class="ti ti-glass-full" style="font-size:20px;color:var(--gold);opacity:'+(i<Math.min(noteRating,5)?'1':'0.18')+'"></i>'
  ).join('') + (noteRating >= 6
    ? '<i class="ti ti-heart-filled" style="font-size:20px;color:#E05252;margin-left:5px;"></i><span style="font-family:var(--sans);font-size:12px;color:#E05252;font-weight:700;margin-left:4px;letter-spacing:.2px;">Fantastico!</span>'
    : '');

  // Helper: card-section with title
  const sec = (icon,title,body) =>
    '<div class="form-section" style="margin-top:12px;">' +
    '<div class="form-section-title"><i class="ti '+icon+'"></i>'+title+'</div>' +
    body+'</div>';

  // ── Collect all photos ─────────────────────────────────────
  window._currentNotePhotos = note.foto_urls && note.foto_urls.length > 0
    ? note.foto_urls
    : (note.foto_url ? [note.foto_url] : []);
  const allPhotos = window._currentNotePhotos;

  // ── HERO: foto sinistra + info destra ───────────────────────
  const photoEl = allPhotos.length > 0
    ? '<img src="'+allPhotos[0]+'" style="width:100%;height:100%;object-fit:cover;display:block;cursor:pointer;" onclick="openLightbox(window._currentNotePhotos,0)"/>'
    : '<svg width="40" height="40" viewBox="0 0 512 512" fill="rgba(184,146,42,.28)"><path fill-rule="evenodd" clip-rule="evenodd" d="M217.6,0 L294.4,0 L294.4,76.8 C294.4,256 371.2,217.6 371.2,396.8 L371.2,512 L140.8,512 L140.8,396.8 C140.8,217.6 217.6,256 217.6,76.8 Z M335.057,240.943 L256,320 L176.943,240.943 L176.943,258.943 L256,338 L335.057,258.943 Z M204.8,396.8 L307.2,396.8 L307.2,435.2 L204.8,435.2 Z"/></svg>';

  let badges = '';
  if (note.annata)       badges += '<span style="background:var(--gold-pale);border:0.5px solid var(--gold-border);border-radius:5px;padding:3px 8px;font-family:var(--sans);font-size:11px;color:#8a6a1e;font-weight:500;">'+note.annata+'</span>';
  if (tipoLabel)         badges += '<span style="background:var(--ivory-2);border:0.5px solid var(--border-2);border-radius:5px;padding:3px 8px;font-family:var(--sans);font-size:11px;color:var(--ink-3);">'+tipoLabel+'</span>';
  if (note.dosage_testo) badges += '<span style="background:var(--ivory-2);border:0.5px solid var(--border-2);border-radius:5px;padding:3px 8px;font-family:var(--sans);font-size:11px;color:var(--ink-3);">'+note.dosage_testo+'</span>';

  let html =
    '<div style="margin:12px 14px 0;background:var(--white);border-radius:16px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.07);display:flex;min-height:170px;">'+
      '<div style="width:125px;flex-shrink:0;background:linear-gradient(150deg,#F8F2E6,#EBD9B8);overflow:hidden;display:flex;align-items:center;justify-content:center;">'+
        photoEl+
      '</div>'+
      '<div style="flex:1;padding:16px 15px;display:flex;flex-direction:column;justify-content:space-between;min-width:0;">'+
        '<div>'+
          '<div style="font-family:var(--sans);font-size:11px;color:var(--gold);font-weight:600;text-transform:uppercase;letter-spacing:.6px;margin-bottom:5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">'+(note.maison_nome||'')+'</div>'+
          '<div style="font-family:var(--serif);font-size:22px;color:var(--ink);font-weight:500;line-height:1.2;margin-bottom:9px;">'+(note.cuvee_nome||'')+'</div>'+
          (badges ? '<div style="display:flex;flex-wrap:wrap;gap:5px;">'+badges+'</div>' : '')+
        '</div>'+
        '<div>'+
          '<div style="display:flex;gap:2px;margin-bottom:5px;">'+glasses+'</div>'+
          (date ? '<div style="font-family:var(--sans);font-size:11px;color:var(--ink-5);">'+date+'</div>' : '')+
        '</div>'+
      '</div>'+
    '</div>';

  // ── GALLERIA (se 2+ foto) ───────────────────────────────────
  if (allPhotos.length > 1) {
    let gBody = '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:7px;">';
    allPhotos.forEach((url, i) => {
      gBody += '<div style="aspect-ratio:1/1;overflow:hidden;border-radius:9px;cursor:pointer;" onclick="openLightbox(window._currentNotePhotos,'+i+')">'+
        '<img src="'+url+'" style="width:100%;height:100%;object-fit:cover;"/>'+
      '</div>';
    });
    gBody += '</div>';
    html += sec('ti-photo', 'Galleria · '+allPhotos.length+' foto', gBody);
  }

  // ── PARAMETRI SENSORIALI ────────────────────────────────────
  if (paramDefs.length > 0) {
    let body = '<div style="display:flex;flex-direction:column;gap:16px;">';
    paramDefs.forEach(p => {
      const val = note[p.key];
      const pct = val / 10 * 100;
      body +=
        '<div>'+
          '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:7px;">'+
            '<span style="font-family:var(--sans);font-size:14px;color:var(--ink-2);display:flex;align-items:center;gap:6px;"><i class="ti '+p.icon+'" style="color:'+p.color+';font-size:15px;"></i>'+p.label+'</span>'+
            '<span style="width:26px;height:26px;border-radius:50%;background:'+p.color+';color:#fff;font-family:var(--sans);font-size:13px;font-weight:600;display:flex;align-items:center;justify-content:center;">'+val+'</span>'+
          '</div>'+
          '<div style="height:6px;background:'+p.bg+';border-radius:3px;overflow:hidden;">'+
            '<div style="width:'+pct+'%;height:100%;background:'+p.color+';border-radius:3px;"></div>'+
          '</div>'+
        '</div>';
    });
    body += '</div>';
    html += sec('ti-adjustments','Parametri sensoriali', body);
  }

  // ── AROMI ───────────────────────────────────────────────────
  if (note.aromi && note.aromi.length > 0) {
    let body = '<div style="display:flex;flex-wrap:wrap;gap:7px;">';
    note.aromi.forEach(a => { body += '<span class="aromi-pill on">'+a+'</span>'; });
    body += '</div>';
    html += sec('ti-leaf','Aromi percepiti', body);
  }

  // ── NOTE LIBERE ─────────────────────────────────────────────
  if (note.note_libere) {
    const body = '<div style="font-family:var(--sans);font-size:16px;color:var(--ink-3);line-height:1.75;font-style:italic;border-left:3px solid var(--gold-border);padding-left:14px;">&ldquo;'+note.note_libere+'&rdquo;</div>';
    html += sec('ti-quote','Note di degustazione', body);
  }

  // ── DETTAGLI ────────────────────────────────────────────────
  const detRows = [];
  if (note.sboccatura)    detRows.push({icon:'ti-calendar-check', label:'Sboccatura',    val: note.sboccatura});
  if (note.luogo)         detRows.push({icon:'ti-map-pin',        label:'Luogo',         val: note.luogo});
  if (note.prezzo_pagato) detRows.push({icon:'ti-coin',           label:'Prezzo pagato', val: '€ '+note.prezzo_pagato});

  if (detRows.length > 0) {
    let body = '';
    detRows.forEach((d,i) => {
      body +=
        '<div style="display:flex;align-items:center;gap:12px;padding:10px 0;'+(i<detRows.length-1?'border-bottom:1px solid var(--border);':'')+'">' +
          '<div style="width:36px;height:36px;border-radius:10px;background:var(--gold-pale);display:flex;align-items:center;justify-content:center;flex-shrink:0;"><i class="ti '+d.icon+'" style="font-size:17px;color:var(--gold);"></i></div>'+
          '<div><div style="font-family:var(--sans);font-size:12px;color:var(--ink-5);margin-bottom:1px;">'+d.label+'</div>'+
          '<div style="font-family:var(--sans);font-size:16px;color:var(--ink);">'+d.val+'</div></div>'+
        '</div>';
    });
    html += sec('ti-info-circle','Dettagli', body);
  }

  // ── ANALISI SCANSIONE ───────────────────────────────────────
  if (note.scan_result_json) {
    const sr  = note.scan_result_json;
    const b2  = sr.matched_bottle || {};
    const score          = sr.score_medio          ?? b2.score_medio          ?? null;
    const noteDeg        = sr.note_degustazione    || b2.note_degustazione    || '';
    const abbinamento    = sr.abbinamento          || b2.abbinamento          || '';
    const finestra_da    = sr.finestra_da          || b2.finestra_da          || null;
    const finestra_a     = sr.finestra_a           || b2.finestra_a           || null;
    const isMillesimato  = sr.is_millesimato       ?? b2.is_millesimato       ?? false;
    const finestraConsMin= sr.finestra_consumo_min_anni ?? b2.finestra_consumo_min_anni ?? null;
    const finestraConsMax= sr.finestra_consumo_max_anni ?? b2.finestra_consumo_max_anni ?? null;
    const pctPN          = sr.pct_pinot_noir       ?? b2.pct_pinot_noir       ?? null;
    const pctCH          = sr.pct_chardonnay       ?? b2.pct_chardonnay       ?? null;
    const pctPM          = sr.pct_meunier          ?? b2.pct_meunier          ?? null;
    const provenienzaUve = sr.provenienza_uve      ?? b2.provenienza_uve      ?? null;
    const vinificazione  = sr.vinificazione        ?? b2.vinificazione        ?? null;
    const malolattica    = sr.malolattica          ?? b2.malolattica          ?? null;
    const maturazioneMesi= sr.maturazione_mesi     ?? b2.maturazione_mesi     ?? null;
    const prodBottiglie  = sr.produzione_bottiglie ?? b2.produzione_bottiglie ?? null;
    const dosaggioGl     = sr.dosaggio_gl          ?? b2.dosaggio_gl          ?? null;
    const dosage         = sr.dosage               || b2.dosaggio_tipo        || null;
    const prezzoMin      = sr.prezzo_min           ?? b2.prezzo_min           ?? null;
    const prezzoMax      = sr.prezzo_max           ?? b2.prezzo_max           ?? null;
    const fascia         = sr.fascia_prezzo        ?? b2.fascia_prezzo        ?? null;
    const assemblaggio   = sr.assemblaggio         ?? b2.assemblaggio         ?? null;

    const scoreTag = score
      ? '<span style="font-family:var(--sans);font-size:13px;font-weight:700;color:var(--gold);">'+score+'</span><span style="font-family:var(--sans);font-size:11px;color:var(--ink-5);">/100</span>'
      : '';

    // ── Sezioni corpo ──
    let innerHtml = '';

    // Note degustazione
    if (noteDeg) innerHtml +=
      '<div style="margin-bottom:16px;">' +
        '<div style="font-family:var(--sans);font-size:11px;font-weight:600;color:var(--ink-4);text-transform:uppercase;letter-spacing:.8px;margin-bottom:8px;"><i class="ti ti-notes" style="margin-right:5px;"></i>Note di degustazione</div>' +
        '<div style="font-family:var(--sans);font-size:14px;color:var(--ink-3);line-height:1.75;border-left:3px solid var(--gold-border);padding-left:12px;">'+noteDeg+'</div>' +
      '</div>';

    // Abbinamento
    if (abbinamento) innerHtml +=
      '<div style="margin-bottom:16px;">' +
        '<div style="font-family:var(--sans);font-size:11px;font-weight:600;color:var(--ink-4);text-transform:uppercase;letter-spacing:.8px;margin-bottom:8px;"><i class="ti ti-chef-hat" style="margin-right:5px;"></i>Abbinamento</div>' +
        '<div style="font-family:var(--sans);font-size:14px;color:var(--ink-3);line-height:1.7;">'+abbinamento+'</div>' +
      '</div>';

    // Assemblaggio (vini di base, anni + %)
    (function() {
      const ribbon = buildAssemblaggioHTML(assemblaggio);
      if (!ribbon) return;
      innerHtml +=
        '<div style="margin-bottom:16px;">' +
          '<div style="font-family:var(--sans);font-size:11px;font-weight:600;color:var(--ink-4);text-transform:uppercase;letter-spacing:.8px;margin-bottom:10px;"><i class="ti ti-chart-bar" style="margin-right:5px;"></i>Vini di base</div>' +
          ribbon +
        '</div>';
    })();

    // Scheda tecnica
    (function() {
      const inner = buildSchedaTecnicaHTML({
        pctPinotNoir: pctPN, pctChardonnay: pctCH, pctMeunier: pctPM,
        dosaggioGl, dosaggioTipo: dosage,
        maturazioneMesi, provenienzaUve, vinificazione, malolattica,
        produzioneBottiglie: prodBottiglie,
      });
      if (!inner) return;
      innerHtml +=
        '<div style="margin-bottom:16px;">' +
          '<div style="font-family:var(--sans);font-size:11px;font-weight:600;color:var(--ink-4);text-transform:uppercase;letter-spacing:.8px;margin-bottom:8px;"><i class="ti ti-list-details" style="margin-right:5px;"></i>Scheda tecnica</div>' +
          inner +
        '</div>';
    })();

    // Finestra di degustazione
    const finestraHtml = isMillesimato
      ? buildFinestraHTML(finestra_da, finestra_a)
      : buildFinestraSAHTML(finestraConsMin, finestraConsMax);
    if (finestraHtml) innerHtml += '<div style="margin-bottom:16px;">' + finestraHtml + '</div>';

    // Prezzo
    if (prezzoMin || fascia) {
      innerHtml +=
        '<div>' +
          priceScale(fascia, prezzoMin) +
          (prezzoMin
            ? '<div style="font-family:var(--sans);font-size:12px;color:var(--ink-4);margin-top:3px;">' +
                'da <b style="color:var(--gold);">'+prezzoMin+'€</b>' +
                (prezzoMax ? ' – <b style="color:var(--gold);">'+prezzoMax+'€</b>' : '') +
                ' <span style="font-size:11px;">(Italia, 75cl)</span>' +
              '</div>'
            : '') +
        '</div>';
    }

    if (!innerHtml) innerHtml = '<div style="font-family:var(--sans);font-size:13px;color:var(--ink-5);">Nessun dato aggiuntivo disponibile.</div>';

    html +=
      '<div style="margin:12px 14px 4px;background:var(--white);border-radius:14px;box-shadow:0 2px 10px rgba(0,0,0,.06);overflow:hidden;">' +
        '<div onclick="toggleScanAnalysis()" style="display:flex;align-items:center;justify-content:space-between;padding:14px 16px;cursor:pointer;-webkit-tap-highlight-color:transparent;">' +
          '<div style="display:flex;align-items:center;gap:12px;">' +
            '<div style="width:36px;height:36px;border-radius:10px;background:linear-gradient(135deg,#1A1F2E,#252B3D);display:flex;align-items:center;justify-content:center;flex-shrink:0;">' +
              '<i class="ti ti-scan" style="font-size:16px;color:#8BA8E0;"></i>' +
            '</div>' +
            '<div>' +
              '<div style="font-family:var(--sans);font-size:13px;font-weight:600;color:var(--ink);">Rivedi l\'analisi scansione</div>' +
              (scoreTag ? '<div style="margin-top:2px;">'+scoreTag+'</div>' : '') +
            '</div>' +
          '</div>' +
          '<i id="scan-analysis-chevron" class="ti ti-chevron-right" style="font-size:18px;color:var(--ink-4);transition:transform .25s;flex-shrink:0;"></i>' +
        '</div>' +
        '<div id="scan-analysis-body" style="display:none;padding:0 16px 16px;">'+innerHtml+'</div>' +
      '</div>';
  }

  container.innerHTML = html;
  go('v-carnet-detail');
}

function toggleScanAnalysis() {
  const body = document.getElementById('scan-analysis-body');
  const chevron = document.getElementById('scan-analysis-chevron');
  if (!body) return;
  const open = body.style.display === 'block';
  body.style.display = open ? 'none' : 'block';
  if (chevron) chevron.style.transform = open ? '' : 'rotate(90deg)';
}


// ═══ COLLEZIONI — Salvati e Wishlist ═══

async function loadSalvati() {
  if (!currentUser) return [];
  try {
    const { data, error } = await supa
      .from('favorites')
      .select('*, maison(id, nome, slug, tipo, sede_comune, anno_fondazione, foto_url)')
      .eq('user_id', currentUser.id)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  } catch(e) {
    console.log('loadSalvati error:', e);
    return [];
  }
}

async function loadWishlist() {
  if (!currentUser) return [];
  try {
    const { data, error } = await supa
      .from('wishlist')
      .select('*, bottiglie(id, nome, tipo, dosaggio_tipo, annata, prezzo_min, prezzo_max, foto_url, maison(nome))')
      .eq('user_id', currentUser.id)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  } catch(e) {
    console.log('loadWishlist error:', e);
    return [];
  }
}

async function updateSalvatiUI() {
  const items = await loadSalvati();
  const emptyEl = document.getElementById('salvati-empty');
  const listEl = document.getElementById('salvati-list');
  const countEl = document.getElementById('profile-fav-count');

  if (countEl) countEl.textContent = items.length + (items.length === 1 ? ' salvato' : ' salvati');

  if (!listEl) return;
  if (items.length === 0) {
    if (emptyEl) emptyEl.style.display = 'block';
    listEl.style.display = 'none';
    return;
  }

  if (emptyEl) emptyEl.style.display = 'none';
  listEl.style.display = 'block';

  listEl.innerHTML = items.map(item => {
    const m = item.maison;
    if (!m) return '';
    const tipoLabel = {
      'grande_maison': 'Grande Maison',
      'vigneron_rm': 'Vigneron RM',
      'cooperativa': 'Cooperativa',
      'negociant': 'Négociant'
    }[m.tipo] || m.tipo;

    const zoneColor = m.zone?.colore || '#b8922a';
    const initial = maisonMonogram(m.nome);
    return '<div class="maison-card" onclick="openSavedMaison(\'' + m.id + '\')" style="margin:0 14px 12px;">' +
      '<div class="maison-body">' +
      '<div class="maison-header-row">' +
      '<div class="maison-id">' +
      (m.foto_url
        ? '<div class="maison-thumb"><img src="' + m.foto_url + '" loading="lazy"/></div>'
        : '<div class="maison-monogram" style="color:' + zoneColor + ';background:' + zoneColor + '14;border-color:' + zoneColor + '40;">' + initial + '</div>') +
      '<div style="min-width:0;"><div class="maison-name">' + m.nome + '</div></div>' +
      '</div>' +
      '<i class="ti ti-trash" style="font-size:20px;color:#c0a080;cursor:pointer;flex-shrink:0;" data-id="' + item.id + '" onclick="event.stopPropagation();removeFavorite(this.dataset.id)"></i>' +
      '</div>' +
      '<div class="maison-meta">' + [m.sede_comune, m.anno_fondazione ? 'dal ' + m.anno_fondazione : ''].filter(Boolean).join(' · ') + '</div>' +
      '<div class="badges-row"><span class="badge badge-gm">' + tipoLabel + '</span></div>' +
      '</div></div>';
  }).join('');
}

async function updateWishlistUI() {
  const items = await loadWishlist();
  const emptyEl = document.getElementById('wishlist-empty');
  const listEl = document.getElementById('wishlist-list');
  const countEl = document.getElementById('profile-wish-count');

  if (countEl) countEl.textContent = items.length + (items.length === 1 ? ' salvato' : ' salvati');

  if (!listEl) return;
  if (items.length === 0) {
    if (emptyEl) emptyEl.style.display = 'block';
    listEl.style.display = 'none';
    return;
  }

  if (emptyEl) emptyEl.style.display = 'none';
  listEl.style.display = 'block';

  listEl.innerHTML = items.map(item => {
    const b = item.bottiglie;
    if (!b) return '';
    const prezzo = b.prezzo_min ? 'da ' + b.prezzo_min + '€' : '';
    const tipoLabel = {
      'nv': 'Sans Année',
      'millesime': 'Millésimé',
      'prestige': 'Prestige Cuvée',
      'blanc_de_blancs': 'Blanc de Blancs',
      'blanc_de_noirs': 'Blanc de Noirs',
      'rose': 'Rosé',
      'nature': 'Brut Nature'
    }[b.tipo] || b.tipo || '';

    return '<div class="bottle-row" onclick="openSavedBottiglia(\'' + b.id + '\')" style="margin:0 14px 9px;cursor:pointer;">' +
      '<div class="bottle-ph"><svg viewBox="0 0 512 512" fill="currentColor"><path fill-rule="evenodd" clip-rule="evenodd" d="M217.6,0 L294.4,0 L294.4,76.8 C294.4,256 371.2,217.6 371.2,396.8 L371.2,512 L140.8,512 L140.8,396.8 C140.8,217.6 217.6,256 217.6,76.8 Z M335.057,240.943 L256,320 L176.943,240.943 L176.943,258.943 L256,338 L335.057,258.943 Z M204.8,396.8 L307.2,396.8 L307.2,435.2 L204.8,435.2 Z"/></svg></div>' +
      '<div class="bottle-info">' +
      '<div class="bottle-name">' + b.nome + '</div>' +
      '<div class="bottle-type">' + [b.maison?.nome, tipoLabel, b.annata].filter(Boolean).join(' · ') + '</div>' +
      (prezzo ? '<div class="bottle-price">' + prezzo + '</div>' : '') +
      '</div>' +
      '<i class="ti ti-trash" style="font-size:20px;color:#c0a080;cursor:pointer;flex-shrink:0;" data-id="' + item.id + '" onclick="event.stopPropagation();removeFromWishlist(this.dataset.id)"></i>' +
      '</div>';
  }).join('');
}

async function removeFavorite(favId) {
  if (!currentUser) return;
  try {
    await supa.from('favorites').delete().eq('id', favId);
    await updateSalvatiUI();
  } catch(e) {
    console.log('removeFavorite error:', e);
  }
}

async function openSavedMaison(maisonId) {
  const cached = allMaison.find(x => x.id === maisonId);
  // Carica dati completi se assenti o parziali (es. caricati solo per la ricerca)
  if (!cached || !('descrizione' in cached)) {
    try {
      const { data } = await supa.from('maison').select('*, zone(nome, colore)').eq('id', maisonId).maybeSingle();
      if (data) {
        const idx = allMaison.findIndex(x => x.id === maisonId);
        if (idx >= 0) allMaison[idx] = data; // sostituisce dati parziali
        else allMaison = [...allMaison, data];
      }
    } catch(e) { console.log('openSavedMaison error:', e); }
  }
  openMaisonDetail(maisonId);
}

async function openSavedBottiglia(bottId) {
  const cached = allBottiglie.find(x => x.id === bottId);
  // Carica dati completi se assenti o parziali
  if (!cached || !('score' in cached)) {
    try {
      const { data } = await supa.from('bottiglie').select('*, maison(nome, slug)').eq('id', bottId).maybeSingle();
      if (data) {
        const idx = allBottiglie.findIndex(x => x.id === bottId);
        if (idx >= 0) allBottiglie[idx] = data; // sostituisce dati parziali
        else allBottiglie = [...allBottiglie, data];
      }
    } catch(e) { console.log('openSavedBottiglia error:', e); }
  }
  openBottigliaDetail(bottId);
}

async function removeFromWishlist(wishId) {
  if (!currentUser) return;
  try {
    await supa.from('wishlist').delete().eq('id', wishId);
    await updateWishlistUI();
  } catch(e) {
    console.log('removeWishlist error:', e);
  }
}



// ═══ RICERCA HOME ═══

let homeSearchTimeout = null;
let homeSearchCat = 'tutti';

// Normalizza stringa: rimuove accenti e porta in lowercase
// "Moët" → "moet", "Bâtonnage" → "batonnage", "Rosé" → "rose"
function normalizeStr(s) {
  return String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

// Ricerca multi-termine: spezza la query in parole e richiede che OGNI parola
// compaia da qualche parte nell'insieme dei campi passati (in qualsiasi ordine,
// anche a cavallo tra campi diversi \u2014 es. "krug 171" trova maison="Krug" +
// nome="Grande Cuv\u00e9e 171\u00e8me \u00c9dition" anche se "krug" non \u00e8 nel nome bottiglia).
function matchesAllTerms(query, ...fields) {
  const terms = (query || '').trim().split(/\s+/).map(normalizeStr).filter(Boolean);
  if (!terms.length) return true;
  const combined = fields.map(f => normalizeStr(f || '')).join(' ');
  return terms.every(t => combined.includes(t));
}

// Usa esattamente la stessa query di loadAndRenderMaison (provata e funzionante)
async function ensureMaisonLoaded() {
  if (allMaison.length > 0) return;
  try {
    const { data, error } = await supa
      .from('maison')
      .select('*, zone(nome, colore)')
      .eq('is_published', true)
      .order('nome', { ascending: true });
    if (!error) allMaison = data || [];
    else console.log('ensureMaisonLoaded error:', error);
  } catch(e) { console.log('ensureMaisonLoaded exc:', e); }
}

// Usa esattamente la stessa query di loadAndRenderBottiglie (provata e funzionante)
async function ensureBottiglieLoaded() {
  if (allBottiglie.length > 0) return;
  try {
    const { data, error } = await supa
      .from('bottiglie')
      .select('*, maison(nome, slug, is_free)')
      .eq('is_published', true)
      .eq('needs_review', false)
      .order('nome', { ascending: true });
    if (!error) allBottiglie = data || [];
    else console.log('ensureBottiglieLoaded error:', error);
  } catch(e) { console.log('ensureBottiglieLoaded exc:', e); }
}

// Carica glossario se non ancora in cache
async function ensureGlossarioLoaded() {
  if (allGlossario.length > 0) return;
  try {
    const { data, error } = await supa
      .from('glossario')
      .select('termine, definizione, lettera, livello, categoria')
      .eq('is_published', true)
      .order('termine', { ascending: true });
    if (!error) allGlossario = data || [];
    else console.log('ensureGlossarioLoaded error:', error);
  } catch(e) { console.log('ensureGlossarioLoaded exc:', e); }
}

function showHomeSearchUI() {
  document.getElementById('home-search-cat').style.display = 'flex';
}

function hideHomeSearchUI() {
  // Ritardo: lascia registrare eventuali click sui badge prima di nasconderli
  setTimeout(() => {
    const input = document.getElementById('home-search-input');
    if (!input || input.value.trim() !== '') return; // non nascondere se c'è testo
    document.getElementById('home-search-cat').style.display = 'none';
    document.getElementById('home-search-results').style.display = 'none';
    const mainContent = document.getElementById('home-main-content');
    if (mainContent) mainContent.style.display = '';
  }, 150);
}

function doHomeSearch() {
  const q = document.getElementById('home-search-input').value.trim();
  const clear = document.getElementById('home-search-clear');
  const results = document.getElementById('home-search-results');
  const mainContent = document.getElementById('home-main-content');

  if (q.length === 0) { clearHomeSearch(); return; }

  clear.style.display = 'block';
  results.style.display = 'block';
  mainContent.style.display = 'none';

  if (q.length < 2) {
    results.innerHTML = '<div class="home-search-empty">Digita almeno 2 caratteri…</div>';
    return;
  }

  clearTimeout(homeSearchTimeout);
  homeSearchTimeout = setTimeout(() => _execHomeSearch(q), 300);
}

// Card per un risultato di ricerca bloccato da Premium — niente contenuto
// reale nel markup (solo titolo, mai la definizione/descrizione), card scura
// per farsi notare invece di sparire nell'affievolimento usuale.
function _lockedSearchCard(title, sub) {
  return '<div class="search-lock-card" onclick="go(\'v-paywall\')">' +
    '<div class="search-lock-icon"><i class="ti ti-lock"></i></div>' +
    '<div style="flex:1;min-width:0;">' +
      '<div class="search-lock-title">' + title + '</div>' +
      '<div class="search-lock-sub">' + sub + '</div>' +
    '</div>' +
    '<div class="search-lock-badge"><i class="ti ti-lock"></i>Premium</div>' +
  '</div>';
}

// Stessa regola di isBottigliaLocked ma calcolata in locale sull'elenco già
// caricato (evita una query per ogni risultato mostrato in ricerca).
function _computeBottleLockMap() {
  const map = new Map();
  if (isPremium()) return map;
  const seenPerMaison = new Map();
  allBottiglie.forEach(b => {
    const maisonLocked = b.maison?.is_free === false;
    const idx = seenPerMaison.get(b.maison_id) || 0;
    seenPerMaison.set(b.maison_id, idx + 1);
    map.set(b.id, maisonLocked || idx >= 2);
  });
  return map;
}

async function _execHomeSearch(q) {
  const results = document.getElementById('home-search-results');
  results.innerHTML = '<div class="home-search-empty">Ricerca in corso…</div>';
  const cat = homeSearchCat;

  // Carica dati in parallelo se non ancora in cache
  const loads = [];
  if (cat === 'tutti' || cat === 'produttori') loads.push(ensureMaisonLoaded());
  if (cat === 'tutti' || cat === 'champagne') loads.push(ensureBottiglieLoaded());
  if (cat === 'tutti' || cat === 'glossario') loads.push(ensureGlossarioLoaded());
  await Promise.all(loads);

  let html = '';

  // — PRODUTTORI: cerca per nome e sede (accent-insensitive) —
  if (cat === 'tutti' || cat === 'produttori') {
    const res = allMaison.filter(m =>
      matchesAllTerms(q, m.nome, m.sede)
    ).slice(0, 6);
    if (res.length > 0) {
      const premium = isPremium();
      const tipoBadge = { 'NM':'badge-gm','RM':'badge-rm','RC':'badge-rm','CM':'badge-bio','SR':'badge-rm','ND':'badge-pres','MA':'badge-pres' };
      html += '<div class="home-search-section">Produttori</div>';
      html += res.map(m => {
        if (m.is_free === false && !premium) return _lockedSearchCard(m.nome, 'Disponibile con Piano Premium');
        const anno = m.anno_fondazione ? 'dal ' + m.anno_fondazione : '';
        const sub = [m.sede, anno].filter(Boolean).join(' · ');
        const zonaColor = m.zone?.colore || 'var(--gold)';
        const zonaNome = m.zone?.nome || '';
        const foto = m.foto_url
          ? '<img src="' + m.foto_url + '" style="width:100%;height:100%;object-fit:cover;"/>'
          : '<svg width="19" height="24" viewBox="0 0 44.309 55.104" fill="var(--ink-5)"><g><path d="M38.691,7.996c-2.373-1.104-4.788-0.948-5.4,0.349c-0.608,1.294,0.82,3.239,3.194,4.345c2.375,1.106,7.147,2.046,7.757,0.75C44.852,12.143,41.063,9.101,38.691,7.996z"/><path d="M25.552,25.806c-0.864,0.293-1.79,0.454-2.752,0.454c-1.258,0-2.446-0.272-3.524-0.756c-0.049-0.019-0.104-0.046-0.152-0.067c-1.278,1.134-2.115,2.764-2.195,4.583c-0.005,0.103-0.009,0.204-0.009,0.308c0,0.951,0.205,1.854,0.572,2.672c0.165,0.37,0.366,0.722,0.594,1.05c0.332,0.482,0.729,0.912,1.173,1.282c0.626,0.528,1.353,0.938,2.147,1.206c0.541,0.179,1.113,0.293,1.703,0.322c0.13,0.013,0.259,0.015,0.394,0.015c0.276,0,0.551-0.02,0.818-0.055c2.639-0.32,4.789-2.192,5.505-4.676C27.531,30.845,25.9,28.524,25.552,25.806z"/><path d="M16.218,17.4c-0.004,0.103-0.008,0.199-0.008,0.303c0,0.377,0.031,0.742,0.095,1.104v0.005c0.24,1.415,0.939,2.674,1.933,3.622c0.23,0.223,0.482,0.426,0.746,0.619c0.13,0.088,0.258,0.172,0.393,0.251c0.196,0.122,0.397,0.229,0.608,0.331c0.447,0.21,0.926,0.368,1.422,0.475c0.448,0.098,0.914,0.146,1.392,0.146c0.729,0,1.432-0.119,2.089-0.337c0.224-0.075,0.446-0.158,0.657-0.261c0.022-0.195,0.054-0.394,0.095-0.584c0.062-0.328,0.147-0.654,0.245-0.967c0.608-1.885,1.857-3.485,3.489-4.55c-0.041-1.894-0.886-3.593-2.218-4.757c0.165-0.222,0.363-0.475,0.577-0.748c0.191-0.24,0.407-0.502,0.626-0.768c2.522-3.035,7.402-8.186,11.73-8.616c0.738-0.077,1.276-0.73,1.197-1.466c-0.071-0.733-0.724-1.263-1.467-1.197c-5.02,0.507-10.13,5.486-13.533,9.58c-0.23,0.285-0.447,0.556-0.647,0.806c-0.081,0.099-0.162,0.195-0.238,0.293l-0.401,0.523c-0.071,0.088-0.139,0.179-0.201,0.258c-0.632-0.21-1.304-0.314-2-0.314c-1.592,0-3.05,0.559-4.187,1.494c-1.387,1.133-2.299,2.823-2.394,4.726V17.4z"/><path d="M9.039,44.346c-0.777,0.23-1.602,0.356-2.451,0.356c-1.553,0-3.015-0.414-4.272-1.134C0.899,44.77,0,46.553,0,48.552c0,3.619,2.952,6.552,6.588,6.552c3.452,0,6.284-2.641,6.557-6.005C11.238,48.098,9.754,46.399,9.039,44.346z"/><path d="M2.266,41.096c0.286,0.249,0.6,0.478,0.926,0.672c0.397,0.24,0.824,0.436,1.271,0.587c0.666,0.229,1.383,0.348,2.125,0.348c0.702,0,1.383-0.11,2.018-0.311c-0.004-0.023-0.009-0.052-0.009-0.077C8.574,42.061,8.56,41.803,8.56,41.54c0-0.103,0-0.204,0.009-0.308c0.009-0.352,0.045-0.695,0.099-1.035c0.411-2.587,1.995-4.788,4.187-6.055c-0.193-0.596-0.471-1.16-0.812-1.665c-0.401,0.059-0.808,0.088-1.229,0.088c-2.447,0-4.655-1.021-6.222-2.659C1.931,30.747,0,33.226,0,36.151C0,38.127,0.876,39.899,2.266,41.096z"/><path d="M14.28,18.87c-1.234,0.684-2.655,1.077-4.17,1.077c-1.314,0-2.562-0.297-3.676-0.824c-1.356,1.196-2.205,2.944-2.205,4.888c0,1.361,0.416,2.625,1.128,3.675c0.228,0.33,0.481,0.641,0.769,0.924c0.398,0.407,0.854,0.762,1.355,1.053c0.733,0.431,1.561,0.724,2.441,0.84c0.291,0.04,0.587,0.062,0.891,0.062c0.271,0,0.545-0.019,0.811-0.054c0.41-0.044,0.809-0.132,1.188-0.253c0.81-0.258,1.548-0.663,2.187-1.185c0.269-1.832,1.123-3.482,2.375-4.741C15.725,22.998,14.58,21.067,14.28,18.87z"/><path d="M6.302,16.734c0.312,0.229,0.651,0.424,1.006,0.586c0.45,0.215,0.926,0.374,1.427,0.478c0.442,0.098,0.903,0.146,1.377,0.146c0.729,0,1.431-0.114,2.085-0.333c0.482-0.159,0.938-0.375,1.364-0.635c0.254-0.156,0.5-0.33,0.731-0.517c0.01-0.086,0.022-0.165,0.041-0.244c0.306-1.751,1.149-3.312,2.354-4.521c0.003-0.102,0.008-0.201,0.008-0.302c0-3.617-2.947-6.55-6.583-6.55c-3.637,0-6.588,2.933-6.588,6.55C3.524,13.598,4.62,15.551,6.302,16.734z"/><path d="M17.388,24.316c-0.006,0.003-0.01,0.009-0.015,0.018c0.005,0.009,0.009,0.014,0.015,0.014V24.316z"/><path d="M34.075,18.167c-0.983,0-1.914,0.212-2.75,0.601c-0.403,0.183-0.788,0.405-1.141,0.663c-1.153,0.845-2.026,2.055-2.434,3.461c-0.062,0.211-0.116,0.436-0.151,0.663c-0.026,0.124-0.045,0.249-0.059,0.377c-0.031,0.258-0.05,0.517-0.05,0.782c0,0.051,0,0.097,0.005,0.148c0,0.09,0.004,0.174,0.009,0.262c0.122,1.953,1.101,3.675,2.567,4.797c0.317,0.239,0.657,0.453,1.015,0.635c0.312,0.161,0.645,0.294,0.984,0.405c0.63,0.201,1.306,0.307,2.004,0.307c3.636,0,6.583-2.932,6.583-6.554C40.658,21.1,37.711,18.167,34.075,18.167z"/><path d="M16.337,35.043c-0.412,0.051-0.812,0.139-1.197,0.263c-0.342,0.107-0.662,0.242-0.977,0.4c-0.353,0.18-0.683,0.389-0.997,0.624c-1.427,1.087-2.393,2.726-2.562,4.602c-0.02,0.143-0.027,0.285-0.027,0.432c-0.006,0.058-0.006,0.12-0.006,0.177c0,0.19,0.009,0.384,0.028,0.575c0.008,0.137,0.026,0.281,0.049,0.413c0.053,0.352,0.133,0.693,0.241,1.021c0.005,0.019,0.015,0.042,0.019,0.059c0.376,1.127,1.047,2.114,1.927,2.875c0.386,0.333,0.815,0.626,1.271,0.863c0.35,0.182,0.716,0.333,1.096,0.454c0.617,0.19,1.275,0.293,1.959,0.293c3.636,0,6.582-2.932,6.582-6.554c0-0.952-0.205-1.858-0.571-2.672C20.323,38.761,17.823,37.266,16.337,35.043z"/></g></svg>';
        return '<div class="card" style="padding:11px 12px;margin-bottom:8px;cursor:pointer;display:flex;gap:11px;align-items:center;" onclick="openSavedMaison(\'' + m.id + '\')">' +
          '<div style="width:48px;height:48px;border-radius:10px;background:var(--ivory-2);border:1px solid var(--border);flex-shrink:0;overflow:hidden;display:flex;align-items:center;justify-content:center;">' + foto + '</div>' +
          '<div style="flex:1;min-width:0;">' +
            '<div style="font-family:var(--sans);font-size:15px;font-weight:600;color:var(--ink);margin-bottom:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + m.nome + '</div>' +
            '<div style="display:flex;gap:5px;flex-wrap:wrap;align-items:center;margin-bottom:3px;">' +
              (m.tipo ? '<span class="badge ' + (tipoBadge[m.tipo]||'badge-rm') + '">' + m.tipo + '</span>' : '') +
              (zonaNome ? '<span style="font-family:var(--sans);font-size:11px;font-weight:600;color:#fff;background:' + zonaColor + ';border-radius:20px;padding:2px 8px;">' + zonaNome + '</span>' : '') +
            '</div>' +
            (sub ? '<div style="font-family:var(--sans);font-size:12px;color:var(--ink-4);">' + sub + '</div>' : '') +
          '</div>' +
        '</div>';
      }).join('');
    }
  }

  // — CHAMPAGNE: cerca per nome bottiglia E nome produttore (accent-insensitive) —
  if (cat === 'tutti' || cat === 'champagne') {
    const res = allBottiglie.filter(b =>
      matchesAllTerms(q, b.nome, b.maison?.nome)
    ).slice(0, 8);
    if (res.length > 0) {
      const lockMap = _computeBottleLockMap();
      html += '<div class="home-search-section">Champagne</div>';
      html += res.map(b => {
        if (lockMap.get(b.id)) return _lockedSearchCard(b.nome, b.maison?.nome ? 'di ' + b.maison.nome : 'Disponibile con Piano Premium');
        const foto = b.foto_url
          ? '<img src="' + b.foto_url + '" style="width:100%;height:100%;object-fit:cover;"/>'
          : '<svg width="22" height="22" viewBox="0 0 512 512" fill="var(--ink-5)"><path fill-rule="evenodd" clip-rule="evenodd" d="M217.6,0 L294.4,0 L294.4,76.8 C294.4,256 371.2,217.6 371.2,396.8 L371.2,512 L140.8,512 L140.8,396.8 C140.8,217.6 217.6,256 217.6,76.8 Z M335.057,240.943 L256,320 L176.943,240.943 L176.943,258.943 L256,338 L335.057,258.943 Z M204.8,396.8 L307.2,396.8 L307.2,435.2 L204.8,435.2 Z"/></svg>';
        return '<div class="card" style="padding:10px 12px;margin-bottom:8px;cursor:pointer;display:flex;gap:12px;align-items:center;" onclick="openSavedBottiglia(\'' + b.id + '\')">' +
          '<div style="width:52px;height:52px;border-radius:10px;background:var(--ivory-2);border:1px solid var(--border);flex-shrink:0;overflow:hidden;display:flex;align-items:center;justify-content:center;">' + foto + '</div>' +
          '<div style="flex:1;min-width:0;">' +
            '<div style="font-family:var(--sans);font-size:15px;font-weight:500;color:var(--ink);margin-bottom:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + b.nome + '</div>' +
            '<div style="font-family:var(--sans);font-size:13px;color:var(--ink-3);margin-bottom:5px;">' + (b.maison?.nome||'') + '</div>' +
            (b.dosaggio_tipo ? dosagePill(b.dosaggio_tipo) : '') +
          '</div>' +
        '</div>';
      }).join('');
    }
  }

  // — GLOSSARIO: cerca per termine e definizione (accent-insensitive) —
  if (cat === 'tutti' || cat === 'glossario') {
    const res = allGlossario.filter(t =>
      matchesAllTerms(q, t.termine, t.definizione)
    ).slice(0, 6);
    if (res.length > 0) {
      const premium = isPremium();
      const livelloBadge = { base:'badge-rm', avanzato:'badge-pres', premium:'badge-prem' };
      html += '<div class="home-search-section">Glossario</div>';
      html += res.map(t => {
        if (t.livello === 'premium' && !premium) return _lockedSearchCard(t.termine, 'Disponibile con Piano Premium');
        return '<div class="card" style="padding:12px 14px;margin-bottom:8px;">' +
          '<div style="font-family:var(--sans);font-size:15px;font-weight:500;color:var(--ink);margin-bottom:4px;">' + t.termine + '</div>' +
          '<div style="font-family:var(--sans);font-size:13px;color:var(--ink-3);line-height:1.55;">' + t.definizione + '</div>' +
          '<span class="badge ' + (livelloBadge[t.livello]||'badge-rm') + '" style="margin-top:7px;">' + (t.livello||'base') + '</span>' +
        '</div>';
      }).join('');
    }
  }

  results.innerHTML = html ||
    '<div class="home-search-empty">Nessun risultato per "<strong>' + q + '</strong>"</div>';
}

function setSearchCat(btn, cat) {
  document.querySelectorAll('#home-search-cat .f-btn').forEach(b => b.classList.remove('on'));
  btn.classList.add('on');
  homeSearchCat = cat;
  const q = document.getElementById('home-search-input').value.trim();
  if (q.length >= 2) _execHomeSearch(q);
}

function clearHomeSearch() {
  const input = document.getElementById('home-search-input');
  if (input) input.value = '';
  document.getElementById('home-search-clear').style.display = 'none';
  document.getElementById('home-search-cat').style.display = 'none';
  document.getElementById('home-search-results').style.display = 'none';
  document.getElementById('home-main-content').style.display = 'block';
  homeSearchCat = 'tutti';
  document.querySelectorAll('#home-search-cat .f-btn').forEach((b,i) => b.classList.toggle('on', i===0));
}

// ═══ MODIFICA E ELIMINA NOTE ═══

function openEditNote(note) {
  currentEditId = note.id;
  currentRating = note.rating || 0;

  // Fill form fields
  const fields = {
    'note-maison': note.maison_nome,
    'note-cuvee': note.cuvee_nome,
    'note-annata': note.annata,
    'note-dosage': note.dosage_testo,
    'note-luogo': note.luogo || note.occasione,
    'note-text': note.note_libere,
    'note-prezzo': note.prezzo_pagato
  };
  Object.entries(fields).forEach(([id, val]) => {
    const el = document.getElementById(id);
    if (el) el.value = val || '';
  });

  // Set sliders — attiva solo quelli con valore salvato
  _activeSliders = new Set();
  const sliders = {
    'val-acidite': { val: note.acidite,       key: 'acidite' },
    'val-eff':     { val: note.effervescence,  key: 'eff'     },
    'val-comp':    { val: note.complexite,     key: 'comp'    },
    'val-lung':    { val: note.longueur,       key: 'lung'    }
  };
  Object.entries(sliders).forEach(([id, {val, key}]) => {
    const el = document.getElementById(id);
    if (el && val != null) el.textContent = val;
    const wrap = el?.closest('.slider-wrap');
    if (wrap) {
      const input = wrap.querySelector('input[type=range]');
      if (input && val != null) {
        input.value = val;
        _activeSliders.add(key);
        wrap.classList.add('slider-active');
      } else {
        wrap.classList.remove('slider-active');
      }
    }
  });

  // Set rating (handles 1-5 glasses + 6=Fantastico cuore)
  setRating(currentRating);

  // Set tipo chip
  _noteTypes = Array.isArray(note.tipo) ? [...note.tipo] : (note.tipo ? [note.tipo] : []);
  _syncTipoChips();

  // Set aromi predefiniti
  const _PREDEF_AROMI = new Set(['Agrumi','Mela verde','Pera','Pêche blanche','Frutta rossa','Fiori bianchi','Brioche','Pane tostato','Nocciola tostata','Burro','Miele','Vaniglia','Spezie','Cioccolato','Frutta secca','Gesso · minéralité','Tabacco','Fungo']);
  document.querySelectorAll('#aromi-grid .aromi-pill').forEach(pill => {
    pill.classList.toggle('on', (note.aromi || []).includes(pill.textContent));
  });
  // Aromi custom (non in lista predefinita)
  const _customAromiEdit = (note.aromi || []).filter(a => !_PREDEF_AROMI.has(a));
  const _customAromiInput = document.getElementById('note-aromi-custom');
  if (_customAromiInput) _customAromiInput.value = _customAromiEdit.join(', ');
  // Sboccatura
  const _sboccEdit = document.getElementById('note-sboccatura');
  if (_sboccEdit) _sboccEdit.value = note.sboccatura || '';
  // Data degustazione
  const _dataDegEdit = document.getElementById('note-data-deg');
  if (_dataDegEdit) _dataDegEdit.value = note.data_degustazione || new Date().toISOString().split('T')[0];

  // Load existing photos into strip
  _pendingPhotos = [];
  _existingPhotoUrls = note.foto_urls && note.foto_urls.length > 0
    ? [...note.foto_urls]
    : (note.foto_url ? [note.foto_url] : []);

  // Store edit ID in hidden input (more reliable than global)
  const hiddenId = document.getElementById('edit-note-id');
  if (hiddenId) hiddenId.value = note.id;
  currentEditId = note.id;

  // Update title and button
  const title = document.querySelector('#v-carnet-new .topbar [style*="font-family:var(--serif)"]');
  if (title) title.textContent = 'Modifica nota';
  const btn = document.getElementById('save-note-btn');
  if (btn) btn.textContent = 'Salva modifiche';

  go('v-carnet-new');
  requestAnimationFrame(() => { initAllSliders(null); renderPhotoStrip(); });
}

async function deleteNote(noteId) {
  if (!confirm('Vuoi eliminare questa nota? L\'operazione non è reversibile.')) return;
  try {
    // Recupera la nota per ottenere TUTTE le foto (foto_url + foto_urls)
    const { data: noteData } = await supa
      .from('carnet_notes')
      .select('foto_url, foto_urls')
      .eq('id', noteId)
      .single();

    // Elimina dal database
    const { error } = await supa
      .from('carnet_notes')
      .delete()
      .eq('id', noteId)
      .eq('user_id', currentUser.id);
    if (error) throw error;

    // Elimina TUTTE le foto dallo storage (sia foto_url che foto_urls)
    try {
      const allUrls = [
        ...(noteData?.foto_urls
          ? (Array.isArray(noteData.foto_urls) ? noteData.foto_urls : [noteData.foto_urls])
          : []),
        ...(noteData?.foto_url && !noteData?.foto_urls ? [noteData.foto_url] : []),
      ].filter(Boolean);

      const marker = '/carnet-photos/';
      const storagePaths = [...new Set(
        allUrls
          .filter(url => url.includes(marker))
          .map(url => url.substring(url.indexOf(marker) + marker.length).split('?')[0])
      )];

      if (storagePaths.length) {
        await supa.storage.from('carnet-photos').remove(storagePaths);
        console.log('Photos deleted from storage:', storagePaths);
      }
    } catch(storageErr) {
      console.log('Storage delete error:', storageErr);
      // Non bloccare se le foto non si cancellano
    }

    goBack();
    await updateCarnetUI();
  } catch(e) {
    console.log('deleteNote error:', e);
    alert('Errore durante l\'eliminazione.');
  }
}



// ═══ CARNET — FILTRI, MENU, CONDIVISIONE ═══

let allCarnetNotes = [];
let activeCaliceFilter = 0;
let activeSearchQuery = '';
let activeTypeFilter = 'tutti';

// Tipo nota: restituisce ARRAY di tipi (tipo è text[] nel DB)
function inferTipoNota(n) {
  // tipo è text[] — normalizza sempre ad array
  let tipi = [];
  if (Array.isArray(n.tipo)) {
    tipi = n.tipo.filter(t => t && t !== 'non_so');
  } else if (n.tipo && n.tipo !== 'non_so') {
    tipi = [n.tipo]; // legacy stringa
  }
  if (tipi.length > 0) return tipi;
  // Fallback inferenza per note vecchie senza campo tipo
  const cuvee = (n.cuvee_nome || '').toLowerCase();
  const dosage = (n.dosage_testo || '').toLowerCase();
  const annata = (n.annata || '').trim();
  if (/ros[eé]/.test(cuvee)) return ['rose'];
  if (/blanc\s+de\s+blancs/.test(cuvee)) return ['blanc_de_blancs'];
  if (/blanc\s+de\s+noirs/.test(cuvee)) return ['blanc_de_noirs'];
  if (/brut\s+nature|zero\s+dosage|pas\s+dos[eé]|non\s+dos[eé]/.test(dosage) || dosage === 'nature') return ['nature'];
  if (/^\d{4}$/.test(annata)) return ['millesimato'];
  return ['nv'];
}

function setCarnetTypeFilter(el, tipo) {
  document.querySelectorAll('#carnet-type-filters .f-btn').forEach(b => b.classList.remove('on'));
  el.classList.add('on');
  activeTypeFilter = tipo;
  renderCarnetNotes(allCarnetNotes);
}

// Override updateCarnetUI to also cache notes for filtering
const _origUpdateCarnetUI = updateCarnetUI;
async function updateCarnetUI() {
  if (!currentUser) return;
  const notes = await loadCarnetNotes();
  allCarnetNotes = notes;
  renderCarnetNotes(notes);

  // Counts
  const emptyEl = document.getElementById('carnet-empty');
  const premBanner = document.getElementById('carnet-premium-banner');
  const msgEl = document.getElementById('carnet-note-msg');
  const isPrem = currentUser?.profile?.is_premium;
  if (notes.length === 0) {
    if (emptyEl) emptyEl.style.display = 'block';
    document.getElementById('carnet-notes-list').style.display = 'none';
  } else {
    if (emptyEl) emptyEl.style.display = 'none';
    document.getElementById('carnet-notes-list').style.display = 'block';
  }

  if (premBanner) {
    premBanner.style.display = isPrem ? 'none' : 'block';
    if (!isPrem && msgEl) {
      const used = Math.min(notes.length, 3);
      const remaining = 3 - used;
      if (used === 0) {
        msgEl.innerHTML = 'Hai <strong style="color:#8a6a1e;">3 note gratuite</strong> disponibili. Con Premium puoi aggiungere tutte le degustazioni che vuoi — senza limiti.';
      } else if (remaining > 0) {
        msgEl.innerHTML = 'Ti restano <strong style="color:#8a6a1e;">' + remaining + ' note gratuite</strong>. Con Premium puoi aggiungere tutte le degustazioni che vuoi — senza limiti.';
      } else {
        msgEl.innerHTML = 'Hai usato le <strong style="color:#8a6a1e;">3 note gratuite</strong>. Con Premium puoi aggiungere tutte le degustazioni che vuoi — senza limiti.';
      }
    }
  }
}

function renderCarnetNotes(notes) {
  const listEl = document.getElementById('carnet-notes-list');
  if (!listEl) return;

  // Le prime 3 note (ordine cronologico già applicato da loadCarnetNotes) restano
  // libere; se l'utente non è premium, le successive vengono offuscate e bloccate,
  // anche se erano state inserite mentre l'account era premium.
  const premium = isPremium();
  notes.forEach((n, i) => { n._locked = !premium && i >= 3; });

  // Apply filters
  let filtered = notes;
  if (activeCaliceFilter > 0) {
    filtered = filtered.filter(n => (n.rating || 0) === activeCaliceFilter);
  }
  if (activeTypeFilter && activeTypeFilter !== 'tutti') {
    filtered = filtered.filter(n => inferTipoNota(n).includes(activeTypeFilter));
  }
  if (activeSearchQuery) {
    filtered = filtered.filter(n => matchesAllTerms(activeSearchQuery, n.maison_nome, n.cuvee_nome));
  }

  window._carnetNotes = notes; // keep full array for index access

  // Update topbar count label
  const countLbl = document.getElementById('carnet-count-label');
  if (countLbl) {
    const n = notes.length;
    countLbl.textContent = n === 0 ? 'Nessuna nota' : n === 1 ? '1 nota' : n + ' note';
  }

  if (filtered.length === 0) {
    listEl.innerHTML = '<div style="padding:40px 24px;text-align:center;font-family:var(--sans);font-size:16px;color:var(--ink-4);">Nessuna nota trovata</div>';
    return;
  }

  const _tipoShort = {nv:'Sans Année',millesimato:'Millésimé',rose:'Rosé',blanc_de_blancs:'Blanc de Blancs',blanc_de_noirs:'Blanc de Noirs',nature:'Brut Nature',prestige:'Prestige'};

  listEl.innerHTML = '<div class="carnet-grid">' + filtered.map((note) => {
    const isLocked = !!note._locked;
    const tipi = inferTipoNota(note);
    const tipoLabel = tipi.filter(t => t !== 'non_so').map(t => _tipoShort[t] || t).join(' · ');
    const r = note.rating || 0;
    const glasses = Array.from({length:5}, (_,i) =>
      '<i class="ti ti-glass-full" style="opacity:'+(i<Math.min(r,5)?'1':'0.18')+'"></i>'
    ).join('') + (r >= 6 ? '<i class="ti ti-heart-filled" style="color:#E05252;font-size:13px;margin-left:3px;opacity:1;"></i>' : '');
    const date = note.data_degustazione
      ? new Date(note.data_degustazione).toLocaleDateString('it-IT',{day:'numeric',month:'short'})
      : '';
    const origIdx = allCarnetNotes.findIndex(n => n.id === note.id);

    return '<div class="carnet-note-card' + (isLocked ? ' locked' : '') + '" data-idx="'+origIdx+'" onclick="' + (isLocked ? "go('v-paywall')" : "openNoteDetail(window._carnetNotes[this.dataset.idx])") + '">'+
      '<div class="cnc-img">'+
        (note.foto_url
          ? '<img src="'+note.foto_url+'" style="width:100%;height:100%;object-fit:cover;"/>'
          : '<div class="cnc-img-ph"><svg viewBox="0 0 512 512" fill="currentColor"><path fill-rule="evenodd" clip-rule="evenodd" d="M217.6,0 L294.4,0 L294.4,76.8 C294.4,256 371.2,217.6 371.2,396.8 L371.2,512 L140.8,512 L140.8,396.8 C140.8,217.6 217.6,256 217.6,76.8 Z M335.057,240.943 L256,320 L176.943,240.943 L176.943,258.943 L256,338 L335.057,258.943 Z M204.8,396.8 L307.2,396.8 L307.2,435.2 L204.8,435.2 Z"/></svg></div>')+
        (!isLocked && tipoLabel ? '<span class="cnc-tipo">'+tipoLabel+'</span>' : '')+
        (!isLocked && note.annata ? '<span class="cnc-annata">'+note.annata+'</span>' : '')+
        (isLocked ? '<div class="lock-over"><i class="ti ti-lock"></i>Premium</div>' : '')+
      '</div>'+
      '<div class="cnc-body">'+
        '<div class="cnc-maison">'+(note.maison_nome||'&nbsp;')+'</div>'+
        '<div class="cnc-cuvee">'+(note.cuvee_nome||'')+'</div>'+
        (!isLocked ? '<div class="cnc-footer">'+
          '<div class="cnc-glasses">'+glasses+'</div>'+
          '<div class="cnc-date">'+date+'</div>'+
        '</div>' : '')+
      '</div>'+
    '</div>';
  }).join('')+'</div>';
}

// Filtro calici
function setCaliceFilter(rating) {
  activeCaliceFilter = rating;
  document.querySelectorAll('.calice-btn').forEach(b => b.classList.remove('on'));
  const btnId = rating === 0 ? 'cf-all' : 'cf-' + rating;
  const btn = document.getElementById(btnId);
  if (btn) btn.classList.add('on');
  renderCarnetNotes(allCarnetNotes);
}

// Ricerca
function filterCarnet() {
  const input = document.getElementById('carnet-search');
  activeSearchQuery = input ? input.value.trim() : '';
  const clearBtn = document.getElementById('carnet-search-clear');
  if (clearBtn) clearBtn.style.display = activeSearchQuery ? 'block' : 'none';
  renderCarnetNotes(allCarnetNotes);
}

function clearCarnetSearch() {
  const input = document.getElementById('carnet-search');
  if (input) { input.value = ''; input.focus(); }
  activeSearchQuery = '';
  const clr = document.getElementById('carnet-search-clear');
  if (clr) clr.style.display = 'none';
  renderCarnetNotes(allCarnetNotes);
}

// Menu contestuale nota
function openNoteMenu() {
  const overlay = document.getElementById('note-menu-overlay');
  if (overlay) overlay.style.display = 'block';
  document.body.style.overflow = 'hidden';
}

function closeNoteMenu() {
  const overlay = document.getElementById('note-menu-overlay');
  if (overlay) overlay.style.display = 'none';
  document.body.style.overflow = '';
}

// Condivisione nota
async function shareNote() {
  if (!currentNote) return;
  const note = currentNote;

  const glasses = '🥂'.repeat(note.rating || 0);
  const metaParts = [note.annata, note.dosage_testo].filter(Boolean).join(' · ');
  const testo = [
    '🍾 ' + note.maison_nome + ' — ' + note.cuvee_nome,
    metaParts ? metaParts : '',
    glasses ? glasses : '',
    note.note_libere ? '"' + note.note_libere.substring(0, 200) + (note.note_libere.length > 200 ? '...' : '') + '"' : '',
    '',
    'Via Cuvée — La guida italiana allo Champagne'
  ].filter(Boolean).join('\n');

  // Web Share API nativa del SO (iOS/Android share sheet)
  if (navigator.share) {
    try {
      const shareData = { text: testo };
      // Aggiungi foto se presente e se l'API lo supporta
      if (note.foto_url && navigator.canShare) {
        try {
          const resp = await fetch(note.foto_url);
          const blob = await resp.blob();
          const file = new File([blob], 'champagne.jpg', { type: blob.type });
          if (navigator.canShare({ files: [file] })) {
            shareData.files = [file];
          }
        } catch(e) {
          // Ignora errori foto — condividi solo testo
        }
      }
      await navigator.share(shareData);
    } catch(e) {
      if (e.name !== 'AbortError') {
        // Fallback: copia negli appunti
        copyToClipboard(testo);
      }
    }
  } else {
    copyToClipboard(testo);
  }
}

function copyToClipboard(text) {
  if (navigator.clipboard) {
    navigator.clipboard.writeText(text).then(() => {
      alert('Testo copiato negli appunti!');
    });
  } else {
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    alert('Testo copiato negli appunti!');
  }
}



// ═══ REVENUECAT: paywall reale (solo dentro l'app nativa) ═══
const RC_ENTITLEMENT = 'cuvée_pro';
let _rcOfferings = null;
let _selectedRcPackage = null;

function _isRcPackageType(pkg, type) {
  if (!pkg) return false;
  if (type === 'annual') return pkg.packageType === 'ANNUAL' || pkg.identifier === '$rc_annual';
  return pkg.packageType === 'MONTHLY' || pkg.identifier === '$rc_monthly';
}
function _rcPackageForType(type) {
  if (!_rcOfferings) return null;
  return _rcOfferings.availablePackages.find(p => _isRcPackageType(p, type)) || null;
}

// Aggiorna le due card del paywall con i prezzi reali letti da App Store —
// se RevenueCat non è disponibile (sito da browser, o SDK non configurato)
// restano i prezzi statici già scritti nell'HTML.
// Tiene traccia della chiamata di rete in corso, così subscribeNow() può
// aspettarla invece di fallire se l'utente tocca "Abbonati ora" prima che
// il caricamento (una vera richiesta di rete ad Apple/RevenueCat) finisca.
let _paywallLoadPromise = null;
function loadPaywallOfferings() {
  _paywallLoadPromise = _loadPaywallOfferingsImpl();
  return _paywallLoadPromise;
}
async function _loadPaywallOfferingsImpl() {
  const RC = _rcPlugin();
  if (!window.Capacitor?.isNativePlatform?.() || !RC || !_rcConfigured) return;
  try {
    const rcResult = await RC.getOfferings();
    // Il plugin a volte restituisce {offerings:{current,all}} e a volte
    // l'oggetto offerings direttamente, senza wrapper.
    const offerings = rcResult?.offerings || rcResult;
    // "current" a volte non è valorizzato subito lato SDK anche se il
    // dashboard segna l'offering come corrente — offerings.all.default (o il
    // primo disponibile) è un fallback affidabile con gli stessi dati.
    const current = offerings?.current || offerings?.all?.default || Object.values(offerings?.all || {})[0] || null;
    if (!current || !current.availablePackages?.length) return;
    _rcOfferings = current;

    const cards = document.querySelectorAll('#v-paywall .plan-card');
    const annual = _rcPackageForType('annual');
    const monthly = _rcPackageForType('monthly');

    if (annual && cards[0]) {
      cards[0].dataset.rcPlan = 'annual';
      const perMonth = (annual.product.price / 12).toFixed(2).replace('.', ',');
      const priceEl = cards[0].querySelector('.plan-price');
      if (priceEl) priceEl.innerHTML = perMonth + '€ <span>/ mese</span>';
      const descEl = cards[0].querySelector('.plan-desc');
      if (descEl) descEl.textContent = 'Fatturato ' + annual.product.priceString + '/anno';
    }
    if (monthly && cards[1]) {
      cards[1].dataset.rcPlan = 'monthly';
      const priceEl = cards[1].querySelector('.plan-price');
      if (priceEl) priceEl.innerHTML = monthly.product.priceString + ' <span>/ mese</span>';
    }
    const selectedType = document.querySelector('#v-paywall .plan-card.selected')?.dataset.rcPlan || 'annual';
    _selectedRcPackage = _rcPackageForType(selectedType) || annual || monthly;
  } catch(e) {
    console.log('RevenueCat getOfferings error:', e);
  }
}

// Aggiorna is_premium/premium_until su Supabase in base allo stato reale
// dell'entitlement RevenueCat — chiamata dopo un acquisto, un ripristino, e
// a ogni login/apertura app, così lo stato resta corretto anche se un
// rinnovo o una disdetta sono avvenuti mentre l'app era chiusa. Non copre
// in tempo reale gli eventi mentre l'app resta chiusa per giorni: per
// quello serve ancora un webhook lato server (da collegare più avanti).
async function _syncPremiumFromCustomerInfo(customerInfo) {
  if (!currentUser || !customerInfo) return;
  // Non toccare un Premium concesso manualmente dall'admin: RevenueCat non ha
  // nessun acquisto da sincronizzare per questi account, quindi senza questo
  // controllo il primo giro di sync (a ogni avvio dell'app) lo riporterebbe
  // sempre a gratuito. Una volta scaduto, isPremium() lo tratta comunque
  // come non premium da solo — qui serve solo a non azzerarlo mentre è attivo.
  if (currentUser.profile?.premium_source === 'admin' && isPremium()) return;

  const ent = customerInfo.entitlements?.active?.[RC_ENTITLEMENT];
  const isPremiumNow = !!ent;
  const premiumUntil = ent?.expirationDate || null;
  const cancelAtEnd = isPremiumNow && ent?.willRenew === false;
  try {
    const updates = {
      is_premium: isPremiumNow,
      premium_until: premiumUntil,
      cancel_at_period_end: cancelAtEnd,
    };
    // Da qui in avanti è un abbonamento vero: se l'utente aveva un Premium
    // manuale precedente, RevenueCat ora è la fonte di verità.
    if (isPremiumNow) updates.premium_source = 'revenuecat';
    await supa.from('users').update(updates).eq('id', currentUser.id);
    if (currentUser.profile) {
      currentUser.profile.is_premium = isPremiumNow;
      currentUser.profile.premium_until = premiumUntil;
      currentUser.profile.cancel_at_period_end = cancelAtEnd;
      if (isPremiumNow) currentUser.profile.premium_source = 'revenuecat';
    }
  } catch(e) {
    console.log('sync premium error:', e);
  }
}

async function subscribeNow() {
  if (!currentUser) { go('v-login'); return; }
  const RC = _rcPlugin();
  const isNative = window.Capacitor?.isNativePlatform?.();

  // Fuori dall'app nativa (sito da browser) o SDK non pronto: comportamento
  // di sempre — nessun pagamento reale possibile qui.
  if (!isNative || !RC || !_rcConfigured) { return activateTestPremium(); }

  // Se il caricamento dei piani è ancora in corso (rete lenta, o l'utente ha
  // toccato subito), aspettalo invece di fallire subito.
  if (!_selectedRcPackage && _paywallLoadPromise) {
    try { await _paywallLoadPromise; } catch(e) {}
  }
  if (!_selectedRcPackage) { alert('Seleziona un piano prima di continuare.'); return; }

  const btn = document.getElementById('subscribe-btn');
  if (btn) { btn.textContent = 'Acquisto in corso...'; btn.disabled = true; }

  try {
    const result = await RC.purchasePackage({ aPackage: _selectedRcPackage });
    await _syncPremiumFromCustomerInfo(result.customerInfo);
    if (btn) { btn.textContent = 'Premium attivato!'; btn.style.background = '#5DCAA5'; }
    setTimeout(() => {
      if (btn) { btn.textContent = 'Abbonati ora'; btn.style.background = ''; btn.disabled = false; }
      updatePremiumUI();
      go('v-home');
    }, 1200);
  } catch(e) {
    if (btn) { btn.textContent = 'Abbonati ora'; btn.disabled = false; }
    if (e?.userCancelled) return; // foglio di acquisto chiuso dall'utente, nessun errore da mostrare
    console.log('purchase error:', e);
    alert('Acquisto non riuscito: ' + (e?.message || 'errore sconosciuto') + '. Riprova.');
  }
}

// Obbligatorio per la revisione Apple: recupera un abbonamento già attivo
// (es. dopo aver reinstallato l'app o cambiato dispositivo).
async function restorePurchases() {
  const RC = _rcPlugin();
  if (!window.Capacitor?.isNativePlatform?.() || !RC || !_rcConfigured) {
    alert('Il ripristino acquisti è disponibile solo nell\'app.');
    return;
  }
  try {
    const result = await RC.restorePurchases();
    await _syncPremiumFromCustomerInfo(result.customerInfo);
    updatePremiumUI();
    const hasPremium = !!result.customerInfo?.entitlements?.active?.[RC_ENTITLEMENT];
    alert(hasPremium ? 'Abbonamento ripristinato!' : 'Nessun acquisto da ripristinare per questo account.');
  } catch(e) {
    alert('Ripristino non riuscito: ' + (e?.message || 'errore sconosciuto'));
  }
}

// ═══ TEST PREMIUM — fallback quando RevenueCat non è disponibile (sito da browser) ═══
async function activateTestPremium() {
  if (!currentUser) { go('v-login'); return; }
  // Attivazione gratuita riservata agli account admin: finché non è collegato un vero
  // pagamento (Stripe), nessun utente reale deve poter sbloccare Premium da qui.
  if (!isAdmin()) {
    alert('L\'attivazione online non è ancora disponibile. Ci stiamo lavorando — torna presto!');
    return;
  }

  const btn = document.getElementById('subscribe-btn');
  if (btn) { btn.textContent = 'Attivazione in corso...'; btn.disabled = true; }

  try {
    // Leggi il piano selezionato dal paywall
    const selectedPlan = document.querySelector('.plan-card.selected');
    const isAnnual = selectedPlan ? !selectedPlan.querySelector('.plan-name')?.textContent.includes('Mensile') : true;
    const plan = isAnnual ? 'annual' : 'monthly';
    const months = isAnnual ? 12 : 1;
    const premiumUntil = new Date(Date.now() + months * 30 * 24 * 60 * 60 * 1000).toISOString();

    const { error } = await supa
      .from('users')
      .update({
        is_premium: true,
        premium_until: premiumUntil,
        subscription_plan: plan,
        cancel_at_period_end: false
      })
      .eq('id', currentUser.id);

    if (error) throw error;

    if (currentUser.profile) {
      currentUser.profile.is_premium = true;
      currentUser.profile.premium_until = premiumUntil;
      currentUser.profile.subscription_plan = plan;
      currentUser.profile.cancel_at_period_end = false;
    }

    if (btn) { btn.textContent = 'Premium attivato!'; btn.style.background = '#5DCAA5'; }

    setTimeout(async () => {
      if (btn) { btn.textContent = 'Abbonati ora'; btn.style.background = ''; btn.disabled = false; }
      updatePremiumUI();
      await loadSubscriptionScreen();
      go('v-home');
    }, 1500);

  } catch(e) {
    console.log('activatePremium error:', e);
    alert('Errore: ' + e.message);
    if (btn) { btn.textContent = 'Abbonati ora'; btn.disabled = false; }
  }
}

async function deactivatePremium() {
  if (!currentUser) return;
  try {
    const { data, error } = await supa
      .from('users')
      .update({ is_premium: false, premium_until: null, cancel_at_period_end: false })
      .eq('id', currentUser.id)
      .select();
    if (error) {
      console.log('Deactivate error:', error);
      alert('Errore DB: ' + error.message + ' (code: ' + error.code + ')');
      return;
    }
    if (currentUser.profile) {
      currentUser.profile.is_premium = false;
      currentUser.profile.premium_until = null;
      currentUser.profile.cancel_at_period_end = false;
    }
    updateProfileUI(currentUser.profile);
    updatePremiumUI();
  } catch(e) {
    console.log('Deactivate fetch error:', e);
    // "Failed to fetch" di solito = CORS o rete
    // Proviamo con rpc come alternativa
    try {
      await supa.rpc('set_user_free', { uid: currentUser.id });
      if (currentUser.profile) {
        currentUser.profile.is_premium = false;
        currentUser.profile.premium_until = null;
      }
      updateProfileUI(currentUser.profile);
      updatePremiumUI();
    } catch(e2) {
      alert('Errore rete: ' + e.message + ' | ' + e2.message);
    }
  }
}

// Funzione per DISATTIVARE il premium (utile per testare entrambi gli stati)
// deactivatePremium defined above



// ═══ PREMIUM STATE MANAGEMENT ═══

function isPremium() {
  const p = currentUser?.profile;
  if (!p || p.is_premium !== true) return false;
  // Se c'è una data di scadenza, verifica che non sia passata
  if (p.premium_until) return new Date(p.premium_until) > new Date();
  return true;
}

// Nelle pagine zona/terroir, gli utenti free vedono solo i primi 2 comuni di
// ogni gruppo (Grand Cru, Premier Cru, Autres Crus, sotto-zone...) — il resto
// è dietro una card "sblocca con Premium". Funziona su qualunque .cru-grid
// trovi nella vista passata, senza dover toccare l'HTML statico di ogni zona.
function applyCruPremiumGating(viewId) {
  const view = document.getElementById(viewId);
  if (!view) return;
  const premium = isPremium();
  view.querySelectorAll('.cru-group').forEach(group => {
    const grid = group.querySelector('.cru-grid');
    if (!grid) return;
    const pills = Array.from(grid.children);
    let lockCard = group.querySelector('.cru-lock-card');
    if (premium) {
      pills.forEach(p => { p.style.display = ''; });
      if (lockCard) lockCard.remove();
      return;
    }
    const hidden = pills.slice(2);
    pills.forEach((p, i) => { p.style.display = i < 2 ? '' : 'none'; });
    if (hidden.length === 0) {
      if (lockCard) lockCard.remove();
      return;
    }
    if (!lockCard) {
      lockCard = document.createElement('div');
      lockCard.className = 'cru-lock-card';
      lockCard.onclick = () => go('v-paywall');
      grid.insertAdjacentElement('afterend', lockCard);
    }
    lockCard.innerHTML = '<i class="ti ti-lock"></i><span>+<strong>' + hidden.length + '</strong> comuni — sblocca con <strong>Premium</strong></span>';
  });
}

// Notifiche inviate dall'admin (comunicazioni, nuove funzioni, ecc.)
// Lette/non lette è per-notifica (tabella notification_reads): una notifica
// risulta letta solo quando l'utente apre proprio quella card, non quando
// visita semplicemente l'elenco.
let _notificationsCache = [];
let _readNotifIds = new Set();

async function _fetchUnreadActiveIds() {
  const { data: active, error: e1 } = await supa.from('notifications').select('id').eq('is_active', true);
  if (e1) throw e1;
  const activeIds = (active || []).map(n => n.id);
  if (!activeIds.length) return [];
  const { data: reads, error: e2 } = await supa.from('notification_reads')
    .select('notification_id').eq('user_id', currentUser.id);
  if (e2) throw e2;
  const readSet = new Set((reads || []).map(r => r.notification_id));
  return activeIds.filter(id => !readSet.has(id));
}

async function checkUnreadNotifications() {
  if (!currentUser) return;
  const dot = document.getElementById('notif-badge-dot');
  if (!dot) return;
  try {
    const unread = await _fetchUnreadActiveIds();
    dot.classList.toggle('show', unread.length > 0);
  } catch(e) { console.log('checkUnreadNotifications error:', e); }
}

async function renderNotificationsUI() {
  const listEl = document.getElementById('notifications-list');
  if (!listEl) return;
  listEl.innerHTML = '<div style="padding:60px 20px;text-align:center;font-family:var(--sans);font-size:14px;color:var(--ink-4);">Caricamento…</div>';
  try {
    const { data, error } = await supa.from('notifications')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false });
    if (error) throw error;
    _notificationsCache = data || [];
    const { data: reads, error: e2 } = await supa.from('notification_reads')
      .select('notification_id').eq('user_id', currentUser.id);
    if (e2) throw e2;
    _readNotifIds = new Set((reads || []).map(r => r.notification_id));
    renderNotificationsList();
  } catch(e) {
    listEl.innerHTML = '<div style="padding:40px 24px;text-align:center;color:#B4442E;font-family:var(--sans);font-size:13px;">Errore nel caricamento delle notifiche.</div>';
    console.log('renderNotificationsUI error:', e);
  }
}

// Ridisegna la lista dalla cache locale (nessuna chiamata di rete) — usata
// dopo aver aperto una card o premuto "Segna tutte come lette".
function renderNotificationsList() {
  const listEl = document.getElementById('notifications-list');
  if (!listEl) return;
  if (!_notificationsCache.length) {
    listEl.innerHTML = '<div style="padding:60px 24px;text-align:center;">'
      + '<i class="ti ti-bell" style="font-size:34px;color:var(--border-2);display:block;margin-bottom:12px;"></i>'
      + '<div style="font-family:var(--sans);font-size:14px;color:var(--ink-4);">Nessuna notifica al momento</div>'
      + '</div>';
    return;
  }
  const unread = _notificationsCache.filter(n => !_readNotifIds.has(n.id));
  const read = _notificationsCache.filter(n => _readNotifIds.has(n.id));

  const card = (n, isUnread) => (
    '<div onclick="openNotificationDetail(\'' + n.id + '\')" style="background:' + (isUnread ? 'var(--white)' : 'var(--ivory-2)') + ';border:1px solid var(--border);border-radius:var(--radius-lg);padding:16px;margin-bottom:10px;cursor:pointer;">'
    + '<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:10px;margin-bottom:6px;">'
    + '<div style="display:flex;align-items:center;gap:7px;min-width:0;">'
    + (isUnread ? '<span style="width:8px;height:8px;border-radius:50%;background:#B4442E;flex-shrink:0;"></span>' : '')
    + '<div style="font-family:var(--sans);font-size:14.5px;font-weight:' + (isUnread ? '600' : '500') + ';color:' + (isUnread ? 'var(--ink)' : 'var(--ink-3)') + ';">' + n.title + '</div>'
    + '</div>'
    + '<div style="font-family:var(--sans);font-size:11.5px;color:var(--ink-5);white-space:nowrap;flex-shrink:0;padding-top:1px;">' + new Date(n.created_at).toLocaleDateString('it-IT', {day:'numeric', month:'short'}) + '</div>'
    + '</div>'
    + '<div style="font-family:var(--sans);font-size:13.5px;color:var(--ink-4);line-height:1.6;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;">' + n.body + '</div>'
    + '<div style="font-family:var(--sans);font-size:12px;color:' + (isUnread ? 'var(--gold)' : 'var(--ink-5)') + ';font-weight:600;margin-top:8px;">Leggi tutto <i class="ti ti-chevron-right" style="font-size:11px;"></i></div>'
    + '</div>'
  );

  let html = '';
  if (unread.length) {
    html += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">'
      + '<div class="section-label" style="padding:0;">Da leggere · ' + unread.length + '</div>'
      + '<button onclick="markAllNotificationsRead()" style="background:none;border:none;font-family:var(--sans);font-size:12.5px;font-weight:600;color:var(--gold);cursor:pointer;padding:4px 0;">Segna tutte come lette</button>'
      + '</div>'
      + unread.map(n => card(n, true)).join('')
      + (read.length ? '<div style="height:8px;"></div>' : '');
  }
  if (read.length) {
    html += '<div class="section-label" style="padding:0 0 10px;">Lette</div>' + read.map(n => card(n, false)).join('');
  }
  listEl.innerHTML = html;
}

async function markAllNotificationsRead() {
  if (!currentUser) return;
  const unreadIds = _notificationsCache.map(n => n.id).filter(id => !_readNotifIds.has(id));
  if (!unreadIds.length) return;
  unreadIds.forEach(id => _readNotifIds.add(id));
  renderNotificationsList();
  const dot = document.getElementById('notif-badge-dot');
  if (dot) dot.classList.remove('show');
  const rows = unreadIds.map(id => ({ user_id: currentUser.id, notification_id: id }));
  const { error } = await supa.from('notification_reads').upsert(rows, { onConflict: 'user_id,notification_id' });
  if (error) console.log('markAllNotificationsRead error:', error);
}

function openNotificationDetail(id) {
  const n = _notificationsCache.find(x => x.id === id);
  if (!n) return;
  document.getElementById('notif-detail-title').textContent = n.title;
  document.getElementById('notif-detail-date').textContent = new Date(n.created_at).toLocaleDateString('it-IT', {day:'numeric', month:'long', year:'numeric'});
  document.getElementById('notif-detail-body').textContent = n.body;
  document.getElementById('notification-detail-modal').classList.add('on');

  if (currentUser && !_readNotifIds.has(id)) {
    _readNotifIds.add(id);
    renderNotificationsList();
    const dot = document.getElementById('notif-badge-dot');
    if (dot && !_notificationsCache.some(x => !_readNotifIds.has(x.id))) dot.classList.remove('show');
    supa.from('notification_reads').upsert({ user_id: currentUser.id, notification_id: id }, { onConflict: 'user_id,notification_id' })
      .then(({ error }) => { if (error) console.log('mark notification read error:', error); });
  }
}
function closeNotificationDetailModal() {
  document.getElementById('notification-detail-modal').classList.remove('on');
}

// Notifica di benvenuto: una riga fissa e sempre presente in tabella notifications
// (stesso id per tutti gli account, creata via SQL). Al primissimo accesso mostriamo
// il popup di benvenuto e, nello stesso momento, la segniamo già letta per l'utente:
// così risulta comunque in "Lette" nel centro notifiche, ma non riappare né conta
// come non letta, visto che è comparsa automaticamente.
const WELCOME_NOTIFICATION_ID = '11111111-1111-4111-8111-111111111111';
let _welcomeChecked = false;

async function checkWelcomeNotification() {
  if (!currentUser || _welcomeChecked) return;
  _welcomeChecked = true;
  // Subito dopo una registrazione manuale (email+password) può capitare che
  // la riga su public.users non sia ancora stata creata dal trigger su
  // auth.users quando arriviamo qui, perché non c'è nessuna attesa naturale
  // prima di questo punto (a differenza del round-trip OAuth di Google/Apple,
  // che dà al trigger il tempo di completarsi). L'upsert fallisce allora per
  // violazione della foreign key notification_reads_user_id_fkey. Riproviamo
  // qualche volta con un piccolo ritardo invece di arrenderci subito: senza
  // questo, chi resta in Home non vede più il popup finché non riavvia l'app,
  // perché altrimenti il retry scatta solo al prossimo ingresso in Home.
  const MAX_ATTEMPTS = 4;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const { data, error } = await supa.from('notification_reads')
        .select('notification_id')
        .eq('user_id', currentUser.id)
        .eq('notification_id', WELCOME_NOTIFICATION_ID)
        .maybeSingle();
      if (error) throw error;
      if (data) return;
      const { error: e2 } = await supa.from('notification_reads')
        .upsert({ user_id: currentUser.id, notification_id: WELCOME_NOTIFICATION_ID }, { onConflict: 'user_id,notification_id' });
      if (e2) throw e2;
      document.getElementById('welcome-modal')?.classList.add('on');
      return;
    } catch(e) {
      console.log(`checkWelcomeNotification error (tentativo ${attempt}/${MAX_ATTEMPTS}):`, e);
      if (attempt < MAX_ATTEMPTS) {
        await new Promise(r => setTimeout(r, 800));
      } else {
        _welcomeChecked = false; // esauriti i tentativi: riprova al prossimo ingresso in Home
      }
    }
  }
}
function closeWelcomeModal() {
  document.getElementById('welcome-modal').classList.remove('on');
}

// Controlli di sviluppo/debug (attivazione test premium, badge fonte scansione, ecc.)
// visibili SOLO per account admin — verifica lato client, l'unica finora presente.
function isAdmin() {
  return currentUser?.profile?.is_admin === true;
}

// Aggiorna tutta l'UI in base allo stato premium
function updatePremiumUI() {
  const premium = isPremium();

  // Nascondi/mostra banner premium in home
  const homeBanner = document.querySelector('.prem-banner');
  if (homeBanner) homeBanner.style.display = premium ? 'none' : 'flex';

  // Nascondi/mostra banner premium in maison
  const maisonBanner = document.querySelector('#v-maison .prem-banner, #v-maison [onclick*="v-paywall"]');
  if (maisonBanner) maisonBanner.style.display = premium ? 'none' : 'block';

  // Card Millésimes locked
  document.querySelectorAll('.q-card.locked').forEach(el => {
    if (premium) {
      el.classList.remove('locked');
      el.querySelector('.lock-pill')?.remove();
    }
  });

  // Lock pills ovunque
  if (premium) {
    document.querySelectorAll('.lock-pill').forEach(el => el.style.display = 'none');
    document.querySelectorAll('.lock-over').forEach(el => el.style.display = 'none');
    document.querySelectorAll('.locked-row').forEach(el => el.style.display = 'none');
    document.querySelectorAll('.zone-prem-block').forEach(el => el.style.display = 'none');
    document.querySelectorAll('.carnet-free-badge').forEach(el => el.style.display = 'none');
    document.querySelectorAll('[id="carnet-premium-banner"]').forEach(el => el.style.display = 'none');
    // Sblocca cru locked nella mappa e nelle zone
    document.querySelectorAll('.cru-locked').forEach(el => {
      el.style.opacity = '1';
      el.style.pointerEvents = 'auto';
    });
    // Sblocca maison card locked
    document.querySelectorAll('.maison-card[style*="opacity:.5"]').forEach(el => {
      el.style.opacity = '1';
      el.style.pointerEvents = 'auto';
    });
  } else {
    document.querySelectorAll('.lock-pill').forEach(el => el.style.display = '');
    document.querySelectorAll('.lock-over').forEach(el => el.style.display = '');
    document.querySelectorAll('.locked-row').forEach(el => el.style.display = '');
    document.querySelectorAll('.zone-prem-block').forEach(el => el.style.display = '');
  }

  // Nascondi stat "3 note gratuite" nella card Carnet in home se già premium
  const carnetStat = document.getElementById('home-carnet-stat');
  if (carnetStat) carnetStat.style.display = premium ? 'none' : '';

  // Aggiorna badge premium nel profilo
  const premBadge = document.getElementById('profile-premium-badge');
  if (premBadge) {
    premBadge.style.display = premium ? 'inline-flex' : 'none';
  }
  const freeBadge = document.getElementById('profile-free-badge');
  if (freeBadge) {
    freeBadge.style.display = premium ? 'none' : 'inline-flex';
  }

  // Pannello test attivazione Premium: visibile solo per account admin
  const testPanel = document.getElementById('test-premium-panel');
  if (testPanel) testPanel.style.display = isAdmin() ? 'block' : 'none';
}



// ═══ SCHERMATA ABBONAMENTO ═══

async function loadSubscriptionScreen() {
  // Ricarica il profilo fresco dal DB: se l'admin attiva/modifica il Premium
  // mentre la sessione è già aperta, currentUser.profile resta quello caricato
  // al login finché non si rifà l'accesso. Questa è proprio la schermata dove
  // l'utente controlla se l'upgrade è andato a buon fine — non deve mai
  // mostrare uno stato ormai superato.
  if (currentUser) {
    try {
      const { data, error } = await supa.from('users').select('*').eq('id', currentUser.id).maybeSingle();
      if (!error && data) currentUser.profile = data;
    } catch(e) { console.log('Subscription profile refresh error:', e); }
  }

  const premium = isPremium();
  const premEl = document.getElementById('sub-premium-active');
  const freeEl = document.getElementById('sub-free-active');

  if (premEl) premEl.style.display = premium ? 'block' : 'none';
  if (freeEl) freeEl.style.display = premium ? 'none' : 'block';

  if (!premium || !currentUser?.profile) return;

  const profile = currentUser.profile;
  const cancelAtEnd = profile.cancel_at_period_end === true;

  // Status label
  const statusEl = document.getElementById('sub-status-label');
  if (statusEl) {
    statusEl.textContent = cancelAtEnd ? '⚠ Disdetta programmata' : '✓ Abbonamento attivo';
    statusEl.style.color = cancelAtEnd ? '#B8860B' : '#085041';
  }

  // Piano e prezzo
  const planEl = document.getElementById('sub-plan-label');
  const priceEl = document.getElementById('sub-plan-price');
  const plan = profile.subscription_plan || 'test';
  if (planEl) {
    const labels = { annual: 'Annuale', monthly: 'Mensile', test: 'Test (gratuito)' };
    planEl.textContent = labels[plan] || 'Premium';
  }
  if (priceEl) {
    const prices = { annual: '4,99€/mese', monthly: '5,99€/mese', test: '—' };
    priceEl.textContent = prices[plan] || '';
  }

  // Data scadenza / rinnovo
  const renewalEl = document.getElementById('sub-renewal-date');
  const dateLabelEl = document.getElementById('sub-date-label');
  if (profile.premium_until) {
    const d = new Date(profile.premium_until);
    const formatted = d.toLocaleDateString('it-IT', {day:'numeric', month:'long', year:'numeric'});
    if (renewalEl) renewalEl.textContent = formatted;
    if (dateLabelEl) dateLabelEl.textContent = cancelAtEnd ? 'Scade il' : 'Rinnovo il';
  }

  // Banner disdetta
  const cancelNotice = document.getElementById('sub-cancel-notice');
  const cancelUntil = document.getElementById('sub-cancel-until');
  const cancelBtnWrap = document.getElementById('sub-cancel-btn-wrap');
  if (cancelAtEnd) {
    if (cancelNotice) cancelNotice.style.display = 'block';
    if (cancelBtnWrap) cancelBtnWrap.style.display = 'none';
    if (cancelUntil && profile.premium_until) {
      const d = new Date(profile.premium_until);
      cancelUntil.textContent = d.toLocaleDateString('it-IT', {day:'numeric', month:'long', year:'numeric'});
    }
  } else {
    if (cancelNotice) cancelNotice.style.display = 'none';
    if (cancelBtnWrap) cancelBtnWrap.style.display = 'block';
  }
}

async function deactivateAndRefresh() {
  await deactivatePremium();
  await loadSubscriptionScreen();
}

async function confirmCancelPremium() {
  const isNative = window.Capacitor?.isNativePlatform?.();
  const platform = window.Capacitor?.getPlatform?.();
  // Un abbonamento IAP reale non si può disdire con una chiamata dall'app:
  // Apple/Google richiedono che la disdetta avvenga nella loro schermata di
  // gestione abbonamenti di sistema. Ce li apre direttamente.
  if (isNative && platform === 'ios') {
    window.location.href = 'itms-apps://apps.apple.com/account/subscriptions';
    return;
  }
  if (isNative && platform === 'android') {
    window.location.href = 'https://play.google.com/store/account/subscriptions';
    return;
  }
  // Sito da browser, senza IAP reale: comportamento di test come sempre.
  if (!confirm('Sei sicuro di voler disdire il Premium?')) return;
  await deactivateAndRefresh();
}

// activateTestPremium and deactivatePremium defined above



function showAppToast(msg, duration) {
  const existing = document.getElementById('app-toast');
  if (existing) existing.remove();
  const t = document.createElement('div');
  t.id = 'app-toast';
  t.style.cssText = 'position:fixed;bottom:90px;left:50%;transform:translateX(-50%);background:rgba(30,18,8,.92);color:#fff;font-family:var(--sans);font-size:14px;padding:11px 20px;border-radius:20px;z-index:9999;white-space:nowrap;box-shadow:0 4px 16px rgba(0,0,0,.28);pointer-events:none;';
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => { if (t.parentNode) t.remove(); }, duration || 3000);
}

function showNoteError(msg) {
  // Remove existing error if any
  const existing = document.getElementById('note-form-error');
  if (existing) existing.remove();

  const err = document.createElement('div');
  err.id = 'note-form-error';
  err.style.cssText = 'background:#FCEBEB;color:#E24B4A;border:1px solid #F09595;border-radius:10px;padding:11px 14px;font-family:var(--sans);font-size:15px;margin:0 18px 12px;display:flex;align-items:center;gap:8px;';
  err.innerHTML = '<i class="ti ti-alert-circle" style="font-size:18px;flex-shrink:0;"></i>' + msg;

  // Inserisce prima del fondo del form
  const anchor = document.getElementById('note-form-bottom');
  if (anchor) anchor.parentElement.insertBefore(err, anchor);

  // Scroll to it
  err.scrollIntoView({ behavior: 'smooth', block: 'center' });

  // Auto remove after 4 seconds
  setTimeout(() => err.remove(), 4000);
}



// ═══ MAISON — Caricamento e rendering dal database ═══

let allMaison = [];
let currentMaisonFilter = 'tutti';
let currentMaisonLetter = 'tutti';
let currentMaisonSearch = '';
let currentMaisonDetail = null;
let maisonFavorites = new Set();
const MAISON_PAGE_SIZE = 50;
let maisonShownCount = MAISON_PAGE_SIZE;
let _maisonFiltered = [];

async function loadAndRenderMaison() {
  const loadingEl = document.getElementById('maison-loading');
  const listEl = document.getElementById('maison-list');
  const countEl = document.getElementById('maison-count-label');

  try {
    // Load maison from DB
    const { data, error } = await supa
      .from('maison')
      .select('*, zone(nome, colore)')
      .eq('is_published', true)
      .order('nome', { ascending: true });

    if (error) throw error;
    allMaison = data || [];

    // Load user favorites
    if (currentUser) {
      const { data: favs } = await supa
        .from('favorites')
        .select('maison_id')
        .eq('user_id', currentUser.id);
      maisonFavorites = new Set((favs || []).map(f => f.maison_id));
    }

    if (countEl) countEl.textContent = _approxCount(allMaison.length) + ' produttori · Champagne';
    if (loadingEl) loadingEl.style.display = 'none';
    if (listEl) listEl.style.display = 'block';

    buildLetterFilters();
    renderMaison();

  } catch(e) {
    console.log('loadMaison error:', e);
    if (loadingEl) loadingEl.innerHTML = '<div style="padding:20px;text-align:center;font-family:var(--sans);font-size:15px;color:var(--ink-4);">Errore caricamento. Riprova.</div>';
  }
}

function renderMaison() {
  const listEl = document.getElementById('maison-list');
  if (!listEl) return;

  let filtered = allMaison;

  // Filter by type / category
  if (currentMaisonFilter !== 'tutti') {
    if (currentMaisonFilter === 'grande-maison') filtered = filtered.filter(m => m.tipo === 'NM');
    else if (currentMaisonFilter === 'vigneron') filtered = filtered.filter(m => ['RM','RC','SR'].includes(m.tipo));
    else if (currentMaisonFilter === 'cooperativa') filtered = filtered.filter(m => m.tipo === 'CM');
    else if (currentMaisonFilter === 'bio') filtered = filtered.filter(m =>
      Array.isArray(m.certificazioni) && m.certificazioni.some(c => /bio/i.test(c) || c === 'Demeter')
    );
    else filtered = filtered.filter(m => m.tipo === currentMaisonFilter);
  }

  // Filter by letter (ignora parentesi e simboli iniziali)
  if (currentMaisonLetter !== 'tutti') {
    filtered = filtered.filter(m => maisonInitial(m.nome) === currentMaisonLetter);
  }

  // Filter by search (accent-insensitive via normalizeStr)
  if (currentMaisonSearch) {
    const q = normalizeStr(currentMaisonSearch);
    const tipoLabelM = {'NM':'négociant-manipulant','RM':'récoltant-manipulant','RC':'récoltant-coopérateur','CM':'coopérative-manipulant','SR':'société de récoltants','ND':'négociant-distributeur','MA':'marque acheteur'};
    filtered = filtered.filter(m =>
      matchesAllTerms(currentMaisonSearch, m.nome, m.sede_comune, m.descrizione, m.chef_de_cave, m.tipo, tipoLabelM[m.tipo], m.zone?.nome)
    );
    // Ordina: match nel nome prima, poi gli altri
    filtered.sort((a, b) => {
      const an = normalizeStr(a.nome), bn = normalizeStr(b.nome);
      const aScore = an.startsWith(q) ? 3 : an.includes(q) ? 2 : 1;
      const bScore = bn.startsWith(q) ? 3 : bn.includes(q) ? 2 : 1;
      return bScore - aScore;
    });
  }

  if (filtered.length === 0) {
    listEl.innerHTML = '<div style="padding:40px 24px;text-align:center;font-family:var(--sans);font-size:16px;color:var(--ink-4);">Nessuna maison trovata</div>';
    return;
  }

  const tipoLabel = {
    'NM':'Négociant-Manipulant','RM':'Récoltant-Manipulant',
    'RC':'Récoltant-Coopérateur','CM':'Coopérative-Manipulant',
    'SR':'Société de Récoltants','ND':'Négociant-Distributeur','MA':'Marque d\'Acheteur'
  };
  const tipoCategoria = {
    'NM':'Grande Maison','ND':'Grande Maison','MA':'Grande Maison',
    'RM':'Vigneron','RC':'Vigneron','SR':'Vigneron',
    'CM':'Cooperativa'
  };
  const tipoBadge = {
    'NM':'badge-gm','RM':'badge-rm','RC':'badge-rm',
    'CM':'badge-bio','SR':'badge-rm','ND':'badge-pres','MA':'badge-pres'
  };

  _maisonFiltered = filtered;
  maisonShownCount = MAISON_PAGE_SIZE;
  listEl.innerHTML = filtered.slice(0, maisonShownCount).map(m => _maisonCardHTML(m, tipoBadge, tipoCategoria)).join('') + _maisonLoadMoreHTML();
}

// Pulsante "Carica altri produttori", visibile solo se ce ne sono altri oltre
// quelli già mostrati. L'azione (pulsante) e il numero rimanente (didascalia
// leggera sotto) sono separati apposta — il numero è un dettaglio, non
// l'invito principale. Il wrapper ha una classe dedicata per poterlo trovare
// e rimuovere prima di appendere la pagina successiva.
function _maisonLoadMoreHTML() {
  if (maisonShownCount >= _maisonFiltered.length) return '';
  const remaining = _maisonFiltered.length - maisonShownCount;
  return '<div class="maison-loadmore-wrap" style="padding:8px 18px 20px;text-align:center;">' +
    '<button class="btn-outline" style="width:100%;border:1px solid var(--border-2);color:var(--ink-2);border-radius:var(--radius-md);padding:12px;" onclick="_loadMoreMaison()">Carica altri produttori</button>' +
    '<div style="font-family:var(--sans);font-size:12px;color:var(--ink-4);margin-top:9px;">' + remaining + ' rimasti</div>' +
  '</div>';
}

// Costruisce l'HTML di una singola card maison — condiviso tra render completo
// (cambio filtro/ricerca) e caricamento della pagina successiva (_loadMoreMaison).
function _maisonCardHTML(m, tipoBadge, tipoCategoria) {
  const premium = isPremium();
  const isLocked = !m.is_free && !premium;
  const badge = tipoBadge[m.tipo] || 'badge-rm';
  const categoria = tipoCategoria[m.tipo] || null;
  const label = m.tipo || '—';
  const fav = maisonFavorites.has(m.id);
  const zoneColor = m.zone?.colore || '#b8922a';
  const initial = maisonMonogram(m.nome);

  return '<div class="maison-card' + (isLocked ? ' locked' : '') + '" data-id="' + m.id + '" onclick="' + (isLocked ? "go('v-paywall')" : "openMaisonDetail('" + m.id + "')") + '">' +
    '<div class="maison-body">' +
      '<div class="maison-header-row">' +
        '<div class="maison-id">' +
          (m.foto_url
            ? '<div class="maison-thumb"><img src="' + m.foto_url + '" loading="lazy"/></div>'
            : '<div class="maison-monogram" style="color:' + zoneColor + ';background:' + zoneColor + '14;border-color:' + zoneColor + '40;">' + initial + '</div>') +
          '<div style="min-width:0;"><div class="maison-name">' + m.nome + '</div></div>' +
        '</div>' +
        (isLocked
          ? '<span class="maison-lock-pill"><i class="ti ti-lock"></i>Premium</span>'
          : '<i class="ti ' + (fav ? 'ti-heart-filled' : 'ti-heart') + ' maison-heart" style="' + (fav ? 'color:var(--gold);' : '') + '" data-id="' + m.id + '" onclick="event.stopPropagation();toggleMaisonFavorite(this,this.dataset.id)"></i>') +
      '</div>' +
      '<div class="maison-card-zona">' +
        (m.zone ? '<span class="zona-badge-sm" style="background:' + zoneColor + '18;color:' + zoneColor + ';border:0.5px solid ' + zoneColor + '55;">' + (m.zone.nome||'') + '</span>' : '') +
        (m.sede_comune ? '<span class="maison-sede">· ' + m.sede_comune + '</span>' : '') +
        (m.anno_fondazione ? '<span class="maison-sede">· dal ' + m.anno_fondazione + '</span>' : '') +
      '</div>' +
      '<div class="badges-row">' +
        (categoria ? '<span class="badge ' + badge + '">' + categoria + '</span>' : '') +
        '<span class="badge ' + badge + '" style="opacity:.75;">' + label + '</span>' +
        (m.certificazioni && m.certificazioni.length ? m.certificazioni.map(c => '<span class="badge badge-bio">' + c + '</span>').join('') : '') +
      '</div>' +
    '</div>' +
    (m.chef_de_cave ? '<div class="maison-cdc"><i class="ti ti-glass-full maison-cdc-icon"></i><div><div class="maison-cdc-label">Chef de Cave</div><div class="maison-cdc-name">' + m.chef_de_cave + '</div></div></div>' : '') +
  '</div>';
}

// Chiamata al click su "Carica altri produttori": aggiunge la pagina
// successiva in fondo alla lista già mostrata, senza ricostruire le card
// esistenti, e riposiziona il pulsante (o lo rimuove se non restano altri
// risultati).
function _loadMoreMaison() {
  if (maisonShownCount >= _maisonFiltered.length) return;
  const listEl = document.getElementById('maison-list');
  if (!listEl) return;
  const oldBtn = listEl.querySelector('.maison-loadmore-wrap');
  if (oldBtn) oldBtn.remove();
  // tipoBadge/tipoCategoria ridefiniti qui: identici a quelli in renderMaison,
  // servono solo per lo stile della card, non dipendono dai filtri attivi.
  const tipoBadge = { 'NM':'badge-gm','RM':'badge-rm','RC':'badge-rm','CM':'badge-bio','SR':'badge-rm','ND':'badge-pres','MA':'badge-pres' };
  const tipoCategoria = { 'NM':'Grande Maison','ND':'Grande Maison','MA':'Grande Maison','RM':'Vigneron','RC':'Vigneron','SR':'Vigneron','CM':'Cooperativa' };
  const next = _maisonFiltered.slice(maisonShownCount, maisonShownCount + MAISON_PAGE_SIZE);
  maisonShownCount += MAISON_PAGE_SIZE;
  listEl.insertAdjacentHTML('beforeend', next.map(m => _maisonCardHTML(m, tipoBadge, tipoCategoria)).join('') + _maisonLoadMoreHTML());
}

function setMaisonFilter(el, filter) {
  document.querySelectorAll('#maison-filters .f-btn').forEach(b => b.classList.remove('on'));
  el.classList.add('on');
  currentMaisonFilter = filter;
  renderMaison();
}

// Prima lettera alfabetica del nome, ignorando parentesi e simboli iniziali
function maisonInitial(nome) {
  if (!nome) return '';
  const m = nome.match(/[A-Za-zÀ-ÖØ-öø-ÿ]/);
  return m ? m[0].toUpperCase() : '';
}

// Iniziali per il monogramma (es. "Dom Pérignon" → "DP", "Bruno Paillard" → "BP").
// Con una sola lettera, scorrendo la lista in ordine alfabetico si vedono
// pagine intere con lo stesso monogramma — la seconda parola lo distingue.
// Un solo nome (es. "Krug") resta a una lettera.
function maisonMonogram(nome) {
  if (!nome) return '?';
  const clean = nome.replace(/^\s*\([^)]*\)\s*/, ''); // via un eventuale prefisso tra parentesi
  const words = clean.split(/[\s\-]+/).filter(w => /[A-Za-zÀ-ÖØ-öø-ÿ]/.test(w));
  if (words.length === 0) return maisonInitial(nome) || '?';
  const letterOf = w => w.match(/[A-Za-zÀ-ÖØ-öø-ÿ]/)[0].toUpperCase();
  return words.length === 1 ? letterOf(words[0]) : letterOf(words[0]) + letterOf(words[1]);
}

function buildLetterFilters() {
  const row = document.getElementById('maison-letter-filters');
  if (!row) return;

  // Raccogli le iniziali disponibili (ignora parentesi e simboli)
  const letters = [...new Set(
    allMaison.map(m => maisonInitial(m.nome)).filter(Boolean)
  )].sort();

  let html = '<div class="f-btn on" onclick="setMaisonLetter(this,\'tutti\')">Tutte</div>';
  letters.forEach(l => {
    html += '<div class="f-btn" onclick="setMaisonLetter(this,\'' + l + '\')">' + l + '</div>';
  });
  row.innerHTML = html;
}

function setMaisonLetter(el, letter) {
  document.querySelectorAll('#maison-letter-filters .f-btn').forEach(b => b.classList.remove('on'));
  el.classList.add('on');
  currentMaisonLetter = letter;
  renderMaison();
}

function toggleMaisonSearch() {
  const wrap = document.getElementById('maison-search-wrap');
  if (!wrap) return;
  const visible = wrap.style.display !== 'none';
  wrap.style.display = visible ? 'none' : 'block';
  if (!visible) document.getElementById('maison-search-input')?.focus();
}

function filterMaison() {
  currentMaisonSearch = document.getElementById('maison-search-input')?.value.trim() || '';
  renderMaison();
}

function clearMaisonSearch() {
  const input = document.getElementById('maison-search-input');
  if (input) input.value = '';
  currentMaisonSearch = '';
  renderMaison();
}

async function toggleMaisonFavorite(iconEl, maisonId) {
  if (!currentUser) { go('v-login'); return; }
  const isFav = maisonFavorites.has(maisonId);
  if (isFav) {
    await supa.from('favorites').delete().eq('user_id', currentUser.id).eq('maison_id', maisonId);
    maisonFavorites.delete(maisonId);
    iconEl.className = 'ti ti-heart maison-heart';
    iconEl.style.color = '';
  } else {
    await supa.from('favorites').insert({ user_id: currentUser.id, maison_id: maisonId });
    maisonFavorites.add(maisonId);
    iconEl.className = 'ti ti-heart-filled maison-heart';
    iconEl.style.color = 'var(--gold)';
  }
  updateProfileCounters();
}

async function toggleDetailFavorite() {
  if (!currentMaisonDetail) return;
  const id = currentMaisonDetail.id;
  const icon = document.getElementById('detail-fav-icon');
  const isFav = maisonFavorites.has(id);
  if (isFav) {
    await supa.from('favorites').delete().eq('user_id', currentUser.id).eq('maison_id', id);
    maisonFavorites.delete(id);
    if (icon) { icon.className = 'ti ti-heart'; icon.style.color = ''; }
  } else {
    await supa.from('favorites').insert({ user_id: currentUser.id, maison_id: id });
    maisonFavorites.add(id);
    if (icon) { icon.className = 'ti ti-heart-filled'; icon.style.color = 'var(--gold)'; }
  }
  updateProfileCounters();
}

function shareMaison() {
  if (!currentMaisonDetail) return;
  const m = currentMaisonDetail;
  const text = '🍾 ' + m.nome + '\n' +
    [m.sede_comune, m.anno_fondazione ? 'fondata nel ' + m.anno_fondazione : ''].filter(Boolean).join(' · ') + '\n\n' +
    (m.descrizione ? m.descrizione.substring(0,200) + '...' : '') + '\n\n' +
    'Via Cuvée — La guida italiana allo Champagne';
  if (navigator.share) {
    navigator.share({ text }).catch(() => {});
  } else {
    navigator.clipboard?.writeText(text).then(() => alert('Copiato!'));
  }
}

function openMaisonDetail(maisonId) {
  const m = allMaison.find(x => x.id === maisonId);
  if (!m) return;
  currentMaisonDetail = m;

  const tipoLabel = {
    'NM':'Négociant-Manipulant','RM':'Récoltant-Manipulant',
    'RC':'Récoltant-Coopérateur','CM':'Coopérative-Manipulant',
    'SR':'Société de Récoltants','ND':'Négociant-Distributeur','MA':'Marque d\'Acheteur'
  };
  const tipoBadge = {
    'NM':'badge-gm','RM':'badge-rm','RC':'badge-rm',
    'CM':'badge-bio','SR':'badge-rm','ND':'badge-pres','MA':'badge-pres'
  };

  const zonaNome = m.zone?.nome || '';

  // Hero
  const hero = document.getElementById('detail-hero');
  if (hero) {
    if (m.foto_url) {
      hero.className = 'detail-hero-photo';
      hero.style.color = '';
      hero.innerHTML = '<img src="' + m.foto_url + '" style="width:100%;height:200px;object-fit:cover;"/>';
    } else {
      const zoneColor = m.zone?.colore || '#b8922a';
      const initial = maisonMonogram(m.nome);
      hero.className = 'detail-hero-mono';
      hero.style.setProperty('--hero-tint', zoneColor + '14');
      hero.style.color = zoneColor;
      hero.innerHTML = '<div class="detail-hero-medallion">' + initial + '</div><div class="detail-hero-rule"></div>';
    }
  }

  // Favorite icon
  const favIcon = document.getElementById('detail-fav-icon');
  if (favIcon) {
    favIcon.className = 'ti ' + (maisonFavorites.has(m.id) ? 'ti-heart-filled' : 'ti-heart');
    favIcon.style.color = maisonFavorites.has(m.id) ? 'var(--gold)' : '';
  }

  // Nome & meta
  const nameEl = document.getElementById('detail-name');
  if (nameEl) nameEl.textContent = m.nome;
  const metaEl = document.getElementById('detail-meta');
  if (metaEl) metaEl.textContent = [m.sede_comune, m.anno_fondazione ? 'dal ' + m.anno_fondazione : ''].filter(Boolean).join(' · ');

  // Badges
  const badgesEl = document.getElementById('detail-badges');
  if (badgesEl) {
    let b = '';
    if (m.zone?.nome) b += '<span class="zona-pill-detail" style="background:' + (m.zone.colore || 'var(--gold)') + ';">' + m.zone.nome + '</span> ';
    if (m.tipo) b += '<span class="badge ' + (tipoBadge[m.tipo]||'badge-rm') + '">' + m.tipo + ' — ' + (tipoLabel[m.tipo]||m.tipo) + '</span>';
    if (m.certificazioni && m.certificazioni.length) m.certificazioni.forEach(c => { b += ' <span class="badge badge-bio">' + c + '</span>'; });
    badgesEl.innerHTML = b;
  }

  // Nota editoriale
  const notaSection = document.getElementById('detail-nota-editoriale-section');
  const notaEl = document.getElementById('detail-nota-editoriale');
  if (notaSection && notaEl) {
    notaSection.style.display = m.nota_editoriale ? 'block' : 'none';
    if (m.nota_editoriale) notaEl.textContent = m.nota_editoriale;
  }

  // Profilo
  const descEl = document.getElementById('detail-desc');
  if (descEl) descEl.textContent = m.descrizione || '';

  // Filosofia
  const filosSection = document.getElementById('detail-filosofia-section');
  const filosEl = document.getElementById('detail-filosofia');
  if (filosSection && filosEl) {
    filosSection.style.display = m.filosofia ? 'block' : 'none';
    if (m.filosofia) filosEl.textContent = m.filosofia;
  }

  // Scheda tecnica
  const schedaEl = document.getElementById('detail-scheda');
  if (schedaEl) {
    // ── Card statistiche in evidenza: i 3 numeri che raccontano la maison a colpo d'occhio ──
    const statCards = [
      m.anno_fondazione ? { icon:'ti-calendar-event', value: m.anno_fondazione, label:'Fondazione' } : null,
      m.ettari_totali ? { icon:'ti-map-2', value: m.ettari_totali + ' ha', label:'Vigneto' } : null,
      m.produzione_bottiglie ? { icon:'ti-bottle', value: (m.produzione_bottiglie >= 1000 ? Math.round(m.produzione_bottiglie/1000) + 'k' : m.produzione_bottiglie), label:'Bottiglie/anno' } : null,
    ].filter(Boolean);
    const statCardsHtml = statCards.length
      ? '<div class="stat-cards-row">' + statCards.map(s =>
          '<div class="stat-card">'
            + '<i class="ti ' + s.icon + ' stat-card-icon"></i>'
            + '<div class="stat-card-value">' + s.value + '</div>'
            + '<div class="stat-card-label">' + s.label + '</div>'
          + '</div>'
        ).join('') + '</div>'
      : '';

    const rows = [
      { icon:'ti-category',        l:'Tipo', v: m.tipo ? m.tipo + ' — ' + (tipoLabel[m.tipo]||'') : null },
      { icon:'ti-map-pin',         l:'Zona', v: zonaNome || null },
      { icon:'ti-building-store',  l:'Sede', v: [m.sede_comune, m.sede_regione].filter(Boolean).join(', ') || null },
      { icon:'ti-map-pin-filled',  l:'Indirizzo', v: m.sede_indirizzo || null },
      { icon:'ti-chef-hat',        l:'Chef de cave', v: m.chef_de_cave || null },
      { icon:'ti-user-star',       l:'Direzione', v: m.direzione || null },
      { icon:'ti-key',             l:'Proprietà', v: m.proprieta || null },
      { icon:'ti-hierarchy-2',     l:'Gruppo', v: m.gruppo || null },
    ].filter(r => r.v);
    const rowsHtml = rows.map(r =>
      '<div class="detail-row"><span class="detail-row-label-wrap"><i class="ti ' + r.icon + ' detail-row-icon"></i><span class="detail-row-label">' + r.l + '</span></span><span class="detail-row-value">' + r.v + '</span></div>'
    ).join('');

    schedaEl.innerHTML = statCardsHtml + rowsHtml;
  }

  // Vigneti & uvaggi
  const vigSection = document.getElementById('detail-vigneti-section');
  const vigEl = document.getElementById('detail-vigneti');
  if (vigSection && vigEl) {
    const hasData = m.ettari_totali || m.pct_pinot_noir || m.pct_chardonnay || m.pct_meunier || (m.certificazioni && m.certificazioni.length);
    vigSection.style.display = hasData ? 'block' : 'none';
    if (hasData) {
      let html = '';
      if (m.ettari_totali || m.ettari_proprieta) {
        let ettariVal = '';
        if (m.ettari_totali) ettariVal += m.ettari_totali + ' ha totali';
        if (m.ettari_proprieta && m.ettari_proprieta !== m.ettari_totali) ettariVal += (ettariVal ? '<br>' : '') + m.ettari_proprieta + ' ha di proprietà';
        if (m.ettari_gestione) ettariVal += '<br>' + m.ettari_gestione + ' ha in gestione';
        html += '<div class="detail-row"><span class="detail-row-label-wrap"><i class="ti ti-map-2 detail-row-icon"></i><span class="detail-row-label">Ettari</span></span><span class="detail-row-value">' + ettariVal + '</span></div>';
      }
      if (m.comuni_vigneti && m.comuni_vigneti.length) {
        html += '<div class="detail-row"><span class="detail-row-label-wrap"><i class="ti ti-map-pins detail-row-icon"></i><span class="detail-row-label">Comuni</span></span><span class="detail-row-value">' + m.comuni_vigneti.join(', ') + '</span></div>';
      }
      const uvaggi = [
        { name:'Pinot Noir', pct: m.pct_pinot_noir },
        { name:'Chardonnay', pct: m.pct_chardonnay },
        { name:'Meunier', pct: m.pct_meunier }
      ].filter(u => u.pct > 0);
      if (uvaggi.length) {
        html += '<div class="detail-row-label-wrap" style="margin-top:16px;margin-bottom:8px;"><i class="ti ti-glass-full detail-row-icon"></i><span class="detail-row-label">Uvaggio</span></div>'
          + renderRibbon(uvaggi.map(u => ({ label: u.name, perc: u.pct, tipo: 'uva' })), ['#7a2f3a','#b8922a','#8a6a1e'], '#9a8a72')
              .replace('ribbon-wrap', 'ribbon-wrap ribbon-wrap-tight');
      }
      if (m.certificazioni && m.certificazioni.length) {
        html += '<div style="margin-top:12px;display:flex;flex-wrap:wrap;gap:6px;">';
        m.certificazioni.forEach(c => { html += '<span class="badge badge-bio">' + c + '</span>'; });
        html += '</div>';
      }
      vigEl.innerHTML = html;
    }
  }

  // Produzione
  const prodSection = document.getElementById('detail-produzione-section');
  const prodEl = document.getElementById('detail-produzione');
  if (prodSection && prodEl) {
    // Produzione annua è già in evidenza tra le card statistiche sopra, non ripetuta qui.
    const rows = [
      { icon:'ti-flask',       l:'Vinificazione', v: m.vinificazione || null },
      { icon:'ti-flask-2',     l:'Malolattica', v: m.malolattica || null },
      { icon:'ti-gauge',       l:'Tipo di pressa', v: m.tipo_pressa || null },
      { icon:'ti-recycle',     l:'Vins de réserve', v: m.vins_de_reserve || null },
      { icon:'ti-droplet',     l:'Liqueur d\'expédition', v: m.liqueur_expedition || null },
      { icon:'ti-archive',     l:'Stock in cantina', v: m.stock_cantina ? m.stock_cantina.toLocaleString('it') + ' bott.' : null },
    ].filter(r => r.v);
    prodSection.style.display = rows.length ? 'block' : 'none';
    prodEl.innerHTML = rows.map(r =>
      '<div class="detail-row"><span class="detail-row-label-wrap"><i class="ti ' + r.icon + ' detail-row-icon"></i><span class="detail-row-label">' + r.l + '</span></span><span class="detail-row-value">' + r.v + '</span></div>'
    ).join('');
  }

  // Distribuzione & contatti
  const distribSection = document.getElementById('detail-distribuzione-section');
  const distribEl = document.getElementById('detail-distribuzione');
  if (distribSection && distribEl) {
    let html = '';
    if (m.importatore_italia) html += '<div class="detail-row"><span class="detail-row-label-wrap"><i class="ti ti-world detail-row-icon"></i><span class="detail-row-label">In Italia</span></span><span class="detail-row-value">' + m.importatore_italia + '</span></div>';
    if (m.telefono) html += '<div class="detail-row"><span class="detail-row-label-wrap"><i class="ti ti-phone detail-row-icon"></i><span class="detail-row-label">Telefono</span></span><span class="detail-row-value"><a class="detail-link" href="tel:' + m.telefono + '">' + m.telefono + '</a></span></div>';
    if (m.sito_web) {
      const url = m.sito_web.startsWith('http') ? m.sito_web : 'https://' + m.sito_web;
      html += '<div class="detail-row"><span class="detail-row-label-wrap"><i class="ti ti-link detail-row-icon"></i><span class="detail-row-label">Sito web</span></span><span class="detail-row-value"><a class="detail-link" href="' + url + '" target="_blank" onclick="event.stopPropagation()">' + m.sito_web + '</a></span></div>';
    }
    html += '<div style="margin-top:4px;">' +
      '<span class="visit-pill' + (m.visita_possibile ? ' on' : '') + '"><i class="ti ' + (m.visita_possibile ? 'ti-check' : 'ti-x') + '"></i>Visita</span>' +
      '<span class="visit-pill' + (m.degustazione_possibile ? ' on' : '') + '"><i class="ti ' + (m.degustazione_possibile ? 'ti-check' : 'ti-x') + '"></i>Degustazione</span>' +
    '</div>';
    if (m.visita_info) html += '<div style="font-family:var(--sans);font-size:13px;color:var(--ink-4);margin-top:8px;line-height:1.6;">' + m.visita_info + '</div>';
    distribSection.style.display = html ? 'block' : 'none';
    distribEl.innerHTML = html;
  }

  // Load bottles
  loadDetailBottles(maisonId);
  go('v-detail');
}

function toggleDetailCard(id) {
  document.getElementById(id)?.classList.toggle('open');
}

async function loadDetailBottles(maisonId) {
  const listEl = document.getElementById('detail-bottles-list');
  const lockEl = document.getElementById('detail-bottles-lock');
  if (!listEl) return;
  try {
    const { data: bottles } = await supa
      .from('bottiglie')
      .select('*')
      .eq('maison_id', maisonId)
      .eq('is_published', true)
      .eq('needs_review', false)
      .order('nome', { ascending: true });

    // openBottigliaDetail cerca la bottiglia in allBottiglie: se l'utente apre
    // una cuvée da qui senza mai aver visitato la scheda Champagne, l'array è
    // vuoto e il tap non fa nulla. Le registriamo qui per renderle sempre trovabili.
    if (bottles && bottles.length) {
      const known = new Set(allBottiglie.map(x => x.id));
      const toAdd = bottles.filter(b => !known.has(b.id));
      if (toAdd.length) allBottiglie = allBottiglie.concat(toAdd);
    }

    const subtitleEl = document.getElementById('detail-cuvee-subtitle');
    if (!bottles || bottles.length === 0) {
      listEl.innerHTML = '<div style="padding:0 18px 16px;font-family:var(--sans);font-size:15px;color:var(--ink-4);">Catalogo in aggiornamento.</div>';
      if (lockEl) lockEl.style.display = 'none';
      if (subtitleEl) subtitleEl.textContent = 'Catalogo in aggiornamento';
      return;
    }
    if (subtitleEl) subtitleEl.textContent = bottles.length + (bottles.length === 1 ? ' cuvée nel catalogo' : ' cuvée nel catalogo');
    const premium = isPremium();
    const lockedCount = premium ? 0 : Math.max(0, bottles.length - 2);
    listEl.innerHTML = bottles.map((b, i) => {
      const isLocked = !premium && i >= 2;
      const meta = (b.is_millesimato ? '<span class="type-pill type-pill-mill">Millesimato</span>' : '<span class="type-pill type-pill-sa">Sans Année</span>') +
        (b.dosaggio_tipo ? dosagePill(b.dosaggio_tipo) : '');
      const prezzo = b.prezzo_min ? 'da ' + b.prezzo_min + '€' : (b.fascia_prezzo || '');
      const foto = b.foto_url
        ? '<img src="' + b.foto_url + '" style="width:100%;height:100%;object-fit:cover;border-radius:6px;">'
        : '<svg viewBox="0 0 512 512" fill="currentColor"><path fill-rule="evenodd" clip-rule="evenodd" d="M217.6,0 L294.4,0 L294.4,76.8 C294.4,256 371.2,217.6 371.2,396.8 L371.2,512 L140.8,512 L140.8,396.8 C140.8,217.6 217.6,256 217.6,76.8 Z M335.057,240.943 L256,320 L176.943,240.943 L176.943,258.943 L256,338 L335.057,258.943 Z M204.8,396.8 L307.2,396.8 L307.2,435.2 L204.8,435.2 Z"/></svg>';
      return '<div class="bottle-row' + (isLocked ? ' locked' : '') + '" onclick="' + (isLocked ? "go('v-paywall')" : "openBottigliaDetail('" + b.id + "')") + '" style="cursor:pointer;">' +
        '<div class="bottle-ph">' + foto + '</div>' +
        '<div class="bottle-info">' +
          '<div class="bottle-name">' + b.nome + '</div>' +
          '<div class="bottle-type" style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">' + meta + '</div>' +
          (isLocked ? '<div class="lock-pill"><i class="ti ti-lock"></i><span>Premium</span></div>' :
            (prezzo ? '<div class="bottle-price" style="font-family:var(--sans);font-size:13px;color:var(--gold);margin-top:2px;">' + prezzo + '</div>' : '')) +
        '</div>' +
        (!isLocked && b.score_medio ? scoreRingCard(b.score_medio) : '') +
      '</div>';
    }).join('');
    if (lockEl) {
      if (lockedCount > 0) {
        lockEl.style.display = 'flex';
        lockEl.querySelector('p').innerHTML = '<strong>' + lockedCount + ' cuvées</strong> disponibili con Piano Premium.';
      } else {
        lockEl.style.display = 'none';
      }
    }
  } catch(e) { console.log('loadDetailBottles error:', e); }
}

// ═══ BOTTIGLIE — Lista completa ═══
let allBottiglie = [];
let currentBottFilters = new Set();   // multi-select tipo
let currentBottSearch = '';
let currentBottLetter = 'tutti';
let currentBottPriceFilter = 'tutti';
let currentBottiglia = null;
const BOTT_PAGE_SIZE = 50;
let bottShownCount = BOTT_PAGE_SIZE;
let _bottFiltered = [];
let wishlistIds = new Set();

function scoreLabel(s) {
  if (!s) return '';
  if (s >= 100) return 'Perfetto';
  if (s >= 98) return 'Leggendario';
  if (s >= 96) return 'Eccezionale';
  if (s >= 94) return 'Straordinario';
  if (s >= 92) return 'Superiore';
  if (s >= 90) return 'Eccellente';
  if (s >= 88) return 'Molto Buono';
  return 'Buono';
}

function scoreRingSm(score) {
  if (!score) return '';
  const deg = Math.round((score / 100) * 360);
  return '<div style="display:flex;flex-direction:column;align-items:center;flex-shrink:0;">' +
    '<div class="score-ring-sm" style="background:conic-gradient(var(--gold) ' + deg + 'deg,var(--border) 0deg);">' +
      '<div class="score-ring-sm-inner"><span class="score-num-sm">' + score + '</span></div>' +
    '</div>' +
    '<div class="score-label-sm">' + scoreLabel(score) + '</div>' +
  '</div>';
}
function scoreRingCard(score) {
  if (!score) return '';
  const deg = Math.round((score / 100) * 360);
  return '<div class="score-ring-sm" style="background:conic-gradient(var(--gold) ' + deg + 'deg,var(--border) 0deg);">' +
    '<div class="score-ring-sm-inner"><span class="score-num-sm">' + score + '</span></div>' +
  '</div>';
}

function dosagePill(tipo) {
  if (!tipo) return '';
  const cfg = {
    'Brut Nature': {bg:'#DFF0FA',c:'#184F6A'},
    'Zero Dosage': {bg:'#DFF0FA',c:'#184F6A'},
    'Pas Dosé':    {bg:'#DFF0FA',c:'#184F6A'},
    'Extra Brut':  {bg:'#D8F2EC',c:'#0C5444'},
    'Brut':        {bg:'#F5EDD8',c:'#8A6A1E'},
    'Extra Sec':   {bg:'#FEF0CC',c:'#7A5000'},
    'Extra Dry':   {bg:'#FEF0CC',c:'#7A5000'},
    'Sec':         {bg:'#FDE4D0',c:'#7A3010'},
    'Demi-Sec':    {bg:'#FDE0EE',c:'#7A1840'},
    'Doux':        {bg:'#EDD0E8',c:'#5A1060'},
  };
  const s = cfg[tipo] || {bg:'var(--ivory-2)',c:'var(--ink-4)'};
  return '<span class="dosage-pill" style="background:' + s.bg + ';color:' + s.c + ';">' + tipo + '</span>';
}

function priceScale(fascia, prezzo) {
  // prezzo_min è sempre fonte di verità se disponibile
  let n = 0;
  if (prezzo) {
    n = prezzo <= 50 ? 1 : prezzo <= 90 ? 2 : prezzo <= 130 ? 3 : prezzo <= 200 ? 4 : prezzo <= 300 ? 5 : 6;
  } else {
    const levels = {'entry':1,'media_gamma':2,'premium':3,'alta_gamma':4,'lusso':5,'gran_lusso':6};
    n = levels[fascia] || 0;
  }
  if (!n) return '';
  const symbols = Array.from({length:6}, (_,i) => {
    const active = i < n;
    const isTopLevel = active && i === 5;
    if (isTopLevel) {
      return '<span style="font-size:14px;font-weight:700;color:#111;-webkit-text-stroke:0.5px var(--gold);line-height:1;">€</span>';
    }
    return '<span style="font-size:14px;font-weight:' + (active?'700':'400') + ';color:' + (active?'var(--gold)':'var(--border-2)') + ';line-height:1;">€</span>';
  }).join('');
  return '<div class="price-scale" style="display:flex;align-items:center;gap:1px;">' + symbols + '</div>';
}

async function loadAndRenderBottiglie() {
  const loadingEl = document.getElementById('bott-loading');
  const listEl = document.getElementById('bott-list');
  const countEl = document.getElementById('bott-count-label');
  try {
    const { data, error } = await supa
      .from('bottiglie')
      .select('*, maison(nome, slug, is_free)')
      .eq('is_published', true)
      .eq('needs_review', false)
      .order('nome', { ascending: true });
    if (error) throw error;
    allBottiglie = data || [];
    computeBottiglieLocks();
    if (currentUser) {
      const { data: wish } = await supa.from('wishlist').select('bottiglia_id').eq('user_id', currentUser.id);
      wishlistIds = new Set((wish || []).map(w => w.bottiglia_id));
    }
    if (countEl) countEl.textContent = _approxCount(allBottiglie.length) + ' cuvée nel catalogo';
    if (loadingEl) loadingEl.style.display = 'none';
    if (listEl) listEl.style.display = 'block';
    buildBottLetterFilters();
    renderBottiglie();
  } catch(e) {
    console.log('loadBottiglie error:', e);
    if (loadingEl) loadingEl.innerHTML = '<div style="padding:20px;text-align:center;font-family:var(--sans);font-size:15px;color:var(--ink-4);">Errore caricamento. Riprova.</div>';
  }
}

// Calcola quali bottiglie sono libere: prime 2 in ordine alfabetico per ogni maison,
// oppure tutte bloccate se la maison stessa è premium.
function computeBottiglieLocks() {
  const byMaison = {};
  allBottiglie.forEach(b => {
    const mid = b.maison_id;
    if (!byMaison[mid]) byMaison[mid] = [];
    byMaison[mid].push(b);
  });
  Object.values(byMaison).forEach(group => {
    group.sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));
    const maisonLocked = group[0]?.maison?.is_free === false;
    group.forEach((b, i) => { b._locked = maisonLocked || i >= 2; });
  });
}

function renderBottiglie() {
  const listEl = document.getElementById('bott-list');
  if (!listEl) return;
  const tipoLabel = {'nv':'Sans Année','millesimato':'Millésimé','prestige':'Prestige Cuvée','blanc_de_blancs':'Blanc de Blancs','blanc_de_noirs':'Blanc de Noirs','rose':'Rosé','nature':'Brut Nature'};
  let filtered = allBottiglie;

  // Multi-filter: AND logic tra filtri attivi
  if (currentBottFilters.size > 0) {
    filtered = filtered.filter(b => {
      for (const f of currentBottFilters) {
        switch (f) {
          case 'millesimato':
            if (b.is_millesimato !== true) return false; break;
          case 'nv':
            if (b.is_millesimato === true) return false; break;
          case 'rose':
            if (b.tipo !== 'rose') return false; break;
          case 'blanc_de_blancs':
            if (b.tipo !== 'blanc_de_blancs') return false; break;
          case 'blanc_de_noirs':
            if (b.tipo !== 'blanc_de_noirs') return false; break;
          case 'assemblage':
            if (b.tipo !== 'assemblage') return false; break;
          case 'nature': {
            const pasD = ['brut nature','pas dosé','pas dose','nature','zero dosage']
            const dTipo = (b.dosaggio_tipo || '').toLowerCase()
            if (b.dosaggio_gl !== 0 && !pasD.some(t => dTipo.includes(t))) return false; break;
          }
          case 'prestige':
            if (!b.is_featured) return false; break;
        }
      }
      return true;
    });
  }

  if (currentBottLetter !== 'tutti') filtered = filtered.filter(b => bottInitial(b.nome) === currentBottLetter || bottInitial(b.maison?.nome) === currentBottLetter);

  // Filtro per fascia prezzo
  if (currentBottPriceFilter !== 'tutti') {
    filtered = filtered.filter(b => {
      const p = b.prezzo_min;
      if (!p) return false;
      switch (currentBottPriceFilter) {
        case 'entry':       return p <= 50;
        case 'media_gamma': return p > 50  && p <= 90;
        case 'premium':     return p > 90  && p <= 130;
        case 'alta_gamma':  return p > 130 && p <= 200;
        case 'lusso':       return p > 200 && p <= 300;
        case 'gran_lusso':  return p > 300;
        default: return true;
      }
    });
  }

  if (currentBottSearch) {
    const q = normalizeStr(currentBottSearch);
    const tipoLabelB = {'nv':'sans année','millesimato':'millésimé','prestige':'prestige cuvée','blanc_de_blancs':'blanc de blancs','blanc_de_noirs':'blanc de noirs','rose':'rosé','nature':'brut nature'};
    filtered = filtered.filter(b =>
      matchesAllTerms(currentBottSearch, b.nome, b.maison?.nome, b.descrizione, b.dosaggio_tipo, tipoLabelB[b.tipo], b.annata)
    );
    // Ordina: match nel nome cuvée o maison prima, poi gli altri campi
    filtered.sort((a, b) => {
      const scoreOf = x => {
        const nome = normalizeStr(x.nome), maison = normalizeStr(x.maison?.nome || '');
        if (nome.startsWith(q) || maison.startsWith(q)) return 3;
        if (nome.includes(q) || maison.includes(q)) return 2;
        return 1;
      };
      return scoreOf(b) - scoreOf(a);
    });
  }
  if (!filtered.length) {
    listEl.innerHTML = '<div style="padding:40px 24px;text-align:center;font-family:var(--sans);font-size:16px;color:var(--ink-4);">Nessuna bottiglia trovata</div>';
    return;
  }
  _bottFiltered = filtered;
  bottShownCount = BOTT_PAGE_SIZE;
  listEl.innerHTML = filtered.slice(0, bottShownCount).map(b => _bottCardHTML(b, tipoLabel)).join('') + _bottLoadMoreHTML();
}

// Pulsante "Carica altri champagne", visibile solo se ce ne sono altri oltre
// quelli già mostrati. Azione (pulsante) e numero rimanente (didascalia
// leggera sotto) separati apposta — il numero è un dettaglio, non l'invito.
function _bottLoadMoreHTML() {
  if (bottShownCount >= _bottFiltered.length) return '';
  const remaining = _bottFiltered.length - bottShownCount;
  return '<div class="bott-loadmore-wrap" style="padding:8px 18px 20px;text-align:center;">' +
    '<button class="btn-outline" style="width:100%;border:1px solid var(--border-2);color:var(--ink-2);border-radius:var(--radius-md);padding:12px;" onclick="_loadMoreBottiglie()">Carica altri champagne</button>' +
    '<div style="font-family:var(--sans);font-size:12px;color:var(--ink-4);margin-top:9px;">' + remaining + ' rimasti</div>' +
  '</div>';
}

// Costruisce l'HTML di una singola card bottiglia — condiviso tra render
// completo (cambio filtro/ricerca) e caricamento della pagina successiva col pulsante "Mostra altri".
function _bottCardHTML(b, tipoLabel) {
  const isLocked = !!b._locked && !isPremium();
  return '<div class="bott-card' + (isLocked ? ' locked' : '') + '" onclick="' + (isLocked ? "go('v-paywall')" : "openBottigliaDetail('" + b.id + "')") + '">' +
    '<div class="bott-card-img" style="min-height:88px;">' +
      (b.foto_url ? '<img src="' + b.foto_url + '" loading="lazy"/>' : '<svg viewBox="0 0 512 512" fill="currentColor"><path fill-rule="evenodd" clip-rule="evenodd" d="M217.6,0 L294.4,0 L294.4,76.8 C294.4,256 371.2,217.6 371.2,396.8 L371.2,512 L140.8,512 L140.8,396.8 C140.8,217.6 217.6,256 217.6,76.8 Z M335.057,240.943 L256,320 L176.943,240.943 L176.943,258.943 L256,338 L335.057,258.943 Z M204.8,396.8 L307.2,396.8 L307.2,435.2 L204.8,435.2 Z"/></svg>') +
      (isLocked ? '<div class="lock-over"><i class="ti ti-lock"></i>Premium</div>' : '') +
    '</div>' +
    '<div class="bott-card-body">' +
      '<div class="bott-card-maison">' + (b.maison?.nome || '') + '</div>' +
      '<div class="bott-card-nome">' + b.nome + '</div>' +
      '<div class="bott-card-tipo" style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">' +
        (b.is_millesimato ? '<span class="type-pill type-pill-mill">Millesimato</span>' : '<span class="type-pill type-pill-sa">Sans Année</span>') +
        dosagePill(b.dosaggio_tipo) +
      '</div>' +
      '<div class="bott-card-footer">' +
        '<div class="bott-card-info">' +
          (!isLocked && b.score_medio ? scoreRingCard(b.score_medio) : '') +
          (!isLocked && (b.fascia_prezzo || b.prezzo_min) ? '<div style="display:flex;flex-direction:column;gap:2px;">' +
            priceScale(b.fascia_prezzo, b.prezzo_min) +
            (b.prezzo_min ? '<span style="font-family:var(--sans);font-size:11px;color:var(--ink-4);">da ' + b.prezzo_min + '€</span>' : '') +
          '</div>' : '') +
        '</div>' +
        (!isLocked ? '<button class="bott-card-add" data-id="' + b.id + '" onclick="event.stopPropagation();openNewNoteFromBottiglia(this.dataset.id)">' +
          '<span class="bott-card-add-badge">+</span>' +
          '<i class="ti ti-notebook"></i>' +
        '</button>' : '') +
      '</div>' +
    '</div>' +
  '</div>';
}

// Chiamata al click su "Carica altri champagne": aggiunge la pagina
// successiva in fondo alla lista già mostrata, senza ricostruire le card
// esistenti, e riposiziona il pulsante (o lo rimuove se non restano altri
// risultati).
function _loadMoreBottiglie() {
  if (bottShownCount >= _bottFiltered.length) return;
  const listEl = document.getElementById('bott-list');
  if (!listEl) return;
  const oldBtn = listEl.querySelector('.bott-loadmore-wrap');
  if (oldBtn) oldBtn.remove();
  const tipoLabel = {'nv':'Sans Année','millesimato':'Millésimé','prestige':'Prestige Cuvée','blanc_de_blancs':'Blanc de Blancs','blanc_de_noirs':'Blanc de Noirs','rose':'Rosé','nature':'Brut Nature'};
  const next = _bottFiltered.slice(bottShownCount, bottShownCount + BOTT_PAGE_SIZE);
  bottShownCount += BOTT_PAGE_SIZE;
  listEl.insertAdjacentHTML('beforeend', next.map(b => _bottCardHTML(b, tipoLabel)).join('') + _bottLoadMoreHTML());
}

function toggleBottFilter(el, filter) {
  if (filter === 'tutti') {
    currentBottFilters.clear();
  } else {
    if (currentBottFilters.has(filter)) {
      currentBottFilters.delete(filter);
    } else {
      currentBottFilters.add(filter);
    }
  }
  document.querySelectorAll('#bott-filters .f-btn').forEach(b => {
    const f = b.dataset.filter;
    const active = f === 'tutti' ? currentBottFilters.size === 0 : currentBottFilters.has(f);
    b.classList.toggle('on', active);
  });
  renderBottiglie();
}

function toggleBottPriceFilter(el, price) {
  currentBottPriceFilter = price;
  document.querySelectorAll('#bott-price-filters .f-btn').forEach(b => {
    b.classList.toggle('on', b.dataset.price === price);
  });
  renderBottiglie();
}

// Prima lettera del nome bottiglia (ignora parentesi e simboli)
function bottInitial(nome) {
  if (!nome) return '';
  const m = nome.match(/[A-Za-zÀ-ÖØ-öø-ÿ]/);
  return m ? m[0].toUpperCase() : '';
}

function buildBottLetterFilters() {
  const row = document.getElementById('bott-letter-filters');
  if (!row) return;
  const letters = [...new Set(
    allBottiglie.map(b => bottInitial(b.nome)).filter(Boolean)
  )].sort();
  let html = '<div class="f-btn on" onclick="setBottLetter(this,\'tutti\')">Tutte</div>';
  letters.forEach(l => {
    html += '<div class="f-btn" onclick="setBottLetter(this,\'' + l + '\')">' + l + '</div>';
  });
  row.innerHTML = html;
}

function setBottLetter(el, letter) {
  document.querySelectorAll('#bott-letter-filters .f-btn').forEach(b => b.classList.remove('on'));
  el.classList.add('on');
  currentBottLetter = letter;
  renderBottiglie();
}

function toggleBottSearch() {
  const wrap = document.getElementById('bott-search-wrap');
  if (!wrap) return;
  const vis = wrap.style.display !== 'none';
  wrap.style.display = vis ? 'none' : 'block';
  if (!vis) document.getElementById('bott-search-input')?.focus();
}

function filterBottiglie() {
  currentBottSearch = document.getElementById('bott-search-input')?.value.trim() || '';
  renderBottiglie();
}

function clearBottSearch() {
  const input = document.getElementById('bott-search-input');
  if (input) input.value = '';
  currentBottSearch = '';
  renderBottiglie();
}

async function toggleWishlist(iconEl, bottId) {
  if (!currentUser) { go('v-login'); return; }
  const inWish = wishlistIds.has(bottId);
  if (inWish) {
    await supa.from('wishlist').delete().eq('user_id', currentUser.id).eq('bottiglia_id', bottId);
    wishlistIds.delete(bottId);
  } else {
    await supa.from('wishlist').insert({ user_id: currentUser.id, bottiglia_id: bottId });
    wishlistIds.add(bottId);
  }
  iconEl.className = 'ti ' + (wishlistIds.has(bottId) ? 'ti-heart-filled' : 'ti-heart') + ' bott-wish' + (wishlistIds.has(bottId) ? ' on' : '');
  updateProfileCounters();
}

function renderAssemblaggio(b) {
  const section = document.getElementById('bott-detail-assembl-section');
  const el = document.getElementById('bott-detail-assembl');
  const totalEl = document.getElementById('bott-detail-assembl-total');
  if (!section || !el) return;

  let items = null;

  // 1. Dati strutturati da DB (JSONB)
  if (b.assemblaggio && Array.isArray(b.assemblaggio) && b.assemblaggio.length) {
    items = b.assemblaggio;
  }
  // 2. Fallback automatico: se l'annata è compilata → 100% di quell'anno
  else if (b.annata) {
    items = [{ anno: b.annata, perc: 100 }];
  }

  if (!items || !items.length) {
    section.style.display = 'none';
    return;
  }

  // Colori per distinguere le annate (oro in gradazioni diverse); la riserva
  // usa sempre un tono più freddo/spento per restare distinguibile a colpo d'occhio.
  const colors = ['#b8922a','#8a6a1e','#d4b06a','#a68030','#e0c48a'];
  let colorIdx = 0;
  const RISERVA_COLOR = '#9a8a72';

  section.style.display = 'block';

  // Label totale anni (es. "da 3 annate" o "100% 2015")
  const anni = items.filter(i => i.anno).map(i => i.anno);
  if (totalEl) {
    if (anni.length === 1 && items.length === 1) totalEl.textContent = '100% ' + anni[0];
    else if (anni.length > 1) totalEl.textContent = anni.length + ' annate in assemblaggio';
    else totalEl.textContent = '';
  }

  // Riserva sempre presente (0% se assente nei dati)
  const hasRiserva = items.some(i => !i.anno);
  if (!hasRiserva) items = [...items, { tipo: 'riserva', perc: 0 }];

  el.innerHTML = renderRibbon(items, colors, RISERVA_COLOR)
    + '<div class="assembl-divider"></div>';
}

// Nastro proporzionale riusabile: un'unica barra divisa in segmenti in base
// alla % reale di ciascun componente, con legenda leggibile sotto (pallino
// colore + etichetta + percentuale). Usato per "Vini di base" e per l'uvaggio.
function renderRibbon(items, yearColors, otherColor) {
  let colorIdx = 0;
  const segData = items.map(item => {
    // "riserva" copre anche varianti descrittive tipo "riserva perpetua dal 1998"
    const isRiserva = typeof item.tipo === 'string' && item.tipo.startsWith('riserva');
    const label = item.anno
      ? String(item.anno)
      : (item.label || (isRiserva ? (item.tipo.charAt(0).toUpperCase() + item.tipo.slice(1)) : (item.tipo || 'Base')));
    const perc  = item.perc || 0;
    const color = isRiserva ? otherColor : yearColors[colorIdx++ % yearColors.length];
    return { label, perc, color };
  });

  const segs = segData.map(s => {
    const showPct = s.perc >= 12; // sotto questa soglia il testo non ci sta leggibile
    return '<div class="ribbon-seg" style="flex-grow:' + Math.max(s.perc, 0.001) + ';background:' + s.color + ';">'
      + (showPct ? '<span class="ribbon-seg-pct">' + s.perc + '%</span>' : '')
      + '</div>';
  }).join('');

  const legend = segData.map(s =>
    '<div class="ribbon-legend-item">'
      + '<span class="ribbon-dot" style="background:' + s.color + ';"></span>'
      + '<span class="ribbon-legend-label">' + s.label + '</span>'
      + '<span class="ribbon-legend-pct">' + s.perc + '%</span>'
    + '</div>'
  ).join('');

  return '<div class="ribbon-wrap">'
    + '<div class="ribbon-bar">' + segs + '</div>'
    + '<div class="ribbon-legend">' + legend + '</div>'
  + '</div>';
}

// Versione string-based di renderAssemblaggio(), per i contesti che costruiscono
// HTML via innerHTML in un colpo solo (risultato scansione, nota carnet) invece
// di patchare nodi DOM fissi come fa la pagina scheda bottiglia.
function buildAssemblaggioHTML(assemblaggio) {
  if (!assemblaggio || !Array.isArray(assemblaggio) || !assemblaggio.length) return '';
  let items = assemblaggio;
  const colors = ['#b8922a','#8a6a1e','#d4b06a','#a68030','#e0c48a'];
  const RISERVA_COLOR = '#9a8a72';
  const hasRiserva = items.some(i => !i.anno);
  if (!hasRiserva) items = [...items, { tipo: 'riserva', perc: 0 }];
  return renderRibbon(items, colors, RISERVA_COLOR);
}

// Blocco "finestra di degustazione" per le Sans Année: qui non esiste un'annata
// fissa da collocare su un asse a calendario (la SA si rinnova ogni anno), quindi
// mostriamo una durata consigliata dall'acquisto invece di un intervallo assoluto.
function buildFinestraSAHTML(minAnni, maxAnni) {
  if (minAnni == null && maxAnni == null) return '';
  let testo;
  if (minAnni != null && maxAnni != null) {
    testo = minAnni === maxAnni
      ? `Da bere entro ${maxAnni} ${maxAnni === 1 ? 'anno' : 'anni'} dall'acquisto`
      : `Da bere entro ${minAnni}-${maxAnni} anni dall'acquisto`;
  } else if (maxAnni != null) {
    testo = `Da bere entro ${maxAnni} ${maxAnni === 1 ? 'anno' : 'anni'} dall'acquisto`;
  } else {
    testo = `Da bere almeno dopo ${minAnni} ${minAnni === 1 ? 'anno' : 'anni'} dall'acquisto`;
  }
  return '<div class="finestra-wrap finestra-wrap-sa">'
    + '<div class="finestra-header">'
      + '<div class="finestra-title"><i class="ti ti-calendar-time"></i>Finestra di degustazione</div>'
    + '</div>'
    + '<div class="finestra-sa-badge">' + testo + '</div>'
    + '<div class="finestra-sa-note">Sans Année: la bottiglia si rinnova ogni anno, quindi la finestra vale dal momento dell\'acquisto e non da un\'annata fissa.</div>'
  + '</div>';
}

// Dispatcher: sceglie la versione a calendario (millesimati) o a durata (Sans
// Année) in base al tipo di bottiglia. Usato ovunque serva il blocco finestra.
function buildFinestraSectionHTML(b) {
  if (b.is_millesimato) return buildFinestraHTML(b.finestra_da, b.finestra_a);
  return buildFinestraSAHTML(b.finestra_consumo_min_anni, b.finestra_consumo_max_anni);
}

// Blocco completo "finestra di degustazione" (titolo, pillola stato, tracciato
// rosso→verde→rosso, marker "oggi", etichette anni, legenda) come stringa HTML
// autonoma — stessa logica/colori della scheda bottiglia, riusata ovunque serva
// lo stesso riferimento visivo (risultato scansione, nota carnet). Solo per
// millesimati: le Sans Année usano buildFinestraSAHTML tramite il dispatcher.
function buildFinestraHTML(finestra_da, finestra_a) {
  if (!finestra_da && !finestra_a) return '';
  const now  = new Date().getFullYear();
  const from = finestra_da || now;
  const to   = finestra_a  || (now + 10);
  const trackFrom = from - 2;
  const trackTo   = to   + 2;
  const trackSpan = trackTo - trackFrom;
  const toPercent = v => Math.max(0, Math.min(100, ((v - trackFrom) / trackSpan) * 100));

  const fromPct = toPercent(from), toPct = toPercent(to), nowPct = toPercent(now);
  const RED = '#a8564f', GREEN = '#7c9473';
  const blend = 6;
  const stops = [
    RED + ' 0%', RED + ' ' + Math.max(0, fromPct - blend) + '%',
    GREEN + ' ' + fromPct + '%', GREEN + ' ' + toPct + '%',
    RED + ' ' + Math.min(100, toPct + blend) + '%', RED + ' 100%',
  ];
  const gradient = 'linear-gradient(90deg,' + stops.join(',') + ')';

  const REDBG = '#f5e6e4', REDTXT = '#8a453e', GREENBG = '#eef1e8', GREENTXT = '#5c7a4f';
  let stato = '', pillBg = '', pillColor = '';
  if (now < from) {
    stato = 'Da aprire nel ' + from;
    pillBg = REDBG; pillColor = REDTXT;
  } else if (now <= to) {
    if (now === from)       { stato = 'Appena pronta';  pillBg = GREENBG; pillColor = GREENTXT; }
    else if (now >= to - 1) { stato = 'In declino';      pillBg = GREENBG; pillColor = GREENTXT; }
    else                     { stato = '● Ottimale ora'; pillBg = GREENBG; pillColor = GREENTXT; }
  } else {
    stato = 'Oltre la finestra';
    pillBg = REDBG; pillColor = REDTXT;
  }

  return '<div class="finestra-wrap">'
    + '<div class="finestra-header">'
      + '<div class="finestra-title"><i class="ti ti-calendar-time"></i>Finestra di degustazione</div>'
      + '<span class="finestra-status-pill" style="background:' + pillBg + ';color:' + pillColor + ';">' + stato + '</span>'
    + '</div>'
    + '<div class="finestra-track-wrap"><div class="finestra-track" style="background:' + gradient + ';">'
      + '<div class="finestra-now-marker" style="left:' + nowPct + '%;"></div>'
    + '</div></div>'
    + '<div class="finestra-labels"><span>' + from + '</span><span class="finestra-labels-now">Oggi</span><span>' + to + '</span></div>'
    + '<div class="finestra-legend">'
      + '<span class="finestra-legend-item"><span class="finestra-legend-dot" style="background:' + REDTXT + ';"></span>Non ancora ideale</span>'
      + '<span class="finestra-legend-item"><span class="finestra-legend-dot" style="background:' + GREENTXT + ';"></span>Nel momento giusto</span>'
    + '</div>'
  + '</div>';
}

// Scheda tecnica (card statistiche + nastro uvaggio + righe con icona) come
// stringa HTML autonoma — stessa logica/stile della scheda bottiglia, riusata
// nei contesti che costruiscono la pagina via innerHTML in un colpo solo.
function buildSchedaTecnicaHTML(f) {
  const uvaggiParts = [
    { l:'Pinot Noir', v: f.pctPinotNoir },
    { l:'Chardonnay', v: f.pctChardonnay },
    { l:'Meunier',    v: f.pctMeunier },
  ].filter(u => u.v);
  const uvaggioPrincipale = uvaggiParts.length
    ? uvaggiParts.reduce((max, u) => u.v > max.v ? u : max, uvaggiParts[0])
    : null;

  const statCards = [
    f.dosaggioGl != null ? { icon:'ti-droplet', value: f.dosaggioGl + ' g/l', label: f.dosaggioTipo || 'Dosaggio' } : (f.dosaggioTipo ? { icon:'ti-droplet', value: f.dosaggioTipo, label:'Dosaggio' } : null),
    f.maturazioneMesi ? { icon:'ti-clock-hour-4', value: f.maturazioneMesi, label:'Mesi sui lieviti' } : null,
    uvaggioPrincipale ? { icon:'ti-glass-full', value: uvaggioPrincipale.v + '%', label: uvaggioPrincipale.l } : null,
  ].filter(Boolean);

  const statCardsHtml = statCards.length
    ? '<div class="stat-cards-row">' + statCards.map(s =>
        '<div class="stat-card">'
          + '<i class="ti ' + s.icon + ' stat-card-icon"></i>'
          + '<div class="stat-card-value">' + s.value + '</div>'
          + '<div class="stat-card-label">' + s.label + '</div>'
        + '</div>'
      ).join('') + '</div>'
    : '';

  const uvaggioRibbon = uvaggiParts.length > 1
    ? '<div class="detail-row-label-wrap" style="margin-bottom:8px;"><i class="ti ti-glass-full detail-row-icon"></i><span class="detail-row-label">Uvaggio</span></div>'
      + renderRibbon(uvaggiParts.map(u => ({ label: u.l, perc: u.v, tipo: 'uva' })), ['#7a2f3a','#b8922a','#8a6a1e'], '#9a8a72').replace('ribbon-wrap', 'ribbon-wrap ribbon-wrap-tight')
    : '';

  const rows = [
    { icon:'ti-building-store', l:'Produttore', v: f.maison || null },
    { icon:'ti-map-pin',        l:'Provenienza uve', v: f.provenienzaUve || null },
    { icon:'ti-flask',          l:'Vinificazione', v: f.vinificazione || null },
    { icon:'ti-flask-2',        l:'Malolattica', v: f.malolattica || null },
    { icon:'ti-notes',          l:'Note assemblaggio', v: f.notaAssemblaggio || null },
    { icon:'ti-bottle',         l:'Produzione', v: f.produzioneBottiglie ? f.produzioneBottiglie.toLocaleString('it') + ' bott.' : null },
  ].filter(r => r.v);
  const rowsHtml = rows.map(r =>
    '<div class="detail-row"><span class="detail-row-label-wrap"><i class="ti ' + r.icon + ' detail-row-icon"></i><span class="detail-row-label">' + r.l + '</span></span><span class="detail-row-value">' + r.v + '</span></div>'
  ).join('');

  return statCardsHtml + uvaggioRibbon + rowsHtml;
}

function bottDetailPhotoClick() {
  if (window._bottDetailPhotoUrl) openLightbox([window._bottDetailPhotoUrl], 0);
  else openBottlePhotoInfoModal();
}

function openBottlePhotoInfoModal() {
  const modal = document.getElementById('bottle-photo-info-modal');
  if (modal) modal.classList.add('on');
}
function closeBottlePhotoInfoModal() {
  const modal = document.getElementById('bottle-photo-info-modal');
  if (modal) modal.classList.remove('on');
}

// Verifica sempre lato server la posizione alfabetica reale tra le bottiglie
// della stessa maison, indipendentemente da quali dati sono già in cache lato client.
async function isBottigliaLocked(b) {
  if (isPremium()) return false;
  const { data } = await supa
    .from('bottiglie')
    .select('id, nome, maison(is_free)')
    .eq('maison_id', b.maison_id)
    .eq('is_published', true)
    .eq('needs_review', false)
    .order('nome', { ascending: true });
  if (!data || !data.length) return false;
  if (data[0].maison?.is_free === false) return true;
  const idx = data.findIndex(x => x.id === b.id);
  return idx === -1 ? false : idx >= 2;
}

async function openBottigliaDetail(bottId) {
  const b = allBottiglie.find(x => x.id === bottId) || currentBottiglia;
  if (!b) return;
  if (await isBottigliaLocked(b)) { go('v-paywall'); return; }
  currentBottiglia = b;

  // Foto verticale cliccabile — riempie il contenitore senza barre nere
  const hero = document.getElementById('bott-detail-hero');
  window._bottDetailPhotoUrl = b.foto_url || null;
  if (hero) {
    if (b.foto_url) {
      hero.style.position = 'relative';
      hero.style.display  = 'block';
      hero.style.cursor   = 'zoom-in';
      hero.innerHTML = '<img src="' + b.foto_url + '" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block;" onerror="this.parentElement.style.cursor=\'default\';this.style.display=\'none\'">';
    } else {
      hero.style.position = '';
      hero.style.display  = 'flex';
      hero.style.cursor   = 'pointer';
      hero.innerHTML = '<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:12px 8px;gap:5px;">'
        + '<i class="ti ti-camera-plus" style="font-size:28px;color:rgba(200,160,58,.55);"></i>'
        + '<div style="font-family:var(--sans);font-size:11px;font-weight:600;color:rgba(200,160,58,.85);line-height:1.3;">Ancora nessuna foto</div>'
        + '<div style="font-family:var(--sans);font-size:9.5px;color:rgba(200,160,58,.5);line-height:1.3;">Sii il primo a scansionarla</div>'
        + '<div style="margin-top:2px;display:flex;align-items:center;gap:3px;background:rgba(200,160,58,.14);border:1px solid rgba(200,160,58,.28);border-radius:20px;padding:3px 8px;">'
        + '<i class="ti ti-info-circle" style="font-size:10px;color:rgba(200,160,58,.8);"></i>'
        + '<span style="font-family:var(--sans);font-size:8.5px;color:rgba(200,160,58,.8);">scopri come</span>'
        + '</div>'
        + '</div>';
    }
  }

  // Wishlist icon
  const wishIcon = document.getElementById('bott-detail-wish-icon');
  if (wishIcon) {
    const inWish = wishlistIds.has(b.id);
    wishIcon.className = 'ti ' + (inWish ? 'ti-heart-filled' : 'ti-heart');
    wishIcon.style.color = inWish ? 'var(--gold)' : '';
  }

  // Nome & info
  const maisonNomeEl = document.getElementById('bott-detail-maison-nome');
  if (maisonNomeEl) maisonNomeEl.textContent = b.maison?.nome || '';
  const nomeEl = document.getElementById('bott-detail-nome');
  if (nomeEl) nomeEl.textContent = b.nome;
  // Riga tipo: solo Millesimato/Sans Année + dosaggio, come due badge colorati
  const tipoEl = document.getElementById('bott-detail-tipo');
  if (tipoEl) {
    const millPill = b.is_millesimato
      ? '<span class="type-pill type-pill-mill">Millesimato</span>'
      : '<span class="type-pill type-pill-sa">Sans Année</span>';
    tipoEl.innerHTML = millPill + (b.dosaggio_tipo ? dosagePill(b.dosaggio_tipo) : '');
  }

  // Prezzo: un'unica riga pulita, scala € + range
  const badgesEl = document.getElementById('bott-detail-badges');
  if (badgesEl) {
    let bdg = '';
    if (b.prezzo_min) {
      bdg += '<span class="bott-price-value">da ' + b.prezzo_min + (b.prezzo_max ? '–' + b.prezzo_max : '') + ' €</span>';
    }
    if (b.fascia_prezzo || b.prezzo_min) bdg += '<span class="bott-price-scale">' + priceScale(b.fascia_prezzo, b.prezzo_min) + '</span>';
    badgesEl.innerHTML = bdg;
  }

  // Score compatto nella colonna destra
  const scoreWrap = document.getElementById('bott-detail-score-wrap');
  const scoreRingEl = document.getElementById('bott-detail-score-ring');
  if (scoreWrap && scoreRingEl && b.score_medio) {
    const deg = Math.round((b.score_medio / 100) * 360);
    scoreRingEl.innerHTML =
      '<div style="width:52px;height:52px;border-radius:50%;background:conic-gradient(var(--gold) ' + deg + 'deg,var(--border) 0deg);display:flex;align-items:center;justify-content:center;flex-shrink:0;">' +
        '<div style="width:40px;height:40px;border-radius:50%;background:var(--ivory);display:flex;align-items:center;justify-content:center;">' +
          '<span style="font-family:var(--sans);font-size:15px;color:var(--ink);font-weight:700;line-height:1;">' + b.score_medio + '</span>' +
        '</div>' +
      '</div>';
    const lblEl = document.getElementById('bott-detail-score-label');
    if (lblEl) lblEl.textContent = scoreLabel(b.score_medio);
    scoreWrap.style.display = 'flex';
  } else if (scoreWrap) { scoreWrap.style.display = 'none'; }

  // Finestra degustazione — a calendario (rosso→verde→rosso) per i millesimati,
  // a durata dall'acquisto per le Sans Année (che si rinnovano ogni anno e non
  // hanno un'annata fissa da collocare su un asse a calendario).
  const finSection = document.getElementById('bott-detail-finestra-section');
  if (finSection) {
    const finHtml = b.is_millesimato
      ? buildFinestraHTML(b.finestra_da, b.finestra_a)
      : buildFinestraSAHTML(b.finestra_consumo_min_anni, b.finestra_consumo_max_anni);
    finSection.style.display = finHtml ? 'block' : 'none';
    finSection.innerHTML = finHtml;
  }

  // Note degustazione
  const noteEl = document.getElementById('bott-detail-note');
  if (noteEl) noteEl.textContent = b.note_degustazione || '';

  // Scheda tecnica
  // Assemblaggio vini di base
  renderAssemblaggio(b);

  const schedaEl = document.getElementById('bott-detail-scheda');
  if (schedaEl) {
    // Mostra vini_base come testo solo se non c'è assemblaggio strutturato
    const hasAssembl = (b.assemblaggio && b.assemblaggio.length) || !!b.annata;

    // ── Card statistiche in evidenza: dosaggio, maturazione, uvaggio principale ──
    const uvaggiParts = [
      { l:'Pinot Noir', v: b.pct_pinot_noir },
      { l:'Chardonnay',  v: b.pct_chardonnay },
      { l:'Meunier',     v: b.pct_meunier },
    ].filter(u => u.v);
    const uvaggioPrincipale = uvaggiParts.length
      ? uvaggiParts.reduce((max, u) => u.v > max.v ? u : max, uvaggiParts[0])
      : null;

    const statCards = [
      b.dosaggio_gl != null ? { icon:'ti-droplet', value: b.dosaggio_gl + ' g/l', label: b.dosaggio_tipo || 'Dosaggio' } : (b.dosaggio_tipo ? { icon:'ti-droplet', value: b.dosaggio_tipo, label:'Dosaggio' } : null),
      b.maturazione_mesi ? { icon:'ti-clock-hour-4', value: b.maturazione_mesi, label:'Mesi sui lieviti' } : null,
      uvaggioPrincipale ? { icon:'ti-glass-full', value: uvaggioPrincipale.v + '%', label: uvaggioPrincipale.l } : null,
    ].filter(Boolean);

    const statCardsHtml = statCards.length
      ? '<div class="stat-cards-row">' + statCards.map(s =>
          '<div class="stat-card">'
            + '<i class="ti ' + s.icon + ' stat-card-icon"></i>'
            + '<div class="stat-card-value">' + s.value + '</div>'
            + '<div class="stat-card-label">' + s.label + '</div>'
          + '</div>'
        ).join('') + '</div>'
      : '';

    // ── Uvaggio come nastro proporzionale (se più di un vitigno) ──
    const uvaggioRibbon = uvaggiParts.length > 1
      ? '<div class="detail-row-label-wrap" style="margin-bottom:8px;"><i class="ti ti-glass-full detail-row-icon"></i><span class="detail-row-label">Uvaggio</span></div>'
        + renderRibbon(uvaggiParts.map(u => ({ label: u.l, perc: u.v, tipo: 'uva' })), ['#7a2f3a','#b8922a','#8a6a1e'], '#9a8a72').replace('ribbon-wrap', 'ribbon-wrap ribbon-wrap-tight')
      : '';

    // ── Righe rimanenti con icona ──
    const rows = [
      { icon:'ti-building-store', l:'Produttore', v: b.maison?.nome || null },
      { icon:'ti-map-pin',        l:'Provenienza uve', v: b.provenienza_uve || null },
      { icon:'ti-flask',          l:'Vinificazione', v: b.vinificazione || null },
      { icon:'ti-flask-2',        l:'Malolattica', v: b.malolattica || null },
      { icon:'ti-notes',          l:'Note assemblaggio', v: !hasAssembl ? (b.vini_base || null) : null },
      { icon:'ti-bottle',         l:'Produzione', v: b.produzione_bottiglie ? b.produzione_bottiglie.toLocaleString('it') + ' bott.' : null },
    ].filter(r => r.v);
    const rowsHtml = rows.map(r =>
      '<div class="detail-row"><span class="detail-row-label-wrap"><i class="ti ' + r.icon + ' detail-row-icon"></i><span class="detail-row-label">' + r.l + '</span></span><span class="detail-row-value">' + r.v + '</span></div>'
    ).join('');

    schedaEl.innerHTML = statCardsHtml + uvaggioRibbon + rowsHtml;
  }

  // Abbinamento
  const abbSection = document.getElementById('bott-detail-abbinamento-section');
  const abbEl = document.getElementById('bott-detail-abbinamento');
  if (abbSection && abbEl) {
    abbSection.style.display = b.abbinamento ? 'block' : 'none';
    if (b.abbinamento) abbEl.textContent = b.abbinamento;
  }

  // ── Dove acquistare (link dal DB) ────────────────────
  const buySection = document.getElementById('bott-buy-section');
  if (buySection) {
    const SUPPLIERS = [
      { key:'link_millesima',  name:'Millésima',   desc:'Specialista Champagne · spedizione rapida',         favicon:'https://www.millesima.it/favicon.ico' },
      { key:'link_callmewine', name:'Callmewine',  desc:'Enoteca online italiana · oltre 10.000 etichette',  favicon:'https://www.callmewine.com/favicon.ico' },
      { key:'link_tannico',    name:'Tannico',      desc:'Marketplace del vino · prezzi competitivi',         favicon:'https://www.tannico.it/favicon.ico' },
    ];

    // Costruisci lista righe: 3 fornitori fissi + custom opzionali
    const links = [
      ...SUPPLIERS.map(s => ({ name: s.name, desc: s.desc, favicon: s.favicon, url: b[s.key] || '' })),
      ...(b.link_custom1_nome && b.link_custom1_url ? [{ name: b.link_custom1_nome, desc: 'Link personalizzato', favicon: null, url: b.link_custom1_url }] : []),
      ...(b.link_custom2_nome && b.link_custom2_url ? [{ name: b.link_custom2_nome, desc: 'Link personalizzato', favicon: null, url: b.link_custom2_url }] : []),
    ];
    // Solo i venditori con un link davvero impostato per questa bottiglia —
    // niente più righe grigie/non cliccabili per fornitori non disponibili.
    const available = links.filter(l => l.url);

    const rows = available.map((l, i) => {
      const isLast = i === available.length - 1;
      const logoEl = l.favicon
        ? '<img src="' + l.favicon + '" onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'flex\'" style="width:24px;height:24px;object-fit:contain;" alt=""><svg width="18" height="18" viewBox="0 0 512 512" fill="var(--gold)" style="display:none;"><path fill-rule="evenodd" clip-rule="evenodd" d="M217.6,0 L294.4,0 L294.4,76.8 C294.4,256 371.2,217.6 371.2,396.8 L371.2,512 L140.8,512 L140.8,396.8 C140.8,217.6 217.6,256 217.6,76.8 Z M335.057,240.943 L256,320 L176.943,240.943 L176.943,258.943 L256,338 L335.057,258.943 Z M204.8,396.8 L307.2,396.8 L307.2,435.2 L204.8,435.2 Z"/></svg>'
        : '<i class="ti ti-link" style="font-size:18px;color:var(--gold);"></i>';
      return '<a href="' + l.url + '" target="_blank" class="buy-row"'
        + (isLast ? ' style="border-bottom:none;"' : '')
        + '>'
        + '<div class="buy-logo">' + logoEl + '</div>'
        + '<div class="buy-info"><div class="buy-name">' + l.name + '</div><div class="buy-desc">' + l.desc + '</div></div>'
        + '<i class="ti ti-chevron-right buy-arrow"></i>'
        + '</a>';
    }).join('');

    const header = '<div style="font-family:var(--sans);font-size:10px;letter-spacing:1.5px;color:var(--gold);text-transform:uppercase;font-weight:600;margin-bottom:10px;">'
      + '<i class="ti ti-shopping-bag" style="font-size:10px;margin-right:5px;"></i>Dove acquistare'
      + '</div>';

    buySection.innerHTML = header + (available.length
      ? '<div style="background:var(--ivory-2);border:1px solid var(--border);border-radius:var(--radius-lg);overflow:hidden;">' + rows + '</div>'
      : '<div style="background:var(--ivory-2);border:1px dashed var(--border-2);border-radius:var(--radius-lg);padding:24px 20px;text-align:center;">'
        + '<div style="width:46px;height:46px;border-radius:50%;background:#1E1208;border:2px solid var(--ivory);box-shadow:0 -3px 14px rgba(30,18,8,.16),0 3px 10px rgba(30,18,8,.18);display:flex;align-items:center;justify-content:center;margin:0 auto 12px;">'
        + '<i class="ti ti-clock" style="font-size:20px;color:#C8A03A;"></i>'
        + '</div>'
        + '<div style="font-family:var(--serif);font-size:17px;color:var(--ink);font-weight:500;margin-bottom:5px;">Punti vendita in aggiornamento</div>'
        + '<div style="font-family:var(--sans);font-size:13px;color:var(--ink-4);line-height:1.55;">Stiamo selezionando i migliori rivenditori per questa cuvée — torna presto a controllare.</div>'
        + '</div>');
  }
  // ── End Dove acquistare ──────────────────────────────

  go('v-bottiglia-detail');
}

async function toggleWishlistDetail() {
  if (!currentBottiglia || !currentUser) return;
  const icon = document.getElementById('bott-detail-wish-icon');
  const inWish = wishlistIds.has(currentBottiglia.id);
  if (inWish) {
    await supa.from('wishlist').delete().eq('user_id', currentUser.id).eq('bottiglia_id', currentBottiglia.id);
    wishlistIds.delete(currentBottiglia.id);
  } else {
    await supa.from('wishlist').insert({ user_id: currentUser.id, bottiglia_id: currentBottiglia.id });
    wishlistIds.add(currentBottiglia.id);
  }
  if (icon) { icon.className = 'ti ' + (wishlistIds.has(currentBottiglia.id) ? 'ti-heart-filled' : 'ti-heart'); icon.style.color = wishlistIds.has(currentBottiglia.id) ? 'var(--gold)' : ''; }
  updateProfileCounters();
}

function shareBottiglia() {
  if (!currentBottiglia) return;
  const text = '🍾 ' + currentBottiglia.nome + (currentBottiglia.maison?.nome ? '\n' + currentBottiglia.maison.nome : '') + '\n\n' + (currentBottiglia.note_degustazione || '').substring(0, 150) + '...\n\nScopri su Cuvée app';
  if (navigator.share) { navigator.share({ title: currentBottiglia.nome, text }); }
  else if (navigator.clipboard) { navigator.clipboard.writeText(text); }
}

// ══════════════════════════════════════════════════════════════
//  SCAN FEATURE — riconoscimento bottiglia tramite Claude Vision
// ══════════════════════════════════════════════════════════════

const EDGE_URL = 'https://wlfxgbmffvhuqmqjiuqo.supabase.co/functions/v1/analyze-bottle';
let _scanPhotoDataUrl = null;
let _scanResult       = null;

// Avvia la scansione (mode: 'explore' = pagina risultato | 'carnet' = compila form)
const FREE_SCANS_PER_MONTH = 3;
const PREMIUM_SCANS_PER_MONTH = 100;
const PREMIUM_SCAN_WARNING_THRESHOLD = 3; // sotto questa soglia avvisiamo i Premium
let _pendingScanMode = 'explore';

async function startScan(mode) {
  if (!currentUser) { go('v-login'); return; }
  _pendingScanMode = mode || 'explore';

  if (!isPremium()) {
    const remaining = await _getScansRemainingThisMonth();
    if (remaining <= 0) {
      _showScanLimitModal(false);
      return;
    }
    _showScanRemainingModal(remaining, false);
    return;
  }

  // Premium: nessuna interruzione finché restano scansioni "abbondanti".
  // Sotto la soglia avvisiamo (stesso banner mostrato nel profilo); a 0 blocchiamo
  // proattivamente come per i free, invece di scoprirlo solo dopo lo scatto.
  const usedPremium = await _getScansUsedThisMonth();
  const remainingPremium = Math.max(0, PREMIUM_SCANS_PER_MONTH - usedPremium);
  if (remainingPremium <= 0) {
    _showScanLimitModal(true);
    return;
  }
  if (remainingPremium <= PREMIUM_SCAN_WARNING_THRESHOLD) {
    _showScanRemainingModal(remainingPremium, true);
    return;
  }
  _openScanInput(_pendingScanMode);
}

function _openScanInput(mode) {
  const input = document.getElementById('scan-input');
  if (!input) return;
  input.setAttribute('data-scan-mode', mode || 'explore');
  input.click();
}

// Quante scansioni sono state "usate" questo mese: l'override admin ha sempre
// priorità sul conteggio reale calcolato da bottle_scans.
async function _getScansUsedThisMonth() {
  if (!currentUser) return 0;
  const override = currentUser.profile?.scan_override;
  if (override != null) return override;
  try {
    const monthStart = new Date();
    monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
    const { count } = await supa
      .from('bottle_scans')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', currentUser.id)
      .gte('created_at', monthStart.toISOString());
    return count || 0;
  } catch(e) {
    console.log('scan count error:', e);
    return 0;
  }
}

// Conta le scansioni già fatte questo mese e ritorna quante ne restano (min 0).
// In caso di errore di rete non blocchiamo l'utente: il vero limite è comunque
// applicato lato server nella edge function.
async function _getScansRemainingThisMonth() {
  if (!currentUser) return FREE_SCANS_PER_MONTH;
  try {
    const used = await _getScansUsedThisMonth();
    return Math.max(0, FREE_SCANS_PER_MONTH - used);
  } catch(e) {
    console.log('scan count error:', e);
    return FREE_SCANS_PER_MONTH;
  }
}

// Popola i contatori "Scansioni totali" / "Rimaste questo mese" nel profilo
// e mostra un avviso ai Premium quando stanno per esaurire le 100 mensili.
async function updateScanStatsUI() {
  if (!currentUser) return;
  try {
    const [{ count: totalCount }, used] = await Promise.all([
      supa.from('bottle_scans').select('*', { count: 'exact', head: true }).eq('user_id', currentUser.id),
      _getScansUsedThisMonth(),
    ]);

    const prem = isPremium();
    const cap = prem ? PREMIUM_SCANS_PER_MONTH : FREE_SCANS_PER_MONTH;
    const remaining = Math.max(0, cap - used);

    const totalEl = document.getElementById('profile-scans-total');
    if (totalEl) totalEl.textContent = totalCount ?? 0;

    const remEl = document.getElementById('profile-scans-remaining');
    if (remEl) remEl.textContent = remaining;
    const remLabelEl = document.getElementById('profile-scans-remaining-label');
    if (remLabelEl) remLabelEl.textContent = 'Rimaste questo mese (su ' + cap + ')';

    // Avviso solo per Premium in esaurimento — a 0 rimaste interviene già
    // il modal dedicato al momento della scansione, qui serve solo l'anticipo.
    const warnEl = document.getElementById('profile-scan-warning');
    const warnTextEl = document.getElementById('profile-scan-warning-text');
    if (warnEl) {
      if (prem && remaining > 0 && remaining <= PREMIUM_SCAN_WARNING_THRESHOLD) {
        if (warnTextEl) warnTextEl.innerHTML = 'Ultime <strong>' + remaining + (remaining === 1 ? ' scansione' : ' scansioni') + '</strong> Premium disponibili questo mese, su ' + PREMIUM_SCANS_PER_MONTH + ' totali. Si rinnovano il 1° del mese prossimo.';
        warnEl.style.display = 'flex';
      } else {
        warnEl.style.display = 'none';
      }
    }
  } catch(e) {
    console.log('updateScanStatsUI error:', e);
  }
}

// isPrem=true quando è un Premium in avvicinamento alle 100 scansioni mensili:
// niente pitch "passa a Premium", messaggio e soglia diversi dal free.
function _showScanRemainingModal(remaining, isPrem) {
  const modal = document.getElementById('scan-remaining-modal');
  if (!modal) { _openScanInput(_pendingScanMode); return; }
  const c1 = document.getElementById('scan-remaining-count');
  const c2 = document.getElementById('scan-remaining-count-2');
  if (c1) c1.textContent = remaining;
  if (c2) c2.textContent = remaining;

  const suffix1 = document.getElementById('scan-remaining-suffix');
  const suffix2 = document.getElementById('scan-remaining-desc-suffix');
  const sep     = document.getElementById('scan-remaining-sep');
  const skipBtn = document.getElementById('scan-remaining-skip-btn');

  if (isPrem) {
    if (suffix1) suffix1.textContent = remaining === 1 ? ' scansione Premium rimasta' : ' scansioni Premium rimaste';
    if (suffix2) suffix2.innerHTML = ' scansioni sommelier disponibili, su <strong>100 totali</strong>. Si rinnovano il 1° del mese prossimo.';
    if (sep)     sep.style.display = 'none';
    if (skipBtn) skipBtn.style.display = 'none';
  } else {
    if (suffix1) suffix1.textContent = ' scansioni gratuite rimaste';
    if (suffix2) suffix2.innerHTML = ' scansioni gratuite disponibili. Con <strong>Cuvée Premium</strong> hai 100 scansioni sommelier al mese.';
    if (sep)     sep.style.display = '';
    if (skipBtn) skipBtn.style.display = '';
  }

  modal.classList.add('on');
}
function closeScanRemainingModal() {
  const modal = document.getElementById('scan-remaining-modal');
  if (modal) modal.classList.remove('on');
}
function _confirmScanFromModal() {
  closeScanRemainingModal();
  _openScanInput(_pendingScanMode);
}

// Handler del file input
function handleScanFile(inputEl) {
  const file = inputEl.files?.[0];
  if (!file) return;
  inputEl.value = '';
  const mode = inputEl.getAttribute('data-scan-mode') || 'explore';
  _processScan(file, mode);
}

// Comprime l'immagine via canvas (max 1200px, JPEG 0.82)
function _compressForScan(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const MAX = 1200;
        let { width: w, height: h } = img;
        if (w > MAX || h > MAX) {
          if (w > h) { h = Math.round(h * MAX / w); w = MAX; }
          else       { w = Math.round(w * MAX / h); h = MAX; }
        }
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
        resolve({ dataUrl, base64: dataUrl.split(',')[1] });
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Flusso principale di scansione
async function _processScan(file, mode) {
  _showScanLoading(true);
  try {
    // 1. Comprimi
    const { dataUrl, base64 } = await _compressForScan(file);
    _scanPhotoDataUrl = dataUrl;

    // 2. Auth token
    const { data: sessionData } = await supa.auth.getSession();
    const token = sessionData?.session?.access_token;
    if (!token) { _showScanLoading(false); go('v-login'); return; }

    // 3. Chiama Edge Function
    const resp = await fetch(EDGE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
      body: JSON.stringify({ image_base64: base64, media_type: 'image/jpeg' })
    });
    const result = await resp.json();

    // 4. Gestione rate limit
    if (resp.status === 429) {
      _showScanLoading(false);
      _showScanLimitModal(result.scan_limit === 100);
      return;
    }
    if (!resp.ok || result.error) {
      _showScanLoading(false);
      alert('Errore durante la scansione. Riprova.\n' + (result?.message || result?.error || ''));
      return;
    }

    _scanResult = result;
    if (result._debug) console.warn('scan _debug:', result._debug);
    _showScanLoading(false);

    // Salva nello storico qualsiasi scansione di vino valida (Champagne o altro).
    // Bottiglie non-vino (birra, superalcolici, ecc.) e non-bottiglie restano escluse.
    if (currentUser && result.is_bottle !== false && result.is_wine !== false) {
      saveScanToHistory(result, dataUrl).catch(() => {});
    }

    if (mode === 'carnet') {
      _fillCarnetFromScan(result, dataUrl);
    } else {
      _showScanResultPage(result, dataUrl);
    }

  } catch(err) {
    _showScanLoading(false);
    console.error('scan error:', err);
    alert('Errore di connessione. Controlla la rete e riprova.\n' + (err?.message || err));
  }
}

// Carica la foto nel bucket champagne-photos e aggiorna il record
async function _uploadBottlePhoto(dataUrl, bottleId) {
  try {
    const res  = await fetch(dataUrl);
    const blob = await res.blob();
    const path = 'bottles/' + bottleId + '.jpg';
    const { error } = await supa.storage
      .from('champagne-photos')
      .upload(path, blob, { contentType: 'image/jpeg', upsert: true });
    if (!error) {
      const { data: u } = supa.storage.from('champagne-photos').getPublicUrl(path);
      await supa.from('bottiglie').update({ foto_url: u.publicUrl }).eq('id', bottleId);
      if (_scanResult) _scanResult._uploadedPhotoUrl = u.publicUrl;
    }
  } catch(e) { console.error('photo upload error:', e); }
}

// Mostra/nasconde l'overlay di caricamento
function _showScanLoading(show) {
  const el = document.getElementById('scan-loading');
  if (el) el.classList.toggle('on', show);
}

// Modal rate limit — overlay in-app
// isPrem=true quando è un Premium ad aver esaurito le 100 scansioni mensili:
// in quel caso non ha senso mostrargli il pitch "passa a Premium".
function _showScanLimitModal(isPrem) {
  const modal = document.getElementById('scan-limit-modal');
  if (!modal) return;
  const title = modal.querySelector('.scan-limit-title');
  const desc  = modal.querySelector('.scan-limit-desc');
  const sep   = modal.querySelector('.scan-limit-sep');
  const label = modal.querySelector('.scan-limit-label');
  const feats = modal.querySelector('.scan-limit-features');
  const cta   = modal.querySelector('.btn-gold');
  if (isPrem) {
    if (title) title.textContent = 'Scansioni del mese terminate';
    if (desc)  desc.innerHTML = 'Hai usato le <strong>100 scansioni sommelier</strong> incluse in Premium questo mese. Si rinnovano il 1° del mese prossimo.';
    [sep, label, feats, cta].forEach(el => { if (el) el.style.display = 'none'; });
  } else {
    if (title) title.textContent = 'Scansioni gratuite terminate';
    if (desc)  desc.innerHTML = 'Hai usato le <strong>3 scansioni gratuite</strong> di questo mese. Si rinnovano il 1° del mese prossimo.';
    [sep, label, feats, cta].forEach(el => { if (el) el.style.display = ''; });
  }
  modal.classList.add('on');
}
function closeScanLimitModal() {
  const modal = document.getElementById('scan-limit-modal');
  if (modal) modal.classList.remove('on');
}

// Mostra la pagina risultato scansione
function _showScanResultPage(result, photoDataUrl) {
  _renderScanResult(result, photoDataUrl);
  // Nasconde il cestino (visibile solo se aperto dallo storico)
  _currentHistoryIdx = null;
  const btn = document.getElementById('scan-result-delete-btn');
  const spacer = document.getElementById('scan-result-topbar-spacer');
  if (btn) btn.style.display = 'none';
  if (spacer) spacer.style.display = '';
  go('v-scan-result');
}

// Costruisce l'HTML della pagina risultato
function _renderScanResult(result, photoDataUrl) {
  const container = document.getElementById('scan-result-content');
  if (!container) return;

  if (result.is_bottle === false) {
    container.innerHTML = _buildInvalidScanHTML(photoDataUrl);
    return;
  }

  const isChampagne = result.is_champagne !== false;
  const b      = result.matched_bottle || {};
  const maison = result.maison || b.maison?.nome || '—';
  const cuvee  = result.cuvee  || b.nome         || '—';
  const annata = result.is_sa ? 'Sans Année' : (result.annata || b.annata || null);
  // Titolo completo: cuvée + annata (per i millesimati l'anno è sempre nel titolo).
  // Le bottiglie già in catalogo hanno spesso l'anno scritto dentro il nome stesso
  // (es. "Cristal 2010") — non aggiungerlo di nuovo se è già alla fine del nome.
  const cuveeAlreadyHasYear = annata && String(cuvee).trim().endsWith(String(annata));
  const cuveeTitle = cuvee + (!result.is_sa && annata && !cuveeAlreadyHasYear ? ' ' + annata : '');
  const dosage = result.dosage || b.dosaggio_tipo || null;
  const tipo   = result.tipo   || b.tipo          || null;
  const photo  = photoDataUrl || b.foto_url || result.uploaded_photo_url || '';
  const score  = result.score_medio != null ? result.score_medio : (b.score_medio ?? null);
  const noteDeg    = result.note_degustazione || b.note_degustazione || '';
  const abbinamento = result.abbinamento || b.abbinamento || '';
  const finestra_da = result.finestra_da || b.finestra_da || null;
  const finestra_a  = result.finestra_a  || b.finestra_a  || null;
  const isMillesimato = result.is_millesimato ?? b.is_millesimato ?? false;
  const finestraConsMin = result.finestra_consumo_min_anni ?? b.finestra_consumo_min_anni ?? null;
  const finestraConsMax = result.finestra_consumo_max_anni ?? b.finestra_consumo_max_anni ?? null;
  // Scheda tecnica fields
  const pctChardonnay  = result.pct_chardonnay  ?? b.pct_chardonnay  ?? null;
  const pctPinotNoir   = result.pct_pinot_noir   ?? b.pct_pinot_noir   ?? null;
  const pctMeunier     = result.pct_meunier      ?? b.pct_meunier      ?? null;
  const provenienzaUve = result.provenienza_uve  ?? b.provenienza_uve  ?? null;
  const vinificazione  = result.vinificazione    ?? b.vinificazione    ?? null;
  const malolattica    = result.malolattica      ?? b.malolattica      ?? null;
  const maturazioneMesi= result.maturazione_mesi ?? b.maturazione_mesi ?? null;
  const prodBottiglie  = result.produzione_bottiglie ?? b.produzione_bottiglie ?? null;
  const dosaggioGl     = result.dosaggio_gl      ?? b.dosaggio_gl     ?? null;
  const prezzoMin      = result.prezzo_min       ?? b.prezzo_min      ?? null;
  const prezzoMax      = result.prezzo_max       ?? b.prezzo_max      ?? null;
  const fascia         = result.fascia_prezzo    ?? b.fascia_prezzo   ?? null;
  const assemblaggio   = result.assemblaggio     ?? b.assemblaggio    ?? null;

  // Badge fonte scansione (catalogo/AI): nota interna, visibile solo per admin
  const badge = !isAdmin() ? '' : (result.is_in_catalog
    ? '<span class="scan-badge scan-badge-catalog"><i class="ti ti-check" style="font-size:11px;"></i>Nel catalogo Cuvée</span>'
    : '<span class="scan-badge scan-badge-ai"><i class="ti ti-sparkles" style="font-size:11px;"></i>Rilevato da scansione</span>');

  let pills = '';
  if (annata) pills += '<span class="scan-pill scan-pill-gold">' + annata + '</span>';
  if (dosage) pills += '<span class="scan-pill">' + dosage + '</span>';
  if (tipo)   pills += '<span class="scan-pill">' + tipo   + '</span>';
  if (result.prestige) pills += '<span class="scan-pill scan-pill-gold">✦ Prestige</span>';

  const priceHtml = (prezzoMin || fascia)
    ? '<div style="margin-top:10px;">'
        + priceScale(fascia, prezzoMin)
        + (prezzoMin
            ? '<div style="font-family:var(--sans);font-size:12px;color:var(--ink-4);margin-top:3px;">'
                + 'da <b style="color:var(--gold);">' + prezzoMin + '€</b>'
                + (prezzoMax ? ' – <b style="color:var(--gold);">' + prezzoMax + '€</b>' : '')
                + ' <span style="color:var(--ink-4);font-size:11px;">(Italia, 75cl)</span>'
              + '</div>'
            : '')
      + '</div>'
    : '';

  // Foto verticale sinistra
  const photoHtml = photo
    ? '<img src="' + photo + '" style="width:100%;height:100%;object-fit:cover;display:block;" onerror="this.parentElement.style.background=\'#1E1208\';this.style.display=\'none\'">'
    : '<svg width="40" height="40" viewBox="0 0 512 512" fill="rgba(200,160,58,.22)"><path fill-rule="evenodd" clip-rule="evenodd" d="M217.6,0 L294.4,0 L294.4,76.8 C294.4,256 371.2,217.6 371.2,396.8 L371.2,512 L140.8,512 L140.8,396.8 C140.8,217.6 217.6,256 217.6,76.8 Z M335.057,240.943 L256,320 L176.943,240.943 L176.943,258.943 L256,338 L335.057,258.943 Z M204.8,396.8 L307.2,396.8 L307.2,435.2 L204.8,435.2 Z"/></svg>';

  // Score ring — allineato a sinistra come il testo
  const scoreSmHtml = score ? (function() {
    const deg = Math.round((score / 100) * 360);
    return '<div style="display:inline-flex;flex-direction:column;align-items:flex-start;flex-shrink:0;margin-top:10px;">' +
      '<div class="score-ring-sm" style="background:conic-gradient(var(--gold) ' + deg + 'deg,var(--border) 0deg);">' +
        '<div class="score-ring-sm-inner"><span class="score-num-sm">' + score + '</span></div>' +
      '</div>' +
      '<div class="score-label-sm">' + scoreLabel(score) + '</div>' +
    '</div>';
  })() : '';

  // Finestra di degustazione
  const finestraHtml = isMillesimato
    ? buildFinestraHTML(finestra_da, finestra_a)
    : buildFinestraSAHTML(finestraConsMin, finestraConsMax);

  // ── Card azioni: due card se in catalogo, una sola se non in catalogo ──
  const actionCards = result.is_in_catalog && result.matched_bottle_id
    // Bottiglia in catalogo → due card affiancate
    ? '<div style="margin:16px 14px 4px;display:grid;grid-template-columns:1fr 1fr;gap:10px;">'
        // Card: Scheda completa
        + '<div onclick="openBottigliaFromScan()" style="background:var(--ivory-2);border:1px solid var(--border);border-radius:var(--radius-lg);padding:16px 12px 18px;text-align:center;cursor:pointer;-webkit-tap-highlight-color:transparent;">'
          + '<i class="ti ti-book-2" style="font-size:26px;color:var(--gold);display:block;margin-bottom:10px;"></i>'
          + '<div style="font-family:var(--sans);font-size:13px;font-weight:600;color:var(--ink);margin-bottom:4px;">Scheda completa</div>'
          + '<div style="font-family:var(--sans);font-size:11px;color:var(--ink-4);line-height:1.5;">Note, abbinamenti<br>e storia</div>'
        + '</div>'
        // Card: Aggiungi al Carnet
        + '<div onclick="addToCarnetFromScan()" style="position:relative;background:#1E1208;border-radius:var(--radius-lg);padding:16px 12px 18px;text-align:center;cursor:pointer;-webkit-tap-highlight-color:transparent;">'
          + '<span style="position:absolute;top:-9px;right:-9px;width:20px;height:20px;border-radius:50%;background:#C8A03A;color:#1E1208;border:2px solid var(--ivory);font-family:var(--sans);font-size:11px;font-weight:800;display:flex;align-items:center;justify-content:center;line-height:1;">+</span>'
          + '<i class="ti ti-notebook" style="font-size:26px;color:#C8A03A;display:block;margin-bottom:10px;"></i>'
          + '<div style="font-family:var(--sans);font-size:13px;font-weight:600;color:#C8A03A;margin-bottom:4px;">Aggiungi al Carnet</div>'
          + '<div style="font-family:var(--sans);font-size:11px;color:rgba(200,160,58,.55);line-height:1.5;">Salva note<br>e degustazione</div>'
        + '</div>'
      + '</div>'
    // Bottiglia non in catalogo → card "L'hai assaggiata?" classica
    : '<div style="margin:16px 14px 4px;background:var(--ivory-2);border:1px solid var(--border);border-radius:var(--radius-lg);padding:18px 18px 20px;text-align:center;">'
        + '<div style="font-family:var(--serif);font-size:20px;color:var(--ink-2);font-style:italic;font-weight:600;margin-bottom:14px;">L\'hai assaggiata?</div>'
        + '<button onclick="addToCarnetFromScan()" style="position:relative;width:100%;background:#1E1208;border:2px solid var(--ivory);border-radius:12px;box-shadow:0 -3px 14px rgba(30,18,8,.16),0 3px 10px rgba(30,18,8,.18);padding:13px 20px;font-family:var(--sans);font-size:15px;font-weight:500;color:#C8A03A;display:flex;align-items:center;justify-content:center;gap:8px;cursor:pointer;box-sizing:border-box;">'
          + '<span style="position:absolute;top:-9px;right:-9px;width:20px;height:20px;border-radius:50%;background:#C8A03A;color:#1E1208;border:2px solid var(--ivory);font-family:var(--sans);font-size:11px;font-weight:800;display:flex;align-items:center;justify-content:center;line-height:1;">+</span>'
          + '<i class="ti ti-notebook" style="font-size:17px;"></i> Aggiungi al Carnet'
        + '</button>'
      + '</div>';

  container.innerHTML =
    // ── Layout: foto verticale sx + info dx ──
    '<div style="display:flex;gap:14px;padding:16px 14px 0;align-items:flex-start;">'
      + '<div style="width:40%;max-width:150px;border-radius:12px;overflow:hidden;background:#1E1208;aspect-ratio:2/3;flex-shrink:0;display:flex;align-items:center;justify-content:center;' + (photo ? 'cursor:pointer;' : '') + '"' + (photo ? " onclick=\"openLightbox(['" + photo + "'],0)\"" : '') + '>'
        + photoHtml
      + '</div>'
      + '<div style="flex:1;min-width:0;">'
        + badge
        + '<div style="font-family:var(--sans);font-size:10px;color:var(--ink-4);letter-spacing:1.4px;text-transform:uppercase;margin:7px 0 3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + maison + '</div>'
        + '<div style="font-family:var(--serif);font-size:21px;color:var(--ink);font-weight:500;line-height:1.2;margin-bottom:8px;">' + cuveeTitle + '</div>'
        + '<div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:8px;">' + pills + '</div>'
        + priceHtml
        + scoreSmHtml
      + '</div>'
    + '</div>'
    // ── Card azioni (scheda completa + carnet, o solo carnet) ──
    + actionCards
    // ── Note di degustazione ──
    + (noteDeg ? '<div class="form-section" style="margin:14px 14px 0;">'
        + '<div class="form-section-title"><i class="ti ti-notes"></i> Note di degustazione</div>'
        + '<div style="font-family:var(--sans);font-size:14px;color:var(--ink-3);line-height:1.7;margin-top:8px;">' + noteDeg + '</div>'
      + '</div>' : '')
    // ── Abbinamento ──
    + (abbinamento ? '<div class="form-section" style="margin:14px 14px 0;">'
        + '<div class="form-section-title"><i class="ti ti-chef-hat"></i> Abbinamento</div>'
        + '<div style="font-family:var(--sans);font-size:14px;color:var(--ink-3);line-height:1.7;margin-top:8px;">' + abbinamento + '</div>'
      + '</div>' : '')
    // ── Assemblaggio (vini di base) ──
    + (function(){
        const ribbon = buildAssemblaggioHTML(assemblaggio);
        if (!ribbon) return '';
        return '<div class="form-section" style="margin:14px 14px 0;">'
          + '<div class="form-section-title"><i class="ti ti-chart-bar"></i> Vini di base</div>'
          + '<div style="margin-top:10px;">' + ribbon + '</div>'
        + '</div>';
      })()
    // ── Scheda tecnica ──
    + (function(){
        const inner = buildSchedaTecnicaHTML({
          maison: maison !== '—' ? maison : null,
          pctPinotNoir, pctChardonnay, pctMeunier,
          dosaggioGl, dosaggioTipo: dosage,
          maturazioneMesi, provenienzaUve, vinificazione, malolattica,
          produzioneBottiglie: prodBottiglie,
        });
        if (!inner) return '';
        return '<div class="form-section" style="margin:14px 14px 0;">'
          + '<div class="form-section-title"><i class="ti ti-list-details"></i> Scheda tecnica</div>'
          + '<div style="margin-top:10px;">' + inner + '</div>'
        + '</div>';
      })()
    // ── Finestra ──
    + (finestraHtml ? '<div style="margin-top:14px;">' + finestraHtml + '</div>' : '')
    // ── Debug: sorgente risultato (solo admin) ──
    + (function() {
        if (!isAdmin()) return '';
        const fromCache = result.from_cache === true;
        const icon  = fromCache ? 'ti-database' : 'ti-sparkles';
        const color = fromCache ? '#22c55e' : '#C8A03A';
        const bg    = fromCache ? 'rgba(34,197,94,.07)' : 'rgba(200,160,58,.07)';
        const border= fromCache ? 'rgba(34,197,94,.2)'  : 'rgba(200,160,58,.2)';
        const label = fromCache
          ? '✓ Bottiglia trovata nel database — risultati dal catalogo'
          : '✦ Scansione nuova — analisi AI in tempo reale';
        return '<div style="margin:16px 14px 0;padding:12px 14px;background:' + bg + ';border:1px solid ' + border + ';border-radius:10px;display:flex;align-items:center;gap:10px;">'
          + '<i class="ti ' + icon + '" style="font-size:16px;color:' + color + ';flex-shrink:0;"></i>'
          + '<span style="font-family:var(--sans);font-size:12px;color:' + color + ';line-height:1.4;">' + label + '</span>'
          + '</div>';
      })()
    + '<div style="height:30px;"></div>';

  if (!isChampagne) _showNotChampagneModal(result.not_champagne_type);
}

// Popup "ti abbiamo beccato" — mostrato sopra il risultato scansione quando
// la bottiglia non è Champagne, prima di rivelare l'analisi (identica a quella Champagne).
function _showNotChampagneModal(notChampagneType) {
  const modal = document.getElementById('scan-not-champagne-modal');
  if (!modal) return;
  const typeEl = document.getElementById('scan-not-champagne-type');
  if (typeEl) typeEl.textContent = notChampagneType || 'un altro vino';
  modal.classList.add('on');
}
function closeNotChampagneModal() {
  const modal = document.getElementById('scan-not-champagne-modal');
  if (modal) modal.classList.remove('on');
}

// ═══ ELIMINAZIONE ACCOUNT ═══
// Testo del modale differenziato: chi ha un Premium attivo deve sapere che lo
// perde insieme a tutto il resto, senza rimborso dei giorni/mesi residui.
const DELETE_ACCOUNT_EDGE_URL = 'https://wlfxgbmffvhuqmqjiuqo.supabase.co/functions/v1/delete-account';

function openDeleteAccountModal() {
  if (!currentUser) return;
  const desc = document.getElementById('delete-account-desc');
  const ack  = document.getElementById('delete-account-ack');
  const btn  = document.getElementById('delete-account-confirm-btn');
  if (ack) ack.checked = false;
  if (btn) { btn.disabled = true; btn.classList.remove('ready'); btn.textContent = 'Elimina definitivamente'; }
  if (desc) {
    desc.innerHTML = isPremium()
      ? 'Hai un <strong>abbonamento Premium attivo</strong>: eliminando l\'account lo perderai insieme a tutto il resto — <strong>nessun rimborso</strong> per i giorni o mesi già pagati e non ancora utilizzati. Perderai anche Storico scansioni, Carnet de dégustation e tutte le foto caricate. L\'operazione non può essere annullata.'
      : 'Perderai per sempre lo Storico scansioni, il Carnet de dégustation e tutte le foto caricate. L\'operazione non può essere annullata.';
  }
  const modal = document.getElementById('delete-account-modal');
  if (modal) modal.classList.add('on');
}
function closeDeleteAccountModal() {
  const modal = document.getElementById('delete-account-modal');
  if (modal) modal.classList.remove('on');
}
function _toggleDeleteAccountBtn() {
  const ack = document.getElementById('delete-account-ack');
  const btn = document.getElementById('delete-account-confirm-btn');
  if (!ack || !btn) return;
  btn.disabled = !ack.checked;
  btn.classList.toggle('ready', ack.checked);
}
async function confirmDeleteAccount() {
  const ack = document.getElementById('delete-account-ack');
  const btn = document.getElementById('delete-account-confirm-btn');
  if (!ack?.checked || !currentUser) return;

  btn.disabled = true;
  btn.textContent = 'Eliminazione in corso...';

  try {
    const { data: sessionData } = await supa.auth.getSession();
    const token = sessionData?.session?.access_token;
    if (!token) throw new Error('Sessione non valida');

    const resp = await fetch(DELETE_ACCOUNT_EDGE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
    });
    const result = await resp.json().catch(() => ({}));
    if (!resp.ok || result.error) throw new Error(result?.error || 'Errore durante l\'eliminazione');

    closeDeleteAccountModal();
    currentUser = null;
    await supa.auth.signOut();
    go('v-splash');
    alert('Il tuo account e tutti i tuoi dati sono stati eliminati definitivamente.');
  } catch(e) {
    console.log('Delete account error:', e);
    btn.disabled = false;
    btn.textContent = 'Elimina definitivamente';
    alert('Non è stato possibile eliminare l\'account. Riprova tra qualche istante.\n' + (e.message || ''));
  }
}

// HTML per scan non valido (non è una bottiglia)
function _buildInvalidScanHTML(photoDataUrl) {
  const photoHtml = photoDataUrl
    ? '<div style="width:100px;flex-shrink:0;border-radius:12px;overflow:hidden;background:#1E1208;aspect-ratio:2/3;display:flex;align-items:center;justify-content:center;opacity:.5;cursor:pointer;" onclick="openLightbox([\'' + photoDataUrl + '\'],0)">'
        + '<img src="' + photoDataUrl + '" style="width:100%;height:100%;object-fit:cover;">'
      + '</div>'
    : '';
  return '<div style="padding:24px 14px 0;">'
    + '<div style="display:flex;gap:14px;align-items:flex-start;margin-bottom:20px;">'
      + photoHtml
      + '<div style="flex:1;min-width:0;">'
        + '<div style="display:inline-flex;align-items:center;gap:5px;background:rgba(100,100,100,.10);border:0.5px solid rgba(100,100,100,.25);border-radius:20px;padding:3px 9px;margin-bottom:10px;">'
          + '<span style="font-family:var(--sans);font-size:11px;font-weight:500;color:var(--ink-4);letter-spacing:.3px;">Scansione non valida</span>'
        + '</div>'
        + '<div style="font-family:var(--serif);font-size:22px;color:var(--ink);font-weight:600;font-style:italic;line-height:1.2;margin-bottom:8px;">'
          + 'Mmm, qui non vedo nessuna bottiglia…'
        + '</div>'
        + '<div style="font-family:var(--sans);font-size:13px;color:var(--ink-3);line-height:1.6;">'
          + 'Cuvée riconosce solo bottiglie e bevande. Punta la fotocamera su una bottiglia e riprova!'
        + '</div>'
      + '</div>'
    + '</div>'
    + '<div style="padding:16px 18px;background:var(--ivory-2);border:1px solid var(--border);border-radius:var(--radius-lg);margin-bottom:18px;">'
      + '<div style="font-family:var(--serif);font-size:17px;color:var(--ink);font-style:italic;font-weight:600;margin-bottom:6px;">Solo bottiglie, per favore 🍾</div>'
      + '<div style="font-family:var(--sans);font-size:14px;color:var(--ink-3);line-height:1.7;">'
        + 'Questa app è dedicata al mondo delle bollicine — inquadra una bottiglia di Champagne, vino o qualsiasi bevanda per iniziare.'
      + '</div>'
    + '</div>'
    + '<button class="btn-outline" onclick="startScan(\'explore\')" style="width:100%;">'
      + '<i class="ti ti-camera"></i> Riprova la scansione'
    + '</button>'
  + '</div><div style="height:30px;"></div>';
}

// Apre la scheda completa della bottiglia trovata in DB durante una scansione
// Delega a openSavedBottiglia che: fetch completo → aggiorna allBottiglie → apre dettaglio
function openBottigliaFromScan() {
  if (!_scanResult || !_scanResult.matched_bottle_id) return;
  openSavedBottiglia(_scanResult.matched_bottle_id);
}

// Pre-compila il form carnet dai dati scan e ci va direttamente
function _fillCarnetFromScan(result, photoDataUrl) {
  resetPhotoStrip();
  const b = result.matched_bottle || {};

  // Campi testo
  const fields = {
    'note-maison': result.maison || b.maison?.nome || '',
    'note-cuvee':  result.cuvee  || b.nome         || '',
    'note-annata': result.is_sa  ? 'SA' : (result.annata || b.annata || ''),
    'note-dosage': result.dosage || b.dosaggio_tipo || '',
  };
  Object.entries(fields).forEach(([id, val]) => {
    const el = document.getElementById(id);
    if (el && val) el.value = val;
  });
  // Reset sboccatura, aromi custom, imposta data a oggi
  const _sbocc = document.getElementById('note-sboccatura');
  if (_sbocc) _sbocc.value = '';
  const _cust = document.getElementById('note-aromi-custom');
  if (_cust) _cust.value = '';
  const _dateFill = document.getElementById('note-data-deg');
  if (_dateFill) _dateFill.value = new Date().toISOString().split('T')[0];

  // Tipo chips — mappa AI tipo → chip value
  const tipoMap = {
    'blanc de blancs': 'blanc_de_blancs',
    'blanc de noirs':  'blanc_de_noirs',
    'rosé':            'rose',
  };
  _noteTypes = [];
  if (result.is_sa)                          _noteTypes.push('nv');
  else if (result.annata || b.annata)        _noteTypes.push('millesimato');
  const mappedTipo = result.tipo ? (tipoMap[result.tipo] || null) : null;
  if (mappedTipo && !_noteTypes.includes(mappedTipo)) _noteTypes.push(mappedTipo);
  if (result.dosage === 'Brut Nature')       _noteTypes.push('nature');
  if (result.prestige)                       _noteTypes.push('prestige');
  _syncTipoChips();

  // Foto: usa uploaded_photo_url se disponibile (già salvata nel catalogo), altrimenti dataUrl locale
  const photoToAdd = result.uploaded_photo_url || photoDataUrl;
  if (photoToAdd) {
    if (photoToAdd.startsWith('http')) {
      _existingPhotoUrls.push(photoToAdd);
    } else {
      // Converte dataUrl in Blob reale per poterla caricare su storage
      fetch(photoToAdd)
        .then(r => r.blob())
        .then(blob => {
          _pendingPhotos.push({ id: Date.now(), dataUrl: photoToAdd, blob, ext: 'jpg' });
          renderPhotoStrip();
        })
        .catch(() => {
          // Fallback: usa dataUrl direttamente
          _pendingPhotos.push({ id: Date.now(), dataUrl: photoToAdd, blob: null, ext: 'jpg' });
          renderPhotoStrip();
        });
    }
  }

  go('v-carnet-new');
  requestAnimationFrame(() => { initAllSliders(5); renderPhotoStrip(); });
}

// Chiamato dal bottone "Aggiungi al Carnet" nella pagina risultato
function addToCarnetFromScan(result) {
  result = result || _scanResult;
  if (!result) return;
  window._pendingScanResult = result;
  _fillCarnetFromScan(result, _scanPhotoDataUrl);
}

