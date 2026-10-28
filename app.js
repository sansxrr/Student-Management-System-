const seedStudents = [
  { prn: 'PRN101', name: 'Aarav', className: 'SE-A', attendance: 92, marks: [90, 90, 90], order: 1 },
  { prn: 'PRN102', name: 'Diya', className: 'SE-A', attendance: 95, marks: [95, 95, 95], order: 2 },
  { prn: 'PRN103', name: 'Kabir', className: 'SE-A', attendance: 88, marks: [95, 95, 95], order: 3 },
  { prn: 'PRN104', name: 'Meera', className: 'SE-A', attendance: 79, marks: [70, 65, 80], order: 4 },
  { prn: 'PRN105', name: 'Rohan', className: 'SE-A', attendance: 83, marks: [38, 72, 68], order: 5 },
];

const storageKey = 'fieldnote-student-records-v1';
const palette = [
  ['#e8eee8', '#46644f'], ['#edf0e4', '#6c7546'], ['#e9eff2', '#4d7083'],
  ['#f5ece7', '#98674f'], ['#e9edf3', '#5b6785'], ['#f1ecef', '#806070'],
];
const pageCopy = {
  students: ['Students', 'Student records', 'A considered view of the class, one record at a time.'],
  merit: ['Merit list', 'Merit list', 'Recognition, ranked by aggregate across all three subjects.'],
  reports: ['Class report', 'Class report', 'A clear read on class performance and outcomes.'],
  revaluation: ['Revaluation', 'Revaluation candidates', 'Students with a subject mark close to the passing threshold.'],
};

let students = loadStudents();
let activeView = 'students';
let toastTimeout;

const $ = (selector) => document.querySelector(selector);
const rows = $('#student-rows');
const searchInput = $('#search-input');
const sortSelect = $('#sort-select');
const classFilter = $('#class-filter');
const dialog = $('#student-dialog');
const form = $('#student-form');

function loadStudents() {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey));
    if (Array.isArray(saved) && saved.every(isValidStudent)) return saved;
  } catch { /* Use the sample cohort when browser storage is unavailable. */ }
  return seedStudents.map((student) => ({ ...student, marks: [...student.marks] }));
}

function isValidStudent(student) {
  return student && typeof student.prn === 'string' && typeof student.name === 'string'
    && typeof student.className === 'string' && Number.isFinite(student.attendance)
    && Array.isArray(student.marks) && student.marks.length === 3
    && student.marks.every(Number.isFinite);
}

function persist() {
  try {
    localStorage.setItem(storageKey, JSON.stringify(students));
    $('.live-indicator').innerHTML = '<i></i> Changes saved locally';
  } catch {
    $('.live-indicator').innerHTML = '<i></i> Browser storage unavailable';
  }
}

function total(student) { return student.marks.reduce((sum, mark) => sum + mark, 0); }
function average(student) { return total(student) / 3; }
function passed(student) { return student.marks.every((mark) => mark >= 40); }
function isReviewCandidate(student) { return student.marks.some((mark) => mark >= 35 && mark <= 39); }
function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
}

function sortedStudents(list) {
  const sortBy = activeView === 'merit' ? 'aggregate' : sortSelect.value;
  return [...list].sort((a, b) => {
    if (sortBy === 'name') return a.name.localeCompare(b.name) || a.order - b.order;
    if (sortBy === 'attendance') return b.attendance - a.attendance || a.order - b.order;
    return total(b) - total(a) || a.order - b.order;
  });
}

function visibleStudents() {
  const query = searchInput.value.trim().toLowerCase();
  return sortedStudents(students.filter((student) => {
    const matchesText = !query || student.name.toLowerCase().includes(query) || student.prn.toLowerCase().includes(query);
    const matchesClass = classFilter.value === 'all' || student.className === classFilter.value;
    const matchesView = activeView !== 'revaluation' || isReviewCandidate(student);
    return matchesText && matchesClass && matchesView;
  }));
}

function renderMetrics() {
  const passingCount = students.filter(passed).length;
  const candidateCount = students.filter(isReviewCandidate).length;
  const classAverage = students.length ? students.reduce((sum, student) => sum + average(student), 0) / students.length : 0;
  $('#metric-enrolled').textContent = String(students.length).padStart(2, '0');
  $('#metric-average').textContent = classAverage.toFixed(2);
  $('#metric-pass').textContent = String(students.length ? Math.round((passingCount / students.length) * 100) : 0);
  $('#metric-pass-count').textContent = `${passingCount} of ${students.length} students`;
  $('#metric-review').textContent = String(candidateCount).padStart(2, '0');
  $('#nav-count').textContent = String(students.length).padStart(2, '0');
  $('#reval-count').textContent = String(candidateCount).padStart(2, '0');
  const uniqueClasses = [...new Set(students.map((student) => student.className))].sort();
  const selectedClass = classFilter.value;
  classFilter.innerHTML = '<option value="all">All classes</option>' + uniqueClasses.map((className) => `<option value="${escapeHtml(className)}">${escapeHtml(className)}</option>`).join('');
  classFilter.value = uniqueClasses.includes(selectedClass) ? selectedClass : 'all';
  const yearTotal = students.reduce((sum, student) => sum + total(student), 0);
  $('#insight-text').innerHTML = students.length
    ? `<strong>Class insight</strong> · ${passingCount} of ${students.length} students pass all three subjects; ${yearTotal.toLocaleString()} total marks recorded.`
    : '<strong>Class insight</strong> · Add the first student record to begin tracking class outcomes.';
}

function renderRows() {
  const visible = visibleStudents();
  const caption = activeView === 'merit' ? 'Ranked by aggregate · ties retain entry order'
    : activeView === 'revaluation' ? 'Showing marks from 35–39 in any subject'
      : `Sorted by ${sortSelect.options[sortSelect.selectedIndex].text.toLowerCase()}${sortSelect.value === 'aggregate' ? ' · highest first' : sortSelect.value === 'attendance' ? ' · highest first' : ' · A to Z'}`;
  $('#table-caption').textContent = caption;
  $('#record-count').textContent = `${String(visible.length).padStart(2, '0')} ${visible.length === 1 ? 'record' : 'records'}`;
  $('#showing-count').textContent = visible.length;
  $('#total-count').textContent = students.length;
  $('#empty-state').hidden = visible.length !== 0;
  rows.innerHTML = visible.map((student, index) => {
    const [background, foreground] = palette[student.order % palette.length];
    const initials = student.name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
    const rank = activeView === 'merit' ? `<small class="rank-label">RANK ${String(index + 1).padStart(2, '0')}</small>` : '';
    const scores = student.marks.map((mark) => `<span class="score${mark < 40 ? ' is-low' : ''}">${mark}</span>`).join('');
    return `<tr style="animation-delay:${Math.min(index, 8) * 25}ms">
      <td><div class="student-cell"><span class="student-avatar" style="--avatar-bg:${background};--avatar-ink:${foreground}">${escapeHtml(initials)}</span><span class="student-copy"><strong>${escapeHtml(student.name)}</strong><small>${escapeHtml(student.prn)}${rank ? ` · ${rank}` : ''}</small></span></div></td>
      <td>${escapeHtml(student.className)}</td>
      <td><div class="attendance-cell"><span class="attendance-number">${student.attendance.toFixed(1)}%</span><span class="attendance-track"><i style="width:${student.attendance}%"></i></span></div></td>
      <td><div class="scores">${scores}</div></td>
      <td class="total-cell">${total(student)}<span style="color:#a5aea6;font-weight:400"> / 300</span></td>
      <td class="average-cell">${average(student).toFixed(2)}%</td>
      <td><span class="result-pill ${passed(student) ? 'result-pass' : 'result-fail'}">${passed(student) ? 'PASS' : 'FAIL'}</span></td>
      <td><div class="row-actions"><button class="row-action" type="button" data-action="edit" data-prn="${escapeHtml(student.prn)}" title="Edit ${escapeHtml(student.name)}" aria-label="Edit ${escapeHtml(student.name)}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14 5 5 5M4 20l4.4-.9L19 8.5 15.5 5 4.9 15.6 4 20Z"/></svg></button><button class="row-action delete" type="button" data-action="delete" data-prn="${escapeHtml(student.prn)}" title="Delete ${escapeHtml(student.name)}" aria-label="Delete ${escapeHtml(student.name)}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M10 11v6m4-6v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg></button></div></td>
    </tr>`;
  }).join('');
}

function render() {
  const [breadcrumb, title, subtitle] = pageCopy[activeView];
  $('#breadcrumb-current').textContent = breadcrumb;
  $('#page-title').innerHTML = `${title}<span class="title-period">.</span>`;
  $('#page-subtitle').textContent = subtitle;
  $('#table-heading').textContent = activeView === 'students' ? 'Class register' : pageCopy[activeView][1];
  $('#merit-link').hidden = activeView === 'merit';
  document.querySelectorAll('.nav-link').forEach((button) => button.classList.toggle('is-active', button.dataset.view === activeView));
  renderMetrics();
  renderRows();
}

function showToast(message) {
  const toast = $('#toast');
  toast.textContent = message;
  toast.classList.add('is-visible');
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => toast.classList.remove('is-visible'), 2600);
}

function openDialog(student = null) {
  form.reset();
  $('#dialog-error').textContent = '';
  $('#editing-prn').value = student?.prn ?? '';
  $('#dialog-title').textContent = student ? 'Edit student' : 'Add student';
  $('#submit-student').textContent = student ? 'Save changes' : 'Add record';
  $('#field-prn').value = student?.prn ?? '';
  $('#field-prn').readOnly = Boolean(student);
  $('#field-name').value = student?.name ?? '';
  $('#field-class').value = student?.className ?? '';
  $('#field-attendance').value = student?.attendance ?? '';
  student?.marks.forEach((mark, index) => { $(`#field-mark-${index + 1}`).value = mark; });
  dialog.showModal();
  (student ? $('#field-name') : $('#field-prn')).focus();
}

function saveStudent(event) {
  event.preventDefault();
  if (!form.reportValidity()) return;
  const editingPrn = $('#editing-prn').value;
  const prn = $('#field-prn').value.trim();
  const existing = students.find((student) => student.prn.toLowerCase() === prn.toLowerCase());
  if (existing && existing.prn !== editingPrn) {
    $('#dialog-error').textContent = 'That PRN is already assigned to another student.';
    $('#field-prn').focus();
    return;
  }
  const record = {
    prn,
    name: $('#field-name').value.trim(),
    className: $('#field-class').value.trim(),
    attendance: Number($('#field-attendance').value),
    marks: [1, 2, 3].map((number) => Number($(`#field-mark-${number}`).value)),
    order: editingPrn ? students.find((student) => student.prn === editingPrn).order : Math.max(0, ...students.map((student) => student.order)) + 1,
  };
  if (editingPrn) students = students.map((student) => student.prn === editingPrn ? record : student);
  else students.push(record);
  persist();
  render();
  dialog.close();
  showToast(editingPrn ? 'Student record updated.' : 'Student added to the class register.');
}

function exportCsv() {
  const headers = ['PRN', 'Name', 'Class', 'Attendance', 'Subject 1', 'Subject 2', 'Subject 3', 'Total', 'Percentage', 'Result'];
  const lines = students.map((student) => [student.prn, student.name, student.className, student.attendance, ...student.marks, total(student), average(student).toFixed(2), passed(student) ? 'PASS' : 'FAIL']);
  const csv = [headers, ...lines].map((line) => line.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(',')).join('\r\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = 'student-records.csv';
  link.click();
  URL.revokeObjectURL(url);
  showToast('Student records exported as CSV.');
}

document.querySelectorAll('.nav-link').forEach((button) => button.addEventListener('click', () => {
  activeView = button.dataset.view;
  searchInput.value = '';
  classFilter.value = 'all';
  render();
}));
$('#add-button').addEventListener('click', () => openDialog());
$('#merit-link').addEventListener('click', () => { activeView = 'merit'; render(); });
$('#export-button').addEventListener('click', exportCsv);
$('#close-dialog').addEventListener('click', () => dialog.close());
$('#cancel-dialog').addEventListener('click', () => dialog.close());
form.addEventListener('submit', saveStudent);
searchInput.addEventListener('input', renderRows);
sortSelect.addEventListener('change', renderRows);
classFilter.addEventListener('change', renderRows);
rows.addEventListener('click', (event) => {
  const button = event.target.closest('button[data-action]');
  if (!button) return;
  const student = students.find((record) => record.prn === button.dataset.prn);
  if (!student) return;
  if (button.dataset.action === 'edit') openDialog(student);
  if (button.dataset.action === 'delete' && window.confirm(`Delete ${student.name} (${student.prn}) from the class register?`)) {
    students = students.filter((record) => record.prn !== student.prn);
    persist();
    render();
    showToast('Student record deleted.');
  }
});
document.addEventListener('keydown', (event) => {
  if (event.key === '/' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) {
    event.preventDefault();
    searchInput.focus();
  }
});

$('#today-date').textContent = new Intl.DateTimeFormat('en', { weekday: 'short', month: 'short', day: '2-digit', year: 'numeric' }).format(new Date());
persist();
render();