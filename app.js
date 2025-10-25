// Supabase via CDN (kein Build notwendig)
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// === DOM-Refs ===
const postsContainer = document.getElementById('posts');
const postTemplate   = document.getElementById('post-template');
const aboutTemplate  = document.getElementById('about-template');

// === ENV aus index.html ===
const SUPABASE_URL = window.env?.SUPABASE_URL;
const SUPABASE_ANON = window.env?.SUPABASE_ANON;

if (!SUPABASE_URL || !SUPABASE_ANON) {
  console.error('[RLB] Supabase ENV fehlt. Bitte window.env in index.html prüfen.');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON);

// ===========================
// UI <-> DB Mapping
// ===========================
const UI_KEYS = ['video', 'about', 'news', 'thoughts'];
const KEY_TO_DB = {
  video: 'video blog',
  about: 'about',
  news: 'news',
  thoughts: 'thoughts',
};

// ===========================
// YouTube-ID Parser
// ===========================
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
  } catch {
    /* ignore */
  }

  const last = String(input).match(/([0-9A-Za-z_-]{11})(?!.*[0-9A-Za-z_-]{11})/);
  return last ? last[1] : null;
}

// ===========================
// Card Renderer
// ===========================
function createPost(row) {
  const { title, description, youtube_url, image_url, published_at } = row;
  const tpl = postTemplate.content.cloneNode(true);

  const thumb = tpl.querySelector('.thumb');
  const img   = tpl.querySelector('.thumb-img');

  // Thumbnail
  if (youtube_url) {
    const id = extractYouTubeId(youtube_url);
    if (id) {
      img.src = `https://img.youtube.com/vi/${id}/hqdefault.jpg`;
      img.alt = title || 'Vorschaubild';
      const clickHref = youtube_url.startsWith('http')
        ? youtube_url
        : `https://www.youtube.com/watch?v=${id}`;
      thumb?.addEventListener('click', () => window.open(clickHref, '_blank', 'noopener'));
    } else {
      thumb?.remove();
    }
  } else if (image_url) {
    img.src = image_url;
    img.alt = title || 'Bild';
  } else {
    thumb?.remove();
  }

  // Datum
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

// ===========================
// About Renderer (statisch)
// ===========================
function renderAbout() {
  postsContainer.innerHTML = '';
  if (!aboutTemplate) {
    postsContainer.innerHTML = '<p style="opacity:.7">About-Inhalt (Template) fehlt.</p>';
    return;
  }
  const node = aboutTemplate.content.cloneNode(true);

  // Datum „Aktualisiert am …“
  const timeEl = node.querySelector('.post-date');
  if (timeEl) {
    const d = new Date();
    timeEl.textContent = `Aktualisiert am ${d.toLocaleDateString('de-DE')}`;
    timeEl.setAttribute('datetime', d.toISOString().slice(0,10));
  }

  postsContainer.appendChild(node);
}

// ===========================
// Helpers
// ===========================
function getKeyFromHash() {
  const key = (location.hash || '').replace('#', '').trim();
  return UI_KEYS.includes(key) ? key : 'video';
}

function setActiveButton(key) {
  document.querySelectorAll('.chip-nav .chip').forEach(b => {
    b.classList.toggle('is-active', b.dataset.key === key);
  });
}

// ===========================
// Daten laden (Posts)
// ===========================
async function loadPosts(uiKey) {
  const safeKey = UI_KEYS.includes(uiKey) ? uiKey : 'video';

  if (safeKey === 'about') {
    console.log('[RLB] renderAbout()');
    renderAbout();
    return;
  }

  const dbCategory = KEY_TO_DB[safeKey] || 'video blog';
  postsContainer.innerHTML = '<p style="opacity:.7">Lade Beiträge…</p>';

  console.log('[RLB] Lade Kategorie:', { uiKey: safeKey, dbCategory });

  let { data, error } = await supabase
    .from('posts')
    .select('title, description, youtube_url, image_url, published_at, created_at, category')
    .eq('category', dbCategory)
    .order('published_at', { ascending: false })
    .order('created_at', { ascending: false });

  // Fallback, falls 'category' fehlt (alte DB) ODER eq-Filter nichts liefert
  const missingColumn =
    error && (String(error.code) === '42703' || /column .*category.* does not exist/i.test(error.message));

  if (missingColumn) {
    console.warn('[RLB] Spalte "category" fehlt – lade alle und filtere clientseitig.');
    ({ data, error } = await supabase
      .from('posts')
      .select('title, description, youtube_url, image_url, published_at, created_at, category')
      .order('published_at', { ascending: false })
      .order('created_at', { ascending: false }));
    if (!error && Array.isArray(data)) {
      data = data.filter(r => (r.category || 'video blog') === dbCategory);
    }
  } else if (!error && Array.isArray(data) && data.length === 0) {
    // zweiter Fallback: evtl. Einträge ohne category; lade alle und filtere
    console.warn('[RLB] Serverfilter leer – lade alle und filtere clientseitig.');
    const res = await supabase
      .from('posts')
      .select('title, description, youtube_url, image_url, published_at, created_at, category')
      .order('published_at', { ascending: false })
      .order('created_at', { ascending: false });
    if (!res.error && Array.isArray(res.data)) {
      data = res.data.filter(r => (r.category || 'video blog') === dbCategory);
    }
  }

  if (error) {
    console.error('[RLB] Supabase-Fehler:', error);
    postsContainer.innerHTML = '<p style="color:#c00">Fehler beim Laden der Beiträge.</p>';
    return;
  }

  postsContainer.innerHTML = '';
  if (!data || data.length === 0) {
    postsContainer.innerHTML = `<p style="opacity:.7">Keine Beiträge in „${safeKey}“ gefunden.</p>`;
    console.log('[RLB] 0 Beiträge nach Filter:', { safeKey, dbCategory });
    return;
  }

  console.log('[RLB] Beiträge:', data.length);
  data.forEach(row => postsContainer.appendChild(createPost(row)));
}

// ===========================
// Events
// ===========================
document.querySelectorAll('.chip-nav .chip').forEach(btn => {
  btn.addEventListener('click', () => {
    const key = btn.dataset.key;
    if (!UI_KEYS.includes(key)) return;

    setActiveButton(key);
    if (location.hash !== `#${key}`) history.replaceState(null, '', `#${key}`);
    loadPosts(key);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
});

window.addEventListener('hashchange', () => {
  const key = getKeyFromHash();
  setActiveButton(key);
  loadPosts(key);
});

// ===========================
// Init
// ===========================
(function init() {
  try {
    // Sanity: sind Templates & Container da?
    if (!postsContainer) throw new Error('#posts fehlt');
    if (!postTemplate)   console.warn('[RLB] #post-template fehlt – keine Cards renderbar.');
    if (!aboutTemplate)  console.warn('[RLB] #about-template fehlt – About kann nicht gerendert werden.');

    const key = getKeyFromHash();  // erwartet 'video' beim ersten Laden (oder was im Hash steht)
    setActiveButton(key);
    console.log('[RLB] Init mit Key:', key);
    loadPosts(key);
  } catch (e) {
    console.error('[RLB] Init-Fehler:', e);
    if (postsContainer) {
      postsContainer.innerHTML = '<p style="color:#c00">Initialisierungsfehler – siehe Konsole.</p>';
    }
  }
})();
