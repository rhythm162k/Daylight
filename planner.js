const dayMinutes = 1440;
const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const minuteOf = value => Number(value.slice(0, 2)) * 60 + Number(value.slice(3, 5));

function planDay(routine, prayer, day) {
  const wake = minuteOf(routine.wake);
  const bedtime = minuteOf(routine.bed);
  const bed = bedtime > wake ? bedtime : bedtime + dayMinutes;
  const fixed = [];
  const outside = [];
  const conflicts = new Set();

  for (const commitment of routine.commitments) {
    const start = minuteOf(commitment.start);
    const end = minuteOf(commitment.end);
    for (const offset of [-1, 0, 1]) {
      if (!commitment.days.includes((day + offset + 7) % 7)) continue;
      const from = Math.max(wake, start + offset * dayMinutes);
      const until = Math.min(bed, end + (offset + (end < start ? 1 : 0)) * dayMinutes);
      if (from < until) {
        fixed.push({start: from, end: until, title: commitment.name, detail: 'Fixed commitment'});
      }
    }
  }

  if (prayer.mode === 'custom') {
    for (const entry of prayer.entries) {
      if (!entry.time) continue;
      const minute = minuteOf(entry.time);
      const start = minute < wake && bed > dayMinutes ? minute + dayMinutes : minute;
      const end = start + entry.minutes;
      if (start < wake || end > bed) outside.push(entry.name);
      if (start < bed && end > wake) {
        fixed.push({
          start: Math.max(wake, start), end: Math.min(bed, end),
          title: entry.name, detail: prayer.title,
        });
      }
    }
  }

  const slots = [];
  let cursor = wake;
  let latest;
  fixed.sort((a, b) => a.start - b.start);
  for (const item of fixed) {
    if (item.start > cursor) slots.push({start: cursor, end: item.start});
    if (item.start < cursor) {
      conflicts.add(latest.title);
      conflicts.add(item.title);
    }
    if (item.end > cursor) {
      cursor = item.end;
      latest = item;
    }
  }
  if (cursor < bed) slots.push({start: cursor, end: bed});

  const activities = routine.activities.map(activity => ({...activity, remaining: activity.minutes, parts: 0}));
  const items = [...fixed];
  const continuous = activities.filter(activity => !activity.split);
  const flexible = activities.filter(activity => activity.split);

  for (const activity of continuous.sort((a, b) => b.minutes - a.minutes)) {
    const pause = 5;
    const length = activity.minutes + Math.floor((activity.minutes - 1) / 30) * pause;
    const slot = slots.find(candidate => candidate.end - candidate.start >= length);
    if (!slot) continue;
    const start = slot.start;
    const breaks = [];
    for (let work = 30, elapsed = 30; work < activity.minutes; work += 30, elapsed += 30 + pause) {
      breaks.push({start: start + elapsed, end: start + elapsed + pause});
    }
    items.push({
      id: 'activity-' + activity.id, activityId: activity.id, title: activity.name,
      start, end: start + length, minutes: activity.minutes, breaks,
    });
    slot.start += length;
    activity.remaining = 0;
  }

  const full = placeFlexible(slots, flexible, 10, true);
  const fitsFullSessions = full.activities.every(activity => !activity.remaining);
  const packed = fitsFullSessions ? full : placeFlexible(slots, flexible, 10, false);
  const spare = packed.slots.reduce((sum, slot) => sum + slot.end - slot.start, 0);
  const breaks = packed.items.filter(item => !item.id).length;
  let sessions = packed;
  if (breaks && spare && packed.activities.every(activity => !activity.remaining)) {
    const spacing = Math.min(180, 10 + Math.floor(spare / breaks));
    const spread = placeFlexible(slots, flexible, spacing, fitsFullSessions);
    if (spread.activities.every((activity, index) =>
      !activity.remaining && activity.parts <= packed.activities[index].parts)) sessions = spread;
  }
  items.push(...sessions.items);

  return {
    items: items.sort((a, b) => a.start - b.start),
    unscheduled: [...continuous, ...sessions.activities].filter(activity => activity.remaining),
    outside,
    conflicts: [...conflicts],
  };
}

function placeFlexible(availability, activities, spacing, preferFullSessions) {
  const slots = availability.map(slot => ({...slot}));
  const pending = activities.map(activity => ({...activity}));
  const items = [];
  for (const slot of slots) {
    while (slot.start < slot.end) {
      let scheduled = false;
      for (const activity of pending) {
        if (!activity.remaining || slot.start === slot.end) continue;
        const start = slot.start;
        const target = Math.min(120, activity.remaining);
        if (preferFullSessions && slot.end - start < target) continue;
        const minutes = Math.min(target, slot.end - start);
        activity.remaining -= minutes;
        activity.parts++;
        items.push({
          id: 'activity-' + activity.id + '-' + activity.parts, activityId: activity.id,
          title: activity.name, start, end: start + minutes, minutes,
        });
        slot.start += minutes;
        if (activity.remaining && slot.start < slot.end) {
          items.push({start: slot.start, end: Math.min(slot.start + 10, slot.end), title: 'Break'});
          slot.start = Math.min(slot.start + spacing, slot.end);
        }
        scheduled = true;
      }
      if (!scheduled) break;
    }
  }
  return {slots, activities: pending, items};
}
