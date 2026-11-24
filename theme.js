(() => {
  const key = 'daylight:theme';
  const root = document.documentElement;
  const themeColor = document.querySelector('meta[name="theme-color"]');
  let dark = false;

  function applyTheme() {
    root.dataset.theme = dark ? 'dark' : 'light';
    themeColor.content = dark ? '#131b21' : '#f7f6ef';
  }

  try { dark = localStorage.getItem(key) === 'dark'; } catch {}
  applyTheme();

  document.addEventListener('DOMContentLoaded', () => {
    const button = document.getElementById('theme-toggle');
    button.setAttribute('aria-pressed', String(dark));
    button.addEventListener('click', () => {
      root.classList.add('theme-motion');
      dark = !dark;
      applyTheme();
      button.setAttribute('aria-pressed', String(dark));
      try { localStorage.setItem(key, root.dataset.theme); } catch {}
    });
  });
})();
