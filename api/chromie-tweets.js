/**
 * Proxies Chromie's public tweets for the live feed (keeps Bearer token server-side).
 * Vercel: set TWITTER_BEARER_TOKEN. Optional: TWITTER_USERNAME (default chromie_hub).
 */
function sendJson(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
}

module.exports = async function chromieTweets(req, res) {
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.statusCode = 204;
    return res.end();
  }

  if (req.method !== "GET") {
    return sendJson(res, 405, { error: "method_not_allowed", tweets: [] });
  }

  const bearer = process.env.TWITTER_BEARER_TOKEN;
  const username = (process.env.TWITTER_USERNAME || "chromie_hub").replace(/^@/, "");

  if (!bearer || bearer === "YOUR_KEY") {
    return sendJson(res, 200, {
      ok: false,
      configured: false,
      error: "missing_twitter_bearer",
      tweets: [],
      hint: "Add TWITTER_BEARER_TOKEN in Vercel project Environment Variables.",
    });
  }

  const headers = { Authorization: `Bearer ${bearer}` };

  try {
    const userRes = await fetch(
      `https://api.twitter.com/2/users/by/username/${encodeURIComponent(username)}?user.fields=id,name,username`,
      { headers }
    );
    const userJson = await userRes.json();

    if (!userRes.ok) {
      return sendJson(res, 200, {
        ok: false,
        configured: true,
        error: "twitter_user_lookup_failed",
        detail: userJson,
        tweets: [],
      });
    }

    const userId = userJson?.data?.id;
    if (!userId) {
      return sendJson(res, 200, {
        ok: false,
        configured: true,
        error: "user_not_found",
        tweets: [],
      });
    }

    const tweetsUrl = new URL(`https://api.twitter.com/2/users/${userId}/tweets`);
    tweetsUrl.searchParams.set("max_results", "10");
    tweetsUrl.searchParams.set("tweet.fields", "created_at,public_metrics");
    tweetsUrl.searchParams.set("exclude", "retweets");

    const twRes = await fetch(tweetsUrl.toString(), { headers });
    const twJson = await twRes.json();

    if (!twRes.ok) {
      return sendJson(res, 200, {
        ok: false,
        configured: true,
        error: "twitter_timeline_failed",
        detail: twJson,
        tweets: [],
      });
    }

    const tweets = (twJson.data || []).map((t) => ({
      id: t.id,
      text: t.text,
      created_at: t.created_at,
    }));

    return sendJson(res, 200, {
      ok: true,
      configured: true,
      username: userJson.data.username,
      tweets,
    });
  } catch (e) {
    return sendJson(res, 200, {
      ok: false,
      configured: true,
      error: "upstream_exception",
      message: String(e && e.message ? e.message : e),
      tweets: [],
    });
  }
};
