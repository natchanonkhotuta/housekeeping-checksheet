/* =====================================================================
   screens-master.js — หน้าจอข้อมูลหลัก
   พื้นที่ · แม่บ้าน · รายการงานมาตรฐาน · วันหยุด/วันลา · ผู้ใช้งาน · ตั้งค่า
   ===================================================================== */
'use strict';

/* =====================================================================
   1. จัดการพื้นที่ปฏิบัติงาน
   ===================================================================== */
SCREENS.areas = async function(v){
  const list = D.areas(false);
  const editable = can('area');

  v.innerHTML =
    '<div class="page-head"><h1>🏢 จัดการพื้นที่ปฏิบัติงาน</h1><span class="sp"></span>'
    + (editable ? '<button class="btn primary" id="addArea">+ เพิ่มพื้นที่</button>' : '')
    + '</div>'
    + '<p class="hint">ลำดับที่แสดงคือลำดับที่ใช้เรียงบน CHECK SHEET — ใช้ปุ่ม ▲▼ เพื่อจัดลำดับ</p>'
    + '<div class="tablewrap"><table><thead><tr>'
    +   '<th class="num">ลำดับ</th><th>รหัส</th><th>ชื่อพื้นที่</th><th class="num">จำนวนงาน</th>'
    +   '<th>ผู้รับผิดชอบ</th><th class="num">สถานะ</th>'
    +   (editable ? '<th class="num">จัดการ</th>' : '')
    + '</tr></thead><tbody>'
    + (list.length ? list.map((a,i)=>{
        const nt = D.taskDefs(a.id, true).length;
        const st = D.staffOfArea(a.id);
        return '<tr>'
          + '<td class="num">'+a.order+'</td>'
          + '<td><span class="pill">'+esc(a.code)+'</span></td>'
          + '<td><b>'+esc(a.name)+'</b>'+(a.note?'<div class="hint">'+esc(a.note)+'</div>':'')+'</td>'
          + '<td class="num">'+nt+'</td>'
          + '<td>'+(st.length ? st.map(s=>esc(s.name.split(' ')[0])).join(', ')
                              : '<span class="hint">— ยังไม่กำหนด —</span>')+'</td>'
          + '<td class="num">'+(a.active ? '<span class="badge b-done">ใช้งาน</span>'
                                         : '<span class="badge b-skipped">ปิดใช้งาน</span>')+'</td>'
          + (editable ? '<td class="num">'
              + '<button class="btn sm" data-up="'+a.id+'"'+(i===0?' disabled':'')+'>▲</button> '
              + '<button class="btn sm" data-down="'+a.id+'"'+(i===list.length-1?' disabled':'')+'>▼</button> '
              + '<button class="btn sm" data-edit="'+a.id+'">แก้ไข</button> '
              + '<button class="btn sm" data-tog="'+a.id+'">'+(a.active?'ปิด':'เปิด')+'</button> '
              + '<button class="btn sm danger" data-del="'+a.id+'">ลบ</button></td>' : '')
          + '</tr>';
      }).join('') : '<tr><td colspan="7" class="empty">ยังไม่มีพื้นที่</td></tr>')
    + '</tbody></table></div>';

  if(!editable) return;
  $('#addArea').onclick = ()=> areaDialog(null);
  $$('[data-edit]', v).forEach(b=> b.onclick = ()=> areaDialog(D.area(b.dataset.edit)));
  $$('[data-tog]', v).forEach(b=> b.onclick = async ()=>{
    const a = D.area(b.dataset.tog); a.active = !a.active;
    await saveMaster((a.active?'เปิด':'ปิด')+'ใช้งานพื้นที่ '+a.name);
    renderRoute();
  });
  $$('[data-del]', v).forEach(b=> b.onclick = ()=> deleteAreaDialog(D.area(b.dataset.del)));

  const move = async (id, dir)=>{
    const arr = D.areas(false);
    const i = arr.findIndex(x=>x.id===id), j = i + dir;
    if(j < 0 || j >= arr.length) return;
    const t = arr[i].order; arr[i].order = arr[j].order; arr[j].order = t;
    await saveMaster('จัดลำดับพื้นที่');
    renderRoute();
  };
  $$('[data-up]', v).forEach(b=> b.onclick = ()=> move(b.dataset.up, -1));
  $$('[data-down]', v).forEach(b=> b.onclick = ()=> move(b.dataset.down, 1));
};

function areaDialog(area){
  const isNew = !area;
  const a = area || { id:uid('ar'), code:'', name:'', order:(D.areas(false).length+1), active:true, note:'' };
  openModal({
    title: isNew ? 'เพิ่มพื้นที่' : 'แก้ไขพื้นที่', width:'480px',
    body:'<div class="row">'
      + '<div class="field" style="max-width:130px"><label>รหัสพื้นที่ *</label>'
      +   '<input id="fCode" value="'+esc(a.code)+'" placeholder="เช่น F1"></div>'
      + '<div class="field"><label>ชื่อพื้นที่ *</label>'
      +   '<input id="fName" value="'+esc(a.name)+'" placeholder="เช่น ชั้นที่ 1"></div></div>'
      + '<div class="field"><label>หมายเหตุ</label><input id="fNote" value="'+esc(a.note||'')+'"></div>'
      + '<div class="field"><label>ลำดับการแสดงผล</label>'
      +   '<input type="number" id="fOrder" value="'+a.order+'" min="1"></div>'
      + '<label class="chk'+(a.active?' on':'')+'"><input type="checkbox" id="fActive"'
      +   (a.active?' checked':'')+'> เปิดใช้งาน</label>',
    actions:[
      { label:'บันทึก', cls:'primary', onClick: async ()=>{
          const code = $('#fCode').value.trim(), name = $('#fName').value.trim();
          if(!code || !name){ toast('กรุณากรอกรหัสและชื่อพื้นที่','err'); return; }
          if(D.areas(false).some(x=> x.code.toLowerCase()===code.toLowerCase() && x.id!==a.id)){
            toast('รหัสพื้นที่ซ้ำ','err'); return;
          }
          Object.assign(a, { code, name, note:$('#fNote').value.trim(),
                             order: clampInt($('#fOrder').value,1,999), active: $('#fActive').checked });
          if(isNew) state.data.areas.push(a);
          await saveMaster((isNew?'เพิ่ม':'แก้ไข')+'พื้นที่ '+name);
          closeModal(); renderRoute(); toast('บันทึกแล้ว','ok');
        }},
      { label:'ยกเลิก', onClick: closeModal }
    ],
    onOpen: ()=> bindChkStyle()
  });
}

function deleteAreaDialog(a){
  if(!a) return;
  const nTasks = D.taskDefs(a.id, false).length;
  const nPlans = (state.data.planIndex||[]).filter(k=> k.endsWith('|'+a.id)).length;
  if(nTasks || nPlans){
    openModal({
      title:'ลบพื้นที่ไม่ได้', width:'480px',
      body:'<p>พื้นที่ <b>'+esc(a.name)+'</b> ยังมีข้อมูลผูกอยู่</p><ul>'
        + (nTasks ? '<li>รายการงานมาตรฐาน '+nTasks+' รายการ</li>' : '')
        + (nPlans ? '<li>ตารางงานที่บันทึกไว้ '+nPlans+' เดือน</li>' : '')
        + '</ul><p class="hint">การลบจะทำให้ประวัติเสียหาย — แนะนำให้ใช้ปุ่ม “ปิด” '
        + 'เพื่อซ่อนพื้นที่นี้จากการมอบหมายงานใหม่แทน โดยประวัติเดิมยังอยู่ครบ</p>',
      actions:[
        { label:'ปิดใช้งานแทน', cls:'primary', onClick: async ()=>{
            a.active = false;
            await saveMaster('ปิดใช้งานพื้นที่ '+a.name);
            closeModal(); renderRoute(); toast('ปิดใช้งานพื้นที่แล้ว','ok');
          }},
        { label:'ยกเลิก', onClick: closeModal }
      ]
    });
    return;
  }
  confirmDialog('ลบพื้นที่ “'+esc(a.name)+'” ออกจากระบบ?', async ()=>{
    state.data.areas = state.data.areas.filter(x=> x.id !== a.id);
    state.data.staff.forEach(s=>{
      if(s.mainAreaId === a.id) s.mainAreaId = '';
      s.subAreaIds = (s.subAreaIds||[]).filter(id=> id !== a.id);
    });
    await saveMaster('ลบพื้นที่ '+a.name);
    renderRoute(); toast('ลบแล้ว','ok');
  }, 'ลบ', 'danger');
}

/* =====================================================================
   2. จัดการข้อมูลแม่บ้าน
   ===================================================================== */
SCREENS.staff = async function(v){
  const list = D.staffAll(false);
  const editable = can('staff');

  v.innerHTML =
    '<div class="page-head"><h1>👥 จัดการข้อมูลแม่บ้าน</h1><span class="sp"></span>'
    + (editable ? '<button class="btn primary" id="addStaff">+ เพิ่มแม่บ้าน</button>'
                : '<span class="hint">สิทธิ์ของคุณเปิดดูได้อย่างเดียว</span>')
    + '</div>'
    + '<div class="tablewrap"><table><thead><tr>'
    +   '<th>รหัสพนักงาน</th><th>ชื่อ–นามสกุล</th><th>เบอร์โทรศัพท์</th><th>พื้นที่หลัก</th>'
    +   '<th>พื้นที่เพิ่มเติม</th><th>วันหยุดประจำสัปดาห์</th><th class="num">สถานะ</th>'
    +   (editable ? '<th class="num">จัดการ</th>' : '')
    + '</tr></thead><tbody>'
    + (list.length ? list.map(s=>
        '<tr>'
        + '<td><span class="pill">'+esc(s.empCode)+'</span></td>'
        + '<td><b>'+esc(s.name)+'</b>'+(s.note?'<div class="hint">'+esc(s.note)+'</div>':'')+'</td>'
        + '<td>'+esc(s.phone||'—')+'</td>'
        + '<td>'+(s.mainAreaId ? esc(D.areaName(s.mainAreaId)) : '<span class="hint">พนักงานสำรอง</span>')+'</td>'
        + '<td>'+((s.subAreaIds||[]).map(id=>'<span class="pill">'+esc(D.areaName(id))+'</span>').join(' ')||'—')+'</td>'
        + '<td>'+((s.weeklyOff||[]).map(d=>'<span class="pill">'+TH_DOW_SHORT[d]+'</span>').join(' ')||'—')+'</td>'
        + '<td class="num"><span class="badge '
          + (s.status==='active'?'b-done':s.status==='leave'?'b-leave':'b-skipped')+'">'
          + STAFF_STATUS[s.status]+'</span></td>'
        + (editable ? '<td class="num">'
            + '<button class="btn sm" data-edit="'+s.id+'">แก้ไข</button> '
            + '<button class="btn sm" data-leave="'+s.id+'">วันลา</button> '
            + '<button class="btn sm danger" data-del="'+s.id+'">ลบ</button></td>' : '')
        + '</tr>').join('')
      : '<tr><td colspan="8" class="empty">ยังไม่มีข้อมูลแม่บ้าน</td></tr>')
    + '</tbody></table></div>';

  if(!editable) return;
  $('#addStaff').onclick = ()=> staffDialog(null);
  $$('[data-edit]', v).forEach(b=> b.onclick = ()=> staffDialog(D.staff(b.dataset.edit)));
  $$('[data-leave]', v).forEach(b=> b.onclick = ()=>{ state.ui.staffId = b.dataset.leave; go('holidays'); });
  $$('[data-del]', v).forEach(b=> b.onclick = ()=> deleteStaffDialog(D.staff(b.dataset.del)));
};

function staffDialog(staff){
  const isNew = !staff;
  const s = staff || { id:uid('st'), empCode:'', name:'', phone:'', status:'active',
                       mainAreaId:'', subAreaIds:[], weeklyOff:[0], note:'' };
  const areas = D.areas(true);

  openModal({
    title: isNew ? 'เพิ่มแม่บ้าน' : 'แก้ไขข้อมูลแม่บ้าน', width:'560px',
    body:'<div class="row">'
      + '<div class="field" style="max-width:160px"><label>รหัสพนักงาน *</label>'
      +   '<input id="fEmp" value="'+esc(s.empCode)+'" placeholder="EMP-00X"></div>'
      + '<div class="field"><label>ชื่อ–นามสกุล *</label><input id="fName" value="'+esc(s.name)+'"></div></div>'
      + '<div class="row">'
      + '<div class="field"><label>เบอร์โทรศัพท์</label><input type="tel" id="fPhone" value="'+esc(s.phone||'')+'"></div>'
      + '<div class="field" style="max-width:170px"><label>สถานะการทำงาน</label><select id="fStatus">'
      +   selOptions(Object.keys(STAFF_STATUS).map(k=>({k, v:STAFF_STATUS[k]})),'k','v',s.status)
      + '</select></div></div>'
      + '<div class="field"><label>พื้นที่รับผิดชอบหลัก</label><select id="fMain">'
      +   selOptions(areas,'id','name',s.mainAreaId,'— ไม่ระบุ (พนักงานสำรอง) —')+'</select></div>'
      + '<div class="field"><label>พื้นที่รับผิดชอบเพิ่มเติม</label><div>'
      +   areas.map(a=>'<label class="chk'+((s.subAreaIds||[]).includes(a.id)?' on':'')+'">'
      +     '<input type="checkbox" name="sub" value="'+a.id+'"'
      +     ((s.subAreaIds||[]).includes(a.id)?' checked':'')+'> '+esc(a.name)+'</label>').join(' ')
      + '</div></div>'
      + '<div class="field"><label>วันหยุดประจำสัปดาห์</label><div>'+dowChecks('woff', s.weeklyOff)+'</div></div>'
      + '<div class="field"><label>หมายเหตุ</label><input id="fNote" value="'+esc(s.note||'')+'"></div>'
      + (isNew ? '<p class="hint">ระบบจะสร้างบัญชีผู้ใช้ให้อัตโนมัติ (รหัสผ่านเริ่มต้น 1234)</p>' : ''),
    actions:[
      { label:'บันทึก', cls:'primary', onClick: async ()=>{
          const empCode = $('#fEmp').value.trim(), name = $('#fName').value.trim();
          if(!empCode || !name){ toast('กรุณากรอกรหัสพนักงานและชื่อ','err'); return; }
          if(D.staffAll(false).some(x=> x.empCode.toLowerCase()===empCode.toLowerCase() && x.id!==s.id)){
            toast('รหัสพนักงานซ้ำ','err'); return;
          }
          Object.assign(s, {
            empCode, name,
            phone: $('#fPhone').value.trim(),
            status: $('#fStatus').value,
            mainAreaId: $('#fMain').value,
            subAreaIds: $$('input[name=sub]:checked').map(i=>i.value),
            weeklyOff:  $$('input[name=woff]:checked').map(i=>+i.value),
            note: $('#fNote').value.trim()
          });
          let extra = '';
          if(isNew){
            state.data.staff.push(s);
            const base = empCode.toLowerCase().replace(/[^a-z0-9]/g,'') || 'user';
            let un = base, i = 1;
            while(state.data.users.some(x=>x.username===un)) un = base + (++i);
            state.data.users.push({ id:'u_'+s.id, username:un, name, role:'staff',
                                    staffId:s.id, passHash: await sha256('1234'), active:true });
            extra = ' (บัญชีผู้ใช้: '+un+' / รหัสผ่าน 1234)';
          }
          await saveMaster((isNew?'เพิ่ม':'แก้ไข')+'ข้อมูลแม่บ้าน '+name);
          closeModal(); renderRoute(); toast('บันทึกแล้ว'+extra,'ok');
        }},
      { label:'ยกเลิก', onClick: closeModal }
    ],
    onOpen: ()=> bindChkStyle()
  });
}

function deleteStaffDialog(s){
  if(!s) return;
  const inTasks = (state.data.taskDefs||[]).filter(t=> t.defaultStaffId === s.id).length;
  const inLeaves = (state.data.leaves||[]).filter(l=> l.staffId === s.id).length;
  openModal({
    title:'ลบข้อมูลแม่บ้าน', width:'500px',
    body:'<p>ต้องการจัดการข้อมูลของ <b>'+esc(s.name)+'</b> อย่างไร</p>'
      + '<p class="hint">พบการอ้างอิง: รายการงานมาตรฐาน '+inTasks+' รายการ · บันทึกวันลา '+inLeaves+' รายการ<br>'
      + 'ตารางงานที่บันทึกไปแล้วจะยังคงชื่อผู้ปฏิบัติงานเดิมไว้เป็นประวัติ</p>'
      + '<p><b>แนะนำ:</b> เปลี่ยนสถานะเป็น “พ้นสภาพ” — ชื่อจะหายจากการมอบหมายงานใหม่ '
      + 'แต่ประวัติและรายงานย้อนหลังยังอ่านได้ครบ</p>',
    actions:[
      { label:'ตั้งเป็นพ้นสภาพ', cls:'primary', onClick: async ()=>{
          s.status = 'resigned';
          const u = (state.data.users||[]).find(x=> x.staffId === s.id);
          if(u) u.active = false;
          await saveMaster('ตั้งสถานะพ้นสภาพ '+s.name);
          closeModal(); renderRoute(); toast('ปรับสถานะแล้ว','ok');
        }},
      { label:'ลบถาวร', cls:'danger', onClick: async ()=>{
          state.data.staff = state.data.staff.filter(x=> x.id !== s.id);
          state.data.users = state.data.users.filter(x=> x.staffId !== s.id);
          state.data.leaves = state.data.leaves.filter(l=> l.staffId !== s.id);
          (state.data.taskDefs||[]).forEach(t=>{ if(t.defaultStaffId === s.id) t.defaultStaffId = ''; });
          await saveMaster('ลบข้อมูลแม่บ้าน '+s.name);
          closeModal(); renderRoute(); toast('ลบแล้ว','ok');
        }},
      { label:'ยกเลิก', onClick: closeModal }
    ]
  });
}

/* =====================================================================
   3. รายการงานมาตรฐาน
   ===================================================================== */
SCREENS.taskdefs = async function(v){
  const areaId = (D.area(state.ui.areaId) ? state.ui.areaId : (D.areas(true)[0]||{}).id) || '';
  state.ui.areaId = areaId;
  const editable = can('taskdef');
  const defs = D.taskDefs(areaId, false);

  v.innerHTML =
    '<div class="page-head"><h1>📋 รายการงานมาตรฐาน</h1><span class="sp"></span>'
    + (editable ? '<button class="btn" id="copyTasks">คัดลอกไปพื้นที่อื่น</button>'
                + '<button class="btn primary" id="addTask">+ เพิ่มงาน</button>' : '')
    + '</div>'
    + '<div class="toolbar">'+areaPicker('tdArea')+'</div>'
    + '<div class="tablewrap"><table><thead><tr>'
    +   '<th class="num">ลำดับ</th><th>รหัสงาน</th><th>ชื่องาน / รายละเอียด</th><th>ความถี่</th>'
    +   '<th>วัน</th><th>ช่วงเวลา</th><th>ผู้รับผิดชอบ</th><th class="num">สถานะ</th>'
    +   (editable ? '<th class="num">จัดการ</th>' : '')
    + '</tr></thead><tbody>'
    + (defs.length ? defs.map((t,i)=>
        '<tr>'
        + '<td class="num">'+t.order+'</td>'
        + '<td><span class="pill">'+esc(t.code)+'</span></td>'
        + '<td><b>'+esc(t.name)+'</b>'+(t.detail?'<div class="hint">'+esc(t.detail)+'</div>':'')+'</td>'
        + '<td>'+FREQ[t.freq]+'</td>'
        + '<td>'+(t.freq==='weekly'
            ? (t.weekdays||[]).map(d=>'<span class="pill">'+TH_DOW_SHORT[d]+'</span>').join(' ')
            : (t.freq==='monthly'||t.freq==='dates')
              ? (t.monthDays||[]).map(d=>'<span class="pill">'+d+'</span>').join(' ')
              : '<span class="hint">ทุกวัน</span>')+'</td>'
        + '<td>'+(t.period==='allday'?'ทั้งวัน':PERIODS[t.period])+'</td>'
        + '<td>'+(t.defaultStaffId ? esc(D.staffName(t.defaultStaffId)) : '<span class="hint">—</span>')+'</td>'
        + '<td class="num">'+(t.active?'<span class="badge b-done">ใช้งาน</span>'
                                      :'<span class="badge b-skipped">ปิด</span>')+'</td>'
        + (editable ? '<td class="num">'
            + '<button class="btn sm" data-up="'+t.id+'"'+(i===0?' disabled':'')+'>▲</button> '
            + '<button class="btn sm" data-down="'+t.id+'"'+(i===defs.length-1?' disabled':'')+'>▼</button> '
            + '<button class="btn sm" data-edit="'+t.id+'">แก้ไข</button> '
            + '<button class="btn sm" data-tog="'+t.id+'">'+(t.active?'ปิด':'เปิด')+'</button> '
            + '<button class="btn sm danger" data-del="'+t.id+'">ลบ</button></td>' : '')
        + '</tr>').join('')
      : '<tr><td colspan="9" class="empty">ยังไม่มีรายการงานในพื้นที่นี้</td></tr>')
    + '</tbody></table></div>';

  $('#tdArea').onchange = e=>{ state.ui.areaId = e.target.value; renderRoute(); };
  if(!editable) return;

  $('#addTask').onclick  = ()=> taskDefDialog(null, areaId);
  $('#copyTasks').onclick = ()=> copyTasksDialog(areaId);
  $$('[data-edit]', v).forEach(b=> b.onclick = ()=> taskDefDialog(D.taskDef(b.dataset.edit), areaId));
  $$('[data-tog]', v).forEach(b=> b.onclick = async ()=>{
    const t = D.taskDef(b.dataset.tog); t.active = !t.active;
    await saveMaster('เปลี่ยนสถานะงาน '+t.name); renderRoute();
  });
  $$('[data-del]', v).forEach(b=> b.onclick = ()=>{
    const t = D.taskDef(b.dataset.del);
    confirmDialog('ลบงาน “'+esc(t.name)+'” ออกจากรายการมาตรฐาน?'
      + '<br><span class="hint">ตารางงานที่สร้างไปแล้วจะไม่ถูกลบ</span>', async ()=>{
        state.data.taskDefs = state.data.taskDefs.filter(x=> x.id !== t.id);
        await saveMaster('ลบงาน '+t.name);
        renderRoute(); toast('ลบแล้ว','ok');
      }, 'ลบ', 'danger');
  });

  const move = async (id, dir)=>{
    const arr = D.taskDefs(areaId, false);
    const i = arr.findIndex(x=>x.id===id), j = i + dir;
    if(j < 0 || j >= arr.length) return;
    const t = arr[i].order; arr[i].order = arr[j].order; arr[j].order = t;
    await saveMaster('จัดลำดับงาน'); renderRoute();
  };
  $$('[data-up]', v).forEach(b=> b.onclick = ()=> move(b.dataset.up, -1));
  $$('[data-down]', v).forEach(b=> b.onclick = ()=> move(b.dataset.down, 1));
};

function taskDefDialog(td, areaId){
  const isNew = !td;
  const t = td || { id:uid('td'), code:'', name:'', detail:'', areaId, freq:'daily',
                    weekdays:[1], monthDays:[1], period:'morning', defaultStaffId:'',
                    active:true, order: D.taskDefs(areaId,false).length + 1 };
  openModal({
    title: isNew ? 'เพิ่มรายการงาน' : 'แก้ไขรายการงาน', width:'600px',
    body:'<div class="row">'
      + '<div class="field" style="max-width:150px"><label>รหัสงาน *</label>'
      +   '<input id="fCode" value="'+esc(t.code)+'" placeholder="F1-CL01"></div>'
      + '<div class="field"><label>ชื่องาน *</label><input id="fName" value="'+esc(t.name)+'"></div></div>'
      + '<div class="field"><label>รายละเอียด</label><textarea id="fDetail">'+esc(t.detail||'')+'</textarea></div>'
      + '<div class="row">'
      + '<div class="field"><label>พื้นที่ปฏิบัติงาน</label><select id="fArea">'
      +   selOptions(D.areas(true),'id','name',t.areaId)+'</select></div>'
      + '<div class="field" style="max-width:170px"><label>ความถี่</label><select id="fFreq">'
      +   selOptions(Object.keys(FREQ).map(k=>({k, v:FREQ[k]})),'k','v',t.freq)+'</select></div></div>'
      + '<div class="field" id="wkBox"><label>วันในสัปดาห์ที่ต้องทำ</label><div>'+dowChecks('wd', t.weekdays)+'</div></div>'
      + '<div class="field" id="mdBox"><label>วันที่ในเดือนที่ต้องทำ (คั่นด้วยจุลภาค)</label>'
      +   '<input id="fDays" value="'+(t.monthDays||[]).join(',')+'" placeholder="เช่น 1,15"></div>'
      + '<div class="row">'
      + '<div class="field" style="max-width:170px"><label>ช่วงเวลา</label><select id="fPeriod">'
      +   '<option value="morning"'+(t.period==='morning'?' selected':'')+'>เช้า</option>'
      +   '<option value="afternoon"'+(t.period==='afternoon'?' selected':'')+'>บ่าย</option>'
      +   '<option value="allday"'+(t.period==='allday'?' selected':'')+'>ทั้งวัน (เช้า+บ่าย)</option>'
      + '</select></div>'
      + '<div class="field"><label>ผู้รับผิดชอบเริ่มต้น</label><select id="fStaff">'
      +   selOptions(D.staffAll(true),'id','name',t.defaultStaffId,'— ยังไม่กำหนด —')+'</select></div>'
      + '<div class="field" style="max-width:110px"><label>ลำดับ</label>'
      +   '<input type="number" id="fOrder" value="'+t.order+'" min="1"></div></div>'
      + '<label class="chk'+(t.active?' on':'')+'"><input type="checkbox" id="fActive"'
      +   (t.active?' checked':'')+'> เปิดใช้งาน</label>',
    actions:[
      { label:'บันทึก', cls:'primary', onClick: async ()=>{
          const code = $('#fCode').value.trim(), name = $('#fName').value.trim();
          if(!code || !name){ toast('กรุณากรอกรหัสงานและชื่องาน','err'); return; }
          const freq = $('#fFreq').value;
          const wd = $$('input[name=wd]:checked').map(i=>+i.value);
          const md = $('#fDays').value.split(',').map(x=>parseInt(x.trim(),10)).filter(x=> x>=1 && x<=31);
          if(freq === 'weekly' && !wd.length){ toast('กรุณาเลือกวันในสัปดาห์','err'); return; }
          if((freq === 'monthly' || freq === 'dates') && !md.length){
            toast('กรุณาระบุวันที่ในเดือน','err'); return;
          }
          Object.assign(t, {
            code, name, detail: $('#fDetail').value.trim(), areaId: $('#fArea').value,
            freq, weekdays: wd, monthDays: md, period: $('#fPeriod').value,
            defaultStaffId: $('#fStaff').value, order: clampInt($('#fOrder').value,1,999),
            active: $('#fActive').checked
          });
          if(isNew) state.data.taskDefs.push(t);
          await saveMaster((isNew?'เพิ่ม':'แก้ไข')+'รายการงาน '+name);
          closeModal(); renderRoute(); toast('บันทึกแล้ว','ok');
        }},
      { label:'ยกเลิก', onClick: closeModal }
    ],
    onOpen:()=>{
      bindChkStyle();
      const sync = ()=>{
        const f = $('#fFreq').value;
        $('#wkBox').style.display = (f === 'weekly') ? '' : 'none';
        $('#mdBox').style.display = (f === 'monthly' || f === 'dates') ? '' : 'none';
      };
      $('#fFreq').onchange = sync;
      sync();
    }
  });
}

function copyTasksDialog(fromAreaId){
  openModal({
    title:'คัดลอกรายการงานไปยังพื้นที่อื่น', width:'480px',
    body:'<p class="hint">คัดลอกงานทั้งหมดของ <b>'+esc(D.areaName(fromAreaId))+'</b> ไปยังพื้นที่ที่เลือก '
      + '(งานที่มีรหัสซ้ำอยู่แล้วจะถูกข้าม)</p><div>'
      + D.areas(true).filter(a=>a.id!==fromAreaId).map(a=>
          '<label class="chk"><input type="checkbox" name="cp" value="'+a.id+'"> '+esc(a.name)+'</label>').join(' ')
      + '</div>',
    actions:[
      { label:'คัดลอก', cls:'primary', onClick: async ()=>{
          const targets = $$('input[name=cp]:checked').map(i=>i.value);
          if(!targets.length){ toast('ยังไม่ได้เลือกพื้นที่','err'); return; }
          const src = D.taskDefs(fromAreaId, false);
          let n = 0;
          targets.forEach(aid=>{
            const area = D.area(aid);
            src.forEach(t=>{
              const code = area.code + '-' + t.code.split('-').pop();
              if(state.data.taskDefs.some(x=> x.areaId===aid && x.code===code)) return;
              state.data.taskDefs.push(Object.assign(clone(t), {
                id: uid('td'), areaId: aid, code,
                defaultStaffId: (D.staffOfArea(aid)[0]||{}).id || ''
              }));
              n++;
            });
          });
          await saveMaster('คัดลอกรายการงานจาก '+D.areaName(fromAreaId));
          closeModal(); renderRoute(); toast('คัดลอก '+n+' รายการแล้ว','ok');
        }},
      { label:'ยกเลิก', onClick: closeModal }
    ],
    onOpen: ()=> bindChkStyle()
  });
}

/* =====================================================================
   4. ปฏิทินวันหยุด / วันลา
   ===================================================================== */
SCREENS.holidays = async function(v){
  const y = state.ui.y;
  const hols = (state.data.holidays||[]).filter(h=>h.date.startsWith(y+'-'))
                                        .sort((a,b)=> a.date.localeCompare(b.date));
  const lvs  = (state.data.leaves||[]).filter(l=>l.date.startsWith(y+'-'))
                                      .sort((a,b)=> a.date.localeCompare(b.date));
  const editable = can('holiday') || can('holiday.edit');

  v.innerHTML =
    '<div class="page-head"><h1>📆 ปฏิทินวันหยุดและวันลา</h1><span class="sp"></span>'
    + (editable ? '<button class="btn" id="addHol">+ วันหยุด</button>'
                + '<button class="btn primary" id="addLv">+ บันทึกวันลา</button>' : '')
    + '</div>'
    + '<div class="toolbar">'
    + '<div class="field" style="max-width:130px"><label>ปี (พ.ศ.)</label><select id="hYear">'
    +   [y-2,y-1,y,y+1,y+2].map(yy=>'<option value="'+yy+'"'+(yy===y?' selected':'')+'>'+beYear(yy)+'</option>').join('')
    + '</select></div>'
    + '<div class="field"><label>&nbsp;</label>'
    +   '<span class="hint">วันหยุดประจำสัปดาห์ตั้งค่ารายบุคคลได้ที่หน้า “จัดการข้อมูลแม่บ้าน”</span></div>'
    + '</div>'
    + '<div class="grid g2">'
    + '<div class="card"><h2>วันหยุดของหน่วยงาน ('+hols.length+' วัน)</h2><div class="tablewrap"><table>'
    +   '<thead><tr><th>วันที่</th><th>วัน</th><th>ชื่อวันหยุด</th><th>ประเภท</th>'
    +   (editable?'<th class="num"></th>':'')+'</tr></thead><tbody>'
    +   (hols.length ? hols.map(h=>{
          const p = isoParts(h.date);
          return '<tr><td>'+thDate(h.date)+'</td><td>'+TH_DOW[dowOf(p.y,p.m,p.d)]+'</td>'
            + '<td>'+esc(h.name)+'</td>'
            + '<td><span class="badge '+(h.type==='public'?'b-failed':'b-rework')+'">'
              + (HOLIDAY_TYPES[h.type]||h.type)+'</span></td>'
            + (editable ? '<td class="num"><button class="btn sm danger" data-delh="'+h.id+'">ลบ</button></td>' : '')
            + '</tr>';
        }).join('') : '<tr><td colspan="5" class="empty">ยังไม่มีวันหยุดในปีนี้</td></tr>')
    + '</tbody></table></div></div>'
    + '<div class="card"><h2>วันลาของแม่บ้าน ('+lvs.length+' รายการ)</h2><div class="tablewrap"><table>'
    +   '<thead><tr><th>วันที่</th><th>แม่บ้าน</th><th>ประเภท</th><th>ผู้ทดแทน</th>'
    +   (editable?'<th class="num"></th>':'')+'</tr></thead><tbody>'
    +   (lvs.length ? lvs.map(l=>
          '<tr><td>'+thDate(l.date)+'</td><td>'+esc(D.staffName(l.staffId))+'</td>'
          + '<td><span class="badge b-leave">'+esc(l.type)+'</span></td>'
          + '<td>'+(l.substituteStaffId ? esc(D.staffName(l.substituteStaffId))
                    : '<span class="hint" style="color:var(--danger)">ยังไม่มีผู้ทดแทน</span>')+'</td>'
          + (editable ? '<td class="num"><button class="btn sm" data-editl="'+l.id+'">แก้ไข</button> '
                      + '<button class="btn sm danger" data-dell="'+l.id+'">ลบ</button></td>' : '')
          + '</tr>').join('')
        : '<tr><td colspan="5" class="empty">ยังไม่มีการบันทึกวันลา</td></tr>')
    + '</tbody></table></div></div></div>';

  $('#hYear').onchange = e=>{ state.ui.y = +e.target.value; renderRoute(); };
  if(!editable) return;

  $('#addHol').onclick = ()=> holidayDialog();
  $('#addLv').onclick  = ()=> leaveDialog(null);
  $$('[data-delh]', v).forEach(b=> b.onclick = async ()=>{
    state.data.holidays = state.data.holidays.filter(h=> h.id !== b.dataset.delh);
    await saveMaster('ลบวันหยุด'); renderRoute();
  });
  $$('[data-editl]', v).forEach(b=> b.onclick = ()=>
    leaveDialog(state.data.leaves.find(l=> l.id === b.dataset.editl)));
  $$('[data-dell]', v).forEach(b=> b.onclick = async ()=>{
    state.data.leaves = state.data.leaves.filter(l=> l.id !== b.dataset.dell);
    await saveMaster('ลบวันลา'); renderRoute();
  });
};

function holidayDialog(){
  const t = todayParts();
  openModal({
    title:'เพิ่มวันหยุด', width:'460px',
    body:'<div class="row">'
      + '<div class="field"><label>วันที่เริ่ม *</label>'
      +   '<input type="date" id="fFrom" value="'+ymd(t.y,t.m,t.d)+'"></div>'
      + '<div class="field"><label>ถึงวันที่ (เว้นว่าง = วันเดียว)</label><input type="date" id="fTo"></div></div>'
      + '<div class="field"><label>ชื่อวันหยุด *</label><input id="fName" placeholder="เช่น วันสงกรานต์"></div>'
      + '<div class="field"><label>ประเภท</label><select id="fType">'
      +   selOptions(Object.keys(HOLIDAY_TYPES).map(k=>({k, v:HOLIDAY_TYPES[k]})),'k','v','public')+'</select></div>',
    actions:[
      { label:'บันทึก', cls:'primary', onClick: async ()=>{
          const from = $('#fFrom').value, to = $('#fTo').value || from;
          const name = $('#fName').value.trim(), type = $('#fType').value;
          if(!from || !name){ toast('กรอกวันที่และชื่อวันหยุด','err'); return; }
          if(to < from){ toast('วันสิ้นสุดต้องไม่ก่อนวันเริ่ม','err'); return; }
          let cur = new Date(from);
          const end = new Date(to);
          let n = 0;
          while(cur <= end && n < 400){
            const iso = ymd(cur.getFullYear(), cur.getMonth(), cur.getDate());
            if(!state.data.holidays.some(h=> h.date === iso))
              state.data.holidays.push({ id:uid('hd'), date:iso, name, type });
            cur.setDate(cur.getDate()+1); n++;
          }
          await saveMaster('เพิ่มวันหยุด '+name);
          closeModal(); renderRoute(); toast('บันทึกแล้ว','ok');
        }},
      { label:'ยกเลิก', onClick: closeModal }
    ]
  });
}

function leaveDialog(lv){
  const isNew = !lv;
  const t = todayParts();
  const l = lv || { id:uid('lv'), staffId: state.ui.staffId || '', date: ymd(t.y,t.m,t.d),
                    type:'ลากิจ', substituteStaffId:'', note:'' };
  openModal({
    title: isNew ? 'บันทึกวันลา' : 'แก้ไขวันลา', width:'500px',
    body:'<div class="row">'
      + '<div class="field"><label>แม่บ้าน *</label><select id="fStaff">'
      +   selOptions(D.staffAll(true),'id','name',l.staffId,'— เลือก —')+'</select></div>'
      + '<div class="field" style="max-width:160px"><label>ประเภทการลา</label><select id="fType">'
      +   selOptions(LEAVE_TYPES,null,null,l.type)+'</select></div></div>'
      + '<div class="row">'
      + '<div class="field"><label>วันที่เริ่มลา *</label><input type="date" id="fFrom" value="'+l.date+'"></div>'
      + '<div class="field"><label>ถึงวันที่</label><input type="date" id="fTo" value="'+(isNew?'':l.date)+'"></div></div>'
      + '<div class="field"><label>ผู้ปฏิบัติงานทดแทน</label><select id="fSub">'
      +   selOptions(D.staffAll(true),'id','name',l.substituteStaffId,'— ให้ระบบเสนอให้ —')+'</select>'
      +   '<span class="hint" id="subHint"></span></div>'
      + '<div class="field"><label>หมายเหตุ</label><input id="fNote" value="'+esc(l.note||'')+'"></div>'
      + '<p class="hint">หลังบันทึกแล้ว ให้กด “สร้าง/อัปเดตตาราง” ในหน้ามอบหมายงาน '
      + 'เพื่อให้ระบบจัดผู้ทดแทนลงตารางให้</p>',
    actions:[
      { label:'บันทึก', cls:'primary', onClick: async ()=>{
          const staffId = $('#fStaff').value, from = $('#fFrom').value, to = $('#fTo').value || from;
          if(!staffId || !from){ toast('กรุณาเลือกแม่บ้านและวันที่','err'); return; }
          if(to < from){ toast('วันสิ้นสุดต้องไม่ก่อนวันเริ่ม','err'); return; }
          const st = D.staff(staffId);
          const type = $('#fType').value, sub = $('#fSub').value, note = $('#fNote').value.trim();
          if(!isNew) state.data.leaves = state.data.leaves.filter(x=> x.id !== l.id);
          let cur = new Date(from);
          const end = new Date(to);
          let n = 0;
          while(cur <= end && n < 200){
            const iso = ymd(cur.getFullYear(), cur.getMonth(), cur.getDate());
            state.data.leaves = state.data.leaves.filter(x=> !(x.staffId===staffId && x.date===iso));
            state.data.leaves.push({
              id: uid('lv'), staffId, date: iso, type,
              substituteStaffId: sub || suggestSubstitute(st ? st.mainAreaId : '', iso, staffId),
              note
            });
            cur.setDate(cur.getDate()+1); n++;
          }
          await saveMaster('บันทึกวันลา '+D.staffName(staffId));
          closeModal(); renderRoute();
          toast('บันทึกแล้ว — อย่าลืมกด “สร้าง/อัปเดตตาราง” ในหน้ามอบหมายงาน','ok');
        }},
      { label:'ยกเลิก', onClick: closeModal }
    ],
    onOpen:()=>{
      const upd = ()=>{
        const sid = $('#fStaff').value, d = $('#fFrom').value;
        const el = $('#subHint');
        if(!sid || !d){ el.textContent = ''; return; }
        const s = D.staff(sid);
        const list = suggestSubstitutes(s ? s.mainAreaId : '', d, sid);
        el.textContent = list.length
          ? 'ระบบเสนอ: ' + list.slice(0,3).map(x=>x.name).join(', ')
          : 'ไม่มีผู้ทดแทนที่ว่างในวันนี้';
      };
      $('#fStaff').onchange = upd;
      $('#fFrom').onchange  = upd;
      upd();
    }
  });
}

/* =====================================================================
   5. ผู้ใช้งานและสิทธิ์
   ===================================================================== */
SCREENS.users = async function(v){
  const users = state.data.users || [];
  v.innerHTML =
    '<div class="page-head"><h1>🔐 ผู้ใช้งานและสิทธิ์</h1><span class="sp"></span>'
    + '<button class="btn primary" id="addUser">+ เพิ่มผู้ใช้</button></div>'
    + '<div class="card"><h3>สิทธิ์ตามบทบาท</h3><div class="tablewrap"><table>'
    +   '<thead><tr><th>บทบาท</th><th>ทำอะไรได้บ้าง</th></tr></thead><tbody>'
    +   '<tr><td><b>ผู้ดูแลระบบ</b></td><td>จัดการข้อมูลและตั้งค่าทั้งหมด รวมถึงผู้ใช้งาน</td></tr>'
    +   '<tr><td><b>หัวหน้าแม่บ้าน</b></td><td>มอบหมายงาน ตรวจสอบ อนุมัติ คีย์ผลจากกระดาษ สแกนใบเช็ค '
    +     'พิมพ์เอกสาร แก้ไขวันหยุด/วันลา · ดูข้อมูลแม่บ้านและพื้นที่ได้แบบอ่านอย่างเดียว</td></tr>'
    +   '<tr><td><b>ผู้บริหาร</b></td><td>ดูรายงาน ตรวจ/อนุมัติขั้นสุดท้าย พิมพ์เอกสาร</td></tr>'
    +   '<tr><td><b>ผู้บันทึกข้อมูล</b></td><td>คีย์ผลจากกระดาษ สแกนใบเช็ค ดูรายงาน และพิมพ์เอกสาร</td></tr>'
    +   '<tr><td><b>แม่บ้าน</b></td><td>ดูงานของตนเอง บันทึกผลการปฏิบัติงาน พิมพ์ CHECK SHEET ของตนเอง</td></tr>'
    + '</tbody></table></div></div>'
    + '<div class="tablewrap"><table><thead><tr>'
    +   '<th>ชื่อผู้ใช้</th><th>ชื่อ–สกุล</th><th>บทบาท</th><th>ผูกกับแม่บ้าน</th>'
    +   '<th class="num">สถานะ</th><th class="num">จัดการ</th></tr></thead><tbody>'
    + users.map(u=>
        '<tr><td><span class="pill">'+esc(u.username)+'</span></td><td>'+esc(u.name)+'</td>'
        + '<td><span class="badge b-assigned">'+ROLES[u.role].label+'</span></td>'
        + '<td>'+(u.staffId ? esc(D.staffName(u.staffId)) : '—')+'</td>'
        + '<td class="num">'+(u.active!==false ? '<span class="badge b-done">ใช้งาน</span>'
                                               : '<span class="badge b-skipped">ปิด</span>')+'</td>'
        + '<td class="num"><button class="btn sm" data-edit="'+u.id+'">แก้ไข</button> '
        +   '<button class="btn sm" data-pw="'+u.id+'">รหัสผ่าน</button> '
        +   (u.id !== state.session.id
              ? '<button class="btn sm" data-tog="'+u.id+'">'+(u.active!==false?'ปิด':'เปิด')+'</button> '
              + '<button class="btn sm danger" data-del="'+u.id+'">ลบ</button>' : '')
        + '</td></tr>').join('')
    + '</tbody></table></div>';

  $('#addUser').onclick = ()=> userDialog(null);
  $$('[data-edit]', v).forEach(b=> b.onclick = ()=> userDialog(D.user(b.dataset.edit)));
  $$('[data-pw]', v).forEach(b=> b.onclick = ()=> changePasswordDialog(b.dataset.pw));
  $$('[data-tog]', v).forEach(b=> b.onclick = async ()=>{
    const u = D.user(b.dataset.tog);
    u.active = (u.active === false);
    await saveMaster('เปลี่ยนสถานะผู้ใช้ '+u.name); renderRoute();
  });
  $$('[data-del]', v).forEach(b=> b.onclick = ()=>{
    const u = D.user(b.dataset.del);
    confirmDialog('ลบบัญชีผู้ใช้ “'+esc(u.username)+'” ?', async ()=>{
      state.data.users = state.data.users.filter(x=> x.id !== u.id);
      await saveMaster('ลบผู้ใช้ '+u.name);
      renderRoute(); toast('ลบแล้ว','ok');
    }, 'ลบ', 'danger');
  });
};

function userDialog(user){
  const isNew = !user;
  const u = user || { id:uid('u'), username:'', name:'', role:'staff', staffId:'', passHash:'', active:true };
  openModal({
    title: isNew ? 'เพิ่มผู้ใช้งาน' : 'แก้ไขผู้ใช้งาน', width:'480px',
    body:'<div class="row">'
      + '<div class="field"><label>ชื่อผู้ใช้ *</label><input id="fU" value="'+esc(u.username)+'"></div>'
      + '<div class="field"><label>ชื่อ–สกุล *</label><input id="fN" value="'+esc(u.name)+'"></div></div>'
      + '<div class="row">'
      + '<div class="field"><label>บทบาท</label><select id="fR">'
      +   selOptions(Object.keys(ROLES).map(k=>({k, v:ROLES[k].label})),'k','v',u.role)+'</select></div>'
      + '<div class="field"><label>ผูกกับข้อมูลแม่บ้าน</label><select id="fS">'
      +   selOptions(D.staffAll(false),'id','name',u.staffId,'— ไม่ผูก —')+'</select></div></div>'
      + (isNew ? '<div class="field"><label>รหัสผ่านเริ่มต้น *</label>'
               + '<input type="password" id="fP" value="1234"></div>' : '')
      + '<p class="hint">บัญชีบทบาท “แม่บ้าน” ควรผูกกับข้อมูลแม่บ้าน '
      + 'มิฉะนั้นหน้า “งานของฉัน” จะไม่รู้ว่าเป็นงานของใคร</p>',
    actions:[
      { label:'บันทึก', cls:'primary', onClick: async ()=>{
          const un = $('#fU').value.trim().toLowerCase(), nm = $('#fN').value.trim();
          if(!un || !nm){ toast('กรอกชื่อผู้ใช้และชื่อ–สกุล','err'); return; }
          if((state.data.users||[]).some(x=> x.username===un && x.id!==u.id)){
            toast('ชื่อผู้ใช้ซ้ำ','err'); return;
          }
          const role = $('#fR').value, staffId = $('#fS').value;
          if(role === 'staff' && !staffId){ toast('บัญชีแม่บ้านต้องผูกกับข้อมูลแม่บ้าน','err'); return; }
          Object.assign(u, { username:un, name:nm, role, staffId });
          if(isNew){ u.passHash = await sha256($('#fP').value || '1234'); state.data.users.push(u); }
          await saveMaster((isNew?'เพิ่ม':'แก้ไข')+'ผู้ใช้ '+nm);
          closeModal(); renderRoute(); toast('บันทึกแล้ว','ok');
        }},
      { label:'ยกเลิก', onClick: closeModal }
    ]
  });
}

/* =====================================================================
   6. ตั้งค่าระบบ
   ===================================================================== */
SCREENS.settings = async function(v){
  const o = state.data.org, s = state.data.settings;
  const cfg = Store.loadCfg() || { mode:'auto', url:'', key:'', table:'hkcs_kv', authHeader:'', authValue:'' };

  v.innerHTML =
    '<div class="page-head"><h1>⚙️ ตั้งค่าระบบ</h1></div>'
    + '<div class="grid g2">'

    + '<div class="card"><h2>ข้อมูลหน่วยงาน (แสดงบนหัวเอกสาร)</h2>'
    +   '<div class="field"><label>ชื่อบริษัท / หน่วยงาน</label><input id="oName" value="'+esc(o.name)+'"></div>'
    +   '<div class="field"><label>ฝ่าย / แผนก</label><input id="oDept" value="'+esc(o.dept)+'"></div>'
    +   '<div class="row"><div class="field"><label>รหัสเอกสาร</label>'
    +     '<input id="oDoc" value="'+esc(o.doc)+'"></div>'
    +   '<div class="field" style="max-width:110px"><label>แก้ไขครั้งที่</label>'
    +     '<input id="oRev" value="'+esc(o.rev)+'"></div></div></div>'

    + '<div class="card"><h2>กฎการมอบหมายงาน</h2>'
    +   '<label class="chk'+(s.assignOnHoliday?' on':'')+'" style="display:flex;margin-bottom:.5rem">'
    +     '<input type="checkbox" id="sHol"'+(s.assignOnHoliday?' checked':'')+'> มอบหมายงานในวันหยุดด้วย</label>'
    +   '<label class="chk'+(s.workOnSunday?' on':'')+'" style="display:flex;margin-bottom:.5rem">'
    +     '<input type="checkbox" id="sSun"'+(s.workOnSunday?' checked':'')+'> วันอาทิตย์เป็นวันทำงานปกติ</label>'
    +   '<label class="chk'+(s.autoApproveDone?' on':'')+'" style="display:flex">'
    +     '<input type="checkbox" id="sAuto"'+(s.autoApproveDone?' checked':'')
    +     '> เมื่อแม่บ้านกดเสร็จ ให้ถือว่าตรวจสอบแล้วอัตโนมัติ</label>'
    +   '<p class="hint" style="margin-top:.7rem">การเปลี่ยนกฎมีผลกับการ “สร้าง/อัปเดตตาราง” ครั้งถัดไป</p></div>'

    + '<div class="card" style="grid-column:1/-1"><h2>☁️ การเก็บข้อมูลและการใช้ข้ามเครื่อง</h2>'
    +   '<p class="hint">โหมดปัจจุบัน: <b>'+esc(Store.modeLabel())+'</b>'
    +     (Store.isShared() ? (Store.online ? ' · เชื่อมต่อปกติ'
        : ' · <span style="color:var(--danger)">เชื่อมต่อไม่ได้: '+esc(Store.lastError||'')+'</span>') : '')
    +   '</p>'
    +   '<div class="row" style="margin-top:.5rem">'
    +     '<div class="field" style="max-width:260px"><label>วิธีเก็บข้อมูล</label><select id="cMode">'
    +       '<option value="auto"'+(cfg.mode==='auto'||!cfg.mode?' selected':'')+'>อัตโนมัติ (แนะนำ)</option>'
    +       '<option value="local"'+(cfg.mode==='local'?' selected':'')+'>เก็บในเครื่องนี้เท่านั้น</option>'
    +       '<option value="supabase"'+(cfg.mode==='supabase'?' selected':'')+'>Supabase (ใช้ข้ามเครื่อง)</option>'
    +       '<option value="rest"'+(cfg.mode==='rest'?' selected':'')+'>REST API ของตัวเอง</option>'
    +     '</select></div></div>'
    +   '<div id="cSb" style="display:none">'
    +     '<div class="row"><div class="field"><label>Supabase Project URL</label>'
    +       '<input type="url" id="cUrl" value="'+esc(cfg.url||'')+'" placeholder="https://xxxx.supabase.co"></div>'
    +     '<div class="field" style="max-width:180px"><label>ชื่อตาราง</label>'
    +       '<input id="cTable" value="'+esc(cfg.table||'hkcs_kv')+'"></div></div>'
    +     '<div class="field"><label>anon public key</label>'
    +       '<input id="cKey" value="'+esc(cfg.key||'')+'" placeholder="eyJhbGciOi..."></div>'
    +     '<p class="hint">สร้างตารางด้วยคำสั่ง SQL ที่อยู่ในไฟล์ <code>docs/SETUP-CLOUD.md</code> '
    +       'ก่อนใช้งานครั้งแรก</p></div>'
    +   '<div id="cRest" style="display:none">'
    +     '<div class="field"><label>Base URL</label>'
    +       '<input type="url" id="cUrl2" value="'+esc(cfg.url||'')+'" placeholder="https://api.example.com/kv"></div>'
    +     '<div class="row"><div class="field"><label>ชื่อ Header สำหรับยืนยันตัวตน (ถ้ามี)</label>'
    +       '<input id="cAH" value="'+esc(cfg.authHeader||'')+'" placeholder="Authorization"></div>'
    +     '<div class="field"><label>ค่าของ Header</label>'
    +       '<input id="cAV" value="'+esc(cfg.authValue||'')+'" placeholder="Bearer ..."></div></div>'
    +     '<p class="hint">ระบบจะเรียก <code>GET {BaseURL}/{key}</code> และ <code>PUT {BaseURL}/{key}</code> '
    +       'โดยเนื้อหาเป็น JSON</p></div>'
    +   '<div class="row" style="margin-top:.6rem">'
    +     '<button class="btn primary" id="cSave">บันทึกและเชื่อมต่อใหม่</button>'
    +     '<button class="btn" id="cTest">ทดสอบการเชื่อมต่อ</button>'
    +     (Store.isShared() ? '<button class="btn" id="cSync">🔄 ดึงข้อมูลล่าสุด</button>' : '')
    +     '<button class="btn" id="cUpload">⬆ ส่งข้อมูลในเครื่องขึ้นส่วนกลาง</button>'
    +   '</div>'
    +   '<p class="hint" style="margin-top:.5rem">⚠️ ระบบนี้ทำงานฝั่งเบราว์เซอร์ทั้งหมด '
    +     'รหัสผ่านผู้ใช้เก็บเป็นค่าแฮช แต่ไม่ได้ป้องกันระดับเซิร์ฟเวอร์ '
    +     'จึงเหมาะกับการใช้ภายในองค์กร ไม่ควรใส่ข้อมูลที่เป็นความลับสูง</p></div>'

    + '<div class="card"><h2>ข้อมูลและการสำรอง</h2>'
    +   '<p class="hint">สำรองข้อมูลจะรวมตารางงานทุกเดือนที่เคยบันทึกไว้</p>'
    +   '<div class="row" style="margin-top:.6rem">'
    +     '<button class="btn" id="btnBackup">⬇ สำรองข้อมูล (JSON)</button>'
    +     '<button class="btn" id="btnRestore">⬆ กู้คืนข้อมูล</button>'
    +     '<button class="btn danger" id="btnReset">รีเซ็ตเป็นข้อมูลตัวอย่าง</button>'
    +   '</div></div>'

    + '<div class="card"><h2>เกี่ยวกับระบบ</h2><p class="hint">'
    +   'ระบบมอบหมายงานและตรวจสอบงานแม่บ้าน · เวอร์ชัน '+APP_VERSION+'<br>'
    +   'พื้นที่ '+D.areas(false).length+' · แม่บ้าน '+D.staffAll(false).length+' คน · '
    +   'งานมาตรฐาน '+(state.data.taskDefs||[]).length+' รายการ · '
    +   'ตารางงานที่บันทึกไว้ '+(state.data.planIndex||[]).length+' เดือน-พื้นที่<br>'
    +   'แก้ไขล่าสุด '+thStamp(state.data.updatedAt)+'</p></div>'
    + '</div>'
    + '<div style="margin-top:.4rem"><button class="btn primary" id="saveSet">บันทึกการตั้งค่า</button></div>';

  bindChkStyle(v);

  const syncCloudBoxes = ()=>{
    const m = $('#cMode').value;
    $('#cSb').style.display   = (m === 'supabase') ? '' : 'none';
    $('#cRest').style.display = (m === 'rest') ? '' : 'none';
  };
  $('#cMode').onchange = syncCloudBoxes;
  syncCloudBoxes();

  const readCfg = ()=>{
    const m = $('#cMode').value;
    if(m === 'supabase') return { mode:'supabase', url:$('#cUrl').value.trim(),
                                  key:$('#cKey').value.trim(), table:$('#cTable').value.trim()||'hkcs_kv' };
    if(m === 'rest')     return { mode:'rest', url:$('#cUrl2').value.trim(),
                                  authHeader:$('#cAH').value.trim(), authValue:$('#cAV').value.trim() };
    if(m === 'local')    return { mode:'local' };
    return null;   // auto
  };

  $('#cSave').onclick = async ()=>{
    const c = readCfg();
    if(c && c.mode==='supabase' && (!c.url || !c.key)){ toast('กรอก URL และ anon key ให้ครบ','err'); return; }
    if(c && c.mode==='rest' && !c.url){ toast('กรอก Base URL','err'); return; }
    Store.saveCfg(c);
    toast('บันทึกการตั้งค่าแล้ว — กำลังเชื่อมต่อใหม่…');
    await Store.init();
    const d = await Store.get(DATA_KEY);
    if(d) state.data = normalizeData(d);
    else await Store.set(DATA_KEY, state.data);
    renderShell(); renderRoute();
    toast('เชื่อมต่อโหมด '+Store.modeLabel()+' แล้ว','ok');
  };

  $('#cTest').onclick = async ()=>{
    const c = readCfg();
    const backup = Store.cfg, backupMode = Store.mode;
    Store.cfg = c; Store.mode = c ? c.mode : 'local';
    const r = await Store.ping();
    Store.cfg = backup; Store.mode = backupMode;
    if(r.ok) toast('เชื่อมต่อสำเร็จ ✓','ok');
    else toast('เชื่อมต่อไม่สำเร็จ: '+r.msg,'err');
  };

  const cs = $('#cSync');
  if(cs) cs.onclick = ()=> syncNow(false);

  $('#cUpload').onclick = ()=> confirmDialog(
    'ส่งข้อมูลทั้งหมดในเครื่องนี้ขึ้นส่วนกลาง? <b>ข้อมูลบนส่วนกลางจะถูกเขียนทับ</b>', async ()=>{
      if(!Store.isShared()){ toast('ต้องตั้งค่าโหมดคลาวด์ก่อน','err'); return; }
      const plans = await collectAllPlans();
      await Store.set(DATA_KEY, state.data);
      let n = 0;
      for(const k in plans){ await Store.set('plan:'+k, plans[k]); n++; }
      toast('ส่งข้อมูลขึ้นส่วนกลางแล้ว ('+n+' ตาราง)','ok');
    }, 'ส่งขึ้น', 'danger');

  $('#saveSet').onclick = async ()=>{
    Object.assign(state.data.org, {
      name: $('#oName').value.trim(), dept: $('#oDept').value.trim(),
      doc:  $('#oDoc').value.trim(),  rev:  $('#oRev').value.trim()
    });
    Object.assign(state.data.settings, {
      assignOnHoliday: $('#sHol').checked,
      workOnSunday:    $('#sSun').checked,
      autoApproveDone: $('#sAuto').checked
    });
    await saveMaster('แก้ไขการตั้งค่าระบบ');
    toast('บันทึกการตั้งค่าแล้ว','ok');
  };

  $('#btnBackup').onclick  = backupAll;
  $('#btnRestore').onclick = restoreDialog;
  $('#btnReset').onclick   = ()=> confirmDialog(
    'รีเซ็ตข้อมูลทั้งหมดกลับเป็นข้อมูลตัวอย่าง? <b>ข้อมูลปัจจุบันจะหายทั้งหมด</b>', async ()=>{
      const oldKeys = (state.data.planIndex||[]).slice();
      state.data = await buildSeed();
      state.plans = {};
      oldKeys.forEach(k=> Store._lsDel('plan:'+k));
      try{
        for(let i=localStorage.length-1; i>=0; i--){
          const k = localStorage.key(i);
          if(k && k.startsWith(LS_PREFIX+'plan:')) localStorage.removeItem(k);
        }
      }catch(e){}
      await Store.set(DATA_KEY, state.data);
      toast('รีเซ็ตเรียบร้อย','ok');
      renderShell(); renderRoute();
    }, 'รีเซ็ต', 'danger');
};
