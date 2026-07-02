(function () {
    const FALLBACK = {
        floris:   { subs: 119521, lifetimeSubs: 244892, views: 648215, favs: 6416, stars: 5, numRatings: 2972 },
        medieval: { subs: 97294,  lifetimeSubs: 214738, views: 529250, favs: 7279, stars: 5, numRatings: 3181 },
        tainted:  { subs: 31496,  lifetimeSubs: 84809,  views: 226521, favs: 3356, stars: 5, numRatings: 1103 }
    };

    function formatCompact(n) {
        if (n >= 1000000) return (n / 1000000).toFixed(1).replace(/\.0$/, '') + 'M+';
        if (n >= 1000) return (n / 1000).toFixed(0) + 'K+';
        return n.toString();
    }

    function starGlyphs(stars) {
        const full = Math.max(0, Math.min(5, Math.round(Number(stars) || 0)));
        return '★'.repeat(full) + '☆'.repeat(5 - full);
    }

    function renderStats(data) {
        Object.keys(FALLBACK).forEach(key => {
            const raw = data[key] || {};
            const fb = FALLBACK[key];
            const d = {
                subs: raw.subs != null ? raw.subs : fb.subs,
                lifetimeSubs: raw.lifetimeSubs != null ? raw.lifetimeSubs : fb.lifetimeSubs,
                views: raw.views != null ? raw.views : fb.views,
                favs: raw.favs != null ? raw.favs : fb.favs,
                stars: raw.stars != null ? raw.stars : fb.stars,
                numRatings: raw.numRatings != null ? raw.numRatings : fb.numRatings
            };
            try {
                const subsEl = document.getElementById(`stat-${key}-subs`);
                const lifeEl = document.getElementById(`stat-${key}-lifetime`);
                const viewsEl = document.getElementById(`stat-${key}-views`);
                const favsEl = document.getElementById(`stat-${key}-favs`);
                const ratingEl = document.getElementById(`rating-${key}`);
                if (subsEl) subsEl.textContent = d.subs.toLocaleString();
                if (lifeEl) lifeEl.textContent = d.lifetimeSubs.toLocaleString();
                if (viewsEl) viewsEl.textContent = d.views.toLocaleString();
                if (favsEl) favsEl.textContent = d.favs.toLocaleString();
                if (ratingEl) ratingEl.textContent = `${starGlyphs(d.stars)} (${d.numRatings.toLocaleString()} ratings)`;
            } catch (err) {
                console.warn(`Render failed for ${key}:`, err);
            }
        });
        renderBars(data);
        renderHeroStrip(data);
    }

    function renderBars(data) {
        try {
            const keys = Object.keys(FALLBACK);
            const maxViews = Math.max(...keys.map(k => (data[k] || FALLBACK[k]).views)) || 1;
            keys.forEach(key => {
                const d = data[key] || FALLBACK[key];
                ['subs', 'lifetimeSubs', 'views'].forEach(metric => {
                    const bar = document.getElementById(`bar-${key}-${metric}`);
                    if (bar) {
                        const pct = Math.max(4, (d[metric] / maxViews) * 100);
                        requestAnimationFrame(() => { bar.style.width = pct + '%'; });
                    }
                });
            });
        } catch (err) {
            console.warn("renderBars failed:", err);
        }
    }

function fillBar(id, value, visualMax) {
    try {
        const bar = document.getElementById(id);
        if (!bar) return;
        const pct = Math.min(100, (value / visualMax) * 100);
        requestAnimationFrame(() => { bar.style.height = pct + '%'; });
    } catch (err) {
        console.warn(`fillBar failed for ${id}:`, err);
    }
}

    function renderHeroStrip(data) {
        try {
            const keys = Object.keys(FALLBACK);
            const values = keys.map(k => data[k] || FALLBACK[k]);
            const totalLifetime = values.reduce((s, d) => s + (d.lifetimeSubs || 0), 0);
            const totalViews = values.reduce((s, d) => s + (d.views || 0), 0);
            const totalCurrentSubs = values.reduce((s, d) => s + (d.subs || 0), 0);
            const totalProjects = values.length;

            const viewsEl = document.getElementById('hero-stat-views');
            const lifetimeEl = document.getElementById('hero-stat-lifetime');
            const currentSubsEl = document.getElementById('hero-stat-current-subs');
            const projectsEl = document.getElementById('hero-stat-projects');

            if (viewsEl) viewsEl.textContent = formatCompact(totalViews);
            if (lifetimeEl) lifetimeEl.textContent = formatCompact(totalLifetime);
            if (currentSubsEl) currentSubsEl.textContent = formatCompact(totalCurrentSubs);
            if (projectsEl) projectsEl.textContent = totalProjects.toString();

            fillRing('ring-views', totalViews, 1500000);
            fillRing('ring-installs', totalLifetime, 600000);
            fillRing('ring-subs', totalCurrentSubs, 300000);
            fillRing('ring-projects', totalProjects, 5);
        } catch (err) {
            console.warn("renderHeroStrip failed:", err);
        }
    }

    function showBadge(isLive) {
        const badge = document.getElementById('steam-stats-badge');
        if (badge) badge.textContent = isLive ? '● Live adoption data' : '● Showing cached data';
    }

    document.addEventListener("DOMContentLoaded", async function () {
        renderStats(FALLBACK);
        showBadge(false);

        try {
            const res = await fetch('data/steam-stats.json', { cache: 'no-store' });
            if (!res.ok) throw new Error("fetch failed: " + res.status);
            const data = await res.json();
            renderStats(data);
            showBadge(true);
        } catch (err) {
            console.warn("Live stats fetch failed, keeping cached values:", err);
        }
    });
})();
