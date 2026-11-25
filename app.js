const byId = id => document.getElementById(id);
const zone = 'Asia/Dhaka';
const formatters = timezone => {
  const formatter = (locale, options) => new Intl.DateTimeFormat(locale, {timeZone: timezone, ...options});
  return {
    shortDay: formatter('en', {weekday: 'short'}),
    fullDate: formatter('en', {weekday: 'long', month: 'long', day: 'numeric'}),
    dayNumber: formatter('en', {day: 'numeric'}),
    dateKey: createDateKey(timezone),
    previousKey: formatter('en-CA', {year: 'numeric', month: '2-digit', day: '2-digit'}),
    clock: formatter('en', {hour: 'numeric', minute: '2-digit'}),
    minuteClock: formatter('en-GB', {hour: '2-digit', minute: '2-digit', hourCycle: 'h23'}),
  };
};
const bangladesh = formatters(zone);
const local = formatters();
let profile = readProfile();
let dates = profile?.legacy ? bangladesh : local;


function shiftDay(date, offset) {
  if (dates === bangladesh) return new Date(date.getTime() + offset * 86400000);
  const shifted = new Date(date.getTime());
  shifted.setHours(12, 0, 0, 0);
  shifted.setDate(shifted.getDate() + offset);
  return shifted;
}

function weekOf(date) {
  const offset = weekdays.indexOf(dates.shortDay.format(date));
  return weekdays.map((_, index) => shiftDay(date, index - offset));
}

function routineDate(now, routine = profile?.routine) {
  if (routine && routine.bed < routine.wake && dates.minuteClock.format(now) < routine.bed) {
    return shiftDay(now, -1);
  }
  return now;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, character =>
    ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[character]));
}

const plans = [
  ['Build something', 'Start the week with the roadmap’s hands-on work.', ['Build the main task','Learn the next concept','Test and write notes'], 'Outline a WattaDumb explainer', false, false],
  ['Learn and apply', 'Study a concept in the morning, then try it in code.', ['Study the main lesson','Use it in a small example','Finish the exercise'], 'Script or storyboard a video', true, false],
  ['Practice and polish', 'Give the tricky exercises a fresh look and take a slower evening.', ['Tackle the hardest exercise','Debug and improve your solution','Review what clicked'], 'Record narration or edit a scene', false, true],
  ['Build and ship', 'Make something you can run, test, or show by the end of the day.', ['Build the roadmap task','Run tests and fix issues','Document what you built'], 'Edit the next WattaDumb video', true, true],
  ['Ease into Friday', 'Keep the morning gentle and leave room around midday prayer.', ['Start with guided practice','Finish the day’s main exercise','Review and catch up'], 'Make a thumbnail or prep upload details', false, false],
  ['Experiment', 'Try an idea from the roadmap and see what you can make with it.', ['Try the day’s concept in a tiny project','Complete the main roadmap task','Compare approaches'], 'Finish a video or schedule a ready upload', true, false],
  ['Review and reset', 'Use the roadmap time to finish today’s work and carry one clear next step into tomorrow.', ['Review a topic and start today’s task','Complete the remaining exercises','Write tomorrow’s first action'], 'Upload a finished video or plan the next one', false, true],
];
const prayerNames = ['Fajr','Dhuhr / Jumu’ah on Friday','Asr','Maghrib','Isha'];
const block = (id, start, end, title, detail, category = '') => ({id, start, end, title, detail, category});
function originalDay(index) {
  const [, , focus, video, familyFirst, jobsLate] = plans[index];
  const friday = index === 4;
  const afternoon = friday ? 840 : 825;
  const studyA = friday ? 570 : 510;
  const studyB = friday ? 690 : 660;
  const firstJob = friday ? 515 : 630;
  const nextJob = friday ? 975 : 945;
  const videoStart = jobsLate ? nextJob : nextJob + 30;
  const secondJob = jobsLate ? nextJob + 60 : nextJob;
  const freeStart = nextJob + 90;
  const leisure = [
    block('family', 0, 45, 'Time with your niece', 'Play a game, draw, or let her pick.'),
    block('audio', 0, 30, 'Audiobook', 'Listen somewhere comfortable or while doing something with your hands.'),
  ];
  if (!familyFirst) leisure.reverse();
  let start = freeStart;
  const evening = leisure.map(item => {
    const next = {...item, start, end: start + item.end};
    start = next.end;
    return next;
  });
  return [
    block('morning', 340, 510, 'Morning routine', 'Wake around 5:40, pray Fajr at its local time, clean your room, help your mother, shower, and have breakfast.'),
    block('focus-a', studyA, studyA + (friday ? 105 : 120), 'Roadmap · Focus 1', focus[0], 'Roadmap'),
    block('job-a', firstJob, firstJob + 30, 'Job search · Check openings', 'Save relevant roles and shortlist the ones worth applying for.', 'Jobs'),
    block('focus-b', studyB, studyB + (friday ? 60 : 90), 'Roadmap · Focus 2', focus[1], 'Roadmap'),
    block('lunch', 750, afternoon - 15, friday ? 'Lunch and Jumu’ah buffer' : 'Lunch and a screen-free break', friday ? 'Keep this window flexible around the local congregation time.' : 'Eat lunch, pause for Dhuhr when due, and take a proper break.'),
    block('focus-c', afternoon, afternoon + (friday ? 135 : 90), 'Roadmap · Focus 3', focus[2], 'Roadmap'),
    block('job-b', secondJob, secondJob + 30, 'Job search · Apply or follow up', 'Tailor an application, send a follow-up, or update your job tracker.', 'Jobs'),
    block('video', videoStart, videoStart + 60, 'WattaDumb · YouTube', video, 'YouTube'),
    ...evening,
    block('dinner', 1155, 1200, 'Dinner', 'Eat and take a break.'),
    block('series', 1200, 1250, 'TV series', 'Sit down for an episode or finish one you started.'),
    block('winddown', 1275, 1335, 'Wind down', 'Get ready for bed and aim to sleep around 10:15 PM.'),
  ].map(item => ({...item, protected: ['morning', 'lunch', 'dinner', 'winddown'].includes(item.id)}))
    .sort((a,b) => a.start-b.start);
}

function editableRoutine(current) {
  if (current?.routine || !current?.legacy) return current?.routine || defaultRoutine;
  const activities = originalDay(0).filter(item => !item.protected).map(item => ({
    id: item.id, source: item.id, name: item.title, minutes: item.end - item.start, split: false,
    weeklyMinutes: weekdays.map((_, day) => {
      const block = originalDay(day).find(candidate => candidate.id === item.id);
      return block.end - block.start;
    }),
  }));
  return {wake: '05:40', bed: '22:15', commitments: [], activities};
}

function dayPlan(current, day, date) {
  return planDay(editableRoutine(current), current.prayer, day, date, current.legacy ? originalDay(day) : []);
}

function todayForRoutine(routine, now = new Date()) {
  const today = routineDate(now, routine);
  const date = dates.dateKey(today);
  return {
    date, day: weekdays.indexOf(dates.shortDay.format(today)),
    minute: minuteOf(dates.minuteClock.format(now)) + (date === dates.dateKey(now) ? 0 : dayMinutes),
  };
}
function time(minutes) {
  minutes %= dayMinutes;
  const hour = Math.floor(minutes / 60);
  return `${hour % 12 || 12}:${String(minutes % 60).padStart(2,'0')} ${hour < 12 ? 'AM' : 'PM'}`;
}
function range({start, end}) {
  const [startTime, startPeriod] = time(start).split(' ');
  const [endTime, endPeriod] = time(end).split(' ');
  const startLabel = startPeriod === endPeriod && start < dayMinutes && end < dayMinutes
    ? startTime : startTime + ' ' + startPeriod;
  const nextDay = end >= dayMinutes ? ' (+1 day)' : '';
  return `${startLabel}–${endTime} ${endPeriod}${nextDay}`;
}

let selected = routineDate(new Date());
let todayKey = dates.dateKey(selected);

function readDone() {
  try {
    const saved = localStorage.getItem('daylight:' + dates.dateKey(selected)) ??
      localStorage.getItem('daylight:' + dates.previousKey.format(selected));
    return new Set(JSON.parse(saved || '[]'));
  } catch { return new Set(); }
}

function toggle(id) {
  const done = readDone();
  if (done.has(id)) done.delete(id); else done.add(id);
  try {
    localStorage.setItem('daylight:' + dates.dateKey(selected), JSON.stringify([...done]));
  } catch {
    byId('progress-status').textContent = 'Your browser couldn’t save this checkmark.';
    return;
  }
  byId('progress-status').textContent = '';
  render(id);
}

function checkbox(id, title, done) {
  return `<button class="check" type="button" data-check="${escapeHtml(id)}" aria-label="${escapeHtml(title)}" aria-pressed="${done.has(id)}">${done.has(id) ? '✓' : ''}</button>`;
}

function renderForbiddenNotice(now) {
  const periods = locationSettings.forbiddenPeriods(now);
  const [hour, minute] = bangladesh.minuteClock.format(now).split(':').map(Number);
  const currentMinute = hour * 60 + minute;
  const active = periods.find(({start, end}) => start <= currentMinute && currentMinute < end);
  const notice = byId('forbidden-status');
  const estimated = !Object.hasOwn(bangladeshTimetable, locationSettings.district) || bangladesh.dateKey(now).endsWith('02-29');
  const message = active
    ? `Forbidden prayer time · ${active.reason} · Until ${time(active.end)}${estimated ? ' (estimated)' : ''}${active.reason === 'Sunset' ? '. If you still owe today’s Asr, pray it before sunset.' : ''}`
    : '';
  if (notice.textContent !== message) notice.textContent = message;
  notice.hidden = !active;
}
function renderSalah(done) {
  // A selected planner day may be in a different time zone. Anchor the
  // corresponding Bangladesh timetable to the same calendar date.
  const prayerDay = new Date(dates.dateKey(selected) + 'T06:00:00Z');
  const friday = bangladesh.shortDay.format(prayerDay) === 'Fri';
  const district = locationSettings.district;
  const deadlines = locationSettings.deadlines(prayerDay);
  const estimated = !Object.hasOwn(bangladeshTimetable, district) || bangladesh.dateKey(prayerDay).endsWith('02-29');
  byId('prayer-method').textContent = deadlines
    ? (estimated ? 'Estimated cutoffs · Bangladesh time' : 'Timetable cutoffs · Bangladesh time')
    : 'District times are currently unavailable.';
  const periods = locationSettings.forbiddenPeriods(prayerDay);
  byId('forbidden-periods').hidden = periods.length === 0;
  byId('forbidden-list').innerHTML = periods.map(({start, end, reason}) =>
    `<li>${reason} · ${range({start, end})}${estimated ? ' (estimated)' : ''}</li>`
  ).join('');
  renderForbiddenNotice(new Date());
  byId('prayers').innerHTML = prayerNames.map((name, i) => {
    const title = i === 1 ? (friday ? 'Jumu’ah' : 'Dhuhr') : name;
    const cutoff = deadlines ? time(deadlines[i]) : '';
    const timing = i === 1 && friday ? 'Follow your mosque’s congregation time'
      : (cutoff ? 'Ends at ' + cutoff + (i === 4 ? ' next day' : '') : 'Time unavailable');
    return `<div class="prayer"><div><span>${title}</span><small>${timing}</small></div>${checkbox('prayer-' + i, title, done)}</div>`;
  }).join('');
}
function renderPrayers(done) {
  const prayer = profile?.prayer || noPrayer;
  const salah = prayer.mode === 'salah';
  byId('salah-controls').hidden = !salah;
  byId('salah-details').hidden = !salah;
  byId('prayer-title').textContent = salah ? 'Salah' : (prayer.mode === 'custom' && prayer.title) || 'Prayer';
  const editLabel = salah ? 'Prayer settings' : 'Edit prayer';
  byId('edit-prayer').setAttribute('aria-label', editLabel);
  byId('edit-prayer').title = editLabel;
  if (salah) {
    renderSalah(done);
    return;
  }
  const entries = prayer.mode === 'custom' ? prayer.entries : [];
  byId('prayers').innerHTML = entries.length ? entries.map(entry => {
    const timing = entry.time ? time(minuteOf(entry.time)) + ' · ' + entry.minutes + ' min' : '';
    return `<div class="prayer"><div><span>${escapeHtml(entry.name)}</span>${timing ? `<small>${timing}</small>` : ''}</div>${checkbox('custom-prayer-' + entry.id, entry.name, done)}</div>`;
  }).join('') : '<p class="empty-plan">Add prayers or practices to fill your checklist.</p>';
}

function renderPlanRow(item, done) {
  const notes = [item.detail, item.minutes ? item.minutes + ' min of activity' : ''].filter(Boolean);
  const breaks = item.breaks?.length ? '<ul class="session-breaks">' +
    item.breaks.map(pause => `<li>Walk or stretch · ${range(pause)}</li>`).join('') + '</ul>' : '';
  const label = item.activityId ? item.title + ' · ' + range(item) : item.title;
  const tag = item.tag || item.category;
  return `<article class="row" data-done="${done.has(item.id)}">
    <div class="time">${range(item)}</div>
    <div><h3>${escapeHtml(item.title)}${tag ? ` <span class="tag">${escapeHtml(tag)}</span>` : ''}</h3>
    ${notes.length ? `<p>${escapeHtml(notes.join(' · '))}</p>` : ''}${breaks}</div>
    ${item.id ? checkbox(item.id, label, done) : ''}
  </article>`;
}

function renderTotals(items, done, activities) {
  const groups = profile?.legacy
    ? [
        ...[['Roadmap', 'Roadmap'], ['Job search', 'Jobs'], ['WattaDumb', 'YouTube']]
          .filter(([, key]) => items.some(item => item.category === key)),
        ...activities.filter(activity => !activity.source).map(activity => [activity.name, activity.id, activity.minutes]),
      ]
    : activities.map(activity => [activity.name, activity.id, activity.minutes]);
  byId('totals').hidden = !groups.length;
  byId('totals').innerHTML = groups.map(([label, key, goal]) => {
    const blocks = items.filter(item => item.activityId === key || item.category === key);
    const minutes = list => list.reduce((sum, item) => sum + (item.minutes ?? item.end - item.start), 0);
    return `<div><dt>${escapeHtml(label)}</dt><dd>${minutes(blocks.filter(item => done.has(item.id)))} / ${goal ?? minutes(blocks)} min</dd></div>`;
  }).join('');
}

function render(focusId, now = new Date()) {
  const today = routineDate(now);
  const index = weekdays.indexOf(dates.shortDay.format(selected));
  const isToday = dates.dateKey(selected) === dates.dateKey(today);
  const plan = profile ? dayPlan(profile, index, dates.dateKey(selected)) : null;
  const items = plan?.items || [];
  const done = readDone();
  byId('date').textContent = dates.fullDate.format(selected);
  byId('theme').textContent = profile?.legacy ? plans[index].slice(0, 2).join(' · ') :
    profile ? `Awake ${range({start: minuteOf(profile.routine.wake), end: minuteOf(profile.routine.bed) +
        (profile.routine.bed < profile.routine.wake ? dayMinutes : 0)})}` :
      'Make time for what matters to you.';
  byId('schedule-title').textContent = isToday ? 'Today’s plan' : weekdays[index] + '’s plan';
  byId('today').hidden = isToday;
  document.querySelector('.week').innerHTML = weekOf(today).map((date, i) =>
    `<button class="day" data-day="${i}" aria-pressed="${i === index}" aria-label="${dates.fullDate.format(date)}"${dates.dateKey(date) === dates.dateKey(today) ? ' aria-current="date"' : ''}><span>${weekdays[i]}</span><strong>${dates.dayNumber.format(date)}</strong></button>`
  ).join('');
  byId('timeline').innerHTML = items.length ? items.map(item => renderPlanRow(item, done)).join('') :
    '<p class="empty-plan">Add activities or commitments to fill your plan.</p>';

  const notes = plan ? [
    ...plan.unscheduled.map(activity => {
      const scheduled = activity.minutes - activity.remaining;
      return scheduled ? `${activity.name} · ${scheduled} of ${activity.minutes} min scheduled.` :
        `${activity.name} · ${activity.minutes} min didn’t fit within waking hours and breaks.`;
    }),
    ...plan.outside.map(name => name + ' · Scheduled partly or entirely outside your waking hours.'),
    ...(plan.conflicts.length ? ['Fixed times overlap · ' + plan.conflicts.join(', ')] : []),
  ] : [];
  byId('plan-notes').hidden = !notes.length;
  byId('plan-notes').innerHTML = notes.map(note => '<li>' + escapeHtml(note) + '</li>').join('');

  renderPrayers(done);
  const trackable = items.filter(item => item.id);
  const unfinished = trackable.filter(item => !done.has(item.id));
  const count = trackable.length - unfinished.length;
  const currentMinute = minuteOf(dates.minuteClock.format(now)) +
    (dates.dateKey(today) !== dates.dateKey(now) ? dayMinutes : 0);
  const next = (isToday && unfinished.find(item => item.end > currentMinute)) || unfinished[0];
  byId('next-label').textContent = next ? 'Next unfinished' : 'Daily plan';
  byId('next-title').textContent = next ? next.title : trackable.length ? 'You’re done for the day' : 'No activities scheduled';
  byId('next-detail').textContent = next ? range(next) + (next.detail ? ' · ' + next.detail : '') :
    trackable.length ? 'All activity blocks are checked off.' : 'Activities will appear here when they fit into your plan.';
  byId('complete').hidden = !next;
  byId('complete').onclick = next ? () => toggle(next.id) : null;
  byId('fraction').textContent = count + ' / ' + trackable.length;
  byId('progress').value = trackable.length ? count / trackable.length : 0;
  renderTotals(items, done, plan?.activities || []);
  if (focusId) document.querySelector(`[data-check="${CSS.escape(focusId)}"]`)?.focus();
}

document.addEventListener('click', event => {
  const button = event.target.closest('button');
  if (!button) return;
  if (button.dataset.day !== undefined) {
    selected = weekOf(routineDate(new Date()))[Number(button.dataset.day)];
    render();
    document.querySelector(`[data-day="${button.dataset.day}"]`).focus();
  } else if (button.dataset.check) toggle(button.dataset.check);
  else if (button.id === 'today') {
    selected = routineDate(new Date());
    render();
    document.querySelector('[aria-current="date"]').focus();
  }
});

function showClock(now) {
  byId('clock').textContent = dates.clock.format(now);
}

const locationSettings = initializeLocation(profile?.legacy, () => {
  if (profile?.prayer.mode === 'salah') renderSalah(readDone());
  refreshWeather();
});
const refreshWeather = initializeWeather(locationSettings);

function tick() {
  const now = new Date();
  const today = routineDate(now);
  showClock(now);
  if (dates.dateKey(today) !== todayKey) {
    selected = today;
    todayKey = dates.dateKey(today);
    render(undefined, now);
  }
  if (profile?.prayer.mode === 'salah') renderForbiddenNotice(now);
  refreshWeather();
}

function applySettings(next) {
  const previousDates = dates;
  const previousToday = todayKey;
  const wasToday = dates.dateKey(selected) === todayKey;
  profile = next;
  dates = profile.legacy ? bangladesh : local;
  const today = routineDate(new Date());
  todayKey = dates.dateKey(today);
  if (wasToday || dates !== previousDates || todayKey !== previousToday) selected = today;
  if (profile.prayer.mode === 'salah') locationSettings.loadPrayerDistrict();
  tick();
  render();
}

document.addEventListener('visibilitychange', () => {
  if (!document.hidden) tick();
});
if (profile?.prayer.mode === 'salah') locationSettings.loadPrayerDistrict();
tick();
render();
setInterval(tick, 15000);

const splash = byId('launch-splash');
Promise.allSettled((splash.getAnimations?.() || []).map(animation => animation.finished)).then(() => {
  splash.hidden = true;
  initializeSettings(profile, applySettings);
});

function initializeRefresh() {
  if (!navigator.maxTouchPoints && !('ontouchstart' in window)) return;
  const root = document.documentElement;
  root.classList.add('touch-refresh');

  const settings = byId('settings-dialog');
  const armDistance = 58;
  const maxDistance = 118;
  let start;
  let pulling = false;

  function movePage(distance) {
    root.style.setProperty('--pull-distance', distance + 'px');
    root.style.setProperty('--pull-progress', Math.min(distance / armDistance, 1));
  }

  function finish(refresh = false) {
    start = undefined;
    if (!pulling) return;
    pulling = false;
    if (refresh) {
      root.dataset.pull = 'refreshing';
      movePage(armDistance);
      setTimeout(() => window.location.reload(), 180);
    } else {
      delete root.dataset.pull;
      movePage(0);
    }
  }

  document.addEventListener('touchstart', event => {
    finish();
    if (event.touches.length === 1 && window.scrollY <= 0 && !settings.open &&
        splash.hidden && root.dataset.pull !== 'refreshing') {
      start = event.touches[0];
    }
  }, {passive: true});

  document.addEventListener('touchmove', event => {
    if (!start) return;
    if (event.touches.length !== 1 || !event.cancelable || settings.open || window.scrollY > 0) {
      finish();
      return;
    }
    const touch = event.touches[0];
    const down = touch.clientY - start.clientY;
    const across = Math.abs(touch.clientX - start.clientX);
    if (!pulling) {
      if (Math.max(Math.abs(down), across) < 6) return;
      if (down <= across) {
        finish();
        return;
      }
      pulling = true;
    }
    event.preventDefault();
    const distance = maxDistance * (1 - Math.exp(-Math.max(0, down) / maxDistance));
    root.dataset.pull = distance >= armDistance ? 'ready' : 'dragging';
    movePage(distance);
  }, {passive: false});

  document.addEventListener('touchend', () => {
    finish(root.dataset.pull === 'ready' && !settings.open);
  }, {passive: true});
  document.addEventListener('touchcancel', () => finish(), {passive: true});
}

initializeRefresh();
