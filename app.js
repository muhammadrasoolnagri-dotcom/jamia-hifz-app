
/* Jamia Hifz/Nazra Management — Supabase */
(() => {
"use strict";

const URL = window.SUPABASE_URL;
const KEY = window.SUPABASE_ANON_KEY;

const $ = id => document.getElementById(id);
const today = () => new Date().toLocaleDateString("en-CA", {timeZone:"Asia/Karachi"});

const esc = s => String(s ?? "").replace(/[&<>"']/g,c=>({
  "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
}[c]));

let sb, user, profile;
let classes=[], students=[], records=[], assignments=[], lastCsv=[];

const isAdmin = () => profile?.role === "admin";

const toast = (msg,bad=false) => {
  const el=$("toast");
  if(!el)return;
  el.textContent=msg;
  el.classList.remove("hidden","bad","ok");
  el.classList.add(bad?"bad":"ok");
  setTimeout(()=>el.classList.add("hidden"),4500);
};

const fail = e => {
  console.error(e);
  toast(e?.message || "عمل مکمل نہیں ہوا۔",true);
};

const q = async promise => {
  const {data,error}=await promise;
  if(error)throw error;
  return data;
};

const show = (id,on=true) =>
  $(id)?.classList.toggle("hidden",!on);

const setOptions = (id,rows,first="کلاس منتخب کریں") => {
  const el=$(id);
  if(!el)return;

  const old=el.value;
  el.innerHTML=`<option value="">${first}</option>`+
    rows.map(x=>`<option value="${esc(x.id)}">${esc(x.name)}</option>`).join("");

  if(rows.some(x=>x.id===old))el.value=old;
};

const assignedClass = id => classes.find(c=>c.id===id);
const studentById = id => students.find(s=>s.id===id);
const classById = id => assignedClass(id);

const rollOf = s =>
  students
    .filter(x=>x.class_id===s.class_id)
    .sort((a,b)=>(a.created_at||"").localeCompare(b.created_at||""))
    .findIndex(x=>x.id===s.id)+1;

async function init(){
  if(!window.supabase || !KEY || KEY.includes("PASTE_")){
    $("loginMessage").textContent="Supabase کی Publishable Key درج کریں۔";
    show("loginMessage");
    return;
  }

  sb=window.supabase.createClient(URL,KEY,{
    auth:{
      persistSession:true,
      autoRefreshToken:true,
      detectSessionInUrl:true
    }
  });

  $("loginBtn").onclick=login;
  $("logoutBtnMain").onclick=logout;
  $("pendingLogout").onclick=logout;

  document.querySelectorAll("[data-tab]").forEach(b=>{
    b.onclick=()=>switchTab(b.dataset.tab);
  });

  $("addStudentBtn").onclick=addStudent;
  $("saveDiary").onclick=saveDiary;
  $("createClassBtn").onclick=createClass;
  $("showRecords").onclick=showRecords;
  $("exportPdf").onclick=exportPdf;
 $("studentFilter").onchange=renderStudents;
$("studentSearch").oninput=renderStudents;
$("diaryClass").onchange=renderDiary;
$("recordClass").onchange=loadRecordStudents;

   const {data:{session}}=await sb.auth.getSession();

  if(session)await boot(session.user);

  sb.auth.onAuthStateChange((event,session)=>{
    if(event==="SIGNED_OUT"){
      resetUI();
      return;
    }

    if(event==="SIGNED_IN" && session){
      boot(session.user).catch(fail);
    }
  });
    }

async function login(){
  const selected=sessionStorage.getItem("jamia_selected_role");

  if(!selected){
    $("loginMessage").textContent="پہلے نگران یا استاد منتخب کریں۔";
    show("loginMessage");
    return;
  }

  try{
    await q(sb.auth.signInWithOAuth({
      provider:"google",
      options:{redirectTo:location.origin+location.pathname}
    }));
  }catch(e){fail(e);}
}

async function logout(){
  try{
    if(sb)await q(sb.auth.signOut());
    sessionStorage.removeItem("jamia_selected_role");
    resetUI();
  }catch(e){fail(e);}
}

function resetUI(){
  user=profile=null;
  classes=[];
  students=[];
  records=[];
  assignments=[];

  show("loginView");
  show("pendingView",false);
  show("appView",false);

  if($("loginBtn"))$("loginBtn").disabled=true;
}

async function boot(u){
  user=u;

  try{
    profile=await q(
      sb.from("profiles").select("*").eq("id",u.id).single()
    );

    if(!profile.active){
      show("loginView",false);
      show("appView",false);
      show("pendingView");
      return;
    }

    const selected=sessionStorage.getItem("jamia_selected_role");
    const actualRole=isAdmin()?"supervisor":"teacher";

    if(selected && selected!==actualRole){
      await sb.auth.signOut();
      sessionStorage.removeItem("jamia_selected_role");
      resetUI();
      $("loginMessage").textContent=
        "آپ کے اکاؤنٹ کا کردار منتخب کردہ کردار سے مختلف ہے۔ درست کردار منتخب کریں۔";
      show("loginMessage");
      return;
    }

    show("loginView",false);
    show("pendingView",false);
    show("appView");

    $("userEmail").textContent=u.email||"";
    $("welcome").textContent=profile.full_name||u.email||"صارف";
    $("roleLabel").textContent=isAdmin()?"نگران / مکمل اختیار":"استاد";

    show("adminTab",isAdmin());
    $("todayLabel").textContent=today();

    await loadData();
    switchTab("dashboard");

  }catch(e){
    fail(e);
    resetUI();
  }
}

async function loadData(){
  if(isAdmin()){
    classes=await q(
      sb.from("classes").select("*").order("created_at")
    );

    assignments=await q(
      sb.from("class_teachers")
        .select("id,class_id,teacher_id,profiles(id,full_name,email,active)")
    );

  }else{
    assignments=await q(
      sb.from("class_teachers")
        .select("class_id")
        .eq("teacher_id",user.id)
    );

    const ids=assignments.map(a=>a.class_id);

    classes=ids.length
      ?await q(sb.from("classes").select("*").in("id",ids))
      :[];
  }

  const ids=classes.map(c=>c.id);

  students=ids.length
    ?await q(
      sb.from("students")
        .select("*")
        .in("class_id",ids)
        .eq("active",true)
        .order("created_at")
    )
    :[];

  records=ids.length
    ?await q(
      sb.from("daily_records")
        .select("*")
        .in("class_id",ids)
        .order("record_date",{ascending:false})
        .limit(3000)
    )
    :[];

  setOptions("studentFilter",classes);
  setOptions("diaryClass",classes);
  setOptions("recordClass",classes);
if(!$("recordDate").value)$("recordDate").value=today();
await loadRecordStudents();
  renderDashboard();
  renderStudents();
  renderDiary();

  if(isAdmin())await renderAdmin();
}

function switchTab(name){
  const panels={
    dashboard:"dashboardTab",
    students:"studentsTab",
    diary:"diaryTab",
    records:"recordsTab",
    admin:"adminTabPanel"
  };

  Object.entries(panels).forEach(([tab,id])=>{
    show(id,tab===name);
  });

  document.querySelectorAll("[data-tab]").forEach(b=>{
    b.classList.toggle("active",b.dataset.tab===name);
  });

  if(name==="diary")renderDiary();
  if(name==="admin"&&isAdmin())renderAdmin();
}

function renderDashboard(){
  $("stats").innerHTML=[
    ["کلاسیں",classes.length],
    ["طلبہ",students.length],
    ["آج کے ریکارڈ",records.filter(r=>r.record_date===today()).length]
  ].map(([a,b])=>
    `<div class="card">
      <div class="muted">${a}</div>
      <h2>${b}</h2>
    </div>`
  ).join("");

  $("classCards").innerHTML=classes.map(c=>
    `<div class="card">
      <b>${esc(c.name)}</b>
      <div class="muted">${students.filter(s=>s.class_id===c.id).length} طلبہ</div>
    </div>`
  ).join("")||"ابھی کوئی کلاس الاٹ نہیں۔";
}

function renderStudents(){
  const cid=$("studentFilter").value;
  const term=$("studentSearch").value.trim().toLowerCase();

  const list=students.filter(s=>
    (!cid||s.class_id===cid)&&
    (!term||`${s.name} ${s.admission_no||""}`.toLowerCase().includes(term))
  );

  $("studentCards").innerHTML=list.map(s=>
    `<div class="card row">
      <div>
        <b>${esc(s.name)}</b>
        <div class="muted">
          ${esc(classById(s.class_id)?.name||"")}
          · رول ${rollOf(s)}
          · داخلہ ${esc(s.admission_no||"-")}
        </div>
        <div class="muted">${esc(s.father_name||"")}</div>
      </div>
    </div>`
  ).join("")||"کوئی طالب علم نہیں۔";
}

async function addStudent(){
  const cid=$("studentFilter").value||$("diaryClass").value;
  if(!cid)return toast("پہلے کلاس منتخب کریں۔",true);

  const name=prompt("طالب علم کا نام:");
  if(!name?.trim())return;

  const admission=prompt("داخلہ نمبر (اختیاری):")||"";
  const father=prompt("والد کا نام (اختیاری):")||"";
  const whatsapp=prompt("والد یا سرپرست کا واٹس ایپ نمبر، مثلاً 923001234567:")||"";

  try{
    await q(sb.from("students").insert({
      class_id:cid,
      name:name.trim(),
      admission_no:admission.trim(),
      father_name:father.trim(),
      whatsapp_number:whatsapp.replace(/\D/g,""),
      active:true
    }));

    await loadData();
    toast("طالب علم شامل ہوگیا۔");
  }catch(e){fail(e);}
}

function renderDiary(){
  if(!$("diaryDate").value)$("diaryDate").value=today();

  const cid=$("diaryClass").value;
  const list=students.filter(s=>s.class_id===cid);

  $("diaryStudents").innerHTML=list.map(s=>{
    const r=records.find(x=>
      x.student_id===s.id&&x.record_date===$("diaryDate").value
    );

    const owned=!r||r.created_by===user.id||isAdmin();

    return `
      <div class="card" data-student="${s.id}">
        <b>${esc(s.name)} — رول ${rollOf(s)}</b>
        ${r&&!owned
          ?'<div class="status">یہ ریکارڈ دوسرے استاد نے درج کیا ہے؛ صرف پڑھ سکتے ہیں۔</div>'
          :""}
        <div class="record-grid">
          ${field("حاضری","attendance",r?.attendance||"حاضر",owned)}
          ${field("سبق","lesson",r?.lesson||"",owned)}
          ${field("سبق کا معیار","lesson_quality",r?.lesson_quality||"",owned)}
          ${field("سبقی","sabqi",r?.sabqi||"",owned)}
          ${field("سبقی کا معیار","sabqi_quality",r?.sabqi_quality||"",owned)}
          ${field("منزل","manzil",r?.manzil||"",owned)}
          ${field("منزل کا معیار","manzil_quality",r?.manzil_quality||"",owned)}
          ${field("نوٹ","note",r?.note||"",owned)}
        </div>
      </div>`;
  }).join("")||"اس کلاس میں طلبہ موجود نہیں۔";
}

function field(label,key,value,enabled){
  return `
    <div>
      <label>${label}</label>
      ${key==="attendance"
        ?`<select data-key="${key}" ${enabled?"":"disabled"}>
            <option ${value==="حاضر"?"selected":""}>حاضر</option>
            <option ${value==="غیر حاضر"?"selected":""}>غیر حاضر</option>
            <option ${value==="رخصت"?"selected":""}>رخصت</option>
          </select>`
        :`<input data-key="${key}" value="${esc(value)}" ${enabled?"":"disabled"}>`
      }
    </div>`;
}


async function saveDiary(){
  const cid = $("diaryClass").value;
  const date = $("diaryDate").value;

  if(!cid || !date){
    return toast("کلاس اور تاریخ منتخب کریں۔", true);
  }

  if(date > today()){
    return toast("مستقبل کی تاریخ کا ریکارڈ محفوظ نہیں ہو سکتا۔", true);
  }

  let saved = 0;
  let skipped = 0;
  let failed = 0;

  for(const card of document.querySelectorAll("#diaryStudents [data-student]")){
    const sid = card.dataset.student;

    const existing = records.find(r =>
      r.student_id === sid && r.record_date === date
    );

    const vals = {};
    card.querySelectorAll("[data-key]").forEach(el => {
      vals[el.dataset.key] = el.value.trim();
    });

    if(existing && existing.created_by !== user.id && !isAdmin()){
      skipped++;
      continue;
    }

    // نامکمل طالب علم کا ریکارڈ محفوظ نہیں ہوگا
    if(!vals.lesson || !vals.sabqi || !vals.manzil){
      skipped++;
      continue;
    }

    const row = {
      student_id: sid,
      class_id: cid,
      record_date: date,
      created_by: existing?.created_by || user.id,
      ...vals
    };

    if(existing) row.id = existing.id;

    try{
      await q(
        sb.from("daily_records")
          .upsert(row, {onConflict:"student_id,record_date"})
      );
      saved++;
    }catch(e){
      console.error(e);
      failed++;
    }
  }

  if(saved > 0){
    await loadData();
  }

  if(failed > 0){
    toast(`${saved} محفوظ، ${skipped} نامکمل، ${failed} میں خرابی۔`, true);
  }else if(saved > 0){
    toast(`${saved} طلبہ کا ریکارڈ محفوظ ہوگیا۔ ${skipped} نامکمل ریکارڈ چھوڑ دیے گئے۔`);
  }else{
    toast("کوئی مکمل ریکارڈ نہیں ملا۔", true);
  }
}




function showRecords(){
  const date=$("recordDate").value;
  const cid=$("recordClass").value;
  const sid=$("recordStudent").value;

  lastCsv=records.filter(r=>
    (!date||r.record_date===date)&&
    (!cid||r.class_id===cid)&&
    (!sid||r.student_id===sid)
  );

  $("recordResults").innerHTML=lastCsv.map(r=>{
    const s=studentById(r.student_id);
    const phone=(s?.whatsapp_number||"").replace(/\D/g,"");

    return `
      <div class="card">
        <b>${esc(s?.name||"")} — رول ${s?rollOf(s):"-"}</b>
        <div class="muted">${esc(classById(r.class_id)?.name||"")} · ${esc(r.record_date)}</div>

        <p>حاضری: ${esc(r.attendance||"—")}</p>

        <p>
          سبق: ${esc(r.lesson||"—")}
          <strong> | معیار: ${esc(r.lesson_quality||"درج نہیں")}</strong>
        </p>

        <p>
          سبقی: ${esc(r.sabqi||"—")}
          <strong> | معیار: ${esc(r.sabqi_quality||"درج نہیں")}</strong>
        </p>

        <p>
          منزل: ${esc(r.manzil||"—")}
          <strong> | معیار: ${esc(r.manzil_quality||"درج نہیں")}</strong>
        </p>

        <div class="muted">نوٹ: ${esc(r.note||"—")}</div>

        <button
          type="button"
          class="primary-btn"
          data-whatsapp-record="${esc(r.id)}"
          ${phone.length<10?"disabled":""}
        >
          ${phone.length<10?"واٹس ایپ نمبر موجود نہیں":"واٹس ایپ پر ریکارڈ بھیجیں"}
        </button>
      </div>`;
  }).join("")||"کوئی ریکارڈ نہیں ملا۔";

  document.querySelectorAll("[data-whatsapp-record]").forEach(button=>{
    button.onclick=()=>{
      const r=lastCsv.find(x=>x.id===button.dataset.whatsappRecord);
      if(!r)return;

      const s=studentById(r.student_id);
      const phone=(s?.whatsapp_number||"").replace(/\D/g,"");

      if(phone.length<10){
        toast("اس طالب علم کا درست واٹس ایپ نمبر موجود نہیں۔",true);
        return;
      }

      const message=
`السلام علیکم!

طالب علم کا روزانہ تعلیمی ریکارڈ

نام: ${s?.name||"—"}
والد کا نام: ${s?.father_name||"—"}
کلاس: ${classById(r.class_id)?.name||"—"}
تاریخ: ${r.record_date}

حاضری: ${r.attendance||"—"}

سبق: ${r.lesson||"—"}
سبق کا معیار: ${r.lesson_quality||"درج نہیں"}

سبقی: ${r.sabqi||"—"}
سبقی کا معیار: ${r.sabqi_quality||"درج نہیں"}

منزل: ${r.manzil||"—"}
منزل کا معیار: ${r.manzil_quality||"درج نہیں"}

استاد کا نوٹ: ${r.note||"—"}

جامعہ حفظ و ناظرہ ڈیجیٹل مینجمنٹ`;

      const url=`https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
      window.open(url,"_blank");
    };
  });
}


function exportPdf(){
  const rows=lastCsv;

  if(!rows.length){
    toast("پہلے ریکارڈ دکھائیں، پھر PDF بنائیں۔",true);
    return;
  }

  const win=window.open("","_blank");

  if(!win){
    toast("PDF بنانے کے لیے Pop-ups کی اجازت دیں۔",true);
    return;
  }

  const body=rows.map(r=>{
    const s=studentById(r.student_id);
    const cls=classById(r.class_id);

    return `
      <tr>
        <td>${esc(r.record_date)}</td>
        <td>${esc(cls?.name||"")}</td>
        <td>${esc(s?rollOf(s):"-")}</td>
        <td>${esc(s?.name||"")}</td>
        <td>${esc(r.attendance||"—")}</td>
        <td>${esc(r.lesson||"—")}<br><small>${esc(r.lesson_quality||"معیار درج نہیں")}</small></td>
        <td>${esc(r.sabqi||"—")}<br><small>${esc(r.sabqi_quality||"معیار درج نہیں")}</small></td>
        <td>${esc(r.manzil||"—")}<br><small>${esc(r.manzil_quality||"معیار درج نہیں")}</small></td>
        <td>${esc(r.note||"—")}</td>
      </tr>`;
  }).join("");

  win.document.open();

  win.document.write(`
    <!doctype html>
    <html lang="ur" dir="rtl">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <title>جامعہ اشرف العلوم — طلبہ کے ریکارڈز</title>

      <style>
        body{
          font-family:Arial,"Noto Nastaliq Urdu",sans-serif;
          color:#183b30;
          padding:18px;
          direction:rtl;
        }

        h2,p{text-align:center}

        table{
          width:100%;
          border-collapse:collapse;
          font-size:12px;
        }

        th,td{
          border:1px solid #65766d;
          padding:7px;
          text-align:right;
          vertical-align:top;
        }

        th{background:#e8efeb}
        small{color:#42584e}

        .actions{
          text-align:center;
          margin:14px;
        }

        button{
          font:inherit;
          padding:10px 18px;
        }

        @page{
          size:landscape;
          margin:10mm;
        }

        tr{break-inside:avoid}

        @media print{
          .actions{display:none}
          body{padding:0}
        }
      </style>
    </head>

    <body>
      <h2>جامعہ اشرف العلوم باغبانپورہ رجسٹرڈ</h2>
      <p>طلبہ کے روزانہ ریکارڈز</p>
      <p>کل اندراجات: ${rows.length}</p>

      <div class="actions">
        <button onclick="window.print()">PDF محفوظ کریں / پرنٹ کریں</button>
      </div>

      <table>
        <thead>
          <tr>
            <th>تاریخ</th>
            <th>کلاس</th>
            <th>رول</th>
            <th>طالب علم</th>
            <th>حاضری</th>
            <th>سبق / معیار</th>
            <th>سبقی / معیار</th>
            <th>منزل / معیار</th>
            <th>نوٹ</th>
          </tr>
        </thead>

        <tbody>${body}</tbody>
      </table>
    </body>
    </html>
  `);

  win.document.close();
}

async function createClass(){
  const name=$("newClassName").value.trim();
  if(!name)return toast("کلاس کا نام لکھیں۔",true);

  try{
    await q(sb.from("classes").insert({name}));
    $("newClassName").value="";
    await loadData();
    toast("کلاس بن گئی۔");
  }catch(e){fail(e);}
}

async function renderAdmin(){
  const profiles=await q(
    sb.from("profiles").select("*").order("created_at",{ascending:false})
  );

  $("teacherList").innerHTML=profiles.map(p=>
    `<div class="card">
      <b>${esc(p.full_name||p.email||p.id)}</b>
      <span class="muted">${esc(p.email||"")}</span>
      <div class="muted">${esc(p.role)} · ${p.active?"فعال":"غیر فعال"}</div>
      ${p.role!=="admin"
        ?`<button data-approve="${p.id}">${p.active?"غیر فعال کریں":"منظور کریں"}</button>`
        :""}
    </div>`
  ).join("");

  document.querySelectorAll("[data-approve]").forEach(b=>{
    b.onclick=()=>toggleTeacher(
      b.dataset.approve,
      profiles.find(p=>p.id===b.dataset.approve)
    );
  });

  $("adminClasses").innerHTML=classes.map(c=>{
    const assigned=assignments
      .filter(a=>a.class_id===c.id)
      .map(a=>a.profiles)
      .filter(Boolean);

    return `
      <div class="card">
        <b>${esc(c.name)}</b>
        <div class="muted">
          مقرر اساتذہ: ${assigned.map(p=>esc(p.full_name||p.email)).join("، ")||"کوئی نہیں"}
        </div>
        <label>استاد مقرر کریں</label>
        <select data-assign-class="${c.id}">
          <option value="">استاد منتخب کریں</option>
          ${profiles.filter(p=>p.role==="teacher"&&p.active).map(p=>
            `<option value="${p.id}">${esc(p.full_name||p.email)}</option>`
          ).join("")}
        </select>
        <button data-assign="${c.id}">مقرر کریں</button>
        <button class="secondary-btn" data-unassign="${c.id}">اس کلاس کی تمام اسائنمنٹس ختم کریں</button>
      </div>`;
  }).join("");

  document.querySelectorAll("[data-assign]").forEach(b=>{
    b.onclick=()=>assignTeacher(b.dataset.assign);
  });

  document.querySelectorAll("[data-unassign]").forEach(b=>{
    b.onclick=()=>unassignClass(b.dataset.unassign);
  });
}

async function toggleTeacher(id,p){
  try{
    await q(sb.from("profiles").update({active:!p.active}).eq("id",id));
    await renderAdmin();
    toast("استاد کی حیثیت تبدیل ہوگئی۔");
  }catch(e){fail(e);}
}

async function assignTeacher(classId){
  const teacherId=document.querySelector(
    `[data-assign-class="${classId}"]`
  ).value;

  if(!teacherId)return toast("استاد منتخب کریں۔",true);

  try{
    await q(
      sb.from("class_teachers").upsert(
        {class_id:classId,teacher_id:teacherId},
        {onConflict:"class_id,teacher_id"}
      )
    );

    await loadData();
    await renderAdmin();
    toast("کلاس استاد کو الاٹ ہوگئی۔");
  }catch(e){fail(e);}
}

async function unassignClass(classId){
  if(!confirm("کیا اس کلاس کے تمام اساتذہ کی اسائنمنٹ ختم کرنی ہے؟"))return;

  try{
    await q(sb.from("class_teachers").delete().eq("class_id",classId));
    await loadData();
    await renderAdmin();
    toast("اسائنمنٹ ختم ہوگئی۔");
  }catch(e){fail(e);}
}

window.JamiaApp={
  getFilteredRecords:()=>records,
  studentById,
  classById,
  rollOf
};

document.addEventListener("DOMContentLoaded",init);

})();
