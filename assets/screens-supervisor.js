/* =====================================================================
   screens-supervisor.js — เช็คลิสต์งานหัวหน้าแม่บ้าน
   รายการงานของหัวหน้าเอง · ติ๊กเสร็จรายวันตลอดรอบ 21–20 · พิมพ์ได้
   ===================================================================== */
'use strict';

const SV = { dirty:new Set(), timer:null };

SCREENS.supervisor = async function(v){
  const cyc = ensureCycle();
  const y = cyc.y, m = cyc.m;
  await loadCycleSups(y, m);

  const days  = cycleDays(y, m);
  const tasks = supTaskList(false);
  const act   = tasks.filter(t=> t.active !== false);
  const editable = can('suptask');
  const sum = supCycleSummary(y, m);
  const t0 = todayParts();
  const todayIso = ymd(t0.y, t0.m, t0.d);

  v.innerHTML =
    '<div class="page-head"><h1>🧑‍💼 งานหัวหน้าแม่บ้าน</h1><span class="sp"></span>'
    + (editable ? '<button class="btn" id="svAdd">+ เพิ่มงาน</button>' : '')
    + '<button class="btn" id="svPrint">🖨️ พิมพ์เช็คลิสต์</button></div>'

    + '<div class="toolbar">'+cyclePicker('sv')+'</div>'

    + '<div class="card" style="padding:.7rem .9rem"><div class="row" style="align-items:center">'
    +   '<div style="flex:1;min-width:200px"><b>'+act.length+' รายการงาน · '+days.length+' วันในรอบนี้</b>'
    +     '<div class="hint">ทำแล้ว '+sum.done+' จาก '+sum.dueToDate+' ช่องที่ถึงกำหนด'
    +     (sum.due !== sum.dueToDate ? ' (ทั้งรอบ '+sum.due+' ช่อง)' : '')+'</div></div>'
    +   '<div style="min-width:130px"><div class="bar" style="height:14px">'
    +     '<i style="width:'+sum.pct+'%;background:var(--ok)"></i></div>'
    +     '<div class="hint" style="text-align:center">'+sum.pct+'%</div></div>'
    +   (editable ? '<span class="hint" id="svState">ยังไม่มีการแก้ไข</span>'
                  + '<button class="btn primary" id="svSave">💾 บันทึก</button>' : '')
    + '</div></div>'

    + (act.length
      ? '<div class="tablewrap rswrap"><table class="rs"><thead>'
        + '<tr><th class="nm">รายการงานของหัวหน้า</th>'
        + days.map(dd=>{
            const hd = holidayOn(dd.iso), dow = dowOf(dd.y, dd.m, dd.d);
            const cls = hd ? 'hol' : dow === 0 ? 'sun' : '';
            return '<th class="'+cls+(dd.iso===todayIso?' today':'')+'">'+dd.d+'</th>';
          }).join('')
        + '<th class="sum">รวม</th></tr>'
        + '<tr><th class="nm"><span class="hint">ความถี่</span></th>'
        + days.map(dd=>{
            const dow = dowOf(dd.y, dd.m, dd.d);
            return '<th class="'+(holidayOn(dd.iso)?'hol':dow===0?'sun':'')+'">'
              + TH_DOW_SHORT[dow]+'</th>';
          }).join('')
        + '<th class="sum"></th></tr></thead><tbody>'
        + act.map(tk=> svRowHtml(tk, days, editable, todayIso)).join('')
        + '</tbody></table></div>'
        + '<p class="hint" style="margin-top:.5rem">คลิกช่องเพื่อสลับ '
        + '<b>✓ ทำแล้ว</b> → <b>✗ ยังไม่ได้ทำ</b> → ว่าง · '
        + 'ช่องเทาคือวันที่งานนั้นไม่ต้องทำตามความถี่ที่ตั้งไว้'
      : '<div class="card"><div class="empty">ยังไม่มีรายการงานของหัวหน้าแม่บ้าน<br>'
        + '<span class="hint">กดปุ่ม “+ เพิ่มงาน” เพื่อสร้างรายการแรก เช่น '
        + 'ตรวจความเรียบร้อยพื้นที่ส่วนกลาง · ตรวจสต็อกน้ำยา · ประชุมทีมประจำสัปดาห์</span></div></div>')

    + (tasks.length > act.length
      ? '<p class="hint" style="margin-top:.4rem">มีงานที่ปิดใช้งานอยู่ '
        + (tasks.length - act.length)+' รายการ</p>' : '')

    + (editable && tasks.length
      ? '<div class="card" style="margin-top:.7rem"><h3>รายการงานทั้งหมด</h3>'
        + '<div class="tablewrap"><table><thead><tr><th class="num">ลำดับ</th><th>รหัส</th>'
        +   '<th>ชื่องาน</th><th>ความถี่</th><th>วัน</th><th class="num">สถานะ</th>'
        +   '<th class="num">จัดการ</th></tr></thead><tbody>'
        + tasks.map((t,i)=>
            '<tr><td class="num">'+t.order+'</td>'
            + '<td><span class="pill">'+esc(t.code)+'</span></td>'
            + '<td><b>'+esc(t.name)+'</b>'
            +   (t.detail?'<div class="hint">'+esc(t.detail)+'</div>':'')+'</td>'
            + '<td>'+FREQ[t.freq]+'</td>'
            + '<td>'+(t.freq==='weekly'
                ? (t.weekdays||[]).map(d=>'<span class="pill">'+TH_DOW_SHORT[d]+'</span>').join(' ')
                : (t.freq==='monthly'||t.freq==='dates')
                  ? (t.monthDays||[]).map(d=>'<span class="pill">'+d+'</span>').join(' ')
                  : '<span class="hint">ทุกวัน</span>')+'</td>'
            + '<td class="num">'+(t.active!==false?'<span class="badge b-done">ใช้งาน</span>'
                                                  :'<span class="badge b-skipped">ปิด</span>')+'</td>'
            + '<td class="num" style="white-space:nowrap">'
            +   '<button class="btn sm" data-svup="'+esc(t.id)+'"'+(i===0?' disabled':'')+'>▲</button> '
            +   '<button class="btn sm" data-svdown="'+esc(t.id)+'"'+(i===tasks.length-1?' disabled':'')+'>▼</button> '
            +   '<button class="btn sm" data-svedit="'+esc(t.id)+'">แก้ไข</button> '
            +   '<button class="btn sm" data-svtog="'+esc(t.id)+'">'+(t.active!==false?'ปิด':'เปิด')+'</button> '
            +   '<button class="btn sm danger" data-svdel="'+esc(t.id)+'">ลบ</button></td></tr>').join('')
        + '</tbody></table></div></div>'
      : '');

  bindCyclePicker('sv', renderRoute);
  $('#svPrint').onclick = ()=> printSupervisor(y, m);
  if(!editable) return;

  $('#svAdd').onclick = ()=> supTaskDialog(null);
  $$('[data-svedit]', v).forEach(b=> b.onclick = ()=> supTaskDialog(supTaskById(b.dataset.svedit)));

  $$('[data-svtog]', v).forEach(b=> b.onclick = async ()=>{
    const t = supTaskById(b.dataset.svtog);
    t.active = (t.active === false);
    await saveMaster((t.active?'เปิด':'ปิด')+'งานหัวหน้า '+t.name);
    renderRoute();
  });

  $$('[data-svdel]', v).forEach(b=> b.onclick = ()=>{
    const t = supTaskById(b.dataset.svdel);
    confirmDialog('ลบงาน “'+esc(t.name)+'” ?'
      + '<div class="hint" style="margin-top:.4rem">ผลที่เคยติ๊กไว้ของงานนี้จะไม่แสดงอีก '
      + 'ถ้าแค่ไม่อยากใช้ชั่วคราว ใช้ปุ่ม “ปิด” แทนจะปลอดภัยกว่า</div>', async ()=>{
        state.data.supTasks = supTaskList(false).filter(x=> x.id !== t.id);
        await saveMaster('ลบงานหัวหน้า '+t.name);
        closeModal(); renderRoute(); toast('ลบแล้ว','ok');
      }, 'ลบ', 'danger');
  });

  const move = async (id, dir)=>{
    const list = supTaskList(false);
    const i = list.findIndex(t=> t.id === id), j = i + dir;
    if(i < 0 || j < 0 || j >= list.length) return;
    const a = list[i].order || (i+1), b = list[j].order || (j+1);
    list[i].order = b; list[j].order = a;
    await saveMaster('สลับลำดับงานหัวหน้า');
    renderRoute();
  };
  $$('[data-svup]', v).forEach(b=> b.onclick = ()=> move(b.dataset.svup, -1));
  $$('[data-svdown]', v).forEach(b=> b.onclick = ()=> move(b.dataset.svdown, 1));

  /* ---------- ติ๊กช่อง ---------- */
  const markDirty = (dd)=>{
    SV.dirty.add(ymKey(dd.y, dd.m));
    const el = $('#svState');
    if(el){ el.textContent = 'มีการแก้ไขที่ยังไม่บันทึก'; el.style.color = 'var(--warn)'; }
    clearTimeout(SV.timer);
    SV.timer = setTimeout(saveAll, 4000);
  };

  $$('.rs td.c[data-i]', v).forEach(td=> td.onclick = ()=>{
    const dd = days[+td.dataset.i];
    const id = td.dataset.task;
    const cur = supRec(dd, id).st || '';
    const next = cur === '' ? 'done' : cur === 'done' ? 'miss' : '';
    setSupRec(dd, id, { st: next });
    markDirty(dd);
    renderRoute();
  });

  async function saveAll(){
    clearTimeout(SV.timer);
    if(!SV.dirty.size){ toast('ไม่มีการแก้ไข'); return; }
    const keys = Array.from(SV.dirty);
    SV.dirty.clear();
    for(const k of keys){
      const s = state.sups[k];
      if(s) await saveSup(s.y, s.m);
    }
    const el = $('#svState');
    if(el){ el.textContent = 'บันทึกแล้ว '+thStamp(nowIso()); el.style.color = 'var(--ok)'; }
    toast('บันทึกเช็คลิสต์หัวหน้าแล้ว','ok');
  }
  $('#svSave').onclick = saveAll;
};

/** แถวของงานหัวหน้า 1 รายการ */
function svRowHtml(tk, days, editable, todayIso){
  let tds = '', done = 0, due = 0;
  days.forEach((dd,i)=>{
    const applies = supAppliesOn(tk, dd);
    const rec = supRec(dd, tk.id);
    const hd = holidayOn(dd.iso), dow = dowOf(dd.y, dd.m, dd.d);
    let cls = hd ? 'hol' : dow === 0 ? 'sun' : '';
    let inner = '';
    if(!applies){ cls = 'na'; }
    else {
      due++;
      if(rec.st === 'done'){ cls = 'has'; inner = '<span class="sh">✓</span>'; done++; }
      else if(rec.st === 'miss'){ cls = 'off'; inner = '<span class="sh">✗</span>'; }
    }
    if(dd.iso === todayIso) cls += ' today';
    tds += '<td class="c '+cls+'"'
      + (editable && applies ? ' data-i="'+i+'" data-task="'+esc(tk.id)+'"' : '')
      + ' title="'+esc(thDateLong(dd.iso)+' · '+tk.name)+'">'+inner+'</td>';
  });
  return '<tr><td class="nm"><b>'+esc(tk.name)+'</b>'
    + '<div class="hint">'+esc(tk.code)+' · '+FREQ[tk.freq]+'</div></td>'
    + tds
    + '<td class="sum"><b>'+done+'</b><div class="hint">/'+due+'</div></td></tr>';
}

/** เพิ่ม / แก้ไขงานของหัวหน้า */
function supTaskDialog(tk){
  const isNew = !tk;
  const t = tk || { id:uid('sup'), code: nextSupCode(), name:'', detail:'', freq:'daily',
                    weekdays:[1], monthDays:[1], order: nextSupOrder(), active:true };
  openModal({
    title: isNew ? 'เพิ่มงานหัวหน้าแม่บ้าน' : 'แก้ไขงานหัวหน้าแม่บ้าน', width:'560px',
    body:'<div class="row">'
      + '<div class="field" style="max-width:150px"><label>รหัสงาน</label>'
      +   '<input id="svCode" value="'+esc(t.code)+'"></div>'
      + '<div class="field"><label>ชื่องาน *</label>'
      +   '<input id="svName" value="'+esc(t.name)+'" placeholder="เช่น ตรวจความเรียบร้อยพื้นที่ส่วนกลาง"></div></div>'
      + '<div class="field"><label>รายละเอียด</label>'
      +   '<textarea id="svDetail">'+esc(t.detail||'')+'</textarea></div>'
      + '<div class="row">'
      + '<div class="field" style="max-width:190px"><label>ความถี่</label><select id="svFreq">'
      +   selOptions(Object.keys(FREQ).map(k=>({k, v:FREQ[k]})),'k','v',t.freq)+'</select></div>'
      + '<div class="field" style="max-width:120px"><label>ลำดับ</label>'
      +   '<input type="number" id="svOrder" value="'+t.order+'" min="1"></div></div>'
      + '<div class="field" id="svWk"><label>วันในสัปดาห์ที่ต้องทำ</label><div>'
      +   dowChecks('svwd', t.weekdays)+'</div></div>'
      + '<div class="field" id="svMd"><label>วันที่ในเดือนที่ต้องทำ (คั่นด้วยจุลภาค)</label>'
      +   '<input id="svDays" value="'+(t.monthDays||[]).join(',')+'" placeholder="เช่น 1,15"></div>'
      + '<label class="chk'+(t.active!==false?' on':'')+'"><input type="checkbox" id="svActive"'
      +   (t.active!==false?' checked':'')+'> เปิดใช้งาน</label>',
    actions:[
      { label:'บันทึก', cls:'primary', onClick: async ()=>{
          const name = $('#svName').value.trim();
          if(!name){ toast('กรอกชื่องานก่อน','err'); return; }
          const freq = $('#svFreq').value;
          const wd = $$('input[name=svwd]:checked').map(i=>+i.value);
          const md = $('#svDays').value.split(',').map(x=>parseInt(x.trim(),10)).filter(x=> x>=1 && x<=31);
          if(freq === 'weekly' && !wd.length){ toast('เลือกวันในสัปดาห์ก่อน','err'); return; }
          if((freq === 'monthly' || freq === 'dates') && !md.length){
            toast('ระบุวันที่ในเดือนก่อน','err'); return;
          }
          Object.assign(t, {
            code: $('#svCode').value.trim() || nextSupCode(), name,
            detail: $('#svDetail').value.trim(), freq, weekdays: wd, monthDays: md,
            order: clampInt($('#svOrder').value, 1, 999), active: $('#svActive').checked
          });
          if(isNew) state.data.supTasks = supTaskList(false).concat([t]);
          await saveMaster((isNew?'เพิ่ม':'แก้ไข')+'งานหัวหน้า '+name);
          closeModal(); renderRoute(); toast('บันทึกแล้ว','ok');
        }},
      { label:'ยกเลิก', onClick: closeModal }
    ],
    onOpen:()=>{
      bindChkStyle();
      const sync = ()=>{
        const f = $('#svFreq').value;
        $('#svWk').style.display = (f === 'weekly') ? '' : 'none';
        $('#svMd').style.display = (f === 'monthly' || f === 'dates') ? '' : 'none';
      };
      $('#svFreq').onchange = sync;
      sync();
    }
  });
}

/* ---------------------------------------------------------------
   พิมพ์เช็คลิสต์งานหัวหน้าแม่บ้าน — A4 แนวนอน หน้าเดียว
   --------------------------------------------------------------- */
const SUP_PRINT_CSS = ''
  + '#printHost .sv{font-family:"Sarabun","Noto Sans Thai",Tahoma,sans-serif;color:#000;background:#fff;'
  +   'font-size:9.5pt;-webkit-print-color-adjust:exact;print-color-adjust:exact;'
  +   'display:flex;flex-direction:column;height:194mm}'
  + '#printHost .sv .hd{display:flex;justify-content:space-between;align-items:flex-start;'
  +   'border-bottom:1.5pt solid #000;padding-bottom:4px;margin-bottom:5px;font-size:9pt}'
  + '#printHost .sv h1{font-size:15pt;margin:0;text-align:center;flex:1}'
  + '#printHost .sv h1 span{display:block;font-size:10.5pt;font-weight:400}'
  + '#printHost .sv table{border-collapse:collapse;width:100%;table-layout:fixed;flex:1}'
  + '#printHost .sv th,#printHost .sv td{border:.75pt solid #000;padding:0;font-size:9pt;'
  +   'text-align:center;overflow:hidden}'
  + '#printHost .sv th{background:#dfe3e8;font-weight:700;padding:1px 0}'
  + '#printHost .sv td.nm,#printHost .sv th.nm{text-align:left;font-size:9.5pt;padding:2px 6px;'
  +   'white-space:nowrap;text-overflow:ellipsis}'
  + '#printHost .sv td.nm .fq{font-size:7.5pt;color:#333;margin-left:4pt}'
  + '#printHost .sv td.c{font-weight:700;font-size:10pt}'
  + '#printHost .sv td.na{background:#d9d9d9}'
  + '#printHost .sv .sun{background:#f2dede}'
  + '#printHost .sv .hol{background:#fbe5c8}'
  + '#printHost .sv .legend{font-size:8.5pt;margin-top:5px;border:.75pt solid #000;padding:3px 6px}'
  + '#printHost .sv .sign{display:flex;gap:8px;margin-top:6px;font-size:8.5pt}'
  + '#printHost .sv .sign>div{flex:1;border:.75pt solid #000;padding:4px 6px;min-height:58px}'
  + '#printHost .sv .ln{border-bottom:.75pt dotted #000;height:16px;margin:10px 0 3px}'
  + '#printHost .sv .foot{font-size:7.5pt;margin-top:3px;text-align:right}';

function printSupervisor(y, m){
  const tasks = supTaskList(true);
  if(!tasks.length){ toast('ยังไม่มีรายการงานของหัวหน้า','err'); return; }
  const days = cycleDays(y, m);
  const org  = state.data.org;
  const rev  = rosterRev(y, m) || org.rev;

  const rowMm = Math.max(5, Math.min(14, (194 - 18 - 12 - 16 - 24) / tasks.length)).toFixed(2);

  let head = '', dowRow = '';
  days.forEach(dd=>{
    const hd = holidayOn(dd.iso), dow = dowOf(dd.y, dd.m, dd.d);
    const cls = (hd || dow === 0) ? 'sun' : '';
    head   += '<th class="'+cls+'">'+dd.d+'</th>';
    dowRow += '<th class="'+cls+'">'+TH_DOW_SHORT[dow]+'</th>';
  });

  const body = tasks.map(tk=>{
    let tds = '', done = 0, due = 0;
    days.forEach(dd=>{
      const hd = holidayOn(dd.iso), dow = dowOf(dd.y, dd.m, dd.d);
      let cls = hd ? 'hol' : dow === 0 ? 'sun' : '';
      let txt = '';
      if(!supAppliesOn(tk, dd)) cls = 'na';
      else {
        due++;
        const st = supRec(dd, tk.id).st;
        if(st === 'done'){ txt = '✓'; done++; }
        else if(st === 'miss') txt = '✗';
      }
      tds += '<td class="c '+cls+'">'+txt+'</td>';
    });
    return '<tr style="height:'+rowMm+'mm"><td class="nm">'+esc(tk.name)
      + '<span class="fq">('+FREQ[tk.freq]+')</span></td>'+tds
      + '<td class="c"><b>'+done+'</b>/'+due+'</td></tr>';
  }).join('');

  const colW = ((100 - 26 - 5) / days.length).toFixed(3);
  const html =
    '<div class="sv">'
    + '<div class="hd"><span><b>'+esc(org.name)+'</b><br>'+esc(org.dept)+'</span>'
    +   '<h1>เช็คลิสต์งานหัวหน้าแม่บ้าน<span>รอบ '+esc(cycleLabel(y, m))+'</span></h1>'
    +   '<span style="text-align:right">'+esc(org.doc)+'-S<br>แก้ไขครั้งที่ '+esc(rev)+'</span></div>'
    + '<table><colgroup><col style="width:26%">'
    +   days.map(()=>'<col style="width:'+colW+'%">').join('')
    +   '<col style="width:5%"></colgroup><thead>'
    +   '<tr><th class="nm" rowspan="2">รายการงานของหัวหน้าแม่บ้าน</th>'+head
    +     '<th rowspan="2">ทำแล้ว</th></tr><tr>'+dowRow+'</tr></thead>'
    +   '<tbody>'+body+'</tbody></table>'
    + '<div class="legend"><b>วิธีกรอก:</b> ✓ = ทำแล้ว &nbsp;·&nbsp; ✗ = ยังไม่ได้ทำ '
    +   '&nbsp;·&nbsp; ช่องเทา = วันที่งานนั้นไม่ต้องทำตามความถี่ที่กำหนด</div>'
    + '<div class="sign">'
    +   '<div><b>ผู้จัดทำ</b><div class="ln"></div>( …………………………… )<br>หัวหน้าแม่บ้าน</div>'
    +   '<div><b>ผู้ตรวจสอบ</b><div class="ln"></div>( …………………………… )<br>'
    +     'หัวหน้าแผนกสื่อสารและแรงงานสัมพันธ์</div>'
    +   '<div><b>ผู้รับทราบ</b><div class="ln"></div>( …………………………… )<br>'
    +     'ผู้จัดการฝ่ายบริหารทรัพยากรมนุษย์</div></div>'
    + '<div class="foot">พิมพ์ '+thStamp(nowIso())+' โดย '+esc(state.session.name)+'</div>'
    + '</div>';

  printDocument({
    title: 'เช็คลิสต์หัวหน้าแม่บ้าน_'+cycleLabelShort(y, m),
    html, css: SUP_PRINT_CSS, orientation:'landscape', margin:'8mm'
  });
}
