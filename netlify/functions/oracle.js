const ASSETS = {
  BTC: "bitcoin",
  ETH: "ethereum",
  SOL: "solana"
};

const SPORTDB_API_KEY = process.env.SPORTDB_API_KEY || "";

exports.handler = async function(event) {
  return handleOracle(event.queryStringParameters || {});
};

async function handleOracle(params) {
  const condition = (params.condition || "").trim();
  const explicitType = (params.type || "").trim().toLowerCase();

  if (!condition) {
    return json({ status: "error", result: false, summary: "Missing condition" }, 400);
  }

  const type = explicitType || detectCategory(condition);
  if (type === "crypto_price") return handleCryptoPrice(condition);
  if (type === "sports_result") return handleSportsResult(condition, params);
  if (type === "news_event") return handleNewsEvent(condition);
  if (type === "web_check") return handleWebCheck(condition);

  return json({
    status: "unsupported_condition",
    result: false,
    category: type || "unknown",
    summary: "This condition needs a compatible public data source or manual fallback.",
    condition
  });
}

function detectCategory(condition) {
  const t = condition.toLowerCase();
  if (/\b(btc|bitcoin|eth|ethereum|sol|solana)\b/.test(t) && /\b(above|over|greater than|below|under|less than)\b/.test(t)) {
    return "crypto_price";
  }
  if (/\b(score|winner|won|lost|match|game|arsenal|chelsea|lakers|warriors|real madrid|barcelona|nba|nfl|epl|football|soccer)\b/.test(t)) {
    return "sports_result";
  }
  if (/\b(announce|announced|release|released|launch|launched|happen|happened|did|will|tweet|post|news)\b/.test(t)) {
    return "news_event";
  }
  if (/\b(url|website|webpage|page says|source says|check)\b/.test(t)) {
    return "web_check";
  }
  return "manual_fallback";
}

async function handleCryptoPrice(condition) {
  const parsed = parseCondition(condition);
  if (!parsed) {
    return json({
      status: "unsupported_condition",
      result: false,
      category: "crypto_price",
      summary: "Use a condition like BTC above 100000 or ETH below 2500.",
      condition
    });
  }

  try {
    const id = ASSETS[parsed.asset];
    const url = `https://api.coingecko.com/api/v3/simple/price?ids=${id}&vs_currencies=usd`;
    const res = await fetch(url, { headers: { accept: "application/json" } });
    if (!res.ok) throw new Error(`price_source_${res.status}`);

    const data = await res.json();
    const value = data?.[id]?.usd;
    if (typeof value !== "number") throw new Error("price_missing");

    const result = parsed.operator === "above" ? value > parsed.target : value < parsed.target;
    return json({
      status: "ok",
      result,
      category: "crypto_price",
      asset: parsed.asset,
      value,
      operator: parsed.operator,
      target: parsed.target,
      summary: `${parsed.asset} is ${value} USD, target is ${parsed.operator} ${parsed.target} USD.`,
      source: "coingecko",
      updated_at: new Date().toISOString()
    });
  } catch (error) {
    return json({
      status: "source_unavailable",
      result: false,
      category: "crypto_price",
      summary: "Price source unavailable. Use manual fallback in the contract.",
      condition,
      error: String(error.message || error)
    });
  }
}

async function handleSportsResult(condition, params = {}) {
  if (!SPORTDB_API_KEY) {
    return json({
      status: "source_required",
      result: false,
      category: "sports_result",
      summary: "Sports predictions need SPORTDB_API_KEY configured in Netlify environment variables.",
      condition
    });
  }

  const teams = extractTeams(condition);
  try {
    const data = await fetchSportsLiveData((params.date || "").trim());
    const matches = Array.isArray(data) ? data : (data.matches || data.data || data.live || []);
    const found = findMatch(matches, teams);

    if (!found) {
      return json({
        status: "not_found",
        result: false,
        category: "sports_result",
        summary: "No matching sports event found for that source/date. Use manual fallback or try another date/source.",
        condition,
        teams
      });
    }

    const normalized = normalizeMatch(found);
    return json({
      status: "ok",
      result: normalized.is_final ? Boolean(normalized.winner) : false,
      category: "sports_result",
      home_team: normalized.home_team,
      away_team: normalized.away_team,
      home_score: normalized.home_score,
      away_score: normalized.away_score,
      winner: normalized.winner,
      is_final: normalized.is_final,
      summary: normalized.summary,
      source: "sportdb.dev",
      updated_at: new Date().toISOString()
    });
  } catch (error) {
    return json({
      status: "source_unavailable",
      result: false,
      category: "sports_result",
      summary: "Sports source unavailable. Use manual fallback in the contract.",
      condition,
      error: String(error.message || error)
    });
  }
}

async function fetchSportsLiveData(dateParam = "") {
  try {
    return await fetchSportDbLive();
  } catch (sportdbError) {
    try {
      return await fetchEspnScoreboards(dateParam);
    } catch (espnError) {
      throw new Error(String(sportdbError.message || sportdbError) + "; espn_unavailable: " + String(espnError.message || espnError));
    }
  }
}

async function fetchEspnScoreboards(dateParam = "") {
  const endpoints = [
    "https://site.api.espn.com/apis/site/v2/sports/soccer/uefa.champions/scoreboard",
    "https://site.api.espn.com/apis/site/v2/sports/soccer/uefa.europa/scoreboard",
    "https://site.api.espn.com/apis/site/v2/sports/soccer/eng.1/scoreboard",
    "https://site.api.espn.com/apis/site/v2/sports/soccer/esp.1/scoreboard",
    "https://site.api.espn.com/apis/site/v2/sports/soccer/ita.1/scoreboard",
    "https://site.api.espn.com/apis/site/v2/sports/soccer/ger.1/scoreboard",
    "https://site.api.espn.com/apis/site/v2/sports/soccer/fra.1/scoreboard",
    "https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard",
    "https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard"
  ];
  const all = [];
  const failures = [];

  for (const endpoint of endpoints) {
    try {
      const requestUrl = dateParam ? endpoint + "?dates=" + encodeURIComponent(dateParam) : endpoint;
      const res = await fetch(requestUrl, { headers: { "accept": "application/json" } });
      if (!res.ok) {
        failures.push((dateParam ? endpoint + "?dates=" + dateParam : endpoint) + " -> " + res.status);
        continue;
      }
      const data = await res.json();
      if (Array.isArray(data.events)) all.push(...data.events.map(normalizeEspnEvent));
    } catch (error) {
      failures.push(endpoint + " -> " + String(error.message || error));
    }
  }

  if (all.length) return { data: all };
  throw new Error(failures.join("; ") || "no_espn_events");
}

function normalizeEspnEvent(event) {
  const comps = event.competitions && event.competitions[0] && event.competitions[0].competitors ? event.competitions[0].competitors : [];
  const home = comps.find(c => c.homeAway === "home") || comps[0] || {};
  const away = comps.find(c => c.homeAway === "away") || comps[1] || {};
  const status = event.status && event.status.type ? event.status.type : {};
  return {
    home_team: home.team ? (home.team.displayName || home.team.name || home.team.shortDisplayName || "") : "",
    away_team: away.team ? (away.team.displayName || away.team.name || away.team.shortDisplayName || "") : "",
    home_score: Number(home.score || 0),
    away_score: Number(away.score || 0),
    status: status.name || status.description || "",
    is_final: Boolean(status.completed)
  };
}
async function fetchSportDbLive() {
  const endpoints = [
    "https://api.sportdb.dev/api/football/live",
    "https://api.sportdb.dev/api/soccer/live",
    "https://api.sportdb.dev/api/basketball/live",
    "https://api.sportdb.dev/api/hockey/live"
  ];
  const failures = [];

  for (const endpoint of endpoints) {
    try {
      const res = await fetch(endpoint, {
        headers: { "accept": "application/json", "X-API-Key": SPORTDB_API_KEY }
      });
      if (res.ok) return await res.json();
      failures.push((dateParam ? endpoint + "?dates=" + dateParam : endpoint) + " -> " + res.status);
    } catch (error) {
      failures.push(endpoint + " -> " + String(error.message || error));
    }
  }

  throw new Error("sportdb_unavailable: " + failures.join("; "));
}
function extractTeams(condition) {
  const clean = condition.replace(/\b(winner|score|result|who wins|won)\b/gi, "").trim();
  const parts = clean.split(/\s+(?:vs|v|versus)\s+/i).map(x => x.trim()).filter(Boolean);
  return { a: parts[0] || "", b: parts[1] || "" };
}

function findMatch(matches, teams) {
  if (!teams.a && !teams.b) return null;
  const a = teams.a.toLowerCase();
  const b = teams.b.toLowerCase();
  return matches.find(match => {
    const norm = normalizeMatch(match);
    const hay = normalizeTeamName(`${norm.home_team} ${norm.away_team}`);
    return (!a || hay.includes(a)) && (!b || hay.includes(b));
  }) || null;
}

function normalizeTeamName(name) {
  return String(name || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\bfc\b|\bafc\b|\bcf\b/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}
function normalizeMatch(match) {
  const home = String(match.home_team || match.homeTeam || match.home_name || match.home || match.team_home || "");
  const away = String(match.away_team || match.awayTeam || match.away_name || match.away || match.team_away || "");
  const hs = Number(match.home_score ?? match.homeScore ?? match.score_home ?? match.home_goals ?? 0);
  const as = Number(match.away_score ?? match.awayScore ?? match.score_away ?? match.away_goals ?? 0);
  const status = String(match.status || match.match_status || match.state || "").toLowerCase();
  const isFinal = /final|finished|ft|ended|complete/.test(status);
  const winner = isFinal ? (hs > as ? home : (as > hs ? away : "draw")) : "";
  return {
    home_team: home,
    away_team: away,
    home_score: isFinite(hs) ? hs : 0,
    away_score: isFinite(as) ? as : 0,
    is_final: isFinal,
    winner,
    summary: isFinal ? `${home} ${hs} - ${as} ${away}. Winner: ${winner}.` : `${home} ${hs} - ${as} ${away}. Match is not final.`
  };
}

function handleNewsEvent(condition) {
  return json({
    status: "source_required",
    result: false,
    category: "news_event",
    summary: "News/event predictions need an official public source URL or manual fallback.",
    condition
  });
}

function handleWebCheck(condition) {
  return json({
    status: "source_required",
    result: false,
    category: "web_check",
    summary: "Generic web checks need a public source URL that validators can fetch.",
    condition
  });
}

function parseCondition(input) {
  const clean = input.toUpperCase().replace(/[$,]/g, "");
  const match = clean.match(/\b(BTC|BITCOIN|ETH|ETHEREUM|SOL|SOLANA)\b.*\b(ABOVE|OVER|GREATER THAN|BELOW|UNDER|LESS THAN)\b\s*(\d+(?:\.\d+)?)/);
  if (!match) return null;

  return {
    asset: normalizeAsset(match[1]),
    operator: /ABOVE|OVER|GREATER/.test(match[2]) ? "above" : "below",
    target: Number(match[3])
  };
}

function normalizeAsset(asset) {
  if (asset === "BITCOIN") return "BTC";
  if (asset === "ETHEREUM") return "ETH";
  if (asset === "SOLANA") return "SOL";
  return asset;
}

function json(body, statusCode = 200) {
  return {
    statusCode,
    headers: {
      "content-type": "application/json",
      "access-control-allow-origin": "*"
    },
    body: JSON.stringify(body, null, 2)
  };
}







