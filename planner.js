const dayMinutes = 1440;
const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const minuteOf = value => Number(value.slice(0, 2)) * 60 + Number(value.slice(3, 5));

function activityApplies(activity, day, date) {
  return activity.date ? activity.date === date : !activity.days || activity.days.includes(day);
}

function planDay(routine, prayer, day, date, original = []) {
  const wake = minuteOf(routine.wake);
  const bedtime = minuteOf(routine.bed);
  const bed = bedtime > wake ? bedtime : bedtime + dayMinutes;
  const fixed = original.filter(item => item.protected && item.start < bed && item.end > wake)
    .map(item => ({...item, start: Math.max(wake, item.start), end: Math.min(bed, item.end)}));
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

  const slots = freeSlots(wake, bed, fixed, conflicts);
  const activities = routine.activities.filter(activity => activityApplies(activity, day, date)).map(activity => ({
    ...activity,
    minutes: activity.weeklyMinutes?.[day] ?? activity.minutes,
    original: activity.source && original.find(item => item.id === activity.source),
  }));
  const anchored = activities.filter(activity => {
    const item = activity.original;
    return item && activity.originalSession !== false && activity.notBefore === undefined &&
      activity.minutes <= item.end - item.start &&
      slots.some(slot => slot.start <= item.start && slot.end >= item.start + activity.minutes);
  });
  const anchoredItems = anchored.map(activity => ({
    ...activity.original, title: activity.name, activityId: activity.id,
    end: activity.original.start + activity.minutes,
  }));
  const additions = activities.filter(activity => !anchored.includes(activity));
  const inPlace = packActivities(freeSlots(wake, bed, [...fixed, ...anchoredItems]), additions);
  if (inPlace.activities.every(activity => !activity.remaining)) {
    return {items: [...fixed, ...anchoredItems, ...inPlace.items].sort((a, b) => a.start - b.start),
      activities, unscheduled: [], outside, conflicts: [...conflicts]};
  }

  const plan = fitActivities(slots, activities);
  return {
    items: [...fixed, ...plan.items].sort((a, b) => a.start - b.start),
    activities,
    unscheduled: plan.activities.flatMap((activity, index) => {
      const remaining = activities[index].minutes - activity.minutes + activity.remaining;
      return remaining ? [{...activities[index], remaining}] : [];
    }),
    outside,
    conflicts: [...conflicts],
  };
}

function freeSlots(wake, bed, fixed, conflicts) {
  const slots = [];
  let cursor = wake;
  let latest;
  for (const item of [...fixed].sort((a, b) => a.start - b.start)) {
    if (item.start > cursor) slots.push({start: cursor, end: item.start});
    if (item.start < cursor) {
      conflicts?.add(latest.title);
      conflicts?.add(item.title);
    }
    if (item.end > cursor) {
      cursor = item.end;
      latest = item;
    }
  }
  if (cursor < bed) slots.push({start: cursor, end: bed});
  return slots;
}

function fitActivities(slots, activities) {
  const pack = minutes => packActivities(slots, activities.map((activity, index) => ({
    ...activity, minutes: minutes[index],
  })));
  const goals = activities.map(activity => activity.minutes);
  const full = pack(goals);
  const fits = plan => plan.activities.every(activity => !activity.remaining);
  if (fits(full)) return full;

  const minutes = goals.map(() => 1);
  let best = pack(minutes);
  if (!fits(best)) return full;

  // Give today's additions first claim on time, then the most recent routine edits.
  const latest = Math.max(0, ...activities.filter(activity => !activity.date).map(activity => activity.priority || 0));
  const groups = [[], [], []];
  activities.forEach((activity, index) => {
    const group = activity.date ? 0 : latest && activity.priority === latest ? 1 : 2;
    groups[group].push(index);
  });
  for (const group of groups) {
    if (!group.length) continue;
    // Apply the same fraction of each requested duration within a group.
    let low = 0;
    let high = dayMinutes;
    while (low <= high) {
      const fraction = Math.floor((low + high) / 2);
      const trial = [...minutes];
      for (const index of group) trial[index] = 1 + Math.floor((goals[index] - 1) * fraction / dayMinutes);
      const candidate = pack(trial);
      if (fits(candidate)) {
        for (const index of group) minutes[index] = trial[index];
        best = candidate;
        low = fraction + 1;
      } else {
        high = fraction - 1;
      }
    }
    // Use remaining whole minutes when rounding left room for another activity.
    for (const index of group) {
      if (minutes[index] >= goals[index]) continue;
      minutes[index]++;
      const candidate = pack(minutes);
      if (fits(candidate)) best = candidate;
      else minutes[index]--;
    }
  }
  return best;
}

function packActivities(availability, activities) {
  const slots = availability.map(slot => ({...slot}));
  const scheduled = new Map();
  const items = [];
  for (const activity of activities.filter(activity => activity.notBefore !== undefined)) {
    const late = [];
    for (const slot of slots) {
      if (slot.end > activity.notBefore) late.push({start: Math.max(slot.start, activity.notBefore), end: slot.end});
    }
    const result = packSessions(late, [activity]);
    const earlier = slots.filter(slot => slot.start < activity.notBefore)
      .map(slot => ({start: slot.start, end: Math.min(slot.end, activity.notBefore)}));
    slots.splice(0, slots.length, ...earlier, ...result.slots);
    for (let index = slots.length - 1; index > 0; index--) {
      if (slots[index - 1].end === slots[index].start) slots[index - 1].end = slots.splice(index, 1)[0].end;
    }
    scheduled.set(activity.id, result.activities[0]);
    items.push(...result.items);
  }
  const rest = packSessions(slots, activities.filter(activity => !scheduled.has(activity.id)));
  for (const activity of rest.activities) scheduled.set(activity.id, activity);
  return {items: [...items, ...rest.items], activities: activities.map(activity => scheduled.get(activity.id))};
}

function sessionItem(activity, start, end, minutes, suffix = '') {
  return {
    id: activity.original && !suffix ? activity.original.id : 'activity-' + activity.id + suffix,
    activityId: activity.id, title: activity.name, start, end, minutes,
    detail: activity.original?.detail, category: activity.original?.category,
  };
}

function packSessions(slots, activities) {
  const items = [];
  const pending = activities.map(activity => ({...activity, remaining: activity.minutes, parts: 0}));
  const continuous = pending.filter(activity => !activity.split);
  const flexible = pending.filter(activity => activity.split);

  for (const activity of continuous.sort((a, b) => b.minutes - a.minutes)) {
    const pause = activity.original && activity.originalSession !== false ? 0 : 5;
    const length = activity.minutes + Math.floor((activity.minutes - 1) / 30) * pause;
    const slot = slots.find(candidate => candidate.end - candidate.start >= length);
    if (!slot) continue;
    const start = slot.start;
    const breaks = [];
    for (let work = 30, elapsed = 30; pause && work < activity.minutes; work += 30, elapsed += 30 + pause) {
      breaks.push({start: start + elapsed, end: start + elapsed + pause});
    }
    items.push({...sessionItem(activity, start, start + length, activity.minutes), breaks});
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

  return {items, slots: sessions.slots, activities: [...continuous, ...sessions.activities]};
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
        items.push(sessionItem(activity, start, start + minutes, minutes, '-' + activity.parts));
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
