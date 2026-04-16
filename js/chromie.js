(function () {
  const feed = document.getElementById("live-feed");
  const statusLine = document.getElementById("status-line");
  const html = document.documentElement;
  const maxLines = 48;
  const TWITTER_POLL_MS = 90_000;
  const SEEN_KEY = "chromie_seen_tweet_ids";

  let audioCtx;
  let walletPubkey = null;

  function appendLine(text, className) {
    if (!feed) return;
    const row = document.createElement("div");
    row.className = "line" + (className ? " " + className : "");
    row.textContent = "> " + text;
    feed.appendChild(row);
    while (feed.children.length > maxLines) {
      feed.removeChild(feed.firstChild);
    }
    row.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }

  function ensureAudio() {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    if (!audioCtx) audioCtx = new AC();
    if (audioCtx.state === "suspended") {
      audioCtx.resume().catch(function () {});
    }
    return audioCtx;
  }

  /** Coin-drop / register ka-ching using Web Audio (no asset file). */
  function playCoinDropSound() {
    const ctx = ensureAudio();
    if (!ctx) return;
    const t0 = ctx.currentTime;
    const master = ctx.createGain();
    master.gain.value = 0.32;
    master.connect(ctx.destination);

    const o1 = ctx.createOscillator();
    o1.type = "triangle";
    o1.frequency.setValueAtTime(880, t0);
    o1.frequency.exponentialRampToValueAtTime(2600, t0 + 0.045);
    const g1 = ctx.createGain();
    g1.gain.setValueAtTime(0.22, t0);
    g1.gain.exponentialRampToValueAtTime(0.001, t0 + 0.28);
    o1.connect(g1);
    g1.connect(master);
    o1.start(t0);
    o1.stop(t0 + 0.3);

    const o2 = ctx.createOscillator();
    o2.type = "square";
    o2.frequency.setValueAtTime(2100, t0 + 0.012);
    o2.frequency.exponentialRampToValueAtTime(520, t0 + 0.11);
    const g2 = ctx.createGain();
    g2.gain.setValueAtTime(0.06, t0 + 0.012);
    g2.gain.exponentialRampToValueAtTime(0.001, t0 + 0.16);
    o2.connect(g2);
    g2.connect(master);
    o2.start(t0 + 0.008);
    o2.stop(t0 + 0.18);

    const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.06), ctx.sampleRate);
    const ch = buf.getChannelData(0);
    for (let i = 0; i < ch.length; i++) {
      ch[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / ch.length, 2.2);
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buf;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0.08, t0 + 0.02);
    ng.gain.exponentialRampToValueAtTime(0.001, t0 + 0.09);
    noise.connect(ng);
    ng.connect(master);
    noise.start(t0 + 0.02);
    noise.stop(t0 + 0.1);
  }

  function dirtyWork() {
    playCoinDropSound();
    appendLine("DIRTY_WORK: coin dropped in THE PIT. CHROMIE'S RETAINER JUST WENT UP.");
  }

  function stake() {
    appendLine("STAKE_SOL: routing wallet… THE PIT TAKES 10% VIGOR. CHROMIE DOES NOT APOLOGIZE.");
    appendLine("TODO: wire Solana stake / pool program URL here.");
  }

  function enterPit() {
    appendLine("ENTER_THE_PIT: gate opening… smell of melted crayons detected.");
    appendLine("TODO: deep link Discord #heartass-pit or app route.");
  }

  function viewFairness() {
    appendLine("VIEW_FAIRNESS: opening ledger / provably-fair docs (placeholder).");
    appendLine("TODO: set window.location or modal with your fairness spec.");
  }

  function lowBalanceLamports() {
    const sol = parseFloat(html.getAttribute("data-low-balance-sol") || "0.05");
    const s = Number.isFinite(sol) ? sol : 0.05;
    return Math.max(0, Math.floor(s * 1e9));
  }

  function solanaRpc() {
    return (
      html.getAttribute("data-solana-rpc") ||
      "https://api.mainnet-beta.solana.com"
    ).trim();
  }

  function applyThemeFromLamports(lamports) {
    const low = lowBalanceLamports();
    if (walletPubkey == null || lamports == null) {
      html.dataset.theme = "neon";
      if (statusLine) {
        statusLine.textContent = "STATUS: UNFILTERED // MODE: DIRTY WORK";
      }
      return;
    }
    if (lamports < low) {
      html.dataset.theme = "heart";
      if (statusLine) {
        statusLine.textContent =
          "STATUS: HEART_MODE // WALLET: VULNERABLE (< " +
          (low / 1e9).toFixed(2) +
          " SOL) // CHROMIE CARES (RUDELY)";
      }
    } else {
      html.dataset.theme = "neon";
      if (statusLine) {
        statusLine.textContent =
          "STATUS: UNFILTERED // MODE: DIRTY_WORK // BALANCE_OK";
      }
    }
  }

  async function fetchBalanceLamports(pubkeyB58) {
    const rpc = solanaRpc();
    const res = await fetch(rpc, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "getBalance",
        params: [pubkeyB58],
      }),
    });
    const j = await res.json();
    if (typeof j.result?.value === "number") return j.result.value;
    return null;
  }

  async function connectWallet() {
    const w = window.solana;
    if (!w || typeof w.connect !== "function") {
      appendLine("WALLET: no injected wallet (try Phantom).");
      return;
    }
    try {
      const resp = await w.connect();
      const pk = resp?.publicKey;
      const b58 =
        pk && typeof pk.toBase58 === "function"
          ? pk.toBase58()
          : pk && typeof pk.toString === "function"
            ? pk.toString()
            : null;
      if (!b58) {
        appendLine("WALLET: connected but no public key.");
        return;
      }
      walletPubkey = b58;
      appendLine("WALLET: connected " + b58.slice(0, 4) + "…" + b58.slice(-4));
      const lamports = await fetchBalanceLamports(b58);
      if (lamports == null) {
        appendLine("WALLET: balance RPC failed.");
        applyThemeFromLamports(null);
        return;
      }
      appendLine(
        "WALLET: balance ≈ " + (lamports / 1e9).toFixed(4) + " SOL (mainnet RPC)."
      );
      applyThemeFromLamports(lamports);

      if (typeof w.on === "function") {
        w.on("disconnect", function () {
          walletPubkey = null;
          html.dataset.theme = "neon";
          if (statusLine) {
            statusLine.textContent = "STATUS: UNFILTERED // MODE: DIRTY WORK";
          }
          appendLine("WALLET: disconnected. THEME: NEON restored.");
        });
      }
    } catch (e) {
      appendLine("WALLET: connect failed — " + (e && e.message ? e.message : String(e)));
    }
  }

  function loadSeenIds() {
    try {
      const raw = sessionStorage.getItem(SEEN_KEY);
      if (!raw) return new Set();
      const arr = JSON.parse(raw);
      return new Set(Array.isArray(arr) ? arr : []);
    } catch {
      return new Set();
    }
  }

  function saveSeenIds(set) {
    try {
      sessionStorage.setItem(SEEN_KEY, JSON.stringify(Array.from(set).slice(-200)));
    } catch {}
  }

  function formatTweetLine(username, tweet) {
    const t = tweet.text.replace(/\s+/g, " ").trim();
    const when = tweet.created_at
      ? new Date(tweet.created_at).toLocaleString(undefined, {
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })
      : "";
    return "[@" + username + "] " + (when ? when + " — " : "") + t;
  }

  async function pollTwitterFeed() {
    try {
      const res = await fetch("/api/chromie-tweets", { cache: "no-store" });
      const data = await res.json();

      if (!data.configured) {
        if (!sessionStorage.getItem("chromie_twitter_warned")) {
          sessionStorage.setItem("chromie_twitter_warned", "1");
          appendLine(
            "TWITTER_FEED: API not configured on server. Set TWITTER_BEARER_TOKEN on Vercel."
          );
        }
        return;
      }

      if (!data.ok || !Array.isArray(data.tweets)) {
        appendLine(
          "TWITTER_FEED: fetch error — " + (data.error || "unknown") + "."
        );
        return;
      }

      const username = data.username || "chromie_hub";
      const seen = loadSeenIds();
      const incoming = data.tweets.slice().reverse();

      for (const tw of incoming) {
        if (!tw.id || seen.has(tw.id)) continue;
        seen.add(tw.id);
        appendLine(formatTweetLine(username, tw), "twitter");
      }
      saveSeenIds(seen);
    } catch (e) {
      appendLine("TWITTER_FEED: network — " + (e && e.message ? e.message : String(e)));
    }
  }

  window.stake = stake;
  window.enterPit = enterPit;
  window.viewFairness = viewFairness;
  window.dirtyWork = dirtyWork;
  window.connectWallet = connectWallet;

  document.querySelector(".buttons")?.addEventListener("click", function (e) {
    const btn = e.target.closest("button[data-action]");
    if (!btn) return;
    const action = btn.getAttribute("data-action");
    if (action === "dirtywork") dirtyWork();
    if (action === "wallet") connectWallet();
    if (action === "stake") stake();
    if (action === "pit") enterPit();
    if (action === "fairness") viewFairness();
  });

  const boot = [
    "Connecting to #heartass-pit…",
    "HANDSHAKE_OK // operator=CHROMIE // caps=LOCKED_ON",
    "Whale radar: STANDBY. Vulnerable wallets: PROTECTED (allegedly).",
    "TWITTER_FEED: polling /api/chromie-tweets …",
  ];
  let i = 0;
  function bootStep() {
    if (i < boot.length) {
      appendLine(boot[i]);
      i++;
      setTimeout(bootStep, 380 + Math.random() * 220);
    } else {
      pollTwitterFeed();
      setInterval(pollTwitterFeed, TWITTER_POLL_MS);
    }
  }
  bootStep();
})();
