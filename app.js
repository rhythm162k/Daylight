const zone = 'Asia/Dhaka';
const shortDay = new Intl.DateTimeFormat('en', {timeZone: zone, weekday: 'short'});
const fullDate = new Intl.DateTimeFormat('en', {timeZone: zone, weekday: 'long', month: 'long', day: 'numeric'});
const dayNumber = new Intl.DateTimeFormat('en', {timeZone: zone, day: 'numeric'});
const dateKey = new Intl.DateTimeFormat('en-CA', {timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit'});
const clock = new Intl.DateTimeFormat('en', {timeZone: zone, hour: 'numeric', minute: '2-digit'});
const dayNames = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
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
const byId = id => document.getElementById(id);
const weekOf = date => {
  const offset = dayNames.indexOf(shortDay.format(date));
  return dayNames.map((_, index) => new Date(date.getTime() + (index - offset) * 86400000));
};
const block = (id, start, end, title, detail, category = '') => ({id, start, end, title, detail, category});
function routine(index) {
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
  ].sort((a,b) => a.start-b.start);
}
function time(minutes) {
  const hour = Math.floor(minutes / 60);
  return `${hour % 12 || 12}:${String(minutes % 60).padStart(2,'0')} ${hour < 12 ? 'AM' : 'PM'}`;
}
const range = ({start, end}) => time(start).split(' ')[1] === time(end).split(' ')[1]
  ? `${time(start).split(' ')[0]}–${time(end)}`
  : `${time(start)}–${time(end)}`;
let selected = new Date();
let todayKey = dateKey.format(selected);
function readDone() {
  try { return new Set(JSON.parse(localStorage.getItem('daylight:' + dateKey.format(selected)) || '[]')); }
  catch { return new Set(); }
}
function toggle(id) {
  const done = readDone();
  if (done.has(id)) done.delete(id); else done.add(id);
  localStorage.setItem('daylight:' + dateKey.format(selected), JSON.stringify([...done]));
  render(id);
}
function checkbox(id, title, done) {
  return `<button class="check" data-check="${id}" aria-label="${title}" aria-pressed="${done.has(id)}">${done.has(id) ? '✓' : ''}</button>`;
}
const localMinuteClock = new Intl.DateTimeFormat('en-GB', {
  timeZone: zone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
});
function renderForbiddenNotice(now) {
  const periods = prayerLocation.forbiddenPeriods(now);
  const [hour, minute] = localMinuteClock.format(now).split(':').map(Number);
  const currentMinute = hour * 60 + minute;
  const active = periods.find(({start, end}) => start <= currentMinute && currentMinute < end);
  const notice = byId('forbidden-status');
  const estimated = !Object.hasOwn(bangladeshTimetable, prayerLocation.district) || dateKey.format(now).endsWith('02-29');
  const message = active
    ? `Forbidden prayer time · ${active.reason} · Until ${time(active.end)}${estimated ? ' (estimated)' : ''}${active.reason === 'Sunset' ? '. If you still owe today’s Asr, pray it before sunset.' : ''}`
    : '';
  if (notice.textContent !== message) notice.textContent = message;
  notice.hidden = !active;
}
function renderPrayers(index, done) {
  const district = prayerLocation.district;
  const deadlines = prayerLocation.deadlines(selected);
  const estimated = !Object.hasOwn(bangladeshTimetable, district) || dateKey.format(selected).endsWith('02-29');
  byId('prayer-method').textContent = deadlines
    ? (estimated ? 'Estimated cutoffs · Bangladesh time' : 'Timetable cutoffs · Bangladesh time')
    : 'District times are currently unavailable.';
  const periods = prayerLocation.forbiddenPeriods(selected);
  byId('forbidden-periods').hidden = periods.length === 0;
  byId('forbidden-list').innerHTML = periods.map(({start, end, reason}) =>
    `<li>${reason} · ${range({start, end})}${estimated ? ' (estimated)' : ''}</li>`
  ).join('');
  renderForbiddenNotice(new Date());
  byId('prayers').innerHTML = prayerNames.map((name, i) => {
    const friday = i === 1 && index === 4;
    const title = i === 1 ? (friday ? 'Jumu’ah' : 'Dhuhr') : name;
    const cutoff = deadlines ? time(deadlines[i]) : '';
    const timing = friday ? 'Follow your mosque’s congregation time'
      : (cutoff ? 'Ends at ' + cutoff + (i === 4 ? ' next day' : '') : 'Time unavailable');
    return `<div class="prayer"><div><span>${title}</span><small>${timing}</small></div>${checkbox('prayer-' + i, title, done)}</div>`;
  }).join('');
}
function render(focusId) {
  const current = new Date();
  const index = dayNames.indexOf(shortDay.format(selected));
  const isToday = dateKey.format(selected) === dateKey.format(current);
  const [name, description] = plans[index];
  byId('date').textContent = fullDate.format(selected);
  byId('theme').textContent = name + ' · ' + description;
  byId('schedule-title').textContent = isToday ? 'Today’s plan' : shortDay.format(selected) + '’s plan';
  byId('today').hidden = isToday;
  const week = weekOf(current);
  document.querySelector('.week').innerHTML = week.map((date,i) =>
    `<button class="day" data-day="${i}" aria-pressed="${i === index}" aria-label="${fullDate.format(date)}"${dateKey.format(date) === dateKey.format(current) ? ' aria-current="date"' : ''}><span>${dayNames[i]}</span><strong>${dayNumber.format(date)}</strong></button>`
  ).join('');
  const items = routine(index);
  const done = readDone();
  const count = items.filter(item => done.has(item.id)).length;
  const unfinished = items.filter(item => !done.has(item.id));
  const localTime = new Intl.DateTimeFormat('en-GB', {timeZone: zone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23'}).format(current);
  const [hour, minute] = localTime.split(':').map(Number);
  const next = (isToday && unfinished.find(item => item.end > hour * 60 + minute)) || unfinished[0];
  byId('timeline').innerHTML = items.map(item => `<article class="row" data-done="${done.has(item.id)}"><div class="time">${range(item)}</div><div><h3>${item.title}${item.category ? ` <span class="tag">${item.category}</span>` : ''}</h3><p>${item.detail}</p></div>${checkbox(item.id,item.title,done)}</article>`).join('');
  renderPrayers(index, done);
  byId('next-label').textContent = next ? 'Next unfinished' : 'Daily plan complete';
  byId('next-title').textContent = next ? next.title : 'You’re done for the day';
  byId('next-detail').textContent = next ? range(next) + ' · ' + next.detail : 'All routine blocks are checked off.';
  byId('complete').hidden = !next;
  byId('complete').onclick = next ? () => toggle(next.id) : null;
  byId('fraction').textContent = count + ' / ' + items.length;
  byId('progress').value = count / items.length;
  byId('totals').innerHTML = [['Roadmap','Roadmap'],['Job search','Jobs'],['WattaDumb','YouTube']].map(([label,category]) => {
    const blocks = items.filter(item => item.category === category);
    const minutes = list => list.reduce((sum,item) => sum + item.end-item.start,0);
    return `<div><dt>${label}</dt><dd>${minutes(blocks.filter(item => done.has(item.id)))} / ${minutes(blocks)} min</dd></div>`;
  }).join('');
  if (focusId) document.querySelector(`[data-check="${focusId}"]`)?.focus();
}
document.addEventListener('click', event => {
  const button = event.target.closest('button');
  if (!button) return;
  if (button.dataset.day !== undefined) {
    selected = weekOf(new Date())[Number(button.dataset.day)];
    render();
    document.querySelector(`[data-day="${button.dataset.day}"]`).focus();
  } else if (button.dataset.check) toggle(button.dataset.check);
  else if (button.id === 'today') {
    selected = new Date();
    render();
    document.querySelector('[aria-current="date"]').focus();
  }
});
function renderClock(now) {
  byId('clock').textContent = clock.format(now) + ' · ' + prayerLocation.district;
}
function tick() {
  const now = new Date();
  renderClock(now);
  refreshWeather();
  if (dateKey.format(now) !== todayKey) {
    selected = now;
    todayKey = dateKey.format(now);
    render();
  } else {
    renderForbiddenNotice(now);
  }
}
const prayerLocation = initializePrayerLocation(() => {
  renderClock(new Date());
  renderPrayers(dayNames.indexOf(shortDay.format(selected)), readDone());
  refreshWeather();
});
const refreshWeather = initializeWeather(prayerLocation);
document.addEventListener('visibilitychange', refreshWeather);
tick();
render();
setInterval(tick, 15000);
