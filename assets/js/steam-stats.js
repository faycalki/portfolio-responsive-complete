// ===== LIVE STEAM WORKSHOP STATS =====
(function () {
    const STEAM_PROJECTS = [
        { id: "582428582", key: "floris" },
        { id: "770266833", key: "medieval" },
        { id: "1302156823", key: "tainted" }
    ];

    const FALLBACK = {
        floris:   { subs: 119521, lifetimeSubs: 244890, views: 648214, favs: 6416 },
        medieval: { subs: 97291,  lifetimeSubs: 214736, views: 529247, favs: 7279 },
        tainted:  { subs: 31496,  lifetimeSubs: 84809,  views: 226519, favs: 3356 }
    };

    function formatNumber(n) {
        if (n >= 1000000) return (n / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
        if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
        return n.toString();
    }

    function renderStats(data) {
        STEAM_PROJECTS.forEach(p => {
            const d = data[p.key];
            if (!d) return;
            const subsEl = document.getElementById(`stat-${p.key}-subs`);
            const lifeEl = document.getElementById(`stat-${p.key}-lifetime`);
            const viewsEl = document.getElementById(`stat-${p.key}-views`);
            const favsEl = document.getElementById(`stat-${p.key}-favs`);
            if (subsEl) subsEl.textContent = d.subs.toLocaleString();
            if (lifeEl) lifeEl.textContent = d.lifetimeSubs.toLocaleString();
            if (viewsEl) viewsEl.textContent = d.views.toLocaleString();
            if (favsEl) favsEl.textContent = d.favs.toLocaleString();
        });
        renderChart(data);
    }

    function renderChart(data) {
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

    function showLiveBadge(isLive) {
        const badge = document.getElementById('steam-stats-badge');
        if (!badge) return;
        if (isLive) {
            badge.textContent = '● Live data from Steam Workshop API';
        } else {
            badge.textContent = '● Showing cached data (live fetch unavailable)';
        }
    }

    async function fetchSteamStats() {
        const endpoint = "https://api.steampowered.com/ISteamRemoteStorage/GetPublishedFileDetails/v1/";
        const proxied = "https://proxy.cors.sh/" + endpoint;

        const body = new URLSearchParams();
        body.append("itemcount", STEAM_PROJECTS.length.toString());
        STEAM_PROJECTS.forEach((p, i) => body.append(`publishedfileids[${i}]`, p.id));

        try {
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

            renderStats(parsed);
            showLiveBadge(true);
        } catch (err) {
            console.warn("Live Steam stats fetch failed, using cached fallback:", err);
            renderStats(FALLBACK);
            showLiveBadge(false);
        }
    }

    document.addEventListener("DOMContentLoaded", fetchSteamStats);
})();
