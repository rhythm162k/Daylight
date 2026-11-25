function createDateKey(timeZone) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
  });
  return date => {
    const parts = Object.fromEntries(formatter.formatToParts(date).map(part => [part.type, part.value]));
    return parts.year + '-' + parts.month + '-' + parts.day;
  };
}
const prayerDate = createDateKey('Asia/Dhaka');
const tomorrow = date => new Date(date.getTime() + 86400000);

function timetableEntry(district, date) {
  const key = prayerDate(date).slice(5);
  const table = bangladeshTimetable[district];
  return table[key] ?? table['02-28'].map((value, i) => Math.min(value, table['03-01'][i]));
}

function solarEvents(latitude, longitude, date) {
  const angle = Math.PI / 180;
  const day = new Date(prayerDate(date) + 'T00:00:00Z');
  const ordinal = (day - Date.UTC(day.getUTCFullYear(), 0, 1)) / 86400000;
  const phase = 2 * Math.PI * ordinal / 365;
  const declination = 0.006918 - 0.399912 * Math.cos(phase) + 0.070257 * Math.sin(phase)
    - 0.006758 * Math.cos(2 * phase) + 0.000907 * Math.sin(2 * phase)
    - 0.002697 * Math.cos(3 * phase) + 0.00148 * Math.sin(3 * phase);
  const lat = latitude * angle;
  const solarNoon = -4 * longitude;
  const hourAngle = elevation => Math.acos((Math.sin(elevation) - Math.sin(lat) * Math.sin(declination))
    / (Math.cos(lat) * Math.cos(declination))) / angle * 4;
  const hanafiAsr = Math.atan(1 / (2 + Math.tan(Math.abs(lat - declination))));
  return [
    solarNoon - hourAngle(-18 * angle),
    solarNoon - hourAngle(-0.833 * angle),
    solarNoon + hourAngle(hanafiAsr),
    solarNoon + hourAngle(-0.833 * angle),
    solarNoon + hourAngle(-18 * angle),
    solarNoon,
  ];
}

function prayerTimesFor(district, date, boundaries) {
  if (Object.hasOwn(bangladeshTimetable, district)) return timetableEntry(district, date);
  const center = districtCenter(district, boundaries);
  if (!center) return null;
  const {latitude, longitude} = center;
  const dhakaPosition = solarEvents(23.8103, 90.4125, date);
  const districtPosition = solarEvents(latitude, longitude, date);
  return timetableEntry('Dhaka', date).map((minute, i) => Math.round(minute + districtPosition[i] - dhakaPosition[i]));
}

function deadlineMinutes(district, date, boundaries) {
  const today = prayerTimesFor(district, date, boundaries);
  const next = prayerTimesFor(district, tomorrow(date), boundaries);
  if (!today || !next) return null;
  const [, sunrise, asr, maghrib, isha] = today;
  // The Foundation timetable adds three minutes to Maghrib and Fajr starts.
  return [sunrise, asr, maghrib - 3, isha, next[0] - 3];
}

function forbiddenPrayerPeriods(district, date, boundaries) {
  const times = prayerTimesFor(district, date, boundaries);
  if (!times) return [];
  const [, sunrise, , maghrib, , dhuhr] = times;
  const sunset = maghrib - 3;
  return [
    {start: sunrise, end: sunrise + 24, reason: 'Sunrise'},
    {start: dhuhr - 6, end: dhuhr, reason: 'Solar noon'},
    {start: sunset - 24, end: sunset, reason: 'Sunset'},
  ];
}
