# ☀ Daylight

Daylight builds a daily plan around your waking hours, fixed commitments, and the time you want to spend on each activity. It runs on plain HTML, CSS, and JavaScript without an account or backend.

## Set up your day

- **Routine.** Set your usual wake time and bedtime, then add fixed commitments such as work or commuting. Choose which days each commitment repeats.
- **Activities.** Add or remove activities in **Edit routine**. Set active minutes and choose every day, selected weekdays, or today only. **First every day** makes an activity the opener on its scheduled days. **First today** overrides the usual opener for the current day. The other recurring activities shuffle by date. Choose one session with short breaks or split it across the day.
- **Prayer.** Use the edit button on the Prayer card to set up the Bangladesh Salah timetable or a custom checklist. A custom checklist uses **Prayer** as its title when you leave the title blank. Giving a custom entry a time reserves space in the plan.
- **Progress.** Use the weekly calendar to view today or an earlier day and check off activities or prayers. Future days show a dad joke from [icanhazdadjoke](https://icanhazdadjoke.com/api) until the day starts. Refresh a future day for another joke.

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

Your settings and checkmarks are stored in your browser for the site’s address. On the original address, browsers with existing checkmarks or district preferences can edit the original weekly plan directly. A new address starts with its own storage.

Generated routines use the browser’s local time. Salah cutoffs and live forbidden periods use Bangladesh time. The hero shows Dhaka weather by default. Use the location pin to update the forecast with your browser’s location permission. Daylight remembers approximate coordinates on this device. A matched Bangladesh district also updates the optional Salah timetable.

## Prayer data and credits

Dhaka and Mymensingh use Kivabe’s published district tables based on the Islamic Foundation Bangladesh permanent timetable. Other districts use location-adjusted estimates. February 29 uses neighboring dates as an estimate. The forbidden periods follow the Foundation timetable notes, including the exception for that day’s Asr before sunset.

[Dhaka table](https://kivabe.com/namaz/?zilla=1&month=12) · [Mymensingh table](https://kivabe.com/namaz/?zilla=37&month=12) · [Islamic Foundation timetable PDF](https://kivabe.com/namaz/Calender_permanent_namaz_time.pdf)

District boundaries are from Bangladesh Bureau of Statistics and OCHA ROAP via [geoBoundaries](https://www.geoboundaries.org/), licensed under [CC BY 3.0 IGO](https://creativecommons.org/licenses/by/3.0/igo/). Coordinates are rounded in the bundled map.
