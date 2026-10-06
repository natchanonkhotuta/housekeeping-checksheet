/* =====================================================================
   screens-roster.js — ตารางกะ (รอบ 21 ถึง 20) และการจัดการกะ
   แถว = แม่บ้าน · คอลัมน์ = วันที่ในรอบ
   หนึ่งช่องเก็บ กะ 1 กะ + พื้นที่ได้หลายตึก + หรือ ตั้งเป็นวันหยุด
   ===================================================================== */
'use strict';

/* เครื่องมือที่กำลังเลือกอยู่ — ใช้ตอนคลิกช่อง/แถว/คอลัมน์ */
const RS = { dirty:new Set(), timer:null, tool:{ kind:'shift', id:'' }, lastShift:'' };

/* =====================================================================
   1. ตารางกะ
   ===================================================================== */
SCREENS.roster = async function(v){
  if(state.ui.rcY === undefined){
    const c = currentCycle();
    state.ui.rcY = c.y; state.ui.rcM = c.m;
  }
  const y = state.ui.rcY, m = state.ui.rcM;
  await loadCycleRosters(y, m);

  const days = cycleDays(y, m);
  const staffs = D.staffAll(true);
  const areas = D.areas(true);
  const shifts = shiftList();
  const editable = can('roster');

  if(RS.tool.kind === 'shift' && !RS.tool.id && shifts.length) RS.tool.id = shifts[0].id;
  if(RS.tool.kind === 'shift') RS.lastShift = RS.tool.id;
  if(!RS.lastShift && shifts.length) RS.lastShift = shifts[0].id;

  let work = 0, off = 0;
  staffs.forEach(s=>{ const t = rosterSummary(y, m, s.id); work += t.work; off += t.off; });

  const toolBtn = (kind, id, label, extraCls)=>
    '<button class="btn sm '+(extraCls||'')
    + (RS.tool.kind === kind && RS.tool.id === id ? ' primary' : '')
    + '" data-tool="'+kind+'" data-id="'+esc(id||'')+'">'+label+'</button>';

  v.innerHTML =
    '<div class="page-head"><h1>🗓️ ตารางกะ</h1><span class="sp"></span>'
    + (canRoute('shifts') ? '<button class="btn" id="rsShifts">⏰ จัดการกะ</button>' : '')
    + '<button class="btn" id="rsPrint">🖨️ พิมพ์ตารางกะ</button></div>'

    + '<div class="toolbar"><div class="field"><label>รอบการทำงาน</label><div class="row">'
    +   '<button class="btn sm" id="rsPrev">◀ รอบก่อน</button>'
    +   '<span class="badge b-verified" style="font-size:.95rem;padding:.3rem .7rem">'
    +     esc(cycleLabel(y, m))+'</span>'
    +   '<button class="btn sm" id="rsNext">รอบถัดไป ▶</button>'
    +   '<button class="btn sm" id="rsNow">รอบปัจจุบัน</button>'
    + '</div></div></div>'

    + '<div class="card" style="padding:.7rem .9rem"><div class="row" style="align-items:center">'
    +   '<div style="flex:1;min-width:180px"><b>'+days.length+' วันในรอบนี้</b>'
    +     '<div class="hint">ลงกะแล้ว '+work+' วัน-คน · วันหยุด '+off+' · แม่บ้าน '+staffs.length+' คน</div></div>'
    +   (editable
      ? '<span class="hint" id="rsState">ยังไม่มีการแก้ไข</span>'
        + '<button class="btn" id="rsApply">▶ สร้างเช็คลิสต์จากตารางกะ</button>'
        + '<button class="btn primary" id="rsSave">💾 บันทึก</button>' : '')
    + '</div></div>'

    + (editable
      ? '<div class="card" style="padding:.6rem .9rem">'
        + '<div class="row" style="align-items:center">'
        +   '<span class="hint" style="min-width:74px">1. กะ</span>'
        +   shifts.map(s=> toolBtn('shift', s.id, esc(s.code)+' · '+esc(s.name)
              + ' <span class="hint">'+esc(s.start)+'–'+esc(s.end)+'</span>')).join(' ')
        +   toolBtn('off','','ห · วันหยุด')
        +   toolBtn('clear','','ล้างช่อง')
        + '</div>'
        + '<div class="row" style="align-items:center;margin-top:.4rem">'
        +   '<span class="hint" style="min-width:74px">2. พื้นที่</span>'
        +   areas.map(a=>{
              const hl = areaHighlight(a.id);
              return toolBtn('area', a.id,
                esc(areaShort(a.id))+' '+esc(a.name), hl ? 'hl-'+hl : '');
            }).join(' ')
        + '</div>'
        + '<div class="hint" style="margin-top:.4rem">เลือกเครื่องมือด้านบน แล้วคลิกช่องในตาราง · '
        + 'เครื่องมือ <b>พื้นที่</b> คลิกซ้ำเพื่อเอาออก (หนึ่งวันใส่ได้หลายตึก) · '
        + 'คลิกชื่อแม่บ้าน = ทั้งแถว · คลิกวันที่ = ทั้งคอลัมน์</div></div>'
      : '')

    + (staffs.length
      ? '<div class="tablewrap rs-wrap"><table class="rs"><thead><tr>'
        + '<th class="nm">แม่บ้าน</th>'
        + days.map(dd=>{
            const hd = holidayOn(dd.iso), dow = dowOf(dd.y, dd.m, dd.d);
            return '<th class="d '+(hd?'hol':dow===0?'sun':'')+'" data-col="'+dd.iso+'" '
              + 'title="'+esc(thDateLong(dd.iso)+(hd?' · '+hd.name:''))+'">'
              + dd.d+'<span class="dw">'+TH_DOW_SHORT[dow]+'</span></th>';
          }).join('')
        + '<th class="sum">สรุป</th></tr></thead><tbody>'
        + staffs.map(s=> rosterRowHtml(s, days, y, m, editable)).join('')
        + '</tbody></table></div>'
      : '<div class="card"><div class="empty">ยังไม่มีข้อมูลแม่บ้าน</div></div>')

    + '<div class="card" style="margin-top:.6rem;padding:.6rem .9rem"><div class="hint">'
    +   '<b>กะ</b> — '+shifts.map(s=>'<span class="pill">'+esc(s.code)+' = '+esc(s.name)
        + ' '+esc(s.start)+'–'+esc(s.end)+(s.hl?' · แสดงสีเน้น':'')+'</span>').join(' ')
    +   '<br><b>พื้นที่</b> — '+areas.map(a=>{
          const hl = areaHighlight(a.id);
          return '<span class="pill'+(hl?' hl-'+hl:'')+'">'+esc(areaShort(a.id))+' = '
            + esc(a.name)+'</span>';
        }).join(' ')
    +   '<br>อ่านช่องตาราง: บรรทัดบนคือรหัสกะ บรรทัดล่างคือเลขตึกที่ไปทำวันนั้น '
    +   '· <b>ห</b> = วันหยุด · ช่องว่าง = ยังไม่ได้ลงตาราง'
    + '</div></div>';

  /* ---------- เลื่อนรอบ ---------- */
  const goCycle = (dy, dm)=>{ state.ui.rcY = dy; state.ui.rcM = dm; renderRoute(); };
  $('#rsPrev').onclick = ()=>{ const p = prevMonthOf(y, m); goCycle(p.y, p.m); };
  $('#rsNext').onclick = ()=>{ const n = nextMonthOf(y, m); goCycle(n.y, n.m); };
  $('#rsNow').onclick  = ()=>{ const c = currentCycle(); goCycle(c.y, c.m); };
  if($('#rsShifts')) $('#rsShifts').onclick = ()=> go('shifts');
  $('#rsPrint').onclick = ()=> printRoster(y, m);

  if(!editable) return;

  /* ---------- เลือกเครื่องมือ ---------- */
  $$('[data-tool]', v).forEach(b=> b.onclick = ()=>{
    RS.tool = { kind: b.dataset.tool, id: b.dataset.id || '' };
    renderRoute();
  });

  /* ---------- แก้ไขช่อง ---------- */
  const markDirty = (dd)=>{
    RS.dirty.add(ymKey(dd.y, dd.m));
    const el = $('#rsState');
    if(el){ el.textContent = 'มีการแก้ไขที่ยังไม่บันทึก'; el.style.color = 'var(--warn)'; }
    clearTimeout(RS.timer);
    RS.timer = setTimeout(saveAll, 4000);
  };

  /** ลงเครื่องมือปัจจุบันในช่องหนึ่ง — forceAdd = true ตอนลงทั้งแถว/คอลัมน์ (ไม่สลับออก) */
  const applyCell = (dd, staffId, forceAdd)=>{
    const t = RS.tool;
    const rec = rosterRec(dd.y, dd.m, staffId, dd.d);

    if(t.kind === 'clear'){
      setRosterRec(dd.y, dd.m, staffId, dd.d, { sh:'', ars:[], off:false });
    } else if(t.kind === 'off'){
      setRosterRec(dd.y, dd.m, staffId, dd.d, { sh:'', ars:[], off:true });
    } else if(t.kind === 'shift'){
      setRosterRec(dd.y, dd.m, staffId, dd.d, { sh:t.id, off:false,
        ars: rosterAreas(rec) });
    } else if(t.kind === 'area'){
      const cur = rosterAreas(rec).slice();
      const i = cur.indexOf(t.id);
      if(i >= 0){ if(!forceAdd) cur.splice(i, 1); }
      else cur.push(t.id);
      cur.sort(compareAreaShort);
      // ลงพื้นที่ในช่องว่าง ให้ใส่กะที่เพิ่งเลือกไว้ให้ด้วย จะได้ไม่ต้องคลิกสองรอบ
      const sh = rec.sh || RS.lastShift || (shifts[0] ? shifts[0].id : '');
      setRosterRec(dd.y, dd.m, staffId, dd.d, { sh, ars:cur, off:false });
    }
    markDirty(dd);
  };

  $$('.rs td.c', v).forEach(td=> td.onclick = ()=>{
    applyCell(days[+td.dataset.i], td.dataset.staff, false);
    renderRoute();
  });

  // คลิกชื่อแม่บ้าน = ลงทั้งแถว (ข้ามวันหยุดประจำสัปดาห์และวันหยุดนักขัตฤกษ์)
  $$('.rs td.nm', v).forEach(td=> td.onclick = ()=>{
    const sid = td.dataset.staff;
    const s = D.staff(sid);
    days.forEach(dd=>{
      if(RS.tool.kind === 'shift' || RS.tool.kind === 'area'){
        const dow = dowOf(dd.y, dd.m, dd.d);
        if((s.weeklyOff||[]).includes(dow) || holidayOn(dd.iso)) return;
      }
      applyCell(dd, sid, true);
    });
    renderRoute();
    toast('ลงทั้งแถวของ '+D.staffName(sid)+' แล้ว');
  });

  // คลิกวันที่ = ลงทั้งคอลัมน์
  $$('.rs th[data-col]', v).forEach(th=> th.onclick = ()=>{
    const dd = days.find(x=> x.iso === th.dataset.col);
    staffs.forEach(s=> applyCell(dd, s.id, true));
    renderRoute();
    toast('ลงทั้งคอลัมน์วันที่ '+dd.d+' แล้ว');
  });

  async function saveAll(){
    clearTimeout(RS.timer);
    if(!RS.dirty.size){ toast('ไม่มีการแก้ไข'); return; }
    const keys = Array.from(RS.dirty);
    RS.dirty.clear();
    for(const k of keys){
      const r = state.rosters[k];
      if(r) await saveRoster(r.y, r.m);
    }
    await saveMaster('บันทึกตารางกะ รอบ '+cycleLabel(y, m));
    const el = $('#rsState');
    if(el){ el.textContent = 'บันทึกแล้ว '+thStamp(nowIso()); el.style.color = 'var(--ok)'; }
    toast('บันทึกตารางกะแล้ว','ok');
  }
  $('#rsSave').onclick = saveAll;

  $('#rsApply').onclick = ()=>{
    if(!staffs.some(s=> rosterSummary(y, m, s.id).work > 0)){
      toast('ยังไม่ได้ลงตารางกะในรอบนี้','err'); return;
    }
    confirmDialog('สร้างเช็คลิสต์ปฏิบัติงานจากตารางกะรอบ <b>'+esc(cycleLabel(y, m))+'</b>?'
      + '<div class="hint" style="margin-top:.4rem">ระบบจะสร้างงานของทุกตึกที่แต่ละคนถูกจัดให้ไปทำ '
      + 'และ<b>ไม่แตะช่องที่บันทึกผลไปแล้ว</b><br>'
      + 'วันที่ลงเป็นวันหยุดในตารางกะจะไม่ถูกสร้างงาน</div>', async ()=>{
        if(RS.dirty.size) await saveAll();
        const r = await applyRosterToPlans(y, m);
        await saveMaster('สร้างเช็คลิสต์จากตารางกะ รอบ '+cycleLabel(y, m));
        renderRoute();
        toast('สร้างใหม่ '+r.created+' ช่อง · เปลี่ยนผู้รับผิดชอบ '+r.reassigned+' ช่อง'
          + (r.kept ? ' · คงเดิม '+r.kept+' ช่องที่บันทึกผลแล้ว' : ''), 'ok');
      }, 'สร้างเช็คลิสต์');
  };
};

/** แถวของแม่บ้าน 1 คน */
function rosterRowHtml(s, days, y, m, editable){
  const sum = rosterSummary(y, m, s.id);
  let tds = '';

  days.forEach((dd,i)=>{
    const rec = rosterAt(dd, s.id);
    const ars = rosterAreas(rec);
    const hd = holidayOn(dd.iso), dow = dowOf(dd.y, dd.m, dd.d);
    let cls = hd ? 'hol' : dow === 0 ? 'sun' : '';
    let inner = '';
    let title = thDateLong(dd.iso);

    if(rec.off){
      cls = 'off'; inner = 'ห'; title += ' · วันหยุด';
    } else if(rec.sh || ars.length){
      const sh = shiftById(rec.sh);
      cls = 'has';
      inner = '<span class="sh">'+esc(sh ? sh.code : '?')+'</span>'
        + '<span class="ars">'
        + ars.map(id=>{
            const hl = rosterCellColor(rec.sh, id);
            return '<span'+(hl ? ' class="hl-'+hl+'"' : '')+'>'+esc(areaShort(id))+'</span>';
          }).join('')
        + '</span>';
      title += ' · '+(sh ? shiftLabel(sh.id) : 'ไม่ระบุกะ')
             + (ars.length ? ' · '+ars.map(D.areaName).join(', ') : ' · ยังไม่ระบุตึก');
    }

    tds += '<td class="c '+cls+'"'+(editable ? ' data-i="'+i+'" data-staff="'+esc(s.id)+'"' : '')
      + ' title="'+esc(title)+'">'+inner+'</td>';
  });

  return '<tr><td class="nm"'+(editable ? ' data-staff="'+esc(s.id)+'"' : '')+'>'
    + '<b>'+esc(s.name)+'</b><div class="hint">'+esc(D.areaName(s.mainAreaId))+'</div></td>'
    + tds
    + '<td class="sum"><b>'+sum.work+'</b><div class="hint">หยุด '+sum.off+'</div></td></tr>';
}

/* =====================================================================
   2. พิมพ์ตารางกะ
   ===================================================================== */
const ROSTER_PRINT_CSS = ''
  + '#printHost .rt{font-family:"Sarabun","Noto Sans Thai",Tahoma,sans-serif;color:#000;background:#fff;font-size:9pt;'
  +   '-webkit-print-color-adjust:exact;print-color-adjust:exact}'
  + '#printHost .rt .hd{display:flex;justify-content:space-between;align-items:flex-start;'
  +   'border-bottom:1.5pt solid #000;padding-bottom:4px;margin-bottom:6px;font-size:8.5pt}'
  + '#printHost .rt h1{font-size:14pt;margin:0;text-align:center;flex:1}'
  + '#printHost .rt h1 span{display:block;font-size:10pt;font-weight:400}'
  + '#printHost .rt table{border-collapse:collapse;width:100%;table-layout:fixed}'
  + '#printHost .rt th,#printHost .rt td{border:.6pt solid #000;padding:1px 1px;'
  +   'font-size:7.5pt;text-align:center;overflow:hidden;color:#000}'
  + '#printHost .rt th{background:#e8e8e8;font-weight:700}'
  + '#printHost .rt td.nm,#printHost .rt th.nm{text-align:left;font-size:8.5pt;padding:2px 5px;'
  +   'white-space:nowrap;text-overflow:ellipsis;width:18%}'
  + '#printHost .rt td.c{font-weight:700;font-size:7.5pt;line-height:1.1}'
  + '#printHost .rt td.c .sh{display:block;font-size:6.5pt;font-weight:400}'
  + '#printHost .rt td.c i{font-style:normal;display:inline-block;padding:0 .4pt}'
  + '#printHost .rt .sun{background:#f2dede}'
  + '#printHost .rt .hol{background:#fbe5c8}'
  + '#printHost .rt .off{background:#d9d9d9}'
  + '#printHost .rt .legend{font-size:8pt;margin-top:6px;border:.6pt solid #000;padding:4px 6px}'
  + '#printHost .rt .legend b{font-weight:700}'
  + '#printHost .rt .legend i{font-style:normal;padding:0 3px;border-radius:2px}'
  + '#printHost .rt .sign{display:flex;gap:10px;margin-top:12px;font-size:8.5pt}'
  + '#printHost .rt .sign div{flex:1;border:.6pt solid #000;padding:5px 8px;min-height:52px}'
  + '#printHost .rt .ln{border-bottom:.6pt dotted #000;height:18px;margin:12px 0 3px}'
  + '#printHost .rt .foot{font-size:7pt;margin-top:4px;text-align:right}';

function printRoster(y, m){
  const days = cycleDays(y, m);
  const staffs = D.staffAll(true);
  const org = state.data.org;
  const shifts = shiftList();
  if(!staffs.length){ toast('ยังไม่มีข้อมูลแม่บ้าน','err'); return; }

  const hlStyle = (hl)=>{
    const c = HL_COLORS[hl];
    return (hl && c) ? ' style="background:'+c.bg+';color:'+c.fg+'"' : '';
  };

  let head = '', dowRow = '';
  days.forEach(dd=>{
    const hd = holidayOn(dd.iso), dow = dowOf(dd.y, dd.m, dd.d);
    const cls = hd ? 'hol' : dow === 0 ? 'sun' : '';
    head   += '<th class="'+cls+'">'+dd.d+'</th>';
    dowRow += '<th class="'+cls+'">'+TH_DOW_SHORT[dow]+'</th>';
  });

  const body = staffs.map(s=>{
    const sum = rosterSummary(y, m, s.id);
    let tds = '';
    days.forEach(dd=>{
      const rec = rosterAt(dd, s.id);
      const ars = rosterAreas(rec);
      const hd = holidayOn(dd.iso), dow = dowOf(dd.y, dd.m, dd.d);
      let cls = hd ? 'hol' : dow === 0 ? 'sun' : '';
      let inner = '';
      if(rec.off){ cls = 'off'; inner = 'ห'; }
      else if(rec.sh || ars.length){
        const sh = shiftById(rec.sh);
        inner = '<span class="sh">'+esc(sh ? sh.code : '?')+'</span>'
          + ars.map(id=>'<i'+hlStyle(rosterCellColor(rec.sh, id))+'>'
              + esc(areaShort(id))+'</i>').join('');
      }
      tds += '<td class="c '+cls+'">'+inner+'</td>';
    });
    return '<tr><td class="nm">'+esc(s.name)+'</td>'+tds
      + '<td>'+sum.work+'</td><td>'+sum.off+'</td></tr>';
  }).join('');

  const colW = (74 / days.length).toFixed(3);
  const html =
    '<div class="rt">'
    + '<div class="hd"><span><b>'+esc(org.name)+'</b><br>'+esc(org.dept)+'</span>'
    +   '<h1>ตารางกะปฏิบัติงาน — แม่บ้าน<span>รอบ '+esc(cycleLabel(y, m))+'</span></h1>'
    +   '<span style="text-align:right">'+esc(org.doc)+'-R<br>แก้ไขครั้งที่ '+esc(org.rev)+'</span></div>'
    + '<table><colgroup><col style="width:18%">'
    +   days.map(()=>'<col style="width:'+colW+'%">').join('')
    +   '<col style="width:4%"><col style="width:4%">'
    + '</colgroup><thead>'
    +   '<tr><th class="nm" rowspan="2">แม่บ้าน</th>'+head
    +     '<th rowspan="2">ทำงาน</th><th rowspan="2">หยุด</th></tr>'
    +   '<tr>'+dowRow+'</tr></thead><tbody>'+body+'</tbody></table>'
    + '<div class="legend"><b>กะ:</b> '
    +   shifts.map(s=> esc(s.code)+' = '+esc(s.name)+' '+esc(s.start)+'–'+esc(s.end)).join(' &nbsp; ')
    +   '<br><b>พื้นที่:</b> '
    +   D.areas(true).map(a=>{
          const hl = areaHighlight(a.id);
          return '<i'+hlStyle(hl)+'>'+esc(areaShort(a.id))+'</i> = '+esc(a.name);
        }).join(' &nbsp; ')
    +   '<br><b>วิธีอ่าน:</b> บรรทัดบนคือรหัสกะ บรรทัดล่างคือเลขตึกที่ไปทำวันนั้น '
    +   '(หนึ่งวันมีได้หลายตึก) &nbsp; · &nbsp; ห = วันหยุด &nbsp; · &nbsp; ช่องว่าง = ยังไม่ได้ลงตาราง'
    +   (shifts.some(s=>s.hl)
        ? '<br><b>สีเน้น</b> แสดงเฉพาะกะ '
          + shifts.filter(s=>s.hl).map(s=> esc(s.code)+' ('+esc(s.start)+'–'+esc(s.end)+')').join(', ')
        : '')
    + '</div>'
    + '<div class="sign">'
    +   '<div>ผู้จัดตาราง<div class="ln"></div>( …………………………… )<br>วันที่ …… / …… / ……</div>'
    +   '<div>หัวหน้าแม่บ้าน<div class="ln"></div>( …………………………… )<br>วันที่ …… / …… / ……</div>'
    +   '<div>ผู้อนุมัติ<div class="ln"></div>( …………………………… )<br>วันที่ …… / …… / ……</div></div>'
    + '<div class="foot">พิมพ์ '+thStamp(nowIso())+' โดย '+esc(state.session.name)+'</div>'
    + '</div>';

  printDocument({
    title: 'ตารางกะ_'+cycleLabelShort(y, m),
    html, css: ROSTER_PRINT_CSS, orientation:'landscape', margin:'8mm'
  });
}

/* =====================================================================
   3. จัดการกะ
   ===================================================================== */
SCREENS.shifts = async function(v){
  const editable = can('shift');
  const list = shiftList();

  v.innerHTML =
    '<div class="page-head"><h1>⏰ กะการทำงาน</h1><span class="sp"></span>'
    + (editable ? '<button class="btn primary" id="shAdd">+ เพิ่มกะ</button>' : '')
    + '</div>'
    + '<p class="hint">รหัสกะคือตัวอักษรสั้น ๆ ที่แสดงในตารางกะและใบพิมพ์ '
    + 'ช่องในตารางจะแสดงรหัสกะบรรทัดบน และเลขตึกที่ไปทำบรรทัดล่าง</p>'
    + '<div class="tablewrap"><table><thead><tr>'
    +   '<th class="num">รหัส</th><th>ชื่อกะ</th><th>เวลาเข้า–ออก</th>'
    +   '<th class="num">แสดงสีเน้น</th><th>หมายเหตุ</th>'
    +   (editable ? '<th class="num">จัดการ</th>' : '')
    + '</tr></thead><tbody>'
    + (list.length ? list.map(s=>
        '<tr><td class="num"><b style="font-size:1.1rem">'+esc(s.code)+'</b></td>'
        + '<td><b>'+esc(s.name)+'</b></td>'
        + '<td>'+esc(s.start)+' – '+esc(s.end)+'</td>'
        + '<td class="num">'+(s.hl
            ? '<span class="badge b-done">แสดง</span>'
            : '<span class="hint">—</span>')+'</td>'
        + '<td class="hint">'+esc(s.note||'')+'</td>'
        + (editable ? '<td class="num"><button class="btn sm" data-edit="'+esc(s.id)+'">แก้ไข</button> '
            + '<button class="btn sm danger" data-del="'+esc(s.id)+'">ลบ</button></td>' : '')
        + '</tr>').join('')
      : '<tr><td colspan="6" class="empty">ยังไม่มีกะ</td></tr>')
    + '</tbody></table></div>'
    + '<div class="card" style="margin-top:.7rem"><h3>สีเน้นพื้นที่</h3>'
    +   '<p class="hint">ตึกส่วนใหญ่ไม่ต้องมีสี เลือกสีเฉพาะตึกที่อยากให้สังเกตเห็นง่าย '
    +   'และสีจะแสดง<b>เฉพาะกะที่ตั้งค่าว่า “แสดงสีเน้น”</b> เท่านั้น '
    +   '— ตั้งสีของแต่ละตึกได้ที่หน้าจัดการพื้นที่</p>'
    +   '<div class="row">'+D.areas(true).map(a=>{
          const hl = areaHighlight(a.id);
          return '<span class="pill'+(hl?' hl-'+hl:'')+'">'+esc(areaShort(a.id))+' '
            + esc(a.name)+(hl ? ' · '+HL_COLORS[hl].label : '')+'</span>';
        }).join(' ')+'</div></div>'
    + (canRoute('roster')
      ? '<div class="row" style="margin-top:.7rem">'
        + '<button class="btn" id="shGoRoster">🗓️ ไปหน้าตารางกะ</button></div>' : '');

  if($('#shGoRoster')) $('#shGoRoster').onclick = ()=> go('roster');
  if(!editable) return;

  $('#shAdd').onclick = ()=> shiftDialog(null);
  $$('[data-edit]', v).forEach(b=> b.onclick = ()=> shiftDialog(shiftById(b.dataset.edit)));
  $$('[data-del]', v).forEach(b=> b.onclick = ()=>{
    const s = shiftById(b.dataset.del);
    confirmDialog('ลบกะ “'+esc(s.code)+' · '+esc(s.name)+'” ?'
      + '<div class="hint" style="margin-top:.4rem">ตารางกะที่ลงไว้แล้วจะแสดงเป็น '
      + '<b>?</b> ในช่องที่เคยใช้กะนี้</div>', async ()=>{
        state.data.shifts = shiftList().filter(x=> x.id !== s.id);
        await saveMaster('ลบกะ '+s.name);
        renderRoute(); toast('ลบแล้ว','ok');
      }, 'ลบ', 'danger');
  });
};

function shiftDialog(sh){
  const isNew = !sh;
  const s = sh || { id:uid('sh'), code:'', name:'', start:'08:00', end:'17:00', note:'', hl:false };
  openModal({
    title: isNew ? 'เพิ่มกะ' : 'แก้ไขกะ', width:'480px',
    body:'<div class="row">'
      + '<div class="field" style="max-width:110px"><label>รหัสกะ *</label>'
      +   '<input id="fCode" value="'+esc(s.code)+'" placeholder="A" maxlength="2"></div>'
      + '<div class="field"><label>ชื่อกะ *</label>'
      +   '<input id="fName" value="'+esc(s.name)+'" placeholder="กะเช้า"></div></div>'
      + '<div class="row">'
      + '<div class="field"><label>เวลาเข้างาน</label>'
      +   '<input type="time" id="fStart" value="'+esc(s.start)+'"></div>'
      + '<div class="field"><label>เวลาออกงาน</label>'
      +   '<input type="time" id="fEnd" value="'+esc(s.end)+'"></div></div>'
      + '<label class="chk'+(s.hl?' on':'')+'" style="display:flex;margin-bottom:.6rem">'
      +   '<input type="checkbox" id="fHl"'+(s.hl?' checked':'')+'> '
      +   'แสดงสีเน้นพื้นที่ในกะนี้</label>'
      + '<div class="field"><label>หมายเหตุ</label>'
      +   '<input id="fNote" value="'+esc(s.note||'')+'" placeholder="เช่น ผู้ปิดตึก"></div>',
    actions:[
      { label:'บันทึก', cls:'primary', onClick: async ()=>{
          const code = $('#fCode').value.trim(), name = $('#fName').value.trim();
          if(!code || !name){ toast('กรอกรหัสกะและชื่อกะ','err'); return; }
          if(shiftList().some(x=> x.code === code && x.id !== s.id)){
            toast('รหัสกะซ้ำ','err'); return;
          }
          Object.assign(s, { code, name, start:$('#fStart').value, end:$('#fEnd').value,
                             hl:$('#fHl').checked, note:$('#fNote').value.trim() });
          if(isNew) state.data.shifts.push(s);
          await saveMaster((isNew?'เพิ่ม':'แก้ไข')+'กะ '+name);
          closeModal(); renderRoute(); toast('บันทึกแล้ว','ok');
        }},
      { label:'ยกเลิก', onClick: closeModal }
    ],
    onOpen: ()=> bindChkStyle()
  });
}
