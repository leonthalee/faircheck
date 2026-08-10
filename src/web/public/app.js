function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

const state = { receipts: [], expandedReceiptIds: new Set(), calendarCursor: startOfMonth(new Date()), splitReceiptId: null };

const filterInput = document.getElementById('filterInput');
const receiptsList = document.getElementById('receiptsList');
const csvFile = document.getElementById('csvFile');
const importBtn = document.getElementById('importBtn');
const importStatus = document.getElementById('importStatus');
const splitReceiptSelect = document.getElementById('splitReceiptSelect');
const sharedTagSelect = document.getElementById('sharedTagSelect');
const participantsFieldset = document.getElementById('participantsFieldset');
const splitBtn = document.getElementById('splitBtn');
const splitResult = document.getElementById('splitResult');
const calendarGrid = document.getElementById('calendarGrid');
const calendarMonthLabel = document.getElementById('calendarMonthLabel');
const calendarPrevBtn = document.getElementById('calendarPrevBtn');
const calendarNextBtn = document.getElementById('calendarNextBtn');
const spendingSummary = document.getElementById('spendingSummary');
const spendingList = document.getElementById('spendingList');
const themeToggle = document.getElementById('themeToggle');

function getSystemTheme() {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  themeToggle.textContent = theme === 'dark' ? '☀️' : '🌙';
}

applyTheme(localStorage.getItem('theme') ?? getSystemTheme());

themeToggle.addEventListener('click', () => {
  const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  localStorage.setItem('theme', next);
  applyTheme(next);
});

function formatDateTime(dateStr) {
  const d = new Date(dateStr);
  const day = d.toLocaleDateString('de-DE');
  const time = d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  return `${day} ${time}`;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

function flash(el) {
  el.classList.add('saved');
  setTimeout(() => el.classList.remove('saved'), 600);
}

function highlightReceipt(el) {
  el.classList.add('jump-highlight');
  setTimeout(() => el.classList.remove('jump-highlight'), 1200);
}

function switchTab(name) {
  document.querySelectorAll('.tab-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.tab === name);
  });
  document.querySelectorAll('.tab').forEach((tab) => {
    tab.classList.toggle('active', tab.id === `tab-${name}`);
  });
  if (name === 'split') populateSplitForm();
  if (name === 'calendar') renderCalendar();
  if (name === 'spending') renderSpending();
}

document.querySelectorAll('.tab-btn').forEach((btn) => {
  btn.addEventListener('click', () => switchTab(btn.dataset.tab));
});

async function fetchReceipts() {
  const res = await fetch('/api/receipts');
  state.receipts = await res.json();
}

function renderReceipts() {
  const filter = filterInput.value.trim().toLowerCase();
  receiptsList.innerHTML = '';

  if (state.receipts.length === 0) {
    receiptsList.innerHTML = '<p class="muted">Noch keine Belege importiert.</p>';
    return;
  }

  for (const receipt of state.receipts) {
    const receiptMatches =
      receipt.store.toLowerCase().includes(filter) ||
      (receipt.label ?? '').toLowerCase().includes(filter);
    const items = receipt.items.filter((item) => {
      if (!filter) return true;
      return receiptMatches || item.name.toLowerCase().includes(filter);
    });
    if (filter && items.length === 0) continue;

    // While filtering, force-expand receipts with matches without touching
    // the user's manual expand/collapse state, so it's restored once the
    // filter is cleared.
    const isExpanded = filter !== '' || state.expandedReceiptIds.has(receipt.id);

    const section = document.createElement('div');
    section.className = 'receipt';
    section.dataset.receiptId = receipt.id;

    const dateTime = formatDateTime(receipt.date);
    section.innerHTML = `
      <div class="receipt-header">
        <button type="button" class="toggle-btn ${isExpanded ? 'expanded' : ''}" data-receipt-id="${escapeHtml(receipt.id)}" aria-label="Artikel ein-/ausklappen">▸</button>
        <div class="receipt-info toggle-btn" data-receipt-id="${escapeHtml(receipt.id)}">
          <strong>${escapeHtml(receipt.label || receipt.store)}</strong>
          ${receipt.label ? `<span class="muted">(${escapeHtml(receipt.store)})</span>` : ''}
          <span class="muted">${dateTime} · ${receipt.items.length} Artikel · ${receipt.amount.toFixed(2)} ${escapeHtml(receipt.currency)}</span>
        </div>
        <div class="receipt-actions">
          <input type="text" class="label-input" data-receipt-id="${escapeHtml(receipt.id)}" placeholder="Eigener Name, z.B. Wocheneinkauf" value="${escapeHtml(receipt.label ?? '')}" />
          <form class="bulk-tag-form" data-receipt-id="${escapeHtml(receipt.id)}">
            <input type="text" placeholder="Tag für alle Items, z.B. gemeinsam" />
            <button type="submit">Allen hinzufügen</button>
          </form>
          <button type="button" class="clear-tags-btn danger" data-receipt-id="${escapeHtml(receipt.id)}">Alle Tags entfernen</button>
          <button type="button" class="split-receipt-btn" data-receipt-id="${escapeHtml(receipt.id)}">Kosten aufteilen</button>
          <button type="button" class="delete-receipt-btn danger" data-receipt-id="${escapeHtml(receipt.id)}">Beleg löschen</button>
        </div>
      </div>
      <table class="items-table ${isExpanded ? '' : 'collapsed'}">
        <thead><tr><th>Artikel</th><th>Preis</th><th>Tags</th></tr></thead>
        <tbody></tbody>
      </table>
    `;

    const tbody = section.querySelector('tbody');
    for (const item of items) {
      const price = item.price !== null ? `${item.price.toFixed(2)} ${escapeHtml(receipt.currency)}` : '–';
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${escapeHtml(item.name)}</td>
        <td>${price}</td>
        <td><input type="text" class="tags-input" data-item-id="${escapeHtml(item.id)}" value="${escapeHtml(item.tags.join(', '))}" /></td>
      `;
      tbody.appendChild(tr);
    }

    receiptsList.appendChild(section);
  }

  receiptsList.querySelectorAll('.tags-input').forEach((input) => {
    input.addEventListener('change', onTagsInputChange);
  });
  receiptsList.querySelectorAll('.bulk-tag-form').forEach((form) => {
    form.addEventListener('submit', onBulkTagSubmit);
  });
  receiptsList.querySelectorAll('.clear-tags-btn').forEach((button) => {
    button.addEventListener('click', onClearReceiptTags);
  });
  receiptsList.querySelectorAll('.toggle-btn').forEach((el) => {
    el.addEventListener('click', onToggleReceipt);
  });
  receiptsList.querySelectorAll('.label-input').forEach((input) => {
    input.addEventListener('change', onLabelInputChange);
  });
  receiptsList.querySelectorAll('.delete-receipt-btn').forEach((button) => {
    button.addEventListener('click', onDeleteReceipt);
  });
  receiptsList.querySelectorAll('.split-receipt-btn').forEach((button) => {
    button.addEventListener('click', onSplitReceiptClick);
  });
}

function onSplitReceiptClick(event) {
  state.splitReceiptId = event.currentTarget.dataset.receiptId;
  switchTab('split');
}

function groupReceiptsByDay(receipts) {
  const map = new Map(); // key: "YYYY-M-D" (lokal) -> Receipt[]
  for (const receipt of receipts) {
    const d = new Date(receipt.date);
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(receipt);
  }
  return map;
}

function renderCalendar() {
  const cursor = state.calendarCursor;
  const year = cursor.getFullYear();
  const month = cursor.getMonth();

  calendarMonthLabel.textContent = cursor.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });

  const grouped = groupReceiptsByDay(state.receipts);

  const firstOfMonth = new Date(year, month, 1);
  const firstWeekday = (firstOfMonth.getDay() + 6) % 7; // 0=Mo..6=So
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const totalCells = Math.ceil((firstWeekday + daysInMonth) / 7) * 7;

  const today = new Date();
  const todayKey = `${today.getFullYear()}-${today.getMonth()}-${today.getDate()}`;

  calendarGrid.innerHTML = '';

  for (let i = 0; i < totalCells; i++) {
    const dayNum = i - firstWeekday + 1;
    const cellDate = new Date(year, month, dayNum); // JS normalisiert Über-/Unterlauf automatisch in Nachbarmonate
    const isOtherMonth = cellDate.getMonth() !== month;
    const key = `${cellDate.getFullYear()}-${cellDate.getMonth()}-${cellDate.getDate()}`;
    const dayReceipts = grouped.get(key) ?? [];

    const cell = document.createElement('div');
    cell.className = 'calendar-day';
    if (isOtherMonth) cell.classList.add('other-month');
    if (key === todayKey) cell.classList.add('today');
    if (dayReceipts.length > 0) cell.classList.add('has-receipts');

    const names = dayReceipts.slice(0, 2).map((r) => escapeHtml(r.label || r.store)).join(', ');
    const extra = dayReceipts.length > 2 ? ` +${dayReceipts.length - 2}` : '';

    cell.innerHTML = `
      <span class="calendar-day-num">${cellDate.getDate()}</span>
      ${dayReceipts.length > 0 ? `
        <span class="calendar-day-marker">
          <span class="calendar-dot"></span>
          <span class="calendar-day-summary">${names}${extra}</span>
        </span>
      ` : ''}
    `;

    if (dayReceipts.length > 0) {
      cell.dataset.receiptIds = dayReceipts.map((r) => r.id).join(',');
      cell.addEventListener('click', onCalendarDayClick);
    }

    calendarGrid.appendChild(cell);
  }
}

function onCalendarDayClick(event) {
  const ids = event.currentTarget.dataset.receiptIds.split(',');
  for (const id of ids) state.expandedReceiptIds.add(id);

  filterInput.value = '';
  renderReceipts();
  switchTab('items');

  const target = receiptsList.querySelector(`.receipt[data-receipt-id="${CSS.escape(ids[0])}"]`);
  if (target) {
    target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    highlightReceipt(target);
  }
}

function groupReceiptsByMonth(receipts) {
  const map = new Map(); // key: "YYYY-M" (lokal) -> { year, month, total, count }
  for (const receipt of receipts) {
    const d = new Date(receipt.date);
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    if (!map.has(key)) map.set(key, { year: d.getFullYear(), month: d.getMonth(), total: 0, count: 0 });
    const entry = map.get(key);
    entry.total += receipt.amount;
    entry.count += 1;
  }
  return map;
}

function renderSpending() {
  if (state.receipts.length === 0) {
    spendingSummary.innerHTML = '';
    spendingList.innerHTML = '<p class="muted">Noch keine Belege importiert.</p>';
    return;
  }

  const grouped = [...groupReceiptsByMonth(state.receipts).values()].sort(
    (a, b) => a.year - b.year || a.month - b.month,
  );

  const grandTotal = grouped.reduce((sum, m) => sum + m.total, 0);
  spendingSummary.innerHTML = `
    <p>Gesamt: <strong>${formatOwed(grandTotal)} EUR</strong> über ${grouped.length} Monat(e), ${state.receipts.length} Beleg(e)</p>
  `;

  const maxAbs = Math.max(...grouped.map((m) => Math.abs(m.total)), 0.01);

  spendingList.innerHTML = grouped
    .map((m) => {
      const label = new Date(m.year, m.month, 1).toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });
      const pct = (Math.abs(m.total) / maxAbs) * 100;
      return `
        <div class="spending-row">
          <span class="spending-month">${escapeHtml(label)}</span>
          <div class="spending-bar-track"><div class="spending-bar-fill" style="width: ${pct}%"></div></div>
          <span class="spending-amount">${formatOwed(m.total)} EUR</span>
          <span class="spending-count muted">${m.count} Beleg(e)</span>
        </div>
      `;
    })
    .join('');
}

async function onDeleteReceipt(event) {
  const button = event.target;
  const receiptId = button.dataset.receiptId;

  if (!confirm('Diesen Beleg wirklich komplett löschen? Alle Items und Tags gehen verloren. Das lässt sich nicht rückgängig machen.')) return;

  button.disabled = true;
  try {
    const res = await fetch(`/api/receipts/${encodeURIComponent(receiptId)}`, {
      method: 'DELETE',
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? 'Fehler beim Löschen');
    await fetchReceipts();
    renderReceipts();
  } catch (err) {
    alert('Fehler: ' + err.message);
  } finally {
    button.disabled = false;
  }
}

async function onLabelInputChange(event) {
  const input = event.target;
  const receiptId = input.dataset.receiptId;
  const label = input.value.trim();
  input.disabled = true;

  try {
    const res = await fetch(`/api/receipts/${encodeURIComponent(receiptId)}/label`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? 'Fehler beim Speichern');
    await fetchReceipts();
    renderReceipts();
  } catch (err) {
    alert('Fehler: ' + err.message);
  } finally {
    input.disabled = false;
  }
}

function onToggleReceipt(event) {
  const receiptId = event.currentTarget.dataset.receiptId;
  if (state.expandedReceiptIds.has(receiptId)) {
    state.expandedReceiptIds.delete(receiptId);
  } else {
    state.expandedReceiptIds.add(receiptId);
  }
  renderReceipts();
}

async function onTagsInputChange(event) {
  const input = event.target;
  const itemId = input.dataset.itemId;
  const tags = input.value
    .split(',')
    .map((tag) => tag.trim())
    .filter((tag) => tag !== '');
  input.value = tags.join(', ');
  input.disabled = true;

  try {
    const res = await fetch(`/api/items/${encodeURIComponent(itemId)}/tags`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tags }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? 'Fehler beim Speichern');
    flash(input);
  } catch (err) {
    alert('Fehler: ' + err.message);
  } finally {
    input.disabled = false;
  }
}

async function onBulkTagSubmit(event) {
  event.preventDefault();
  const form = event.target;
  const receiptId = form.dataset.receiptId;
  const input = form.querySelector('input');
  const tags = input.value
    .split(',')
    .map((tag) => tag.trim())
    .filter((tag) => tag !== '');
  if (tags.length === 0) return;

  const button = form.querySelector('button');
  button.disabled = true;

  try {
    const res = await fetch(`/api/receipts/${encodeURIComponent(receiptId)}/tags`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tags }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? 'Fehler beim Speichern');
    await fetchReceipts();
    renderReceipts();
  } catch (err) {
    alert('Fehler: ' + err.message);
  } finally {
    button.disabled = false;
  }
}

async function onClearReceiptTags(event) {
  const button = event.target;
  const receiptId = button.dataset.receiptId;

  if (!confirm('Wirklich ALLE Tags von allen Items dieses Belegs entfernen?')) return;

  button.disabled = true;
  try {
    const res = await fetch(`/api/receipts/${encodeURIComponent(receiptId)}/tags`, {
      method: 'DELETE',
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? 'Fehler beim Entfernen');
    await fetchReceipts();
    renderReceipts();
  } catch (err) {
    alert('Fehler: ' + err.message);
  } finally {
    button.disabled = false;
  }
}

filterInput.addEventListener('input', renderReceipts);

calendarPrevBtn.addEventListener('click', () => {
  state.calendarCursor.setMonth(state.calendarCursor.getMonth() - 1);
  renderCalendar();
});
calendarNextBtn.addEventListener('click', () => {
  state.calendarCursor.setMonth(state.calendarCursor.getMonth() + 1);
  renderCalendar();
});

sharedTagSelect.addEventListener('change', renderParticipantOptions);
splitReceiptSelect.addEventListener('change', () => {
  state.splitReceiptId = splitReceiptSelect.value || null;
  renderSplitChoices();
});

importBtn.addEventListener('click', async () => {
  const file = csvFile.files[0];
  if (!file) {
    importStatus.textContent = 'Bitte zuerst eine CSV-Datei auswählen.';
    return;
  }

  importStatus.textContent = 'Importiere...';
  importBtn.disabled = true;

  try {
    const text = await file.text();
    const res = await fetch('/api/import', {
      method: 'POST',
      headers: { 'Content-Type': 'text/csv' },
      body: text,
    });
    const receipts = await res.json();
    if (!res.ok) throw new Error(receipts.error ?? 'Import fehlgeschlagen');

    state.receipts = receipts;
    const itemCount = receipts.reduce((sum, r) => sum + r.items.length, 0);
    importStatus.textContent = `Importiert: ${receipts.length} Beleg(e), ${itemCount} Artikel.`;
    renderReceipts();
    switchTab('items');
  } catch (err) {
    importStatus.textContent = 'Fehler: ' + err.message;
  } finally {
    importBtn.disabled = false;
  }
});

function describeReceiptOption(receipt) {
  const name = receipt.label ? `${receipt.label} (${receipt.store})` : receipt.store;
  return `${formatDateTime(receipt.date)} ${name} — ${receipt.amount.toFixed(2)} ${receipt.currency}`;
}

function collectTagsForScope(receiptId) {
  const scoped = receiptId ? state.receipts.filter((r) => r.id === receiptId) : state.receipts;
  const counts = new Map();
  for (const receipt of scoped) {
    for (const item of receipt.items) {
      for (const tag of item.tags) {
        counts.set(tag, (counts.get(tag) ?? 0) + 1);
      }
    }
  }
  return counts;
}

function populateSplitForm() {
  splitReceiptSelect.innerHTML =
    '<option value="">Alle Belege</option>' +
    state.receipts
      .map((r) => `<option value="${escapeHtml(r.id)}">${escapeHtml(describeReceiptOption(r))}</option>`)
      .join('');
  splitReceiptSelect.value = state.splitReceiptId ?? '';

  renderSplitChoices();
}

function renderSplitChoices() {
  const receiptId = splitReceiptSelect.value;
  const counts = collectTagsForScope(receiptId);
  const tags = [...counts.entries()].map(([tag, count]) => ({ tag, count })).sort((a, b) => b.count - a.count);

  if (tags.length === 0) {
    sharedTagSelect.innerHTML = '';
    participantsFieldset.innerHTML = '<legend>Personen-Tags</legend><p class="muted">Noch keine Tags vergeben.</p>';
    return;
  }

  sharedTagSelect.innerHTML = tags
    .map((t) => `<option value="${escapeHtml(t.tag)}">${escapeHtml(t.tag)} (${t.count})</option>`)
    .join('');

  participantsFieldset.innerHTML =
    '<legend>Personen-Tags</legend>' +
    tags
      .map(
        (t) => `
        <label class="checkbox-label">
          <input type="checkbox" value="${escapeHtml(t.tag)}" />
          ${escapeHtml(t.tag)} (${t.count})
        </label>
      `,
      )
      .join('');

  renderParticipantOptions();
}

function renderParticipantOptions() {
  const sharedTag = sharedTagSelect.value;
  participantsFieldset.querySelectorAll('input[type="checkbox"]').forEach((checkbox) => {
    const label = checkbox.closest('label');
    if (checkbox.value === sharedTag) {
      checkbox.checked = false;
      label.style.display = 'none';
    } else {
      label.style.display = '';
    }
  });
}

function formatOwed(signed) {
  return (-signed).toFixed(2);
}

function renderSplitResult(result) {
  const scopeLabel = splitReceiptSelect.value
    ? splitReceiptSelect.options[splitReceiptSelect.selectedIndex].textContent
    : 'Alle Belege';
  let html = `
    <p class="muted">Für: ${escapeHtml(scopeLabel)}</p>
    <div class="split-summary">
      <p>Gemeinsame Kosten ("${escapeHtml(result.sharedTag)}"): <strong>${formatOwed(result.sharedTotal)} EUR</strong></p>
      <p>Anteil pro Person (${result.participants.length}): <strong>${formatOwed(result.perPersonShared)} EUR</strong></p>
    </div>
    <table class="split-table">
      <thead><tr><th>Person</th><th>Eigene Artikel</th><th>Anteil gemeinsam</th><th>Gesamt</th></tr></thead>
      <tbody>
        ${result.participants
          .map(
            (p) => `
          <tr>
            <td>${escapeHtml(p)}</td>
            <td>${formatOwed(result.individualTotals[p] ?? 0)} EUR</td>
            <td>${formatOwed(result.perPersonShared)} EUR</td>
            <td><strong>${formatOwed(result.finalTotals[p] ?? 0)} EUR</strong></td>
          </tr>
        `,
          )
          .join('')}
      </tbody>
    </table>
  `;

  if (result.unassigned.length > 0) {
    const preview = result.unassigned.slice(0, 20);
    html += `
      <div class="warning">
        <p>Achtung: ${result.unassigned.length} Artikel haben weder "${escapeHtml(result.sharedTag)}" noch einen Personen-Tag (nicht berücksichtigt):</p>
        <ul>${preview.map((i) => `<li>${escapeHtml(i.name)} (${i.price !== null ? i.price.toFixed(2) : '–'})</li>`).join('')}</ul>
        ${result.unassigned.length > 20 ? `<p>... und ${result.unassigned.length - 20} weitere</p>` : ''}
      </div>
    `;
  }

  splitResult.innerHTML = html;
}

splitBtn.addEventListener('click', async () => {
  const sharedTag = sharedTagSelect.value;
  const participants = [...participantsFieldset.querySelectorAll('input:checked')].map((cb) => cb.value);
  const receiptId = splitReceiptSelect.value || undefined;

  if (!sharedTag) {
    splitResult.innerHTML = '<p class="muted">Kein Tag verfügbar. Erst taggen.</p>';
    return;
  }
  if (participants.length === 0) {
    splitResult.innerHTML = '<p class="muted">Mindestens eine Person auswählen.</p>';
    return;
  }

  const res = await fetch('/api/split', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sharedTag, participants, receiptId }),
  });
  const result = await res.json();
  if (!res.ok) {
    splitResult.innerHTML = `<p class="muted">Fehler: ${escapeHtml(result.error ?? 'unbekannt')}</p>`;
    return;
  }

  renderSplitResult(result);
});

async function init() {
  await fetchReceipts();
  renderReceipts();
  if (state.receipts.length > 0) switchTab('items');
}

init();
