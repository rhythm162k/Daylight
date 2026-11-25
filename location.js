const prayerPreferenceKey = 'daylight:prayer-location';
const locationKey = 'daylight:location';
const dhaka = {latitude: 23.81, longitude: 90.41, label: 'Dhaka'};

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

function districtCenter(district, boundaries) {
  const box = boundaries?.[district]?.[0];
  if (!box) return null;
  return {latitude: (box[1] + box[3]) / 2, longitude: (box[0] + box[2]) / 2};
}

function initializeLocation(isLegacy, onChange) {
  const picker = document.getElementById('prayer-district');
  const button = document.getElementById('use-location');
  const status = document.getElementById('location-status');
  const districtStatus = document.getElementById('district-status');
  let saved;
  let previous;
  try {
    saved = JSON.parse(localStorage.getItem(locationKey));
    previous = JSON.parse(localStorage.getItem(prayerPreferenceKey));
  } catch {}

  const oldDistrict = districtNames.includes(previous?.district) ? previous.district : undefined;
  let district = saved?.district || oldDistrict || (isLegacy ? 'Mymensingh' : 'Dhaka');
  let forecast = saved?.forecast || (oldDistrict && oldDistrict !== 'Dhaka' ? {label: oldDistrict} : dhaka);
  let boundaryRequest;
  let boundaries;

  function loadBoundaries() {
    boundaryRequest ??= fetch('bd-districts.json').then(async response => {
      if (!response.ok) throw new Error('District map unavailable');
      boundaries = await response.json();
      return boundaries;
    }).catch(error => {
      boundaryRequest = undefined;
      throw error;
    });
    return boundaryRequest;
  }

  function save() {
    try { localStorage.setItem(locationKey, JSON.stringify({district, forecast})); } catch {}
  }

  async function loadPrayerDistrict() {
    districtStatus.textContent = '';
    if (boundaries || Object.hasOwn(bangladeshTimetable, district)) return;
    try {
      await loadBoundaries();
      onChange();
    } catch {
      if (!Object.hasOwn(bangladeshTimetable, district)) {
        districtStatus.textContent = 'District data is unavailable. Try selecting the district again.';
      }
    }
  }

  picker.replaceChildren(...districtNames.map(name => new Option(name, name)));
  picker.value = district;
  picker.addEventListener('change', () => {
    district = picker.value;
    if (!forecast.detected) forecast = district === 'Dhaka' ? dhaka : {label: district};
    save();
    onChange();
    loadPrayerDistrict();
  });

  button.addEventListener('click', async () => {
    if (!navigator.geolocation) {
      status.textContent = 'Location access is unavailable.';
      return;
    }
    button.disabled = true;
    status.textContent = 'Finding your location…';
    try {
      const {coords: {latitude, longitude}} = await new Promise((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, {timeout: 10000}));
      let detectedDistrict;
      if (latitude >= 20 && latitude <= 27 && longitude >= 88 && longitude <= 93) {
        const map = await loadBoundaries().catch(() => null);
        if (map) detectedDistrict = districtAt(latitude, longitude, map);
      }
      forecast = {
        latitude: Number(latitude.toFixed(2)),
        longitude: Number(longitude.toFixed(2)),
        label: detectedDistrict || 'Current location',
        detected: true,
      };
      if (detectedDistrict) {
        district = picker.value = detectedDistrict;
        districtStatus.textContent = '';
      }
      save();
      status.textContent = '';
      onChange();
    } catch (error) {
      status.textContent = error.code === 1 ? 'Location access was denied.' :
        'Couldn’t get your location. Try again.';
    } finally {
      button.disabled = false;
    }
  });

  return {
    get district() { return district; },
    get forecast() { return forecast; },
    async coordinatesFor(place) {
      return place.latitude === undefined ? districtCenter(place.label, await loadBoundaries()) : place;
    },
    loadPrayerDistrict,
    forbiddenPeriods(date) { return forbiddenPrayerPeriods(district, date, boundaries); },
    deadlines(date) { return deadlineMinutes(district, date, boundaries); },
  };
}
