/* =====================================================================
   auth.js — เข้าสู่ระบบ สิทธิ์ผู้ใช้ และการสำรอง/กู้คืนข้อมูล
   ===================================================================== */
'use strict';

/* ---------------------------------------------------------------
   1. หน้าเข้าสู่ระบบ
   --------------------------------------------------------------- */
function renderLogin(msg){
  const demo = [
    ['admin','ผู้ดูแลระบบ'],
    ['supervisor','หัวหน้าแม่บ้าน'],
    ['manager','ผู้บริหาร'],
    ['recorder','ตัวแทนผู้บันทึก'],
    ['st001','แม่บ้าน (สมหญิง)']
  ];
  $('#root').innerHTML =
    '<div class="login-wrap"><form class="login-card" id="loginForm" autocomplete="on">'
    + '<div class="logo">🧹</div>'
    + '<h1 style="margin-bottom:.15rem">ระบบมอบหมายงานและตรวจสอบงานแม่บ้าน</h1>'
    + '<p class="hint" style="margin:0 0 1rem">Housekeeping Assignment &amp; Check Sheet System</p>'
    + (msg ? '<p style="color:var(--danger);font-size:.9rem;margin:0 0 .6rem">'+esc(msg)+'</p>' : '')
    + '<div class="field"><label for="lgUser">ชื่อผู้ใช้</label>'
    +   '<input id="lgUser" name="username" type="text" autocomplete="username" required></div>'
    + '<div class="field"><label for="lgPass">รหัสผ่าน</label>'
    +   '<input id="lgPass" name="password" type="password" autocomplete="current-password" required></div>'
    + '<button class="btn primary" style="width:100%;justify-content:center;padding:.55rem" type="submit">เข้าสู่ระบบ</button>'
    + '<p class="hint" style="margin:.9rem 0 .2rem">เข้าใช้ด่วนสำหรับทดลองระบบ (รหัสผ่าน <b>1234</b>)</p>'
    + '<div class="quick">'
    +   demo.map(d=>'<button type="button" class="btn sm" data-u="'+d[0]+'">'+esc(d[1])+'</button>').join('')
    + '</div>'
    + '<p class="hint" style="margin-top:1rem;font-size:.78rem">เวอร์ชัน '+APP_VERSION+' · '+esc(Store.modeLabel())+'</p>'
    + '</form></div>';

  $('#loginForm').addEventListener('submit', async e=>{
    e.preventDefault();
    await doLogin($('#lgUser').value.trim(), $('#lgPass').value);
  });
  $$('.quick .btn').forEach(b=> b.onclick = async ()=>{ await doLogin(b.dataset.u, '1234'); });
}

/** หน้าจอแรกที่บทบาทนี้เปิดได้ */
function firstAllowedRoute(){
  if(state.session.role === 'staff' && canRoute('mywork')) return 'mywork';
  const order = ['dashboard','mywork','keyin','verify','assign','print','report','scan','settings'];
  for(const r of order) if(canRoute(r)) return r;
  return 'dashboard';
}

async function doLogin(username, password){
  const u = (state.data.users || []).find(x=>
    x.username.toLowerCase() === String(username).toLowerCase() && x.active !== false);
  if(!u){ renderLogin('ไม่พบชื่อผู้ใช้นี้ในระบบ'); return; }

  const h = await sha256(password);
  if(h !== u.passHash){ renderLogin('รหัสผ่านไม่ถูกต้อง'); return; }

  state.session = { id:u.id, username:u.username, name:u.name, role:u.role, staffId:u.staffId || '' };
  try{ sessionStorage.setItem(SESSION_KEY, JSON.stringify(state.session)); }catch(e){}

  await saveMaster('เข้าสู่ระบบ');
  state.route = firstAllowedRoute();
  renderShell(); renderRoute();
  toast('ยินดีต้อนรับ '+u.name, 'ok');
}

async function logout(){
  await saveMaster('ออกจากระบบ');
  state.session = null;
  try{ sessionStorage.removeItem(SESSION_KEY); }catch(e){}
  renderLogin();
}

function restoreSession(){
  try{
    const raw = sessionStorage.getItem(SESSION_KEY);
    if(!raw) return false;
    const s = JSON.parse(raw);
    const u = (state.data.users || []).find(x=> x.id === s.id && x.active !== false);
    if(!u) return false;
    state.session = { id:u.id, username:u.username, name:u.name, role:u.role, staffId:u.staffId || '' };
    if(!canRoute(state.route)) state.route = firstAllowedRoute();
    return true;
  }catch(e){ return false; }
}

/* ---------------------------------------------------------------
   2. เปลี่ยนรหัสผ่าน
   --------------------------------------------------------------- */
function changePasswordDialog(userId){
  const self = (userId === state.session.id);
  openModal({
    title:'เปลี่ยนรหัสผ่าน', width:'440px',
    body: (self ? '<div class="field"><label>รหัสผ่านเดิม</label><input type="password" id="pwOld"></div>' : '')
      + '<div class="field"><label>รหัสผ่านใหม่</label><input type="password" id="pwNew"></div>'
      + '<div class="field"><label>ยืนยันรหัสผ่านใหม่</label><input type="password" id="pwNew2"></div>'
      + '<p class="hint">รหัสผ่านอย่างน้อย 4 ตัวอักษร</p>',
    actions:[
      { label:'บันทึก', cls:'primary', onClick: async ()=>{
          const u = D.user(userId);
          if(!u){ toast('ไม่พบผู้ใช้','err'); return; }
          if(self){
            const oh = await sha256($('#pwOld').value);
            if(oh !== u.passHash){ toast('รหัสผ่านเดิมไม่ถูกต้อง','err'); return; }
          }
          const n = $('#pwNew').value, n2 = $('#pwNew2').value;
          if(n.length < 4){ toast('รหัสผ่านสั้นเกินไป','err'); return; }
          if(n !== n2){ toast('รหัสผ่านใหม่ไม่ตรงกัน','err'); return; }
          u.passHash = await sha256(n);
          await saveMaster('เปลี่ยนรหัสผ่านของ '+u.name);
          closeModal(); toast('เปลี่ยนรหัสผ่านแล้ว','ok');
        }},
      { label:'ยกเลิก', onClick: closeModal }
    ]
  });
}

/* ---------------------------------------------------------------
   3. สำรอง / กู้คืนข้อมูล
   รวมตารางงาน "ทุกเดือน" ที่เคยบันทึกไว้ ไม่ใช่เฉพาะเดือนที่เปิดดู
   --------------------------------------------------------------- */
async function collectAllPlans(onProgress){
  const keys = new Set(state.data.planIndex || []);
  Object.keys(state.plans).forEach(k=> keys.add(k));
  (await Store.keys('plan:')).forEach(k=> keys.add(k.slice(5)));

  const out = {};
  let i = 0;
  for(const k of keys){
    i++;
    if(onProgress) onProgress(i, keys.size);
    const p = state.plans[k] || await Store.get('plan:'+k);
    if(p) out[k] = p;
  }
  return out;
}

async function backupAll(){
  toast('กำลังรวบรวมข้อมูล…');
  const plans = await collectAllPlans();
  const dump = {
    app:'hkcs', version: APP_VERSION, exportedAt: nowIso(),
    master: state.data, plans
  };
  const t = new Date();
  const name = 'backup_ระบบแม่บ้าน_' + (t.getFullYear()+543) + pad2(t.getMonth()+1) + pad2(t.getDate()) + '.json';
  await download(name, new Blob([JSON.stringify(dump, null, 1)], { type:'application/json' }));
}

function restoreDialog(){
  openModal({
    title:'กู้คืนข้อมูลจากไฟล์สำรอง', width:'480px',
    body:'<p class="hint">เลือกไฟล์ .json ที่ได้จากปุ่ม “สำรองข้อมูล” — '
      + '<b>ข้อมูลปัจจุบันทั้งหมดจะถูกแทนที่</b></p>'
      + '<input type="file" id="rsFile" accept="application/json,.json">'
      + '<p class="hint" id="rsProg" style="margin-top:.6rem"></p>',
    actions:[
      { label:'กู้คืน', cls:'danger', onClick: async ()=>{
          const f = $('#rsFile').files[0];
          if(!f){ toast('ยังไม่ได้เลือกไฟล์','err'); return; }
          try{
            const j = JSON.parse(await f.text());
            if(!j.master) throw new Error('รูปแบบไฟล์ไม่ถูกต้อง');
            state.data = normalizeData(j.master);
            state.plans = {};
            const keys = Object.keys(j.plans || {});
            state.data.planIndex = keys.slice().sort();
            await Store.set(DATA_KEY, state.data);
            let n = 0;
            for(const k of keys){
              n++;
              const el = $('#rsProg'); if(el) el.textContent = 'กำลังกู้คืนตารางงาน '+n+'/'+keys.length;
              state.plans[k] = j.plans[k];
              await Store.set('plan:'+k, j.plans[k]);
            }
            closeModal();
            toast('กู้คืนข้อมูลเรียบร้อย ('+keys.length+' ตาราง)','ok');
            if(state.session){ renderShell(); renderRoute(); } else renderLogin();
          }catch(e){ toast('กู้คืนไม่สำเร็จ: '+e.message,'err'); }
        }},
      { label:'ยกเลิก', onClick: closeModal }
    ]
  });
}
