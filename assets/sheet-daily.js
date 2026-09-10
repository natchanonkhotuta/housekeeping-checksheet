/* =====================================================================
   sheet-daily.js — ใบเช็คงานรายวัน (Daily Tally Sheet)
   ออกแบบมาให้สแกนกลับเข้าระบบได้

   พิกัดทุกอย่างเป็นสัดส่วน 0–1 ของกรอบหมุด 4 มุม
   ค่าชุด GEO ใช้ทั้งตอน "พิมพ์" และตอน "อ่านจากภาพสแกน" จึงตรงกันเสมอ
   ===================================================================== */
'use strict';

const SHEET_W_MM = 190, SHEET_H_MM = 265;

const GEO = {
  /* หมุด 4 มุม (จุดกึ่งกลางสี่เหลี่ยมทึบ) เรียง ซ้ายบน → ขวาบน → ขวาล่าง → ซ้ายล่าง */
  fid: [[0.020,0.014],[0.980,0.014],[0.980,0.986],[0.020,0.986]],
  fidW: 0.030,
  get fidH(){ return this.fidW * SHEET_W_MM / SHEET_H_MM; },   // ให้เป็นจัตุรัสจริงบนกระดาษ

  /* แถบรหัสแผ่น 20 บิต */
  code: { x0:0.560, w:0.016, gap:0.002, y:0.080, h:0.017, bits:20 },

  /* ตารางงาน */
  table: { top:0.168, rowH:0.0375, rows:18, nameX:0.030, nameW:0.60 },

  /* ช่องให้กา — จุดกึ่งกลางแนวนอนของช่วงเช้า/บ่าย */
  box: { cx:[0.700,0.862], w:0.092, h:0.026 }
};
const rowCY = i => GEO.table.top + GEO.table.rowH * (i + 0.5);

/* ---------------------------------------------------------------
   รหัสแผ่น 20 บิต
   [0]=start  [1-4]=ลำดับพื้นที่  [5-9]=วันที่  [10-13]=เดือน
   [14-17]=ปี(ค.ศ.-2020)  [18]=พาริตี  [19]=stop
   --------------------------------------------------------------- */
function encodeSheetCode(areaIdx, day, month, year){
  const bits = new Array(GEO.code.bits).fill(0);
  bits[0] = 1;
  const put = (start, len, val)=>{
    for(let i = 0; i < len; i++) bits[start+i] = (val >> (len-1-i)) & 1;
  };
  put(1, 4, areaIdx & 15);
  put(5, 5, day & 31);
  put(10, 4, month & 15);
  put(14, 4, Math.max(0, Math.min(15, year - 2020)));
  bits[18] = bits.slice(1,18).reduce((a,b)=> a ^ b, 0);
  bits[19] = 0;
  return bits;
}
function decodeSheetCode(bits){
  if(bits.length !== GEO.code.bits || bits[0] !== 1 || bits[19] !== 0) return null;
  if(bits.slice(1,18).reduce((a,b)=> a ^ b, 0) !== bits[18]) return null;
  const get = (s,l)=> bits.slice(s, s+l).reduce((a,b)=> (a<<1) | b, 0);
  const areaIdx = get(1,4), day = get(5,5), month = get(10,4), year = 2020 + get(14,4);
  if(day < 1 || day > 31 || month < 1 || month > 12) return null;
  return { areaIdx, day, month, year };
}

/* ลำดับพื้นที่ในรหัสแผ่น — ใช้ลำดับที่บันทึกไว้จริง (insertion order)
   ไม่ใช้ลำดับแสดงผล เพราะการจัดลำดับใหม่จะทำให้ใบที่พิมพ์ไปแล้วอ่านผิดพื้นที่ */
function areaIndex(areaId){ return D.areasRaw().findIndex(a=> a.id === areaId); }
function areaByIndex(i){ return D.areasRaw()[i] || null; }

/** งานของพื้นที่+วันที่ ที่จะพิมพ์ลงใบรายวัน (จำกัดตามจำนวนแถวของใบ) */
function dailyRows(plan, day){
  const out = [];
  D.taskDefs(plan.areaId, true).forEach(td=>{
    const mk = plan.cells[cellKey(td.id, day, 'morning')];
    const af = plan.cells[cellKey(td.id, day, 'afternoon')];
    if(mk || af) out.push({ td, hasM: !!mk, hasA: !!af });
  });
  return out.slice(0, GEO.table.rows);
}

/** HTML ของใบเช็คงานรายวัน 1 แผ่น */
function dailySheetHtml(areaId, y, m, day){
  const plan = state.plans[planKey(y, m, areaId)];
  if(!plan) return '';
  const rows = dailyRows(plan, day);
  if(!rows.length) return '';

  const org  = state.data.org;
  const area = D.area(areaId);
  const iso  = ymd(y, m, day);
  const hd   = holidayOn(iso);
  const dow  = dowOf(y, m, day);

  const staffNames = Array.from(new Set(
    rows.flatMap(r=> PERIOD_KEYS
      .map(pk=> (plan.cells[cellKey(r.td.id, day, pk)] || {}).s)
      .filter(Boolean)))).map(D.staffName);

  const bits = encodeSheetCode(areaIndex(areaId), day, m+1, y);
  const pct  = n => (n * 100).toFixed(3) + '%';

  const fids = GEO.fid.map(f=>
    '<div class="fid" style="left:'+pct(f[0] - GEO.fidW/2)+';top:'+pct(f[1] - GEO.fidH/2)
    + ';width:'+pct(GEO.fidW)+';height:'+pct(GEO.fidH)+'"></div>').join('');

  const codeCells = bits.map((b,i)=>{
    const x = GEO.code.x0 + i * (GEO.code.w + GEO.code.gap);
    return '<div class="cbit'+(b?' on':'')+'" style="left:'+pct(x)
      + ';top:'+pct(GEO.code.y - GEO.code.h/2)
      + ';width:'+pct(GEO.code.w)+';height:'+pct(GEO.code.h)+'"></div>';
  }).join('');

  let body = '';
  for(let i = 0; i < GEO.table.rows; i++){
    const top = GEO.table.top + GEO.table.rowH * i;
    const r = rows[i];
    body += '<div class="drow'+(r?'':' blank')+'" style="top:'+pct(top)
      + ';height:'+pct(GEO.table.rowH)+'"></div>';
    if(r){
      const c = plan.cells[cellKey(r.td.id, day, 'morning')]
             || plan.cells[cellKey(r.td.id, day, 'afternoon')];
      const who = (c && c.s) ? D.staffName(c.s).split(' ')[0] : '';
      body += '<div class="dname" style="top:'+pct(top)+';height:'+pct(GEO.table.rowH)
        + ';left:'+pct(GEO.table.nameX)+';width:'+pct(GEO.table.nameW)+'">'
        + '<span class="no">'+(i+1)+'</span><span class="nm">'+esc(r.td.name)+'</span>'
        + '<span class="wh">'+esc(who)+'</span></div>';
    }
    PERIOD_KEYS.forEach((pk, pi)=>{
      const on = r && (pi === 0 ? r.hasM : r.hasA);
      const cx = GEO.box.cx[pi];
      body += '<div class="dbox'+(on?'':' off')+'" style="left:'+pct(cx - GEO.box.w/2)
        + ';top:'+pct(rowCY(i) - GEO.box.h/2)
        + ';width:'+pct(GEO.box.w)+';height:'+pct(GEO.box.h)+'"></div>';
    });
  }

  const hdrTop = GEO.table.top - GEO.table.rowH * 0.9;

  return '<div class="dsheet">'
    + fids + codeCells
    + '<div class="dhead">'
    +   '<div class="l"><b>'+esc(org.name)+'</b><br>'+esc(org.dept)+'</div>'
    +   '<div class="c"><b>ใบเช็คงานประจำวัน — แม่บ้าน</b>'
    +     '<div class="d">'+thDateLong(iso)+' (วัน'+TH_DOW[dow]+')'
    +       (hd ? ' · '+esc(hd.name) : '')+'</div></div>'
    +   '<div class="r">'+esc(org.doc)+'-D<br>รหัสแผ่น '
    +     pad2(areaIndex(areaId)+1)+'-'+pad2(day)+pad2(m+1)+'</div>'
    + '</div>'
    + '<div class="dinfo"><b>พื้นที่:</b> '+esc(area ? area.name : '')+' &nbsp;&nbsp;'
    +   '<b>ผู้ปฏิบัติงาน:</b> '
    +   (staffNames.length ? esc(staffNames.join(', ')) : '……………………………')+'</div>'
    + '<div class="dhow">ทำเครื่องหมาย <b>✗</b> หรือ <b>✓</b> ในช่องเมื่อทำงานเสร็จ · '
    +   'ช่องทึบสีเทาคือไม่มีงานในช่วงนั้น ไม่ต้องกรอก · กาให้อยู่ในกรอบ อย่าเลยเส้น</div>'
    + '<div class="dth" style="top:'+pct(hdrTop)+';height:'+pct(GEO.table.rowH * 0.95)+'">'
    +   '<div class="t1" style="left:'+pct(GEO.table.nameX)+';width:'+pct(GEO.table.nameW)+'">รายการงาน</div>'
    +   PERIOD_KEYS.map((pk, pi)=>
          '<div class="t2" style="left:'+pct(GEO.box.cx[pi] - GEO.box.w/2)
          + ';width:'+pct(GEO.box.w)+'">'+(pi === 0 ? 'เช้า' : 'บ่าย')+'</div>').join('')
    + '</div>'
    + body
    + '<div class="dsign">'
    +   '<div>ผู้ปฏิบัติงาน<div class="ln"></div>( ………………………………… )</div>'
    +   '<div>หัวหน้าแม่บ้านตรวจสอบ<div class="ln"></div>( ………………………………… )</div>'
    + '</div>'
    + '<div class="dfoot">พิมพ์ '+thStamp(nowIso())
    +   ' · แผ่นนี้สแกนเข้าระบบได้ที่เมนู “สแกนใบเช็คงาน”</div>'
    + '</div>';
}
