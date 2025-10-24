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

  // Rückfall: letztes 11er-Token nehmen
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

// (Optional) Active-State der Navigation
document.querySelectorAll('.chip-nav .chip').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.chip-nav .chip').forEach(b => b.classList.remove('is-active'));
    btn.classList.add('is-active');
  });
});

/* ========= NAV-Overlay exakt ausrichten =========
   Overlay (#nav-overlay) beginnt GENAU unter dem Header-BILD (headerImg.bottom)
   und endet an der Unterkante der Navigation (nav.bottom).
   → Header bleibt 100% sichtbar.
*/
(function setupNavOverlay(){
  const nav       = document.querySelector('.chip-nav');
  const headerImg = document.querySelector('.header-img');
  const veil      = document.getElementById('nav-overlay');
  if (!nav || !headerImg || !veil) return;

  let ticking = false;
  let lastTop = null;
  let lastH   = null;

  function measure(){
    const navRect   = nav.getBoundingClientRect();
    const imgRect   = headerImg.getBoundingClientRect();

    // Start exakt an der Unterkante des Header-Bildes
    const top = Math.round(imgRect.bottom);

    // Ende an der Unterkante der Navi
    const bottomY = Math.round(navRect.bottom);

    // Höhe = Bereich zwischen Bildunterkante und Nav-Unterkante
    const height = Math.max(0, bottomY - top);
    return { top, height };
  }

  function apply({ top, height }){
    if (top !== lastTop) {
      veil.style.top = `${top}px`;
      lastTop = top;
    }
    if (height !== lastH) {
      veil.style.height = `${height}px`;
      lastH = height;
    }
  }

  function onFrame(){
    apply(measure());
  }

  function onScrollOrResize(){
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      onFrame();
      ticking = false;
    });
  }

  // Events
  window.addEventListener('scroll', onScrollOrResize, { passive: true });
  window.addEventListener('resize', onScrollOrResize, { passive: true });
  window.addEventListener('orientationchange', onScrollOrResize, { passive: true });
  window.addEventListener('pageshow', onScrollOrResize, { passive: true });

  // iOS Safari: VisualViewport kann sich separat bewegen
  if (window.visualViewport) {
    visualViewport.addEventListener('scroll', onScrollOrResize, { passive: true });
    visualViewport.addEventListener('resize', onScrollOrResize, { passive: true });
  }

  // Beobachte Bild- und Nav-Größe (Wrap/Aspekt/Load)
  const ro = new ResizeObserver(onScrollOrResize);
  ro.observe(nav);
  ro.observe(headerImg);

  // Headerbild kann async laden → bei Load neu messen
  if (!headerImg.complete) {
    headerImg.addEventListener('load', onScrollOrResize, { once: true });
  }

  // Initial + kleine Nachstabilisierungen
  window.addEventListener('load', () => {
    onScrollOrResize();
    setTimeout(onScrollOrResize, 50);
    setTimeout(onScrollOrResize, 250);
    setTimeout(onScrollOrResize, 800);
  });
})();
