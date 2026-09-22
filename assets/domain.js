/* =====================================================================
   domain.js — ตรรกะหลักของระบบ
   ปฏิทิน วันหยุด การลา การมอบหมายงาน และสถิติ
   ===================================================================== */
'use strict';

/* ---------------------------------------------------------------
   1. ตัวอ่านข้อมูล (Data accessors)
   --------------------------------------------------------------- */
const D = {
  /** พื้นที่เรียงตามลำดับแสดงผล */
  areas(activeOnly){
    const a = (state.data.areas || []).slice().sort((x,y)=> (x.order||0) - (y.order||0));
    return activeOnly ? a.filter(x=>x.active) : a;
  },
  /** พื้นที่ตามลำดับที่บันทึกไว้จริง — ใช้กับรหัสบนใบเช็คงาน จึงต้องไม่ขึ้นกับการจัดลำดับใหม่ */
  areasRaw(){ return state.data.areas || []; },
  area(id){ return (state.data.areas || []).find(a=>a.id===id) || null; },
  areaName(id){ const a = D.area(id); return a ? a.name : '—'; },

  staffAll(activeOnly){
    const s = (state.data.staff || []).slice();
    return activeOnly ? s.filter(x=>x.status==='active') : s;
  },
  staff(id){ return (state.data.staff || []).find(s=>s.id===id) || null; },
  staffName(id){ const s = D.staff(id); return s ? s.name : '—'; },

  taskDefs(areaId, activeOnly){
    let t = (state.data.taskDefs || []).slice().sort((a,b)=> (a.order||0) - (b.order||0));
    if(areaId) t = t.filter(x=> x.areaId === areaId);
    if(activeOnly) t = t.filter(x=> x.active);
    return t;
  },
  taskDef(id){ return (state.data.taskDefs || []).find(t=>t.id===id) || null; },

  user(id){ return (state.data.users || []).find(u=>u.id===id) || null; },

  /** แม่บ้านที่รับผิดชอบพื้นที่นี้ (พื้นที่หลัก + พื้นที่เสริม) */
  staffOfArea(areaId){
    return D.staffAll(true).filter(s=> s.mainAreaId === areaId || (s.subAreaIds||[]).includes(areaId));
  }
};

/* ---------------------------------------------------------------
   2. วันหยุด / วันลา
   --------------------------------------------------------------- */
function holidayOn(iso){ return (state.data.holidays || []).find(h=>h.date===iso) || null; }
function leaveOn(staffId, iso){
  return (state.data.leaves || []).find(l=> l.staffId===staffId && l.date===iso) || null;
}

/**
 * แม่บ้านคนนี้หยุดในวันนั้นหรือไม่
 * @returns {null | {kind:'weekly'|'leave'|'holiday', label:string, sub?:string}}
 */
function staffOffOn(staffId, iso){
  const s = D.staff(staffId); if(!s) return null;
  const lv = leaveOn(staffId, iso);
  if(lv) return { kind:'leave', label: lv.type, sub: lv.substituteStaffId || '' };
  const hd = holidayOn(iso);
  if(hd) return { kind:'holiday', label: hd.name };
  const p = isoParts(iso);
  const dow = dowOf(p.y, p.m, p.d);
  if((s.weeklyOff||[]).includes(dow)) return { kind:'weekly', label:'วันหยุดประจำสัปดาห์ ('+TH_DOW[dow]+')' };
  return null;
}

/* ---------------------------------------------------------------
   3. รายการงานมาตรฐาน → ตารางงานรายเดือน
   --------------------------------------------------------------- */
/** ช่วงเวลาของงาน — 'allday' หมายถึงทั้งเช้าและบ่าย */
function periodsOf(td){ return td.period === 'allday' ? PERIOD_KEYS.slice() : [td.period]; }

/** งานนี้ต้องทำในวันที่นี้หรือไม่ ตามความถี่ที่ตั้งไว้ */
function taskAppliesOn(td, y, m, d){
  const dow = dowOf(y, m, d);
  switch(td.freq){
    case 'daily':   return true;
    case 'weekly':  return (td.weekdays||[]).includes(dow);
    case 'monthly': return (td.monthDays||[]).includes(d) || ((td.monthDays||[]).length===0 && d===1);
    case 'dates':   return (td.monthDays||[]).includes(d);
    default:        return false;
  }
}

/**
 * สร้าง/อัปเดตตารางงานรายเดือนจากรายการงานมาตรฐาน
 * @param {object} plan  แผนของพื้นที่นั้นในเดือนนั้น
 * @param {object} opts  { overwrite:boolean, assignOnHoliday:boolean }
 */
function generatePlan(plan, opts){
  opts = opts || {};
  const y = plan.y, m = plan.m, areaId = plan.areaId;
  const dim  = daysInMonth(y, m);
  const defs = D.taskDefs(areaId, true);
  const assignOnHoliday = (opts.assignOnHoliday !== undefined)
    ? opts.assignOnHoliday : state.data.settings.assignOnHoliday;

  let created = 0, skipped = 0;
  for(let d=1; d<=dim; d++){
    const iso = ymd(y, m, d);
    const dow = dowOf(y, m, d);
    const hd  = holidayOn(iso);
    const sundayOff = (dow === 0 && !state.data.settings.workOnSunday);

    defs.forEach(td=>{
      if(!taskAppliesOn(td, y, m, d)) return;
      periodsOf(td).forEach(pk=>{
        const k = cellKey(td.id, d, pk);
        const existing = plan.cells[k];
        if(existing && !opts.overwrite) return;      // ไม่เขียนทับของเดิม
        if(existing && existing.locked) return;      // ช่องที่ถูกล็อกไว้

        if((hd || sundayOff) && !assignOnHoliday){ skipped++; return; }

        let staffId = td.defaultStaffId || '';
        let note = '';
        if(staffId){
          const off = staffOffOn(staffId, iso);
          if(off){
            const sub = off.sub || suggestSubstitute(areaId, iso, staffId);
            if(sub){
              note = 'ทดแทน ' + D.staffName(staffId) + ' (' + off.label + ')';
              staffId = sub;
            } else {
              note = D.staffName(staffId) + ' ' + off.label + ' — ยังไม่มีผู้ทดแทน';
              staffId = '';
            }
          }
        }
        plan.cells[k] = { s: staffId, st: staffId ? 'assigned' : 'pending', note, day:d, p:pk, t:td.id };
        created++;
      });
    });
  }
  return { created, skipped };
}

/** ผู้ปฏิบัติงานทดแทนที่เหมาะสม เรียงจากเหมาะที่สุด */
function suggestSubstitutes(areaId, iso, excludeId){
  const pool = [];
  D.staffAll(true).forEach(s=>{
    if(s.id === excludeId) return;
    if(staffOffOn(s.id, iso)) return;
    let score = 0;
    if(s.mainAreaId === areaId) score += 3;
    if((s.subAreaIds||[]).includes(areaId)) score += 2;
    if(!s.mainAreaId) score += 1;                    // พนักงานสำรอง
    if(score === 0) return;
    pool.push({ staff:s, score });
  });
  pool.sort((a,b)=> b.score - a.score);
  return pool.map(p=>p.staff);
}
function suggestSubstitute(areaId, iso, excludeId){
  const l = suggestSubstitutes(areaId, iso, excludeId);
  return l.length ? l[0].id : '';
}

/* ---------------------------------------------------------------
   4. การตรวจการชนของตารางงาน
   --------------------------------------------------------------- */
/** คนเดียวกันถูกมอบหมายในพื้นที่อื่น ณ วันและช่วงเวลาเดียวกันหรือไม่ */
function findClash(y, m, day, period, staffId, exceptAreaId){
  if(!staffId) return null;
  for(const key in state.plans){
    const p = state.plans[key];
    if(!p || p.y !== y || p.m !== m) continue;
    if(p.areaId === exceptAreaId) continue;
    for(const ck in p.cells){
      const c = p.cells[ck];
      if(c.day === day && c.p === period && c.s === staffId){
        return { areaId: p.areaId, taskId: c.t };
      }
    }
  }
  return null;
}

/** โหลดแผนของทุกพื้นที่ในเดือนนั้น (ใช้ตรวจการชนและทำแดชบอร์ด) */
async function loadMonthPlans(y, m){
  const areas = D.areas(true);
  await Promise.all(areas.map(a=> loadPlan(y, m, a.id)));
  return areas.map(a=> state.plans[planKey(y, m, a.id)]);
}

/* ---------------------------------------------------------------
   5. สถิติ
   --------------------------------------------------------------- */
function planStats(plan){
  const st = { total:0, pending:0, assigned:0, doing:0, done:0, verified:0,
               failed:0, rework:0, skipped:0, leave:0, unassigned:0 };
  for(const k in plan.cells){
    const c = plan.cells[k];
    st.total++;
    st[c.st] = (st[c.st] || 0) + 1;
    if(!c.s && c.st !== 'skipped') st.unassigned++;
  }
  return st;
}

function statsForDay(plans, y, m, d){
  const st = { total:0, done:0, verified:0, pending:0, doing:0, problem:0, unassigned:0 };
  plans.forEach(p=>{
    if(!p) return;
    for(const k in p.cells){
      const c = p.cells[k];
      if(c.day !== d) continue;
      st.total++;
      if(c.st === 'done') st.done++;
      else if(c.st === 'verified'){ st.verified++; st.done++; }
      else if(c.st === 'doing') st.doing++;
      else if(ST_PROBLEM.includes(c.st)) st.problem++;
      else if(c.st === 'pending' || c.st === 'assigned') st.pending++;
      if(!c.s && c.st !== 'skipped') st.unassigned++;
    }
  });
  return st;
}

/* ---------------------------------------------------------------
   6. เปลี่ยนสถานะของช่องงาน
   บันทึกให้ชัดว่าใครเป็น "ผู้ปฏิบัติงาน" (by) ใครเป็น "ผู้บันทึกข้อมูล" (rec)
   และใครเป็น "ผู้ตรวจสอบ" (vby)
   --------------------------------------------------------------- */
function setCellStatus(plan, k, status, extra){
  const c = plan.cells[k]; if(!c) return;
  const who = state.session ? state.session.name : '';
  c.st = status;

  if(status === 'done'){
    c.by  = c.s ? D.staffName(c.s) : who;
    c.at  = c.at || nowIso();
    c.rec = who; c.recAt = nowIso();
  }
  if(status === 'verified' || status === 'failed' || status === 'rework'){
    c.vby = who; c.vat = nowIso();
    if(status === 'verified' && !c.by){
      c.by = c.s ? D.staffName(c.s) : who;
      c.at = c.at || nowIso();
    }
  }
  if(status === 'pending' || status === 'assigned'){
    delete c.by; delete c.at; delete c.vby; delete c.vat; delete c.rec; delete c.recAt; delete c.src;
  }
  if(extra) Object.assign(c, extra);
}

/* =====================================================================
   7. สถิติรายวันรายบุคคล
   ---------------------------------------------------------------------
   ปัญหาเดิม: รายงานอ่านทีละพื้นที่ พอแม่บ้านไปช่วยพื้นที่อื่น ข้อมูลตกหล่น
   วิธีแก้: กวาด "ทุกพื้นที่" ในเดือนนั้นแล้วจัดกลุ่มตามคน+วัน
           จากนั้นซ้อนทับด้วยส่วนต่างที่บันทึกไว้ใน daily:YYYY-MM
   ===================================================================== */

/** ดัชนีงานที่ทำจริงของทั้งเดือน — { 'staffId|day': { taskId: {...} } } */
function monthWorkIndex(y, m){
  const idx = {};
  D.areas(false).forEach(a=>{
    const p = state.plans[planKey(y, m, a.id)];
    if(!p) return;
    for(const k in p.cells){
      const c = p.cells[k];
      if(!c.s) continue;
      const worked = ST_DONE.includes(c.st) || ST_PROBLEM.includes(c.st);
      if(!worked) continue;
      const key = c.s + '|' + c.day;
      const list = idx[key] || (idx[key] = {});
      const e = list[c.t] || (list[c.t] = {
        taskId: c.t, areaId: a.id, periods: [], st: 'done', auto: true
      });
      if(!e.periods.includes(c.p)) e.periods.push(c.p);
      if(ST_PROBLEM.includes(c.st)) e.st = 'failed';
    }
  });
  return idx;
}

/** ส่วนต่างที่บันทึกไว้ของคนนั้นวันนั้น (สร้างให้ถ้ายังไม่มี) */
function dailyRec(y, m, staffId, day, create){
  const d = state.dailies[ymKey(y, m)];
  if(!d) return {};
  const k = staffId + '|' + day;
  if(!d.rec[k] && create) d.rec[k] = { s: staffId, d: day };
  return d.rec[k] || {};
}

/**
 * งานที่แม่บ้านคนนี้ทำจริงในวันนั้น (รวมทุกพื้นที่ + ส่วนต่างที่บันทึกด้วยมือ)
 * @param {object} idx ดัชนีจาก monthWorkIndex() — ส่งมาด้วยเพื่อไม่ต้องกวาดซ้ำ
 */
function dailyWork(y, m, day, staffId, idx){
  idx = idx || monthWorkIndex(y, m);
  const rec  = dailyRec(y, m, staffId, day);
  const base = idx[staffId + '|' + day] || {};
  const map  = {};

  Object.keys(base).forEach(t=>{ map[t] = base[t]; });
  (rec.rm || []).forEach(t=> delete map[t]);
  (rec.add || []).forEach(t=>{
    if(map[t]) return;
    const td = D.taskDef(t);
    if(!td) return;
    map[t] = { taskId: t, areaId: td.areaId, periods: [], st: 'done', auto: false };
  });

  const items = Object.keys(map).map(t=> map[t]).filter(it=> D.taskDef(it.taskId));
  items.sort((a,b)=> areaOrderOf(a.areaId) - areaOrderOf(b.areaId)
    || ((D.taskDef(a.taskId).order || 0) - (D.taskDef(b.taskId).order || 0)));
  return { items, rec };
}

function areaOrderOf(areaId){
  const a = D.area(areaId);
  return a ? (a.order || 0) : 999;
}

/** พื้นที่ที่แม่บ้านคนนี้รับผิดชอบ (ใช้จำกัดตัวเลือกตอนเพิ่มงานด้วยมือ) */
function areasOfStaff(staffId){
  const s = D.staff(staffId);
  if(!s) return [];
  const ids = [];
  if(s.mainAreaId) ids.push(s.mainAreaId);
  (s.subAreaIds || []).forEach(id=>{ if(!ids.includes(id)) ids.push(id); });
  return ids.map(D.area).filter(Boolean).sort((a,b)=> (a.order||0) - (b.order||0));
}

/** สถานะการทำงานของคนนั้นในวันนั้น — 'work' | 'off' พร้อมเหตุผล */
function dailyStatus(y, m, day, staffId){
  const rec = dailyRec(y, m, staffId, day);
  if(rec.st === 'work') return { st:'work', label:'ปฏิบัติงาน', forced:true };
  const off = staffOffOn(staffId, ymd(y, m, day));
  if(rec.st === 'off' || rec.st === 'leave')
    return { st:'off', label: rec.stLabel || (off ? off.label : 'หยุด'), forced:true };
  if(off) return { st:'off', label: off.label, kind: off.kind };
  return { st:'work', label:'ปฏิบัติงาน' };
}

/**
 * ตารางสรุปรายเดือนของแม่บ้าน 1 คน
 * rows  = จุดที่คนนั้นทำจริงทั้งเดือน (รวมทุกพื้นที่)
 * byDay = { วันที่: { marks:{taskId:'done'|'failed'}, cm, status } }
 */
function staffMonthMatrix(y, m, staffId, idx){
  idx = idx || monthWorkIndex(y, m);
  const dim = daysInMonth(y, m);
  const rowsMap = {};
  const byDay = {};
  let workDays = 0, marks = 0, comments = 0;

  for(let d = 1; d <= dim; d++){
    const w = dailyWork(y, m, d, staffId, idx);
    const cell = { marks:{}, cm: w.rec.cm || '', status: dailyStatus(y, m, d, staffId) };
    w.items.forEach(it=>{
      if(!rowsMap[it.taskId])
        rowsMap[it.taskId] = { taskId: it.taskId, td: D.taskDef(it.taskId), areaId: it.areaId };
      cell.marks[it.taskId] = it.st;
      marks++;
    });
    if(w.items.length) workDays++;
    if(cell.cm) comments++;
    byDay[d] = cell;
  }

  const rows = Object.keys(rowsMap).map(k=> rowsMap[k])
    .sort((a,b)=> areaOrderOf(a.areaId) - areaOrderOf(b.areaId)
      || ((a.td.order || 0) - (b.td.order || 0)));

  return { rows, byDay, dim, workDays, marks, comments };
}

/** โหลดข้อมูลที่จำเป็นทั้งหมดของเดือน (ตารางงานทุกพื้นที่ + บันทึกประจำวัน) */
async function loadMonthAll(y, m){
  await loadMonthPlans(y, m);
  await loadDaily(y, m);
}
