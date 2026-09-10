/* =====================================================================
   print.js — CHECK SHEET: ตัวอย่างก่อนพิมพ์ / PDF / Excel
   ===================================================================== */
'use strict';

const PRINT_OPT = {
  by: 'area',          // area | staff
  rowsPerPage: 16,
  showStatus: false,
  showSub: true,
  doc: 'blank',        // blank | filled | daily
  from: '', to: ''
};

SCREENS.print = async function(v){
  const y = state.ui.y, m = state.ui.m;
  await loadMonthPlans(y, m);

  if(state.ui.prArea === undefined)
    state.ui.prArea = state.ui.areaId || (D.areas(true)[0]||{}).id || '__all';
  if(state.ui.prStaff === undefined) state.ui.prStaff = '__all';

  const isStaff = (state.session.role === 'staff');
  if(isStaff){ PRINT_OPT.by = 'staff'; state.ui.prStaff = state.session.staffId; }

  const t = todayParts();
  const dflt = (t.y === y && t.m === m) ? t.d : 1;
  if(!PRINT_OPT.from) PRINT_OPT.from = ymd(y, m, dflt);
  if(!PRINT_OPT.to)   PRINT_OPT.to   = ymd(y, m, dflt);

  v.innerHTML =
    '<div class="page-head noprint"><h1>🖨️ พิมพ์ / ส่งออก CHECK SHEET</h1><span class="sp"></span></div>'
    + '<div class="card noprint">'
    + '<div class="toolbar" style="margin-bottom:.2rem">'
    +   monthPicker('pr')
    +   '<div class="field" style="max-width:180px"><label>แยกเอกสารตาม</label><select id="prBy"'
    +     (isStaff?' disabled':'')+'>'
    +     '<option value="area"'+(PRINT_OPT.by==='area'?' selected':'')+'>พื้นที่</option>'
    +     '<option value="staff"'+(PRINT_OPT.by==='staff'?' selected':'')+'>แม่บ้าน</option></select></div>'
    +   '<div class="field" style="min-width:180px" id="prTargetBox"></div>'
    +   '<div class="field" style="max-width:140px"><label>แถวต่อหน้า</label>'
    +     '<input type="number" id="prRows" value="'+PRINT_OPT.rowsPerPage+'" min="6" max="30"></div>'
    + '</div>'
    + '<div class="row">'
    +   '<div class="field" style="max-width:340px;margin-bottom:0"><label>ชนิดเอกสาร</label><select id="prSt">'
    +     '<option value="blank"'+(PRINT_OPT.doc==='blank'?' selected':'')
    +       '>📄 CHECK SHEET ฟอร์มเปล่า (รายเดือน)</option>'
    +     '<option value="filled"'+(PRINT_OPT.doc==='filled'?' selected':'')
    +       '>✅ CHECK SHEET เติมผลแล้ว — เก็บแฟ้ม</option>'
    +     '<option value="daily"'+(PRINT_OPT.doc==='daily'?' selected':'')
    +       '>🗓️ ใบเช็คงานรายวัน — พิมพ์แล้วสแกนกลับได้</option></select></div>'
    +   '<div class="field" id="prRangeBox" style="max-width:340px;margin-bottom:0;'
    +     (PRINT_OPT.doc==='daily'?'':'display:none')+'"><label>ช่วงวันที่ของใบรายวัน</label><div class="row">'
    +     '<input type="date" id="prFrom" style="max-width:160px" value="'+PRINT_OPT.from+'">'
    +     '<input type="date" id="prTo" style="max-width:160px" value="'+PRINT_OPT.to+'"></div></div>'
    +   '<label class="chk'+(PRINT_OPT.showSub?' on':'')+'"><input type="checkbox" id="prSub"'
    +     (PRINT_OPT.showSub?' checked':'')+'> แสดงแถวหัวหน้าแม่บ้านตรวจสอบ</label>'
    +   '<span class="sp" style="flex:1"></span>'
    +   '<button class="btn primary" id="prPrint">🖨️ พิมพ์ / บันทึกเป็น PDF</button>'
    +   '<button class="btn" id="prXlsx">⬇ ส่งออก Excel (.xlsx)</button>'
    + '</div>'
    + '<p class="hint" style="margin:.6rem 0 0">'
    +   'CHECK SHEET รายเดือนใช้กระดาษ A4 แนวนอน · ใบเช็คงานรายวันใช้ A4 แนวตั้ง — '
    +   'ระบบตั้งค่าหน้ากระดาษให้อัตโนมัติ · เมื่อกดพิมพ์ ให้เลือกปลายทางเป็น “บันทึกเป็น PDF”</p>'
    + '</div>'
    + '<div id="sheetArea"></div>';

  bindChkStyle(v);
  bindMonthPicker('pr', renderRoute);

  const renderTarget = ()=>{
    const box = $('#prTargetBox');
    if(PRINT_OPT.by === 'area'){
      box.innerHTML = '<label>พื้นที่</label><select id="prTarget">'
        + '<option value="__all">— ทุกพื้นที่ —</option>'
        + selOptions(D.areas(true),'id','name',state.ui.prArea)+'</select>';
      $('#prTarget').onchange = e=>{ state.ui.prArea = e.target.value; drawSheets(); };
    } else {
      box.innerHTML = '<label>แม่บ้าน</label><select id="prTarget"'+(isStaff?' disabled':'')+'>'
        + (isStaff ? '' : '<option value="__all">— ทุกคน —</option>')
        + selOptions(D.staffAll(true),'id','name',state.ui.prStaff)+'</select>';
      $('#prTarget').onchange = e=>{ state.ui.prStaff = e.target.value; drawSheets(); };
    }
  };

  $('#prBy').onchange   = e=>{ PRINT_OPT.by = e.target.value; renderTarget(); drawSheets(); };
  $('#prRows').onchange = e=>{ PRINT_OPT.rowsPerPage = clampInt(e.target.value, 6, 30); drawSheets(); };
  $('#prSt').onchange   = e=>{
    PRINT_OPT.doc = e.target.value;
    PRINT_OPT.showStatus = (e.target.value === 'filled');
    $('#prRangeBox').style.display = (PRINT_OPT.doc === 'daily') ? '' : 'none';
    drawSheets();
  };
  $('#prFrom').onchange = e=>{
    PRINT_OPT.from = e.target.value;
    if(PRINT_OPT.to < PRINT_OPT.from){ PRINT_OPT.to = e.target.value; $('#prTo').value = e.target.value; }
    drawSheets();
  };
  $('#prTo').onchange = e=>{ PRINT_OPT.to = e.target.value; drawSheets(); };
  $('#prSub').onchange = e=>{ PRINT_OPT.showSub = e.target.checked; drawSheets(); };
  $('#prPrint').onclick = doPrint;
  $('#prXlsx').onclick  = ()=> exportCheckSheetExcel(buildSheetSpecs());

  renderTarget();
  drawSheets();
};

/** รายการเอกสารที่จะพิมพ์ (1 spec = 1 CHECK SHEET) */
function buildSheetSpecs(){
  const y = state.ui.y, m = state.ui.m;
  const specs = [];

  if(PRINT_OPT.by === 'area'){
    const areas = (state.ui.prArea === '__all' || !state.ui.prArea)
      ? D.areas(true) : [D.area(state.ui.prArea)].filter(Boolean);
    areas.forEach(a=>{
      const plan = state.plans[planKey(y, m, a.id)];
      if(!plan) return;
      const defs = D.taskDefs(a.id, true)
        .filter(td=> Object.values(plan.cells).some(c=> c.t === td.id));
      const names = Array.from(new Set(Object.values(plan.cells).map(c=>c.s).filter(Boolean)))
        .map(D.staffName);
      specs.push({
        title: a.name, areaId: a.id, staffId:'', plan, defs,
        headerStaff: names.length ? names.join(', ') : '……………………………………',
        headerArea: a.name
      });
    });
  } else {
    const staffs = (state.ui.prStaff === '__all' || !state.ui.prStaff)
      ? D.staffAll(true) : [D.staff(state.ui.prStaff)].filter(Boolean);
    staffs.forEach(s=>{
      D.areas(true).forEach(a=>{
        const plan = state.plans[planKey(y, m, a.id)];
        if(!plan) return;
        const mine = Object.values(plan.cells).filter(c=> c.s === s.id);
        if(!mine.length) return;
        const ids = new Set(mine.map(c=>c.t));
        const defs = D.taskDefs(a.id, true).filter(td=> ids.has(td.id));
        specs.push({
          title: s.name+' — '+a.name, areaId: a.id, staffId: s.id, plan, defs,
          headerStaff: s.name, headerArea: a.name
        });
      });
    });
  }
  return specs.filter(s=> s.plan && s.defs.length);
}

/** วาดเอกสารทั้งหมดลงหน้าตัวอย่าง */
async function drawSheets(){
  const host = $('#sheetArea'); if(!host) return;

  if(PRINT_OPT.doc === 'daily'){
    setPageSize('portrait','0mm');
    await drawDailySheets(host);
    return;
  }
  setPageSize('landscape','6mm');

  const specs = buildSheetSpecs();
  if(!specs.length){
    host.innerHTML = '<div class="card"><div class="empty">ยังไม่มีตารางงานของเดือนนี้<br>'
      + '<span class="hint">ไปที่หน้า “มอบหมายงาน” แล้วกด “สร้าง/อัปเดตตาราง” ก่อน</span></div></div>';
    return;
  }

  // แบ่งหน้า: ตัดตามจำนวนแถวต่อหน้า และไม่ตัดแถวข้ามหน้า
  const pages = [];
  specs.forEach(sp=>{
    const chunks = [];
    for(let i = 0; i < sp.defs.length; i += PRINT_OPT.rowsPerPage)
      chunks.push(sp.defs.slice(i, i + PRINT_OPT.rowsPerPage));
    chunks.forEach((ch,i)=> pages.push({
      sp, defs: ch, page: i+1, pages: chunks.length, startNo: i * PRINT_OPT.rowsPerPage + 1
    }));
  });
  host.innerHTML = pages.map((p,i)=> sheetHtml(p, i+1, pages.length)).join('');
}

/** HTML ของ CHECK SHEET 1 หน้า */
function sheetHtml(p, pageNo, pageTotal){
  const sp = p.sp, defs = p.defs, startNo = p.startNo;
  const y = state.ui.y, m = state.ui.m;
  const dim = daysInMonth(y, m);
  const org = state.data.org;
  const plan = sp.plan;

  let thDays = '', thPeriods = '';
  for(let d = 1; d <= dim; d++){
    const dow = dowOf(y, m, d);
    const hd  = holidayOn(ymd(y, m, d));
    const cls = hd ? 'hol' : dow === 0 ? 'sun' : '';
    thDays    += '<th colspan="2" class="'+cls+'">'+d+'<div class="p">'+TH_DOW_SHORT[dow]+'</div></th>';
    thPeriods += '<th class="'+cls+' p">ช</th><th class="'+cls+' p">บ</th>';
  }

  const rows = defs.map((td,i)=>{
    let tds = '';
    for(let d = 1; d <= dim; d++){
      const iso = ymd(y, m, d);
      const dow = dowOf(y, m, d);
      const hd  = holidayOn(iso);
      PERIOD_KEYS.forEach(pk=>{
        const c = plan.cells[cellKey(td.id, d, pk)];
        let cls = hd ? 'hol' : dow === 0 ? 'sun' : '';
        let mark = '';
        if(c && !(sp.staffId && c.s !== sp.staffId)){
          const off = c.s ? staffOffOn(c.s, iso) : null;
          if(off && !ST_DONE.includes(c.st)){ cls = 'off'; mark = 'ห'; }
          else if(PRINT_OPT.showStatus) mark = STATUS[c.st] ? STATUS[c.st].mark : '';
        } else {
          cls = cls || 'na';    // ไม่มีงานในช่องนี้ — ระบายเทา
        }
        tds += '<td class="'+cls+' mk">'+esc(mark)+'</td>';
      });
    }
    return '<tr><td class="no">'+(startNo+i)+'</td>'
      + '<td class="tk" title="'+esc(td.detail||'')+'">'+esc(td.name)+'</td>'+tds+'</tr>';
  }).join('');

  let supRow = '';
  if(PRINT_OPT.showSub){
    let tds = '';
    for(let d = 1; d <= dim; d++){
      const dow = dowOf(y, m, d);
      const hd  = holidayOn(ymd(y, m, d));
      const dayCells = Object.values(plan.cells)
        .filter(c=> c.day === d && (!sp.staffId || c.s === sp.staffId));
      const cls = hd ? 'hol' : dow === 0 ? 'sun' : (dayCells.length ? '' : 'na');
      const anyVerified = dayCells.some(c=> c.st === 'verified');
      tds += '<td colspan="2" class="'+cls+' mk">'
        + (anyVerified && PRINT_OPT.showStatus ? '✓' : '')+'</td>';
    }
    supRow = '<tr><td class="no"></td><td class="tk"><b>หัวหน้าแม่บ้านตรวจสอบ</b></td>'+tds+'</tr>';
  }

  const approved = plan.approvals && plan.approvals.plan;
  const colW = (78.8 / (dim * 2)).toFixed(3);

  return '<div class="sheet">'
    + '<div class="sh-head">'
    +   '<div class="co">'+esc(org.name)
    +     '<div style="font-size:8pt;font-weight:400">'+esc(org.dept)+'</div></div>'
    +   '<div class="ti"><div class="t1">CHECK SHEET การทำงานของแม่บ้าน</div>'
    +     '<div class="t2">ประจำเดือน '+TH_MONTHS[m]+' พ.ศ. '+beYear(y)+'</div></div>'
    +   '<div class="meta">เอกสารเลขที่ '+esc(org.doc)+'<br>แก้ไขครั้งที่ '+esc(org.rev)
    +     '<br>หน้า '+pageNo+'/'+pageTotal+'</div>'
    + '</div>'
    + '<div class="sh-info">'
    +   '<div><b>ผู้ปฏิบัติงาน:</b> '+esc(sp.headerStaff)+'</div>'
    +   '<div><b>สถานที่ / พื้นที่:</b> '+esc(sp.headerArea)+'</div>'
    +   '<div><b>เดือน:</b> '+TH_MONTHS[m]+'</div>'
    +   '<div><b>ปี พ.ศ.:</b> '+beYear(y)+'</div>'
    +   '<div><b>สถานะเอกสาร:</b> '
    +     (plan.status==='approved'?'อนุมัติแล้ว':plan.status==='review'?'รอตรวจสอบ':'แบบร่าง')+'</div>'
    + '</div>'
    + '<table class="cs"><colgroup><col style="width:2.2%"><col style="width:19%">'
    +   Array.from({length: dim*2}).map(()=>'<col style="width:'+colW+'%">').join('')
    + '</colgroup><thead>'
    +   '<tr><th rowspan="2" class="no">ที่</th><th rowspan="2">รายการงาน</th>'+thDays+'</tr>'
    +   '<tr>'+thPeriods+'</tr></thead><tbody>'+rows+supRow+'</tbody></table>'
    + (PRINT_OPT.showStatus
      ? '<div class="legend">'
        + '<span><b>ช</b>=เช้า <b>บ</b>=บ่าย</span><span><i class="na"></i>ไม่มีงาน</span>'
        + '<span><i class="sun"></i>วันอาทิตย์</span><span><i class="hol"></i>วันหยุดนักขัตฤกษ์</span>'
        + '<span><i class="off"></i>หยุด/ลา</span>'
        + '<span>✓=ปฏิบัติแล้ว</span><span>/=กำลังทำ</span><span>✗=ไม่ผ่าน</span>'
        + '<span>!=ต้องแก้ไข</span><span>-=งดปฏิบัติงาน</span><span>ห=หยุด/ลา</span></div>'
      : '<div class="legend howto"><b>วิธีกรอก (สำหรับผู้ปฏิบัติงาน):</b>'
        + '<span>ปฏิบัติงานเสร็จแล้ว ทำเครื่องหมาย <b>✗</b> หรือ <b>✓</b> ในช่องของวันและช่วงเวลานั้น</span>'
        + '<span>ทำไม่ได้/งดปฏิบัติงาน ใส่ <b>–</b> แล้วเขียนเหตุผลด้านล่าง</span>'
        + '<span><b>ช</b>=ช่วงเช้า <b>บ</b>=ช่วงบ่าย</span>'
        + '<span><i class="na"></i>ช่องเทา = ไม่มีงานในวันนั้น ไม่ต้องกรอก</span>'
        + '<span><i class="sun"></i>วันอาทิตย์</span><span><i class="hol"></i>วันหยุดนักขัตฤกษ์</span></div>')
    + '<div class="sh-sign">'
    +   '<div class="box"><div class="lbl">ผู้ปฏิบัติงาน</div><div class="ln"></div>'
    +     '( '+esc(sp.headerStaff)+' )<br>วันที่ ………… / ………… / …………</div>'
    +   '<div class="box"><div class="lbl">หัวหน้าแม่บ้าน (ผู้ตรวจสอบ)</div><div class="ln"></div>'
    +     '( …………………………………… )<br>วันที่ ………… / ………… / …………</div>'
    +   '<div class="box"><div class="lbl">ผู้รับทราบ / ผู้บริหาร</div><div class="ln"></div>'
    +     '( '+(approved ? esc(approved.by) : '……………………………………')+' )<br>วันที่ '
    +     (approved ? esc(thDate(approved.at.slice(0,10))) : '………… / ………… / …………')+'</div>'
    + '</div>'
    + '<div class="sh-foot"><span>พิมพ์เมื่อ '+thStamp(nowIso())+' โดย '+esc(state.session.name)+'</span>'
    +   '<span class="sp"></span><span>'+esc(org.doc)+' — หน้า '+pageNo+' จาก '+pageTotal+'</span></div>'
    + '</div>';
}

/** วาดใบเช็คงานรายวันตามช่วงวันที่ที่เลือก (โหลดตารางข้ามเดือนให้ด้วย) */
async function drawDailySheets(host){
  const areas = (state.ui.prArea === '__all' || !state.ui.prArea)
    ? D.areas(true) : [D.area(state.ui.prArea)].filter(Boolean);
  const from = new Date(PRINT_OPT.from), to = new Date(PRINT_OPT.to);
  if(isNaN(from) || isNaN(to) || to < from){
    host.innerHTML = '<div class="card"><div class="empty">เลือกช่วงวันที่ให้ถูกต้อง</div></div>';
    return;
  }
  if((to - from) / 86400000 > 62){
    host.innerHTML = '<div class="card"><div class="empty">ช่วงวันที่ยาวเกินไป — เลือกไม่เกิน 62 วัน</div></div>';
    return;
  }

  host.innerHTML = '<div class="card"><div class="empty">กำลังเตรียมเอกสาร…</div></div>';

  // โหลดตารางของทุกเดือนที่อยู่ในช่วง
  const months = new Set();
  for(let cur = new Date(from); cur <= to; cur.setDate(cur.getDate()+1))
    months.add(cur.getFullYear()+'|'+cur.getMonth());
  for(const mk of months){
    const parts = mk.split('|');
    await loadMonthPlans(+parts[0], +parts[1]);
  }

  const out = [];
  for(let cur = new Date(from); cur <= to; cur.setDate(cur.getDate()+1)){
    const yy = cur.getFullYear(), mm = cur.getMonth(), dd = cur.getDate();
    areas.forEach(a=>{
      if(!state.plans[planKey(yy, mm, a.id)]) return;
      const h = dailySheetHtml(a.id, yy, mm, dd);
      if(h) out.push(h);
    });
  }

  host.innerHTML = out.length ? out.join('')
    : '<div class="card"><div class="empty">ไม่มีงานในช่วงวันที่ที่เลือก<br>'
      + '<span class="hint">ตรวจว่าได้สร้างตารางงานของเดือนนั้นแล้ว</span></div></div>';
}

/** ตั้งชื่อไฟล์อัตโนมัติ */
function sheetFileName(ext){
  const y = state.ui.y, m = state.ui.m;
  const suffix = ext ? '.'+ext : '';
  if(PRINT_OPT.doc === 'daily'){
    const who = (state.ui.prArea === '__all' || !state.ui.prArea)
      ? 'ทุกพื้นที่' : D.areaName(state.ui.prArea);
    return 'ใบเช็คงานรายวัน_'+who+'_'+PRINT_OPT.from+'_ถึง_'+PRINT_OPT.to+suffix;
  }
  let who;
  if(PRINT_OPT.by === 'area')
    who = (state.ui.prArea === '__all' || !state.ui.prArea) ? 'ทุกพื้นที่' : D.areaName(state.ui.prArea);
  else
    who = (state.ui.prStaff === '__all' || !state.ui.prStaff)
      ? 'ทุกคน' : D.staffName(state.ui.prStaff).replace(/\s+/g,'');
  return 'CheckSheet_'+who+'_'+TH_MONTHS[m]+'_'+beYear(y)+suffix;
}

function doPrint(){
  const old = document.title;
  document.title = sheetFileName('');    // ให้เบราว์เซอร์เสนอชื่อไฟล์นี้เมื่อบันทึกเป็น PDF
  setPageSize(PRINT_OPT.doc === 'daily' ? 'portrait' : 'landscape',
              PRINT_OPT.doc === 'daily' ? '0mm' : '6mm');
  toast('เลือกปลายทาง “บันทึกเป็น PDF” และกระดาษ A4 '
    + (PRINT_OPT.doc === 'daily' ? 'แนวตั้ง' : 'แนวนอน'));
  setTimeout(()=>{
    window.print();
    setTimeout(()=>{ document.title = old; }, 1200);
  }, 350);
}

/* =====================================================================
   ส่งออก Excel
   ===================================================================== */
function csvFallback(rowsAoA, filename){
  const csv = rowsAoA.map(r=> r.map(c=>{
    const s = (c == null) ? '' : String(c);
    return /[",\n]/.test(s) ? '"'+s.replace(/"/g,'""')+'"' : s;
  }).join(',')).join('\r\n');
  download(filename.replace(/\.xlsx$/,'.csv'),
    new Blob(['﻿'+csv], { type:'text/csv;charset=utf-8' }));
  toast('ไม่พบไลบรารี Excel — ส่งออกเป็น CSV แทน (เปิดด้วย Excel ได้)','err');
}

function exportCheckSheetExcel(specs){
  if(!specs.length){ toast('ยังไม่มีข้อมูลให้ส่งออก','err'); return; }
  const y = state.ui.y, m = state.ui.m;
  const dim = daysInMonth(y, m);
  const org = state.data.org;
  const hasXLSX = (typeof XLSX !== 'undefined');
  const wb = hasXLSX ? XLSX.utils.book_new() : null;
  let firstAoA = null;

  specs.forEach((sp, idx)=>{
    const aoa = [];
    aoa.push([org.name]);
    aoa.push([org.dept, '', 'CHECK SHEET การทำงานของแม่บ้าน']);
    aoa.push(['เอกสารเลขที่', org.doc, 'ประจำเดือน', TH_MONTHS[m], 'พ.ศ.', beYear(y)]);
    aoa.push(['ผู้ปฏิบัติงาน', sp.headerStaff, 'สถานที่', sp.headerArea, 'สถานะ',
      sp.plan.status==='approved'?'อนุมัติแล้ว':sp.plan.status==='review'?'รอตรวจสอบ':'แบบร่าง']);
    aoa.push([]);

    const h1 = ['ที่','รายการงาน'], h2 = ['',''], dowRow = ['',''];
    for(let d = 1; d <= dim; d++){
      h1.push(d, ''); h2.push('ช','บ');
      dowRow.push(TH_DOW_SHORT[dowOf(y,m,d)], '');
    }
    aoa.push(h1); aoa.push(h2); aoa.push(dowRow);

    sp.defs.forEach((td,i)=>{
      const r = [i+1, td.name];
      for(let d = 1; d <= dim; d++){
        PERIOD_KEYS.forEach(pk=>{
          const c = sp.plan.cells[cellKey(td.id, d, pk)];
          if(!c || (sp.staffId && c.s !== sp.staffId)){ r.push(''); return; }
          const off = c.s ? staffOffOn(c.s, ymd(y,m,d)) : null;
          r.push((off && !ST_DONE.includes(c.st)) ? 'ห' : (STATUS[c.st] ? STATUS[c.st].mark : ''));
        });
      }
      aoa.push(r);
    });

    aoa.push([]);
    aoa.push(['สัญลักษณ์','✓ ปฏิบัติงานแล้ว','/ กำลังดำเนินการ','✗ ไม่ผ่าน',
              '! ต้องแก้ไข','- งดปฏิบัติงาน','ห หยุด/ลา']);
    aoa.push([]);
    aoa.push(['ผู้ปฏิบัติงาน','','','หัวหน้าแม่บ้าน (ผู้ตรวจสอบ)','','','ผู้รับทราบ / ผู้บริหาร']);
    aoa.push(['(………………………………)','','','(………………………………)','','','(………………………………)']);
    aoa.push(['วันที่ …… / …… / ……','','','วันที่ …… / …… / ……','','','วันที่ …… / …… / ……']);

    if(idx === 0) firstAoA = aoa;
    if(!hasXLSX) return;

    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const merges = [{ s:{r:0,c:0}, e:{r:0,c:6} }, { s:{r:1,c:2}, e:{r:1,c:10} }];
    for(let d = 0; d < dim; d++){
      merges.push({ s:{r:5, c:2+d*2}, e:{r:5, c:3+d*2} });   // เลขวันที่
      merges.push({ s:{r:7, c:2+d*2}, e:{r:7, c:3+d*2} });   // ชื่อวัน
    }
    ws['!merges'] = merges;
    ws['!cols'] = [{wch:4},{wch:34}].concat(Array.from({length: dim*2}, ()=>({wch:3})));
    const name = (sp.title || 'Sheet').replace(/[\\\/\?\*\[\]:]/g,'').slice(0,28) || ('Sheet'+(idx+1));
    XLSX.utils.book_append_sheet(wb, ws, name);
  });

  const fn = sheetFileName('xlsx');
  if(!hasXLSX){ csvFallback(firstAoA, fn); return; }
  const out = XLSX.write(wb, { bookType:'xlsx', type:'array' });
  download(fn, new Blob([out],
    { type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
}

function exportReportExcel(y, m, plans, byStaff){
  const aoa = [];
  aoa.push([state.data.org.name]);
  aoa.push(['รายงานสรุปผลการปฏิบัติงานแม่บ้าน','ประจำเดือน', TH_MONTHS[m], 'พ.ศ.', beYear(y)]);
  aoa.push([]);
  aoa.push(['แม่บ้าน','พื้นที่หลัก','งานที่ได้รับ','เสร็จ','ตรวจผ่าน','ไม่ผ่าน','ค้าง','อัตราสำเร็จ (%)']);
  Object.keys(byStaff).forEach(sid=>{
    const b = byStaff[sid];
    aoa.push([ D.staffName(sid), D.areaName((D.staff(sid)||{}).mainAreaId),
      b.total, b.done, b.verified, b.failed, b.pending,
      b.total ? Math.round(b.done / b.total * 100) : 0 ]);
  });
  aoa.push([]);
  aoa.push(['รายละเอียดรายวัน']);
  aoa.push(['วันที่','ช่วง','พื้นที่','รหัสงาน','รายการงาน','ผู้รับผิดชอบ','สถานะ',
            'ผู้ปฏิบัติ','เวลาบันทึก','ผู้คีย์ข้อมูล','ที่มา','ผู้ตรวจสอบ','หมายเหตุ']);
  plans.forEach(p=>{
    Object.values(p.cells).sort((a,b)=> a.day - b.day).forEach(c=>{
      const td = D.taskDef(c.t);
      aoa.push([ c.day, PERIODS[c.p], D.areaName(p.areaId), td?td.code:'', td?td.name:'',
        c.s ? D.staffName(c.s) : '', STATUS[c.st] ? STATUS[c.st].label : c.st,
        c.by||'', c.at ? thStamp(c.at) : '', c.rec||'',
        c.src === 'scan' ? 'สแกน' : c.src === 'paper' ? 'คีย์จากกระดาษ' : 'ในระบบ',
        c.vby||'', c.note||'' ]);
    });
  });

  const fn = 'รายงานแม่บ้าน_'+TH_MONTHS[m]+'_'+beYear(y)+'.xlsx';
  if(typeof XLSX === 'undefined'){ csvFallback(aoa, fn); return; }
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = [{wch:6},{wch:8},{wch:18},{wch:12},{wch:34},{wch:20},{wch:14},
                 {wch:18},{wch:18},{wch:18},{wch:14},{wch:16},{wch:26}];
  XLSX.utils.book_append_sheet(wb, ws, 'รายงาน');
  const out = XLSX.write(wb, { bookType:'xlsx', type:'array' });
  download(fn, new Blob([out],
    { type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
}
