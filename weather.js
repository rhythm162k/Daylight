const weatherConditions = {
  0: 'Clear sky', 1: 'Mostly clear', 2: 'Partly cloudy', 3: 'Overcast',
  45: 'Fog', 48: 'Freezing fog',
  51: 'Light drizzle', 53: 'Drizzle', 55: 'Heavy drizzle',
  56: 'Freezing drizzle', 57: 'Freezing drizzle',
  61: 'Light rain', 63: 'Rain', 65: 'Heavy rain',
  66: 'Freezing rain', 67: 'Freezing rain',
  71: 'Light snow', 73: 'Snow', 75: 'Heavy snow', 77: 'Snow grains',
  80: 'Light showers', 81: 'Rain showers', 82: 'Heavy showers',
  85: 'Snow showers', 86: 'Heavy snow showers',
  95: 'Thunderstorm', 96: 'Thunderstorm with hail', 99: 'Thunderstorm with hail',
};

function initializeWeather(location) {
  const summary = document.getElementById('weather-summary');
  const place = document.getElementById('weather-location');
  let requestedPlace;
  let request;
  let refreshAt = 0;

  return async function refreshWeather() {
    const forecast = location.forecast;
    if (document.hidden || (forecast === requestedPlace && (request || Date.now() < refreshAt))) return;

    if (forecast !== requestedPlace) {
      request?.abort();
      requestedPlace = forecast;
      summary.textContent = 'Loading weather…';
      place.textContent = forecast.label;
    }

    const controller = new AbortController();
    request = controller;
    const timeout = setTimeout(() => controller.abort(), 10000);
    try {
      const center = await location.coordinatesFor(forecast);
      if (request !== controller) return;
      if (!center) throw new Error('Weather location unavailable');
      const url = new URL('https://api.open-meteo.com/v1/forecast');
      url.search = new URLSearchParams({
        latitude: center.latitude.toFixed(2),
        longitude: center.longitude.toFixed(2),
        current: 'temperature_2m,weather_code',
        temperature_unit: 'celsius',
      });
      const response = await fetch(url, {signal: controller.signal, referrerPolicy: 'no-referrer'});
      if (!response.ok) throw new Error('Weather data unavailable');
      const {current} = await response.json();
      if (!Number.isFinite(current?.temperature_2m)) throw new Error('Temperature unavailable');
      if (request !== controller) return;
      const temperature = document.createElement('strong');
      temperature.textContent = `${Math.round(current.temperature_2m)}°C`;
      const condition = weatherConditions[current.weather_code];
      summary.replaceChildren(temperature, condition ? ' · ' + condition : '');
      refreshAt = Date.now() + 15 * 60 * 1000;
    } catch {
      if (request !== controller) return;
      summary.textContent = 'Weather unavailable';
      refreshAt = Date.now() + 60 * 1000;
    } finally {
      clearTimeout(timeout);
      if (request === controller) request = undefined;
    }
  };
}
