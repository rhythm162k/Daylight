const dayMinutes = 1440;
const splitBreakMinutes = 10;
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
          title: entry.name, detail: prayer.title || 'Prayer',
        });
      }
    }
  }

  const slots = freeSlots(wake, bed, fixed, conflicts);
  const todayFirstId = routine.firstByDate?.[date];
  const activities = routine.activities.filter(activity => activityApplies(activity, day, date) ||
    (activity.id === todayFirstId && !activity.date)).map(activity => ({
    ...activity,
    minutes: activity.weeklyMinutes?.[day] ?? activity.minutes,
    original: activity.source && original.find(item => item.id === activity.source),
  }));
  const firstId = [todayFirstId, routine.firstActivityId]
    .find(id => activities.some(activity => activity.id === id));
  const anchored = firstId ? [] : activities.filter(activity => {
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
  const inPlace = !firstId && packActivities(freeSlots(wake, bed, [...fixed, ...anchoredItems]), additions);
  if (inPlace && inPlace.activities.every(activity => !activity.remaining)) {
    return {items: timelineItems([...fixed, ...anchoredItems, ...inPlace.items], activities, date),
      activities, unscheduled: [], outside, conflicts: [...conflicts]};
  }

  const plan = fitActivities(slots, activities, firstId);
  return {
    items: timelineItems([...fixed, ...plan.items], activities, date, firstId),
    activities,
    unscheduled: plan.activities.flatMap((activity, index) => {
      const remaining = activities[index].minutes - activity.minutes + activity.remaining;
      return remaining ? [{...activities[index], remaining}] : [];
    }),
    outside,
    conflicts: [...conflicts],
  };
}

function shuffleRoutineSessions(items, activities, date, firstId) {
  const dateNumber = Date.parse(date) / 86400000;
  const movable = new Set(activities.filter(activity =>
    activity.id !== firstId && !activity.date && activity.notBefore === undefined)
    .map(activity => activity.id));
  const group = new Map();
  let seed = dateNumber >>> 0;

  function shuffleGroup() {
    if (group.size > 1) {
      const sessions = [...group.values()];
      const order = [...sessions];
      // Cycle the opening activity when the same group runs on consecutive days.
      const first = (dateNumber % order.length + order.length) % order.length;
      [order[0], order[first]] = [order[first], order[0]];
      for (let index = order.length - 1; index > 1; index--) {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        const other = 1 + seed % index;
        [order[index], order[other]] = [order[other], order[index]];
      }

      // Keep the total window, including its idle gaps and reserved breaks.
      const gaps = sessions.slice(1).map(([item], index) => item.start - sessions[index].at(-1).end);
      let start = sessions[0][0].start;
      order.forEach((session, index) => {
        const offset = start - session[0].start;
        for (const item of session) {
          item.start += offset;
          item.end += offset;
          for (const pause of item.breaks || []) {
            pause.start += offset;
            pause.end += offset;
          }
        }
        start = session.at(-1).end + (gaps[index] ?? 0);
      });
    }
    group.clear();
  }

  for (let index = 0; index < items.length; index++) {
    const item = items[index];
    const pause = items[index + 1]?.sessionBreak ? items[index + 1] : undefined;
    if (pause) index++;
    // A short break uses the last minutes before a fixed boundary.
    if (!movable.has(item.activityId) || (pause && pause.end - pause.start < splitBreakMinutes)) {
      shuffleGroup();
      continue;
    }
    if (group.has(item.activityId)) shuffleGroup();
    group.set(item.activityId, pause ? [item, pause] : [item]);
  }
  shuffleGroup();
}

function timelineItems(items, activities, date, firstId) {
  items.sort((a, b) => a.start - b.start);
  if (date) {
    shuffleRoutineSessions(items, activities, date, firstId);
    items.sort((a, b) => a.start - b.start);
  }
  const sessions = new Map();
  for (const item of items) {
    if (!item.activityId) continue;
    if (!sessions.has(item.activityId)) sessions.set(item.activityId, []);
    sessions.get(item.activityId).push(item);
  }
  for (const group of sessions.values()) {
    if (group.length < 2) continue;
    group.forEach((item, index) => {
      item.tag = item.category || item.title;
      item.title += ' · Focus ' + (index + 1);
    });
  }
  return items;
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

function fitActivities(slots, activities, firstId, requireFirst = true) {
  const pack = (minutes, keepOpening = requireFirst) => packActivities(slots, activities.map((activity, index) => ({
    ...activity, minutes: minutes[index],
  })), firstId, keepOpening);
  const goals = activities.map(activity => activity.minutes);
  const full = pack(goals);
  const fits = plan => plan.activities.every(activity => !activity.remaining);
  if (fits(full)) return full;
  const opening = activities.find(activity => activity.id === firstId);
  if (requireFirst && opening?.notBefore > slots[0]?.start) {
    const relaxed = pack(goals, false);
    if (fits(relaxed)) return relaxed;
  }

  const minutes = goals.map(() => 1);
  let best = pack(minutes);
  if (!fits(best) && firstId && requireFirst) {
    // Reuse earlier gaps if the opening session otherwise leaves an activity without time.
    return fitActivities(slots, activities, firstId, false);
  }
  if (!fits(best)) return full;

  // Protect the opener, then today's additions and recent routine edits.
  const latest = Math.max(0, ...activities.filter(activity => !activity.date).map(activity => activity.priority || 0));
  const groups = [[], [], [], []];
  activities.forEach((activity, index) => {
    const group = activity.id === firstId ? 0 : activity.date ? 1 : latest && activity.priority === latest ? 2 : 3;
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

function packActivities(availability, activities, firstId, requireFirst = true) {
  const slots = availability.map(slot => ({...slot}));
  const scheduled = new Map();
  const items = [];
  const first = activities.find(activity => activity.id === firstId);
  const reserved = activities.filter(activity => activity !== first && activity.notBefore !== undefined);
  if (first) reserved.unshift(first);
  for (const activity of reserved) {
    const notBefore = activity.notBefore ?? 0;
    const late = [];
    for (const slot of slots) {
      if (slot.end > notBefore) late.push({start: Math.max(slot.start, notBefore), end: slot.end});
    }
    const opening = activity === first;
    const result = packSessions(late, [activity], opening);
    const start = opening && requireFirst ? result.items[0]?.start : undefined;
    const earlier = slots.filter(slot => slot.start < notBefore)
      .map(slot => ({start: slot.start, end: Math.min(slot.end, notBefore)}));
    slots.splice(0, slots.length, ...earlier, ...result.slots);
    if (start !== undefined) {
      while (slots.length && slots[0].end <= start) slots.shift();
    }
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

function packSessions(slots, activities, opening = false) {
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

  const full = placeFlexible(slots, flexible, splitBreakMinutes, !opening);
  const fitsFullSessions = opening || full.activities.every(activity => !activity.remaining);
  const packed = fitsFullSessions ? full : placeFlexible(slots, flexible, splitBreakMinutes, false);
  const spare = packed.slots.reduce((sum, slot) => sum + slot.end - slot.start, 0);
  const breaks = packed.items.filter(item => !item.id).length;
  let sessions = packed;
  if (!opening && breaks && spare && packed.activities.every(activity => !activity.remaining)) {
    const spacing = Math.min(180, splitBreakMinutes + Math.floor(spare / breaks));
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
          items.push({start: slot.start, end: Math.min(slot.start + splitBreakMinutes, slot.end),
            title: 'Break', sessionBreak: true});
          slot.start = Math.min(slot.start + spacing, slot.end);
        }
        scheduled = true;
      }
      if (!scheduled) break;
    }
  }
  return {slots, activities: pending, items};
}
