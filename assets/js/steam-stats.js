// ===== LIVE STEAM WORKSHOP STATS =====
(function () {
    const STEAM_PROJECTS = [
        { id: "582428582", key: "floris" },
        { id: "770266833", key: "medieval" },
        { id: "1302156823", key: "tainted" }
    ];

    const FALLBACK = {
        floris:   { subs: 119521, lifetimeSubs: 244890, views: 648214, favs: 6416, stars: 5, numRatings: 2972 },
        medieval: { subs: 97291,  lifetimeSubs: 214736, views: 529247, favs: 7279, stars: 5, numRatings: 3181 },
        tainted:  { subs: 31496,  lifetimeSubs: 84809,  views: 226519, favs: 3356, stars: 5, numRatings: 1103 }
    };

    function formatCompact(n) {
        if (n >= 1000000) return (n / 1000000).toFixed(1).replace(/\.0$/, '') + 'M+';
        if (n >= 1000) return (n / 1000).toFixed(0) + 'K+';
        return n.toString();
    }

    function starGlyphs(stars) {
        const full = Math.round(stars);
        return '★'.repeat(full) + '☆'.repeat(5 - full);
    }

    function renderStats(data) {
        STEAM_PROJECTS.forEach(p => {
            const d = data[p.key];
            if (!d) return;
            const subsEl = document.getElementById(`stat-${p.key}-subs`);
            const lifeEl = document.getElementById(`stat-${p.key}-lifetime`);
            const viewsEl = document.getElementById(`stat-${p.key}-views`);
            const favsEl = document.getElementById(`stat-${p.key}-favs`);
            const ratingEl = document.getElementById(`rating-${p.key}`);
            if (subsEl) subsEl.textContent = d.subs.toLocaleString();
            if (lifeEl) lifeEl.textContent = d.lifetimeSubs.toLocaleString();
            if (viewsEl) viewsEl.textContent = d.views.toLocaleString();
            if (favsEl) favsEl.textContent = d.favs.toLocaleString();
            if (ratingEl && d.stars != null) {
                const ratingsCount = d.numRatings ? d.numRatings.toLocaleString() : '?';
                ratingEl.textContent = `${starGlyphs(d.stars)} (${ratingsCount} ratings)`;
            }
        });
        renderBars(data);
        renderHeroStrip(data);
    }

    function renderBars(data) {
        const maxViews = Math.max(...STEAM_PROJECTS.map(p => data[p.key].views));
        STEAM_PROJECTS.forEach(p => {
            const d = data[p.key];
            ['subs', 'lifetimeSubs', 'views'].forEach((metric) => {
                const bar = document.getElementById(`bar-${p.key}-${metric}`);
                if (bar) {
                    const pct = Math.max(4, (d[metric] / maxViews) * 100);
                    requestAnimationFrame(() => { bar.style.width = pct + '%'; });
                }
            });
        });
    }

    function renderHeroStrip(data) {
        const values = Object.values(data);
        const totalLifetime = values.reduce((sum, d) => sum + (d.lifetimeSubs || 0), 0);
        const totalViews = values.reduce((sum, d) => sum + (d.views || 0), 0);
        const lifetimeEl = document.getElementById('hero-stat-lifetime');
        const viewsEl = document.getElementById('hero-stat-views');
        if (lifetimeEl) lifetimeEl.textContent = formatCompact(totalLifetime);
        if (viewsEl) viewsEl.textContent = formatCompact(totalViews);
    }

    function showLiveBadge(isLive) {
        const badge = document.getElementById('steam-stats-badge');
        if (!badge) return;
        badge.textContent = isLive
            ? '● Live adoption data'
            : '● Showing cached data (live fetch unavailable)';
    }

    async function fetchCoreStats() {
        const endpoint = "https://api.steampowered.com/ISteamRemoteStorage/GetPublishedFileDetails/v1/";
        const proxied = "https://proxy.cors.sh/" + endpoint;

        const body = new URLSearchParams();
        body.append("itemcount", STEAM_PROJECTS.length.toString());
        STEAM_PROJECTS.forEach((p, i) => body.append(`publishedfileids[${i}]`, p.id));

        const res = await fetch(proxied, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: body.toString()
        });
        if (!res.ok) throw new Error("Bad response " + res.status);
        const json = await res.json();
        const details = json.response.publishedfiledetails;

        const parsed = {};
        details.forEach(item => {
            const proj = STEAM_PROJECTS.find(p => p.id === item.publishedfileid);
            if (!proj) return;
            parsed[proj.key] = {
                subs: Math.round(Number(item.subscriptions)),
                lifetimeSubs: Math.round(Number(item.lifetime_subscriptions)),
                views: Math.round(Number(item.views)),
                favs: Math.round(Number(item.lifetime_favorited))
            };
        });
        return parsed;
    }

    async function fetchRating(project) {
        try {
            const pageUrl = `https://steamcommunity.com/sharedfiles/filedetails/?id=${project.id}`;
            const proxied = "https://proxy.cors.sh/" + pageUrl;
            const res = await fetch(proxied, { headers: { "User-Agent": "Mozilla/5.0" } });
            if (!res.ok) throw new Error("Bad response " + res.status);
            const text = await res.text();

            const starMatch = text.match(/\/(\d)(?:_half)?-star_large\.png/);
            const numMatch = text.match(/numRatings">([\d,]+) ratings/);

            return {
                stars: starMatch ? Number(starMatch[1]) : null,
                numRatings: numMatch ? Number(numMatch[1].replace(/,/g, '')) : null
            };
        } catch (err) {
            console.warn(`Rating fetch failed for ${project.key}:`, err);
            return null;
        }
    }

    async function fetchSteamStats() {
        try {
            const coreStats = await fetchCoreStats();

            const ratingResults = await Promise.all(STEAM_PROJECTS.map(fetchRating));
            STEAM_PROJECTS.forEach((p, i) => {
                const rating = ratingResults[i];
                if (coreStats[p.key] && rating) {
                    coreStats[p.key].stars = rating.stars;
                    coreStats[p.key].numRatings = rating.numRatings;
                } else if (coreStats[p.key]) {
                    coreStats[p.key].stars = FALLBACK[p.key].stars;
                    coreStats[p.key].numRatings = FALLBACK[p.key].numRatings;
                }
            });

            renderStats(coreStats);
            showLiveBadge(true);
        } catch (err) {
            console.warn("Live Steam stats fetch failed, using cached fallback:", err);
            renderStats(FALLBACK);
            showLiveBadge(false);
        }
    }

    document.addEventListener("DOMContentLoaded", fetchSteamStats);
})();
