/* =====================================================================
   screens-staffmonth.js — สรุปรายเดือนรายบุคคล
   หนึ่งคนหนึ่งตาราง · แถว = จุดที่ทำจริงทั้งเดือน (รวมทุกพื้นที่)
   คอลัมน์ = วันที่ · ติ๊กเฉพาะวันที่ทำ · คอมเมนต์รายวันเป็นเชิงอรรถ
   ===================================================================== */
'use strict';

SCREENS.staffmonth = async function(v){
  const y = state.ui.y, m = state.ui.m;
  await loadMonthAll(y, m);

  const idx = monthWorkIndex(y, m);
  const pick = state.ui.smStaff || '';
  const staffs = (pick ? [D.staff(pick)].filter(Boolean) : D.staffAll(false))
    .map(s=>({ s, mx: staffMonthMatrix(y, m, s.id, idx) }));
  const shown = staffs.filter(x=> x.mx.rows.length || x.mx.comments);

  const totalMarks = shown.reduce((a,x)=> a + x.mx.marks, 0);

  v.innerHTML =
    '<div class="page-head"><h1>📊 สรุปรายเดือนรายบุคคล</h1><span class="sp"></span>'
    + '<button class="btn" id="smPrint">🖨️ พิมพ์</button>'
    + '<button class="btn" id="smXlsx">⬇ ส่งออก Excel</button></div>'

    + '<div class="toolbar">'+monthPicker('sm')
    +   '<div class="field" style="min-width:180px"><label>แม่บ้าน</label><select id="smStaff">'
    +     selOptions(D.staffAll(false),'id','name', pick, '— ทุกคน —')+'</select></div>'
    +   (canRoute('dailylog')
        ? '<div class="field"><label>&nbsp;</label>'
          + '<button class="btn" id="smEdit">📓 ไปแก้บันทึกประจำวัน</button></div>' : '')
    + '</div>'

    + '<div class="card" style="padding:.7rem .9rem"><div class="hint">'
    +   '<b>'+TH_MONTHS[m]+' '+beYear(y)+'</b> · แสดง '+shown.length+' คน · '
    +   'รวมงานที่ทำจริง '+totalMarks+' จุด-วัน<br>'
    +   'ตารางนี้รวมงานจากทุกพื้นที่ที่แต่ละคนไปทำจริง ไม่ยึดตามพื้นที่ที่วางแผนไว้ '
    +   'จึงไม่ตกหล่นเมื่อมีการสลับพื้นที่</div></div>'

    + (shown.length ? shown.map(x=> staffMatrixHtml(x.s, x.mx, y, m)).join('')
        : '<div class="card"><div class="empty">ยังไม่มีข้อมูลการปฏิบัติงานในเดือนนี้<br>'
          + '<span class="hint">บันทึกผลที่หน้า “บันทึกผลจากกระดาษ” “สแกนใบเช็คงาน” '
          + 'หรือ “บันทึกประจำวัน” ก่อน</span></div></div>');

  bindMonthPicker('sm', renderRoute);
  $('#smStaff').onchange = e=>{ state.ui.smStaff = e.target.value; renderRoute(); };
  if($('#smEdit')) $('#smEdit').onclick = ()=> go('dailylog');
  $('#smPrint').onclick = ()=> printStaffMonth(shown, y, m);
  $('#smXlsx').onclick  = ()=> exportStaffMonthExcel(shown, y, m);
};

/** ตารางของแม่บ้าน 1 คน (สำหรับแสดงบนจอ) */
function staffMatrixHtml(s, mx, y, m){
  const dim = mx.dim;

  // เชิงอรรถคอมเมนต์
  const notes = [];
  for(let d = 1; d <= dim; d++){
    const c = mx.byDay[d];
    if(c && c.cm) notes.push({ n: notes.length + 1, d, cm: c.cm });
  }
  const noteNo = {};
  notes.forEach(n=>{ noteNo[n.d] = n.n; });

  const dayCls = d=>{
    const dow = dowOf(y, m, d);
    if(holidayOn(ymd(y, m, d))) return 'hol';
    if(dow === 0) return 'sun';
    return '';
  };

  let head = '';
  for(let d = 1; d <= dim; d++)
    head += '<th class="d '+dayCls(d)+'">'+d
          + '<span class="dw">'+TH_DOW_SHORT[dowOf(y,m,d)]+'</span></th>';

  const body = mx.rows.map(r=>{
    let tds = '';
    for(let d = 1; d <= dim; d++){
      const cell = mx.byDay[d];
      const mk = cell.marks[r.taskId];
      const off = (cell.status.st === 'off' && !mk);
      const cls = mk === 'done' ? 'ok' : mk === 'failed' ? 'bad' : (off ? 'off' : dayCls(d));
      tds += '<td class="d '+cls+'">'
        + (mk === 'done' ? '✓' : mk === 'failed' ? '✗' : '')+'</td>';
    }
    return '<tr><td class="tk"><b>'+esc(r.td.name)+'</b>'
      + '<div class="hint">'+esc(D.areaName(r.areaId))+'</div></td>'+tds+'</tr>';
  }).join('');

  let cmTds = '';
  for(let d = 1; d <= dim; d++){
    const cell = mx.byDay[d];
    const off = (cell.status.st === 'off');
    cmTds += '<td class="d '+(off ? 'off' : dayCls(d))+'">'
      + (noteNo[d] ? noteNo[d] : (off ? 'ห' : ''))+'</td>';
  }

  return '<div class="card">'
    + '<div class="row" style="align-items:center;margin-bottom:.5rem">'
    +   '<div style="flex:1;min-width:200px"><h2 style="margin:0">'+esc(s.name)+'</h2>'
    +     '<div class="hint">'+esc(s.empCode)+' · พื้นที่หลัก '+esc(D.areaName(s.mainAreaId))
    +     (s.status !== 'active' ? ' · <span class="badge b-skipped">'
          + STAFF_STATUS[s.status]+'</span>' : '')+'</div></div>'
    +   '<div class="row" style="gap:.4rem">'
    +     '<span class="pill">ทำงาน '+mx.workDays+' วัน</span>'
    +     '<span class="pill">'+mx.rows.length+' จุด</span>'
    +     '<span class="pill">'+mx.marks+' จุด-วัน</span>'
    +     (mx.comments ? '<span class="pill">คอมเมนต์ '+mx.comments+' วัน</span>' : '')
    +   '</div>'
    + '</div>'
    + (mx.rows.length
      ? '<div class="tablewrap smx-wrap"><table class="smx"><thead><tr>'
        + '<th class="tk">รายการงาน / พื้นที่</th>'+head+'</tr></thead><tbody>'
        + body
        + '<tr class="cmrow"><td class="tk">คอมเมนต์ประจำวัน</td>'+cmTds+'</tr>'
        + '</tbody></table></div>'
      : '<div class="empty">ไม่มีงานที่บันทึกไว้ในเดือนนี้</div>')
    + (notes.length
      ? '<div class="smx-note">'
        + notes.map(n=>'<b>'+n.n+'</b> วันที่ '+n.d+' — '+esc(n.cm)).join('<br>')
        + '</div>' : '')
    + '</div>';
}

/* ---------------------------------------------------------------
   พิมพ์ — A4 แนวนอน หนึ่งคนหนึ่งหน้า
   --------------------------------------------------------------- */
const SMX_PRINT_CSS = ''
  + '#printHost .sm{font-family:"Sarabun","Noto Sans Thai",Tahoma,sans-serif;color:#000;background:#fff;'
  +   'page-break-after:always;break-after:page;font-size:9pt}'
  + '#printHost .sm:last-child{page-break-after:auto;break-after:auto}'
  + '#printHost .sm *{color:#000}'
  + '#printHost .sm .hd{display:flex;justify-content:space-between;align-items:flex-start;'
  +   'border-bottom:1.5pt solid #000;padding-bottom:4px;margin-bottom:6px;font-size:8.5pt}'
  + '#printHost .sm h1{font-size:13pt;margin:0;text-align:center;flex:1}'
  + '#printHost .sm h1 span{display:block;font-size:9.5pt;font-weight:400}'
  + '#printHost .sm .info{display:flex;gap:16px;font-size:9pt;margin-bottom:5px;flex-wrap:wrap}'
  + '#printHost .sm table{border-collapse:collapse;width:100%;table-layout:fixed}'
  + '#printHost .sm th,#printHost .sm td{border:.6pt solid #000;padding:1px 2px;'
  +   'font-size:7.2pt;text-align:center;overflow:hidden}'
  + '#printHost .sm th{background:#e8e8e8;font-weight:700}'
  + '#printHost .sm td.tk,#printHost .sm th.tk{text-align:left;font-size:8pt;padding:1px 4px;'
  +   'white-space:nowrap;text-overflow:ellipsis;width:23%}'
  + '#printHost .sm td.tk small{font-size:6.5pt}'
  + '#printHost .sm .sun{background:#f2dede}'
  + '#printHost .sm .hol{background:#fbe5c8}'
  + '#printHost .sm .off{background:#e4e0f2}'
  + '#printHost .sm .mk{font-weight:700;font-size:8pt}'
  + '#printHost .sm .cmrow td{background:#f5f5f5;font-weight:700}'
  + '#printHost .sm .notes{font-size:7.5pt;margin-top:5px;border:.6pt solid #000;padding:3px 5px}'
  + '#printHost .sm .sign{display:flex;gap:10px;margin-top:8px;font-size:8.5pt}'
  + '#printHost .sm .sign div{flex:1;border:.6pt solid #000;padding:4px 6px;min-height:50px}'
  + '#printHost .sm .ln{border-bottom:.6pt dotted #000;height:18px;margin:10px 0 3px}'
  + '#printHost .sm .foot{font-size:7pt;margin-top:4px;display:flex;justify-content:space-between}';

function printStaffMonth(list, y, m){
  if(!list.length){ toast('ยังไม่มีข้อมูลให้พิมพ์','err'); return; }
  const org = state.data.org;

  const html = list.map(x=>{
    const s = x.s, mx = x.mx, dim = mx.dim;
    const notes = [];
    for(let d = 1; d <= dim; d++){
      const c = mx.byDay[d];
      if(c && c.cm) notes.push({ n: notes.length + 1, d, cm: c.cm });
    }
    const noteNo = {};
    notes.forEach(n=>{ noteNo[n.d] = n.n; });
    const dayCls = d=> holidayOn(ymd(y,m,d)) ? 'hol' : (dowOf(y,m,d) === 0 ? 'sun' : '');

    let head = '';
    for(let d = 1; d <= dim; d++) head += '<th class="'+dayCls(d)+'">'+d+'</th>';
    let dowRow = '';
    for(let d = 1; d <= dim; d++)
      dowRow += '<th class="'+dayCls(d)+'">'+TH_DOW_SHORT[dowOf(y,m,d)]+'</th>';

    const body = mx.rows.map(r=>{
      let tds = '';
      for(let d = 1; d <= dim; d++){
        const cell = mx.byDay[d];
        const mk = cell.marks[r.taskId];
        const off = (cell.status.st === 'off' && !mk);
        tds += '<td class="mk '+(off ? 'off' : dayCls(d))+'">'
          + (mk === 'done' ? '✓' : mk === 'failed' ? '✗' : '')+'</td>';
      }
      return '<tr><td class="tk">'+esc(r.td.name)
        + ' <small>('+esc(D.areaName(r.areaId))+')</small></td>'+tds+'</tr>';
    }).join('');

    let cmTds = '';
    for(let d = 1; d <= dim; d++){
      const cell = mx.byDay[d];
      const off = (cell.status.st === 'off');
      cmTds += '<td class="'+(off ? 'off' : dayCls(d))+'">'
        + (noteNo[d] ? noteNo[d] : (off ? 'ห' : ''))+'</td>';
    }

    const colW = (77 / dim).toFixed(3);
    return '<div class="sm">'
      + '<div class="hd"><span><b>'+esc(org.name)+'</b><br>'+esc(org.dept)+'</span>'
      +   '<h1>สรุปการปฏิบัติงานรายบุคคล<span>ประจำเดือน '+TH_MONTHS[m]+' พ.ศ. '+beYear(y)+'</span></h1>'
      +   '<span style="text-align:right">'+esc(org.doc)+'-S<br>แก้ไขครั้งที่ '+esc(org.rev)+'</span></div>'
      + '<div class="info"><span><b>ผู้ปฏิบัติงาน:</b> '+esc(s.name)+'</span>'
      +   '<span><b>รหัส:</b> '+esc(s.empCode)+'</span>'
      +   '<span><b>พื้นที่หลัก:</b> '+esc(D.areaName(s.mainAreaId))+'</span>'
      +   '<span><b>ทำงาน:</b> '+mx.workDays+' วัน</span>'
      +   '<span><b>จุดที่ดูแล:</b> '+mx.rows.length+' จุด</span>'
      +   '<span><b>รวม:</b> '+mx.marks+' จุด-วัน</span></div>'
      + '<table><colgroup><col style="width:23%">'
      +   Array.from({length: dim}).map(()=>'<col style="width:'+colW+'%">').join('')
      + '</colgroup><thead><tr><th class="tk" rowspan="2">รายการงาน (พื้นที่)</th>'+head+'</tr>'
      +   '<tr>'+dowRow+'</tr></thead><tbody>'+body
      +   '<tr class="cmrow"><td class="tk">คอมเมนต์ประจำวัน</td>'+cmTds+'</tr></tbody></table>'
      + (notes.length
        ? '<div class="notes"><b>คอมเมนต์:</b> '
          + notes.map(n=> n.n+') วันที่ '+n.d+' — '+esc(n.cm)).join(' &nbsp; ')+'</div>'
        : '')
      + '<div class="sign">'
      +   '<div>ผู้ปฏิบัติงาน<div class="ln"></div>( '+esc(s.name)+' )</div>'
      +   '<div>หัวหน้าแม่บ้าน<div class="ln"></div>( …………………………… )</div>'
      +   '<div>ผู้รับทราบ / ผู้บริหาร<div class="ln"></div>( …………………………… )</div></div>'
      + '<div class="foot"><span>พิมพ์เมื่อ '+thStamp(nowIso())+' โดย '+esc(state.session.name)+'</span>'
      +   '<span>✓ ปฏิบัติแล้ว · ✗ ไม่ผ่าน/ต้องแก้ไข · ห หยุด-ลา · ช่องว่าง = ไม่ได้ทำจุดนั้นในวันนั้น</span></div>'
      + '</div>';
  }).join('');

  printDocument({
    title: 'สรุปรายบุคคล_'+TH_MONTHS[m]+'_'+beYear(y),
    html, css: SMX_PRINT_CSS, orientation:'landscape', margin:'8mm'
  });
}

/* ---------------------------------------------------------------
   ส่งออก Excel — หนึ่งคนหนึ่งชีต
   --------------------------------------------------------------- */
function exportStaffMonthExcel(list, y, m){
  if(!list.length){ toast('ยังไม่มีข้อมูลให้ส่งออก','err'); return; }
  const org = state.data.org;
  const hasXLSX = (typeof XLSX !== 'undefined');
  const wb = hasXLSX ? XLSX.utils.book_new() : null;
  let firstAoA = null;

  list.forEach((x, i)=>{
    const s = x.s, mx = x.mx, dim = mx.dim;
    const aoa = [];
    aoa.push([org.name, '', 'สรุปการปฏิบัติงานรายบุคคล']);
    aoa.push(['ประจำเดือน', TH_MONTHS[m], 'พ.ศ.', beYear(y)]);
    aoa.push(['ผู้ปฏิบัติงาน', s.name, 'รหัส', s.empCode,
              'พื้นที่หลัก', D.areaName(s.mainAreaId)]);
    aoa.push(['ทำงาน', mx.workDays+' วัน', 'จุดที่ดูแล', mx.rows.length,
              'รวม', mx.marks+' จุด-วัน']);
    aoa.push([]);

    const h1 = ['รายการงาน','พื้นที่'], h2 = ['',''];
    for(let d = 1; d <= dim; d++){ h1.push(d); h2.push(TH_DOW_SHORT[dowOf(y,m,d)]); }
    aoa.push(h1); aoa.push(h2);

    mx.rows.forEach(r=>{
      const row = [r.td.name, D.areaName(r.areaId)];
      for(let d = 1; d <= dim; d++){
        const mk = mx.byDay[d].marks[r.taskId];
        row.push(mk === 'done' ? '✓' : mk === 'failed' ? '✗' : '');
      }
      aoa.push(row);
    });

    const cmRow = ['คอมเมนต์ประจำวัน',''];
    for(let d = 1; d <= dim; d++){
      const cell = mx.byDay[d];
      cmRow.push(cell.cm ? cell.cm : (cell.status.st === 'off' ? 'ห' : ''));
    }
    aoa.push(cmRow);

    aoa.push([]);
    aoa.push(['สัญลักษณ์','✓ ปฏิบัติแล้ว','✗ ไม่ผ่าน/ต้องแก้ไข','ห หยุด-ลา',
              'ช่องว่าง = ไม่ได้ทำจุดนั้นในวันนั้น']);

    if(i === 0) firstAoA = aoa;
    if(!hasXLSX) return;

    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws['!cols'] = [{wch:32},{wch:16}].concat(Array.from({length: dim}, ()=>({wch:4})));
    const name = (s.name || 'staff').replace(/[\\\/\?\*\[\]:]/g,'').slice(0,28) || ('คน'+(i+1));
    XLSX.utils.book_append_sheet(wb, ws, name);
  });

  const fn = 'สรุปรายบุคคล_'+TH_MONTHS[m]+'_'+beYear(y)+'.xlsx';
  if(!hasXLSX){ csvFallback(firstAoA, fn); return; }
  const out = XLSX.write(wb, { bookType:'xlsx', type:'array' });
  download(fn, new Blob([out],
    { type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
}
