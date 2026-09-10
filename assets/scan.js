/* =====================================================================
   scan.js — สแกนใบเช็คงานรายวัน แล้วอ่านเครื่องหมายในช่อง (OMR)
   ไม่ได้อ่านลายมือ แต่ดูว่า "ช่องนี้มีรอยปากกาหรือไม่"
   เพราะระบบเป็นคนพิมพ์ฟอร์มเอง จึงรู้ตำแหน่งทุกช่องอยู่แล้ว
   ===================================================================== */
'use strict';

const SCAN = { items:[], cur:-1, corners:[] };

/* เกณฑ์ตัดสิน: สัดส่วนพิกเซลเข้มภายในกรอบ */
const OMR = { markMin:0.055, emptyMax:0.018, inset:0.22 };

/* ---------------------------------------------------------------
   1. เรขาคณิต — homography 4 จุด (normalized → พิกัดภาพ)
   --------------------------------------------------------------- */
function solveH(dst, src){
  const A = [], b = [];
  for(let i = 0; i < 4; i++){
    const x = dst[i][0], y = dst[i][1], u = src[i][0], v = src[i][1];
    A.push([x, y, 1, 0, 0, 0, -x*u, -y*u]); b.push(u);
    A.push([0, 0, 0, x, y, 1, -x*v, -y*v]); b.push(v);
  }
  const n = 8;
  for(let i = 0; i < n; i++){
    let p = i;
    for(let r = i+1; r < n; r++) if(Math.abs(A[r][i]) > Math.abs(A[p][i])) p = r;
    if(Math.abs(A[p][i]) < 1e-9) return null;
    const tA = A[i]; A[i] = A[p]; A[p] = tA;
    const tb = b[i]; b[i] = b[p]; b[p] = tb;
    for(let r = 0; r < n; r++){
      if(r === i) continue;
      const f = A[r][i] / A[i][i];
      if(!f) continue;
      for(let c = i; c < n; c++) A[r][c] -= f * A[i][c];
      b[r] -= f * b[i];
    }
  }
  const h = b.map((v,i)=> v / A[i][i]);
  return [h[0],h[1],h[2],h[3],h[4],h[5],h[6],h[7],1];
}
function project(H, x, y){
  const w = H[6]*x + H[7]*y + H[8];
  return [ (H[0]*x + H[1]*y + H[2]) / w, (H[3]*x + H[4]*y + H[5]) / w ];
}

/* ---------------------------------------------------------------
   2. การอ่านภาพ
   --------------------------------------------------------------- */
/** ImageData ของทั้งภาพ — ดึงครั้งเดียวแล้วเก็บไว้ (การอ่านทีละพิกเซลช้ามาก) */
const _imgCache = new WeakMap();
function fullImageData(canvas){
  let d = _imgCache.get(canvas);
  if(!d){
    d = canvas.getContext('2d', { willReadFrequently:true })
             .getImageData(0, 0, canvas.width, canvas.height);
    _imgCache.set(canvas, d);
  }
  return d;
}

/** แปลงภาพเป็นระดับเทา 0–1 */
function toGray(canvas){
  const img = fullImageData(canvas);
  const d = img.data;
  const g = new Float32Array(canvas.width * canvas.height);
  for(let i = 0, j = 0; i < d.length; i += 4, j++)
    g[j] = (d[i]*0.299 + d[i+1]*0.587 + d[i+2]*0.114) / 255;
  return { g, w: canvas.width, h: canvas.height };
}

/** ระดับความขาวของกระดาษ (ประมาณจากเปอร์เซ็นไทล์บน) */
function paperWhite(gray){
  const hist = new Uint32Array(64);
  const step = Math.max(1, Math.floor(gray.g.length / 40000));
  let n = 0;
  for(let i = 0; i < gray.g.length; i += step){
    hist[Math.min(63, (gray.g[i] * 64) | 0)]++;
    n++;
  }
  let acc = 0;
  for(let b = 63; b >= 0; b--){
    acc += hist[b];
    if(acc >= n * 0.08) return (b + 0.5) / 64;
  }
  return 0.9;
}

/** ค้นหาหมุดดำ 4 มุม */
function findFiducials(gray, white){
  const g = gray.g, w = gray.w, h = gray.h;
  const thr = white * 0.62;
  const expect = GEO.fidW * w;                      // ขนาดหมุดโดยประมาณ (px)
  const quads = [[0,0],[1,0],[1,1],[0,1]];          // TL, TR, BR, BL
  const qw = Math.floor(w * 0.32), qh = Math.floor(h * 0.28);
  const out = [];

  for(const q of quads){
    const qx = q[0], qy = q[1];
    const x0 = qx ? w - qw : 0, y0 = qy ? h - qh : 0;
    const seen = new Uint8Array(qw * qh);
    let best = null;

    for(let yy = 0; yy < qh; yy++) for(let xx = 0; xx < qw; xx++){
      const li = yy * qw + xx;
      if(seen[li]) continue;
      if(g[(y0+yy)*w + (x0+xx)] >= thr){ seen[li] = 1; continue; }

      let minx = xx, maxx = xx, miny = yy, maxy = yy, area = 0, sx = 0, sy = 0, tooBig = false;
      const st = [li];
      seen[li] = 1;
      while(st.length){
        const p = st.pop();
        const px = p % qw, py = (p / qw) | 0;
        area++; sx += px; sy += py;
        if(px < minx) minx = px;
        if(px > maxx) maxx = px;
        if(py < miny) miny = py;
        if(py > maxy) maxy = py;
        if(area > expect * expect * 6){ tooBig = true; break; }
        const nb = [[px-1,py],[px+1,py],[px,py-1],[px,py+1]];
        for(const nn of nb){
          const nx = nn[0], ny = nn[1];
          if(nx < 0 || ny < 0 || nx >= qw || ny >= qh) continue;
          const ni = ny * qw + nx;
          if(seen[ni]) continue;
          seen[ni] = 1;
          if(g[(y0+ny)*w + (x0+nx)] < thr) st.push(ni);
        }
      }
      if(tooBig) continue;

      const bw = maxx - minx + 1, bh = maxy - miny + 1;
      const aspect = bw / bh, fill = area / (bw * bh);
      if(bw < expect*0.35 || bw > expect*2.6) continue;
      if(bh < expect*0.35 || bh > expect*2.6) continue;
      if(aspect < 0.55 || aspect > 1.8) continue;
      if(fill < 0.62) continue;

      const cx = x0 + sx / area, cy = y0 + sy / area;
      const dist = Math.hypot(cx - (qx ? w : 0), cy - (qy ? h : 0));
      if(!best || dist < best.dist) best = { cx, cy, dist };
    }
    if(!best) return null;
    out.push([best.cx, best.cy]);
  }
  return out;
}

/** สัดส่วนพิกเซลเข้มภายในกรอบหนึ่งช่อง */
function sampleBox(gray, H, cx, cy, bw, bh, white){
  const inset = OMR.inset;
  const x0 = cx - bw/2 + bw*inset, x1 = cx + bw/2 - bw*inset;
  const y0 = cy - bh/2 + bh*inset, y1 = cy + bh/2 - bh*inset;
  const N = 22, M = 14;
  const thr = white * 0.62;
  let dark = 0, tot = 0;
  for(let j = 0; j < M; j++) for(let i = 0; i < N; i++){
    const p = project(H, x0 + (x1-x0)*(i+0.5)/N, y0 + (y1-y0)*(j+0.5)/M);
    const px = Math.round(p[0]), py = Math.round(p[1]);
    if(px < 0 || py < 0 || px >= gray.w || py >= gray.h) continue;
    tot++;
    if(gray.g[py*gray.w + px] < thr) dark++;
  }
  return tot ? dark / tot : 0;
}

/** ตัดภาพช่องนั้นออกมาให้คนดูยืนยัน */
function cropCell(srcCanvas, H, cx, cy, bw, bh, outW, outH){
  const src = fullImageData(srcCanvas);
  const sw = srcCanvas.width, sh = srcCanvas.height;
  const c = document.createElement('canvas');
  c.width = outW; c.height = outH;
  const cctx = c.getContext('2d');
  const img = cctx.createImageData(outW, outH);
  const pad = 0.08;
  const x0 = cx - bw*(0.5+pad), x1 = cx + bw*(0.5+pad);
  const y0 = cy - bh*(0.5+pad), y1 = cy + bh*(0.5+pad);

  for(let j = 0; j < outH; j++) for(let i = 0; i < outW; i++){
    const p = project(H, x0 + (x1-x0)*(i+0.5)/outW, y0 + (y1-y0)*(j+0.5)/outH);
    const px = Math.max(0, Math.min(sw-1, Math.round(p[0])));
    const py = Math.max(0, Math.min(sh-1, Math.round(p[1])));
    const si = (py*sw + px) * 4;
    const o  = (j*outW + i) * 4;
    img.data[o]   = src.data[si];
    img.data[o+1] = src.data[si+1];
    img.data[o+2] = src.data[si+2];
    img.data[o+3] = 255;
  }
  cctx.putImageData(img, 0, 0);
  return c;
}

/* ---------------------------------------------------------------
   3. อ่านทั้งแผ่น
   --------------------------------------------------------------- */
function readSheet(canvas, corners){
  const gray = toGray(canvas);
  const white = paperWhite(gray);
  let H = solveH(GEO.fid, corners);
  if(!H) return { ok:false, msg:'คำนวณตำแหน่งกระดาษไม่ได้ — ลองระบุมุมกระดาษเอง' };

  const readCode = (Hx)=>{
    const bits = [];
    for(let i = 0; i < GEO.code.bits; i++){
      const x = GEO.code.x0 + i * (GEO.code.w + GEO.code.gap) + GEO.code.w/2;
      bits.push(sampleBox(gray, Hx, x, GEO.code.y, GEO.code.w, GEO.code.h, white) > 0.5 ? 1 : 0);
    }
    return decodeSheetCode(bits);
  };

  let code = readCode(H);
  if(!code){
    // ลองสมมติว่ากระดาษถูกวางกลับหัว 180°
    const rot = [corners[2], corners[3], corners[0], corners[1]];
    const H2 = solveH(GEO.fid, rot);
    const c2 = H2 && readCode(H2);
    if(c2){ H = H2; code = c2; corners = rot; }
  }
  return { ok:true, H, gray, white, code, corners };
}

/** แปลงผลอ่านเป็นรายการช่อง พร้อมระดับความมั่นใจ */
function extractMarks(canvas, res){
  const code = res.code;
  const area = areaByIndex(code.areaIdx);
  if(!area) return { error:'อ่านรหัสพื้นที่จากแผ่นไม่ได้ (พื้นที่อาจถูกลบไปแล้ว)' };

  const y = code.year, m = code.month - 1, day = code.day;
  const plan = state.plans[planKey(y, m, area.id)];
  if(!plan) return { error:'ยังไม่มีตารางงานของ '+area.name+' เดือน'+TH_MONTHS[m]+' '+beYear(y)+' ในระบบ' };

  const rows = dailyRows(plan, day);
  if(!rows.length) return { error:'ไม่มีงานของ '+area.name+' ในวันที่ '+day };

  const cells = [];
  rows.forEach((r,i)=>{
    PERIOD_KEYS.forEach((pk, pi)=>{
      const has = (pi === 0) ? r.hasM : r.hasA;
      if(!has) return;
      const k = cellKey(r.td.id, day, pk);
      if(!plan.cells[k]) return;
      const cy = rowCY(i), cx = GEO.box.cx[pi];
      const ratio = sampleBox(res.gray, res.H, cx, cy, GEO.box.w, GEO.box.h, res.white);
      const unsure = (ratio < OMR.markMin && ratio > OMR.emptyMax);
      const step = unsure
        ? (ratio > (OMR.markMin + OMR.emptyMax) / 2 ? 'done' : 'clear')
        : (ratio >= OMR.markMin ? 'done' : 'clear');
      cells.push({ k, td:r.td, pk, row:i, cx, cy, ratio, step, unsure });
    });
  });
  return { plan, area, y, m, day, rows, cells };
}

/* ---------------------------------------------------------------
   4. หน้าจอสแกน
   --------------------------------------------------------------- */
SCREENS.scan = async function(v){
  v.innerHTML =
    '<div class="page-head"><h1>📷 สแกนใบเช็คงาน</h1><span class="sp"></span>'
    + '<span class="hint">อ่านเครื่องหมายในช่องจากใบที่แม่บ้านกา แล้วสรุปผลให้</span></div>'
    + '<div class="card">'
    + '<div class="scan-drop" id="scDrop"><div class="ic">📄⬆️</div>'
    +   '<b>ลากไฟล์สแกนมาวางที่นี่ หรือคลิกเพื่อเลือกไฟล์</b>'
    +   '<div class="hint" style="margin-top:.3rem">รองรับ JPG · PNG · PDF (หลายแผ่นพร้อมกันได้) · '
    +     'แนะนำสแกนขาวดำหรือสีเทา 200–300 dpi</div>'
    +   '<input type="file" id="scFile" accept="image/*,application/pdf" multiple hidden></div>'
    + '<div class="hint" style="margin-top:.6rem">ⓘ ใบที่สแกนต้องเป็น <b>“ใบเช็คงานรายวัน”</b> '
    +   'ที่พิมพ์จากระบบนี้ (มีหมุดดำ 4 มุมและแถบรหัสแผ่น) — พิมพ์ได้ที่เมนู '
    +   '<b>พิมพ์ / ส่งออก CHECK SHEET</b> → ชนิดเอกสาร <b>ใบเช็คงานรายวัน</b></div>'
    + '</div><div id="scResult"></div>';

  const drop = $('#scDrop'), input = $('#scFile');
  drop.onclick     = ()=> input.click();
  drop.ondragover  = e=>{ e.preventDefault(); drop.classList.add('over'); };
  drop.ondragleave = ()=> drop.classList.remove('over');
  drop.ondrop      = e=>{ e.preventDefault(); drop.classList.remove('over'); handleFiles(e.dataTransfer.files); };
  input.onchange   = ()=> handleFiles(input.files);

  if(SCAN.items.length) renderScanList();
};

async function handleFiles(fileList){
  const files = Array.from(fileList || []);
  if(!files.length) return;
  const host = $('#scResult');
  host.innerHTML = '<div class="card"><div class="empty">กำลังอ่านไฟล์… <span id="scProg"></span></div></div>';

  let n = 0;
  for(const f of files){
    n++;
    const p = $('#scProg');
    if(p) p.textContent = '('+n+'/'+files.length+') '+f.name;
    try{
      const canvases = await fileToCanvases(f);
      for(let i = 0; i < canvases.length; i++){
        const item = {
          name: f.name + (canvases.length > 1 ? ' — หน้า '+(i+1) : ''),
          canvas: canvases[i], status:'', msg:'', data:null, corners:null, saved:false
        };
        await analyzeItem(item);
        SCAN.items.push(item);
      }
    }catch(e){
      SCAN.items.push({ name:f.name, canvas:null, status:'bad',
                        msg:'เปิดไฟล์ไม่ได้: '+e.message, saved:false });
    }
  }
  renderScanList();
}

async function fileToCanvases(file){
  if(file.type === 'application/pdf' || /\.pdf$/i.test(file.name)){
    if(typeof pdfjsLib === 'undefined')
      throw new Error('โหลดตัวอ่าน PDF ไม่ได้ (ต้องต่ออินเทอร์เน็ต) — กรุณาสแกนเป็น JPG แทน');
    try{
      pdfjsLib.GlobalWorkerOptions.workerSrc =
        'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    }catch(e){}
    const buf = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
    const out = [];
    for(let p = 1; p <= Math.min(pdf.numPages, 40); p++){
      const page = await pdf.getPage(p);
      const vp = page.getViewport({ scale: 1 });
      const scale = Math.min(2.2, 1700 / Math.max(vp.width, vp.height));
      const v2 = page.getViewport({ scale });
      const c = document.createElement('canvas');
      c.width = Math.round(v2.width);
      c.height = Math.round(v2.height);
      await page.render({ canvasContext: c.getContext('2d'), viewport: v2 }).promise;
      out.push(c);
    }
    return out;
  }

  const url = URL.createObjectURL(file);
  try{
    const img = await new Promise((res, rej)=>{
      const im = new Image();
      im.onload = ()=> res(im);
      im.onerror = ()=> rej(new Error('ไฟล์ภาพเสียหรือไม่รองรับ'));
      im.src = url;
    });
    const scale = Math.min(1, 1700 / Math.max(img.width, img.height));
    const c = document.createElement('canvas');
    c.width = Math.round(img.width * scale);
    c.height = Math.round(img.height * scale);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    return [c];
  } finally { URL.revokeObjectURL(url); }
}

function downscale(canvas, maxW){
  const scale = Math.min(1, maxW / canvas.width);
  if(scale === 1) return { canvas, scale:1 };
  const c = document.createElement('canvas');
  c.width = Math.round(canvas.width * scale);
  c.height = Math.round(canvas.height * scale);
  c.getContext('2d').drawImage(canvas, 0, 0, c.width, c.height);
  return { canvas:c, scale };
}

async function analyzeItem(item){
  const small = downscale(item.canvas, 950);
  const gray  = toGray(small.canvas);
  const white = paperWhite(gray);
  const fid   = findFiducials(gray, white);
  if(!fid){
    item.status = 'bad';
    item.msg = 'หาหมุดดำ 4 มุมไม่พบ — กดปุ่ม “ระบุมุมเอง” เพื่อคลิกมุมกระดาษ';
    return;
  }
  await applyCorners(item, fid.map(p=> [p[0]/small.scale, p[1]/small.scale]));
}

/** อ่านแผ่นด้วยมุมที่กำหนด แล้วโหลดตารางของ "เดือนที่อยู่บนแผ่น" ก่อนถอดผล */
async function applyCorners(item, corners){
  const res = readSheet(item.canvas, corners);
  if(!res.ok){ item.status = 'bad'; item.msg = res.msg; return; }
  item.corners = res.corners;

  if(!res.code){
    item.status = 'bad';
    item.msg = 'อ่านแถบรหัสแผ่นไม่ได้ — ตรวจว่าสแกนครบทั้งแผ่นและไม่เอียงมาก';
    return;
  }

  // สำคัญ: แผ่นที่สแกนอาจเป็นของเดือนอื่น จึงต้องโหลดตารางของเดือนนั้นก่อน
  const area = areaByIndex(res.code.areaIdx);
  if(!area){ item.status = 'bad'; item.msg = 'อ่านรหัสพื้นที่จากแผ่นไม่ได้'; return; }
  await loadPlan(res.code.year, res.code.month - 1, area.id);

  const ex = extractMarks(item.canvas, res);
  if(ex.error){ item.status = 'bad'; item.msg = ex.error; return; }

  item.res = res;
  item.data = ex;
  const unsure = ex.cells.filter(c=> c.unsure).length;
  item.status = unsure ? 'warn' : 'ok';
  item.msg = D.areaName(ex.area.id)+' · '+thDateLong(ymd(ex.y, ex.m, ex.day))
           + ' · อ่านได้ '+ex.cells.length+' ช่อง'
           + (unsure ? ' · ไม่มั่นใจ '+unsure+' ช่อง' : '');
}

function renderScanList(){
  const host = $('#scResult'); if(!host) return;
  if(!SCAN.items.length){ host.innerHTML = ''; return; }

  host.innerHTML =
    '<div class="card"><div class="row" style="align-items:center">'
    + '<h3 style="margin:0;flex:1">ไฟล์ที่สแกนเข้ามา ('+SCAN.items.length+')</h3>'
    + '<button class="btn sm" id="scClear">ล้างรายการ</button></div>'
    + '<div class="scan-list" style="margin-top:.6rem">'
    + SCAN.items.map((it,i)=>
        '<div class="scan-item '+(it.saved ? 'ok' : it.status)+'">'
        + '<canvas class="thumb" data-thumb="'+i+'" width="44" height="60"></canvas>'
        + '<div class="meta"><b>'+esc(it.name)+'</b><div class="hint">'
        +   (it.saved ? '✅ บันทึกเข้าระบบแล้ว — ' : '')+esc(it.msg||'')+'</div></div>'
        + (it.data && !it.saved
            ? '<button class="btn sm primary" data-review="'+i+'">ตรวจและบันทึก</button>' : '')
        + (it.canvas ? '<button class="btn sm" data-corner="'+i+'">ระบุมุมเอง</button>' : '')
        + '</div>').join('')
    + '</div></div><div id="scReview"></div>';

  SCAN.items.forEach((it,i)=>{
    const c = $('[data-thumb="'+i+'"]');
    if(!c || !it.canvas) return;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, 44, 60);
    ctx.drawImage(it.canvas, 0, 0, 44, 60);
  });

  $('#scClear').onclick = ()=>{ SCAN.items = []; renderScanList(); };
  $$('[data-review]').forEach(b=> b.onclick = ()=> renderReview(+b.dataset.review));
  $$('[data-corner]').forEach(b=> b.onclick = ()=> renderCornerPicker(+b.dataset.corner));

  const firstPending = SCAN.items.findIndex(it=> it.data && !it.saved);
  if(firstPending >= 0) renderReview(firstPending);
}

/* ---------- ให้ผู้ใช้คลิกมุมกระดาษเอง ---------- */
function renderCornerPicker(idx){
  const it = SCAN.items[idx];
  SCAN.corners = [];
  const disp = downscale(it.canvas, 900);
  const labels = ['ซ้ายบน','ขวาบน','ขวาล่าง','ซ้ายล่าง'];

  $('#scReview').innerHTML =
    '<div class="card"><h3>ระบุมุมกระดาษ — '+esc(it.name)+'</h3>'
    + '<p class="hint">คลิกที่ <b>หมุดสี่เหลี่ยมดำ</b> ทั้ง 4 มุมของใบ ตามลำดับ: '
    +   '<span id="cpNext" style="color:var(--brand);font-weight:600">1) '+labels[0]+'</span></p>'
    + '<div class="scan-stage"><canvas id="cpCanvas" width="'+disp.canvas.width
    +   '" height="'+disp.canvas.height+'"></canvas></div>'
    + '<div class="row" style="margin-top:.6rem">'
    +   '<button class="btn" id="cpUndo">↶ ย้อนกลับ 1 จุด</button>'
    +   '<button class="btn" id="cpReset">เริ่มใหม่</button>'
    +   '<span class="sp" style="flex:1"></span>'
    +   '<button class="btn primary" id="cpDone" disabled>อ่านใหม่ด้วยมุมนี้</button>'
    + '</div></div>';

  const cv = $('#cpCanvas'), ctx = cv.getContext('2d');
  const draw = ()=>{
    ctx.drawImage(disp.canvas, 0, 0);
    SCAN.corners.forEach((p,i)=>{
      ctx.strokeStyle = '#e11'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(p[0], p[1], 10, 0, 7); ctx.stroke();
      ctx.fillStyle = '#e11'; ctx.font = 'bold 14px sans-serif';
      ctx.fillText(String(i+1), p[0]+12, p[1]-6);
    });
    $('#cpNext').textContent = SCAN.corners.length < 4
      ? (SCAN.corners.length+1)+') '+labels[SCAN.corners.length] : 'ครบแล้ว ✓';
    $('#cpDone').disabled = (SCAN.corners.length !== 4);
  };
  draw();

  cv.onclick = e=>{
    if(SCAN.corners.length >= 4) return;
    const r = cv.getBoundingClientRect();
    SCAN.corners.push([
      (e.clientX - r.left) * (cv.width / r.width),
      (e.clientY - r.top)  * (cv.height / r.height)
    ]);
    draw();
  };
  $('#cpUndo').onclick  = ()=>{ SCAN.corners.pop(); draw(); };
  $('#cpReset').onclick = ()=>{ SCAN.corners = []; draw(); };
  $('#cpDone').onclick  = async ()=>{
    await applyCorners(it, SCAN.corners.map(p=> [p[0]/disp.scale, p[1]/disp.scale]));
    renderScanList();
    if(it.status === 'bad') toast(it.msg, 'err');
  };
}

/* ---------- หน้าตรวจก่อนบันทึก ---------- */
function renderReview(idx){
  const it = SCAN.items[idx];
  if(!it || !it.data) return;
  SCAN.cur = idx;
  const d = it.data;
  const box = $('#scReview');
  const unsureN = d.cells.filter(c=> c.unsure).length;
  const doneN   = d.cells.filter(c=> c.step === 'done').length;

  box.innerHTML =
    '<div class="card"><div class="row" style="align-items:center">'
    + '<div style="flex:1;min-width:200px">'
    +   '<h3 style="margin:0">ตรวจผลที่อ่านได้ — '+esc(D.areaName(d.area.id))+'</h3>'
    +   '<div class="hint">'+thDateLong(ymd(d.y,d.m,d.day))+' (วัน'+TH_DOW[dowOf(d.y,d.m,d.day)]+') · '
    +     'อ่านว่าทำแล้ว <b>'+doneN+'</b> จาก '+d.cells.length+' ช่อง</div></div>'
    + '<label class="chk'+(KI.verifyToo?' on':'')+'"><input type="checkbox" id="rvVerify"'
    +   (KI.verifyToo?' checked':'')+'> ถือว่าตรวจสอบแล้วด้วย</label>'
    + '<button class="btn primary" id="rvSave">💾 บันทึกเข้าระบบ</button></div>'
    + (unsureN
      ? '<div class="card" style="border-color:var(--warn);background:var(--warn-soft);margin:.7rem 0 0">'
        + '⚠️ มี <b>'+unsureN+'</b> ช่องที่ระบบไม่มั่นใจ (ขอบสีเหลือง) — '
        + 'ดูรูปที่ตัดมาแล้วคลิกแก้ก่อนบันทึก</div>'
      : '<div class="card" style="border-color:var(--ok);background:var(--ok-soft);margin:.7rem 0 0">'
        + '✅ อ่านได้ชัดเจนทุกช่อง — ตรวจดูอีกรอบแล้วกดบันทึกได้เลย</div>')
    + '<p class="hint" style="margin:.6rem 0 .3rem">คลิกช่องเพื่อเปลี่ยนเครื่องหมาย · '
    +   'ภาพเล็กคือรอยที่สแกนมาจริง</p>'
    + '<div class="tablewrap" style="max-height:60vh"><table class="kigrid"><thead><tr>'
    +   '<th class="ki-no">ที่</th><th class="ki-task">รายการงาน</th>'
    +   '<th class="ki-ph" style="min-width:70px">เช้า</th>'
    +   '<th class="ki-ph" style="min-width:70px">บ่าย</th></tr></thead><tbody>'
    + d.rows.map((r,i)=>
        '<tr><td class="ki-no">'+(i+1)+'</td>'
        + '<td class="ki-task"><b>'+esc(r.td.name)+'</b><div class="hint">'+esc(r.td.code)+'</div></td>'
        + PERIOD_KEYS.map(pk=>{
            const c = d.cells.find(x=> x.row === i && x.pk === pk);
            if(!c) return '<td class="ki-c ki-na"></td>';
            return '<td class="ki-c ki-'+c.step+(c.unsure?' ki-unsure':'')+'" '
              + 'data-cell="'+esc(c.k)+'" style="width:70px;min-width:70px" '
              + 'title="ความเข้ม '+(c.ratio*100).toFixed(1)+'%">'
              + '<div class="mk">'+KEYIN_MARK[c.step]+'</div></td>';
          }).join('')
        + '</tr>').join('')
    + '</tbody></table></div></div>';

  bindChkStyle(box);
  $('#rvVerify').onchange = e=>{ KI.verifyToo = e.target.checked; };

  /* ใส่ภาพที่ตัดจากการสแกนลงในแต่ละช่อง */
  d.cells.forEach(c=>{
    const td = box.querySelector('[data-cell="'+CSS.escape(c.k)+'"]');
    if(!td) return;
    const im = cropCell(it.canvas, it.res.H, c.cx, c.cy, GEO.box.w, GEO.box.h, 44, 22);
    im.className = 'scan-crop';
    td.appendChild(im);
    td.onclick = ()=>{
      c.step = (c.step === 'done') ? 'clear' : 'done';
      c.unsure = false;
      td.className = 'ki-c ki-'+c.step;
      td.querySelector('.mk').textContent = KEYIN_MARK[c.step];
    };
  });

  $('#rvSave').onclick = async ()=>{
    const plan = d.plan;
    let nDone = 0, nClear = 0;
    d.cells.forEach(c=>{
      const cell = plan.cells[c.k];
      if(!cell) return;
      if(c.step === 'done'){
        setCellStatus(plan, c.k, KI.verifyToo ? 'verified' : 'done');
        cell.by    = cell.s ? D.staffName(cell.s) : '';
        cell.at    = noonIsoOf(d.y, d.m, d.day);
        cell.rec   = state.session.name;
        cell.recAt = nowIso();
        cell.src   = 'scan';
        nDone++;
      } else {
        setCellStatus(plan, c.k, 'assigned');
        nClear++;
      }
    });
    await savePlan(plan.key);
    await saveMaster('สแกนใบเช็คงาน '+D.areaName(d.area.id)+' วันที่ '+d.day+' — บันทึก '+nDone+' ช่อง');
    it.saved = true;
    toast('บันทึก '+nDone+' ช่องเรียบร้อย','ok');
    renderScanList();
    renderScanSummary(d, nDone, nClear);
  };
}

/* ---------- สรุปผลประจำวันหลังบันทึก ---------- */
function renderScanSummary(d, nDone, nClear){
  const plan = d.plan;
  const rows = [];
  for(const k in plan.cells) if(plan.cells[k].day === d.day) rows.push(plan.cells[k]);

  const byStaff = {};
  rows.forEach(c=>{
    const id = c.s || '__none';
    const b = byStaff[id] = byStaff[id] || { total:0, done:0, miss:0 };
    b.total++;
    if(ST_DONE.includes(c.st)) b.done++;
    else if(ST_OPEN.includes(c.st)) b.miss++;
  });
  const missed = rows.filter(c=> ST_OPEN.includes(c.st));
  const pct = rows.length
    ? Math.round(rows.filter(c=> ST_DONE.includes(c.st)).length / rows.length * 100) : 0;

  $('#scReview').innerHTML =
    '<div class="card" style="border-color:var(--ok)">'
    + '<h2>📋 สรุปผลประจำวัน — '+esc(D.areaName(d.area.id))+'</h2>'
    + '<p class="hint">'+thDateLong(ymd(d.y,d.m,d.day))+' (วัน'+TH_DOW[dowOf(d.y,d.m,d.day)]+') · '
    +   'บันทึกจากใบสแกนแล้ว '+nDone+' ช่อง'+(nClear ? ' · ล้าง '+nClear+' ช่อง' : '')+'</p>'
    + '<div class="grid g4" style="margin:.7rem 0">'
    +   '<div class="stat info"><div class="lbl">งานทั้งวัน</div><div class="val">'+rows.length+'</div></div>'
    +   '<div class="stat ok"><div class="lbl">ทำแล้ว</div><div class="val">'+(rows.length-missed.length)+'</div>'
    +     '<div class="hint">'+pct+'% ของงานวันนี้</div></div>'
    +   '<div class="stat bad"><div class="lbl">ยังไม่ได้ทำ</div><div class="val">'+missed.length+'</div></div>'
    +   '<div class="stat"><div class="lbl">แม่บ้านในวันนี้</div><div class="val">'
    +     Object.keys(byStaff).length+'</div></div>'
    + '</div>'
    + '<div class="grid g2">'
    + '<div><h3>แยกตามแม่บ้าน</h3><div class="tablewrap"><table>'
    +   '<thead><tr><th>แม่บ้าน</th><th class="num">งาน</th><th class="num">ทำแล้ว</th>'
    +   '<th class="num">ยังไม่ทำ</th><th>ความคืบหน้า</th></tr></thead><tbody>'
    +   Object.keys(byStaff).map(sid=>{
          const b = byStaff[sid];
          const p = b.total ? Math.round(b.done / b.total * 100) : 0;
          return '<tr><td><b>'+(sid === '__none' ? '— ไม่ระบุ —' : esc(D.staffName(sid)))+'</b></td>'
            + '<td class="num">'+b.total+'</td>'
            + '<td class="num" style="color:var(--ok)">'+b.done+'</td>'
            + '<td class="num" style="color:var(--danger)">'+b.miss+'</td>'
            + '<td>'+progressBar(p)+'</td></tr>';
        }).join('')
    + '</tbody></table></div></div>'
    + '<div><h3>งานที่ยังไม่ได้ทำ ('+missed.length+')</h3>'
    +   (missed.length
        ? '<div class="tablewrap" style="max-height:260px;overflow:auto"><table>'
          + '<thead><tr><th>งาน</th><th>ช่วง</th><th>ผู้รับผิดชอบ</th></tr></thead><tbody>'
          + missed.map(c=>{
              const td = D.taskDef(c.t);
              return '<tr><td>'+esc(td ? td.name : '—')+'</td>'
                + '<td><span class="pill">'+PERIODS[c.p]+'</span></td>'
                + '<td>'+(c.s ? esc(D.staffName(c.s)) : '—')+'</td></tr>';
            }).join('')
          + '</tbody></table></div>'
        : '<div class="empty">ทำครบทุกงาน 🎉</div>')
    + '</div></div>'
    + '<div class="row" style="margin-top:.8rem">'
    +   (canRoute('verify') ? '<button class="btn" id="sumVerify">ไปหน้าตรวจสอบของวันนี้</button>' : '')
    +   (canRoute('keyin')  ? '<button class="btn" id="sumKeyin">เปิดตารางคีย์มือของวันนี้</button>' : '')
    + '</div></div>';

  if($('#sumVerify')) $('#sumVerify').onclick = ()=>{
    state.ui.y = d.y; state.ui.m = d.m; state.ui.vfDay = d.day;
    state.ui.vfScope = 'day'; state.ui.vfShow = 'all'; state.ui.areaId = d.area.id;
    go('verify');
  };
  if($('#sumKeyin')) $('#sumKeyin').onclick = ()=>{
    state.ui.y = d.y; state.ui.m = d.m; state.ui.kiDay = d.day;
    state.ui.kiScope = 'day'; state.ui.areaId = d.area.id;
    go('keyin');
  };
}
