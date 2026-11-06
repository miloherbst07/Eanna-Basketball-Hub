// Data layer. Two back ends with the same functions:
//  - Demo: localStorage in this browser (used when HUB_CONFIG.firebase is null)
//  - Firebase: Firestore + Google sign-in (free Spark plan, no Storage needed)
//
// Collections
//  settings/public      { underage: {"u11-12":"results","u13-16":"first","u17-20":"full"} }
//  private/club         { code }                                       moderators with "settings"
//  members/{email}      { name, owner, roles:[roleId], teams:[team], perms:{task:'all'|'teams'} }  perms are worked out from roles
//  settings/roles       { roles: { roleId: { name, scope:'all'|'teams', perms:{task:true} } } }   public read
//  admins/{email}       legacy owner entry ({ role:'owner' }) from the first setup
//  rosters/{teamKey}    { team, players:[{no,name,hidden}] }            moderators only
//  submissions/{id}     { status, team, gameKey, lines, potg, ... }     anyone with the club code can create
//  boxscores/{gameKey}  { team, sex, lines, potg, mode, ... }           public, written on approve
//  fixtures/{gameKey}   { d, tm, v, status, note } or { added:true, ... } public, moderators with "fixtures"
(function(){
const CFG = window.HUB_CONFIG || {};
const LS = 'eanna-hub-demo-v1';
const ls = {
  load(){ try{ return JSON.parse(localStorage.getItem(LS)) || null }catch(e){ return null } },
  save(d){ try{ localStorage.setItem(LS, JSON.stringify(d)) }catch(e){ console.warn('save failed', e) } }
};
const DEFAULT_SETTINGS = { underage: { 'u11-12':'results', 'u13-16':'first', 'u17-20':'full' } };
// Every task the hub has. The third value: 1 = can be limited to a member's own teams.
const TASKS = [['sendSheets','Send score-sheets',1],['approveSheets','Check & approve score-sheets',0],['editFixtures','Edit fixtures & add games',1],['rosters','Rosters & hide players',0],['underage','Underage settings',0],['carousel','Make carousels',0],['settings','Backups & site settings',0],['members','Add members & choose their roles',0]];
const DEFAULT_ROLES = {
  coach:     { name:'Coach',        scope:'teams', perms:{ sendSheets:true, editFixtures:true } },
  manager:   { name:'Team manager', scope:'teams', perms:{ sendSheets:true, editFixtures:true } },
  moderator: { name:'Moderator',    scope:'all',   perms:{ sendSheets:true, approveSheets:true, editFixtures:true, rosters:true, underage:true, carousel:true, settings:true, members:true }, ownerOnly:true },
  committee: { name:'Committee',    scope:'all',   perms:{} },
  media:     { name:'Media team',   scope:'all',   perms:{ carousel:true } }
};
const ALL = Object.fromEntries(TASKS.map(t => [t[0], 'all']));
function effective(member, roles){
  const out = {};
  (member.roles || []).forEach(r => { const role = roles[r]; if(!role) return;
    TASKS.forEach(([t,, scopable]) => { if(role.perms && role.perms[t]){ const v = scopable && role.scope === 'teams' ? 'teams' : 'all'; out[t] = out[t] === 'all' ? 'all' : v } }) });
  return out;
}
const meFrom = (email, name, m) => {
  if(!m) return { admin:false, member:false, owner:false, email, name, perms:{}, teams:[], roles:[] };
  const owner = !!m.owner; const perms = owner ? ALL : (m.perms || {});
  return { admin: owner || Object.keys(perms).length > 0, member:true, owner, email, name: m.name || name, perms, teams: m.teams || [], roles: m.roles || [] };
};
window.HubRoles = { TASKS, DEFAULT_ROLES, effective };
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2,7);

/* ---------- demo back end ---------- */
function demoStore(){
  let db = ls.load();
  if(!db){ db = { settings: DEFAULT_SETTINGS, club:{ code: CFG.demoClubCode || 'EANNA26' }, rosters:{}, submissions:{}, boxscores:{}, fixtures:{}, seeded:false }; }
  db.fixtures = db.fixtures || {};
  db.members = db.members || { 'demo-admin': { name:'You (demo)', owner:true, roles:[], teams:[] } };
  db.roles = db.roles || JSON.parse(JSON.stringify(DEFAULT_ROLES));
  const persist = () => ls.save(db);
  let me = meFrom(null, '', null); const listeners = [];
  try { const who = sessionStorage.getItem('eanna-hub-demo-admin'); if(who) me = meFrom(who === '1' ? 'demo-admin' : who, '', db.members[who === '1' ? 'demo-admin' : who]) } catch(e){}
  const emit = () => { try { me.email ? sessionStorage.setItem('eanna-hub-demo-admin', me.email) : sessionStorage.removeItem('eanna-hub-demo-admin') } catch(e){} listeners.forEach(f => f({ ...me })) };
  return {
    mode: 'demo', uid,
    async getSettings(){ return db.settings || DEFAULT_SETTINGS },
    async setSettings(s){ db.settings = s; persist() },
    async getClubCode(){ return db.club.code },
    async setClubCode(c){ db.club.code = c; persist() },
    async getRoster(team){ return db.rosters[team] || { team, players: [] } },
    async listRosters(){ return Object.values(db.rosters) },
    async saveRoster(team, players){ db.rosters[team] = { team, players }; persist() },
    async submitSheet(sub){
      const p = me.perms.sendSheets; if(!p || (p === 'teams' && !me.teams.includes(sub.team))) throw new Error('permission');
      sub.byEmail = me.email;
      const id = uid(); db.submissions[id] = { ...sub, id, status:'pending', created: new Date().toISOString() }; persist(); return id;
    },
    async listSubmissions(){ return Object.values(db.submissions).sort((a,b)=>b.created.localeCompare(a.created)) },
    async getSubmission(id){ return db.submissions[id] || null },
    async updateSubmission(id, patch){ db.submissions[id] = { ...db.submissions[id], ...patch }; persist() },
    async deleteSubmission(id){ delete db.submissions[id]; persist() },
    async listBoxscores(){ return Object.values(db.boxscores) },
    async putBoxscore(key, box){ db.boxscores[key] = box; persist() },
    async deleteBoxscore(key){ delete db.boxscores[key]; persist() },
    async listFixtureEdits(){ return Object.entries(db.fixtures).map(([key, v]) => ({ key, ...v })) },
    async putFixtureEdit(key, v){ db.fixtures[key] = v; persist() },
    async deleteFixtureEdit(key){ delete db.fixtures[key]; persist() },
    async getRoles(){ return db.roles },
    async saveRoles(roles){ db.roles = roles; Object.entries(db.members).forEach(([e, m]) => { m.perms = effective(m, roles) }); persist() },
    async listMembers(){ return Object.entries(db.members).map(([email, v]) => ({ email, ...v })) },
    async putMember(email, v){ db.members[email] = { ...v, perms: effective(v, db.roles) }; persist(); if(email === me.email){ me = meFrom(email, me.name, db.members[email]); emit() } },
    async deleteMember(email){ delete db.members[email]; persist() },
    // demo only: see the hub as one of your members
    async viewAs(email){ me = meFrom(email, '', db.members[email]); emit() },
    onAuth(fn){ listeners.push(fn); fn({ ...me }) },
    async signIn(){ me = meFrom('demo-admin', 'You (demo)', db.members['demo-admin']); emit() },
    async signOut(){ me = meFrom(null, '', null); emit() },
    isSeeded(){ return db.seeded },
    markSeeded(){ db.seeded = true; persist() },
    async exportAll(){ return JSON.parse(JSON.stringify(db)) },
    async resetDemo(){ localStorage.removeItem(LS); location.reload() }
  };
}

/* ---------- Firebase back end ---------- */
async function firebaseStore(conf){
  const V = '10.12.2';
  const [{ initializeApp }, A, F] = await Promise.all([
    import(`https://www.gstatic.com/firebasejs/${V}/firebase-app.js`),
    import(`https://www.gstatic.com/firebasejs/${V}/firebase-auth.js`),
    import(`https://www.gstatic.com/firebasejs/${V}/firebase-firestore.js`)
  ]);
  const app = initializeApp(conf);
  const auth = A.getAuth(app);
  const db = F.getFirestore(app);
  const d = (...p) => F.doc(db, ...p);
  const all = async (name) => (await F.getDocs(F.collection(db, name))).docs.map(x => ({ id: x.id, ...x.data() }));
  let me = meFrom(null, '', null); const listeners = [];
  A.getRedirectResult(auth).catch(e => console.warn("sign-in", e.code));
  A.onAuthStateChanged(auth, async (u) => {
    me = meFrom(u ? u.email : null, u ? (u.displayName || '') : '', null);
    if(u){ try {
      const ms = await F.getDoc(d('members', u.email));
      if(ms.exists()) me = meFrom(u.email, u.displayName || '', ms.data());
      else { const a = await F.getDoc(d('admins', u.email)).catch(() => null);
        if(a && a.exists() && a.data().role === 'owner'){ // first setup: copy the owner entry into members
          const m = { name: a.data().name || u.displayName || '', owner:true, roles:[], teams:[], perms:{} };
          await F.setDoc(d('members', u.email), m).catch(() => {}); me = meFrom(u.email, u.displayName || '', m) } }
    } catch(e){ console.warn('member', e) } }
    listeners.forEach(f => f({ ...me }));
  });
  const safeKey = k => encodeURIComponent(k).replace(/\./g,'%2E');
  return {
    mode: 'live', uid,
    async getSettings(){ const s = await F.getDoc(d('settings','public')); return s.exists() ? s.data() : DEFAULT_SETTINGS },
    async setSettings(s){ await F.setDoc(d('settings','public'), { ...s, updated: F.serverTimestamp() }) },
    async getClubCode(){ const s = await F.getDoc(d('private','club')); return s.exists() ? s.data().code : '' },
    async setClubCode(code){ await F.setDoc(d('private','club'), { code }) },
    async getRoster(team){ const s = await F.getDoc(d('rosters', safeKey(team))); return s.exists() ? s.data() : { team, players: [] } },
    async listRosters(){ return all('rosters') },
    async saveRoster(team, players){ await F.setDoc(d('rosters', safeKey(team)), { team, players }) },
    async submitSheet(sub){
      const ref = await F.addDoc(F.collection(db,'submissions'), { ...sub, byEmail: me.email, status:'pending', created: new Date().toISOString() });
      return ref.id;
    },
    async listSubmissions(){ return (await all('submissions')).sort((a,b)=>(b.created||'').localeCompare(a.created||'')) },
    async getSubmission(id){ const s = await F.getDoc(d('submissions', id)); return s.exists() ? { id, ...s.data() } : null },
    async updateSubmission(id, patch){ await F.updateDoc(d('submissions', id), patch) },
    async deleteSubmission(id){ await F.deleteDoc(d('submissions', id)) },
    async listBoxscores(){ return all('boxscores') },
    async putBoxscore(key, box){ await F.setDoc(d('boxscores', safeKey(key)), box) },
    async deleteBoxscore(key){ await F.deleteDoc(d('boxscores', safeKey(key))) },
    async listFixtureEdits(){ return (await all('fixtures')).map(x => ({ ...x, key: x.key || decodeURIComponent(x.id) })) },
    async putFixtureEdit(key, v){ await F.setDoc(d('fixtures', safeKey(key)), { ...v, key }) },
    async deleteFixtureEdit(key){ await F.deleteDoc(d('fixtures', safeKey(key))) },
    async getRoles(){ const r = await F.getDoc(d('settings','roles')); return r.exists() ? r.data().roles : JSON.parse(JSON.stringify(DEFAULT_ROLES)) },
    async saveRoles(roles){ await F.setDoc(d('settings','roles'), { roles });
      for(const m of await all('members')) await F.updateDoc(d('members', m.id), { perms: effective(m, roles) }) },
    async listMembers(){ return (await all('members')).map(x => ({ email: x.id, ...x })) },
    async putMember(email, v){ const roles = await this.getRoles(); const e = email.trim().toLowerCase(); const doc = { name: v.name || '', owner: !!v.owner, roles: v.roles || [], teams: v.teams || [], perms: effective(v, roles) };
      await F.setDoc(d('members', e), doc); if(e === me.email){ me = meFrom(e, me.name, doc); listeners.forEach(f => f({ ...me })) } },
    async deleteMember(email){ await F.deleteDoc(d('members', email)) },
    onAuth(fn){ listeners.push(fn); fn({ ...me }) },
    async signIn(){
      const prov = new A.GoogleAuthProvider(); prov.setCustomParameters({ prompt:'select_account' });
      try { await A.signInWithPopup(auth, prov) }
      catch(e){
        // Pop-up blocked or closed by the browser: sign in on this page instead
        if(['auth/popup-blocked','auth/popup-closed-by-user','auth/cancelled-popup-request','auth/operation-not-supported-in-this-environment'].includes(e.code)) return A.signInWithRedirect(auth, prov);
        throw e;
      }
    },
    async signOut(){ await A.signOut(auth) },
    isSeeded(){ return true }, markSeeded(){},
    async exportAll(){ const out = {}; for(const n of ['rosters','submissions','boxscores','fixtures','members']) out[n] = await all(n); out.settings = await this.getSettings(); return out },
    async resetDemo(){}
  };
}

window.HubStore = {
  async init(){
    if(CFG.firebase){
      try{ return await firebaseStore(CFG.firebase) }
      catch(e){ console.error('Firebase failed, using demo mode', e) }
    }
    return demoStore();
  }
};
})();
