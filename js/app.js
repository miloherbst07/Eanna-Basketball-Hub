// Éanna Hub app: routing, public pages, score-sheet entry, admin, carousel.
(function(){
'use strict';
const $ = (s, r=document) => r.querySelector(s);
const $$ = (s, r=document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const CFG = window.HUB_CONFIG || {};
const pad = n => String(n).padStart(2,'0');
const isoDay = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const TODAY = isoDay(new Date());

let S = null;            // store
let DATA = null;         // fixtures json
let G = [], T = [], TB = {};
let SETTINGS = null, BOXES = {};
let AUTH = { admin:false, email:null, role:null, perms:{} };
let EDITS = [];
const can = p => AUTH.admin && (AUTH.role === 'owner' || !!(AUTH.perms||{})[p]);
const PERMS = [['sheets','Approve & edit score-sheets'],['fixtures','Edit fixtures & add games'],['rosters','Rosters & hide players'],['underage','Underage settings'],['carousel','Make carousels'],['settings','Club code & backups']];

/* ---------- helpers ---------- */
const crestMap = [['Limerick Celtics','limerick-celtics'],['Limerick Eagles','limerick-sport-eagles'],['Sligo All','sligo-all-stars'],['UCC Demons','ucc-demons'],['Killester','killester'],['St. Vincent','st-vincents'],['St Vincent','st-vincents'],['UCD Marian','ucd-marian'],['Neptune','neptune'],['Tralee','tralee-warriors'],['Belfast Star','belfast-star'],['Brunell','brunell'],['Ballincollig','ballincollig']];
const oname = o => String(o||'').replace(/\s+BC\b/,'').trim();
const initials = o => oname(o).replace(/[^A-Za-zÀ-ÿ ]/g,'').split(' ').filter(Boolean).map(w=>w[0]).join('').slice(0,2).toUpperCase() || '?';
const crest = (o, size) => { const m = crestMap.find(c => String(o).includes(c[0])); const st = size ? ` style="width:${size}px;height:${size}px"` : '';
  return m ? `<img class="cr" src="assets/${m[1]}.png" alt="${esc(oname(o))}"${st}>` : `<span class="oi"${size?` style="width:${size}px;height:${size}px;font-size:${Math.round(size/3.2)}px"`:''}>${esc(initials(o))}</span>` };
const sexOf = x => x.sex || (x.b === 'DLBB' ? 'w' : 'm');
const isSenior = name => /^(Men's|Women's)/.test(name);
const ageOf = name => { const m = String(name).match(/U(\d+)/); return m ? +m[1] : null };
const bucketOf = name => { const a = ageOf(name); if(a===null) return null; return a <= 12 ? 'u11-12' : a <= 16 ? 'u13-16' : 'u17-20' };
const modeFor = name => { const b = bucketOf(name); return b ? ((SETTINGS && SETTINGS.underage && SETTINGS.underage[b]) || 'results') : 'full' };
const visible = name => modeFor(name) !== 'hidden';
const groupOf = x => { const n = x.team || x.name; return isSenior(n) ? (sexOf(x)==='w' ? 'Senior women' : 'Senior men') : (sexOf(x)==='w' ? 'Girls' : 'Boys') };
const GROUPS = ['Senior men','Senior women','Boys','Girls'];
const fmtDate = (d, o) => new Date(d+'T12:00').toLocaleDateString('en-IE', o || { weekday:'short', day:'numeric', month:'short' });
const fmtTime = t => { if(!t) return 'TBC'; let [h,m] = t.split(':').map(Number); const ap = h>=12?'pm':'am'; h = h%12||12; return h + (m ? ':'+pad(m) : '') + ap };
const ord = n => { const s=['th','st','nd','rd'], v=n%100; return n + (s[(v-20)%10] || s[v] || s[0]) };
const gameKey = g => `${g.b}:${g.id || (g.team+'|'+(g.d||'')+'|'+g.o)}`;
const monday = d => { const x = new Date(d+'T12:00'); x.setDate(x.getDate() - ((x.getDay()+6)%7)); return isoDay(x) };
const addDays = (d, n) => { const x = new Date(d+'T12:00'); x.setDate(x.getDate()+n); return isoDay(x) };
const played = g => typeof g.us === 'number';
const boardName = { DMBB:"Dublin Men's Basketball Board", DLBB:"Dublin Ladies' Basketball Board", BI:'Basketball Ireland' };
const gameLink = g => g.b === 'BI' ? `https://ireland.basketball/${g.page}` : g.id ? `https://bi.comortais.com/match.aspx?id=${g.id}&orgId=${g.b==='DMBB'?1006:1015}` : '';
const jersey = (n, w) => `<svg class="jy" aria-hidden="true"><use href="#${w?'jsyw':'jsy'}"/><text x="20" y="33" text-anchor="middle" font-family="Anton" font-size="14" fill="#fff">${esc(n)}</text></svg>`;
const lsGet = (k, d) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d } catch(e) { return d } };
const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)) } catch(e) {} };
function toast(msg, err){ const t = $('#toast'); t.textContent = msg; t.classList.toggle('err', !!err); t.classList.add('show'); clearTimeout(t._t); t._t = setTimeout(()=>t.classList.remove('show'), 2800) }
const card = (label, inner, extra='') => `<div class="cd" ${extra}>${label?`<div class="lbl">${label}</div>`:''}${inner}</div>`;

function gameRow(g){
  const res = played(g)
    ? `<div class="sc ${g.us>g.th?'w':'l'}">${g.us}–${g.th}<small>${g.us>g.th?'WIN':'LOSS'}</small></div>`
    : g.status ? `<span class="pill ${g.status==='Cancelled'?'p-no':'p-warn'}">${esc(g.status)}</span>`
    : (g.d && g.d < TODAY ? '<span class="pill p-nv">No score</span>' : `<div class="sc" style="font-size:15px">${g.d?fmtTime(g.tm):'TBC'}<small>${g.h?'HOME':'AWAY'}</small></div>`);
  const box = BOXES[gameKey(g)] ? ' <span class="pill p-pu">Box score</span>' : '';
  return `<a class="mt" href="#game/${encodeURIComponent(gameKey(g))}"><img class="cr" src="assets/crest.png" alt="Éanna"><span class="vs">VS</span>${crest(g.o)}<div class="who"><b>${esc(g.team)}${box}</b><span>${esc(oname(g.o))}${g.k==='Cup'||g.b==='ADD'?' · '+esc(g.c):''}</span></div>${res}</a>`;
}
const rows = list => list.map(gameRow).join('');
const namesShown = team => ['full','first'].includes(modeFor(team));
const playerHref = (team, no) => `#player/${encodeURIComponent(team)}/${encodeURIComponent(no)}`;
const pname = (team, no, name) => namesShown(team) ? `<a href="${playerHref(team, no)}" style="color:inherit;text-decoration:none">${esc(name)}</a>` : esc(name);

function setHead(title, sub, back){
  $('#head').innerHTML = `${back ? `<a class="back" href="${back}" aria-label="Back">‹</a>` : `<img class="crest" src="assets/crest-dark.png" alt="Éanna Basketball">`}
    <div class="t"><h1>${esc(title)}</h1>${sub?`<small>${esc(sub)}</small>`:''}</div>${S && S.mode==='demo' ? '<span class="demo" title="Demo mode: saved in this browser only">DEMO</span>' : ''}`;
  document.title = title === 'Éanna Hub' ? 'Éanna Hub' : `${title} · Éanna Hub`;
}
const TABS = [['home','Home','M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z'],['results','Results','M4 20V10M10 20V4M16 20v-7M22 20H2'],['teams','Teams','M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zM2 12h20M12 2c3 3 3 17 0 20M12 2c-3 3-3 17 0 20'],['fixtures','Fixtures','M4 5h16v15H4zM4 10h16M9 3v4M15 3v4'],['more','More','M5 12h.01M12 12h.01M19 12h.01']];
function setTab(r){ $('#tabs').innerHTML = TABS.map(t => `<a href="#${t[0]}" class="${t[0]===r?'on':''}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="${t[2]}"/></svg><span class="t">${t[1]}</span></a>`).join('') }

/* ---------- box scores ---------- */
function topPerformers(from, to){
  const out = { m:[], w:[] };
  Object.values(BOXES).forEach(b => {
    if(!b.d || b.d < from || b.d > to) return;
    if(!['full','first'].includes(b.mode)) return;
    const best = (b.lines||[]).filter(l => l.pts > 0).sort((a,c)=>c.pts-a.pts)[0];   // top scorer from each game
    if(best) out[b.sex === 'w' ? 'w' : 'm'].push({ ...best, team:b.team, o:b.o, us:b.us, th:b.th, d:b.d, sex:b.sex });
  });
  out.m.sort((a,b)=>b.pts-a.pts); out.w.sort((a,b)=>b.pts-a.pts);
  return out;
}
function potgList(from, to){
  return Object.values(BOXES).filter(b => b.potg && b.d && b.d >= from && b.d <= to).map(b => ({ ...b.potg, team:b.team, o:b.o, d:b.d, sex:b.sex, key:b.key })).sort((a,b)=>b.d.localeCompare(a.d));
}
function currentWeek(){
  // The latest week (Mon–Sun) up to today that has at least one played game
  const wk = [...new Set(G.filter(g => g.d && g.d <= TODAY && (played(g) || BOXES[gameKey(g)])).map(g => monday(g.d)))].sort();
  return wk.length ? wk[wk.length-1] : monday(TODAY);
}
// Build the public box score from a full (private) submission, applying underage rules
function publicBox(sub, roster){
  const mode = modeFor(sub.team);
  const hiddenNos = new Set((roster && roster.players || []).filter(p => p.hidden).map(p => String(p.no)));
  let lines = [];
  if(mode === 'full' || mode === 'first'){
    lines = (sub.lines||[]).filter(l => !l.hidden && !hiddenNos.has(String(l.no)));
    if(!isSenior(sub.team)) lines = lines.filter(l => l.pts > 0);
    lines = lines.map(l => ({ no: l.no, name: mode === 'first' ? String(l.name||'').trim().split(/\s+/)[0] : l.name, pts: +l.pts || 0 }));
    lines.sort((a,b)=>b.pts-a.pts);
  }
  let potg = null;
  if((mode === 'full' || mode === 'first') && sub.potg && sub.potg.name && !hiddenNos.has(String(sub.potg.no))){
    potg = { no: sub.potg.no, name: mode === 'first' ? String(sub.potg.name).trim().split(/\s+/)[0] : sub.potg.name, note: sub.potg.note || '' };
  }
  return { key: sub.gameKey, team: sub.team, sex: sub.sex, d: sub.d, o: sub.o, us: +sub.us, th: +sub.th, mode, lines, potg, example: !!sub.example, approved: new Date().toISOString() };
}
async function republishAll(){
  const subs = (await S.listSubmissions()).filter(s => s.status === 'approved');
  for(const s of subs){ const r = await S.getRoster(s.team); const b = publicBox(s, r);
    if(b.mode === 'hidden') await S.deleteBoxscore(s.gameKey); else await S.putBoxscore(s.gameKey, b) }
  await loadBoxes();
}
async function loadBoxes(){ BOXES = {}; try { (await within(S.listBoxscores(), 6000, [])).forEach(b => { BOXES[b.key] = b }) } catch(e){ console.warn("box scores", e) } }

/* ---------- views ---------- */
const V = {};

V.home = () => {
  setHead('Éanna Hub', `${CFG.season || ''} · every team, every game`);
  const wk = currentWeek(), end = addDays(wk, 6);
  const tp = topPerformers(wk, end);
  const sex = lsGet('eanna-hub-tp', 'm');
  const list = tp[sex].slice(0, 5);
  const pg = potgList(wk, end);
  const potgCard = pg.length ? card(`Players of the game · picked by coaches`, pg.slice(0,6).map(p => `<a class="row" href="#game/${encodeURIComponent(p.key)}" style="padding:9px 0;border-bottom:1px solid var(--line);text-decoration:none;color:inherit;align-items:flex-start">${jersey(p.no, p.sex==='w')}<div class="f"><b>${esc(p.name)}</b> <span class="sm mut">${esc(p.team)} · v ${esc(oname(p.o))}</span>${p.note?`<div class="sm" style="margin-top:2px">“${esc(p.note)}”</div>`:''}</div></a>`).join('')) : '';
  const perf = list.length ? list.map(p => `<div class="perf">${jersey(p.no, p.sex==='w')}<div class="f"><b>${pname(p.team, p.no, p.name)}</b><span>${esc(p.team)} · v ${esc(oname(p.o))}</span></div><div class="n">${p.pts}<small>PTS</small></div></div>`).join('')
    : `<div style="padding:12px 0 4px"><b style="font-family:var(--display)">No score-sheets in yet for this week</b><div class="sm" style="opacity:.8;margin-top:4px">Top performers appear here once coaches send in score-sheets and a moderator approves them.</div></div>`;
  const wkGames = G.filter(g => g.d >= wk && g.d <= end && visible(g.team));
  const res = wkGames.filter(played).sort((a,b)=>(b.d+(b.tm||'')).localeCompare(a.d+(a.tm||'')));
  const next = G.filter(g => g.d && g.d >= TODAY && !played(g) && visible(g.team)).sort((a,b)=>(a.d+(a.tm||'')).localeCompare(b.d+(b.tm||''))).slice(0, 5);
  const W = res.filter(g=>g.us>g.th).length;
  $('#view').innerHTML = `<div class="split"><div>${potgCard}
    <div class="tc">
      <div class="row sp"><span class="lbl">Top scorer from each game · ${fmtDate(wk,{day:'numeric',month:'short'})}–${fmtDate(end,{day:'numeric',month:'short'})}</span></div>
      <div class="seg" style="margin:10px 0 2px;background:rgba(255,255,255,.08);border-color:rgba(255,255,255,.14)" data-tp><button data-v="m" class="${sex==='m'?'on':''}" style="color:#fff">Men &amp; boys</button><button data-v="w" class="${sex==='w'?'on':''}" style="color:#fff">Women &amp; girls</button></div>
      ${perf}
    </div>
    ${card(`This week's results · ${res.length ? `<span class="pill p-ok">${W} won</span> <span class="pill p-no">${res.length-W} lost</span>` : ''}`, res.length ? rows(res.slice(0,6)) + (res.length > 6 ? `<a class="btn g block" style="margin-top:8px" href="#results">All ${res.length} results</a>` : '') : '<div class="empty" style="padding:12px"><b>No results yet this week</b></div>')}
    </div><div>${card('Next up', next.length ? rows(next) + `<a class="btn g block" style="margin-top:8px" href="#fixtures">All fixtures</a>` : '<div class="empty" style="padding:12px"><b>No upcoming games</b></div>')}
    <a class="cd row" href="#submit" style="text-decoration:none;color:inherit"><span class="ball">✎</span><div class="f"><b>Coaches: send a score-sheet</b><div class="sm mut">Takes about a minute after the game</div></div><span class="mut">›</span></a>
    <div class="spons home-spons"><img src="assets/griffith-college-black.png" alt="Griffith College"><img src="assets/crest.png" alt="Éanna Basketball" style="height:46px"><img src="assets/upmc-ssc-colour.png" alt="UPMC Sports Surgery Clinic"></div></div></div>`;
  $$('[data-tp] button').forEach(b => b.onclick = () => { lsSet('eanna-hub-tp', b.dataset.v); V.home() });
};

let wi = null;
V.results = () => {
  setHead('Results', CFG.season + ' season');
  const weeks = [...new Set(G.filter(g => g.d && g.d <= TODAY).map(g => monday(g.d)))].sort();
  if(!weeks.length){ $('#view').innerHTML = '<div class="empty"><b>No results yet</b></div>'; return }
  if(wi === null || wi >= weeks.length) wi = Math.max(0, weeks.indexOf(currentWeek()));
  const w = weeks[wi], e = addDays(w, 6);
  const gs = G.filter(g => g.d && g.d >= w && g.d <= e && visible(g.team));
  const pl = gs.filter(played), W = pl.filter(g=>g.us>g.th).length;
  let h = `<div class="cd row sp" style="padding:8px 10px"><button class="btn g sm" data-wk="-1" ${wi===0?'disabled':''} aria-label="Previous week">‹</button><b style="font-family:var(--display)">${fmtDate(w,{day:'numeric',month:'short'})} – ${fmtDate(e,{day:'numeric',month:'short'})}</b><button class="btn g sm" data-wk="1" ${wi===weeks.length-1?'disabled':''} aria-label="Next week">›</button></div>
    <div class="row wrap"><span class="pill p-nv">${gs.length} games</span><span class="pill p-ok">${W} won</span><span class="pill p-no">${pl.length-W} lost</span>${gs.length-pl.length?`<span class="pill p-warn">${gs.length-pl.length} no score yet</span>`:''}</div>`;
  const cols = [[],[]]; GROUPS.forEach((gr, i) => { const x = gs.filter(g => groupOf(g) === gr); if(x.length) cols[i%2].push(card(gr, rows(x))) });
  h += `<div class="cards"><div>${cols[0].join('')}</div><div>${cols[1].join('')}</div></div>`;
  const tally = { m:{}, w:{} };
  Object.values(BOXES).forEach(b => { if(!namesShown(b.team)) return; (b.lines||[]).forEach(l => { const k = b.team+'|'+l.no; const t = tally[b.sex==='w'?'w':'m']; t[k] = t[k] || { team:b.team, no:l.no, name:l.name, pts:0, gp:0 }; t[k].pts += l.pts; t[k].gp++ }) });
  const lb = sx => Object.values(tally[sx]).sort((a,b)=>b.pts-a.pts).slice(0,10).map((p,i)=>`<a class="row" href="${playerHref(p.team,p.no)}" style="padding:7px 0;border-bottom:1px solid var(--line);text-decoration:none;color:inherit"><span class="n" style="width:22px;color:var(--orange)">${i+1}</span><div class="f"><b>${esc(p.name)}</b> <span class="sm mut">${esc(p.team)}</span></div><span class="sm mut">${p.gp} gm</span><span class="n" style="font-size:17px">${p.pts}</span></a>`).join('') || '<div class="sm mut" style="padding:8px 0">No score-sheets yet.</div>';
  h += `<details class="cd"><summary class="lbl" style="cursor:pointer">Season points ▾</summary><div class="cards" style="margin-top:8px"><div><div class="lbl">Men &amp; boys</div>${lb('m')}</div><div><div class="lbl">Women &amp; girls</div>${lb('w')}</div></div><div class="sm mut" style="margin-top:8px">From approved score-sheets only. Follows each age group's settings.</div></details>`;
  $('#view').innerHTML = h;
  $$('[data-wk]').forEach(b => b.onclick = () => { wi += +b.dataset.wk; V.results() });
};

V.game = (key) => {
  const g = G.find(x => gameKey(x) === key);
  if(!g){ setHead('Game', '', '#results'); $('#view').innerHTML = '<div class="empty"><b>Game not found</b></div>'; return }
  setHead(g.team, `${g.k==='Cup'?g.c:'League'} · ${g.b==='BI'?'Basketball Ireland':g.b}`, history.length > 1 ? 'javascript:history.back()' : '#results');
  const box = BOXES[key];
  const p = played(g), past = g.d && g.d < TODAY;
  let h = `<div class="cd"><div class="row sp" style="align-items:flex-start">
      <div style="text-align:center;flex:1"><img src="assets/crest.png" alt="" style="width:64px;height:64px;object-fit:contain"><div class="sm" style="font-weight:700">Éanna</div>${p?`<div class="n" style="font-size:36px;color:${g.us>g.th?'var(--ok)':'var(--no)'}">${g.us}</div>`:''}</div>
      <div style="text-align:center;padding-top:18px"><span class="vs" style="font-size:26px">VS</span><div>${p?`<span class="pill ${g.us>g.th?'p-ok':'p-no'}">FINAL · ${g.us>g.th?'WIN':'LOSS'}</span>`:past?'<span class="pill p-nv">No score yet</span>':'<span class="pill p-pu">UPCOMING</span>'}</div></div>
      <div style="text-align:center;flex:1"><div style="display:grid;place-items:center;height:64px">${crest(g.o, 60)}</div><div class="sm" style="font-weight:700">${esc(oname(g.o))}</div>${p?`<div class="n" style="font-size:36px">${g.th}</div>`:''}</div></div></div>
    <div class="cd">
      <div class="info"><span class="ic">📅</span><div class="f"><b>${g.d ? fmtDate(g.d,{weekday:'long',day:'numeric',month:'long'})+' · '+fmtTime(g.tm) : 'Date to be confirmed'}</b><div class="sm mut">${g.h?'Home':'Away'}</div></div></div>
      <div class="info"><span class="ic">📍</span><div class="f"><b>${esc(g.v || 'Venue to be confirmed')}</b></div></div>
      <div class="info"><span class="ic">🏆</span><div class="f"><b>${esc(g.c)}</b><div class="sm mut">${boardName[g.b]||'Added by a moderator'} · ${esc(g.k)}</div></div></div>
      ${g.status?`<div class="info"><span class="ic">⚠️</span><div class="f"><b>${esc(g.status)}</b></div></div>`:''}${g.note?`<div class="info"><span class="ic">ℹ️</span><div class="f">${esc(g.note)}</div></div>`:''}
    </div>`;
  if(box && box.potg) h += `<div class="tc"><div class="lbl">Player of the game · coach's pick</div><div class="perf">${jersey(box.potg.no, box.sex==='w')}<div class="f"><b>${pname(g.team, box.potg.no, box.potg.name)}</b>${box.potg.note?`<span style="display:block;margin-top:4px;font-size:14px;opacity:.9">“${esc(box.potg.note)}”</span>`:''}</div></div></div>`;
  if(box){
    if(box.lines && box.lines.length){
      h += card(`Points${box.example?' · <span class="pill p-warn">Example</span>':''}`, `<table class="bx"><thead><tr><th></th><th>Player</th><th class="r">Pts</th></tr></thead><tbody>${box.lines.map(l=>`<tr><td style="width:40px">${jersey(l.no, box.sex==='w')}</td><td>${pname(g.team, l.no, l.name)}</td><td class="r n" style="font-size:17px">${l.pts}</td></tr>`).join('')}</tbody></table>${!isSenior(g.team)?'<div class="sm mut" style="margin-top:6px">Underage game: only players who scored are shown.</div>':''}`);
    } else {
      h += `<div class="banner b-pu">The score-sheet for this game is in. Player points aren't shown publicly for this age group.</div>`;
    }
  } else if(p || past){
    h += `<a class="cd row" href="#submit/${encodeURIComponent(key)}" style="text-decoration:none;color:inherit"><span class="ball">✎</span><div class="f"><b>No score-sheet yet</b><div class="sm mut">Coach or manager? Send it in for player points.</div></div><span class="mut">›</span></a>`;
  }
  if(can('fixtures')) h += `<a class="btn g block" href="#admin/fixtures/${encodeURIComponent(key)}">Edit this fixture</a>`;
  if(gameLink(g)) h += `<a class="btn g block" href="${gameLink(g)}" target="_blank" rel="noopener">Open on the ${g.b==='BI'?'Basketball Ireland':g.b} site ↗</a>`;
  $('#view').innerHTML = `<div class="narrow">${h}</div>`;
};

let ctf = 'all';
V.teams = () => {
  setHead('Teams', `${T.filter(t=>visible(t.name)).length} Éanna teams`);
  const L = T.filter(t => visible(t.name) && (ctf==='all' || (ctf==='w') === (sexOf(t)==='w')));
  let h = `<div class="seg" data-ct><button data-v="all" class="${ctf==='all'?'on':''}">All</button><button data-v="m" class="${ctf==='m'?'on':''}">Men &amp; boys</button><button data-v="w" class="${ctf==='w'?'on':''}">Women &amp; girls</button></div>`;
  const tcols = [[],[]];
  GROUPS.forEach((gr, gi) => {
    const x = L.filter(t => groupOf(t) === gr).sort((a,b) => (ageOf(a.name)||0)-(ageOf(b.name)||0) || a.name.localeCompare(b.name));
    if(!x.length) return;
    tcols[gi%2].push(card(`${gr} · ${x.length}`, x.map(t => `<a class="row" href="#team/${encodeURIComponent(t.name)}" style="padding:9px 0;border-bottom:1px solid var(--line);text-decoration:none;color:inherit"><span class="ball" style="font-size:9.5px">${esc((t.name.match(/U\d+/)||[sexOf(t)==='w'?'W':'M'])[0])}</span><div class="f"><b>${esc(t.name)}</b><div class="sm mut">${t.b==='BI'?'Basketball Ireland':t.b} · ${esc(t.comp)}</div></div>${t.n ? `<span class="n" style="font-size:17px">${t.w}–${t.l}</span>${t.pos?`<span class="pill ${t.pos<=2?'p-or':'p-nv'}">${ord(t.pos)}</span>`:''}` : '<span class="pill p-nv">No scores</span>'}<span class="mut">›</span></a>`).join('')));
  });
  h += `<div class="cards"><div>${tcols[0].join('')}</div><div>${tcols[1].join('')}</div></div>`;
  $('#view').innerHTML = h;
  $$('[data-ct] button').forEach(b => b.onclick = () => { ctf = b.dataset.v; V.teams() });
};

V.team = (name) => {
  const t = T.find(x => x.name === name);
  const all = G.filter(g => g.team === name || (t && g.k==='Cup' && g.team.startsWith(name)));
  setHead(name, t ? `${t.b==='BI'?'Basketball Ireland':t.b} · ${t.comp}` : 'Cup', '#teams');
  if(!visible(name)){ $('#view').innerHTML = '<div class="empty"><b>This team isn\'t shown publicly</b></div>'; return }
  const pl = all.filter(played).sort((a,b)=>(b.d||'').localeCompare(a.d||''));
  const next = all.filter(g => g.d && g.d >= TODAY && !played(g)).sort((a,b)=>(a.d+(a.tm||'')).localeCompare(b.d+(b.tm||'')));
  let h = `<div class="wood"><div class="in"><img src="assets/crest-dark.png" alt=""><div class="f"><div class="lbl" style="color:rgba(255,255,255,.75)">${t?esc(t.comp):'Cup'}</div><h2>${esc(name)}</h2></div>${name==="Men's Super League"?'<img src="assets/mens-super-league.png" alt="" style="width:56px;height:auto">':''}</div></div>`;
  if(t) h += `<div class="stat3"><div><span class="n">${t.n?t.w+'–'+t.l:'–'}</span><span>Record</span></div><div><span class="n">${t.pos?ord(t.pos):'–'}</span><span>of ${t.of||'–'}</span></div><div><span class="n">${t.n?Math.round(t.pf/t.n)+'–'+Math.round(t.pa/t.n):'–'}</span><span>Avg score</span></div></div>`;
  if(pl.length) h += `<div class="cd row sp"><span class="lbl">Form</span><span class="form">${pl.slice(0,5).reverse().map(g=>`<span class="${g.us>g.th?'W':'L'}">${g.us>g.th?'W':'L'}</span>`).join('')}</span></div>`;
  if(/U11/.test(name)) h += '<div class="banner b-pu">U11 is a non-scoring league, so there are fixtures but no results or table.</div>';
  // top scorers from approved box scores
  const tally = {};
  Object.values(BOXES).filter(b => b.team === name).forEach(b => (b.lines||[]).forEach(l => { const k = l.no+'|'+l.name; tally[k] = tally[k] || { no:l.no, name:l.name, pts:0, gp:0 }; tally[k].pts += l.pts; tally[k].gp++ }));
  const ts = Object.values(tally).sort((a,b)=>b.pts-a.pts).slice(0,5);
  if(ts.length) h += card('Top scorers · from score-sheets', ts.map(p => `<div class="row" style="padding:7px 0;border-bottom:1px solid var(--line)">${jersey(p.no, sexOf(t||{})==='w')}<b class="f">${pname(name, p.no, p.name)}</b><span class="sm mut">${p.gp} gm</span><span class="n" style="font-size:18px">${p.pts}</span></div>`).join(''));
  let right = '';
  if(next.length) right += card('Next games', rows(next.slice(0,4)));
  if(pl.length) right += card('Results', rows(pl));
  const tb = t && TB[t.cid];
  if(tb && tb.length) h += card('League table', `<div class="tscroll"><table class="bx"><thead><tr><th>#</th><th>Team</th><th class="r">W</th><th class="r">L</th><th class="r">+/−</th></tr></thead><tbody>${tb.map((r,i)=>`<tr class="${/[EÉ]anna/.test(r[0])?'me':''}"><td>${i+1}</td><td>${esc(oname(r[0]))}</td><td class="r">${r[1]}</td><td class="r">${r[2]}</td><td class="r">${r[3]-r[4]>0?'+':''}${r[3]-r[4]}</td></tr>`).join('')}</tbody></table></div><div class="sm mut" style="margin-top:6px">Worked out from results on the ${t.b==='BI'?'Basketball Ireland':t.b} site. The official table may differ slightly.</div>`);
  const cut = h.indexOf('<div class="stat3">');
  $('#view').innerHTML = cut > 0 ? h.slice(0, cut) + `<div class="split"><div>${h.slice(cut)}</div><div>${right}</div></div>` : h + right;
};

V.player = (team, no) => {
  setHead('Player', team, `#team/${encodeURIComponent(team)}`);
  if(!namesShown(team)){ $('#view').innerHTML = '<div class="empty"><b>Player pages aren\'t shown for this age group</b></div>'; return }
  const games = Object.values(BOXES).filter(b => b.team === team).map(b => ({ b, l: (b.lines||[]).find(l => String(l.no) === String(no)) })).filter(x => x.l).sort((a,c)=>(c.b.d||'').localeCompare(a.b.d||''));
  if(!games.length){ $('#view').innerHTML = '<div class="empty"><b>No games on record yet</b></div>'; return }
  const name = games[0].l.name, tot = games.reduce((a,x)=>a+x.l.pts,0), hi = Math.max(...games.map(x=>x.l.pts));
  const pg = games.filter(x => x.b.potg && String(x.b.potg.no) === String(no)).length;
  setHead(name, team, `#team/${encodeURIComponent(team)}`);
  const w = sexOf(games[0].b) === 'w';
  $('#view').innerHTML = `<div class="narrow"><div class="tc"><div class="row"><svg style="width:84px;height:92px;filter:drop-shadow(0 8px 12px rgba(0,0,0,.5))" aria-hidden="true"><use href="#${w?'jsyw':'jsy'}"/><text x="20" y="33" text-anchor="middle" font-family="Anton" font-size="14" fill="#fff">${esc(no)}</text></svg><div class="f"><div class="lbl">${esc(team)}</div><div class="h2" style="color:#fff">${esc(name)}</div>${pg?`<span class="pill p-or" style="margin-top:6px">Player of the game × ${pg}</span>`:''}</div></div></div>
    <div class="stat3"><div><span class="n">${games.length}</span><span>Games</span></div><div><span class="n">${(tot/games.length).toFixed(1)}</span><span>Pts per game</span></div><div><span class="n">${hi}</span><span>Best game</span></div></div>
    ${card('Game log', games.map(x => `<a class="row" href="#game/${encodeURIComponent(x.b.key)}" style="padding:8px 0;border-bottom:1px solid var(--line);text-decoration:none;color:inherit"><span class="sm mut" style="width:62px">${x.b.d?fmtDate(x.b.d,{day:'numeric',month:'short'}):''}</span>${crest(x.b.o)}<b class="f">v ${esc(oname(x.b.o))} <span class="${x.b.us>x.b.th?'w':'l'} sm">${x.b.us>x.b.th?'W':'L'}</span></b><span class="n" style="font-size:17px">${x.l.pts}</span></a>`).join(''))}</div>`;
};

/* fixtures */
let fx = { f:'all', team:'', ym: TODAY.slice(0,7), sel: TODAY };
const FOLLOW_KEY = 'eanna-hub-follow';
function following(){ return lsGet(FOLLOW_KEY, { off: [] }) }
const fxPass = g => { const fo = following(); if(fo.off.includes(g.b==='BI' ? g.c : g.b)) return false;
  return visible(g.team) && (!fx.team || g.team === fx.team) && (fx.f==='all' || (fx.f==='m' && sexOf(g)==='m') || (fx.f==='w' && sexOf(g)==='w') || (fx.f==='sen' && isSenior(g.team))) };
V.fixtures = () => {
  setHead('Fixtures', fx.team || 'All Éanna teams');
  const [y, m] = fx.ym.split('-').map(Number);
  const first = new Date(y, m-1, 1, 12), days = new Date(y, m, 0).getDate(), off = (first.getDay()+6)%7, prevDays = new Date(y, m-1, 0).getDate();
  const teams = [...new Set(G.map(g => g.team))].filter(visible).sort((a,b) => GROUPS.indexOf(groupOf({team:a, b:(G.find(g=>g.team===a)||{}).b, sex:(G.find(g=>g.team===a)||{}).sex})) - GROUPS.indexOf(groupOf({team:b, b:(G.find(g=>g.team===b)||{}).b, sex:(G.find(g=>g.team===b)||{}).sex})) || (ageOf(a)||0)-(ageOf(b)||0) || a.localeCompare(b));
  let cal = 'MTWTFSS'.split('').map(d => `<span class="dh">${d}</span>`).join('');
  for(let i=0;i<off;i++) cal += `<button class="x" disabled>${prevDays-off+1+i}</button>`;
  for(let d=1; d<=days; d++){ const ds = `${fx.ym}-${pad(d)}`; const n = G.filter(g => g.d === ds && fxPass(g)).length;
    cal += `<button class="${ds===fx.sel?'sel':''} ${ds===TODAY?'today':''}" data-day="${ds}" aria-label="${fmtDate(ds)}, ${n} games">${d}${n?`<span class="dots">${'<i></i>'.repeat(Math.min(n,3))}</span>`:''}</button>` }
  const day = G.filter(g => g.d === fx.sel && fxPass(g)).sort((a,b)=>(a.tm||'').localeCompare(b.tm||''));
  const nat = (DATA.national || []);
  const fo = following();
  const tg = (key, on) => `<button class="tog ${on?'on':''}" data-fol="${esc(key)}" aria-pressed="${on}" aria-label="${esc(key)}"></button>`;
  const until = addDays(TODAY, 13);
  const up = G.filter(g => g.d && g.d >= TODAY && g.d <= until && fxPass(g)).sort((a,b)=>(a.d+(a.tm||'')).localeCompare(b.d+(b.tm||'')));
  let upH = '', last = '', buf = '';
  const flush = () => { if(buf) upH += card('', buf); buf = '' };
  up.forEach(g => { if(g.d !== last){ flush(); upH += `<div class="dayh">${fmtDate(g.d)}</div>`; last = g.d } buf += gameRow(g) }); flush();
  $('#view').innerHTML = `
    <div class="seg" data-fx><button data-v="all">All</button><button data-v="m">Men &amp; boys</button><button data-v="w">Women &amp; girls</button><button data-v="sen">Senior</button></div>
    <label class="fld"><span>Team</span><select id="fxTeam"><option value="">All Éanna teams</option>${teams.map(n=>`<option ${n===fx.team?'selected':''}>${esc(n)}</option>`).join('')}</select></label>
    <div class="split fx-split"><div>
    <div class="cd"><div class="row sp" style="margin-bottom:8px"><button class="btn g sm" data-mon="-1" aria-label="Previous month">‹</button><b style="font-family:var(--display)">${first.toLocaleDateString('en-IE',{month:'long',year:'numeric'})}</b><button class="btn g sm" data-mon="1" aria-label="Next month">›</button></div><div class="cal">${cal}</div></div>
    <details class="cd"><summary class="lbl" style="cursor:pointer">My competitions · what shows in my schedule</summary>
      <div style="margin-top:8px">
        <div class="trow"><span><b>DMBB</b> · Dublin men's &amp; boys'</span>${tg('DMBB', !fo.off.includes('DMBB'))}</div>
        <div class="trow"><span><b>DLBB</b> · Dublin women's &amp; girls'</span>${tg('DLBB', !fo.off.includes('DLBB'))}</div>
        ${nat.filter(n=>n.on).map(n => `<div class="trow"><span><b>${esc(n.c)}</b><br><span class="sm mut">${esc(n.s)}</span></span>${tg(compOf(n.c), !fo.off.includes(compOf(n.c)))}</div>`).join('')}
        <div class="sm mut" style="margin-top:6px">Saved on this phone only. It doesn't change anything for anyone else.</div>
      </div></details>
    </div><div>
    <div class="dayh">${fmtDate(fx.sel)} · ${day.length} game${day.length===1?'':'s'}</div>
    ${day.length ? card('', rows(day)) : '<div class="empty" style="padding:10px"><b>No games</b>Pick a day with orange dots.</div>'}
    <div class="dayh">Next 14 days</div>
    ${upH || '<div class="empty" style="padding:10px"><b>No games in the next 14 days</b></div>'}
    </div></div>`;
  $$('[data-fx] button').forEach(b => { b.classList.toggle('on', b.dataset.v === fx.f); b.onclick = () => { fx.f = b.dataset.v; V.fixtures() } });
  $('#fxTeam').onchange = e => { fx.team = e.target.value; V.fixtures() };
  $$('[data-day]').forEach(b => b.onclick = () => { fx.sel = b.dataset.day; V.fixtures() });
  $$('[data-mon]').forEach(b => b.onclick = () => { let [yy,mm] = fx.ym.split('-').map(Number); mm += +b.dataset.mon; if(mm<1){mm=12;yy--} if(mm>12){mm=1;yy++} const k = `${yy}-${pad(mm)}`; if(k < '2026-09' || k > '2027-05') return; fx.ym = k; const f1 = G.filter(g => g.d && g.d.startsWith(k) && fxPass(g)).map(g=>g.d).sort()[0]; fx.sel = f1 || `${k}-01`; V.fixtures() });
  $$('[data-fol]').forEach(b => b.onclick = () => { const f = following(); const k = b.dataset.fol; f.off = f.off.includes(k) ? f.off.filter(x=>x!==k) : [...f.off, k]; lsSet(FOLLOW_KEY, f); const open = b.closest('details').open; V.fixtures(); if(open) $('details.cd').open = true });
};
// national list names -> competition names used in games
function compOf(c){ return ({"Domino's Men's Super League":"Men's Super League"})[c] || c }

V.more = () => {
  setHead('More', 'Éanna Hub');
  const upd = DATA.fetched ? fmtDate(DATA.fetched,{day:'numeric',month:'long',year:'numeric'}) : '';
  $('#view').innerHTML = `
    <a class="cd row" href="#submit" style="text-decoration:none;color:inherit"><span class="ball">✎</span><div class="f"><b>Send a score-sheet</b><div class="sm mut">For coaches and team managers</div></div><span class="mut">›</span></a>
    <a class="cd row" href="#admin" style="text-decoration:none;color:inherit"><img src="assets/crest.png" alt="" style="width:34px;height:34px;object-fit:contain"><div class="f"><b>Admin &amp; moderators</b><div class="sm mut">${AUTH.admin ? 'Signed in' : 'Sign in to approve score-sheets'}</div></div><span class="mut">›</span></a>
    ${card('Add the hub to your phone', `<div class="sm" style="margin-top:6px"><b>iPhone:</b> open this page in Safari, tap <b>Share</b>, then <b>Add to Home Screen</b>.<br><b>Android:</b> open it in Chrome, tap the <b>⋮</b> menu, then <b>Install app</b> or <b>Add to Home screen</b>.</div>`)}
    ${card('Where the fixtures come from', `<div class="sm" style="margin-top:6px">Dublin leagues and cups from the <a href="https://bi.comortais.com/competitionstabs.aspx?oid=1006" target="_blank" rel="noopener">DMBB</a> and <a href="https://bi.comortais.com/competitionstabs.aspx?oid=1015" target="_blank" rel="noopener">DLBB</a> sites. National games from <a href="https://ireland.basketball/NationalLeagueFixtures" target="_blank" rel="noopener">Basketball Ireland</a>.${upd?` Last updated ${upd}.`:''} Player points come from score-sheets sent in by coaches.</div>`)}
    ${card('Privacy', `<div class="sm" style="margin-top:6px">The hub doesn't collect dates of birth, addresses or phone numbers. Underage players who don't score aren't listed, and each age group can be set to show results only. Score-sheet photos are only seen by moderators. To have a player's name removed, contact the club.</div>`)}
    <div class="spons"><img src="assets/griffith-college-black.png" alt="Griffith College"><img src="assets/crest.png" alt="Éanna Basketball" style="height:46px"><img src="assets/upmc-ssc-colour.png" alt="UPMC Sports Surgery Clinic"></div>`;
};

/* ---------- score-sheet entry ---------- */
const SUB_KEY = 'eanna-hub-submitter';
V.submit = async (preKey) => {
  setHead('Send a score-sheet', 'Coaches & team managers', '#more');
  const me = lsGet(SUB_KEY, { name:'', code:'', names:{} });
  const teams = [...new Set(G.map(g => g.team))].sort((a,b)=> GROUPS.indexOf(groupOf(G.find(g=>g.team===a))) - GROUPS.indexOf(groupOf(G.find(g=>g.team===b))) || (ageOf(a)||0)-(ageOf(b)||0) || a.localeCompare(b));
  const pre = preKey ? G.find(g => gameKey(g) === preKey) : null;
  let team = pre ? pre.team : (me.team || teams[0]);
  const render = () => {
    const games = G.filter(g => g.team === team && g.d && g.d <= addDays(TODAY, 1) && g.d >= addDays(TODAY, -45)).sort((a,b)=>b.d.localeCompare(a.d));
    const sel = pre && pre.team === team ? gameKey(pre) : (games[0] ? gameKey(games[0]) : '');
    const saved = (me.names && me.names[team]) || [];
    const baseRows = saved.length ? saved.map(p => ({ no:p.no, name:p.name, pts:'' })) : Array.from({length:8}, () => ({ no:'', name:'', pts:'' }));
    $('#view').innerHTML = `
      <div class="banner b-pu">Type each player's points from the score-sheet. A moderator checks it before anything goes public.</div>
      <label class="fld"><span>Team</span><select id="sTeam">${teams.map(n=>`<option ${n===team?'selected':''}>${esc(n)}</option>`).join('')}</select></label>
      <label class="fld"><span>Game</span><select id="sGame">${games.length ? games.map(g=>`<option value="${esc(gameKey(g))}" ${gameKey(g)===sel?'selected':''}>${fmtDate(g.d)} · v ${esc(oname(g.o))}${g.k==='Cup'?' (cup)':''}</option>`).join('') : '<option value="">No recent games for this team</option>'}</select></label>
      <div class="grid2"><label class="fld"><span>Éanna score</span><input id="sUs" inputmode="numeric" pattern="[0-9]*"></label><label class="fld"><span id="sThL">Opponent score</span><input id="sTh" inputmode="numeric" pattern="[0-9]*"></label></div>
      <div class="cd"><div class="lbl" style="margin-bottom:6px">Players</div>
        <div class="tscroll"><table class="bx"><thead><tr><th>No.</th><th>Name</th><th class="r">Pts</th></tr></thead><tbody id="sRows">${baseRows.map(rowHtml).join('')}</tbody></table></div>
        <button class="btn g sm" id="sAdd" style="margin-top:8px">+ Add player</button>
        <div id="sCheck" class="banner" style="margin-top:10px"></div>
      </div>
      <div class="cd"><div class="lbl" style="margin-bottom:6px">Player of the game · coach's pick (optional)</div>
        <label class="fld"><span>Player</span><select id="sPotg"><option value="">No pick</option></select></label>
        <label class="fld" style="margin-top:8px"><span>Why? A line from the coach</span><input id="sNote" maxlength="160" placeholder="e.g. Ran the offence and never stopped talking on D"></label></div>
      <label class="fld"><span>Photo of the score-sheet (optional, only moderators see it)</span><input id="sPhoto" type="file" accept="image/*"></label>
      <div class="grid2"><label class="fld"><span>Your name</span><input id="sName" value="${esc(me.name)}" autocomplete="name"></label><label class="fld"><span>Club code</span><input id="sCode" value="${esc(me.code)}" autocomplete="off" autocapitalize="characters"></label></div>
      <button class="btn or block" id="sSend">Send for checking</button>
      ${S.mode==='demo' ? `<div class="sm mut" style="text-align:center">Demo mode: the club code is <b>${esc(CFG.demoClubCode)}</b>.</div>` : ''}`;
    const fill = () => { const g = G.find(x => gameKey(x) === $('#sGame').value); if(g){ $('#sThL').textContent = oname(g.o) + ' score'; if(played(g)){ $('#sUs').value = g.us; $('#sTh').value = g.th } } check() };
    $('#sTeam').onchange = e => { team = e.target.value; render() };
    $('#sGame').onchange = fill;
    $('#sAdd').onclick = () => { $('#sRows').insertAdjacentHTML('beforeend', rowHtml({no:'',name:'',pts:''})); check() };
    $('#sRows').oninput = check; $('#sUs').oninput = check;
    $('#sSend').onclick = send;
    fill();
  };
  const rowHtml = p => `<tr><td><input class="num" inputmode="numeric" value="${esc(p.no)}" aria-label="Shirt number"></td><td><input value="${esc(p.name)}" aria-label="Player name"></td><td class="r"><input class="pts" inputmode="numeric" value="${esc(p.pts)}" aria-label="Points"></td></tr>`;
  const readLines = () => $$('#sRows tr').map(tr => { const [a,b,c] = $$('input', tr).map(i => i.value.trim()); return { no:a, name:b, pts: c === '' ? null : parseInt(c,10) } }).filter(l => l.no || l.name || l.pts !== null);
  function potgOpts(){ const sel = $('#sPotg'); if(!sel) return; const cur = sel.value; const ls_ = readLines().filter(l => l.name);
    sel.innerHTML = '<option value="">No pick</option>' + ls_.map(l => `<option value="${esc(l.no)}|${esc(l.name)}" ${(l.no+'|'+l.name)===cur?'selected':''}>${esc(l.no)} · ${esc(l.name)}</option>`).join('') }
  function check(){
    potgOpts();
    const lines = readLines(), tot = lines.reduce((s,l)=>s+(l.pts||0),0), us = parseInt($('#sUs').value,10);
    const b = $('#sCheck');
    if(!lines.length){ b.className='banner b-pu'; b.textContent='Add each player who played, with their points.'; return }
    if(isNaN(us)){ b.className='banner b-pu'; b.textContent=`Players add up to ${tot}. Enter the Éanna score to check it.`; return }
    if(tot === us){ b.className='banner b-ok'; b.innerHTML=`Players add up to <b>${tot}</b>, which matches the score ✓` }
    else { b.className='banner b-warn'; b.innerHTML=`Players add up to <b>${tot}</b> but the Éanna score is <b>${us}</b>. Double-check the sheet. You can still send it.` }
  }
  async function send(){
    const g = G.find(x => gameKey(x) === $('#sGame').value);
    const lines = readLines().filter(l => l.no || l.name);
    const name = $('#sName').value.trim(), code = $('#sCode').value.trim();
    if(!g) return toast('Pick the game first', 1);
    if(!lines.length) return toast('Add at least one player', 1);
    if(lines.some(l => !l.name)) return toast('Every player needs a name', 1);
    if(!name) return toast('Add your name so the moderator knows who sent it', 1);
    if(!code) return toast('Enter the club code', 1);
    const btn = $('#sSend'); btn.disabled = true; btn.textContent = 'Sending…';
    let photo = '';
    const f = $('#sPhoto').files[0];
    if(f){ try { photo = await shrinkImage(f, 1100, .62) } catch(e){ photo = '' } }
    const sub = { team: g.team, sex: sexOf(g), gameKey: gameKey(g), d: g.d, o: g.o, comp: g.c, us: parseInt($('#sUs').value,10) || 0, th: parseInt($('#sTh').value,10) || 0,
      lines: lines.map(l => ({ no: l.no, name: l.name, pts: l.pts || 0 })), by: name, photo };
    const pv = $('#sPotg').value; if(pv){ const [pno, ...pn] = pv.split('|'); sub.potg = { no: pno, name: pn.join('|'), note: $('#sNote').value.trim() } }
    try {
      await S.submitSheet(sub, code);
      me.name = name; me.code = code; me.team = g.team; me.names = me.names || {}; me.names[g.team] = lines.map(l => ({ no:l.no, name:l.name })); lsSet(SUB_KEY, me);
      $('#view').innerHTML = `<div class="cd" style="text-align:center;padding:28px 16px"><div class="ball" style="width:72px;height:72px;margin:0 auto;font-size:28px">✓</div><div class="h2" style="margin-top:12px"><span class="gt">Sent for checking</span></div><p class="mut">${esc(g.team)} v ${esc(oname(g.o))}. A moderator will check it, usually within a day. Player names are saved on this phone for next time.</p><a class="btn g" href="#submit">Send another</a></div>`;
    } catch(e){
      btn.disabled = false; btn.textContent = 'Send for checking';
      toast(e.message === 'code' || /permission/i.test(e.message) ? "That club code doesn't match. Ask your coach or the club." : 'Couldn\'t send it. Check your connection and try again.', 1);
    }
  }
  render();
};
function shrinkImage(file, max, q){
  return new Promise((res, rej) => { const img = new Image(); const url = URL.createObjectURL(file);
    img.onload = () => { const s = Math.min(1, max / Math.max(img.width, img.height)); const c = document.createElement('canvas'); c.width = Math.round(img.width*s); c.height = Math.round(img.height*s); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url); res(c.toDataURL('image/jpeg', q)) };
    img.onerror = rej; img.src = url });
}

/* ---------- admin ---------- */
V.admin = async (sub, arg) => {
  setHead('Admin', AUTH.admin ? (S.mode==='demo' ? 'Demo admin' : AUTH.email) : 'Moderators only', '#more');
  if(!AUTH.admin){
    $('#view').innerHTML = `<div class="cd" style="text-align:center;padding:26px 16px"><img src="assets/crest.png" alt="" style="width:80px"><div class="h2">Moderators</div>
      <p class="mut">${S.mode==='demo' ? 'Demo mode: anyone can open the admin area to try it. Nothing leaves this browser.' : AUTH.email ? `You're signed in as ${esc(AUTH.email)}, but that account isn't a moderator. Ask Milo to add you.` : 'Sign in with the Google account Milo added as a moderator.'}</p>
      <button class="btn block" id="aIn">${S.mode==='demo' ? 'Open admin (demo)' : 'Sign in with Google'}</button>${AUTH.email && S.mode!=='demo' ? '<button class="btn g block" id="aOut" style="margin-top:8px">Sign out</button>' : ''}</div>`;
    $('#aIn').onclick = async () => { try { await S.signIn() } catch(e){ console.warn('sign-in', e); toast('Sign-in didn\'t finish: ' + (e.code || e.message || 'unknown'), 1) } };
    if($('#aOut')) $('#aOut').onclick = () => S.signOut();
    return;
  }
  sub = sub || 'queue';
  const subs = await S.listSubmissions();
  const pending = subs.filter(s => s.status === 'pending');
  const tabs = [['queue',`Score-sheets${pending.length?` (${pending.length})`:''}`,'sheets'],['fixtures','Fixtures','fixtures'],['rosters','Rosters','rosters'],['underage','Underage','underage'],['carousel','Carousel','carousel'],['mods','Moderators','owner'],['settings','Settings','any']].filter(t => t[2]==='any' || (t[2]==='owner' ? AUTH.role==='owner' : can(t[2])));
  if(sub === 'sheet' && !can('sheets')) sub = tabs[0][0];
  if(!tabs.find(t => t[0] === (sub==='sheet'?'queue':sub))) sub = tabs[0][0];
  const nav = `<nav class="atabs">${tabs.map(t=>`<a href="#admin/${t[0]}" class="${(sub==='sheet'?'queue':sub)===t[0]?'on':''}">${t[1]}</a>`).join('')}</nav>`;
  $('#view').classList.toggle('wide', sub === 'carousel');
  if(sub === 'queue'){
    const done = subs.filter(s => s.status !== 'pending').slice(0, 15);
    const item = s => { const tot = (s.lines||[]).reduce((a,l)=>a+(+l.pts||0),0); return `<a class="cd qitem" href="#admin/sheet/${encodeURIComponent(s.id)}" style="border-left-color:${s.status==='pending'?'var(--orange)':s.status==='approved'?'var(--ok)':'var(--no)'}"><div class="row sp"><b>${esc(s.team)} v ${esc(oname(s.o))}</b><span class="pill ${s.status==='pending'?'p-warn':s.status==='approved'?'p-ok':'p-no'}">${s.status==='pending'?'Waiting':s.status==='approved'?'Live':'Rejected'}</span></div><div class="sm mut">${s.d?fmtDate(s.d):''} · ${s.us}–${s.th} · sent by ${esc(s.by)}${s.example?' · example':''}</div>${tot!==+s.us?`<div class="sm" style="color:var(--warn);margin-top:3px">Players add up to ${tot}, score says ${s.us}</div>`:''}</a>` };
    $('#view').innerHTML = nav + (pending.length ? `<div class="lbl">Waiting for a check · ${pending.length}</div>` + pending.map(item).join('') : '<div class="cd empty"><b>Nothing waiting</b>New score-sheets from coaches appear here.</div>') + (done.length ? `<div class="lbl" style="margin-top:8px">Recently checked</div>` + done.map(item).join('') : '');
    return;
  }
  if(sub === 'sheet'){
    const s = await S.getSubmission(arg);
    if(!s){ $('#view').innerHTML = nav + '<div class="empty"><b>Not found</b></div>'; return }
    const roster = await S.getRoster(s.team);
    const hiddenNos = new Set((roster.players||[]).filter(p=>p.hidden).map(p=>String(p.no)));
    $('#view').innerHTML = nav + `
      <div class="cd"><div class="row sp"><div><b style="font-family:var(--display);font-size:17px">${esc(s.team)} v ${esc(oname(s.o))}</b><div class="sm mut">${s.d?fmtDate(s.d,{weekday:'long',day:'numeric',month:'long'}):''} · ${esc(s.comp||'')}</div><div class="sm mut">Sent by ${esc(s.by)} · ${s.created?new Date(s.created).toLocaleString('en-IE'):''}</div></div><span class="pill ${s.status==='pending'?'p-warn':s.status==='approved'?'p-ok':'p-no'}">${s.status}</span></div></div>
      <div class="grid2"><label class="fld"><span>Éanna score</span><input id="eUs" value="${esc(s.us)}" inputmode="numeric"></label><label class="fld"><span>${esc(oname(s.o))}</span><input id="eTh" value="${esc(s.th)}" inputmode="numeric"></label></div>
      <div class="cd"><div class="lbl" style="margin-bottom:6px">Players · edit anything before approving</div><div class="tscroll"><table class="bx"><thead><tr><th>No.</th><th>Name</th><th class="r">Pts</th><th class="r">Hide</th></tr></thead><tbody id="eRows">${(s.lines||[]).map(l=>`<tr><td><input class="num" value="${esc(l.no)}"></td><td><input value="${esc(l.name)}"></td><td class="r"><input class="pts" value="${esc(l.pts)}" inputmode="numeric"></td><td class="r"><button class="tog ${l.hidden||hiddenNos.has(String(l.no))?'on':''}" aria-label="Hide this player"></button></td></tr>`).join('')}</tbody></table></div>
        <button class="btn g sm" id="eAdd" style="margin-top:8px">+ Add player</button><div id="eCheck" class="banner" style="margin-top:10px"></div>
        <div class="sm mut" style="margin-top:8px">Public view for this team: <b>${({full:'full names and points',first:'first names and points',results:'result only, no player points',hidden:'team hidden'})[modeFor(s.team)]}</b> (Admin › Underage).${!isSenior(s.team)?' Players on 0 are never shown for underage teams.':''}</div></div>
      <div class="cd"><div class="lbl" style="margin-bottom:6px">Player of the game · coach's pick</div>
        <label class="fld"><span>Player</span><select id="eP"><option value="">None</option>${(s.lines||[]).map(l=>`<option value="${esc(l.no)}|${esc(l.name)}" ${s.potg&&String(s.potg.no)===String(l.no)?'selected':''}>${esc(l.no)} · ${esc(l.name)}</option>`).join('')}</select></label>
        <label class="fld" style="margin-top:8px"><span>Coach's note (you can edit or clear it)</span><input id="eN" maxlength="160" value="${esc(s.potg?s.potg.note:'')}"></label></div>
      ${s.photo ? `<div class="cd"><div class="lbl" style="margin-bottom:6px">Score-sheet photo</div><img class="photo" src="${s.photo}" alt="Score-sheet photo"></div>` : '<div class="sm mut">No photo was attached.</div>'}
      <div class="btns"><button class="btn" id="eOk">${s.status==='approved'?'Save & republish':'Approve & publish'}</button><button class="btn r" id="eNo">${s.status==='approved'?'Unpublish':'Reject'}</button></div>
      <button class="btn g block" id="eDel">Delete this score-sheet</button>`;
    const read = () => $$('#eRows tr').map(tr => { const ins = $$('input', tr); return { no: ins[0].value.trim(), name: ins[1].value.trim(), pts: parseInt(ins[2].value,10) || 0, hidden: $('.tog', tr).classList.contains('on') } }).filter(l => l.no || l.name);
    const chk = () => { const t = read().reduce((a,l)=>a+l.pts,0), u = parseInt($('#eUs').value,10); const b = $('#eCheck'); b.className = 'banner ' + (t===u?'b-ok':'b-warn'); b.innerHTML = t===u ? `Adds up to <b>${t}</b> ✓` : `Players add up to <b>${t}</b>, Éanna score is <b>${u}</b>` };
    $('#eRows').oninput = chk; $('#eUs').oninput = chk; chk();
    $('#eRows').onclick = e => { const t = e.target.closest('.tog'); if(t){ t.classList.toggle('on') } };
    $('#eAdd').onclick = () => { $('#eRows').insertAdjacentHTML('beforeend', '<tr><td><input class="num"></td><td><input></td><td class="r"><input class="pts" inputmode="numeric"></td><td class="r"><button class="tog" aria-label="Hide this player"></button></td></tr>') };
    $('#eOk').onclick = async () => {
      const lines = read(); const pv = $('#eP').value; const [pno, ...pn] = pv.split('|');
      const potg = pv ? { no: pno, name: (lines.find(l => String(l.no) === String(pno)) || {}).name || pn.join('|'), note: $('#eN').value.trim() } : null;
      const patch = { potg, lines, us: parseInt($('#eUs').value,10)||0, th: parseInt($('#eTh').value,10)||0, status:'approved', checkedBy: AUTH.email || 'admin', checked: new Date().toISOString() };
      await S.updateSubmission(s.id, patch);
      // remember names in the roster (keeps hidden flags)
      const r = await S.getRoster(s.team); const ps = r.players || [];
      lines.forEach(l => { const ex = ps.find(p => String(p.no) === String(l.no)); if(ex){ ex.name = l.name; if(l.hidden) ex.hidden = true } else ps.push({ no:l.no, name:l.name, hidden: !!l.hidden }) });
      await S.saveRoster(s.team, ps);
      const box = publicBox({ ...s, ...patch }, { players: ps });
      if(box.mode === 'hidden') await S.deleteBoxscore(s.gameKey); else await S.putBoxscore(s.gameKey, box);
      await loadBoxes(); toast('Approved and published'); location.hash = '#admin/queue';
    };
    $('#eNo').onclick = async () => { await S.updateSubmission(s.id, { status:'rejected' }); await S.deleteBoxscore(s.gameKey); await loadBoxes(); toast(s.status==='approved'?'Unpublished':'Rejected'); location.hash = '#admin/queue' };
    $('#eDel').onclick = async () => { if($('#eDel').dataset.sure){ await S.deleteSubmission(s.id); if(s.status==='approved') await S.deleteBoxscore(s.gameKey); await loadBoxes(); toast('Deleted'); location.hash = '#admin/queue' } else { $('#eDel').dataset.sure = 1; $('#eDel').textContent = 'Tap again to delete for good' } };
    return;
  }
  if(sub === 'fixtures'){
    const preKey = arg || '';
    const pre = preKey ? G.find(g => gameKey(g) === preKey) : null;
    const teams = [...new Set(G.map(g => g.team))].sort();
    const cur = pre ? pre.team : lsGet('eanna-hub-fx-team', teams[0]);
    const list = G.filter(g => g.team === cur && (!g.d || g.d >= addDays(TODAY, -21))).sort((a,b)=>(a.d||'9999').localeCompare(b.d||'9999'));
    const edited = new Set(EDITS.map(e => e.key));
    const form = g => `<form class="cd" data-fk="${esc(gameKey(g))}" ${gameKey(g)===preKey?'':'hidden'} style="display:grid;gap:8px;background:var(--soft)">
      <div class="grid2"><label class="fld"><span>Date</span><input type="date" name="d" value="${esc(g.d||'')}"></label><label class="fld"><span>Time</span><input type="time" name="tm" value="${esc(g.tm||'')}"></label></div>
      <label class="fld"><span>Venue</span><input name="v" value="${esc(g.v||'')}"></label>
      <label class="fld"><span>Status</span><select name="status"><option value="">On as planned</option>${['Postponed','Cancelled'].map(x=>`<option ${g.status===x?'selected':''}>${x}</option>`).join('')}</select></label>
      <label class="fld"><span>Note for players and parents</span><input name="note" maxlength="160" value="${esc(g.note||'')}"></label>
      <div class="btns"><button class="btn" type="submit">Save</button>${edited.has(gameKey(g)) ? `<button class="btn g" type="button" data-undo>${g.b==='ADD'?'Delete game':'Undo my changes'}</button>` : '<span></span>'}</div></form>`;
    $('#view').innerHTML = nav + `
      <label class="fld"><span>Team</span><select id="xTeam">${teams.map(n=>`<option ${n===cur?'selected':''}>${esc(n)}</option>`).join('')}</select></label>
      <div class="cd">${list.length ? list.map(g => `<div><div class="row" style="padding:8px 0;border-bottom:1px solid var(--line)"><div class="f"><b>${g.d?fmtDate(g.d):'Date TBC'} · v ${esc(oname(g.o))}</b><div class="sm mut">${esc(g.c)} · ${g.d?fmtTime(g.tm):''} · ${esc(g.v||'Venue TBC')}${g.status?` · <b>${esc(g.status)}</b>`:''}${edited.has(gameKey(g))?' · <span class="pill p-pu">Edited</span>':''}</div></div><button class="btn g sm" data-open="${esc(gameKey(g))}">Edit</button></div>${form(g)}</div>`).join('') : '<div class="empty"><b>No games from the last 3 weeks on</b></div>'}</div>
      <form class="cd" id="xAdd" style="display:grid;gap:8px"><div class="lbl">Add a game · friendly, blitz, tournament</div>
        <div class="grid2"><label class="fld"><span>Type</span><select name="type"><option>Friendly</option><option>Blitz</option><option>Tournament</option><option>National Cup</option><option>Other</option></select></label><label class="fld"><span>Home or away</span><select name="h"><option value="1">Home</option><option value="0">Away</option></select></label></div>
        <label class="fld"><span>Opponent or event name</span><input name="o" required></label>
        <div class="grid2"><label class="fld"><span>Date</span><input type="date" name="d" required></label><label class="fld"><span>Time</span><input type="time" name="tm"></label></div>
        <label class="fld"><span>Venue</span><input name="v"></label>
        <button class="btn or" type="submit">Add to ${esc(cur)}</button></form>
      <div class="sm mut">Changes show for everyone straight away. The weekly fixtures refresh never overwrites them. Coaches and managers will be able to do this too once they have accounts (Stage 2).</div>`;
    $('#xTeam').onchange = e => { lsSet('eanna-hub-fx-team', e.target.value); location.hash = '#admin/fixtures' ; V.admin('fixtures') };
    $$('[data-open]').forEach(b => b.onclick = () => { const f = $(`form[data-fk="${CSS.escape(b.dataset.open)}"]`); f.hidden = !f.hidden });
    $$('form[data-fk]').forEach(f => {
      f.onsubmit = async e => { e.preventDefault(); const k = f.dataset.fk; const g = G.find(x => gameKey(x) === k); const v = Object.fromEntries(new FormData(f));
        const base = g.b === 'ADD' ? (EDITS.find(x => x.key === k) || {}) : {};
        await S.putFixtureEdit(k, { ...base, d: v.d || null, tm: v.tm || null, v: v.v, status: v.status, note: v.note, by: AUTH.email || 'moderator' }); toast('Fixture saved'); setTimeout(()=>location.reload(), 500) };
      const u = $('[data-undo]', f); if(u) u.onclick = async () => { await S.deleteFixtureEdit(f.dataset.fk); toast('Done'); setTimeout(()=>location.reload(), 500) };
    });
    $('#xAdd').onsubmit = async e => { e.preventDefault(); const v = Object.fromEntries(new FormData(e.target)); const src = G.find(g => g.team === cur) || {};
      await S.putFixtureEdit('ADD:' + S.uid(), { added:true, team:cur, sex: sexOf(src), k:v.type, c:v.type, o:v.o, h:+v.h, d:v.d, tm:v.tm||null, v:v.v, status:'', note:'', by: AUTH.email || 'moderator' });
      toast('Game added'); setTimeout(()=>location.reload(), 500) };
    return;
  }
  if(sub === 'mods'){
    const admins = await S.listAdmins();
    const permRow = (p, on) => `<div class="trow sm"><span>${p[1]}</span><button type="button" class="tog ${on?'on':''}" data-p="${p[0]}" aria-label="${esc(p[1])}"></button></div>`;
    $('#view').innerHTML = nav + `<div class="banner b-pu">Only owners can add or remove moderators. You choose what each moderator can do, and you can change it at any time. Owners (you and your backup admin) can do everything.</div>` +
      admins.map(a => `<form class="cd" data-em="${esc(a.email)}" style="display:grid;gap:4px"><div class="row sp"><b>${esc(a.name || a.email)}</b><select name="role" class="pill p-nv" style="border:0"><option value="moderator" ${a.role!=='owner'?'selected':''}>Moderator</option><option value="owner" ${a.role==='owner'?'selected':''}>Owner</option></select></div><div class="sm mut">${esc(a.email)}</div>
        <div ${a.role==='owner'?'hidden':''} data-perms>${PERMS.map(p => permRow(p, (a.perms||{})[p[0]])).join('')}</div>
        <div class="btns"><button class="btn sm" type="submit">Save</button>${a.email===AUTH.email ? '<span class="sm mut" style="align-self:center">This is you</span>' : '<button class="btn r sm" type="button" data-rm>Remove</button>'}</div></form>`).join('') +
      `<form class="cd" id="mAdd" style="display:grid;gap:6px"><div class="lbl">Invite a moderator</div>
        <div class="grid2"><label class="fld"><span>Name</span><input name="name" required></label><label class="fld"><span>Google email</span><input name="email" type="email" required></label></div>
        <label class="fld"><span>Role</span><select name="role"><option value="moderator">Moderator</option><option value="owner">Owner (backup admin)</option></select></label>
        <div data-perms>${PERMS.map(p => permRow(p, ['sheets','fixtures'].includes(p[0]))).join('')}</div>
        <button class="btn or" type="submit">Add moderator</button>
        <div class="sm mut">They sign in at More › Admin with that Google account. Tell them once you've added them.</div></form>`;
    const wire = f => { f.onclick = e => { const t = e.target.closest('.tog'); if(t) t.classList.toggle('on') }; const r = $('[name=role]', f); r.onchange = () => { $('[data-perms]', f).hidden = r.value === 'owner' } };
    const read = f => { const perms = {}; $$('[data-p]', f).forEach(t => perms[t.dataset.p] = t.classList.contains('on')); return { role: $('[name=role]', f).value, perms } };
    $$('form[data-em]').forEach(f => { wire(f);
      f.onsubmit = async e => { e.preventDefault(); const a = admins.find(x => x.email === f.dataset.em); await S.putAdmin(f.dataset.em, { name: a.name || '', added: a.added || '', ...read(f) }); toast('Saved') };
      const rm = $('[data-rm]', f); if(rm) rm.onclick = async () => { if(!rm.dataset.sure){ rm.dataset.sure = 1; rm.textContent = 'Tap again'; return } await S.deleteAdmin(f.dataset.em); toast('Removed'); V.admin('mods') } });
    const add = $('#mAdd'); wire(add);
    add.onsubmit = async e => { e.preventDefault(); const em = $('[name=email]', add).value.trim().toLowerCase(); await S.putAdmin(em, { name: $('[name=name]', add).value.trim(), ...read(add), added: new Date().toISOString() }); toast('Moderator added'); V.admin('mods') };
    return;
  }
  if(sub === 'rosters'){
    const teams = [...new Set(G.map(g => g.team))].sort();
    const cur = arg ? decodeURIComponent(arg) : (lsGet('eanna-hub-roster-team', teams[0]));
    const r = await S.getRoster(cur);
    $('#view').innerHTML = nav + `
      <label class="fld"><span>Team</span><select id="rTeam">${teams.map(n=>`<option ${n===cur?'selected':''}>${esc(n)}</option>`).join('')}</select></label>
      <div class="cd"><div class="lbl" style="margin-bottom:6px">Players · ${(r.players||[]).length}</div>
      <div class="tscroll"><table class="bx"><thead><tr><th>No.</th><th>Name</th><th class="r">Hide stats</th><th></th></tr></thead><tbody id="rRows">${(r.players||[]).map(p=>rRow(p)).join('')}</tbody></table></div>
      <button class="btn g sm" id="rAdd" style="margin-top:8px">+ Add player</button>
      <div class="sm mut" style="margin-top:8px">"Hide stats" keeps a player off every public page, for example if a parent asks. Moderators still see them. Names fill in automatically when you approve score-sheets.</div></div>
      <button class="btn block" id="rSave">Save roster &amp; update public pages</button>`;
    $('#rTeam').onchange = e => { lsSet('eanna-hub-roster-team', e.target.value); location.hash = '#admin/rosters/' + encodeURIComponent(e.target.value) };
    $('#rAdd').onclick = () => $('#rRows').insertAdjacentHTML('beforeend', rRow({ no:'', name:'', hidden:false }));
    $('#rRows').onclick = e => { const t = e.target.closest('.tog'); if(t) t.classList.toggle('on'); const x = e.target.closest('[data-rm]'); if(x) x.closest('tr').remove() };
    $('#rSave').onclick = async () => { const ps = $$('#rRows tr').map(tr => { const i = $$('input', tr); return { no: i[0].value.trim(), name: i[1].value.trim(), hidden: $('.tog', tr).classList.contains('on') } }).filter(p => p.no || p.name);
      await S.saveRoster(cur, ps); await republishAll(); toast('Roster saved') };
    return;
  }
  if(sub === 'underage'){
    const u = (SETTINGS && SETTINGS.underage) || {};
    const groups = [['u11-12','Academy to U12'],['u13-16','U13 to U16'],['u17-20','U17 to U20']];
    const opts = [['hidden','Hidden'],['results','Results only'],['first','First names'],['full','Full names']];
    const desc = { hidden:'Teams in this age group are hidden from the public site.', results:'Team results only. No player names or points.', first:'Scorers shown by first name only. Players on 0 are never shown.', full:'Scorers shown by full name. Players on 0 are never shown.' };
    $('#view').innerHTML = nav + groups.map(([k,l]) => `<div class="cd"><b style="font-family:var(--display)">${l}</b><div class="seg" style="margin-top:8px" data-ag="${k}">${opts.map(o=>`<button data-v="${o[0]}" class="${(u[k]||'results')===o[0]?'on':''}">${o[1]}</button>`).join('')}</div><div class="sm mut" style="margin-top:6px" id="d-${k}">${desc[u[k]||'results']}</div></div>`).join('') +
      `<div class="banner b-pu">Senior teams always show full stats. Players can still be hidden one by one in Rosters. Underage photos aren't part of the hub.</div><button class="btn block" id="uSave">Save &amp; update public pages</button>`;
    $$('[data-ag]').forEach(seg => seg.onclick = e => { const b = e.target.closest('button'); if(!b) return; $$('button', seg).forEach(x => x.classList.toggle('on', x===b)); $('#d-'+seg.dataset.ag).textContent = desc[b.dataset.v] });
    $('#uSave').onclick = async () => { const nu = {}; $$('[data-ag]').forEach(seg => nu[seg.dataset.ag] = $('button.on', seg).dataset.v); SETTINGS = { ...(SETTINGS||{}), underage: nu }; await S.setSettings(SETTINGS); await republishAll(); toast('Saved. Public pages updated') };
    return;
  }
  if(sub === 'carousel'){ return Carousel.view(nav) }
  if(sub === 'settings'){
    const code = can('settings') ? await S.getClubCode() : '';
    $('#view').innerHTML = nav + `
      <div class="cd" ${can("settings")?"":"hidden"}><div class="lbl">Club code</div><div class="row" style="margin-top:8px"><label class="fld f"><span>Coaches type this to send a score-sheet</span><input id="cCode" value="${esc(code)}" autocapitalize="characters"></label><button class="btn sm" id="cSave">Save</button></div><div class="sm mut" style="margin-top:6px">Change it if it gets shared outside the club, then post the new one in the coaches' group.</div></div>
      <div class="cd"><div class="lbl">Mode</div><p class="sm" style="margin:6px 0 0">${S.mode==='demo' ? '<b>Demo mode.</b> Everything is saved in this browser only. Follow README.md to connect the free Firebase project and go live.' : `<b>Live.</b> Signed in as ${esc(AUTH.email)}.`}</p></div>
      <div class="cd" ${can("settings")?"":"hidden"}><div class="lbl">Backup</div><p class="sm" style="margin:6px 0 8px">Download every roster, score-sheet and setting as one file.</p><button class="btn g" id="cExp">Download backup</button></div>
      ${S.mode==='demo' ? '<button class="btn r block" id="cReset">Reset demo data</button>' : ''}
      <button class="btn g block" id="cOut">Sign out</button>`;
    $('#cSave').onclick = async () => { const v = $('#cCode').value.trim().toUpperCase(); if(v.length < 4) return toast('Use at least 4 letters or numbers', 1); await S.setClubCode(v); toast('Club code saved') };
    $('#cExp').onclick = async () => { const blob = new Blob([JSON.stringify(await S.exportAll(), null, 1)], { type:'application/json' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `eanna-hub-backup-${TODAY}.json`; a.click() };
    if($('#cReset')) $('#cReset').onclick = () => S.resetDemo();
    $('#cOut').onclick = async () => { await S.signOut(); location.hash = '#home' };
  }
};
const rRow = p => `<tr><td><input class="num" value="${esc(p.no)}"></td><td><input value="${esc(p.name)}"></td><td class="r"><button class="tog ${p.hidden?'on':''}" aria-label="Hide this player's stats"></button></td><td class="r"><button class="btn g sm" data-rm aria-label="Remove">✕</button></td></tr>`;

/* ---------- carousel ---------- */
const Carousel = {
  imgs: {},
  // Load an image and trim its transparent/white edges so logos draw at their real size
  load(src){ return this.imgs[src] || (this.imgs[src] = new Promise(r => { const i = new Image(); i.onload = () => r(this.trim(i)); i.onerror = () => r(null); i.src = src })) },
  trim(img){
    const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const x = c.getContext('2d'); x.drawImage(img, 0, 0);
    const d = x.getImageData(0, 0, c.width, c.height).data; let t = c.height, b = 0, l = c.width, rr = 0;
    for(let y = 0; y < c.height; y++) for(let xx = 0; xx < c.width; xx++){ const k = (y*c.width+xx)*4; const solid = d[k+3] > 20 && !(d[k] > 245 && d[k+1] > 245 && d[k+2] > 245);
      if(solid){ if(y<t) t=y; if(y>b) b=y; if(xx<l) l=xx; if(xx>rr) rr=xx } }
    if(rr <= l || b <= t) return c;
    const o = document.createElement('canvas'); o.width = rr-l+1; o.height = b-t+1; o.getContext('2d').drawImage(c, l, t, o.width, o.height, 0, 0, o.width, o.height); return o;
  },
  async view(nav){
    const weeks = [...new Set(Object.values(BOXES).filter(b=>b.d).map(b => monday(b.d)))].sort().reverse();
    const wk = weeks.includes(Carousel.wk) ? Carousel.wk : (weeks[0] || currentWeek());
    $('#view').innerHTML = nav + `<div class="cd row wrap"><label class="fld f" style="min-width:200px"><span>Week</span><select id="kWeek">${(weeks.length?weeks:[wk]).map(w=>`<option value="${w}" ${w===wk?'selected':''}>${fmtDate(w,{day:'numeric',month:'short'})} – ${fmtDate(addDays(w,6),{day:'numeric',month:'short'})}</option>`).join('')}</select></label><button class="btn or" id="kAll">Download all</button></div>
      <div class="sm mut">Instagram 4:5 (1080 × 1350). Built from approved score-sheets and this week's results. Check the names and numbers before posting.</div>
      <div class="slides" id="kSlides"><div class="empty"><b>Drawing slides…</b></div></div>`;
    $('#kWeek').onchange = e => { Carousel.wk = e.target.value; Carousel.view(nav) };
    await Promise.all([document.fonts.load('900 80px Montserrat'), document.fonts.load('500 30px Montserrat'), document.fonts.load('80px Anton'), document.fonts.load('900 italic 40px Montserrat'), document.fonts.load('600 30px "Source Sans 3"')]).catch(()=>{});
    const slides = await Carousel.build(wk);
    const box = $('#kSlides'); box.innerHTML = '';
    slides.forEach((c, i) => { const w = document.createElement('div'); w.style.display='grid'; w.style.gap='8px'; c.className = 'slide'; w.appendChild(c); const b = document.createElement('button'); b.className = 'btn g sm'; b.textContent = `Download slide ${i+1}`; b.onclick = () => Carousel.save(c, `eanna-top-performers-${wk}-${i+1}.png`); w.appendChild(b); box.appendChild(w) });
    $('#kAll').onclick = () => slides.forEach((c, i) => setTimeout(() => Carousel.save(c, `eanna-top-performers-${wk}-${i+1}.png`), i*400));
  },
  save(c, name){ c.toBlob(b => { const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = name; a.click() }, 'image/png') },
  async base(ctx, dark){
    const W = 1080, H = 1350;
    if(dark){ const g = ctx.createLinearGradient(0,0,W,H); g.addColorStop(0,'#1a1730'); g.addColorStop(.6,'#110E12'); g.addColorStop(1,'#1c1840'); ctx.fillStyle = g; ctx.fillRect(0,0,W,H);
      const r = ctx.createRadialGradient(160,120,10,160,120,900); r.addColorStop(0,'rgba(163,103,175,.55)'); r.addColorStop(1,'rgba(163,103,175,0)'); ctx.fillStyle = r; ctx.fillRect(0,0,W,H) }
    else { ctx.fillStyle = '#fff'; ctx.fillRect(0,0,W,H);
      const g = ctx.createLinearGradient(500,0,W,H); g.addColorStop(0,'#2B2763'); g.addColorStop(.55,'#5B4799'); g.addColorStop(1,'#A367AF');
      ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(W,0); ctx.lineTo(700,0); ctx.bezierCurveTo(980,300,560,700,860,1000); ctx.bezierCurveTo(960,1120,900,1260,820,H); ctx.lineTo(W,H); ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(223,219,231,.7)'; ctx.beginPath(); ctx.moveTo(0,H); ctx.bezierCurveTo(200,1180,120,1100,0,1020); ctx.closePath(); ctx.fill() }
    // court lines
    ctx.save(); ctx.strokeStyle = dark ? 'rgba(255,255,255,.07)' : 'rgba(255,255,255,.18)'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(W*.85, H*.72, 170, 0, Math.PI*2); ctx.stroke(); ctx.beginPath(); ctx.ellipse(W, H*.72, 520, 380, 0, Math.PI*.5, Math.PI*1.5); ctx.stroke(); ctx.restore();
    // grain
    const img = ctx.getImageData(0,0,W,H), d = img.data; for(let i=0;i<d.length;i+=4){ const n = (Math.random()-.5)*18; d[i]+=n; d[i+1]+=n; d[i+2]+=n } ctx.putImageData(img,0,0);
  },
  async sponsors(ctx, dark){
    const [gc, cr, up] = await Promise.all([this.load(dark?'assets/griffith-college-white.png':'assets/griffith-college-black.png'), this.load(dark?'assets/crest-dark.png':'assets/crest.png'), this.load(dark?'assets/upmc-ssc-white.png':'assets/upmc-ssc-colour.png')]);
    // fit inside a box (max width × max height), centred on x, vertically centred on y
    const fit = (im, x, y, mw, mh) => { if(!im) return; const s = Math.min(mw/im.width, mh/im.height); const w = im.width*s, h = im.height*s; ctx.drawImage(im, x - w/2, y - h/2, w, h) };
    fit(gc, 190, 115, 250, 90); fit(cr, 540, 115, 200, 170); fit(up, 890, 115, 250, 80);
  },
  gradText(ctx, txt, x, y, size, align, maxW){ ctx.font = `900 ${size}px Montserrat`; if(maxW){ while(size > 30 && ctx.measureText(txt).width > maxW){ size -= 4; ctx.font = `900 ${size}px Montserrat` } } ctx.textAlign = align || 'left'; const w = ctx.measureText(txt).width; const x0 = align==='center' ? x-w/2 : x; const g = ctx.createLinearGradient(x0,0,x0+w,0); g.addColorStop(0,'#2B2763'); g.addColorStop(.52,'#5B4799'); g.addColorStop(1,'#A367AF'); ctx.lineJoin = 'round'; ctx.lineWidth = 14; ctx.strokeStyle = '#fff'; ctx.strokeText(txt, x, y); ctx.fillStyle = g; ctx.fillText(txt, x, y) },
  jersey(ctx, x, y, s, num, women){
    ctx.save(); ctx.translate(x, y); ctx.scale(s/40, s/40);
    const p = new Path2D('M12 2Q20 8 28 2L38 7 35.5 17 31 15.5V42H9V15.5L4.5 17 2 7Z'); const g = ctx.createRadialGradient(14,8,1,20,20,30); g.addColorStop(0,'#3a3550'); g.addColorStop(.6,'#110E12'); ctx.fillStyle = g; ctx.fill(p);
    const pg = ctx.createLinearGradient(0,17,0,42); if(women){ pg.addColorStop(0,'#A367AF'); pg.addColorStop(1,'#E0457B') } else { pg.addColorStop(0,'#2B2763'); pg.addColorStop(.6,'#5B4799'); pg.addColorStop(1,'#A367AF') }
    ctx.fillStyle = pg; ctx.fillRect(9,17,3.2,25); ctx.fillRect(27.8,17,3.2,25);
    ctx.strokeStyle = women ? '#A367AF' : '#E0457B'; ctx.lineWidth = 1.8; ctx.beginPath(); ctx.moveTo(12,2); ctx.quadraticCurveTo(20,9.5,28,2); ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.font = '14px Anton'; ctx.textAlign = 'center'; ctx.fillText(String(num), 20, 33); ctx.restore();
  },
  async build(wk){
    const end = addDays(wk, 6), tp = topPerformers(wk, end), range = `${fmtDate(wk,{day:'numeric',month:'short'})} – ${fmtDate(end,{day:'numeric',month:'short'})}`.toUpperCase();
    const mk = () => { const c = document.createElement('canvas'); c.width = 1080; c.height = 1350; return c };
    const out = [];
    // 1 cover
    { const c = mk(), x = c.getContext('2d'); await this.base(x, false); await this.sponsors(x, false);
      this.gradText(x, 'TOP', 80, 520, 190, 'left', 920); this.gradText(x, 'PERFORMERS', 80, 690, 150, 'left', 920);
      x.fillStyle = '#1C1B60'; x.font = '500 34px Montserrat'; x.textAlign = 'left'; x.letterSpacing = '10px'; x.fillText('ÉANNA BASKETBALL · ' + range, 84, 780); x.letterSpacing = '0px';
      const g = x.createLinearGradient(84,0,700,0); g.addColorStop(0,'#2B2763'); g.addColorStop(1,'#A367AF'); x.fillStyle = g; x.fillRect(84, 815, 600, 6);
      x.fillStyle = '#fff'; x.font = '800 40px Montserrat'; x.textAlign = 'right'; x.fillText('SWIPE ›', 1000, 1270); x.font = '600 30px "Source Sans 3"'; x.fillText('@eannabasketball', 1000, 1215);
      out.push(c) }
    // players of the game
    { const pg = potgList(wk, end).slice(0, 4);
      if(pg.length){ const c = mk(), x = c.getContext('2d'); await this.base(x, true); await this.sponsors(x, true);
        x.textAlign = 'left'; x.fillStyle = 'rgba(255,255,255,.75)'; x.font = '500 30px Montserrat'; x.fillText("COACHES' PICKS · " + range, 80, 300);
        x.fillStyle = '#fff'; let fs = 92; x.font = `900 ${fs}px Montserrat`; while(x.measureText('PLAYERS OF THE GAME').width > 920){ fs -= 4; x.font = `900 ${fs}px Montserrat` } x.fillText('PLAYERS OF THE GAME', 80, 400);
        pg.forEach((p, i) => { const y = 470 + i*205; x.fillStyle = 'rgba(255,255,255,.06)'; x.beginPath(); x.roundRect(60, y, 960, 180, 28); x.fill();
          this.jersey(x, 90, y+20, 130, p.no, p.sex==='w');
          x.textAlign = 'left'; x.fillStyle = '#fff'; x.font = '800 48px Montserrat'; x.fillText(String(p.name).toUpperCase().slice(0, 24), 250, y+70);
          x.fillStyle = 'rgba(255,255,255,.72)'; x.font = '600 30px "Source Sans 3"'; x.fillText(`${p.team} · v ${oname(p.o)}`.slice(0, 50), 250, y+112);
          if(p.note){ x.fillStyle = '#f6a676'; x.font = 'italic 600 28px "Source Sans 3"'; x.fillText(('“' + p.note + '”').slice(0, 60), 250, y+152) } });
        out.push(c) } }
    // 2–3 men / women
    for(const [sx, label] of [['m',"MEN'S & BOYS'"],['w',"WOMEN'S & GIRLS'"]]){
      const list = tp[sx].slice(0, 4); if(!list.length) continue;
      const c = mk(), x = c.getContext('2d'); await this.base(x, true); await this.sponsors(x, true);
      x.textAlign = 'left'; x.fillStyle = 'rgba(255,255,255,.75)'; x.font = '500 30px Montserrat'; x.letterSpacing = '8px'; x.fillText(label + ' · ' + range, 80, 300); x.letterSpacing = '0px';
      x.fillStyle = '#fff'; let fs = 92; x.font = `900 ${fs}px Montserrat`; while(x.measureText('TOP SCORERS').width > 920){ fs -= 4; x.font = `900 ${fs}px Montserrat` } x.fillText('TOP SCORERS', 80, 400);
      list.forEach((p, i) => { const y = 470 + i*205;
        x.fillStyle = 'rgba(255,255,255,.06)'; x.beginPath(); x.roundRect(60, y, 960, 180, 28); x.fill();
        x.fillStyle = '#D0653C'; x.font = '64px Anton'; x.textAlign = 'center'; x.fillText(String(i+1), 120, y+115);
        this.jersey(x, 170, y+20, 130, p.no, sx==='w');
        x.textAlign = 'left'; x.fillStyle = '#fff'; x.font = '800 50px Montserrat'; x.fillText(String(p.name).toUpperCase().slice(0, 22), 330, y+85);
        x.fillStyle = 'rgba(255,255,255,.72)'; x.font = '600 32px "Source Sans 3"'; x.fillText(`${p.team} · v ${oname(p.o)}`.slice(0, 44), 330, y+132);
        x.textAlign = 'right'; x.fillStyle = '#fff'; x.shadowColor = 'rgba(208,101,60,.7)'; x.shadowBlur = 30; x.font = '110px Anton'; x.fillText(String(p.pts), 990, y+125); x.shadowBlur = 0;
        x.font = '800 20px Montserrat'; x.fillStyle = 'rgba(255,255,255,.7)'; x.fillText('PTS', 990, y+158) });
      out.push(c) }
    // 4 results round-up
    { const gs = G.filter(g => g.d >= wk && g.d <= end && played(g) && visible(g.team)); const W = gs.filter(g=>g.us>g.th);
      const c = mk(), x = c.getContext('2d'); await this.base(x, false); await this.sponsors(x, false);
      this.gradText(x, 'WEEK IN', 80, 380, 120, 'left', 900); this.gradText(x, 'NUMBERS', 80, 500, 120, 'left', 900);
      x.textAlign='left'; x.fillStyle = '#1C1B60'; x.font = '150px Anton'; x.fillText(String(gs.length), 84, 680); x.font='800 34px Montserrat'; x.fillStyle='#5B4799'; x.fillText('GAMES PLAYED', 300, 640);
      x.fillStyle = '#1d7a4c'; x.font = '150px Anton'; x.fillText(String(W.length), 84, 860); x.font='800 34px Montserrat'; x.fillStyle='#5B4799'; x.fillText('WINS', 300, 820);
      const big = W.sort((a,b)=>(b.us-b.th)-(a.us-a.th))[0];
      if(big){ x.fillStyle = '#1C1B60'; x.font = '800 34px Montserrat'; x.fillText('BIGGEST WIN', 84, 980); x.font = '600 40px "Source Sans 3"'; x.fillText(`${big.team} ${big.us}–${big.th} v ${oname(big.o)}`.slice(0, 46), 84, 1036) }
      out.push(c) }
    return out;
  }
};

/* ---------- router ---------- */
async function route(){
  const h = decodeURIComponent(location.hash.slice(1) || 'home');
  const [r, a, b] = h.split('/');
  $('#view').classList.remove('wide');
  setTab(['home','results','teams','fixtures'].includes(r) ? r : r==='game' ? 'results' : (r==='team'||r==='player') ? 'teams' : 'more');
  window.scrollTo(0, 0);
  try {
    if(r === 'game') V.game(h.slice(5));
    else if(r === 'team') V.team(h.slice(5));
    else if(r === 'player'){ const i = h.lastIndexOf('/'); V.player(h.slice(7, i), h.slice(i+1)) }
    else if(r === 'submit') await V.submit(a ? h.slice(7) : null);
    else if(r === 'admin') await V.admin(a, b ? h.split('/').slice(2).join('/') : undefined);
    else (V[r] || V.home)();
  } catch(e){ console.error(e); $('#view').innerHTML = `<div class="empty"><b>Something went wrong</b>${esc(e.message)}</div>` }
}

/* ---------- demo examples ---------- */
async function seedDemo(){
  if(S.mode !== 'demo' || S.isSeeded()) return;
  const sl = G.find(g => g.team === "Men's Super League" && played(g) && g.us === 77 && /Tralee/.test(g.o)) || G.find(g => g.team === "Men's Super League" && played(g));
  const roster = [[0,'Adam McCarthy'],[2,"Cathal O'Sullivan"],[5,'Dean Kiernan'],[7,'Kiki'],[8,'Morgan Taylor'],[9,'Neil Lynch'],[10,'Sean Jenkins'],[11,'David George'],[12,'Nick Hopkins'],[13,'Karl Walsh'],[14,'Ian Lynch'],[17,'Harry Lynch'],[24,'Manou Christal'],[32,'Misha Kucheriavyi'],[36,'Neil Coughlan']];
  await S.saveRoster("Men's Super League", roster.map(([no,name]) => ({ no:String(no), name, hidden:false })));
  if(sl){
    const split = [5,2,9,10,8,24,13,14,0]; const w = [.27,.21,.14,.12,.1,.08,.05,.03,0];
    let pts = w.map(x => Math.floor(x*sl.us)); pts[0] += sl.us - pts.reduce((a,b)=>a+b,0);
    const lines = split.map((no,i) => ({ no:String(no), name: roster.find(r=>r[0]===no)[1], pts: pts[i] }));
    const sub = { team: sl.team, sex:'m', gameKey: gameKey(sl), d: sl.d, o: sl.o, comp: sl.c, us: sl.us, th: sl.th, lines, by:'Example (demo)', photo:'', example:true, potg:{ no:'5', name:'Dean Kiernan', note:'Example note: set the tone on both ends and hit the big shots late.' } };
    const id = await S.submitSheet(sub, CFG.demoClubCode);
    await S.updateSubmission(id, { status:'approved', checked: new Date().toISOString() });
    await S.putBoxscore(sub.gameKey, publicBox(sub, null));
  }
  const ug = G.filter(g => g.team === 'U18 Boys (1)' && played(g)).sort((a,b)=>b.d.localeCompare(a.d))[0];
  if(ug){
    const names = ['Seán','Liam','Cian','Oisín','Darragh','Evan','Rory','Adam'];
    const w = [.26,.2,.17,.13,.1,.09,.05,0]; let pts = w.map(x => Math.floor(x*ug.us)); pts[0] += ug.us - pts.reduce((a,b)=>a+b,0);
    await S.submitSheet({ team: ug.team, sex:'m', gameKey: gameKey(ug), d: ug.d, o: ug.o, comp: ug.c, us: ug.us, th: ug.th, lines: names.map((n,i)=>({ no:String([7,12,9,4,15,5,10,3][i]), name:n+' (example)', pts:pts[i] })), by:'Example coach (demo)', photo:'', example:true }, CFG.demoClubCode);
  }
  S.markSeeded();
}

/* ---------- start ---------- */
// Never let a slow or unreachable database hold up the public pages
const within = (p, ms, fallback) => Promise.race([p, new Promise(r => setTimeout(() => r(fallback), ms))]);
(async function start(){
  try {
    S = await HubStore.init();
    const r = await fetch('data/eanna-fixtures.json', { cache:'no-cache' });
    DATA = await r.json();
    G = DATA.games || []; T = DATA.teams || []; TB = DATA.tables || {};
    const DEF = { underage:{ "u11-12":"results", "u13-16":"first", "u17-20":"full" } };
    const [st, ed] = await Promise.all([within(S.getSettings().catch(()=>null), 5000, null), within(S.listFixtureEdits().catch(()=>[]), 5000, [])]);
    SETTINGS = st || DEF; EDITS = ed || [];
    EDITS.forEach(e => { if(e.added){ G.push({ b:'ADD', id: e.key.slice(4), team:e.team, sex:e.sex, k:e.k, c:e.c, o:e.o, h:e.h, d:e.d, tm:e.tm, v:e.v, status:e.status, note:e.note }) }
      else { const g = G.find(x => gameKey(x) === e.key); if(g) ['d','tm','v','status','note'].forEach(f => { if(e[f] !== undefined && e[f] !== '' && e[f] !== null) g[f] = e[f]; else if(f==='status'||f==='note') g[f] = e[f] || '' }) } });
    G.sort((a,b)=>((a.d||'9999')+(a.tm||'')).localeCompare((b.d||'9999')+(b.tm||'')));
    await seedDemo();
    await loadBoxes();
    S.onAuth(a => { const was = AUTH.admin; AUTH = a; if(was !== a.admin && location.hash.startsWith('#admin')) route() });
    window.addEventListener('hashchange', route);
    route();
  } catch(e){
    console.error(e);
    $('#view').innerHTML = `<div class="empty"><b>Couldn't load the hub</b>Check your connection and refresh the page.</div>`;
  }
})();
})();
