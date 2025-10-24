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

/* ==== KORREKTE MASKE relativ zum NAV-BEREICH (Buttons) ==== */
/* Wir messen die Überlappung zwischen der Unterkante der NAV und der Oberkante von <main>.
   Die Maske wird auf <main> angewendet – so verschwindet Content unter den Buttons. */
   function updateNavMask() {
    const nav  = document.querySelector('.chip-nav');
    const main = document.querySelector('main');
    if (!nav || !main) return;
  
    // Toleranz gegen Subpixel-Jitter (iOS URL-Bar etc.)
    const EPS = 12; // ruhig großzügig, damit sie zuverlässig „aus“ geht
  
    const navBottom = nav.getBoundingClientRect().bottom; // im Viewport
    const mainTop   = main.getBoundingClientRect().top;   // im Viewport
  
    // Distanz von main-Top bis Nav-Unterkante (in main-Koordinaten)
    const overlapRaw = navBottom - mainTop;
  
    // Wenn keine (nennenswerte) Überlappung -> Maske AUS
    if (overlapRaw <= EPS) {
      document.body.classList.remove('mask-active');
      document.documentElement.style.setProperty('--nav-overlap', '0px');
  
      // Inline-Maske sicher entfernen + Safari zwingen zu repainten
      main.style.webkitMaskImage = 'none';
      main.style.maskImage = 'none';
      main.style.transform = 'translateZ(0)';
      requestAnimationFrame(() => { main.style.transform = ''; });
      return;
    }
  
    // Maske AN: weiche Kante 4–24px unterhalb der Nav-Unterkante
    const overlap   = Math.round(overlapRaw);
    const fadeStart = overlap + 4;
    const fadeEnd   = overlap + 24;
  
    const grad = `linear-gradient(
      to bottom,
      rgba(0,0,0,0) 0,
      rgba(0,0,0,0) ${fadeStart}px,
      rgba(0,0,0,1) ${fadeEnd}px
    )`;
  
    document.body.classList.add('mask-active');
    document.documentElement.style.setProperty('--nav-overlap', `${overlap}px`);
    main.style.webkitMaskImage = grad;
    main.style.maskImage = grad;
  }
  
  // --- Events: kontinuierlich und performant updaten ---
  let ticking = false;
  function onScrollOrResize() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      updateNavMask();
      ticking = false;
    });
  }
  
  window.addEventListener('scroll', onScrollOrResize, { passive: true });
  window.addEventListener('resize', onScrollOrResize, { passive: true });
  window.addEventListener('orientationchange', onScrollOrResize, { passive: true });
  window.addEventListener('pageshow', onScrollOrResize, { passive: true });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') onScrollOrResize();
  });
  
  // iOS Safari: VisualViewport bewegt sich separat → mit beobachten
  if (window.visualViewport) {
    visualViewport.addEventListener('scroll', onScrollOrResize, { passive: true });
    visualViewport.addEventListener('resize', onScrollOrResize, { passive: true });
  }
  
  // initial + kurze Nachstabilisierungen (Font reflow etc.)
  window.addEventListener('load', () => {
    onScrollOrResize();
    setTimeout(onScrollOrResize, 0);
    setTimeout(onScrollOrResize, 250);
    setTimeout(onScrollOrResize, 800);
  });
  

window.addEventListener('load', updateNavMask);
window.addEventListener('resize', updateNavMask, { passive: true });
window.addEventListener('orientationchange', updateNavMask, { passive: true });
window.addEventListener('scroll', updateNavMask, { passive: true });

// kleine Stabilisierung nach Fonts/Wraps
window.addEventListener('load', () => {
  let n = 0;
  const t = setInterval(() => {
    updateNavMask();
    if (++n > 10) clearInterval(t); // ~3s
  }, 300);
});
