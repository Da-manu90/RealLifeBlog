// Supabase via CDN (kein Build notwendig)
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const postsContainer = document.getElementById('posts');
const template = document.getElementById('post-template');

// Werte kommen aus window.env (du hast das Snippet ja in index.html eingefügt)
const SUPABASE_URL = window.env?.SUPABASE_URL;
const SUPABASE_ANON = window.env?.SUPABASE_ANON;

if (!SUPABASE_URL || !SUPABASE_ANON) {
  console.error("Supabase ENV fehlt. Bitte window.env in index.html prüfen.");
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON);

// Robust: YouTube-ID aus watch-, youtu.be-, shorts-, embed- und nackter ID ziehen
function extractYouTubeId(input) {
    if (!input) return null;
  
    // nackte ID?
    if (/^[0-9A-Za-z_-]{11}$/.test(input)) return input;
  
    try {
      const u = new URL(input);
  
      // ?v=VIDEOID
      const v = u.searchParams.get('v');
      if (v && /^[0-9A-Za-z_-]{11}$/.test(v)) return v;
  
      // youtu.be/VIDEOID
      if (u.hostname.endsWith('youtu.be')) {
        const id = u.pathname.slice(1).split('/')[0];
        if (/^[0-9A-Za-z_-]{11}$/.test(id)) return id;
      }
  
      // /shorts/VIDEOID
      if (u.pathname.startsWith('/shorts/')) {
        const id = u.pathname.split('/shorts/')[1].split('/')[0];
        const clean = id.split(/[?&]/)[0];
        if (/^[0-9A-Za-z_-]{11}$/.test(clean)) return clean;
      }
  
      // /embed/VIDEOID
      const m = u.pathname.match(/\/embed\/([0-9A-Za-z_-]{11})/);
      if (m) return m[1];
  
    } catch (_) {
      // war keine URL; vielleicht ist es doch eine ID
      if (/^[0-9A-Za-z_-]{11}$/.test(input)) return input;
    }
  
    // letzte Rückfall-Strategie: 11-Zeichen-Token im String finden
    const last = String(input).match(/([0-9A-Za-z_-]{11})(?!.*[0-9A-Za-z_-]{11})/);
    return last ? last[1] : null;
  }

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
      // Fallback: wenn keine ID erkannt wurde, zeig kein leeres Thumbnail
      thumb.remove();
    }
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

async function loadPosts() {
  postsContainer.innerHTML = '<p style="opacity:.7">Lade Beiträge…</p>';

  const { data, error } = await supabase
    .from('posts')
    .select('title, description, youtube_url, image_url, published_at, created_at')
    .order('published_at', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) {
    console.error(error);
    postsContainer.innerHTML = '<p style="color:#c00">Fehler beim Laden der Beiträge.</p>';
    return;
  }

  postsContainer.innerHTML = '';
  data.forEach(row => postsContainer.appendChild(createPost(row)));
}

loadPosts();

// (Optional) Active-State der Navigation (Filter baue ich dir gern später)
document.querySelectorAll('.chip-nav .chip').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.chip-nav .chip').forEach(b => b.classList.remove('is-active'));
    btn.classList.add('is-active');
  });
});

/* ---- Navi-Höhe an CSS geben, damit body::after korrekt maskiert ---- */
function updateNavMask() {
    const nav = document.querySelector('.chip-nav');
    if (!nav) return;
    const rect = nav.getBoundingClientRect();
    const bottom = Math.max(0, Math.ceil(rect.bottom)); // px ab Viewport-Top
    document.documentElement.style.setProperty('--nav-mask-bottom', `${bottom}px`);
  }
  
  // initial + bei Resize/Rotation neu berechnen
  window.addEventListener('load', updateNavMask);
  window.addEventListener('resize', updateNavMask);
  window.addEventListener('orientationchange', updateNavMask);
  
  // Falls sich die Navi-Höhe durch Fonts/Wrap ändert, alle 300ms kurz bis stabil:
  let _maskTimer = null;
  window.addEventListener('load', () => {
    let n = 0;
    _maskTimer = setInterval(() => {
      updateNavMask();
      if (++n > 10) clearInterval(_maskTimer); // nach ~3s aufhören
    }, 300);
  });
  