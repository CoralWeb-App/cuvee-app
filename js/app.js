
const stack=[];
function go(id){
  // Viste protette: richiedono login
  const protectedViews = ['v-home','v-guida','v-maison','v-carnet','v-profile',
    'v-detail','v-carnet-new','v-carnet-detail','v-salvati','v-wishlist',
    'v-bottiglie','v-bottiglia-detail',
    'v-subscription','v-paywall',
    'v-zone-montagne','v-zone-blancs','v-zone-marne','v-zone-bar','v-zone-sezanne'];
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
  if(id==='v-home') updatePremiumUI();
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
  if(id==='v-maison') loadAndRenderMaison();
  if(id==='v-bottiglie') loadAndRenderBottiglie();
  if(id==='v-salvati') updateSalvatiUI();
  if(id==='v-subscription') loadSubscriptionScreen();
  if(id==='v-wishlist') updateWishlistUI();
  // Aggiorna tab attivo nella bottom nav condivisa
  updateBottomNav(id);
}
function updateBottomNav(id){
  // View senza bottom nav (login, paywall, ecc.)
  const noNav = ['v-splash','v-paywall'];
  const nav = document.getElementById('shared-bottom-nav');
  if(nav) nav.style.display = noNav.includes(id) ? 'none' : 'flex';

  const map = {
    'bn-home':       ['v-home'],
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
  go('v-guida');
  setTimeout(function(){
    let el=document.querySelector('#v-guida .tab[data-tab="'+tab+'"]');
    if(!el){
      document.querySelectorAll('#v-guida .tab').forEach(function(t){
        if(t.getAttribute('onclick')&&t.getAttribute('onclick').indexOf("'"+tab+"'")>-1)el=t;
      });
    }
    if(el)swTab(el,tab);
  },80);
}
const onbData=[
  {title:'Il mondo dello Champagne, tutto in un posto',sub:'Dalle grandi Maison ai piccoli vigneron — ogni bottiglia racconta una storia unica. Scoprila.',loc:'Côte des Blancs · Francia',img:'Vendemmia manuale · Côte des Blancs',btn:'Continua'},
  {title:'400+ produttori, ogni cuvée catalogata',sub:"Sfoglia l'archivio più completo d'Italia. Filtra per stile, zona, uvaggio. Trova la bottiglia perfetta.",loc:'Cave · Reims',img:'Cantine di affinamento · Reims',btn:'Continua'},
  {title:'Impara, esplora, acquista',sub:'Glossario completo, guida al metodo champenoise e link ai migliori rivenditori italiani.',loc:'Degustazione · Épernay',img:'Degustazione professionale · Épernay',btn:'Inizia gratis'},
];
let onbIdx=0;
function onbNext(){
  onbIdx++;
  if(onbIdx>=onbData.length){go('v-reg');onbIdx=0;return;}
  const d=onbData[onbIdx];
  document.getElementById('onb-title').textContent=d.title;
  document.getElementById('onb-sub').textContent=d.sub;
  document.getElementById('onb-loc').textContent=d.loc;
  document.getElementById('onb-img-label').textContent=d.img;
  document.getElementById('onb-btn').textContent=d.btn;
  [0,1,2].forEach(i=>document.getElementById('od'+i).classList.toggle('on',i===onbIdx));
}
function swTab(el,tab){
  document.querySelectorAll('#v-guida .tab').forEach(t=>t.classList.remove('on'));
  el.classList.add('on');
  document.querySelectorAll('.tab-content').forEach(tc=>tc.classList.remove('on'));
  document.getElementById('tc-'+tab).classList.add('on');
  if(tab==='glossario') loadGlossario();
  const scrollEl = document.querySelector('#v-guida .scroll');
  if(scrollEl) scrollEl.scrollTop = 0;
}

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
        return '<div class="card" style="padding:13px 14px;margin-bottom:8px;' + (locked ? 'opacity:.5;' : '') + '">' +
          '<div style="font-family:var(--sans);font-size:15px;color:var(--ink);font-weight:500;margin-bottom:4px;display:flex;justify-content:space-between;align-items:center;">' +
            '<span>' + t.termine + '</span>' +
            (locked ? '<i class="ti ti-lock" style="font-size:15px;color:var(--gold);flex-shrink:0;margin-left:8px;"></i>' : '') +
          '</div>' +
          '<div style="font-family:var(--sans);font-size:14px;color:var(--ink-3);line-height:1.65;">' +
            (locked ? 'Contenuto disponibile con Piano Premium.' : t.definizione) +
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
  ['note-maison','note-cuvee','note-annata','note-dosage','note-luogo','note-text','note-prezzo'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  document.querySelectorAll('.aromi-pill').forEach(p => p.classList.remove('on'));
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
  ['note-maison','note-cuvee','note-annata','note-dosage','note-luogo','note-text','note-prezzo'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  document.querySelectorAll('.aromi-pill').forEach(p => p.classList.remove('on'));
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
    aromi: Array.from(document.querySelectorAll('.aromi-pill.on')).map(el => el.textContent),
    data_degustazione: new Date().toISOString().split('T')[0],
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
    result = await saveCarnetNote(nota);
  }

  if (saveBtn) { saveBtn.textContent = 'Salva nel Carnet'; saveBtn.disabled = false; }
  if (result) {
    // Reset form
    currentEditId = null;
    currentRating = 0;
    const hiddenIdReset = document.getElementById('edit-note-id');
    if (hiddenIdReset) hiddenIdReset.value = '';
    resetPhotoStrip();
    go('v-carnet');
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

// Controlla sessione all avvio
async function initAuth() {
  try {
    const { data: { session } } = await supa.auth.getSession();
    if (session) {
      currentUser = session.user;
      loadUserProfile().catch(e => console.log('Init profile load:', e));
      go('v-home');
    }
    // else rimane sulla splash
  } catch(e) {
    console.log('Auth init error:', e);
  }
}

// Ascolta cambiamenti auth
supa.auth.onAuthStateChange(async (event, session) => {
  if (event === 'SIGNED_IN' && session) {
    stopVerifyPolling();
    currentUser = session.user;
    loadUserProfile().catch(e => console.log('Auth profile load:', e));
    go('v-home');
  } else if (event === 'SIGNED_OUT') {
    stopVerifyPolling();
    currentUser = null;
    go('v-splash');
  }
});

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

  btn.textContent = 'Registrazione in corso...';
  btn.disabled = true;
  errEl.style.display = 'none';

  try {
    const { data, error } = await supa.auth.signUp({
      email,
      password,
      options: { data: { full_name: name } }
    });
    if (error) throw error;

    // Caso 1: conferma email disabilitata → session attiva subito
    if (data.session) {
      currentUser = data.session.user;
      loadUserProfile().catch(e => console.log('Profile load:', e));
      go('v-home');
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

// SOCIAL LOGIN
async function signInWithProvider(provider) {
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
  const { error } = await supa.auth.resetPasswordForEmail(email);
  if (!error) alert('Email di reset inviata! Controlla la tua casella.');
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

  // Email profilo
  const emailEl = document.getElementById('profile-email');
  if (emailEl) emailEl.textContent = email;

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

async function updateCarnetUI() {
  if (!currentUser) return;
  const notes = await loadCarnetNotes();
  const emptyEl = document.getElementById('carnet-empty');
  const listEl = document.getElementById('carnet-notes-list');
  const premBanner = document.getElementById('carnet-premium-banner');
  const countEl = document.getElementById('carnet-note-count');

  if (!listEl) return;

  if (notes.length === 0) {
    if (emptyEl) emptyEl.style.display = 'block';
    listEl.style.display = 'none';
    // Mostra banner premium anche a 0 note per utenti free
    const isPremEmpty = currentUser?.profile?.is_premium;
    if (premBanner) premBanner.style.display = !isPremEmpty ? 'block' : 'none';
    return;
  }

  // Hide empty state, show list
  if (emptyEl) emptyEl.style.display = 'none';
  listEl.style.display = 'block';

  // Render notes
  // Store notes globally for detail access
  // Rendering handled by renderCarnetNotes()

  // Show premium banner if at limit and not premium
  const isPrem = currentUser?.profile?.is_premium;
  if (!isPrem && notes.length >= 3) {
    if (premBanner) premBanner.style.display = 'block';
    if (countEl) countEl.textContent = notes.length;
  }

  // Update profile counts
  // fav/wish counts updated separately via loadSalvati/loadWishlist
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

// Aggiorna il pulsante logout nel profilo
document.addEventListener('DOMContentLoaded', function() {
  const logoutBtn = document.querySelector('#v-profile .btn-outline');
  if (logoutBtn) logoutBtn.onclick = signOut;
  initAuth();
  loadHomeCounts();
});

async function loadHomeCounts() {
  const elP = document.getElementById('home-count-produttori');
  const elC = document.getElementById('home-count-champagne');
  try {
    const [{ data: dp }, { data: dc }] = await Promise.all([
      supa.from('maison').select('id').eq('is_published', true),
      supa.from('bottiglie').select('id').eq('is_published', true)
    ]);
    if (elP) elP.textContent = (dp?.length || 0) + ' produttori';
    if (elC) elC.textContent = (dc?.length || 0) + ' cuvée';
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
    : '<i class="ti ti-bottle" style="font-size:40px;color:rgba(184,146,42,.28);"></i>';

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
  if (note.luogo)         detRows.push({icon:'ti-map-pin', label:'Luogo',        val: note.luogo});
  if (note.prezzo_pagato) detRows.push({icon:'ti-coin',    label:'Prezzo pagato',val: '€ '+note.prezzo_pagato});

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

  container.innerHTML = html;
  go('v-carnet-detail');
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

    return '<div class="maison-card" onclick="openSavedMaison(\'' + m.id + '\')" style="margin:0 14px 12px;">' +
      '<div class="img-ph maison-card-ph" style="height:80px;">' +
      (m.foto_url
        ? '<img src="' + m.foto_url + '" style="width:100%;height:100%;object-fit:cover;"/>'
        : '<i class="ti ti-photo" style="font-size:22px;"></i>'
      ) +
      '</div>' +
      '<div class="maison-body">' +
      '<div class="maison-header-row">' +
      '<div class="maison-name">' + m.nome + '</div>' +
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
      '<div class="bottle-ph"><i class="ti ti-bottle"></i></div>' +
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
  return (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
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
      .select('*, maison(nome, slug)')
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

async function _execHomeSearch(q) {
  const results = document.getElementById('home-search-results');
  results.innerHTML = '<div class="home-search-empty">Ricerca in corso…</div>';
  const cat = homeSearchCat;
  const ql = normalizeStr(q); // normalizzato: senza accenti, lowercase

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
      normalizeStr(m.nome).includes(ql) ||
      normalizeStr(m.sede).includes(ql)
    ).slice(0, 6);
    if (res.length > 0) {
      const tipoBadge = { 'NM':'badge-gm','RM':'badge-rm','RC':'badge-rm','CM':'badge-bio','SR':'badge-rm','ND':'badge-pres','MA':'badge-pres' };
      html += '<div class="home-search-section">Produttori</div>';
      html += res.map(m => {
        const anno = m.anno_fondazione ? 'dal ' + m.anno_fondazione : '';
        const sub = [m.sede, anno].filter(Boolean).join(' · ');
        const zonaColor = m.zone?.colore || 'var(--gold)';
        const zonaNome = m.zone?.nome || '';
        const foto = m.foto_url
          ? '<img src="' + m.foto_url + '" style="width:100%;height:100%;object-fit:cover;"/>'
          : '<i class="ti ti-building" style="font-size:20px;color:var(--ink-5);"></i>';
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
      normalizeStr(b.nome).includes(ql) ||
      normalizeStr(b.maison?.nome).includes(ql)
    ).slice(0, 8);
    if (res.length > 0) {
      html += '<div class="home-search-section">Champagne</div>';
      html += res.map(b => {
        const foto = b.foto_url
          ? '<img src="' + b.foto_url + '" style="width:100%;height:100%;object-fit:cover;"/>'
          : '<i class="ti ti-bottle" style="font-size:22px;color:var(--ink-5);"></i>';
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
      normalizeStr(t.termine).includes(ql) ||
      normalizeStr(t.definizione).includes(ql)
    ).slice(0, 6);
    if (res.length > 0) {
      const livelloBadge = { base:'badge-rm', avanzato:'badge-pres', premium:'badge-prem' };
      html += '<div class="home-search-section">Glossario</div>';
      html += res.map(t =>
        '<div class="card" style="padding:12px 14px;margin-bottom:8px;">' +
          '<div style="font-family:var(--sans);font-size:15px;font-weight:500;color:var(--ink);margin-bottom:4px;">' + t.termine + '</div>' +
          '<div style="font-family:var(--sans);font-size:13px;color:var(--ink-3);line-height:1.55;">' + t.definizione + '</div>' +
          '<span class="badge ' + (livelloBadge[t.livello]||'badge-rm') + '" style="margin-top:7px;">' + (t.livello||'base') + '</span>' +
        '</div>'
      ).join('');
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

  // Set aromi
  document.querySelectorAll('.aromi-pill').forEach(pill => {
    pill.classList.toggle('on', (note.aromi || []).includes(pill.textContent));
  });

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
  const countEl = document.getElementById('carnet-note-count');
  const isPrem = currentUser?.profile?.is_premium;
  if (notes.length === 0) {
    if (emptyEl) emptyEl.style.display = 'block';
    document.getElementById('carnet-notes-list').style.display = 'none';
    if (premBanner) premBanner.style.display = !isPrem ? 'block' : 'none';
  } else {
    if (emptyEl) emptyEl.style.display = 'none';
    document.getElementById('carnet-notes-list').style.display = 'block';
    if (!isPrem && notes.length >= 3) {
      if (premBanner) premBanner.style.display = 'block';
      if (countEl) countEl.textContent = notes.length;
    } else {
      if (premBanner) premBanner.style.display = 'none';
    }
  }
}

function renderCarnetNotes(notes) {
  const listEl = document.getElementById('carnet-notes-list');
  if (!listEl) return;

  // Apply filters
  let filtered = notes;
  if (activeCaliceFilter > 0) {
    filtered = filtered.filter(n => (n.rating || 0) === activeCaliceFilter);
  }
  if (activeTypeFilter && activeTypeFilter !== 'tutti') {
    filtered = filtered.filter(n => inferTipoNota(n).includes(activeTypeFilter));
  }
  if (activeSearchQuery) {
    const q = activeSearchQuery.toLowerCase();
    filtered = filtered.filter(n =>
      (n.maison_nome || '').toLowerCase().includes(q) ||
      (n.cuvee_nome || '').toLowerCase().includes(q)
    );
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

    return '<div class="carnet-note-card" data-idx="'+origIdx+'" onclick="openNoteDetail(window._carnetNotes[this.dataset.idx])">'+
      '<div class="cnc-img">'+
        (note.foto_url
          ? '<img src="'+note.foto_url+'" style="width:100%;height:100%;object-fit:cover;"/>'
          : '<div class="cnc-img-ph"><i class="ti ti-bottle"></i></div>')+
        (tipoLabel ? '<span class="cnc-tipo">'+tipoLabel+'</span>' : '')+
        (note.annata ? '<span class="cnc-annata">'+note.annata+'</span>' : '')+
      '</div>'+
      '<div class="cnc-body">'+
        '<div class="cnc-maison">'+(note.maison_nome||'&nbsp;')+'</div>'+
        '<div class="cnc-cuvee">'+(note.cuvee_nome||'')+'</div>'+
        '<div class="cnc-footer">'+
          '<div class="cnc-glasses">'+glasses+'</div>'+
          '<div class="cnc-date">'+date+'</div>'+
        '</div>'+
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



// ═══ TEST PREMIUM (rimuovere quando Stripe è attivo) ═══
async function activateTestPremium() {
  if (!currentUser) { go('v-login'); return; }

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
}



// ═══ SCHERMATA ABBONAMENTO ═══

async function loadSubscriptionScreen() {
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
    const prices = { annual: '3,99€/mese', monthly: '5,99€/mese', test: '—' };
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
  if (!confirm('Sei sicuro di voler disdire il Premium?')) return;
  // TEST MODE: disattiva subito
  // In produzione con Stripe: imposta cancel_at_period_end=true
  // e lascia is_premium=true fino a premium_until (l'utente mantiene l'accesso)
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

  // Insert before save button
  const saveBtn = document.getElementById('save-note-btn');
  if (saveBtn) saveBtn.parentElement.insertBefore(err, saveBtn);

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

    if (countEl) countEl.textContent = allMaison.length + '+ produttori · Champagne';
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
      normalizeStr(m.nome).includes(q) ||
      normalizeStr(m.sede_comune).includes(q) ||
      normalizeStr(m.descrizione).includes(q) ||
      normalizeStr(m.chef_de_cave).includes(q) ||
      normalizeStr(m.tipo).includes(q) ||
      normalizeStr(tipoLabelM[m.tipo]).includes(q) ||
      normalizeStr(m.zone?.nome).includes(q)
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

  const premium = isPremium();
  const isFav = (id) => maisonFavorites.has(id);

  listEl.innerHTML = filtered.map(m => {
    const isLocked = !m.is_free && !premium;
    const badge = tipoBadge[m.tipo] || 'badge-rm';
    const categoria = tipoCategoria[m.tipo] || null;
    const label = m.tipo || '—';
    const fav = isFav(m.id);
    const zonaNome = m.zone?.nome || '';
    const meta = '';

    return '<div class="maison-card' + (isLocked ? ' locked' : '') + '" data-id="' + m.id + '" onclick="' + (isLocked ? "go('v-paywall')" : "openMaisonDetail('" + m.id + "')") + '">' +
      '<div class="img-ph maison-card-ph" style="height:90px;">' +
        (m.foto_url ? '<img src="' + m.foto_url + '" style="width:100%;height:100%;object-fit:cover;"/>' : '<i class="ti ti-photo" style="font-size:22px;"></i>') +
        (isLocked ? '<div class="lock-over"><i class="ti ti-lock"></i>Premium</div>' : '') +
      '</div>' +
      '<div class="maison-body">' +
        '<div class="maison-header-row">' +
          '<div class="maison-name">' + m.nome + '</div>' +
          '<div style="display:flex;align-items:center;gap:8px;">' +
            (!isLocked ? '<i class="ti ' + (fav ? 'ti-heart-filled' : 'ti-heart') + ' maison-heart" style="' + (fav ? 'color:var(--gold);' : '') + '" data-id="' + m.id + '" onclick="event.stopPropagation();toggleMaisonFavorite(this,this.dataset.id)"></i>' : '') +
          '</div>' +
        '</div>' +
        '<div class="maison-card-zona">' +
          (m.zone ? '<span class="zona-badge-sm" style="background:' + (m.zone.colore||'#b8922a') + '18;color:' + (m.zone.colore||'#b8922a') + ';border:0.5px solid ' + (m.zone.colore||'#b8922a') + '55;">' + (m.zone.nome||'') + '</span>' : '') +
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
  }).join('');
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
      hero.innerHTML = '<img src="' + m.foto_url + '" style="width:100%;height:200px;object-fit:cover;"/>';
      hero.className = '';
    } else {
      hero.className = 'img-ph detail-hero-ph';
      hero.innerHTML = '<i class="ti ti-photo" style="font-size:36px;"></i><span>' + m.nome + '</span>';
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
    const rows = [
      { l:'Fondazione', v: m.anno_fondazione },
      { l:'Tipo', v: m.tipo ? m.tipo + ' — ' + (tipoLabel[m.tipo]||'') : null },
      { l:'Zona', v: zonaNome || null },
      { l:'Sede', v: [m.sede_comune, m.sede_regione].filter(Boolean).join(', ') || null },
      { l:'Indirizzo', v: m.sede_indirizzo || null },
      { l:'Chef de cave', v: m.chef_de_cave || null },
      { l:'Direzione', v: m.direzione || null },
      { l:'Proprietà', v: m.proprieta || null },
      { l:'Gruppo', v: m.gruppo || null },
    ].filter(r => r.v);
    schedaEl.innerHTML = rows.map(r =>
      '<div class="detail-row"><span class="detail-row-label">' + r.l + '</span><span class="detail-row-value">' + r.v + '</span></div>'
    ).join('');
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
        html += '<div class="detail-row"><span class="detail-row-label">Ettari</span><span class="detail-row-value">' + ettariVal + '</span></div>';
      }
      if (m.comuni_vigneti && m.comuni_vigneti.length) {
        html += '<div class="detail-row"><span class="detail-row-label">Comuni</span><span class="detail-row-value">' + m.comuni_vigneti.join(', ') + '</span></div>';
      }
      const uvaggi = [
        { name:'Pinot Noir', pct: m.pct_pinot_noir },
        { name:'Chardonnay', pct: m.pct_chardonnay },
        { name:'Pinot Meunier', pct: m.pct_meunier }
      ].filter(u => u.pct > 0);
      if (uvaggi.length) {
        html += '<div style="margin-top:14px;">';
        uvaggi.forEach(u => {
          html += '<div class="uvaggio-item">' +
            '<div class="uvaggio-head"><span>' + u.name + '</span><span>' + u.pct + '%</span></div>' +
            '<div class="uvaggio-track"><div class="uvaggio-fill" style="width:' + u.pct + '%"></div></div>' +
          '</div>';
        });
        html += '</div>';
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
    const rows = [
      { l:'Vinificazione', v: m.vinificazione || null },
      { l:'Malolattica', v: m.malolattica || null },
      { l:'Tipo di pressa', v: m.tipo_pressa || null },
      { l:'Vins de réserve', v: m.vins_de_reserve || null },
      { l:'Liqueur d\'expédition', v: m.liqueur_expedition || null },
      { l:'Produzione annua', v: m.produzione_bottiglie ? m.produzione_bottiglie.toLocaleString('it') + ' bott.' : null },
      { l:'Stock in cantina', v: m.stock_cantina ? m.stock_cantina.toLocaleString('it') + ' bott.' : null },
    ].filter(r => r.v);
    prodSection.style.display = rows.length ? 'block' : 'none';
    prodEl.innerHTML = rows.map(r =>
      '<div class="detail-row"><span class="detail-row-label">' + r.l + '</span><span class="detail-row-value">' + r.v + '</span></div>'
    ).join('');
  }

  // Distribuzione & contatti
  const distribSection = document.getElementById('detail-distribuzione-section');
  const distribEl = document.getElementById('detail-distribuzione');
  if (distribSection && distribEl) {
    let html = '';
    if (m.importatore_italia) html += '<div class="detail-row"><span class="detail-row-label">In Italia</span><span class="detail-row-value">' + m.importatore_italia + '</span></div>';
    if (m.telefono) html += '<div class="detail-row"><span class="detail-row-label">Telefono</span><span class="detail-row-value"><a class="detail-link" href="tel:' + m.telefono + '">' + m.telefono + '</a></span></div>';
    if (m.sito_web) {
      const url = m.sito_web.startsWith('http') ? m.sito_web : 'https://' + m.sito_web;
      html += '<div class="detail-row"><span class="detail-row-label">Sito web</span><span class="detail-row-value"><a class="detail-link" href="' + url + '" target="_blank" onclick="event.stopPropagation()">' + m.sito_web + '</a></span></div>';
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
      .order('is_featured', { ascending: false })
      .order('nome', { ascending: true });

    const subtitleEl = document.getElementById('detail-cuvee-subtitle');
    if (!bottles || bottles.length === 0) {
      listEl.innerHTML = '<div style="padding:0 18px 16px;font-family:var(--sans);font-size:15px;color:var(--ink-4);">Catalogo in aggiornamento.</div>';
      if (lockEl) lockEl.style.display = 'none';
      if (subtitleEl) subtitleEl.textContent = 'Catalogo in aggiornamento';
      return;
    }
    if (subtitleEl) subtitleEl.textContent = bottles.length + (bottles.length === 1 ? ' cuvée nel catalogo' : ' cuvée nel catalogo');
    const premium = isPremium();
    const visible = premium ? bottles : bottles.slice(0, 2);
    const locked = premium ? [] : bottles.slice(2);
    const tipoLabel = {'nv':'Sans Année','millesimato':'Millésimé','prestige':'Prestige Cuvée','blanc_de_blancs':'Blanc de Blancs','blanc_de_noirs':'Blanc de Noirs','rose':'Rosé','nature':'Brut Nature'};
    listEl.innerHTML = visible.map(b => {
      const tipo = tipoLabel[b.tipo] || b.tipo || '';
      const meta = [tipo, b.dosaggio_tipo].filter(Boolean).join(' · ');
      const prezzo = b.prezzo_min ? 'da ' + b.prezzo_min + '€' : (b.fascia_prezzo || '');
      return '<div class="bottle-row" onclick="openBottigliaDetail(\'' + b.id + '\')" style="cursor:pointer;">' +
        '<div class="bottle-ph"><i class="ti ti-bottle"></i></div>' +
        '<div class="bottle-info">' +
          '<div class="bottle-name">' + b.nome + '</div>' +
          '<div class="bottle-type">' + meta + '</div>' +
          (prezzo ? '<div class="bottle-price" style="font-family:var(--sans);font-size:13px;color:var(--gold);margin-top:2px;">' + prezzo + '</div>' : '') +
        '</div>' +
        (b.score_medio ? '<div style="font-family:var(--serif);font-size:18px;color:var(--gold);font-weight:600;flex-shrink:0;">' + b.score_medio + '</div>' : '') +
      '</div>';
    }).join('');
    if (lockEl) {
      if (locked.length > 0) {
        lockEl.style.display = 'flex';
        lockEl.querySelector('p').innerHTML = '<strong>' + locked.length + ' cuvées</strong> disponibili con Piano Premium.';
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
      .select('*, maison(nome, slug)')
      .eq('is_published', true)
      .eq('needs_review', false)
      .order('nome', { ascending: true });
    if (error) throw error;
    allBottiglie = data || [];
    if (currentUser) {
      const { data: wish } = await supa.from('wishlist').select('bottiglia_id').eq('user_id', currentUser.id);
      wishlistIds = new Set((wish || []).map(w => w.bottiglia_id));
    }
    if (countEl) countEl.textContent = allBottiglie.length + ' cuvée nel catalogo';
    if (loadingEl) loadingEl.style.display = 'none';
    if (listEl) listEl.style.display = 'block';
    buildBottLetterFilters();
    renderBottiglie();
  } catch(e) {
    console.log('loadBottiglie error:', e);
    if (loadingEl) loadingEl.innerHTML = '<div style="padding:20px;text-align:center;font-family:var(--sans);font-size:15px;color:var(--ink-4);">Errore caricamento. Riprova.</div>';
  }
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

  if (currentBottLetter !== 'tutti') filtered = filtered.filter(b => bottInitial(b.nome) === currentBottLetter);

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
      normalizeStr(b.nome).includes(q) ||
      normalizeStr(b.maison?.nome).includes(q) ||
      normalizeStr(b.descrizione).includes(q) ||
      normalizeStr(b.dosaggio_tipo).includes(q) ||
      normalizeStr(tipoLabelB[b.tipo]).includes(q) ||
      (b.annata ? String(b.annata) : '').includes(q)
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
  listEl.innerHTML = filtered.map(b => {
    const tipo = tipoLabel[b.tipo] || b.tipo || '';
    return '<div class="bott-card" onclick="openBottigliaDetail(\'' + b.id + '\')">' +
      '<div class="bott-card-img" style="min-height:88px;">' +
        (b.foto_url ? '<img src="' + b.foto_url + '"/>' : '<i class="ti ti-bottle"></i>') +
      '</div>' +
      '<div class="bott-card-body">' +
        '<div class="bott-card-maison">' + (b.maison?.nome || '') + '</div>' +
        '<div class="bott-card-nome">' + b.nome + '</div>' +
        '<div class="bott-card-tipo" style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">' +
          (tipo ? '<span>' + tipo + '</span>' : '') +
          dosagePill(b.dosaggio_tipo) +
        '</div>' +
        '<div class="bott-card-footer">' +
          '<div class="bott-card-info">' +
            (b.score_medio ? scoreRingCard(b.score_medio) : '') +
            ((b.fascia_prezzo || b.prezzo_min) ? '<div style="display:flex;flex-direction:column;gap:2px;">' +
              priceScale(b.fascia_prezzo, b.prezzo_min) +
              (b.prezzo_min ? '<span style="font-family:var(--sans);font-size:11px;color:var(--ink-4);">da ' + b.prezzo_min + '€</span>' : '') +
            '</div>' : '') +
          '</div>' +
          '<button class="bott-card-add" data-id="' + b.id + '" onclick="event.stopPropagation();openNewNoteFromBottiglia(this.dataset.id)">' +
            '<span class="bott-card-add-badge">+</span>' +
            '<i class="ti ti-notebook"></i>' +
          '</button>' +
        '</div>' +
      '</div>' +
    '</div>';
  }).join('');
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

  // Colori per distinguere annate vs riserva
  const colors = ['#b8922a','#c4a855','#7a6234','#9a7a3a','#d4b06a'];
  let colorIdx = 0;

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

  // Card per ogni componente
  const cards = items.map(item => {
    const isRiserva = !item.anno;
    const label = item.anno
      ? String(item.anno)
      : (item.tipo === 'riserva' ? 'Riserva' : (item.label || 'Base'));
    const perc  = item.perc || 0;
    const color = isRiserva ? '#c4b49a' : colors[colorIdx++ % colors.length];
    const percColor = perc > 0 ? 'var(--gold)' : 'var(--ink-4)';

    return '<div style="background:var(--ivory-2);border:1px solid var(--border);border-top:3px solid ' + color + ';'
      + 'border-radius:8px;padding:10px 8px;text-align:center;flex:1;min-width:62px;max-width:90px;">'
      + '<div style="font-family:var(--serif);font-size:13px;color:var(--ink-2);font-weight:600;margin-bottom:5px;">' + label + '</div>'
      + '<div style="font-family:var(--sans);font-size:15px;font-weight:700;color:' + percColor + ';">' + perc + '%</div>'
      + '</div>';
  }).join('');

  el.innerHTML = '<div style="display:flex;gap:8px;padding:0 18px 16px;flex-wrap:wrap;">' + cards + '</div>'
    + '<div class="assembl-divider"></div>';
}

function bottDetailPhotoClick() {
  if (window._bottDetailPhotoUrl) openLightbox([window._bottDetailPhotoUrl], 0);
}

async function openBottigliaDetail(bottId) {
  const b = allBottiglie.find(x => x.id === bottId) || currentBottiglia;
  if (!b) return;
  currentBottiglia = b;
  const tipoLabel = {'nv':'Sans Année','millesimato':'Millésimé','prestige':'Prestige Cuvée','blanc_de_blancs':'Blanc de Blancs','blanc_de_noirs':'Blanc de Noirs','rose':'Rosé','nature':'Brut Nature'};

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
      hero.style.cursor   = 'default';
      hero.innerHTML = '<i class="ti ti-bottle" style="font-size:40px;color:rgba(200,160,58,.22);"></i>';
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
  const tipoEl = document.getElementById('bott-detail-tipo');
  if (tipoEl) tipoEl.textContent = [tipoLabel[b.tipo]||b.tipo, b.dosaggio_tipo].filter(Boolean).join(' · ');

  // Badges
  const badgesEl = document.getElementById('bott-detail-badges');
  if (badgesEl) {
    let bdg = '';
    if (b.dosaggio_tipo) bdg += dosagePill(b.dosaggio_tipo) + ' ';
    if (b.fascia_prezzo || b.prezzo_min) bdg += priceScale(b.fascia_prezzo, b.prezzo_min);
    if (b.prezzo_min && b.prezzo_max) bdg += '<span style="font-family:var(--sans);font-size:13px;color:var(--ink-4);margin-left:6px;">da ' + b.prezzo_min + '€</span>';
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

  // Finestra degustazione — timeline con marker "adesso"
  const finSection = document.getElementById('bott-detail-finestra-section');
  if (finSection) {
    if (b.finestra_da || b.finestra_a) {
      finSection.style.display = 'block';
      const now  = new Date().getFullYear();
      const from = b.finestra_da || now;
      const to   = b.finestra_a  || (now + 10);
      // Span totale track: 2 anni prima di from → 2 anni dopo to
      const trackFrom = from - 2;
      const trackTo   = to   + 2;
      const trackSpan = trackTo - trackFrom;
      const toPercent = v => Math.max(0, Math.min(100, Math.round(((v - trackFrom) / trackSpan) * 100)));

      const fillEl  = document.getElementById('bott-finestra-fill');
      const nowEl   = document.getElementById('bott-finestra-now');
      const daEl    = document.getElementById('bott-finestra-da');
      const aEl     = document.getElementById('bott-finestra-a');
      const statoEl = document.getElementById('bott-finestra-stato');

      if (fillEl) { fillEl.style.left = toPercent(from) + '%'; fillEl.style.width = (toPercent(to) - toPercent(from)) + '%'; }
      if (nowEl)  nowEl.style.left = toPercent(now) + '%';
      if (daEl)   daEl.textContent  = from;
      if (aEl)    aEl.textContent   = to;

      // Stato corrente
      let stato = '';
      if (now < from)      stato = 'Da aprire nel ' + from;
      else if (now <= to)  stato = now === from ? 'Appena pronta' : (now >= to - 1 ? 'In declino' : '● Ottimale ora');
      else                 stato = 'Oltre la finestra';
      if (statoEl) { statoEl.textContent = stato; statoEl.style.color = (now >= from && now <= to) ? 'var(--gold)' : 'var(--ink-4)'; }
    } else { finSection.style.display = 'none'; }
  }

  // Note degustazione
  const noteEl = document.getElementById('bott-detail-note');
  if (noteEl) noteEl.textContent = b.note_degustazione || '';

  // Scheda tecnica
  // Assemblaggio vini di base
  renderAssemblaggio(b);

  const schedaEl = document.getElementById('bott-detail-scheda');
  if (schedaEl) {
    const uvaggi = [b.pct_pinot_noir ? b.pct_pinot_noir + '% Pinot Noir' : null, b.pct_chardonnay ? b.pct_chardonnay + '% Chardonnay' : null, b.pct_meunier ? b.pct_meunier + '% Meunier' : null].filter(Boolean).join(' · ');
    // Mostra vini_base come testo solo se non c'è assemblaggio strutturato
    const hasAssembl = (b.assemblaggio && b.assemblaggio.length) || !!b.annata;
    const rows = [
      { l:'Produttore', v: b.maison?.nome || null },
      { l:'Uvaggi', v: uvaggi || null },
      { l:'Dosaggio', v: b.dosaggio_gl != null ? b.dosaggio_gl + ' g/l — ' + (b.dosaggio_tipo||'') : (b.dosaggio_tipo||null) },
      { l:'Provenienza uve', v: b.provenienza_uve || null },
      { l:'Note assemblaggio', v: !hasAssembl ? (b.vini_base || null) : null },
      { l:'Vinificazione', v: b.vinificazione || null },
      { l:'Malolattica', v: b.malolattica || null },
      { l:'Maturazione sui lieviti', v: b.maturazione_mesi ? b.maturazione_mesi + ' mesi' : null },
      { l:'Produzione', v: b.produzione_bottiglie ? b.produzione_bottiglie.toLocaleString('it') + ' bott.' : null },
    ].filter(r => r.v);
    schedaEl.innerHTML = rows.map(r =>
      '<div class="detail-row"><span class="detail-row-label">' + r.l + '</span><span class="detail-row-value">' + r.v + '</span></div>'
    ).join('');
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
    const hasAnyLink = links.some(l => l.url);

    const rows = links.map((l, i) => {
      const isLast  = i === links.length - 1;
      const hasLink = !!l.url;
      const logoEl  = l.favicon
        ? '<img src="' + l.favicon + '" onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'flex\'" style="width:24px;height:24px;object-fit:contain;" alt=""><i class="ti ti-bottle" style="display:none;font-size:18px;color:var(--gold);"></i>'
        : '<i class="ti ti-link" style="font-size:18px;color:var(--gold);"></i>';
      return '<a '
        + (hasLink ? 'href="' + l.url + '" target="_blank"' : 'href="javascript:void(0)"')
        + ' class="buy-row' + (hasLink ? '' : ' buy-row-empty') + '"'
        + (isLast ? ' style="border-bottom:none;' + (hasLink ? '' : 'opacity:.45') + '"' : (!hasLink ? ' style="opacity:.45"' : ''))
        + '>'
        + '<div class="buy-logo">' + logoEl + '</div>'
        + '<div class="buy-info"><div class="buy-name">' + l.name + '</div><div class="buy-desc">' + l.desc + '</div></div>'
        + (hasLink ? '<i class="ti ti-chevron-right buy-arrow"></i>' : '<i class="ti ti-minus" style="color:var(--ink-5);font-size:12px;margin-right:2px;"></i>')
        + '</a>';
    }).join('');

    buySection.innerHTML =
      '<div style="font-family:var(--sans);font-size:10px;letter-spacing:1.5px;color:var(--gold);text-transform:uppercase;font-weight:600;margin-bottom:10px;">'
      + '<i class="ti ti-shopping-bag" style="font-size:10px;margin-right:5px;"></i>Dove acquistare'
      + '</div>'
      + '<div style="background:var(--ivory-2);border:1px solid var(--border);border-radius:var(--radius-lg);overflow:hidden;">'
      + rows
      + '</div>'
      + (!hasAnyLink
          ? '<div style="font-family:var(--sans);font-size:10px;color:var(--ink-5);text-align:center;margin-top:8px;line-height:1.5;">I link di acquisto verranno personalizzati per ogni bottiglia</div>'
          : '');
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
function startScan(mode) {
  if (!currentUser) { go('v-login'); return; }
  const input = document.getElementById('scan-input');
  if (!input) return;
  input.setAttribute('data-scan-mode', mode || 'explore');
  input.click();
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
      _showScanLimitModal();
      return;
    }
    if (!resp.ok || result.error) {
      _showScanLoading(false);
      alert('Errore durante la scansione. Riprova.\n' + (result?.message || result?.error || ''));
      return;
    }

    _scanResult = result;
    // Log debug errors from Edge Function (DB insert / storage)
    if (result._debug) console.warn('scan _debug:', result._debug);
    _showScanLoading(false);

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
function _showScanLimitModal() {
  const modal = document.getElementById('scan-limit-modal');
  if (modal) modal.classList.add('on');
}
function closeScanLimitModal() {
  const modal = document.getElementById('scan-limit-modal');
  if (modal) modal.classList.remove('on');
}

// Mostra la pagina risultato scansione
function _showScanResultPage(result, photoDataUrl) {
  _renderScanResult(result, photoDataUrl);
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

  if (!result.is_champagne) {
    container.innerHTML = _buildNonChampagneHTML(result, photoDataUrl);
    return;
  }

  const b      = result.matched_bottle || {};
  const maison = result.maison || b.maison?.nome || '—';
  const cuvee  = result.cuvee  || b.nome         || '—';
  const annata = result.is_sa ? 'Sans Année' : (result.annata || b.annata || null);
  // Titolo completo: cuvée + annata (per i millesimati l'anno è sempre nel titolo)
  const cuveeTitle = cuvee + (!result.is_sa && annata ? ' ' + annata : '');
  const dosage = result.dosage || b.dosaggio_tipo || null;
  const tipo   = result.tipo   || b.tipo          || null;
  const photo  = b.foto_url || result.uploaded_photo_url || photoDataUrl || '';
  const score  = result.score_medio != null ? result.score_medio : (b.score_medio ?? null);
  const noteDeg    = result.note_degustazione || b.note_degustazione || '';
  const abbinamento = result.abbinamento || b.abbinamento || '';
  const finestra_da = result.finestra_da || b.finestra_da || null;
  const finestra_a  = result.finestra_a  || b.finestra_a  || null;
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

  const badge = result.is_in_catalog
    ? '<span class="scan-badge scan-badge-catalog"><i class="ti ti-check" style="font-size:11px;"></i>Nel catalogo Cuvée</span>'
    : '<span class="scan-badge scan-badge-ai"><i class="ti ti-sparkles" style="font-size:11px;"></i>Rilevato da scansione</span>';

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
    : '<i class="ti ti-bottle" style="font-size:40px;color:rgba(200,160,58,.22);"></i>';

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
  let finestraHtml = '';
  if (finestra_da || finestra_a) {
    const now = new Date().getFullYear();
    const from = finestra_da || now;
    const to   = finestra_a  || (now + 8);
    const span = to - from;
    const elapsed = Math.min(Math.max(now - from, 0), span);
    const pct = span > 0 ? Math.round((elapsed / span) * 100) : 0;
    finestraHtml =
      '<div class="form-section" style="margin:0 14px 14px;">'
      + '<div class="form-section-title"><i class="ti ti-calendar-time"></i> Finestra di degustazione</div>'
      + '<div style="display:flex;align-items:center;gap:10px;margin-top:10px;">'
        + '<span style="font-family:var(--sans);font-size:12px;color:var(--ink-4);">' + from + '</span>'
        + '<div style="flex:1;background:var(--border);border-radius:4px;height:8px;overflow:hidden;">'
          + '<div style="height:100%;background:linear-gradient(90deg,var(--gold-light),var(--gold));border-radius:4px;width:' + pct + '%;"></div>'
        + '</div>'
        + '<span style="font-family:var(--sans);font-size:12px;color:var(--ink-4);">' + to + '</span>'
      + '</div>'
      + '</div>';
  }

  const catalogBtn = result.is_in_catalog && result.matched_bottle_id
    ? '<div style="padding:0 14px 10px;">'
      + '<button class="btn-outline" style="width:100%;display:flex;align-items:center;justify-content:center;gap:7px;" onclick="openBottigliaFromScan()">'
      + '<i class="ti ti-book-2" style="font-size:16px;"></i> Vedi scheda completa</button></div>'
    : '';

  container.innerHTML =
    // ── Layout: foto verticale sx + info dx ──
    '<div style="display:flex;gap:14px;padding:16px 14px 0;align-items:flex-start;">'
      + '<div style="width:40%;max-width:150px;border-radius:12px;overflow:hidden;background:#1E1208;aspect-ratio:2/3;flex-shrink:0;display:flex;align-items:center;justify-content:center;">'
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
    // ── Pulsante scheda completa (solo se bottiglia in catalogo) ──
    + (catalogBtn ? catalogBtn : '')
    // ── "L'hai assaggiata?" card unificata ──
    + '<div style="margin:' + (catalogBtn ? '0' : '16px') + ' 14px 4px;background:var(--ivory-2);border:1px solid var(--border);border-radius:var(--radius-lg);padding:18px 18px 20px;text-align:center;">'
      + '<div style="font-family:var(--serif);font-size:20px;color:var(--ink-2);font-style:italic;font-weight:600;margin-bottom:14px;">L\'hai assaggiata?</div>'
      + '<button onclick="addToCarnetFromScan()" style="position:relative;width:100%;background:#1E1208;border:2px solid var(--ivory);border-radius:12px;box-shadow:0 -3px 14px rgba(30,18,8,.16),0 3px 10px rgba(30,18,8,.18);padding:13px 20px;font-family:var(--sans);font-size:15px;font-weight:500;color:#C8A03A;display:flex;align-items:center;justify-content:center;gap:8px;cursor:pointer;box-sizing:border-box;">'
        + '<span style="position:absolute;top:-9px;right:-9px;width:20px;height:20px;border-radius:50%;background:#C8A03A;color:#1E1208;border:2px solid var(--ivory);font-family:var(--sans);font-size:11px;font-weight:800;display:flex;align-items:center;justify-content:center;line-height:1;">+</span>'
        + '<i class="ti ti-notebook" style="font-size:17px;"></i> Aggiungi al Carnet'
      + '</button>'
    + '</div>'
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
    // ── Assemblaggio ──
    + (function(){
        if (!assemblaggio || !Array.isArray(assemblaggio) || !assemblaggio.length) return '';
        const anni    = assemblaggio.filter(x => x.anno).sort((a,b) => b.anno - a.anno);
        const riserve = assemblaggio.filter(x => x.tipo === 'riserva');
        if (!anni.length && !riserve.length) return '';
        const bars = assemblaggio.map(x => {
          const isRis  = x.tipo === 'riserva';
          const label  = isRis ? (x.label || 'Vins de réserve') : String(x.anno);
          const bg     = isRis ? 'var(--border-2)' : 'var(--gold)';
          const pct    = x.perc || 0;
          return '<div style="margin-bottom:6px;">'
            + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:3px;">'
              + '<span style="font-family:var(--sans);font-size:12px;color:var(--ink-3);">' + label + '</span>'
              + '<span style="font-family:var(--sans);font-size:12px;font-weight:600;color:var(--gold);">' + pct + '%</span>'
            + '</div>'
            + '<div style="height:6px;background:var(--border);border-radius:3px;overflow:hidden;">'
              + '<div style="height:100%;width:' + pct + '%;background:' + bg + ';border-radius:3px;transition:width .4s;"></div>'
            + '</div>'
          + '</div>';
        }).join('');
        return '<div class="form-section" style="margin:14px 14px 0;">'
          + '<div class="form-section-title"><i class="ti ti-chart-bar"></i> Assemblaggio</div>'
          + '<div style="margin-top:10px;">' + bars + '</div>'
        + '</div>';
      })()
    // ── Scheda tecnica ──
    + (function(){
        const uvaggi = [
          pctChardonnay ? pctChardonnay + '% Chardonnay' : null,
          pctPinotNoir  ? pctPinotNoir  + '% Pinot Noir'  : null,
          pctMeunier    ? pctMeunier    + '% Meunier'      : null,
        ].filter(Boolean).join(' · ');
        const dosageLabel = dosaggioGl != null
          ? (dosaggioGl + ' g/l' + (dosage ? ' — ' + dosage : ''))
          : (dosage || null);
        const schedaRows = [
          { l:'Produttore',             v: maison !== '—' ? maison : null },
          { l:'Uvaggi',                 v: uvaggi || null },
          { l:'Dosaggio',               v: dosageLabel },
          { l:'Provenienza uve',        v: provenienzaUve },
          { l:'Vinificazione',          v: vinificazione },
          { l:'Malolattica',            v: malolattica },
          { l:'Maturazione sui lieviti',v: maturazioneMesi ? maturazioneMesi + ' mesi' : null },
          { l:'Produzione',             v: prodBottiglie ? prodBottiglie.toLocaleString('it') + ' bott.' : null },
        ].filter(r => r.v);
        if (!schedaRows.length) return '';
        return '<div class="form-section" style="margin:14px 14px 0;">'
          + '<div class="form-section-title"><i class="ti ti-list-details"></i> Scheda tecnica</div>'
          + '<div style="margin-top:8px;">'
          + schedaRows.map(r =>
              '<div class="detail-row"><span class="detail-row-label">' + r.l + '</span>'
              + '<span class="detail-row-value">' + r.v + '</span></div>'
            ).join('')
          + '</div></div>';
      })()
    // ── Finestra ──
    + (finestraHtml ? '<div style="margin-top:14px;">' + finestraHtml + '</div>' : '')
    // (catalogBtn già mostrato in cima, dopo foto+nome)
    // ── Debug: sorgente risultato ──
    + (function() {
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
}

// HTML per scan non valido (non è una bottiglia)
function _buildInvalidScanHTML(photoDataUrl) {
  const photoHtml = photoDataUrl
    ? '<div style="width:100px;flex-shrink:0;border-radius:12px;overflow:hidden;background:#1E1208;aspect-ratio:2/3;display:flex;align-items:center;justify-content:center;opacity:.5;">'
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

// HTML per bottiglia non Champagne
function _buildNonChampagneHTML(result, photoDataUrl) {
  const tipo        = result.not_champagne_type || 'Bevanda non identificata';
  const maison      = result.maison || '';
  const noteDeg     = result.note_degustazione || '';
  const abbinamento = result.abbinamento || '';
  const pctChardonnay = result.pct_chardonnay ?? null;
  const pctPinotNoir  = result.pct_pinot_noir  ?? null;
  const pctMeunier    = result.pct_meunier     ?? null;
  const dosage        = result.dosage || null;
  const provenienzaUve  = result.provenienza_uve  || null;
  const vinificazione   = result.vinificazione    || null;
  const malolattica     = result.malolattica       || null;
  const maturazioneMesi = result.maturazione_mesi  ?? null;
  const prodBottiglie   = result.produzione_bottiglie ?? null;

  const photoHtml = photoDataUrl
    ? '<div style="width:110px;flex-shrink:0;border-radius:12px;overflow:hidden;background:#1E1208;aspect-ratio:2/3;display:flex;align-items:center;justify-content:center;">'
        + '<img src="' + photoDataUrl + '" style="width:100%;height:100%;object-fit:cover;">'
      + '</div>'
    : '<div style="width:110px;flex-shrink:0;border-radius:12px;background:#1E1208;aspect-ratio:2/3;display:flex;align-items:center;justify-content:center;">'
        + '<i class="ti ti-bottle" style="font-size:32px;color:rgba(200,160,58,.3);"></i>'
      + '</div>';

  // ── Scheda tecnica ──
  const uvaggi = [
    pctChardonnay ? pctChardonnay + '% Chardonnay' : null,
    pctPinotNoir  ? pctPinotNoir  + '% Pinot Noir'  : null,
    pctMeunier    ? pctMeunier    + '% Meunier'      : null,
  ].filter(Boolean).join(' · ');

  const schedaRows = [
    { l:'Produttore',              v: maison || null },
    { l:'Uvaggi',                  v: uvaggi || null },
    { l:'Dosaggio',                v: dosage },
    { l:'Provenienza uve',         v: provenienzaUve },
    { l:'Vinificazione',           v: vinificazione },
    { l:'Malolattica',             v: malolattica },
    { l:'Maturazione sui lieviti', v: maturazioneMesi ? maturazioneMesi + ' mesi' : null },
    { l:'Produzione',              v: prodBottiglie ? prodBottiglie.toLocaleString('it') + ' bott.' : null },
  ].filter(r => r.v);

  const schedaHtml = schedaRows.length
    ? '<div class="form-section" style="margin:14px 14px 0;">'
        + '<div class="form-section-title"><i class="ti ti-list-details"></i> Scheda tecnica</div>'
        + '<div style="margin-top:8px;">'
        + schedaRows.map(r =>
            '<div class="detail-row"><span class="detail-row-label">' + r.l + '</span>'
            + '<span class="detail-row-value">' + r.v + '</span></div>'
          ).join('')
        + '</div></div>'
    : '';

  return '<div style="padding:16px 14px 0;">'
    // ── Blocco 1: foto + header compatto ──
    + '<div style="display:flex;gap:14px;align-items:flex-start;">'
      + photoHtml
      + '<div style="flex:1;min-width:0;">'
        + '<div style="display:inline-flex;align-items:center;gap:5px;background:rgba(180,60,40,.10);border:0.5px solid rgba(180,60,40,.3);border-radius:20px;padding:3px 9px;margin-bottom:8px;">'
          + '<span style="font-family:var(--sans);font-size:11px;font-weight:500;color:#8b2a1a;letter-spacing:.3px;">Non è Champagne AOC</span>'
        + '</div>'
        + '<div style="font-family:var(--serif);font-size:19px;color:var(--ink);font-weight:600;font-style:italic;line-height:1.2;margin-bottom:6px;">Eh eh, t\'abbiamo beccato! 😄</div>'
        + '<div style="font-family:var(--sans);font-size:13px;color:var(--ink-3);line-height:1.5;">' + tipo + '</div>'
      + '</div>'
    + '</div>'
    // ── Blocco 2: card "L'hai assaggiata?" identica a champagne ──
    + '<div style="margin:16px 14px 4px;background:var(--ivory-2);border:1px solid var(--border);border-radius:var(--radius-lg);padding:18px 18px 20px;text-align:center;">'
      + '<div style="font-family:var(--serif);font-size:20px;color:var(--ink-2);font-style:italic;font-weight:600;margin-bottom:14px;">L\'hai assaggiata?</div>'
      + '<button onclick="addToCarnetFromScan(_scanResult)" style="position:relative;width:100%;background:#1E1208;border:2px solid var(--ivory);border-radius:12px;box-shadow:0 -3px 14px rgba(30,18,8,.16),0 3px 10px rgba(30,18,8,.18);padding:13px 20px;font-family:var(--sans);font-size:15px;font-weight:500;color:#C8A03A;display:flex;align-items:center;justify-content:center;gap:8px;cursor:pointer;box-sizing:border-box;">'
        + '<span style="position:absolute;top:-9px;right:-9px;width:20px;height:20px;border-radius:50%;background:#C8A03A;color:#1E1208;border:2px solid var(--ivory);font-family:var(--sans);font-size:11px;font-weight:800;display:flex;align-items:center;justify-content:center;line-height:1;">+</span>'
        + '<i class="ti ti-notebook" style="font-size:17px;"></i> Aggiungi al Carnet'
      + '</button>'
    + '</div>'
    // ── Blocco 3: dettagli scansione ──
    + (noteDeg || abbinamento || schedaRows.length
      ? '<div style="margin:18px 14px 0;padding-bottom:4px;border-top:1px solid var(--border);padding-top:16px;">'
          + '<div style="font-family:var(--sans);font-size:11px;font-weight:600;color:var(--ink-4);letter-spacing:1.2px;text-transform:uppercase;margin-bottom:14px;">Cosa abbiamo trovato</div>'
        + '</div>'
      : '')
    + (noteDeg
      ? '<div class="form-section" style="margin:0 14px;">'
          + '<div class="form-section-title"><i class="ti ti-notes"></i> Note di degustazione</div>'
          + '<div style="font-family:var(--sans);font-size:14px;color:var(--ink-3);line-height:1.7;margin-top:8px;">' + noteDeg + '</div>'
        + '</div>'
      : '')
    + (abbinamento
      ? '<div class="form-section" style="margin:14px 14px 0;">'
          + '<div class="form-section-title"><i class="ti ti-chef-hat"></i> Abbinamento</div>'
          + '<div style="font-family:var(--sans);font-size:14px;color:var(--ink-3);line-height:1.7;margin-top:8px;">' + abbinamento + '</div>'
        + '</div>'
      : '')
    + schedaHtml
    + '<div style="height:30px;"></div>';
}

// Apre la scheda completa della bottiglia trovata in DB durante una scansione
// Recupera tutti i campi dal DB (matched_bottle ha solo un sottoinsieme)
async function openBottigliaFromScan() {
  if (!_scanResult || !_scanResult.matched_bottle_id) return;
  const bottId = _scanResult.matched_bottle_id;
  // Controlla se già caricata in allBottiglie (navigazione catalogo precedente)
  let b = (allBottiglie || []).find(x => x.id === bottId);
  if (!b) {
    // Fetch completo dal DB con tutti i campi
    const { data } = await supa
      .from('bottiglie')
      .select('*, maison:maison_id(id, nome, slug)')
      .eq('id', bottId)
      .single();
    b = data;
  }
  if (!b) return;
  currentBottiglia = b;
  openBottigliaDetail(b.id);
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
  _fillCarnetFromScan(result, _scanPhotoDataUrl);
}

