/* =====================================================================
   ui.js — โครงหน้าจอ เมนู เราต์เตอร์ กล่องโต้ตอบ และตัวช่วยฟอร์ม
   ===================================================================== */
'use strict';

/* ---------------------------------------------------------------
   1. เมนูนำทาง
   --------------------------------------------------------------- */
const NAV = [
  { grp:'ภาพรวม', items:[
    { id:'dashboard', ic:'📊', label:'แดชบอร์ด' },
    { id:'mywork',    ic:'✅', label:'งานของฉัน' }
  ]},
  { grp:'ปฏิบัติงาน', items:[
    { id:'assign', ic:'🗓️', label:'มอบหมายงาน (ปฏิทิน)' },
    { id:'keyin',  ic:'⌨️', label:'บันทึกผลจากกระดาษ' },
    { id:'scan',   ic:'📷', label:'สแกนใบเช็คงาน' },
    { id:'verify', ic:'🔍', label:'ตรวจสอบและอนุมัติ' },
    { id:'print',  ic:'🖨️', label:'พิมพ์ / ส่งออก CHECK SHEET' }
  ]},
  { grp:'ข้อมูลหลัก', items:[
    { id:'staff',    ic:'👥', label:'จัดการข้อมูลแม่บ้าน' },
    { id:'areas',    ic:'🏢', label:'จัดการพื้นที่' },
    { id:'taskdefs', ic:'📋', label:'รายการงานมาตรฐาน' },
    { id:'holidays', ic:'📆', label:'ปฏิทินวันหยุด / วันลา' }
  ]},
  { grp:'ระบบ', items:[
    { id:'report',   ic:'📈', label:'รายงานประวัติการทำงาน' },
    { id:'users',    ic:'🔐', label:'ผู้ใช้งานและสิทธิ์' },
    { id:'settings', ic:'⚙️', label:'ตั้งค่าระบบ' }
  ]}
];

/* ---------------------------------------------------------------
   2. โครงหน้าจอหลัก
   --------------------------------------------------------------- */
function renderShell(){
  const u = state.session;
  const nav = NAV.map(g=>{
    const items = g.items.filter(it=> canRoute(it.id));
    if(!items.length) return '';
    return '<div class="navgrp">'+esc(g.grp)+'</div>' + items.map(it=>
      '<button class="navitem'+(state.route===it.id?' active':'')+'" data-route="'+it.id+'">'
      + '<span class="ic">'+it.ic+'</span><span>'+esc(it.label)+'</span></button>').join('');
  }).join('');

  const syncBtn = Store.isShared()
    ? '<button id="btnSync" title="ดึงข้อมูลล่าสุดจากส่วนกลาง">'+(Store.online?'🔄':'⚠️')+'</button>' : '';

  $('#root').innerHTML =
    '<div id="app">'
    + '<div class="topbar noprint">'
    +   '<button class="menubtn mobonly" id="btnMenu" aria-label="เมนู">☰</button>'
    +   '<span class="brand">🧹 ระบบมอบหมายงานและตรวจสอบงานแม่บ้าน</span>'
    +   '<span class="sp"></span>'
    +   '<span class="pill" title="โหมดจัดเก็บข้อมูล">'+esc(Store.modeLabel())+'</span>'
    +   syncBtn
    +   '<button id="btnTheme" title="สลับโหมดสว่าง/มืด">🌓</button>'
    +   '<button id="btnUser" title="บัญชีผู้ใช้">'+esc(u.name)+' · '+esc(ROLES[u.role].label)+'</button>'
    + '</div>'
    + '<div class="layout">'
    +   '<nav class="sidebar noprint'+(state.ui.sidebarOpen?' open':'')+'" id="sidebar">'+nav+'</nav>'
    +   (state.ui.sidebarOpen ? '<div class="scrim" id="scrim"></div>' : '')
    +   '<main class="main" id="view"></main>'
    + '</div></div>';

  const menu = $('#btnMenu');
  if(menu) menu.addEventListener('click', ()=>{
    state.ui.sidebarOpen = !state.ui.sidebarOpen; renderShell(); renderRoute();
  });
  const scrim = $('#scrim');
  if(scrim) scrim.addEventListener('click', ()=>{
    state.ui.sidebarOpen = false; renderShell(); renderRoute();
  });
  const sync = $('#btnSync');
  if(sync) sync.addEventListener('click', ()=> syncNow(false));
  $('#btnTheme').addEventListener('click', toggleTheme);
  $('#btnUser').addEventListener('click', showAccountMenu);
  $$('#sidebar .navitem').forEach(b=> b.addEventListener('click', ()=>{
    state.route = b.dataset.route;
    state.ui.sidebarOpen = false;
    renderShell(); renderRoute();
  }));
}

function toggleTheme(){
  const cur  = document.documentElement.getAttribute('data-theme');
  const next = cur === 'dark' ? 'light' : cur === 'light' ? '' : 'dark';
  if(next) document.documentElement.setAttribute('data-theme', next);
  else document.documentElement.removeAttribute('data-theme');
  try{ localStorage.setItem(LS_PREFIX+'theme', next); }catch(e){}
}

/* ---------------------------------------------------------------
   3. เราต์เตอร์ (พร้อมด่านตรวจสิทธิ์)
   --------------------------------------------------------------- */
const SCREENS = {};

async function renderRoute(){
  const v = $('#view'); if(!v) return;
  if(!canRoute(state.route)){
    v.innerHTML = '<div class="card"><div class="empty">🚫 บัญชีของคุณไม่มีสิทธิ์เข้าหน้าจอนี้'
      + '<div class="hint" style="margin-top:.4rem">สิทธิ์ปัจจุบัน: '
      + esc(ROLES[state.session.role].label) + '</div></div></div>';
    return;
  }
  const fn = SCREENS[state.route];
  if(!fn){ v.innerHTML = '<div class="empty">ไม่พบหน้าจอนี้</div>'; return; }
  v.innerHTML = '<div class="empty">กำลังโหลด…</div>';
  try{ await fn(v); }
  catch(e){
    console.error(e);
    v.innerHTML = '<div class="card"><h2>เกิดข้อผิดพลาด</h2>'
      + '<pre style="white-space:pre-wrap;color:var(--danger)">'+esc(e.message)+'</pre></div>';
  }
}
function go(route){ state.route = route; renderShell(); renderRoute(); }

/* ---------------------------------------------------------------
   4. กล่องโต้ตอบ (Modal)
   --------------------------------------------------------------- */
function openModal(o){
  const acts = (o.actions||[]).map((a,i)=>
    '<button class="btn '+(a.cls||'')+'" data-act="'+i+'">'+esc(a.label)+'</button>').join('');
  $('#modalHost').innerHTML =
    '<div class="modal-bg" id="modalBg">'
    + '<div class="modal" style="'+(o.width?('max-width:'+o.width):'')+'" role="dialog" aria-modal="true">'
    +   '<header><h3>'+esc(o.title||'')+'</h3><button class="iconbtn" id="modalX" aria-label="ปิด">✕</button></header>'
    +   '<div class="body">'+(o.body||'')+'</div>'
    +   (acts ? '<footer>'+acts+'</footer>' : '')
    + '</div></div>';
  $('#modalX').onclick = closeModal;
  $('#modalBg').addEventListener('mousedown', e=>{
    if(e.target.id === 'modalBg' && !o.sticky) closeModal();
  });
  $$('#modalHost [data-act]').forEach(b=> b.onclick = ()=>{
    const a = o.actions[+b.dataset.act];
    if(a.onClick) a.onClick();
  });
  if(o.onOpen) o.onOpen();
  const f = $('#modalHost input, #modalHost select, #modalHost textarea');
  if(f) setTimeout(()=>f.focus(), 40);
}
function closeModal(){ $('#modalHost').innerHTML = ''; }

function confirmDialog(msg, onYes, yesLabel, cls){
  openModal({
    title:'ยืนยัน', width:'440px',
    body:'<p style="margin:.2rem 0 .4rem">'+msg+'</p>',
    actions:[
      { label: yesLabel || 'ตกลง', cls: cls || 'primary', onClick: ()=>{ closeModal(); onYes(); } },
      { label:'ยกเลิก', onClick: closeModal }
    ]
  });
}

/* ---------------------------------------------------------------
   5. ตัวช่วยฟอร์ม
   --------------------------------------------------------------- */
function selOptions(list, valKey, labelKey, current, placeholder){
  let h = (placeholder != null) ? '<option value="">'+esc(placeholder)+'</option>' : '';
  list.forEach(o=>{
    const v = (typeof o === 'string') ? o : o[valKey];
    const l = (typeof o === 'string') ? o
            : (typeof labelKey === 'function' ? labelKey(o) : o[labelKey]);
    h += '<option value="'+esc(v)+'"'+(String(current)===String(v)?' selected':'')+'>'+esc(l)+'</option>';
  });
  return h;
}

function dowChecks(name, selected){
  return TH_DOW.map((d,i)=>
    '<label class="chk'+((selected||[]).includes(i)?' on':'')+'">'
    + '<input type="checkbox" name="'+name+'" value="'+i+'"'
    + ((selected||[]).includes(i)?' checked':'')+'> '+esc(TH_DOW_SHORT[i])+'</label>').join(' ');
}

/** ทำให้ป้าย .chk เปลี่ยนสีตามสถานะติ๊ก */
function bindChkStyle(root){
  $$('.chk input', root || document).forEach(inp=>{
    inp.addEventListener('change', ()=> inp.closest('.chk').classList.toggle('on', inp.checked));
  });
}

function monthPicker(idPrefix){
  const years = [];
  const ty = todayParts().y;
  for(let y = ty-2; y <= ty+2; y++) years.push(y);
  return '<div class="field" style="min-width:130px"><label>เดือน</label>'
    + '<select id="'+idPrefix+'Month">'
    + TH_MONTHS.map((n,i)=>'<option value="'+i+'"'+(i===state.ui.m?' selected':'')+'>'+n+'</option>').join('')
    + '</select></div>'
    + '<div class="field" style="min-width:110px"><label>ปี (พ.ศ.)</label>'
    + '<select id="'+idPrefix+'Year">'
    + years.map(y=>'<option value="'+y+'"'+(y===state.ui.y?' selected':'')+'>'+beYear(y)+'</option>').join('')
    + '</select></div>';
}
function bindMonthPicker(idPrefix, onChange){
  $('#'+idPrefix+'Month').onchange = e=>{ state.ui.m = +e.target.value; onChange(); };
  $('#'+idPrefix+'Year').onchange  = e=>{ state.ui.y = +e.target.value; onChange(); };
}

function areaPicker(id, includeAll){
  return '<div class="field" style="min-width:170px"><label>พื้นที่</label>'
    + '<select id="'+id+'">'
    + (includeAll ? '<option value="">— ทุกพื้นที่ —</option>' : '')
    + selOptions(D.areas(true),'id','name', state.ui.areaId, includeAll ? null : '— เลือกพื้นที่ —')
    + '</select></div>';
}

function statusBadge(st){
  const s = STATUS[st] || STATUS.pending;
  return '<span class="badge '+s.cls+'">'+esc(s.label)+'</span>';
}

/** แถบความคืบหน้า */
function progressBar(pct){
  const color = pct >= 90 ? 'var(--ok)' : pct >= 70 ? 'var(--warn)' : 'var(--danger)';
  return '<div class="bar"><i style="width:'+pct+'%;background:'+color+'"></i></div>'
       + '<span class="hint">'+pct+'%</span>';
}

/* ---------------------------------------------------------------
   6. การพิมพ์
   ตั้งขนาดกระดาษให้ตรงกับเอกสารที่กำลังพิมพ์
   (CHECK SHEET รายเดือน = A4 แนวนอน, ใบเช็คงานรายวัน/ใบตรวจ = A4 แนวตั้ง)
   --------------------------------------------------------------- */
function setPageSize(orientation, margin){
  let st = document.getElementById('pageStyle');
  if(!st){ st = document.createElement('style'); st.id = 'pageStyle'; document.head.appendChild(st); }
  st.textContent = '@page{size:A4 '+(orientation||'landscape')+';margin:'+(margin||'6mm')+'}';
}

/** พิมพ์เอกสารเฉพาะกิจ โดยไม่ต้องเปิดหน้าต่างใหม่ (ปลอดภัยจากตัวบล็อก pop-up) */
function printDocument(o){
  const host = $('#printHost');
  host.innerHTML = (o.css ? '<style>'+o.css+'</style>' : '') + (o.html || '');
  setPageSize(o.orientation || 'portrait', o.margin || '10mm');
  document.body.classList.add('printing');
  const oldTitle = document.title;
  if(o.title) document.title = o.title;
  setTimeout(()=>{
    window.print();
    setTimeout(()=>{
      document.body.classList.remove('printing');
      host.innerHTML = '';
      document.title = oldTitle;
      setPageSize('landscape','6mm');
    }, 900);
  }, 250);
}

/* ---------------------------------------------------------------
   7. เมนูบัญชีผู้ใช้
   --------------------------------------------------------------- */
function showAccountMenu(){
  const u = state.session;
  const storeNote = Store.isShared()
    ? esc(Store.modeLabel()) + ' — ทุกคนเห็นข้อมูลชุดเดียวกัน'
      + (Store.online ? '' : '<br><span style="color:var(--danger)">ขณะนี้เชื่อมต่อไม่ได้ กำลังใช้แคชในเครื่อง</span>')
    : '💾 เก็บในเบราว์เซอร์เครื่องนี้ (localStorage) — ควรสำรองข้อมูลเป็นระยะ';

  openModal({
    title:'บัญชีผู้ใช้',
    body:'<div class="field"><label>ชื่อ</label><div>'+esc(u.name)+'</div></div>'
      + '<div class="field"><label>ชื่อผู้ใช้</label><div>'+esc(u.username)+'</div></div>'
      + '<div class="field"><label>สิทธิ์</label><div><span class="badge b-verified">'
        + esc(ROLES[u.role].label)+'</span></div></div>'
      + '<div class="field"><label>โหมดจัดเก็บข้อมูล</label><div>'+storeNote+'</div></div>'
      + '<hr style="border:0;border-top:1px solid var(--border);margin:.8rem 0">'
      + '<div class="row">'
      +   '<button class="btn" id="mChgPw">เปลี่ยนรหัสผ่าน</button>'
      +   '<button class="btn" id="mBackup">สำรองข้อมูล (JSON)</button>'
      +   (can('settings') ? '<button class="btn" id="mRestore">กู้คืนข้อมูล</button>' : '')
      + '</div>',
    actions:[
      { label:'ออกจากระบบ', cls:'danger', onClick:()=>{ closeModal(); logout(); } },
      { label:'ปิด', onClick: closeModal }
    ],
    onOpen:()=>{
      $('#mChgPw').onclick  = ()=>{ closeModal(); changePasswordDialog(state.session.id); };
      $('#mBackup').onclick = backupAll;
      const r = $('#mRestore');
      if(r) r.onclick = ()=>{ closeModal(); restoreDialog(); };
    }
  });
}
