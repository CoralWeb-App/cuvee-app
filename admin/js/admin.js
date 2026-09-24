// ── CONFIG ──────────────────────────────────────────
const SUPA_URL  = 'https://wlfxgbmffvhuqmqjiuqo.supabase.co'
const SUPA_ANON = 'sb_publishable_uGKM1xe1pSq3nr_8gK8ZIQ_PElk0l0C'

const { createClient } = supabase
const supa = createClient(SUPA_URL, SUPA_ANON)

let currentAdmin    = null
let utentiPage      = 1
let utentiFilter    = 'all'
let utentiSearch    = ''
let bottigliaPage         = 1
let bottigliaPerPage      = 50
let bottigliaSearch       = ''
let bottigliaFilter       = ''
let bottigliaStatusFilter = ''
let bottigliaSort         = 'nome'
let bottigliaLetterFilter = ''
let bottigliaFotoFilter   = false
let maisonSearch       = ''
let maisonTipoFilter   = ''
let maisonStatusFilter = ''
let maisonSort         = 'nome'
let maisonLetterFilter = ''
let glossarioSearch       = ''
let glossarioLetterFilter = ''
let searchTimer        = null

const PER_PAGE = 15

// ── TOAST ─────────────────────────────────────────────
function showToast(msg, type = 'success') {
  let container = document.getElementById('adm-toast-container')
  if (!container) {
    container = document.createElement('div')
    container.id = 'adm-toast-container'
    document.body.appendChild(container)
  }
  const icon = type === 'error' ? 'alert-circle' : type === 'info' ? 'info-circle' : 'circle-check'
  const t = document.createElement('div')
  t.className = 'adm-toast adm-toast-' + type
  t.innerHTML = `<i class="ti ti-${icon}"></i> ${msg}`
  container.appendChild(t)
  requestAnimationFrame(() => t.classList.add('show'))
  setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 350) }, 3200)
}

// ── MODAL ─────────────────────────────────────────────
function openModal(title, bodyHTML, wide = false) {
  const box = document.getElementById('adm-modal-box')
  document.getElementById('modal-title').textContent = title
  document.getElementById('modal-body').innerHTML = bodyHTML
  if (wide) box.classList.add('wide'); else box.classList.remove('wide')
  document.getElementById('adm-modal').classList.add('open')
  setTimeout(() => box.querySelector('input:not([disabled]),textarea,select')?.focus(), 120)
}

function closeModal() {
  document.getElementById('adm-modal').classList.remove('open')
}

// ── ESCAPE ────────────────────────────────────────────
function esc(s) {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')
}

// ── SEARCH NORMALIZATION (accents + punteggiatura) ───
// Normalizes accented chars and strips punctuation/spaces:
// Moët→moet, "R.D. 2008"→"rd2008", "Egly-Ouriet"→"eglyouriet"
// così la ricerca funziona anche senza punti/trattini.
function norm(s) {
  return String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim().replace(/[^a-z0-9]/g, '')
}

// Costruisce il filtro per supa.or(...): stesso termine cercato (ilike) su più colonne.
// Tolti i caratteri con significato speciale nella sintassi .or() di PostgREST (virgole e parentesi),
// altrimenti romperebbero il filtro invece di limitarsi a non trovare risultati.
function orSearch(colsAndTerm) {
  return Object.entries(colsAndTerm)
    .map(([col, term]) => `${col}.ilike.%${String(term).replace(/[,()]/g, '').trim()}%`)
    .join(',')
}

// Genera uno slug URL-safe da un nome (es. "Grande Cuvée 171ème" → "grande-cuvee-171eme")
function slugify(s) {
  return String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

// Ricerca multi-termine: spezza la query in parole e richiede che OGNI parola
// compaia da qualche parte nell'insieme dei campi passati (in qualsiasi ordine,
// anche a cavallo tra campi diversi — es. "krug 171" trova maison="Krug" +
// nome="Grande Cuvée 171ème Édition" anche se "krug" non è nel nome bottiglia).
function matchesAllTerms(query, ...fields) {
  const terms = String(query ?? '').trim().split(/\s+/).map(norm).filter(Boolean)
  if (!terms.length) return true
  const combined = fields.map(f => norm(f ?? '')).join(' ')
  return terms.every(t => combined.includes(t))
}

// ── DYNAMIC FORM HELPERS ─────────────────────────────
// Builds editable fields for ALL columns in a DB row.
// skip: always hidden | fullRow: force 2-col span | textareaCols: force textarea
function buildAllColsForm(row, { skip = [], fullRow = [], textareaCols = [] } = {}) {
  const numHint = /^(anno|annata|millesimo|vintage|count|price|numero|qty|dosaggio|lat|lng|sort_order|rank)$/i
  return Object.entries(row).map(([col, val]) => {
    if (skip.includes(col)) return ''
    if (val !== null && typeof val === 'object') return ''   // skip joined relations

    const label  = col.replace(/_/g, ' ').toUpperCase()
    const isBool = typeof val === 'boolean'
    const isNum  = typeof val === 'number' || (val === null && numHint.test(col))
    const isTA   = textareaCols.includes(col) || (typeof val === 'string' && val.length > 120)
    const isFull = fullRow.includes(col) || isTA

    let input
    if (isBool) {
      input = `<select class="adm-form-input" data-col="${col}">
        <option value="false" ${!val ? 'selected' : ''}>No</option>
        <option value="true"  ${val  ? 'selected' : ''}>Sì</option>
      </select>`
    } else if (isNum) {
      input = `<input class="adm-form-input" type="number" step="any" data-col="${col}" value="${val ?? ''}">`
    } else if (isTA) {
      input = `<textarea class="adm-form-input" rows="3" style="resize:vertical" data-col="${col}">${esc(String(val ?? ''))}</textarea>`
    } else {
      input = `<input class="adm-form-input" type="text" data-col="${col}" value="${esc(String(val ?? ''))}">`
    }

    return `<div class="adm-form-field"${isFull ? ' style="grid-column:1/-1"' : ''}>
      <label class="adm-form-label">${label}</label>${input}
    </div>`
  }).join('')
}

// Collects all [data-col] inputs inside modal-body into an update object
// Colonne generate o readonly che non vanno mai nell'UPDATE
const GENERATED_COLS = new Set(['nome_norm','id','created_at','updated_at'])

function collectDataCols() {
  const updates = {}
  document.querySelectorAll('#modal-body [data-col]').forEach(el => {
    const col = el.dataset.col
    if (GENERATED_COLS.has(col)) return   // mai aggiornare colonne generate
    const val = el.value
    if (val === 'true')  { updates[col] = true;  return }
    if (val === 'false') { updates[col] = false; return }
    if (el.type === 'number') { updates[col] = val === '' ? null : parseFloat(val); return }
    if (el.dataset.type === 'json') {
      if (!val.trim()) { updates[col] = null; return }
      try { updates[col] = JSON.parse(val) } catch(e) { updates[col] = val }
      return
    }
    updates[col] = val === '' ? null : val
  })
  return updates
}

// ── DATES ─────────────────────────────────────────────
function timeAgo(iso) {
  if (!iso) return '-'
  const m = Math.floor((Date.now() - new Date(iso)) / 60000)
  if (m < 1)   return 'adesso'
  if (m < 60)  return m + 'm fa'
  if (m < 1440) return Math.floor(m/60) + 'h fa'
  if (m < 43200) return Math.floor(m/1440) + 'gg fa'
  return fmtDate(iso)
}

function fmtDate(iso) {
  if (!iso) return '-'
  return new Date(iso).toLocaleDateString('it', { day:'2-digit', month:'short', year:'numeric' })
}

function isoDate(iso) {
  if (!iso) return ''
  return new Date(iso).toISOString().slice(0, 10)
}

function fmtTipo(t) {
  return { assemblage:'Assemblage', blanc_de_blancs:'Blanc de Blancs',
           blanc_de_noirs:'Blanc de Noirs', rose:'Rosé' }[t] ?? (t ?? '-')
}

// Premium "attivo" = flag acceso E scadenza non passata. Il solo flag può restare vero dopo la scadenza
// (finché l'app o il webhook non lo riallineano), quindi i conteggi devono guardare anche la data.
const activePremium = (q) => q.eq('is_premium', true).or(`premium_until.is.null,premium_until.gt.${new Date().toISOString()}`)
const notActivePremium = (q) => q.or(`is_premium.eq.false,is_premium.is.null,premium_until.lte.${new Date().toISOString()}`)

function isPremiumActive(u) {
  return u.is_premium === true && (!u.premium_until || new Date(u.premium_until) > new Date())
}

// ── NAV ───────────────────────────────────────────────
// ── Menu laterale a comparsa (telefono) ─────────────────
function openAdminDrawer() {
  document.body.classList.add('adm-drawer-open')
  const b = document.getElementById('adm-menu-btn'); if (b) b.setAttribute('aria-expanded', 'true')
}
function closeAdminDrawer() {
  document.body.classList.remove('adm-drawer-open')
  const b = document.getElementById('adm-menu-btn'); if (b) b.setAttribute('aria-expanded', 'false')
}
function toggleAdminDrawer() {
  document.body.classList.contains('adm-drawer-open') ? closeAdminDrawer() : openAdminDrawer()
}
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeAdminDrawer() })
window.addEventListener('resize', () => { if (window.innerWidth > 768) closeAdminDrawer() })

// Etichetta ogni cella con il titolo della colonna: sul telefono le tabelle diventano schede (CSS) e servono le etichette
function adminLabelTables() {
  document.querySelectorAll('table.adm-table').forEach(t => {
    const heads = Array.from(t.querySelectorAll('thead th')).map(th => th.textContent.trim())
    if (!heads.length) return
    t.querySelectorAll('tbody tr').forEach(tr => {
      Array.from(tr.children).forEach((td, i) => {
        if (td.tagName === 'TD' && !td.hasAttribute('data-label') && !td.hasAttribute('colspan')) td.setAttribute('data-label', heads[i] || '')
      })
    })
  })
}
let _adminLblRaf = 0
document.addEventListener('DOMContentLoaded', () => {
  const shell = document.getElementById('admin-shell')
  if (!shell) return
  new MutationObserver(() => {
    if (_adminLblRaf) return
    _adminLblRaf = setTimeout(() => { _adminLblRaf = 0; adminLabelTables() }, 30)
  }).observe(shell, { childList: true, subtree: true })
})

function showView(id) {
  closeAdminDrawer()
  const _main = document.querySelector('.adm-main'); if (_main) _main.scrollTop = 0
  document.querySelectorAll('.adm-view').forEach(v => v.classList.remove('active'))
  document.querySelectorAll('.adm-nav-item').forEach(n => n.classList.remove('active'))
  const view = document.getElementById('view-' + id)
  if (view) view.classList.add('active')
  const nav = document.querySelector('[data-view="' + id + '"]')
  if (nav) nav.classList.add('active')
  const titles = { dashboard:'Dashboard', approvazioni:'Coda Approvazioni',
    bottiglie:'Catalogo Champagne', maison:'Gestione Maison', glossario:'Gestione Glossario',
    utenti:'Utenti', abbonamenti:'Abbonamenti Premium', notifiche:'Notifiche', stats:'Statistiche' }
  const el = document.getElementById('adm-header-view')
  if (el) el.textContent = titles[id] || id

  if (id === 'dashboard')    loadDashboard()
  if (id === 'approvazioni') loadApprovazioni()
  if (id === 'bottiglie')    { bottigliaPage = 1; renderBottiglie() }
  if (id === 'maison')       { maisonSearch = ''; maisonTipoFilter = ''; maisonStatusFilter = ''; maisonSort = 'nome'; maisonLetterFilter = ''; loadMaison() }
  if (id === 'glossario')    { glossarioSearch = ''; glossarioLetterFilter = ''; loadGlossarioAdmin() }
  if (id === 'utenti') {
    utentiPage = 1; utentiFilter = 'all'; utentiSearch = ''
    document.querySelectorAll('#view-utenti .adm-filter').forEach((b, i) => b.classList.toggle('active', i === 0))
    renderUtenti()
  }
  if (id === 'abbonamenti')  loadAbbonamenti()
  if (id === 'notifiche')    loadNotifiche()
  if (id === 'stats')        loadStats()
}

// ── LOGIN ─────────────────────────────────────────────
async function adminLogin() {
  const email = document.getElementById('login-email').value.trim()
  const pass  = document.getElementById('login-pass').value
  const btn   = document.getElementById('login-btn')
  const err   = document.getElementById('login-error')
  if (!email || !pass) { showLoginError('Inserisci email e password.'); return }
  btn.innerHTML = '<i class="ti ti-loader-2 spin"></i> // VERIFICA...'
  btn.disabled = true
  err.style.display = 'none'
  try {
    const { data, error } = await supa.auth.signInWithPassword({ email, password: pass })
    if (error) throw error
    const { data: profile } = await supa.from('users').select('is_admin, email').eq('id', data.user.id).single()
    if (!profile?.is_admin) {
      await supa.auth.signOut()
      throw new Error('Accesso non autorizzato.')
    }
    currentAdmin = { ...data.user, profile }
    enterAdmin()
  } catch(e) {
    showLoginError(e.message || 'Errore di accesso.')
    btn.innerHTML = '<i class="ti ti-terminal-2"></i> // ACCEDI AL TERMINALE'
    btn.disabled = false
  }
}

function showLoginError(msg) {
  const err = document.getElementById('login-error')
  err.textContent = '⚠ ' + msg
  err.style.display = 'block'
}

function toggleLoginPass(btn) {
  const input = document.getElementById('login-pass')
  const icon  = document.getElementById('login-eye-icon')
  const show  = input.type === 'password'
  input.type  = show ? 'text' : 'password'
  icon.className = show ? 'ti ti-eye-off' : 'ti ti-eye'
  input.focus()
}

async function adminLogout() {
  await supa.auth.signOut()
  currentAdmin = null
  document.getElementById('admin-shell').classList.remove('visible')
  document.getElementById('login-page').style.display = 'flex'
}

function enterAdmin() {
  document.getElementById('login-page').style.display = 'none'
  document.getElementById('admin-shell').classList.add('visible')
  const email = currentAdmin.profile?.email || currentAdmin.email || ''
  document.getElementById('adm-user-initial').textContent = email[0]?.toUpperCase() || 'A'
  document.getElementById('adm-user-email').textContent = email
  startHeaderMonitors()
  showView('dashboard')
}

// ── HEADER MONITORS ───────────────────────────────────
let _sessionStart = null
let _uptimeTimer  = null
let _dbTimer      = null

function startHeaderMonitors() {
  // 1. Network status
  updateNetworkStatus()
  window.addEventListener('online',  updateNetworkStatus)
  window.addEventListener('offline', updateNetworkStatus)

  // 2. Session uptime counter
  _sessionStart = Date.now()
  clearInterval(_uptimeTimer)
  _uptimeTimer = setInterval(updateUptime, 1000)
  updateUptime()

  // 3. DB ping ogni 30s
  checkDbStatus()
  clearInterval(_dbTimer)
  _dbTimer = setInterval(checkDbStatus, 30000)
}

function updateNetworkStatus() {
  const badge = document.getElementById('live-badge')
  const dot   = document.getElementById('live-dot')
  const label = document.getElementById('live-label')
  if (!badge) return
  if (navigator.onLine) {
    badge.classList.remove('offline')
    dot.classList.remove('offline')
    label.textContent = 'LIVE'
  } else {
    badge.classList.add('offline')
    dot.classList.add('offline')
    label.textContent = 'OFFLINE'
  }
}

function updateUptime() {
  const el = document.getElementById('uptime-val')
  if (!el || !_sessionStart) return
  const s = Math.floor((Date.now() - _sessionStart) / 1000)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const ss = s % 60
  el.textContent = h > 0
    ? `${h}h ${String(m).padStart(2,'0')}m`
    : `${String(m).padStart(2,'0')}:${String(ss).padStart(2,'0')}`
}

async function checkDbStatus() {
  const el = document.getElementById('db-val')
  if (!el) return
  try {
    const t0 = Date.now()
    const { error } = await supa.from('bottiglie').select('id', { count:'exact', head:true }).limit(1)
    if (error) throw error
    const ms = Date.now() - t0
    el.textContent = ms < 300 ? 'OK' : ms + 'ms'
    el.className = 'adm-header-stat-val online'
  } catch {
    el.textContent = 'ERR'
    el.className = 'adm-header-stat-val offline'
  }
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeModal()
  if (e.key === 'Enter' && document.getElementById('login-page').style.display !== 'none') adminLogin()
})

function toggleAdminMenu(e) {
  e.stopPropagation()
  const dd      = document.getElementById('adm-user-dropdown')
  const chevron = document.getElementById('adm-user-chevron')
  if (!dd) return
  const open = dd.classList.toggle('open')
  if (chevron) chevron.className = open ? 'ti ti-chevron-up adm-logout-icon' : 'ti ti-chevron-down adm-logout-icon'
}

function photoPreviewField(url, colName, bottleId) {
  const val = url ?? ''
  const hasPhoto = !!val
  const previewInner = hasPhoto
    ? `<img src="${esc(val)}" alt="" style="max-width:100%;max-height:150px;object-fit:contain">`
    : `<div style="text-align:center;color:var(--text-3)">
         <i class="ti ti-photo" style="font-size:28px;display:block;margin-bottom:4px"></i>
         <span style="font-size:10px;font-family:var(--mono)">Nessuna foto</span>
       </div>`
  return `<div class="adm-form-field" style="grid-column:1/-1">
    <label class="adm-form-label">FOTO</label>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;align-items:start">
      <input class="adm-form-input" type="text" id="foto-url-input" data-col="${colName}"
             value="${esc(val)}" placeholder="https://..."
             oninput="updateFotoPreview(this)">
      <div id="foto-preview-wrap"
           data-foto-url="${esc(val)}"
           data-bottle-id="${bottleId}"
           data-foto-col="${colName}"
           onclick="fotoWrapClick(this)"
           style="border:1px solid var(--border);border-radius:var(--radius);min-height:110px;
                  display:flex;align-items:center;justify-content:center;
                  background:var(--surface-3);overflow:hidden;padding:8px;
                  cursor:${hasPhoto ? 'pointer' : 'default'}">
        ${previewInner}
      </div>
    </div>
  </div>`
}

function fotoWrapClick(el) {
  const url      = el.dataset.fotoUrl  || ''
  const bottleId = el.dataset.bottleId || ''
  const colName  = el.dataset.fotoCol  || 'foto_url'
  if (!url) { triggerFotoReplace(bottleId, colName); return }
  showFotoCtxMenu(el, url, bottleId, colName)
}

function showFotoCtxMenu(trigger, url, bottleId, colName) {
  document.querySelectorAll('.adm-foto-ctx').forEach(m => m.remove())
  const rect = trigger.getBoundingClientRect()
  const menu = document.createElement('div')
  menu.className = 'adm-foto-ctx'
  menu.innerHTML = `
    <button onclick="openLightbox('${esc(url)}')">
      <i class="ti ti-eye"></i> Visualizza foto
    </button>
    <button onclick="triggerFotoReplace('${bottleId}','${colName}')">
      <i class="ti ti-upload"></i> Sostituisci foto
    </button>
    <button onclick="deleteFoto('${bottleId}','${colName}')" style="color:var(--red)">
      <i class="ti ti-trash"></i> Elimina foto
    </button>`
  const top  = Math.min(rect.bottom + 4, window.innerHeight - 140)
  const left = Math.min(rect.left,       window.innerWidth  - 200)
  menu.style.top = top + 'px'
  menu.style.left = left + 'px'
  document.body.appendChild(menu)
  setTimeout(() => document.addEventListener('click', () => menu.remove(), { once: true }), 20)
}

async function deleteFoto(bottleId, colName) {
  if (!confirm('Eliminare la foto da questa bottiglia?\nViene rimossa dal database e dallo storage.')) return
  try {
    // Rimuovi dallo storage via Edge Function (service role, bypassa RLS)
    const { data: { session } } = await supa.auth.getSession()
    const resp = await fetch(`${SUPA_URL}/functions/v1/admin-photo-upload`, {
      method:  'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type':  'application/json',
        'apikey':        SUPA_ANON,
      },
      body: JSON.stringify({ action: 'delete', bottle_id: bottleId }),
    })
    const storageResult = await resp.json()
    if (!resp.ok || storageResult.error) throw new Error('Storage: ' + (storageResult.error || 'errore'))

    // Aggiorna DB: foto_url = null
    const upd = {}; upd[colName] = null
    const { data: updated, error: dbErr } = await supa.from('bottiglie').update(upd).eq('id', bottleId).select('id')
    if (dbErr) throw dbErr
    if (!updated?.length) throw new Error('Aggiornamento DB bloccato — controlla policy UPDATE su bottiglie')

    // Aggiorna UI
    const urlInput = document.getElementById('foto-url-input')
    if (urlInput) { urlInput.value = ''; updateFotoPreview(urlInput) }

    showToast('Foto eliminata ✓')
  } catch(err) { showToast(err.message, 'error') }
}

function openLightbox(url) {
  if (!url) return
  document.querySelectorAll('.adm-lightbox').forEach(l => l.remove())
  const lb = document.createElement('div')
  lb.className = 'adm-lightbox'
  lb.innerHTML = `
    <button class="adm-lightbox-close" onclick="event.stopPropagation();this.closest('.adm-lightbox').remove()">
      <i class="ti ti-x"></i>
    </button>
    <img src="${esc(url)}" alt="" onclick="event.stopPropagation()">`
  lb.addEventListener('click', () => lb.remove())
  document.body.appendChild(lb)
  requestAnimationFrame(() => lb.classList.add('open'))
}

function updateFotoPreview(input) {
  const url  = input.value.trim()
  const wrap = document.getElementById('foto-preview-wrap')
  if (!wrap) return
  wrap.dataset.fotoUrl = url
  wrap.style.cursor = url ? 'pointer' : 'default'
  // Aggiunge cache-bust al src così il browser ricarica sempre la versione aggiornata
  const src = url ? `${url}?t=${Date.now()}` : ''
  wrap.innerHTML = src
    ? `<img src="${esc(src)}" alt="" style="max-width:100%;max-height:150px;object-fit:contain">`
    : `<div style="text-align:center;color:var(--text-3)">
         <i class="ti ti-photo" style="font-size:28px;display:block;margin-bottom:4px"></i>
         <span style="font-size:10px;font-family:var(--mono)">Nessuna foto</span>
       </div>`
}

async function compressImage(file, maxW = 1400, maxH = 1400, quality = 0.82) {
  return new Promise(resolve => {
    const reader = new FileReader()
    reader.onload = e => {
      const img = new Image()
      img.onload = () => {
        let { width, height } = img
        if (width > maxW || height > maxH) {
          const r = Math.min(maxW / width, maxH / height)
          width  = Math.round(width  * r)
          height = Math.round(height * r)
        }
        const canvas = document.createElement('canvas')
        canvas.width = width; canvas.height = height
        canvas.getContext('2d').drawImage(img, 0, 0, width, height)
        canvas.toBlob(resolve, 'image/jpeg', quality)
      }
      img.src = e.target.result
    }
    reader.readAsDataURL(file)
  })
}

async function triggerFotoReplace(bottleId, colName) {
  if (!bottleId) { showToast('ID bottiglia mancante', 'error'); return }
  const input = document.createElement('input')
  input.type = 'file'; input.accept = 'image/*'
  input.onchange = async e => {
    const file = e.target.files[0]
    if (!file) return
    showToast('Compressione in corso...')
    try {
      const blob = await compressImage(file)

      // Converti blob → base64 per l'Edge Function
      const arrayBuffer = await blob.arrayBuffer()
      const uint8 = new Uint8Array(arrayBuffer)
      let binary = ''
      uint8.forEach(b => binary += String.fromCharCode(b))
      const base64 = btoa(binary)

      showToast('Upload in corso...')

      // Chiama Edge Function con service role → nessun problema di storage RLS
      const { data: { session } } = await supa.auth.getSession()
      const resp = await fetch(`${SUPA_URL}/functions/v1/admin-photo-upload`, {
        method:  'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type':  'application/json',
          'apikey':        SUPA_ANON,
        },
        body: JSON.stringify({ bottle_id: bottleId, image_base64: base64 }),
      })
      const result = await resp.json()
      if (!resp.ok || result.error) throw new Error(result.error || 'Upload fallito')

      const newUrl = result.url

      // Aggiorna DB
      const upd = {}; upd[colName] = newUrl
      const { error: dbErr } = await supa.from('bottiglie').update(upd).eq('id', bottleId)
      if (dbErr) throw dbErr

      // Aggiorna UI
      const urlInput = document.getElementById('foto-url-input')
      if (urlInput) { urlInput.value = newUrl; updateFotoPreview(urlInput) }

      showToast('Foto aggiornata ✓')
    } catch(err) { showToast(err.message, 'error') }
  }
  input.click()
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('adm-modal')?.addEventListener('click', e => {
    if (e.target.id === 'adm-modal') closeModal()
  })
  // Chiudi dropdown admin al click fuori
  document.addEventListener('click', () => {
    const dd      = document.getElementById('adm-user-dropdown')
    const chevron = document.getElementById('adm-user-chevron')
    if (dd) dd.classList.remove('open')
    if (chevron) chevron.className = 'ti ti-chevron-down adm-logout-icon'
  })
  checkSession()
})

async function checkSession() {
  const { data: { session } } = await supa.auth.getSession()
  if (session) {
    const { data: profile } = await supa.from('users').select('is_admin, email').eq('id', session.user.id).single()
    if (profile?.is_admin) { currentAdmin = { ...session.user, profile }; enterAdmin(); return }
  }
  initBinaryRain('binary-canvas')
}

// ── BINARY RAIN ───────────────────────────────────────
function initBinaryRain(canvasId) {
  const canvas = document.getElementById(canvasId)
  if (!canvas) return
  const ctx = canvas.getContext('2d')
  function resize() { canvas.width = canvas.offsetWidth; canvas.height = canvas.offsetHeight }
  resize()
  window.addEventListener('resize', resize)
  const cols = Math.floor(canvas.width / 18)
  const drops = Array(cols).fill(1)
  setInterval(() => {
    ctx.fillStyle = 'rgba(10,10,15,0.05)'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.fillStyle = '#C8A03A'
    ctx.font = '12px JetBrains Mono, monospace'
    drops.forEach((y, i) => {
      ctx.fillText(Math.random() > .5 ? '1' : '0', i * 18, y * 18)
      if (y * 18 > canvas.height && Math.random() > .975) drops[i] = 0
      drops[i]++
    })
  }, 80)
}

// ══════════════════════════════════════════════════════
// DASHBOARD
// ══════════════════════════════════════════════════════
async function loadDashboard() {
  try {
    const todayStart = new Date(); todayStart.setHours(0,0,0,0)

    const [
      { count: cBottiglie },
      { count: cMaison },
      { count: cUtenti },
      { count: cPendingBottiglie },
      { count: cPendingMaison },
      { count: cPendingFoto },
      { count: cScanOggi },
      { count: cScanTot },
      { count: cPremium },
    ] = await Promise.all([
      supa.from('bottiglie').select('*', { count:'exact', head:true }).eq('needs_review', false),
      supa.from('maison').select('*', { count:'exact', head:true }),
      supa.from('users').select('*', { count:'exact', head:true }),
      supa.from('bottiglie').select('*', { count:'exact', head:true }).eq('needs_review', true),
      supa.from('maison').select('*', { count:'exact', head:true }).eq('needs_review', true),
      supa.from('foto_bottiglia_pending').select('*', { count:'exact', head:true }).eq('status', 'pending'),
      supa.from('bottle_scans').select('*', { count:'exact', head:true }).gte('created_at', todayStart.toISOString()),
      supa.from('bottle_scans').select('*', { count:'exact', head:true }),
      activePremium(supa.from('users').select('*', { count:'exact', head:true })),
    ])
    const cPending = (cPendingBottiglie ?? 0) + (cPendingMaison ?? 0) + (cPendingFoto ?? 0)

    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v ?? '-' }
    set('dash-bottiglie', cBottiglie?.toLocaleString('it'))
    set('dash-maison', cMaison?.toLocaleString('it'))
    set('dash-utenti', cUtenti?.toLocaleString('it'))
    set('dash-pending', cPending?.toLocaleString('it'))
    set('dash-today',   cScanOggi?.toLocaleString('it'))
    set('dash-total',   cScanTot?.toLocaleString('it'))
    set('dash-premium', cPremium?.toLocaleString('it'))

    const badge = document.querySelector('[data-view="approvazioni"] .adm-nav-badge')
    if (badge) { badge.textContent = cPending ?? 0; badge.style.display = cPending > 0 ? '' : 'none' }

    // Feed: attività recente del catalogo (bottiglie approvate, maison, nuovi utenti)
    const [
      { data: recentBottiglie },
      { data: recentMaison },
      { data: recentUtenti },
      { data: recentPremium },
    ] = await Promise.all([
      supa.from('bottiglie').select('nome, updated_at, maison:maison_id(nome)').eq('needs_review', false).order('updated_at', { ascending: false }).limit(6),
      supa.from('maison').select('nome, updated_at').eq('needs_review', false).order('updated_at', { ascending: false }).limit(4),
      supa.from('users').select('email, created_at').order('created_at', { ascending: false }).limit(4),
      supa.from('users').select('email, premium_from').eq('is_premium', true).not('premium_from', 'is', null).order('premium_from', { ascending: false }).limit(3),
    ])

    const events = [
      ...(recentBottiglie || []).map(b => ({ dot: 'gold',  label: 'Bottiglia approvata',   detail: b.nome + (b.maison?.nome ? ' · ' + b.maison.nome : ''), time: b.updated_at })),
      ...(recentMaison    || []).map(m => ({ dot: 'green', label: 'Maison approvata',       detail: m.nome,  time: m.updated_at })),
      ...(recentUtenti    || []).map(u => ({ dot: 'blue',  label: 'Nuovo utente',           detail: u.email, time: u.created_at })),
      ...(recentPremium   || []).map(u => ({ dot: 'amber', label: 'Premium attivato',       detail: u.email, time: u.premium_from })),
    ].sort((a, b) => new Date(b.time) - new Date(a.time)).slice(0, 12)

    const feed = document.getElementById('dash-feed')
    if (feed) {
      feed.innerHTML = !events.length
        ? '<div style="padding:20px 18px;color:var(--text-3);font-size:12px;font-family:var(--mono)">Nessuna attività recente</div>'
        : events.map(ev => `<div class="adm-feed-item">
          <div class="adm-feed-dot ${ev.dot}"></div>
          <div class="adm-feed-body">
            <span class="adm-feed-ev">${ev.label}</span>
            <span class="adm-feed-detail">${esc(ev.detail)}</span>
          </div>
          <span class="adm-feed-time">${timeAgo(ev.time)}</span>
        </div>`).join('')
    }

    const { data: pending } = await supa
      .from('bottiglie')
      .select('id, nome, tipo, created_at, maison:maison_id(nome)')
      .eq('needs_review', true)
      .order('created_at', { ascending: false })
      .limit(4)

    const plist = document.getElementById('dash-pending-list')
    if (plist) {
      plist.innerHTML = !pending?.length
        ? '<div style="padding:16px 18px;color:var(--text-3);font-size:12px">Nessuna bottiglia in attesa ✓</div>'
        : pending.map(b => `<div class="adm-pending-item" onclick="showView('approvazioni')" style="cursor:pointer">
            <div class="adm-pending-thumb"><svg viewBox="0 0 512 512" fill="currentColor"><path fill-rule="evenodd" clip-rule="evenodd" d="M217.6,0 L294.4,0 L294.4,76.8 C294.4,256 371.2,217.6 371.2,396.8 L371.2,512 L140.8,512 L140.8,396.8 C140.8,217.6 217.6,256 217.6,76.8 Z M335.057,240.943 L256,320 L176.943,240.943 L176.943,258.943 L256,338 L335.057,258.943 Z M204.8,396.8 L307.2,396.8 L307.2,435.2 L204.8,435.2 Z"/></svg></div>
            <div class="adm-pending-info">
              <div class="adm-pending-name">${esc(b.nome ?? 'Senza nome')}</div>
              <div class="adm-pending-meta">${esc(b.maison?.nome ?? '')} · ${fmtTipo(b.tipo)}</div>
            </div>
            <div class="adm-pending-time">${timeAgo(b.created_at)}</div>
          </div>`).join('')
    }
  } catch(e) { console.error('Dashboard:', e) }
}

// ══════════════════════════════════════════════════════
// APPROVAZIONI
// ══════════════════════════════════════════════════════
async function loadApprovazioni() {
  const tbody       = document.getElementById('approvazioni-tbody')
  const maisonWrap  = document.getElementById('approvazioni-maison-wrap')
  const maisonTbody = document.getElementById('approvazioni-maison-tbody')
  if (!tbody) return
  tbody.innerHTML = loadingRow(7)

  try {
    const [
      { data: bottiglie, error: errB },
      { data: maisonPending },
      { data: fotoPending },
    ] = await Promise.all([
      supa.from('bottiglie').select('*, maison:maison_id(nome)').eq('needs_review', true).order('created_at', { ascending: false }),
      supa.from('maison').select('*').eq('needs_review', true).order('created_at', { ascending: false }),
      supa.from('foto_bottiglia_pending')
        .select('*, bottiglie(id, nome, foto_url, maison:maison_id(nome))')
        .eq('status', 'pending')
        .order('created_at', { ascending: false }),
    ])
    if (errB) throw errB

    const total = (bottiglie?.length ?? 0) + (maisonPending?.length ?? 0) + (fotoPending?.length ?? 0)
    const badge = document.querySelector('[data-view="approvazioni"] .adm-nav-badge')
    if (badge) { badge.textContent = total; badge.style.display = total > 0 ? '' : 'none' }
    const cnt = document.getElementById('approvazioni-count')
    if (cnt) cnt.textContent = total + ' IN CODA'

    // ── Bottiglie ─────────────────────────────────────────
    if (!bottiglie?.length) {
      tbody.innerHTML = `<tr><td colspan="7"><div style="padding:32px;text-align:center">
        <i class="ti ti-circle-check" style="font-size:32px;color:var(--green);display:block;margin-bottom:8px"></i>
        <span style="color:var(--text-3)">Nessuna bottiglia in attesa</span>
      </div></td></tr>`
    } else {
      tbody.innerHTML = bottiglie.map(b => `
        <tr class="adm-table-row" style="cursor:pointer" onclick="viewApprovazioneDetail('${b.id}')">
          <td>
            <div class="adm-bottle-cell">
              <div class="adm-bottle-thumb ${(b.foto_url || b.photo_url) ? 'has-img clickable' : ''}"
                   ${(b.foto_url || b.photo_url) ? `onclick="event.stopPropagation();openLightbox('${esc(b.foto_url || b.photo_url)}')"` : ''}>
                ${(b.foto_url || b.photo_url)
                  ? `<img src="${esc(b.foto_url || b.photo_url)}?t=${Date.now()}" alt="">`
                  : '<svg viewBox="0 0 512 512" fill="currentColor"><path fill-rule="evenodd" clip-rule="evenodd" d="M217.6,0 L294.4,0 L294.4,76.8 C294.4,256 371.2,217.6 371.2,396.8 L371.2,512 L140.8,512 L140.8,396.8 C140.8,217.6 217.6,256 217.6,76.8 Z M335.057,240.943 L256,320 L176.943,240.943 L176.943,258.943 L256,338 L335.057,258.943 Z M204.8,396.8 L307.2,396.8 L307.2,435.2 L204.8,435.2 Z"/></svg>'}
              </div>
              <div>
                <div class="adm-bottle-name">${esc(b.nome ?? 'Senza nome')}</div>
                <div class="adm-bottle-sub">${b.dosaggio_gl ? b.dosaggio_gl + ' g/L' : 'dosaggio n.d.'}</div>
              </div>
            </div>
          </td>
          <td><span class="adm-maison-tag">${esc(b.maison?.nome ?? '-')}</span></td>
          <td><span class="adm-type-tag ${b.tipo ?? ''}">${fmtTipo(b.tipo)}</span></td>
          <td>${b.is_millesimato ? `<span class="adm-badge active">${b.annata ?? '?'}</span>` : '<span class="adm-badge inactive">S.A.</span>'}</td>
          <td class="adm-time-cell">${timeAgo(b.created_at)}</td>
          <td><code class="adm-code">${b.id.slice(0,4)}…${b.id.slice(-4)}</code></td>
          <td onclick="event.stopPropagation()">
            <div class="adm-row-actions">
              <button class="adm-btn adm-btn-edit" onclick="viewApprovazioneDetail('${b.id}')">
                <i class="ti ti-eye"></i> Dettagli
              </button>
              <button class="adm-btn adm-btn-approve" onclick="approveBottiglia('${b.id}')">
                <i class="ti ti-check"></i>
              </button>
              <button class="adm-btn adm-btn-reject" onclick="rejectBottiglia('${b.id}','${esc(b.nome ?? '')}')">
                <i class="ti ti-x"></i>
              </button>
            </div>
          </td>
        </tr>`).join('')
    }

    // ── Maison ────────────────────────────────────────────
    if (!maisonPending?.length) {
      if (maisonWrap) maisonWrap.style.display = 'none'
    } else {
      if (maisonWrap) maisonWrap.style.display = ''
      if (maisonTbody) {
        maisonTbody.innerHTML = maisonPending.map(m => `
          <tr class="adm-table-row" style="cursor:pointer" onclick="editMaison('${m.id}')">
            <td>
              <div class="adm-user-cell">
                <div class="adm-maison-initial" style="width:32px;height:32px;font-size:13px;flex-shrink:0">${esc((m.nome ?? '?')[0].toUpperCase())}</div>
                <span class="adm-maison-name">${esc(m.nome ?? '-')}</span>
              </div>
            </td>
            <td><code class="adm-code">${esc(m.slug ?? '-')}</code></td>
            <td class="adm-time-cell">${timeAgo(m.created_at)}</td>
            <td onclick="event.stopPropagation()">
              <div class="adm-row-actions">
                <button class="adm-btn adm-btn-edit" onclick="editMaison('${m.id}')">
                  <i class="ti ti-pencil"></i> Modifica
                </button>
                <button class="adm-btn adm-btn-approve" onclick="approvaMaison('${m.id}')">
                  <i class="ti ti-check"></i>
                </button>
                <button class="adm-btn adm-btn-reject" onclick="rejectMaison('${m.id}','${esc(m.nome ?? '')}')">
                  <i class="ti ti-x"></i>
                </button>
              </div>
            </td>
          </tr>`).join('')
      }
    }

    // ── Foto in approvazione ──────────────────────────────
    const fotoWrap  = document.getElementById('approvazioni-foto-wrap')
    const fotoTbody = document.getElementById('approvazioni-foto-tbody')
    _fotoPendingCache = fotoPending || []
    if (!fotoPending?.length) {
      if (fotoWrap) fotoWrap.style.display = 'none'
    } else {
      if (fotoWrap) fotoWrap.style.display = ''
      if (fotoTbody) {
        fotoTbody.innerHTML = fotoPending.map(f => {
          const b = f.bottiglie || {}
          return `
          <tr class="adm-table-row" style="cursor:pointer" onclick="viewFotoPendingDetail('${f.id}')">
            <td>
              <div class="adm-bottle-cell">
                <div class="adm-bottle-thumb has-img clickable">
                  <img src="${esc(f.foto_url)}?t=${Date.now()}" alt="">
                </div>
                <div class="adm-bottle-name">${esc(b.nome ?? 'Bottiglia eliminata')}</div>
              </div>
            </td>
            <td><span class="adm-maison-tag">${esc(b.maison?.nome ?? '-')}</span></td>
            <td class="adm-time-cell">${timeAgo(f.created_at)}</td>
            <td onclick="event.stopPropagation()">
              <div class="adm-row-actions">
                <button class="adm-btn adm-btn-edit" onclick="viewFotoPendingDetail('${f.id}')">
                  <i class="ti ti-eye"></i> Confronta
                </button>
                <button class="adm-btn adm-btn-approve" onclick="approvaFotoPending('${f.id}')">
                  <i class="ti ti-check"></i>
                </button>
                <button class="adm-btn adm-btn-reject" onclick="rejectFotoPending('${f.id}')">
                  <i class="ti ti-x"></i>
                </button>
              </div>
            </td>
          </tr>`
        }).join('')
      }
    }
  } catch(e) { tbody.innerHTML = errorRow(7, e.message) }
}

let _fotoPendingCache = []

function viewFotoPendingDetail(id) {
  const f = _fotoPendingCache.find(x => x.id === id)
  if (!f) return
  const b = f.bottiglie || {}
  const currentUrl = b.foto_url
  const html = `
    <div class="adm-edit-form">
      <div style="font-size:13px;color:var(--text-2);margin-bottom:14px;">
        <strong style="color:var(--text)">${esc(b.nome ?? 'Bottiglia eliminata')}</strong> · ${esc(b.maison?.nome ?? '-')}
      </div>
      <div class="adm-foto-pending-compare">
        <div class="adm-foto-pending-slot">
          <div class="adm-foto-pending-label">Attuale</div>
          <div class="adm-foto-pending-img ${currentUrl ? '' : 'empty'}" ${currentUrl ? `onclick="openLightbox('${esc(currentUrl)}')"` : ''}>
            ${currentUrl ? `<img src="${esc(currentUrl)}?t=${Date.now()}" alt="">` : 'Nessuna foto'}
          </div>
        </div>
        <div class="adm-foto-pending-slot">
          <div class="adm-foto-pending-label">Candidata</div>
          <div class="adm-foto-pending-img" onclick="openLightbox('${esc(f.foto_url)}')">
            <img src="${esc(f.foto_url)}?t=${Date.now()}" alt="">
          </div>
        </div>
      </div>
      <div class="adm-modal-actions">
        <button class="adm-btn adm-btn-reject" onclick="rejectFotoPending('${f.id}');closeModal()">
          <i class="ti ti-x"></i> Rifiuta
        </button>
        <button class="adm-btn adm-btn-approve" onclick="approvaFotoPending('${f.id}');closeModal()">
          <i class="ti ti-check"></i> Approva
        </button>
      </div>
    </div>`
  openModal('Confronto foto', html)
}

async function approvaFotoPending(pendingId) {
  try {
    const { data: { session } } = await supa.auth.getSession()
    if (!session) throw new Error('Sessione admin non valida')
    const resp = await fetch(`${SUPA_URL}/functions/v1/admin-photo-upload`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type':  'application/json',
        'apikey':        SUPA_ANON,
      },
      body: JSON.stringify({ action: 'approve_photo', pending_id: pendingId }),
    })
    const r = await resp.json()
    if (!resp.ok || r.error) throw new Error(r.error || 'Errore durante l\'approvazione')
    showToast('Foto approvata e pubblicata ✓')
    loadApprovazioni()
  } catch(e) { showToast(e.message, 'error') }
}

async function rejectFotoPending(pendingId) {
  try {
    const { data: { session } } = await supa.auth.getSession()
    if (!session) throw new Error('Sessione admin non valida')
    const resp = await fetch(`${SUPA_URL}/functions/v1/admin-photo-upload`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type':  'application/json',
        'apikey':        SUPA_ANON,
      },
      body: JSON.stringify({ action: 'reject_photo', pending_id: pendingId }),
    })
    const r = await resp.json()
    if (!resp.ok || r.error) throw new Error(r.error || 'Errore durante il rifiuto')
    showToast('Foto rifiutata')
    loadApprovazioni()
  } catch(e) { showToast(e.message, 'error') }
}

async function approvaMaison(id) {
  try {
    const { data: upd, error } = await supa.from('maison').update({ needs_review: false, is_published: true }).eq('id', id).select('id')
    if (error) throw error
    if (!upd?.length) throw new Error('Approvazione bloccata da RLS — aggiungi policy UPDATE su maison')
    showToast('Maison approvata ✓')
    loadApprovazioni()
    loadMaison()
  } catch(e) { showToast(e.message, 'error') }
}

async function rejectMaison(id, nome) {
  if (!confirm(`Eliminare la maison "${nome || 'questa maison'}"?\nAttenzione: le bottiglie collegate perderanno il riferimento.`)) return
  try {
    const { data: deleted, error } = await supa.from('maison').delete().eq('id', id).select('id')
    if (error) throw error
    if (!deleted?.length) throw new Error('Eliminazione bloccata da RLS — aggiungi policy DELETE su maison')
    showToast('Maison eliminata')
    loadApprovazioni()
  } catch(e) { showToast(e.message, 'error') }
}

async function viewApprovazioneDetail(id) {
  openModal('Dettaglio Approvazione', loadingHTML(), true)
  try {
    const [{ data: b, error }, { data: maisonList }] = await Promise.all([
      supa.from('bottiglie').select('*').eq('id', id).single(),
      supa.from('maison').select('id, nome').order('nome')
    ])
    if (error) throw error

    const maisonOptions = (maisonList || []).map(m =>
      `<option value="${m.id}" ${m.id === b.maison_id ? 'selected' : ''}>${esc(m.nome)}</option>`
    ).join('')

    const fotoCol = b.foto_url !== undefined ? 'foto_url' : 'photo_url'
    const fotoUrl = b.foto_url ?? b.photo_url ?? null

    const assemblaggioJson = b.assemblaggio
      ? JSON.stringify(b.assemblaggio, null, 2)
      : ''
    const viniBaseJson = b.vini_base
      ? (typeof b.vini_base === 'object' ? JSON.stringify(b.vini_base, null, 2) : b.vini_base)
      : ''

    const html = `
      <div class="adm-edit-form">

        <!-- ═══ IDENTITÀ ════════════════════════════════ -->
        <div class="adm-edit-card">
          <div class="adm-edit-card-title"><i class="ti ti-id-badge-2"></i> Identità</div>
          <div class="adm-edit-card-body">
            <div class="adm-edit-grid">
              <div class="adm-form-field" style="grid-column:1/-1">
                <label class="adm-form-label">Nome Bottiglia</label>
                <input class="adm-form-input" type="text" data-col="nome" value="${esc(b.nome ?? '')}">
              </div>
              <div class="adm-form-field">
                <label class="adm-form-label">Maison</label>
                <select class="adm-form-input" data-col="maison_id">
                  <option value="">— Seleziona —</option>
                  ${maisonOptions}
                </select>
              </div>
              <div class="adm-form-field">
                <label class="adm-form-label">Tipo</label>
                <select class="adm-form-input" data-col="tipo">
                  <option value="">—</option>
                  <option value="assemblage"      ${b.tipo==='assemblage'      ?'selected':''}>Assemblage</option>
                  <option value="blanc_de_blancs" ${b.tipo==='blanc_de_blancs' ?'selected':''}>Blanc de Blancs</option>
                  <option value="blanc_de_noirs"  ${b.tipo==='blanc_de_noirs'  ?'selected':''}>Blanc de Noirs</option>
                  <option value="rose"            ${b.tipo==='rose'            ?'selected':''}>Rosé</option>
                </select>
              </div>
              <div class="adm-form-field">
                <label class="adm-form-label">Millésimé</label>
                <select class="adm-form-input" data-col="is_millesimato">
                  <option value="false" ${!b.is_millesimato?'selected':''}>Sans Année (S.A.)</option>
                  <option value="true"  ${b.is_millesimato ?'selected':''}>Millésimé</option>
                </select>
              </div>
              <div class="adm-form-field">
                <label class="adm-form-label">Annata</label>
                <input class="adm-form-input" type="number" min="1900" max="2100" data-col="annata" value="${b.annata ?? b.anno ?? ''}">
              </div>
              <div class="adm-form-field">
                <label class="adm-form-label">Slug</label>
                <input class="adm-form-input" type="text" data-col="slug" value="${esc(b.slug ?? '')}">
              </div>
            </div>
          </div>
        </div>

        <!-- ═══ CARATTERISTICHE ══════════════════════════ -->
        <div class="adm-edit-card">
          <div class="adm-edit-card-title"><i class="ti ti-list-details"></i> Caratteristiche</div>
          <div class="adm-edit-card-body">
            <div class="adm-edit-grid">
              <div class="adm-form-field">
                <label class="adm-form-label">Dosaggio (g/L)</label>
                <input class="adm-form-input" type="number" step="0.1" min="0" data-col="dosaggio_gl" value="${b.dosaggio_gl ?? ''}">
              </div>
              <div class="adm-form-field">
                <label class="adm-form-label">Dosaggio Tipo</label>
                <input class="adm-form-input" type="text" data-col="dosaggio_tipo" value="${esc(b.dosaggio_tipo ?? '')}" placeholder="es. Brut, Extra Brut…">
              </div>
              <div class="adm-form-field">
                <label class="adm-form-label">Score Medio</label>
                <input class="adm-form-input" type="number" step="0.1" min="0" max="100" data-col="score_medio" value="${b.score_medio ?? ''}">
              </div>
              <div class="adm-form-field">
                <label class="adm-form-label">Note Punteggio</label>
                <input class="adm-form-input" type="text" data-col="score_note" value="${esc(b.score_note ?? '')}" placeholder="es. RP 95, WS 93">
              </div>
              <div class="adm-form-field">
                <label class="adm-form-label">Prezzo Min (€)</label>
                <input class="adm-form-input" type="number" step="0.01" data-col="prezzo_min" value="${b.prezzo_min ?? ''}">
              </div>
              <div class="adm-form-field">
                <label class="adm-form-label">Prezzo Max (€)</label>
                <input class="adm-form-input" type="number" step="0.01" data-col="prezzo_max" value="${b.prezzo_max ?? ''}">
              </div>
              <div class="adm-form-field">
                <label class="adm-form-label">Fascia Prezzo</label>
                <select class="adm-form-input" data-col="fascia_prezzo">
                  <option value="">—</option>
                  ${['entry','mid','premium','prestige','ultra'].map(f =>
                    `<option value="${f}" ${b.fascia_prezzo===f?'selected':''}>${f}</option>`
                  ).join('')}
                </select>
              </div>
              <div class="adm-form-field">
                <label class="adm-form-label">Finestra Da (anno)</label>
                <input class="adm-form-input" type="number" min="1990" max="2100" data-col="finestra_da" value="${b.finestra_da ?? ''}">
              </div>
              <div class="adm-form-field">
                <label class="adm-form-label">Finestra A (anno)</label>
                <input class="adm-form-input" type="number" min="1990" max="2100" data-col="finestra_a" value="${b.finestra_a ?? ''}">
              </div>
            </div>
          </div>
        </div>

        <!-- ═══ UVAGGI & ASSEMBLAGGIO ════════════════════ -->
        <div class="adm-edit-card">
          <div class="adm-edit-card-title"><i class="ti ti-plant-2"></i> Uvaggi & Assemblaggio</div>
          <div class="adm-edit-card-body">
            <div class="adm-edit-grid">
              <div class="adm-form-field">
                <label class="adm-form-label">% Pinot Noir</label>
                <input class="adm-form-input" type="number" step="0.1" min="0" max="100" data-col="pct_pinot_noir" value="${b.pct_pinot_noir ?? ''}">
              </div>
              <div class="adm-form-field">
                <label class="adm-form-label">% Chardonnay</label>
                <input class="adm-form-input" type="number" step="0.1" min="0" max="100" data-col="pct_chardonnay" value="${b.pct_chardonnay ?? ''}">
              </div>
              <div class="adm-form-field">
                <label class="adm-form-label">% Meunier</label>
                <input class="adm-form-input" type="number" step="0.1" min="0" max="100" data-col="pct_meunier" value="${b.pct_meunier ?? ''}">
              </div>
              <div class="adm-form-field">
                <label class="adm-form-label">Provenienza Uve</label>
                <input class="adm-form-input" type="text" data-col="provenienza_uve" value="${esc(b.provenienza_uve ?? '')}">
              </div>
              <div class="adm-form-field" style="grid-column:1/-1">
                <label class="adm-form-label">Assemblaggio (JSON) <span style="font-weight:400;color:var(--text-3)">— es. [{"anno":2020,"perc":65},{"tipo":"riserva","perc":35}]</span></label>
                <textarea class="adm-form-input adm-mono" rows="4" style="resize:vertical;font-family:monospace;font-size:12px" data-col="assemblaggio" data-type="json">${esc(assemblaggioJson)}</textarea>
              </div>
              <div class="adm-form-field" style="grid-column:1/-1">
                <label class="adm-form-label">Vini di Base / Note (JSON o testo)</label>
                <textarea class="adm-form-input" rows="2" style="resize:vertical" data-col="vini_base" data-type="json">${esc(viniBaseJson)}</textarea>
              </div>
            </div>
          </div>
        </div>

        <!-- ═══ PRODUZIONE ═══════════════════════════════ -->
        <div class="adm-edit-card">
          <div class="adm-edit-card-title"><i class="ti ti-tools"></i> Produzione</div>
          <div class="adm-edit-card-body">
            <div class="adm-edit-grid">
              <div class="adm-form-field" style="grid-column:1/-1">
                <label class="adm-form-label">Vinificazione</label>
                <input class="adm-form-input" type="text" data-col="vinificazione" value="${esc(b.vinificazione ?? '')}">
              </div>
              <div class="adm-form-field">
                <label class="adm-form-label">Malolattica</label>
                <input class="adm-form-input" type="text" data-col="malolattica" value="${esc(b.malolattica ?? '')}">
              </div>
              <div class="adm-form-field">
                <label class="adm-form-label">Maturazione (mesi)</label>
                <input class="adm-form-input" type="number" data-col="maturazione_mesi" value="${b.maturazione_mesi ?? ''}">
              </div>
              <div class="adm-form-field">
                <label class="adm-form-label">Produzione (bottiglie)</label>
                <input class="adm-form-input" type="number" data-col="produzione_bottiglie" value="${b.produzione_bottiglie ?? ''}">
              </div>
            </div>
          </div>
        </div>

        <!-- ═══ NOTE & DEGUSTAZIONE ══════════════════════ -->
        <div class="adm-edit-card">
          <div class="adm-edit-card-title"><i class="ti ti-notes"></i> Note & Degustazione</div>
          <div class="adm-edit-card-body">
            <div class="adm-edit-grid">
              <div class="adm-form-field" style="grid-column:1/-1">
                <label class="adm-form-label">Note Vigneto</label>
                <textarea class="adm-form-input" rows="2" style="resize:vertical" data-col="note_vigneto">${esc(b.note_vigneto ?? '')}</textarea>
              </div>
              <div class="adm-form-field" style="grid-column:1/-1">
                <label class="adm-form-label">Note Degustazione</label>
                <textarea class="adm-form-input" rows="4" style="resize:vertical" data-col="note_degustazione">${esc(b.note_degustazione ?? '')}</textarea>
              </div>
              <div class="adm-form-field" style="grid-column:1/-1">
                <label class="adm-form-label">Abbinamento</label>
                <textarea class="adm-form-input" rows="2" style="resize:vertical" data-col="abbinamento">${esc(b.abbinamento ?? '')}</textarea>
              </div>
            </div>
          </div>
        </div>

        <!-- ═══ FOTO ═══════════════════════════════════════ -->
        <div class="adm-edit-card">
          <div class="adm-edit-card-title"><i class="ti ti-photo"></i> Foto</div>
          <div class="adm-edit-card-body">
            <div class="adm-edit-grid">
              ${photoPreviewField(fotoUrl, fotoCol, b.id)}
            </div>
          </div>
        </div>

        <div class="adm-edit-meta">
          <code class="adm-code" style="font-size:10px">${b.id}</code>
          <span style="color:var(--text-3);font-size:11px">Rilevata: ${fmtDate(b.created_at)}</span>
        </div>
        <div class="adm-modal-actions">
          <button class="adm-btn adm-btn-reject" onclick="rejectBottiglia('${b.id}','${esc(b.nome ?? '')}')">
            <i class="ti ti-trash"></i> Elimina
          </button>
          <button class="adm-btn adm-btn-ghost" onclick="closeModal()">Chiudi</button>
          <button class="adm-btn adm-btn-ghost" onclick="saveAndKeepApprovazione('${b.id}')">
            <i class="ti ti-device-floppy"></i> Salva
          </button>
          <button class="adm-btn adm-btn-approve" onclick="saveAndApproveBottiglia('${b.id}')">
            <i class="ti ti-check"></i> Salva e approva
          </button>
        </div>
      </div>`
    document.getElementById('modal-body').innerHTML = html
  } catch(e) {
    document.getElementById('modal-body').innerHTML = errorHTML(e.message)
  }
}

async function saveAndApproveBottiglia(id) {
  const saved = await saveBottigliaFields(id, false)
  if (!saved) return
  const { data: upd, error } = await supa.from('bottiglie').update({ needs_review: false, is_published: true }).eq('id', id).select('id')
  if (error) { showToast(error.message, 'error'); return }
  if (!upd?.length) { showToast('Approvazione bloccata da RLS — esegui la query SQL admin', 'error'); return }
  closeModal()
  showToast('Bottiglia approvata e pubblicata ✓')
  loadApprovazioni()
}

async function saveAndKeepApprovazione(id) {
  await saveBottigliaFields(id, true)
  loadApprovazioni()
}

async function approveBottiglia(id) {
  try {
    const { data: upd, error } = await supa.from('bottiglie').update({ needs_review: false }).eq('id', id).select('id')
    if (error) throw error
    if (!upd?.length) throw new Error('Approvazione bloccata da RLS — esegui la query SQL admin')
    showToast('Bottiglia approvata e pubblicata ✓')
    loadApprovazioni()
  } catch(e) { showToast(e.message, 'error') }
}

async function rejectBottiglia(id, nome) {
  if (!confirm(`Eliminare definitivamente "${nome || 'questa bottiglia'}"?\nL'operazione non è reversibile.`)) return
  try {
    // 1. Elimina foto dallo storage via admin-photo-upload (service role, bypassa RLS)
    const { data: { session } } = await supa.auth.getSession()
    if (session) {
      const resp = await fetch(`${SUPA_URL}/functions/v1/admin-photo-upload`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type':  'application/json',
          'apikey':        SUPA_ANON,
        },
        body: JSON.stringify({ action: 'delete', bottle_id: id }),
      })
      const r = await resp.json()
      if (!resp.ok) console.warn('Storage delete warning:', r.error)
    }

    // 2. Elimina bottiglia dal DB
    const { data: deleted, error } = await supa.from('bottiglie').delete().eq('id', id).select('id')
    if (error) throw error
    if (!deleted?.length) throw new Error('Eliminazione bloccata da RLS — aggiungi policy DELETE su bottiglie')
    closeModal()
    showToast('Bottiglia eliminata ✓')
    loadApprovazioni()
  } catch(e) { showToast(e.message, 'error') }
}

// ══════════════════════════════════════════════════════
// BOTTIGLIE
// ══════════════════════════════════════════════════════
async function renderBottiglie() {
  const tbody = document.getElementById('bottiglie-tbody')
  if (!tbody) return
  tbody.innerHTML = loadingRow(8)
  try {
    let data, count

    if (bottigliaSearch || bottigliaLetterFilter) {
      // Ricerca/filtro lettera lato client: la colonna nome_norm è GENERATA dal
      // database e non rimuove punteggiatura/spazi, quindi "rd 2008" non
      // troverebbe "R.D. 2008" via ilike; inoltre il filtro lettera deve poter
      // matchare anche l'iniziale della maison (es. "S" per bottiglie Salon
      // chiamate "Cuvée S..."), cosa che una ilike sulla sola colonna
      // bottiglie.nome_norm non può fare. Scarichiamo il set filtrato dagli
      // altri criteri (dataset piccolo) e confrontiamo lato client.
      let query = supa
        .from('bottiglie')
        .select('*, maison:maison_id(nome)')
        .eq('needs_review', false)

      if (bottigliaFilter === 'millesimato') query = query.eq('is_millesimato', true)
      else if (bottigliaFilter)              query = query.eq('tipo', bottigliaFilter)
      if (bottigliaStatusFilter === 'online')  query = query.eq('is_published', true)
      if (bottigliaStatusFilter === 'offline') query = query.eq('is_published', false)
      if (bottigliaFotoFilter) query = query.not('foto_url', 'is', null)

      switch (bottigliaSort) {
        case 'recente':
          query = query.order('created_at', { ascending: false })
          break
        case 'prezzo_asc':
          query = query.order('prezzo_min', { ascending: true,  nullsFirst: false })
          break
        case 'prezzo_desc':
          query = query.order('prezzo_max', { ascending: false, nullsFirst: false })
          break
        case 'score':
          query = query.order('score_medio', { ascending: false, nullsFirst: false })
          break
        case 'millesimato':
          query = query
            .order('is_millesimato', { ascending: false })
            .order('annata', { ascending: false, nullsFirst: false })
          break
        default:
          query = query.order('nome')
      }

      const { data: all, error } = await query
      if (error) throw error

      let filtered = (all || []).filter(b => matchesAllTerms(bottigliaSearch, b.nome, b.maison?.nome))
      if (bottigliaLetterFilter) {
        const l = norm(bottigliaLetterFilter)
        filtered = filtered.filter(b => norm(b.nome ?? '').startsWith(l) || norm(b.maison?.nome ?? '').startsWith(l))
      }

      count = filtered.length
      data  = filtered.slice((bottigliaPage-1)*bottigliaPerPage, bottigliaPage*bottigliaPerPage)
    } else {
      let query = supa
        .from('bottiglie')
        .select('*, maison:maison_id(nome)', { count: 'exact' })
        .eq('needs_review', false)

      if (bottigliaFilter === 'millesimato') query = query.eq('is_millesimato', true)
      else if (bottigliaFilter)              query = query.eq('tipo', bottigliaFilter)
      if (bottigliaStatusFilter === 'online')  query = query.eq('is_published', true)
      if (bottigliaStatusFilter === 'offline') query = query.eq('is_published', false)
      if (bottigliaFotoFilter) query = query.not('foto_url', 'is', null)
      // bottigliaLetterFilter è gestito nel ramo client-side sopra (deve poter
      // matchare anche l'iniziale della maison, non solo quella della bottiglia)

      // ── Ordinamento ──────────────────────────────────
      switch (bottigliaSort) {
        case 'recente':
          query = query.order('created_at', { ascending: false })
          break
        case 'prezzo_asc':
          query = query.order('prezzo_min', { ascending: true,  nullsFirst: false })
          break
        case 'prezzo_desc':
          query = query.order('prezzo_max', { ascending: false, nullsFirst: false })
          break
        case 'score':
          query = query.order('score_medio', { ascending: false, nullsFirst: false })
          break
        case 'millesimato':
          query = query
            .order('is_millesimato', { ascending: false })
            .order('annata', { ascending: false, nullsFirst: false })
          break
        default:
          query = query.order('nome')
      }

      query = query.range((bottigliaPage-1)*bottigliaPerPage, bottigliaPage*bottigliaPerPage - 1)

      const result = await query
      if (result.error) throw result.error
      data  = result.data
      count = result.count
    }

    const sub = document.getElementById('bottiglie-subtitle')
    if (sub) sub.textContent = (count ?? 0).toLocaleString('it') + ' bottiglie pubblicate'

    if (!data.length) {
      tbody.innerHTML = `<tr><td colspan="8"><div style="padding:32px;text-align:center;color:var(--text-3)">Nessuna bottiglia trovata</div></td></tr>`
    } else {
      tbody.innerHTML = data.map(b => `
        <tr class="adm-table-row" style="cursor:pointer" onclick="editBottiglia('${b.id}')">
          <td>
            <div class="adm-bottle-cell">
              <div class="adm-bottle-thumb ${(b.foto_url || b.photo_url) ? 'has-img clickable' : ''}"
                   ${(b.foto_url || b.photo_url) ? `onclick="event.stopPropagation();openLightbox('${esc(b.foto_url || b.photo_url)}')"` : ''}>
                ${(b.foto_url || b.photo_url)
                  ? `<img src="${esc(b.foto_url || b.photo_url)}?t=${Date.now()}" alt="">`
                  : '<svg viewBox="0 0 512 512" fill="currentColor"><path fill-rule="evenodd" clip-rule="evenodd" d="M217.6,0 L294.4,0 L294.4,76.8 C294.4,256 371.2,217.6 371.2,396.8 L371.2,512 L140.8,512 L140.8,396.8 C140.8,217.6 217.6,256 217.6,76.8 Z M335.057,240.943 L256,320 L176.943,240.943 L176.943,258.943 L256,338 L335.057,258.943 Z M204.8,396.8 L307.2,396.8 L307.2,435.2 L204.8,435.2 Z"/></svg>'}
              </div>
              <div>
                <div class="adm-bottle-name">${esc(b.nome ?? '')}</div>
                <div class="adm-bottle-sub">${b.annata ?? b.anno ?? 'S.A.'} · 75cl</div>
              </div>
            </div>
          </td>
          <td><span class="adm-maison-tag">${esc(b.maison?.nome ?? '-')}</span></td>
          <td><span class="adm-type-tag ${b.tipo ?? ''}">${fmtTipo(b.tipo)}</span></td>
          <td>${b.is_millesimato && (b.annata ?? b.anno) ? `<span class="adm-badge active">${b.annata ?? b.anno}</span>` : '<span class="adm-badge inactive">S.A.</span>'}</td>
          <td class="adm-mono">${b.dosaggio_gl ? b.dosaggio_gl + ' g/L' : '-'}</td>
          <td class="adm-mono" style="font-size:10px">—</td>
          <td>
            <span class="adm-badge ${b.is_published !== false ? 'active' : 'offline'} adm-status-badge"
                  onclick="event.stopPropagation();toggleBottigliaStatus('${b.id}',${b.is_published !== false})">
              ${b.is_published !== false ? 'ONLINE' : 'OFFLINE'}
            </span>
          </td>
          <td>
            <div class="adm-row-actions">
              <button class="adm-btn adm-btn-edit" onclick="event.stopPropagation();editBottiglia('${b.id}')">
                <i class="ti ti-pencil"></i>
              </button>
              <button class="adm-btn adm-btn-reject" onclick="event.stopPropagation();deleteBottiglia('${b.id}','${esc(b.nome ?? '')}')">
                <i class="ti ti-trash"></i>
              </button>
            </div>
          </td>
        </tr>`).join('')
    }

    renderPagination('bottiglie-pagination', bottigliaPage, Math.ceil((count??0)/bottigliaPerPage), 'bottiglieGoToPage')
    const fc = document.getElementById('bottiglie-footer-count')
    if (fc) fc.textContent = `Mostrando ${Math.min((bottigliaPage-1)*bottigliaPerPage+1, count??0)}–${Math.min(bottigliaPage*bottigliaPerPage, count??0)} di ${(count??0).toLocaleString('it')}`
  } catch(e) { tbody.innerHTML = errorRow(8, e.message) }
}

function bottiglieGoToPage(p) { bottigliaPage = p; renderBottiglie() }

function changeBottigliaPerPage(val) {
  bottigliaPerPage = parseInt(val, 10) || 50
  bottigliaPage = 1
  renderBottiglie()
}

function filterBottiglie(tipo, btn) {
  bottigliaFilter = (tipo === bottigliaFilter) ? '' : tipo
  document.querySelectorAll('#view-bottiglie .adm-filter').forEach(b => b.classList.remove('active'))
  if (!bottigliaFilter) document.querySelector('#view-bottiglie .adm-filter').classList.add('active')
  else btn.classList.add('active')
  bottigliaPage = 1; renderBottiglie()
}

function filterBottigliaStatus(status, btn) {
  bottigliaStatusFilter = (status === bottigliaStatusFilter) ? '' : status
  document.querySelectorAll('#view-bottiglie .adm-filter-status').forEach(b => b.classList.remove('active'))
  if (!bottigliaStatusFilter) document.querySelector('#view-bottiglie .adm-filter-status').classList.add('active')
  else btn.classList.add('active')
  bottigliaPage = 1; renderBottiglie()
}

function filterBottigliaSort(sort, btn) {
  bottigliaSort = sort
  document.querySelectorAll('#view-bottiglie .adm-filter-sort').forEach(b => b.classList.remove('active'))
  btn.classList.add('active')
  bottigliaPage = 1; renderBottiglie()
}

function filterBottigliaFoto(btn) {
  bottigliaFotoFilter = !bottigliaFotoFilter
  btn.classList.toggle('active', bottigliaFotoFilter)
  bottigliaPage = 1; renderBottiglie()
}

function filterBottigliaLetter(letter, btn) {
  bottigliaLetterFilter = (letter !== '' && letter === bottigliaLetterFilter) ? '' : letter
  document.querySelectorAll('#view-bottiglie .adm-filter-letter').forEach(b => b.classList.remove('active'))
  if (!bottigliaLetterFilter) {
    document.querySelector('#view-bottiglie .adm-filter-letter.all-btn')?.classList.add('active')
  } else {
    btn.classList.add('active')
  }
  bottigliaPage = 1; renderBottiglie()
}

function searchBottiglie(val) {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => { bottigliaSearch = val.trim(); bottigliaPage = 1; renderBottiglie() }, 400)
}

async function deleteBottiglia(id, nome) {
  if (!confirm(`Eliminare "${nome || 'questa bottiglia'}"?`)) return
  try {
    // Elimina foto dallo storage (non blocca se non esiste)
    await supa.storage.from('champagne-photos').remove([`bottles/${id}.jpg`])

    const { data: deleted, error } = await supa.from('bottiglie').delete().eq('id', id).select('id')
    if (error) throw error
    if (!deleted?.length) throw new Error('Eliminazione bloccata da RLS — esegui la query SQL admin')
    showToast('Bottiglia e foto eliminate')
    renderBottiglie()
  } catch(e) { showToast(e.message, 'error') }
}

async function toggleBottigliaStatus(id, currentlyOnline) {
  const newStatus = !currentlyOnline
  try {
    const { data: upd, error } = await supa.from('bottiglie')
      .update({ is_published: newStatus }).eq('id', id).select('id')
    if (error) throw error
    if (!upd?.length) throw new Error('Aggiornamento bloccato da RLS')
    showToast(newStatus ? 'Bottiglia online ✓' : 'Bottiglia portata offline')
    renderBottiglie()
  } catch(e) { showToast(e.message, 'error') }
}

async function toggleMaisonStatus(id, currentlyOnline) {
  const newStatus = !currentlyOnline
  try {
    const { data: upd, error } = await supa.from('maison')
      .update({ is_published: newStatus }).eq('id', id).select('id')
    if (error) throw error
    if (!upd?.length) throw new Error('Aggiornamento bloccato da RLS')
    showToast(newStatus ? 'Maison online ✓' : 'Maison portata offline')
    loadMaison()
  } catch(e) { showToast(e.message, 'error') }
}

// Template per "Nuova bottiglia" — stesse chiavi di una riga reale, valori di
// default sensati, così il form è identico (stessi campi) sia in modifica che
// in creazione.
const BOTTIGLIA_TEMPLATE = {
  maison_id: null, nome: '', slug: '', tipo: null, is_millesimato: false,
  dosaggio_gl: null, dosaggio_tipo: '', pct_pinot_noir: null, pct_chardonnay: null, pct_meunier: null,
  provenienza_uve: '', vini_base: '', vinificazione: '', malolattica: '', maturazione_mesi: null,
  produzione_bottiglie: null, note_vigneto: '', note_degustazione: '', abbinamento: '',
  prezzo_min: null, prezzo_max: null, score_medio: null, score_note: '', finestra_da: null, finestra_a: null,
  stile: '', fascia_prezzo: '', foto_url: null, is_featured: false, is_published: true,
  assemblaggio: null, annata: null, source: 'manual', needs_review: false,
  link_millesima: '', link_callmewine: '', link_tannico: '',
  link_custom1_nome: '', link_custom1_url: '', link_custom2_nome: '', link_custom2_url: ''
}

// Costruisce le card di campi (Foto → Altre Informazioni) condivise tra
// modifica e creazione — b è la riga reale in modifica, BOTTIGLIA_TEMPLATE
// in creazione. Il footer/meta restano a carico del chiamante.
function _bottigliaFieldsHTML(b, maisonList) {
    const maisonOptions = (maisonList || []).map(m =>
      `<option value="${m.id}" ${m.id === b.maison_id ? 'selected' : ''}>${esc(m.nome)}</option>`
    ).join('')

    // Columns handled manually below — excluded from buildAllColsForm catch-all
    const CUSTOM = [
      'id','nome','maison_id','tipo','is_millesimato','dosaggio_gl','needs_review',
      'created_at','updated_at','foto_url','photo_url','nome_norm',
      'annata','anno','score_medio','finestra_da','finestra_a',
      'dosaggio_tipo','fascia_prezzo','prezzo_min','prezzo_max',
      'pct_pinot_noir','pct_chardonnay','pct_meunier',
      'provenienza_uve','vini_base','assemblaggio',
      'vinificazione','malolattica','maturazione_mesi','produzione_bottiglie',
      'note_vigneto','note_degustazione','abbinamento','score_note','stile',
      'is_featured','is_published',
      'link_millesima','link_callmewine','link_tannico',
      'link_custom1_nome','link_custom1_url','link_custom2_nome','link_custom2_url'
    ]

    const fotoCol  = b.foto_url !== undefined ? 'foto_url' : 'photo_url'
    const fotoUrl  = b.foto_url ?? b.photo_url ?? null
    const extraFields = buildAllColsForm(b, { skip: CUSTOM })

    return `
        <!-- ═══ FOTO ═══════════════════════════════════ -->
        <div class="adm-edit-card">
          <div class="adm-edit-card-title"><i class="ti ti-photo"></i> Foto</div>
          <div class="adm-edit-card-body">
            <div class="adm-edit-grid">
              ${photoPreviewField(fotoUrl, fotoCol, b.id ?? '')}
            </div>
          </div>
        </div>

        <!-- ═══ IDENTITÀ ════════════════════════════════ -->
        <div class="adm-edit-card">
          <div class="adm-edit-card-title"><i class="ti ti-id-badge-2"></i> Identità</div>
          <div class="adm-edit-card-body">
            <div class="adm-edit-grid">
              <div class="adm-form-field" style="grid-column:1/-1">
                <label class="adm-form-label">Nome Bottiglia</label>
                <input class="adm-form-input" type="text" data-col="nome" value="${esc(b.nome ?? '')}">
              </div>
              <div class="adm-form-field">
                <label class="adm-form-label">Maison</label>
                <select class="adm-form-input" data-col="maison_id">
                  <option value="">— Seleziona —</option>
                  ${maisonOptions}
                </select>
              </div>
              <div class="adm-form-field">
                <label class="adm-form-label">Tipo</label>
                <select class="adm-form-input" data-col="tipo">
                  <option value="">—</option>
                  <option value="assemblage"      ${b.tipo==='assemblage'      ?'selected':''}>Assemblage</option>
                  <option value="blanc_de_blancs" ${b.tipo==='blanc_de_blancs' ?'selected':''}>Blanc de Blancs</option>
                  <option value="blanc_de_noirs"  ${b.tipo==='blanc_de_noirs'  ?'selected':''}>Blanc de Noirs</option>
                  <option value="rose"            ${b.tipo==='rose'            ?'selected':''}>Rosé</option>
                </select>
              </div>
              <div class="adm-form-field">
                <label class="adm-form-label">Millésimé</label>
                <select class="adm-form-input" data-col="is_millesimato">
                  <option value="false" ${!b.is_millesimato?'selected':''}>Sans Année (S.A.)</option>
                  <option value="true"  ${b.is_millesimato ?'selected':''}>Millésimé</option>
                </select>
              </div>
              <div class="adm-form-field">
                <label class="adm-form-label">Annata</label>
                <input class="adm-form-input" type="number" min="1900" max="2100" data-col="annata" value="${b.annata ?? b.anno ?? ''}">
              </div>
              <div class="adm-form-field">
                <label class="adm-form-label">Stato</label>
                <select class="adm-form-input" data-col="is_published">
                  <option value="true"  ${b.is_published !== false ?'selected':''}>● Online</option>
                  <option value="false" ${b.is_published === false  ?'selected':''}>○ Offline</option>
                </select>
              </div>
              <div class="adm-form-field">
                <label class="adm-form-label">In Evidenza</label>
                <select class="adm-form-input" data-col="is_featured">
                  <option value="false" ${!b.is_featured?'selected':''}>No</option>
                  <option value="true"  ${b.is_featured ?'selected':''}>Sì</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        <!-- ═══ CARATTERISTICHE ══════════════════════════ -->
        <div class="adm-edit-card">
          <div class="adm-edit-card-title"><i class="ti ti-list-details"></i> Caratteristiche</div>
          <div class="adm-edit-card-body">
            <div class="adm-edit-grid">
              <div class="adm-form-field">
                <label class="adm-form-label">Dosaggio (g/L)</label>
                <input class="adm-form-input" type="number" step="0.1" min="0" data-col="dosaggio_gl" value="${b.dosaggio_gl ?? ''}">
              </div>
              <div class="adm-form-field">
                <label class="adm-form-label">Dosaggio Tipo</label>
                <input class="adm-form-input" type="text" data-col="dosaggio_tipo"
                       value="${esc(b.dosaggio_tipo ?? '')}" placeholder="es. Brut, Extra Brut…">
              </div>
              <div class="adm-form-field">
                <label class="adm-form-label">Score Medio</label>
                <input class="adm-form-input" type="number" step="0.1" min="0" max="100" data-col="score_medio" value="${b.score_medio ?? ''}">
              </div>
              <div class="adm-form-field">
                <label class="adm-form-label">Fascia Prezzo</label>
                <input class="adm-form-input" type="text" data-col="fascia_prezzo"
                       value="${esc(b.fascia_prezzo ?? '')}" placeholder="es. €€€">
              </div>
              <div class="adm-form-field">
                <label class="adm-form-label">Prezzo Min (€)</label>
                <input class="adm-form-input" type="number" step="0.01" data-col="prezzo_min" value="${b.prezzo_min ?? ''}">
              </div>
              <div class="adm-form-field">
                <label class="adm-form-label">Prezzo Max (€)</label>
                <input class="adm-form-input" type="number" step="0.01" data-col="prezzo_max" value="${b.prezzo_max ?? ''}">
              </div>
            </div>
          </div>
        </div>

        <!-- ═══ UVAGGI & ASSEMBLAGGIO ════════════════════ -->
        <div class="adm-edit-card">
          <div class="adm-edit-card-title"><i class="ti ti-plant-2"></i> Uvaggi & Assemblaggio</div>
          <div class="adm-edit-card-body">
            <div class="adm-edit-grid">
              <div class="adm-form-field">
                <label class="adm-form-label">% Pinot Noir</label>
                <input class="adm-form-input" type="number" step="0.1" min="0" max="100" data-col="pct_pinot_noir" value="${b.pct_pinot_noir ?? ''}">
              </div>
              <div class="adm-form-field">
                <label class="adm-form-label">% Chardonnay</label>
                <input class="adm-form-input" type="number" step="0.1" min="0" max="100" data-col="pct_chardonnay" value="${b.pct_chardonnay ?? ''}">
              </div>
              <div class="adm-form-field">
                <label class="adm-form-label">% Meunier</label>
                <input class="adm-form-input" type="number" step="0.1" min="0" max="100" data-col="pct_meunier" value="${b.pct_meunier ?? ''}">
              </div>
              <div class="adm-form-field">
                <label class="adm-form-label">Provenienza Uve</label>
                <input class="adm-form-input" type="text" data-col="provenienza_uve" value="${esc(b.provenienza_uve ?? '')}">
              </div>
              <div class="adm-form-field" style="grid-column:1/-1">
                <label class="adm-form-label">Stile</label>
                <input class="adm-form-input" type="text" data-col="stile"
                       value="${esc(b.stile ?? '')}" placeholder="es. Blanc de Blancs, Rosé, Prestige…">
              </div>
              <div class="adm-form-field" style="grid-column:1/-1">
                <label class="adm-form-label">Vini di Base (note)</label>
                <textarea class="adm-form-input" rows="2" style="resize:vertical" data-col="vini_base">${esc(b.vini_base ?? '')}</textarea>
              </div>
            </div>
          </div>
        </div>

        <!-- ═══ PRODUZIONE & FINESTRA ════════════════════ -->
        <div class="adm-edit-card">
          <div class="adm-edit-card-title"><i class="ti ti-tools"></i> Produzione & Finestra di Degustazione</div>
          <div class="adm-edit-card-body">
            <div class="adm-edit-grid">
              <div class="adm-form-field" style="grid-column:1/-1">
                <label class="adm-form-label">Vinificazione</label>
                <input class="adm-form-input" type="text" data-col="vinificazione" value="${esc(b.vinificazione ?? '')}">
              </div>
              <div class="adm-form-field">
                <label class="adm-form-label">Malolattica</label>
                <input class="adm-form-input" type="text" data-col="malolattica" value="${esc(b.malolattica ?? '')}">
              </div>
              <div class="adm-form-field">
                <label class="adm-form-label">Maturazione (mesi)</label>
                <input class="adm-form-input" type="number" data-col="maturazione_mesi" value="${b.maturazione_mesi ?? ''}">
              </div>
              <div class="adm-form-field">
                <label class="adm-form-label">Produzione (bottiglie)</label>
                <input class="adm-form-input" type="number" data-col="produzione_bottiglie" value="${b.produzione_bottiglie ?? ''}">
              </div>
              <div class="adm-form-field"></div>
              <div class="adm-form-field">
                <label class="adm-form-label">Finestra Da (anno)</label>
                <input class="adm-form-input" type="number" min="1990" max="2100" data-col="finestra_da" value="${b.finestra_da ?? ''}">
              </div>
              <div class="adm-form-field">
                <label class="adm-form-label">Finestra A (anno)</label>
                <input class="adm-form-input" type="number" min="1990" max="2100" data-col="finestra_a" value="${b.finestra_a ?? ''}">
              </div>
            </div>
          </div>
        </div>

        <!-- ═══ DESCRIZIONE & NOTE ═══════════════════════ -->
        <div class="adm-edit-card">
          <div class="adm-edit-card-title"><i class="ti ti-notes"></i> Descrizione & Note</div>
          <div class="adm-edit-card-body">
            <div class="adm-edit-grid">
              <div class="adm-form-field" style="grid-column:1/-1">
                <label class="adm-form-label">Note Vigneto</label>
                <textarea class="adm-form-input" rows="3" style="resize:vertical" data-col="note_vigneto">${esc(b.note_vigneto ?? '')}</textarea>
              </div>
              <div class="adm-form-field" style="grid-column:1/-1">
                <label class="adm-form-label">Note Degustazione</label>
                <textarea class="adm-form-input" rows="4" style="resize:vertical" data-col="note_degustazione">${esc(b.note_degustazione ?? '')}</textarea>
              </div>
              <div class="adm-form-field" style="grid-column:1/-1">
                <label class="adm-form-label">Abbinamento</label>
                <textarea class="adm-form-input" rows="2" style="resize:vertical" data-col="abbinamento">${esc(b.abbinamento ?? '')}</textarea>
              </div>
              <div class="adm-form-field" style="grid-column:1/-1">
                <label class="adm-form-label">Note Punteggio</label>
                <input class="adm-form-input" type="text" data-col="score_note"
                       value="${esc(b.score_note ?? '')}" placeholder="Breve commento al punteggio…">
              </div>
            </div>
          </div>
        </div>

        <!-- ═══ DOVE ACQUISTARE ══════════════════════════ -->
        <div class="adm-edit-card">
          <div class="adm-edit-card-title"><i class="ti ti-shopping-bag"></i> Dove Acquistare</div>
          <div class="adm-edit-card-body">
            <div class="adm-edit-grid">
              <div class="adm-form-field" style="grid-column:1/-1">
                <label class="adm-form-label">Link Millésima</label>
                <input class="adm-form-input" type="url" data-col="link_millesima"
                       value="${esc(b.link_millesima ?? '')}"
                       placeholder="https://www.millesima.it/prodotto/...">
              </div>
              <div class="adm-form-field" style="grid-column:1/-1">
                <label class="adm-form-label">Link Callmewine</label>
                <input class="adm-form-input" type="url" data-col="link_callmewine"
                       value="${esc(b.link_callmewine ?? '')}"
                       placeholder="https://www.callmewine.com/...">
              </div>
              <div class="adm-form-field" style="grid-column:1/-1">
                <label class="adm-form-label">Link Tannico</label>
                <input class="adm-form-input" type="url" data-col="link_tannico"
                       value="${esc(b.link_tannico ?? '')}"
                       placeholder="https://www.tannico.it/...">
              </div>
              <div style="grid-column:1/-1;padding-top:4px;border-top:1px dashed var(--border);">
                <div style="font-family:var(--mono);font-size:10px;color:var(--text-3);text-transform:uppercase;letter-spacing:1px;margin-bottom:12px;">
                  Link personalizzati (opzionali)
                </div>
                <div class="adm-edit-grid" style="margin:0">
                  <div class="adm-form-field">
                    <label class="adm-form-label">Personalizzato 1 · Nome</label>
                    <input class="adm-form-input" type="text" data-col="link_custom1_nome"
                           value="${esc(b.link_custom1_nome ?? '')}" placeholder="es. Vino.com">
                  </div>
                  <div class="adm-form-field">
                    <label class="adm-form-label">Personalizzato 1 · URL</label>
                    <input class="adm-form-input" type="url" data-col="link_custom1_url"
                           value="${esc(b.link_custom1_url ?? '')}" placeholder="https://...">
                  </div>
                  <div class="adm-form-field">
                    <label class="adm-form-label">Personalizzato 2 · Nome</label>
                    <input class="adm-form-input" type="text" data-col="link_custom2_nome"
                           value="${esc(b.link_custom2_nome ?? '')}" placeholder="es. Vinolog">
                  </div>
                  <div class="adm-form-field">
                    <label class="adm-form-label">Personalizzato 2 · URL</label>
                    <input class="adm-form-input" type="url" data-col="link_custom2_url"
                           value="${esc(b.link_custom2_url ?? '')}" placeholder="https://...">
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        ${extraFields ? `
        <!-- ═══ ALTRE INFORMAZIONI ══════════════════════ -->
        <div class="adm-edit-card">
          <div class="adm-edit-card-title"><i class="ti ti-dots"></i> Altre Informazioni</div>
          <div class="adm-edit-card-body">
            <div class="adm-edit-grid">${extraFields}</div>
          </div>
        </div>` : ''}
      `
}

async function editBottiglia(id) {
  openModal('Modifica Bottiglia', loadingHTML(), true)
  try {
    const [{ data: b, error }, { data: maisonList }] = await Promise.all([
      supa.from('bottiglie').select('*').eq('id', id).single(),
      supa.from('maison').select('id, nome').order('nome')
    ])
    if (error) throw error

    const html = `
      <div class="adm-edit-form">
        ${_bottigliaFieldsHTML(b, maisonList)}
        <div class="adm-edit-meta">
          <code class="adm-code" style="font-size:10px">${b.id}</code>
          <span style="color:var(--text-3);font-size:11px">Aggiunta: ${fmtDate(b.created_at)}</span>
        </div>
        <div class="adm-modal-actions">
          <button class="adm-btn adm-btn-ghost" onclick="closeModal()">Annulla</button>
          <button class="adm-btn adm-btn-primary" onclick="saveBottigliaFields('${b.id}', true)">
            <i class="ti ti-device-floppy"></i> Salva modifiche
          </button>
        </div>
      </div>`
    document.getElementById('modal-body').innerHTML = html
  } catch(e) { document.getElementById('modal-body').innerHTML = errorHTML(e.message) }
}

async function openNewBottigliaModal() {
  openModal('Nuova Bottiglia', loadingHTML(), true)
  try {
    const { data: maisonList, error } = await supa.from('maison').select('id, nome').order('nome')
    if (error) throw error

    const html = `
      <div class="adm-edit-form">
        ${_bottigliaFieldsHTML(BOTTIGLIA_TEMPLATE, maisonList)}
        <div class="adm-modal-actions">
          <button class="adm-btn adm-btn-ghost" onclick="closeModal()">Annulla</button>
          <button class="adm-btn adm-btn-primary" onclick="createBottiglia()">
            <i class="ti ti-plus"></i> Crea bottiglia
          </button>
        </div>
      </div>`
    document.getElementById('modal-body').innerHTML = html
  } catch(e) { document.getElementById('modal-body').innerHTML = errorHTML(e.message) }
}

async function createBottiglia() {
  const updates = collectDataCols()
  if (!updates.nome || !updates.nome.trim())       { showToast('Il nome della bottiglia è obbligatorio', 'error'); return }
  if (!updates.maison_id)                          { showToast('Seleziona una maison', 'error'); return }
  if (!updates.slug || !updates.slug.trim()) updates.slug = slugify(updates.nome)
  try {
    const { data, error } = await supa.from('bottiglie').insert(updates).select('id').single()
    if (error) throw error
    closeModal()
    showToast('Bottiglia creata ✓')
    bottigliaPage = 1
    renderBottiglie()
  } catch(e) { showToast(e.message, 'error') }
}

async function saveBottigliaFields(id, closeAfter) {
  const updates = collectDataCols()
  try {
    const { data, error } = await supa.from('bottiglie').update(updates).eq('id', id).select('id')
    if (error) throw error
    if (!data || !data.length) throw new Error('Nessuna riga aggiornata: verifica i permessi (RLS) sulla tabella bottiglie')
    if (closeAfter) { closeModal(); showToast('Bottiglia aggiornata ✓'); renderBottiglie() }
    return true
  } catch(e) { showToast(e.message, 'error'); return false }
}

// ══════════════════════════════════════════════════════
// MAISON
// ══════════════════════════════════════════════════════
async function loadMaison() {
  const grid = document.getElementById('maison-grid')
  if (!grid) return
  grid.innerHTML = '<div class="adm-loading-block"><i class="ti ti-loader-2 spin"></i> Caricamento...</div>'
  try {
    // ── Sort: gestito lato DB per affidabilità ─────────
    let query = supa.from('maison').select('*')
    if (maisonSort === 'recente') {
      query = query.order('created_at', { ascending: false }).order('id', { ascending: false })
    } else {
      query = query.order('nome')
    }

    const { data: all, error } = await query
    if (error) throw error

    // ── Filtri client-side (solo rimozione righe, l'ordine DB è già corretto) ──
    let data = all

    if (maisonSearch) {
      data = data.filter(m => matchesAllTerms(maisonSearch, m.nome, m.regione ?? m.zona ?? m.region ?? ''))
    }

    // tipo è una stringa ('NM','RM','RC','CM'…) — gruppi come nell'app
    if (maisonTipoFilter === 'grande_maison') {
      data = data.filter(m => ['NM','ND','MA'].includes(m.tipo))
    } else if (maisonTipoFilter === 'vigneron') {
      data = data.filter(m => ['RM','RC','SR'].includes(m.tipo))
    } else if (maisonTipoFilter === 'cooperativa') {
      data = data.filter(m => m.tipo === 'CM')
    }

    if (maisonStatusFilter === 'online')  data = data.filter(m => m.is_published !== false)
    if (maisonStatusFilter === 'offline') data = data.filter(m => m.is_published === false)

    if (maisonLetterFilter) {
      data = data.filter(m => norm(m.nome ?? '').startsWith(maisonLetterFilter))
    }

    const isFiltered = !!(maisonSearch || maisonTipoFilter || maisonStatusFilter || maisonLetterFilter)
    const sub = document.getElementById('maison-subtitle')
    if (sub) sub.textContent = (isFiltered ? `${data.length} / ${all.length}` : data.length) + ' maison nel catalogo'

    if (!data.length) { grid.innerHTML = '<div class="adm-loading-block" style="color:var(--text-3)">Nessuna maison trovata</div>'; return }

    grid.innerHTML = data.map(m => `
      <div class="adm-maison-card" style="cursor:pointer" onclick="editMaison('${m.id}')">
        <div class="adm-maison-header">
          <div class="adm-maison-initial">${esc((m.nome ?? '?')[0].toUpperCase())}</div>
          <div style="flex:1;min-width:0">
            <div class="adm-maison-name">${esc(m.nome ?? '')}</div>
            <div class="adm-maison-region">${esc(m.regione ?? m.zona ?? m.region ?? 'Champagne, France')}</div>
          </div>
          <div class="adm-maison-actions-top">
            <button class="adm-btn adm-btn-edit" onclick="event.stopPropagation();editMaison('${m.id}')">
              <i class="ti ti-pencil"></i>
            </button>
            <button class="adm-btn adm-btn-reject" onclick="event.stopPropagation();deleteMaison('${m.id}','${esc(m.nome ?? '')}')">
              <i class="ti ti-trash"></i>
            </button>
          </div>
        </div>
        <div class="adm-maison-stats">
          <span class="adm-badge ${m.is_published !== false ? 'active' : 'offline'} adm-status-badge"
                onclick="event.stopPropagation();toggleMaisonStatus('${m.id}',${m.is_published !== false})">
            ${m.is_published !== false ? 'ONLINE' : 'OFFLINE'}
          </span>
          ${m.tipo ? `<span style="margin-left:6px;font-family:var(--mono);font-size:10px;color:var(--text-3);letter-spacing:.05em">${esc(m.tipo)} · ${{ NM:'Grande Maison', ND:'Grande Maison', MA:'Grande Maison', RM:'Vigneron', RC:'Vigneron', SR:'Vigneron', CM:'Cooperativa' }[m.tipo] ?? m.tipo}</span>` : ''}
        </div>
      </div>`).join('')
  } catch(e) { grid.innerHTML = `<div class="adm-error-cell">${esc(e.message)}</div>` }
}

function filterMaison(tipo, btn) {
  maisonTipoFilter = (tipo === maisonTipoFilter) ? '' : tipo
  document.querySelectorAll('#view-maison .adm-filter').forEach(b => b.classList.remove('active'))
  if (!maisonTipoFilter) document.querySelector('#view-maison .adm-filter').classList.add('active')
  else btn.classList.add('active')
  loadMaison()
}

function filterMaisonStatus(status, btn) {
  maisonStatusFilter = (status === maisonStatusFilter) ? '' : status
  document.querySelectorAll('#view-maison .adm-filter-status').forEach(b => b.classList.remove('active'))
  if (!maisonStatusFilter) document.querySelector('#view-maison .adm-filter-status').classList.add('active')
  else btn.classList.add('active')
  loadMaison()
}

function filterMaisonSort(sort, btn) {
  maisonSort = sort
  document.querySelectorAll('#view-maison .adm-filter-sort').forEach(b => b.classList.remove('active'))
  btn.classList.add('active')
  loadMaison()
}

function filterMaisonLetter(letter, btn) {
  maisonLetterFilter = (letter !== '' && letter === maisonLetterFilter) ? '' : letter
  document.querySelectorAll('#view-maison .adm-filter-letter').forEach(b => b.classList.remove('active'))
  if (!maisonLetterFilter) {
    document.querySelector('#view-maison .adm-filter-letter.all-btn')?.classList.add('active')
  } else {
    btn.classList.add('active')
  }
  loadMaison()
}

function searchMaison(val) {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => { maisonSearch = val.trim(); loadMaison() }, 400)
}

async function editMaison(id) {
  openModal('Modifica Maison', loadingHTML(), true)
  try {
    const { data: m, error } = await supa.from('maison').select('*').eq('id', id).single()
    if (error) throw error

    const SKIP = ['id', 'created_at', 'updated_at']
    const FULL = ['nome', 'descrizione', 'storia', 'bio', 'note', 'indirizzo', 'sito_web', 'website', 'url']
    const TA   = ['descrizione', 'storia', 'bio', 'note']

    const fieldsHTML = buildAllColsForm(m, { skip: SKIP, fullRow: FULL, textareaCols: TA })

    const html = `
      <div class="adm-edit-form">
        <div class="adm-edit-grid">${fieldsHTML}</div>
        <div class="adm-edit-meta">
          <code class="adm-code" style="font-size:10px">${m.id}</code>
          <span style="color:var(--text-3);font-size:11px">Tutte le colonne della tabella maison</span>
        </div>
        <div class="adm-modal-actions">
          <button class="adm-btn adm-btn-ghost" onclick="closeModal()">Annulla</button>
          <button class="adm-btn adm-btn-primary" onclick="saveMaison('${id}')">
            <i class="ti ti-device-floppy"></i> Salva
          </button>
        </div>
      </div>`
    document.getElementById('modal-body').innerHTML = html
  } catch(e) { document.getElementById('modal-body').innerHTML = errorHTML(e.message) }
}

// Template per "Nuova maison" — stesse chiavi di una riga reale, così il form
// (via buildAllColsForm, identico a editMaison) espone tutti i campi.
const MAISON_TEMPLATE = {
  nome: '', slug: '', tipo: '', zona_id: null, sede_comune: '', sede_regione: '',
  sede_indirizzo: '', telefono: '', sito_web: '', anno_fondazione: null,
  proprieta: '', gruppo: '', direzione: '', chef_de_cave: '',
  ettari_totali: null, ettari_proprieta: null, ettari_gestione: null, comuni_vigneti: null,
  pct_pinot_noir: null, pct_chardonnay: null, pct_meunier: null, pct_grand_cru: null, pct_premier_cru: null,
  tipo_pressa: '', vinificazione: '', malolattica: '', vins_de_reserve: null, liqueur_expedition: null,
  produzione_bottiglie: null, stock_cantina: null, importatore_italia: '',
  visita_possibile: false, degustazione_possibile: false, visita_info: null,
  descrizione: '', filosofia: '', gamma: null, fascia_prezzo: '', nota_editoriale: null,
  foto_url: null, is_published: true, is_free: false, source: 'manual', needs_review: false
}

function openNewMaisonModal() {
  const SKIP = ['id', 'created_at', 'updated_at']
  const FULL = ['nome', 'descrizione', 'storia', 'bio', 'note', 'indirizzo', 'sito_web', 'website', 'url']
  const TA   = ['descrizione', 'storia', 'bio', 'note']

  const fieldsHTML = buildAllColsForm(MAISON_TEMPLATE, { skip: SKIP, fullRow: FULL, textareaCols: TA })

  const html = `
    <div class="adm-edit-form">
      <div class="adm-edit-grid">${fieldsHTML}</div>
      <div class="adm-modal-actions">
        <button class="adm-btn adm-btn-ghost" onclick="closeModal()">Annulla</button>
        <button class="adm-btn adm-btn-primary" onclick="createMaison()">
          <i class="ti ti-plus"></i> Crea maison
        </button>
      </div>
    </div>`
  openModal('Nuova Maison', html)
}

async function createMaison() {
  const updates = collectDataCols()
  if (!updates.nome || !updates.nome.trim()) { showToast('Il nome della maison è obbligatorio', 'error'); return }
  if (!updates.slug || !updates.slug.trim()) updates.slug = slugify(updates.nome)
  try {
    const { data, error } = await supa.from('maison').insert(updates).select('id').single()
    if (error) throw error
    closeModal()
    showToast('Maison creata ✓')
    loadMaison()
  } catch(e) { showToast(e.message, 'error') }
}

async function saveMaison(id) {
  const updates = collectDataCols()
  try {
    const { data, error } = await supa.from('maison').update(updates).eq('id', id).select('id')
    if (error) throw error
    if (!data || !data.length) throw new Error('Nessuna riga aggiornata: verifica i permessi (RLS) sulla tabella maison')
    closeModal()
    showToast('Maison aggiornata ✓')
    loadMaison()
  } catch(e) { showToast(e.message, 'error') }
}

async function deleteMaison(id, nome) {
  if (!confirm(`Eliminare la maison "${nome}"?\nAttenzione: le bottiglie collegate perderanno il riferimento.`)) return
  try {
    const { error } = await supa.from('maison').delete().eq('id', id)
    if (error) throw error
    showToast('Maison eliminata')
    loadMaison()
  } catch(e) { showToast(e.message, 'error') }
}

// ══════════════════════════════════════════════════════
// GLOSSARIO
// ══════════════════════════════════════════════════════
async function loadGlossarioAdmin() {
  const tbody = document.getElementById('glossario-tbody')
  if (!tbody) return
  tbody.innerHTML = loadingRow(5)
  try {
    const { data: all, error } = await supa
      .from('glossario')
      .select('*')
      .order('lettera')
      .order('termine')
    if (error) throw error

    let data = all || []
    if (glossarioSearch) {
      data = data.filter(g => matchesAllTerms(glossarioSearch, g.termine, g.definizione, g.categoria))
    }
    if (glossarioLetterFilter) {
      data = data.filter(g => norm(g.termine ?? '').startsWith(glossarioLetterFilter))
    }

    const isFiltered = !!(glossarioSearch || glossarioLetterFilter)
    const sub = document.getElementById('glossario-subtitle')
    if (sub) sub.textContent = (isFiltered ? `${data.length} / ${(all || []).length}` : (all || []).length) + ' termini nel glossario'

    if (!data.length) {
      tbody.innerHTML = `<tr><td colspan="5"><div style="padding:32px;text-align:center;color:var(--text-3)">Nessun termine trovato</div></td></tr>`
      return
    }

    const livelloClass = { base: 'inactive', avanzato: 'active', premium: 'premium' }

    tbody.innerHTML = data.map(g => `
      <tr class="adm-table-row" style="cursor:pointer" onclick="editGlossario('${g.id}')">
        <td>
          <div class="adm-bottle-name">${esc(g.termine ?? '')}</div>
          <div class="adm-bottle-sub" style="max-width:440px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(g.definizione ?? '')}</div>
        </td>
        <td>${g.categoria ? `<span class="adm-maison-tag">${esc(g.categoria)}</span>` : '-'}</td>
        <td>${g.livello ? `<span class="adm-badge ${livelloClass[g.livello] ?? ''}">${esc(g.livello).toUpperCase()}</span>` : '-'}</td>
        <td>
          <span class="adm-badge ${g.is_published !== false ? 'active' : 'offline'} adm-status-badge"
                onclick="event.stopPropagation();toggleGlossarioStatus('${g.id}',${g.is_published !== false})">
            ${g.is_published !== false ? 'ONLINE' : 'OFFLINE'}
          </span>
        </td>
        <td>
          <div class="adm-row-actions">
            <button class="adm-btn adm-btn-edit" onclick="event.stopPropagation();editGlossario('${g.id}')">
              <i class="ti ti-pencil"></i>
            </button>
            <button class="adm-btn adm-btn-reject" onclick="event.stopPropagation();deleteGlossario('${g.id}','${esc(g.termine ?? '')}')">
              <i class="ti ti-trash"></i>
            </button>
          </div>
        </td>
      </tr>`).join('')
  } catch(e) { tbody.innerHTML = errorRow(5, e.message) }
}

function filterGlossarioLetter(letter, btn) {
  glossarioLetterFilter = (letter !== '' && letter === glossarioLetterFilter) ? '' : letter
  document.querySelectorAll('#view-glossario .adm-filter-letter').forEach(b => b.classList.remove('active'))
  if (!glossarioLetterFilter) {
    document.querySelector('#view-glossario .adm-filter-letter.all-btn')?.classList.add('active')
  } else {
    btn.classList.add('active')
  }
  loadGlossarioAdmin()
}

function searchGlossario(val) {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => { glossarioSearch = val.trim(); loadGlossarioAdmin() }, 400)
}

async function toggleGlossarioStatus(id, currentlyOnline) {
  const newStatus = !currentlyOnline
  try {
    const { data: upd, error } = await supa.from('glossario')
      .update({ is_published: newStatus }).eq('id', id).select('id')
    if (error) throw error
    if (!upd?.length) throw new Error('Aggiornamento bloccato da RLS')
    showToast(newStatus ? 'Termine online ✓' : 'Termine portato offline')
    loadGlossarioAdmin()
  } catch(e) { showToast(e.message, 'error') }
}

async function deleteGlossario(id, termine) {
  if (!confirm(`Eliminare "${termine || 'questo termine'}"?`)) return
  try {
    const { error } = await supa.from('glossario').delete().eq('id', id)
    if (error) throw error
    showToast('Termine eliminato')
    loadGlossarioAdmin()
  } catch(e) { showToast(e.message, 'error') }
}

async function editGlossario(id) {
  openModal('Modifica Termine', loadingHTML(), true)
  try {
    const { data: g, error } = await supa.from('glossario').select('*').eq('id', id).single()
    if (error) throw error

    const SKIP = ['id', 'created_at']
    const FULL = ['termine', 'definizione']
    const TA   = ['definizione']

    const fieldsHTML = buildAllColsForm(g, { skip: SKIP, fullRow: FULL, textareaCols: TA })

    const html = `
      <div class="adm-edit-form">
        <div class="adm-edit-grid">${fieldsHTML}</div>
        <div class="adm-edit-meta">
          <code class="adm-code" style="font-size:10px">${g.id}</code>
          <span style="color:var(--text-3);font-size:11px">Tutte le colonne della tabella glossario</span>
        </div>
        <div class="adm-modal-actions">
          <button class="adm-btn adm-btn-ghost" onclick="closeModal()">Annulla</button>
          <button class="adm-btn adm-btn-primary" onclick="saveGlossario('${id}')">
            <i class="ti ti-device-floppy"></i> Salva
          </button>
        </div>
      </div>`
    document.getElementById('modal-body').innerHTML = html
  } catch(e) { document.getElementById('modal-body').innerHTML = errorHTML(e.message) }
}

async function saveGlossario(id) {
  const updates = collectDataCols()
  try {
    const { data, error } = await supa.from('glossario').update(updates).eq('id', id).select('id')
    if (error) throw error
    if (!data || !data.length) throw new Error('Nessuna riga aggiornata: verifica i permessi (RLS) sulla tabella glossario')
    closeModal()
    showToast('Termine aggiornato ✓')
    loadGlossarioAdmin()
  } catch(e) { showToast(e.message, 'error') }
}

function openNewGlossarioModal() {
  const html = `
    <div class="adm-edit-form">
      <div class="adm-edit-grid">
        <div class="adm-form-field" style="grid-column:1/-1">
          <label class="adm-form-label">Termine</label>
          <input class="adm-form-input" type="text" id="ng-termine" placeholder="es. Dégorgement">
        </div>
        <div class="adm-form-field" style="grid-column:1/-1">
          <label class="adm-form-label">Definizione</label>
          <textarea class="adm-form-input" rows="4" id="ng-definizione" placeholder="Spiegazione del termine..."></textarea>
        </div>
        <div class="adm-form-field">
          <label class="adm-form-label">Categoria</label>
          <input class="adm-form-input" type="text" id="ng-categoria" placeholder="es. Metodo, Vinificazione, Terroir...">
        </div>
        <div class="adm-form-field">
          <label class="adm-form-label">Livello</label>
          <select class="adm-form-input" id="ng-livello">
            <option value="base">Base</option>
            <option value="avanzato">Avanzato</option>
            <option value="premium">Premium</option>
          </select>
        </div>
      </div>
      <div class="adm-modal-actions">
        <button class="adm-btn adm-btn-ghost" onclick="closeModal()">Annulla</button>
        <button class="adm-btn adm-btn-primary" onclick="createGlossario()">
          <i class="ti ti-plus"></i> Aggiungi
        </button>
      </div>
    </div>`
  openModal('Nuovo Termine', html)
}

async function createGlossario() {
  const termine     = document.getElementById('ng-termine')?.value.trim()
  const definizione = document.getElementById('ng-definizione')?.value.trim()
  const categoria   = document.getElementById('ng-categoria')?.value.trim() || null
  const livello     = document.getElementById('ng-livello')?.value || 'base'
  if (!termine)     { showToast('Il termine è obbligatorio', 'error'); return }
  if (!definizione) { showToast('La definizione è obbligatoria', 'error'); return }

  const lettera = norm(termine).charAt(0).toUpperCase() || termine.trim().charAt(0).toUpperCase()
  try {
    const { error } = await supa.from('glossario').insert({
      termine, definizione, categoria, livello, lettera, ordine: 0, is_published: true
    })
    if (error) throw error
    closeModal()
    showToast('Termine aggiunto ✓')
    loadGlossarioAdmin()
  } catch(e) { showToast(e.message, 'error') }
}

// ══════════════════════════════════════════════════════
// NOTIFICHE
// Comunicazioni broadcast: centro notifiche in-app (badge + messaggio) e, a scelta, anche notifica push
// sul telefono tramite la Edge Function send-push (invio diretto ad Apple APNs).
// ══════════════════════════════════════════════════════
async function loadNotifiche() {
  const tbody = document.getElementById('notifiche-tbody')
  if (!tbody) return
  loadAutoRules()
  tbody.innerHTML = loadingRow(5)
  try {
    const { data, error } = await supa
      .from('notifications')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) throw error

    const sub = document.getElementById('notifiche-subtitle')
    if (sub) {
      sub.textContent = (data || []).length + ' notifiche inviate'
      pushDeviceCount().then(n => { if (n !== null) sub.textContent += ` · ${n} dispositivi con push attive` })
    }

    if (!data || !data.length) {
      tbody.innerHTML = `<tr><td colspan="5"><div style="padding:32px;text-align:center;color:var(--text-3)">Nessuna notifica ancora inviata</div></td></tr>`
      return
    }

    tbody.innerHTML = data.map(n => `
      <tr class="adm-table-row" style="cursor:pointer" onclick="editNotifica('${n.id}')">
        <td><div class="adm-bottle-name">${esc(n.title)}</div></td>
        <td><div class="adm-bottle-sub" style="max-width:420px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(n.body)}</div></td>
        <td>${timeAgo(n.created_at)}</td>
        <td>
          <span class="adm-badge ${n.is_active ? 'active' : 'offline'} adm-status-badge"
                onclick="event.stopPropagation();toggleNotificaStatus('${n.id}',${n.is_active})">
            ${n.is_active ? 'ATTIVA' : 'ARCHIVIATA'}
          </span>
        </td>
        <td>
          <div class="adm-row-actions">
            <button class="adm-btn adm-btn-edit" onclick="event.stopPropagation();editNotifica('${n.id}')">
              <i class="ti ti-pencil"></i>
            </button>
            <button class="adm-btn adm-btn-reject" onclick="event.stopPropagation();deleteNotifica('${n.id}','${esc(n.title).replace(/'/g, "\\'")}')">
              <i class="ti ti-trash"></i>
            </button>
          </div>
        </td>
      </tr>`).join('')
  } catch(e) { tbody.innerHTML = errorRow(5, e.message) }
}

// Azioni che un pulsante dentro un messaggio può eseguire (stesso elenco dell'app: l'azione si sceglie da qui,
// non si scrive a mano, così ogni pulsante funziona sempre)
const CTA_ACTIONS = {
  scan: 'Scansiona una bottiglia', new_note: 'Nuova degustazione', carnet: 'Apri il Carnet', premium: 'Scopri Premium',
  catalog: 'Esplora gli Champagne', producers: 'Esplora i Produttori', guide: 'Apri la Guida', glossary: 'Apri il Glossario', home: 'Vai alla Home',
}
const ctaOptions = (selected) => `<option value="">Nessun pulsante</option>` +
  Object.entries(CTA_ACTIONS).map(([k, v]) => `<option value="${k}" ${k === selected ? 'selected' : ''}>${esc(v)}</option>`).join('')

const AUTOMATIONS_URL = 'https://wlfxgbmffvhuqmqjiuqo.supabase.co/functions/v1/run-automations'

async function loadAutoRules() {
  const box = document.getElementById('auto-rules')
  if (!box) return
  try {
    const { data: rules, error } = await supa.from('auto_notifications').select('*').order('sort', { ascending: true })
    if (error) throw error
    if (!rules.length) { box.innerHTML = '<div style="color:var(--text-3);font-size:12px">Nessuna regola trovata.</div>'; return }

    const count = async (table, filter) => {
      let q = supa.from(table).select('*', { count: 'exact', head: true })
      q = filter(q)
      const { count: c } = await q
      return c ?? 0
    }
    const stats = {}
    await Promise.all(rules.map(async r => {
      const [sent, opened, clicked] = await Promise.all([
        count('auto_notification_log', q => q.eq('key', r.key)),
        count('personal_notifications', q => q.eq('auto_key', r.key).eq('is_test', false).not('read_at', 'is', null)),
        count('personal_notifications', q => q.eq('auto_key', r.key).eq('is_test', false).not('clicked_at', 'is', null)),
      ])
      stats[r.key] = { sent, opened, clicked }
    }))
    window.__autoRules = Object.fromEntries(rules.map(r => [r.key, r]))
    const pct = (a, b) => b ? Math.round(a / b * 100) + '%' : '-'

    box.innerHTML = rules.map(r => {
      const st = stats[r.key]
      return `<div class="adm-auto-card ${r.enabled ? 'on' : ''}">
        <div class="adm-auto-top">
          <div>
            <div class="adm-auto-name">${esc(r.name)}</div>
            <div class="adm-auto-desc">${esc(r.description)}</div>
          </div>
          <label class="adm-switch" title="${r.enabled ? 'Attiva' : 'Spenta'}"><input type="checkbox" ${r.enabled ? 'checked' : ''} onchange="toggleAutoRule('${r.key}', this)"><span></span></label>
        </div>
        <div class="adm-auto-msg">
          <div class="adm-auto-msg-t">${esc(r.title)}</div>
          <div class="adm-auto-msg-b">${esc(r.body)}</div>
          <span class="adm-auto-msg-c">${esc(r.cta_label)} → ${esc(CTA_ACTIONS[r.cta_action] || r.cta_action)}</span>
        </div>
        <div class="adm-auto-stats">
          <span>Inviate <b>${st.sent}</b></span>
          <span>Aperte <b>${st.opened}</b> (${pct(st.opened, st.sent)})</span>
          <span>Pulsante <b>${st.clicked}</b> (${pct(st.clicked, st.sent)})</span>
        </div>
        <div class="adm-auto-actions">
          <button class="adm-btn adm-btn-ghost" onclick="editAutoRule('${r.key}')"><i class="ti ti-pencil"></i> Modifica testo</button>
          <button class="adm-btn adm-btn-ghost" onclick="testAutoRule('${r.key}', this)"><i class="ti ti-device-mobile"></i> Prova su di me</button>
        </div>
      </div>`
    }).join('')
  } catch (e) {
    box.innerHTML = /auto_notifications|PGRST205|42P01/.test(e.message || '') || e.code === 'PGRST205'
      ? `<div style="color:var(--text-2);font-size:12.5px;line-height:1.6"><strong style="color:var(--amber)">Notifiche automatiche non ancora attive.</strong> Esegui lo script SQL delle automatiche su Supabase: crea le regole che compaiono qui.</div>`
      : `<div style="color:var(--red);font-size:12px;font-family:var(--mono)">${esc(e.message)}</div>`
  }
}

async function toggleAutoRule(key, el) {
  const enable = el.checked
  if (enable && !confirm('Attivare questa notifica automatica?\n\nDalla prossima ora utile (10:00–20:00) la riceveranno tutti gli utenti che rispettano la regola. Puoi spegnerla quando vuoi.')) { el.checked = false; return }
  el.disabled = true
  try {
    const { error } = await supa.from('auto_notifications').update({ enabled: enable, updated_at: new Date().toISOString() }).eq('key', key)
    if (error) throw error
    showToast(enable ? 'Notifica automatica attivata ✓' : 'Notifica automatica spenta')
  } catch (e) { el.checked = !enable; showToast(e.message, 'error') }
  el.disabled = false
  loadAutoRules()
}

function editAutoRule(key) {
  const r = (window.__autoRules || {})[key]
  if (!r) return
  const html = `
    <div class="adm-edit-form">
      <div class="adm-edit-grid">
        <div class="adm-form-field" style="grid-column:1/-1">
          <label class="adm-form-label">Titolo</label>
          <input class="adm-form-input" type="text" id="ar-title" maxlength="80" value="${esc(r.title)}">
        </div>
        <div class="adm-form-field" style="grid-column:1/-1">
          <label class="adm-form-label">Messaggio</label>
          <textarea class="adm-form-input" rows="4" id="ar-body" maxlength="500">${esc(r.body)}</textarea>
        </div>
        <div class="adm-form-field" style="grid-column:1/-1">
          <label class="adm-form-label">Testo del pulsante</label>
          <input class="adm-form-input" type="text" id="ar-cta" maxlength="30" value="${esc(r.cta_label)}">
          <div style="font-size:11.5px;color:var(--text-3);margin-top:6px">Il pulsante apre sempre: <strong>${esc(CTA_ACTIONS[r.cta_action] || r.cta_action)}</strong>. L'azione è fissa, cambia solo il testo.</div>
        </div>
      </div>
      <div class="adm-modal-actions">
        <button class="adm-btn adm-btn-ghost" onclick="closeModal()">Annulla</button>
        <button class="adm-btn adm-btn-primary" onclick="saveAutoRule('${key}')"><i class="ti ti-device-floppy"></i> Salva</button>
      </div>
    </div>`
  openModal('Modifica: ' + r.name, html)
}

async function saveAutoRule(key) {
  const title = document.getElementById('ar-title')?.value.trim()
  const body = document.getElementById('ar-body')?.value.trim()
  const cta = document.getElementById('ar-cta')?.value.trim()
  if (!title || !body || !cta) { showToast('Titolo, messaggio e testo del pulsante sono obbligatori', 'error'); return }
  try {
    const { error } = await supa.from('auto_notifications').update({ title, body, cta_label: cta, updated_at: new Date().toISOString() }).eq('key', key)
    if (error) throw error
    closeModal(); showToast('Testo aggiornato ✓'); loadAutoRules()
  } catch (e) { showToast(e.message, 'error') }
}

async function testAutoRule(key, btn) {
  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="ti ti-loader-2 spin"></i> Invio...' }
  try {
    const { data: { session } } = await supa.auth.getSession()
    if (!session?.access_token) throw new Error('Sessione admin non valida')
    const resp = await fetch(AUTOMATIONS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + session.access_token },
      body: JSON.stringify({ action: 'test', key }),
    })
    const r = await resp.json().catch(() => ({}))
    if (resp.status === 404 && !r.error) throw new Error('Funzione run-automations non ancora pubblicata su Supabase')
    if (!resp.ok || r.error) throw new Error(r.error || 'Errore durante la prova')
    const sent = r.push?.sent ?? 0
    showToast(sent ? `Prova inviata: guarda il telefono e la campanella nell'app (${sent} ${sent === 1 ? 'dispositivo' : 'dispositivi'})` : 'Messaggio creato nella tua campanella (nessun dispositivo con push attive)')
  } catch (e) { showToast(e.message, 'error') }
  if (btn) { btn.disabled = false; btn.innerHTML = '<i class="ti ti-device-mobile"></i> Prova su di me' }
}

const PUSH_URL = 'https://wlfxgbmffvhuqmqjiuqo.supabase.co/functions/v1/send-push'

async function pushDeviceCount() {
  try {
    const { count, error } = await supa.from('push_tokens').select('*', { count: 'exact', head: true })
    return error ? null : (count ?? 0)
  } catch (e) { return null }
}

async function callSendPush(body) {
  const { data: { session } } = await supa.auth.getSession()
  const token = session?.access_token
  if (!token) throw new Error('Sessione admin non valida')
  const resp = await fetch(PUSH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
    body: JSON.stringify(body),
  })
  const result = await resp.json().catch(() => ({}))
  if (resp.status === 404) throw new Error('Funzione send-push non ancora pubblicata su Supabase')
  if (!resp.ok || result.error) throw new Error(result?.error || 'Errore durante l\'invio della push')
  return result
}

function describePushResult(r) {
  if (!r.total) return r.note || 'Nessun dispositivo registrato per questi destinatari'
  let msg = `Push inviata a ${r.sent} di ${r.total} dispositivi`
  if (r.removed) msg += ` · ${r.removed} non più validi rimossi`
  if (r.failed) msg += ` · ${r.failed} non riusciti`
  return msg
}

async function openNewNotificaModal() {
  const html = `
    <div class="adm-edit-form">
      <div class="adm-edit-grid">
        <div class="adm-form-field" style="grid-column:1/-1">
          <label class="adm-form-label">Titolo</label>
          <input class="adm-form-input" type="text" id="nn-title" maxlength="80" placeholder="es. Nuova funzione disponibile">
        </div>
        <div class="adm-form-field" style="grid-column:1/-1">
          <label class="adm-form-label">Messaggio</label>
          <textarea class="adm-form-input" rows="5" id="nn-body" maxlength="2000" placeholder="Testo del messaggio che vedrà l'utente..."></textarea>
        </div>
        <div class="adm-form-field" style="grid-column:1/-1">
          <label class="adm-form-label">PULSANTE (facoltativo)</label>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
            <select class="adm-form-input" id="nn-cta-action">${ctaOptions('')}</select>
            <input class="adm-form-input" type="text" id="nn-cta-label" maxlength="30" placeholder="Testo del pulsante">
          </div>
          <div style="font-size:11.5px;color:var(--text-3);margin-top:6px">L'azione si sceglie dall'elenco e funziona sempre; il testo del pulsante lo scrivi tu.</div>
        </div>
        <div class="adm-form-field" style="grid-column:1/-1">
          <label style="display:flex;gap:10px;align-items:center;cursor:pointer;font-size:13px;color:var(--text-2)">
            <input type="checkbox" id="nn-push" checked onchange="document.getElementById('nn-push-opts').style.display = this.checked ? 'block' : 'none'" style="width:16px;height:16px;accent-color:var(--gold)">
            Invia anche come notifica push sul telefono
          </label>
        </div>
        <div class="adm-form-field" id="nn-push-opts" style="grid-column:1/-1">
          <label class="adm-form-label">DESTINATARI DELLA PUSH</label>
          <select class="adm-form-input" id="nn-audience">
            <option value="all">Tutti gli utenti</option>
            <option value="premium">Solo Premium</option>
            <option value="free">Solo Free</option>
          </select>
          <div id="nn-push-hint" style="font-size:11.5px;color:var(--text-3);margin-top:6px;line-height:1.5"></div>
        </div>
      </div>
      <div class="adm-modal-actions">
        <button class="adm-btn adm-btn-ghost" onclick="closeModal()">Annulla</button>
        <button class="adm-btn adm-btn-ghost" id="nn-test-btn" onclick="sendTestPush()" title="Invia la sola push ai tuoi dispositivi, senza pubblicare la notifica">
          <i class="ti ti-device-mobile"></i> Prova su di me
        </button>
        <button class="adm-btn adm-btn-primary" id="nn-send-btn" onclick="createNotifica()">
          <i class="ti ti-send"></i> Invia
        </button>
      </div>
    </div>`
  openModal('Nuova notifica', html)
  updatePushCounter()
  pushDeviceCount().then(n => {
    const el = document.getElementById('nn-push-hint')
    if (el && n !== null) el.dataset.devices = n
    updatePushCounter()
  })
}

function updatePushCounter() {
  const el = document.getElementById('nn-push-hint')
  if (!el) return
  const devices = el.dataset.devices
  el.textContent = (devices !== undefined ? `${devices} dispositivi con push attive. ` : '')
    + 'Nella push compare solo l\'inizio del messaggio; il testo completo si legge dentro l\'app.'
}

async function sendTestPush() {
  const title = document.getElementById('nn-title')?.value.trim()
  const body  = document.getElementById('nn-body')?.value.trim()
  if (!title || !body) { showToast('Scrivi titolo e messaggio per la prova', 'error'); return }
  const btn = document.getElementById('nn-test-btn')
  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="ti ti-loader-2 spin"></i> Invio...' }
  try {
    showToast(describePushResult(await callSendPush({ title, body, audience: 'test' })))
  } catch (e) { showToast(e.message, 'error') }
  if (btn) { btn.disabled = false; btn.innerHTML = '<i class="ti ti-device-mobile"></i> Prova su di me' }
}

async function createNotifica() {
  const title = document.getElementById('nn-title')?.value.trim()
  const body  = document.getElementById('nn-body')?.value.trim()
  const wantPush = document.getElementById('nn-push')?.checked
  const audience = document.getElementById('nn-audience')?.value || 'all'
  if (!title) { showToast('Il titolo è obbligatorio', 'error'); return }
  if (!body)  { showToast('Il messaggio è obbligatorio', 'error'); return }
  const btn = document.getElementById('nn-send-btn')
  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="ti ti-loader-2 spin"></i> Invio...' }
  try {
    const ctaAction = document.getElementById('nn-cta-action')?.value || null
    const ctaLabel = (document.getElementById('nn-cta-label')?.value || '').trim() || (ctaAction ? CTA_ACTIONS[ctaAction] : null)
    const row = { title, body, is_active: true }
    if (ctaAction) { row.cta_action = ctaAction; row.cta_label = ctaLabel }   // solo se scelto: senza l'SQL delle automatiche le colonne non esistono ancora
    const { data: created, error } = await supa.from('notifications').insert(row).select('id').single()
    if (error) throw error
    let pushMsg = ''
    if (wantPush) {
      try { pushMsg = ' · ' + describePushResult(await callSendPush({ title, body, audience, notification_id: created?.id })) }
      catch (pe) { closeModal(); showToast('Notifica pubblicata, ma la push non è partita: ' + pe.message, 'error'); loadNotifiche(); return }
    }
    closeModal()
    showToast('Notifica inviata ✓' + pushMsg)
    loadNotifiche()
  } catch(e) {
    showToast(e.message, 'error')
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="ti ti-send"></i> Invia' }
  }
}

async function editNotifica(id) {
  openModal('Modifica notifica', loadingHTML())
  try {
    const { data: n, error } = await supa.from('notifications').select('*').eq('id', id).single()
    if (error) throw error
    window.__notifHasCta = 'cta_action' in n
    const html = `
      <div class="adm-edit-form">
        <div class="adm-edit-grid">
          <div class="adm-form-field" style="grid-column:1/-1">
            <label class="adm-form-label">Titolo</label>
            <input class="adm-form-input" type="text" id="nn-title" value="${esc(n.title)}">
          </div>
          <div class="adm-form-field" style="grid-column:1/-1">
            <label class="adm-form-label">Messaggio</label>
            <textarea class="adm-form-input" rows="5" id="nn-body">${esc(n.body)}</textarea>
          </div>
          <div class="adm-form-field" style="grid-column:1/-1">
            <label class="adm-form-label">PULSANTE (facoltativo)</label>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
              <select class="adm-form-input" id="nn-cta-action">${ctaOptions(n.cta_action || '')}</select>
              <input class="adm-form-input" type="text" id="nn-cta-label" maxlength="30" value="${esc(n.cta_label || '')}" placeholder="Testo del pulsante">
            </div>
          </div>
        </div>
        <div class="adm-modal-actions">
          <button class="adm-btn adm-btn-ghost" onclick="closeModal()">Annulla</button>
          <button class="adm-btn adm-btn-primary" onclick="saveNotifica('${id}')">
            <i class="ti ti-device-floppy"></i> Salva
          </button>
        </div>
      </div>`
    document.getElementById('modal-body').innerHTML = html
  } catch(e) { document.getElementById('modal-body').innerHTML = errorHTML(e.message) }
}

async function saveNotifica(id) {
  const title = document.getElementById('nn-title')?.value.trim()
  const body  = document.getElementById('nn-body')?.value.trim()
  if (!title) { showToast('Il titolo è obbligatorio', 'error'); return }
  if (!body)  { showToast('Il messaggio è obbligatorio', 'error'); return }
  try {
    const ctaAction = document.getElementById('nn-cta-action')?.value || null
    const ctaLabel = (document.getElementById('nn-cta-label')?.value || '').trim() || (ctaAction ? CTA_ACTIONS[ctaAction] : null)
    const upd = { title, body }
    if (ctaAction || window.__notifHasCta) { upd.cta_action = ctaAction; upd.cta_label = ctaAction ? ctaLabel : null }
    const { error } = await supa.from('notifications').update(upd).eq('id', id)
    if (error) throw error
    closeModal()
    showToast('Notifica aggiornata ✓')
    loadNotifiche()
  } catch(e) { showToast(e.message, 'error') }
}

async function toggleNotificaStatus(id, currentlyActive) {
  const newStatus = !currentlyActive
  try {
    const { data: upd, error } = await supa.from('notifications')
      .update({ is_active: newStatus }).eq('id', id).select('id')
    if (error) throw error
    if (!upd?.length) throw new Error('Aggiornamento bloccato da RLS')
    showToast(newStatus ? 'Notifica riattivata ✓' : 'Notifica archiviata')
    loadNotifiche()
  } catch(e) { showToast(e.message, 'error') }
}

async function deleteNotifica(id, title) {
  if (!confirm(`Eliminare la notifica "${title || ''}"?`)) return
  try {
    const { error } = await supa.from('notifications').delete().eq('id', id)
    if (error) throw error
    showToast('Notifica eliminata')
    loadNotifiche()
  } catch(e) { showToast(e.message, 'error') }
}

// ══════════════════════════════════════════════════════
// UTENTI
// ══════════════════════════════════════════════════════
const UTENTI_HEAD = {
  users:   ['UTENTE', 'PIANO', 'PUSH', 'SCAN', 'CARNET', 'REGISTRATO'],
  deleted: ['UTENTE', 'STATO', 'PIANO', 'ATTIVITÀ', 'CANCELLAZIONE', 'REGISTRO'],
}
function setUtentiHead(mode) {
  const tr = document.getElementById('utenti-thead')
  if (tr) tr.innerHTML = UTENTI_HEAD[mode].map(h => `<th>${h}</th>`).join('')
}

// Il campo push_enabled esiste solo dopo lo script SQL: se manca, l'elenco funziona lo stesso (senza colonna e filtri push)
let pushColMissing = false
const pushBadge = (on) => on
  ? '<span class="adm-badge active" title="Ha almeno un telefono con le notifiche push attive"><i class="ti ti-bell-ringing"></i> ATTIVE</span>'
  : '<span class="adm-badge inactive" title="Nessun telefono registrato per le notifiche push">NO</span>'

async function renderUtenti() {
  const tbody = document.getElementById('utenti-tbody')
  if (!tbody) return
  if (utentiFilter === 'deleted') return renderUtentiCancellati()
  setUtentiHead('users')
  refreshDeletedCount()
  const isPushFilter = utentiFilter === 'push_on' || utentiFilter === 'push_off'
  if (isPushFilter && pushColMissing) {
    tbody.innerHTML = `<tr><td colspan="6"><div style="padding:28px 24px;color:var(--text-2);font-size:13px;line-height:1.6"><strong style="color:var(--amber)">Filtro non ancora attivo.</strong> Esegui lo script SQL del campo <code class="adm-code">push_enabled</code> su Supabase per usare i filtri push.</div></td></tr>`
    return
  }
  tbody.innerHTML = loadingRow(6)
  try {
    let query = supa
      .from('users')
      .select('id, email, full_name, is_premium, premium_until, is_admin, created_at, deletion_requested_at' + (pushColMissing ? '' : ', push_enabled'), { count: 'exact' })
      .order('created_at', { ascending: false })
      .range((utentiPage-1)*PER_PAGE, utentiPage*PER_PAGE - 1)

    if (utentiFilter === 'premium') query = activePremium(query)
    if (utentiFilter === 'free')    query = notActivePremium(query)
    if (utentiFilter === 'push_on')  query = query.eq('push_enabled', true)
    if (utentiFilter === 'push_off') query = query.eq('push_enabled', false)
    // Con Apple l'email reale spesso non si vede (relay privato): si cerca anche nel nome utente,
    // l'unica cosa che permette di riconoscere la persona in quel caso.
    if (utentiSearch) query = query.or(orSearch({ email: utentiSearch, full_name: utentiSearch }))

    const { data, count, error } = await query
    if (error) {
      if (!pushColMissing && /push_enabled/.test(error.message || '')) { pushColMissing = true; return renderUtenti() }
      throw error
    }

    const cnt = document.getElementById('utenti-count')
    if (cnt) cnt.textContent = (count ?? 0).toLocaleString('it') + (utentiFilter === 'push_on' ? ' utenti con push attive' : utentiFilter === 'push_off' ? ' utenti senza push' : ' utenti registrati')

    // Conteggi esatti per utente (non righe scaricate: il limite di 1000 righe per richiesta falserebbe i totali)
    const scanCounts = {}, carnetCounts = {}
    await Promise.all(data.map(async u => {
      const [s, c] = await Promise.all([
        supa.from('bottle_scans').select('*', { count: 'exact', head: true }).eq('user_id', u.id),
        supa.from('carnet_notes').select('*', { count: 'exact', head: true }).eq('user_id', u.id),
      ])
      scanCounts[u.id] = s.count ?? 0
      carnetCounts[u.id] = c.count ?? 0
    }))

    tbody.innerHTML = data.map(u => {
      const prem = isPremiumActive(u)
      const uname = u.full_name && u.full_name.trim() ? u.full_name.trim() : null
      return `<tr class="adm-table-row adm-utente-row" onclick="showUserDetail('${u.id}')" style="cursor:pointer">
        <td>
          <div class="adm-user-cell">
            <div class="adm-user-avatar">${((uname || u.email || '?'))[0].toUpperCase()}</div>
            <div>
              <div class="adm-user-name">${esc(uname || u.email || '-')}</div>
              <div class="adm-user-sub">${u.is_admin ? '⚙ Admin · ' : ''}${uname ? esc(u.email ?? '') + ' · ' : ''}registrato ${timeAgo(u.created_at)}</div>
            </div>
          </div>
        </td>
        <td>${prem ? '<span class="adm-badge premium"><i class="ti ti-crown"></i> PREMIUM</span>' : '<span class="adm-badge free">FREE</span>'}${u.deletion_requested_at ? ' <span class="adm-badge pending" title="Ha chiesto di eliminare l\'account: verrà eliminato alla scadenza dell\'abbonamento"><i class="ti ti-clock"></i> CANC. PROGRAMMATA</span>' : ''}</td>
        <td>${pushColMissing ? '<span class="adm-mono" style="color:var(--text-3)">-</span>' : pushBadge(u.push_enabled === true)}</td>
        <td class="adm-mono">${scanCounts[u.id] ?? 0}</td>
        <td class="adm-mono">${carnetCounts[u.id] ?? 0}</td>
        <td class="adm-time-cell">${fmtDate(u.created_at)}</td>
      </tr>`
    }).join('')

    renderPagination('utenti-pagination', utentiPage, Math.ceil((count??0)/PER_PAGE), 'utentiGoToPage')
    const fc = document.getElementById('utenti-footer-count')
    if (fc) fc.textContent = `Mostrando ${Math.min((utentiPage-1)*PER_PAGE+1,count??0)}–${Math.min(utentiPage*PER_PAGE,count??0)} di ${(count??0).toLocaleString('it')}`
  } catch(e) { tbody.innerHTML = errorRow(6, e.message) }
}

function utentiGoToPage(p) { utentiPage = p; renderUtenti() }

function filterUtenti(filter, btn) {
  utentiFilter = filter
  document.querySelectorAll('#view-utenti .adm-filter').forEach(b => b.classList.remove('active'))
  btn.classList.add('active')
  closeUserDetail()
  utentiPage = 1; renderUtenti()
}

function searchUtenti(val) {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => { utentiSearch = val.trim(); utentiPage = 1; renderUtenti() }, 400)
}

// ── CANCELLATI: registro degli account eliminati (30 giorni) ──────────
const DELETE_ACCOUNT_URL = 'https://wlfxgbmffvhuqmqjiuqo.supabase.co/functions/v1/delete-account'
let deletedCache = []
let deleteFlowV2 = false

// La Edge Function aggiornata risponde "ok:v2" a OPTIONS. Le versioni vecchie eliminano a QUALSIASI POST:
// per questo la disponibilità di "programma"/"annulla" si verifica solo con OPTIONS, mai con un POST.
async function deleteFlowSupportsScheduling() {
  if (deleteFlowV2) return true
  try {
    const ctl = new AbortController()
    const to = setTimeout(() => ctl.abort(), 4000)
    const r = await fetch(DELETE_ACCOUNT_URL, { method: 'OPTIONS', signal: ctl.signal })
    clearTimeout(to)
    deleteFlowV2 = r.ok && (await r.text()).trim() === 'ok:v2'
  } catch (e) { deleteFlowV2 = false }
  return deleteFlowV2
}

async function callDeleteAccount(body) {
  const { data: { session } } = await supa.auth.getSession()
  const token = session?.access_token
  if (!token) throw new Error('Sessione admin non valida')
  const resp = await fetch(DELETE_ACCOUNT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
    body: JSON.stringify(body),
  })
  const result = await resp.json().catch(() => ({}))
  if (!resp.ok || result.error) throw new Error(result?.error || 'Errore durante l\'operazione')
  return result
}

function isRegistryMissing(error) {
  return error && (error.code === 'PGRST205' || error.code === '42P01' || /deleted_users/.test(error.message || ''))
}

async function refreshDeletedCount() {
  const el = document.getElementById('utenti-deleted-count')
  if (!el) return
  try {
    const { count, error } = await supa.from('deleted_users').select('*', { count: 'exact', head: true })
      .or(`status.eq.scheduled,purge_at.gt.${new Date().toISOString()}`)
    if (error) throw error
    el.textContent = count ? `(${count})` : ''
  } catch (e) { el.textContent = '' }
}

const DELETED_BY_LABEL = { user: 'dall\'utente', admin: 'da admin', dashboard: 'da Supabase' }
const daysUntil = (iso) => Math.max(0, Math.ceil((new Date(iso) - Date.now()) / 86400000))

function deletedStateBadges(d) {
  const state = d.status === 'scheduled'
    ? '<span class="adm-badge pending"><i class="ti ti-clock"></i> PROGRAMMATA</span>'
    : '<span class="adm-badge inactive">ELIMINATO</span>'
  const back = d.returned_at
    ? ` <span class="adm-badge active" title="Si è registrato di nuovo il ${fmtDate(d.returned_at)}"><i class="ti ti-arrow-back-up"></i> TORNATO</span>`
    : ''
  return state + back
}

async function renderUtentiCancellati() {
  const tbody = document.getElementById('utenti-tbody')
  setUtentiHead('deleted')
  refreshDeletedCount()
  tbody.innerHTML = loadingRow(6)
  try {
    let query = supa
      .from('deleted_users')
      .select('*', { count: 'exact' })
      .or(`status.eq.scheduled,purge_at.gt.${new Date().toISOString()}`)
      .order('deleted_at', { ascending: false, nullsFirst: true })
      .order('created_at', { ascending: false })
      .range((utentiPage-1)*PER_PAGE, utentiPage*PER_PAGE - 1)
    if (utentiSearch) query = query.ilike('email', `%${utentiSearch}%`)

    const { data, count, error } = await query
    if (error) throw error
    deletedCache = data

    const cnt = document.getElementById('utenti-count')
    if (cnt) cnt.textContent = (count ?? 0).toLocaleString('it') + ' account cancellati · il riepilogo resta 30 giorni'

    tbody.innerHTML = !data.length
      ? `<tr><td colspan="6"><div style="padding:32px;text-align:center;color:var(--text-3)">Nessun account cancellato negli ultimi 30 giorni</div></td></tr>`
      : data.map(d => {
          const scheduled = d.status === 'scheduled'
          const when = scheduled
            ? `prevista ${d.scheduled_for ? fmtDate(d.scheduled_for) : 'a breve'}`
            : `${fmtDate(d.deleted_at)} · ${DELETED_BY_LABEL[d.deleted_by] || '-'}`
          return `<tr class="adm-table-row adm-utente-row" onclick="showDeletedDetail('${d.id}')" style="cursor:pointer">
            <td>
              <div class="adm-user-cell">
                <div class="adm-user-avatar">${(d.email ?? '?')[0].toUpperCase()}</div>
                <div>
                  <div class="adm-user-name">${esc(d.email ?? '-')}</div>
                  <div class="adm-user-sub">${d.full_name ? esc(d.full_name) + ' · ' : ''}iscritto ${fmtDate(d.registered_at)}</div>
                </div>
              </div>
            </td>
            <td>${deletedStateBadges(d)}</td>
            <td>${d.was_premium ? '<span class="adm-badge premium"><i class="ti ti-crown"></i> PREMIUM</span>' : '<span class="adm-badge free">FREE</span>'}</td>
            <td class="adm-time-cell">${d.scan_count ?? 0} scan · ${d.carnet_count ?? 0} carnet</td>
            <td class="adm-time-cell">${when}</td>
            <td class="adm-time-cell">${scheduled ? '-' : 'tra ' + daysUntil(d.purge_at) + ' gg'}</td>
          </tr>`
        }).join('')

    renderPagination('utenti-pagination', utentiPage, Math.ceil((count??0)/PER_PAGE), 'utentiGoToPage')
    const fc = document.getElementById('utenti-footer-count')
    if (fc) fc.textContent = count ? `Mostrando ${Math.min((utentiPage-1)*PER_PAGE+1,count)}–${Math.min(utentiPage*PER_PAGE,count)} di ${count.toLocaleString('it')}` : ''
  } catch(e) {
    tbody.innerHTML = isRegistryMissing(e)
      ? `<tr><td colspan="6"><div style="padding:28px 24px;color:var(--text-2);font-size:13px;line-height:1.6"><strong style="color:var(--amber)">Registro non ancora attivo.</strong> Esegui lo script SQL della migrazione su Supabase (crea la tabella <code class="adm-code">deleted_users</code>): finché non c'è, gli account eliminati non vengono elencati qui.</div></td></tr>`
      : errorRow(6, e.message)
  }
}

function showDeletedDetail(id) {
  const d = deletedCache.find(x => x.id === id)
  if (!d) return
  document.querySelectorAll('.adm-utente-row').forEach(r => r.classList.remove('selected'))
  const row = document.querySelector(`.adm-utente-row[onclick*="${id}"]`)
  if (row) row.classList.add('selected')

  const panel = document.getElementById('user-detail-panel')
  if (!panel) return
  panel.classList.add('visible')

  const scheduled = d.status === 'scheduled'
  const endRef = d.deleted_at || d.requested_at || new Date().toISOString()
  const activeDays = d.registered_at ? Math.max(0, Math.round((new Date(endRef) - new Date(d.registered_at)) / 86400000)) : null
  const row2 = (label, val) => `<div class="adm-ud-row"><span class="adm-ud-label">${label}</span><span class="adm-ud-val">${val}</span></div>`

  panel.innerHTML = `
    <div class="adm-ud-inner">
      <div class="adm-ud-topbar"><button class="adm-ud-close" onclick="closeUserDetail()"><i class="ti ti-x"></i></button></div>

      <div class="adm-ud-header">
        <div class="adm-ud-avatar">${(d.email ?? '?')[0].toUpperCase()}</div>
        ${d.full_name ? `<div style="font-size:13px;color:var(--text);margin-bottom:4px;font-weight:500">${esc(d.full_name)}</div>` : ''}
        <div class="adm-ud-email">${esc(d.email ?? '-')}</div>
        <div class="adm-ud-badges">
          ${deletedStateBadges(d)}
          ${d.was_premium ? '<span class="adm-badge premium" style="margin-left:4px"><i class="ti ti-crown"></i> PREMIUM</span>' : ''}
        </div>
      </div>

      <div class="adm-ud-stats">
        <div class="adm-ud-stat"><div class="adm-ud-stat-val">${d.scan_count ?? 0}</div><div class="adm-ud-stat-label">Scansioni</div></div>
        <div class="adm-ud-stat"><div class="adm-ud-stat-val">${d.carnet_count ?? 0}</div><div class="adm-ud-stat-label">Carnet</div></div>
        <div class="adm-ud-stat"><div class="adm-ud-stat-val">${d.favorites_count ?? 0}</div><div class="adm-ud-stat-label">Preferiti</div></div>
      </div>

      <div class="adm-ud-section">
        <div class="adm-ud-section-title">CANCELLAZIONE</div>
        ${row2('Richiesta il', fmtDate(d.requested_at))}
        ${scheduled
          ? row2('Eliminazione', `<span style="color:var(--amber)">alla scadenza · ${d.scheduled_for ? fmtDate(d.scheduled_for) : 'a breve'}</span>`)
          : row2('Eliminato il', fmtDate(d.deleted_at))}
        ${row2('Richiesta da', ({ user: 'utente', admin: 'admin', dashboard: 'Supabase (manuale)' })[d.deleted_by] || '-')}
        ${scheduled
          ? row2('Registro', '30 gg dopo l\'eliminazione')
          : row2('Scheda rimossa tra', `${daysUntil(d.purge_at)} gg (${fmtDate(d.purge_at)})`)}
      </div>

      <div class="adm-ud-section">
        <div class="adm-ud-section-title">PROFILO</div>
        ${row2('Iscritto il', fmtDate(d.registered_at))}
        ${activeDays !== null ? row2('Rimasto iscritto', `${activeDays} giorni`) : ''}
        ${row2('Ultima attività', d.last_activity_at ? fmtDate(d.last_activity_at) : 'nessuna')}
        ${d.was_premium ? row2('Piano', esc(d.subscription_plan || '-') + (d.premium_source ? ` · ${esc(d.premium_source)}` : '')) : ''}
        ${d.was_premium && d.premium_from ? row2('Premium dal', fmtDate(d.premium_from)) : ''}
        ${d.was_premium && d.premium_until ? row2('Premium fino al', fmtDate(d.premium_until)) : ''}
      </div>

      ${d.returned_at ? `
      <div class="adm-ud-section">
        <div class="adm-ud-section-title">SI È REGISTRATO DI NUOVO</div>
        ${row2('Il', fmtDate(d.returned_at))}
        <button class="adm-btn adm-btn-ghost" style="width:100%;justify-content:center;margin-top:6px" onclick="showUserDetail('${d.returned_user_id}')">
          <i class="ti ti-user-search"></i> Apri il nuovo account
        </button>
      </div>` : ''}

      <div class="adm-ud-actions">
        ${scheduled ? `
          <button class="adm-btn adm-btn-ghost" style="width:100%;justify-content:center" onclick="cancelScheduledDeletion('${d.user_id}')">
            <i class="ti ti-arrow-back-up"></i> Annulla eliminazione
          </button>
          <button class="adm-btn adm-btn-reject" style="width:100%;justify-content:center;margin-top:6px" onclick="deleteUserAccountModal('${d.user_id}','${esc(d.email ?? '').replace(/'/g, "\\'")}', false, '', true)">
            <i class="ti ti-trash"></i> Elimina ora
          </button>` : `
          <button class="adm-btn adm-btn-reject" style="width:100%;justify-content:center" onclick="removeDeletedCard('${d.id}')">
            <i class="ti ti-eraser"></i> Rimuovi dal registro adesso
          </button>`}
      </div>
    </div>`
}

async function removeDeletedCard(id) {
  if (!confirm('Rimuovere adesso questa scheda dal registro? Non è recuperabile.')) return
  try {
    const { error } = await supa.from('deleted_users').delete().eq('id', id)
    if (error) throw error
    showToast('Scheda rimossa dal registro')
    closeUserDetail()
    renderUtenti()
  } catch(e) { showToast(e.message, 'error') }
}

async function cancelScheduledDeletion(userId) {
  if (!confirm('Annullare l\'eliminazione programmata? L\'account resterà attivo.')) return
  try {
    if (!(await deleteFlowSupportsScheduling())) throw new Error('Aggiorna prima la Edge Function "delete-account" su Supabase')
    await callDeleteAccount({ action: 'cancel', target_user_id: userId })
    showToast('Eliminazione annullata ✓')
    closeUserDetail()
    renderUtenti()
  } catch(e) { showToast(e.message, 'error') }
}

// Sezioni costi del dettaglio utente: mese corrente per tipo, budget usato, totale da sempre, ultime scansioni con il costo di ognuna
function buildUserCostHTML(monthlyList, allScans, totalScanCount) {
  const aggM = aggScansByKind(monthlyList), aggA = aggScansByKind(allScans)
  const priced = a => a.total.n - a.altro.n
  const budgetUsd = BUDGET_UTENTE_EUR / USD_TO_EUR
  const pct = aggM.total.cost / budgetUsd * 100
  const barCol = pct >= 100 ? 'var(--red)' : pct >= 60 ? 'var(--amber)' : 'var(--green)'
  const kindRow = (a, k) => `<div class="adm-ud-kind"><span class="adm-ud-kind-l"><i style="background:${SCAN_KINDS[k].color}"></i>${esc(SCAN_KINDS[k].label)}</span>
      <span class="adm-ud-kind-r">${a[k].n} × ${a[k].n ? fmtUsdCost(a[k].cost / a[k].n) : '—'}<small>= ${fmtUsdCost(a[k].cost)}</small></span></div>`
  const monthKinds = SCAN_KIND_ORDER.filter(k => aggM[k].n > 0 || k === 'catalogo' || k === 'web').map(k => kindRow(aggM, k)).join('')
  const fullM = aggM.web.n + aggM.web1.n + aggM.sonnet.n
  const fullCost = aggM.web.cost + aggM.web1.cost + aggM.sonnet.cost
  const fmtWhen = iso => new Date(iso).toLocaleString('it-IT', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
  const last = allScans.slice(0, 10).map(x => {
    const k = scanKind(x)
    const name = k === 'non_vino' ? 'Foto non vino' : (x.detected_maison ? `${x.detected_maison}${x.detected_cuvee ? ' — ' + x.detected_cuvee : ''}` : 'Non riconosciuta')
    return `<div class="adm-ud-scanrow"><div class="adm-ud-scanrow-t"><div class="adm-ud-scanrow-n">${esc(name)}</div>
      <div class="adm-ud-scanrow-s"><i style="display:inline-block;width:7px;height:7px;border-radius:50%;background:${SCAN_KINDS[k].color};margin-right:5px"></i>${esc(SCAN_KINDS[k].label)} · ${fmtWhen(x.created_at)}</div></div>
      <div class="adm-ud-scanrow-c">${k === 'altro' ? '—' : fmtUsdCost(x.cost_usd)}</div></div>`
  }).join('')
  return `
        <div class="adm-ud-section">
          <div class="adm-ud-section-title">COSTI SCANSIONI — QUESTO MESE</div>
          <div class="adm-ud-row" style="align-items:baseline">
            <span class="adm-ud-label">Costo del mese</span>
            <span class="adm-ud-val" style="font-size:14px;font-weight:600">${fmtUsdCost(aggM.total.cost)} <span style="color:var(--text-3);font-weight:400;font-size:11px">${fmtEurEst(aggM.total.cost)}</span></span>
          </div>
          <div class="adm-ud-budget"><span style="width:${Math.min(100, pct).toFixed(1)}%;background:${barCol}"></span></div>
          <div style="font-size:11px;color:var(--text-3);margin-bottom:8px">${pct < 10 ? pct.toFixed(1) : Math.round(pct)}% del budget mensile (${BUDGET_UTENTE_EUR.toString().replace('.', ',')} € ≈ ${fmtUsdCost(budgetUsd)})</div>
          ${monthKinds}
          <div class="adm-ud-row" style="margin-top:6px">
            <span class="adm-ud-label">Costo medio scansione</span>
            <span class="adm-ud-val">${priced(aggM) ? fmtUsdCost(aggM.total.cost / priced(aggM)) : '—'}</span>
          </div>
          <div class="adm-ud-row">
            <span class="adm-ud-label">Costo medio analisi completa</span>
            <span class="adm-ud-val">${fullM ? fmtUsdCost(fullCost / fullM) : '—'}</span>
          </div>
        </div>

        <div class="adm-ud-section">
          <div class="adm-ud-section-title">COSTI DA SEMPRE</div>
          <div class="adm-ud-row"><span class="adm-ud-label">Scansioni</span><span class="adm-ud-val">${totalScanCount}</span></div>
          <div class="adm-ud-row"><span class="adm-ud-label">Costo totale</span><span class="adm-ud-val">${fmtUsdCost(aggA.total.cost)} <span style="color:var(--text-3);font-size:11px">${fmtEurEst(aggA.total.cost)}</span></span></div>
          <div class="adm-ud-row"><span class="adm-ud-label">Analisi complete</span><span class="adm-ud-val">${aggA.web.n + aggA.web1.n + aggA.sonnet.n} · ${fmtUsdCost(aggA.web.cost + aggA.web1.cost + aggA.sonnet.cost)}</span></div>
          <div class="adm-ud-row"><span class="adm-ud-label">Da catalogo</span><span class="adm-ud-val">${aggA.catalogo.n} · ${fmtUsdCost(aggA.catalogo.cost)}</span></div>
          ${allScans.length >= 1000 ? '<div style="font-size:10.5px;color:var(--text-3);margin-top:4px">Calcolato sulle ultime 1000 scansioni.</div>' : ''}
        </div>

        <div class="adm-ud-section">
          <div class="adm-ud-section-title">ULTIME SCANSIONI</div>
          ${last || '<div style="font-size:12px;color:var(--text-3)">Nessuna scansione</div>'}
        </div>`
}

// ── USER DETAIL PANEL ─────────────────────────────────
async function showUserDetail(userId) {
  document.querySelectorAll('.adm-utente-row').forEach(r => r.classList.remove('selected'))
  const row = document.querySelector(`.adm-utente-row[onclick*="${userId}"]`)
  if (row) row.classList.add('selected')

  const panel = document.getElementById('user-detail-panel')
  if (!panel) return
  panel.classList.add('visible')
  panel.innerHTML = `<div class="adm-ud-loading">${loadingHTML()}</div>`

  try {
    const monthStart = new Date()
    monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0)

    const [{ data: u, error }, { count: scanCount }, { data: userScans }, { count: carnetCount }] = await Promise.all([
      supa.from('users').select('*').eq('id', userId).single(),
      supa.from('bottle_scans')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId),
      supa.from('bottle_scans')
        .select('id,created_at,scan_type,cost_usd,ricerche:result_json->>ricerche_web,haiku_input_tokens,haiku_output_tokens,sonnet_input_tokens,sonnet_output_tokens,detected_maison,detected_cuvee,detected_annata')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1000),
      supa.from('carnet_notes')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
    ])
    if (error) throw error

    const prem = isPremiumActive(u)
    const initial = (u.email ?? '?')[0].toUpperCase()
    const displayName = u.display_name ?? u.full_name ?? u.nome ?? null
    const pendingDeletion = !!u.deletion_requested_at
    const paying = u.is_premium === true && u.premium_source === 'revenuecat' && !!u.premium_until && new Date(u.premium_until) > new Date()

    // Scansioni mensili: usa l'override manuale se impostato, altrimenti il conteggio reale
    const scanLimit    = prem ? 50 : 3
    const allScans      = userScans ?? []
    const monthlyList   = allScans.filter(x => new Date(x.created_at) >= monthStart)
    const monthlyScanCount = monthlyList.length
    const scansReal     = monthlyScanCount
    const scanOverride  = u.scan_override ?? null
    const scansUsed     = scanOverride ?? scansReal

    // Costi reali delle scansioni: del mese e da sempre, per tipo (vedi buildUserCostHTML)
    const costHTML = buildUserCostHTML(monthlyList, allScans, scanCount ?? allScans.length)

    panel.innerHTML = `
      <div class="adm-ud-inner">

        <div class="adm-ud-topbar">
          <button class="adm-ud-close" onclick="closeUserDetail()"><i class="ti ti-x"></i></button>
        </div>

        <div class="adm-ud-header">
          <div class="adm-ud-avatar">${initial}</div>
          ${displayName ? `<div style="font-size:13px;color:var(--text);margin-bottom:4px;font-weight:500">${esc(displayName)}</div>` : ''}
          <div class="adm-ud-email">${esc(u.email ?? '-')}</div>
          <div class="adm-ud-badges">
            ${prem ? '<span class="adm-badge premium"><i class="ti ti-crown"></i> PREMIUM</span>' : '<span class="adm-badge free">FREE</span>'}
            ${u.is_admin ? '<span class="adm-badge active" style="margin-left:4px">ADMIN</span>' : ''}
          </div>
        </div>

        <div class="adm-ud-stats">
          <div class="adm-ud-stat">
            <div class="adm-ud-stat-val">${scanCount ?? 0}</div>
            <div class="adm-ud-stat-label">Scansioni totali</div>
          </div>
          <div class="adm-ud-stat">
            <div class="adm-ud-stat-val">${carnetCount ?? 0}</div>
            <div class="adm-ud-stat-label">Carnet</div>
          </div>
          <div class="adm-ud-stat">
            <div class="adm-ud-stat-val" style="color:${prem ? 'var(--gold)' : 'var(--text-3)'}">
              ${prem ? '✓' : '✗'}
            </div>
            <div class="adm-ud-stat-label">Premium</div>
          </div>
        </div>

        <div class="adm-ud-section">
          <div class="adm-ud-section-title">SCANSIONI QUESTO MESE</div>
          <div class="adm-ud-row" style="align-items:center;margin-bottom:8px">
            <span class="adm-ud-label">Usate</span>
            <span class="adm-ud-val" style="font-size:14px;font-weight:600;color:${scansUsed >= scanLimit ? 'var(--red)' : 'var(--text)'}">
              ${scansUsed} <span style="color:var(--text-3);font-weight:400">/ ${scanLimit}</span>
              ${scanOverride != null ? ' <span style="color:var(--gold);font-size:10px;font-weight:500">MANUALE</span>' : ''}
            </span>
          </div>
          ${scanOverride != null ? `
          <div class="adm-ud-row">
            <span class="adm-ud-label">Reali</span>
            <span class="adm-ud-val" style="color:var(--text-3)">${scansReal} (calcolate da bottle_scans)</span>
          </div>` : ''}
          <button class="adm-btn adm-btn-ghost" style="width:100%;justify-content:center;margin-top:6px" onclick="openScanOverrideModal('${u.id}', ${scansReal}, ${scanOverride ?? 'null'}, ${scanLimit})">
            <i class="ti ti-edit"></i> Modifica scansioni usate
          </button>
        </div>

        ${costHTML}

        <div class="adm-ud-section">
          <div class="adm-ud-section-title">PROFILO</div>
          <div class="adm-ud-row">
            <span class="adm-ud-label">ID</span>
            <code class="adm-code" style="font-size:9px">${u.id.slice(0,8)}…${u.id.slice(-4)}</code>
          </div>
          <div class="adm-ud-row">
            <span class="adm-ud-label">Email</span>
            <span class="adm-ud-val">${esc(u.email ?? '-')}</span>
          </div>
          <div class="adm-ud-row">
            <span class="adm-ud-label">Registrato</span>
            <span class="adm-ud-val">${fmtDate(u.created_at)}</span>
          </div>
          ${'push_enabled' in u ? `<div class="adm-ud-row">
            <span class="adm-ud-label">Notifiche push</span>
            <span class="adm-ud-val" style="color:${u.push_enabled ? 'var(--green, #3ecf8e)' : 'var(--text-3)'}">${u.push_enabled ? 'Attive' : 'Non attive'}</span>
          </div>` : ''}
          ${u.is_premium ? `
          <div class="adm-ud-row">
            <span class="adm-ud-label">Premium dal</span>
            <span class="adm-ud-val">${fmtDate(u.premium_from)}</span>
          </div>
          <div class="adm-ud-row">
            <span class="adm-ud-label">Scade il</span>
            <span class="adm-ud-val" style="color:${prem ? 'var(--gold)' : 'var(--red)'}">
              ${u.premium_until ? fmtDate(u.premium_until) : 'Illimitato'}
              ${!prem && u.premium_until ? ' ⚠ scaduto' : ''}
            </span>
          </div>` : ''}
          ${u.premium_notes ? `
          <div class="adm-ud-row">
            <span class="adm-ud-label">Note</span>
            <span class="adm-ud-val">${esc(u.premium_notes)}</span>
          </div>` : ''}
        </div>

        ${pendingDeletion ? `
        <div class="adm-ud-section">
          <div class="adm-ud-section-title">ELIMINAZIONE PROGRAMMATA</div>
          <div class="adm-ud-row"><span class="adm-ud-label">Richiesta il</span><span class="adm-ud-val">${fmtDate(u.deletion_requested_at)}</span></div>
          <div class="adm-ud-row"><span class="adm-ud-label">Eliminazione</span><span class="adm-ud-val" style="color:var(--amber)">${prem && u.premium_until ? 'alla scadenza · ' + fmtDate(u.premium_until) : 'a breve'}</span></div>
          <button class="adm-btn adm-btn-ghost" style="width:100%;justify-content:center;margin-top:6px" onclick="cancelScheduledDeletion('${u.id}')">
            <i class="ti ti-arrow-back-up"></i> Annulla eliminazione
          </button>
        </div>` : ''}

        <div class="adm-ud-actions">
          <button class="adm-btn adm-btn-ghost" style="width:100%;justify-content:center" onclick="editUserModal('${u.id}')">
            <i class="ti ti-edit"></i> Modifica profilo
          </button>
          <button class="adm-btn adm-btn-ghost" style="width:100%;justify-content:center" onclick="resetUserPassword('${esc(u.email ?? '')}')">
            <i class="ti ti-key"></i> Invia reset password
          </button>
          ${prem
            ? `<button class="adm-btn adm-btn-reject" style="width:100%;justify-content:center" onclick="revokeUserPremium('${u.id}')">
                <i class="ti ti-crown-off"></i> Rimuovi premium
              </button>`
            : `<button class="adm-btn adm-btn-approve" style="width:100%;justify-content:center" onclick="openPremiumModal('${u.id}','${esc(u.email ?? '')}')">
                <i class="ti ti-crown"></i> Attiva premium
              </button>`
          }
          <button class="adm-btn adm-btn-reject" style="width:100%;justify-content:center;margin-top:6px" onclick="deleteUserAccountModal('${u.id}','${esc(u.email ?? '').replace(/'/g, "\\'")}', ${paying}, '${paying ? u.premium_until : ''}', ${pendingDeletion})">
            <i class="ti ti-trash"></i> Elimina account
          </button>
        </div>

      </div>`

  } catch(e) {
    panel.innerHTML = `<div class="adm-ud-loading"><div style="color:var(--red);font-size:12px;font-family:var(--mono);padding:24px">${esc(e.message)}</div></div>`
  }
}

function closeUserDetail() {
  const panel = document.getElementById('user-detail-panel')
  if (panel) panel.classList.remove('visible')
  document.querySelectorAll('.adm-utente-row').forEach(r => r.classList.remove('selected'))
}

async function resetUserPassword(email) {
  if (!email) return
  if (!confirm(`Inviare email di reset password a:\n${email}\n\nL'utente riceverà un link per impostare una nuova password.`)) return
  try {
    const { error } = await supa.auth.resetPasswordForEmail(email, {
      redirectTo: 'https://coralweb-app.github.io/cuvee-app'
    })
    if (error) throw error
    showToast(`Email di reset inviata a ${email} ✓`)
  } catch(e) { showToast(e.message, 'error') }
}

async function revokeUserPremium(userId) {
  if (!confirm('Rimuovere il premium da questo utente?')) return
  try {
    const { error } = await supa.from('users').update({ is_premium: false, premium_until: null, premium_from: null }).eq('id', userId)
    if (error) throw error
    showToast('Premium rimosso')
    showUserDetail(userId)
    renderUtenti()
  } catch(e) { showToast(e.message, 'error') }
}

// ── ELIMINAZIONE ACCOUNT (stessa Edge Function usata dall'app: passiamo target_user_id e la function
// verifica lato server che il chiamante sia admin). Premium a pagamento: di default la cancellazione
// viene PROGRAMMATA alla scadenza dell'abbonamento; l'admin può forzare l'eliminazione immediata. ──
async function deleteUserAccountModal(userId, email, paying = false, until = '', pending = false) {
  const scheduling = await deleteFlowSupportsScheduling()
  const who = `<strong>${esc(email || '')}</strong>`
  const summaryNote = 'Resta per 30 giorni un riepilogo minimo (email, iscrizione, numero di scansioni) nella tab Cancellati, poi sparisce.'
  let intro, choice = ''

  if (pending) {
    intro = `L'eliminazione di ${who} è già programmata. Se continui, l'account viene eliminato <strong>adesso</strong>, senza attendere la scadenza dell'abbonamento: profilo, storico scansioni, Carnet de dégustation e tutte le foto. ${summaryNote}`
  } else if (paying && scheduling) {
    intro = `${who} ha un <strong>abbonamento a pagamento</strong> attivo fino al <strong>${fmtDate(until)}</strong>. Scegli come procedere. ${summaryNote}`
    choice = `
      <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:16px">
        <label style="display:flex;gap:10px;align-items:flex-start;padding:10px 12px;border:1px solid var(--border-2);border-radius:8px;cursor:pointer">
          <input type="radio" name="del-user-mode" value="auto" checked style="margin-top:2px;accent-color:var(--gold)">
          <span style="font-size:12.5px;color:var(--text-2);line-height:1.5"><strong style="color:var(--text)">Programma alla scadenza (consigliato)</strong><br>L'utente usa l'app fino al ${fmtDate(until)}, poi l'account viene eliminato con tutti i dati.</span>
        </label>
        <label style="display:flex;gap:10px;align-items:flex-start;padding:10px 12px;border:1px solid var(--border-2);border-radius:8px;cursor:pointer">
          <input type="radio" name="del-user-mode" value="now" style="margin-top:2px;accent-color:var(--red)">
          <span style="font-size:12.5px;color:var(--text-2);line-height:1.5"><strong style="color:var(--text)">Elimina subito</strong><br>Perde subito l'accesso e il periodo già pagato. L'abbonamento Apple resta attivo finché l'utente non lo annulla.</span>
        </label>
      </div>`
  } else if (paying) {
    intro = `${who} ha un <strong>abbonamento a pagamento</strong> attivo fino al <strong>${fmtDate(until)}</strong>, ma la Edge Function <code class="adm-code">delete-account</code> non è ancora aggiornata: l'eliminazione sarebbe <strong>immediata</strong> e perderebbe il periodo pagato. Aggiorna prima la funzione per abilitare la cancellazione programmata.`
  } else {
    intro = `Elimina definitivamente l'account ${who}: profilo, storico scansioni, Carnet de dégustation e tutte le foto caricate (avatar, scansioni, carnet). L'utente perde l'accesso subito. ${scheduling ? summaryNote : ''}`
  }

  const html = `
    <div class="adm-edit-form">
      <div style="background:rgba(226,75,74,.08);border:1px solid rgba(226,75,74,.3);border-radius:8px;padding:14px 16px;margin-bottom:16px;">
        <div style="color:var(--red);font-size:13px;font-weight:600;margin-bottom:6px;display:flex;align-items:center;gap:6px;"><i class="ti ti-alert-triangle"></i> ${pending || !paying || !scheduling ? 'Operazione irreversibile' : 'Account con abbonamento attivo'}</div>
        <div style="font-size:12.5px;color:var(--text-2);line-height:1.6;">${intro}</div>
      </div>
      ${choice}
      <label style="display:flex;align-items:flex-start;gap:10px;margin-bottom:18px;cursor:pointer;">
        <input type="checkbox" id="del-user-ack" onchange="const b=document.getElementById('del-user-confirm-btn');b.disabled=!this.checked;b.style.opacity=this.checked?'1':'.5';" style="width:17px;height:17px;margin-top:1px;flex-shrink:0;accent-color:var(--red);">
        <span style="font-size:12.5px;color:var(--text-2);line-height:1.5;">Ho capito che i contenuti eliminati non sono recuperabili.</span>
      </label>
      <div class="adm-modal-actions">
        <button class="adm-btn adm-btn-ghost" onclick="closeModal()">Annulla</button>
        <button class="adm-btn adm-btn-reject" id="del-user-confirm-btn" disabled style="opacity:.5" onclick="confirmDeleteUserAccount('${userId}', ${pending})">
          <i class="ti ti-trash"></i> Conferma
        </button>
      </div>
    </div>`
  openModal('Elimina account', html)
}

async function confirmDeleteUserAccount(userId, pending = false) {
  const btn = document.getElementById('del-user-confirm-btn')
  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="ti ti-loader-2 spin"></i> In corso...' }
  try {
    const picked = document.querySelector('input[name="del-user-mode"]:checked')?.value
    const mode = pending ? 'now' : (picked || 'auto')
    const result = await callDeleteAccount({ target_user_id: userId, action: 'delete', mode })
    closeModal()
    closeUserDetail()
    showToast(result.scheduled
      ? `Eliminazione programmata per il ${fmtDate(result.scheduled_for)} ✓`
      : 'Account eliminato definitivamente')
    renderUtenti()
  } catch(e) {
    showToast(e.message, 'error')
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="ti ti-trash"></i> Conferma' }
  }
}

// ── SCANSIONI MENSILI (override manuale) ──────────────
function openScanOverrideModal(userId, realCount, currentOverride, limit) {
  const val = currentOverride != null ? currentOverride : realCount
  const html = `
    <div class="adm-edit-form">
      <div style="margin-bottom:14px;color:var(--text-2);font-family:var(--mono);font-size:12px">
        Conteggio reale calcolato dalle scansioni di questo mese: <strong style="color:var(--text)">${realCount}</strong> / ${limit}
      </div>
      <div class="adm-form-field">
        <label class="adm-form-label">SCANSIONI USATE (manuale)</label>
        <input id="so-val" class="adm-form-input" type="number" min="0" step="1" value="${val}">
      </div>
      <div style="margin-top:10px;font-family:var(--mono);font-size:11px;color:var(--text-3)">Svuota il campo per tornare al conteggio reale automatico.</div>
      <div class="adm-modal-actions">
        <button class="adm-btn adm-btn-ghost" onclick="closeModal()">Annulla</button>
        <button class="adm-btn adm-btn-primary" onclick="saveScanOverride('${userId}')">Salva</button>
      </div>
    </div>`
  openModal('Modifica scansioni mensili', html)
}

async function saveScanOverride(userId) {
  const raw = document.getElementById('so-val')?.value
  const val = (raw === '' || raw === null || raw === undefined) ? null : parseInt(raw, 10)
  if (val !== null && (isNaN(val) || val < 0)) { showToast('Valore non valido', 'error'); return }
  try {
    const { error } = await supa.from('users').update({ scan_override: val }).eq('id', userId)
    if (error) throw error
    closeModal()
    showToast('Scansioni aggiornate ✓')
    showUserDetail(userId)
  } catch(e) { showToast(e.message, 'error') }
}

// ── AVVISO DI REGALO PREMIUM ──────────────────────────
// Durata "amichevole" dalle due date: riconosce i periodi standard (1/3/6 mesi, 1/2 anni) entro
// pochi giorni di tolleranza (i mesi non hanno tutti la stessa lunghezza), altrimenti dice i giorni esatti.
function formatPremiumDurationIt(fromISO, untilISO) {
  const days = Math.round((new Date(untilISO) - new Date(fromISO)) / 86400000)
  if (days <= 0) return null
  const near = (n, tol) => Math.abs(days - n) <= tol
  if (near(365, 4)) return '1 anno'
  if (near(730, 6)) return '2 anni'
  if (near(180, 4)) return '6 mesi'
  if (near(90, 3)) return '3 mesi'
  if (near(30, 2)) return '1 mese'
  const months = Math.round(days / 30)
  if (months >= 1 && Math.abs(days - months * 30) <= 3) return `${months} mesi`
  return `${days} giorni`
}

// Crea il messaggio personale (campanella dell'app) e prova a mandare anche la push. Non blocca mai
// l'attivazione del Premium, già salvata prima di questa chiamata: un eventuale errore è solo avvisato.
async function sendPremiumGiftNotice(userId, fromISO, untilISO) {
  try {
    const dur = formatPremiumDurationIt(fromISO, untilISO)
    const until = fmtDate(untilISO)
    const body = dur
      ? `Un amministratore di Cuvée ti ha regalato l'abbonamento Premium per ${dur}, fino al ${until}. Buona degustazione!`
      : `Un amministratore di Cuvée ti ha regalato l'abbonamento Premium, fino al ${until}. Buona degustazione!`
    const r = await callSendPush({ target_user_id: userId, title: 'Ti abbiamo regalato Premium', body, cta_action: 'premium', cta_label: 'Scopri Premium' })
    showToast('Premium attivato ✓ · avviso inviato' + (r.sent ? ` (push su ${r.sent} dispositivo/i)` : ''))
  } catch(e) { showToast('Premium attivato, ma l\'avviso non è partito: ' + e.message, 'error') }
}

// ── PREMIUM MODAL ─────────────────────────────────────
function openPremiumModal(userId, email) {
  const today     = new Date().toISOString().slice(0, 10)
  const m1  = new Date(Date.now() +  30*24*3600*1000).toISOString().slice(0, 10)
  const m3  = new Date(Date.now() +  90*24*3600*1000).toISOString().slice(0, 10)
  const m6  = new Date(Date.now() + 180*24*3600*1000).toISOString().slice(0, 10)
  const y1  = new Date(Date.now() + 365*24*3600*1000).toISOString().slice(0, 10)

  const html = `
    <div class="adm-edit-form">
      <div style="margin-bottom:16px;color:var(--text-2);font-family:var(--mono);font-size:12px">
        Utente: <span style="color:var(--gold)">${esc(email)}</span>
      </div>
      <div style="margin-bottom:18px">
        <div class="adm-form-label" style="margin-bottom:8px">DURATA RAPIDA</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button class="adm-btn adm-btn-ghost adm-prem-preset" onclick="setPremDate('${m1}',this)">1 mese</button>
          <button class="adm-btn adm-btn-ghost adm-prem-preset" onclick="setPremDate('${m3}',this)">3 mesi</button>
          <button class="adm-btn adm-btn-ghost adm-prem-preset" onclick="setPremDate('${m6}',this)">6 mesi</button>
          <button class="adm-btn adm-btn-ghost adm-prem-preset" onclick="setPremDate('${y1}',this)">1 anno</button>
        </div>
      </div>
      <div class="adm-edit-grid">
        <div class="adm-form-field">
          <label class="adm-form-label">DATA INIZIO</label>
          <input id="pm-from" class="adm-form-input" type="date" value="${today}">
        </div>
        <div class="adm-form-field">
          <label class="adm-form-label">DATA FINE *</label>
          <input id="pm-until" class="adm-form-input" type="date" value="${y1}">
        </div>
        <div class="adm-form-field" style="grid-column:1/-1">
          <label class="adm-form-label">NOTE (opzionale)</label>
          <input id="pm-notes" class="adm-form-input" type="text" placeholder="es. Influencer, codice promo...">
        </div>
        <div class="adm-form-field" style="grid-column:1/-1">
          <label style="display:flex;gap:10px;align-items:center;cursor:pointer;font-size:13px;color:var(--text-2)">
            <input type="checkbox" id="pm-notify" checked style="width:16px;height:16px;accent-color:var(--gold)">
            Avvisa l'utente del regalo (messaggio nell'app + push)
          </label>
        </div>
      </div>
      <div class="adm-modal-actions">
        <button class="adm-btn adm-btn-ghost" onclick="closeModal()">Annulla</button>
        <button class="adm-btn adm-btn-primary" onclick="assignPremiumModal('${userId}')">
          <i class="ti ti-crown"></i> Attiva Premium
        </button>
      </div>
    </div>`
  openModal('Attiva Premium', html)
}

function setPremDate(date, btn) {
  const el = document.getElementById('pm-until')
  if (el) el.value = date
  document.querySelectorAll('.adm-prem-preset').forEach(b => b.classList.remove('active'))
  if (btn) btn.classList.add('active')
}

async function assignPremiumModal(userId) {
  const from  = document.getElementById('pm-from')?.value
  const until = document.getElementById('pm-until')?.value
  const notes = document.getElementById('pm-notes')?.value
  const notify = document.getElementById('pm-notify')?.checked
  if (!until) { showToast('Seleziona una data di scadenza', 'error'); return }
  try {
    const fromIso  = from  ? new Date(from  + 'T00:00:00').toISOString() : new Date().toISOString()
    const untilIso = new Date(until + 'T23:59:59').toISOString()
    const { error } = await supa.from('users').update({
      is_premium: true,
      premium_from:  fromIso,
      premium_until: untilIso,
      premium_notes: notes || null,
      premium_source: 'admin',
    }).eq('id', userId)
    if (error) throw error
    closeModal()
    showUserDetail(userId)
    renderUtenti()
    if (notify) await sendPremiumGiftNotice(userId, fromIso, untilIso)
    else showToast('Premium attivato ✓')
  } catch(e) { showToast(e.message, 'error') }
}

// ── USER EDIT MODAL ───────────────────────────────────
async function editUserModal(userId) {
  openModal('Modifica Utente', loadingHTML(), true)
  try {
    const { data: u, error } = await supa.from('users').select('*').eq('id', userId).single()
    if (error) throw error

    // Read-only (managed by Supabase Auth, not editable from users table)
    const READONLY = ['id', 'email', 'created_at', 'updated_at']
    const FULL     = ['display_name', 'full_name', 'nome', 'premium_notes', 'note']
    const TA       = ['premium_notes', 'note', 'bio']

    // Show email read-only at top
    const emailField = `<div class="adm-form-field" style="grid-column:1/-1">
      <label class="adm-form-label">EMAIL <span style="color:var(--text-3);font-size:10px">(sola lettura — modificabile solo da Supabase Auth)</span></label>
      <input class="adm-form-input" type="text" value="${esc(u.email ?? '')}" disabled style="opacity:.45;cursor:not-allowed">
    </div>`

    // All other editable columns
    const otherFields = buildAllColsForm(u, { skip: READONLY, fullRow: FULL, textareaCols: TA })

    const html = `
      <div class="adm-edit-form">
        <div class="adm-edit-grid">
          ${emailField}
          ${otherFields}
        </div>
        <div class="adm-edit-meta">
          <code class="adm-code" style="font-size:10px">${u.id}</code>
          <span style="color:var(--text-3);font-size:11px">Registrato: ${fmtDate(u.created_at)}</span>
        </div>
        <div class="adm-modal-actions">
          <button class="adm-btn adm-btn-ghost" onclick="closeModal()">Annulla</button>
          <button class="adm-btn adm-btn-primary" onclick="saveUserEdit('${userId}')">
            <i class="ti ti-device-floppy"></i> Salva
          </button>
        </div>
      </div>`
    document.getElementById('modal-body').innerHTML = html
  } catch(e) { document.getElementById('modal-body').innerHTML = errorHTML(e.message) }
}

async function saveUserEdit(userId) {
  const updates = collectDataCols()
  try {
    const { error } = await supa.from('users').update(updates).eq('id', userId)
    if (error) throw error
    closeModal()
    showToast('Utente aggiornato ✓')
    showUserDetail(userId)
    renderUtenti()
  } catch(e) { showToast(e.message, 'error') }
}

// ══════════════════════════════════════════════════════
// ABBONAMENTI
// ══════════════════════════════════════════════════════
async function loadAbbonamenti() {
  const tbody = document.getElementById('abbonamenti-tbody')
  if (!tbody) return
  tbody.innerHTML = loadingRow(6)
  try {
    const { data, error } = await supa
      .from('users')
      .select('id, email, is_premium, premium_from, premium_until, premium_notes')
      .eq('is_premium', true)
      .order('premium_until', { ascending: false })
    if (error) throw error

    const now = new Date()
    const active   = data.filter(u => !u.premium_until || new Date(u.premium_until) > now)
    const expiring = active.filter(u => u.premium_until && (new Date(u.premium_until) - now) < 7*24*60*60*1000)
    const expired  = data.filter(u => u.premium_until && new Date(u.premium_until) <= now)

    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v }
    set('abb-active',   active.length)
    set('abb-expiring', expiring.length)
    set('abb-expired',  expired.length)

    tbody.innerHTML = !data.length
      ? `<tr><td colspan="6"><div style="padding:32px;text-align:center;color:var(--text-3)">Nessun utente premium</div></td></tr>`
      : data.map(u => {
          const isActive   = !u.premium_until || new Date(u.premium_until) > now
          const isExpiring = isActive && u.premium_until && (new Date(u.premium_until) - now) < 7*24*60*60*1000
          const badge = isActive
            ? (isExpiring
                ? '<span class="adm-badge pending"><i class="ti ti-clock"></i> IN SCADENZA</span>'
                : '<span class="adm-badge premium"><i class="ti ti-crown"></i> ATTIVO</span>')
            : '<span class="adm-badge inactive">SCADUTO</span>'
          return `<tr class="adm-table-row" style="opacity:${isActive?1:.6}">
            <td>
              <div class="adm-user-cell">
                <div class="adm-user-avatar">${(u.email??'?')[0].toUpperCase()}</div>
                <span class="adm-user-name">${esc(u.email??'-')}</span>
              </div>
            </td>
            <td class="adm-time-cell">${fmtDate(u.premium_from)}</td>
            <td class="adm-time-cell ${isActive ? 'gold' : ''}" style="${isExpiring?'color:var(--amber)':''}">${u.premium_until ? fmtDate(u.premium_until) : 'Illimitato'}</td>
            <td class="adm-notes-cell">${esc(u.premium_notes??'-')}</td>
            <td>${badge}</td>
            <td>
              <div class="adm-row-actions">
                <button class="adm-btn adm-btn-approve" onclick="renewPremium('${u.id}')">
                  <i class="ti ti-refresh"></i>
                </button>
                <button class="adm-btn adm-btn-reject" onclick="revokeAbb('${u.id}','${esc(u.email??'')}')">
                  <i class="ti ti-ban"></i>
                </button>
              </div>
            </td>
          </tr>`
        }).join('')
  } catch(e) { tbody.innerHTML = errorRow(6, e.message) }
}

async function assignPremium() {
  const email = document.getElementById('prem-email').value.trim()
  const from  = document.getElementById('prem-from').value
  const until = document.getElementById('prem-until').value
  const notes = document.getElementById('prem-notes').value.trim()
  const notify = document.getElementById('prem-notify')?.checked
  if (!email || !until) { showToast('Email e data di fine obbligatorie', 'error'); return }
  try {
    const { data: users, error: e1 } = await supa.from('users').select('id').eq('email', email)
    if (e1) throw e1
    if (!users.length) throw new Error(`Utente "${email}" non trovato`)
    const fromIso  = from  ? new Date(from  + 'T00:00:00').toISOString() : new Date().toISOString()
    const untilIso = new Date(until + 'T23:59:59').toISOString()
    const { error } = await supa.from('users').update({
      is_premium: true,
      premium_from:  fromIso,
      premium_until: untilIso,
      premium_notes: notes || null,
      premium_source: 'admin',
    }).eq('id', users[0].id)
    if (error) throw error
    document.getElementById('prem-email').value = ''
    document.getElementById('prem-notes').value = ''
    loadAbbonamenti()
    if (notify) await sendPremiumGiftNotice(users[0].id, fromIso, untilIso)
    else showToast(`Premium attivato per ${email} ✓`)
  } catch(e) { showToast(e.message, 'error') }
}

async function renewPremium(userId) {
  const until = new Date(Date.now() + 365*24*60*60*1000).toISOString()
  try {
    const { error } = await supa.from('users').update({ premium_until: until, premium_source: 'admin' }).eq('id', userId)
    if (error) throw error
    showToast('Premium rinnovato di 1 anno ✓')
    loadAbbonamenti()
  } catch(e) { showToast(e.message, 'error') }
}

async function revokeAbb(userId, email) {
  if (!confirm(`Rimuovere il premium da ${email}?`)) return
  try {
    const { error } = await supa.from('users').update({ is_premium: false, premium_until: null }).eq('id', userId)
    if (error) throw error
    showToast('Premium rimosso')
    loadAbbonamenti()
  } catch(e) { showToast(e.message, 'error') }
}

// ══════════════════════════════════════════════════════
// STATS
// ══════════════════════════════════════════════════════
// ══════════════════════════════════════════════════════
// STATISTICHE — filtro periodo
// ══════════════════════════════════════════════════════
const STATS_MONTH_NAMES = ['gennaio','febbraio','marzo','aprile','maggio','giugno','luglio','agosto','settembre','ottobre','novembre','dicembre']
const STATS_MONTH_ABBR  = ['gen','feb','mar','apr','mag','giu','lug','ago','set','ott','nov','dic']
const STATS_WEEKDAY_LETTER = ['D','L','M','M','G','V','S'] // getDay(): 0=domenica..6=sabato
const STATS_WEEKDAY_NAME   = ['Domenica','Lunedì','Martedì','Mercoledì','Giovedì','Venerdì','Sabato']

function _startOfDay(d) { const x = new Date(d); x.setHours(0,0,0,0); return x }
function _addDays(d, n) { const x = new Date(d); x.setDate(x.getDate()+n); return x }
function _startOfWeek(d) { const x = _startOfDay(d); const day = (x.getDay()+6)%7; return _addDays(x,-day) }
function _startOfMonth(d) { return new Date(d.getFullYear(), d.getMonth(), 1) }
function _startOfYear(d) { return new Date(d.getFullYear(), 0, 1) }
function _isoDateLocal(d) { return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}` }
function _fmtDateIt(d) { return `${d.getDate()} ${STATS_MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}` }

function computeStatsRange(preset) {
  const now = new Date()
  const todayStart = _startOfDay(now)
  const tomorrowStart = _addDays(todayStart, 1)
  switch (preset) {
    case 'today':     return { from: todayStart, to: tomorrowStart, label: `Oggi — ${_fmtDateIt(todayStart)}` }
    case 'yesterday': { const y = _addDays(todayStart,-1); return { from: y, to: todayStart, label: `Ieri — ${_fmtDateIt(y)}` } }
    case 'week':      { const s = _startOfWeek(now); return { from: s, to: tomorrowStart, label: `Questa settimana — dal ${_fmtDateIt(s)}` } }
    case 'month':     { const s = _startOfMonth(now); return { from: s, to: tomorrowStart, label: `Questo mese — ${STATS_MONTH_NAMES[now.getMonth()]} ${now.getFullYear()}` } }
    case 'lastmonth': { const s = new Date(now.getFullYear(), now.getMonth()-1, 1); const e = _startOfMonth(now); return { from: s, to: e, label: `Mese scorso — ${STATS_MONTH_NAMES[s.getMonth()]} ${s.getFullYear()}` } }
    case '7d':        { const s = _addDays(todayStart,-6); return { from: s, to: tomorrowStart, label: `Ultimi 7 giorni — dal ${_fmtDateIt(s)}` } }
    case '30d':       { const s = _addDays(todayStart,-29); return { from: s, to: tomorrowStart, label: `Ultimi 30 giorni — dal ${_fmtDateIt(s)}` } }
    case '90d':       { const s = _addDays(todayStart,-89); return { from: s, to: tomorrowStart, label: `Ultimi 90 giorni — dal ${_fmtDateIt(s)}` } }
    case 'year':      { const s = _startOfYear(now); return { from: s, to: tomorrowStart, label: `Quest'anno — ${now.getFullYear()}` } }
    case 'all':
    default:          return { from: null, to: tomorrowStart, label: 'Da sempre' }
  }
}

let statsRangeState = null
;(function initStatsRangeDefault() {
  const r = computeStatsRange('month')
  statsRangeState = { preset: 'month', ...r }
  const fromInp = document.getElementById('stats-date-from')
  const toInp = document.getElementById('stats-date-to')
  if (fromInp) fromInp.value = r.from ? _isoDateLocal(r.from) : ''
  if (toInp) toInp.value = _isoDateLocal(_addDays(r.to, -1))
})()

function setStatsPreset(preset, btnEl) {
  document.querySelectorAll('#stats-presets .adm-filter').forEach(b => b.classList.remove('active'))
  if (btnEl) btnEl.classList.add('active')
  const r = computeStatsRange(preset)
  statsRangeState = { preset, ...r }
  const fromInp = document.getElementById('stats-date-from')
  const toInp = document.getElementById('stats-date-to')
  if (fromInp) fromInp.value = r.from ? _isoDateLocal(r.from) : ''
  if (toInp) toInp.value = _isoDateLocal(_addDays(r.to, -1))
  const lbl = document.getElementById('stats-range-label')
  if (lbl) lbl.textContent = r.label
  loadStats()
}

function applyCustomStatsRange() {
  const fromInp = document.getElementById('stats-date-from')
  const toInp = document.getElementById('stats-date-to')
  if (!fromInp?.value || !toInp?.value) { alert('Seleziona sia la data di inizio che quella di fine'); return }
  const from = new Date(fromInp.value + 'T00:00:00')
  const to = _addDays(new Date(toInp.value + 'T00:00:00'), 1)
  if (from >= to) { alert('La data di inizio deve precedere quella di fine'); return }
  document.querySelectorAll('#stats-presets .adm-filter').forEach(b => b.classList.remove('active'))
  const label = `Dal ${_fmtDateIt(from)} al ${_fmtDateIt(_addDays(to,-1))}`
  statsRangeState = { preset: 'custom', from, to, label }
  const lbl = document.getElementById('stats-range-label')
  if (lbl) lbl.textContent = label
  loadStats()
}

// ══════════════════════════════════════════════════════
// STATISTICHE — rendering helper
// ══════════════════════════════════════════════════════
function _topFromCounts(countsMap, namesMap, n = 5) {
  return Object.entries(countsMap).sort((a,b) => b[1]-a[1]).slice(0, n)
    .map(([id, c]) => ({ name: namesMap[id] ?? id.slice(0,8), count: c }))
}

function _renderTopList(elId, items, emptyMsg) {
  const el = document.getElementById(elId)
  if (!el) return
  if (!items.length) { el.innerHTML = `<div class="adm-loading-block" style="color:var(--text-3)">${esc(emptyMsg)}</div>`; return }
  const maxC = items[0].count || 1
  const ranks = ['I','II','III','IV','V']
  el.innerHTML = items.map((it, i) => `
    <div class="adm-top-item">
      <span class="adm-top-rank">${ranks[i]}</span>
      <div class="adm-top-info">
        <span class="adm-top-name">${esc(it.name)}</span>
        <div class="adm-top-bar"><div class="adm-top-fill" style="width:${Math.round(it.count/maxC*100)}%"></div></div>
      </div>
      <span class="adm-top-count">${it.count}</span>
    </div>`).join('')
}

function _bucketKeyFor(d, granularity) {
  if (granularity === 'day') return _isoDateLocal(d)
  if (granularity === 'week') return _isoDateLocal(_startOfWeek(d))
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`
}

function _bucketScans(scans, from, to) {
  const spanDays = from ? Math.ceil((to - from) / 86400000) : (scans.length ? Math.ceil((to - new Date(scans[0].created_at)) / 86400000) : 1)
  let granularity = 'day'
  if (spanDays > 180) granularity = 'month'
  else if (spanDays > 45) granularity = 'week'

  const buckets = new Map()
  if (from) {
    let cursor = new Date(from)
    let guard = 0
    while (cursor < to && guard < 2000) {
      const k = _bucketKeyFor(cursor, granularity)
      if (!buckets.has(k)) buckets.set(k, 0)
      cursor = granularity === 'day' ? _addDays(cursor,1) : granularity === 'week' ? _addDays(cursor,7) : new Date(cursor.getFullYear(), cursor.getMonth()+1, 1)
      guard++
    }
  }
  scans.forEach(s => {
    const k = _bucketKeyFor(new Date(s.created_at), granularity)
    buckets.set(k, (buckets.get(k) || 0) + 1)
  })
  const entries = Array.from(buckets.entries()).sort((a,b) => a[0] < b[0] ? -1 : 1)
  return { granularity, entries: entries.length > 60 ? entries.slice(-60) : entries }
}

function _bucketShortLabel(key, granularity) {
  if (granularity === 'day')   return STATS_WEEKDAY_LETTER[new Date(key+'T00:00:00').getDay()]
  if (granularity === 'week')  { const d = new Date(key+'T00:00:00'); return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}` }
  const [y,m] = key.split('-'); return STATS_MONTH_ABBR[parseInt(m,10)-1]
}

function _bucketFullLabel(key, granularity) {
  if (granularity === 'month') { const [y,m] = key.split('-'); return `${STATS_MONTH_NAMES[parseInt(m,10)-1]} ${y}` }
  if (granularity === 'week')  return `Settimana dal ${_fmtDateIt(new Date(key+'T00:00:00'))}`
  return _fmtDateIt(new Date(key+'T00:00:00'))
}

function _peakWeekdayLabel(scans) {
  if (!scans.length) return ''
  const counts = new Array(7).fill(0)
  scans.forEach(s => counts[new Date(s.created_at).getDay()]++)
  const max = Math.max(...counts)
  if (max === 0) return ''
  const top = counts.map((c,i) => ({c,i})).filter(x => x.c === max).map(x => STATS_WEEKDAY_NAME[x.i])
  return `${top.join(' e ')} → giorno con più scansioni (${max})`
}

function _renderDailyBars(scans, from, to) {
  const barsEl = document.getElementById('stats-daily-bars')
  const labelEl = document.getElementById('stats-daily-label')
  if (!barsEl) return
  const { granularity, entries } = _bucketScans(scans, from, to)
  if (!entries.length) {
    barsEl.innerHTML = '<div class="adm-loading-block" style="color:var(--text-3)">Nessun dato nel periodo</div>'
    if (labelEl) labelEl.textContent = ''
    return
  }
  const maxC = Math.max(1, ...entries.map(([,c]) => c))
  barsEl.innerHTML = entries.map(([key, c]) => {
    const h = c > 0 ? Math.max(Math.round(c/maxC*100), 4) : 2
    return `<div class="adm-bar-wrap" title="${esc(_bucketFullLabel(key,granularity))}: ${c} scansioni"><div class="adm-bar" style="height:${h}%"></div><span>${esc(_bucketShortLabel(key,granularity))}</span></div>`
  }).join('')
  const total = entries.reduce((s,[,c]) => s+c, 0)
  const peak = granularity === 'day' ? _peakWeekdayLabel(scans) : ''
  if (labelEl) labelEl.textContent = peak || `${total.toLocaleString('it')} scansioni nel periodo`
}

function _renderTipoDonut(scans) {
  const labels = { blanc_de_blancs:'Blanc de Blancs', blanc_de_noirs:'Blanc de Noirs', rose:'Rosé', assemblage:'Assemblage' }
  const colors = { blanc_de_blancs:'#6B8AE8', blanc_de_noirs:'#5BBCAD', rose:'#E87B7B', assemblage:'#C8A03A' }
  const el = document.getElementById('stats-tipo-donut')
  if (!el) return
  const counts = {}
  let total = 0
  scans.forEach(s => { if (!s.detected_tipo) return; counts[s.detected_tipo] = (counts[s.detected_tipo]||0) + 1; total++ })
  if (!total) { el.innerHTML = '<div class="adm-loading-block" style="color:var(--text-3)">Nessun tipo rilevato nel periodo</div>'; return }
  const sorted = Object.entries(counts).sort((a,b) => b[1]-a[1])
  el.innerHTML = sorted.map(([k,c]) => `
    <div class="adm-donut-item">
      <div class="adm-donut-dot" style="background:${colors[k] || '#8a8a8a'}"></div>
      <span class="adm-donut-label">${esc(labels[k] || k)}</span>
      <span class="adm-donut-pct">${Math.round(c/total*100)}%</span>
    </div>`).join('')
}

// ══════════════════════════════════════════════════════
// COSTI SCANSIONE — sistema attuale (Haiku + ricerca web)
// I costi vengono da bottle_scans.cost_usd, calcolato dalla funzione con i token e le ricerche realmente usati.
// ══════════════════════════════════════════════════════
const USD_TO_EUR = 0.86            // cambio indicativo usato solo per la stima "≈ €"
const BUDGET_UTENTE_EUR = 2.5      // budget mensile di costo scansioni per utente (deciso il 24/09/2026)
const SCAN_KINDS = {
  catalogo: { label: 'Riconoscimento da catalogo', sub: 'Haiku · bottiglia già in catalogo',        color: '#00FF88' },
  web:      { label: 'Analisi completa',           sub: 'Haiku + 3 ricerche web · bottiglia nuova', color: '#C8A03A' },
  web1:     { label: 'Analisi di prova (1 ricerca)', sub: 'Haiku + 1 ricerca web · 24/09 mattina',  color: '#E8B74A' },
  sonnet:   { label: 'Analisi vecchio sistema',    sub: 'Sonnet senza ricerca · fino al 24/09',      color: '#6B8AE8' },
  non_vino: { label: 'Foto non vino',              sub: 'fermata al primo controllo',                color: '#A0A0B8' },
  altro:    { label: 'Senza dati di costo',        sub: 'registrate prima del tracking',             color: '#666680' },
}
const SCAN_KIND_ORDER = ['catalogo', 'web', 'web1', 'sonnet', 'non_vino', 'altro']
const SCAN_CARD_KINDS = ['catalogo', 'web', 'sonnet', 'non_vino']   // le quattro card in alto

// Tipo di una scansione: le analisi complete del nuovo sistema hanno ricerche web (ricerche_web) o molti token in ingresso
function scanKind(s) {
  const t = s.scan_type
  if (t === 'haiku_only') return 'catalogo'
  if (t === 'blocked_non_wine') return 'non_vino'
  if (t === 'sonnet_full' || t === 'haiku_fallback') {
    if (Number(s.ricerche) > 0) return 'web'                       // nuovo sistema: 3 ricerche web
    if (Number(s.sonnet_input_tokens) > 15000) return 'web1'       // prove del 24/09: 1 ricerca web (pagine lette = tanti token)
    return 'sonnet'
  }
  return 'altro'
}
const fmtUsdCost = n => '$' + Number(n || 0).toFixed(Number(n || 0) < 1 ? 4 : 2)
const fmtEurEst  = n => { const e = Number(n || 0) * USD_TO_EUR; return '≈ €' + e.toFixed(e < 0.1 ? 3 : 2).replace('.', ',') }
const fmtTokK    = n => n >= 1_000_000 ? (n/1_000_000).toFixed(2)+'M' : n >= 1_000 ? (n/1_000).toFixed(1)+'K' : String(Math.round(n))

// Somma per tipo: { kind: { n, cost, inTok, outTok } } + totali
function aggScansByKind(scans) {
  const out = { total: { n: 0, cost: 0 } }
  SCAN_KIND_ORDER.forEach(k => { out[k] = { n: 0, cost: 0, inTok: 0, outTok: 0 } })
  scans.forEach(s => {
    const k = scanKind(s), c = Number(s.cost_usd) || 0
    out[k].n++; out[k].cost += c
    out[k].inTok += Number(s.haiku_input_tokens || 0) + Number(s.sonnet_input_tokens || 0)
    out[k].outTok += Number(s.haiku_output_tokens || 0) + Number(s.sonnet_output_tokens || 0)
    out.total.n++; out.total.cost += c
  })
  return out
}

// Utenti per id, a blocchi (limite di lunghezza dell'URL)
async function fetchUsersByIds(ids) {
  const map = new Map()
  for (let i = 0; i < ids.length; i += 100) {
    const { data } = await supa.from('users')
      .select('id,email,display_name,full_name,is_premium,premium_until,premium_source')
      .in('id', ids.slice(i, i + 100))
    ;(data || []).forEach(u => map.set(u.id, u))
  }
  return map
}

function _renderDailyCost(scans, from, to) {
  const barsEl = document.getElementById('stats-cost-daily-bars')
  const labelEl = document.getElementById('stats-cost-daily-label')
  if (!barsEl) return
  const { granularity, entries } = _bucketScans(scans, from, to)
  if (!entries.length) { barsEl.innerHTML = '<div class="adm-loading-block" style="color:var(--text-3)">Nessun dato nel periodo</div>'; if (labelEl) labelEl.textContent = ''; return }
  const sums = new Map(entries.map(([k]) => [k, 0]))
  scans.forEach(s => { const k = _bucketKeyFor(new Date(s.created_at), granularity); if (sums.has(k)) sums.set(k, sums.get(k) + (Number(s.cost_usd) || 0)) })
  const vals = entries.map(([k]) => [k, sums.get(k)])
  const maxC = Math.max(0.0001, ...vals.map(([, c]) => c))
  barsEl.innerHTML = vals.map(([key, c]) => {
    const h = c > 0 ? Math.max(Math.round(c / maxC * 100), 4) : 2
    return `<div class="adm-bar-wrap" title="${esc(_bucketFullLabel(key, granularity))}: ${fmtUsdCost(c)}"><div class="adm-bar" style="height:${h}%"></div><span>${esc(_bucketShortLabel(key, granularity))}</span></div>`
  }).join('')
  const total = vals.reduce((t, [, c]) => t + c, 0)
  if (labelEl) labelEl.textContent = `${fmtUsdCost(total)} nel periodo (${fmtEurEst(total)})`
}

// Sezione "Scansioni e costi AI" delle Statistiche
async function _renderCostStats(scans, from, to) {
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v ?? '-' }
  const html = (id, v) => { const el = document.getElementById(id); if (el) el.innerHTML = v }
  const agg = aggScansByKind(scans)

  SCAN_CARD_KINDS.forEach(k => {
    set('stats-k-' + k, agg[k].n.toLocaleString('it'))
    set('stats-kavg-' + k, agg[k].n ? 'media ' + fmtUsdCost(agg[k].cost / agg[k].n) : 'nessuna')
  })
  const tracked = agg.catalogo.n + agg.web.n + agg.web1.n + agg.sonnet.n
  set('stats-hit-rate', tracked ? Math.round(agg.catalogo.n / tracked * 100) + '%' : '—')
  const priced = agg.total.n - agg.altro.n
  set('stats-cost-total', fmtUsdCost(agg.total.cost))
  set('stats-cost-total-eur', fmtEurEst(agg.total.cost))
  set('stats-cost-avg', priced ? fmtUsdCost(agg.total.cost / priced) : '—')
  set('stats-cost-avg-web', agg.web.n ? fmtUsdCost(agg.web.cost / agg.web.n) : '—')

  // ── Tabella per tipo ──
  const rows = SCAN_KIND_ORDER.filter(k => agg[k].n > 0 || k === 'catalogo' || k === 'web').map(k => {
    const a = agg[k], kd = SCAN_KINDS[k]
    return `<tr class="adm-table-row">
      <td><div style="display:flex;align-items:center;gap:8px"><span style="width:9px;height:9px;border-radius:50%;background:${kd.color};flex-shrink:0"></span>
        <div><div style="font-weight:500">${esc(kd.label)}</div><div style="font-size:11px;color:var(--text-3)">${esc(kd.sub)}</div></div></div></td>
      <td class="num">${a.n.toLocaleString('it')}</td>
      <td class="num">${agg.total.n ? Math.round(a.n / agg.total.n * 100) : 0}%</td>
      <td class="num">${fmtTokK(a.inTok)} / ${fmtTokK(a.outTok)}</td>
      <td class="num">${fmtUsdCost(a.cost)}</td>
      <td class="num">${a.n ? fmtUsdCost(a.cost / a.n) : '—'}</td>
    </tr>`
  }).join('')
  html('stats-cost-breakdown', scans.length ? `
    <div class="adm-table-wrap" style="margin:0"><table class="adm-table" style="min-width:640px"><thead><tr>
      <th>Tipo di scansione</th><th class="num">Scansioni</th><th class="num">Quota</th><th class="num">Token in / out</th><th class="num">Costo</th><th class="num">Costo medio</th>
    </tr></thead><tbody>${rows}
      <tr class="adm-table-row" style="font-weight:600"><td>Totale</td><td class="num">${agg.total.n.toLocaleString('it')}</td><td class="num">100%</td><td class="num">—</td>
        <td class="num">${fmtUsdCost(agg.total.cost)}<div style="font-size:10px;color:var(--text-3);font-weight:400">${fmtEurEst(agg.total.cost)}</div></td>
        <td class="num">${priced ? fmtUsdCost(agg.total.cost / priced) : '—'}</td></tr>
    </tbody></table></div>
    <div style="margin-top:10px;font-size:11px;color:var(--text-3);line-height:1.6">Costi reali registrati per ogni scansione (token e ricerche effettivamente usati). «Analisi completa» = Haiku con 3 ricerche web (1 c per ricerca + pagine lette). Il cambio in € è indicativo (1 $ ≈ ${USD_TO_EUR} €).</div>`
    : '<div class="adm-loading-block" style="color:var(--text-3)">Nessuna scansione nel periodo selezionato</div>')

  // ── Per utente e per piano ──
  const perUser = new Map()
  scans.forEach(s => {
    if (!s.user_id) return
    const u = perUser.get(s.user_id) || { id: s.user_id, n: 0, full: 0, cat: 0, cost: 0 }
    const k = scanKind(s)
    u.n++; u.cost += Number(s.cost_usd) || 0
    if (k === 'web' || k === 'web1' || k === 'sonnet') u.full++
    if (k === 'catalogo') u.cat++
    perUser.set(s.user_id, u)
  })
  const usersMap = perUser.size ? await fetchUsersByIds([...perUser.keys()]) : new Map()
  set('stats-active-users', perUser.size.toLocaleString('it'))
  set('stats-cost-per-user', perUser.size ? fmtUsdCost(agg.total.cost / perUser.size) + ' / utente' : '—')

  // per piano
  const plans = { premium: { users: 0, n: 0, full: 0, cost: 0 }, free: { users: 0, n: 0, full: 0, cost: 0 } }
  perUser.forEach(u => {
    const info = usersMap.get(u.id)
    const p = info && isPremiumActive(info) ? plans.premium : plans.free
    p.users++; p.n += u.n; p.full += u.full; p.cost += u.cost
  })
  const planRow = (name, p) => `<tr class="adm-table-row">
      <td style="font-weight:500">${name}</td><td class="num">${p.users}</td><td class="num">${p.n.toLocaleString('it')}</td><td class="num">${p.full.toLocaleString('it')}</td>
      <td class="num">${fmtUsdCost(p.cost)}</td><td class="num">${p.users ? fmtUsdCost(p.cost / p.users) : '—'}</td><td class="num">${p.n ? fmtUsdCost(p.cost / p.n) : '—'}</td></tr>`
  html('stats-cost-plan', perUser.size ? `<div class="adm-table-wrap" style="margin:0"><table class="adm-table" style="min-width:640px"><thead><tr>
      <th>Piano</th><th class="num">Utenti attivi</th><th class="num">Scansioni</th><th class="num">Analisi complete</th><th class="num">Costo</th><th class="num">Per utente</th><th class="num">Per scansione</th>
    </tr></thead><tbody>${planRow('Premium', plans.premium)}${planRow('Free', plans.free)}</tbody></table></div>`
    : '<div class="adm-loading-block" style="color:var(--text-3)">Nessun utente ha scansionato nel periodo</div>')

  // top utenti per costo
  const top = [...perUser.values()].sort((a, b) => b.cost - a.cost).slice(0, 20)
  const budgetUsd = BUDGET_UTENTE_EUR / USD_TO_EUR
  html('stats-cost-users', top.length ? `<div class="adm-table-wrap" style="margin:0"><table class="adm-table" style="min-width:700px"><thead><tr>
      <th>Utente</th><th>Piano</th><th class="num">Scansioni</th><th class="num">Da catalogo</th><th class="num">Analisi complete</th><th class="num">Costo</th><th class="num">Costo medio</th><th class="num">% budget</th>
    </tr></thead><tbody>${top.map(u => {
      const info = usersMap.get(u.id), prem = info && isPremiumActive(info)
      const name = info ? (info.display_name || info.full_name || info.email || u.id.slice(0, 8)) : u.id.slice(0, 8) + '…'
      const pct = u.cost / budgetUsd * 100
      const col = pct >= 100 ? 'var(--red)' : pct >= 60 ? 'var(--amber)' : 'var(--text)'
      return `<tr class="adm-table-row">
        <td><div style="font-weight:500">${esc(name)}</div>${info && info.email && info.email !== name ? `<div style="font-size:11px;color:var(--text-3)">${esc(info.email)}</div>` : ''}</td>
        <td>${prem ? '<span class="adm-badge premium">PREMIUM</span>' : '<span class="adm-badge free">FREE</span>'}</td>
        <td class="num">${u.n}</td><td class="num">${u.cat}</td><td class="num">${u.full}</td>
        <td class="num">${fmtUsdCost(u.cost)}</td><td class="num">${fmtUsdCost(u.cost / u.n)}</td>
        <td class="num" style="color:${col};font-weight:600">${pct < 10 ? pct.toFixed(1) : Math.round(pct)}%</td></tr>`
    }).join('')}</tbody></table></div>
    <div style="margin-top:10px;font-size:11px;color:var(--text-3);line-height:1.6">Ordinati per costo. «% budget» = costo rispetto al budget di ${BUDGET_UTENTE_EUR.toString().replace('.', ',')} € per utente (≈ ${fmtUsdCost(budgetUsd)}): pensato per un periodo mensile.</div>`
    : '<div class="adm-loading-block" style="color:var(--text-3)">Nessuna scansione nel periodo selezionato</div>')

  _renderDailyCost(scans, from, to)
}

// ══════════════════════════════════════════════════════
// STATISTICHE — caricamento principale
// ══════════════════════════════════════════════════════
async function loadStats() {
  try {
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v ?? '-' }
    if (!statsRangeState) statsRangeState = { preset: 'month', ...computeStatsRange('month') }
    const { from, to } = statsRangeState
    const dateFilter = (q, col = 'created_at') => { let qq = q.lt(col, to.toISOString()); if (from) qq = qq.gte(col, from.toISOString()); return qq }

    // ── Stato attuale (non dipende dal periodo) ──────────────────
    const [
      { count: totBottiglie }, { count: totBottiglieReview },
      { count: totMaison }, { count: totMaisonReview },
      { count: totUtenti }, { count: totPremium },
      { count: totNewsletter }, { count: totWishlist },
    ] = await Promise.all([
      supa.from('bottiglie').select('*', { count:'exact', head:true }).eq('needs_review', false).eq('is_published', true),
      supa.from('bottiglie').select('*', { count:'exact', head:true }).eq('needs_review', true),
      supa.from('maison').select('*', { count:'exact', head:true }).eq('needs_review', false).eq('is_published', true),
      supa.from('maison').select('*', { count:'exact', head:true }).eq('needs_review', true),
      supa.from('users').select('*', { count:'exact', head:true }),
      activePremium(supa.from('users').select('*', { count:'exact', head:true })),
      supa.from('users').select('*', { count:'exact', head:true }).eq('newsletter_opt_in', true),
      supa.from('wishlist').select('*', { count:'exact', head:true }),
    ])

    set('stats-bottiglie', (totBottiglie??0).toLocaleString('it'))
    set('stats-bottiglie-review', (totBottiglieReview??0).toLocaleString('it'))
    set('stats-maison', (totMaison??0).toLocaleString('it'))
    set('stats-maison-review', (totMaisonReview??0).toLocaleString('it'))
    set('stats-utenti', (totUtenti??0).toLocaleString('it'))
    set('stats-premium', (totPremium??0).toLocaleString('it'))
    set('stats-newsletter', (totNewsletter??0).toLocaleString('it'))
    set('stats-wishlist-tot', (totWishlist??0).toLocaleString('it'))
    const premPctEl = document.getElementById('stats-premium-pct')
    if (premPctEl) premPctEl.textContent = totUtenti ? `${((totPremium/totUtenti)*100).toFixed(1)}% degli utenti registrati` : ''

    // ── Attività nel periodo: contatori semplici ──────────────────
    const [
      { count: newUsers }, { count: newPremium },
      { count: newBottiglie }, { count: newMaison },
    ] = await Promise.all([
      dateFilter(supa.from('users').select('*', { count:'exact', head:true })),
      dateFilter(supa.from('users').select('*', { count:'exact', head:true }).not('premium_from', 'is', null), 'premium_from'),
      dateFilter(supa.from('bottiglie').select('*', { count:'exact', head:true })),
      dateFilter(supa.from('maison').select('*', { count:'exact', head:true })),
    ])
    set('stats-new-users', (newUsers??0).toLocaleString('it'))
    set('stats-new-premium', (newPremium??0).toLocaleString('it'))
    set('stats-new-bottiglie', (newBottiglie??0).toLocaleString('it'))
    set('stats-new-maison', (newMaison??0).toLocaleString('it'))

    // ── Scansioni nel periodo (un'unica query, tutto derivato client-side) ──
    const { data: scansPeriod, error: scansErr } = await dateFilter(
      supa.from('bottle_scans').select('id,created_at,user_id,scan_type,cost_usd,ricerche:result_json->>ricerche_web,haiku_input_tokens,haiku_output_tokens,sonnet_input_tokens,sonnet_output_tokens,is_champagne,added_to_carnet,detected_tipo,matched_bottle_id,bottiglie:matched_bottle_id(nome,maison_id,maison:maison_id(nome))')
    ).order('created_at', { ascending: true }).limit(20000)

    const scans = scansErr ? [] : (scansPeriod || [])
    set('stats-scans', scans.length.toLocaleString('it'))

    const notChampagneN = scans.filter(s => s.is_champagne === false).length
    set('stats-not-champagne', notChampagneN.toLocaleString('it'))

    const carnetN = scans.filter(s => s.added_to_carnet === true).length
    set('stats-carnet-adds', carnetN.toLocaleString('it'))
    const carnetRateEl = document.getElementById('stats-carnet-rate')
    if (carnetRateEl) carnetRateEl.textContent = scans.length ? `${((carnetN/scans.length)*100).toFixed(1)}% delle scansioni` : ''

    // ── Scansioni e costi AI: per tipo, per piano, per utente, per giorno ──
    await _renderCostStats(scans, from, to)

    // ── Grafici ────────────────────────────────────────────────
    _renderDailyBars(scans, from, to)
    _renderTipoDonut(scans)

    // ── Top bottiglie / maison per scansioni ──────────────────
    const bottCounts = {}, bottNames = {}
    const maisonScanCounts = {}, maisonScanNames = {}
    scans.forEach(s => {
      if (s.matched_bottle_id) {
        bottCounts[s.matched_bottle_id] = (bottCounts[s.matched_bottle_id]||0) + 1
        if (s.bottiglie?.nome) bottNames[s.matched_bottle_id] = s.bottiglie.nome
        const mId = s.bottiglie?.maison_id
        if (mId) {
          maisonScanCounts[mId] = (maisonScanCounts[mId]||0) + 1
          if (s.bottiglie?.maison?.nome) maisonScanNames[mId] = s.bottiglie.maison.nome
        }
      }
    })
    _renderTopList('stats-top-bottiglie', _topFromCounts(bottCounts, bottNames), 'Nessuna scansione riconosciuta nel periodo')
    _renderTopList('stats-top-maison-scan', _topFromCounts(maisonScanCounts, maisonScanNames), 'Nessuna scansione riconosciuta nel periodo')

    // ── Top maison preferite / top bottiglie in wishlist ──────
    const [{ data: favPeriod }, { data: wishPeriod }] = await Promise.all([
      dateFilter(supa.from('favorites').select('maison_id,created_at,maison:maison_id(nome)')).limit(5000),
      dateFilter(supa.from('wishlist').select('bottiglia_id,created_at,bottiglie:bottiglia_id(nome)')).limit(5000),
    ])
    const favCounts = {}, favNames = {}
    ;(favPeriod||[]).forEach(f => { favCounts[f.maison_id] = (favCounts[f.maison_id]||0)+1; if (f.maison?.nome) favNames[f.maison_id] = f.maison.nome })
    _renderTopList('stats-top-maison-fav', _topFromCounts(favCounts, favNames), 'Nessun preferito salvato nel periodo')

    const wishCounts = {}, wishNames = {}
    ;(wishPeriod||[]).forEach(w => { wishCounts[w.bottiglia_id] = (wishCounts[w.bottiglia_id]||0)+1; if (w.bottiglie?.nome) wishNames[w.bottiglia_id] = w.bottiglie.nome })
    _renderTopList('stats-top-wishlist', _topFromCounts(wishCounts, wishNames), 'Nessuna bottiglia salvata in wishlist nel periodo')

  } catch(e) { console.error('Stats:', e) }
}

// ══════════════════════════════════════════════════════
// HELPERS
// ══════════════════════════════════════════════════════
function loadingRow(cols) {
  return `<tr><td colspan="${cols}" class="adm-loading"><i class="ti ti-loader-2 spin"></i> Caricamento...</td></tr>`
}

function errorRow(cols, msg) {
  return `<tr><td colspan="${cols}" style="padding:16px 18px;color:var(--red);font-size:12px;font-family:var(--mono)">${esc(msg)}</td></tr>`
}

function loadingHTML() {
  return '<div class="adm-ud-loading"><i class="ti ti-loader-2 spin" style="font-size:28px;color:var(--gold)"></i></div>'
}

function errorHTML(msg) {
  return `<div style="padding:24px;color:var(--red);font-family:var(--mono);font-size:12px">${esc(msg)}</div>`
}

function renderPagination(containerId, currentPage, totalPages, callbackFnName) {
  const el = document.getElementById(containerId)
  if (!el) return
  if (totalPages <= 1) { el.innerHTML = ''; return }
  let html = `<button class="adm-page-btn" ${currentPage===1?'disabled':''} onclick="${callbackFnName}(${currentPage-1})"><i class="ti ti-chevron-left"></i></button>`
  const pages = []
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i)
  } else {
    pages.push(1)
    if (currentPage > 3) pages.push('…')
    for (let i = Math.max(2, currentPage-1); i <= Math.min(totalPages-1, currentPage+1); i++) pages.push(i)
    if (currentPage < totalPages - 2) pages.push('…')
    pages.push(totalPages)
  }
  pages.forEach(p => {
    if (p === '…') html += `<span class="adm-page-dots">…</span>`
    else html += `<button class="adm-page-btn ${p===currentPage?'active':''}" onclick="${callbackFnName}(${p})">${p}</button>`
  })
  html += `<button class="adm-page-btn" ${currentPage===totalPages?'disabled':''} onclick="${callbackFnName}(${currentPage+1})"><i class="ti ti-chevron-right"></i></button>`
  el.innerHTML = html
}
