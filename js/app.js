
const stack=[];
function go(id){
  // Viste protette: richiedono login
  const protectedViews = ['v-home','v-guida','v-maison','v-carnet','v-profile',
    'v-detail','v-carnet-new','v-carnet-detail','v-salvati','v-wishlist',
    'v-bottiglie','v-bottiglia-detail',
    'v-subscription','v-paywall','v-mappa',
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
    const si = document.getElementById('carnet-search');
    if(si) si.value = '';
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
  if(id==='v-mappa') setTimeout(initMapTouch,100);
}
function goBack(){
  if(stack.length>0){
    const p=stack.pop();
    document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));
    const t=document.getElementById(p);
    if(t)t.classList.add('active');
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
}
function togStep(el){
  const body=el.nextElementSibling;
  const chev=el.querySelector('.step-chev');
  const open=body.style.display==='block';
  body.style.display=open?'none':'block';
  chev.classList.toggle('open',!open);
}
function filterGloss(btn,letter){
  document.querySelectorAll('#tc-glossario .f-btn').forEach(b=>b.classList.remove('on'));
  btn.classList.add('on');
  document.querySelectorAll('#tc-glossario [data-g]').forEach(g=>{
    g.style.display=(letter==='tutti'||g.dataset.g===letter)?'block':'none';
  });
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
function checkAndNewNote(){
  currentEditId = null;
  const hiddenId = document.getElementById('edit-note-id');
  if (hiddenId) hiddenId.value = '';
  currentRating = 0;
  // Reset form
  ['note-maison','note-cuvee','note-annata','note-dosage','note-luogo','note-text','note-prezzo'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  document.querySelectorAll('.aromi-pill').forEach(p => p.classList.remove('on'));
  document.querySelectorAll('.rating-star').forEach(s => {
    s.style.opacity = '0.25';
    s.className = 'ti ti-glass-full rating-star';
  });
  const lbl = document.getElementById('rating-label');
  if (lbl) lbl.textContent = 'Tocca per valutare *';
  const photoBox = document.getElementById('photo-box');
  if (photoBox) photoBox.innerHTML = '<i class="ti ti-camera"></i><span>Tocca per aggiungere una foto</span><span style="font-family:var(--sans);font-size:13px;color:var(--ink-5);">Dalla galleria o dalla fotocamera</span>';
  const title = document.querySelector('#v-carnet-new .topbar [style*="font-family:var(--serif)"]');
  if (title) title.textContent = 'Nuova nota';
  const btn = document.getElementById('save-note-btn');
  if (btn) btn.textContent = 'Salva nel Carnet';
  go('v-carnet-new');
}
function setRating(n){
  currentRating=n;
  const labels=['','Deludente','Nella media','Buono','Ottimo','Eccellente — da ricordare!'];
  document.querySelectorAll('.rating-star').forEach((s,i)=>{
    s.className='ti ti-glass-full rating-star' + (i<n?' on':'');
    s.style.color='var(--gold)';
    s.style.opacity=i<n?'1':'0.25';
  });
  const lbl=document.getElementById('rating-label');
  if(lbl)lbl.textContent=labels[n]||'';
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

function waitForCompression(input){
  return Promise.resolve();
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
    acidite: parseInt(document.getElementById('val-acidite')?.textContent) || null,
    effervescence: parseInt(document.getElementById('val-eff')?.textContent) || null,
    complexite: parseInt(document.getElementById('val-comp')?.textContent) || null,
    longueur: parseInt(document.getElementById('val-lung')?.textContent) || null,
    aromi: Array.from(document.querySelectorAll('.aromi-pill.on')).map(el => el.textContent),
    data_degustazione: new Date().toISOString().split('T')[0]
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

  // Upload foto if present (WebP compresso)
  const photoInput = document.getElementById('photo-input');
  if (photoInput && photoInput.files && photoInput.files[0]) {
    try {
      // Usa il blob WebP compresso se disponibile, altrimenti il file originale
      const fileToUpload = photoInput._compressedBlob || photoInput.files[0];
      const ext = photoInput._compressedExt || photoInput.files[0].name.split('.').pop();
      const path = currentUser.id + '/' + Date.now() + '.' + ext;
      console.log('Uploading:', ext.toUpperCase(), Math.round(fileToUpload.size/1024) + 'KB');
      const { data: uploadData, error: uploadError } = await supa.storage
        .from('carnet-photos')
        .upload(path, fileToUpload, {
          upsert: true,
          contentType: photoInput._compressedBlob ? 'image/webp' : fileToUpload.type
        });
      if (!uploadError) {
        const { data: urlData } = supa.storage
          .from('carnet-photos')
          .getPublicUrl(path);
        nota.foto_url = urlData?.publicUrl || null;
        console.log('Foto salvata:', path);
      } else {
        console.log('Upload error:', uploadError);
      }
    } catch(e) {
      console.log('Photo upload error:', e);
    }
  }

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
    currentRating = 0;
    photoInput && (photoInput.value = '');
    const photoBox = document.getElementById('photo-box');
    if (photoBox) photoBox.innerHTML = '<i class="ti ti-camera"></i><span>Tocca per aggiungere una foto</span><span style="font-family:var(--sans);font-size:13px;color:var(--ink-5);">Dalla galleria o dalla fotocamera</span>';
    go('v-carnet');
  }
}
// PWA manifest
const manifest={name:'Cuvée — Guida allo Champagne',short_name:'Cuvée',description:'La guida italiana allo Champagne',start_url:'/',display:'standalone',background_color:'#faf8f5',theme_color:'#faf8f5',orientation:'portrait',icons:[{src:'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 192 192"><rect width="192" height="192" fill="%23faf8f5" rx="40"/><ellipse cx="96" cy="72" rx="32" ry="52" stroke="%23b8922a" stroke-width="4" fill="none"/><line x1="96" y1="124" x2="96" y2="155" stroke="%23b8922a" stroke-width="4"/><line x1="68" y1="155" x2="124" y2="155" stroke="%23b8922a" stroke-width="4"/></svg>',sizes:'192x192',type:'image/svg+xml'}]};
const mblob=new Blob([JSON.stringify(manifest)],{type:'application/json'});
document.querySelector('link[rel="manifest"]').href=URL.createObjectURL(mblob);
// Service Worker
if('serviceWorker' in navigator){
  const sw=`const C='cuvee-v5';self.addEventListener('install',e=>{self.skipWaiting();});self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==C).map(k=>caches.delete(k)))));self.clients.claim();});self.addEventListener('fetch',e=>{if(e.request.mode==='navigate'){e.respondWith(fetch(e.request).catch(()=>caches.match('/')));return;}e.respondWith(fetch(e.request).then(r=>{const rc=r.clone();caches.open(C).then(c=>c.put(e.request,rc));return r;}).catch(()=>caches.match(e.request)));});`;
  navigator.serviceWorker.register(URL.createObjectURL(new Blob([sw],{type:'application/javascript'})));
}


// ═══ MAPPA ═══
// ═══ MAPPA — ZOOM/PAN + INTERAZIONE ═══
(function(){
const CRU = {
  // GRAND CRU Montagne de Reims
  ambonnay:   {name:'Ambonnay',cl:'gc',zona:'montagne',uva:'Pinot Noir',pct:'100%',desc:'Uno dei Grand Cru più pregiati della Champagne. Pinot Noir di struttura eccezionale, longevo e complesso. Riferimento per Egly-Ouriet e per i vins de réserve di Krug.',maison:['Egly-Ouriet','Krug (réserve)','Marie-Noëlle Ledru']},
  bouzy:      {name:'Bouzy',cl:'gc',zona:'montagne',uva:'Pinot Noir',pct:'100%',desc:'Celebre anche per il Bouzy Rouge — raro vino rosso fermo della Champagne. Pinot Noir potente e fruttato, ideale per assemblages importanti.',maison:['Georges Vesselle','Paul Bara','Herbert Beaufort']},
  verzenay:   {name:'Verzenay',cl:'gc',zona:'montagne',uva:'Pinot Noir',pct:'100%',desc:'Esposizione nord unica in Champagne — le uve maturano lentamente producendo acidità vibrante e longevità straordinaria. Sede del Musée de la Vigne.',maison:['Mumm','Louis Roederer','Vilmart & Cie']},
  verzy:      {name:'Verzy',cl:'gc',zona:'montagne',uva:'Pinot Noir',pct:'100%',desc:'Noto per i Faux de Verzy, faggi contorti millenari. Vini austeri e minerali che richiedono anni per esprimersi pienamente.',maison:['Louis Roederer','Cattier','Diebolt-Vallois']},
  louvois:    {name:'Louvois',cl:'gc',zona:'montagne',uva:'Pinot Noir',pct:'100%',desc:'Piccolo Grand Cru spesso sottovalutato con note floreali inusuali. Il Château de Louvois fu residenza di Luigi XIV.',maison:['Deutz','Bollinger (réserve)']},
  beaumont:   {name:'Beaumont-sur-Vesle',cl:'gc',zona:'montagne',uva:'Pinot Noir',pct:'100%',desc:'Grand Cru sul versante est della Montagne. Pinot Noir di grande struttura, utilizzato principalmente per i Non Vintage delle grandi maison.',maison:['Veuve Clicquot','Pommery']},
  sillery:    {name:'Sillery',cl:'gc',zona:'montagne',uva:'Pinot Noir',pct:'100%',desc:'Storico Grand Cru, uno dei più antichi citati nei documenti storici della Champagne. Oggi produzione molto limitata.',maison:['Tattinger','Pommery']},
  puisieulx:  {name:'Puisieulx',cl:'gc',zona:'montagne',uva:'Pinot Noir',pct:'100%',desc:'Il più piccolo Grand Cru della Champagne per superficie. Quasi tutta la produzione va alle grandi maison di Reims.',maison:['Mumm','Lanson']},
  tours:      {name:'Tours-sur-Marne',cl:'gc',zona:'montagne',uva:'Pinot Noir / Chardonnay',pct:'100%',desc:'Grand Cru di confine tra Montagne e Vallée. Unico Grand Cru classificato 100% sia per Pinot Noir che per Chardonnay.',maison:['Laurent-Perrier','Bollinger']},
  // GRAND CRU Côte des Blancs
  avize:      {name:'Avize',cl:'gc',zona:'blancs',uva:'Chardonnay',pct:'100%',desc:'Cuore della Côte des Blancs. Mineralità gessosa intensa e longevità eccezionale. Jacques Selosse ha trasformato Avize in un nome di culto mondiale.',maison:['Jacques Selosse','Deutz','Taittinger']},
  cramant:    {name:'Cramant',cl:'gc',zona:'blancs',uva:'Chardonnay',pct:'100%',desc:'Chardonnay floreale e agrumato, con bollicine finissime. Il Comtes de Champagne di Taittinger proviene in parte da Cramant.',maison:['Taittinger','Mumm de Cramant','Bonnaire']},
  mesnil:     {name:'Le Mesnil-sur-Oger',cl:'gc',zona:'blancs',uva:'Chardonnay',pct:'100%',desc:'Il Grand Cru più famoso della Côte des Blancs. I Blanc de Blancs più longevi al mondo. Qui nasce il Clos du Mesnil di Krug e il leggendario Salon.',maison:['Salon','Krug (Clos du Mesnil)','Pierre Péters']},
  oger:       {name:'Oger',cl:'gc',zona:'blancs',uva:'Chardonnay',pct:'100%',desc:'Chardonnay più morbido e fruttato rispetto al Mesnil, con note di pesca bianca e fiori. Bellissima chiesa romanica nel villaggio.',maison:['Billecart-Salmon','Charles Heidsieck']},
  oiry:       {name:'Oiry',cl:'gc',zona:'blancs',uva:'Chardonnay',pct:'100%',desc:'Il più piccolo Grand Cru della Côte des Blancs. Chardonnay di grande freschezza e tensione minerale.',maison:['Pol Roger','Duval-Leroy']},
  chouilly:   {name:'Chouilly',cl:'gc',zona:'blancs',uva:'Chardonnay',pct:'100%',desc:'Grand Cru al confine tra Côte des Blancs e Vallée de la Marne. Chardonnay elegante con buona struttura.',maison:['Nicolas Feuillatte','Moët & Chandon']},
  // PREMIER CRU Montagne
  rilly:      {name:'Rilly-la-Montagne',cl:'pc',zona:'montagne',uva:'Pinot Noir',pct:'94%',desc:'Premier Cru sul versante nord della Montagne. Pinot Noir elegante con buona acidità.',maison:['Duval-Leroy','Forget-Brimont']},
  mailly:     {name:'Mailly-Champagne',cl:'pc',zona:'montagne',uva:'Pinot Noir',pct:'99%',desc:'Quasi Grand Cru (99%). La cooperativa locale Mailly Grand Cru è un riferimento per i Blanc de Noirs.',maison:['Mailly Grand Cru','Pommery']},
  villersmarmery:{name:'Villers-Marmery',cl:'pc',zona:'montagne',uva:'Chardonnay',pct:'95%',desc:'Raro Premier Cru della Montagne con Chardonnay dominante. Vini freschi e minerali.',maison:['Veuve Clicquot','Moët & Chandon']},
  tauxieres:  {name:'Tauxières',cl:'pc',zona:'montagne',uva:'Pinot Noir',pct:'99%',desc:'Premier Cru molto vicino ai Grand Cru di Ambonnay e Bouzy. Pinot Noir di grande struttura.',maison:['Gosset','Paul Bara']},
  trépail:    {name:'Trépail',cl:'pc',zona:'montagne',uva:'Chardonnay',pct:'95%',desc:'Secondo Premier Cru della Montagne con prevalenza Chardonnay. Note di fiori bianchi e frutta gialla.',maison:['Roederer','Taittinger']},
  ludes:      {name:'Ludes',cl:'pc',zona:'montagne',uva:'Pinot Noir',pct:'94%',desc:'Premier Cru sul versante ovest della Montagne. Base importante per i Non Vintage.',maison:['Canard-Duchêne','Forget-Brimont']},
  chigny:     {name:'Chigny-les-Roses',cl:'pc',zona:'montagne',uva:'Pinot Noir',pct:'94%',desc:'Premier Cru noto per la sua Rosé de saignée. Pinot Noir fruttato e aromatico.',maison:['Cattier','Vollereaux']},
  montbré:    {name:'Montbré',cl:'pc',zona:'montagne',uva:'Pinot Noir',pct:'94%',desc:'Piccolo Premier Cru sul versante ovest. Produzione limitata, quasi tutta assorbita dalle grandi maison.',maison:['Piper-Heidsieck','Charles Heidsieck']},
  // PREMIER CRU Vallée de la Marne
  ay:         {name:'Aÿ',cl:'pc',zona:'marne',uva:'Pinot Noir',pct:'100%',desc:'Storica città del vino. Il Clos des Goisses di Philipponnat — uno dei vigneti più straordinari della Champagne — si trova qui. Sede di Bollinger e Deutz.',maison:['Bollinger','Deutz','Philipponnat','Gosset']},
  mareuil:    {name:'Mareuil-sur-Aÿ',cl:'pc',zona:'marne',uva:'Pinot Noir',pct:'99%',desc:'Sede storica di Billecart-Salmon. Pinot Noir setoso ed elegante. Il Clos Saint-Hilaire di Billecart è qui.',maison:['Billecart-Salmon','Philipponnat']},
  hautvillers:{name:'Hautvillers',cl:'pc',zona:'marne',uva:'Pinot Meunier',pct:'90%',desc:'Il villaggio più famoso della Champagne — Dom Pérignon lavorò come cellerier dell\'abbazia nel XVII secolo. Vista spettacolare sulla Vallée.',maison:['Moët & Chandon (abbazia)','Leclerc Briant']},
  dizy:       {name:'Dizy',cl:'pc',zona:'marne',uva:'Pinot Noir',pct:'95%',desc:'Premier Cru adiacente ad Aÿ. Pinot Noir strutturato, usato da Jacquesson per la loro cuvée di punta.',maison:['Jacquesson','Pol Roger']},
  cumieres:   {name:'Cumières',cl:'pc',zona:'marne',uva:'Pinot Meunier',pct:'90%',desc:'Premier Cru noto per il Coteaux Champenois Rouge di Cumières — vino rosso fermo di grande qualità. Sede di Georges Laval.',maison:['Georges Laval','Moët & Chandon']},
  // PREMIER CRU Côte des Blancs
  vertus:     {name:'Vertus',cl:'pc',zona:'blancs',uva:'Chardonnay',pct:'95%',desc:'Premier Cru più a sud della Côte des Blancs. Chardonnay più strutturato. Sede di Larmandier-Bernier, riferimento del vino naturale.',maison:['Larmandier-Bernier','Louis Casters']},
  cuis:       {name:'Cuis',cl:'pc',zona:'blancs',uva:'Chardonnay',pct:'95%',desc:'Premier Cru al confine nord della Côte des Blancs. Chardonnay fresco e agrumato, ottima tensione minerale.',maison:['Pierre Gimonnet','Duval-Leroy']},
  grauves:    {name:'Grauves',cl:'pc',zona:'blancs',uva:'Chardonnay',pct:'95%',desc:'Premier Cru sul versante ovest della Côte des Blancs. Chardonnay elegante con note di fiori bianchi.',maison:['Taittinger','Moët & Chandon']},
  bergeres:   {name:'Bergères-lès-Vertus',cl:'pc',zona:'blancs',uva:'Chardonnay',pct:'95%',desc:'Premier Cru all\'estremità sud della Côte des Blancs. Chardonnay corposo con buona longevità.',maison:['Larmandier-Bernier','Union Champagne']},
};

const ZONA_COLORS = {
  montagne:{c:'#b8922a',bg:'#f5ede0',name:'Montagne de Reims'},
  marne:   {c:'#5DCAA5',bg:'#e0f5ee',name:'Vallée de la Marne'},
  blancs:  {c:'#AFA9EC',bg:'#eeedf9',name:'Côte des Blancs'},
  bar:     {c:'#F0997B',bg:'#fdeee8',name:'Côte des Bar'},
};

// ── ZOOM / PAN ──
let scale=1, tx=0, ty=0;
let isPinch=false, lastDist=0;
let isDrag=false, lastX=0, lastY=0, startX=0, startY=0;
const MIN=0.6, MAX=4;

function applyTransform(s,x,y){
  scale=Math.min(MAX,Math.max(MIN,s));
  tx=x; ty=y;
  document.getElementById('map-stage').style.transform=`translate(${tx}px,${ty}px) scale(${scale})`;
  document.getElementById('map-stage').style.transformOrigin='0 0';
}

function mapReset(){applyTransform(1,0,0);closeCruPanel();}

function initMapTouch(){
  const stage=document.getElementById('map-stage');
  if(!stage)return;

  // Touch pinch zoom + drag
  stage.addEventListener('touchstart',function(e){
    if(e.touches.length===2){
      isPinch=true;
      const dx=e.touches[0].clientX-e.touches[1].clientX;
      const dy=e.touches[0].clientY-e.touches[1].clientY;
      lastDist=Math.hypot(dx,dy);
    } else if(e.touches.length===1){
      isDrag=true;
      lastX=e.touches[0].clientX;
      lastY=e.touches[0].clientY;
      startX=lastX; startY=lastY;
    }
  },{passive:true});

  stage.addEventListener('touchmove',function(e){
    if(e.touches.length===2&&isPinch){
      e.preventDefault();
      const dx=e.touches[0].clientX-e.touches[1].clientX;
      const dy=e.touches[0].clientY-e.touches[1].clientY;
      const dist=Math.hypot(dx,dy);
      const ds=dist/lastDist;
      applyTransform(scale*ds, tx, ty);
      lastDist=dist;
    } else if(e.touches.length===1&&isDrag){
      const dx=e.touches[0].clientX-lastX;
      const dy=e.touches[0].clientY-lastY;
      applyTransform(scale, tx+dx, ty+dy);
      lastX=e.touches[0].clientX;
      lastY=e.touches[0].clientY;
    }
  },{passive:false});

  stage.addEventListener('touchend',function(e){
    if(e.touches.length<2) isPinch=false;
    if(e.touches.length===0){
      // if barely moved, treat as tap (handled by onclick)
      isDrag=false;
    }
  },{passive:true});

  // Mouse wheel zoom (desktop)
  stage.addEventListener('wheel',function(e){
    e.preventDefault();
    const ds=e.deltaY<0?1.15:0.87;
    applyTransform(scale*ds,tx,ty);
  },{passive:false});
}

// ── CRU PANEL ──
function showCru(id){
  const c=CRU[id]; if(!c)return;
  const z=ZONA_COLORS[c.zona]||{c:'#b8922a',bg:'#f5ede0',name:''};
  const badgeStyle=c.cl==='gc'
    ?'background:#faeeda;color:#633806;border:0.5px solid #EF9F27;'
    :'background:#e1f5ee;color:#085041;border:0.5px solid #5DCAA5;';
  const clLabel=c.cl==='gc'?'Grand Cru':'Premier Cru';

  const maisonHTML=c.maison.map(m=>`
    <div style="background:#f5f0e8;border:1px solid #ede8e0;border-radius:10px;padding:9px 13px;margin-bottom:7px;display:flex;justify-content:space-between;align-items:center;cursor:pointer;" onclick="go('v-maison')">
      <div style="font-family:DM Sans,sans-serif;font-size:15px;color:#1a1208;font-weight:500;">${m}</div>
      <i class="ti ti-chevron-right" style="font-size:16px;color:#c4b49a;"></i>
    </div>`).join('');

  document.getElementById('cru-panel-body').innerHTML=`
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:5px;">
      <div style="width:10px;height:10px;border-radius:50%;background:${z.c};"></div>
      <span style="font-family:DM Sans,sans-serif;font-size:13px;color:#9a8a72;">${z.name}</span>
    </div>
    <div style="font-family:Cormorant Garamond,serif;font-size:28px;color:#1a1208;font-weight:500;margin-bottom:8px;line-height:1.2;">${c.name}</div>
    <div style="margin-bottom:13px;display:flex;align-items:center;gap:10px;">
      <span style="font-family:DM Sans,sans-serif;font-size:13px;border-radius:20px;padding:5px 12px;font-weight:500;${badgeStyle}">${clLabel} · ${c.pct}</span>
      <span style="font-family:DM Sans,sans-serif;font-size:13px;color:#9a8a72;">· ${c.uva}</span>
    </div>
    <div style="font-family:DM Sans,sans-serif;font-size:16px;color:#4a3a28;line-height:1.7;margin-bottom:16px;">${c.desc}</div>
    <div style="font-family:DM Sans,sans-serif;font-size:11px;letter-spacing:1.2px;color:#b8922a;text-transform:uppercase;font-weight:600;margin-bottom:10px;">Maison e vigneron principali</div>
    ${maisonHTML}
    <div style="margin-top:14px;">
      <button onclick="go('v-zone-${c.zona}')" style="width:100%;background:#b8922a;color:#fff;border:none;border-radius:12px;padding:15px;font-family:DM Sans,sans-serif;font-size:16px;font-weight:500;cursor:pointer;">Scopri la zona completa →</button>
    </div>
  `;
  document.getElementById('cru-panel').style.transform='translateY(0)';
}

function closeCruPanel(){
  document.getElementById('cru-panel').style.transform='translateY(100%)';
}

// ── ZONA FILTER ──
function selectZona(z){
  document.querySelectorAll('.zpill').forEach(p=>p.classList.remove('on'));
  const pill=document.getElementById('zp-'+z);
  if(pill)pill.classList.add('on');

  const zones=['montagne','marne','blancs','bar'];
  zones.forEach(id=>{
    const el=document.getElementById('z-'+id);
    if(!el)return;
    el.style.opacity=(z==='all'||z===id)?'1':'0.2';
    el.style.pointerEvents=(z==='all'||z===id)?'auto':'none';
  });
  // Also dim markers of other zones
  document.querySelectorAll('.gc-marker,.pc-marker').forEach(m=>{
    const gruId=m.id?m.id.replace('gc-',''):'';
    const cru=CRU[gruId];
    if(z==='all'){m.style.opacity='1';}
    else if(cru&&cru.zona!==z){m.style.opacity='0.15';}
    else{m.style.opacity='1';}
  });
  closeCruPanel();
}

// Init on DOM ready
document.addEventListener('DOMContentLoaded',function(){
  initMapTouch();
});
// Also init when view becomes active
const origGo=window.go;
window.go=function(id){
  origGo(id);
  if(id==='v-mappa'){setTimeout(initMapTouch,100);}
};
})();



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
  currentMaisonSearch = '';
  // Svuota stack navigazione
  stack.length = 0;
  // Nascondi bottom nav
  const nav = document.getElementById('shared-bottom-nav');
  // Vai alla splash
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  const splash = document.getElementById('v-splash');
  if (splash) splash.classList.add('active');
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
      if (el) el.textContent = items.length + ' maison';
    }).catch(() => {});
    loadWishlist().then(items => {
      const el = document.getElementById('profile-wish-count');
      if (el) el.textContent = items.length + (items.length === 1 ? ' bottiglia' : ' bottiglie');
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

  // Avatar iniziale
  const avatarEl = document.getElementById('profile-avatar');
  if (avatarEl) avatarEl.textContent = initial;

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
    if (profile.is_premium) {
      premBadge.style.display = 'inline-flex';
    } else {
      premBadge.style.display = 'none';
    }
  }
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
    if (premBanner) premBanner.style.display = 'none';
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
    if (filters.tipo) query = query.eq('tipo', filters.tipo);
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
      .order('data_degustazione', { ascending: false });
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
  try {
    const [{ count: cp }, { count: cc }] = await Promise.all([
      supa.from('maison').select('*', { count: 'exact', head: true }),
      supa.from('bottiglie').select('*', { count: 'exact', head: true })
    ]);
    const elP = document.getElementById('home-count-produttori');
    const elC = document.getElementById('home-count-champagne');
    if (elP && cp != null) elP.textContent = cp + ' produttori';
    if (elC && cc != null) elC.textContent = cc + ' cuvée';
  } catch(e) {
    const elP = document.getElementById('home-count-produttori');
    const elC = document.getElementById('home-count-champagne');
    if (elP) elP.textContent = 'Produttori';
    if (elC) elC.textContent = 'Cuvée';
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

  // Header
  const maison = document.getElementById('detail-maison');
  const cuvee = document.getElementById('detail-cuvee');
  const meta = document.getElementById('detail-meta');
  const rating = document.getElementById('detail-rating');

  if (maison) maison.textContent = note.maison_nome || '';
  if (cuvee) cuvee.textContent = note.cuvee_nome || '';

  const metaParts = [note.annata, note.dosage_testo,
    note.data_degustazione ? 'Degustato il ' + new Date(note.data_degustazione).toLocaleDateString('it-IT', {day:'numeric',month:'long',year:'numeric'}) : ''
  ].filter(Boolean);
  if (meta) meta.textContent = metaParts.join(' · ');

  if (rating) {
    rating.innerHTML = Array.from({length:5}, (_,i) =>
      '<i class="ti ti-glass-full" style="font-size:22px;opacity:' + (i < (note.rating||0) ? '1' : '0.2') + ';"></i>'
    ).join('');
  }

  // Foto
  const imgWrap = document.getElementById('detail-img-wrap');
  if (imgWrap) {
    if (note.foto_url) {
      imgWrap.innerHTML = '<img src="' + note.foto_url + '" style="width:100%;height:220px;object-fit:cover;"/>';
      imgWrap.classList.remove('carnet-note-img-ph');
    } else {
      imgWrap.className = 'carnet-note-img-ph';
      imgWrap.style.height = '220px';
      imgWrap.innerHTML = '<i class="ti ti-camera" style="font-size:48px;"></i>';
    }
  }

  // Dynamic content
  const dynEl = document.getElementById('detail-dynamic-content');
  if (!dynEl) { go('v-carnet-detail'); return; }

  let html = '';

  // Parametri sensoriali
  const params = [
    {key:'acidite', label:'Acidité'},
    {key:'effervescence', label:'Effervescence'},
    {key:'complexite', label:'Complexité'},
    {key:'longueur', label:'Longueur en bouche'}
  ].filter(p => note[p.key]);

  if (params.length > 0) {
    html += '<div style="margin-bottom:18px;">';
    html += '<div style="font-family:var(--sans);font-size:13px;letter-spacing:1.2px;color:var(--gold);text-transform:uppercase;font-weight:500;margin-bottom:12px;">Parametri sensoriali</div>';
    html += '<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:9px;">';
    params.forEach(p => {
      const val = note[p.key];
      const pct = (val / 10 * 100) + '%';
      html += '<div style="background:var(--ivory-2);border:1px solid var(--border);border-radius:var(--radius-md);padding:12px 14px;">' +
        '<div style="font-family:var(--sans);font-size:13px;color:var(--ink-4);margin-bottom:4px;">' + p.label + '</div>' +
        '<div style="display:flex;align-items:center;gap:6px;">' +
        '<div style="flex:1;height:5px;background:var(--border);border-radius:2px;">' +
        '<div style="width:' + pct + ';height:100%;background:var(--gold);border-radius:2px;"></div></div>' +
        '<span style="font-family:var(--sans);font-size:14px;color:var(--gold);font-weight:500;">' + val + '</span>' +
        '</div></div>';
    });
    html += '</div></div>';
  }

  // Aromi
  if (note.aromi && note.aromi.length > 0) {
    html += '<div style="margin-bottom:18px;">';
    html += '<div style="font-family:var(--sans);font-size:13px;letter-spacing:1.2px;color:var(--gold);text-transform:uppercase;font-weight:500;margin-bottom:10px;">Aromi percepiti</div>';
    html += '<div style="display:flex;flex-wrap:wrap;gap:7px;">';
    note.aromi.forEach(a => {
      html += '<span class="aromi-pill on">' + a + '</span>';
    });
    html += '</div></div>';
  }

  // Note libere
  if (note.note_libere) {
    html += '<div style="margin-bottom:18px;">';
    html += '<div style="font-family:var(--sans);font-size:13px;letter-spacing:1.2px;color:var(--gold);text-transform:uppercase;font-weight:500;margin-bottom:10px;">Note di degustazione</div>';
    html += '<div style="font-family:var(--sans);font-size:17px;color:var(--ink-2);line-height:1.7;font-style:italic;">"' + note.note_libere + '"</div>';
    html += '</div>';
  }

  // Luogo e prezzo
  const extraParts = [];
  if (note.luogo || note.occasione) {
    extraParts.push('<div style="background:var(--ivory-2);border:1px solid var(--border);border-radius:var(--radius-md);padding:12px 14px;">' +
      '<div style="font-family:var(--sans);font-size:13px;color:var(--ink-4);margin-bottom:4px;">Occasione</div>' +
      '<div style="font-family:var(--sans);font-size:16px;color:var(--ink);">' + (note.occasione || note.luogo) + '</div></div>');
  }
  if (note.prezzo_pagato) {
    extraParts.push('<div style="background:var(--ivory-2);border:1px solid var(--border);border-radius:var(--radius-md);padding:12px 14px;">' +
      '<div style="font-family:var(--sans);font-size:13px;color:var(--ink-4);margin-bottom:4px;">Prezzo pagato</div>' +
      '<div style="font-family:var(--serif);font-size:20px;color:var(--gold);font-weight:500;">' + note.prezzo_pagato + '€</div></div>');
  }
  if (extraParts.length > 0) {
    html += '<div style="display:grid;grid-template-columns:' + (extraParts.length > 1 ? '1fr 1fr' : '1fr') + ';gap:9px;margin-bottom:24px;">' + extraParts.join('') + '</div>';
  }

  dynEl.innerHTML = html;
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
      .select('*, bottiglie(id, nome, tipo, dosage, annata, prezzo_min, prezzo_max, foto_url, maison(nome))')
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

  if (countEl) countEl.textContent = items.length + (items.length === 1 ? ' maison' : ' maison');

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

    return '<div class="maison-card" onclick="go(\'v-detail\')" style="margin:0 14px 12px;">' +
      '<div class="img-ph maison-card-ph" style="height:80px;">' +
      (m.foto_url
        ? '<img src="' + m.foto_url + '" style="width:100%;height:100%;object-fit:cover;"/>'
        : '<i class="ti ti-photo" style="font-size:22px;"></i>'
      ) +
      '</div>' +
      '<div class="maison-body">' +
      '<div class="maison-header-row">' +
      '<div class="maison-name">' + m.nome + '</div>' +
      '<i class="ti ti-heart-filled maison-heart" style="color:var(--gold);" data-id="' + item.id + '" onclick="event.stopPropagation();removeFavorite(this.dataset.id)"></i>' +
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

  if (countEl) countEl.textContent = items.length + (items.length === 1 ? ' bottiglia' : ' bottiglie');

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
      'nv': 'Non Vintage',
      'millesime': 'Millésimé',
      'prestige': 'Prestige Cuvée',
      'blanc_de_blancs': 'Blanc de Blancs',
      'blanc_de_noirs': 'Blanc de Noirs',
      'rose': 'Rosé',
      'nature': 'Brut Nature'
    }[b.tipo] || b.tipo || '';

    return '<div class="bottle-row" style="margin:0 14px 9px;cursor:pointer;">' +
      '<div class="bottle-ph"><i class="ti ti-bottle"></i></div>' +
      '<div class="bottle-info">' +
      '<div class="bottle-name">' + b.nome + '</div>' +
      '<div class="bottle-type">' + [b.maison?.nome, tipoLabel, b.annata].filter(Boolean).join(' · ') + '</div>' +
      (prezzo ? '<div class="bottle-price">' + prezzo + '</div>' : '') +
      '</div>' +
      '<i class="ti ti-star-filled" style="font-size:20px;color:var(--gold);cursor:pointer;" data-id="' + item.id + '" onclick="removeFromWishlist(this.dataset.id)"></i>' +
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

async function removeFromWishlist(wishId) {
  if (!currentUser) return;
  try {
    await supa.from('wishlist').delete().eq('id', wishId);
    await updateWishlistUI();
  } catch(e) {
    console.log('removeWishlist error:', e);
  }
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

  // Set sliders
  const sliders = {
    'val-acidite': note.acidite,
    'val-eff': note.effervescence,
    'val-comp': note.complexite,
    'val-lung': note.longueur
  };
  Object.entries(sliders).forEach(([id, val]) => {
    const el = document.getElementById(id);
    if (el && val) el.textContent = val;
    // Find the input range sibling
    const labelRow = el?.closest('.slider-wrap') || el?.parentElement;
    if (labelRow) {
      const input = labelRow.querySelector('input[type=range]');
      if (input && val) input.value = val;
    }
  });

  // Set rating
  document.querySelectorAll('.rating-star').forEach((s, i) => {
    s.style.opacity = i < currentRating ? '1' : '0.25';
    s.className = 'ti ti-glass-full rating-star' + (i < currentRating ? ' on' : '');
  });
  const lbl = document.getElementById('rating-label');
  const labels = ['', 'Deludente', 'Nella media', 'Buono', 'Ottimo', 'Eccellente — da ricordare!'];
  if (lbl) lbl.textContent = labels[currentRating] || '';

  // Set aromi
  document.querySelectorAll('.aromi-pill').forEach(pill => {
    pill.classList.toggle('on', (note.aromi || []).includes(pill.textContent));
  });

  // Show existing photo
  if (note.foto_url) {
    const box = document.getElementById('photo-box');
    if (box) box.innerHTML = '<img src="' + note.foto_url + '" style="width:100%;height:160px;object-fit:cover;border-radius:12px;"/>';
  }

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
}

async function deleteNote(noteId) {
  if (!confirm('Vuoi eliminare questa nota? L\'operazione non è reversibile.')) return;
  try {
    // Prima recupera la nota per ottenere la foto_url
    const { data: noteData } = await supa
      .from('carnet_notes')
      .select('foto_url')
      .eq('id', noteId)
      .single();

    // Elimina dal database
    const { error } = await supa
      .from('carnet_notes')
      .delete()
      .eq('id', noteId)
      .eq('user_id', currentUser.id);
    if (error) throw error;

    // Elimina la foto dallo storage se presente
    if (noteData?.foto_url) {
      try {
        // Estrai il path dal URL pubblico
        // URL format: .../storage/v1/object/public/carnet-photos/USER_ID/FILENAME
        const url = noteData.foto_url;
        const marker = '/carnet-photos/';
        const pathStart = url.indexOf(marker);
        if (pathStart !== -1) {
          const storagePath = url.substring(pathStart + marker.length);
          await supa.storage.from('carnet-photos').remove([storagePath]);
          console.log('Photo deleted from storage:', storagePath);
        }
      } catch(storageErr) {
        console.log('Storage delete error:', storageErr);
        // Non bloccare se la foto non si cancella
      }
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
  if (notes.length === 0) {
    if (emptyEl) emptyEl.style.display = 'block';
    document.getElementById('carnet-notes-list').style.display = 'none';
    if (premBanner) premBanner.style.display = 'none';
  } else {
    if (emptyEl) emptyEl.style.display = 'none';
    document.getElementById('carnet-notes-list').style.display = 'block';
    const isPrem = currentUser?.profile?.is_premium;
    if (!isPrem && notes.length >= 3) {
      if (premBanner) premBanner.style.display = 'block';
      if (countEl) countEl.textContent = notes.length;
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
  if (activeSearchQuery) {
    const q = activeSearchQuery.toLowerCase();
    filtered = filtered.filter(n =>
      (n.maison_nome || '').toLowerCase().includes(q) ||
      (n.cuvee_nome || '').toLowerCase().includes(q)
    );
  }

  window._carnetNotes = notes; // keep full array for index access

  if (filtered.length === 0) {
    listEl.innerHTML = '<div style="padding:40px 24px;text-align:center;font-family:var(--sans);font-size:16px;color:var(--ink-4);">Nessuna nota trovata</div>';
    return;
  }

  listEl.innerHTML = '<div class="carnet-grid">' + filtered.map((note, idx) => {
    const glasses = Array.from({length: 5}, (_, i) =>
      '<i class="ti ti-glass-full" style="font-size:13px;color:var(--gold);opacity:' + (i < (note.rating||0) ? '1' : '0.2') + ';"></i>'
    ).join('');
    const date = note.data_degustazione
      ? new Date(note.data_degustazione).toLocaleDateString('it-IT', {day:'numeric', month:'short'})
      : '';
    // Find original index in allCarnetNotes for correct detail open
    const origIdx = allCarnetNotes.findIndex(n => n.id === note.id);
    return '<div class="carnet-note-card" data-idx="' + origIdx + '" onclick="openNoteDetail(window._carnetNotes[this.dataset.idx])">' +
      '<div style="width:100%;aspect-ratio:1/1;overflow:hidden;background:var(--ivory-3);display:flex;align-items:center;justify-content:center;">' +
        (note.foto_url
          ? '<img src="' + note.foto_url + '" style="width:100%;height:100%;object-fit:cover;"/>'
          : '<i class="ti ti-camera" style="font-size:28px;color:var(--ink-5);"></i>') +
      '</div>' +
      '<div style="padding:11px 12px 13px;">' +
        '<div style="font-family:var(--sans);font-size:13px;color:var(--gold);font-weight:500;text-transform:uppercase;letter-spacing:.3px;margin-bottom:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + (note.maison_nome||'') + '</div>' +
        '<div style="font-family:var(--serif);font-size:17px;color:var(--ink);font-weight:500;line-height:1.2;margin-bottom:5px;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;">' + (note.cuvee_nome||'') + '</div>' +
        '<div style="font-family:var(--sans);font-size:13px;color:var(--ink-5);margin-bottom:7px;">' + (note.annata||'') + '</div>' +
        '<div style="display:flex;align-items:center;justify-content:space-between;">' +
          '<div>' + glasses + '</div>' +
          '<div style="font-family:var(--sans);font-size:12px;color:var(--ink-5);">' + date + '</div>' +
        '</div>' +
      '</div>' +
    '</div>';
  }).join('') + '</div>';
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
  if (input) input.value = '';
  activeSearchQuery = '';
  const clearBtn = document.getElementById('carnet-search-clear');
  if (clearBtn) clearBtn.style.display = 'none';
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
  return currentUser?.profile?.is_premium === true;
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

  // Filter by type
  if (currentMaisonFilter !== 'tutti') {
    filtered = filtered.filter(m => m.tipo === currentMaisonFilter);
  }

  // Filter by search
  if (currentMaisonSearch) {
    const q = currentMaisonSearch.toLowerCase();
    const tipoLabelM = {'NM':'négociant-manipulant','RM':'récoltant-manipulant','RC':'récoltant-coopérateur','CM':'coopérative-manipulant','SR':'société de récoltants','ND':'négociant-distributeur','MA':'marque acheteur'};
    filtered = filtered.filter(m =>
      (m.nome||'').toLowerCase().includes(q) ||
      (m.sede_comune||'').toLowerCase().includes(q) ||
      (m.descrizione||'').toLowerCase().includes(q) ||
      (m.chef_de_cave||'').toLowerCase().includes(q) ||
      (m.tipo||'').toLowerCase().includes(q) ||
      (tipoLabelM[m.tipo]||'').toLowerCase().includes(q) ||
      (m.zone?.nome||'').toLowerCase().includes(q)
    );
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
  const tipoBadge = {
    'NM':'badge-gm','RM':'badge-rm','RC':'badge-rm',
    'CM':'badge-bio','SR':'badge-rm','ND':'badge-pres','MA':'badge-pres'
  };

  const premium = isPremium();
  const isFav = (id) => maisonFavorites.has(id);

  listEl.innerHTML = filtered.map(m => {
    const isLocked = !m.is_free && !premium;
    const badge = tipoBadge[m.tipo] || 'badge-rm';
    const label = m.tipo || '—';
    const fav = isFav(m.id);
    const zonaNome = m.zone?.nome || '';
    const meta = [m.anno_fondazione ? 'dal ' + m.anno_fondazione : '', m.chef_de_cave || ''].filter(Boolean).join(' · ');

    return '<div class="maison-card' + (isLocked ? ' locked' : '') + '" data-id="' + m.id + '" onclick="' + (isLocked ? "go('v-paywall')" : "openMaisonDetail('" + m.id + "')") + '">' +
      '<div class="img-ph maison-card-ph" style="height:90px;">' +
        (m.foto_url ? '<img src="' + m.foto_url + '" style="width:100%;height:100%;object-fit:cover;"/>' : '<i class="ti ti-photo" style="font-size:22px;"></i>') +
        (isLocked ? '<div class="lock-over"><i class="ti ti-lock"></i>Premium</div>' : '') +
      '</div>' +
      '<div class="maison-body">' +
        '<div class="maison-header-row">' +
          '<div class="maison-name">' + m.nome + '</div>' +
          '<div style="display:flex;align-items:center;gap:8px;">' +
            (m.fascia_prezzo ? '<span class="fascia-tag">' + m.fascia_prezzo + '</span>' : '') +
            (!isLocked ? '<i class="ti ' + (fav ? 'ti-heart-filled' : 'ti-heart') + ' maison-heart" style="' + (fav ? 'color:var(--gold);' : '') + '" data-id="' + m.id + '" onclick="event.stopPropagation();toggleMaisonFavorite(this,this.dataset.id)"></i>' : '') +
          '</div>' +
        '</div>' +
        (m.zone ? '<div class="maison-card-zona">' +
          '<span class="zona-dot" style="background:' + (m.zone.colore || 'var(--gold)') + ';"></span>' +
          m.zone.nome + (m.sede_comune ? ' · ' + m.sede_comune : '') +
        '</div>' : '') +
        (meta ? '<div class="maison-meta">' + meta + '</div>' : '') +
        '<div class="badges-row">' +
          '<span class="badge ' + badge + '">' + label + '</span>' +
          (m.certificazioni && m.certificazioni.length ? m.certificazioni.map(c => '<span class="badge badge-bio">' + c + '</span>').join('') : '') +
        '</div>' +
      '</div>' +
    '</div>';
  }).join('');
}

function setMaisonFilter(el, filter) {
  document.querySelectorAll('#maison-filters .f-btn').forEach(b => b.classList.remove('on'));
  el.classList.add('on');
  currentMaisonFilter = filter;
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
  // Update profile count
  const favCount = document.getElementById('profile-fav-count');
  if (favCount) favCount.textContent = maisonFavorites.size + ' maison';
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
    if (m.fascia_prezzo) b += ' <span class="fascia-tag" style="font-size:15px;margin-left:4px;">' + m.fascia_prezzo + '</span>';
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
      .order('is_featured', { ascending: false })
      .order('nome', { ascending: true });

    if (!bottles || bottles.length === 0) {
      listEl.innerHTML = '<div style="padding:0 18px 16px;font-family:var(--sans);font-size:15px;color:var(--ink-4);">Catalogo in aggiornamento.</div>';
      if (lockEl) lockEl.style.display = 'none';
      return;
    }
    const premium = isPremium();
    const visible = premium ? bottles : bottles.slice(0, 2);
    const locked = premium ? [] : bottles.slice(2);
    const tipoLabel = {'nv':'Non Vintage','millesimato':'Millesimato','prestige':'Prestige Cuvée','blanc_de_blancs':'Blanc de Blancs','blanc_de_noirs':'Blanc de Noirs','rose':'Rosé','nature':'Brut Nature'};
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
let currentBottFilter = 'tutti';
let currentBottSearch = '';
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

function dosagePill(tipo) {
  if (!tipo) return '';
  const cfg = {
    'Brut Nature': {bg:'#E3F2F8',c:'#1A5C78'},
    'Zero Dosage': {bg:'#E3F2F8',c:'#1A5C78'},
    'Extra Brut':  {bg:'#E8F4F5',c:'#1E7A8A'},
    'Brut':        {bg:'#F5EDD8',c:'#8A6A1E'},
    'Extra Sec':   {bg:'#F5E8D0',c:'#9A5810'},
    'Sec':         {bg:'#F5E0D0',c:'#A04020'},
    'Demi-Sec':    {bg:'#F5D8EC',c:'#8A2860'},
    'Doux':        {bg:'#F0D0E8',c:'#6A1848'},
  };
  const s = cfg[tipo] || {bg:'var(--ivory-2)',c:'var(--ink-4)'};
  return '<span class="dosage-pill" style="background:' + s.bg + ';color:' + s.c + ';">' + tipo + '</span>';
}

function priceScale(fascia) {
  if (!fascia) return '';
  const levels = {'€':1,'€€':2,'€€€':3,'€€€€':4};
  const n = levels[fascia] || 0;
  const symbols = Array.from({length:5}, (_,i) =>
    '<span style="font-size:14px;font-weight:' + (i<n?'700':'400') + ';color:' + (i<n?'var(--gold)':'var(--border-2)') + ';line-height:1;">€</span>'
  ).join('');
  return '<div class="price-scale">' + symbols + '</div>';
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
      .order('is_featured', { ascending: false })
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
    renderBottiglie();
  } catch(e) {
    console.log('loadBottiglie error:', e);
    if (loadingEl) loadingEl.innerHTML = '<div style="padding:20px;text-align:center;font-family:var(--sans);font-size:15px;color:var(--ink-4);">Errore caricamento. Riprova.</div>';
  }
}

function renderBottiglie() {
  const listEl = document.getElementById('bott-list');
  if (!listEl) return;
  const tipoLabel = {'nv':'Non Vintage','millesimato':'Millesimato','prestige':'Prestige Cuvée','blanc_de_blancs':'Blanc de Blancs','blanc_de_noirs':'Blanc de Noirs','rose':'Rosé','nature':'Brut Nature'};
  let filtered = allBottiglie;
  if (currentBottFilter !== 'tutti') filtered = filtered.filter(b => b.tipo === currentBottFilter);
  if (currentBottSearch) {
    const q = currentBottSearch.toLowerCase();
    const tipoLabelB = {'nv':'non vintage','millesimato':'millesimato','prestige':'prestige cuvée','blanc_de_blancs':'blanc de blancs','blanc_de_noirs':'blanc de noirs','rose':'rosé','nature':'brut nature'};
    filtered = filtered.filter(b =>
      (b.nome||'').toLowerCase().includes(q) ||
      (b.maison?.nome||'').toLowerCase().includes(q) ||
      (b.descrizione||'').toLowerCase().includes(q) ||
      (b.dosaggio_tipo||'').toLowerCase().includes(q) ||
      (tipoLabelB[b.tipo]||'').toLowerCase().includes(q) ||
      (b.annata ? String(b.annata) : '').includes(q)
    );
  }
  if (!filtered.length) {
    listEl.innerHTML = '<div style="padding:40px 24px;text-align:center;font-family:var(--sans);font-size:16px;color:var(--ink-4);">Nessuna bottiglia trovata</div>';
    return;
  }
  listEl.innerHTML = filtered.map(b => {
    const tipo = tipoLabel[b.tipo] || b.tipo || '';
    const inWish = wishlistIds.has(b.id);
    const prezzoRange = b.prezzo_min && b.prezzo_max ? '<div style="font-family:var(--sans);font-size:12px;color:var(--ink-4);margin-bottom:2px;">' + b.prezzo_min + '–' + b.prezzo_max + '€</div>' : '';
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
          '<div>' + prezzoRange + priceScale(b.fascia_prezzo) + '</div>' +
          '<div style="display:flex;align-items:center;gap:10px;">' +
            (b.score_medio ? scoreRingSm(b.score_medio) : '') +
            '<i class="ti ' + (inWish ? 'ti-heart-filled' : 'ti-heart') + ' bott-wish' + (inWish ? ' on' : '') + '" data-id="' + b.id + '" onclick="event.stopPropagation();toggleWishlist(this,this.dataset.id)"></i>' +
          '</div>' +
        '</div>' +
      '</div>' +
    '</div>';
  }).join('');
}

function setBottFilter(el, filter) {
  document.querySelectorAll('#bott-filters .f-btn').forEach(b => b.classList.remove('on'));
  el.classList.add('on');
  currentBottFilter = filter;
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
}

async function openBottigliaDetail(bottId) {
  const b = allBottiglie.find(x => x.id === bottId) || currentBottiglia;
  if (!b) return;
  currentBottiglia = b;
  const tipoLabel = {'nv':'Non Vintage','millesimato':'Millesimato','prestige':'Prestige Cuvée','blanc_de_blancs':'Blanc de Blancs','blanc_de_noirs':'Blanc de Noirs','rose':'Rosé','nature':'Brut Nature'};

  // Hero
  const hero = document.getElementById('bott-detail-hero');
  if (hero) {
    if (b.foto_url) { hero.innerHTML = '<img src="' + b.foto_url + '" style="width:100%;height:200px;object-fit:cover;"/>'; hero.className = ''; }
    else { hero.className = 'img-ph detail-hero-ph'; hero.innerHTML = '<i class="ti ti-bottle" style="font-size:40px;"></i>'; }
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
    if (b.fascia_prezzo) bdg += priceScale(b.fascia_prezzo);
    if (b.prezzo_min && b.prezzo_max) bdg += '<span style="font-family:var(--sans);font-size:13px;color:var(--ink-4);margin-left:6px;">da ' + b.prezzo_min + '€</span>';
    badgesEl.innerHTML = bdg;
  }

  // Score
  const scoreWrap = document.getElementById('bott-detail-score-wrap');
  const scoreRingEl = document.getElementById('bott-detail-score-ring');
  if (scoreWrap && scoreRingEl && b.score_medio) {
    const deg = Math.round((b.score_medio / 100) * 360);
    scoreRingEl.innerHTML = '<div class="score-ring-lg" style="background:conic-gradient(var(--gold) ' + deg + 'deg,var(--border) 0deg);">' +
      '<div class="score-ring-lg-inner"><span class="score-num-lg">' + b.score_medio + '</span></div>' +
    '</div>';
    const lblEl = document.getElementById('bott-detail-score-label');
    if (lblEl) lblEl.textContent = scoreLabel(b.score_medio);
    const fonteEl = document.getElementById('bott-detail-score-fonte');
    if (fonteEl) fonteEl.textContent = b.score_note || 'Stima editoriale — consenso critico internazionale';
    scoreWrap.style.display = 'flex';
  } else if (scoreWrap) { scoreWrap.style.display = 'none'; }

  // Finestra degustazione
  const finSection = document.getElementById('bott-detail-finestra-section');
  if (finSection) {
    if (b.finestra_da || b.finestra_a) {
      finSection.style.display = 'block';
      const now = new Date().getFullYear();
      const from = b.finestra_da || now;
      const to = b.finestra_a || (now + 10);
      const total = Math.max(to - now + 5, 1);
      const start = Math.max(0, from - now);
      const width = Math.min(100, Math.round(((to - from) / total) * 100));
      const left = Math.min(80, Math.round((start / total) * 100));
      const fillEl = document.getElementById('bott-finestra-fill');
      if (fillEl) { fillEl.style.width = width + '%'; fillEl.style.marginLeft = left + '%'; }
      const daEl = document.getElementById('bott-finestra-da');
      const aEl = document.getElementById('bott-finestra-a');
      if (daEl) daEl.textContent = from <= now ? 'Pronta ora' : 'Da ' + from;
      if (aEl) aEl.textContent = 'Fino al ' + to;
    } else { finSection.style.display = 'none'; }
  }

  // Note degustazione
  const noteEl = document.getElementById('bott-detail-note');
  if (noteEl) noteEl.textContent = b.note_degustazione || '';

  // Scheda tecnica
  const schedaEl = document.getElementById('bott-detail-scheda');
  if (schedaEl) {
    const uvaggi = [b.pct_pinot_noir ? b.pct_pinot_noir + '% Pinot Noir' : null, b.pct_chardonnay ? b.pct_chardonnay + '% Chardonnay' : null, b.pct_meunier ? b.pct_meunier + '% Meunier' : null].filter(Boolean).join(' · ');
    const rows = [
      { l:'Maison', v: b.maison?.nome || null },
      { l:'Uvaggi', v: uvaggi || null },
      { l:'Dosaggio', v: b.dosaggio_gl != null ? b.dosaggio_gl + ' g/l — ' + (b.dosaggio_tipo||'') : (b.dosaggio_tipo||null) },
      { l:'Provenienza uve', v: b.provenienza_uve || null },
      { l:'Vini base', v: b.vini_base || null },
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
}

function shareBottiglia() {
  if (!currentBottiglia) return;
  const text = '🍾 ' + currentBottiglia.nome + (currentBottiglia.maison?.nome ? '\n' + currentBottiglia.maison.nome : '') + '\n\n' + (currentBottiglia.note_degustazione || '').substring(0, 150) + '...\n\nScopri su Cuvée app';
  if (navigator.share) { navigator.share({ title: currentBottiglia.nome, text }); }
  else if (navigator.clipboard) { navigator.clipboard.writeText(text); }
}

