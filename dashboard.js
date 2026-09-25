/* Eén weergave voor lokale API's en de statische momentopname. Geen orders. */
'use strict';
(function () {
  const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const numeric = value => value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value));
  const number = (value, digits = 2) => numeric(value) ? Number(value).toLocaleString('nl-NL', {maximumFractionDigits: digits, minimumFractionDigits: digits}) : '—';
  const money = value => numeric(value) ? '€ ' + number(value) : '—';
  const dollars = value => numeric(value) ? '$ ' + number(value, Number(value) > 1 ? 2 : 8) : '—';
  const pct = value => numeric(value) ? (Number(value) >= 0 ? '+' : '') + number(value) + '%' : '—';
  const direction = value => numeric(value) ? (Number(value) >= 0 ? 'up' : 'down') : '';
  function riskClass(risk) {
    const text = String(risk || '').toLowerCase();
    if (text.includes('rug') || text.includes('zeer')) return 'rug';
    if (text.includes('verhoogd') || text.includes('iets') || text.includes('beweeglijk')) return 'mid';
    if (text.includes('ok-niveau') || text.includes('rustig')) return 'ok';
    return 'unknown';
  }
  const riskTag = risk => `<span class="tag ${riskClass(risk)}">${escapeHTML(risk || 'risico onbekend')}</span>`;
  function chartURL(raw, embed = false) {
    try {
      const input = new URL(raw);
      if (input.protocol !== 'https:' || input.hostname !== 'dexscreener.com' || input.port || input.username || input.password || !/^\/[a-z0-9-]+\/[a-zA-Z0-9_-]+\/?$/.test(input.pathname)) return null;
      const url = new URL(input.pathname, 'https://dexscreener.com');
      if (embed) url.search = new URLSearchParams({embed:'1', theme:'dark', trades:'0', info:'0', chartLeftToolbar:'0', chartDefaultView:'price', chartType:'usd'}).toString();
      return url.href;
    } catch (_) { return null; }
  }
  function radarPosition(score, index) {
    const radius = 37 - Math.min(100, Math.max(0, Number(score) || 0)) * .25;
    const angle = (index * 137.508 - 60) * Math.PI / 180;
    return {x: 50 + Math.cos(angle) * radius, y: 50 + Math.sin(angle) * radius};
  }
  // Kleine pure helpers zijn ook zonder browser toetsbaar.
  if (typeof module !== 'undefined' && module.exports) module.exports = {escapeHTML, chartURL, radarPosition, riskClass, numeric};
  if (typeof document === 'undefined') return;
  const $ = id => document.getElementById(id);
  const live = document.body.dataset.mode === 'live';
  let candidates = [], watchlist = [], selected = null, activeURL, loading = false;
  let paused = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const identity = item => item ? [item.url || '', item.chain || '', item.symbol || ''].join('|') : '';
  const table = (headers, rows) => `<div class="table-wrap"><table><thead><tr>${headers.map(h => `<th scope="col">${h}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table></div>`;
  function updateMotion() {
    $('scope').classList.toggle('paused', paused || document.hidden);
    $('motion').setAttribute('aria-pressed', String(paused));
    $('motion').textContent = paused ? 'Animatie hervatten' : 'Animatie pauzeren';
    $('motion').disabled = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if ($('motion').disabled) $('motion').textContent = 'Beweging beperkt';
  }
  $('motion').addEventListener('click', () => { paused = !paused; updateMotion(); });
  document.addEventListener('visibilitychange', updateMotion);
  window.matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', event => { paused = event.matches; updateMotion(); });
  updateMotion();
  function renderChart(item) {
    const url = chartURL(item && item.url);
    $('chart-title').textContent = item ? `${item.symbol || 'Token'} — koersgrafiek` : 'Interactieve koersgrafiek';
    $('chart-external').hidden = !url;
    if (url) $('chart-external').href = url;
    else $('chart-external').removeAttribute('href');
    $('chart-note').textContent = url ? 'Externe marktdata · USD · de koersgrafiek kan actueler zijn dan de radargegevens.' : 'Voor dit signaal is geen betrouwbare DexScreener-paarlink beschikbaar.';
    if (activeURL === url && $('chart-host').childElementCount) return;
    activeURL = url;
    $('chart-host').replaceChildren();
    if (!url) {
      const message = document.createElement('p'); message.className = 'chart-empty';
      message.textContent = item ? 'Geen koershistorie beschikbaar voor deze kandidaat.' : 'Selecteer een kandidaat met een koersgrafiek.';
      $('chart-host').append(message); return;
    }
    const iframe = document.createElement('iframe');
    iframe.title = `Interactieve DexScreener-koersgrafiek van ${item.symbol || 'token'}`;
    iframe.loading = 'eager'; iframe.referrerPolicy = 'strict-origin-when-cross-origin';
    iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-popups');
    const loader = document.createElement('p'); loader.className = 'chart-loading';
    loader.textContent = 'Externe koersgrafiek laden… Je kunt de grafiek ook rechtstreeks in DexScreener openen.';
    iframe.addEventListener('load', () => { loader.hidden = true; });
    iframe.src = chartURL(url, true); $('chart-host').append(iframe, loader);
  }
  function select(item) {
    selected = item;
    $('selected-title').textContent = item ? item.symbol || 'Onbekend token' : 'Geen kandidaat geselecteerd';
    $('selected-chain').textContent = item ? item.chain || 'netwerk onbekend' : '—';
    if (item) {
      $('selected').innerHTML = `<div class="score-row"><div><div class="score-value">${number(item.score, 1)}<small> / 100</small></div><p class="score-caption">Aandacht + momentum + liquiditeit</p></div>${riskTag(item.risk)}</div><dl class="metrics"><div><dt>Koers (USD)</dt><dd>${dollars(item.price_usd)}</dd></div><div><dt>Verandering · 24 uur</dt><dd class="${direction(item.change_h24)}">${pct(item.change_h24)}</dd></div><div><dt>Liquiditeit</dt><dd>$ ${number(item.liquidity_usd, 0)}</dd></div><div><dt>Volume · 24 uur</dt><dd>$ ${number(item.volume_h24, 0)}</dd></div></dl><p class="source-counts">X-menties: ${number(item.x_count, 0)} · Nieuwsberichten: ${number(item.news, 0)}</p>`;
    } else $('selected').innerHTML = '<p class="muted">Er zijn nog geen signalen beschikbaar. Ontbrekende gegevens worden niet aangevuld met voorbeeldkoersen.</p>';
    document.querySelectorAll('[data-signal-key]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.signalKey === identity(item))));
    renderChart(item);
  }
  function renderRadar(data) {
    candidates = Array.isArray(data.kandidaten) ? data.kandidaten.filter(item => item && typeof item === 'object') : [];
    $('candidate-count').textContent = `${candidates.length} kandidaten`;
    $('scope-message').hidden = candidates.length > 0;
    $('scope-message').textContent = data.melding || 'Geen kandidaten gevonden.';
    $('blips').replaceChildren();
    candidates.forEach((item, index) => {
      const point = radarPosition(item.score, index), button = document.createElement('button');
      button.className = `blip ${riskClass(item.risk)}`; button.style.left = `${point.x}%`; button.style.top = `${point.y}%`;
      button.dataset.signalKey = identity(item); button.setAttribute('aria-pressed', 'false');
      button.setAttribute('aria-label', `${item.symbol || 'Token'}, score ${number(item.score, 1)}, ${item.risk || 'risico onbekend'}`);
      const label = document.createElement('span'); label.className = 'blip-label'; label.textContent = item.symbol || 'Token';
      button.append(label); button.addEventListener('click', () => select(item)); $('blips').append(button);
    });
    $('radar').innerHTML = candidates.length ? candidates.map((item, index) => `<button class="candidate" data-candidate="${index}" data-signal-key="${escapeHTML(identity(item))}" aria-pressed="false"><span><strong>${escapeHTML(item.symbol)}</strong> <span class="muted">${escapeHTML(item.chain)}</span><small class="${riskClass(item.risk)}">${escapeHTML(item.risk || 'risico onbekend')}</small><small>24u <span class="${direction(item.change_h24)}">${pct(item.change_h24)}</span> · liq $ ${number(item.liquidity_usd, 0)}</small></span><span class="candidate-score">${number(item.score, 1)}</span></button>`).join('') : `<p class="muted">${escapeHTML(data.melding || 'Geen kandidaten gevonden.')}</p>`;
    $('radar').querySelectorAll('[data-candidate]').forEach(button => button.addEventListener('click', () => select(candidates[Number(button.dataset.candidate)])));
    const existing = [...candidates, ...watchlist].find(item => identity(item) === identity(selected));
    select(existing || candidates[0] || watchlist[0] || null);
  }
  function renderPortfolio(pf) {
    const metrics = [['Waarde',money(pf.equity_eur)],['Rendement',pct(pf.rendement_pct),direction(pf.rendement_pct)],['Kas',money(pf.cash_eur)],['Trades',number(pf.trades,0)],['Fees betaald',money(pf.fees_paid_eur)]];
    $('pf').innerHTML = `<div class="kpis">${metrics.map(([label,value,color]) => `<div class="kpi"><span>${label}</span><b class="${color || ''}">${value}</b></div>`).join('')}</div>`;
    const positions = Array.isArray(pf.posities) ? pf.posities : [];
    $('pf').innerHTML += positions.length ? table(['Symbool','Aantal','Instap','P&L','Reden'], positions.map(p => `<tr><td><b>${escapeHTML(p.symbol)}</b></td><td>${number(p.qty, 8)}</td><td>€ ${number(p.entry, 8)}</td><td class="${direction(p.pnl_pct)}">${pct(p.pnl_pct)}</td><td>${escapeHTML(p.note)}</td></tr>`)) : '<p class="note">Geen open papieren posities.</p>';
  }
  function renderStocks(data) {
    const items = Array.isArray(data.aandelen) ? data.aandelen : [];
    $('stocks').innerHTML = items.length ? table(['Ticker','Score','Koers','Dag','Mom. 20d','RSI','Risico'], items.map(a => `<tr><td><b>${escapeHTML(a.symbol)}</b> <span class="muted">${escapeHTML(a.name)}</span></td><td>${number(a.score,1)}</td><td>${number(a.price)} ${escapeHTML(a.currency)}</td><td class="${direction(a.change_pct)}">${pct(a.change_pct)}</td><td class="${direction(a.momentum_pct)}">${pct(a.momentum_pct)}</td><td>${number(a.rsi,1)}</td><td>${riskTag(a.risk)}</td></tr>`)) : `<p class="muted">${escapeHTML(data.melding || 'Geen aandelengegevens beschikbaar.')}</p>`;
  }
  function renderWatchlist(data) {
    watchlist = Array.isArray(data.items) ? data.items.filter(item => item && typeof item === 'object') : [];
    $('wl').innerHTML = watchlist.length ? table(['Token','Score','24u','Risico','Koersgrafiek'], watchlist.map((item, index) => `<tr><td><b>${escapeHTML(item.symbol)}</b></td><td>${number(item.score,1)}</td><td class="${direction(item.change_h24)}">${pct(item.change_h24)}</td><td>${riskTag(item.risk)}</td><td><button class="token-button" data-watch="${index}" data-signal-key="${escapeHTML(identity(item))}" aria-pressed="false">Bekijk ${escapeHTML(item.symbol)}</button></td></tr>`)) : '<p class="muted">Watchlist is leeg.</p>';
    $('wl').querySelectorAll('[data-watch]').forEach(button => button.addEventListener('click', () => { select(watchlist[Number(button.dataset.watch)]); $('chart-title').scrollIntoView({block:'start'}); }));
    if (!selected && watchlist.length) select(watchlist[0]);
    else if (selected) select(watchlist.find(item => identity(item) === identity(selected)) || selected);
  }
  async function getJSON(url) {
    const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 90000);
    try {
      const response = await fetch(url, {cache:'no-store', signal:controller.signal});
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      if (!data || typeof data !== 'object' || data.error) throw new Error('Geen geldige gegevens');
      return data;
    } finally { clearTimeout(timer); }
  }
  const blocks = [['portfolio','pf',renderPortfolio],['radar','radar',renderRadar],['stocks','stocks',renderStocks],['watchlist','wl',renderWatchlist]];
  function blockError(name, id) {
    if (name === 'radar') renderRadar({kandidaten:[], melding:'Radar tijdelijk niet beschikbaar. Probeer later opnieuw.'});
    else if (name === 'watchlist') { watchlist = []; if (!candidates.length) select(null); }
    $(id).innerHTML = '<p class="error">Gegevens konden niet worden geladen. Probeer later opnieuw.</p>';
  }
  async function load() {
    if (loading) return;
    loading = true; $('refresh').disabled = true;
    if (live) {
      const outcomes = await Promise.allSettled(blocks.map(async ([name,id,render]) => {
        try { render(await getJSON(`/api/${name}`)); }
        catch (error) { blockError(name,id); throw error; }
      }));
      const failed = outcomes.filter(result => result.status === 'rejected').length;
      $('stamp').textContent = `${failed ? 'Deels geladen' : 'Opgehaald'} ${new Date().toLocaleTimeString('nl-NL', {hour:'2-digit', minute:'2-digit'})} · broncache max. 5 min`;
    } else {
      try {
        const data = await getJSON('demo-data.json');
        $('stamp').textContent = `Momentopname: ${data.generated_at || 'datum onbekend'}`;
        for (const [name,id,render] of blocks) {
          try { if (!data[name] || typeof data[name] !== 'object') throw new Error('Blok ontbreekt'); render(data[name]); }
          catch (_) { blockError(name,id); }
        }
      } catch (_) { blocks.forEach(([name,id]) => blockError(name,id)); $('stamp').textContent = 'Momentopname niet beschikbaar'; }
    }
    loading = false; $('refresh').disabled = false;
  }
  if (live) {
    $('mode-badge').textContent = 'Lokaal dashboard'; $('refresh').hidden = false;
    $('data-note').textContent = 'Geen financieel advies, alles op papier. Gegevens worden lokaal opgehaald; bronnen kunnen vertraagd of tijdelijk onbereikbaar zijn.';
    $('refresh').addEventListener('click', load);
    setInterval(() => { if (!document.hidden) load(); }, 60000);
  } else $('data-note').textContent = 'Geen financieel advies, alles op papier. Radar en portefeuille zijn een opgeslagen momentopname. De externe koersgrafiek haalt apart marktdata op.';
  load();
})();
