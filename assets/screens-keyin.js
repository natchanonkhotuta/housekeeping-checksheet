/* =====================================================================
   screens-keyin.js — บันทึกผลจากกระดาษ (Key-in)
   แม่บ้านกาเครื่องหมายลงเช็คชีทที่พิมพ์ไป แล้วหัวหน้า/ตัวแทนคีย์เข้าระบบ
   ตารางบนจอเรียงเหมือนกระดาษ เพื่อให้คีย์ตามได้ทีละแถว
   ===================================================================== */
'use strict';

/* วงจรการกดช่อง: ว่าง → ✓ เสร็จ → ✗ ไม่ผ่าน → – งด → ว่าง */
const KEYIN_CYCLE = ['clear','done','failed','skipped'];
const KEYIN_MARK  = { clear:'', done:'✓', failed:'✗', skipped:'–' };

/** สถานะร่วมของหน้าคีย์ผลและหน้าสแกน */
const KI = { dirty:new Set(), verifyToo:false, timer:null };

function kiStatusOf(step){
  if(step === 'clear')  return 'assigned';
  if(step === 'done')   return KI.verifyToo ? 'verified' : 'done';
  if(step === 'failed') return 'failed';
  return 'skipped';
}
function kiStepOf(st){
  if(st === 'done' || st === 'verified') return 'done';
  if(st === 'failed' || st === 'rework') return 'failed';
  if(st === 'skipped' || st === 'leave') return 'skipped';
  return 'clear';
}

SCREENS.keyin = async function(v){
  const t = todayParts();
  // ยึดวันที่เป็นหลัก แล้วหารอบ 21–20 ที่วันนั้นอยู่
  const wantIso = state.ui.kiIso || ymd(t.y, t.m, t.d);
  const wd  = new Date(wantIso);
  const cyc = cycleOfDate(wd.getFullYear(), wd.getMonth(), wd.getDate());
  state.ui.cy = cyc.y; state.ui.cm = cyc.m;
  const y = cyc.y, m = cyc.m;

  if(!D.area(state.ui.areaId)) state.ui.areaId = (D.areas(true)[0]||{}).id || '';
  const areaId = state.ui.areaId;
  if(!areaId){ v.innerHTML = '<div class="empty">กรุณาเพิ่มพื้นที่ก่อน</div>'; return; }

  const scope = state.ui.kiScope || 'day';

  await loadCycleAll(y, m);
  const cp  = await cyclePlanSet(y, m, areaId);
  const sel = cp.dayOf(wantIso) || cp.days[0];
  state.ui.kiIso = sel.iso;

  /* ---- คอลัมน์วันที่ที่จะแสดง (อาจคาบสองเดือนปฏิทินในสัปดาห์เดียว) ---- */
  let days;
  if(scope === 'week'){
    const idx = cp.days.findIndex(d=> d.iso === sel.iso);
    let from = idx;
    while(from > 0 && dowOf(cp.days[from].y, cp.days[from].m, cp.days[from].d) !== 0) from--;
    days = cp.days.slice(from, from + 7);
  } else days = [sel];

  const cellAt = (dd, tid, pk)=>{
    const p = cp.planOf(dd);
    return p ? (p.cells[cellKey(tid, dd.d, pk)] || null) : null;
  };

  /* ---- แถวงาน: เฉพาะงานที่มีอยู่ในตารางของช่วงนี้ ---- */
  const defs = D.taskDefs(areaId, true).filter(td=>
    days.some(dd=> PERIOD_KEYS.some(pk=> cellAt(dd, td.id, pk))));

  let cTotal = 0, cFilled = 0;
  days.forEach(dd=> defs.forEach(td=> PERIOD_KEYS.forEach(pk=>{
    const c = cellAt(dd, td.id, pk);
    if(!c) return;
    cTotal++;
    if(kiStepOf(c.st) !== 'clear') cFilled++;
  })));

  const rangeTxt = (scope === 'day')
    ? thDateLong(sel.iso)+' ('+TH_DOW[dowOf(sel.y,sel.m,sel.d)]+')'
    : thDate(days[0].iso)+' – '+thDate(days[days.length-1].iso);

  v.innerHTML =
    '<div class="page-head"><h1>⌨️ บันทึกผลจากกระดาษ</h1><span class="sp"></span>'
    + '<span class="hint">คีย์ตามเช็คชีทที่แม่บ้านกาไว้ · ผู้บันทึก: <b>'
    + esc(state.session.name)+'</b></span></div>'

    + '<div class="toolbar">'
    +   '<div class="field" style="max-width:150px"><label>คีย์ทีละ</label><select id="kiScope">'
    +     '<option value="day"'+(scope==='day'?' selected':'')+'>รายวัน</option>'
    +     '<option value="week"'+(scope==='week'?' selected':'')+'>รายสัปดาห์</option></select></div>'
    +   '<div class="field" style="max-width:180px"><label>วันที่</label>'
    +     '<input type="date" id="kiDate" value="'+sel.iso+'">'
    +     '<span class="hint">รอบ '+cycleLabelShort(y, m)+'</span></div>'
    +   '<div class="field"><label>&nbsp;</label><div class="row">'
    +     '<button class="btn sm" id="kiPrev">◀ '+(scope==='day'?'วันก่อน':'สัปดาห์ก่อน')+'</button>'
    +     '<button class="btn sm" id="kiToday">วันนี้</button>'
    +     '<button class="btn sm" id="kiNext">'+(scope==='day'?'วันถัดไป':'สัปดาห์ถัดไป')+' ▶</button>'
    +   '</div></div>'
    +   areaPicker('kiArea')
    + '</div>'

    + '<div class="card" style="padding:.7rem .9rem"><div class="row" style="align-items:center">'
    +   '<div style="flex:1;min-width:190px"><b>'+esc(D.areaName(areaId))+'</b> · '+esc(rangeTxt)
    +     '<div class="hint">คีย์แล้ว <b id="kiCount">'+cFilled+'</b> จาก '+cTotal+' ช่อง</div></div>'
    +   '<label class="chk'+(KI.verifyToo?' on':'')+'"><input type="checkbox" id="kiVerify"'
    +     (KI.verifyToo?' checked':'')+'> ถือว่าตรวจสอบแล้วด้วย</label>'
    +   '<button class="btn" id="kiFillAll">✓ ติ๊กผ่านทั้งหมด</button>'
    +   '<button class="btn" id="kiClearAll">ล้างทั้งหมด</button>'
    +   '<button class="btn primary" id="kiSave">💾 บันทึก</button>'
    + '</div>'
    + '<div class="hint" style="margin-top:.45rem">คลิกช่องเพื่อเปลี่ยนเครื่องหมาย: '
    +   '<span class="ki-lg"><i class="ki-c ki-done">✓</i> ปฏิบัติแล้ว</span>'
    +   '<span class="ki-lg"><i class="ki-c ki-failed">✗</i> ไม่ผ่าน</span>'
    +   '<span class="ki-lg"><i class="ki-c ki-skipped">–</i> งดปฏิบัติงาน</span>'
    +   '<span class="ki-lg"><i class="ki-c"></i> ยังไม่ระบุ</span>'
    +   ' · คลิกหัวคอลัมน์ = ติ๊กทั้งคอลัมน์ · คลิกชื่องาน = ติ๊กทั้งแถว'
    +   ' · ใช้แป้นพิมพ์: 1=✓ 2=✗ 3=– 0=ล้าง ลูกศรซ้าย/ขวาเลื่อนช่อง</div></div>'

    + (defs.length
      ? '<div class="tablewrap ki-wrap"><table class="kigrid"><thead>'
        + '<tr><th class="ki-no" rowspan="2">ที่</th><th class="ki-task" rowspan="2">รายการงาน</th>'
        + days.map(dd=>{
            const hd = holidayOn(dd.iso), dw = dowOf(dd.y,dd.m,dd.d);
            return '<th colspan="2" class="ki-day '+(hd?'hol':dw===0?'sun':'')+'">'+dd.d
              + '<div class="ki-dw">'+TH_MONTHS_SHORT[dd.m]+' '+TH_DOW_SHORT[dw]+'</div></th>';
          }).join('')
        + '</tr><tr>'
        + days.map(dd=> PERIOD_KEYS.map(pk=>
            '<th class="ki-ph" data-fillcol="'+dd.iso+'|'+pk+'" title="คลิกเพื่อติ๊กทั้งคอลัมน์">'
            + (pk === 'morning' ? 'เช้า' : 'บ่าย')+'</th>').join('')).join('')
        + '</tr></thead><tbody>'
        + defs.map((td,i)=>
            '<tr><td class="ki-no">'+(i+1)+'</td>'
            + '<td class="ki-task" data-fillrow="'+td.id+'" title="คลิกเพื่อติ๊กทั้งแถว">'
            +   '<b>'+esc(td.name)+'</b><div class="hint">'+esc(td.code)+'</div></td>'
            + days.map(dd=> PERIOD_KEYS.map(pk=>{
                const k = cellKey(td.id, dd.d, pk);
                const p = cp.planOf(dd);
                const c = p ? p.cells[k] : null;
                if(!c) return '<td class="ki-c ki-na"></td>';
                const step = kiStepOf(c.st);
                const off  = c.s ? staffOffOn(c.s, dd.iso) : null;
                const tip  = (c.s ? D.staffName(c.s) : 'ยังไม่มีผู้รับผิดชอบ') + (off ? ' — '+off.label : '');
                return '<td class="ki-c ki-'+step+(off?' ki-off':'')+'" data-k="'+esc(k)+'" '
                  + 'data-pk="'+esc(p.key)+'" data-iso="'+dd.iso+'" data-p="'+pk+'" '
                  + 'data-step="'+step+'" title="'+esc(tip)+'" tabindex="0" role="button">'
                  + KEYIN_MARK[step]+'</td>';
              }).join('')).join('')
            + '</tr>').join('')
        + '</tbody></table></div>'
      : '<div class="card"><div class="empty">ยังไม่มีตารางงานของช่วงนี้<br>'
        + '<span class="hint">ไปที่หน้า “มอบหมายงาน” เลือกรอบและพื้นที่ '
        + 'แล้วกด “สร้าง/อัปเดตตาราง” ก่อน</span></div></div>')

    + (defs.length
      ? '<div class="row" style="margin-top:.6rem">'
        + '<span class="hint" id="kiState">ยังไม่มีการแก้ไข</span>'
        + '<span class="sp" style="flex:1"></span>'
        + '<button class="btn primary" id="kiSave2">💾 บันทึกผลการคีย์</button></div>' : '');

  bindChkStyle(v);

  /* ---------- ตัวควบคุมช่วงเวลา ---------- */
  $('#kiScope').onchange = e=>{ state.ui.kiScope = e.target.value; renderRoute(); };
  $('#kiArea').onchange  = e=>{ state.ui.areaId  = e.target.value; renderRoute(); };
  const goIso = iso=>{ state.ui.kiIso = iso; renderRoute(); };
  $('#kiDate').onchange  = e=> goIso(e.target.value);
  const step = dir=>{
    const d = new Date(sel.iso);
    d.setDate(d.getDate() + dir * (scope === 'week' ? 7 : 1));
    goIso(ymd(d.getFullYear(), d.getMonth(), d.getDate()));
  };
  $('#kiPrev').onclick  = ()=> step(-1);
  $('#kiNext').onclick  = ()=> step(1);
  $('#kiToday').onclick = ()=>{
    const t2 = todayParts();
    goIso(ymd(t2.y, t2.m, t2.d));
  };
  $('#kiVerify').onchange = e=>{ KI.verifyToo = e.target.checked; };

  if(!defs.length) return;

  /* ---------- แก้ไขช่อง ---------- */
  const markDirty = (pk)=>{
    KI.dirty.add(pk);
    const el = $('#kiState');
    if(el){ el.textContent = 'มีการแก้ไขที่ยังไม่บันทึก'; el.style.color = 'var(--warn)'; }
    clearTimeout(KI.timer);
    KI.timer = setTimeout(saveKeyin, 4000);   // บันทึกอัตโนมัติหลังหยุดคีย์ 4 วินาที
  };
  const recount = ()=>{
    const n = $$('.ki-c[data-k]', v).filter(td=> td.dataset.step !== 'clear').length;
    const el = $('#kiCount');
    if(el) el.textContent = n;
  };
  const applyCell = (cell, nextStep)=>{
    const plan = state.plans[cell.dataset.pk];
    if(!plan) return;
    const c = plan.cells[cell.dataset.k];
    if(!c) return;
    const cd = new Date(cell.dataset.iso);
    const isOff = cell.classList.contains('ki-off');
    cell.dataset.step = nextStep;
    cell.className = 'ki-c ki-'+nextStep + (isOff ? ' ki-off' : '');
    cell.textContent = KEYIN_MARK[nextStep];

    setCellStatus(plan, cell.dataset.k, kiStatusOf(nextStep));
    if(nextStep === 'clear'){
      delete c.by; delete c.at; delete c.vby; delete c.vat;
      delete c.rec; delete c.recAt; delete c.src;
    } else {
      c.by    = c.s ? D.staffName(c.s) : '';
      // เวลาอ้างอิงตามวันบนกระดาษ ไม่ใช่เวลาที่คีย์
      c.at    = noonIsoOf(cd.getFullYear(), cd.getMonth(), cd.getDate());
      c.rec   = state.session.name;
      c.recAt = nowIso();
      c.src   = 'paper';
    }
    markDirty(plan.key);
  };
  const cycle = cell=>{
    const cur  = cell.dataset.step;
    const next = KEYIN_CYCLE[(KEYIN_CYCLE.indexOf(cur) + 1) % KEYIN_CYCLE.length];
    applyCell(cell, next);
  };

  const allCells = $$('.ki-c[data-k]', v);
  allCells.forEach(cell=>{
    cell.onclick = ()=>{ cycle(cell); recount(); };
    cell.onkeydown = e=>{
      const map = { '1':'done', '2':'failed', '3':'skipped', '0':'clear',
                    'x':'done', 'X':'done', '/':'failed', '-':'skipped' };
      if(e.key === ' ' || e.key === 'Enter'){ e.preventDefault(); cycle(cell); recount(); return; }
      if(map[e.key]){ e.preventDefault(); applyCell(cell, map[e.key]); recount(); return; }
      const i = allCells.indexOf(cell);
      if(e.key === 'ArrowRight' && allCells[i+1]){ e.preventDefault(); allCells[i+1].focus(); }
      if(e.key === 'ArrowLeft'  && allCells[i-1]){ e.preventDefault(); allCells[i-1].focus(); }
    };
  });

  /* คลิกหัวคอลัมน์ = ติ๊ก/ล้างทั้งคอลัมน์ */
  $$('[data-fillcol]', v).forEach(th=> th.onclick = ()=>{
    const parts = th.dataset.fillcol.split('|');
    const cells = allCells.filter(c=> c.dataset.iso === parts[0] && c.dataset.p === parts[1]);
    const allDone = cells.length && cells.every(c=> c.dataset.step === 'done');
    cells.forEach(c=> applyCell(c, allDone ? 'clear' : 'done'));
    recount();
    toast(allDone ? 'ล้างทั้งคอลัมน์' : 'ติ๊กผ่านทั้งคอลัมน์');
  });

  /* คลิกชื่องาน = ติ๊ก/ล้างทั้งแถว */
  $$('[data-fillrow]', v).forEach(td=> td.onclick = ()=>{
    const cells = $$('.ki-c[data-k]', td.parentElement);
    const allDone = cells.length && cells.every(c=> c.dataset.step === 'done');
    cells.forEach(c=> applyCell(c, allDone ? 'clear' : 'done'));
    recount();
    toast(allDone ? 'ล้างทั้งแถว' : 'ติ๊กผ่านทั้งแถว');
  });

  $('#kiFillAll').onclick = ()=>{
    allCells.forEach(c=> applyCell(c, 'done'));
    recount();
    toast('ติ๊กผ่านทั้งหมดแล้ว — อย่าลืมกดบันทึก');
  };
  $('#kiClearAll').onclick = ()=> confirmDialog('ล้างเครื่องหมายทั้งหมดในช่วงนี้?', ()=>{
    allCells.forEach(c=> applyCell(c, 'clear'));
    recount();
  }, 'ล้าง', 'danger');

  async function saveKeyin(){
    clearTimeout(KI.timer);
    if(!KI.dirty.size){ toast('ไม่มีการแก้ไข'); return; }
    const keys = Array.from(KI.dirty);
    KI.dirty.clear();
    for(const key of keys) await savePlan(key);
    await saveMaster('คีย์ผลจากกระดาษ '+D.areaName(areaId)+' · '+rangeTxt);
    const el = $('#kiState');
    if(el){ el.textContent = 'บันทึกแล้ว '+thStamp(nowIso()); el.style.color = 'var(--ok)'; }
    toast('บันทึกผลการคีย์เรียบร้อย','ok');
  }
  $('#kiSave').onclick  = saveKeyin;
  $('#kiSave2').onclick = saveKeyin;
};
