// Supabase via CDN (kein Build notwendig)
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const postsContainer = document.getElementById('posts');
const template = document.getElementById('post-template');

// ENV aus index.html
const SUPABASE_URL = window.env?.SUPABASE_URL;
const SUPABASE_ANON = window.env?.SUPABASE_ANON;

if (!SUPABASE_URL || !SUPABASE_ANON) {
  console.error("Supabase ENV fehlt. Bitte window.env in index.html prüfen.");
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON);

// -------------------------------
// YouTube-ID Parser (unverändert)
// -------------------------------
function extractYouTubeId(input) {
  if (!input) return null;
  if (/^[0-9A-Za-z_-]{11}$/.test(input)) return input;

  try {
    const u = new URL(input);
    const v = u.searchParams.get('v');
    if (v && /^[0-9A-Za-z_-]{11}$/.test(v)) return v;

    if (u.hostname.endsWith('youtu.be')) {
      const id = u.pathname.slice(1).split('/')[0];
      if (/^[0-9A-Za-z_-]{11}$/.test(id)) return id;
    }

    if (u.pathname.startsWith('/shorts/')) {
      const id = u.pathname.split('/shorts/')[1].split('/')[0];
      const clean = id.split(/[?&]/)[0];
      if (/^[0-9A-Za-z_-]{11}$/.test(clean)) return clean;
    }

    const m = u.pathname.match(/\/embed\/([0-9A-Za-z_-]{11})/);
    if (m) return m[1];
  } catch (_) {
    if (/^[0-9A-Za-z_-]{11}$/.test(input)) return input;
  }

  const last = String(input).match(/([0-9A-Za-z_-]{11})(?!.*[0-9A-Za-z_-]{11})/);
  return last ? last[1] : null;
}

// -------------------------------
// Card-Renderer (unverändert)
// -------------------------------
function createPost({ title, description, youtube_url, image_url, published_at }) {
  const tpl = template.content.cloneNode(true);

  const thumb = tpl.querySelector('.thumb');
  const img = tpl.querySelector('.thumb-img');

  if (youtube_url) {
    const id = extractYouTubeId(youtube_url);
    if (id) {
      img.src = `https://img.youtube.com/vi/${id}/hqdefault.jpg`;
      img.alt = title || 'Vorschaubild';
      const clickHref = youtube_url.startsWith('http')
        ? youtube_url
        : `https://www.youtube.com/watch?v=${id}`;
      thumb.addEventListener('click', () => {
        window.open(clickHref, '_blank', 'noopener');
      });
    } else {
      thumb.remove();
    }
  } else if (image_url) {
    img.src = image_url;
    img.alt = title || 'Bild';
  } else {
    thumb.remove();
  }

  const timeEl = tpl.querySelector('.post-date');
  if (published_at) {
    const d = new Date(published_at);
    if (!Number.isNaN(d.getTime())) {
      timeEl.textContent = d.toLocaleDateString('de-DE');
      timeEl.setAttribute('datetime', d.toISOString().slice(0,10));
    }
  }

  tpl.querySelector('.post-title').textContent = title || '';
  tpl.querySelector('.post-desc').innerHTML = (description || '').replace(/\n/g, '<br>');

  return tpl;
}

// -------------------------------
// Kategorien / Buttons / Hash
// -------------------------------
const ALLOWED = new Set(['video','about','news','thoughts']);

function getKeyFromHash() {
  const key = (location.hash || '').replace('#', '').trim();
  return ALLOWED.has(key) ? key : 'video';
}

function setActiveButton(key) {
  document.querySelectorAll('.chip-nav .chip').forEach(b => {
    b.classList.toggle('is-active', b.dataset.key === key);
  });
}

// -------------------------------
// Daten laden (robust, mit Fallback)
// -------------------------------
async function loadPosts(categoryKey) {
  const key = ALLOWED.has(categoryKey) ? categoryKey : 'video';
  postsContainer.innerHTML = '<p style="opacity:.7">Lade Beiträge…</p>';

  // Wir holen ALLE Posts (inkl. category), damit es auch funktioniert,
  // wenn deine Tabelle die Spalte "category" noch nicht hat.
  const { data, error } = await supabase
    .from('posts')
    .select('title, description, youtube_url, image_url, published_at, created_at, category')
    .order('published_at', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) {
    console.error(error);
    postsContainer.innerHTML = '<p style="color:#c00">Fehler beim Laden der Beiträge.</p>';
    return;
  }

  // Clientseitig nach category filtern (failsafe, funktioniert auch ohne Spalte)
  const rows = Array.isArray(data) ? data : [];
  const filtered = rows.filter(r => (r.category || 'video') === key);

  postsContainer.innerHTML = '';
  if (filtered.length === 0) {
    postsContainer.innerHTML = `<p style="opacity:.7">Keine Beiträge in „${key}“ gefunden.</p>`;
    return;
  }

  filtered.forEach(row => postsContainer.appendChild(createPost(row)));
}

// -------------------------------
// Event-Bindings
// -------------------------------
document.querySelectorAll('.chip-nav .chip').forEach(btn => {
  btn.addEventListener('click', () => {
    const key = btn.dataset.key;
    if (!ALLOWED.has(key)) return;

    // Active-State
    setActiveButton(key);

    // Hash setzen (teilbar/bookmarkbar) ohne Sprung nach oben
    if (location.hash !== `#${key}`) {
      history.replaceState(null, '', `#${key}`);
    }

    // Laden
    loadPosts(key);

    // Optional: sanft nach oben
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
});

// Hash-Navigation (Back/Forward)
window.addEventListener('hashchange', () => {
  const key = getKeyFromHash();
  setActiveButton(key);
  loadPosts(key);
});

// -------------------------------
// Initiale Ladung
// -------------------------------
(function init() {
  const key = getKeyFromHash();
  setActiveButton(key);
  loadPosts(key);
})();
