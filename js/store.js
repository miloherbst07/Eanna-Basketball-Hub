// Data layer. Two back ends with the same functions:
//  - Demo: localStorage in this browser (used when HUB_CONFIG.firebase is null)
//  - Firebase: Firestore + Google sign-in (free Spark plan, no Storage needed)
//
// Collections
//  settings/public      { underage: {"u11-12":"results","u13-16":"first","u17-20":"full"} }
//  private/club         { code }                                       moderators with "settings"
//  admins/{email}       { role:"owner"|"moderator", perms:{sheets,fixtures,rosters,underage,carousel,settings} }
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
const ALL = { sheets:true, fixtures:true, rosters:true, underage:true, carousel:true, settings:true };
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2,7);

/* ---------- demo back end ---------- */
function demoStore(){
  let db = ls.load();
  if(!db){ db = { settings: DEFAULT_SETTINGS, club:{ code: CFG.demoClubCode || 'EANNA26' }, rosters:{}, submissions:{}, boxscores:{}, fixtures:{}, seeded:false }; }
  db.fixtures = db.fixtures || {};
  db.admins = db.admins || { 'demo-admin': { role:'owner', name:'You (demo)' } };
  const persist = () => ls.save(db);
  let me = { admin:false, email:null, role:null, perms:{} }; const listeners = [];
  try { if(sessionStorage.getItem('eanna-hub-demo-admin')) me = { admin:true, email:'demo-admin', role:'owner', perms: ALL } } catch(e){}
  const emit = () => { try { me.admin ? sessionStorage.setItem('eanna-hub-demo-admin','1') : sessionStorage.removeItem('eanna-hub-demo-admin') } catch(e){} listeners.forEach(f => f({ ...me })) };
  return {
    mode: 'demo', uid,
    async getSettings(){ return db.settings || DEFAULT_SETTINGS },
    async setSettings(s){ db.settings = s; persist() },
    async getClubCode(){ return db.club.code },
    async setClubCode(c){ db.club.code = c; persist() },
    async getRoster(team){ return db.rosters[team] || { team, players: [] } },
    async listRosters(){ return Object.values(db.rosters) },
    async saveRoster(team, players){ db.rosters[team] = { team, players }; persist() },
    async submitSheet(sub, code){
      if((code||'').trim().toUpperCase() !== db.club.code.toUpperCase()) throw new Error('code');
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
    async listAdmins(){ return Object.entries(db.admins).map(([email, v]) => ({ email, ...v })) },
    async putAdmin(email, v){ db.admins[email] = v; persist() },
    async deleteAdmin(email){ delete db.admins[email]; persist() },
    onAuth(fn){ listeners.push(fn); fn({ ...me }) },
    async signIn(){ me = { admin:true, email:'demo-admin', name:'You (demo)', role:'owner', perms: ALL }; emit() },
    async signOut(){ me = { admin:false, email:null, role:null, perms:{} }; emit() },
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
  let me = { admin:false, email:null, role:null, perms:{} }; const listeners = [];
  A.getRedirectResult(auth).catch(e => console.warn("sign-in", e.code));
  A.onAuthStateChanged(auth, async (u) => {
    me = { admin:false, email: u ? u.email : null, name: u ? (u.displayName || '') : '', role:null, perms:{} };
    if(u){ try{ const s = await F.getDoc(d('admins', u.email)); if(s.exists()){ const v = s.data(); me.admin = true; if(v.name) me.name = v.name; me.role = v.role || 'moderator'; me.perms = me.role === 'owner' ? ALL : (v.perms || {}) } }catch(e){} }
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
    async submitSheet(sub, code){
      const ref = await F.addDoc(F.collection(db,'submissions'), { ...sub, code: (code||'').trim().toUpperCase(), status:'pending', created: new Date().toISOString() });
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
    async listAdmins(){ return (await all('admins')).map(x => ({ email: x.id, ...x })) },
    async putAdmin(email, v){ await F.setDoc(d('admins', email.trim().toLowerCase()), v) },
    async deleteAdmin(email){ await F.deleteDoc(d('admins', email)) },
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
    async exportAll(){ const out = {}; for(const n of ['rosters','submissions','boxscores','fixtures','admins']) out[n] = await all(n); out.settings = await this.getSettings(); return out },
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
