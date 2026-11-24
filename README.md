# ☀ Daylight

A personal routine planner with a rotating weekly schedule, a daily checklist, and local salah times for Bangladesh. Daylight runs on plain HTML, CSS, and JavaScript. It has no backend, database, build step, API keys, or sign-in.

## What’s inside

- **Weekly routine.** Each weekday has its own plan, with five hours for the software engineering roadmap, two half-hour job-search blocks, and an hour for WattaDumb.
- **Daily progress.** The next unfinished block appears in its own card. Checkmarks are saved by date in your browser.
- **Salah.** See prayer cutoffs and the three forbidden periods for the selected date and district. A live notice appears under **Salah** during a forbidden period and shows when it ends. Friday directs you to your mosque’s Jumu’ah congregation time.
- **District selection.** Choose a Bangladesh district or use your browser’s location permission. Daylight remembers the district and your location preference. It uses coordinates in memory to find your district.

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

**Visibility and progress.** A standard GitHub Pages deployment is publicly accessible and has no ChatGPT sign-in. Your schedule is visible to visitors, but your checkmarks and district preference stay in your browser. The new site starts with its own browser storage, so progress from the existing Daylight URL does not transfer.

## Customize the routine

| File | What it controls |
| --- | --- |
| `app.js` | Weekday themes, routine blocks, checkmarks, and the live notice |
| `index.html`, `style.css` | Page structure and appearance |
| `prayers.js` | Cutoff rules, forbidden periods, and district detection |
| `prayer-timetable.js` | Bundled Dhaka and Mymensingh daily timetable values |
| `bd-districts.json`, `district-names.js` | District boundaries and names |

Routine start and end times in `app.js` use minutes after midnight. Calendar dates and live times use Bangladesh time (Asia/Dhaka).

## Prayer data and credits

Dhaka and Mymensingh use Kivabe’s published district tables based on the Islamic Foundation Bangladesh permanent timetable. Other districts use location-adjusted estimates. February 29 uses neighboring dates as an estimate. The forbidden periods follow the Foundation timetable notes, including the exception for that day’s Asr before sunset.

[Dhaka table](https://kivabe.com/namaz/?zilla=1&month=12) · [Mymensingh table](https://kivabe.com/namaz/?zilla=37&month=12) · [Islamic Foundation timetable PDF](https://kivabe.com/namaz/Calender_permanent_namaz_time.pdf)

District boundaries are from Bangladesh Bureau of Statistics and OCHA ROAP via [geoBoundaries](https://www.geoboundaries.org/), licensed under [CC BY 3.0 IGO](https://creativecommons.org/licenses/by/3.0/igo/). Coordinates are rounded in the bundled map.
