# ☀ Daylight

Daylight builds a daily plan around your waking hours, fixed commitments, and the time you want to spend on each activity. It runs on plain HTML, CSS, and JavaScript without an account or backend.

## Set up your day

- **Routine.** Set your usual wake time and bedtime, then add fixed commitments such as work or commuting. Choose which days each commitment repeats.
- **Activities.** Enter active minutes for each activity. Choose one session with a five-minute break after each 30 minutes of work, or split the activity into blocks of up to two hours. The plan shows any minutes that could not be scheduled.
- **Prayer.** Choose no prayer section, the built-in Bangladesh Salah timetable, or a custom section. Giving a custom entry a time reserves space in the plan. Untimed entries appear in the prayer checklist.
- **Progress.** Use the weekly calendar to view a day and check off activities or prayers. Edit the routine from the plan, or use **Settings** to change the routine and prayer preferences.

## Run locally

From the folder containing `index.html`, run:

```sh
python3 -m http.server 8000
```

Open [http://localhost:8000](http://localhost:8000). Serving the folder over HTTP lets the browser load the district map.

## Publish on GitHub Pages

1. Push the contents of the extracted `daylight` folder to a repository’s `main` branch. Keep `index.html` and `.nojekyll` at the repository root.
2. Open **Settings → Pages** in that repository. Choose **Deploy from a branch**, then select **main** and **/(root)** and save.
3. Open the published URL shown in **Settings → Pages**. The default Pages URL uses HTTPS, which is required for browser location access on a deployed site.

[GitHub Pages publishing guide](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)

Your settings and checkmarks are stored in your browser for the site’s address. On the original address, browsers with existing checkmarks or district preferences retain the original weekly plan until they choose to replace it. That original routine is included in the static source for compatibility. A new address starts with its own storage.

Generated routines use the browser’s local time. Salah cutoffs and live forbidden periods use Bangladesh time. The hero shows Dhaka weather by default. Use the location pin to update the forecast with your browser’s location permission. Daylight remembers approximate coordinates on this device. A matched Bangladesh district also updates the optional Salah timetable.

## Prayer data and credits

Dhaka and Mymensingh use Kivabe’s published district tables based on the Islamic Foundation Bangladesh permanent timetable. Other districts use location-adjusted estimates. February 29 uses neighboring dates as an estimate. The forbidden periods follow the Foundation timetable notes, including the exception for that day’s Asr before sunset.

[Dhaka table](https://kivabe.com/namaz/?zilla=1&month=12) · [Mymensingh table](https://kivabe.com/namaz/?zilla=37&month=12) · [Islamic Foundation timetable PDF](https://kivabe.com/namaz/Calender_permanent_namaz_time.pdf)

District boundaries are from Bangladesh Bureau of Statistics and OCHA ROAP via [geoBoundaries](https://www.geoboundaries.org/), licensed under [CC BY 3.0 IGO](https://creativecommons.org/licenses/by/3.0/igo/). Coordinates are rounded in the bundled map.
