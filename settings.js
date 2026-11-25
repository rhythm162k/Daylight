const profileKey = 'daylight:profile';
const defaultRoutine = {wake: '07:00', bed: '23:00', commitments: [], activities: []};
const noPrayer = {mode: 'none', title: '', entries: []};

function readProfile() {
  try {
    const profile = JSON.parse(localStorage.getItem(profileKey));
    if (profile?.prayer && (profile.legacy || profile.routine)) return profile;
    const hasProgress = Object.keys(localStorage).some(key =>
      /^daylight:(\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/\d{4})$/.test(key));
    if (hasProgress || localStorage.getItem(prayerPreferenceKey)) {
      return {legacy: true, prayer: {...noPrayer, mode: 'salah'}};
    }
  } catch {}
  return null;
}

function initializeSettings(profile, onSave) {
  const get = id => document.getElementById(id);
  const dialog = get('settings-dialog');
  const form = get('settings-form');
  const error = get('settings-error');
  const activityRows = get('activity-settings');
  const commitmentRows = get('commitment-settings');
  const prayerRows = get('prayer-settings-rows');
  const mode = get('prayer-mode');
  const custom = get('custom-prayer-settings');
  let trigger;

  function fields(id, label, markup, values) {
    const row = document.createElement('fieldset');
    row.className = 'settings-row';
    row.dataset.id = id || (globalThis.crypto.randomUUID?.() ?? Math.random().toString(36).slice(2));
    row.innerHTML = '<legend>' + label + '</legend>' + markup +
      '<button type="button" class="icon-button remove-row" aria-label="Remove ' + label.toLowerCase() + '" title="Remove ' + label.toLowerCase() + '">' +
      '<svg aria-hidden="true"><use href="#icon-remove" /></svg></button>';
    for (const [name, value] of Object.entries(values)) {
      row.querySelector('[data-field="' + name + '"]').value = value ?? '';
    }
    const remove = row.querySelector('.remove-row');
    remove.addEventListener('click', () => {
      const target = row.nextElementSibling?.querySelector('input') ||
        row.previousElementSibling?.querySelector('input') ||
        row.parentElement.nextElementSibling;
      row.remove();
      target.focus();
    });
    return row;
  }

  function activityRow(entry = {}) {
    return fields(entry.id, 'Activity', `
      <div class="settings-grid">
        <label>Activity name <input data-field="name" required maxlength="80" placeholder="e.g. Study" /></label>
        <label>Minutes <input data-field="minutes" type="number" min="1" max="1440" required /></label>
        <label class="wide">Session type
          <span class="settings-select">
            <select data-field="type">
              <option value="split">Split across the day</option>
              <option value="single">One session with short breaks</option>
            </select>
          </span>
        </label>
      </div>`, {name: entry.name, minutes: entry.minutes, type: entry.split === false ? 'single' : 'split'});
  }

  function commitmentRow(entry = {}) {
    const row = fields(entry.id, 'Commitment', `
      <div class="settings-grid">
        <label class="wide">Commitment name <input data-field="name" required maxlength="80" placeholder="e.g. Work or commute" /></label>
        <label>Starts <input data-field="start" type="time" required /></label>
        <label>Ends <input data-field="end" type="time" required /></label>
      </div>
      <fieldset class="day-options">
        <legend>Repeats on</legend>
        <div>${weekdays.map((day, index) =>
          `<label><input type="checkbox" value="${index}" />${day}</label>`).join('')}</div>
      </fieldset>`, {name: entry.name, start: entry.start, end: entry.end});
    for (const input of row.querySelectorAll('[type="checkbox"]')) {
      input.checked = !entry.days || entry.days.includes(Number(input.value));
    }
    return row;
  }

  function prayerRow(entry = {}) {
    const row = fields(entry.id, 'Prayer or practice', `
      <div class="settings-grid">
        <label class="wide">Name <input data-field="name" required maxlength="80" placeholder="e.g. Evening prayer" /></label>
        <label>Time (optional) <input data-field="time" type="time" /></label>
        <label>Minutes <input data-field="minutes" type="number" min="1" max="1440" /></label>
      </div>`, {name: entry.name, time: entry.time, minutes: entry.minutes || 10});
    const time = row.querySelector('[data-field="time"]');
    const minutes = row.querySelector('[data-field="minutes"]');
    function updateTime() {
      minutes.disabled = !time.value;
      minutes.required = Boolean(time.value);
    }
    time.addEventListener('input', updateTime);
    updateTime();
    return row;
  }

  function bindAdd(id, container, makeRow) {
    get(id).addEventListener('click', () => {
      const row = makeRow();
      container.append(row);
      row.querySelector('input').focus();
    });
  }
  bindAdd('add-activity', activityRows, activityRow);
  bindAdd('add-commitment', commitmentRows, commitmentRow);
  bindAdd('add-prayer', prayerRows, prayerRow);

  function updateMode() {
    custom.disabled = mode.value !== 'custom';
    custom.hidden = custom.disabled;
    if (!custom.disabled && !prayerRows.children.length) prayerRows.append(prayerRow());
  }
  mode.addEventListener('change', updateMode);

  function open(scope, button) {
    trigger = button;
    const firstRun = !profile;
    const routineSection = get('routine-settings');
    const prayerSection = get('prayer-settings');
    routineSection.hidden = routineSection.disabled = scope === 'prayer';
    prayerSection.hidden = prayerSection.disabled = scope === 'routine';
    get('settings-title').textContent = firstRun ? 'Set up your day' :
      {routine: 'Edit routine', prayer: 'Prayer settings', all: 'Settings'}[scope];
    const intro = get('settings-intro');
    intro.textContent = firstRun ? 'Add what you want to do each day. Daylight will find time around your commitments.' :
      profile.legacy && scope !== 'prayer' ? 'To switch from your existing weekly schedule to a generated plan, select “Replace my current routine.”' : '';
    intro.hidden = !intro.textContent;
    get('save-settings').textContent = firstRun ? 'Create my plan' : 'Save settings';
    const routine = profile?.routine || defaultRoutine;
    get('wake-time').value = routine.wake;
    get('bed-time').value = routine.bed;
    commitmentRows.replaceChildren(...routine.commitments.map(commitmentRow));
    activityRows.replaceChildren(...routine.activities.map(activityRow));
    const prayer = profile?.prayer || noPrayer;
    mode.value = prayer.mode;
    get('custom-prayer-title').value = prayer.title || 'Prayer';
    prayerRows.replaceChildren(...prayer.entries.map(prayerRow));
    if (firstRun) activityRows.append(activityRow());
    updateMode();
    error.hidden = true;
    dialog.showModal();
  }

  function values(row) {
    return Object.fromEntries([...row.querySelectorAll('[data-field]')].map(input =>
      [input.dataset.field, input.value.trim()]));
  }

  function showError(message, field) {
    error.textContent = message;
    error.hidden = false;
    field?.focus();
  }

  form.addEventListener('submit', event => {
    event.preventDefault();
    error.hidden = true;
    const next = {...profile};
    if (!get('routine-settings').disabled && (!profile?.legacy || get('use-custom-routine').checked)) {
      const wake = get('wake-time').value;
      const bed = get('bed-time').value;
      if (wake === bed) return showError('Choose a different bedtime and wake time.', get('bed-time'));
      const commitments = [];
      for (const row of commitmentRows.children) {
        const {name, start, end} = values(row);
        const days = [...row.querySelectorAll(':checked')].map(input => Number(input.value));
        if (!name) return showError('Enter a commitment name.', row.querySelector('[data-field="name"]'));
        if (start === end) return showError('Choose a different end time for ' + name + '.', row.querySelector('[data-field="end"]'));
        if (!days.length) return showError('Select at least one day for ' + name + '.', row.querySelector('[type="checkbox"]'));
        commitments.push({id: row.dataset.id, name, start, end, days});
      }
      const activities = [];
      for (const row of activityRows.children) {
        const {name, minutes, type} = values(row);
        if (!name) return showError('Enter an activity name.', row.querySelector('[data-field="name"]'));
        activities.push({id: row.dataset.id, name, minutes: Number(minutes), split: type === 'split'});
      }
      next.routine = {wake, bed, commitments, activities};
      next.legacy = false;
    }

    if (!get('prayer-settings').disabled) {
      const prayer = {...(profile?.prayer || noPrayer), mode: mode.value};
      if (mode.value === 'custom') {
        prayer.title = get('custom-prayer-title').value.trim();
        if (!prayer.title) return showError('Enter a title for your prayer section.', get('custom-prayer-title'));
        if (!prayerRows.children.length) return showError('Add at least one prayer or practice.', get('add-prayer'));
        prayer.entries = [];
        for (const row of prayerRows.children) {
          const {name, time, minutes} = values(row);
          if (!name) return showError('Enter a name for each prayer or practice.', row.querySelector('[data-field="name"]'));
          prayer.entries.push({id: row.dataset.id, name, time, minutes: time ? Number(minutes) : 0});
        }
      }
      next.prayer = prayer;
    }

    try {
      localStorage.setItem(profileKey, JSON.stringify(next));
    } catch {
      return showError('Your browser couldn’t save your settings. Check that browser storage is available.');
    }
    profile = next;
    dialog.close();
    onSave(next);
  });

  const conversion = get('use-custom-routine');
  function show(scope, button) {
    conversion.parentElement.hidden = !profile?.legacy;
    conversion.checked = false;
    get('routine-fields').disabled = Boolean(profile?.legacy);
    open(scope, button);
  }
  conversion.addEventListener('change', () => {
    get('routine-fields').disabled = !conversion.checked;
  });
  get('cancel-settings').addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => {
    const fallback = get('settings-button');
    (trigger?.getClientRects().length ? trigger : fallback).focus();
  });
  for (const [id, scope] of [['settings-button', 'all'], ['edit-routine', 'routine'], ['edit-prayer', 'prayer']]) {
    const button = get(id);
    button.addEventListener('click', () => show(scope, button));
  }
  if (!profile) show('all');
}
