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
let bottigliaSearch       = ''
let bottigliaFilter       = ''
let bottigliaStatusFilter = ''
let bottigliaSort         = 'nome'
let bottigliaLetterFilter = ''
let maisonSearch       = ''
let maisonTipoFilter   = ''
let maisonStatusFilter = ''
let maisonSort         = 'nome'
let maisonLetterFilter = ''
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

// ── SEARCH NORMALIZATION (accents) ───────────────────
// Normalizes accented chars: Moët→Moet, Bollinger→Bollinger
function norm(s) {
  return String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
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
function collectDataCols() {
  const updates = {}
  document.querySelectorAll('#modal-body [data-col]').forEach(el => {
    const col = el.dataset.col
    const val = el.value
    if (val === 'true')  { updates[col] = true;  return }
    if (val === 'false') { updates[col] = false; return }
    if (el.type === 'number') { updates[col] = val === '' ? null : parseFloat(val); return }
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

function isPremiumActive(u) {
  return u.is_premium === true && (!u.premium_until || new Date(u.premium_until) > new Date())
}

// ── NAV ───────────────────────────────────────────────
function showView(id) {
  document.querySelectorAll('.adm-view').forEach(v => v.classList.remove('active'))
  document.querySelectorAll('.adm-nav-item').forEach(n => n.classList.remove('active'))
  const view = document.getElementById('view-' + id)
  if (view) view.classList.add('active')
  const nav = document.querySelector('[data-view="' + id + '"]')
  if (nav) nav.classList.add('active')
  const titles = { dashboard:'Dashboard', approvazioni:'Coda Approvazioni',
    bottiglie:'Catalogo Champagne', maison:'Gestione Maison',
    utenti:'Utenti', abbonamenti:'Abbonamenti Premium', stats:'Statistiche' }
  const el = document.getElementById('adm-header-view')
  if (el) el.textContent = titles[id] || id

  if (id === 'dashboard')    loadDashboard()
  if (id === 'approvazioni') loadApprovazioni()
  if (id === 'bottiglie')    { bottigliaPage = 1; renderBottiglie() }
  if (id === 'maison')       { maisonSearch = ''; maisonTipoFilter = ''; maisonStatusFilter = ''; maisonSort = 'nome'; maisonLetterFilter = ''; loadMaison() }
  if (id === 'utenti')       { utentiPage = 1; utentiFilter = 'all'; utentiSearch = ''; renderUtenti() }
  if (id === 'abbonamenti')  loadAbbonamenti()
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
      { count: cScanOggi },
      { count: cScanTot },
      { count: cPremium },
    ] = await Promise.all([
      supa.from('bottiglie').select('*', { count:'exact', head:true }).eq('needs_review', false),
      supa.from('maison').select('*', { count:'exact', head:true }),
      supa.from('users').select('*', { count:'exact', head:true }),
      supa.from('bottiglie').select('*', { count:'exact', head:true }).eq('needs_review', true),
      supa.from('maison').select('*', { count:'exact', head:true }).eq('needs_review', true),
      supa.from('bottle_scans').select('*', { count:'exact', head:true }).gte('created_at', todayStart.toISOString()),
      supa.from('bottle_scans').select('*', { count:'exact', head:true }),
      supa.from('users').select('*', { count:'exact', head:true }).eq('is_premium', true),
    ])
    const cPending = (cPendingBottiglie ?? 0) + (cPendingMaison ?? 0)

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
            <div class="adm-pending-thumb"><i class="ti ti-bottle"></i></div>
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
    ] = await Promise.all([
      supa.from('bottiglie').select('*, maison:maison_id(nome)').eq('needs_review', true).order('created_at', { ascending: false }),
      supa.from('maison').select('*').eq('needs_review', true).order('created_at', { ascending: false }),
    ])
    if (errB) throw errB

    const total = (bottiglie?.length ?? 0) + (maisonPending?.length ?? 0)
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
              <div class="adm-bottle-thumb"><i class="ti ti-bottle"></i></div>
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
  } catch(e) { tbody.innerHTML = errorRow(7, e.message) }
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

    const fotoCol  = b.foto_url !== undefined ? 'foto_url' : 'photo_url'
    const fotoUrl  = b.foto_url ?? b.photo_url ?? null

    const CUSTOM = ['id','nome','maison_id','tipo','is_millesimato','dosaggio_gl','needs_review','created_at','updated_at']
    const FULL   = ['descrizione','vitigni','note','note_degustazione','photo_url']
    const TA     = ['descrizione','note','note_degustazione']

    const extraFields = buildAllColsForm(b, { skip: CUSTOM, fullRow: FULL, textareaCols: TA })

    const html = `
      <div class="adm-edit-form">
        <div class="adm-edit-grid">
          <div class="adm-form-field" style="grid-column:1/-1">
            <label class="adm-form-label">NOME BOTTIGLIA</label>
            <input class="adm-form-input" type="text" data-col="nome" value="${esc(b.nome ?? '')}">
          </div>
          <div class="adm-form-field">
            <label class="adm-form-label">MAISON</label>
            <select class="adm-form-input" data-col="maison_id">
              <option value="">— Seleziona —</option>
              ${maisonOptions}
            </select>
          </div>
          <div class="adm-form-field">
            <label class="adm-form-label">TIPO</label>
            <select class="adm-form-input" data-col="tipo">
              <option value="">—</option>
              <option value="assemblage"      ${b.tipo==='assemblage'?'selected':''}>Assemblage</option>
              <option value="blanc_de_blancs" ${b.tipo==='blanc_de_blancs'?'selected':''}>Blanc de Blancs</option>
              <option value="blanc_de_noirs"  ${b.tipo==='blanc_de_noirs'?'selected':''}>Blanc de Noirs</option>
              <option value="rose"            ${b.tipo==='rose'?'selected':''}>Rosé</option>
            </select>
          </div>
          <div class="adm-form-field">
            <label class="adm-form-label">MILLÉSIMÉ</label>
            <select class="adm-form-input" data-col="is_millesimato">
              <option value="false" ${!b.is_millesimato?'selected':''}>Sans Année (S.A.)</option>
              <option value="true"  ${b.is_millesimato?'selected':''}>Millésimé</option>
            </select>
          </div>
          <div class="adm-form-field">
            <label class="adm-form-label">DOSAGGIO (g/L)</label>
            <input class="adm-form-input" type="number" step="0.1" min="0" data-col="dosaggio_gl" value="${b.dosaggio_gl ?? ''}">
          </div>
          ${extraFields}
          ${photoPreviewField(fotoUrl, fotoCol, b.id)}
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
    // Elimina foto dallo storage (non blocca se non esiste)
    await supa.storage.from('champagne-photos').remove([`bottles/${id}.jpg`])

    const { data: deleted, error } = await supa.from('bottiglie').delete().eq('id', id).select('id')
    if (error) throw error
    if (!deleted?.length) throw new Error('Eliminazione bloccata da RLS — esegui la query SQL admin per aggiungere la policy DELETE su bottiglie')
    closeModal()
    showToast('Bottiglia e foto eliminate')
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
    let query = supa
      .from('bottiglie')
      .select('*, maison:maison_id(nome)', { count: 'exact' })
      .eq('needs_review', false)

    if (bottigliaSearch) {
      const searchNorm = norm(bottigliaSearch)
      // Cerca anche per nome maison: pre-query leggera + norm() client-side (accent-insensitive)
      const { data: allMaisonSearch } = await supa.from('maison').select('id, nome')
      const maisonIds = (allMaisonSearch || [])
        .filter(m => norm(m.nome ?? '').includes(searchNorm))
        .map(m => m.id)
      if (maisonIds.length > 0) {
        // OR: nome bottiglia oppure maison corrispondente
        query = query.or(`nome_norm.ilike.%${searchNorm}%,maison_id.in.(${maisonIds.join(',')})`)
      } else {
        query = query.ilike('nome_norm', `%${searchNorm}%`)
      }
    }
    if (bottigliaFilter === 'millesimato') query = query.eq('is_millesimato', true)
    else if (bottigliaFilter)              query = query.eq('tipo', bottigliaFilter)
    if (bottigliaStatusFilter === 'online')  query = query.eq('is_published', true)
    if (bottigliaStatusFilter === 'offline') query = query.eq('is_published', false)
    if (bottigliaLetterFilter) query = query.ilike('nome_norm', `${bottigliaLetterFilter}%`)

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

    query = query.range((bottigliaPage-1)*PER_PAGE, bottigliaPage*PER_PAGE - 1)

    const { data, count, error } = await query
    if (error) throw error

    const sub = document.getElementById('bottiglie-subtitle')
    if (sub) sub.textContent = (count ?? 0).toLocaleString('it') + ' bottiglie pubblicate'

    if (!data.length) {
      tbody.innerHTML = `<tr><td colspan="8"><div style="padding:32px;text-align:center;color:var(--text-3)">Nessuna bottiglia trovata</div></td></tr>`
    } else {
      tbody.innerHTML = data.map(b => `
        <tr class="adm-table-row">
          <td>
            <div class="adm-bottle-cell">
              <div class="adm-bottle-thumb ${(b.foto_url || b.photo_url) ? 'has-img clickable' : ''}"
                   ${(b.foto_url || b.photo_url) ? `onclick="event.stopPropagation();openLightbox('${esc(b.foto_url || b.photo_url)}')"` : ''}>
                ${(b.foto_url || b.photo_url)
                  ? `<img src="${esc(b.foto_url || b.photo_url)}?t=${Date.now()}" alt="">`
                  : '<i class="ti ti-bottle"></i>'}
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
              <button class="adm-btn adm-btn-edit" onclick="editBottiglia('${b.id}')">
                <i class="ti ti-pencil"></i>
              </button>
              <button class="adm-btn adm-btn-reject" onclick="deleteBottiglia('${b.id}','${esc(b.nome ?? '')}')">
                <i class="ti ti-trash"></i>
              </button>
            </div>
          </td>
        </tr>`).join('')
    }

    renderPagination('bottiglie-pagination', bottigliaPage, Math.ceil((count??0)/PER_PAGE), 'bottiglieGoToPage')
    const fc = document.getElementById('bottiglie-footer-count')
    if (fc) fc.textContent = `Mostrando ${Math.min((bottigliaPage-1)*PER_PAGE+1, count??0)}–${Math.min(bottigliaPage*PER_PAGE, count??0)} di ${(count??0).toLocaleString('it')}`
  } catch(e) { tbody.innerHTML = errorRow(8, e.message) }
}

function bottiglieGoToPage(p) { bottigliaPage = p; renderBottiglie() }

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

async function editBottiglia(id) {
  openModal('Modifica Bottiglia', loadingHTML(), true)
  try {
    const [{ data: b, error }, { data: maisonList }] = await Promise.all([
      supa.from('bottiglie').select('*').eq('id', id).single(),
      supa.from('maison').select('id, nome').order('nome')
    ])
    if (error) throw error

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

    const html = `
      <div class="adm-edit-form">

        <!-- ═══ FOTO ═══════════════════════════════════ -->
        <div class="adm-edit-card">
          <div class="adm-edit-card-title"><i class="ti ti-photo"></i> Foto</div>
          <div class="adm-edit-card-body">
            <div class="adm-edit-grid">
              ${photoPreviewField(fotoUrl, fotoCol, b.id)}
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

async function saveBottigliaFields(id, closeAfter) {
  const updates = collectDataCols()
  try {
    const { error } = await supa.from('bottiglie').update(updates).eq('id', id)
    if (error) throw error
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
      const q = norm(maisonSearch)
      data = data.filter(m =>
        norm(m.nome ?? '').includes(q)
        || norm(m.regione ?? m.zona ?? m.region ?? '').includes(q)
      )
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

async function saveMaison(id) {
  const updates = collectDataCols()
  try {
    const { error } = await supa.from('maison').update(updates).eq('id', id)
    if (error) throw error
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
// UTENTI
// ══════════════════════════════════════════════════════
async function renderUtenti() {
  const tbody = document.getElementById('utenti-tbody')
  if (!tbody) return
  tbody.innerHTML = loadingRow(5)
  try {
    let query = supa
      .from('users')
      .select('id, email, is_premium, premium_until, is_admin, created_at', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range((utentiPage-1)*PER_PAGE, utentiPage*PER_PAGE - 1)

    if (utentiFilter === 'premium') query = query.eq('is_premium', true)
    if (utentiFilter === 'free')    query = query.eq('is_premium', false)
    if (utentiSearch) {
      const n = norm(utentiSearch)
      query = query.ilike('email', `%${utentiSearch}%`)
    }

    const { data, count, error } = await query
    if (error) throw error

    const cnt = document.getElementById('utenti-count')
    if (cnt) cnt.textContent = (count ?? 0).toLocaleString('it') + ' utenti registrati'

    const ids = data.map(u => u.id)
    const scanCounts = {}
    if (ids.length) {
      const { data: sc } = await supa.from('bottle_scans').select('user_id').in('user_id', ids)
      if (sc) sc.forEach(s => { scanCounts[s.user_id] = (scanCounts[s.user_id] || 0) + 1 })
    }

    tbody.innerHTML = data.map(u => {
      const prem = isPremiumActive(u)
      return `<tr class="adm-table-row adm-utente-row" onclick="showUserDetail('${u.id}')" style="cursor:pointer">
        <td>
          <div class="adm-user-cell">
            <div class="adm-user-avatar">${(u.email ?? '?')[0].toUpperCase()}</div>
            <div>
              <div class="adm-user-name">${esc(u.email ?? '-')}</div>
              <div class="adm-user-sub">${u.is_admin ? '⚙ Admin · ' : ''}registrato ${timeAgo(u.created_at)}</div>
            </div>
          </div>
        </td>
        <td>${prem ? '<span class="adm-badge premium"><i class="ti ti-crown"></i> PREMIUM</span>' : '<span class="adm-badge free">FREE</span>'}</td>
        <td class="adm-mono">${scanCounts[u.id] ?? 0}</td>
        <td class="adm-mono">-</td>
        <td class="adm-time-cell">${fmtDate(u.created_at)}</td>
      </tr>`
    }).join('')

    renderPagination('utenti-pagination', utentiPage, Math.ceil((count??0)/PER_PAGE), 'utentiGoToPage')
    const fc = document.getElementById('utenti-footer-count')
    if (fc) fc.textContent = `Mostrando ${Math.min((utentiPage-1)*PER_PAGE+1,count??0)}–${Math.min(utentiPage*PER_PAGE,count??0)} di ${(count??0).toLocaleString('it')}`
  } catch(e) { tbody.innerHTML = errorRow(5, e.message) }
}

function utentiGoToPage(p) { utentiPage = p; renderUtenti() }

function filterUtenti(filter, btn) {
  utentiFilter = filter
  document.querySelectorAll('#view-utenti .adm-filter').forEach(b => b.classList.remove('active'))
  btn.classList.add('active')
  utentiPage = 1; renderUtenti()
}

function searchUtenti(val) {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => { utentiSearch = val.trim(); utentiPage = 1; renderUtenti() }, 400)
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
    const [{ data: u, error }, { data: scans, count: scanCount }] = await Promise.all([
      supa.from('users').select('*').eq('id', userId).single(),
      supa.from('bottle_scans')
        .select('id, created_at, is_champagne, is_bottle, bottiglie:matched_bottle_id(nome)', { count: 'exact' })
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(5)
    ])
    if (error) throw error

    const prem = isPremiumActive(u)
    const initial = (u.email ?? '?')[0].toUpperCase()
    const displayName = u.display_name ?? u.full_name ?? u.nome ?? null

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
            <div class="adm-ud-stat-label">Scansioni</div>
          </div>
          <div class="adm-ud-stat">
            <div class="adm-ud-stat-val">-</div>
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

        <div class="adm-ud-section">
          <div class="adm-ud-section-title">ULTIME SCANSIONI</div>
          ${scans && scans.length
            ? scans.map(s => `
              <div class="adm-ud-scan">
                <div class="adm-feed-dot ${s.is_champagne ? 'gold' : 'amber'}"></div>
                <div style="flex:1;min-width:0">
                  <div style="font-size:12px;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">
                    ${esc(s.bottiglie?.nome ?? (s.is_champagne ? 'Champagne' : 'Non champagne'))}
                  </div>
                  <div style="font-size:10px;color:var(--text-3);font-family:var(--mono)">${timeAgo(s.created_at)}</div>
                </div>
              </div>`).join('')
            : '<div style="color:var(--text-3);font-size:12px;padding:4px 0">Nessuna scansione</div>'
          }
        </div>

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
  if (!until) { showToast('Seleziona una data di scadenza', 'error'); return }
  try {
    const { error } = await supa.from('users').update({
      is_premium: true,
      premium_from:  from  ? new Date(from  + 'T00:00:00').toISOString() : new Date().toISOString(),
      premium_until: new Date(until + 'T23:59:59').toISOString(),
      premium_notes: notes || null,
    }).eq('id', userId)
    if (error) throw error
    closeModal()
    showToast('Premium attivato ✓')
    showUserDetail(userId)
    renderUtenti()
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
  if (!email || !until) { showToast('Email e data di fine obbligatorie', 'error'); return }
  try {
    const { data: users, error: e1 } = await supa.from('users').select('id').eq('email', email)
    if (e1) throw e1
    if (!users.length) throw new Error(`Utente "${email}" non trovato`)
    const { error } = await supa.from('users').update({
      is_premium: true,
      premium_from:  from  ? new Date(from  + 'T00:00:00').toISOString() : new Date().toISOString(),
      premium_until: new Date(until + 'T23:59:59').toISOString(),
      premium_notes: notes || null,
    }).eq('id', users[0].id)
    if (error) throw error
    showToast(`Premium attivato per ${email} ✓`)
    document.getElementById('prem-email').value = ''
    document.getElementById('prem-notes').value = ''
    loadAbbonamenti()
  } catch(e) { showToast(e.message, 'error') }
}

async function renewPremium(userId) {
  const until = new Date(Date.now() + 365*24*60*60*1000).toISOString()
  try {
    const { error } = await supa.from('users').update({ premium_until: until }).eq('id', userId)
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
async function loadStats() {
  try {
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v ?? '-' }

    // ── Contatori base ───────────────────────────────────────────
    const [
      { count: totScans },
      { count: totBottiglie },
      { count: totUtenti },
      { count: totPremium },
    ] = await Promise.all([
      supa.from('bottle_scans').select('*', { count:'exact', head:true }),
      supa.from('bottiglie').select('*', { count:'exact', head:true }).eq('needs_review', false),
      supa.from('users').select('*', { count:'exact', head:true }),
      supa.from('users').select('*', { count:'exact', head:true }).eq('is_premium', true),
    ])

    set('stats-scans',     (totScans??0).toLocaleString('it'))
    set('stats-bottiglie', (totBottiglie??0).toLocaleString('it'))
    set('stats-utenti',    (totUtenti??0).toLocaleString('it'))
    set('stats-premium',   (totPremium??0).toLocaleString('it'))

    // ── Statistiche costi AI (via RPC aggregata) ─────────────────
    const { data: scanStats, error: rpcErr } = await supa.rpc('get_scan_stats')
    if (scanStats && !rpcErr) {
      const s = scanStats
      const haikuN   = Number(s.haiku_only_count    ?? 0)
      const sonnetN  = Number(s.sonnet_full_count    ?? 0)
      const fbN      = Number(s.haiku_fallback_count ?? 0)
      const tracked  = haikuN + sonnetN + fbN   // scansioni con tracking (esclude legacy)
      const hitRate  = tracked > 0 ? Math.round(haikuN / tracked * 100) : null
      const totalCost = Number(s.total_cost_usd ?? 0)

      set('stats-haiku-count',  haikuN.toLocaleString('it'))
      set('stats-sonnet-count', (sonnetN + fbN).toLocaleString('it'))
      set('stats-hit-rate',     hitRate !== null ? hitRate + '%' : '—')
      set('stats-total-cost',   '$' + totalCost.toFixed(4))

      // ── Breakdown dettagliato ────────────────────────────────
      const haikuCost   = Number(s.haiku_only_cost_usd     ?? 0)
      const sonnetCost  = Number(s.sonnet_full_cost_usd    ?? 0)
      const fbCost      = Number(s.haiku_fallback_cost_usd ?? 0)
      const haikuInTok  = Number(s.total_haiku_input_tokens  ?? 0)
      const haikuOutTok = Number(s.total_haiku_output_tokens ?? 0)
      const sonnetInTok = Number(s.total_sonnet_input_tokens  ?? 0)
      const sonnetOutTok= Number(s.total_sonnet_output_tokens ?? 0)
      const avgHaiku    = Number(s.avg_cost_haiku_only  ?? 0)
      const avgSonnet   = Number(s.avg_cost_sonnet_full ?? 0)

      const fmtTok = n => n >= 1_000_000
        ? (n/1_000_000).toFixed(2) + 'M'
        : n >= 1_000 ? (n/1_000).toFixed(1) + 'K' : String(n)

      const breakdownEl = document.getElementById('stats-cost-breakdown')
      if (breakdownEl) {
        const saving = tracked > 0 && (sonnetN + fbN) > 0
          ? (() => {
              // Risparmio stimato: ogni scan haiku-only ha evitato ~1 scan sonnet
              const sonnetAvgCost = avgSonnet || 0.004
              const savedUsd = haikuN * (sonnetAvgCost - avgHaiku)
              return savedUsd > 0 ? '$' + savedUsd.toFixed(4) : null
            })()
          : null

        breakdownEl.innerHTML = `
          <table style="width:100%;border-collapse:collapse;font-family:var(--mono);font-size:12px">
            <thead>
              <tr style="color:var(--text-4);border-bottom:1px solid var(--border-1)">
                <th style="text-align:left;padding:6px 8px;font-weight:600">Tipo scan</th>
                <th style="text-align:right;padding:6px 8px;font-weight:600">Conteggio</th>
                <th style="text-align:right;padding:6px 8px;font-weight:600">Token input</th>
                <th style="text-align:right;padding:6px 8px;font-weight:600">Token output</th>
                <th style="text-align:right;padding:6px 8px;font-weight:600">Costo USD</th>
                <th style="text-align:right;padding:6px 8px;font-weight:600">Costo medio</th>
              </tr>
            </thead>
            <tbody>
              <tr style="border-bottom:1px solid var(--border-1)">
                <td style="padding:8px;display:flex;align-items:center;gap:6px">
                  <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#388E3C"></span>
                  <span>Haiku — cache hit</span>
                </td>
                <td style="text-align:right;padding:8px">${haikuN.toLocaleString('it')}</td>
                <td style="text-align:right;padding:8px">${fmtTok(haikuInTok)}</td>
                <td style="text-align:right;padding:8px">${fmtTok(haikuOutTok)}</td>
                <td style="text-align:right;padding:8px">$${haikuCost.toFixed(4)}</td>
                <td style="text-align:right;padding:8px">$${avgHaiku.toFixed(5)}</td>
              </tr>
              <tr style="border-bottom:1px solid var(--border-1)">
                <td style="padding:8px;display:flex;align-items:center;gap:6px">
                  <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#1565C0"></span>
                  <span>Sonnet — full analysis</span>
                </td>
                <td style="text-align:right;padding:8px">${sonnetN.toLocaleString('it')}</td>
                <td style="text-align:right;padding:8px">${fmtTok(sonnetInTok)}</td>
                <td style="text-align:right;padding:8px">${fmtTok(sonnetOutTok)}</td>
                <td style="text-align:right;padding:8px">$${sonnetCost.toFixed(4)}</td>
                <td style="text-align:right;padding:8px">$${avgSonnet.toFixed(5)}</td>
              </tr>
              ${fbN > 0 ? `
              <tr style="border-bottom:1px solid var(--border-1)">
                <td style="padding:8px;display:flex;align-items:center;gap:6px">
                  <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#E65100"></span>
                  <span>Haiku — fallback Sonnet</span>
                </td>
                <td style="text-align:right;padding:8px">${fbN.toLocaleString('it')}</td>
                <td style="text-align:right;padding:8px">—</td>
                <td style="text-align:right;padding:8px">—</td>
                <td style="text-align:right;padding:8px">$${fbCost.toFixed(4)}</td>
                <td style="text-align:right;padding:8px">—</td>
              </tr>` : ''}
              <tr style="font-weight:600;border-top:2px solid var(--border-2)">
                <td style="padding:8px">Totale (scansioni tracciate)</td>
                <td style="text-align:right;padding:8px">${tracked.toLocaleString('it')}</td>
                <td style="text-align:right;padding:8px">${fmtTok(haikuInTok + sonnetInTok)}</td>
                <td style="text-align:right;padding:8px">${fmtTok(haikuOutTok + sonnetOutTok)}</td>
                <td style="text-align:right;padding:8px">$${totalCost.toFixed(4)}</td>
                <td style="text-align:right;padding:8px">—</td>
              </tr>
            </tbody>
          </table>
          ${saving ? `
          <div style="margin-top:12px;padding:10px 14px;background:#E8F5E9;border-radius:8px;font-family:var(--sans);font-size:12px;color:#1B5E20;display:flex;align-items:center;gap:8px">
            <i class="ti ti-pig-money" style="font-size:16px"></i>
            <span>Risparmio stimato grazie al catalogo (scan haiku al posto di Sonnet): <strong>${saving}</strong></span>
          </div>` : ''}
          ${Number(s.legacy_count ?? 0) > 0 ? `
          <div style="margin-top:8px;font-family:var(--sans);font-size:11px;color:var(--text-4)">
            * ${Number(s.legacy_count).toLocaleString('it')} scansioni precedenti non hanno dati di costo (registrate prima del tracking).
          </div>` : ''}`
      }
    } else {
      // RPC non disponibile (migration non ancora eseguita)
      const el = document.getElementById('stats-cost-breakdown')
      if (el) el.innerHTML = '<div style="padding:12px;font-family:var(--sans);font-size:12px;color:var(--text-4)"><i class="ti ti-info-circle"></i> Esegui prima la migration <code>sql_scan_tracking_migration.sql</code> per abilitare il tracking costi.</div>'
    }

    // ── Top bottiglie per scansioni ──────────────────────────────
    const { data: topScans } = await supa
      .from('bottle_scans')
      .select('matched_bottle_id, bottiglie:matched_bottle_id(nome)')
      .not('matched_bottle_id', 'is', null)
      .limit(2000)

    if (topScans) {
      const counts = {}, names = {}
      topScans.forEach(s => {
        counts[s.matched_bottle_id] = (counts[s.matched_bottle_id] || 0) + 1
        if (s.bottiglie?.nome) names[s.matched_bottle_id] = s.bottiglie.nome
      })
      const sorted = Object.entries(counts).sort((a,b) => b[1]-a[1]).slice(0, 5)
      const maxC = sorted[0]?.[1] ?? 1
      const el = document.getElementById('stats-top-bottiglie')
      if (el) {
        if (!sorted.length) { el.innerHTML = '<div class="adm-loading-block" style="color:var(--text-3)">Nessuna scansione ancora</div>'; return }
        const ranks = ['I','II','III','IV','V']
        el.innerHTML = sorted.map(([id, c], i) => `
          <div class="adm-top-item">
            <span class="adm-top-rank">${ranks[i]}</span>
            <div class="adm-top-info">
              <span class="adm-top-name">${esc(names[id] ?? id.slice(0,8))}</span>
              <div class="adm-top-bar"><div class="adm-top-fill" style="width:${Math.round(c/maxC*100)}%"></div></div>
            </div>
            <span class="adm-top-count">${c}</span>
          </div>`).join('')
      }
    }
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
