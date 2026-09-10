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
})();
