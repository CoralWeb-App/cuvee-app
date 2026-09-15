import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'

// Pagina pubblica per i link generati dal pulsante "Condividi" dell'app
// (nota di degustazione, bottiglia, maison). Nessuna autenticazione: chi
// riceve il link non ha un account Cuvée. Il contenuto viene letto con la
// service role (l'anon key non ha accesso in lettura a queste tabelle,
// per disegno — vedi le policy RLS) e SOLO i campi qui sotto vengono
// esposti: mai user_id, prezzo_pagato, luogo, sboccatura o altri dati
// privati della nota.

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
}

const APP_STORE_URL = 'https://apps.apple.com/it/app/cuv%C3%A9e/id6806301961'
const LANDING_URL    = 'https://cuvee-champagne.coralweb.it/'
const OG_IMAGE_FALLBACK = 'https://cuvee-champagne.coralweb.it/og-image.jpg'

const esc = (s: unknown) => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')

const html = (body: string, status = 200) =>
  new Response(body, { status, headers: { ...cors, 'Content-Type': 'text/html; charset=utf-8' } })

// ── Shell HTML comune — stesso linguaggio visivo della landing (fondo
//    ink, oro, Cormorant Garamond + DM Sans) — con i tag Open Graph
//    valorizzati per riga così le app di messaggistica mostrano
//    un'anteprima vera (foto, titolo) invece del link nudo. ──
function pageShell(opts: {
  title: string
  description: string
  image: string | null
  canonicalUrl: string
  bodyHtml: string
}) {
  const image = opts.image || OG_IMAGE_FALLBACK
  return `<!DOCTYPE html>
<html lang="it">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(opts.title)}</title>
<meta name="description" content="${esc(opts.description)}">
<meta name="robots" content="noindex, follow">
<link rel="canonical" href="${esc(opts.canonicalUrl)}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Cuvée">
<meta property="og:title" content="${esc(opts.title)}">
<meta property="og:description" content="${esc(opts.description)}">
<meta property="og:image" content="${esc(image)}">
<meta property="og:url" content="${esc(opts.canonicalUrl)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(opts.title)}">
<meta name="twitter:description" content="${esc(opts.description)}">
<meta name="twitter:image" content="${esc(image)}">
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 56 72'%3E%3Crect width='56' height='72' fill='%231e1208' rx='12'/%3E%3Cpath d='M20,9 C17,12 15,16 15,20 C15,25 17,29 19,33 C22,38 25,43 28,47 C31,43 34,38 37,33 C39,29 41,25 41,20 C41,16 39,12 36,9' stroke='%23d4a83c' stroke-width='2.4' fill='none' stroke-linejoin='round'/%3E%3Cline x1='20' y1='9' x2='36' y2='9' stroke='%23d4a83c' stroke-width='2.4' stroke-opacity='.55'/%3E%3Cline x1='28' y1='47' x2='28' y2='60' stroke='%23d4a83c' stroke-width='2.4'/%3E%3Cline x1='18' y1='60' x2='38' y2='60' stroke='%23d4a83c' stroke-width='2.4' stroke-linecap='round'/%3E%3C/svg%3E">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,500&family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
:root{
  --ink:#1e1208; --ivory:#faf8f5; --gold:#b8922a; --gold-bright:#e0b34a; --gold-deep:#8a6a1e;
  --gold-pale:#f5efe4; --gold-border:#e3d3a4; --text-on-dark-soft:#cdbb96;
  --serif:'Cormorant Garamond',Georgia,serif; --sans:'DM Sans',-apple-system,sans-serif;
}
*{box-sizing:border-box;}
body{
  margin:0;min-height:100dvh;background:radial-gradient(ellipse 120% 80% at 50% -10%, #3a2914 0%, var(--ink) 55%);
  font-family:var(--sans);color:var(--ivory);display:flex;flex-direction:column;align-items:center;
  padding:32px 20px 40px;-webkit-font-smoothing:antialiased;
}
.logo{display:flex;align-items:center;gap:8px;font-family:var(--serif);font-size:19px;letter-spacing:2px;color:#fff;margin-bottom:28px;}
.logo svg{width:13px;height:17px;}
.card{
  width:100%;max-width:380px;background:var(--ivory);border-radius:26px;overflow:hidden;
  box-shadow:0 30px 70px -20px rgba(0,0,0,.5);
}
.card-photo{width:100%;aspect-ratio:2/3;background:linear-gradient(150deg,#F8F2E6 0%,#EBD9B8 100%);position:relative;}
.card-photo img{width:100%;height:100%;object-fit:cover;display:block;}
.card-photo .ph{width:100%;height:100%;display:flex;align-items:center;justify-content:center;}
.card-photo .ph svg{width:44px;height:44px;opacity:.3;}
.card-body{padding:22px 22px 26px;}
.eyebrow{font-family:var(--sans);font-size:11px;font-weight:700;letter-spacing:.6px;text-transform:uppercase;color:var(--gold-deep);margin-bottom:4px;}
.title{font-family:var(--serif);font-size:26px;font-weight:600;color:var(--ink);line-height:1.15;margin-bottom:12px;text-wrap:balance;}
.pills{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:16px;}
.pill{background:var(--gold-pale);border:1px solid var(--gold-border);border-radius:20px;padding:4px 11px;font-size:12px;font-weight:600;color:var(--gold-deep);}
.note{font-size:14px;line-height:1.7;color:#4a3c26;margin-bottom:4px;}
.cta-wrap{width:100%;max-width:380px;margin-top:22px;}
.cta{
  display:flex;align-items:center;justify-content:center;gap:10px;width:100%;
  background:var(--gold-bright);color:var(--ink);text-decoration:none;
  font-family:var(--sans);font-size:15px;font-weight:700;padding:15px 20px;border-radius:14px;
}
.sub-link{display:block;text-align:center;margin-top:14px;font-size:12.5px;color:var(--text-on-dark-soft);text-decoration:none;}
.foot{margin-top:30px;font-size:11.5px;color:#6b5c42;text-align:center;}
</style>
</head>
<body>
  <div class="logo">
    <svg viewBox="0 0 56 72" fill="none"><path d="M20,9 C17,12 15,16 15,20 C15,25 17,29 19,33 C22,38 25,43 28,47 C31,43 34,38 37,33 C39,29 41,25 41,20 C41,16 39,12 36,9" stroke="#e0b34a" stroke-width="2.6" stroke-linejoin="round"/><line x1="20" y1="9" x2="36" y2="9" stroke="#e0b34a" stroke-width="2.6" stroke-opacity=".55"/><line x1="28" y1="47" x2="28" y2="60" stroke="#e0b34a" stroke-width="2.6"/><line x1="18" y1="60" x2="38" y2="60" stroke="#e0b34a" stroke-width="2.6" stroke-linecap="round"/></svg>
    CUVÉE
  </div>
  ${opts.bodyHtml}
  <div class="foot">L'app italiana per riconoscere, scoprire e degustare Champagne</div>
</body>
</html>`
}

function notFoundPage(canonicalUrl: string) {
  return pageShell({
    title: 'Contenuto non più disponibile — Cuvée',
    description: 'Questo link di condivisione non è più valido.',
    image: null,
    canonicalUrl,
    bodyHtml: `
    <div class="card">
      <div class="card-body" style="padding-top:26px;">
        <div class="title" style="margin-bottom:10px;">Questo link non è più valido</div>
        <div class="note">Chi l'ha condiviso potrebbe aver smesso di condividerlo, oppure sono passati più di 30 giorni. Scarica Cuvée per scoprire tante altre bottiglie ed etichette.</div>
      </div>
    </div>
    <div class="cta-wrap">
      <a class="cta" href="${esc(APP_STORE_URL)}">Scarica Cuvée</a>
      <a class="sub-link" href="${esc(LANDING_URL)}">Scopri di più su Cuvée</a>
    </div>`,
  })
}

const bottleIcon = '<svg viewBox="0 0 512 512" fill="rgba(184,146,42,.4)"><path fill-rule="evenodd" clip-rule="evenodd" d="M217.6,0 L294.4,0 L294.4,76.8 C294.4,256 371.2,217.6 371.2,396.8 L371.2,512 L140.8,512 L140.8,396.8 C140.8,217.6 217.6,256 217.6,76.8 Z M335.057,240.943 L256,320 L176.943,240.943 L176.943,258.943 L256,338 L335.057,258.943 Z M204.8,396.8 L307.2,396.8 L307.2,435.2 L204.8,435.2 Z"/></svg>'

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  const url = new URL(req.url)
  const type = url.searchParams.get('type')
  const canonicalUrl = req.url

  try {
    const SUPA_URL     = Deno.env.get('SUPABASE_URL')!
    const SUPA_SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const adminSupa = createClient(SUPA_URL, SUPA_SERVICE)

    // ═══ NOTA DI DEGUSTAZIONE (privata, richiede token attivo e non scaduto) ═══
    if (type === 'nota') {
      const token = url.searchParams.get('token')
      if (!token) return html(notFoundPage(canonicalUrl), 404)

      const { data: note } = await adminSupa
        .from('carnet_notes')
        .select('maison_nome, cuvee_nome, annata, dosage_testo, rating, colore, evoluzione, aromi, note_libere, foto_urls, foto_url, tipo, share_until')
        .eq('share_token', token)
        .maybeSingle()

      if (!note || !note.share_until || new Date(note.share_until as string) < new Date()) {
        return html(notFoundPage(canonicalUrl), 404)
      }

      const photo = (Array.isArray(note.foto_urls) && note.foto_urls[0]) || note.foto_url || null
      const titleTxt = [note.maison_nome, note.cuvee_nome].filter(Boolean).join(' — ') || 'Una degustazione su Cuvée'
      const glasses = '🥂'.repeat(Math.min((note.rating as number) || 0, 5)) + ((note.rating as number) >= 6 ? ' ❤️' : '')

      const pills: string[] = []
      if (note.annata) pills.push(String(note.annata))
      if (note.dosage_testo) pills.push(String(note.dosage_testo))
      if (Array.isArray(note.tipo)) pills.push(...(note.tipo as string[]))

      const bodyHtml = `
      <div class="card">
        <div class="card-photo">${photo ? `<img src="${esc(photo)}">` : `<div class="ph">${bottleIcon}</div>`}</div>
        <div class="card-body">
          <div class="eyebrow">Degustazione condivisa</div>
          <div class="title">${esc(titleTxt)}</div>
          ${glasses ? `<div style="font-size:18px;margin-bottom:14px;">${glasses}</div>` : ''}
          ${pills.length ? `<div class="pills">${pills.map(p => `<span class="pill">${esc(p)}</span>`).join('')}</div>` : ''}
          ${note.note_libere ? `<div class="note">&ldquo;${esc(String(note.note_libere).slice(0,220))}${String(note.note_libere).length > 220 ? '…' : ''}&rdquo;</div>` : ''}
        </div>
      </div>
      <div class="cta-wrap">
        <a class="cta" href="${esc(APP_STORE_URL)}">Scarica Cuvée per vedere tutto</a>
        <a class="sub-link" href="${esc(LANDING_URL)}">Scopri di più su Cuvée</a>
      </div>`

      return html(pageShell({
        title: titleTxt + ' — Cuvée',
        description: 'Una degustazione condivisa su Cuvée, l\'app italiana per lo Champagne.',
        image: photo,
        canonicalUrl,
        bodyHtml,
      }))
    }

    // ═══ BOTTIGLIA (catalogo pubblico, nessun token: basta l'id) ═══
    if (type === 'bottiglia') {
      const id = url.searchParams.get('id')
      if (!id) return html(notFoundPage(canonicalUrl), 404)

      const { data: b } = await adminSupa
        .from('bottiglie')
        .select('nome, annata, is_millesimato, tipo, dosaggio_tipo, dosaggio_gl, foto_url, score_medio, note_degustazione, prezzo_min, prezzo_max, maison(nome)')
        .eq('id', id)
        .eq('is_published', true)
        .eq('needs_review', false)
        .maybeSingle()

      if (!b) return html(notFoundPage(canonicalUrl), 404)

      const maisonNome = (b.maison as { nome?: string } | null)?.nome || null
      const titleTxt = [maisonNome, b.nome].filter(Boolean).join(' — ')

      const pills: string[] = []
      pills.push(b.is_millesimato ? 'Millesimato' : 'Sans Année')
      if (b.annata) pills.push(String(b.annata))
      if (b.dosaggio_tipo) pills.push(String(b.dosaggio_tipo))

      const bodyHtml = `
      <div class="card">
        <div class="card-photo">${b.foto_url ? `<img src="${esc(b.foto_url)}">` : `<div class="ph">${bottleIcon}</div>`}</div>
        <div class="card-body">
          <div class="eyebrow">${esc(maisonNome || 'Champagne')}</div>
          <div class="title">${esc(b.nome)}</div>
          <div class="pills">${pills.map(p => `<span class="pill">${esc(p)}</span>`).join('')}${b.score_medio ? `<span class="pill">★ ${esc(b.score_medio)}/100</span>` : ''}</div>
          ${b.note_degustazione ? `<div class="note">${esc(String(b.note_degustazione).slice(0,220))}${String(b.note_degustazione).length > 220 ? '…' : ''}</div>` : ''}
        </div>
      </div>
      <div class="cta-wrap">
        <a class="cta" href="${esc(APP_STORE_URL)}">Scopri questa bottiglia su Cuvée</a>
        <a class="sub-link" href="${esc(LANDING_URL)}">Scopri di più su Cuvée</a>
      </div>`

      return html(pageShell({
        title: titleTxt + ' — Cuvée',
        description: (b.note_degustazione as string) || ('Scopri ' + titleTxt + ' su Cuvée, l\'app italiana per lo Champagne.'),
        image: b.foto_url as string | null,
        canonicalUrl,
        bodyHtml,
      }))
    }

    // ═══ MAISON (catalogo pubblico, nessun token: basta l'id) ═══
    if (type === 'maison') {
      const id = url.searchParams.get('id')
      if (!id) return html(notFoundPage(canonicalUrl), 404)

      const { data: m } = await adminSupa
        .from('maison')
        .select('nome, sede_comune, anno_fondazione, tipo, descrizione, foto_url')
        .eq('id', id)
        .eq('is_published', true)
        .eq('needs_review', false)
        .maybeSingle()

      if (!m) return html(notFoundPage(canonicalUrl), 404)

      const pills: string[] = []
      if (m.sede_comune) pills.push(String(m.sede_comune))
      if (m.anno_fondazione) pills.push('dal ' + m.anno_fondazione)

      const bodyHtml = `
      <div class="card">
        <div class="card-photo">${m.foto_url ? `<img src="${esc(m.foto_url)}">` : `<div class="ph">${bottleIcon}</div>`}</div>
        <div class="card-body">
          <div class="eyebrow">Maison Champagne</div>
          <div class="title">${esc(m.nome)}</div>
          ${pills.length ? `<div class="pills">${pills.map(p => `<span class="pill">${esc(p)}</span>`).join('')}</div>` : ''}
          ${m.descrizione ? `<div class="note">${esc(String(m.descrizione).slice(0,220))}${String(m.descrizione).length > 220 ? '…' : ''}</div>` : ''}
        </div>
      </div>
      <div class="cta-wrap">
        <a class="cta" href="${esc(APP_STORE_URL)}">Scopri questa Maison su Cuvée</a>
        <a class="sub-link" href="${esc(LANDING_URL)}">Scopri di più su Cuvée</a>
      </div>`

      return html(pageShell({
        title: m.nome + ' — Cuvée',
        description: (m.descrizione as string) || ('Scopri ' + m.nome + ' su Cuvée, l\'app italiana per lo Champagne.'),
        image: m.foto_url as string | null,
        canonicalUrl,
        bodyHtml,
      }))
    }

    return html(notFoundPage(canonicalUrl), 404)

  } catch (err) {
    console.error('share-view error:', err)
    return html(notFoundPage(canonicalUrl), 500)
  }
})
