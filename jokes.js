const fallbackDadJokes = [
  'I only know 25 letters of the alphabet. I don’t know y.',
  'Why did the scarecrow win an award? He was outstanding in his field.',
  'What do you call a factory that makes good products? A satisfactory.',
  'Why did the bicycle fall over? It was two-tired.',
  'I used to hate facial hair, but then it grew on me.',
  'What do you call a fish wearing a bow tie? Sofishticated.',
  'Why do melons have weddings? Because they cantaloupe.',
];
const dadJokesByDate = new Map();
const shownDadJokes = new Set();

function dadJokeFor(date) {
  if (!dadJokesByDate.has(date)) dadJokesByDate.set(date, fetchDadJoke(date));
  return dadJokesByDate.get(date);
}

async function fetchDadJoke(date) {
  const key = 'daylight:joke:' + date;
  let previous;
  try { previous = sessionStorage.getItem(key); } catch {}
  const isFresh = joke => joke && joke !== previous && !shownDadJokes.has(joke);
  let joke;
  try {
    const response = await fetch('https://icanhazdadjoke.com/', {
      headers: {Accept: 'application/json'}, cache: 'no-store', signal: AbortSignal.timeout(3500),
    });
    if (response.ok) {
      const result = await response.json();
      if (typeof result.joke === 'string' && isFresh(result.joke.trim())) joke = result.joke.trim();
    }
  } catch {}
  if (!joke) {
    const unused = fallbackDadJokes.filter(isFresh);
    const options = unused.length ? unused : fallbackDadJokes.filter(text => text !== previous);
    joke = options[Math.floor(Math.random() * options.length)];
  }
  shownDadJokes.add(joke);
  try { sessionStorage.setItem(key, joke); } catch {}
  return joke;
}
