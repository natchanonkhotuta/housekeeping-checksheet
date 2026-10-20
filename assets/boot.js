/* =====================================================================
   boot.js — เริ่มต้นระบบ
   ===================================================================== */
'use strict';

(async function boot(){
  /* ธีมสว่าง/มืดที่ผู้ใช้เลือกไว้ */
  try{
    const th = localStorage.getItem(LS_PREFIX+'theme');
    if(th) document.documentElement.setAttribute('data-theme', th);
  }catch(e){}

  $('#root').innerHTML =
    '<div class="login-wrap"><div class="login-card" style="text-align:center">'
    + '<div class="logo" style="margin:0 auto .7rem">🧹</div>'
    + '<h2>กำลังเริ่มระบบ…</h2><p class="hint">กำลังเชื่อมต่อแหล่งจัดเก็บข้อมูล</p></div></div>';

  await Store.init();

  let data = await Store.get(DATA_KEY);
  if(!data || !data.areas || !data.users || !data.users.length){
    data = await buildSeed();
    // ข้อมูลหน่วยงานที่ผู้ติดตั้งกำหนดไว้ใน assets/config.js (ใช้เฉพาะตอนสร้างครั้งแรก)
    const orgCfg = (window.HKCS_CONFIG && window.HKCS_CONFIG.org) || null;
    if(orgCfg) Object.keys(orgCfg).forEach(k=>{ if(orgCfg[k]) data.org[k] = orgCfg[k]; });
    await Store.set(DATA_KEY, data);
  }
  state.data = normalizeData(data);

  /* ---- ปรับข้อมูลจากเวอร์ชันเก่าให้เข้ากับเวอร์ชันนี้ ---- */
  let migrated = false;

  // บทบาท "ผู้บันทึกข้อมูล" เพิ่มเข้ามาในเวอร์ชัน 1.0
  if(!state.data.users.some(u=> u.role === 'recorder')){
    state.data.users.push({
      id:'u_rec', username:'recorder', name:'ตัวแทนผู้บันทึก — ปราณี ธุรการ',
      role:'recorder', staffId:'', passHash: await sha256('1234'), active:true
    });
    migrated = true;
  }

  // เวอร์ชัน 1.1: สร้างดัชนีตารางงานจากที่เก็บในเครื่อง เพื่อให้สำรองข้อมูลได้ครบทุกเดือน
  if(!state.data.planIndex.length){
    const keys = await Store.keys('plan:');
    if(keys.length){
      state.data.planIndex = keys.map(k=> k.slice(5)).sort();
      migrated = true;
    }
  }

  // เวอร์ชัน 1.6: ตั้งค่าเริ่มต้นของสีเน้นพื้นที่ในตารางกะ
  if(applyHighlightDefaults()) migrated = true;

  if(migrated) await Store.set(DATA_KEY, state.data);

  /* ---- เข้าสู่ระบบ ---- */
  if(restoreSession()){ renderShell(); renderRoute(); }
  else renderLogin();

  /* ---- เหตุการณ์ระดับหน้าต่าง ---- */
  window.addEventListener('resize', ()=>{
    if(window.innerWidth > 860 && state.ui.sidebarOpen){
      state.ui.sidebarOpen = false;
      if(state.session){ renderShell(); renderRoute(); }
    }
  });

  document.addEventListener('keydown', e=>{
    if(e.key === 'Escape' && $('#modalHost').innerHTML) closeModal();
  });

  // กลับมาออนไลน์แล้วดึงข้อมูลล่าสุดให้อัตโนมัติ
  window.addEventListener('online', ()=>{
    if(Store.isShared() && state.session) syncNow(true);
  });

  checkForUpdate();
})();

/**
 * เตือนเมื่อมีเวอร์ชันใหม่
 * โฮสต์อย่าง GitHub Pages แคชหน้าเว็บไว้ 10 นาที ผู้ใช้จึงอาจเปิดได้ของเก่า
 * ทั้งที่ deploy ไปแล้ว — ดึง version.json แบบไม่ผ่านแคชมาเทียบกับตัวที่โหลดอยู่
 */
async function checkForUpdate(){
  if(location.protocol === 'file:') return;          // เปิดจากไฟล์ในเครื่อง ไม่ต้องเช็ก
  try{
    const r = await fetch('version.json?t='+Date.now(), { cache:'no-store' });
    if(!r.ok) return;
    const v = await r.json();
    if(!v.version || v.version === APP_VERSION) return;

    const bar = document.createElement('div');
    bar.style.cssText = 'position:fixed;left:0;right:0;bottom:0;z-index:9999;padding:.7rem 1rem;'
      + 'background:#0f766e;color:#fff;display:flex;gap:.8rem;align-items:center;'
      + 'justify-content:center;flex-wrap:wrap;font-size:.95rem';
    bar.innerHTML = '<span>มีเวอร์ชันใหม่ <b>'+esc(v.version)+'</b> '
      + '(ตอนนี้ใช้ '+esc(APP_VERSION)+') — เบราว์เซอร์ยังเก็บไฟล์เก่าไว้</span>'
      + '<button class="btn sm" id="updNow" style="background:#fff;color:#0f766e;font-weight:600">'
      + 'โหลดเวอร์ชันใหม่</button>'
      + '<button class="btn sm" id="updLater" style="background:transparent;color:#fff;'
      + 'border-color:rgba(255,255,255,.6)">ไว้ก่อน</button>';
    document.body.appendChild(bar);

    $('#updNow').onclick = ()=>{
      // ต่อท้าย query ให้ได้ไฟล์ใหม่จริง ไม่ใช่ของในแคช
      location.replace(location.pathname + '?v=' + Date.now());
    };
    $('#updLater').onclick = ()=> bar.remove();
  }catch(e){ /* เช็กไม่ได้ก็ไม่เป็นไร */ }
}
