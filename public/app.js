// This file must sit in Laravel's public/ folder so it shares the origin of the API.
const API = '/api';
const START_HOUR = 7, END_HOUR = 21, ROW = 44;
const $ = s => document.querySelector(s);
let rooms = [], room = null;

async function api(path, opts = {}) {
  const res = await fetch(API + path, {
    ...opts,
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' }
  });
  let data = null;
  try { data = await res.json(); } catch {}
  if (!res.ok) {
    const first = data && data.errors ? Object.values(data.errors)[0][0] : null;
    throw new Error(first || (data && data.message) || 'Request failed (' + res.status + ')');
  }
  return data;
}

function show(el, text, ok) {
  el.hidden = false;
  el.className = 'msg ' + (ok ? 'ok' : 'err');
  el.textContent = text;
}
const esc = s => String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const today = () => {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
};
const mins = t => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };

// True if bookings cover the whole 07:00-21:00 window with no gaps.
function dayIsFull(list) {
  let covered = START_HOUR * 60;
  const sorted = [...list].sort((a, b) => mins(a.starts_at) - mins(b.starts_at));
  for (const b of sorted) {
    const s = mins(b.starts_at), e = mins(b.ends_at);
    if (s > covered) return false; // gap before this booking
    covered = Math.max(covered, e);
    if (covered >= END_HOUR * 60) return true;
  }
  return covered >= END_HOUR * 60;
}

async function loadRooms() {
  try {
    rooms = await api('/rooms');
  } catch (e) {
    $('#rooms').innerHTML = '<p class="msg err">Could not reach the API. Start it with php artisan serve and open this page from http://127.0.0.1:8000/rooms.html</p>';
    $('#roomTitle').textContent = 'No connection';
    return;
  }
  if (!rooms.length) { $('#roomTitle').textContent = 'No rooms yet'; $('#rooms').innerHTML = '<p class="empty" style="padding:10px">Add a room to begin.</p>'; return; }
  if (!room || !rooms.find(r => r.id === room.id)) room = rooms[0];
  renderRooms();
  loadRoom();
}

function renderRooms() {
  $('#rooms').innerHTML = rooms.map(r =>
    `<button class="room" data-id="${r.id}" aria-current="${room && room.id === r.id}">
       <b>${esc(r.name)} <span class="status" id="st${r.id}">…</span></b>
       <small>${esc(r.location)} · seats ${r.capacity}</small>
     </button>`).join('');
  document.querySelectorAll('.room').forEach(b => b.onclick = () => {
    room = rooms.find(r => r.id == b.dataset.id);
    renderRooms(); loadRoom();
  });
  const viewedDay = $('#date').value || today();
  rooms.forEach(async r => {
    const el = $('#st' + r.id);
    if (!el) return;
    try {
      const [current, dayList] = await Promise.all([
        api('/rooms/' + r.id + '/current'),
        api('/rooms/' + r.id + '/schedule/' + viewedDay)
      ]);
      if (current.occupied) {
        el.textContent = 'In use';
        el.className = 'status busy';
      } else if (dayIsFull(dayList)) {
        el.textContent = 'Full';
        el.className = 'status full';
      } else {
        el.textContent = 'Free';
        el.className = 'status free';
      }
    } catch {}
  });
}

function loadRoom() {
  $('#roomTitle').textContent = room.name;
  $('#roomMeta').textContent = room.location + ' · seats ' + room.capacity;
  loadDay();
  loadUpcoming();
}

async function loadDay() {
  const day = $('#date').value;
  const tl = $('#timeline');
  let html = '';
  for (let h = START_HOUR; h < END_HOUR; h++) {
    html += `<div class="hour" data-h="${h}" style="top:${(h - START_HOUR) * ROW}px"><span>${String(h).padStart(2, '0')}:00</span></div>`;
  }
  let list = [];
  try { list = await api('/rooms/' + room.id + '/schedule/' + day); } catch (e) { tl.innerHTML = html; $('#dayEmpty').hidden = false; $('#dayEmpty').textContent = e.message; return; }
  list.forEach(b => {
    const top = Math.max(0, (mins(b.starts_at) - START_HOUR * 60) * ROW / 60);
    const end = Math.min((END_HOUR - START_HOUR) * ROW, (mins(b.ends_at) - START_HOUR * 60) * ROW / 60);
    html += `<div class="block" data-id="${b.id}" data-title="${esc(b.title)}" data-by="${esc(b.booked_by)}"
        data-start="${b.starts_at}" data-end="${b.ends_at}" data-day="${day}"
        style="top:${top}px;height:${Math.max(24, end - top - 2)}px">
      <button class="del" data-id="${b.id}" title="Delete booking">×</button>
      <b>${esc(b.title)}</b>${esc(b.booked_by)} · ${b.starts_at}–${b.ends_at}</div>`;
  });
  tl.innerHTML = html;

  tl.querySelectorAll('.del').forEach(btn => btn.onclick = ev => {
    ev.stopPropagation();
    deleteBooking(btn.dataset.id);
  });

  tl.querySelectorAll('.block').forEach(el => el.onclick = () => editBooking({
    id: el.dataset.id, title: el.dataset.title, booked_by: el.dataset.by,
    day: el.dataset.day, start: el.dataset.start, end: el.dataset.end
  }));

  tl.querySelectorAll('.hour').forEach(el => el.onclick = () => {
    const h = +el.dataset.h;
    startNewBooking(day, String(h).padStart(2, '0') + ':00', String(h + 1).padStart(2, '0') + ':00');
  });

  const full = dayIsFull(list);
  $('#dayEmpty').hidden = list.length > 0 && !full;
  $('#dayEmpty').textContent = full
    ? 'This day is fully booked.'
    : 'No bookings on this day. Click an hour to start a booking, or click a booking to edit it.';
  if (list.length === 0) $('#dayEmpty').hidden = false;
}

async function loadUpcoming() {
  const ul = $('#upcoming');
  try {
    const list = await api('/rooms/' + room.id + '/upcoming');
    ul.innerHTML = list.length ? list.map(b => {
      const s = String(b.starts_at).replace('T', ' '), e = String(b.ends_at).replace('T', ' ');
      return `<li>
        <span class="when">${s.slice(0, 10)} ${s.slice(11, 16)}–${e.slice(11, 16)}</span>
        <span><b>${esc(b.title)}</b><br>${esc(b.booked_by)}</span>
        <button class="edit" data-id="${b.id}" data-title="${esc(b.title)}" data-by="${esc(b.booked_by)}"
          data-day="${s.slice(0, 10)}" data-start="${s.slice(11, 16)}" data-end="${e.slice(11, 16)}">Edit</button>
        <button class="del" data-id="${b.id}" title="Delete booking">×</button>
      </li>`;
    }).join('') : '<li class="empty">Nothing coming up for this room.</li>';
    ul.querySelectorAll('.del').forEach(btn => btn.onclick = () => deleteBooking(btn.dataset.id));
    ul.querySelectorAll('.edit').forEach(btn => btn.onclick = () => editBooking({
      id: btn.dataset.id, title: btn.dataset.title, booked_by: btn.dataset.by,
      day: btn.dataset.day, start: btn.dataset.start, end: btn.dataset.end
    }));
  } catch (e) { ul.innerHTML = '<li class="empty">' + esc(e.message) + '</li>'; }
}

function startNewBooking(day, start, end) {
  const f = $('#bookForm');
  f.reset();
  f.bookingId.value = '';
  f.day.value = day; f.start.value = start; f.end.value = end;
  $('#formTitle').textContent = 'Book this room';
  $('#formSubmit').textContent = 'Book room';
  $('#formCancel').hidden = true;
  f.title.focus();
}

function editBooking(b) {
  const f = $('#bookForm');
  f.bookingId.value = b.id;
  f.title.value = b.title;
  f.booked_by.value = b.booked_by;
  f.day.value = b.day; f.start.value = b.start; f.end.value = b.end;
  $('#formTitle').textContent = 'Edit booking';
  $('#formSubmit').textContent = 'Update booking';
  $('#formCancel').hidden = false;
  f.title.focus();
}

async function deleteBooking(id) {
  if (!confirm('Delete this booking?')) return;
  try {
    await api('/bookings/' + id, { method: 'DELETE' });
    if ($('#bookForm').bookingId.value === id) startNewBooking($('#date').value, '09:00', '10:00');
    loadDay(); loadUpcoming(); renderRooms();
  } catch (e) { alert(e.message); }
}

$('#date').value = today();
$('#bookForm').day.value = today();
$('#date').onchange = () => { loadDay(); renderRooms(); };
$('#formCancel').onclick = () => startNewBooking($('#date').value, '09:00', '10:00');

$('#bookForm').onsubmit = async ev => {
  ev.preventDefault();
  const f = ev.target, msg = $('#bookMsg');
  const id = f.bookingId.value;

  if (mins(f.start.value) < mins('07:00') || mins(f.end.value) > mins('21:00')) {
    show(msg, 'Bookings must be between 07:00 and 21:00.', false);
    return;
  }

  const payload = {
    room_id: room.id,
    title: f.title.value,
    booked_by: f.booked_by.value,
    starts_at: f.day.value + ' ' + f.start.value + ':00',
    ends_at: f.day.value + ' ' + f.end.value + ':00'
  };
  try {
    if (id) {
      await api('/bookings/' + id, { method: 'PATCH', body: JSON.stringify(payload) });
      show(msg, 'Booking updated.', true);
    } else {
      await api('/bookings', { method: 'POST', body: JSON.stringify(payload) });
      show(msg, 'Room booked.', true);
    }
    $('#date').value = f.day.value;
    startNewBooking(f.day.value, f.start.value, f.end.value);
    loadDay(); loadUpcoming(); renderRooms();
  } catch (e) { show(msg, e.message, false); }
};

$('#roomForm').onsubmit = async ev => {
  ev.preventDefault();
  const f = ev.target, msg = $('#roomMsg');
  try {
    const created = await api('/rooms', {
      method: 'POST',
      body: JSON.stringify({ name: f.name.value, capacity: +f.capacity.value, location: f.location.value })
    });
    show(msg, 'Room added.', true);
    f.reset();
    room = created;
    loadRooms();
  } catch (e) { show(msg, e.message, false); }
};

loadRooms();