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
  const activitySearch = get('activity-search');
  const activityResults = get('activity-results');
  const activitySearchStatus = get('activity-search-status');
  const commitmentRows = get('commitment-settings');
  const prayerRows = get('prayer-settings-rows');
  const mode = get('prayer-mode');
  const custom = get('custom-prayer-settings');
  const fit = get('settings-fit');
  const save = get('save-settings');
  let existingActivities;
  let confirmedFit;
  let trigger;

  function resetFit() {
    confirmedFit = undefined;
    fit.hidden = true;
    save.textContent = profile ? 'Save settings' : 'Create my plan';
  }
  form.addEventListener('input', event => {
    if (event.target !== activitySearch) resetFit();
  });

  function fields(id, label, markup, values, onDelete) {
    const row = document.createElement('fieldset');
    row.className = 'settings-row';
    row.dataset.id = id || (globalThis.crypto.randomUUID?.() ?? Math.random().toString(36).slice(2));
    row.innerHTML = '<legend>' + label + '</legend>' + markup +
      '<button type="button" class="icon-button remove-row" aria-label="Delete ' + label.toLowerCase() + '" title="Delete ' + label.toLowerCase() + '">' +
      '<svg aria-hidden="true"><use href="#icon-delete" /></svg></button>';
    for (const [name, value] of Object.entries(values)) {
      row.querySelector('[data-field="' + name + '"]').value = value ?? '';
    }
    const remove = row.querySelector('.remove-row');
    remove.addEventListener('click', () => {
      if (onDelete) return onDelete(row.dataset.id);
      const target = row.nextElementSibling?.querySelector('input') ||
        row.previousElementSibling?.querySelector('input') ||
        row.parentElement.nextElementSibling;
      row.remove();
      resetFit();
      target.focus();
    });
    return row;
  }

  function activityRow(entry = {}) {
    const row = fields(entry.id, 'Activity', `
      <div class="settings-grid">
        <label>Activity name <input data-field="name" required maxlength="80" placeholder="e.g. Study" /></label>
        <label>Minutes <input data-field="minutes" type="number" min="1" max="1440" required /></label>
        <label class="wide">Frequency
          <span class="settings-select">
            <select data-field="frequency">
              <option value="daily">Every day</option>
              <option value="weekly">Selected weekdays</option>
              <option value="today">Today only</option>
            </select>
          </span>
        </label>
        <label class="wide">Session type
          <span class="settings-select">
            <select data-field="type">
              ${entry.source ? '<option value="original">Original session</option>' : ''}
              <option value="split">Split across the day</option>
              <option value="single">One session with short breaks</option>
            </select>
          </span>
        </label>
      </div>
      <p>A single session includes a 5-minute break after every 30 minutes of activity.</p>
      ${weekdayFields()}
      <p class="one-time-date" hidden></p>
      ${entry.weeklyMinutes?.some(minutes => minutes !== entry.minutes)
        ? '<p class="original-duration">Some days use the original duration until you edit the minutes.</p>' : ''}`, {
      name: entry.name, minutes: entry.minutes,
      type: entry.source && entry.originalSession !== false ? 'original' : entry.split === false ? 'single' : 'split',
      frequency: entry.date ? 'today' : entry.days ? 'weekly' : 'daily',
    }, deleteActivity);
    const days = row.querySelector('.day-options');
    const date = row.querySelector('.one-time-date');
    const frequency = row.querySelector('[data-field="frequency"]');
    if (entry.date) {
      frequency.querySelector('[value="today"]').textContent = 'One time';
      date.textContent = entry.date;
    }
    for (const input of days.querySelectorAll('input')) input.checked = entry.days?.includes(Number(input.value)) ?? false;
    function updateFrequency() {
      days.hidden = days.disabled = frequency.value !== 'weekly';
      date.hidden = !entry.date || frequency.value !== 'today';
    }
    frequency.addEventListener('change', updateFrequency);
    updateFrequency();
    return row;
  }

  function findActivityRow(id) {
    return [...activityRows.children].find(row => row.dataset.id === id);
  }

  function deleteActivity(id) {
    existingActivities.delete(id);
    findActivityRow(id)?.remove();
    resetFit();
    renderActivityResults();
    activitySearch.focus();
  }

  function renderActivityResults() {
    const query = activitySearch.value.trim().toLocaleLowerCase();
    activityResults.replaceChildren();
    if (query) {
      for (const entry of existingActivities.values()) {
        const draft = findActivityRow(entry.id);
        const name = draft?.querySelector('[data-field="name"]').value.trim() || entry.name;
        if (!name.toLocaleLowerCase().includes(query)) continue;
        const result = document.createElement('li');
        result.innerHTML = `<strong></strong><div class="activity-actions">
          <button type="button" class="icon-button" title="Edit activity">
            <svg aria-hidden="true"><use href="#icon-edit" /></svg>
          </button>
          <button type="button" class="icon-button" title="Delete activity">
            <svg aria-hidden="true"><use href="#icon-delete" /></svg>
          </button>
        </div>`;
        result.querySelector('strong').textContent = name;
        const [edit, remove] = result.querySelectorAll('button');
        edit.setAttribute('aria-label', `Edit ${name}`);
        remove.setAttribute('aria-label', `Delete ${name}`);
        edit.addEventListener('click', () => {
          let row = findActivityRow(entry.id);
          if (!row) row = activityRows.appendChild(activityRow(entry));
          row.querySelector('[data-field="name"]').focus();
        });
        remove.addEventListener('click', () => deleteActivity(entry.id));
        activityResults.append(result);
      }
    }
    activityResults.hidden = !activityResults.children.length;
    activitySearchStatus.textContent = query && activityResults.hidden ? 'No matching activities.' : '';
  }

  activitySearch.addEventListener('input', renderActivityResults);
  activitySearch.addEventListener('keydown', event => {
    if (event.key === 'Enter' && !event.isComposing) event.preventDefault();
  });
  activityRows.addEventListener('input', event => {
    if (event.target.dataset.field === 'name' && existingActivities.has(event.target.closest('.settings-row').dataset.id)) {
      renderActivityResults();
    }
  });

  function weekdayFields() {
    return `<fieldset class="day-options">
      <legend>Repeats on</legend>
      <div>${weekdays.map((day, index) =>
        `<label><input type="checkbox" value="${index}" />${day}</label>`).join('')}</div>
    </fieldset>`;
  }

  function commitmentRow(entry = {}) {
    const row = fields(entry.id, 'Commitment', `
      <div class="settings-grid">
        <label class="wide">Commitment name <input data-field="name" required maxlength="80" placeholder="e.g. Work or commute" /></label>
        <label>Starts <input data-field="start" type="time" required /></label>
        <label>Ends <input data-field="end" type="time" required /></label>
      </div>
      ${weekdayFields()}`, {name: entry.name, start: entry.start, end: entry.end});
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
      resetFit();
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
    intro.textContent = firstRun ? 'Add what you want to do. Daylight will find time around your commitments.' : '';
    intro.hidden = !intro.textContent;
    resetFit();
    const routine = editableRoutine(profile);
    get('wake-time').value = routine.wake;
    get('bed-time').value = routine.bed;
    commitmentRows.replaceChildren(...routine.commitments.map(commitmentRow));
    existingActivities = new Map(routine.activities.map(entry => [entry.id, entry]));
    activityRows.replaceChildren();
    activitySearch.value = '';
    renderActivityResults();
    const prayer = profile?.prayer || noPrayer;
    mode.value = prayer.mode;
    get('custom-prayer-title').value = prayer.title || 'Prayer';
    prayerRows.replaceChildren(...prayer.entries.map(prayerRow));
    updateMode();
    error.hidden = true;
    dialog.showModal();
  }

  function values(row) {
    return Object.fromEntries([...row.querySelectorAll('[data-field]')].map(input =>
      [input.dataset.field, input.value.trim()]));
  }

  function showError(message, field) {
    resetFit();
    error.textContent = message;
    error.hidden = false;
    field?.focus();
  }

  function checkFit(next, changed, today) {
    const dates = weekdays.map((label, index) => ({label, index}));
    if (next.routine.activities.some(activity => activity.date === today.date)) {
      dates.push({label: 'Today', index: today.day, date: today.date});
    }
    for (const date of new Set(next.routine.activities.filter(activity =>
      activity.date && activity.date !== today.date && changed.has(activity.id)).map(activity => activity.date))) {
      const index = (new Date(date).getUTCDay() + 6) % 7;
      dates.push({label: date, index, date});
    }
    const reductions = new Map();
    for (const {label, index, date} of dates) {
      const proposed = dayPlan(next, index, date);
      const previous = new Map(profile ? dayPlan(profile, index, date).unscheduled
        .map(activity => [activity.id, activity.remaining]) : []);
      for (const activity of proposed.unscheduled) {
        const scheduled = activity.minutes - activity.remaining;
        if (changed.has(activity.id) || (!scheduled && activity.remaining > (previous.get(activity.id) || 0))) {
          const row = findActivityRow(activity.id);
          return showError(`${activity.name} needs ${activity.minutes} min on ${label === 'Today' ? 'today’s plan' : label}, and ${scheduled} min fit with sleep and breaks reserved. Try fewer minutes, another day, or a split session.`,
            row?.querySelector('[data-field="minutes"]'));
        }
        if (activity.remaining <= (previous.get(activity.id) || 0)) continue;
        const text = `${activity.name} · ${scheduled} of ${activity.minutes} min`;
        if (!reductions.has(text)) reductions.set(text, []);
        reductions.get(text).push(label);
      }
    }
    const changes = [...reductions].map(([text, days]) => `${text} (${days.join(', ')})`);
    const summary = JSON.stringify(changes);
    if (!changes.length || summary === confirmedFit) return true;
    confirmedFit = summary;
    fit.querySelector('ul').replaceChildren(...changes.map(text => {
      const item = document.createElement('li');
      item.textContent = text;
      return item;
    }));
    fit.hidden = false;
    save.textContent = 'Save adjusted plan';
    return false;
  }

  form.addEventListener('submit', event => {
    event.preventDefault();
    error.hidden = true;
    const next = {...profile};
    const changed = new Set();
    const current = editableRoutine(profile);
    const now = new Date();
    if (!get('routine-settings').disabled) {
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
      const activities = new Map(existingActivities);
      const priority = Math.max(0, ...current.activities.map(activity => activity.priority || 0)) + 1;
      const today = todayForRoutine({wake, bed}, now);
      for (const row of activityRows.children) {
        const {name, minutes, type, frequency} = values(row);
        if (!name) return showError('Enter an activity name.', row.querySelector('[data-field="name"]'));
        const id = row.dataset.id;
        const before = existingActivities.get(id);
        const activity = {id, name, minutes: Number(minutes), split: type === 'split'};
        if (before?.source) {
          activity.source = before.source;
          activity.originalSession = type === 'original';
          if (before.weeklyMinutes && activity.minutes === before.minutes && frequency !== 'today') {
            activity.weeklyMinutes = before.weeklyMinutes;
          }
        }
        if (frequency === 'weekly') {
          activity.days = [...row.querySelectorAll(':checked')].map(input => Number(input.value));
          if (!activity.days.length) return showError('Select at least one day for ' + name + '.', row.querySelector('[type="checkbox"]'));
        }
        if (frequency === 'today') {
          activity.date = before?.date || today.date;
          activity.notBefore = before?.notBefore ?? today.minute;
        }
        const timingChanged = !before || activity.minutes !== before.minutes || activity.split !== before.split ||
          activity.date !== before.date || JSON.stringify(activity.days) !== JSON.stringify(before.days) ||
          (before.source && activity.originalSession !== (before.originalSession !== false));
        if (timingChanged) changed.add(id);
        if (!activity.date && (timingChanged || before.priority)) activity.priority = timingChanged ? priority : before.priority;
        activities.set(id, activity);
      }
      next.routine = {wake, bed, commitments, activities: [...activities.values()]};
      next.legacy = Boolean(profile?.legacy);
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

    const routine = editableRoutine(next);
    if ((!get('routine-settings').disabled || next.prayer.mode === 'custom') &&
        !checkFit({...next, routine}, changed, todayForRoutine(routine, now))) return;

    try {
      localStorage.setItem(profileKey, JSON.stringify(next));
    } catch {
      return showError('Your browser couldn’t save your settings. Check that browser storage is available.');
    }
    profile = next;
    dialog.close();
    onSave(next);
  });

  get('cancel-settings').addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => {
    const fallback = get('settings-button');
    (trigger?.getClientRects().length ? trigger : fallback).focus();
  });
  for (const [id, scope] of [['settings-button', 'all'], ['edit-routine', 'routine'], ['edit-prayer', 'prayer']]) {
    const button = get(id);
    button.addEventListener('click', () => open(scope, button));
  }
  if (!profile) open('all');
}
