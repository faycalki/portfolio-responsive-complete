import json
import re
import os
import requests

PROJECTS = {
    "582428582": "floris",
    "770266833": "medieval",
    "1302156823": "tainted"
}

FALLBACK = {
    "floris":   {"subs": 119521, "lifetimeSubs": 244890, "views": 648214, "favs": 6416, "stars": 5, "numRatings": 2972},
    "medieval": {"subs": 97291,  "lifetimeSubs": 214736, "views": 529247, "favs": 7279, "stars": 5, "numRatings": 3181},
    "tainted":  {"subs": 31496,  "lifetimeSubs": 84809,  "views": 226519, "favs": 3356, "stars": 5, "numRatings": 1103}
}

HEADERS = {"User-Agent": "Mozilla/5.0"}


def fetch_core_stats():
    url = "https://api.steampowered.com/ISteamRemoteStorage/GetPublishedFileDetails/v1/"
    data = {"itemcount": len(PROJECTS)}
    for i, pid in enumerate(PROJECTS.keys()):
        data[f"publishedfileids[{i}]"] = pid

    resp = requests.post(url, data=data, headers=HEADERS, timeout=20)
    resp.raise_for_status()
    result = {}
    for item in resp.json()["response"]["publishedfiledetails"]:
        pid = str(item.get("publishedfileid"))
        key = PROJECTS.get(pid)
        if not key:
            continue
        result[key] = {
            "subs": int(float(item.get("subscriptions", 0))),
            "lifetimeSubs": int(float(item.get("lifetime_subscriptions", 0))),
            "views": int(float(item.get("views", 0))),
            "favs": int(float(item.get("lifetime_favorited", 0)))
        }
    return result


def fetch_rating(pid):
    try:
        page_url = f"https://steamcommunity.com/sharedfiles/filedetails/?id={pid}"
        resp = requests.get(page_url, headers=HEADERS, timeout=20)
        resp.raise_for_status()
        text = resp.text

        star_match = re.search(r'/(\d)(?:_half)?-star_large\.png', text)
        num_match = re.search(r'numRatings">([\d,]+) ratings', text)

        if not star_match or not num_match:
            return None

        return {
            "stars": int(star_match.group(1)),
            "numRatings": int(num_match.group(1).replace(",", ""))
        }
    except Exception as e:
        print(f"Rating fetch failed for {pid}: {e}")
        return None


def main():
    try:
        core = fetch_core_stats()
    except Exception as e:
        print(f"Core stats fetch failed entirely: {e}")
        core = {}

    output = {}
    for pid, key in PROJECTS.items():
        base = dict(FALLBACK[key])
        if key in core:
            base.update(core[key])

        rating = fetch_rating(pid)
        if rating:
            base["stars"] = rating["stars"]
            base["numRatings"] = rating["numRatings"]

        output[key] = base

    os.makedirs("data", exist_ok=True)
    with open("data/steam-stats.json", "w") as f:
        json.dump(output, f, indent=2)

    print(json.dumps(output, indent=2))


if __name__ == "__main__":
    main()
