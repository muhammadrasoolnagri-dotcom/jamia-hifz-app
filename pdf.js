
(function () {
  function safe(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function makeRows(filtered) {
    const date = document.getElementById('recordDate').value;
    const classId = document.getElementById('recordClass').value;
    const studentId = document.getElementById('recordStudent').value;
    const dates = filtered && date
      ? [date]
      : Object.keys(db.records).sort().reverse();
    const rows = [];

    dates.forEach(function (d) {
      Object.entries(db.records[d] || {}).forEach(function (entry) {
        const id = entry[0];
        const r = entry[1];
        const s = studentById(id);
        if (!s) return;
        if (filtered && classId && s.classId !== classId) return;
        if (filtered && studentId && id !== studentId) return;

        rows.push([
          d,
          (classById(s.classId) || {}).name || '',
          rollOf(s) || '',
          s.name || '',
          r.attendance === 'present' ? 'حاضر' : 'غیر حاضر',
          (r.lesson || '—') + ' / ' + (r.lessonQ || '—'),
          (r.sabqi || '—') + ' / ' + (r.sabqiQ || '—'),
          (r.manzil || '—') + ' / ' + (r.manzilQ || '—'),
          r.note || '—'
        ]);
      });
    });
    return rows;
  }

  function exportPdf(filtered) {
    const rows = makeRows(filtered);
    if (!rows.length) {
      alert('اس انتخاب کے مطابق کوئی ریکارڈ نہیں ملا۔');
      return;
    }

    const win = window.open('', '_blank');
    if (!win) {
      alert('براہ کرم اس ویب سائٹ کے لیے Pop-ups کی اجازت دیں اور دوبارہ کوشش کریں۔');
      return;
    }

    const title = filtered
      ? 'جامعہ حفظ و ناظرہ — منتخب ریکارڈ'
      : 'جامعہ حفظ و ناظرہ — تمام ریکارڈ';

    const tableRows = rows.map(function (r) {
      return '<tr>' + r.map(function (v) {
        return '<td>' + safe(v) + '</td>';
      }).join('') + '</tr>';
    }).join('');

    win.document.open();
    win.document.write(
      '<!doctype html><html lang="ur" dir="rtl"><head>' +
      '<meta charset="UTF-8"><title>' + safe(title) + '</title>' +
      '<style>' +
      'body{font-family:Arial,sans-serif;direction:rtl;padding:15px;color:#111}' +
      'h2{text-align:center;font-size:20px}' +
      'table{width:100%;border-collapse:collapse;font-size:11px}' +
      'th,td{border:1px solid #555;padding:6px;text-align:right;vertical-align:top}' +
      'th{background:#eee}' +
      '@page{size:landscape;margin:10mm}' +
      'tr{break-inside:avoid}' +
      '</style></head><body>' +
      '<h2>' + safe(title) + '</h2>' +
      '<p>کل اندراجات: ' + rows.length + '</p>' +
      '<button onclick="window.print()">PDF محفوظ کریں / پرنٹ کریں</button>' +
      '<table><thead><tr>' +
      '<th>تاریخ</th><th>کلاس</th><th>رول نمبر</th><th>طالب علم</th>' +
      '<th>حاضری</th><th>سبق / معیار</th><th>سبقی / معیار</th>' +
      '<th>منزل / معیار</th><th>نوٹ</th>' +
      '</tr></thead><tbody>' + tableRows +
      '</tbody></table></body></html>'
    );
    win.document.close();
  }

  document.addEventListener('DOMContentLoaded', function () {
    const all = document.getElementById('exportAllPdf');
    const selected = document.getElementById('exportFilteredPdf');

    if (all) {
      all.addEventListener('click', function () {
        exportPdf(false);
      });
    }

    if (selected) {
      selected.addEventListener('click', function () {
        exportPdf(true);
      });
    }
  });
})();
