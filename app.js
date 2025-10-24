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

/* ========= NAV-Overlay: Position + Höhe exakt ausrichten =========
   Overlay (#nav-overlay) beginnt JETZT unterhalb des HEADERS und
   endet wie bisher an der berechneten Unterkante (Nav-Bottom + Extra - BottomOffset). */
(function setupNavOverlay(){
  const header = document.querySelector('.site-header');
  const nav    = document.querySelector('.chip-nav');
  const veil   = document.getElementById('nav-overlay');
  if (!header || !nav || !veil) return;

  const readPxVar = (name, fallback = 0) => {
    const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    if (!v) return fallback;
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : fallback;
  };

  let ticking = false;
  let lastTop = null;
  let lastH   = null;

  function measure(){
    const headerRect = header.getBoundingClientRect();
    const navRect    = nav.getBoundingClientRect();

    const topOffset    = readPxVar('--nav-overlay-top-offset');      // jetzt 0px
    const bottomOffset = readPxVar('--nav-overlay-bottom-offset');   // z.B. -10
    const extra        = readPxVar('--nav-overlay-extra');           // z.B. 80

    // OVERLAY START: direkt UNTER dem Header
    const top = Math.round(headerRect.bottom + topOffset);

    // OVERLAY ENDE: wie bisher – Nav-Bottom inkl. Extra & Bottom-Offset
    // (negativer Bottom-Offset erweitert nach unten)
    const bottomY = Math.round(navRect.bottom - bottomOffset + extra);

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

  // Beobachte Header- und Nav-Höhe (Wrap/Zeilenumbrüche, Fonts etc.)
  const ro = new ResizeObserver(onScrollOrResize);
  ro.observe(header);
  ro.observe(nav);

  // Initial + kleine Nachstabilisierungen
  window.addEventListener('load', () => {
    onScrollOrResize();
    setTimeout(onScrollOrResize, 50);
    setTimeout(onScrollOrResize, 250);
    setTimeout(onScrollOrResize, 800);
  });
})();
