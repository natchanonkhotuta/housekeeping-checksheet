/* =====================================================================
   screens-daily.js — บันทึกประจำวันรายบุคคล
   รวมงานที่แต่ละคนทำจริงในวันนั้นจากทุกพื้นที่ แก้ไข/เพิ่มได้ และใส่คอมเมนต์รายวัน
   ===================================================================== */
'use strict';

const DL = { dirty:false, timer:null };

SCREENS.dailylog = async function(v){
  const t = todayParts();
  const y = state.ui.y, m = state.ui.m;
  const dim = daysInMonth(y, m);
  const day = clampInt(state.ui.dlDay || ((y === t.y && m === t.m) ? t.d : 1), 1, dim);
  state.ui.dlDay = day;
  const iso = ymd(y, m, day);

  await loadMonthAll(y, m);
  const idx = monthWorkIndex(y, m);
  const staffs = D.staffAll(true);
  const editable = can('dailylog');

  const rows = staffs.map(s=>({
    s,
    work: dailyWork(y, m, day, s.id, idx),
    status: dailyStatus(y, m, day, s.id)
  }));

  const nWorking = rows.filter(r=> r.work.items.length).length;
  const nOff     = rows.filter(r=> r.status.st === 'off').length;
  const nMarks   = rows.reduce((a,r)=> a + r.work.items.length, 0);
  const nComment = rows.filter(r=> r.work.rec.cm).length;
  const hd = holidayOn(iso);

  v.innerHTML =
    '<div class="page-head"><h1>📓 บันทึกประจำวัน</h1><span class="sp"></span>'
    + '<span class="hint">ระบบรวมงานจากทุกพื้นที่ให้แล้ว — แก้หรือเพิ่มเฉพาะที่ต่างจากความจริง</span></div>'

    + '<div class="toolbar">'
    +   '<div class="field" style="max-width:190px"><label>วันที่</label>'
    +     '<input type="date" id="dlDate" value="'+iso+'"></div>'
    +   '<div class="field"><label>&nbsp;</label><div class="row">'
    +     '<button class="btn sm" id="dlPrev">◀ วันก่อน</button>'
    +     '<button class="btn sm" id="dlToday">วันนี้</button>'
    +     '<button class="btn sm" id="dlNext">วันถัดไป ▶</button></div></div>'
    +   (canRoute('staffmonth')
        ? '<div class="field"><label>&nbsp;</label>'
          + '<button class="btn" id="dlReport">📈 ดูสรุปรายเดือน</button></div>' : '')
    + '</div>'

    + (hd ? '<div class="card" style="border-color:var(--danger);background:var(--danger-soft)">'
          + '<b>🎌 '+esc(hd.name)+'</b> <span class="hint">('
          + (HOLIDAY_TYPES[hd.type]||hd.type)+')</span></div>' : '')

    + '<div class="card" style="padding:.7rem .9rem"><div class="row" style="align-items:center">'
    +   '<div style="flex:1;min-width:200px"><b>'+thDateLong(iso)+' ('+TH_DOW[dowOf(y,m,day)]+')</b>'
    +     '<div class="hint">ปฏิบัติงาน '+nWorking+' คน · รวม '+nMarks+' จุด · หยุด/ลา '+nOff+' คน · '
    +     'มีคอมเมนต์ '+nComment+' คน</div></div>'
    +   (editable ? '<span class="hint" id="dlState">ยังไม่มีการแก้ไข</span>'
                  + '<button class="btn primary" id="dlSave">💾 บันทึก</button>' : '')
    + '</div></div>'

    + (rows.length ? rows.map(r=> dailyCardHtml(r, editable)).join('')
        : '<div class="empty">ยังไม่มีข้อมูลแม่บ้าน</div>');

  /* ---------- ตัวควบคุมวันที่ ---------- */
  const goDay = d=>{
    state.ui.y = d.getFullYear(); state.ui.m = d.getMonth(); state.ui.dlDay = d.getDate();
    renderRoute();
  };
  $('#dlDate').onchange = e=> goDay(new Date(e.target.value));
  $('#dlPrev').onclick  = ()=>{ const d = new Date(iso); d.setDate(d.getDate()-1); goDay(d); };
  $('#dlNext').onclick  = ()=>{ const d = new Date(iso); d.setDate(d.getDate()+1); goDay(d); };
  $('#dlToday').onclick = ()=>{ const t2 = todayParts(); goDay(new Date(t2.y, t2.m, t2.d)); };
  if($('#dlReport')) $('#dlReport').onclick = ()=> go('staffmonth');

  if(!editable) return;

  /* ---------- แก้ไข ---------- */
  const markDirty = ()=>{
    DL.dirty = true;
    const el = $('#dlState');
    if(el){ el.textContent = 'มีการแก้ไขที่ยังไม่บันทึก'; el.style.color = 'var(--warn)'; }
    clearTimeout(DL.timer);
    DL.timer = setTimeout(saveDay, 4000);
  };

  async function saveDay(){
    clearTimeout(DL.timer);
    if(!DL.dirty){ toast('ไม่มีการแก้ไข'); return; }
    DL.dirty = false;
    await saveDaily(y, m);
    await saveMaster('บันทึกประจำวัน '+thDate(iso));
    const el = $('#dlState');
    if(el){ el.textContent = 'บันทึกแล้ว '+thStamp(nowIso()); el.style.color = 'var(--ok)'; }
    toast('บันทึกแล้ว','ok');
  }
  $('#dlSave').onclick = saveDay;

  /* เอางานออก */
  $$('[data-rm]', v).forEach(b=> b.onclick = ()=>{
    const sid = b.dataset.staff, tid = b.dataset.rm;
    const rec = dailyRec(y, m, sid, day, true);
    if((rec.add || []).includes(tid)){
      rec.add = rec.add.filter(x=> x !== tid);          // งานที่เพิ่มเอง → ลบออกตรง ๆ
    } else {
      rec.rm = rec.rm || [];
      if(!rec.rm.includes(tid)) rec.rm.push(tid);       // งานที่ระบบรวมมา → บันทึกว่าไม่ได้ทำ
    }
    rec.by = state.session.name; rec.at = nowIso();
    markDirty();
    renderRoute();
  });

  /* เพิ่มงาน */
  $$('[data-add]', v).forEach(b=> b.onclick = ()=> addWorkDialog(y, m, day, b.dataset.add, markDirty));

  /* คอมเมนต์ */
  $$('[data-cm]', v).forEach(inp=>{
    inp.onchange = ()=>{
      const rec = dailyRec(y, m, inp.dataset.cm, day, true);
      rec.cm = inp.value.trim();
      rec.by = state.session.name; rec.at = nowIso();
      markDirty();
    };
  });

  /* สลับสถานะ ปฏิบัติงาน / หยุด */
  $$('[data-tog]', v).forEach(b=> b.onclick = ()=>{
    const sid = b.dataset.tog;
    const rec = dailyRec(y, m, sid, day, true);
    const cur = dailyStatus(y, m, day, sid);
    rec.st = (cur.st === 'work') ? 'off' : 'work';
    if(rec.st === 'off'){
      const off = staffOffOn(sid, iso);
      rec.stLabel = off ? off.label : 'หยุด';
    } else delete rec.stLabel;
    rec.by = state.session.name; rec.at = nowIso();
    markDirty();
    renderRoute();
  });
};

/** การ์ดของแม่บ้าน 1 คน */
function dailyCardHtml(r, editable){
  const s = r.s, items = r.work.items, rec = r.work.rec;
  const off = (r.status.st === 'off');

  const chips = items.length
    ? items.map(it=>{
        const td = D.taskDef(it.taskId);
        const bad = (it.st === 'failed');
        return '<span class="chk" style="'
          + (bad ? 'border-color:var(--danger);color:var(--danger)' : '')
          + (it.auto ? '' : ';background:var(--brand-soft);border-color:var(--brand)')+'">'
          + (bad ? '✗ ' : '✓ ')
          + esc(td.name)
          + ' <span class="hint" style="font-size:.75rem">'+esc(D.areaName(it.areaId))+'</span>'
          + (it.auto ? '' : ' <span class="hint" style="font-size:.7rem">เพิ่มเอง</span>')
          + (editable ? ' <button class="iconbtn" style="font-size:.8rem;padding:0 .2rem" '
              + 'data-rm="'+esc(it.taskId)+'" data-staff="'+esc(s.id)+'" '
              + 'title="เอาออก" aria-label="เอาออก">✕</button>' : '')
          + '</span>';
      }).join(' ')
    : '<span class="hint">'+(off ? 'หยุดงาน — ไม่มีรายการ' : 'ยังไม่มีงานที่บันทึกไว้ในวันนี้')+'</span>';

  return '<div class="taskcard'+(off ? '' : ' s-done')+'" style="padding:.7rem .8rem">'
    + '<div class="row" style="align-items:flex-start">'
    +   '<div style="flex:1;min-width:170px">'
    +     '<div class="t">'+esc(s.name)+'</div>'
    +     '<div class="m">'+esc(s.empCode)+' · พื้นที่หลัก '+esc(D.areaName(s.mainAreaId))+'</div>'
    +   '</div>'
    +   '<div style="text-align:right">'
    +     (off ? '<span class="badge b-leave">'+esc(r.status.label)+'</span>'
                : '<span class="badge b-done">ปฏิบัติงาน '+items.length+' จุด</span>')
    +     (editable ? '<div style="margin-top:.3rem">'
          + '<button class="btn sm" data-tog="'+esc(s.id)+'">'
          + (off ? 'ตั้งเป็นปฏิบัติงาน' : 'ตั้งเป็นหยุด')+'</button></div>' : '')
    +   '</div>'
    + '</div>'
    + '<div style="margin:.5rem 0 .35rem;display:flex;flex-wrap:wrap;gap:.3rem;align-items:center">'
    +   chips
    +   (editable ? ' <button class="btn sm" data-add="'+esc(s.id)+'">+ เพิ่มงาน</button>' : '')
    + '</div>'
    + (editable
      ? '<input type="text" data-cm="'+esc(s.id)+'" value="'+esc(rec.cm || '')+'" '
        + 'placeholder="คอมเมนต์ของวันนี้ เช่น ไปช่วยชั้น 3 ช่วงบ่าย / ลาครึ่งวัน">'
      : (rec.cm ? '<div class="m">📝 '+esc(rec.cm)+'</div>' : ''))
    + '</div>';
}

/** เพิ่มงานที่ทำจริงด้วยมือ — เลือกได้เฉพาะพื้นที่ที่คนนั้นรับผิดชอบ */
function addWorkDialog(y, m, day, staffId, onChanged){
  const areas = areasOfStaff(staffId);
  if(!areas.length){
    toast('แม่บ้านคนนี้ยังไม่ได้กำหนดพื้นที่รับผิดชอบ — ตั้งค่าที่หน้าจัดการข้อมูลแม่บ้านก่อน','err');
    return;
  }
  const already = {};
  dailyWork(y, m, day, staffId).items.forEach(it=>{ already[it.taskId] = true; });

  openModal({
    title:'เพิ่มงานที่ทำจริง — '+D.staffName(staffId), width:'520px',
    body:'<p class="hint">วันที่ '+thDateLong(ymd(y,m,day))+' · '
      + 'เลือกได้เฉพาะพื้นที่ที่แม่บ้านคนนี้รับผิดชอบ</p>'
      + '<div class="field"><label>พื้นที่</label><select id="awArea">'
      +   selOptions(areas,'id','name',areas[0].id)+'</select></div>'
      + '<div class="field"><label>รายการงาน</label>'
      +   '<div id="awList" style="max-height:260px;overflow:auto"></div></div>',
    actions:[
      { label:'เพิ่ม', cls:'primary', onClick: ()=>{
          const picked = $$('input[name=aw]:checked').map(i=> i.value);
          if(!picked.length){ toast('ยังไม่ได้เลือกงาน','err'); return; }
          const rec = dailyRec(y, m, staffId, day, true);
          rec.add = rec.add || [];
          picked.forEach(t=>{
            if(rec.rm && rec.rm.includes(t)) rec.rm = rec.rm.filter(x=> x !== t);
            else if(!rec.add.includes(t)) rec.add.push(t);
          });
          if(rec.st === 'off'){ delete rec.st; delete rec.stLabel; }
          rec.by = state.session.name; rec.at = nowIso();
          onChanged();
          closeModal(); renderRoute();
          toast('เพิ่ม '+picked.length+' งานแล้ว','ok');
        }},
      { label:'ยกเลิก', onClick: closeModal }
    ],
    onOpen:()=>{
      const fill = ()=>{
        const aid = $('#awArea').value;
        const defs = D.taskDefs(aid, true).filter(td=> !already[td.id]);
        $('#awList').innerHTML = defs.length
          ? defs.map(td=>'<label class="chk" style="margin:2px">'
              + '<input type="checkbox" name="aw" value="'+esc(td.id)+'"> '+esc(td.name)+'</label>').join(' ')
          : '<span class="hint">งานของพื้นที่นี้ถูกบันทึกไว้ครบแล้ว</span>';
        bindChkStyle($('#awList'));
      };
      $('#awArea').onchange = fill;
      fill();
    }
  });
}
