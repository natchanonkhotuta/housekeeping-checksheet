/* =====================================================================
   core.js — ค่าคงที่ ตัวช่วยทั่วไป ชั้นเก็บข้อมูล และสถานะแอป
   ระบบมอบหมายงานและตรวจสอบงานแม่บ้าน (Housekeeping Check Sheet System)
   ===================================================================== */
'use strict';

const APP_VERSION = '1.1.0';
const LS_PREFIX   = 'hkcs:';
const DATA_KEY    = 'master';
const SYNC_CFG_KEY = LS_PREFIX + 'sync';
const SESSION_KEY  = LS_PREFIX + 'session';

/* ---------------------------------------------------------------
   1. ค่าคงที่ของโดเมน
   --------------------------------------------------------------- */
const TH_MONTHS = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน',
                   'กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];
const TH_MONTHS_SHORT = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
const TH_DOW = ['อาทิตย์','จันทร์','อังคาร','พุธ','พฤหัสบดี','ศุกร์','เสาร์'];
const TH_DOW_SHORT = ['อา','จ','อ','พ','พฤ','ศ','ส'];

const PERIODS = { morning:'เช้า', afternoon:'บ่าย' };
const PERIOD_KEYS = ['morning','afternoon'];

const FREQ = { daily:'ทุกวัน', weekly:'รายสัปดาห์', monthly:'รายเดือน', dates:'วันที่กำหนด' };

const STATUS = {
  pending:  { label:'ยังไม่เริ่ม',     cls:'b-pending',  mark:''  },
  assigned: { label:'มอบหมายแล้ว',    cls:'b-assigned', mark:''  },
  doing:    { label:'กำลังดำเนินการ', cls:'b-doing',    mark:'/' },
  done:     { label:'เสร็จแล้ว',       cls:'b-done',     mark:'✓' },
  verified: { label:'ตรวจสอบแล้ว',     cls:'b-verified', mark:'✓' },
  failed:   { label:'ไม่ผ่าน',         cls:'b-failed',   mark:'✗' },
  rework:   { label:'ต้องแก้ไข',       cls:'b-rework',   mark:'!' },
  skipped:  { label:'งดปฏิบัติงาน',    cls:'b-skipped',  mark:'-' },
  leave:    { label:'หยุด/ลา',         cls:'b-leave',    mark:'ห' }
};
const STATUS_KEYS = Object.keys(STATUS);
/** สถานะที่ถือว่า "ยังไม่มีข้อสรุป" — ใช้ร่วมกันหลายหน้าจอ */
const ST_OPEN    = ['pending','assigned','doing'];
const ST_DONE    = ['done','verified'];
const ST_PROBLEM = ['failed','rework'];

const STAFF_STATUS = { active:'ปฏิบัติงาน', leave:'ลาพัก', resigned:'พ้นสภาพ' };
const LEAVE_TYPES  = ['ลาป่วย','ลากิจ','ลาพักร้อน','ลาคลอด','หยุดชดเชย','ขาดงาน'];
const HOLIDAY_TYPES = { public:'วันหยุดนักขัตฤกษ์', special:'วันหยุดพิเศษ', company:'วันหยุดบริษัท' };

const ROLES = {
  admin:      { label:'ผู้ดูแลระบบ',              rank:5 },
  supervisor: { label:'หัวหน้าแม่บ้าน',           rank:4 },
  manager:    { label:'ผู้บริหาร',                rank:3 },
  recorder:   { label:'ผู้บันทึกข้อมูล (ตัวแทน)', rank:2 },
  staff:      { label:'แม่บ้าน',                  rank:1 }
};

/* ---------------------------------------------------------------
   2. สิทธิ์การใช้งาน
   หลักการ:  <หน้าจอ>        = เปิดหน้าและแก้ไขได้
             <หน้าจอ>.view   = เปิดหน้าได้อย่างเดียว (อ่านอย่างเดียว)
   การ "เข้าหน้าจอ" ตรวจด้วย canAny() ตาม ROUTE_PERMS
   การ "แก้ไข" ตรวจด้วย can() แบบตรงตัวเสมอ
   --------------------------------------------------------------- */
const PERMS = {
  admin:      ['*'],
  supervisor: ['dashboard','mywork','assign','verify','keyin','scan','print','report',
               'holiday','check.any','staff.view','area.view','taskdef.view'],
  manager:    ['dashboard','verify.approve','print','report',
               'staff.view','area.view','taskdef.view','holiday.view'],
  recorder:   ['dashboard','keyin','scan','print','report',
               'staff.view','area.view','taskdef.view','holiday.view'],
  staff:      ['dashboard','mywork','check.self','print.self','holiday.view']
};

/** สิทธิ์ที่ยอมให้ "เปิดหน้าจอ" นั้นได้ (ข้อใดข้อหนึ่ง) */
const ROUTE_PERMS = {
  dashboard: ['dashboard'],
  mywork:    ['mywork','check.self','check.any'],
  assign:    ['assign'],
  keyin:     ['keyin'],
  scan:      ['scan'],
  verify:    ['verify','verify.approve'],
  print:     ['print','print.self'],
  staff:     ['staff','staff.view'],
  areas:     ['area','area.view'],
  taskdefs:  ['taskdef','taskdef.view'],
  holidays:  ['holiday','holiday.edit','holiday.view'],
  report:    ['report'],
  users:     ['users'],
  settings:  ['settings']
};

/** ตรวจสิทธิ์แบบตรงตัว (รองรับ * และการสืบทอดจากรากสิทธิ์ เช่น 'verify' ครอบคลุม 'verify.approve') */
function can(perm){
  const u = state.session; if(!u) return false;
  const list = PERMS[u.role] || [];
  if(list.includes('*')) return true;
  if(list.includes(perm)) return true;
  const root = String(perm).split('.')[0];
  return list.includes(root);
}
/** ตรวจว่ามีสิทธิ์ข้อใดข้อหนึ่งหรือไม่ */
function canAny(){
  for(let i=0;i<arguments.length;i++){
    const a = arguments[i];
    if(Array.isArray(a)){ if(a.some(can)) return true; }
    else if(can(a)) return true;
  }
  return false;
}
/** เปิดหน้าจอนี้ได้หรือไม่ */
function canRoute(route){
  const list = ROUTE_PERMS[route];
  return list ? canAny(list) : false;
}

/* ---------------------------------------------------------------
   3. ตัวช่วยทั่วไป
   --------------------------------------------------------------- */
const $  = (s,r)=> (r||document).querySelector(s);
const $$ = (s,r)=> Array.from((r||document).querySelectorAll(s));
const uid = (p)=> (p||'id')+'_'+Math.random().toString(36).slice(2,9)+Date.now().toString(36).slice(-4);

function esc(s){
  return String(s==null?'':s).replace(/[&<>"']/g,
    c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function clone(o){ return JSON.parse(JSON.stringify(o)); }
function beYear(y){ return y + 543; }
function adYear(by){ return by - 543; }
function pad2(n){ return String(n).padStart(2,'0'); }
function ymd(y,m,d){ return y+'-'+pad2(m+1)+'-'+pad2(d); }          // m = 0-based
function ymKey(y,m){ return y+'-'+pad2(m+1); }
function daysInMonth(y,m){ return new Date(y,m+1,0).getDate(); }
function dowOf(y,m,d){ return new Date(y,m,d).getDay(); }
function todayParts(){ const t=new Date(); return { y:t.getFullYear(), m:t.getMonth(), d:t.getDate() }; }
function isoParts(iso){ const p=String(iso).split('-').map(Number); return { y:p[0], m:p[1]-1, d:p[2] }; }
function clampInt(v,lo,hi){ v = parseInt(v,10); if(isNaN(v)) v = lo; return Math.max(lo, Math.min(hi, v)); }

function thDate(iso){
  if(!iso) return '';
  const p = isoParts(iso);
  return p.d+' '+TH_MONTHS_SHORT[p.m]+' '+beYear(p.y);
}
function thDateLong(iso){
  if(!iso) return '';
  const p = isoParts(iso);
  return p.d+' '+TH_MONTHS[p.m]+' '+beYear(p.y);
}
function nowIso(){ return new Date().toISOString(); }
function thStamp(iso){
  if(!iso) return '';
  const dt = new Date(iso);
  if(isNaN(dt)) return '';
  return dt.getDate()+' '+TH_MONTHS_SHORT[dt.getMonth()]+' '+beYear(dt.getFullYear())
       + ' ' + pad2(dt.getHours())+':'+pad2(dt.getMinutes());
}
/** เวลาเที่ยงวันของวันที่กำหนด — ใช้เป็นเวลาบันทึกย้อนหลังจากกระดาษ/ใบสแกน */
function noonIsoOf(y,m,d){ return new Date(y, m, d, 12, 0, 0).toISOString(); }

async function sha256(txt){
  try{
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(txt));
    return Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,'0')).join('');
  }catch(e){
    // สำรองสำหรับบริบทที่ไม่ใช่ secure context (เปิดไฟล์จากเครื่องโดยตรง)
    let h = 0;
    for(let i=0;i<txt.length;i++){ h = (h<<5)-h+txt.charCodeAt(i); h |= 0; }
    return 'x'+Math.abs(h).toString(16);
  }
}

function toast(msg, kind){
  const host = $('#toasts'); if(!host) return;
  const el = document.createElement('div');
  el.className = 'toast'+(kind?' '+kind:'');
  el.textContent = msg;
  host.appendChild(el);
  setTimeout(()=>{ el.style.opacity='0'; el.style.transition='opacity .3s'; setTimeout(()=>el.remove(),320); }, 2800);
}

/* ---------- ดาวน์โหลดไฟล์ ---------- */
let _dl = null, _dlChecked = false;
async function getDownloader(){
  if(_dlChecked) return _dl;
  _dlChecked = true;
  try{
    if(typeof window!=='undefined' && window.claude && typeof window.claude.use==='function'){
      _dl = await Promise.race([ window.claude.use('downloads'),
                                 new Promise(r=>setTimeout(()=>r(null), 12000)) ]);
    }
  }catch(e){ _dl = null; }
  return _dl;
}
async function download(filename, blob){
  const d = await getDownloader();
  if(d){
    try{ await d.save({ filename, data: blob }); toast('บันทึกไฟล์แล้ว','ok'); }
    catch(e){
      if(e && e.code==='declined') toast('ยกเลิกการบันทึกไฟล์');
      else toast('บันทึกไฟล์ไม่สำเร็จ: '+((e&&e.message)||''),'err');
    }
    return;
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  setTimeout(()=>{ URL.revokeObjectURL(url); a.remove(); }, 800);
}

/* ---------------------------------------------------------------
   4. ชั้นเก็บข้อมูล (Storage)
   รองรับ 4 โหมด — เลือกอัตโนมัติหรือกำหนดเองที่หน้า "ตั้งค่าระบบ"
     local     เก็บในเบราว์เซอร์เครื่องนี้ (localStorage)
     supabase  ตาราง key/value บน Supabase (ฟรี ใช้ข้ามเครื่องได้)
     rest      REST API ของตัวเอง  GET/PUT {base}/{key}
     claude    ฐานข้อมูลของ Claude Artifact (ตรวจพบอัตโนมัติ)
   ทุกโหมดที่ไม่ใช่ local จะ "มิเรอร์" ลง localStorage ไว้เป็นแคชออฟไลน์เสมอ
   --------------------------------------------------------------- */
const Store = {
  mode: 'local',
  db: null,
  cfg: null,
  online: true,
  lastError: '',

  loadCfg(){
    try{ const raw = localStorage.getItem(SYNC_CFG_KEY); return raw? JSON.parse(raw) : null; }
    catch(e){ return null; }
  },
  saveCfg(cfg){
    try{
      if(cfg) localStorage.setItem(SYNC_CFG_KEY, JSON.stringify(cfg));
      else localStorage.removeItem(SYNC_CFG_KEY);
      this.cfg = cfg;
      return true;
    }catch(e){ return false; }
  },
  modeLabel(){
    return { local:'💾 เก็บที่เครื่องนี้', supabase:'☁️ Supabase (ใช้ร่วมกัน)',
             rest:'☁️ REST API (ใช้ร่วมกัน)', claude:'☁️ Claude Artifact (ใช้ร่วมกัน)' }[this.mode] || this.mode;
  },
  isShared(){ return this.mode !== 'local'; },

  async init(){
    this.cfg = this.loadCfg();
    if(this.cfg && this.cfg.mode === 'supabase' && this.cfg.url && this.cfg.key){
      this.mode = 'supabase'; return this.mode;
    }
    if(this.cfg && this.cfg.mode === 'rest' && this.cfg.url){
      this.mode = 'rest'; return this.mode;
    }
    if(this.cfg && this.cfg.mode === 'local'){ this.mode = 'local'; return this.mode; }
    // ตรวจหาฐานข้อมูลของ Claude Artifact โดยอัตโนมัติ
    try{
      if(typeof window!=='undefined' && window.claude && typeof window.claude.use==='function'){
        const db = await Promise.race([ window.claude.use('db'),
                                        new Promise(r=>setTimeout(()=>r(null), 12000)) ]);
        if(db){ this.db = db; this.mode = 'claude'; return this.mode; }
      }
    }catch(e){ /* ไม่มีก็ใช้ local */ }
    this.mode = 'local';
    return this.mode;
  },

  /* ----- API หลัก ----- */
  async get(key){
    if(this.mode === 'local') return this._lsGet(key);
    try{
      let v = null;
      if(this.mode === 'claude')        v = await this._claudeGet(key);
      else if(this.mode === 'supabase') v = await this._sbGet(key);
      else if(this.mode === 'rest')     v = await this._restGet(key);
      this.online = true; this.lastError = '';
      if(v !== null && v !== undefined) this._lsSet(key, v);   // มิเรอร์เป็นแคช
      return v === undefined ? null : v;
    }catch(e){
      this.online = false; this.lastError = e.message || String(e);
      console.warn('Store.get', key, e);
      return this._lsGet(key);                                  // ใช้แคชแทน
    }
  },

  async set(key, value){
    this._lsSet(key, value);                                    // เขียนแคชก่อนเสมอ
    if(this.mode === 'local') return true;
    try{
      if(this.mode === 'claude')        await this._claudeSet(key, value);
      else if(this.mode === 'supabase') await this._sbSet(key, value);
      else if(this.mode === 'rest')     await this._restSet(key, value);
      this.online = true; this.lastError = '';
      return true;
    }catch(e){
      this.online = false; this.lastError = e.message || String(e);
      console.warn('Store.set', key, e);
      toast('บันทึกขึ้นระบบส่วนกลางไม่สำเร็จ — เก็บไว้ในเครื่องแล้ว จะซิงก์ใหม่เมื่อเชื่อมต่อได้','err');
      return false;
    }
  },

  /** รายชื่อคีย์ทั้งหมดที่ขึ้นต้นด้วย prefix (เท่าที่แหล่งเก็บนั้นบอกได้) */
  async keys(prefix){
    const out = new Set();
    // จากแคชในเครื่องเสมอ
    try{
      for(let i=0;i<localStorage.length;i++){
        const k = localStorage.key(i);
        if(k && k.startsWith(LS_PREFIX+prefix)) out.add(k.slice(LS_PREFIX.length));
      }
    }catch(e){}
    if(this.mode === 'supabase'){
      try{
        const rows = await this._sbList(prefix);
        rows.forEach(r=> out.add(r.key));
      }catch(e){ console.warn('Store.keys', e); }
    }
    return Array.from(out);
  },

  async ping(){
    try{
      await this.get('__ping__');
      return { ok:true };
    }catch(e){ return { ok:false, msg: e.message || String(e) }; }
  },

  /* ----- localStorage ----- */
  _lsGet(key){
    try{ const raw = localStorage.getItem(LS_PREFIX+key); return raw==null? null : JSON.parse(raw); }
    catch(e){ return null; }
  },
  _lsSet(key, value){
    try{ localStorage.setItem(LS_PREFIX+key, JSON.stringify(value)); return true; }
    catch(e){ toast('พื้นที่จัดเก็บในเครื่องเต็ม ไม่สามารถบันทึกได้','err'); return false; }
  },
  _lsDel(key){ try{ localStorage.removeItem(LS_PREFIX+key); }catch(e){} },

  /* ----- Claude Artifact db ----- */
  async _claudeGet(key){
    const snap = await this.db.doc('appdata/'+key).get();
    return snap && snap.exists ? (snap.data().v ?? null) : null;
  },
  async _claudeSet(key, value){
    await this.db.doc('appdata/'+key).set({ v:value, at:nowIso() });
  },

  /* ----- Supabase (PostgREST) ----- */
  _sbHeaders(extra){
    return Object.assign({
      'apikey': this.cfg.key,
      'Authorization': 'Bearer '+this.cfg.key,
      'Content-Type': 'application/json'
    }, extra||{});
  },
  _sbTable(){ return (this.cfg.table || 'hkcs_kv'); },
  _sbBase(){ return String(this.cfg.url).replace(/\/+$/,'') + '/rest/v1/' + this._sbTable(); },
  async _sbGet(key){
    const url = this._sbBase()+'?select=value&key=eq.'+encodeURIComponent(key)+'&limit=1';
    const r = await fetch(url, { headers: this._sbHeaders() });
    if(!r.ok) throw new Error('Supabase '+r.status+' '+(await r.text()).slice(0,160));
    const rows = await r.json();
    return rows.length ? rows[0].value : null;
  },
  async _sbSet(key, value){
    const r = await fetch(this._sbBase()+'?on_conflict=key', {
      method:'POST',
      headers: this._sbHeaders({ 'Prefer':'resolution=merge-duplicates,return=minimal' }),
      body: JSON.stringify([{ key, value, updated_at: nowIso() }])
    });
    if(!r.ok) throw new Error('Supabase '+r.status+' '+(await r.text()).slice(0,160));
  },
  async _sbList(prefix){
    const url = this._sbBase()+'?select=key&key=like.'+encodeURIComponent(prefix+'*');
    const r = await fetch(url, { headers: this._sbHeaders() });
    if(!r.ok) throw new Error('Supabase '+r.status);
    return r.json();
  },

  /* ----- REST API ทั่วไป ----- */
  _restHeaders(){
    const h = { 'Content-Type':'application/json' };
    if(this.cfg.authHeader && this.cfg.authValue) h[this.cfg.authHeader] = this.cfg.authValue;
    return h;
  },
  _restUrl(key){ return String(this.cfg.url).replace(/\/+$/,'') + '/' + encodeURIComponent(key); },
  async _restGet(key){
    const r = await fetch(this._restUrl(key), { headers: this._restHeaders() });
    if(r.status === 404) return null;
    if(!r.ok) throw new Error('REST '+r.status);
    const txt = await r.text();
    return txt ? JSON.parse(txt) : null;
  },
  async _restSet(key, value){
    const r = await fetch(this._restUrl(key), {
      method:'PUT', headers:this._restHeaders(), body: JSON.stringify(value)
    });
    if(!r.ok) throw new Error('REST '+r.status);
  }
};

/* ---------------------------------------------------------------
   5. สถานะแอปในหน่วยความจำ
   --------------------------------------------------------------- */
const state = {
  session: null,
  route: 'dashboard',
  data: null,     // { org, areas, staff, taskDefs, holidays, leaves, users, settings, planIndex, audit }
  plans: {},      // { 'YYYY-MM|areaId' : plan }
  ui: {
    y: todayParts().y, m: todayParts().m,
    areaId:'', staffId:'', selDay:0,
    calMode:'month', sidebarOpen:false,
    vfScope:'day', vfDay:0, vfShow:'todo', vfStaff:'',
    kiScope:'day', kiDay:0,
    prArea:undefined, prStaff:undefined
  }
};

const planKey = (y,m,areaId)=> ymKey(y,m)+'|'+areaId;
const cellKey = (taskId, day, period)=> taskId+'|'+day+'|'+period;

/* ---------- บันทึกข้อมูลหลัก ---------- */
async function saveMaster(logAction, detail){
  if(!state.data) return;
  if(logAction) pushAudit(logAction, detail);
  state.data.updatedAt = nowIso();
  await Store.set(DATA_KEY, state.data);
}

/* ---------- แผนงานรายเดือนต่อพื้นที่ ---------- */
async function savePlan(key){
  const p = state.plans[key]; if(!p) return;
  p.updatedAt = nowIso();
  registerPlanKey(key);
  await Store.set('plan:'+key, p);
}
async function loadPlan(y, m, areaId){
  const key = planKey(y, m, areaId);
  if(state.plans[key]) return state.plans[key];
  const got = await Store.get('plan:'+key);
  state.plans[key] = got || { key, y, m, areaId, status:'draft', cells:{}, approvals:{}, createdAt:nowIso() };
  if(got) registerPlanKey(key);
  return state.plans[key];
}
/** จำรายชื่อแผนที่เคยบันทึก เพื่อให้ "สำรองข้อมูล" ครบทุกเดือนแม้ยังไม่ได้เปิดดู */
function registerPlanKey(key){
  if(!state.data) return;
  if(!Array.isArray(state.data.planIndex)) state.data.planIndex = [];
  if(!state.data.planIndex.includes(key)){
    state.data.planIndex.push(key);
    state.data.planIndex.sort();
    Store.set(DATA_KEY, state.data);   // เขียนแบบไม่รอ — ครั้งถัดไปที่ saveMaster จะยืนยันอีกที
  }
}

/* ---------- ประวัติการแก้ไข ---------- */
function pushAudit(action, detail){
  if(!state.data) return;
  if(!Array.isArray(state.data.audit)) state.data.audit = [];
  state.data.audit.unshift({
    id: uid('a'), at: nowIso(),
    by: state.session ? state.session.name : 'ระบบ',
    role: state.session ? state.session.role : '-',
    action, detail: detail || ''
  });
  if(state.data.audit.length > 400) state.data.audit.length = 400;
}

/* ---------- เติมฟิลด์ที่ขาดให้ข้อมูลจากเวอร์ชันเก่า ---------- */
function normalizeData(data){
  if(!data) return data;
  data.version  = APP_VERSION;
  data.org      = Object.assign({ name:'บริษัท ตัวอย่าง จำกัด', dept:'ฝ่ายบริหารทั่วไป',
                                  doc:'FM-GA-001', rev:'00' }, data.org || {});
  data.settings = Object.assign({ assignOnHoliday:false, workOnSunday:false, autoApproveDone:false },
                                data.settings || {});
  data.areas     = data.areas     || [];
  data.staff     = data.staff     || [];
  data.taskDefs  = data.taskDefs  || [];
  data.holidays  = data.holidays  || [];
  data.leaves    = data.leaves    || [];
  data.users     = data.users     || [];
  data.audit     = data.audit     || [];
  data.planIndex = data.planIndex || [];
  return data;
}

/* ---------- ซิงก์ข้อมูลจากส่วนกลางลงเครื่องนี้ ---------- */
async function syncNow(silent){
  if(!Store.isShared()){ if(!silent) toast('โหมดนี้เก็บข้อมูลในเครื่อง จึงไม่ต้องซิงก์'); return; }
  const d = await Store.get(DATA_KEY);
  if(d) state.data = normalizeData(d);
  const keys = Object.keys(state.plans);
  for(const k of keys){
    const p = await Store.get('plan:'+k);
    if(p) state.plans[k] = p;
  }
  if(!silent){
    if(Store.online) toast('ซิงก์ข้อมูลล่าสุดแล้ว','ok');
    else toast('เชื่อมต่อส่วนกลางไม่ได้ — แสดงข้อมูลจากแคชในเครื่อง','err');
  }
  if(typeof renderShell === 'function' && state.session){ renderShell(); renderRoute(); }
}
