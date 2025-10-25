// Supabase via CDN
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const postsContainer = document.getElementById('posts');
const postTemplate   = document.getElementById('post-template');
const aboutTemplate  = document.getElementById('about-template');

// ENV aus index.html
const SUPABASE_URL  = window.env?.SUPABASE_URL;
const SUPABASE_ANON = window.env?.SUPABASE_ANON;
if (!SUPABASE_URL || !SUPABASE_ANON) {
  console.error('Supabase ENV fehlt. Bitte window.env in index.html prüfen.');
}
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON);

/* ===========================
   UI <-> DB Mapping
   =========================== */
const UI_KEYS = ['video','about','news','thoughts'];
const KEY_TO_DB = {
  video: 'video blog',
  about: 'about',
  news: 'news',
  thoughts: 'thoughts',
};

/* ===========================
   YouTube-ID Parser
   =========================== */
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

/* ===========================
   Card Renderer
   =========================== */
function createPost(row) {
  const { title, description, youtube_url, image_url, published_at } = row;
  const tpl = postTemplate.content.cloneNode(true);

  const thumb = tpl.querySelector('.thumb');
  const img   = tpl.querySelector('.thumb-img');

  // Share-URL/-Text
  let shareUrl  = window.location.origin + window.location.pathname + window.location.hash;
  let shareText = title || 'Beitrag';
  if (youtube_url && /^https?:\/\//i.test(youtube_url)) {
    shareUrl = youtube_url;
  } else if (image_url && /^https?:\/\//i.test(image_url)) {
    shareUrl = image_url;
  }

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

  // Share-Bar (Label + Icon)
let shareBar = tpl.querySelector('.share-bar');
if (!shareBar) {
  shareBar = document.createElement('nav');
  shareBar.className = 'share-bar';
  shareBar.setAttribute('aria-label', 'Beitrag teilen');
}

// immer Inhalt setzen – auch wenn shareBar schon existiert
shareBar.innerHTML = `
  <button class="share-btn share-native" type="button" aria-label="Teilen">
    <img src="images/share.png" alt="" width="18" height="18">
    <span>Teilen</span>
  </button>

  <a class="share-btn share-fb" href="#" target="_blank" rel="noopener" aria-label="Auf Facebook teilen">
    <img src="images/fb.png" alt="" width="18" height="18">
    <span>Facebook</span>
  </a>

  <a class="share-btn share-wa" href="#" target="_blank" rel="noopener" aria-label="Per WhatsApp teilen">
    <img src="images/whatsapp.svg" alt="" width="18" height="18">
    <span>WhatsApp</span>
  </a>

  <button class="share-btn share-copy" type="button" aria-label="Link kopieren">
    <img src="images/copy-link.png" alt="" width="18" height="18">
    <span>Link kopieren</span>
  </button>
`;

// sinnvoll einhängen (fallback, falls .post-meta fehlt)
const metaHost = tpl.querySelector('.post-meta') || tpl;
if (!shareBar.parentNode) metaHost.appendChild(shareBar);

// Links/Handler binden (wie gehabt)
const btnNative = shareBar.querySelector('.share-native');
const aFB      = shareBar.querySelector('.share-fb');
const aWA      = shareBar.querySelector('.share-wa');
const btnCopy  = shareBar.querySelector('.share-copy');

if (aFB) aFB.href = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`;
if (aWA) {
  const msg = `${shareText} ${shareUrl}`;
  aWA.href = `https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`;
}

btnNative?.addEventListener('click', async () => {
  if (navigator.share) {
    try { await navigator.share({ title: shareText, url: shareUrl, text: shareText }); } catch {}
  } else {
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`, '_blank', 'noopener');
  }
});

btnCopy?.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(shareUrl);
    const old = btnCopy.innerHTML;
    btnCopy.innerHTML = `<img src="images/link.png" alt="" width="18" height="18"><span>Kopiert!</span>`;
    setTimeout(() => (btnCopy.innerHTML = old), 1400);
  } catch {
    window.prompt('Link kopieren:', shareUrl);
  }
});

  return tpl;
}

/* ===========================
   About Renderer (statisch)
   =========================== */
function renderAbout() {
  postsContainer.innerHTML = '';
  if (!aboutTemplate) {
    postsContainer.innerHTML = '<p style="opacity:.7">About-Inhalt (Template) fehlt.</p>';
    return;
  }
  const node = aboutTemplate.content.cloneNode(true);

  // Datum „aktualisiert am …“
  const timeEl = node.querySelector('.post-date');
  if (timeEl) {
    const d = new Date();
    timeEl.textContent = `Aktualisiert am ${d.toLocaleDateString('de-DE')}`;
    timeEl.setAttribute('datetime', d.toISOString().slice(0,10));
  }

  postsContainer.appendChild(node);
}

/* ===========================
   Helpers
   =========================== */
function getKeyFromHash() {
  const key = (location.hash || '').replace('#', '').trim();
  return UI_KEYS.includes(key) ? key : 'video';
}
function setActiveButton(key) {
  document.querySelectorAll('.chip-nav .chip').forEach(b => {
    b.classList.toggle('is-active', b.dataset.key === key);
  });
}

/* ===========================
   Daten laden (Posts)
   =========================== */
async function loadPosts(uiKey) {
  const safeKey = UI_KEYS.includes(uiKey) ? uiKey : 'video';

  if (safeKey === 'about') {
    renderAbout();
    return;
  }

  const dbCategory = KEY_TO_DB[safeKey] || 'video blog';
  postsContainer.innerHTML = '<p style="opacity:.7">Lade Beiträge…</p>';

  let { data, error } = await supabase
    .from('posts')
    .select('title, description, youtube_url, image_url, published_at, created_at, category')
    .eq('category', dbCategory)
    .order('published_at', { ascending: false })
    .order('created_at', { ascending: false });

  // Fallback, falls 'category' (noch) fehlt
  const missingColumn =
    error && (String(error.code) === '42703' || /column .*category.* does not exist/i.test(error.message));

  if (missingColumn) {
    ({ data, error } = await supabase
      .from('posts')
      .select('title, description, youtube_url, image_url, published_at, created_at, category')
      .order('published_at', { ascending: false })
      .order('created_at', { ascending: false }));

    if (error) {
      console.error(error);
      postsContainer.innerHTML = '<p style="color:#c00">Fehler beim Laden der Beiträge.</p>';
      return;
    }
    data = (data || []).filter(r => (r.category || 'video blog') === dbCategory);
  } else if (error) {
    console.error(error);
    postsContainer.innerHTML = '<p style="color:#c00">Fehler beim Laden der Beiträge.</p>';
    return;
  }

  postsContainer.innerHTML = '';
  if (!data || data.length === 0) {
    postsContainer.innerHTML = `<p style="opacity:.7">Keine Beiträge in „${safeKey}“ gefunden.</p>`;
    return;
  }

  data.forEach(row => postsContainer.appendChild(createPost(row)));
}

/* ===========================
   Events
   =========================== */
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

/* ===========================
   Init
   =========================== */
(function init() {
  const key = getKeyFromHash();
  setActiveButton(key);
  loadPosts(key);
})();

async function fetchNewsFromSupabase(){
  const url = window.env?.SUPABASE_URL;
  const key = window.env?.SUPABASE_ANON;

  // Wenn du die View nutzt, ersetze 'news' -> 'news_public'
  const endpoint = `${url}/rest/v1/news?select=title,description,youtube_url,image_url,published_at&order=published_at.desc`;

  const res = await fetch(endpoint, {
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      Prefer: "return=representation"  // ok, kann auch entfallen bei SELECT
    }
  });
  if (!res.ok) throw new Error("News fetch failed");
  return await res.json();
}

async function fetchNewsFromSupabase(){
  const url = window.env?.SUPABASE_URL;
  const key = window.env?.SUPABASE_ANON;
  const endpoint = `${url}/rest/v1/news?select=title,description,youtube_url,image_url,published_at&order=published_at.desc`;

  const res = await fetch(endpoint, {
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      Prefer: "return=representation"
    }
  });
  if (!res.ok) throw new Error("News fetch failed");
  return await res.json();
}

// 3) === Render-Funktion für Neuigkeiten ===
const postsHost = document.getElementById('posts');

async function renderNews(){
  postsHost.innerHTML = '';

  const data = await fetchNewsFromSupabase();

  if (!data?.length){
    postsHost.innerHTML = `<p style="padding:1rem;">Keine Neuigkeiten gefunden.</p>`;
    return;
  }
  for (const row of data){
    postsHost.appendChild(createPost(row));  // nutzt dein bestehendes createPost
  }
}

// 4) === Tabs verdrahten (Neuigkeiten-Button) ===
const chips = document.querySelectorAll('.chip-nav .chip');
chips.forEach(btn => {
  btn.addEventListener('click', async () => {
    chips.forEach(c => c.classList.remove('is-active'));
    btn.classList.add('is-active');

    const key = btn.dataset.key;
    if (key === 'news') {
      await renderNews();
    }
    // else if (...) -> deine anderen Tabs (video/about/thoughts)
  });
});

// Optional: Wenn beim Laden schon "Neuigkeiten" aktiv ist, direkt rendern
const activeChip = document.querySelector('.chip-nav .chip.is-active');
if (activeChip?.dataset.key === 'news') {
  renderNews();
}

async function fetchNewsFromSupabase(){
  const url = window.env?.SUPABASE_URL;
  const key = window.env?.SUPABASE_ANON;
  const endpoint = `${url}/rest/v1/news?select=title,description,youtube_url,image_url,published_at&order=published_at.desc`;
  const res = await fetch(endpoint, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
  if (!res.ok) throw new Error("News fetch failed");
  return await res.json();
}



async function renderNews(){
  postsHost.innerHTML = '';
  const data = await fetchNewsFromSupabase();
  if (!data?.length){
    postsHost.innerHTML = `<p style="padding:1rem;">Keine Neuigkeiten gefunden.</p>`;
    return;
  }
  for (const row of data){
    postsHost.appendChild(createPost(row));
  }
}


chips.forEach(btn => {
  btn.addEventListener('click', async () => {
    chips.forEach(c => c.classList.remove('is-active'));
    btn.classList.add('is-active');

    const key = btn.dataset.key;
    if (key === 'news') {
      await renderNews();
    }
    // … deine anderen Tabs (video/about/thoughts)
  });
});

// Falls „Neuigkeiten“ beim Laden aktiv ist:
const active = document.querySelector('.chip-nav .chip.is-active');
if (active?.dataset.key === 'news') renderNews();

