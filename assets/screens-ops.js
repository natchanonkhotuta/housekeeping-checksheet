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
  const cyc = ensureCycle();
  const y = cyc.y, m = cyc.m;
  await loadCycleAll(y, m);
  // วันที่แสดง: วันนี้ถ้าอยู่ในรอบ ไม่อยู่ก็วันแรกของรอบ
  const tc = cycleOfDate(t.y, t.m, t.d);
  const isThisCycle = (tc.y === y && tc.m === m);
  const days = cycleDays(y, m);
  const dd  = isThisCycle ? { y:t.y, m:t.m, d:t.d, iso: ymd(t.y, t.m, t.d) } : days[0];
  const iso = dd.iso;
  const plans = D.areas(true).map(a=> planAt(dd, a.id)).filter(Boolean);
  const st  = statsForDay(plans, dd.y, dd.m, dd.d);
  const hd  = holidayOn(iso);
  const offStaff = D.staffAll(true).map(s=>({ s, off: staffOffOn(s.id, iso) })).filter(x=>x.off);
  const pct = st.total ? Math.round(st.done / st.total * 100) : 0;

  const perArea = plans.map(p=> p ? { a: D.area(p.areaId), s: statsForDay([p], dd.y, dd.m, dd.d) } : null)
                       .filter(x=> x && x.a);

  v.innerHTML =
    '<div class="page-head"><h1>📊 แดชบอร์ด</h1><span class="sp"></span>'
    + '<span class="hint">'+(isThisCycle?'ข้อมูลของวันนี้ ':'ข้อมูลวันแรกของรอบ ')
    + thDateLong(iso)+' ('+TH_DOW[dowOf(dd.y,dd.m,dd.d)]+')</span></div>'
    + '<div class="toolbar">'+cyclePicker('db')+'</div>'
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
        }).join('') : '<tr><td colspan="6" class="empty">ยังไม่ได้สร้างตารางงานของรอบนี้</td></tr>')
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

  bindCyclePicker('db', renderRoute);
  $$('[data-go]', v).forEach(b=> b.onclick = ()=> go(b.dataset.go));

  const gotoVerify = (scope)=>{
    const t2 = todayParts();
    const cv = cycleOfDate(t2.y, t2.m, t2.d);
    state.ui.cy = cv.y; state.ui.cm = cv.m;
    state.ui.vfIso = ymd(t2.y, t2.m, t2.d);
    state.ui.vfScope = scope; state.ui.vfShow = 'todo'; state.ui.vfStaff = '';
    go('verify');
  };
  if($('#scToday')) $('#scToday').onclick = ()=> gotoVerify('day');
  if($('#scWeek'))  $('#scWeek').onclick  = ()=> gotoVerify('week');
  if($('#scKeyin')) $('#scKeyin').onclick = ()=>{
    const t3 = todayParts();
    const ck = cycleOfDate(t3.y, t3.m, t3.d);
    state.ui.cy = ck.y; state.ui.cm = ck.m;
    state.ui.kiIso = ymd(t3.y, t3.m, t3.d);
    go('keyin');
  };
};

/* =====================================================================
   2. มอบหมายงาน (ปฏิทินรอบ 21–20)
   เก็บข้อมูลยังแยกรายเดือน แต่ทุกหน้าจอมองเป็นรอบเดียว
   ===================================================================== */
SCREENS.assign = async function(v){
  const cyc = ensureCycle();
  const y = cyc.y, m = cyc.m;
  if(!D.area(state.ui.areaId)) state.ui.areaId = (D.areas(true)[0]||{}).id || '';
  const areaId = state.ui.areaId;
  if(!areaId){ v.innerHTML = '<div class="empty">กรุณาเพิ่มพื้นที่ก่อน</div>'; return; }

  await loadCycleAll(y, m);
  const cp     = await cyclePlanSet(y, m, areaId);
  const stats  = cycleStats(cp);
  const status = cycleStatus(cp);
  const ents   = cp.entries();

  /* ---- คำเตือน ---- */
  const warnUnassigned = [], warnHoliday = [], warnClash = [], warnInactive = [];
  const inactiveWho = {};
  ents.forEach(e=>{
    const c = e.c, iso = e.dd.iso;
    if(!c.s && c.st !== 'skipped') warnUnassigned.push(e);
    if(c.s){
      const inact = staffInactive(c.s);
      if(inact){
        warnInactive.push({ e, label: inact });
        inactiveWho[c.s] = inact;
      } else {
        const off = staffOffOn(c.s, iso);
        if(off) warnHoliday.push({ e, off });
      }
      const cl = findClash(e.dd.y, e.dd.m, e.dd.d, c.p, c.s, areaId);
      if(cl) warnClash.push({ e, cl });
    }
  });

  const warnDay = w => w.e.dd.d + ' ' + TH_MONTHS_SHORT[w.e.dd.m];

  const statusBadgeHtml =
    '<span class="badge '+(status==='approved'?'b-verified':status==='review'?'b-doing':'b-pending')+'">'
    + (status==='approved'?'อนุมัติแล้ว':status==='review'?'รอตรวจสอบ':'แบบร่าง')+'</span>';

  v.innerHTML =
    '<div class="page-head"><h1>🗓️ มอบหมายงาน</h1><span class="sp"></span>'+statusBadgeHtml+'</div>'
    + '<div class="toolbar noprint">'
    +   cyclePicker('as') + areaPicker('asArea')
    +   '<div class="field" style="max-width:150px"><label>มุมมอง</label><select id="asMode">'
    +     '<option value="month"'+(state.ui.calMode==='month'?' selected':'')+'>ทั้งรอบ</option>'
    +     '<option value="week"'+(state.ui.calMode==='week'?' selected':'')+'>รายสัปดาห์</option>'
    +     '<option value="day"'+(state.ui.calMode==='day'?' selected':'')+'>รายวัน</option></select></div>'
    +   '<div class="field"><label>&nbsp;</label><div class="row">'
    +     '<button class="btn primary" id="btnGen">⟳ สร้าง/อัปเดตตาราง</button>'
    +     '<button class="btn" id="btnBulk">มอบหมายเป็นชุด</button>'
    +     '<button class="btn" id="btnFix"'+(warnUnassigned.length?'':' disabled')+'>'
    +       'เติมผู้ทดแทนอัตโนมัติ ('+warnUnassigned.length+')</button>'
    +     '<button class="btn" id="btnAssignArea">👥 ตั้งผู้รับผิดชอบตามพื้นที่</button>'
    +     '<button class="btn danger" id="btnClear">🗑️ ล้างตาราง</button>'
    +   '</div></div></div>'

    + '<div class="grid g4" style="margin-bottom:.8rem">'
    +   '<div class="stat info"><div class="lbl">งานทั้งรอบ</div><div class="val">'+stats.total+'</div>'
    +     '<div class="hint">'+cycleLabelShort(y, m)+'</div></div>'
    +   '<div class="stat ok"><div class="lbl">เสร็จ/ตรวจแล้ว</div><div class="val">'
    +     (stats.done+stats.verified)+'</div></div>'
    +   '<div class="stat warn"><div class="lbl">ยังไม่มีผู้รับผิดชอบ</div><div class="val">'
    +     warnUnassigned.length+'</div></div>'
    +   '<div class="stat bad"><div class="lbl">ชนวันหยุด/ตารางชน</div><div class="val">'
    +     (warnHoliday.length + warnClash.length)+'</div></div>'
    + '</div>'

    + (warnInactive.length
      ? '<div class="card" style="border-color:var(--danger);background:var(--danger-soft)">'
        + '<h3>🚫 มอบหมายให้คนที่ไม่ได้ปฏิบัติงานแล้ว</h3>'
        + '<div>งาน <b>'+warnInactive.length+'</b> ช่อง ยังเป็นชื่อของ '
        + Object.keys(inactiveWho).map(id=> esc(D.staffName(id))+' ('+esc(inactiveWho[id])+')').join(', ')
        + ' — ชื่อนี้จะถูกพิมพ์ลงใบเช็คงานด้วย</div>'
        + '<div class="row" style="margin-top:.5rem">'
        + '<button class="btn danger" id="btnFixInactive">แทนที่ด้วยผู้รับผิดชอบพื้นที่นี้ ('
        + warnInactive.length+' ช่อง)</button></div></div>'
      : '')

    + ((warnUnassigned.length || warnHoliday.length || warnClash.length)
      ? '<div class="card" style="border-color:var(--warn)"><h3>⚠️ คำเตือน</h3>'
        + (warnUnassigned.length ? '<div>• งาน <b>'+warnUnassigned.length+'</b> ช่อง ยังไม่มีผู้รับผิดชอบ</div>' : '')
        + (warnHoliday.length ? '<div>• งาน <b>'+warnHoliday.length+'</b> ช่อง มอบหมายให้คนที่หยุดในวันนั้น '
            + '<span class="hint">('+warnHoliday.slice(0,3).map(w=>
                'วันที่ '+warnDay(w)+' '+esc(D.staffName(w.e.c.s))+' '+esc(w.off.label)).join(' · ')
            + (warnHoliday.length>3?' …':'')+')</span></div>' : '')
        + (warnClash.length ? '<div>• งาน <b>'+warnClash.length+'</b> ช่อง ผู้รับผิดชอบซ้ำกับพื้นที่อื่นในเวลาเดียวกัน '
            + '<span class="hint">('+warnClash.slice(0,3).map(w=>
                'วันที่ '+warnDay(w)+' '+esc(D.staffName(w.e.c.s))+' @ '+esc(D.areaName(w.cl.areaId))).join(' · ')
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

  bindCyclePicker('as', renderRoute);
  $('#asArea').onchange = e=>{ state.ui.areaId = e.target.value; renderRoute(); };
  $('#asMode').onchange = e=>{ state.ui.calMode = e.target.value; renderRoute(); };

  $('#btnGen').onclick = ()=>{
    const t2 = todayParts();
    const todayIso = ymd(t2.y, t2.m, t2.d);
    const defIso = cp.dayOf(todayIso) ? todayIso : cp.days[0].iso;
    openModal({
      title:'สร้าง / อัปเดตตารางงาน', width:'520px',
      body:'<p>สร้างตารางงานรอบ <b>'+cycleLabel(y, m)+'</b> พื้นที่ <b>'
        + esc(D.areaName(areaId))+'</b> จากรายการงานมาตรฐาน '
        + D.taskDefs(areaId,true).length+' รายการ</p>'
        + '<div class="card" style="border-color:var(--ok);background:var(--ok-soft);margin:.2rem 0 .7rem">'
        +   '🛡️ <b>ข้อมูลเดิมปลอดภัย</b> — การสร้าง/อัปเดตจะเติมเฉพาะช่องที่ยังไม่มี '
        +   'ไม่ลบงานของวันที่ผ่านมา และไม่แตะช่องที่บันทึกผลไปแล้ว'
        +   '<div class="hint" style="margin-top:.3rem">ถ้าต้องการล้างจริง ๆ '
        +   'ใช้ปุ่ม “ล้างตาราง” แยกต่างหาก</div></div>'
        + '<label class="chk" style="display:flex;margin-bottom:.4rem">'
        +   '<input type="checkbox" id="gOver"> อัปเดตผู้รับผิดชอบในช่องที่ยังไม่ได้บันทึกผลด้วย</label>'
        + '<div class="field" id="gFromBox" style="display:none;max-width:230px">'
        +   '<label>อัปเดตตั้งแต่วันที่</label>'
        +   '<input type="date" id="gFrom" value="'+defIso+'" min="'+cp.days[0].iso+'" max="'
        +     cp.days[cp.days.length-1].iso+'">'
        +   '<span class="hint">วันก่อนหน้านี้จะไม่ถูกแตะ</span></div>'
        + '<label class="chk'+(state.data.settings.assignOnHoliday?' on':'')+'" style="display:flex">'
        +   '<input type="checkbox" id="gHol"'+(state.data.settings.assignOnHoliday?' checked':'')
        +   '> มอบหมายงานในวันหยุดด้วย</label>',
      actions:[
        { label:'สร้าง / อัปเดต', cls:'primary', onClick: async ()=>{
            const over = $('#gOver').checked;
            const hol  = $('#gHol').checked;
            const fd   = over ? (cp.dayOf($('#gFrom').value) || cp.days[0]) : null;
            let created = 0, skipped = 0;
            cp.plans.forEach(p=>{
              const rg = cp.rangeOf(p);
              // แปลง "ตั้งแต่วันที่" ให้เป็นเลขวันของเดือนนั้น ๆ
              let fromDay = 0;
              if(fd){
                const after = (fd.y > p.y) || (fd.y === p.y && fd.m > p.m);
                if(after) return;                                   // ทั้งเดือนนี้อยู่ก่อนวันเริ่ม
                fromDay = (fd.y === p.y && fd.m === p.m) ? fd.d : 1;
              }
              const r = generatePlan(p, {
                overwrite: over, fromDay,
                assignOnHoliday: hol,
                minDay: rg.from, maxDay: rg.to
              });
              created += r.created; skipped += r.skipped;
              if(p.status === 'approved') p.status = 'draft';
            });
            await cp.save('อัปเดตตารางงาน '+D.areaName(areaId)+' รอบ '+cycleLabelShort(y, m));
            closeModal(); renderRoute();
            toast('เพิ่ม/อัปเดต '+created+' ช่องงาน (ข้ามวันหยุด '+skipped+')','ok');
          }},
        { label:'ยกเลิก', onClick: closeModal }
      ],
      onOpen: ()=>{
        bindChkStyle();
        $('#gOver').addEventListener('change', e=>{
          $('#gFromBox').style.display = e.target.checked ? '' : 'none';
        });
      }
    });
  };

  $('#btnClear').onclick = ()=> clearPlanDialog(cp);
  $('#btnAssignArea').onclick = ()=> assignByAreaDialog(cp);

  if($('#btnFixInactive')) $('#btnFixInactive').onclick = ()=>{
    const pool = D.staffOfArea(areaId);
    if(!pool.length){
      toast('พื้นที่นี้ยังไม่มีแม่บ้านที่ปฏิบัติงานอยู่ — กำหนดพื้นที่รับผิดชอบที่หน้าจัดการข้อมูลแม่บ้านก่อน','err');
      return;
    }
    confirmDialog('แทนที่ชื่อในงาน <b>'+warnInactive.length+'</b> ช่อง ด้วยผู้รับผิดชอบพื้นที่นี้?'
      + '<div class="hint" style="margin-top:.4rem">ระบบจะเลือกคนที่ว่างในวันนั้นให้ '
      + 'และ<b>ไม่แตะช่องที่บันทึกผลไปแล้ว</b></div>', async ()=>{
        let n = 0, skip = 0;
        warnInactive.forEach(w=>{
          const c = w.e.plan.cells[w.e.k];
          if(!c) return;
          if(cellHasResult(c)){ skip++; return; }
          const sub = suggestSubstitute(areaId, w.e.dd.iso, c.s);
          if(!sub){ skip++; return; }
          const oldName = D.staffName(c.s);
          c.s = sub;
          c.st = 'assigned';
          c.note = 'แทน '+oldName+' ('+w.label+')';
          n++;
        });
        await cp.save('แทนที่ผู้รับผิดชอบที่ไม่ได้ปฏิบัติงาน '+n+' ช่อง');
        renderRoute();
        toast('แทนที่ '+n+' ช่อง'+(skip ? ' (ข้าม '+skip+' ช่อง)' : ''),'ok');
      }, 'แทนที่', 'danger');
  };

  $('#btnBulk').onclick = ()=> bulkAssignDialog(cp);

  $('#btnFix').onclick = async ()=>{
    let n = 0;
    warnUnassigned.forEach(e=>{
      const c = e.c;
      if(c.s || c.st === 'skipped') return;
      const sub = suggestSubstitute(areaId, e.dd.iso, '');
      if(sub){
        c.s = sub; c.st = 'assigned';
        c.note = (c.note ? c.note+' · ' : '') + 'ระบบเติมผู้ทดแทน';
        n++;
      }
    });
    await cp.save('เติมผู้ทดแทนอัตโนมัติ '+n+' ช่อง');
    renderRoute(); toast('เติมผู้รับผิดชอบ '+n+' ช่อง','ok');
  };

  $('#btnDraft').onclick = async ()=>{
    await cp.setStatus('draft');
    toast('บันทึกแบบร่างแล้ว','ok'); renderRoute();
  };
  $('#btnReview').onclick = async ()=>{
    await cp.setStatus('review');
    await saveMaster('ส่งตารางตรวจสอบ '+D.areaName(areaId));
    toast('ส่งตรวจสอบแล้ว','ok'); renderRoute();
  };
  $('#btnApprove').onclick = ()=> confirmDialog('อนุมัติตารางงานรอบนี้?', async ()=>{
    await cp.setStatus('approved', { by: state.session.name, role: state.session.role, at: nowIso() });
    await saveMaster('อนุมัติตารางงาน '+D.areaName(areaId)+' รอบ '+cycleLabelShort(y, m));
    renderRoute(); toast('อนุมัติแล้ว','ok');
  }, 'อนุมัติ');
  if($('#btnPrintGo')) $('#btnPrintGo').onclick = ()=> go('print');

  const t3 = todayParts();
  const sel = cp.dayOf(state.ui.selIso)
           || cp.dayOf(ymd(t3.y, t3.m, t3.d))
           || cp.days[0];
  renderCalendar(cp, sel);
  renderDayPanel(cp, sel);
};

/**
 * ตั้งผู้รับผิดชอบใหม่ทั้งตารางตาม "ใครดูแลพื้นที่นี้"
 * แก้ปัญหาที่พบบ่อย: เปลี่ยนพื้นที่รับผิดชอบของแม่บ้านแล้ว แต่ตารางที่สร้างไว้ยังเป็นชื่อเดิม
 */
function assignByAreaDialog(cp){
  const areaId = cp.areaId;
  const t = todayParts();
  const todayIso = ymd(t.y, t.m, t.d);
  const defIso = cp.dayOf(todayIso) ? todayIso : cp.days[0].iso;
  const pool = D.staffOfArea(areaId);
  const main = pool.filter(s=> s.mainAreaId === areaId);
  const sub  = pool.filter(s=> s.mainAreaId !== areaId);

  const ents = cp.entries();
  const current = {};
  ents.forEach(e=>{ if(e.c.s) current[e.c.s] = (current[e.c.s] || 0) + 1; });

  openModal({
    title:'ตั้งผู้รับผิดชอบตามพื้นที่', width:'560px',
    body: (pool.length
      ? '<p>พื้นที่ <b>'+esc(D.areaName(areaId))+'</b> รอบ <b>'+cycleLabelShort(cp.y, cp.m)+'</b></p>'
        + '<div class="card" style="margin:.2rem 0 .7rem">'
        +   '<b>ผู้ดูแลพื้นที่นี้</b><div class="hint" style="margin-top:.2rem">'
        +   (main.length ? 'หลัก: '+main.map(s=> esc(s.name)).join(', ') : 'ยังไม่มีผู้ดูแลหลัก')
        +   (sub.length ? ' · สำรอง: '+sub.map(s=> esc(s.name)).join(', ') : '')
        +   '</div></div>'
        + '<div class="card" style="margin:.2rem 0 .7rem"><b>ชื่อที่อยู่ในตารางตอนนี้</b>'
        +   '<div class="hint" style="margin-top:.2rem">'
        +   (Object.keys(current).length
              ? Object.keys(current).map(id=> esc(D.staffName(id))+' ('+current[id]+' ช่อง)').join(' · ')
              : 'ยังไม่มีการมอบหมาย')
        +   '</div></div>'
        + '<div class="field"><label>ขอบเขต</label><select id="abScope">'
        +   '<option value="from">ตั้งแต่วันที่เลือก เป็นต้นไป (แนะนำ)</option>'
        +   '<option value="all">ทั้งรอบ</option></select></div>'
        + '<div class="field" id="abFromBox" style="max-width:230px"><label>ตั้งแต่วันที่</label>'
        +   '<input type="date" id="abFrom" value="'+defIso+'" min="'+cp.days[0].iso+'" max="'
        +   cp.days[cp.days.length-1].iso+'"></div>'
        + '<label class="chk on" style="display:flex"><input type="checkbox" id="abSkipOff" checked>'
        +   ' ข้ามวันที่คนนั้นหยุด (หาคนทดแทนให้)</label>'
        + '<p class="hint">🛡️ ช่องที่บันทึกผลไปแล้วจะไม่ถูกเปลี่ยน</p>'
      : '<div class="empty">พื้นที่นี้ยังไม่มีแม่บ้านที่ปฏิบัติงานอยู่<br>'
        + '<span class="hint">ไปที่หน้าจัดการข้อมูล → แม่บ้าน แล้วกำหนดพื้นที่รับผิดชอบก่อน</span></div>'),
    actions: (pool.length ? [
      { label:'ตั้งผู้รับผิดชอบ', cls:'primary', onClick: async ()=>{
          const scope = $('#abScope').value;
          const fd = (scope === 'from') ? (cp.dayOf($('#abFrom').value) || cp.days[0]) : null;
          const skipOff = $('#abSkipOff').checked;
          let n = 0, kept = 0, noOne = 0;
          cp.entries().forEach(e=>{
            const c = e.c, dd = e.dd;
            if(fd){
              const before = (dd.y < fd.y) || (dd.y === fd.y && dd.m < fd.m)
                          || (dd.y === fd.y && dd.m === fd.m && dd.d < fd.d);
              if(before) return;
            }
            if(cellHasResult(c)){ kept++; return; }
            const pick = skipOff
              ? suggestSubstitute(areaId, dd.iso, '')
              : ((main[0] || pool[0] || {}).id || '');
            if(!pick){ noOne++; return; }
            c.s = pick;
            if(c.st === 'pending') c.st = 'assigned';
            c.note = 'ตามผู้รับผิดชอบพื้นที่';
            n++;
          });
          await cp.save('ตั้งผู้รับผิดชอบตามพื้นที่ '+D.areaName(areaId)+' '+n+' ช่อง');
          closeModal(); renderRoute();
          toast('ตั้งผู้รับผิดชอบ '+n+' ช่อง'
            + (kept ? ' · คงเดิม '+kept+' ช่องที่บันทึกผลแล้ว' : '')
            + (noOne ? ' · ไม่มีคนว่าง '+noOne+' ช่อง' : ''), 'ok');
        }},
      { label:'ยกเลิก', onClick: closeModal }
    ] : [{ label:'ปิด', onClick: closeModal }]),
    onOpen: ()=>{
      bindChkStyle();
      if($('#abScope')) $('#abScope').onchange = e=>{
        $('#abFromBox').style.display = (e.target.value === 'from') ? '' : 'none';
      };
    }
  });
}

/** ล้างตาราง — แยกออกมาเป็นปุ่มของตัวเอง และบอกชัดว่าจะลบอะไรไปบ้าง */
function clearPlanDialog(cp){
  const areaId = cp.areaId;
  const t = todayParts();
  const todayIso = ymd(t.y, t.m, t.d);
  const last = cp.days[cp.days.length-1];
  // ถ้าวันนี้อยู่นอกรอบและรอบผ่านไปแล้ว ให้ถือว่าไม่มี "วันข้างหน้า"
  const fromIso = cp.dayOf(todayIso) ? todayIso
                : (todayIso < cp.days[0].iso ? cp.days[0].iso : null);
  const isFuture = dd => fromIso ? (dd.iso >= fromIso) : false;
  const fromLabel = fromIso ? thDate(fromIso) : 'วันนี้ (รอบนี้ผ่านไปแล้ว)';

  const all = cp.entries();
  const withResult = all.filter(e=> cellHasResult(e.c)).length;
  const future = all.filter(e=> isFuture(e.dd)).length;
  const futureClean = all.filter(e=> isFuture(e.dd) && !cellHasResult(e.c)).length;

  openModal({
    title:'ล้างตารางงาน', width:'560px',
    body:'<p>พื้นที่ <b>'+esc(D.areaName(areaId))+'</b> รอบ <b>'
      + cycleLabel(cp.y, cp.m)+'</b> มีทั้งหมด <b>'+all.length+'</b> ช่องงาน '
      + 'ในจำนวนนี้ <b>'+withResult+'</b> ช่องบันทึกผลการปฏิบัติงานไปแล้ว</p>'
      + '<div class="field"><label>เลือกขอบเขตที่จะล้าง</label><select id="clScope">'
      +   '<option value="futureClean">เฉพาะ '+fromLabel+' เป็นต้นไป ที่ยังไม่ได้บันทึกผล ('
      +     futureClean+' ช่อง) — ปลอดภัยที่สุด</option>'
      +   '<option value="future">ตั้งแต่ '+fromLabel+' เป็นต้นไป ทั้งหมด ('+future+' ช่อง)</option>'
      +   '<option value="noResult">ทั้งรอบ เฉพาะช่องที่ยังไม่ได้บันทึกผล ('
      +     (all.length - withResult)+' ช่อง)</option>'
      +   '<option value="all">ทั้งรอบ ทุกช่อง ('+all.length+' ช่อง) — ลบผลที่บันทึกไว้ด้วย</option>'
      + '</select></div>'
      + '<p class="hint" id="clWarn"></p>'
      + '<p class="hint">ล้างเฉพาะช่วง '+thDate(cp.days[0].iso)+' – '+thDate(last.iso)+' '
      + 'เท่านั้น งานของรอบอื่นไม่ถูกแตะ</p>'
      + '<p class="hint">บันทึกประจำวันและคอมเมนต์รายบุคคลจะไม่ถูกลบ '
      + 'แต่ถ้าล้างช่องที่บันทึกผลแล้ว รายงานรายรอบจะไม่นับงานเหล่านั้นอีก</p>',
    actions:[
      { label:'ล้างตาราง', cls:'danger', onClick: async ()=>{
          const scope = $('#clScope').value;
          let n = 0;
          cp.entries().forEach(e=>{
            const clean = !cellHasResult(e.c);
            const fut = isFuture(e.dd);
            const hit = (scope === 'all')
              || (scope === 'noResult' && clean)
              || (scope === 'future' && fut)
              || (scope === 'futureClean' && fut && clean);
            if(hit){ delete e.plan.cells[e.k]; n++; }
          });
          await cp.save('ล้างตารางงาน '+D.areaName(areaId)+' รอบ '+cycleLabelShort(cp.y, cp.m)
            +' — '+n+' ช่อง');
          closeModal(); renderRoute();
          toast('ล้าง '+n+' ช่องงานแล้ว','ok');
        }},
      { label:'ยกเลิก', onClick: closeModal }
    ],
    onOpen:()=>{
      const upd = ()=>{
        const s = $('#clScope').value;
        $('#clWarn').innerHTML = (s === 'all' || s === 'future')
          ? '<span style="color:var(--danger)">⚠️ ตัวเลือกนี้จะลบผลการปฏิบัติงานที่บันทึกไว้ด้วย '
            + 'ควรสำรองข้อมูลก่อน</span>'
          : '✓ ตัวเลือกนี้ไม่แตะช่องที่บันทึกผลไปแล้ว';
      };
      $('#clScope').onchange = upd;
      upd();
    }
  });
}

/* ---- ปฏิทินของรอบ / รายสัปดาห์ / รายวัน ---- */
function renderCalendar(cp, sel){
  const box = $('#calBox'); if(!box) return;
  const areaId = cp.areaId;
  const mode = state.ui.calMode;
  sel = sel || cp.dayOf(state.ui.selIso) || cp.days[0];
  state.ui.selIso = sel.iso;

  const idx = cp.days.findIndex(d=> d.iso === sel.iso);

  if(mode === 'day'){
    box.innerHTML = '<h3>เลือกวันที่ <span class="hint" style="font-weight:400">— รอบ '
      + cycleLabelShort(cp.y, cp.m)+'</span></h3><div class="row">'
      + '<input type="date" id="dPick" value="'+sel.iso+'" min="'+cp.days[0].iso+'" max="'
      +   cp.days[cp.days.length-1].iso+'" style="max-width:190px">'
      + '<button class="btn sm" id="dPrev"'+(idx<=0?' disabled':'')+'>◀ วันก่อน</button>'
      + '<button class="btn sm" id="dNext"'+(idx>=cp.days.length-1?' disabled':'')+'>วันถัดไป ▶</button></div>';
    const goTo = dd=>{ state.ui.selIso = dd.iso; renderCalendar(cp, dd); renderDayPanel(cp, dd); };
    $('#dPick').onchange = e=>{
      const dd = cp.dayOf(e.target.value);
      if(!dd){ toast('วันที่นี้อยู่นอกรอบ '+cycleLabelShort(cp.y, cp.m),'err'); return; }
      goTo(dd);
    };
    $('#dPrev').onclick = ()=>{ if(idx > 0) goTo(cp.days[idx-1]); };
    $('#dNext').onclick = ()=>{ if(idx < cp.days.length-1) goTo(cp.days[idx+1]); };
    return;
  }

  let list = cp.days;
  if(mode === 'week'){
    let from = idx;
    while(from > 0 && dowOf(cp.days[from].y, cp.days[from].m, cp.days[from].d) !== 0) from--;
    list = cp.days.slice(from, from + 7);
  }

  // นับงานรายวันครั้งเดียว แล้วค่อยวาด
  const cnts = {};
  cp.entries().forEach(e=>{
    const o = cnts[e.dd.iso] = cnts[e.dd.iso] || { total:0, done:0, doing:0, fail:0, ver:0, un:0 };
    const c = e.c;
    o.total++;
    if(c.st === 'done') o.done++;
    else if(c.st === 'verified') o.ver++;
    else if(c.st === 'doing') o.doing++;
    else if(ST_PROBLEM.includes(c.st)) o.fail++;
    if(!c.s && c.st !== 'skipped') o.un++;
  });

  const first = list[0];
  let cells = '';
  for(let i = 0; i < dowOf(first.y, first.m, first.d); i++) cells += '<div class="cell out"></div>';

  list.forEach(dd=>{
    const dow = dowOf(dd.y, dd.m, dd.d);
    const hd  = holidayOn(dd.iso);
    const cnt = cnts[dd.iso] || { total:0, done:0, doing:0, fail:0, ver:0, un:0 };
    const cls = hd ? 'hol' : dow === 0 ? 'sun' : '';
    const dots = [];
    for(let i=0;i<Math.min(cnt.ver,10);i++)   dots.push('ver');
    for(let i=0;i<Math.min(cnt.done,10);i++)  dots.push('done');
    for(let i=0;i<Math.min(cnt.doing,6);i++)  dots.push('doing');
    for(let i=0;i<Math.min(cnt.fail,6);i++)   dots.push('fail');
    const rest = Math.max(0, Math.min(cnt.total,18) - dots.length);
    for(let i=0;i<rest;i++) dots.push('pend');
    // วันที่ 1 ของเดือนถัดไป บอกชื่อเดือนกำกับ ไม่งั้นเลขวันจะอ่านสับสน
    const mark = (dd.d === 1 || dd.iso === cp.days[0].iso) ? ' '+TH_MONTHS_SHORT[dd.m] : '';

    cells += '<div class="cell '+cls+(sel.iso===dd.iso?' sel':'')+'" data-iso="'+dd.iso+'">'
      + '<div class="d">'+dd.d+'<span class="hint" style="font-weight:400">'+mark+' '
        + TH_DOW_SHORT[dow]+'</span></div>'
      + (hd ? '<span class="tag" style="color:var(--danger)">'+esc(hd.name)+'</span>' : '')
      + (cnt.total
          ? '<span class="tag">'+cnt.total+' งาน'
            + (cnt.un ? ' · <b style="color:var(--danger)">ว่าง '+cnt.un+'</b>' : '')+'</span>'
            + '<div class="bars">'+dots.map(x=>'<i class="dot '+x+'"></i>').join('')+'</div>'
          : '<span class="tag">—</span>')
      + '</div>';
  });

  box.innerHTML = '<h3>รอบ '+cycleLabel(cp.y, cp.m)+' — '+esc(D.areaName(areaId))+'</h3>'
    + '<div class="cal">'+TH_DOW_SHORT.map(d=>'<div class="dow">'+d+'</div>').join('')+cells+'</div>'
    + '<p class="hint" style="margin-top:.5rem">'
    + '<i class="dot ver"></i> ตรวจแล้ว &nbsp; <i class="dot done"></i> เสร็จ &nbsp; '
    + '<i class="dot doing"></i> กำลังทำ &nbsp; <i class="dot fail"></i> มีปัญหา &nbsp; '
    + '<i class="dot pend"></i> ยังไม่เริ่ม &nbsp; — คลิกที่วันเพื่อจัดการงานของวันนั้น</p>';

  $$('.cell[data-iso]', box).forEach(c=> c.onclick = ()=>{
    const dd = cp.dayOf(c.dataset.iso); if(!dd) return;
    state.ui.selIso = dd.iso;
    renderCalendar(cp, dd);
    renderDayPanel(cp, dd);
  });
}

/* ---- แผงจัดการงานรายวัน ---- */
function renderDayPanel(cp, dd){
  const box = $('#dayBox'); if(!box) return;
  const plan = cp.planOf(dd); if(!plan) return;
  const areaId = plan.areaId;
  const y = dd.y, m = dd.m, day = dd.d, iso = dd.iso;
  state.ui.selIso = iso;
  state.ui.selDay = day;
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
  const status    = cycleStatus(cp);
  const editable  = can('assign') && status !== 'approved';

  box.innerHTML =
    '<div class="row" style="align-items:center">'
    + '<h3 style="margin:0;flex:1">📌 งานวันที่ '+day+' '+TH_MONTHS[m]+' '+beYear(y)+' ('+TH_DOW[dow]+')'
    +   (hd ? ' <span class="badge b-failed">'+esc(hd.name)+'</span>' : '')
    +   (dow === 0 ? ' <span class="badge b-leave">วันอาทิตย์</span>' : '')+'</h3>'
    + (editable
        ? '<button class="btn sm" id="dAdd">+ เพิ่มงานในวันนี้</button>'
        + '<button class="btn sm" id="dCopy">คัดลอกไปวันอื่น</button>'
        + '<button class="btn sm danger" id="dClear">ล้างงานวันนี้</button>'
        : (status === 'approved'
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
  const redraw = ()=>{ renderDayPanel(cp, dd); renderCalendar(cp, dd); };

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
    await persist('เปลี่ยนผู้รับผิดชอบ '+D.areaName(areaId)+' วันที่ '+thDate(iso));
    redraw();
  });

  $$('[data-st]', box).forEach(sel=> sel.onchange = async ()=>{
    setCellStatus(plan, sel.dataset.st, sel.value);
    await persist();
    redraw();
  });

  $$('[data-del]', box).forEach(b=> b.onclick = async ()=>{
    delete plan.cells[b.dataset.del];
    await persist('ลบงานวันที่ '+thDate(iso));
    redraw();
  });

  $$('[data-move]', box).forEach(b=> b.onclick = ()=> moveCellDialog(cp, dd, b.dataset.move));
  $('#dAdd').onclick   = ()=> addCellDialog(cp, dd);
  $('#dCopy').onclick  = ()=> copyDayDialog(cp, dd);
  $('#dClear').onclick = ()=> confirmDialog('ลบงานทั้งหมดของวันที่ '+thDate(iso)+'?', async ()=>{
    Object.keys(plan.cells).forEach(k=>{ if(plan.cells[k].day === day) delete plan.cells[k]; });
    await persist('ล้างงานวันที่ '+thDate(iso));
    redraw();
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
      await persist('ลาก-วางเปลี่ยนผู้รับผิดชอบ วันที่ '+thDate(iso));
      redraw();
      if(off) toast('⚠ '+D.staffName(sid)+' '+off.label,'err');
      else if(cl) toast('⚠ ซ้ำกับพื้นที่ '+D.areaName(cl.areaId),'err');
      else toast('เปลี่ยนผู้รับผิดชอบเป็น '+D.staffName(sid),'ok');
    });
  });
}

function addCellDialog(cp, dd){
  const plan = cp.planOf(dd); if(!plan) return;
  const day  = dd.d;
  const defs = D.taskDefs(plan.areaId, true);
  openModal({
    title:'เพิ่มงานวันที่ '+thDate(dd.iso), width:'480px',
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
          await saveMaster('เพิ่มงานวันที่ '+thDate(dd.iso));
          closeModal();
          renderDayPanel(cp, dd); renderCalendar(cp, dd);
          toast('เพิ่มแล้ว','ok');
        }},
      { label:'ยกเลิก', onClick: closeModal }
    ]
  });
}

function moveCellDialog(cp, dd, k){
  const plan = cp.planOf(dd); if(!plan) return;
  const c = plan.cells[k]; if(!c) return;
  const td = D.taskDef(c.t);
  openModal({
    title:'ย้ายงานไปวันอื่น', width:'440px',
    body:'<p>'+esc(td ? td.name : '')+' — '+PERIODS[c.p]+' (เดิม '+thDate(dd.iso)+')</p>'
      + '<div class="row"><div class="field"><label>ย้ายไปวันที่</label><select id="mDay">'
      +   cp.days.map(x=>
            '<option value="'+x.iso+'"'+(x.iso===dd.iso?' selected':'')+'>'
            + x.d+' '+TH_MONTHS_SHORT[x.m]+'</option>').join('')
      + '</select></div>'
      + '<div class="field"><label>ช่วงเวลา</label><select id="mP">'
      +   '<option value="morning"'+(c.p==='morning'?' selected':'')+'>เช้า</option>'
      +   '<option value="afternoon"'+(c.p==='afternoon'?' selected':'')+'>บ่าย</option>'
      + '</select></div></div>',
    actions:[
      { label:'ย้าย', cls:'primary', onClick: async ()=>{
          const nd = cp.dayOf($('#mDay').value), np = $('#mP').value;
          if(!nd){ toast('วันที่นี้อยู่นอกรอบ','err'); return; }
          const dst = cp.planOf(nd);
          const nk  = cellKey(c.t, nd.d, np);
          if(dst === plan && nk === k){ closeModal(); return; }
          delete plan.cells[k];
          dst.cells[nk] = Object.assign(c, { day:nd.d, p:np });
          await savePlan(plan.key);
          if(dst !== plan) await savePlan(dst.key);
          await saveMaster('ย้ายงานไปวันที่ '+thDate(nd.iso));
          closeModal();
          renderDayPanel(cp, dd); renderCalendar(cp, dd);
          toast('ย้ายแล้ว','ok');
        }},
      { label:'ยกเลิก', onClick: closeModal }
    ]
  });
}

function copyDayDialog(cp, dd){
  const plan = cp.planOf(dd); if(!plan) return;
  openModal({
    title:'คัดลอกงานวันที่ '+thDate(dd.iso)+' ไปวันอื่น', width:'560px',
    body:'<p class="hint">เลือกวันปลายทางภายในรอบ '+cycleLabelShort(cp.y, cp.m)
      + ' (งานที่ซ้ำกันในวันนั้นจะถูกเขียนทับ)</p>'
      + '<div style="max-height:240px;overflow:auto">'
      + cp.days.map(x=>{
          const hd = holidayOn(x.iso);
          return '<label class="chk" style="margin:2px"><input type="checkbox" name="cd" value="'+x.iso+'"'
            + (x.iso===dd.iso?' disabled':'')+'> '+x.d+' '+TH_MONTHS_SHORT[x.m]+(hd?' 🎌':'')+'</label>';
        }).join('')
      + '</div><div class="row" style="margin-top:.5rem">'
      + '<button class="btn sm" id="selWk">เลือกวันเดียวกันของทั้งรอบ</button>'
      + '<button class="btn sm" id="selAll">เลือกทั้งหมด</button>'
      + '<button class="btn sm" id="selNone">ล้าง</button></div>'
      + '<p class="hint">🛡️ ช่องที่บันทึกผลไปแล้วจะไม่ถูกเขียนทับ</p>',
    actions:[
      { label:'คัดลอก', cls:'primary', onClick: async ()=>{
          const isos = $$('input[name=cd]:checked').map(i=> i.value);
          if(!isos.length){ toast('ยังไม่ได้เลือกวัน','err'); return; }
          const src = Object.values(plan.cells).filter(c=> c.day === dd.d);
          const touched = {};
          let n = 0, kept = 0;
          isos.forEach(iso=>{
            const x = cp.dayOf(iso); if(!x) return;
            const dst = cp.planOf(x); if(!dst) return;
            touched[dst.key] = dst;
            src.forEach(c=>{
              const nk = cellKey(c.t, x.d, c.p);
              if(cellHasResult(dst.cells[nk])){ kept++; return; }
              dst.cells[nk] = {
                s: c.s, st: c.s ? 'assigned' : 'pending',
                note:'คัดลอกจากวันที่ '+thDate(dd.iso), day:x.d, p:c.p, t:c.t
              };
              n++;
            });
          });
          for(const key in touched) await savePlan(key);
          await saveMaster('คัดลอกงานวันที่ '+thDate(dd.iso)+' ไป '+isos.length+' วัน');
          closeModal(); renderRoute();
          toast('คัดลอก '+n+' ช่องงาน'+(kept?' · คงเดิม '+kept+' ช่องที่บันทึกผลแล้ว':''),'ok');
        }},
      { label:'ยกเลิก', onClick: closeModal }
    ],
    onOpen:()=>{
      bindChkStyle();
      const dw = dowOf(dd.y, dd.m, dd.d);
      const setAll = fn => $$('input[name=cd]').forEach(i=>{
        if(i.disabled) return;
        i.checked = fn(i);
        i.dispatchEvent(new Event('change'));
      });
      $('#selWk').onclick = ()=> setAll(i=>{
        const x = cp.dayOf(i.value);
        return !!x && dowOf(x.y, x.m, x.d) === dw;
      });
      $('#selAll').onclick  = ()=> setAll(()=> true);
      $('#selNone').onclick = ()=> setAll(()=> false);
    }
  });
}

function bulkAssignDialog(cp){
  const defs = D.taskDefs(cp.areaId, true);
  const sel  = cp.dayOf(state.ui.selIso) || cp.days[0];
  openModal({
    title:'มอบหมายเป็นชุด', width:'560px',
    body:'<div class="row">'
      + '<div class="field"><label>มอบหมายให้</label><select id="bStaff">'
      +   selOptions(D.staffAll(true),'id','name','','— เลือกแม่บ้าน —')+'</select></div>'
      + '<div class="field" style="max-width:200px"><label>ขอบเขต</label><select id="bScope">'
      +   '<option value="month">ทั้งรอบ ('+cycleLabelShort(cp.y, cp.m)+')</option>'
      +   '<option value="week">สัปดาห์ที่เลือก</option>'
      +   '<option value="day">วันที่เลือก ('+thDate(sel.iso)+')</option></select></div></div>'
      + '<div class="field"><label>เฉพาะงาน (ไม่เลือก = ทุกงาน)</label>'
      +   '<div style="max-height:150px;overflow:auto">'
      +   defs.map(t=>'<label class="chk" style="margin:2px">'
      +     '<input type="checkbox" name="bt" value="'+t.id+'"> '+esc(t.name)+'</label>').join('')
      +   '</div></div>'
      + '<div class="field"><label>ช่วงเวลา</label><select id="bPeriod">'
      +   '<option value="">ทั้งเช้าและบ่าย</option><option value="morning">เฉพาะเช้า</option>'
      +   '<option value="afternoon">เฉพาะบ่าย</option></select></div>'
      + '<label class="chk on" style="display:flex">'
      +   '<input type="checkbox" id="bSkipOff" checked> ข้ามวันที่แม่บ้านคนนี้หยุด</label>'
      + '<p class="hint">ช่องที่บันทึกผลไปแล้วจะไม่ถูกเปลี่ยนชื่อผู้รับผิดชอบ</p>',
    actions:[
      { label:'มอบหมาย', cls:'primary', onClick: async ()=>{
          const sid = $('#bStaff').value;
          if(!sid){ toast('เลือกแม่บ้านก่อน','err'); return; }
          const scope = $('#bScope').value, pf = $('#bPeriod').value, skipOff = $('#bSkipOff').checked;
          const tsel = $$('input[name=bt]:checked').map(i=>i.value);

          // ชุดวันที่อยู่ในขอบเขต
          const idx = cp.days.findIndex(d=> d.iso === sel.iso);
          let list = cp.days;
          if(scope === 'day') list = [sel];
          else if(scope === 'week'){
            let from = idx;
            while(from > 0 && dowOf(cp.days[from].y, cp.days[from].m, cp.days[from].d) !== 0) from--;
            list = cp.days.slice(from, from + 7);
          }
          const inScope = {};
          list.forEach(x=>{ inScope[x.iso] = true; });

          let n = 0, skipped = 0, kept = 0;
          cp.entries().forEach(e=>{
            const c = e.c;
            if(!inScope[e.dd.iso]) return;
            if(pf && c.p !== pf) return;
            if(tsel.length && !tsel.includes(c.t)) return;
            // ไม่เปลี่ยนชื่อคนทำย้อนหลังในช่องที่บันทึกผลไปแล้ว
            if(cellHasResult(c)){ kept++; return; }
            if(skipOff && staffOffOn(sid, e.dd.iso)){ skipped++; return; }
            c.s = sid;
            if(c.st === 'pending') c.st = 'assigned';
            n++;
          });
          await cp.save('มอบหมายเป็นชุดให้ '+D.staffName(sid)+' '+n+' ช่อง');
          closeModal(); renderRoute();
          toast('มอบหมาย '+n+' ช่อง'
            + (skipped ? ' · ข้ามวันหยุด '+skipped : '')
            + (kept ? ' · คงเดิม '+kept+' ช่องที่บันทึกผลแล้ว' : ''),'ok');
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
  // ยึดวันที่เป็นหลัก แล้วหารอบ 21–20 ที่วันนั้นอยู่
  const iso = state.ui.mwIso || ymd(t.y, t.m, t.d);
  const dt  = new Date(iso);
  const y = dt.getFullYear(), m = dt.getMonth(), day = dt.getDate();
  const cyc = cycleOfDate(y, m, day);
  state.ui.cy = cyc.y; state.ui.cm = cyc.m;
  await loadCycleAll(cyc.y, cyc.m);
  const dd = { y, m, d: day, iso };

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
    const p = planAt(dd, a.id);
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
    +     '<input type="date" id="mwDate" value="'+iso+'">'
    +     '<span class="hint">รอบ '+cycleLabelShort(cyc.y, cyc.m)+'</span></div>'
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
    state.ui.mwIso = ymd(d.getFullYear(), d.getMonth(), d.getDate());
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
  const cyc = ensureCycle();
  const y = cyc.y, m = cyc.m;
  await loadCycleAll(y, m);
  const areaId = state.ui.areaId;
  const areas = D.areas(true).filter(a=> !areaId || a.id === areaId);
  const days = cycleDays(y, m);

  // รวมเฉพาะช่องงานที่อยู่ในช่วงของรอบ (ข้ามสองเดือนปฏิทิน)
  const byStaff = {};
  const plans = [];
  days.forEach(dd=>{
    areas.forEach(a=>{
      const p = planAt(dd, a.id);
      if(!p) return;
      if(plans.indexOf(p) < 0) plans.push(p);
      for(const k in p.cells){
        const c = p.cells[k];
        if(c.day !== dd.d || !c.s) continue;
        const b = byStaff[c.s] = byStaff[c.s] || { total:0, done:0, verified:0, failed:0, pending:0 };
        b.total++;
        if(c.st === 'done') b.done++;
        else if(c.st === 'verified'){ b.verified++; b.done++; }
        else if(ST_PROBLEM.includes(c.st)) b.failed++;
        else if(ST_OPEN.includes(c.st)) b.pending++;
      }
    });
  });
  const audit = (state.data.audit || []).slice(0, 120);

  v.innerHTML =
    '<div class="page-head"><h1>📈 รายงานประวัติการทำงาน</h1><span class="sp"></span>'
    + '<button class="btn" id="rpExcel">⬇ ส่งออก Excel</button></div>'
    + '<div class="toolbar">'+cyclePicker('rp')+areaPicker('rpArea', true)+'</div>'
    + '<div class="card"><h2>สรุปผลรายบุคคล — '+cycleLabel(y, m)+'</h2>'
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
      }).join('') : '<tr><td colspan="8" class="empty">ยังไม่มีข้อมูลในรอบนี้</td></tr>')
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

  bindCyclePicker('rp', renderRoute);
  $('#rpArea').onchange = e=>{ state.ui.areaId = e.target.value; renderRoute(); };
  $('#rpExcel').onclick = ()=> exportReportExcel(y, m, plans, byStaff);
};
