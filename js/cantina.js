/* ═══════════════════════════════════════════════════════════════════
   CANTINA PERSONALE
   Più cantine per utente, ognuna fatta di elementi (scaffali, cantinette)
   con le misure scelte dall'utente. Mappa 2D e vista 3D sugli stessi dati.
   Aperta a tutti; solo Premium può creare/modificare (vedi cvCanEdit) —
   chi non lo è vede un'anteprima con dati di esempio (vedi cvDemoView).
   Tabelle: cellars, cellar_units, cellar_bottles (vedi migrazione SQL).
   ═══════════════════════════════════════════════════════════════════ */
'use strict';

const CV_TYPES = {
  champagne: { label: 'Champagne',      dot: '#b8922a', glass: 0x1c3a2b, foil: 0xc9a24a },
  rose:      { label: 'Champagne Rosé', dot: '#d4788a', glass: 0xb98a92, foil: 0xd98a9a },
  spumante:  { label: 'Altri spumanti', dot: '#8fa0a4', glass: 0x28463a, foil: 0xb9c0c4 },
  rosso:     { label: 'Vino rosso',     dot: '#7a1f2b', glass: 0x24100f, foil: 0x6b1620 },
  bianco:    { label: 'Vino bianco',    dot: '#cfc275', glass: 0x7e8f43, foil: 0xdcd28f }
};
const CV_ROWL = 'ABCDEFGHIJKL';
const CV_LIM = { cols: 12, rows: 12, units: 6, seats: 300, cellars: 10 };
const CV_UNIT_NAME = { rack: 'Scaffale', fridge: 'Cantinetta' };

const CV = {
  loaded: false, loading: null, error: null,
  cellars: [], units: [], bottles: [], trash: [],
  cur: null,          // id della cantina aperta
  v: null,            // vista calcolata della cantina aperta
  sel: null,          // { u: idElemento, r, c }
  moveId: null,       // bottiglia che si sta spostando
  target: null,       // posto scelto per una nuova bottiglia { unit, row, col }
  scanTarget: null,   // idem, ma memorizzato mentre si fa la scansione
  view: '2d', fs: false, demo: false,
  T3: null, threeP: null
};

// Bottiglie di esempio per l'anteprima ai non Premium: nomi realistici, nessuna foto, nulla viene letto/scritto sul database
const CV_DEMO_BOTTLES = [
  ['Krug', 'Grande Cuvée', 'NV', 'champagne'], ['Dom Pérignon', 'Vintage 2013', '2013', 'champagne'],
  ['Louis Roederer', 'Cristal', '2014', 'champagne'], ['Salon', 'Le Mesnil', '2012', 'champagne'],
  ['Taittinger', 'Comtes de Champagne', '2012', 'champagne'], ['Bollinger', 'Special Cuvée', 'NV', 'champagne'],
  ['Ruinart', 'Blanc de Blancs', 'NV', 'champagne'], ['Pol Roger', 'Brut Réserve', 'NV', 'champagne'],
  ['Charles Heidsieck', 'Brut Réserve', 'NV', 'champagne'], ['Jacquesson', 'Cuvée 746', 'NV', 'champagne'],
  ['Egly-Ouriet', 'Brut Tradition Grand Cru', 'NV', 'champagne'], ['Larmandier-Bernier', 'Longitude', 'NV', 'champagne'],
  ['Perrier-Jouët', 'Belle Epoque', '2013', 'champagne'], ['Billecart-Salmon', 'Brut Rosé', 'NV', 'rose'],
  ['Ruinart', 'Rosé', 'NV', 'rose'], ['Laurent-Perrier', 'Cuvée Rosé', 'NV', 'rose'],
  ['Dom Pérignon', 'Rosé', '2008', 'rose'], ["Ca' del Bosco", 'Cuvée Prestige', 'NV', 'spumante'],
  ['Ferrari', 'Perlé', '2018', 'spumante'], ['Bellavista', 'Alma Gran Cuvée', 'NV', 'spumante'],
  ['Tenuta San Guido', 'Sassicaia', '2019', 'rosso'], ['Ornellaia', 'Bolgheri Superiore', '2018', 'rosso'],
  ['William Fèvre', 'Chablis 1er Cru', '2021', 'bianco'], ['Livio Felluga', 'Terre Alte', '2020', 'bianco']
].map(a => ({ maison: a[0], cuvee: a[1], year: a[2], kind: a[3] }));
let _cvDemoView = null;
// Una cantina finta ma verosimile: una cantinetta quasi piena e uno scaffale a metà, per far vedere anche i posti liberi
function cvDemoView() {
  if (_cvDemoView) return _cvDemoView;
  const r = cvRng(20260922);
  const pick = () => Object.assign({ id: 'demo-' + Math.floor(r() * 1e9) }, CV_DEMO_BOTTLES[Math.floor(r() * CV_DEMO_BOTTLES.length)]);
  const mkUnit = (id, kind, name, cols, rows, fill) => {
    const slots = {};
    for (let i = 0; i < rows; i++) for (let j = 0; j < cols; j++) if (r() < fill) slots[i + ',' + j] = pick();
    return { id, kind, name, cols, rows, slots };
  };
  _cvDemoView = {
    id: 'demo', name: 'Esempio',
    units: [mkUnit('demo-u1', 'fridge', 'Cantinetta', 6, 4, .62), mkUnit('demo-u2', 'rack', 'Scaffale a parete', 8, 6, .8)],
    unplaced: []
  };
  return _cvDemoView;
}
// Chi può davvero creare/modificare/eliminare: solo da Premium — così anche l'admin, usando "Disattiva Premium"
// nel pannello di test del Profilo, vede esattamente l'anteprima che vedrà un utente free
const cvCanEdit = () => typeof isPremium === 'function' && isPremium();
function cvLock() { const m = cvEl('cellar-lock-modal'); if (m) m.classList.add('on'); }
// Solo la prima volta che un non-Premium entra nell'anteprima: chiarisce che non è la sua cantina vera
const CV_INTRO_KEY = 'cuvee_cv_intro_seen_v1';
function cvMaybeShowIntro() {
  let seen = false;
  try { seen = localStorage.getItem(CV_INTRO_KEY) === '1'; } catch (_) { /* niente memoria: la mostriamo comunque */ }
  if (seen) return;
  try { localStorage.setItem(CV_INTRO_KEY, '1'); } catch (_) { /* pazienza, ricomparirà la prossima volta */ }
  const m = cvEl('cellar-intro-modal'); if (m) m.classList.add('on');
}

const cvEl = id => document.getElementById(id);
const cvEsc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const cvHex = n => '#' + n.toString(16).padStart(6, '0');
// Confronto testo tollerante ad accenti/maiuscole, usato sia dalla ricerca nel catalogo sia da quella in cantina
const cvNorm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
// La cantina è aperta a tutti gli utenti registrati; chi non è Premium vede l'anteprima (cvCanEdit)
const cvEnabled = () => !!currentUser;
const cvToast = m => { if (typeof showAppToast === 'function') showAppToast(m, 2600); };
function cvErrText(e) {
  const m = String((e && e.message) || e || '');
  return m && m.length < 140 ? m : 'Qualcosa è andato storto, riprova';
}

/* ───────── Dati ───────── */
async function cvFetchAll(table) {
  const out = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supa.from(table).select('*').eq('user_id', currentUser.id)
      .order('created_at', { ascending: true }).range(from, from + 999);
    if (error) throw error;
    out.push(...(data || []));
    if (!data || data.length < 1000) break;
  }
  return out;
}
function cvLoad(force) {
  if (CV.loaded && !force) return Promise.resolve();
  if (CV.loading) return CV.loading;
  CV.loading = (async () => {
    try {
      const [c, u, b] = await Promise.all([cvFetchAll('cellars'), cvFetchAll('cellar_units'), cvFetchAll('cellar_bottles')]);
      CV.cellars = c.filter(x => !x.deleted_at).sort((a, z) => a.sort - z.sort || String(a.created_at).localeCompare(String(z.created_at)));
      CV.trash = c.filter(x => x.deleted_at).sort((a, z) => Date.parse(z.deleted_at) - Date.parse(a.deleted_at));
      CV.units = u; CV.bottles = b; CV.loaded = true; CV.error = null;
      if (!CV.cellars.find(x => x.id === CV.cur)) CV.cur = CV.cellars.length ? CV.cellars[0].id : null;
      cvPurgeExpiredTrash(); // in background, non blocca il caricamento
    } catch (e) {
      CV.error = e; throw e;
    } finally { CV.loading = null; }
  })();
  return CV.loading;
}
// Un anno di sicurezza in più prima di sparire per sempre: 30 giorni dalla richiesta di eliminazione
const CV_TRASH_DAYS = 30;
const cvTrashDaysLeft = deletedAt => Math.max(1, Math.ceil((CV_TRASH_DAYS * 86400000 - (Date.now() - Date.parse(deletedAt))) / 86400000));
// Pulizia "pigra" delle cantine nel cestino scadute: nessun cron, parte da sola al primo caricamento
// utile dopo i 30 giorni. Le foto vanno tolte dallo storage PRIMA di eliminare le righe dal database.
async function cvPurgeExpiredTrash() {
  const expired = CV.trash.filter(c => cvTrashDaysLeft(c.deleted_at) <= 0 || Date.parse(c.deleted_at) < Date.now() - CV_TRASH_DAYS * 86400000);
  if (!expired.length) return;
  const ids = expired.map(c => c.id);
  try {
    const { data: bottles } = await supa.from('cellar_bottles').select('photo_url, photo_back_url').in('cellar_id', ids);
    const paths = (bottles || []).flatMap(b => [b.photo_url, b.photo_back_url]).filter(Boolean).map(cvOwnPath).filter(Boolean);
    if (paths.length) await supa.storage.from('carnet-photos').remove(paths);
  } catch (_) { /* le foto orfane non sono un problema grave, si ritenta al prossimo giro */ }
  try {
    const { data, error } = await supa.rpc('cellar_purge_expired');
    if (error) throw error;
    const purged = new Set((data || []).map(r => r.cellar_id));
    if (purged.size) { CV.trash = CV.trash.filter(c => !purged.has(c.id)); cvRenderTrashLink(); }
  } catch (_) { /* riproveremo al prossimo caricamento */ }
}
function cvRenderTrashLink() {
  const link = cvEl('cv-trash-link'); if (!link) return;
  link.hidden = CV.trash.length === 0;
  const count = cvEl('cv-trash-count'); if (count) count.textContent = CV.trash.length ? '(' + CV.trash.length + ')' : '';
}
function cvBuildView() {
  const c = CV.cellars.find(x => x.id === CV.cur);
  if (!c) return null;
  const units = CV.units.filter(u => u.cellar_id === c.id).sort((a, z) => a.sort - z.sort)
    .map(u => ({ id: u.id, kind: u.kind, name: u.name, cols: u.cols, rows: u.rows, slots: {} }));
  const byId = new Map(units.map(u => [u.id, u]));
  const unplaced = [];
  CV.bottles.filter(b => b.cellar_id === c.id).forEach(b => {
    const u = b.unit_id && byId.get(b.unit_id);
    if (u) u.slots[b.slot_row + ',' + b.slot_col] = b; else unplaced.push(b);
  });
  return { id: c.id, name: c.name, units, unplaced };
}
const cvCount = c => CV.bottles.filter(b => b.cellar_id === c.id).length;
const cvBottleById = id => CV.bottles.find(b => b.id === id) || null;

/* ───────── Ingresso nella vista ───────── */
async function cvEnter() {
  if (!cvEnabled()) { cvToast('La cantina non è ancora disponibile'); goBack(); return; }
  cvExitFullscreen();
  CV.demo = !cvCanEdit();
  cvEl('cv-demo-badge').hidden = !CV.demo;
  cvEl('cv-premium-cta').hidden = !CV.demo;
  cvEl('cv-edit-btn').style.display = 'none';
  cvEl('cv-search-btn').style.display = 'none';
  if (CV.demo) {
    CV.sel = null; CV.moveId = null; CV.error = null;
    cvEl('cv-empty').innerHTML = '';
    cvRefresh(true);
    if (CV.view === '3d') cvSetView('3d');
    cvMaybeShowIntro();
    return;
  }
  try { await cvLoad(); }
  catch (e) { cvShowError(e); return; }
  cvRefresh(true);
  if (CV.view === '3d') cvSetView('3d');
}
function cvShowError(e) {
  cvEl('cv-main').hidden = true; cvEl('cv-chips').innerHTML = '';
  const missing = e && (e.code === 'PGRST205' || e.code === '42P01' || /cellars|schema cache|does not exist/i.test(e.message || ''));
  cvEl('cv-empty').innerHTML = '<div class="cv-empty"><b>' + (missing ? 'Cantina non ancora attiva' : 'Non riesco a caricare la cantina') + '</b><p>' +
    (missing ? 'Nel database mancano ancora le tabelle della cantina.' : 'Controlla la connessione e riprova.') + '</p><button class="cv-btn gold" onclick="cvEnter()">Riprova</button></div>';
}

/* ───────── Disegno dell'interfaccia ───────── */
function cvRefresh(rebuild3d) {
  if (CV.demo) {
    CV.v = cvDemoView();
    cvEl('cv-chips').innerHTML = '';
    cvEl('cv-trash-link').hidden = true;
    cvEl('cv-main').hidden = false;
    cvRenderStats(); cvRenderLegend(); cvRender2D(); cvRenderUnplaced(); cvRenderInfo();
    if (CV.T3 && CV.view === '3d') { if (rebuild3d) cvBuild3D(); cvUpdateSel3D(false); }
    return;
  }
  CV.v = cvBuildView();
  const has = CV.cellars.length > 0;
  cvRenderChips();
  cvRenderTrashLink();
  cvEl('cv-main').hidden = !has;
  cvEl('cv-edit-btn').style.display = has ? '' : 'none';
  cvEl('cv-search-btn').style.display = has ? '' : 'none';
  cvEl('cv-empty').innerHTML = has ? '' :
    '<div class="cv-empty"><b>La tua cantina, come nella realtà</b><p>Crea una cantina con le misure dei tuoi scaffali e delle tue cantinette, poi aggiungi le bottiglie e ritrovale al loro posto, anche in 3D.</p>' +
    '<button class="cv-btn gold" onclick="cvOpenBuilder(\'new\')">Crea la tua prima cantina</button></div>';
  if (!has) return;
  // La selezione deve puntare a un posto ancora esistente
  if (CV.sel && !(CV.v && CV.v.units.some(u => u.id === CV.sel.u && CV.sel.r < u.rows && CV.sel.c < u.cols))) CV.sel = null;
  cvRenderStats(); cvRenderLegend(); cvRender2D(); cvRenderUnplaced(); cvRenderInfo();
  if (CV.T3 && CV.view === '3d') { if (rebuild3d) cvBuild3D(); cvUpdateSel3D(false); }
}
function cvRenderChips() {
  cvEl('cv-chips').innerHTML = CV.cellars.map(c =>
    '<button class="cv-chip' + (c.id === CV.cur ? ' on' : '') + '" data-id="' + c.id + '">' + cvEsc(c.name) + ' <small>' + cvCount(c) + '</small></button>'
  ).join('') + (CV.cellars.length && CV.cellars.length < CV_LIM.cellars ? '<button class="cv-chip add" data-add="1">+ Nuova cantina</button>' : '');
}
cvEl('cv-chips').addEventListener('click', e => {
  if (e.target.closest('[data-add]')) { cvOpenBuilder('new'); return; }
  const b = e.target.closest('[data-id]'); if (!b) return;
  CV.cur = b.dataset.id; CV.sel = null; CV.moveId = null;
  cvRefresh(true);
  if (CV.T3 && CV.view === '3d') cvCam('over');
});
function cvRenderStats() {
  const v = CV.v, placedList = v.units.flatMap(u => Object.values(u.slots)), mine = placedList.concat(v.unplaced);
  const cap = v.units.reduce((n, u) => n + u.cols * u.rows, 0), placed = placedList.length;
  const maisons = new Set(mine.map(b => b.maison.trim().toLowerCase())).size;
  cvEl('cv-stats').innerHTML =
    '<div class="cv-stat"><b>' + mine.length + '</b><span>Bottiglie</span></div>' +
    '<div class="cv-stat"><b>' + maisons + '</b><span>Produttori</span></div>' +
    '<div class="cv-stat"><b>' + (cap - placed) + '</b><span>Posti liberi</span></div>';
}
function cvRenderLegend() {
  cvEl('cv-legend').innerHTML = Object.values(CV_TYPES).map(t => '<span><i style="background:' + t.dot + '"></i>' + t.label + '</span>').join('');
}
function cvPosText(unitId, r, c) {
  const un = CV.v.units.find(u => u.id === unitId);
  if (!un) return '';
  return un.kind === 'fridge' ? un.name + ' · ripiano ' + (r + 1) + ', posto ' + (c + 1) : un.name + ' · riga ' + CV_ROWL[r] + ', posto ' + (c + 1);
}
const cvYearText = b => (!b.year || b.year === 'NV') ? 'Senza annata' : b.year;

function cvUnitSVG(un) {
  const p = 34, ml = 18, mt = 16, fr = un.kind === 'fridge';
  const W = ml + un.cols * p + 8, H = mt + un.rows * p + 8;
  let s = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="group" aria-label="' + cvEsc(un.name) + '" style="max-width:' + Math.max(220, un.cols * 46 + 30) + 'px">';
  s += '<rect x="' + (ml - 3) + '" y="' + (mt - 3) + '" width="' + (un.cols * p + 6) + '" height="' + (un.rows * p + 6) + '" rx="7" fill="' + (fr ? '#17171b' : '#8a5d36') + '"/>';
  for (let j = 0; j < un.cols; j++) s += '<text x="' + (ml + j * p + p / 2) + '" y="' + (mt - 6) + '" font-size="8" text-anchor="middle" fill="#9a8a72">' + (j + 1) + '</text>';
  for (let i = 0; i < un.rows; i++) {
    s += '<text x="' + (ml - 8) + '" y="' + (mt + i * p + p / 2 + 3) + '" font-size="8" text-anchor="middle" fill="#9a8a72">' + (fr ? i + 1 : CV_ROWL[i]) + '</text>';
    for (let j = 0; j < un.cols; j++) {
      const x = ml + j * p, y = mt + i * p, cx = x + p / 2, cy = y + p / 2, b = un.slots[i + ',' + j];
      const sel = CV.sel && CV.sel.u === un.id && CV.sel.r === i && CV.sel.c === j;
      s += '<g data-u="' + un.id + '" data-r="' + i + '" data-c="' + j + '"><rect x="' + (x + 1) + '" y="' + (y + 1) + '" width="' + (p - 2) + '" height="' + (p - 2) + '" rx="3" fill="' + (fr ? '#22222a' : '#5a3b22') + '"/>';
      if (b) {
        const t = CV_TYPES[b.kind] || CV_TYPES.champagne;
        s += '<circle cx="' + cx + '" cy="' + cy + '" r="13.4" fill="' + cvHex(t.glass) + '" stroke="rgba(255,255,255,.22)" stroke-width=".8"/>' +
             '<circle cx="' + cx + '" cy="' + cy + '" r="8" fill="' + cvHex(t.foil) + '"/><circle cx="' + (cx - 2.4) + '" cy="' + (cy - 2.6) + '" r="2.4" fill="#fff" opacity=".35"/>';
      } else {
        s += '<circle cx="' + cx + '" cy="' + cy + '" r="11.5" fill="none" stroke="rgba(255,255,255,.2)" stroke-width="1" stroke-dasharray="2.5 2.5"/>';
      }
      if (sel) s += '<circle cx="' + cx + '" cy="' + cy + '" r="16" fill="none" stroke="#f0c14b" stroke-width="2.4"/>';
      s += '</g>';
    }
  }
  return s + '</svg>';
}
function cvRender2D() {
  cvEl('cv-view2d').innerHTML = CV.v.units.map(un => {
    const n = Object.keys(un.slots).length;
    return '<div class="cv-unit"><div class="cv-unit-h"><b>' + cvEsc(un.name) + '</b><span>' + n + ' / ' + un.cols * un.rows + '</span></div>' + cvUnitSVG(un) + '</div>';
  }).join('');
}
cvEl('cv-view2d').addEventListener('click', e => {
  const g = e.target.closest('[data-r]'); if (!g) return;
  cvOnSlot(g.dataset.u, +g.dataset.r, +g.dataset.c);
});
function cvRenderUnplaced() {
  const up = CV.v.unplaced;
  cvEl('cv-unplaced').innerHTML = up.length
    ? '<div class="cv-unit"><div class="cv-unit-h"><b>Non posizionate</b><span>' + up.length + '</span></div><p class="cv-hintp">Tocca una bottiglia, poi un posto libero.</p>' +
      up.map(b => '<button class="cv-row" data-un="' + b.id + '"><i style="background:' + (CV_TYPES[b.kind] || CV_TYPES.champagne).dot + '"></i><span>' + cvEsc(b.maison) + ' · ' + cvEsc(b.cuvee) + '<small>' + cvEsc(cvYearText(b)) + '</small></span></button>').join('') + '</div>'
    : '';
}
cvEl('cv-unplaced').addEventListener('click', e => {
  const r = e.target.closest('[data-un]'); if (!r) return;
  CV.moveId = r.dataset.un; CV.sel = null; cvRenderInfo(); cvRender2D();
  if (CV.T3) cvUpdateSel3D(false);
});

function cvRenderInfo() {
  const el = cvEl('cv-info');
  el.classList.toggle('cv-info-demo', CV.demo);
  if (CV.demo) {
    if (!CV.sel) { el.hidden = true; return; }
    const { u, r, c } = CV.sel, un = CV.v.units.find(x => x.id === u), b = un && un.slots[r + ',' + c];
    el.hidden = false;
    if (!b) {
      el.innerHTML = '<div class="cv-info-top"><div><div class="cv-maison">Posto libero</div><div class="cv-cuvee">' + cvEsc(cvPosText(u, r, c)) + '</div></div><button class="cv-x" data-a="close" aria-label="Chiudi">×</button></div>' +
        '<div class="cv-pos">Con Premium aggiungi qui le tue bottiglie vere.</div><button class="cv-btn gold" data-a="lock" style="width:100%;">Sblocca Premium</button>';
      return;
    }
    const t = CV_TYPES[b.kind] || CV_TYPES.champagne;
    el.innerHTML = '<div class="cv-info-top"><div><div class="cv-maison">' + cvEsc(b.maison) + '</div><div class="cv-cuvee">' + cvEsc(b.cuvee) + '</div></div><button class="cv-x" data-a="close" aria-label="Chiudi">×</button></div>' +
      '<div class="cv-tags"><span class="cv-tag"><i style="display:inline-block;width:8px;height:8px;border-radius:50%;background:' + t.dot + ';margin-right:5px"></i>' + t.label + '</span><span class="cv-tag">' + cvEsc(cvYearText(b)) + '</span></div>' +
      '<div class="cv-pos">' + cvEsc(cvPosText(u, r, c)) + '</div><button class="cv-btn gold" data-a="lock" style="width:100%;">Sblocca per gestire le tue bottiglie</button>';
    return;
  }
  if (CV.moveId) {
    const mb = cvBottleById(CV.moveId);
    if (mb) {
      el.hidden = false;
      el.innerHTML = '<div class="cv-info-top"><div><div class="cv-maison">Sposta in un posto libero</div><div class="cv-cuvee">' + cvEsc(mb.cuvee) + '</div></div><button class="cv-x" data-a="cancelmove" aria-label="Annulla">×</button></div>' +
        '<div class="cv-pos">Tocca un posto libero, nella mappa o in 3D.</div><div class="cv-acts"><button class="cv-btn" data-a="cancelmove">Annulla</button></div>';
      return;
    }
    CV.moveId = null;
  }
  if (!CV.sel) { el.hidden = true; return; }
  const { u, r, c } = CV.sel, un = CV.v.units.find(x => x.id === u), b = un && un.slots[r + ',' + c];
  el.hidden = false;
  if (!b) {
    el.innerHTML = '<div class="cv-info-top"><div><div class="cv-maison">Posto libero</div><div class="cv-cuvee">' + cvEsc(cvPosText(u, r, c)) + '</div></div><button class="cv-x" data-a="close" aria-label="Chiudi">×</button></div>' +
      '<div class="cv-acts"><button class="cv-btn gold" data-a="add">Aggiungi bottiglia</button></div>';
    return;
  }
  const t = CV_TYPES[b.kind] || CV_TYPES.champagne;
  const extra = [];
  if (b.sboccatura) extra.push('sboccatura ' + b.sboccatura);
  if (b.price != null) extra.push('€ ' + Number(b.price).toLocaleString('it-IT', { minimumFractionDigits: 0, maximumFractionDigits: 2 }));
  if (b.purchased_at) extra.push('acquistata il ' + new Date(b.purchased_at + 'T12:00:00').toLocaleDateString('it-IT'));
  const th = (field, label) => b[field]
    ? '<button class="cv-th" data-a="photo" data-f="' + field + '" aria-label="' + label + '"><img src="' + cvEsc(b[field]) + '" alt="' + label + '"></button>'
    : '<button class="cv-th empty" data-a="photo" data-f="' + field + '" aria-label="Aggiungi ' + label + '"><i class="ti ti-camera-plus"></i><span>' + label + '</span></button>';
  el.innerHTML = '<div class="cv-info-top"><div style="flex:1;min-width:0;"><div class="cv-maison">' + cvEsc(b.maison) + '</div><div class="cv-cuvee">' + cvEsc(b.cuvee) + '</div></div>' +
    '<div class="cv-ths">' + th('photo_url', 'Fronte') + th('photo_back_url', 'Retro') + '</div><button class="cv-x" data-a="close" aria-label="Chiudi">×</button></div>' +
    '<div class="cv-tags"><span class="cv-tag"><i style="display:inline-block;width:8px;height:8px;border-radius:50%;background:' + t.dot + ';margin-right:5px"></i>' + t.label + '</span><span class="cv-tag">' + cvEsc(cvYearText(b)) + '</span>' +
    extra.map(x => '<span class="cv-tag">' + cvEsc(x) + '</span>').join('') + '</div>' +
    (b.notes ? '<div class="cv-pos" style="color:var(--ink-4);font-style:italic;">“' + cvEsc(b.notes.length > 90 ? b.notes.slice(0, 90) + '…' : b.notes) + '”</div>' : '') +
    '<div class="cv-pos">' + cvEsc(cvPosText(u, r, c)) + '</div>' +
    '<div class="cv-acts"><button class="cv-btn gold" data-a="open">Stappa</button><button class="cv-btn" data-a="move">Sposta</button><button class="cv-btn danger" data-a="remove">Rimuovi</button></div>';
}
cvEl('cv-info').addEventListener('click', e => {
  const a = e.target.closest('[data-a]'); if (!a) return;
  const act = a.dataset.a;
  if (act === 'cancelmove') { CV.moveId = null; cvRefresh(false); return; }
  if (!CV.sel) return;
  const { u, r, c } = CV.sel, un = CV.v.units.find(x => x.id === u), b = un && un.slots[r + ',' + c];
  switch (act) {
    case 'close': CV.sel = null; cvRefresh(false); break;
    case 'lock': cvLock(); break;
    case 'add': cvStartAdd({ unit: u, row: r, col: c }); break;
    case 'move': if (b) { CV.moveId = b.id; CV.sel = null; cvRefresh(false); } break;
    case 'open': if (b) cvStappa(b); break;
    case 'photo': if (b) cvPhotoTap(b, a.dataset.f); break;
    case 'remove': if (b) cvRemove(b); break;
  }
});

/* ───────── Azioni sui posti e sulle bottiglie ───────── */
async function cvOnSlot(unitId, r, c) {
  const un = CV.v.units.find(x => x.id === unitId); if (!un) return;
  const occ = un.slots[r + ',' + c];
  if (CV.moveId) {
    if (occ) { cvToast('Scegli un posto libero'); return; }
    await cvMove(CV.moveId, unitId, r, c); return;
  }
  CV.sel = { u: unitId, r, c };
  cvRefresh(false);
  if (CV.T3 && CV.view === '3d') cvUpdateSel3D(true);
}
async function cvMove(id, unitId, r, c) {
  if (!cvCanEdit()) { cvLock(); return; }
  const { error } = await supa.from('cellar_bottles').update({ unit_id: unitId, slot_row: r, slot_col: c }).eq('id', id);
  if (error) { cvToast(cvErrText(error)); return; }
  Object.assign(cvBottleById(id), { unit_id: unitId, slot_row: r, slot_col: c });
  CV.moveId = null; CV.sel = { u: unitId, r, c }; cvToast('Bottiglia spostata');
  cvRefresh(true);
}
async function cvDeleteBottle(b) {
  if (!cvCanEdit()) { cvLock(); return false; }
  const { error } = await supa.from('cellar_bottles').delete().eq('id', b.id);
  if (error) { cvToast(cvErrText(error)); return false; }
  CV.bottles = CV.bottles.filter(x => x.id !== b.id); CV.sel = null;
  return true;
}
async function cvRemove(b) {
  const i = await cvAsk('Rimuovere la bottiglia?', '«' + b.cuvee + '» esce dalla cantina. Non finisce nel Carnet.', [{ label: 'Rimuovi', cls: 'danger' }]);
  if (i !== 0) return;
  if (await cvDeleteBottle(b)) { cvToast('Bottiglia rimossa'); cvRefresh(true); cvDeleteOwnPhotos([b.photo_url, b.photo_back_url]); }
}
async function cvStappa(b) {
  const i = await cvAsk('Stappata!', '«' + b.cuvee + '» esce dalla cantina. Vuoi scrivere subito la nota di degustazione?',
    [{ label: 'Sì, scrivi la nota', cls: 'gold' }, { label: 'Solo toglila dalla cantina' }]);
  if (i < 0) return;
  if (!(await cvDeleteBottle(b))) return;
  cvRefresh(true);
  if (i === 0) await cvOpenCarnet(b);   // la foto resta: la usa la nota del Carnet
  else { cvToast('Bottiglia tolta dalla cantina'); cvDeleteOwnPhotos([b.photo_url, b.photo_back_url]); }
}
async function cvOpenCarnet(b) {
  try { await ensureBottiglieLoaded(); } catch (_) { /* si prosegue con i dati della cantina */ }
  if (b.catalog_id && allBottiglie.find(x => x.id === b.catalog_id)) openNewNoteFromBottiglia(b.catalog_id);
  else {
    // Bottiglia non in catalogo: si usa lo stesso percorso, con una scheda "finta" e senza legarla al catalogo
    const prev = currentBottiglia;
    currentBottiglia = { id: 'cellar-tmp', nome: b.cuvee, annata: (b.year && b.year !== 'NV') ? b.year : null, maison: { nome: b.maison },
      tipo: b.kind === 'rose' ? 'rose' : null, dosaggio_tipo: '', foto_url: b.photo_url || null };
    openNewNoteFromBottiglia('cellar-tmp');
    const hid = document.getElementById('note-bottiglia-id'); if (hid) hid.value = '';
    currentBottiglia = prev;
  }
  // La sboccatura, se la conoscevamo già dalla cantina, non va persa passando al Carnet
  if (b.sboccatura) { const el = document.getElementById('note-sboccatura'); if (el) el.value = b.sboccatura; }
}

/* ───────── Foto ───────── */
const cvReadFile = f => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(f); });
function cvPickPhoto(cb) {
  const i = document.createElement('input'); i.type = 'file'; i.accept = 'image/*';
  i.onchange = async () => {
    const f = i.files && i.files[0]; if (!f) return;
    try { cb(await _compressDataUrl(await cvReadFile(f), 1200, 0.8)); } catch (_) { cvToast('Non riesco a leggere la foto'); }
  };
  i.click();
}
async function cvUploadPhoto(dataUrl) {
  const blob = await (await fetch(dataUrl)).blob();
  const path = currentUser.id + '/cellar_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7) + '.jpg';
  const { error } = await supa.storage.from('carnet-photos').upload(path, blob, { contentType: 'image/jpeg', upsert: true });
  if (error) throw error;
  return supa.storage.from('carnet-photos').getPublicUrl(path).data.publicUrl;
}
// Percorso di una foto caricata da qui (solo quelle: mai le foto del catalogo o del Carnet)
function cvOwnPath(url) {
  if (!url) return null;
  const m = '/carnet-photos/', i = url.indexOf(m); if (i < 0) return null;
  let p; try { p = decodeURIComponent(url.slice(i + m.length).split('?')[0]); } catch (_) { return null; }
  return p.startsWith(currentUser.id + '/cellar_') ? p : null;
}
// Toglie dallo spazio le foto non più usate da nessuna bottiglia della cantina
async function cvDeleteOwnPhotos(urls) {
  const inUse = new Set();
  CV.bottles.forEach(b => { inUse.add(b.photo_url); inUse.add(b.photo_back_url); });
  const paths = [...new Set(urls)].filter(u => u && !inUse.has(u)).map(cvOwnPath).filter(Boolean);
  if (paths.length) { try { await supa.storage.from('carnet-photos').remove(paths); } catch (_) { /* resta un file inutilizzato, non è un problema */ } }
}
async function cvSetPhoto(b, field, dataUrl) {
  if (!cvCanEdit()) { cvLock(); return false; }
  const old = b[field]; let url = null;
  if (dataUrl) { try { url = await cvUploadPhoto(dataUrl); } catch (e) { cvToast('Foto non caricata: ' + cvErrText(e)); return false; } }
  const { error } = await supa.from('cellar_bottles').update({ [field]: url }).eq('id', b.id);
  if (error) { cvToast(cvErrText(error)); if (url) cvDeleteOwnPhotos([url]); return false; }
  b[field] = url; cvRefresh(false); cvDeleteOwnPhotos([old]);
  return true;
}
function cvPhotoTap(b, field) {
  if (!cvCanEdit()) { cvLock(); return; }
  if (!b[field]) { cvPickPhoto(d => cvSetPhoto(b, field, d)); return; }
  const label = field === 'photo_url' ? 'Fronte' : 'Controetichetta';
  const ov = document.createElement('div'); ov.className = 'cv-photo';
  ov.innerHTML = '<img src="' + cvEsc(b[field]) + '" alt="' + label + '"><div class="cv-photo-bar"><span>' + label + ' · ' + cvEsc(b.cuvee) + '</span><div>' +
    '<button data-a="change">Cambia foto</button><button data-a="remove">Rimuovi</button><button data-a="close">Chiudi</button></div></div>';
  document.body.appendChild(ov);
  ov.onclick = async e => {
    const a = e.target.closest('[data-a]');
    if (!a && e.target.tagName !== 'IMG' && e.target !== ov) return;
    if (a && a.dataset.a === 'change') { cvPickPhoto(async d => { if (await cvSetPhoto(b, field, d)) ov.remove(); }); return; }
    if (a && a.dataset.a === 'remove') { if (await cvSetPhoto(b, field, null)) ov.remove(); return; }
    ov.remove();
  };
}

/* ───────── Schede a comparsa ───────── */
function cvSheet(html, keepScroll) {
  const sh = cvEl('cv-sheet'), sc = sh.scrollTop;
  sh.innerHTML = html; sh.onclick = null; sh.oninput = null;
  cvEl('cv-sheet-bg').hidden = false;
  sh.scrollTop = keepScroll ? sc : 0;
}
function cvCloseSheet() { cvEl('cv-sheet-bg').hidden = true; cvEl('cv-sheet').onclick = null; cvEl('cv-sheet').oninput = null; }
cvEl('cv-sheet-bg').addEventListener('click', e => { if (e.target === cvEl('cv-sheet-bg')) cvCloseSheet(); });

// Domanda con pulsanti: restituisce l'indice del pulsante scelto, -1 se annulla
function cvAsk(title, text, buttons) {
  return new Promise(res => {
    cvSheet('<h2>' + cvEsc(title) + '</h2><p class="cv-sub">' + cvEsc(text) + '</p>' +
      buttons.map((b, i) => '<button class="cv-btn ' + (b.cls || '') + '" data-i="' + i + '" style="width:100%;margin-bottom:8px;padding:14px;flex:none;">' + cvEsc(b.label) + '</button>').join('') +
      '<button class="cv-btn" data-i="-1" style="width:100%;padding:14px;flex:none;">Annulla</button>');
    const bg = cvEl('cv-sheet-bg'), h = e => { if (e.target === bg) { bg.removeEventListener('click', h); res(-1); } };
    cvEl('cv-sheet').onclick = e => { const b = e.target.closest('[data-i]'); if (!b) return; bg.removeEventListener('click', h); cvCloseSheet(); res(+b.dataset.i); };
    bg.addEventListener('click', h);
  });
}

/* ───────── Aggiungere bottiglie ───────── */
function cvStartAdd(target) {
  if (!cvCanEdit()) { cvLock(); return; }
  CV.target = target || null;
  cvSheet('<h2>Aggiungi bottiglia</h2>' +
    '<button class="cv-opt" data-a="scan"><span class="ic"><i class="ti ti-scan"></i></span><span>Scansiona etichetta<small>La riconosco io: Maison, cuvée e annata</small></span></button>' +
    '<button class="cv-opt" data-a="catalog"><span class="ic"><i class="ti ti-search"></i></span><span>Cerca nel catalogo<small>Scegli tra le cuvée di Cuvée</small></span></button>' +
    '<button class="cv-opt" data-a="manual"><span class="ic"><i class="ti ti-pencil"></i></span><span>Inserisci a mano<small>Per altri vini o bottiglie non in catalogo</small></span></button>');
  cvEl('cv-sheet').onclick = e => {
    const a = e.target.closest('[data-a]'); if (!a) return;
    if (a.dataset.a === 'scan') {
      CV.scanTarget = { cellar: CV.cur, target: CV.target, at: Date.now() };
      cvCloseSheet(); startScan('explore');
    } else if (a.dataset.a === 'catalog') cvOpenCatalogSearch();
    else cvOpenForm({});
  };
}
async function cvOpenCatalogSearch() {
  cvSheet('<h2>Cerca nel catalogo</h2><input type="search" id="cvq" placeholder="Maison o cuvée" aria-label="Cerca" autocomplete="off"><div id="cvq-list"><p class="cv-hintp">Carico il catalogo…</p></div>');
  try { await ensureBottiglieLoaded(); } catch (_) { /* gestito sotto */ }
  const list = q => {
    const tok = cvNorm(q).split(/\s+/).filter(Boolean);
    if (!allBottiglie.length) return '<p class="cv-hintp">Catalogo non disponibile, riprova tra poco.</p>';
    if (cvNorm(q).length < 2) return '<p class="cv-hintp">Scrivi almeno 2 lettere.</p>';
    const hits = allBottiglie.filter(b => { const h = cvNorm((b.maison && b.maison.nome) + ' ' + b.nome); return tok.every(t => h.includes(t)); }).slice(0, 40);
    if (!hits.length) return '<p class="cv-hintp">Nessun risultato. Puoi inserirla a mano.</p>';
    return hits.map(b => '<button class="cv-row" data-id="' + b.id + '"><i style="background:' + (b.tipo === 'rose' ? CV_TYPES.rose.dot : CV_TYPES.champagne.dot) + '"></i><span>' + cvEsc(b.maison && b.maison.nome) + ' · ' + cvEsc(b.nome) + '<small>' + (b.annata ? b.annata : 'Senza annata') + '</small></span></button>').join('');
  };
  const q = cvEl('cvq'); if (!q) return;
  q.addEventListener('input', () => { cvEl('cvq-list').innerHTML = list(q.value); });
  cvEl('cvq-list').innerHTML = list('');
  cvEl('cvq-list').onclick = e => {
    const r = e.target.closest('[data-id]'); if (!r) return;
    const b = allBottiglie.find(x => x.id === r.dataset.id); if (b) cvOpenForm(cvPrefillFromCatalog(b));
  };
}
function cvPrefillFromCatalog(b) {
  return {
    maison: (b.maison && b.maison.nome) || '', cuvee: b.nome || '', year: b.annata ? String(b.annata) : 'NV',
    kind: /ros[eé]/i.test(String(b.tipo || '')) ? 'rose' : 'champagne',
    catalog_id: b.id, photo_url: b.foto_url && /^https?:/.test(b.foto_url) ? b.foto_url : null
  };
}
function cvPrefillFromScan(r) {
  const m = r.matched_bottle || {};
  let kind = 'champagne';
  if (r.is_champagne === false) {
    const t = String(r.not_champagne_type || '').toLowerCase();
    kind = /ross/.test(t) ? 'rosso' : /bianc/.test(t) ? 'bianco' : 'spumante';
  } else if (/ros[eé]/i.test(String(r.tipo || m.tipo || ''))) kind = 'rose';
  // La foto scattata dall'utente ha la precedenza; altrimenti quella già salvata in catalogo
  const own = (typeof _scanPhotoDataUrl === 'string' && _scanPhotoDataUrl) || '';
  const fallback = [r.uploaded_photo_url, m.foto_url].find(u => u && /^https?:/.test(u)) || null;
  return {
    maison: r.maison || (m.maison && m.maison.nome) || '', cuvee: r.cuvee || m.nome || '',
    year: r.is_sa ? 'NV' : String(r.annata || m.annata || ''), kind,
    catalog_id: r.matched_bottle_id || m.id || null,
    photo_url: /^https?:/.test(own) ? own : fallback, photo_data: /^data:image/.test(own) ? own : null
  };
}
// Punti d'ingresso dal catalogo e dalla scansione
async function cvAddFromCatalog(bottId) {
  if (!cvEnabled()) return;
  if (!cvCanEdit()) { cvLock(); return; }
  const b = allBottiglie.find(x => x.id === bottId) || currentBottiglia; if (!b) return;
  try { await cvLoad(); } catch (e) { cvToast('Cantina non disponibile: ' + cvErrText(e)); return; }
  CV.target = null; cvOpenForm(cvPrefillFromCatalog(b));
}
async function cvAddFromScan(result) {
  result = result || _scanResult;
  if (!cvEnabled() || !result) return;
  if (!cvCanEdit()) { cvLock(); return; }
  try { await cvLoad(); } catch (e) { cvToast('Cantina non disponibile: ' + cvErrText(e)); return; }
  const st = CV.scanTarget && (Date.now() - CV.scanTarget.at < 30 * 60 * 1000) ? CV.scanTarget : null;
  CV.target = st ? st.target : null;
  if (st && CV.cellars.some(c => c.id === st.cellar)) CV.cur = st.cellar;
  cvOpenForm(cvPrefillFromScan(result));
}

function cvOpenForm(pre) {
  if (!CV.cellars.length) { cvOpenBuilder('new', { then: () => cvOpenForm(pre) }); return; }
  const F = {
    maison: pre.maison || '', cuvee: pre.cuvee || '', year: pre.year || '', kind: pre.kind || 'champagne', qty: 1,
    front: { url: pre.photo_url || null, data: pre.photo_data || null }, back: { data: null },
    sboccatura: '', price: '', date: '', notes: '', cellar: CV.cellars.some(c => c.id === CV.cur) ? CV.cur : CV.cellars[0].id
  };
  const target = CV.target && CV.v && CV.v.id === F.cellar ? CV.target : null;
  const phTile = (which, label) => {
    const p = F[which], src = p.data || p.url;
    return '<div class="cv-ph' + (src ? ' has' : '') + '" data-ph="' + which + '">' + (src ? '<img src="' + cvEsc(src) + '" alt="' + label + '">' : '<i class="ti ti-camera-plus"></i><span>Aggiungi foto</span>') +
      '<em>' + label + '</em>' + (src ? '<button class="cv-ph-x" data-phx="' + which + '" aria-label="Rimuovi foto">×</button>' : '') + '</div>';
  };
  const draw = () => {
    const where = target ? 'Nel posto scelto: ' + cvPosText(target.unit, target.row, target.col) : 'Nel primo posto libero della cantina';
    cvSheet('<h2>Dettagli bottiglia</h2>' +
      '<label class="cv-lab">Maison o produttore</label><input type="text" id="cvf-maison" value="' + cvEsc(F.maison) + '" maxlength="80" autocomplete="off">' +
      '<label class="cv-lab">Cuvée o nome del vino</label><input type="text" id="cvf-cuvee" value="' + cvEsc(F.cuvee) + '" maxlength="120" autocomplete="off">' +
      '<label class="cv-lab">Annata (NV se senza annata)</label><input type="text" id="cvf-year" value="' + cvEsc(F.year) + '" maxlength="12" placeholder="Es. 2013 oppure NV" autocomplete="off">' +
      '<label class="cv-lab">Sboccatura (se la conosci)</label><input type="text" id="cvf-sboccatura" value="' + cvEsc(F.sboccatura) + '" maxlength="20" placeholder="Es. 03/2025" autocomplete="off">' +
      '<label class="cv-lab">Tipo</label><div class="cv-kinds">' + Object.entries(CV_TYPES).map(([k, t]) =>
        '<button data-k="' + k + '" class="' + (F.kind === k ? 'on' : '') + '"><i style="background:' + t.dot + '"></i>' + t.label + '</button>').join('') + '</div>' +
      '<label class="cv-lab">Foto</label><div class="cv-phs">' + phTile('front', 'Fronte') + phTile('back', 'Controetichetta') + '</div>' +
      '<div class="cv-qty"><span>Quante bottiglie</span><div><button data-q="-1" ' + (F.qty <= 1 ? 'disabled' : '') + ' aria-label="Meno">−</button><b>' + F.qty + '</b><button data-q="1" ' + (F.qty >= 60 ? 'disabled' : '') + ' aria-label="Più">+</button></div></div>' +
      '<div class="cv-two"><div><label class="cv-lab">Prezzo pagato (€)</label><input type="text" inputmode="decimal" id="cvf-price" value="' + cvEsc(F.price) + '" placeholder="Facoltativo"></div>' +
      '<div><label class="cv-lab">Data d\'acquisto</label><input type="date" id="cvf-date" value="' + cvEsc(F.date) + '"></div></div>' +
      '<label class="cv-lab">Nota (facoltativa)</label><textarea id="cvf-notes" maxlength="500" placeholder="Es. regalo, da bere a Natale…">' + cvEsc(F.notes) + '</textarea>' +
      (CV.cellars.length > 1 && !target ? '<label class="cv-lab">In quale cantina</label><select id="cvf-cellar">' + CV.cellars.map(c => '<option value="' + c.id + '"' + (c.id === F.cellar ? ' selected' : '') + '>' + cvEsc(c.name) + '</option>').join('') + '</select>' : '') +
      '<div class="cv-where">' + cvEsc(where) + '</div>' +
      '<button class="cv-btn gold" id="cvf-save" style="width:100%;padding:14px;">Aggiungi in cantina</button>', true);
    const sh = cvEl('cv-sheet');
    sh.oninput = e => {
      const id = e.target.id;
      if (id === 'cvf-maison') F.maison = e.target.value; else if (id === 'cvf-cuvee') F.cuvee = e.target.value;
      else if (id === 'cvf-year') F.year = e.target.value; else if (id === 'cvf-sboccatura') F.sboccatura = e.target.value;
      else if (id === 'cvf-price') F.price = e.target.value;
      else if (id === 'cvf-date') F.date = e.target.value; else if (id === 'cvf-notes') F.notes = e.target.value;
    };
    sh.onchange = e => { if (e.target.id === 'cvf-cellar') { F.cellar = e.target.value; CV.cur = F.cellar; CV.v = cvBuildView(); draw(); } };
    sh.onclick = async e => {
      const px = e.target.closest('[data-phx]'); if (px) { F[px.dataset.phx] = {}; draw(); return; }
      const ph = e.target.closest('[data-ph]'); if (ph) { cvPickPhoto(d => { F[ph.dataset.ph] = { data: d }; draw(); }); return; }
      const k = e.target.closest('[data-k]'); if (k) { F.kind = k.dataset.k; draw(); return; }
      const q = e.target.closest('[data-q]'); if (q) { F.qty = Math.max(1, Math.min(60, F.qty + +q.dataset.q)); draw(); return; }
      if (e.target.id === 'cvf-save') await save();
    };
  };
  const save = async () => {
    const maison = F.maison.trim(), cuvee = F.cuvee.trim();
    if (!maison || !cuvee) { cvToast('Inserisci produttore e nome'); return; }
    let year = F.year.trim(); if (/^nv$/i.test(year)) year = 'NV';
    const priceRaw = F.price.trim().replace(',', '.');
    if (priceRaw && !(Number(priceRaw) >= 0)) { cvToast('Il prezzo non è valido'); return; }
    const btn = cvEl('cvf-save'); btn.disabled = true; btn.textContent = 'Aggiungo…';
    let front = F.front.url || '', back = '';
    try {
      if (F.front.data) front = await cvUploadPhoto(F.front.data);
      if (F.back.data) back = await cvUploadPhoto(F.back.data);
    } catch (e) { cvToast('Foto non caricata: ' + cvErrText(e)); btn.disabled = false; btn.textContent = 'Aggiungi in cantina'; return; }
    const bottle = { maison, cuvee, year, kind: F.kind, catalog_id: pre.catalog_id || '', photo_url: front, photo_back_url: back, sboccatura: F.sboccatura.trim(), price: priceRaw, purchased_at: F.date, notes: F.notes.trim() };
    const t = target && target.unit ? target : null;
    const { data, error } = await supa.rpc('cellar_add_bottles', {
      p_cellar: F.cellar, p_unit: t ? t.unit : null, p_row: t ? t.row : null, p_col: t ? t.col : null, p_bottle: bottle, p_qty: F.qty
    });
    if (error) { cvToast(cvErrText(error)); btn.disabled = false; btn.textContent = 'Aggiungi in cantina'; cvDeleteOwnPhotos([F.front.data ? front : '', back]); return; }
    const placed = typeof data === 'number' ? data : F.qty;
    try { await cvLoad(true); } catch (_) { /* la lista si aggiorna alla prossima apertura */ }
    CV.cur = F.cellar; CV.sel = null; CV.moveId = null; CV.target = null; CV.scanTarget = null;
    cvCloseSheet();
    cvToast(F.qty === 1 ? 'Bottiglia aggiunta in cantina' : F.qty + ' bottiglie aggiunte in cantina' + (placed < F.qty ? ' · ' + (F.qty - placed) + ' non posizionate' : ''));
    const active = document.querySelector('.view.active');
    if (active && active.id === 'v-cantina') cvRefresh(true); else go('v-cantina');
  };
  draw();
}

/* ───────── Creare e modificare le cantine ───────── */
function cvOpenBuilder(mode, opts) {
  if (!cvCanEdit()) { cvLock(); return; }
  opts = opts || {};
  const isNew = mode === 'new';
  if (!isNew && !CV.v) return;
  const D = isNew
    ? { name: CV.cellars.length ? 'Nuova cantina' : 'Casa', units: [{ id: null, kind: 'fridge', name: 'Cantinetta', cols: 6, rows: 4 }] }
    : { name: CV.v.name, units: CV.v.units.map(u => ({ id: u.id, kind: u.kind, name: u.name, cols: u.cols, rows: u.rows })) };
  const seats = () => D.units.reduce((n, u) => n + u.cols * u.rows, 0);
  // Bottiglie che, con le nuove misure, non avrebbero più un posto
  const lostCount = () => {
    if (isNew) return 0;
    let n = 0;
    CV.v.units.forEach(u => {
      const d = D.units.find(x => x.id === u.id);
      Object.keys(u.slots).forEach(k => { const [r, c] = k.split(',').map(Number); if (!d || r >= d.rows || c >= d.cols) n++; });
    });
    return n;
  };
  const presets = [['Cantinetta 6×4', [['fridge', 6, 4]]], ['Scaffale 8×6', [['rack', 8, 6]]], ['Cantinetta + scaffale', [['fridge', 6, 4], ['rack', 8, 6]]]];
  const draw = () => {
    const tot = seats(), over = tot > CV_LIM.seats, lost = lostCount();
    let h = '<h2>' + (isNew ? 'Nuova cantina' : 'Modifica cantina') + '</h2><input type="text" id="cvb-name" value="' + cvEsc(D.name) + '" maxlength="30" aria-label="Nome della cantina">';
    if (isNew) h += '<div class="cv-presets">' + presets.map((p, i) => '<button data-a="preset" data-i="' + i + '">' + p[0] + '</button>').join('') + '</div>';
    D.units.forEach((u, i) => {
      const fr = u.kind === 'fridge';
      h += '<div class="cv-bu"><div class="cv-bu-top"><div class="cv-kseg"><button data-a="kind" data-i="' + i + '" data-v="fridge" class="' + (fr ? 'on' : '') + '">Cantinetta</button><button data-a="kind" data-i="' + i + '" data-v="rack" class="' + (fr ? '' : 'on') + '">Scaffale</button></div>' +
        '<div class="cv-bu-links">' + (D.units.length < CV_LIM.units ? '<button class="cv-link" data-a="dup" data-i="' + i + '">Duplica</button>' : '') + (D.units.length > 1 ? '<button class="cv-link red" data-a="del" data-i="' + i + '">Rimuovi</button>' : '') + '</div></div>' +
        '<input type="text" data-name="' + i + '" value="' + cvEsc(u.name) + '" maxlength="30" aria-label="Nome dell\'elemento" style="margin-bottom:8px">' +
        '<div class="cv-steps">' +
        ['cols', 'rows'].map(f => '<div class="cv-step"><span>' + (f === 'cols' ? 'Colonne' : (fr ? 'Ripiani' : 'Righe')) + '</span><div><button data-a="st" data-i="' + i + '" data-f="' + f + '" data-d="-1" ' + (u[f] <= 1 ? 'disabled' : '') + ' aria-label="Meno">−</button><b>' + u[f] + '</b><button data-a="st" data-i="' + i + '" data-f="' + f + '" data-d="1" ' + (u[f] >= CV_LIM[f] ? 'disabled' : '') + ' aria-label="Più">+</button></div></div>').join('') +
        '</div><div class="cv-seats">' + u.cols + ' × ' + u.rows + ' = ' + u.cols * u.rows + ' posti</div></div>';
    });
    h += '<button class="cv-addu" data-a="addu" ' + (D.units.length >= CV_LIM.units ? 'disabled' : '') + '>+ Aggiungi elemento</button>' +
      '<div class="cv-tot' + (over ? ' warn' : '') + '">Totale ' + tot + ' posti · ' + D.units.length + (D.units.length === 1 ? ' elemento' : ' elementi') +
      (over ? '<br>Massimo ' + CV_LIM.seats + ' posti per cantina: per averne di più crea una seconda cantina.' : '') + '</div>' +
      (lost > 0 ? '<div class="cv-warnp">' + lost + (lost === 1 ? ' bottiglia resta fuori' : ' bottiglie restano fuori') + ' dalle nuove misure: finiranno in “Non posizionate”, senza perderle.</div>' : '') +
      '<button class="cv-btn gold" data-a="save" style="width:100%;padding:14px;" ' + (over ? 'disabled' : '') + '>' + (isNew ? 'Crea cantina' : 'Salva modifiche') + '</button>' +
      (!isNew ? '<button class="cv-delete-cellar" data-a="delcellar">Elimina questa cantina</button>' : '');
    cvSheet(h, true);
    const sh = cvEl('cv-sheet');
    sh.onclick = onClick;
    sh.oninput = e => {
      if (e.target.id === 'cvb-name') D.name = e.target.value;
      else if (e.target.dataset.name !== undefined) D.units[+e.target.dataset.name].name = e.target.value;
    };
  };
  const onClick = async e => {
    const b = e.target.closest('[data-a]'); if (!b) return;
    const i = +b.dataset.i;
    switch (b.dataset.a) {
      case 'preset': D.units = presets[i][1].map(d => ({ id: null, kind: d[0], name: CV_UNIT_NAME[d[0]], cols: d[1], rows: d[2] })); break;
      case 'kind': { const u = D.units[i]; if (u.name === CV_UNIT_NAME[u.kind]) u.name = CV_UNIT_NAME[b.dataset.v]; u.kind = b.dataset.v; break; }
      case 'del': D.units.splice(i, 1); break;
      case 'dup': { const u = D.units[i]; D.units.splice(i + 1, 0, { id: null, kind: u.kind, name: (u.name + ' 2').slice(0, 30), cols: u.cols, rows: u.rows }); break; }
      case 'addu': D.units.push({ id: null, kind: 'rack', name: CV_UNIT_NAME.rack, cols: 6, rows: 4 }); break;
      case 'st': { const u = D.units[i], f = b.dataset.f; u[f] = Math.max(1, Math.min(CV_LIM[f], u[f] + +b.dataset.d)); break; }
      case 'delcellar': await deleteCellar(); return;
      case 'save': await save(b); return;
    }
    draw();
  };
  const unitsPayload = () => D.units.map(u => ({ id: u.id || undefined, kind: u.kind, name: (u.name.trim() || CV_UNIT_NAME[u.kind]).slice(0, 30), cols: u.cols, rows: u.rows }));
  const save = async btn => {
    const name = (D.name.trim() || 'Cantina').slice(0, 30);
    btn.disabled = true; btn.textContent = 'Salvo…';
    let res;
    if (isNew) res = await supa.rpc('cellar_create', { p_name: name, p_units: unitsPayload() });
    else res = await supa.rpc('cellar_save_layout', { p_cellar: CV.v.id, p_name: name, p_units: unitsPayload() });
    if (res.error) { cvToast(cvErrText(res.error)); btn.disabled = false; btn.textContent = isNew ? 'Crea cantina' : 'Salva modifiche'; return; }
    try { await cvLoad(true); } catch (_) { /* ricaricata alla prossima apertura */ }
    if (isNew) CV.cur = res.data;
    CV.sel = null; CV.moveId = null; cvCloseSheet();
    const moved = !isNew && typeof res.data === 'number' ? res.data : 0;
    cvToast(isNew ? 'Cantina creata' : (moved > 0 ? 'Cantina aggiornata · ' + moved + ' in “Non posizionate”' : 'Cantina aggiornata'));
    const active = document.querySelector('.view.active');
    if (active && active.id === 'v-cantina') { cvRefresh(true); if (CV.T3 && CV.view === '3d') cvCam('over'); } else go('v-cantina');
    if (opts.then) opts.then();
  };
  const deleteCellar = async () => {
    const n = CV.bottles.filter(x => x.cellar_id === CV.v.id).length;
    const i = await cvAsk('Eliminare la cantina?', '«' + CV.v.name + '»' + (n ? ' e le sue ' + n + ' bottiglie' : '') + ' verranno spostate nel cestino per ' + CV_TRASH_DAYS + ' giorni: potrai ripristinarla in qualsiasi momento da lì. Dopo, spariscono per sempre.', [{ label: 'Elimina cantina', cls: 'danger' }]);
    if (i !== 0) { draw(); return; }
    const { error } = await supa.rpc('cellar_trash', { p_cellar: CV.v.id });
    if (error) { cvToast(cvErrText(error)); return; }
    CV.cur = null; try { await cvLoad(true); } catch (_) { /* vedi sopra */ }
    CV.sel = null; cvToast('Cantina spostata nel cestino · la ripristini entro ' + CV_TRASH_DAYS + ' giorni'); cvRefresh(true);
  };
  draw();
}
function cvOpenBuilderIfEmpty() { if (!CV.cellars.length) cvOpenBuilder('new'); }

/* ───────── Ricerca fra tutte le cantine ───────── */
function cvPosTextIn(unit, r, c) {
  return unit.kind === 'fridge' ? unit.name + ' · ripiano ' + (r + 1) + ', posto ' + (c + 1) : unit.name + ' · riga ' + CV_ROWL[r] + ', posto ' + (c + 1);
}
function cvSearchIndex() {
  const cellarById = new Map(CV.cellars.map(c => [c.id, c]));
  const unitById = new Map(CV.units.map(u => [u.id, u]));
  return CV.bottles
    .filter(b => cellarById.has(b.cellar_id))
    .map(b => {
      const cellar = cellarById.get(b.cellar_id);
      const unit = b.unit_id ? unitById.get(b.unit_id) : null;
      const where = unit ? cellar.name + ' · ' + cvPosTextIn(unit, b.slot_row, b.slot_col) : cellar.name + ' · non posizionata';
      return { b, cellarId: cellar.id, unitId: b.unit_id, r: b.slot_row, c: b.slot_col, where };
    });
}
function cvOpenSearch() {
  cvSheet('<h2>Cerca in cantina</h2><input type="search" id="cvsq" placeholder="Maison o cuvée" aria-label="Cerca" autocomplete="off"><div id="cvsq-list"></div>');
  const index = cvSearchIndex();
  const list = q => {
    const tok = cvNorm(q).split(/\s+/).filter(Boolean);
    if (!tok.length) return '<p class="cv-hintp">Scrivi il nome di una maison o di una cuvée.</p>';
    const hits = index.filter(x => { const h = cvNorm(x.b.maison + ' ' + x.b.cuvee); return tok.every(t => h.includes(t)); }).slice(0, 60);
    if (!hits.length) return '<p class="cv-hintp">Nessuna bottiglia trovata.</p>';
    return hits.map(x => '<button class="cv-row" data-jump="' + x.b.id + '"><i style="background:' + (CV_TYPES[x.b.kind] || CV_TYPES.champagne).dot + '"></i><span>' + cvEsc(x.b.maison) + ' · ' + cvEsc(x.b.cuvee) + '<small>' + cvEsc(cvYearText(x.b)) + ' · ' + cvEsc(x.where) + '</small></span></button>').join('');
  };
  const q = cvEl('cvsq'); if (!q) return;
  q.addEventListener('input', () => { cvEl('cvsq-list').innerHTML = list(q.value); });
  cvEl('cvsq-list').innerHTML = list('');
  cvEl('cvsq-list').onclick = e => {
    const r = e.target.closest('[data-jump]'); if (!r) return;
    cvCloseSheet();
    cvJumpToBottle(r.dataset.jump, index);
  };
}
// Porta l'utente dritto alla bottiglia trovata: cambia cantina se serve, passa alla mappa 2D, la seleziona
// e scorre fino a lì — sulle "non posizionate" non c'è un posto da cerchiare, quindi si scorre e basta.
function cvJumpToBottle(bottleId, index) {
  const hit = (index || cvSearchIndex()).find(x => x.b.id === bottleId);
  if (!hit) return;
  if (CV.cur !== hit.cellarId) { CV.cur = hit.cellarId; CV.sel = null; CV.moveId = null; }
  CV.view = '2d';
  cvSetView('2d');
  if (hit.unitId) { CV.sel = { u: hit.unitId, r: hit.r, c: hit.c }; CV.moveId = null; } else { CV.sel = null; CV.moveId = null; }
  cvRefresh(true);
  requestAnimationFrame(() => {
    const target = hit.unitId
      ? cvEl('cv-view2d').querySelector('[data-u="' + hit.unitId + '"]')?.closest('.cv-unit')
      : cvEl('cv-unplaced').querySelector('.cv-unit');
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      if (!hit.unitId) {
        const row = [...cvEl('cv-unplaced').querySelectorAll('[data-un]')].find(el => el.dataset.un === bottleId);
        if (row) { row.classList.add('cv-row-flash'); setTimeout(() => row.classList.remove('cv-row-flash'), 1800); }
      }
    }
  });
}

/* ───────── Cestino ───────── */
function cvOpenTrash() {
  const draw = () => {
    if (!CV.trash.length) { cvCloseSheet(); return; }
    const rows = CV.trash.map(c => {
      const d = cvTrashDaysLeft(c.deleted_at);
      const when = new Date(c.deleted_at).toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' });
      return '<div class="cv-trash-row"><div><b>' + cvEsc(c.name) + '</b><small>Eliminata il ' + when + ' · ' + (d === 1 ? 'sparisce domani' : 'sparisce tra ' + d + ' giorni') + '</small></div>' +
        '<button class="cv-btn gold" data-restore="' + c.id + '">Ripristina</button></div>';
    }).join('');
    cvSheet('<h2>Cestino</h2><p class="cv-sub">Le cantine eliminate restano qui ' + CV_TRASH_DAYS + ' giorni, poi spariscono per sempre. Puoi ripristinarle quando vuoi, prima che scada il tempo.</p>' + rows, true);
    cvEl('cv-sheet').onclick = async e => {
      const btn = e.target.closest('[data-restore]'); if (!btn) return;
      const id = btn.dataset.restore;
      btn.disabled = true; btn.textContent = 'Ripristino…';
      const { error } = await supa.rpc('cellar_restore', { p_cellar: id });
      if (error) { cvToast(cvErrText(error)); btn.disabled = false; btn.textContent = 'Ripristina'; return; }
      try { await cvLoad(true); } catch (_) { /* si aggiorna alla prossima apertura */ }
      CV.cur = id; cvCloseSheet(); cvToast('Cantina ripristinata'); cvRefresh(true);
    };
  };
  draw();
}

/* ═══════════════════════ VISTA 3D ═══════════════════════ */
function cvLoadScript(src) {
  return new Promise((res, rej) => {
    const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => rej(new Error('Impossibile caricare ' + src));
    document.head.appendChild(s);
  });
}
function cvEnsureThree() {
  if (window.THREE && THREE.OrbitControls) return Promise.resolve();
  if (!CV.threeP) {
    CV.threeP = (async () => {
      await cvLoadScript('js/vendor/three.min.js?v=1');
      await cvLoadScript('js/vendor/OrbitControls.js?v=1');
    })().catch(e => { CV.threeP = null; throw e; });
  }
  return CV.threeP;
}
async function cvSetView(v) {
  if (v !== '3d') cvExitFullscreen();
  CV.view = v;
  cvEl('cv-seg2d').classList.toggle('on', v === '2d'); cvEl('cv-seg3d').classList.toggle('on', v === '3d');
  cvEl('cv-view2d').hidden = v !== '2d'; cvEl('cv-view3d').hidden = v !== '3d';
  if (v === '3d') cvRenderThemes();
  if (v !== '3d') { if (CV.T3) CV.T3.active = false; return; }
  const stage = cvEl('cv-stage');
  try {
    if (!CV.T3) {
      stage.insertAdjacentHTML('beforeend', '<div class="cv-nogl" id="cv-loading3d">Carico la vista 3D…</div>');
      await cvEnsureThree();
      const ok = cvInit3D();
      const l = cvEl('cv-loading3d'); if (l) l.remove();
      if (!ok) return;
    }
  } catch (e) {
    const l = cvEl('cv-loading3d'); if (l) l.textContent = 'La vista 3D non è disponibile in questo momento.';
    return;
  }
  if (CV.view !== '3d' || !CV.v) return;
  CV.T3.active = true; cvResize3D(); cvBuild3D(); cvUpdateSel3D(false); cvTick3D();
}

function cvCanvasTex(w, h, draw, rx, ry) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx, ry);
  t.encoding = THREE.sRGBEncoding; t.anisotropy = 4; return t;
}
function cvRng(seed) { return function () { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function cvBrickTex() {
  const r = cvRng(3);
  return cvCanvasTex(512, 512, (x, w, h) => {
    x.fillStyle = '#2b1f18'; x.fillRect(0, 0, w, h);
    const bw = 96, bh = 32, g = 4;
    for (let row = 0; row < h / bh; row++) {
      const off = (row % 2) * bw / 2;
      for (let cx = -bw; cx < w + bw; cx += bw) {
        const l = 19 + r() * 10, hue = 12 + r() * 8;
        x.fillStyle = 'hsl(' + hue + ',32%,' + l + '%)'; x.fillRect(cx + off + g / 2, row * bh + g / 2, bw - g, bh - g);
        x.fillStyle = 'rgba(0,0,0,.12)'; x.fillRect(cx + off + g / 2, row * bh + bh - g - 3, bw - g, 3);
      }
    }
  }, 1, 1);
}
function cvTileTex() {
  const r = cvRng(11);
  return cvCanvasTex(256, 256, (x, w, h) => {
    x.fillStyle = '#2a1c14'; x.fillRect(0, 0, w, h);
    for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) {
      x.fillStyle = 'hsl(' + (16 + r() * 6) + ',' + (26 + r() * 8) + '%,' + (15 + r() * 8) + '%)'; x.fillRect(i * 128 + 3, j * 128 + 3, 122, 122);
    }
  }, 1, 1);
}
function cvWoodTex() {
  const r = cvRng(5);
  return cvCanvasTex(128, 128, (x, w, h) => {
    x.fillStyle = '#7c5230'; x.fillRect(0, 0, w, h);
    for (let i = 0; i < 70; i++) { x.strokeStyle = 'rgba(' + (r() < .5 ? '40,22,8' : '170,120,70') + ',' + (.10 + r() * .14) + ')'; x.lineWidth = 1 + r() * 1.5; const y = r() * h; x.beginPath(); x.moveTo(0, y); x.bezierCurveTo(w * .3, y + r() * 5 - 2.5, w * .7, y + r() * 5 - 2.5, w, y); x.stroke(); }
  }, 1, 1);
}
function cvPlaqueTex(text) {
  return cvCanvasTex(512, 80, (x, w, h) => {
    const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#d3ad55'); g.addColorStop(1, '#a07f22');
    x.fillStyle = g; x.fillRect(0, 0, w, h);
    x.strokeStyle = 'rgba(60,40,5,.55)'; x.lineWidth = 3; x.strokeRect(5, 5, w - 10, h - 10);
    x.fillStyle = '#2a1c06'; x.font = '600 38px "Cormorant Garamond",Georgia,serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText(text.toUpperCase().slice(0, 24).split('').join(String.fromCharCode(8202)), w / 2, h / 2 + 2);
  }, 1, 1);
}

const CV_THEMES = {
  brick:    { label: 'Mattoni', swatch: '#a5533a', brick: true, skirt: 0x3d2815, exposure: 1.15, cls: '' },
  ivory:    { label: 'Chiaro',  swatch: '#e6dfd2', wall: 0xf1ebdf, floor: 0xc2b6a3, skirt: 0xfaf6ee, exposure: .95, cls: 'cv-th-ivory' },
  graphite: { label: 'Scuro',   swatch: '#33353c', wall: 0x1e2025, floor: 0x141518, skirt: 0x34363d, exposure: .72, cls: 'cv-th-graphite' }
};
function cvTheme() {
  let k = 'brick'; try { k = localStorage.getItem('cuvee_cv_theme') || 'brick'; } catch (_) { /* si usa quello di default */ }
  return CV_THEMES[k] ? k : 'brick';
}
function cvRenderThemes() {
  const cur = cvTheme();
  cvEl('cv-themes').innerHTML = '<span>Sfondo</span>' + Object.entries(CV_THEMES).map(([k, t]) =>
    '<button data-th="' + k + '" class="' + (k === cur ? 'on' : '') + '"><i style="background:' + t.swatch + '"></i>' + t.label + '</button>').join('');
  const st = cvEl('cv-stage');
  Object.values(CV_THEMES).forEach(t => { if (t.cls) st.classList.remove(t.cls); });
  if (CV_THEMES[cur].cls) st.classList.add(CV_THEMES[cur].cls);
}
cvEl('cv-themes').addEventListener('click', e => {
  const b = e.target.closest('[data-th]'); if (!b) return;
  try { localStorage.setItem('cuvee_cv_theme', b.dataset.th); } catch (_) { /* vale solo per questa sessione */ }
  cvRenderThemes();
  if (CV.T3) { CV.T3.renderer.toneMappingExposure = CV_THEMES[cvTheme()].exposure; cvBuild3D(); cvUpdateSel3D(false); }
});
const CV_UNIT_GAP = .3, CV_ZB = -.5, CV_WALL_H = 1.5, CV_ROOM_D = 1.55;

function cvInit3D() {
  const el = cvEl('cv-stage');
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true }); }
  catch (e) { el.insertAdjacentHTML('afterbegin', '<div class="cv-nogl">La vista 3D non è disponibile su questo dispositivo.</div>'); return false; }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = CV_THEMES[cvTheme()].exposure;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  el.insertBefore(renderer.domElement, el.firstChild);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 1, .05, 30);
  const controls = new THREE.OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true; controls.dampingFactor = .09; controls.enablePan = false;
  controls.minDistance = .45; controls.maxPolarAngle = 1.5; controls.minPolarAngle = .5;
  controls.minAzimuthAngle = -1.15; controls.maxAzimuthAngle = 1.15; controls.rotateSpeed = .7;

  // Bottiglia: profilo ruotato, con l'asse lungo z (collo verso chi guarda). Ricalcato sulla
  // curva reale dell'icona bottiglia usata nel resto dell'app (stesso andamento del bordo nel
  // path SVG), con proporzioni realistiche sul raggio — non più il corpo corto e collo tozzo
  // di prima (sembrava una borraccia). Aggiunta anche una fascia-etichetta chiara sul corpo,
  // altrimenti da lontano/di sbieco si perde il senso "è una bottiglia vera".
  const prof = [[0, 0], [.018, .003], [.033, .012], [.039, .028], [.039, .0641], [.03629, .1113], [.02986, .1412], [.02216, .1652], [.01573, .195], [.013, .24], [.013, .265], [.016, .269], [.016, .281], [.0125, .284], [0, .285]].map(p => new THREE.Vector2(p[0], p[1]));
  const foilP = [[.018, .197], [.0155, .24], [.0155, .265], [.019, .269], [.019, .281], [.015, .284], [0, .287]].map(p => new THREE.Vector2(p[0], p[1]));
  const geoGlass = new THREE.LatheGeometry(prof, 22).rotateX(Math.PI / 2);
  const geoFoil = new THREE.LatheGeometry(foilP, 22).rotateX(Math.PI / 2);
  const geoLabel = new THREE.CylinderGeometry(.0396, .0396, .034, 22, 1, true).rotateX(Math.PI / 2).translate(0, 0, .047);
  const labelMat = new THREE.MeshStandardMaterial({ color: 0xf1e9d8, roughness: .85, metalness: 0, side: THREE.DoubleSide });
  const mats = {};
  Object.keys(CV_TYPES).forEach(k => {
    mats[k] = {
      glass: new THREE.MeshStandardMaterial({ color: CV_TYPES[k].glass, roughness: .18, metalness: .15, side: THREE.DoubleSide }),
      foil: new THREE.MeshStandardMaterial({ color: CV_TYPES[k].foil, roughness: .32, metalness: .55, emissive: CV_TYPES[k].foil, emissiveIntensity: .12, side: THREE.DoubleSide })
    };
  });
  const wood = new THREE.MeshStandardMaterial({ map: cvWoodTex(), roughness: .75 });
  const woodDark = new THREE.MeshStandardMaterial({ color: 0x3d2815, roughness: .9 });
  const carcass = new THREE.MeshStandardMaterial({ color: 0x17171b, roughness: .55, metalness: .4 });
  const ledMat = new THREE.MeshBasicMaterial({ color: 0xffe2b0 });
  const glassDoor = new THREE.MeshBasicMaterial({ color: 0x9fbcc4, transparent: true, opacity: .07, side: THREE.DoubleSide, depthWrite: false });
  const goldRing = new THREE.MeshBasicMaterial({ color: 0xf0c14b });
  const hitMat = new THREE.MeshBasicMaterial({ visible: false });

  scene.add(new THREE.HemisphereLight(0xffe9c8, 0x3a2a20, .5));
  const key = new THREE.DirectionalLight(0xffdcae, 1.0);
  key.position.set(-1.6, 3.2, 3); key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024); key.shadow.bias = -.0004;
  scene.add(key); scene.add(key.target);
  const fill = new THREE.PointLight(0xffb56b, .8, 5); fill.position.set(0, 1.3, .9); scene.add(fill);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(.056, .0045, 8, 40), goldRing); ring.visible = false; scene.add(ring);

  const T = CV.T3 = { el, renderer, scene, camera, controls, mats, geoGlass, geoFoil, geoLabel, labelMat, wood, woodDark, carcass, ledMat, glassDoor, hitMat, key, fill, ring,
    room: null, pick: [], slots: {}, active: false, goal: null, raycaster: new THREE.Raycaster(), Wr: 3, wallH: CV_WALL_H, textures: [], framed: false };

  controls.addEventListener('start', () => { T.goal = null; });
  // Tocco breve = selezione; trascinamento = rotazione
  let down = null;
  renderer.domElement.addEventListener('pointerdown', e => { down = { x: e.clientX, y: e.clientY, t: performance.now() }; });
  renderer.domElement.addEventListener('pointerup', e => {
    if (!down) return;
    const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y), dt = performance.now() - down.t; down = null;
    if (moved > 6 || dt > 600) return;
    const rc = renderer.domElement.getBoundingClientRect();
    const m = new THREE.Vector2(((e.clientX - rc.left) / rc.width) * 2 - 1, -((e.clientY - rc.top) / rc.height) * 2 + 1);
    T.raycaster.setFromCamera(m, camera);
    const hit = T.raycaster.intersectObjects(T.pick, false)[0];
    if (hit && hit.object.userData.slot) { const s = hit.object.userData.slot; cvOnSlot(s.u, s.r, s.c); }
  });
  new ResizeObserver(cvResize3D).observe(el);
  return true;
}
function cvResize3D() {
  const T = CV.T3; if (!T) return;
  const w = T.el.clientWidth, h = T.el.clientHeight; if (!w || !h) return;
  T.renderer.setSize(w, h); T.camera.aspect = w / h; T.camera.updateProjectionMatrix();
}
function cvOverviewGoal(az, el) {
  const T = CV.T3, fov = THREE.MathUtils.degToRad(T.camera.fov), asp = T.camera.aspect || .8;
  const fit = Math.max((T.Wr / 2) / (Math.tan(fov / 2) * asp), ((T.wallH || 1.5) * .48) / Math.tan(fov / 2));
  return { az, el, dist: fit * .92 + .3, target: new THREE.Vector3(0, (T.wallH || 1.5) * .34, -.1) };
}
function cvApplyFullscreenUI() {
  cvEl('cv-stage').classList.toggle('cv-stage-fs', CV.fs);
  cvEl('cv-info').classList.toggle('cv-info-fs', CV.fs);
  const icon = cvEl('cv-fs-icon'); if (icon) icon.className = 'ti ' + (CV.fs ? 'ti-arrows-minimize' : 'ti-arrows-maximize');
  const label = cvEl('cv-fs-label'); if (label) label.textContent = CV.fs ? 'Riduci' : 'Schermo intero';
  const btn = cvEl('cv-fs-btn'); if (btn) btn.setAttribute('aria-label', CV.fs ? 'Esci da schermo intero' : 'Schermo intero');
  cvResize3D();
}
function cvToggleFullscreen() {
  if (!CV.T3) return;
  CV.fs = !CV.fs;
  cvApplyFullscreenUI();
}
function cvExitFullscreen() {
  if (!CV.fs) return;
  CV.fs = false;
  if (cvEl('cv-stage')) cvApplyFullscreenUI();
}
function cvCam(which) {
  if (!CV.T3) return;
  cvGoCam(which === 'front' ? cvOverviewGoal(0, .05) : cvOverviewGoal(.3, .24), true);
}
function cvGoCam(g, animate) {
  const T = CV.T3;
  if (!animate) {
    const off = new THREE.Vector3().setFromSpherical(new THREE.Spherical(g.dist, Math.PI / 2 - g.el, g.az));
    T.controls.target.copy(g.target); T.camera.position.copy(g.target).add(off); T.controls.update(); T.goal = null;
  } else T.goal = g;
}

function cvBuild3D() {
  const T = CV.T3, v = CV.v; if (!T || !v) return;
  const { woodDark, carcass, ledMat } = T;
  if (T.room) {
    T.scene.remove(T.room);
    T.room.traverse(o => { if (o.userData.own && o.geometry) o.geometry.dispose(); });
    T.textures.forEach(t => t.dispose()); T.textures = [];
  }
  const room = new THREE.Group(); T.room = room; T.pick = []; T.slots = {};
  const box = (w, h, d, mat, x, y, z, parent, shadow) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); m.userData.own = true;
    m.castShadow = shadow !== false; m.receiveShadow = true; parent.add(m); return m;
  };
  const dims = v.units.map(u => u.kind === 'fridge'
    ? { w: u.cols * .10 + .02 + .06, h: u.rows * .17 + .06 + .08, d: .4 }
    : { w: u.cols * .11 + .014, h: u.rows * .11 + .014 + .06, d: .34 });
  const total = dims.reduce((s, d) => s + d.w, 0) + CV_UNIT_GAP * (dims.length - 1);
  const Wr = Math.max(total + .7, 1.7); T.Wr = Wr;
  const WH = Math.max(CV_WALL_H, Math.max(...dims.map(d => d.h)) + .4); T.wallH = WH;

  const th = CV_THEMES[cvTheme()];
  const brick = (rx, ry) => {
    if (!th.brick) return new THREE.MeshStandardMaterial({ color: th.wall, roughness: .95 });
    const t = cvBrickTex(); t.repeat.set(rx, ry); T.textures.push(t); return new THREE.MeshStandardMaterial({ map: t, roughness: .95 });
  };
  const back = new THREE.Mesh(new THREE.PlaneGeometry(Wr, WH), brick(Wr / 1.17, WH / 1.2)); back.position.set(0, WH / 2, CV_ZB); back.receiveShadow = true; back.userData.own = true; room.add(back);
  [-1, 1].forEach(sd => {
    const w = new THREE.Mesh(new THREE.PlaneGeometry(CV_ROOM_D, WH), brick(CV_ROOM_D / 1.17, WH / 1.2));
    w.rotation.y = -sd * Math.PI / 2; w.position.set(sd * Wr / 2, WH / 2, CV_ZB + CV_ROOM_D / 2); w.receiveShadow = true; w.userData.own = true; room.add(w);
  });
  let floorMat;
  if (th.brick) { const ft = cvTileTex(); ft.repeat.set(Wr / .6, CV_ROOM_D / .6); T.textures.push(ft); floorMat = new THREE.MeshStandardMaterial({ map: ft, roughness: .85 }); }
  else floorMat = new THREE.MeshStandardMaterial({ color: th.floor, roughness: .9 });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(Wr, CV_ROOM_D), floorMat);
  floor.rotation.x = -Math.PI / 2; floor.position.set(0, 0, CV_ZB + CV_ROOM_D / 2); floor.receiveShadow = true; floor.userData.own = true; room.add(floor);
  box(Wr, .09, .03, th.brick ? woodDark : new THREE.MeshStandardMaterial({ color: th.skirt, roughness: .8 }), 0, .045, CV_ZB + .015, room, false);

  // Lampada a sospensione
  const lampY = WH - .2;
  box(.008, WH - lampY, .008, carcass, 0, (WH + lampY) / 2, CV_ZB + .75, room, false);
  const shade = new THREE.Mesh(new THREE.ConeGeometry(.12, .1, 24, 1, true), new THREE.MeshStandardMaterial({ color: 0x22190f, roughness: .5, metalness: .4, side: THREE.DoubleSide })); shade.position.set(0, lampY, CV_ZB + .75); shade.userData.own = true; room.add(shade);
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(.03, 12, 12), ledMat); bulb.position.set(0, lampY - .03, CV_ZB + .75); bulb.userData.own = true; room.add(bulb);
  const lampLight = new THREE.PointLight(0xffc27a, .55, 3.2); lampLight.position.set(0, lampY - .1, CV_ZB + .75); room.add(lampLight);

  let x = -total / 2;
  v.units.forEach((un, ui) => {
    const d = dims[ui], g = new THREE.Group(); g.position.set(x + d.w / 2, 0, CV_ZB); room.add(g);
    const place = (r, cc, lx, ly, zBase) => {
      const b = un.slots[r + ',' + cc], sk = un.id + ',' + r + ',' + cc, ref = { u: un.id, r, c: cc };
      if (b) {
        const kind = T.mats[b.kind] ? b.kind : 'champagne';
        const grp = new THREE.Group(); grp.position.set(lx, ly, zBase);
        const gm = new THREE.Mesh(T.geoGlass, T.mats[kind].glass), fm = new THREE.Mesh(T.geoFoil, T.mats[kind].foil), lm = new THREE.Mesh(T.geoLabel, T.labelMat);
        gm.castShadow = fm.castShadow = true; gm.receiveShadow = true;
        gm.userData.slot = fm.userData.slot = lm.userData.slot = ref;
        grp.add(gm, fm, lm); grp.userData.baseZ = zBase; grp.userData.targetZ = zBase;
        g.add(grp); T.pick.push(gm, fm, lm); T.slots[sk] = { grp, lx, ly, gx: g.position.x, zFront: zBase + .3 };
      } else {
        const h = new THREE.Mesh(new THREE.BoxGeometry(.085, .085, .04), T.hitMat); h.position.set(lx, ly, zBase + .16); h.userData.slot = ref; h.userData.own = true;
        g.add(h); T.pick.push(h); T.slots[sk] = { grp: null, lx, ly, gx: g.position.x, zFront: zBase + .3 };
      }
    };
    if (un.kind === 'rack') {
      const cell = .11, t = .014, dep = d.d, feet = .06, H = un.rows * cell + t;
      box(d.w, H, .01, woodDark, 0, feet + H / 2, .005, g);
      for (let i = 0; i <= un.rows; i++) box(d.w, t, dep, T.wood, 0, feet + i * cell + t / 2, dep / 2, g);
      for (let j = 0; j <= un.cols; j++) box(t, H, dep, T.wood, -d.w / 2 + j * cell + t / 2, feet + H / 2, dep / 2, g);
      box(d.w, .03, dep - .04, woodDark, 0, .03, dep / 2, g, false);
      for (let r = 0; r < un.rows; r++) for (let cc = 0; cc < un.cols; cc++)
        place(r, cc, -d.w / 2 + t / 2 + (cc + .5) * cell, feet + t / 2 + (un.rows - 1 - r + .5) * cell, .02);
    } else {
      const wl = .03, W = d.w, H = d.h, dep = d.d, inner = un.cols * .10 + .02;
      box(W, wl, dep, carcass, 0, wl / 2, dep / 2, g);
      box(W, wl, dep, carcass, 0, H - wl / 2, dep / 2, g);
      box(wl, H, dep, carcass, -W / 2 + wl / 2, H / 2, dep / 2, g);
      box(wl, H, dep, carcass, W / 2 - wl / 2, H / 2, dep / 2, g);
      box(W, H, .012, carcass, 0, H / 2, .006, g);
      box(inner, .012, .025, ledMat, 0, H - wl - .008, dep - .05, g, false);
      box(.012, H - .12, .02, carcass, W / 2 - .05, H / 2, dep + .012, g, false);
      const pl = new THREE.PointLight(0xffc98a, .55, 1.3); pl.position.set(0, H - .1, dep * .5); g.add(pl);
      for (let r = 0; r < un.rows; r++) {
        const shelfY = wl + (un.rows - 1 - r) * .17 + .02;
        box(inner, .012, dep - .06, woodDark, 0, shelfY, dep / 2 - .01, g);
        for (let cc = 0; cc < un.cols; cc++) place(r, cc, -inner / 2 + .01 + (cc + .5) * .10, shelfY + .006 + .0385, .05);
      }
      const door = new THREE.Mesh(new THREE.PlaneGeometry(W - .03, H - .03), T.glassDoor); door.position.set(0, H / 2, dep + .005); door.userData.own = true; g.add(door);
    }
    const pt = cvPlaqueTex(un.name); T.textures.push(pt);
    const pw = Math.min(Math.max(d.w * .8, .42), .7), plaque = new THREE.Mesh(new THREE.PlaneGeometry(pw, pw * 80 / 512), new THREE.MeshStandardMaterial({ map: pt, roughness: .4, metalness: .5 }));
    plaque.position.set(g.position.x, Math.min(d.h + .16, WH - .12), CV_ZB + .012); plaque.userData.own = true; room.add(plaque);
    x += d.w + CV_UNIT_GAP;
  });
  T.scene.add(room);
  T.key.target.position.set(0, .6, CV_ZB + .3);
  const s = T.key.shadow.camera, ex = Wr / 2 + .4; s.left = -ex; s.right = ex; s.top = WH + .1; s.bottom = -.3; s.near = .5; s.far = 9; s.updateProjectionMatrix();
  T.controls.maxDistance = cvOverviewGoal(0, 0).dist * 1.5;
  if (!T.framed) { T.framed = true; cvResize3D(); cvGoCam(cvOverviewGoal(.3, .24), false); }
}
function cvUpdateSel3D(fly) {
  const T = CV.T3; if (!T || !T.room) return;
  Object.values(T.slots).forEach(s => { if (s.grp) s.grp.userData.targetZ = s.grp.userData.baseZ; });
  if (!CV.sel) { T.ring.visible = false; return; }
  const s = T.slots[CV.sel.u + ',' + CV.sel.r + ',' + CV.sel.c];
  if (!s) { T.ring.visible = false; return; }
  if (s.grp) s.grp.userData.targetZ = s.grp.userData.baseZ + .07;
  T.ring.visible = true; T.ring.position.set(s.gx + s.lx, s.ly, CV_ZB + s.zFront + (s.grp ? .075 : 0) + .004);
  if (fly && CV.view === '3d') {
    const cur = new THREE.Spherical().setFromVector3(T.camera.position.clone().sub(T.controls.target));
    cvGoCam({ az: Math.max(-.6, Math.min(.6, cur.theta)), el: Math.PI / 2 - cur.phi, dist: Math.min(cur.radius, 1.45), target: new THREE.Vector3(s.gx + s.lx, s.ly, CV_ZB + .15) }, true);
  }
}
function cvTick3D() {
  const T = CV.T3; if (!T || !T.active) return;
  const page = cvEl('v-cantina');
  if (!page || !page.classList.contains('active') || CV.view !== '3d') { T.active = false; return; }
  requestAnimationFrame(cvTick3D);
  Object.values(T.slots).forEach(s => { const g = s.grp; if (g && Math.abs(g.position.z - g.userData.targetZ) > .0005) g.position.z += (g.userData.targetZ - g.position.z) * .2; });
  if (T.goal) {
    const g = T.goal, sph = new THREE.Spherical().setFromVector3(T.camera.position.clone().sub(T.controls.target)), k = .13;
    sph.theta += (g.az - sph.theta) * k; sph.phi += ((Math.PI / 2 - g.el) - sph.phi) * k; sph.radius += (g.dist - sph.radius) * k;
    T.controls.target.lerp(g.target, k);
    T.camera.position.copy(T.controls.target).add(new THREE.Vector3().setFromSpherical(sph));
    if (Math.abs(g.az - sph.theta) < .003 && Math.abs(g.dist - sph.radius) < .004 && T.controls.target.distanceTo(g.target) < .004) T.goal = null;
  }
  T.controls.update();
  T.renderer.render(T.scene, T.camera);
}

/* ───────── Punti d'ingresso ───────── */
function cvUpdateEntry() {
  const card = document.getElementById('home-cantina-card');
  if (card) card.style.display = cvEnabled() ? 'block' : 'none';
}
