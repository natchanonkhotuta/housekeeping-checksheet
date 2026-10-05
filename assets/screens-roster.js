/* =====================================================================
   screens-roster.js — ตารางกะ (รอบ 21 ถึง 20) และการจัดการกะ
   แถว = แม่บ้าน · คอลัมน์ = วันที่ในรอบ · แต่ละช่อง = กะ + พื้นที่ + วันหยุด
   ===================================================================== */
'use strict';

const RS = { dirty:new Set(), timer:null, paintShift:'', paintArea:'', mode:'shift' };

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

  if(!RS.paintShift && shifts.length) RS.paintShift = shifts[0].id;
  if(!RS.paintArea && areas.length)  RS.paintArea  = areas[0].id;

  const filled = staffs.reduce((a,s)=> a + rosterSummary(y, m, s.id).work, 0);
  const offs   = staffs.reduce((a,s)=> a + rosterSummary(y, m, s.id).off, 0);

  v.innerHTML =
    '<div class="page-head"><h1>🗓️ ตารางกะ</h1><span class="sp"></span>'
    + (canRoute('shifts') ? '<button class="btn" id="rsShifts">⏰ จัดการกะ</button>' : '')
    + '<button class="btn" id="rsPrint">🖨️ พิมพ์ตารางกะ</button></div>'

    + '<div class="toolbar">'
    +   '<div class="field"><label>รอบการทำงาน</label><div class="row">'
    +     '<button class="btn sm" id="rsPrev">◀ รอบก่อน</button>'
    +     '<span class="badge b-verified" style="font-size:.95rem;padding:.3rem .7rem">'
    +       esc(cycleLabel(y, m))+'</span>'
    +     '<button class="btn sm" id="rsNext">รอบถัดไป ▶</button>'
    +     '<button class="btn sm" id="rsNow">รอบปัจจุบัน</button>'
    +   '</div></div>'
    + '</div>'

    + '<div class="card" style="padding:.7rem .9rem"><div class="row" style="align-items:center">'
    +   '<div style="flex:1;min-width:180px"><b>'+days.length+' วันในรอบนี้</b>'
    +     '<div class="hint">ลงกะแล้ว '+filled+' ช่อง · วันหยุด '+offs+' ช่อง · '
    +     'แม่บ้าน '+staffs.length+' คน</div></div>'
    +   (editable
      ? '<span class="hint" id="rsState">ยังไม่มีการแก้ไข</span>'
        + '<button class="btn" id="rsApply">▶ สร้างเช็คลิสต์จากตารางกะ</button>'
        + '<button class="btn primary" id="rsSave">💾 บันทึก</button>' : '')
    + '</div></div>'

    + (editable
      ? '<div class="card" style="padding:.6rem .9rem">'
        + '<div class="row" style="align-items:center">'
        +   '<span class="hint" style="min-width:90px">เลือกสิ่งที่จะลง</span>'
        +   shifts.map(s=>'<button class="btn sm rs-pick'+(RS.mode==='shift' && RS.paintShift===s.id?' primary':'')
            + '" data-shift="'+esc(s.id)+'">'+esc(s.code)+' · '+esc(s.name)+'</button>').join('')
        +   '<button class="btn sm rs-pick'+(RS.mode==='off'?' primary':'')+'" data-mode="off">ห · วันหยุด</button>'
        +   '<button class="btn sm rs-pick'+(RS.mode==='clear'?' primary':'')+'" data-mode="clear">ล้างช่อง</button>'
        + '</div>'
        + '<div class="row" style="align-items:center;margin-top:.4rem">'
        +   '<span class="hint" style="min-width:90px">พื้นที่</span>'
        +   '<select id="rsArea" style="max-width:220px">'
        +     selOptions(areas,'id','name', RS.paintArea)+'</select>'
        +   '<span class="hint">คลิกช่องเพื่อลง · คลิกชื่อแม่บ้าน = ทั้งแถว · คลิกวันที่ = ทั้งคอลัมน์</span>'
        + '</div></div>'
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
        + ' '+esc(s.start)+'–'+esc(s.end)+'</span>').join(' ')
    +   '<br><b>พื้นที่</b> — '+areas.map(a=>'<span class="pill">'+esc(areaShort(a.id))+' = '
        + esc(a.name)+'</span>').join(' ')
    + '</div></div>';

  /* ---------- เลื่อนรอบ ---------- */
  const goCycle = (dy, dm)=>{ state.ui.rcY = dy; state.ui.rcM = dm; renderRoute(); };
  $('#rsPrev').onclick = ()=>{ const p = prevMonthOf(y, m); goCycle(p.y, p.m); };
  $('#rsNext').onclick = ()=>{ const n = nextMonthOf(y, m); goCycle(n.y, n.m); };
  $('#rsNow').onclick  = ()=>{ const c = currentCycle(); goCycle(c.y, c.m); };
  if($('#rsShifts')) $('#rsShifts').onclick = ()=> go('shifts');
  $('#rsPrint').onclick = ()=> printRoster(y, m);

  if(!editable) return;

  /* ---------- แถบเลือกสิ่งที่จะลง ---------- */
  $('#rsArea').onchange = e=>{ RS.paintArea = e.target.value; };
  $$('[data-shift]', v).forEach(b=> b.onclick = ()=>{
    RS.mode = 'shift'; RS.paintShift = b.dataset.shift; renderRoute();
  });
  $$('[data-mode]', v).forEach(b=> b.onclick = ()=>{
    RS.mode = b.dataset.mode; renderRoute();
  });

  /* ---------- แก้ไขช่อง ---------- */
  const markDirty = (dd)=>{
    RS.dirty.add(ymKey(dd.y, dd.m));
    const el = $('#rsState');
    if(el){ el.textContent = 'มีการแก้ไขที่ยังไม่บันทึก'; el.style.color = 'var(--warn)'; }
    clearTimeout(RS.timer);
    RS.timer = setTimeout(saveAll, 4000);
  };

  const applyCell = (dd, staffId)=>{
    if(RS.mode === 'clear')      setRosterRec(dd.y, dd.m, staffId, dd.d, { sh:'', ar:'', off:false });
    else if(RS.mode === 'off')   setRosterRec(dd.y, dd.m, staffId, dd.d, { sh:'', ar:'', off:true });
    else setRosterRec(dd.y, dd.m, staffId, dd.d, { sh:RS.paintShift, ar:RS.paintArea, off:false });
    markDirty(dd);
  };

  $$('.rs td.c', v).forEach(td=> td.onclick = ()=>{
    const dd = days[+td.dataset.i];
    applyCell(dd, td.dataset.staff);
    renderRoute();
  });

  // คลิกชื่อแม่บ้าน = ลงทั้งแถว (ข้ามวันอาทิตย์และวันหยุด)
  $$('.rs td.nm', v).forEach(td=> td.onclick = ()=>{
    const sid = td.dataset.staff;
    days.forEach(dd=>{
      if(RS.mode === 'shift'){
        const s = D.staff(sid);
        const dow = dowOf(dd.y, dd.m, dd.d);
        if((s.weeklyOff||[]).includes(dow) || holidayOn(dd.iso)) return;
      }
      applyCell(dd, sid);
    });
    renderRoute();
    toast('ลงทั้งแถวของ '+D.staffName(sid)+' แล้ว');
  });

  // คลิกวันที่ = ลงทั้งคอลัมน์
  $$('.rs th[data-col]', v).forEach(th=> th.onclick = ()=>{
    const dd = days.find(x=> x.iso === th.dataset.col);
    staffs.forEach(s=> applyCell(dd, s.id));
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
    const any = staffs.some(s=> rosterSummary(y, m, s.id).work > 0);
    if(!any){ toast('ยังไม่ได้ลงตารางกะในรอบนี้','err'); return; }
    confirmDialog('สร้างเช็คลิสต์ปฏิบัติงานจากตารางกะรอบ <b>'+esc(cycleLabel(y, m))+'</b>?'
      + '<div class="hint" style="margin-top:.4rem">ระบบจะสร้างงานของพื้นที่ที่แต่ละคนถูกจัดให้ไปทำ '
      + 'และ<b>ไม่แตะช่องที่บันทึกผลไปแล้ว</b><br>'
      + 'วันที่ลงเป็นวันหยุดในตารางกะจะไม่ถูกสร้างงาน</div>', async ()=>{
        await saveAll().catch(()=>{});
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
    const hd = holidayOn(dd.iso), dow = dowOf(dd.y, dd.m, dd.d);
    let cls = hd ? 'hol' : dow === 0 ? 'sun' : '';
    let txt = '';
    let title = thDateLong(dd.iso);

    if(rec.off){ cls = 'off'; txt = 'ห'; title += ' · วันหยุด'; }
    else if(rec.sh || rec.ar){
      const sh = shiftById(rec.sh);
      cls = 'on sh-'+(sh ? esc(sh.code) : 'x');
      txt = (sh ? sh.code : '?') + (rec.ar ? areaShort(rec.ar) : '');
      title += ' · '+(sh ? shiftLabel(sh.id) : 'ไม่ระบุกะ')
             + (rec.ar ? ' · '+D.areaName(rec.ar) : '');
    }
    tds += '<td class="c '+cls+'"'+(editable ? ' data-i="'+i+'" data-staff="'+esc(s.id)+'"' : '')
      + ' title="'+esc(title)+'">'+esc(txt)+'</td>';
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
  + '#printHost .rt{font-family:"Sarabun","Noto Sans Thai",Tahoma,sans-serif;color:#000;background:#fff;font-size:9pt}'
  + '#printHost .rt *{color:#000}'
  + '#printHost .rt .hd{display:flex;justify-content:space-between;align-items:flex-start;'
  +   'border-bottom:1.5pt solid #000;padding-bottom:4px;margin-bottom:6px;font-size:8.5pt}'
  + '#printHost .rt h1{font-size:14pt;margin:0;text-align:center;flex:1}'
  + '#printHost .rt h1 span{display:block;font-size:10pt;font-weight:400}'
  + '#printHost .rt table{border-collapse:collapse;width:100%;table-layout:fixed}'
  + '#printHost .rt th,#printHost .rt td{border:.6pt solid #000;padding:2px 1px;'
  +   'font-size:7.5pt;text-align:center;overflow:hidden}'
  + '#printHost .rt th{background:#e8e8e8;font-weight:700}'
  + '#printHost .rt td.nm,#printHost .rt th.nm{text-align:left;font-size:8.5pt;padding:2px 5px;'
  +   'white-space:nowrap;text-overflow:ellipsis;width:19%}'
  + '#printHost .rt td.c{font-weight:700;font-size:8pt}'
  + '#printHost .rt .sun{background:#f2dede}'
  + '#printHost .rt .hol{background:#fbe5c8}'
  + '#printHost .rt .off{background:#d9d9d9}'
  + '#printHost .rt .legend{font-size:8pt;margin-top:6px;border:.6pt solid #000;padding:4px 6px}'
  + '#printHost .rt .legend b{font-weight:700}'
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
      const hd = holidayOn(dd.iso), dow = dowOf(dd.y, dd.m, dd.d);
      let cls = hd ? 'hol' : dow === 0 ? 'sun' : '';
      let txt = '';
      if(rec.off){ cls = 'off'; txt = 'ห'; }
      else if(rec.sh || rec.ar){
        const sh = shiftById(rec.sh);
        txt = (sh ? sh.code : '?') + (rec.ar ? areaShort(rec.ar) : '');
      }
      tds += '<td class="c '+cls+'">'+esc(txt)+'</td>';
    });
    return '<tr><td class="nm">'+esc(s.name)+'</td>'+tds
      + '<td>'+sum.work+'</td><td>'+sum.off+'</td></tr>';
  }).join('');

  const colW = (72 / days.length).toFixed(3);
  const html =
    '<div class="rt">'
    + '<div class="hd"><span><b>'+esc(org.name)+'</b><br>'+esc(org.dept)+'</span>'
    +   '<h1>ตารางกะปฏิบัติงาน — แม่บ้าน<span>รอบ '+esc(cycleLabel(y, m))+'</span></h1>'
    +   '<span style="text-align:right">'+esc(org.doc)+'-R<br>แก้ไขครั้งที่ '+esc(org.rev)+'</span></div>'
    + '<table><colgroup><col style="width:19%">'
    +   days.map(()=>'<col style="width:'+colW+'%">').join('')
    +   '<col style="width:4.5%"><col style="width:4.5%">'
    + '</colgroup><thead>'
    +   '<tr><th class="nm" rowspan="2">แม่บ้าน</th>'+head
    +     '<th rowspan="2">ทำงาน</th><th rowspan="2">หยุด</th></tr>'
    +   '<tr>'+dowRow+'</tr></thead><tbody>'+body+'</tbody></table>'
    + '<div class="legend"><b>กะ:</b> '
    +   shifts.map(s=> esc(s.code)+' = '+esc(s.name)+' '+esc(s.start)+'–'+esc(s.end)).join(' &nbsp; ')
    +   '<br><b>พื้นที่:</b> '
    +   D.areas(true).map(a=> esc(areaShort(a.id))+' = '+esc(a.name)).join(' &nbsp; ')
    +   '<br><b>ตัวอย่างการอ่าน:</b> A4 = กะ A ประจำตึก 4 &nbsp; · &nbsp; ห = วันหยุด '
    +   '&nbsp; · &nbsp; ช่องว่าง = ยังไม่ได้ลงตาราง</div>'
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
    + '<p class="hint">รหัสกะคือตัวอักษรสั้น ๆ ที่ใช้แสดงในตารางกะและใบพิมพ์ '
    + 'เช่น <b>A4</b> หมายถึงกะ A ประจำตึก 4</p>'
    + '<div class="tablewrap"><table><thead><tr>'
    +   '<th class="num">รหัส</th><th>ชื่อกะ</th><th>เวลาเข้า–ออก</th><th>หมายเหตุ</th>'
    +   (editable ? '<th class="num">จัดการ</th>' : '')
    + '</tr></thead><tbody>'
    + (list.length ? list.map(s=>
        '<tr><td class="num"><b style="font-size:1.1rem">'+esc(s.code)+'</b></td>'
        + '<td><b>'+esc(s.name)+'</b></td>'
        + '<td>'+esc(s.start)+' – '+esc(s.end)+'</td>'
        + '<td class="hint">'+esc(s.note||'')+'</td>'
        + (editable ? '<td class="num"><button class="btn sm" data-edit="'+esc(s.id)+'">แก้ไข</button> '
            + '<button class="btn sm danger" data-del="'+esc(s.id)+'">ลบ</button></td>' : '')
        + '</tr>').join('')
      : '<tr><td colspan="5" class="empty">ยังไม่มีกะ</td></tr>')
    + '</tbody></table></div>'
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
  const s = sh || { id:uid('sh'), code:'', name:'', start:'08:00', end:'17:00', note:'' };
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
      + '<div class="field"><label>หมายเหตุ</label>'
      +   '<input id="fNote" value="'+esc(s.note||'')+'" placeholder="เช่น ผู้ปิดตึก"></div>',
    actions:[
      { label:'บันทึก', cls:'primary', onClick: async ()=>{
          const code = $('#fCode').value.trim(), name = $('#fName').value.trim();
          if(!code || !name){ toast('กรอกรหัสกะและชื่อกะ','err'); return; }
          if(shiftList().some(x=> x.code === code && x.id !== s.id)){
            toast('รหัสกะซ้ำ','err'); return;
          }
          Object.assign(s, { code, name, start:$('#fStart').value,
                             end:$('#fEnd').value, note:$('#fNote').value.trim() });
          if(isNew) state.data.shifts.push(s);
          await saveMaster((isNew?'เพิ่ม':'แก้ไข')+'กะ '+name);
          closeModal(); renderRoute(); toast('บันทึกแล้ว','ok');
        }},
      { label:'ยกเลิก', onClick: closeModal }
    ]
  });
}
