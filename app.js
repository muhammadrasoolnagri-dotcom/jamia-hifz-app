const KEY='jamiaHifzManagerV2';
let db=loadDb();

function loadDb(){
 try{return JSON.parse(localStorage.getItem(KEY))||{classes:[],students:[],records:{}}}
 catch(e){return {classes:[],students:[],records:{}}}
}
function saveDb(){
 localStorage.setItem(KEY,JSON.stringify(db));
 renderAll();
}
function uid(){return 'x'+Date.now().toString(36)+Math.random().toString(36).slice(2,7)}
function esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function today(){
 let d=new Date();
 return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function classById(id){return db.classes.find(c=>c.id===id)}
function studentById(id){return db.students.find(s=>s.id===id)}
function showPage(id){
 document.querySelectorAll('.page').forEach(p=>p.classList.add('hidden'));
 document.getElementById(id).classList.remove('hidden');
 document.querySelectorAll('#tabs button').forEach(b=>b.classList.toggle('active',b.dataset.page===id));
 if(id==='diary')renderDiaryForm();
 if(id==='records')renderRecordFilters();
 window.scrollTo({top:0,behavior:'smooth'});
}
document.querySelectorAll('#tabs button').forEach(b=>b.addEventListener('click',()=>showPage(b.dataset.page)));

document.getElementById('classForm').addEventListener('submit',e=>{
 e.preventDefault();
 let name=document.getElementById('className').value.trim();
 let teacher=document.getElementById('teacherName').value.trim();
 if(db.classes.some(c=>c.name.toLowerCase()===name.toLowerCase())){
  alert('اس نام کی کلاس پہلے موجود ہے۔');return;
 }
 db.classes.push({id:uid(),name,teacher,createdAt:today()});
 e.target.reset();saveDb();alert('کلاس محفوظ ہوگئی۔');
});

document.getElementById('studentForm').addEventListener('submit',e=>{
 e.preventDefault();
 let name=document.getElementById('studentName').value.trim();
 let classId=document.getElementById('studentClass').value;
 if(!classId){alert('پہلے کلاس شامل کریں۔');return}
 db.students.push({
  id:uid(),name,classId,
  admissionNo:document.getElementById('admissionNo').value.trim(),
  fatherName:document.getElementById('fatherName').value.trim(),
  notes:document.getElementById('studentNotes').value.trim(),
  createdAt:today(),createdOrder:Date.now()
 });
 e.target.reset();saveDb();alert('طالب علم محفوظ ہوگیا۔');
});

function classStudents(classId){
 return db.students.filter(s=>s.classId===classId)
 .sort((a,b)=>(a.createdOrder||0)-(b.createdOrder||0));
}
function rollOf(student){
 return classStudents(student.classId).findIndex(s=>s.id===student.id)+1;
}
function renderSelects(){
 let opts='<option value="">کلاس منتخب کریں</option>'+
 db.classes.map(c=>`<option value="${c.id}">${esc(c.name)} — استاد: ${esc(c.teacher)}</option>`).join('');
 ['studentClass','diaryClass','recordClass'].forEach(id=>{
  let el=document.getElementById(id),old=el.value;el.innerHTML=opts;
  if(db.classes.some(c=>c.id===old))el.value=old;
 });
 let filter=document.getElementById('studentFilter'),oldf=filter.value;
 filter.innerHTML='<option value="">تمام کلاسیں</option>'+
 db.classes.map(c=>`<option value="${c.id}">${esc(c.name)}</option>`).join('');
 if(db.classes.some(c=>c.id===oldf))filter.value=oldf;
}
function renderClasses(){
 let el=document.getElementById('classList');
 if(!db.classes.length){el.innerHTML='<div class="empty">ابھی کوئی کلاس شامل نہیں۔</div>';return}
 el.innerHTML=db.classes.map(c=>`<div class="item"><div class="info"><b>${esc(c.name)}</b><div class="muted">استاد: ${esc(c.teacher)} • طلبہ: ${classStudents(c.id).length}</div></div><button class="secondary" onclick="editClass('${c.id}')">استاد تبدیل</button><button class="danger" onclick="deleteClass('${c.id}')">حذف</button></div>`).join('');
}
function editClass(id){
 let c=classById(id),t=prompt('استاد کا نیا نام:',c.teacher);
 if(t&&t.trim()){c.teacher=t.trim();saveDb()}
}
function deleteClass(id){
 if(db.students.some(s=>s.classId===id)){alert('اس کلاس میں طلبہ موجود ہیں۔ پہلے طلبہ کو منتقل یا حذف کریں۔');return}
 if(confirm('کیا یہ کلاس حذف کرنی ہے؟')){db.classes=db.classes.filter(c=>c.id!==id);saveDb()}
}
function renderStudents(){
 let filter=document.getElementById('studentFilter').value;
 let arr=db.students.filter(s=>!filter||s.classId===filter);
 let el=document.getElementById('studentList');
 if(!arr.length){el.innerHTML='<div class="empty">کوئی طالب علم موجود نہیں۔</div>';return}
 el.innerHTML=arr.map(s=>{
  let c=classById(s.classId);
  return `<div class="item"><div class="info"><b>${esc(s.name)}</b><div class="muted">${esc(c?.name||'')} • رول نمبر: ${rollOf(s)} • استاد: ${esc(c?.teacher||'')}</div></div>
  <button onclick="openProfile('${s.id}')">ذاتی ریکارڈ</button>
  <button class="secondary" onclick="moveStudent('${s.id}')">کلاس تبدیل</button>
  <button class="danger" onclick="deleteStudent('${s.id}')">حذف</button></div>`;
 }).join('');
}
document.getElementById('studentFilter').addEventListener('change',renderStudents);

function moveStudent(id){
 let s=studentById(id),choices=db.classes.filter(c=>c.id!==s.classId);
 if(!choices.length){alert('دوسری کلاس پہلے شامل کریں۔');return}
 let text=choices.map((c,i)=>`${i+1}. ${c.name}`).join('\n');
 let n=prompt('نئی کلاس کا نمبر لکھیں:\n'+text);
 if(n===null)return;
 let c=choices[Number(n)-1];
 if(!c){alert('درست نمبر منتخب کریں۔');return}
 if(confirm(`${s.name} کو ${c.name} میں منتقل کریں؟`)){s.classId=c.id;saveDb()}
}
function deleteStudent(id){
 let s=studentById(id);
 if(!confirm(`${s.name} اور اس کا آزمائشی ریکارڈ حذف کرنا ہے؟`))return;
 db.students=db.students.filter(x=>x.id!==id);
 Object.keys(db.records).forEach(date=>{
  delete db.records[date][id];
  if(!Object.keys(db.records[date]).length)delete db.records[date];
 });
 saveDb();
}

function renderDiaryForm(){
 let cid=document.getElementById('diaryClass').value;
 let date=document.getElementById('diaryDate').value||today();
 let el=document.getElementById('diaryStudents');
 if(!document.getElementById('diaryDate').value)document.getElementById('diaryDate').value=today();
 if(!cid){el.innerHTML='<div class="empty">پہلے کلاس شامل کریں اور منتخب کریں۔</div>';return}
 let arr=classStudents(cid);
 if(!arr.length){el.innerHTML='<div class="empty">اس کلاس میں طلبہ شامل نہیں۔</div>';return}
 el.innerHTML=`<div class="muted">کلاس: ${esc(classById(cid).name)} • استاد: ${esc(classById(cid).teacher)}</div>
 <div class="table-wrap"><table><thead><tr><th>رول</th><th>طالب علم</th><th>حاضری</th><th>نیا سبق / معیار</th><th>سبقی / معیار</th><th>منزل / معیار</th><th>نوٹ</th></tr></thead><tbody>
 ${arr.map(s=>{
  let r=db.records[date]?.[s.id]||{};
  return `<tr data-student="${s.id}">
  <td>${rollOf(s)}</td><td><button class="secondary" onclick="openProfile('${s.id}')">${esc(s.name)}</button></td>
  <td class="attendance"><label><input type="radio" name="att_${s.id}" value="present" ${(r.attendance||'present')==='present'?'checked':''}> حاضر</label><label><input type="radio" name="att_${s.id}" value="absent" ${r.attendance==='absent'?'checked':''}> غیر حاضر</label></td>
  <td><input data-field="lesson" placeholder="سبق" value="${esc(r.lesson||'')}"><select data-field="lessonQ">${qualityOptions(r.lessonQ)}</select></td>
  <td><input data-field="sabqi" placeholder="سبقی" value="${esc(r.sabqi||'')}"><select data-field="sabqiQ">${qualityOptions(r.sabqiQ)}</select></td>
  <td><input data-field="manzil" placeholder="منزل" value="${esc(r.manzil||'')}"><select data-field="manzilQ">${qualityOptions(r.manzilQ)}</select></td>
  <td><input data-field="note" placeholder="نوٹ" value="${esc(r.note||'')}"></td></tr>`;
 }).join('')}</tbody></table></div>`;
 arr.forEach(s=>{
  let r=db.records[date]?.[s.id],tr=el.querySelector(`tr[data-student="${s.id}"]`);
  if(r)['lessonQ','sabqiQ','manzilQ'].forEach(f=>{if(r[f])tr.querySelector(`[data-field="${f}"]`).value=r[f]});
 });
}
function qualityOptions(selected){
 return '<option value="">معیار منتخب کریں</option>'+
 ['بہترین','اچھا','درمیانہ','کمزور'].map(q=>`<option value="${q}" ${selected===q?'selected':''}>${q}</option>`).join('');
}
document.getElementById('diaryClass').addEventListener('change',renderDiaryForm);
document.getElementById('diaryDate').addEventListener('change',renderDiaryForm);
document.getElementById('saveDiary').addEventListener('click',()=>{
 let cid=document.getElementById('diaryClass').value,date=document.getElementById('diaryDate').value;
 if(!cid){alert('پہلے کلاس منتخب کریں۔');return}
 if(!db.records[date])db.records[date]={};
 let rows=[...document.querySelectorAll('#diaryStudents tbody tr')];
 if(!rows.length){alert('اس کلاس میں طلبہ موجود نہیں۔');return}
 for(let tr of rows){
  let sid=tr.dataset.student;
  let attendance=tr.querySelector(`input[name="att_${sid}"]:checked`)?.value;
  if(!attendance){alert('ہر طالب علم کی حاضری منتخب کریں۔');return}
  let val=f=>tr.querySelector(`[data-field="${f}"]`)?.value.trim()||'';
  db.records[date][sid]={
   attendance,lesson:val('lesson'),lessonQ:val('lessonQ'),
   sabqi:val('sabqi'),sabqiQ:val('sabqiQ'),
   manzil:val('manzil'),manzilQ:val('manzilQ'),
   note:val('note'),classId:cid,teacher:classById(cid).teacher,
   savedAt:new Date().toISOString()
  };
 }
 saveDb();alert('پوری کلاس کا ریکارڈ محفوظ ہوگیا۔');
});

function openProfile(id){
 let s=studentById(id);if(!s)return;
 showPage('profile');
 let c=classById(s.classId),entries=[];
 Object.keys(db.records).sort().forEach(date=>{let r=db.records[date]?.[id];if(r)entries.push({date,...r})});
 let present=entries.filter(r=>r.attendance==='present').length;
 let weak=entries.filter(r=>[r.lessonQ,r.sabqiQ,r.manzilQ].includes('کمزور')).length;
 document.getElementById('profileContent').innerHTML=`
 <h2>${esc(s.name)}</h2><p>${esc(c?.name||'')} • رول نمبر ${rollOf(s)||'—'} • استاد ${esc(c?.teacher||'—')}</p>
 <div class="stats"><div class="stat"><b>${entries.length}</b>درج شدہ دن</div><div class="stat"><b>${present}</b>حاضر دن</div><div class="stat"><b>${weak}</b>کمزور معیار کے اندراج</div></div>
 <div class="panel"><h3>ذاتی معلومات</h3><p>داخلہ نمبر: ${esc(s.admissionNo||'—')}</p><p>والد کا نام: ${esc(s.fatherName||'—')}</p><p>نوٹس: ${esc(s.notes||'—')}</p></div>
 <h3>روزانہ تاریخچہ</h3>
 ${entries.length?`<div class="table-wrap"><table><thead><tr><th>تاریخ</th><th>حاضری</th><th>سبق / معیار</th><th>سبقی / معیار</th><th>منزل / معیار</th><th>نوٹ</th></tr></thead><tbody>${entries.reverse().map(r=>`<tr><td>${esc(r.date)}</td><td>${r.attendance==='present'?'حاضر':'غیر حاضر'}</td><td>${esc(r.lesson||'—')} / ${esc(r.lessonQ||'—')}</td><td>${esc(r.sabqi||'—')} / ${esc(r.sabqiQ||'—')}</td><td>${esc(r.manzil||'—')} / ${esc(r.manzilQ||'—')}</td><td>${esc(r.note||'—')}</td></tr>`).join('')}</tbody></table></div>`:'<div class="empty">ابھی کوئی روزانہ ریکارڈ نہیں۔</div>'}`;
}

function renderRecordFilters(){
 let cid=document.getElementById('recordClass').value,sel=document.getElementById('recordStudent'),old=sel.value;
 sel.innerHTML='<option value="">تمام طلبہ</option>'+
 db.students.filter(s=>!cid||s.classId===cid).map(s=>`<option value="${s.id}">${esc(s.name)} — رول ${rollOf(s)}</option>`).join('');
 if(db.students.some(s=>s.id===old))sel.value=old;
 if(!document.getElementById('recordDate').value)document.getElementById('recordDate').value=today();
}
document.getElementById('recordClass').addEventListener('change',renderRecordFilters);
document.getElementById('showRecords').addEventListener('click',()=>{
 let date=document.getElementById('recordDate').value,cid=document.getElementById('recordClass').value,sid=document.getElementById('recordStudent').value;
 let dates=date?[date]:Object.keys(db.records).sort().reverse(),rows=[];
 dates.forEach(d=>Object.entries(db.records[d]||{}).forEach(([id,r])=>{
  let s=studentById(id);
  if(s&&(!cid||s.classId===cid)&&(!sid||id===sid))rows.push({date:d,s,r});
 }));
 document.getElementById('recordResults').innerHTML=rows.length?`<div class="table-wrap"><table><thead><tr><th>تاریخ</th><th>کلاس</th><th>رول</th><th>طالب علم</th><th>حاضری</th><th>سبق</th><th>سبقی</th><th>منزل</th></tr></thead><tbody>${rows.map(x=>`<tr><td>${esc(x.date)}</td><td>${esc(classById(x.s.classId)?.name||'')}</td><td>${rollOf(x.s)}</td><td><button class="secondary" onclick="openProfile('${x.s.id}')">${esc(x.s.name)}</button></td><td>${x.r.attendance==='present'?'حاضر':'غیر حاضر'}</td><td>${esc(x.r.lesson||'—')} / ${esc(x.r.lessonQ||'—')}</td><td>${esc(x.r.sabqi||'—')} / ${esc(x.r.sabqiQ||'—')}</td><td>${esc(x.r.manzil||'—')} / ${esc(x.r.manzilQ||'—')}</td></tr>`).join('')}</tbody></table></div>`:'<div class="empty">اس انتخاب کے مطابق ریکارڈ نہیں ملا۔</div>';
});
function csvDownload(filename,rows){
 let csv=rows.map(row=>row.map(v=>'"'+String(v??'').replace(/"/g,'""')+'"').join(',')).join('\r\n');
 let blob=new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8;'});
 let url=URL.createObjectURL(blob),a=document.createElement('a');
 a.href=url;a.download=filename;a.click();URL.revokeObjectURL(url);
}
document.getElementById('exportCsv').addEventListener('click',()=>{
 let rows=[['تاریخ','کلاس','رول نمبر','طالب علم','حاضری','سبق','سبق معیار','سبقی','سبقی معیار','منزل','منزل معیار','نوٹ']];
 Object.keys(db.records).sort().forEach(d=>Object.entries(db.records[d]||{}).forEach(([id,r])=>{
  let s=studentById(id);
  if(s)rows.push([d,classById(s.classId)?.name||'',rollOf(s),s.name,r.attendance==='present'?'حاضر':'غیر حاضر',r.lesson,r.lessonQ,r.sabqi,r.sabqiQ,r.manzil,r.manzilQ,r.note]);
 }));
 csvDownload('jamia-daily-records.csv',rows);
});
function renderHome(){
 document.getElementById('stats').innerHTML=`
 <div class="stat"><b>${db.classes.length}</b>کلاسیں</div>
 <div class="stat"><b>${db.classes.length}</b>مقررہ اساتذہ</div>
 <div class="stat"><b>${db.students.length}</b>کل طلبہ</div>
 <div class="stat"><b>${Object.values(db.records).reduce((n,r)=>n+Object.keys(r).length,0)}</b>روزانہ اندراجات</div>`;
 let r=db.records[today()]||{},ids=Object.keys(r);
 let p=ids.filter(id=>r[id].attendance==='present').length,a=ids.filter(id=>r[id].attendance==='absent').length;
 document.getElementById('todaySummary').innerHTML=ids.length?`آج کے اندراج: <b>${ids.length}</b> • حاضر: <b>${p}</b> • غیر حاضر: <b>${a}</b>`:'آج ابھی کوئی ریکارڈ محفوظ نہیں ہوا۔';
}
function renderAll(){
  renderSelects();
  renderClasses();
  renderStudents();
  renderHome();
  renderDiaryForm();
  renderRecordFilters();
}

document.getElementById('diaryDate').value = today();
document.getElementById('recordDate').value = today();

renderAll();
