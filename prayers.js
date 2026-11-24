const defaultPrayerDistrict = 'Mymensingh';
const prayerPreferenceKey = 'daylight:prayer-location';
const prayerDate = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Dhaka',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});
const tomorrow = date => new Date(date.getTime() + 86400000);

function timetableEntry(district, date) {
  const key = prayerDate.format(date).slice(5);
  const table = bangladeshTimetable[district];
  return table[key] ?? table['02-28'].map((value, i) => Math.min(value, table['03-01'][i]));
}

function solarEvents(latitude, longitude, date) {
  const angle = Math.PI / 180;
  const day = new Date(prayerDate.format(date) + 'T00:00:00Z');
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

function insideRing(x, y, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function districtAt(latitude, longitude, boundaries) {
  for (const [district, [box, polygons]] of Object.entries(boundaries)) {
    if (longitude < box[0] || longitude > box[2] || latitude < box[1] || latitude > box[3]) continue;
    if (polygons.some(([outer, ...holes]) => insideRing(longitude, latitude, outer)
      && !holes.some(hole => insideRing(longitude, latitude, hole)))) return district;
  }
}

function prayerTimesFor(district, date, boundaries) {
  if (Object.hasOwn(bangladeshTimetable, district)) return timetableEntry(district, date);
  const box = boundaries?.[district]?.[0];
  if (!box) return null;
  const latitude = (box[1] + box[3]) / 2;
  const longitude = (box[0] + box[2]) / 2;
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

function readPrayerLocation() {
  try {
    const saved = JSON.parse(localStorage.getItem(prayerPreferenceKey));
    if (districtNames.includes(saved?.district)) return {district: saved.district, auto: saved.auto === true};
  } catch {}
  return {district: defaultPrayerDistrict, auto: false};
}

function initializePrayerLocation(onChange) {
  let preference = readPrayerLocation();
  let boundaryRequest;
  let requestId = 0;
  let boundaries;
  const select = document.getElementById('prayer-district');
  const button = document.getElementById('use-location');
  const status = document.getElementById('location-status');
  const districtData = () => {
    boundaryRequest ??= fetch('bd-districts.json').then(response => {
      if (!response.ok) throw new Error('District map unavailable');
      return response.json();
    }).catch(error => {
      boundaryRequest = undefined;
      throw error;
    });
    return boundaryRequest;
  };
  function persist() {
    try { localStorage.setItem(prayerPreferenceKey, JSON.stringify(preference)); } catch {}
  }
  function selectDistrict(district, auto) {
    preference = {district, auto};
    select.value = district;
    persist();
    onChange();
  }
  async function loadDistrict(district) {
    if (Object.hasOwn(bangladeshTimetable, district) || boundaries) return;
    try {
      boundaries = await districtData();
      onChange();
    } catch {
      status.textContent = 'Could not load district data. Try choosing the district again.';
    }
  }
  async function locate() {
    if (!navigator.geolocation) {
      status.textContent = 'Location access is unavailable. Choose your district below.';
      return;
    }
    const id = ++requestId;
    status.textContent = 'Finding your district…';
    button.disabled = true;
    try {
      const position = await new Promise((resolve, reject) => navigator.geolocation.getCurrentPosition(
        resolve, reject, {timeout: 10000, maximumAge: 0},
      ));
      boundaries = await districtData();
      if (id !== requestId) return;
      const {latitude, longitude} = position.coords;
      const district = districtAt(latitude, longitude, boundaries);
      if (!district) {
        status.textContent = 'Couldn’t match your location to a Bangladesh district. Choose it below.';
        return;
      }
      selectDistrict(district, true);
      status.textContent = 'Using your location. Choose a district manually to turn this off.';
    } catch (error) {
      if (id !== requestId) return;
      status.textContent = error.code === 1
        ? 'Location access is off. Choose your district below.'
        : 'Couldn’t detect your district. Choose it below or try again.';
    } finally {
      if (id === requestId) button.disabled = false;
    }
  }
  select.replaceChildren(...districtNames.map(name => new Option(name, name)));
  select.value = preference.district;
  select.addEventListener('change', () => {
    requestId++;
    button.disabled = false;
    status.textContent = '';
    selectDistrict(select.value, false);
    loadDistrict(select.value);
  });
  button.addEventListener('click', locate);
  loadDistrict(preference.district);
  if (preference.auto && navigator.permissions) {
    navigator.permissions.query({name: 'geolocation'}).then(permission => {
      if (permission.state === 'granted' && preference.auto && requestId === 0) locate();
    }).catch(() => {});
  }
  return {
    get district() { return preference.district; },
    forbiddenPeriods(date) { return forbiddenPrayerPeriods(preference.district, date, boundaries); },
    deadlines(date) { return deadlineMinutes(preference.district, date, boundaries); },
  };
}
