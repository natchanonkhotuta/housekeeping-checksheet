/* =====================================================================
   screens-verify.js — ตรวจสอบและอนุมัติงาน
   รอบตรวจรายวัน / รายสัปดาห์ / รายเดือน + ใบตรวจสำหรับพิมพ์
   ===================================================================== */
'use strict';

/** ช่วงวันที่ของรอบตรวจปัจจุบัน */
function verifyRange(){
  const y = state.ui.y, m = state.ui.m, dim = daysInMonth(y, m);
  const t = todayParts();
  let day = state.ui.vfDay;
  if(!day) day = (t.y === y && t.m === m) ? t.d : 1;
  day = clampInt(day, 1, dim);

  const scope = state.ui.vfScope || 'day';
  if(scope === 'day')  return { scope, day, from:day, to:day, dim };
  if(scope === 'week'){
    const from = Math.max(1, day - dowOf(y, m, day));
    return { scope, day, from, to: Math.min(dim, from + 6), dim };
  }
  return { scope, day, from:1, to:dim, dim };
}

function rangeLabel(r){
  const y = state.ui.y, m = state.ui.m;
  if(r.scope === 'day')  return thDateLong(ymd(y,m,r.day))+' ('+TH_DOW[dowOf(y,m,r.day)]+')';
  if(r.scope === 'week') return r.from+' – '+r.to+' '+TH_MONTHS[m]+' '+beYear(y);
  return 'ทั้งเดือน '+TH_MONTHS[m]+' '+beYear(y);
}

SCREENS.verify = async function(v){
  const y = state.ui.y, m = state.ui.m;
  await loadMonthPlans(y, m);

  const r = verifyRange();
  state.ui.vfDay = r.day;
  const areaId = (state.ui.areaId && D.area(state.ui.areaId)) ? state.ui.areaId : '';
  const show = state.ui.vfShow || 'todo';
  const staffFilter = state.ui.vfStaff || '';

  /* ---- รวบรวมงานในรอบตรวจ ---- */
  const all = [];
  D.areas(true).forEach(a=>{
    if(areaId && a.id !== areaId) return;
    const p = state.plans[planKey(y, m, a.id)];
    if(!p) return;
    for(const k in p.cells){
      const c = p.cells[k];
      if(c.day < r.from || c.day > r.to) continue;
      if(staffFilter && c.s !== staffFilter) continue;
      all.push({ p, k, c, area:a, td: D.taskDef(c.t) });
    }
  });

  const isTodo    = x=> x.c.st === 'done';                  // แม่บ้านบันทึกแล้ว รอหัวหน้าตรวจ
  const isNotDone = x=> ST_OPEN.includes(x.c.st);           // ยังไม่บันทึกผล
  const isProblem = x=> ST_PROBLEM.includes(x.c.st);
  const isOk      = x=> x.c.st === 'verified';

  const sum = {
    total: all.length,
    todo:  all.filter(isTodo).length,
    ok:    all.filter(isOk).length,
    bad:   all.filter(isProblem).length,
    open:  all.filter(isNotDone).length,
    skip:  all.filter(x=> x.c.st === 'skipped' || x.c.st === 'leave').length
  };

  let rows = all;
  if(show === 'todo')      rows = all.filter(x=> isTodo(x) || isProblem(x));
  else if(show === 'open') rows = all.filter(isNotDone);
  else if(show !== 'all')  rows = all.filter(x=> x.c.st === show);
  rows.sort((a,b)=> a.c.day - b.c.day
    || (a.area.order - b.area.order)
    || (a.c.p === b.c.p ? ((a.td?a.td.order:0) - (b.td?b.td.order:0)) : (a.c.p === 'morning' ? -1 : 1)));

  /* ---- สรุปรายแม่บ้าน ---- */
  const byStaff = {};
  all.forEach(x=>{
    const id = x.c.s || '__none';
    const b = byStaff[id] = byStaff[id] || { total:0, done:0, ok:0, bad:0, open:0 };
    b.total++;
    if(isOk(x)){ b.ok++; b.done++; }
    else if(isTodo(x)) b.done++;
    else if(isProblem(x)) b.bad++;
    else if(isNotDone(x)) b.open++;
  });

  const canVerify = can('verify') || can('verify.approve');
  const plansHere = D.areas(true).filter(a=> !areaId || a.id === areaId)
                      .map(a=> state.plans[planKey(y,m,a.id)]).filter(Boolean);

  v.innerHTML =
    '<div class="page-head"><h1>🔍 ตรวจสอบและอนุมัติงาน</h1><span class="sp"></span>'
    + '<span class="hint">รอบตรวจ: <b>'+esc(rangeLabel(r))+'</b></span></div>'

    + '<div class="toolbar">'
    +   '<div class="field" style="max-width:170px"><label>รอบการตรวจ</label><select id="vfScope">'
    +     '<option value="day"'+(r.scope==='day'?' selected':'')+'>รายวัน</option>'
    +     '<option value="week"'+(r.scope==='week'?' selected':'')+'>รายสัปดาห์</option>'
    +     '<option value="month"'+(r.scope==='month'?' selected':'')+'>ทั้งเดือน</option></select></div>'
    +   (r.scope !== 'month'
        ? '<div class="field" style="max-width:180px"><label>'
          + (r.scope === 'day' ? 'วันที่ตรวจ' : 'วันในสัปดาห์ที่ตรวจ')+'</label>'
          + '<input type="date" id="vfDate" value="'+ymd(y,m,r.day)+'"></div>'
          + '<div class="field"><label>&nbsp;</label><div class="row">'
          + '<button class="btn sm" id="vfPrev">◀ '+(r.scope==='day'?'วันก่อน':'สัปดาห์ก่อน')+'</button>'
          + '<button class="btn sm" id="vfToday">วันนี้</button>'
          + '<button class="btn sm" id="vfNext">'+(r.scope==='day'?'วันถัดไป':'สัปดาห์ถัดไป')+' ▶</button>'
          + '</div></div>'
        : monthPicker('vf'))
    +   areaPicker('vfArea', true)
    +   '<div class="field" style="min-width:150px"><label>แม่บ้าน</label><select id="vfStaff">'
    +     selOptions(D.staffAll(true),'id','name',staffFilter,'— ทุกคน —')+'</select></div>'
    +   '<div class="field" style="max-width:200px"><label>แสดง</label><select id="vfShow">'
    +     '<option value="todo"'+(show==='todo'?' selected':'')+'>รอตรวจ + มีปัญหา ('+(sum.todo+sum.bad)+')</option>'
    +     '<option value="open"'+(show==='open'?' selected':'')+'>ยังไม่บันทึกผล ('+sum.open+')</option>'
    +     '<option value="all"'+(show==='all'?' selected':'')+'>ทั้งหมดในรอบนี้ ('+sum.total+')</option>'
    +     STATUS_KEYS.map(s=>'<option value="'+s+'"'+(show===s?' selected':'')+'>เฉพาะ: '
          + STATUS[s].label+'</option>').join('')
    +   '</select></div>'
    + '</div>'

    + '<div class="grid g4" style="margin-bottom:.8rem">'
    +   '<div class="stat info"><div class="lbl">งานในรอบตรวจ</div><div class="val">'+sum.total+'</div>'
    +     '<div class="hint">'+esc(rangeLabel(r))+'</div></div>'
    +   '<div class="stat warn"><div class="lbl">รอหัวหน้าตรวจ</div><div class="val">'+sum.todo+'</div></div>'
    +   '<div class="stat ok"><div class="lbl">ตรวจผ่านแล้ว</div><div class="val">'+sum.ok+'</div>'
    +     '<div class="hint">'+(sum.total ? Math.round(sum.ok/sum.total*100) : 0)+'% ของรอบนี้</div></div>'
    +   '<div class="stat bad"><div class="lbl">ไม่ผ่าน / ต้องแก้ไข</div><div class="val">'+sum.bad+'</div></div>'
    +   '<div class="stat"><div class="lbl">แม่บ้านยังไม่บันทึกผล</div><div class="val">'+sum.open+'</div></div>'
    +   '<div class="stat"><div class="lbl">งด / หยุด–ลา</div><div class="val">'+sum.skip+'</div></div>'
    + '</div>'

    + (canVerify
      ? '<div class="row" style="margin-bottom:.8rem">'
        + '<button class="btn primary" id="vfPassAll"'+(sum.todo?'':' disabled')+'>'
        +   '✔ ตรวจผ่านทั้งหมดที่รอตรวจ ('+sum.todo+')</button>'
        + (r.scope !== 'month'
            ? '<button class="btn" id="vfCloseRound"'+(sum.open?'':' disabled')+'>'
              + 'ปิดรอบ — ทำเครื่องหมายงานที่ไม่ได้ทำ ('+sum.open+')</button>' : '')
        + '<span class="sp" style="flex:1"></span>'
        + '<button class="btn" id="vfPrint">🖨️ พิมพ์ใบตรวจรอบนี้</button>'
        + '</div>' : '')

    + '<div class="card"><h3>สรุปรายแม่บ้านในรอบตรวจ</h3><div class="tablewrap"><table>'
    +   '<thead><tr><th>แม่บ้าน</th><th>พื้นที่หลัก</th><th class="num">งาน</th><th class="num">บันทึกแล้ว</th>'
    +   '<th class="num">ตรวจผ่าน</th><th class="num">มีปัญหา</th><th class="num">ยังไม่บันทึก</th>'
    +   '<th>ความคืบหน้า</th></tr></thead><tbody>'
    +   (Object.keys(byStaff).length ? Object.keys(byStaff).map(sid=>{
          const b = byStaff[sid];
          const pc = b.total ? Math.round(b.done / b.total * 100) : 0;
          const nm = sid === '__none'
            ? '<span style="color:var(--danger)">— ยังไม่มีผู้รับผิดชอบ —</span>'
            : esc(D.staffName(sid));
          return '<tr><td><b>'+nm+'</b></td>'
            + '<td>'+(sid === '__none' ? '—' : esc(D.areaName((D.staff(sid)||{}).mainAreaId)))+'</td>'
            + '<td class="num">'+b.total+'</td><td class="num">'+b.done+'</td>'
            + '<td class="num" style="color:var(--ok)">'+b.ok+'</td>'
            + '<td class="num" style="color:var(--danger)">'+b.bad+'</td>'
            + '<td class="num" style="color:var(--warn)">'+b.open+'</td>'
            + '<td>'+progressBar(pc)+'</td></tr>';
        }).join('') : '<tr><td colspan="8" class="empty">ไม่มีงานในรอบตรวจนี้</td></tr>')
    + '</tbody></table></div></div>'

    + '<div class="tablewrap"><table><thead><tr><th class="num">วันที่</th><th>ช่วง</th><th>พื้นที่</th>'
    +   '<th>งาน</th><th>ผู้ปฏิบัติ</th><th>สถานะ</th><th>หมายเหตุ</th>'
    +   (canVerify ? '<th class="num">ผลการตรวจ</th>' : '')+'</tr></thead><tbody>'
    + (rows.length ? verifyRowsHtml(rows, r, canVerify)
        : '<tr><td colspan="8" class="empty">'
          + (show === 'todo' ? 'ไม่มีงานรอตรวจในรอบนี้ — เรียบร้อยทั้งหมด ✔' : 'ไม่มีรายการตรงกับตัวกรอง')
          + '</td></tr>')
    + '</tbody></table></div>'

    + '<div class="card" style="margin-top:.9rem"><h3>สถานะการอนุมัติตารางรายเดือน</h3>'
    + '<div class="tablewrap"><table><thead><tr><th>พื้นที่</th><th>สถานะตาราง</th><th>ผู้อนุมัติ</th>'
    +   '<th class="num">งานทั้งเดือน</th><th class="num">ตรวจผ่าน</th><th class="num"></th></tr></thead><tbody>'
    + (plansHere.length ? plansHere.map(p=>{
        const s = planStats(p), a = D.area(p.areaId);
        return '<tr><td><b>'+esc(a?a.name:'')+'</b></td>'
          + '<td><span class="badge '
            + (p.status==='approved'?'b-verified':p.status==='review'?'b-doing':'b-pending')+'">'
            + (p.status==='approved'?'อนุมัติแล้ว':p.status==='review'?'รอตรวจสอบ':'แบบร่าง')+'</span></td>'
          + '<td class="hint">'+(p.approvals && p.approvals.plan
              ? esc(p.approvals.plan.by)+' · '+thStamp(p.approvals.plan.at) : '—')+'</td>'
          + '<td class="num">'+s.total+'</td><td class="num">'+s.verified+'</td>'
          + '<td class="num">'+(canVerify
              ? '<button class="btn sm primary" data-appr="'+esc(p.key)+'">อนุมัติ</button>' : '')+'</td></tr>';
      }).join('') : '<tr><td colspan="6" class="empty">ยังไม่มีตารางงาน</td></tr>')
    + '</tbody></table></div></div>';

  /* ---- ตัวควบคุม ---- */
  $('#vfScope').onchange = e=>{ state.ui.vfScope = e.target.value; renderRoute(); };
  if($('#vfDate')){
    $('#vfDate').onchange = e=>{
      const d = new Date(e.target.value);
      state.ui.y = d.getFullYear(); state.ui.m = d.getMonth(); state.ui.vfDay = d.getDate();
      renderRoute();
    };
    const step = dir=>{
      const d = new Date(ymd(y, m, r.day));
      d.setDate(d.getDate() + dir * (r.scope === 'week' ? 7 : 1));
      state.ui.y = d.getFullYear(); state.ui.m = d.getMonth(); state.ui.vfDay = d.getDate();
      renderRoute();
    };
    $('#vfPrev').onclick  = ()=> step(-1);
    $('#vfNext').onclick  = ()=> step(1);
    $('#vfToday').onclick = ()=>{
      const t = todayParts();
      state.ui.y = t.y; state.ui.m = t.m; state.ui.vfDay = t.d;
      renderRoute();
    };
  } else bindMonthPicker('vf', renderRoute);

  $('#vfArea').onchange  = e=>{ state.ui.areaId  = e.target.value; renderRoute(); };
  $('#vfStaff').onchange = e=>{ state.ui.vfStaff = e.target.value; renderRoute(); };
  $('#vfShow').onchange  = e=>{ state.ui.vfShow  = e.target.value; renderRoute(); };

  $$('[data-v]', v).forEach(b=> b.onclick = async ()=>{
    const p = state.plans[b.dataset.p];
    if(b.dataset.v === 'failed' || b.dataset.v === 'rework'){
      reasonDialog(p, b.dataset.k, b.dataset.v);
      return;
    }
    setCellStatus(p, b.dataset.k, b.dataset.v);
    await savePlan(b.dataset.p);
    renderRoute();
  });

  if(!canVerify) return;

  $('#vfPassAll').onclick = ()=> confirmDialog(
    'ตรวจผ่านงานที่รอตรวจทั้งหมด <b>'+sum.todo+'</b> รายการ ใน'+esc(rangeLabel(r))+'?', async ()=>{
      const list = all.filter(isTodo);
      list.forEach(x=> setCellStatus(x.p, x.k, 'verified'));
      const keys = Array.from(new Set(list.map(x=> x.p.key)));
      for(const key of keys) await savePlan(key);
      await saveMaster('ตรวจผ่าน '+list.length+' รายการ ('+rangeLabel(r)+')');
      renderRoute(); toast('ตรวจสอบเรียบร้อย','ok');
    }, 'ตรวจผ่านทั้งหมด');

  if($('#vfCloseRound'))
    $('#vfCloseRound').onclick = ()=> closeRoundDialog(all.filter(isNotDone), r);

  $('#vfPrint').onclick = ()=> printRound(all, r, sum, byStaff);

  $$('[data-appr]', v).forEach(b=> b.onclick = ()=> confirmDialog(
    'อนุมัติตารางงานของพื้นที่นี้?', async ()=>{
      const p = state.plans[b.dataset.appr];
      p.status = 'approved';
      p.approvals = p.approvals || {};
      p.approvals.plan = { by: state.session.name, role: state.session.role, at: nowIso() };
      await savePlan(p.key);
      await saveMaster('อนุมัติตาราง '+D.areaName(p.areaId));
      renderRoute(); toast('อนุมัติแล้ว','ok');
    }, 'อนุมัติ'));
};

/** แถวรายการ พร้อมหัวข้อคั่นเมื่อขึ้นวันใหม่ */
function verifyRowsHtml(rows, r, canVerify){
  const y = state.ui.y, m = state.ui.m;
  let out = '', lastDay = null;
  rows.forEach(x=>{
    if(r.scope !== 'day' && x.c.day !== lastDay){
      lastDay = x.c.day;
      const hd = holidayOn(ymd(y, m, x.c.day));
      const n  = rows.filter(z=> z.c.day === x.c.day).length;
      out += '<tr style="background:var(--surface-2)"><td colspan="'+(canVerify?8:7)+'">'
        + '<b>'+x.c.day+' '+TH_MONTHS[m]+' ('+TH_DOW[dowOf(y,m,x.c.day)]+')</b>'
        + '<span class="hint"> — '+n+' รายการ</span>'
        + (hd ? ' <span class="badge b-failed">'+esc(hd.name)+'</span>' : '')+'</td></tr>';
    }
    const off = x.c.s ? staffOffOn(x.c.s, ymd(y, m, x.c.day)) : null;
    out += '<tr>'
      + '<td class="num">'+x.c.day+'</td><td><span class="pill">'+PERIODS[x.c.p]+'</span></td>'
      + '<td>'+esc(x.area.name)+'</td>'
      + '<td><b>'+esc(x.td ? x.td.name : '—')+'</b>'
        + (x.td ? '<div class="hint">'+esc(x.td.code)+'</div>' : '')+'</td>'
      + '<td>'+(x.c.s ? esc(D.staffName(x.c.s))
          : '<span class="hint" style="color:var(--danger)">ยังไม่มีผู้รับผิดชอบ</span>')
        + (x.c.at ? '<div class="hint">บันทึก '+thStamp(x.c.at)+'</div>' : '')
        + (off ? '<div class="hint" style="color:var(--danger)">⛔ '+esc(off.label)+'</div>' : '')+'</td>'
      + '<td>'+statusBadge(x.c.st)
        + (x.c.vby ? '<div class="hint">'+esc(x.c.vby)+' · '+thStamp(x.c.vat)+'</div>' : '')+'</td>'
      + '<td class="hint">'+esc(x.c.note||'')+'</td>'
      + (canVerify
        ? '<td class="num" style="white-space:nowrap">'
          + '<button class="btn sm" data-v="verified" data-p="'+esc(x.p.key)+'" data-k="'+esc(x.k)+'">ผ่าน</button> '
          + '<button class="btn sm danger" data-v="failed" data-p="'+esc(x.p.key)+'" data-k="'+esc(x.k)+'">ไม่ผ่าน</button> '
          + '<button class="btn sm" data-v="rework" data-p="'+esc(x.p.key)+'" data-k="'+esc(x.k)+'">ให้แก้ไข</button></td>'
        : '')
      + '</tr>';
  });
  return out;
}

/** ระบุเหตุผลเมื่อตรวจไม่ผ่าน / ให้แก้ไข */
function reasonDialog(plan, k, status){
  const c = plan.cells[k];
  const td = D.taskDef(c.t);
  const presets = ['ทำความสะอาดไม่ทั่วถึง','ยังมีคราบสกปรก','ไม่ได้เปลี่ยนถุงขยะ',
                   'ของใช้สิ้นเปลืองไม่ครบ','อุปกรณ์ไม่เข้าที่','ไม่ได้ปฏิบัติจริง'];
  openModal({
    title: status === 'failed' ? 'ตรวจไม่ผ่าน' : 'ให้แก้ไขงาน', width:'480px',
    body:'<p><b>'+esc(td ? td.name : '')+'</b> — วันที่ '+c.day+' ('+PERIODS[c.p]+')'
      + (c.s ? ' · '+esc(D.staffName(c.s)) : '')+'</p>'
      + '<div class="field"><label>เหตุผล (เลือกหรือพิมพ์เอง)</label><div>'
      +   presets.map(p=>'<button type="button" class="btn sm" data-preset="'+esc(p)+'" '
      +     'style="margin:2px">'+esc(p)+'</button>').join('')
      + '</div></div>'
      + '<div class="field"><label>รายละเอียดที่ต้องแก้ไข</label>'
      +   '<textarea id="rzText">'+esc(c.note||'')+'</textarea></div>',
    actions:[
      { label:'บันทึกผลการตรวจ', cls:'primary', onClick: async ()=>{
          const txt = $('#rzText').value.trim();
          if(!txt){ toast('กรุณาระบุเหตุผล','err'); return; }
          setCellStatus(plan, k, status, { note: txt });
          await savePlan(plan.key);
          await saveMaster('ตรวจ'+(status==='failed'?'ไม่ผ่าน':'ให้แก้ไข')+': '
            + (td?td.name:'')+' วันที่ '+c.day+' — '+txt);
          closeModal(); renderRoute(); toast('บันทึกผลการตรวจแล้ว','ok');
        }},
      { label:'ยกเลิก', onClick: closeModal }
    ],
    onOpen:()=>{
      $$('[data-preset]').forEach(b=> b.onclick = ()=>{
        const t = $('#rzText');
        t.value = t.value ? t.value+' · '+b.dataset.preset : b.dataset.preset;
      });
    }
  });
}

/** ปิดรอบตรวจ — จัดการงานที่ยังไม่มีข้อสรุป */
function closeRoundDialog(openRows, r){
  openModal({
    title:'ปิดรอบตรวจ', width:'520px',
    body:'<p>ใน<b>'+esc(rangeLabel(r))+'</b> มีงาน <b>'+openRows.length+'</b> รายการที่แม่บ้านยังไม่ได้บันทึกผล '
      + '<span class="hint">(ยังไม่เริ่ม / มอบหมายแล้ว / กำลังดำเนินการ)</span></p>'
      + '<div class="field"><label>ต้องการทำเครื่องหมายงานเหล่านี้เป็น</label><select id="crSt">'
      +   '<option value="failed">ไม่ผ่าน — ไม่ได้ปฏิบัติงาน</option>'
      +   '<option value="rework">ต้องแก้ไข — ให้ตามเก็บงาน</option>'
      +   '<option value="skipped">งดปฏิบัติงาน — ยกเลิกงานวันนั้น</option></select></div>'
      + '<div class="field"><label>หมายเหตุที่จะบันทึกลงทุกรายการ</label>'
      +   '<input id="crNote" value="ไม่พบการบันทึกผลเมื่อปิดรอบตรวจ"></div>'
      + '<p class="hint">ใช้เมื่อสิ้นวันหรือสิ้นสัปดาห์ เพื่อไม่ให้มีงานค้างสถานะโดยไม่มีข้อสรุป</p>',
    actions:[
      { label:'ปิดรอบ', cls:'danger', onClick: async ()=>{
          const st = $('#crSt').value, note = $('#crNote').value.trim();
          openRows.forEach(x=> setCellStatus(x.p, x.k, st, note ? { note } : undefined));
          const keys = Array.from(new Set(openRows.map(x=> x.p.key)));
          for(const key of keys) await savePlan(key);
          await saveMaster('ปิดรอบตรวจ '+rangeLabel(r)+' — '+openRows.length
            + ' รายการเป็น "'+STATUS[st].label+'"');
          closeModal(); renderRoute(); toast('ปิดรอบตรวจแล้ว','ok');
        }},
      { label:'ยกเลิก', onClick: closeModal }
    ]
  });
}

/* ---------------------------------------------------------------
   ใบตรวจรอบวัน/สัปดาห์/เดือน สำหรับพิมพ์และเซ็นชื่อ
   พิมพ์ในหน้าเดิม จึงไม่ถูกตัวบล็อก pop-up ขวาง
   --------------------------------------------------------------- */
const ROUND_SHEET_CSS = ''
  + '#printHost .rs{font-family:"Sarabun","Noto Sans Thai",Tahoma,sans-serif;font-size:10pt;color:#000;background:#fff}'
  + '#printHost .rs *{color:#000}'
  + '#printHost .rs h1{font-size:14pt;margin:0 0 2px;text-align:center}'
  + '#printHost .rs .sub{text-align:center;font-size:10pt;margin-bottom:8px}'
  + '#printHost .rs .hd{display:flex;justify-content:space-between;font-size:9pt;'
  +   'border-bottom:1.5pt solid #000;padding-bottom:4px;margin-bottom:6px}'
  + '#printHost .rs table{border-collapse:collapse;width:100%;font-size:8.6pt;margin-bottom:8px}'
  + '#printHost .rs th,#printHost .rs td{border:.6pt solid #000;padding:2px 4px;text-align:left;vertical-align:top}'
  + '#printHost .rs th{background:#e8e8e8;font-weight:700}'
  + '#printHost .rs td.c,#printHost .rs th.c{text-align:center;white-space:nowrap}'
  + '#printHost .rs .sum{display:flex;gap:6px;margin-bottom:8px;font-size:9pt}'
  + '#printHost .rs .sum div{flex:1;border:.6pt solid #000;padding:3px 6px}'
  + '#printHost .rs .sum b{display:block;font-size:13pt}'
  + '#printHost .rs .sign{display:flex;gap:10px;margin-top:14px;font-size:9pt}'
  + '#printHost .rs .sign div{flex:1;border:.6pt solid #000;padding:5px 8px;min-height:58px}'
  + '#printHost .rs .ln{border-bottom:.6pt dotted #000;height:20px;margin:14px 0 3px}'
  + '#printHost .rs tr{page-break-inside:avoid}'
  + '#printHost .rs thead{display:table-header-group}';

function printRound(all, r, sum, byStaff){
  const y = state.ui.y, m = state.ui.m, org = state.data.org;
  const rows = all.slice().sort((a,b)=> a.c.day - b.c.day
    || (a.area.order - b.area.order)
    || (a.c.p === b.c.p ? 0 : (a.c.p === 'morning' ? -1 : 1)));

  const scopeName = r.scope === 'day' ? 'ประจำวัน' : r.scope === 'week' ? 'ประจำสัปดาห์' : 'ประจำเดือน';
  const html =
    '<div class="rs">'
    + '<div class="hd"><span><b>'+esc(org.name)+'</b> · '+esc(org.dept)+'</span>'
    +   '<span>'+esc(org.doc)+' · แก้ไขครั้งที่ '+esc(org.rev)+'</span></div>'
    + '<h1>ใบตรวจงานแม่บ้าน — รอบ'+scopeName+'</h1>'
    + '<div class="sub">'+esc(rangeLabel(r))
    +   ((state.ui.areaId && D.area(state.ui.areaId))
        ? ' · พื้นที่ '+esc(D.areaName(state.ui.areaId)) : ' · ทุกพื้นที่')+'</div>'
    + '<div class="sum">'
    +   '<div>งานในรอบ<b>'+sum.total+'</b></div><div>รอตรวจ<b>'+sum.todo+'</b></div>'
    +   '<div>ตรวจผ่าน<b>'+sum.ok+'</b></div><div>ไม่ผ่าน/แก้ไข<b>'+sum.bad+'</b></div>'
    +   '<div>ยังไม่บันทึก<b>'+sum.open+'</b></div></div>'
    + '<table><thead><tr><th class="c">วันที่</th><th class="c">ช่วง</th><th>พื้นที่</th>'
    +   '<th>รายการงาน</th><th>ผู้ปฏิบัติงาน</th><th class="c">สถานะ</th>'
    +   '<th>หมายเหตุ / สิ่งที่ต้องแก้ไข</th><th class="c">ผลตรวจ</th></tr></thead><tbody>'
    + (rows.length ? rows.map(x=>
        '<tr><td class="c">'+x.c.day+'</td><td class="c">'+PERIODS[x.c.p]+'</td>'
        + '<td>'+esc(x.area.name)+'</td><td>'+esc(x.td ? x.td.name : '—')+'</td>'
        + '<td>'+(x.c.s ? esc(D.staffName(x.c.s)) : '—')+'</td>'
        + '<td class="c">'+(STATUS[x.c.st] ? esc(STATUS[x.c.st].label) : '')+'</td>'
        + '<td>'+esc(x.c.note||'')+'</td><td class="c" style="width:42px"></td></tr>').join('')
      : '<tr><td colspan="8" style="text-align:center;padding:12px">ไม่มีงานในรอบตรวจนี้</td></tr>')
    + '</tbody></table>'
    + '<table><thead><tr><th>แม่บ้าน</th><th class="c">งาน</th><th class="c">บันทึกแล้ว</th>'
    +   '<th class="c">ตรวจผ่าน</th><th class="c">มีปัญหา</th><th class="c">ยังไม่บันทึก</th>'
    +   '<th>ลงชื่อรับทราบ</th></tr></thead><tbody>'
    + Object.keys(byStaff).map(sid=>{
        const b = byStaff[sid];
        return '<tr><td>'+(sid === '__none' ? '— ยังไม่มีผู้รับผิดชอบ —' : esc(D.staffName(sid)))+'</td>'
          + '<td class="c">'+b.total+'</td><td class="c">'+b.done+'</td><td class="c">'+b.ok+'</td>'
          + '<td class="c">'+b.bad+'</td><td class="c">'+b.open+'</td>'
          + '<td style="width:150px"></td></tr>';
      }).join('')
    + '</tbody></table>'
    + '<div class="sign">'
    +   '<div><b>ผู้ตรวจสอบ (หัวหน้าแม่บ้าน)</b><div class="ln"></div>'
    +     '( …………………………………… )<br>วันที่ ……… / ……… / ………</div>'
    +   '<div><b>ผู้รับทราบ / ผู้บริหาร</b><div class="ln"></div>'
    +     '( …………………………………… )<br>วันที่ ……… / ……… / ………</div></div>'
    + '<p style="font-size:8pt;margin-top:8px">พิมพ์เมื่อ '+esc(thStamp(nowIso()))
    +   ' โดย '+esc(state.session.name)+'</p>'
    + '</div>';

  printDocument({
    title: 'ใบตรวจงาน_'+scopeName+'_'+TH_MONTHS[m]+'_'+beYear(y),
    html, css: ROUND_SHEET_CSS, orientation:'portrait', margin:'12mm'
  });
}
