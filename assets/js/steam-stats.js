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

    // Safely merges live data over fallback so every field always has a value,
    // even if the live fetch only partially succeeded.
    function withFallback(key, liveData) {
        const base = FALLBACK[key];
        if (!liveData) return { ...base };
        return {
            subs: liveData.subs != null ? liveData.subs : base.subs,
            lifetimeSubs: liveData.lifetimeSubs != null ? liveData.lifetimeSubs : base.lifetimeSubs,
            views: liveData.views != null ? liveData.views : base.views,
            favs: liveData.favs != null ? liveData.favs : base.favs,
            stars: liveData.stars != null ? liveData.stars : base.stars,
            numRatings: liveData.numRatings != null ? liveData.numRatings : base.numRatings
        };
    }

    function renderStats(rawData) {
        // Build a complete, safe dataset before rendering anything, so a
        // missing/malformed entry for one project can never break the others.
        const data = {};
        STEAM_PROJECTS.forEach(p => {
            data[p.key] = withFallback(p.key, rawData[p.key]);
        });

        STEAM_PROJECTS.forEach(p => {
            const d = data[p.key];
            try {
                const subsEl = document.getElementById(`stat-${p.key}-subs`);
                const lifeEl = document.getElementById(`stat-${p.key}-lifetime`);
                const viewsEl = document.getElementById(`stat-${p.key}-views`);
                const favsEl = document.getElementById(`stat-${p.key}-favs`);
                const ratingEl = document.getElementById(`rating-${p.key}`);
                if (subsEl) subsEl.textContent = d.subs.toLocaleString();
                if (lifeEl) lifeEl.textContent = d.lifetimeSubs.toLocaleString();
                if (viewsEl) viewsEl.textContent = d.views.toLocaleString();
                if (favsEl) favsEl.textContent = d.favs.toLocaleString();
                if (ratingEl) {
                    ratingEl.textContent = `${starGlyphs(d.stars)} (${d.numRatings.toLocaleString()} ratings)`;
                }
            } catch (err) {
                console.warn(`Render failed for ${p.key}:`, err);
            }
        });

        renderBars(data);
        renderHeroStrip(data);
    }

    function renderBars(data) {
        try {
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
        } catch (err) {
            console.warn("renderBars failed:", err);
        }
    }

    function renderHeroStrip(data) {
        try {
            const values = Object.values(data);
            const totalLifetime = values.reduce((sum, d) => sum + (d.lifetimeSubs || 0), 0);
            const totalViews = values.reduce((sum, d) => sum + (d.views || 0), 0);
            const totalProjects = values.length;

            const lifetimeEl = document.getElementById('hero-stat-lifetime');
            const viewsEl = document.getElementById('hero-stat-views');
            const projectsEl = document.getElementById('hero-stat-projects');

            if (lifetimeEl) lifetimeEl.textContent = formatCompact(totalLifetime);
            if (viewsEl) viewsEl.textContent = formatCompact(totalViews);
            if (projectsEl) projectsEl.textContent = totalProjects.toString();
        } catch (err) {
            console.warn("renderHeroStrip failed:", err);
        }
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
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
                "x-requested-with": "XMLHttpRequest"
            },
            body: body.toString()
        });
        if (!res.ok) throw new Error("Bad response " + res.status);
        const json = await res.json();
        const details = json.response.publishedfiledetails;

        const parsed = {};
        details.forEach(item => {
            // Compare as strings — Steam's API can return publishedfileid as
            // either a string or a number depending on the item, and a strict
            // === comparison against our string IDs would otherwise silently
            // fail to match, leaving that project undefined downstream.
            const itemId = String(item.publishedfileid);
            const proj = STEAM_PROJECTS.find(p => p.id === itemId);
            if (!proj) return;
            parsed[proj.key] = {
                subs: Math.round(Number(item.subscriptions)) || 0,
                lifetimeSubs: Math.round(Number(item.lifetime_subscriptions)) || 0,
                views: Math.round(Number(item.views)) || 0,
                favs: Math.round(Number(item.lifetime_favorited)) || 0
            };
        });
        return parsed;
    }

    async function fetchRating(project) {
        try {
            const pageUrl = `https://steamcommunity.com/sharedfiles/filedetails/?id=${project.id}`;
            const proxied = "https://proxy.cors.sh/" + pageUrl;
            const res = await fetch(proxied, {
                headers: { "x-requested-with": "XMLHttpRequest" }
            });
            if (!res.ok) throw new Error("Bad response " + res.status);
            const text = await res.text();

            const starMatch = text.match(/\/(\d)(?:_half)?-star_large\.png/);
            const numMatch = text.match(/numRatings">([\d,]+) ratings/);

            if (!starMatch || !numMatch) {
                console.warn(`Rating parse incomplete for ${project.key}, using cached value.`);
                return null;
            }

            return {
                stars: Number(starMatch[1]),
                numRatings: Number(numMatch[1].replace(/,/g, ''))
            };
        } catch (err) {
            console.warn(`Rating fetch failed for ${project.key}:`, err);
            return null;
        }
    }

    async function fetchSteamStats() {
        let coreStats = {};
        let coreSucceeded = false;

        try {
            coreStats = await fetchCoreStats();
            coreSucceeded = true;
        } catch (err) {
            console.warn("Core stats fetch failed, using cached fallback:", err);
        }

        // Ratings are fetched independently — even if this fails entirely,
        // it must never block the core subscriber/view stats from rendering.
        let ratingResults = STEAM_PROJECTS.map(() => null);
        try {
            ratingResults = await Promise.all(STEAM_PROJECTS.map(fetchRating));
        } catch (err) {
            console.warn("Rating fetch batch failed:", err);
        }

        STEAM_PROJECTS.forEach((p, i) => {
            const rating = ratingResults[i];
            if (!coreStats[p.key]) coreStats[p.key] = {};
            if (rating && rating.stars != null && rating.numRatings != null) {
                coreStats[p.key].stars = rating.stars;
                coreStats[p.key].numRatings = rating.numRatings;
            }
        });

        renderStats(coreStats);
        showLiveBadge(coreSucceeded);
    }

    document.addEventListener("DOMContentLoaded", fetchSteamStats);
})();
