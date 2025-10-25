// Supabase via CDN (kein Build notwendig)
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const postsContainer = document.getElementById('posts');
const postTemplate   = document.getElementById('post-template');
const aboutTemplate  = document.getElementById('about-template');

// ENV aus index.html
const SUPABASE_URL  = window.env?.SUPABASE_URL;
const SUPABASE_ANON = window.env?.SUPABASE_ANON;

if (!SUPABASE_URL || !SUPABASE_ANON) {
  console.error("Supabase ENV fehlt. Bitte window.env in index.html prüfen.");
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON);

/* ===========================
   UI <-> DB Mapping
   (Wir verwenden EXAKT die Keys, die du im HTML nutzt.)
   =========================== */
const UI_KEYS  = ['video blog', 'about', 'news', 'thoughts'];
// DB-Kategorie = UI-Key (1:1)
const KEY_TO_DB = {
  'video blog': 'video blog',
  'about': 'about',
  'news': 'news',
  'thoughts': 'thoughts',
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

  // Share-URL/Share-Text bestimmen
  let shareUrl = window.location.origin + window.location.pathname + window.location.hash;
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

  // --- Share-Leiste (Label + Icon) --------------------------
  let shareBar = tpl.querySelector('.share-bar');
  if (!shareBar) {
    shareBar = document.createElement('nav');
    shareBar.className = 'share-bar';
    shareBar.setAttribute('aria-label', 'Beitrag teilen');
    shareBar.innerHTML = `
      <button class="share-btn share-native" type="button" aria-label="Teilen">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M18 8a3 3 0 1 0-2.82-4H15a3 3 0 0 0 0 6h.18A3 3 0 0 0 18 8ZM6 14a3 3 0 1 0-2.83 2H3a3 3 0 0 0 0-6h.17A3 3 0 0 0 6 14Zm12 0a3 3 0 1 0-2.83 2H15a3 3 0 0 0 0-6h.17A3 3 0 0 0 18 14ZM8.59 13l6.12-3.06-.9-1.8L7.7 11.2l.89 1.8Zm6.12 1.06L8.59 17l-.9-1.8 6.12-3.06.9 1.92Z"/>
        </svg>
        <span>Teilen</span>
      </button>

      <a class="share-btn share-fb" href="#" target="_blank" rel="noopener" aria-label="Auf Facebook teilen">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M13.5 22v-8h2.6l.4-3h-3V9.1c0-.9.3-1.5 1.6-1.5H16V5.1c-.3 0-1.2-.1-2.3-.1-2.3 0-3.7 1.2-3.7 3.9V11H7v3h3v8h3.5z"/>
        </svg>
        <span>Facebook</span>
      </a>

      <a class="share-btn share-wa" href="#" target="_blank" rel="noopener" aria-label="Per WhatsApp teilen">
        <img src="images/whatsapp.svg" alt="" class="share-icon">
        <span>WhatsApp</span>
      </a>

      <button class="share-btn share-copy" type="button" aria-label="Link kopieren">
        <img src="images/iconmonstr-link-1.png" alt="" class="share-icon">
        <span>Link kopieren</span>
      </button>
    `;
    tpl.querySelector('.post-meta')?.appendChild(shareBar);
  }

  // Links/Handler verdrahten
  const btnNative = shareBar.querySelector('.share-native');
  const aFB      = shareBar.querySelector('.share-fb');
  const aWA      = shareBar.querySelector('.share-wa');
  const btnCopy  = shareBar.querySelector('.share-copy');

  // Facebook & WhatsApp-URLs
  if (aFB) aFB.href = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`;
  if (aWA) {
    const msg = `${shareText} ${shareUrl}`;
    aWA.href = `https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`;
  }

  // Native Share (mit Fallback)
  btnNative?.addEventListener('click', async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: shareText, url: shareUrl, text: shareText });
      } catch { /* user canceled */ }
    } else {
      window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`, '_blank', 'noopener');
    }
  });

  // Copy Link
  btnCopy?.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      const old = btnCopy.innerHTML;
      btnCopy.innerHTML = `<img src="images/iconmonstr-link-1.png" alt="" class="share-icon"><span>Kopiert!</span>`;
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
  const raw = (location.hash || '').slice(1);
  const key = decodeURIComponent(raw || '').trim();
  return UI_KEYS.includes(key) ? key : 'video blog';
}
function setActiveButton(key) {
  document.querySelectorAll('.chip-nav .chip').forEach(b => {
    b.classList.toggle('is-active', (b.dataset.key || '') === key);
  });
}

/* ===========================
   Daten laden (Posts)
   =========================== */
async function loadPosts(uiKey) {
  const safeKey = UI_KEYS.includes(uiKey) ? uiKey : 'video blog';

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

  // Fallback, falls 'category' noch nicht existiert
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
    const key = btn.dataset.key || '';
    if (!UI_KEYS.includes(key)) return;

    setActiveButton(key);
    const hash = `#${encodeURIComponent(key)}`;
    if (location.hash !== hash) history.replaceState(null, '', hash);
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
