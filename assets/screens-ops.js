/* =====================================================================
   screens-ops.js — หน้าจอปฏิบัติงาน
   แดชบอร์ด · มอบหมายงาน (ปฏิทิน) · งานของฉัน · รายงาน
   ===================================================================== */
'use strict';

/* =====================================================================
   1. แดชบอร์ด
   ===================================================================== */
SCREENS.dashboard = async function(v){
  const t = todayParts();
  const y = state.ui.y, m = state.ui.m;
  const plans = await loadMonthPlans(y, m);
  const isThisMonth = (y === t.y && m === t.m);
  const day = isThisMonth ? t.d : 1;
  const iso = ymd(y, m, day);
  const st  = statsForDay(plans, y, m, day);
  const hd  = holidayOn(iso);
  const offStaff = D.staffAll(true).map(s=>({ s, off: staffOffOn(s.id, iso) })).filter(x=>x.off);
  const pct = st.total ? Math.round(st.done / st.total * 100) : 0;

  const perArea = plans.map(p=> p ? { a: D.area(p.areaId), s: statsForDay([p], y, m, day) } : null)
                       .filter(x=> x && x.a);

  v.innerHTML =
    '<div class="page-head"><h1>📊 แดชบอร์ด</h1><span class="sp"></span>'
    + '<span class="hint">'+(isThisMonth?'ข้อมูลของวันนี้ ':'ข้อมูลวันที่ 1 ')
    + thDateLong(iso)+' ('+TH_DOW[dowOf(y,m,day)]+')</span></div>'
    + '<div class="toolbar">'+monthPicker('db')+'</div>'
    + (hd ? '<div class="card" style="border-color:var(--danger);background:var(--danger-soft)">'
          + '<b>🎌 วันนี้เป็นวันหยุด: '+esc(hd.name)+'</b> '
          + '<span class="hint">('+(HOLIDAY_TYPES[hd.type]||hd.type)+')</span></div>' : '')
    + '<div class="grid g4" style="margin-bottom:.9rem">'
    +   '<div class="stat info"><div class="lbl">งานทั้งหมดวันนี้</div><div class="val">'+st.total+'</div></div>'
    +   '<div class="stat ok"><div class="lbl">เสร็จแล้ว</div><div class="val">'+st.done+'</div>'
    +     '<div class="hint">'+pct+'% ของงานวันนี้</div></div>'
    +   '<div class="stat warn"><div class="lbl">ค้างอยู่</div><div class="val">'+(st.pending+st.doing)+'</div></div>'
    +   '<div class="stat bad"><div class="lbl">ไม่ผ่าน / ต้องแก้ไข</div><div class="val">'+st.problem+'</div></div>'
    +   '<div class="stat"><div class="lbl">ยังไม่มีผู้รับผิดชอบ</div><div class="val">'+st.unassigned+'</div></div>'
    +   '<div class="stat"><div class="lbl">แม่บ้านที่หยุดวันนี้</div><div class="val">'+offStaff.length+'</div></div>'
    + '</div>'
    + '<div class="grid g2">'
    + '<div class="card"><h2>ความคืบหน้าแยกตามพื้นที่</h2><div class="tablewrap"><table>'
    +   '<thead><tr><th>พื้นที่</th><th class="num">งาน</th><th class="num">เสร็จ</th>'
    +   '<th class="num">ค้าง</th><th class="num">มีปัญหา</th><th>ความคืบหน้า</th></tr></thead><tbody>'
    +   (perArea.length ? perArea.map(x=>{
          const p = x.s.total ? Math.round(x.s.done / x.s.total * 100) : 0;
          return '<tr><td><b>'+esc(x.a.name)+'</b></td><td class="num">'+x.s.total+'</td>'
            + '<td class="num" style="color:var(--ok)">'+x.s.done+'</td>'
            + '<td class="num" style="color:var(--warn)">'+(x.s.pending+x.s.doing)+'</td>'
            + '<td class="num" style="color:var(--danger)">'+x.s.problem+'</td>'
            + '<td>'+progressBar(p)+'</td></tr>';
        }).join('') : '<tr><td colspan="6" class="empty">ยังไม่ได้สร้างตารางงานของเดือนนี้</td></tr>')
    + '</tbody></table></div></div>'
    + '<div class="card"><h2>แม่บ้านที่หยุด / ลา วันนี้</h2>'
    +   (offStaff.length
        ? '<div class="tablewrap"><table><thead><tr><th>แม่บ้าน</th><th>พื้นที่หลัก</th>'
          + '<th>เหตุผล</th><th>ผู้ทดแทน</th></tr></thead><tbody>'
          + offStaff.map(x=>{
              const sub = x.off.sub || suggestSubstitute(x.s.mainAreaId, iso, x.s.id);
              return '<tr><td><b>'+esc(x.s.name)+'</b></td><td>'+esc(D.areaName(x.s.mainAreaId))+'</td>'
                + '<td><span class="badge b-leave">'+esc(x.off.label)+'</span></td>'
                + '<td>'+(sub ? esc(D.staffName(sub))
                    : '<span style="color:var(--danger)">ยังไม่มีผู้ทดแทน</span>')+'</td></tr>';
            }).join('')
          + '</tbody></table></div>'
        : '<div class="empty">ไม่มีแม่บ้านหยุดในวันนี้</div>')
    + '</div></div>'
    + '<div class="card"><h2>ทางลัด</h2><div class="row">'
    +   (canRoute('verify') ? '<button class="btn primary" id="scToday">🔍 ตรวจงานของวันนี้</button>'
    +                         '<button class="btn" id="scWeek">🔍 ตรวจงานสัปดาห์นี้</button>' : '')
    +   (canRoute('keyin')  ? '<button class="btn" id="scKeyin">⌨️ คีย์ผลจากกระดาษ</button>' : '')
    +   (canRoute('scan')   ? '<button class="btn" data-go="scan">📷 สแกนใบเช็คงาน</button>' : '')
    +   (canRoute('assign') ? '<button class="btn" data-go="assign">ไปหน้ามอบหมายงาน</button>' : '')
    +   (canRoute('print')  ? '<button class="btn" data-go="print">พิมพ์ CHECK SHEET</button>' : '')
    +   (canRoute('holidays') && (can('holiday')||can('holiday.edit'))
          ? '<button class="btn" data-go="holidays">บันทึกวันลา</button>' : '')
    + '</div></div>';

  bindMonthPicker('db', renderRoute);
  $$('[data-go]', v).forEach(b=> b.onclick = ()=> go(b.dataset.go));

  const gotoVerify = (scope)=>{
    const t2 = todayParts();
    state.ui.y = t2.y; state.ui.m = t2.m; state.ui.vfDay = t2.d;
    state.ui.vfScope = scope; state.ui.vfShow = 'todo'; state.ui.vfStaff = '';
    go('verify');
  };
  if($('#scToday')) $('#scToday').onclick = ()=> gotoVerify('day');
  if($('#scWeek'))  $('#scWeek').onclick  = ()=> gotoVerify('week');
  if($('#scKeyin')) $('#scKeyin').onclick = ()=>{
    const t3 = todayParts();
    state.ui.y = t3.y; state.ui.m = t3.m; state.ui.kiDay = t3.d;
    go('keyin');
  };
};

/* =====================================================================
   2. มอบหมายงาน (ปฏิทิน)
   ===================================================================== */
SCREENS.assign = async function(v){
  const y = state.ui.y, m = state.ui.m;
  if(!D.area(state.ui.areaId)) state.ui.areaId = (D.areas(true)[0]||{}).id || '';
  const areaId = state.ui.areaId;
  if(!areaId){ v.innerHTML = '<div class="empty">กรุณาเพิ่มพื้นที่ก่อน</div>'; return; }

  await loadMonthPlans(y, m);
  const plan  = state.plans[planKey(y,m,areaId)] || await loadPlan(y, m, areaId);
  const stats = planStats(plan);

  /* ---- คำเตือน ---- */
  const warnUnassigned = [], warnHoliday = [], warnClash = [];
  for(const k in plan.cells){
    const c = plan.cells[k];
    const iso = ymd(y, m, c.day);
    if(!c.s && c.st !== 'skipped') warnUnassigned.push(c);
    if(c.s){
      const off = staffOffOn(c.s, iso);
      if(off) warnHoliday.push({ c, off });
      const cl = findClash(y, m, c.day, c.p, c.s, areaId);
      if(cl) warnClash.push({ c, cl });
    }
  }

  const statusBadgeHtml =
    '<span class="badge '+(plan.status==='approved'?'b-verified':plan.status==='review'?'b-doing':'b-pending')+'">'
    + (plan.status==='approved'?'อนุมัติแล้ว':plan.status==='review'?'รอตรวจสอบ':'แบบร่าง')+'</span>';

  v.innerHTML =
    '<div class="page-head"><h1>🗓️ มอบหมายงาน</h1><span class="sp"></span>'+statusBadgeHtml+'</div>'
    + '<div class="toolbar noprint">'
    +   monthPicker('as') + areaPicker('asArea')
    +   '<div class="field" style="max-width:150px"><label>มุมมอง</label><select id="asMode">'
    +     '<option value="month"'+(state.ui.calMode==='month'?' selected':'')+'>รายเดือน</option>'
    +     '<option value="week"'+(state.ui.calMode==='week'?' selected':'')+'>รายสัปดาห์</option>'
    +     '<option value="day"'+(state.ui.calMode==='day'?' selected':'')+'>รายวัน</option></select></div>'
    +   '<div class="field"><label>&nbsp;</label><div class="row">'
    +     '<button class="btn primary" id="btnGen">⟳ สร้าง/อัปเดตตาราง</button>'
    +     '<button class="btn" id="btnBulk">มอบหมายเป็นชุด</button>'
    +     '<button class="btn" id="btnFix"'+(warnUnassigned.length?'':' disabled')+'>'
    +       'เติมผู้ทดแทนอัตโนมัติ ('+warnUnassigned.length+')</button>'
    +   '</div></div></div>'

    + '<div class="grid g4" style="margin-bottom:.8rem">'
    +   '<div class="stat info"><div class="lbl">งานทั้งเดือน</div><div class="val">'+stats.total+'</div></div>'
    +   '<div class="stat ok"><div class="lbl">เสร็จ/ตรวจแล้ว</div><div class="val">'
    +     (stats.done+stats.verified)+'</div></div>'
    +   '<div class="stat warn"><div class="lbl">ยังไม่มีผู้รับผิดชอบ</div><div class="val">'
    +     warnUnassigned.length+'</div></div>'
    +   '<div class="stat bad"><div class="lbl">ชนวันหยุด/ตารางชน</div><div class="val">'
    +     (warnHoliday.length + warnClash.length)+'</div></div>'
    + '</div>'

    + ((warnUnassigned.length || warnHoliday.length || warnClash.length)
      ? '<div class="card" style="border-color:var(--warn)"><h3>⚠️ คำเตือน</h3>'
        + (warnUnassigned.length ? '<div>• งาน <b>'+warnUnassigned.length+'</b> ช่อง ยังไม่มีผู้รับผิดชอบ</div>' : '')
        + (warnHoliday.length ? '<div>• งาน <b>'+warnHoliday.length+'</b> ช่อง มอบหมายให้คนที่หยุดในวันนั้น '
            + '<span class="hint">('+warnHoliday.slice(0,3).map(w=>
                'วันที่ '+w.c.day+' '+esc(D.staffName(w.c.s))+' '+esc(w.off.label)).join(' · ')
            + (warnHoliday.length>3?' …':'')+')</span></div>' : '')
        + (warnClash.length ? '<div>• งาน <b>'+warnClash.length+'</b> ช่อง ผู้รับผิดชอบซ้ำกับพื้นที่อื่นในเวลาเดียวกัน '
            + '<span class="hint">('+warnClash.slice(0,3).map(w=>
                'วันที่ '+w.c.day+' '+esc(D.staffName(w.c.s))+' @ '+esc(D.areaName(w.cl.areaId))).join(' · ')
            + (warnClash.length>3?' …':'')+')</span></div>' : '')
        + '</div>' : '')

    + '<div class="grid" style="grid-template-columns:1fr;gap:.8rem">'
    +   '<div class="card" id="calBox"></div><div class="card" id="dayBox"></div></div>'

    + '<div class="row noprint" style="margin-top:.2rem">'
    +   '<button class="btn" id="btnDraft">💾 บันทึกแบบร่าง</button>'
    +   '<button class="btn" id="btnReview">ส่งตรวจสอบ</button>'
    +   '<button class="btn primary" id="btnApprove">✔ อนุมัติตาราง</button>'
    +   (canRoute('print') ? '<button class="btn" id="btnPrintGo">🖨️ ไปหน้าพิมพ์</button>' : '')
    + '</div>';

  bindMonthPicker('as', renderRoute);
  $('#asArea').onchange = e=>{ state.ui.areaId = e.target.value; renderRoute(); };
  $('#asMode').onchange = e=>{ state.ui.calMode = e.target.value; renderRoute(); };

  $('#btnGen').onclick = ()=> openModal({
    title:'สร้าง / อัปเดตตารางงาน', width:'480px',
    body:'<p>สร้างตารางงานเดือน <b>'+TH_MONTHS[m]+' '+beYear(y)+'</b> พื้นที่ <b>'
      + esc(D.areaName(areaId))+'</b> จากรายการงานมาตรฐาน '+D.taskDefs(areaId,true).length+' รายการ</p>'
      + '<label class="chk" style="display:flex;margin-bottom:.4rem">'
      +   '<input type="checkbox" id="gOver"> เขียนทับช่องที่มีอยู่แล้ว (ล้างสถานะและผลที่บันทึกไว้)</label>'
      + '<label class="chk'+(state.data.settings.assignOnHoliday?' on':'')+'" style="display:flex">'
      +   '<input type="checkbox" id="gHol"'+(state.data.settings.assignOnHoliday?' checked':'')
      +   '> มอบหมายงานในวันหยุดด้วย</label>',
    actions:[
      { label:'สร้างตาราง', cls:'primary', onClick: async ()=>{
          const over = $('#gOver').checked;
          if(over) plan.cells = {};
          const r = generatePlan(plan, { overwrite: over, assignOnHoliday: $('#gHol').checked });
          plan.status = 'draft';
          await savePlan(plan.key);
          await saveMaster('สร้างตารางงาน '+D.areaName(areaId)+' '+TH_MONTHS[m]+' '+beYear(y));
          closeModal(); renderRoute();
          toast('สร้าง '+r.created+' ช่องงาน (ข้ามวันหยุด '+r.skipped+')','ok');
        }},
      { label:'ยกเลิก', onClick: closeModal }
    ],
    onOpen: ()=> bindChkStyle()
  });

  $('#btnBulk').onclick = ()=> bulkAssignDialog(plan);

  $('#btnFix').onclick = async ()=>{
    let n = 0;
    for(const k in plan.cells){
      const c = plan.cells[k];
      if(c.s || c.st === 'skipped') continue;
      const sub = suggestSubstitute(areaId, ymd(y,m,c.day), '');
      if(sub){
        c.s = sub; c.st = 'assigned';
        c.note = (c.note ? c.note+' · ' : '') + 'ระบบเติมผู้ทดแทน';
        n++;
      }
    }
    await savePlan(plan.key);
    await saveMaster('เติมผู้ทดแทนอัตโนมัติ '+n+' ช่อง');
    renderRoute(); toast('เติมผู้รับผิดชอบ '+n+' ช่อง','ok');
  };

  $('#btnDraft').onclick = async ()=>{
    plan.status = 'draft'; await savePlan(plan.key);
    toast('บันทึกแบบร่างแล้ว','ok'); renderRoute();
  };
  $('#btnReview').onclick = async ()=>{
    plan.status = 'review'; await savePlan(plan.key);
    await saveMaster('ส่งตารางตรวจสอบ '+D.areaName(areaId));
    toast('ส่งตรวจสอบแล้ว','ok'); renderRoute();
  };
  $('#btnApprove').onclick = ()=> confirmDialog('อนุมัติตารางงานเดือนนี้?', async ()=>{
    plan.status = 'approved';
    plan.approvals = plan.approvals || {};
    plan.approvals.plan = { by: state.session.name, role: state.session.role, at: nowIso() };
    await savePlan(plan.key);
    await saveMaster('อนุมัติตารางงาน '+D.areaName(areaId));
    renderRoute(); toast('อนุมัติแล้ว','ok');
  }, 'อนุมัติ');
  if($('#btnPrintGo')) $('#btnPrintGo').onclick = ()=> go('print');

  renderCalendar(plan);
  renderDayPanel(plan, state.ui.selDay
    || ((todayParts().y === y && todayParts().m === m) ? todayParts().d : 1));
};

/* ---- ปฏิทินรายเดือน / รายสัปดาห์ / รายวัน ---- */
function renderCalendar(plan){
  const y = plan.y, m = plan.m, areaId = plan.areaId;
  const dim = daysInMonth(y, m);
  const box = $('#calBox'); if(!box) return;
  const mode = state.ui.calMode;
  const selDay = clampInt(state.ui.selDay || 1, 1, dim);

  if(mode === 'day'){
    box.innerHTML = '<h3>เลือกวันที่</h3><div class="row">'
      + '<input type="date" id="dPick" value="'+ymd(y,m,selDay)+'" style="max-width:190px">'
      + '<button class="btn sm" id="dPrev">◀ วันก่อน</button>'
      + '<button class="btn sm" id="dNext">วันถัดไป ▶</button></div>';
    $('#dPick').onchange = e=>{
      const d = new Date(e.target.value);
      state.ui.y = d.getFullYear(); state.ui.m = d.getMonth(); state.ui.selDay = d.getDate();
      renderRoute();
    };
    $('#dPrev').onclick = ()=>{ state.ui.selDay = Math.max(1, selDay-1); renderRoute(); };
    $('#dNext').onclick = ()=>{ state.ui.selDay = Math.min(dim, selDay+1); renderRoute(); };
    return;
  }

  let from = 1, to = dim;
  if(mode === 'week'){
    from = Math.max(1, selDay - dowOf(y, m, selDay));
    to   = Math.min(dim, from + 6);
  }

  let cells = '';
  for(let i = 0; i < dowOf(y, m, from); i++) cells += '<div class="cell out"></div>';

  for(let d = from; d <= to; d++){
    const iso = ymd(y, m, d);
    const dow = dowOf(y, m, d);
    const hd  = holidayOn(iso);
    const cnt = { total:0, done:0, doing:0, fail:0, ver:0, un:0 };
    for(const k in plan.cells){
      const c = plan.cells[k];
      if(c.day !== d) continue;
      cnt.total++;
      if(c.st === 'done') cnt.done++;
      else if(c.st === 'verified') cnt.ver++;
      else if(c.st === 'doing') cnt.doing++;
      else if(ST_PROBLEM.includes(c.st)) cnt.fail++;
      if(!c.s && c.st !== 'skipped') cnt.un++;
    }
    const cls = hd ? 'hol' : dow === 0 ? 'sun' : '';
    const dots = [];
    for(let i=0;i<Math.min(cnt.ver,10);i++)   dots.push('ver');
    for(let i=0;i<Math.min(cnt.done,10);i++)  dots.push('done');
    for(let i=0;i<Math.min(cnt.doing,6);i++)  dots.push('doing');
    for(let i=0;i<Math.min(cnt.fail,6);i++)   dots.push('fail');
    const rest = Math.max(0, Math.min(cnt.total,18) - dots.length);
    for(let i=0;i<rest;i++) dots.push('pend');

    cells += '<div class="cell '+cls+(selDay===d?' sel':'')+'" data-day="'+d+'">'
      + '<div class="d">'+d+' <span class="hint" style="font-weight:400">'+TH_DOW_SHORT[dow]+'</span></div>'
      + (hd ? '<span class="tag" style="color:var(--danger)">'+esc(hd.name)+'</span>' : '')
      + (cnt.total
          ? '<span class="tag">'+cnt.total+' งาน'
            + (cnt.un ? ' · <b style="color:var(--danger)">ว่าง '+cnt.un+'</b>' : '')+'</span>'
            + '<div class="bars">'+dots.map(x=>'<i class="dot '+x+'"></i>').join('')+'</div>'
          : '<span class="tag">—</span>')
      + '</div>';
  }

  box.innerHTML = '<h3>'+TH_MONTHS[m]+' '+beYear(y)+' — '+esc(D.areaName(areaId))+'</h3>'
    + '<div class="cal">'+TH_DOW_SHORT.map(d=>'<div class="dow">'+d+'</div>').join('')+cells+'</div>'
    + '<p class="hint" style="margin-top:.5rem">'
    + '<i class="dot ver"></i> ตรวจแล้ว &nbsp; <i class="dot done"></i> เสร็จ &nbsp; '
    + '<i class="dot doing"></i> กำลังทำ &nbsp; <i class="dot fail"></i> มีปัญหา &nbsp; '
    + '<i class="dot pend"></i> ยังไม่เริ่ม &nbsp; — คลิกที่วันเพื่อจัดการงานของวันนั้น</p>';

  $$('.cell[data-day]', box).forEach(c=> c.onclick = ()=>{
    state.ui.selDay = +c.dataset.day;
    renderCalendar(plan);
    renderDayPanel(plan, +c.dataset.day);
  });
}

/* ---- แผงจัดการงานรายวัน ---- */
function renderDayPanel(plan, day){
  const box = $('#dayBox'); if(!box) return;
  const y = plan.y, m = plan.m, areaId = plan.areaId;
  state.ui.selDay = day;
  const iso = ymd(y, m, day);
  const dow = dowOf(y, m, day);
  const hd  = holidayOn(iso);

  const rows = [];
  D.taskDefs(areaId, false).forEach(td=>{
    PERIOD_KEYS.forEach(pk=>{
      const k = cellKey(td.id, day, pk);
      if(plan.cells[k]) rows.push({ k, c: plan.cells[k], td, pk });
    });
  });
  rows.sort((a,b)=> (a.pk === b.pk) ? (a.td.order - b.td.order) : (a.pk === 'morning' ? -1 : 1));

  const staffPool = D.staffAll(true);
  const editable  = can('assign') && plan.status !== 'approved';

  box.innerHTML =
    '<div class="row" style="align-items:center">'
    + '<h3 style="margin:0;flex:1">📌 งานวันที่ '+day+' '+TH_MONTHS[m]+' '+beYear(y)+' ('+TH_DOW[dow]+')'
    +   (hd ? ' <span class="badge b-failed">'+esc(hd.name)+'</span>' : '')
    +   (dow === 0 ? ' <span class="badge b-leave">วันอาทิตย์</span>' : '')+'</h3>'
    + (editable
        ? '<button class="btn sm" id="dAdd">+ เพิ่มงานในวันนี้</button>'
        + '<button class="btn sm" id="dCopy">คัดลอกไปวันอื่น</button>'
        + '<button class="btn sm danger" id="dClear">ล้างงานวันนี้</button>'
        : (plan.status === 'approved'
            ? '<span class="hint">ตารางอนุมัติแล้ว — แก้ไขไม่ได้</span>' : ''))
    + '</div>'
    + (editable
      ? '<p class="hint" style="margin:.4rem 0">ลากชื่อแม่บ้านด้านล่างไปวางบนแถวงาน เพื่อเปลี่ยนผู้รับผิดชอบ</p>'
        + '<div class="row" style="margin-bottom:.6rem">'
        + staffPool.map(s=>{
            const off = staffOffOn(s.id, iso);
            return '<span class="chk" draggable="true" data-staff="'+s.id+'"'
              + (off ? ' style="opacity:.55"' : '')
              + ' title="'+esc(off ? off.label : 'ว่าง')+'">👤 '+esc(s.name)+(off?' ⛔':'')+'</span>';
          }).join('')
        + '</div>' : '')
    + (rows.length
      ? '<div class="tablewrap"><table><thead><tr><th style="width:70px">ช่วง</th><th>งาน</th>'
        + '<th style="min-width:180px">ผู้รับผิดชอบ</th><th>สถานะ</th><th>หมายเหตุ</th>'
        + (editable ? '<th class="num"></th>' : '')+'</tr></thead><tbody>'
        + rows.map(r=>{
            const off   = r.c.s ? staffOffOn(r.c.s, iso) : null;
            const clash = r.c.s ? findClash(y, m, day, r.pk, r.c.s, areaId) : null;
            return '<tr data-k="'+esc(r.k)+'" class="drow">'
              + '<td><span class="pill">'+PERIODS[r.pk]+'</span></td>'
              + '<td><b>'+esc(r.td.name)+'</b><div class="hint">'+esc(r.td.code)+'</div></td>'
              + '<td>'
                + (editable
                    ? '<select data-sel="'+esc(r.k)+'">'
                      + selOptions(staffPool,'id','name',r.c.s,'— ยังไม่มีผู้รับผิดชอบ —')+'</select>'
                    : (r.c.s ? esc(D.staffName(r.c.s)) : '<span class="hint">—</span>'))
                + (off ? '<div style="color:var(--danger);font-size:.8rem">⛔ '+esc(off.label)+'</div>' : '')
                + (clash ? '<div style="color:var(--danger);font-size:.8rem">⚠ ซ้ำกับ '
                    + esc(D.areaName(clash.areaId))+'</div>' : '')
              + '</td>'
              + '<td>'+(editable
                  ? '<select data-st="'+esc(r.k)+'">'
                    + STATUS_KEYS.map(s=>'<option value="'+s+'"'+(r.c.st===s?' selected':'')+'>'
                      + STATUS[s].label+'</option>').join('')+'</select>'
                  : statusBadge(r.c.st))+'</td>'
              + '<td><span class="hint">'+esc(r.c.note||'')+'</span>'
                + (r.c.by ? '<div class="hint">✓ '+esc(r.c.by)+' · '+thStamp(r.c.at)+'</div>' : '')
                + (r.c.rec ? '<div class="hint">คีย์โดย '+esc(r.c.rec)+'</div>' : '')+'</td>'
              + (editable ? '<td class="num"><button class="btn sm" data-move="'+esc(r.k)+'">ย้าย</button> '
                  + '<button class="btn sm danger" data-del="'+esc(r.k)+'">ลบ</button></td>' : '')
              + '</tr>';
          }).join('')
        + '</tbody></table></div>'
      : '<div class="empty">'
        + ((hd && !state.data.settings.assignOnHoliday)
            ? 'วันหยุด — ไม่มีการมอบหมายงาน'
            : 'ยังไม่มีงานในวันนี้ กด “สร้าง/อัปเดตตาราง” หรือ “+ เพิ่มงานในวันนี้”')
        + '</div>');

  if(!editable) return;
  const persist = async (msg)=>{
    await savePlan(plan.key);
    if(msg) await saveMaster(msg);
  };

  $$('[data-sel]', box).forEach(sel=> sel.onchange = async ()=>{
    const c = plan.cells[sel.dataset.sel];
    const newId = sel.value;
    if(newId){
      const cl  = findClash(y, m, day, c.p, newId, areaId);
      const off = staffOffOn(newId, iso);
      if(cl) toast('⚠ '+D.staffName(newId)+' ถูกมอบหมายที่ '+D.areaName(cl.areaId)+' ในช่วงเวลาเดียวกัน','err');
      else if(off) toast('⚠ '+D.staffName(newId)+' '+off.label+' ในวันนี้','err');
    }
    c.s  = newId;
    c.st = newId ? (c.st === 'pending' ? 'assigned' : c.st) : 'pending';
    await persist('เปลี่ยนผู้รับผิดชอบ '+D.areaName(areaId)+' วันที่ '+day);
    renderDayPanel(plan, day); renderCalendar(plan);
  });

  $$('[data-st]', box).forEach(sel=> sel.onchange = async ()=>{
    setCellStatus(plan, sel.dataset.st, sel.value);
    await persist();
    renderDayPanel(plan, day); renderCalendar(plan);
  });

  $$('[data-del]', box).forEach(b=> b.onclick = async ()=>{
    delete plan.cells[b.dataset.del];
    await persist('ลบงานวันที่ '+day);
    renderDayPanel(plan, day); renderCalendar(plan);
  });

  $$('[data-move]', box).forEach(b=> b.onclick = ()=> moveCellDialog(plan, b.dataset.move));
  $('#dAdd').onclick   = ()=> addCellDialog(plan, day);
  $('#dCopy').onclick  = ()=> copyDayDialog(plan, day);
  $('#dClear').onclick = ()=> confirmDialog('ลบงานทั้งหมดของวันที่ '+day+'?', async ()=>{
    Object.keys(plan.cells).forEach(k=>{ if(plan.cells[k].day === day) delete plan.cells[k]; });
    await persist('ล้างงานวันที่ '+day);
    renderDayPanel(plan, day); renderCalendar(plan);
    toast('ลบแล้ว','ok');
  }, 'ลบ', 'danger');

  /* ---- ลาก-วาง เปลี่ยนผู้รับผิดชอบ ---- */
  let dragStaff = null;
  $$('[data-staff]', box).forEach(el=>{
    el.addEventListener('dragstart', e=>{
      dragStaff = el.dataset.staff;
      e.dataTransfer.setData('text/plain', dragStaff);
      e.dataTransfer.effectAllowed = 'copy';
    });
    el.addEventListener('dragend', ()=>{
      dragStaff = null;
      $$('.drow', box).forEach(r=> r.classList.remove('drag-over'));
    });
  });
  $$('.drow', box).forEach(row=>{
    row.addEventListener('dragover', e=>{
      e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; row.classList.add('drag-over');
    });
    row.addEventListener('dragleave', ()=> row.classList.remove('drag-over'));
    row.addEventListener('drop', async e=>{
      e.preventDefault(); row.classList.remove('drag-over');
      const sid = e.dataTransfer.getData('text/plain') || dragStaff;
      if(!sid) return;
      const c = plan.cells[row.dataset.k]; if(!c) return;
      const off = staffOffOn(sid, iso);
      const cl  = findClash(y, m, day, c.p, sid, areaId);
      c.s  = sid;
      c.st = (c.st === 'pending') ? 'assigned' : c.st;
      await persist('ลาก-วางเปลี่ยนผู้รับผิดชอบ วันที่ '+day);
      renderDayPanel(plan, day); renderCalendar(plan);
      if(off) toast('⚠ '+D.staffName(sid)+' '+off.label,'err');
      else if(cl) toast('⚠ ซ้ำกับพื้นที่ '+D.areaName(cl.areaId),'err');
      else toast('เปลี่ยนผู้รับผิดชอบเป็น '+D.staffName(sid),'ok');
    });
  });
}

function addCellDialog(plan, day){
  const defs = D.taskDefs(plan.areaId, true);
  openModal({
    title:'เพิ่มงานวันที่ '+day, width:'480px',
    body:'<div class="field"><label>รายการงาน</label><select id="aTask">'
      +   selOptions(defs,'id', t=> t.code+' — '+t.name, '', '— เลือกงาน —')+'</select></div>'
      + '<div class="field"><label>ช่วงเวลา</label><select id="aPeriod">'
      +   '<option value="morning">เช้า</option><option value="afternoon">บ่าย</option>'
      +   '<option value="both">ทั้งเช้าและบ่าย</option></select></div>'
      + '<div class="field"><label>ผู้รับผิดชอบ</label><select id="aStaff">'
      +   selOptions(D.staffAll(true),'id','name','','— ยังไม่กำหนด —')+'</select></div>',
    actions:[
      { label:'เพิ่ม', cls:'primary', onClick: async ()=>{
          const tid = $('#aTask').value;
          if(!tid){ toast('เลือกงานก่อน','err'); return; }
          const pv = $('#aPeriod').value, sid = $('#aStaff').value;
          const pks = (pv === 'both') ? PERIOD_KEYS : [pv];
          pks.forEach(pk=>{
            plan.cells[cellKey(tid, day, pk)] = {
              s: sid, st: sid ? 'assigned' : 'pending', note:'เพิ่มด้วยมือ', day, p:pk, t:tid
            };
          });
          await savePlan(plan.key);
          await saveMaster('เพิ่มงานวันที่ '+day);
          closeModal();
          renderDayPanel(plan, day); renderCalendar(plan);
          toast('เพิ่มแล้ว','ok');
        }},
      { label:'ยกเลิก', onClick: closeModal }
    ]
  });
}

function moveCellDialog(plan, k){
  const c = plan.cells[k];
  const dim = daysInMonth(plan.y, plan.m);
  const td = D.taskDef(c.t);
  openModal({
    title:'ย้ายงานไปวันอื่น', width:'420px',
    body:'<p>'+esc(td ? td.name : '')+' — '+PERIODS[c.p]+' (เดิมวันที่ '+c.day+')</p>'
      + '<div class="row"><div class="field"><label>ย้ายไปวันที่</label><select id="mDay">'
      +   Array.from({length:dim},(_,i)=>i+1).map(d=>
            '<option value="'+d+'"'+(d===c.day?' selected':'')+'>'+d+'</option>').join('')
      + '</select></div>'
      + '<div class="field"><label>ช่วงเวลา</label><select id="mP">'
      +   '<option value="morning"'+(c.p==='morning'?' selected':'')+'>เช้า</option>'
      +   '<option value="afternoon"'+(c.p==='afternoon'?' selected':'')+'>บ่าย</option>'
      + '</select></div></div>',
    actions:[
      { label:'ย้าย', cls:'primary', onClick: async ()=>{
          const nd = +$('#mDay').value, np = $('#mP').value;
          const nk = cellKey(c.t, nd, np);
          if(nk === k){ closeModal(); return; }
          delete plan.cells[k];
          plan.cells[nk] = Object.assign(c, { day:nd, p:np });
          await savePlan(plan.key);
          await saveMaster('ย้ายงานไปวันที่ '+nd);
          closeModal();
          renderDayPanel(plan, state.ui.selDay); renderCalendar(plan);
          toast('ย้ายแล้ว','ok');
        }},
      { label:'ยกเลิก', onClick: closeModal }
    ]
  });
}

function copyDayDialog(plan, day){
  const dim = daysInMonth(plan.y, plan.m);
  openModal({
    title:'คัดลอกงานวันที่ '+day+' ไปวันอื่น', width:'520px',
    body:'<p class="hint">เลือกวันปลายทาง (งานที่ซ้ำกันในวันนั้นจะถูกเขียนทับ)</p>'
      + '<div style="max-height:220px;overflow:auto">'
      + Array.from({length:dim},(_,i)=>i+1).map(d=>{
          const hd = holidayOn(ymd(plan.y, plan.m, d));
          return '<label class="chk" style="margin:2px"><input type="checkbox" name="cd" value="'+d+'"'
            + (d===day?' disabled':'')+'> '+d+(hd?' 🎌':'')+'</label>';
        }).join('')
      + '</div><div class="row" style="margin-top:.5rem">'
      + '<button class="btn sm" id="selWk">เลือกวันเดียวกันของทั้งเดือน</button>'
      + '<button class="btn sm" id="selAll">เลือกทั้งหมด</button>'
      + '<button class="btn sm" id="selNone">ล้าง</button></div>',
    actions:[
      { label:'คัดลอก', cls:'primary', onClick: async ()=>{
          const days = $$('input[name=cd]:checked').map(i=>+i.value);
          if(!days.length){ toast('ยังไม่ได้เลือกวัน','err'); return; }
          const src = Object.values(plan.cells).filter(c=> c.day === day);
          let n = 0;
          days.forEach(d=> src.forEach(c=>{
            plan.cells[cellKey(c.t, d, c.p)] = {
              s: c.s, st: c.s ? 'assigned' : 'pending',
              note:'คัดลอกจากวันที่ '+day, day:d, p:c.p, t:c.t
            };
            n++;
          }));
          await savePlan(plan.key);
          await saveMaster('คัดลอกงานวันที่ '+day+' ไป '+days.length+' วัน');
          closeModal(); renderRoute();
          toast('คัดลอก '+n+' ช่องงาน','ok');
        }},
      { label:'ยกเลิก', onClick: closeModal }
    ],
    onOpen:()=>{
      bindChkStyle();
      const dw = dowOf(plan.y, plan.m, day);
      const setAll = fn => $$('input[name=cd]').forEach(i=>{
        if(i.disabled) return;
        i.checked = fn(i);
        i.dispatchEvent(new Event('change'));
      });
      $('#selWk').onclick   = ()=> setAll(i=> dowOf(plan.y, plan.m, +i.value) === dw);
      $('#selAll').onclick  = ()=> setAll(()=> true);
      $('#selNone').onclick = ()=> setAll(()=> false);
    }
  });
}

function bulkAssignDialog(plan){
  const dim  = daysInMonth(plan.y, plan.m);
  const defs = D.taskDefs(plan.areaId, true);
  openModal({
    title:'มอบหมายเป็นชุด', width:'560px',
    body:'<div class="row">'
      + '<div class="field"><label>มอบหมายให้</label><select id="bStaff">'
      +   selOptions(D.staffAll(true),'id','name','','— เลือกแม่บ้าน —')+'</select></div>'
      + '<div class="field" style="max-width:190px"><label>ขอบเขต</label><select id="bScope">'
      +   '<option value="month">ทั้งเดือน</option><option value="week">สัปดาห์ที่เลือก</option>'
      +   '<option value="day">วันที่เลือก</option></select></div></div>'
      + '<div class="field"><label>เฉพาะงาน (ไม่เลือก = ทุกงาน)</label>'
      +   '<div style="max-height:150px;overflow:auto">'
      +   defs.map(t=>'<label class="chk" style="margin:2px">'
      +     '<input type="checkbox" name="bt" value="'+t.id+'"> '+esc(t.name)+'</label>').join('')
      +   '</div></div>'
      + '<div class="field"><label>ช่วงเวลา</label><select id="bPeriod">'
      +   '<option value="">ทั้งเช้าและบ่าย</option><option value="morning">เฉพาะเช้า</option>'
      +   '<option value="afternoon">เฉพาะบ่าย</option></select></div>'
      + '<label class="chk on" style="display:flex">'
      +   '<input type="checkbox" id="bSkipOff" checked> ข้ามวันที่แม่บ้านคนนี้หยุด</label>',
    actions:[
      { label:'มอบหมาย', cls:'primary', onClick: async ()=>{
          const sid = $('#bStaff').value;
          if(!sid){ toast('เลือกแม่บ้านก่อน','err'); return; }
          const scope = $('#bScope').value, pf = $('#bPeriod').value, skipOff = $('#bSkipOff').checked;
          const tsel = $$('input[name=bt]:checked').map(i=>i.value);
          const selDay = clampInt(state.ui.selDay || 1, 1, dim);
          let from = 1, to = dim;
          if(scope === 'day'){ from = to = selDay; }
          else if(scope === 'week'){
            from = Math.max(1, selDay - dowOf(plan.y, plan.m, selDay));
            to   = Math.min(dim, from + 6);
          }
          let n = 0, skipped = 0;
          for(const k in plan.cells){
            const c = plan.cells[k];
            if(c.day < from || c.day > to) continue;
            if(pf && c.p !== pf) continue;
            if(tsel.length && !tsel.includes(c.t)) continue;
            if(skipOff && staffOffOn(sid, ymd(plan.y, plan.m, c.day))){ skipped++; continue; }
            c.s = sid;
            if(c.st === 'pending') c.st = 'assigned';
            n++;
          }
          await savePlan(plan.key);
          await saveMaster('มอบหมายเป็นชุดให้ '+D.staffName(sid)+' '+n+' ช่อง');
          closeModal(); renderRoute();
          toast('มอบหมาย '+n+' ช่อง'+(skipped?' (ข้ามวันหยุด '+skipped+')':''),'ok');
        }},
      { label:'ยกเลิก', onClick: closeModal }
    ],
    onOpen: ()=> bindChkStyle()
  });
}

/* =====================================================================
   3. งานของฉัน — แม่บ้านบันทึกผลการปฏิบัติงาน
   ===================================================================== */
SCREENS.mywork = async function(v){
  const t = todayParts();
  const y = state.ui.y, m = state.ui.m;
  const dim = daysInMonth(y, m);
  const day = clampInt(state.ui.selDay || ((y===t.y && m===t.m) ? t.d : 1), 1, dim);
  const iso = ymd(y, m, day);
  await loadMonthPlans(y, m);

  const isStaff = (state.session.role === 'staff');

  // บัญชีแม่บ้านต้องผูกกับข้อมูลแม่บ้าน มิฉะนั้นจะไม่รู้ว่างานของใคร
  if(isStaff && !state.session.staffId){
    v.innerHTML = '<div class="page-head"><h1>✅ งานของฉัน</h1></div>'
      + '<div class="card" style="border-color:var(--warn);background:var(--warn-soft)">'
      + '<b>บัญชีนี้ยังไม่ได้ผูกกับข้อมูลแม่บ้าน</b>'
      + '<p class="hint">กรุณาแจ้งผู้ดูแลระบบให้ตั้งค่า “ผูกกับข้อมูลแม่บ้าน” ที่หน้าผู้ใช้งานและสิทธิ์ '
      + 'ระบบจึงจะแสดงงานที่มอบหมายให้คุณได้</p></div>';
    return;
  }

  const targetStaff = isStaff ? state.session.staffId : (state.ui.staffId || '');

  const rows = [];
  D.areas(true).forEach(a=>{
    const p = state.plans[planKey(y, m, a.id)];
    if(!p) return;
    for(const k in p.cells){
      const c = p.cells[k];
      if(c.day !== day) continue;
      if(targetStaff && c.s !== targetStaff) continue;
      rows.push({ p, k, c, area:a, td: D.taskDef(c.t) });
    }
  });
  rows.sort((a,b)=> (a.c.p === b.c.p)
    ? ((a.td?a.td.order:0) - (b.td?b.td.order:0))
    : (a.c.p === 'morning' ? -1 : 1));

  const off   = targetStaff ? staffOffOn(targetStaff, iso) : null;
  const doneN = rows.filter(r=> ST_DONE.includes(r.c.st)).length;
  const pct   = rows.length ? Math.round(doneN / rows.length * 100) : 0;

  v.innerHTML =
    '<div class="page-head"><h1>✅ งานของฉัน</h1><span class="sp"></span></div>'
    + '<div class="toolbar">'
    +   '<div class="field" style="max-width:190px"><label>วันที่</label>'
    +     '<input type="date" id="mwDate" value="'+iso+'"></div>'
    +   (!isStaff ? '<div class="field" style="min-width:180px"><label>แม่บ้าน</label><select id="mwStaff">'
    +     selOptions(D.staffAll(true),'id','name',targetStaff,'— ทุกคน —')+'</select></div>' : '')
    +   '<div class="field"><label>&nbsp;</label><div class="row">'
    +     '<button class="btn sm" id="mwPrev">◀</button>'
    +     '<button class="btn sm" id="mwToday">วันนี้</button>'
    +     '<button class="btn sm" id="mwNext">▶</button></div></div>'
    + '</div>'
    + (off ? '<div class="card" style="border-color:var(--warn);background:var(--warn-soft)">'
           + '<b>วันนี้เป็นวันหยุดของคุณ:</b> '+esc(off.label)
           + (off.sub ? ' — ผู้ทดแทน: '+esc(D.staffName(off.sub)) : '')+'</div>' : '')
    + '<div class="card"><div class="row" style="align-items:center">'
    +   '<div style="flex:1"><b>'+thDateLong(iso)+' ('+TH_DOW[dowOf(y,m,day)]+')</b>'
    +     '<div class="hint">ทำเสร็จ '+doneN+' จาก '+rows.length+' งาน</div></div>'
    +   '<div style="min-width:120px"><div class="bar" style="height:14px">'
    +     '<i style="width:'+pct+'%;background:var(--ok)"></i></div></div>'
    +   (rows.length ? '<button class="btn primary sm" id="mwAll">ทำเสร็จทั้งหมด</button>' : '')
    + '</div></div>'
    + (PERIOD_KEYS.map(pk=>{
        const list = rows.filter(r=> r.c.p === pk);
        if(!list.length) return '';
        return '<h3 style="margin:.9rem 0 .4rem">'
          + (pk === 'morning' ? '🌅 ช่วงเช้า' : '🌇 ช่วงบ่าย')+' ('+list.length+')</h3>'
          + list.map(r=>
              '<div class="taskcard s-'+r.c.st+'">'
              + '<div class="row" style="align-items:flex-start">'
              +   '<div style="flex:1;min-width:150px">'
              +     '<div class="t">'+esc(r.td ? r.td.name : '(งานถูกลบ)')+'</div>'
              +     '<div class="m">'+esc(r.area.name)
                    + (r.td && r.td.detail ? ' · '+esc(r.td.detail) : '')+'</div>'
              +     (r.c.s && !isStaff ? '<div class="m">ผู้รับผิดชอบ: '+esc(D.staffName(r.c.s))+'</div>' : '')
              +     (r.c.by ? '<div class="m">✓ ปฏิบัติโดย '+esc(r.c.by)+' · '+thStamp(r.c.at)+'</div>' : '')
              +     (r.c.rec ? '<div class="m">⌨️ บันทึกโดย '+esc(r.c.rec)+'</div>' : '')
              +     (r.c.vby ? '<div class="m">🔍 ตรวจโดย '+esc(r.c.vby)+' · '+thStamp(r.c.vat)+'</div>' : '')
              +     (r.c.note ? '<div class="m">📝 '+esc(r.c.note)+'</div>' : '')
              +   '</div><div>'+statusBadge(r.c.st)+'</div></div>'
              + '<div class="acts">'
              +   '<button class="btn sm" data-set="done" data-p="'+esc(r.p.key)+'" data-k="'+esc(r.k)+'">✓ เสร็จแล้ว</button>'
              +   '<button class="btn sm" data-set="doing" data-p="'+esc(r.p.key)+'" data-k="'+esc(r.k)+'">กำลังทำ</button>'
              +   '<button class="btn sm" data-set="skipped" data-p="'+esc(r.p.key)+'" data-k="'+esc(r.k)+'">งดปฏิบัติงาน</button>'
              +   '<button class="btn sm" data-note="1" data-p="'+esc(r.p.key)+'" data-k="'+esc(r.k)+'">📝 หมายเหตุ</button>'
              + '</div></div>').join('');
      }).join('') || '<div class="empty">ไม่มีงานที่มอบหมายในวันนี้</div>');

  const goDay = (d)=>{
    state.ui.y = d.getFullYear(); state.ui.m = d.getMonth(); state.ui.selDay = d.getDate();
    renderRoute();
  };
  $('#mwDate').onchange = e=> goDay(new Date(e.target.value));
  $('#mwPrev').onclick  = ()=>{ const d = new Date(iso); d.setDate(d.getDate()-1); goDay(d); };
  $('#mwNext').onclick  = ()=>{ const d = new Date(iso); d.setDate(d.getDate()+1); goDay(d); };
  $('#mwToday').onclick = ()=>{ const t2 = todayParts(); goDay(new Date(t2.y, t2.m, t2.d)); };
  if($('#mwStaff')) $('#mwStaff').onchange = e=>{ state.ui.staffId = e.target.value; renderRoute(); };

  const apply = async (pk, k, st)=>{
    const p = state.plans[pk]; if(!p) return;
    setCellStatus(p, k, st);
    if(st === 'done' && state.data.settings.autoApproveDone) setCellStatus(p, k, 'verified');
    await savePlan(pk);
  };

  $$('[data-set]', v).forEach(b=> b.onclick = async ()=>{
    await apply(b.dataset.p, b.dataset.k, b.dataset.set);
    renderRoute(); toast('บันทึกแล้ว','ok');
  });

  $$('[data-note]', v).forEach(b=> b.onclick = ()=>{
    const p = state.plans[b.dataset.p];
    const c = p.cells[b.dataset.k];
    openModal({
      title:'หมายเหตุ', width:'420px',
      body:'<div class="field"><label>ข้อความ</label><textarea id="nText">'+esc(c.note||'')+'</textarea></div>',
      actions:[
        { label:'บันทึก', cls:'primary', onClick: async ()=>{
            c.note = $('#nText').value.trim();
            await savePlan(b.dataset.p);
            closeModal(); renderRoute(); toast('บันทึกหมายเหตุแล้ว','ok');
          }},
        { label:'ยกเลิก', onClick: closeModal }
      ]
    });
  });

  if($('#mwAll')) $('#mwAll').onclick = ()=> confirmDialog(
    'บันทึกว่าทำเสร็จทั้งหมด '+rows.length+' งาน?', async ()=>{
      for(const r of rows) await apply(r.p.key, r.k, 'done');
      renderRoute(); toast('บันทึกเรียบร้อย','ok');
    }, 'ยืนยัน');
};

/* =====================================================================
   4. รายงานประวัติการทำงาน
   ===================================================================== */
SCREENS.report = async function(v){
  const y = state.ui.y, m = state.ui.m;
  await loadMonthPlans(y, m);
  const areaId = state.ui.areaId;
  const plans = D.areas(true).filter(a=> !areaId || a.id === areaId)
                  .map(a=> state.plans[planKey(y,m,a.id)]).filter(Boolean);

  const byStaff = {};
  plans.forEach(p=>{
    for(const k in p.cells){
      const c = p.cells[k];
      if(!c.s) continue;
      const b = byStaff[c.s] = byStaff[c.s] || { total:0, done:0, verified:0, failed:0, pending:0 };
      b.total++;
      if(c.st === 'done') b.done++;
      else if(c.st === 'verified'){ b.verified++; b.done++; }
      else if(ST_PROBLEM.includes(c.st)) b.failed++;
      else if(ST_OPEN.includes(c.st)) b.pending++;
    }
  });
  const audit = (state.data.audit || []).slice(0, 120);

  v.innerHTML =
    '<div class="page-head"><h1>📈 รายงานประวัติการทำงาน</h1><span class="sp"></span>'
    + '<button class="btn" id="rpExcel">⬇ ส่งออก Excel</button></div>'
    + '<div class="toolbar">'+monthPicker('rp')+areaPicker('rpArea', true)+'</div>'
    + '<div class="card"><h2>สรุปผลรายบุคคล — '+TH_MONTHS[m]+' '+beYear(y)+'</h2>'
    + '<div class="tablewrap"><table><thead><tr><th>แม่บ้าน</th><th>พื้นที่หลัก</th>'
    +   '<th class="num">งานที่ได้รับ</th><th class="num">เสร็จ</th><th class="num">ตรวจผ่าน</th>'
    +   '<th class="num">ไม่ผ่าน</th><th class="num">ค้าง</th><th>อัตราสำเร็จ</th></tr></thead><tbody>'
    + (Object.keys(byStaff).length ? Object.keys(byStaff).map(sid=>{
        const b = byStaff[sid];
        const p = b.total ? Math.round(b.done / b.total * 100) : 0;
        return '<tr><td><b>'+esc(D.staffName(sid))+'</b></td>'
          + '<td>'+esc(D.areaName((D.staff(sid)||{}).mainAreaId))+'</td>'
          + '<td class="num">'+b.total+'</td>'
          + '<td class="num" style="color:var(--ok)">'+b.done+'</td>'
          + '<td class="num">'+b.verified+'</td>'
          + '<td class="num" style="color:var(--danger)">'+b.failed+'</td>'
          + '<td class="num" style="color:var(--warn)">'+b.pending+'</td>'
          + '<td>'+progressBar(p)+'</td></tr>';
      }).join('') : '<tr><td colspan="8" class="empty">ยังไม่มีข้อมูลในเดือนนี้</td></tr>')
    + '</tbody></table></div></div>'
    + '<div class="card"><h2>ประวัติการแก้ไขข้อมูล (Audit Log)</h2>'
    + '<div class="tablewrap" style="max-height:420px;overflow:auto"><table>'
    +   '<thead><tr><th>เวลา</th><th>ผู้ใช้</th><th>สิทธิ์</th><th>การกระทำ</th></tr></thead><tbody>'
    + (audit.length ? audit.map(a=>
        '<tr><td class="hint">'+thStamp(a.at)+'</td><td>'+esc(a.by)+'</td>'
        + '<td><span class="pill">'+(ROLES[a.role]?ROLES[a.role].label:esc(a.role))+'</span></td>'
        + '<td>'+esc(a.action)+'</td></tr>').join('')
      : '<tr><td colspan="4" class="empty">ยังไม่มีประวัติ</td></tr>')
    + '</tbody></table></div></div>';

  bindMonthPicker('rp', renderRoute);
  $('#rpArea').onchange = e=>{ state.ui.areaId = e.target.value; renderRoute(); };
  $('#rpExcel').onclick = ()=> exportReportExcel(y, m, plans, byStaff);
};
