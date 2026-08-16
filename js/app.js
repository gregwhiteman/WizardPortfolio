/**
 * Wizard Portfolio — D&D-styled multi-portfolio crypto tracker
 * All user data persisted in localStorage.
 */

// Storage keys kept from the UpDown era so existing local data still loads.
const STORAGE_KEY = "updown.app.v2";
const LEGACY_KEY = "updown.addresses.v1";
const SNAPSHOT_KEY = "updown.market.v1";
const NIGHT_POLICY_ID = "0691b2fecca1ac4f53cb6dfb00b7013e561d1f34403b957cbb5af1fa";
const NIGHT_ASSET_NAME = "4e49474854";

// ── Coin config ────────────────────────────────────────────────────────────

const COINS = [
  {
    id: "btc",
    name: "Bitcoin",
    symbol: "BTC",
    geckoId: "bitcoin",
    decimals: 8,
    color: "#f7931a",
    placeholder: "bc1… / 1… / 3…",
    note: "Native BTC address (SegWit, Legacy, or Taproot).",
    explorer: (a) => `https://mempool.space/address/${a}`,
    fetchBalance: fetchBtcBalance,
  },
  {
    id: "xrp",
    name: "XRP",
    symbol: "XRP",
    geckoId: "ripple",
    decimals: 6,
    color: "#23292f",
    placeholder: "r…",
    note: "Classic XRPL address starting with r.",
    explorer: (a) => `https://livenet.xrpl.org/accounts/${a}`,
    fetchBalance: fetchXrpBalance,
  },
  {
    id: "xlm",
    name: "Stellar",
    symbol: "XLM",
    geckoId: "stellar",
    decimals: 7,
    color: "#000000",
    placeholder: "G…",
    note: "Public key starting with G.",
    explorer: (a) => `https://stellarchain.io/accounts/${a}`,
    fetchBalance: fetchXlmBalance,
  },
  {
    id: "hbar",
    name: "Hedera",
    symbol: "HBAR",
    geckoId: "hedera-hashgraph",
    decimals: 8,
    color: "#8259ef",
    placeholder: "0.0.12345",
    note: "Account ID (0.0.x).",
    explorer: (a) => `https://hashscan.io/mainnet/account/${a}`,
    fetchBalance: fetchHbarBalance,
  },
  {
    id: "ada",
    name: "Cardano",
    symbol: "ADA",
    geckoId: "cardano",
    decimals: 6,
    color: "#0033ad",
    placeholder: "addr1…",
    note: "Payment address (addr1…).",
    explorer: (a) => `https://cardanoscan.io/address/${a}`,
    fetchBalance: fetchAdaBalance,
  },
  {
    id: "night",
    name: "Midnight",
    symbol: "NIGHT",
    geckoId: "midnight-3",
    decimals: 6,
    color: "#0a0a0a",
    placeholder: "addr1… holding NIGHT",
    note: "NIGHT as a Cardano native asset — use the Cardano address that holds NIGHT.",
    explorer: (a) => `https://cardanoscan.io/address/${a}`,
    fetchBalance: fetchNightBalance,
  },
  {
    id: "doge",
    name: "Dogecoin",
    symbol: "DOGE",
    geckoId: "dogecoin",
    decimals: 8,
    color: "#c2a633",
    placeholder: "D…",
    note: "Dogecoin mainnet address.",
    explorer: (a) => `https://dogechain.info/address/${a}`,
    fetchBalance: fetchDogeBalance,
  },
  {
    id: "ltc",
    name: "Litecoin",
    symbol: "LTC",
    geckoId: "litecoin",
    decimals: 8,
    color: "#345d9d",
    placeholder: "ltc1… / L… / M…",
    note: "Litecoin address.",
    explorer: (a) => `https://litecoinspace.org/address/${a}`,
    fetchBalance: fetchLtcBalance,
  },
  {
    id: "gold",
    name: "Gold",
    symbol: "XAU",
    kind: "metal",
    unit: "oz",
    yahooSymbol: "GC=F",
    tvSymbol: "XAUUSD",
    decimals: 4,
    color: "#d4af37",
    placeholder: "",
    note: "Spot gold priced per troy ounce. Add ounces you hold.",
    explorer: null,
    fetchBalance: null,
  },
  {
    id: "silver",
    name: "Silver",
    symbol: "XAG",
    kind: "metal",
    unit: "oz",
    yahooSymbol: "SI=F",
    tvSymbol: "XAGUSD",
    decimals: 4,
    color: "#c0c7d1",
    placeholder: "",
    note: "Spot silver priced per troy ounce. Add ounces you hold.",
    explorer: null,
    fetchBalance: null,
  },
];

const COIN_BY_ID = Object.fromEntries(COINS.map((c) => [c.id, c]));

function colorFromSymbol(sym) {
  let h = 0;
  for (const ch of String(sym || "")) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return `hsl(${h % 360} 46% 40%)`;
}

function hydrateCustomAsset(raw) {
  if (!raw || typeof raw !== "object") return null;
  const symbol = String(raw.symbol || "").toUpperCase().slice(0, 12);
  const kind = raw.kind === "stock" ? "stock" : "crypto";
  const geckoId = raw.geckoId ? String(raw.geckoId) : null;
  const yahooSymbol = raw.yahooSymbol ? String(raw.yahooSymbol) : kind === "stock" ? symbol : null;
  const id =
    raw.id ||
    (kind === "stock" ? `eq_${String(yahooSymbol || symbol).toLowerCase()}` : geckoId ? `cg_${geckoId}` : null);
  if (!id || !symbol) return null;
  return {
    kind,
    id,
    name: String(raw.name || symbol).slice(0, 80),
    symbol,
    geckoId,
    yahooSymbol,
    decimals: Number.isFinite(Number(raw.decimals)) ? Number(raw.decimals) : kind === "stock" ? 4 : 8,
    color: raw.color || colorFromSymbol(symbol),
    lastUsd: Number.isFinite(Number(raw.lastUsd)) ? Number(raw.lastUsd) : null,
    lastChange24h: Number.isFinite(Number(raw.lastChange24h)) ? Number(raw.lastChange24h) : null,
    lastUsdAt: Number(raw.lastUsdAt) || null,
    placeholder: "",
    note: kind === "stock" ? "Equities use manual amounts (no on-chain wallets)." : "Manual amounts only for this relic.",
    explorer: null,
    fetchBalance: null,
  };
}

function normalizeCustomAssets(list) {
  if (!Array.isArray(list)) return [];
  const out = [];
  const seen = new Set();
  for (const raw of list) {
    const asset = hydrateCustomAsset(raw);
    if (!asset || seen.has(asset.id) || COIN_BY_ID[asset.id]) continue;
    seen.add(asset.id);
    out.push({
      kind: asset.kind,
      id: asset.id,
      name: asset.name,
      symbol: asset.symbol,
      geckoId: asset.geckoId,
      yahooSymbol: asset.yahooSymbol,
      decimals: asset.decimals,
      color: asset.color,
      lastUsd: Number.isFinite(Number(raw.lastUsd)) ? Number(raw.lastUsd) : asset.lastUsd,
      lastChange24h: Number.isFinite(Number(raw.lastChange24h)) ? Number(raw.lastChange24h) : asset.lastChange24h,
      lastUsdAt: Number(raw.lastUsdAt) || asset.lastUsdAt || null,
    });
  }
  return out;
}

function getCustomAssets() {
  try {
    return normalizeCustomAssets(store?.customAssets);
  } catch {
    return [];
  }
}

function allAssets() {
  return [...COINS, ...getCustomAssets().map(hydrateCustomAsset).filter(Boolean)];
}

function getAsset(id) {
  if (!id) return null;
  if (COIN_BY_ID[id]) return COIN_BY_ID[id];
  try {
    const found = (store?.customAssets || []).find((a) => a.id === id);
    return found ? hydrateCustomAsset(found) : null;
  } catch {
    return null;
  }
}

function ensureCustomAsset(result) {
  const existing = findExistingAsset(result);
  if (existing) return existing.id;
  const asset = hydrateCustomAsset({
    kind: result.kind,
    name: result.name,
    symbol: result.symbol,
    geckoId: result.geckoId,
    yahooSymbol: result.yahooSymbol,
    color: colorFromSymbol(result.symbol),
  });
  if (!asset) return null;
  if (!Array.isArray(store.customAssets)) store.customAssets = [];
  store.customAssets = normalizeCustomAssets([...store.customAssets, asset]);
  saveStore();
  return asset.id;
}

function findExistingAsset(result) {
  if (result.existingId && getAsset(result.existingId)) return getAsset(result.existingId);
  const hint = `${result.symbol || ""} ${result.yahooSymbol || ""} ${result.name || ""}`.toUpperCase();
  if (!result.geckoId && /\b(XAU|XAUUSD|GC=F)\b/.test(hint)) return getAsset("gold");
  if (!result.geckoId && /\b(XAG|XAGUSD|SI=F)\b/.test(hint)) return getAsset("silver");
  if (result.kind === "metal" && /GOLD|XAU/.test(hint)) return getAsset("gold");
  if (result.kind === "metal" && /SILVER|XAG/.test(hint)) return getAsset("silver");
  if (result.kind === "crypto" && result.geckoId) {
    return allAssets().find((a) => a.geckoId === result.geckoId) || null;
  }
  if (result.kind === "stock" && result.yahooSymbol) {
    const y = String(result.yahooSymbol).toUpperCase();
    return (
      allAssets().find(
        (a) => String(a.yahooSymbol || "").toUpperCase() === y || (a.kind === "stock" && a.symbol === y)
      ) || null
    );
  }
  return null;
}

// ── App state ──────────────────────────────────────────────────────────────

/** @type {{ version: number, activePortfolioId: string|null, exchangeFeePct: number, lightningPower: number, lightningStrikes: boolean, customAssets: object[], portfolios: Portfolio[] }} */
let store = loadStore();

/** When true, don't overwrite manual price field with live market price. */
let manualPriceDirty = false;
/** Last coinId we prefilled price for (reset dirty on coin change). */
let manualPriceCoinId = null;

/** @type {Record<string, { usd: number, change24h: number }>} */
let prices = {};

/**
 * Cached CoinGecko market charts: `${coinId}:${days}` → { fetchedAt, points }
 * @type {Record<string, { fetchedAt: number, points: [number, number][] }>}
 */
let chartCache = {};

/** Selected dashboard chart range (CoinGecko days param). */
let chartRange = "1";

/** Last holdings used for the chart (for range tab / retry reloads). */
let lastChartHoldings = [];

/**
 * balanceCache[portfolioId][coinId][address] = { balance, error, loading }
 * @type {Record<string, Record<string, Record<string, { balance: number|null, error: string|null, loading: boolean }>>>}
 */
let balanceCache = {};

/** Chart fetch in progress (for global header spinner). */
let chartLoading = false;

/** Home pager: 0 = hoard (default), 1 = the reckoning. Swipe left from the hoard to open the ledger. */
let homeSlide = 0;

/**
 * Load last-known prices + on-chain balances so the UI never flashes $0 on refresh.
 */
function loadMarketSnapshot() {
  try {
    const raw = localStorage.getItem(SNAPSHOT_KEY);
    if (!raw) return;
    const data = JSON.parse(raw);
    if (data?.prices && typeof data.prices === "object") {
      prices = data.prices;
    }
    if (data?.balances && typeof data.balances === "object") {
      // Restore balances but never restore as "loading"
      for (const pfId of Object.keys(data.balances)) {
        balanceCache[pfId] = balanceCache[pfId] || {};
        for (const coinId of Object.keys(data.balances[pfId] || {})) {
          balanceCache[pfId][coinId] = balanceCache[pfId][coinId] || {};
          for (const addr of Object.keys(data.balances[pfId][coinId] || {})) {
            const row = data.balances[pfId][coinId][addr];
            if (!row || typeof row !== "object") continue;
            balanceCache[pfId][coinId][addr] = {
              balance: row.balance != null && Number.isFinite(Number(row.balance)) ? Number(row.balance) : null,
              error: row.error || null,
              loading: false,
            };
          }
        }
      }
    }
  } catch {
    /* ignore corrupt snapshot */
  }
}

/** Persist prices + successful balances for the next page load / mid-refresh display. */
function saveMarketSnapshot() {
  try {
    const balances = {};
    for (const pfId of Object.keys(balanceCache)) {
      balances[pfId] = {};
      for (const coinId of Object.keys(balanceCache[pfId] || {})) {
        balances[pfId][coinId] = {};
        for (const addr of Object.keys(balanceCache[pfId][coinId] || {})) {
          const row = balanceCache[pfId][coinId][addr];
          if (!row) continue;
          // Keep last good balance even if currently errored
          if (row.balance != null && Number.isFinite(row.balance)) {
            balances[pfId][coinId][addr] = {
              balance: row.balance,
              error: null,
              loading: false,
            };
          }
        }
      }
    }
    localStorage.setItem(
      SNAPSHOT_KEY,
      JSON.stringify({
        prices,
        balances,
        savedAt: Date.now(),
      })
    );
  } catch {
    /* quota / private mode */
  }
}

function anyBalancesLoading() {
  for (const pfId of Object.keys(balanceCache)) {
    for (const coinId of Object.keys(balanceCache[pfId] || {})) {
      for (const addr of Object.keys(balanceCache[pfId][coinId] || {})) {
        if (balanceCache[pfId][coinId][addr]?.loading) return true;
      }
    }
  }
  return false;
}

/** Show/hide the global top-right spinner while any network work is in flight. */
function updateGlobalSpinner() {
  const el = document.getElementById("global-spinner");
  if (!el) return;
  const busy = refreshInFlight || chartLoading || anyBalancesLoading();
  el.hidden = !busy;
  el.setAttribute("aria-hidden", busy ? "false" : "true");
  document.body.classList.toggle("is-data-loading", busy);
}

/** Navigation stack state */
let nav = {
  view: "home", // home | portfolio | asset | add-coin | settings | tv
  tvReturn: null,
  portfolioId: null,
  coinId: null,
};

let modalMode = null; // 'create' | 'rename' | null
let toastTimer = null;

// ── Storage ────────────────────────────────────────────────────────────────

function uid() {
  return crypto.randomUUID?.() || `p_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * @returns {{
 *   addresses: string[],
 *   manual: { id: string, amount: number, label: string, unitPrice: number|null }[],
 *   costBasisUsd: number
 * }}
 */
function emptyCoinHolding() {
  return { addresses: [], manual: [], costBasisUsd: 0 };
}

function emptyHoldings() {
  const h = {};
  for (const c of allAssets()) h[c.id] = emptyCoinHolding();
  return h;
}

function parseOptionalUsd(raw) {
  if (raw == null || raw === "") return null;
  const n = Number(String(raw).replace(/[$,\s]/g, "").trim());
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}

/** Normalize legacy array or partial object → { addresses, manual, costBasisUsd } */
function normalizeCoinHolding(raw) {
  // Legacy: string[] of addresses only
  if (Array.isArray(raw)) {
    return {
      addresses: raw.map(String).filter(Boolean),
      manual: [],
      costBasisUsd: 0,
    };
  }
  if (raw && typeof raw === "object") {
    const addresses = Array.isArray(raw.addresses)
      ? raw.addresses.map(String).filter(Boolean)
      : [];
    let manual = [];
    if (Array.isArray(raw.manual)) {
      manual = raw.manual
        .map((m) => {
          const unitPrice =
            m.unitPrice != null && Number.isFinite(Number(m.unitPrice)) && Number(m.unitPrice) >= 0
              ? Number(m.unitPrice)
              : m.pricePaid != null && Number.isFinite(Number(m.pricePaid)) && Number(m.pricePaid) >= 0
                ? Number(m.pricePaid)
                : null;
          const feePct = normalizeExchangeFeePct(m.feePct);
          let costUsd = Number(m.costUsd);
          if (!Number.isFinite(costUsd) || costUsd < 0) {
            costUsd = unitPrice != null ? manualLotCost(Number(m.amount), unitPrice, feePct) : null;
          }
          return {
            id: m.id || uid(),
            amount: Number(m.amount),
            label: String(m.label || "").slice(0, 40),
            unitPrice,
            feePct,
            costUsd: costUsd != null && Number.isFinite(costUsd) ? costUsd : null,
          };
        })
        .filter((m) => Number.isFinite(m.amount) && m.amount > 0);
    } else if (raw.manual != null && Number(raw.manual) > 0) {
      // Single number form
      manual = [{ id: uid(), amount: Number(raw.manual), label: "", unitPrice: null, feePct: 0, costUsd: null }];
    }

    let costBasisUsd = Number(raw.costBasisUsd);
    if (!Number.isFinite(costBasisUsd) || costBasisUsd < 0) {
      // Derive from avgBuyPrice if present (legacy/export field)
      const avg = Number(raw.avgBuyPrice);
      costBasisUsd = 0;
      if (Number.isFinite(avg) && avg > 0) {
        const qty = manual.reduce((s, m) => s + m.amount, 0);
        if (qty > 0) costBasisUsd = avg * qty;
      } else {
        // Sum known manual lots (include fee when stored)
        costBasisUsd = manual.reduce((s, m) => {
          if (m.costUsd != null) return s + m.costUsd;
          if (m.unitPrice != null) return s + (manualLotCost(m.amount, m.unitPrice, m.feePct) || 0);
          return s;
        }, 0);
      }
    }

    return { addresses, manual, costBasisUsd };
  }
  return emptyCoinHolding();
}

function normalizePortfolio(pf) {
  const holdings = {};
  const src = pf.holdings || {};
  const keys = new Set([...COINS.map((c) => c.id), ...Object.keys(src)]);
  for (const key of keys) {
    holdings[key] = normalizeCoinHolding(src[key]);
  }
  return {
    id: pf.id || uid(),
    name: pf.name || "Portfolio",
    createdAt: pf.createdAt || Date.now(),
    // When true, this portfolio is counted in the home “Current balance”
    includeInTotal: pf.includeInTotal !== false,
    holdings,
  };
}

function getCoinHolding(pf, coinId) {
  if (!pf.holdings[coinId] || Array.isArray(pf.holdings[coinId])) {
    pf.holdings[coinId] = normalizeCoinHolding(pf.holdings[coinId]);
  }
  const h = pf.holdings[coinId];
  if (!Array.isArray(h.addresses)) h.addresses = [];
  if (!Array.isArray(h.manual)) h.manual = [];
  if (!Number.isFinite(h.costBasisUsd) || h.costBasisUsd < 0) h.costBasisUsd = 0;
  return h;
}

function normalizeExchangeFeePct(raw) {
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(100, Math.round(n * 10000) / 10000);
}

function getExchangeFeePct() {
  return normalizeExchangeFeePct(store.exchangeFeePct);
}

function setExchangeFeePct(raw) {
  store.exchangeFeePct = normalizeExchangeFeePct(raw);
  saveStore();
  return store.exchangeFeePct;
}

function normalizeLightningPower(raw) {
  const n = Number(raw);
  if (!Number.isFinite(n)) return 2;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function getLightningPower() {
  return normalizeLightningPower(store.lightningPower);
}

function setLightningPower(raw) {
  store.lightningPower = normalizeLightningPower(raw);
  saveStore();
  return store.lightningPower;
}

function getLightningStrikes() {
  return store.lightningStrikes !== false;
}

function setLightningStrikes(on) {
  store.lightningStrikes = !!on;
  saveStore();
  return store.lightningStrikes;
}

/** Effective lot cost including exchange fee (%). */
function manualLotCost(amount, unitPrice, feePct) {
  if (unitPrice == null || !Number.isFinite(unitPrice)) return null;
  const fee = normalizeExchangeFeePct(feePct);
  return amount * unitPrice * (1 + fee / 100);
}

function defaultStore() {
  const id = uid();
  return {
    version: 2,
    activePortfolioId: id,
    exchangeFeePct: 0,
    lightningPower: 2,
    lightningStrikes: true,
    customAssets: [],
    portfolios: [
      {
        id,
        name: "Main",
        createdAt: Date.now(),
        includeInTotal: true,
        holdings: emptyHoldings(),
      },
    ],
  };
}

function loadStore() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed?.portfolios?.length) {
        parsed.portfolios = parsed.portfolios.map(normalizePortfolio);
        parsed.exchangeFeePct = normalizeExchangeFeePct(parsed.exchangeFeePct);
        parsed.lightningPower = normalizeLightningPower(parsed.lightningPower);
        parsed.lightningStrikes = parsed.lightningStrikes !== false;
        parsed.customAssets = normalizeCustomAssets(parsed.customAssets);
        return parsed;
      }
    }
  } catch {
    /* fall through */
  }

  // Migrate legacy single-address map
  try {
    const legacy = localStorage.getItem(LEGACY_KEY);
    if (legacy) {
      const map = JSON.parse(legacy);
      const id = uid();
      const holdings = emptyHoldings();
      for (const c of COINS) {
        if (Array.isArray(map[c.id])) {
          holdings[c.id] = {
            addresses: map[c.id].map(String).filter(Boolean),
            manual: [],
            costBasisUsd: 0,
          };
        }
      }
      const migrated = {
        exchangeFeePct: 0,
        lightningPower: 2,
        lightningStrikes: true,
        customAssets: [],
        version: 2,
        activePortfolioId: id,
        portfolios: [{ id, name: "Main", createdAt: Date.now(), includeInTotal: true, holdings }],
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
      return migrated;
    }
  } catch {
    /* fall through */
  }

  const s = defaultStore();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  return s;
}

function saveStore() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

function getPortfolio(id) {
  return store.portfolios.find((p) => p.id === id) || null;
}

function getActivePortfolio() {
  if (nav.portfolioId) return getPortfolio(nav.portfolioId);
  if (store.activePortfolioId) return getPortfolio(store.activePortfolioId);
  return store.portfolios[0] || null;
}

// ── Formatting ─────────────────────────────────────────────────────────────

function formatUsd(n, digits) {
  if (n == null || Number.isNaN(n)) return "—";
  const abs = Math.abs(n);
  let max = digits;
  if (max == null) {
    max = abs >= 1000 ? 2 : abs >= 1 ? 2 : abs >= 0.01 ? 4 : 6;
  }
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: max,
  }).format(n);
}

function amountUnit(symbol) {
  const s = String(symbol || "").toUpperCase();
  if (s === "OZ" || s === "XAU" || s === "XAG" || s === "GOLD" || s === "SILVER") return "oz";
  const asset = getAsset(s.toLowerCase()) || allAssets().find((a) => a.symbol === symbol);
  if (asset?.unit) return asset.unit;
  if (asset?.kind === "metal") return "oz";
  return symbol;
}

function formatAmt(n, symbol) {
  const unit = amountUnit(symbol);
  if (n == null || Number.isNaN(n)) return `— ${unit}`;
  const abs = Math.abs(n);
  let digits = unit === "oz" ? 4 : 8;
  if (abs >= 1000) digits = 2;
  else if (abs >= 1) digits = unit === "oz" ? 4 : 4;
  else if (abs >= 0.01) digits = unit === "oz" ? 4 : 6;
  return `${new Intl.NumberFormat("en-US", {
    maximumFractionDigits: digits,
  }).format(n)} ${unit}`;
}

function formatPct(pct) {
  if (pct == null || Number.isNaN(pct)) return { text: "—", cls: "neutral" };
  const sign = pct > 0 ? "+" : "";
  const cls = pct > 0 ? "up" : pct < 0 ? "down" : "neutral";
  return { text: `${sign}${pct.toFixed(2)}%`, cls };
}

function formatChangeUsd(usd, pct) {
  if (usd == null || Number.isNaN(usd)) return { text: "—", cls: "neutral" };
  const sign = usd > 0 ? "+" : usd < 0 ? "" : "";
  const pctPart = pct != null && !Number.isNaN(pct) ? ` (${usd >= 0 ? "+" : ""}${pct.toFixed(2)}%)` : "";
  const cls = usd > 0 ? "up" : usd < 0 ? "down" : "neutral";
  return { text: `${sign}${formatUsd(usd)}${pctPart}`, cls };
}

function iconContrast(hex) {
  const c = hex.replace("#", "");
  if (c.length < 6) return "#fff";
  const r = parseInt(c.slice(0, 2), 16);
  const g = parseInt(c.slice(2, 4), 16);
  const b = parseInt(c.slice(4, 6), 16);
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum < 0.55 ? "#fff6dc" : "#0a101c";
}

/** HTML for a coin avatar using official brand color + symbol. */
function coinAvatarHtml(coin, { lg = false } = {}) {
  const cls = lg ? "coin-avatar lg" : "coin-avatar";
  const bg = coin?.color || "#d4af37";
  const fg = iconContrast(bg);
  const id = coin?.id || "";
  const label = `Open ${coin?.symbol || "asset"} chart`;
  return `<span class="${cls}" style="background:${bg};color:${fg}" data-open-tv="${escapeHtml(id)}" role="button" tabindex="0" title="${escapeHtml(label)}" aria-label="${escapeHtml(label)}">${escapeHtml((coin?.symbol || "?").slice(0, 4))}</span>`;
}

/** Fill an existing avatar element with brand color + symbol. */
function setCoinAvatarEl(el, coin) {
  if (!el || !coin) return;
  el.classList.add("coin-avatar");
  el.classList.remove("has-logo", "logo-fill");
  el.innerHTML = "";
  el.style.background = coin.color || "#d4af37";
  el.style.color = iconContrast(coin.color || "#d4af37");
  el.textContent = coin.symbol.slice(0, 4);
  el.dataset.openTv = coin.id;
  el.setAttribute("role", "button");
  el.setAttribute("tabindex", "0");
  el.setAttribute("aria-label", `Open ${coin.symbol} chart`);
  el.title = `Open ${coin.symbol} chart`;
}

const TV_CRYPTO_SYMBOLS = {
  btc: "COINBASE:BTCUSD",
  xrp: "COINBASE:XRPUSD",
  xlm: "COINBASE:XLMUSD",
  hbar: "CRYPTO:HBARUSD",
  ada: "COINBASE:ADAUSD",
  night: "BINANCE:NIGHTUSDT",
  doge: "COINBASE:DOGEUSD",
  ltc: "COINBASE:LTCUSD",
};

function tradingViewSymbol(asset) {
  if (!asset) return "COINBASE:BTCUSD";
  if (asset.tvSymbol) return asset.tvSymbol;
  if (TV_CRYPTO_SYMBOLS[asset.id]) return TV_CRYPTO_SYMBOLS[asset.id];
  if (asset.kind === "stock" || asset.yahooSymbol) {
    return String(asset.yahooSymbol || asset.symbol || "").replace(/-/g, ".");
  }
  const sym = String(asset.symbol || "").toUpperCase().replace(/[^A-Z0-9.]/g, "");
  return sym ? `${sym}USD` : "COINBASE:BTCUSD";
}

function tradingViewEmbedUrl(symbol) {
  const params = new URLSearchParams({
    symbol,
    interval: "60",
    timezone: "Etc/UTC",
    theme: "dark",
    style: "1",
    locale: "en",
    toolbarbg: "0a101c",
    hideideas: "1",
    hidesidetoolbar: "1",
    symboledit: "1",
    saveimage: "0",
    withdateranges: "1",
    hidevolume: "0",
    autosize: "1",
    backgroundColor: "#0a101c",
    gridColor: "rgba(212,175,55,0.08)",
  });
  return `https://s.tradingview.com/widgetembed/?${params.toString()}`;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ── HTTP / balances ────────────────────────────────────────────────────────

async function fetchJson(url, options = {}, timeoutMs = 15000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`HTTP ${res.status}${body ? `: ${body.slice(0, 100)}` : ""}`);
    }
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

async function fetchJsonCors(url, timeoutMs = 15000) {
  const proxies = [
    url,
    `https://corsproxy.io/?${encodeURIComponent(url)}`,
    `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
    `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`,
  ];
  let lastErr;
  for (const u of proxies) {
    try {
      const data = await fetchJson(u, {}, timeoutMs);
      if (data && typeof data.contents === "string") {
        try {
          return JSON.parse(data.contents);
        } catch {
          /* not wrapped json */
        }
      }
      return data;
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr || new Error("Network error");
}

/** Live quote, else last shown/saved price so the hoard never blanks. */
function getQuote(id) {
  const live = prices[id];
  if (live && Number.isFinite(Number(live.usd))) {
    return { usd: Number(live.usd), change24h: Number(live.change24h) || 0 };
  }
  const asset = getAsset(id);
  if (asset && Number.isFinite(Number(asset.lastUsd))) {
    return { usd: Number(asset.lastUsd), change24h: Number(asset.lastChange24h) || 0 };
  }
  return null;
}

function seedPricesFromAssets() {
  for (const a of allAssets()) {
    if (prices[a.id] && Number.isFinite(Number(prices[a.id].usd))) continue;
    if (Number.isFinite(Number(a.lastUsd))) {
      prices[a.id] = {
        usd: Number(a.lastUsd),
        change24h: Number(a.lastChange24h) || 0,
      };
    }
  }
}

function rememberQuotes(map) {
  if (!map || !Array.isArray(store.customAssets) || !store.customAssets.length) return;
  let changed = false;
  store.customAssets = store.customAssets.map((a) => {
    const q = map[a.id];
    if (!q || !Number.isFinite(Number(q.usd))) return a;
    changed = true;
    return {
      ...a,
      lastUsd: Number(q.usd),
      lastChange24h: Number(q.change24h) || 0,
      lastUsdAt: Date.now(),
    };
  });
  if (changed) saveStore();
}

async function fetchJsonRetry(url, options = {}, attempts = 2) {
  let lastErr;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fetchJson(url, options);
    } catch (err) {
      lastErr = err;
      const msg = String(err?.message || err);
      if (!/HTTP 5\d\d|Failed to fetch|NetworkError|aborted/i.test(msg) || i === attempts - 1) throw err;
      await new Promise((r) => setTimeout(r, 400 * (i + 1)));
    }
  }
  throw lastErr;
}

function satsToCoin(sats, decimals) {
  return Number(sats) / 10 ** decimals;
}

async function fetchBtcBalance(address) {
  const data = await fetchJson(`https://blockstream.info/api/address/${encodeURIComponent(address)}`);
  const funded = data?.chain_stats?.funded_txo_sum ?? 0;
  const spent = data?.chain_stats?.spent_txo_sum ?? 0;
  const memFunded = data?.mempool_stats?.funded_txo_sum ?? 0;
  const memSpent = data?.mempool_stats?.spent_txo_sum ?? 0;
  return satsToCoin(funded - spent + memFunded - memSpent, 8);
}

async function fetchLtcBalance(address) {
  try {
    const data = await fetchJson(`https://litecoinspace.org/api/address/${encodeURIComponent(address)}`);
    const funded = data?.chain_stats?.funded_txo_sum ?? 0;
    const spent = data?.chain_stats?.spent_txo_sum ?? 0;
    return satsToCoin(funded - spent, 8);
  } catch {
    const data = await fetchJson(
      `https://api.blockcypher.com/v1/ltc/main/addrs/${encodeURIComponent(address)}/balance`
    );
    return satsToCoin(data.balance ?? data.final_balance ?? 0, 8);
  }
}

async function fetchDogeBalance(address) {
  try {
    const data = await fetchJson(
      `https://api.blockcypher.com/v1/doge/main/addrs/${encodeURIComponent(address)}/balance`
    );
    return satsToCoin(data.balance ?? data.final_balance ?? 0, 8);
  } catch {
    const data = await fetchJson(
      `https://dogechain.info/api/v1/address/balance/${encodeURIComponent(address)}`
    );
    if (data?.success === 0) throw new Error(data.error || "DOGE lookup failed");
    return Number(data.balance);
  }
}

async function fetchXrpBalance(address) {
  const data = await fetchJson("https://xrplcluster.com/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      method: "account_info",
      params: [{ account: address, ledger_index: "validated", strict: true }],
    }),
  });
  if (data?.result?.error === "actNotFound") return 0;
  if (data?.result?.error) throw new Error(data.result.error_message || data.result.error);
  const drops = data?.result?.account_data?.Balance;
  if (drops == null) throw new Error("No XRP balance");
  return Number(drops) / 1e6;
}

async function fetchXlmBalance(address) {
  try {
    const data = await fetchJson(`https://horizon.stellar.org/accounts/${encodeURIComponent(address)}`);
    const native = (data.balances || []).find((b) => b.asset_type === "native");
    return Number(native?.balance ?? 0);
  } catch (err) {
    if (String(err.message).includes("404")) return 0;
    throw err;
  }
}

async function fetchHbarBalance(address) {
  const data = await fetchJsonRetry(
    `https://mainnet-public.mirrornode.hedera.com/api/v1/accounts/${encodeURIComponent(address)}`
  );
  const tinybars = data?.balance?.balance ?? data?.balance ?? 0;
  return Number(tinybars) / 1e8;
}

async function fetchAdaBalance(address) {
  const data = await fetchJsonRetry("https://api.koios.rest/api/v1/address_info", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ _addresses: [address] }),
  });
  if (!Array.isArray(data) || data.length === 0) return 0;
  return Number(data[0].balance ?? 0) / 1e6;
}

async function fetchNightBalance(address) {
  const data = await fetchJsonRetry("https://api.koios.rest/api/v1/address_assets", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ _addresses: [address] }),
  });
  if (!Array.isArray(data) || data.length === 0) return 0;
  let raw = 0;
  let decimals = 6;
  for (const row of data) {
    const assets = Array.isArray(row.asset_list) ? row.asset_list : [row];
    for (const asset of assets) {
      const policy = String(asset.policy_id || "").toLowerCase();
      const nameHex = String(asset.asset_name || "").toLowerCase();
      if (policy === NIGHT_POLICY_ID && (nameHex === NIGHT_ASSET_NAME || nameHex === "night")) {
        raw += Number(asset.quantity || 0);
        if (asset.decimals != null) decimals = Number(asset.decimals);
      }
    }
  }
  return raw / 10 ** decimals;
}

function parseYahooChart(data) {
  const meta = data?.chart?.result?.[0]?.meta;
  const price = Number(meta?.regularMarketPrice);
  if (!Number.isFinite(price)) return null;
  const prev = Number(meta?.chartPreviousClose ?? meta?.previousClose);
  const change24h = Number.isFinite(prev) && prev !== 0 ? ((price - prev) / prev) * 100 : 0;
  return { usd: price, change24h };
}

function parseNasdaqInfo(data) {
  const p = data?.data?.primaryData;
  if (!p) return null;
  const price = Number(String(p.lastSalePrice || "").replace(/[$,]/g, ""));
  if (!Number.isFinite(price) || price <= 0) return null;
  const change24h = Number(String(p.percentageChange || "").replace(/[%+,]/g, ""));
  return { usd: price, change24h: Number.isFinite(change24h) ? change24h : 0 };
}

async function fetchStockQuote(symbol) {
  const sym = String(symbol || "").trim();
  if (!sym) return null;
  const yahoo = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?interval=1d&range=5d`;
  const yahoo2 = `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?interval=1d&range=5d`;
  const ns = encodeURIComponent(sym.replace(/-/g, "."));
  const nasdaq = `https://api.nasdaq.com/api/quote/${ns}/info?assetclass=stocks`;
  const nasdaqEtf = `https://api.nasdaq.com/api/quote/${ns}/info?assetclass=etf`;

  const tries = [
    () => fetchJson(yahoo).then(parseYahooChart),
    () => fetchJson(yahoo2).then(parseYahooChart),
    () => fetchJsonCors(yahoo).then(parseYahooChart),
    () => fetchJsonCors(yahoo2).then(parseYahooChart),
    () => fetchJsonCors(nasdaq).then(parseNasdaqInfo),
    () => fetchJsonCors(nasdaqEtf).then(parseNasdaqInfo),
  ];
  for (const tryOne of tries) {
    try {
      const q = await tryOne();
      if (q && Number.isFinite(q.usd)) return q;
    } catch {
      /* next source */
    }
  }
  return null;
}

async function fetchPrices() {
  const assets = allAssets();
  const cryptos = assets.filter((a) => a.geckoId);
  const stocks = assets.filter((a) => a.yahooSymbol && !a.geckoId);
  const next = { ...prices };
  seedPricesFromAssets();
  for (const [id, q] of Object.entries(prices)) {
    if (q && Number.isFinite(q.usd) && !next[id]) next[id] = q;
  }

  if (cryptos.length) {
    try {
      const ids = [...new Set(cryptos.map((c) => c.geckoId))].join(",");
      const data = await fetchJson(
        `https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(ids)}&vs_currencies=usd&include_24hr_change=true`
      );
      for (const coin of cryptos) {
        const row = data[coin.geckoId];
        if (row && row.usd != null && Number.isFinite(Number(row.usd))) {
          next[coin.id] = {
            usd: Number(row.usd),
            change24h: Number(row.usd_24h_change) || 0,
          };
        }
      }
    } catch {
      /* keep last crypto quotes */
    }
  }

  if (stocks.length) {
    await runPool(
      stocks.map((stock) => async () => {
        try {
          const q = await fetchStockQuote(stock.yahooSymbol);
          if (q) next[stock.id] = q;
        } catch {
          /* keep last quote */
        }
      }),
      3
    );
  }

  prices = next;
  rememberQuotes(next);
  saveMarketSnapshot();
}

const CHART_CACHE_MS = 5 * 60 * 1000;

const CHART_RANGES = {
  "1": { label: "24H", days: "1", spanMs: 24 * 3600 * 1000 },
  "7": { label: "7D", days: "7", spanMs: 7 * 24 * 3600 * 1000 },
  "30": { label: "30D", days: "30", spanMs: 30 * 24 * 3600 * 1000 },
  "90": { label: "90D", days: "90", spanMs: 90 * 24 * 3600 * 1000 },
  max: { label: "ALL", days: "max", spanMs: 10 * 365 * 24 * 3600 * 1000 },
};

function chartCacheKey(coinId, days) {
  return `${coinId}:${days}`;
}

function rangeSpanMs(days) {
  return CHART_RANGES[days]?.spanMs ?? 24 * 3600 * 1000;
}

async function fetchStockChart(symbol, days = "1") {
  const range = days === "1" || days === 1 ? "1d" : days === "7" ? "5d" : days === "30" ? "1mo" : days === "90" ? "3mo" : "max";
  const interval = range === "1d" ? "5m" : "1d";
  const data = await fetchJsonCors(
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=${interval}&range=${range}`
  );
  const result = data?.chart?.result?.[0];
  const ts = result?.timestamp;
  const close = result?.indicators?.quote?.[0]?.close;
  if (!Array.isArray(ts) || !Array.isArray(close)) return [];
  return ts
    .map((t, i) => [Number(t) * 1000, Number(close[i])])
    .filter((p) => Number.isFinite(p[0]) && Number.isFinite(p[1]));
}

/** Fetch (or reuse) price series for a coin from CoinGecko / Yahoo for the given days. */
async function fetchCoinChart(coinId, days = "1") {
  const coin = getAsset(coinId);
  if (!coin) return [];
  const key = chartCacheKey(coinId, days);
  const cached = chartCache[key];
  if (cached && Date.now() - cached.fetchedAt < CHART_CACHE_MS && cached.points?.length) {
    return cached.points;
  }

  if (coin.yahooSymbol && (coin.kind === "stock" || coin.kind === "metal")) {
    try {
      const points = await fetchStockChart(coin.yahooSymbol, days);
      if (points.length) {
        chartCache[key] = { fetchedAt: Date.now(), points };
        return points;
      }
    } catch (err) {
      if (cached?.points?.length) return cached.points;
      throw err;
    }
  }

  if (!coin.geckoId) {
    if (cached?.points?.length) return cached.points;
    return [];
  }

  let lastErr;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const data = await fetchJson(
        `https://api.coingecko.com/api/v3/coins/${encodeURIComponent(coin.geckoId)}/market_chart?vs_currency=usd&days=${encodeURIComponent(days)}`,
        {},
        20000
      );
      const points = Array.isArray(data?.prices)
        ? data.prices
            .filter((p) => Array.isArray(p) && p.length >= 2 && Number.isFinite(p[0]) && Number.isFinite(p[1]))
            .map((p) => /** @type {[number, number]} */ ([p[0], p[1]]))
        : [];
      if (points.length) {
        chartCache[key] = { fetchedAt: Date.now(), points };
        return points;
      }
      lastErr = new Error("Empty chart data");
    } catch (err) {
      lastErr = err;
      const msg = String(err?.message || err);
      if (/429/.test(msg)) await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
      else if (attempt === 0) await new Promise((r) => setTimeout(r, 300));
    }
  }
  // Stale cache is better than nothing
  if (cached?.points?.length) return cached.points;
  throw lastErr || new Error("Chart fetch failed");
}

/**
 * Build a portfolio USD value series using current balances × historical prices.
 * @param {{ coinId: string, balance: number }[]} holdings
 * @param {string} days
 * @returns {Promise<{ series: { t: number, v: number }[], partial: boolean, failed: number }>}
 */
async function buildPortfolioSeries(holdings, days = "1") {
  const active = (holdings || []).filter((h) => h.balance > 0 && getAsset(h.coinId));
  if (!active.length) return { series: [], partial: false, failed: 0 };

  const seriesByCoin = {};
  let failed = 0;
  await runPool(
    active.map((h) => async () => {
      try {
        seriesByCoin[h.coinId] = await fetchCoinChart(h.coinId, days);
      } catch {
        const stale = chartCache[chartCacheKey(h.coinId, days)]?.points;
        if (stale?.length) seriesByCoin[h.coinId] = stale;
        else {
          seriesByCoin[h.coinId] = [];
          failed += 1;
        }
      }
    }),
    2
  );

  // Common timeline from the densest successful series
  let timeline = [];
  for (const h of active) {
    const pts = seriesByCoin[h.coinId] || [];
    if (pts.length > timeline.length) timeline = pts.map((p) => p[0]);
  }

  if (timeline.length < 2) {
    if (failed === active.length) {
      return { series: [], partial: false, failed };
    }
    // Soft fallback only when we have prices but empty charts
    const total = active.reduce((s, h) => s + h.balance * (getQuote(h.coinId)?.usd || 0), 0);
    const now = Date.now();
    return {
      series: [
        { t: now - rangeSpanMs(days), v: total },
        { t: now, v: total },
      ],
      partial: failed > 0,
      failed,
    };
  }

  function priceAt(points, ts) {
    if (!points?.length) return null;
    let lo = 0;
    let hi = points.length - 1;
    if (ts <= points[0][0]) return points[0][1];
    if (ts >= points[hi][0]) return points[hi][1];
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      const mt = points[mid][0];
      if (mt === ts) return points[mid][1];
      if (mt < ts) lo = mid + 1;
      else hi = mid - 1;
    }
    const i = Math.max(0, Math.min(points.length - 1, lo));
    const a = points[Math.max(0, i - 1)];
    const b = points[i];
    if (!a || !b) return b?.[1] ?? a?.[1] ?? null;
    if (b[0] === a[0]) return b[1];
    const w = (ts - a[0]) / (b[0] - a[0]);
    return a[1] + (b[1] - a[1]) * w;
  }

  const out = [];
  for (const t of timeline) {
    let v = 0;
    let ok = false;
    for (const h of active) {
      const px = priceAt(seriesByCoin[h.coinId], t);
      if (px == null) continue;
      v += h.balance * px;
      ok = true;
    }
    if (ok) out.push({ t, v });
  }
  return { series: out, partial: failed > 0, failed };
}

/**
 * Draw an area chart into an SVG element.
 * @param {SVGElement} svg
 * @param {{ t: number, v: number }[]} series
 */
function renderSparkline(svg, series) {
  if (!svg) return false;
  if (!series || series.length < 2) {
    svg.innerHTML = "";
    return false;
  }

  const W = 320;
  const H = 96;
  const padX = 0;
  const padY = 6;
  const vals = series.map((p) => p.v);
  let min = Math.min(...vals);
  let max = Math.max(...vals);
  if (min === max) {
    min *= 0.99;
    max *= 1.01;
    if (min === 0 && max === 0) {
      min = -1;
      max = 1;
    }
  }
  const first = series[0].v;
  const last = series[series.length - 1].v;
  const up = last >= first;
  const stroke = up ? "#7dba5a" : "#d4543c";
  const fillId = `chartFill_${svg.id || "main"}`;

  const xAt = (i) => padX + (i / (series.length - 1)) * (W - padX * 2);
  const yAt = (v) => padY + (1 - (v - min) / (max - min)) * (H - padY * 2);

  let line = "";
  for (let i = 0; i < series.length; i++) {
    const x = xAt(i);
    const y = yAt(series[i].v);
    line += i === 0 ? `M ${x.toFixed(2)} ${y.toFixed(2)}` : ` L ${x.toFixed(2)} ${y.toFixed(2)}`;
  }
  const yBase = H;
  const area =
    line +
    ` L ${xAt(series.length - 1).toFixed(2)} ${yBase} L ${xAt(0).toFixed(2)} ${yBase} Z`;

  svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
  svg.innerHTML = `
    <defs>
      <linearGradient id="${fillId}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="${stroke}" stop-opacity="0.35"/>
        <stop offset="100%" stop-color="${stroke}" stop-opacity="0"/>
      </linearGradient>
    </defs>
    <path d="${area}" fill="url(#${fillId})" />
    <path d="${line}" fill="none" stroke="${stroke}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke" />
  `;
  return true;
}

let chartRenderToken = 0;

/** @param {"loading"|"error"|"empty"|"ok"|"partial"} state */
function setChartOverlay(state, message) {
  const overlay = document.getElementById("home-chart-overlay");
  const spinner = document.getElementById("home-chart-spinner");
  const status = document.getElementById("home-chart-status");
  const retry = document.getElementById("home-chart-retry");
  const wrap = document.getElementById("home-chart-wrap");
  if (!overlay) return;

  const show = state !== "ok";
  overlay.hidden = !show;
  overlay.classList.toggle("is-error", state === "error");
  overlay.classList.toggle("is-loading", state === "loading");
  overlay.classList.toggle("is-partial", state === "partial");
  if (wrap) {
    wrap.classList.toggle("is-loading", state === "loading");
    wrap.classList.toggle("has-error", state === "error" || state === "empty");
  }

  if (spinner) spinner.hidden = state !== "loading";
  if (retry) retry.hidden = state !== "error";
  if (status) status.textContent = message || "";
}

/** Load and paint the dashboard 24H portfolio chart. */
async function updateHomeChart(allocRows, { force } = {}) {
  const svg = document.getElementById("home-chart");
  if (!svg) return;

  const holdings =
    allocRows != null
      ? (allocRows || [])
          .filter((r) => r.balance > 0)
          .map((r) => ({ coinId: r.coinId, balance: r.balance }))
      : lastChartHoldings;

  lastChartHoldings = holdings;

  if (!holdings.length) {
    svg.innerHTML = "";
    chartLoading = false;
    updateGlobalSpinner();
    setChartOverlay("empty", "Add treasures to see the omen");
    return;
  }

  const token = ++chartRenderToken;
  const rangeLabel = CHART_RANGES[chartRange]?.label || "24H";
  chartLoading = true;
  updateGlobalSpinner();
  setChartOverlay("loading", `Loading ${rangeLabel} chart…`);
  // Keep previous SVG visible under dimmed overlay while loading (unless forced clear)
  if (force) svg.innerHTML = "";

  try {
    const { series, partial, failed } = await buildPortfolioSeries(holdings, chartRange);
    if (token !== chartRenderToken) return;

    const ok = renderSparkline(svg, series);
    if (!ok) {
      setChartOverlay("error", "The omen faded. Scry again or retry.");
      return;
    }
    if (partial && failed > 0) {
      setChartOverlay(
        "partial",
        failed === 1 ? "Partial data — 1 coin missing" : `Partial data — ${failed} coins missing`
      );
      // Auto-hide partial banner after a moment so chart stays readable
      setTimeout(() => {
        if (token === chartRenderToken) setChartOverlay("ok");
      }, 2200);
    } else {
      setChartOverlay("ok");
    }
  } catch (err) {
    if (token !== chartRenderToken) return;
    // Keep previous SVG if we had one; only clear when empty
    if (!svg.innerHTML.trim()) svg.innerHTML = "";
    const msg = /429|Rate/.test(String(err?.message || err))
      ? "Rate limited — try again in a moment"
      : "Chart didn’t load. Tap retry.";
    setChartOverlay("error", msg);
  } finally {
    if (token === chartRenderToken) {
      chartLoading = false;
      updateGlobalSpinner();
    }
  }
}

function humanizeError(err) {
  const msg = err?.message || String(err);
  if (/Failed to fetch|NetworkError|TypeError/i.test(msg)) return "Network error";
  if (/aborted|AbortError/i.test(msg)) return "Timed out";
  if (/404/.test(msg)) return "Not found";
  if (/429/.test(msg)) return "Rate limited";
  return msg.slice(0, 100);
}

// ── Portfolio math ─────────────────────────────────────────────────────────

function ensureCacheSlot(pfId, coinId, addr) {
  if (!balanceCache[pfId]) balanceCache[pfId] = {};
  if (!balanceCache[pfId][coinId]) balanceCache[pfId][coinId] = {};
  if (!balanceCache[pfId][coinId][addr]) {
    balanceCache[pfId][coinId][addr] = { balance: null, error: null, loading: false };
  }
  return balanceCache[pfId][coinId][addr];
}

/**
 * Combined balance for a coin in a portfolio:
 * on-chain address balances + all manual amounts.
 */
function coinBalanceInPortfolio(pf, coinId) {
  const holding = getCoinHolding(pf, coinId);
  const addrs = holding.addresses;
  const manualEntries = holding.manual;

  let onchain = 0;
  let onchainLoaded = false;
  let onchainPending = false;
  for (const addr of addrs) {
    const st = balanceCache[pf.id]?.[coinId]?.[addr];
    if (st?.loading) onchainPending = true;
    if (st && st.balance != null && !st.error) {
      onchain += st.balance;
      onchainLoaded = true;
    }
  }

  const manual = manualEntries.reduce((s, m) => s + (Number(m.amount) || 0), 0);
  const hasManual = manual > 0;
  const hasAddresses = addrs.length > 0;

  // Total uses loaded on-chain data when available; if addresses exist but none loaded yet, still include manual
  const onchainPart = onchainLoaded ? onchain : 0;
  const balance = onchainPart + manual;
  const hasData = onchainLoaded || hasManual;
  const sourceCount = addrs.length + manualEntries.length;

  return {
    balance,
    onchain: onchainPart,
    manual,
    hasData,
    hasManual,
    hasAddresses,
    onchainLoaded,
    onchainPending,
    addrCount: addrs.length,
    manualCount: manualEntries.length,
    sourceCount,
  };
}

function portfolioHasCoin(pf, coinId) {
  const h = getCoinHolding(pf, coinId);
  return h.addresses.length > 0 || h.manual.length > 0;
}

/**
 * Cost basis / avg buy / unrealized P/L for a coin in a portfolio.
 * Avg buy = costBasisUsd / current balance (when both set).
 */
function costBasisInfo(pf, coinId) {
  const holding = getCoinHolding(pf, coinId);
  const balInfo = coinBalanceInPortfolio(pf, coinId);
  const balance = balInfo.hasData ? balInfo.balance : 0;
  const cost = Number(holding.costBasisUsd) || 0;
  const avg = balance > 0 && cost > 0 ? cost / balance : null;
  const px = getQuote(coinId)?.usd ?? 0;
  const market = balance * px;
  const pl = cost > 0 ? market - cost : null;
  const plPct = cost > 0 && Number.isFinite(pl) ? (pl / cost) * 100 : null;
  return { cost, avg, market, pl, plPct, balance };
}

/** Set average buy price → cost basis = avg × current holdings. */
function setAvgBuyPrice(pf, coinId, avgRaw) {
  const holding = getCoinHolding(pf, coinId);
  const avg = parseOptionalUsd(avgRaw);
  if (avg == null || avg <= 0) {
    toast("Enter a valid average buy price", "error");
    return false;
  }
  const bal = coinBalanceInPortfolio(pf, coinId);
  const qty = bal.hasData ? bal.balance : 0;
  if (qty <= 0) {
    toast("Add a holding amount first", "error");
    return false;
  }
  holding.costBasisUsd = avg * qty;
  saveStore();
  return true;
}

/** Set total cost basis USD → implies avg = cost / holdings. */
function setCostBasisUsd(pf, coinId, costRaw) {
  const holding = getCoinHolding(pf, coinId);
  const cost = parseOptionalUsd(costRaw);
  if (cost == null) {
    toast("Enter a valid cost basis", "error");
    return false;
  }
  holding.costBasisUsd = cost;
  saveStore();
  return true;
}

/** Clear cost basis for a coin. */
function clearCostBasis(pf, coinId) {
  const holding = getCoinHolding(pf, coinId);
  holding.costBasisUsd = 0;
  saveStore();
}

function portfolioTotals(pf) {
  let totalUsd = 0;
  let totalPrev = 0;
  let assets = 0;
  let sourceCount = 0;
  /** @type {{ coinId: string, balance: number, usd: number, change24h: number, alloc: number }[]} */
  const rows = [];

  for (const coin of allAssets()) {
    if (!portfolioHasCoin(pf, coin.id)) continue;
    const info = coinBalanceInPortfolio(pf, coin.id);
    sourceCount += info.sourceCount;
    assets += 1;
    const px = getQuote(coin.id)?.usd ?? 0;
    const ch = getQuote(coin.id)?.change24h ?? 0;
    const usd = (info.hasData ? info.balance : 0) * px;
    totalUsd += usd;
    const prev = ch === -100 ? 0 : usd / (1 + ch / 100);
    totalPrev += Number.isFinite(prev) ? prev : usd;
    rows.push({
      coinId: coin.id,
      balance: info.hasData ? info.balance : 0,
      usd,
      change24h: ch,
      alloc: 0,
    });
  }

  for (const r of rows) {
    r.alloc = totalUsd > 0 ? (r.usd / totalUsd) * 100 : 0;
  }
  rows.sort((a, b) => b.usd - a.usd);

  const changeUsd = totalUsd - totalPrev;
  const changePct = totalPrev > 0 ? (changeUsd / totalPrev) * 100 : null;

  return { totalUsd, changeUsd, changePct, assets, addrCount: sourceCount, sourceCount, rows };
}

function isIncludedInTotal(pf) {
  return pf.includeInTotal !== false;
}

function allPortfoliosTotals() {
  let totalUsd = 0;
  let changeUsd = 0;
  let weightedPrev = 0;
  let includedCount = 0;
  let excludedCount = 0;

  const perPf = store.portfolios.map((pf) => {
    const t = portfolioTotals(pf);
    const included = isIncludedInTotal(pf);
    if (included) {
      totalUsd += t.totalUsd;
      changeUsd += t.changeUsd;
      weightedPrev += t.totalUsd - t.changeUsd;
      includedCount += 1;
    } else {
      excludedCount += 1;
    }
    return { pf, included, ...t };
  });

  const changePct = weightedPrev > 0 ? (changeUsd / weightedPrev) * 100 : null;

  // Allocation + coin balances only from portfolios included in the main total
  const byCoin = {};
  for (const item of perPf) {
    if (!item.included) continue;
    for (const r of item.rows) {
      if (!byCoin[r.coinId]) byCoin[r.coinId] = { usd: 0, balance: 0 };
      byCoin[r.coinId].usd += r.usd;
      byCoin[r.coinId].balance += r.balance;
    }
  }
  const allocRows = Object.entries(byCoin)
    .map(([coinId, { usd, balance }]) => ({
      coinId,
      usd,
      balance,
      alloc: totalUsd > 0 ? (usd / totalUsd) * 100 : 0,
    }))
    .sort((a, b) => b.usd - a.usd);

  return { totalUsd, changeUsd, changePct, perPf, allocRows, includedCount, excludedCount };
}

/** Aggregated cost basis + unrealized P/L across portfolios included in the hall total. */
function allPortfoliosCostTotals() {
  /** @type {Record<string, { coinId: string, cost: number, market: number, balance: number }>} */
  const byCoin = {};
  let totalCost = 0;
  let totalMarket = 0;

  for (const pf of store.portfolios) {
    if (!isIncludedInTotal(pf)) continue;
    for (const coin of allAssets()) {
      if (!portfolioHasCoin(pf, coin.id)) continue;
      const cb = costBasisInfo(pf, coin.id);
      if (!byCoin[coin.id]) {
        byCoin[coin.id] = { coinId: coin.id, cost: 0, market: 0, balance: 0 };
      }
      byCoin[coin.id].cost += cb.cost;
      byCoin[coin.id].market += cb.market;
      byCoin[coin.id].balance += cb.balance;
      totalCost += cb.cost;
      totalMarket += cb.market;
    }
  }

  const rows = Object.values(byCoin)
    .map((r) => {
      const pl = r.cost > 0 ? r.market - r.cost : null;
      return {
        ...r,
        avg: r.balance > 0 && r.cost > 0 ? r.cost / r.balance : null,
        pl,
        plPct: r.cost > 0 && pl != null ? (pl / r.cost) * 100 : null,
      };
    })
    .filter((r) => r.balance > 0 || r.market > 0 || r.cost > 0)
    .sort((a, b) => b.market - a.market);

  const pl = totalCost > 0 ? totalMarket - totalCost : null;
  const plPct = totalCost > 0 && pl != null ? (pl / totalCost) * 100 : null;
  return { totalCost, totalMarket, pl, plPct, rows };
}

// ── Refresh ────────────────────────────────────────────────────────────────

async function refreshBalance(pfId, coinId, addr) {
  const coin = getAsset(coinId);
  if (!coin?.fetchBalance) return;
  const slot = ensureCacheSlot(pfId, coinId, addr);
  // Keep previous balance visible while refreshing (don't zero out)
  slot.loading = true;
  updateGlobalSpinner();
  try {
    const bal = await coin.fetchBalance(addr);
    if (bal != null && Number.isFinite(Number(bal))) {
      slot.balance = Number(bal);
      slot.error = null;
    } else {
      // Keep last good balance; surface a soft error
      slot.error = slot.balance != null ? null : "No balance";
    }
  } catch (err) {
    // On failure keep last known balance so totals don't flash to $0
    slot.error = humanizeError(err);
  } finally {
    slot.loading = false;
    updateGlobalSpinner();
  }
}

async function runPool(fns, concurrency = 4) {
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(concurrency, fns.length) }, async () => {
      while (i < fns.length) {
        const fn = fns[i++];
        await fn();
      }
    })
  );
}

let refreshInFlight = false;

async function refreshAll({ fromPull } = {}) {
  if (refreshInFlight) return;
  refreshInFlight = true;
  updateGlobalSpinner();

  if (fromPull) {
    setPtrOffset(PTR.holdOffset, { mode: "refreshing" });
  }

  try {
    try {
      await fetchPrices();
      // Re-render with new prices while balances still show last known values
      render();
    } catch (err) {
      toast(`Prices: ${humanizeError(err)}`, "error");
      // Keep prior prices — do not wipe to zero
    }

    // Allow pull-to-refresh to pull fresh 24h series
    chartCache = {};

    const jobs = [];
    for (const pf of store.portfolios) {
      for (const coin of allAssets()) {
        if (!coin.fetchBalance) continue;
        const holding = getCoinHolding(pf, coin.id);
        for (const addr of holding.addresses) {
          // Mark loading but keep existing balance for display
          const slot = ensureCacheSlot(pf.id, coin.id, addr);
          slot.loading = true;
          jobs.push(() => refreshBalance(pf.id, coin.id, addr));
        }
      }
    }

    updateGlobalSpinner();
    if (jobs.length) {
      render(); // loading flags on, values still from last snapshot
      await runPool(jobs, 4);
    }

    saveMarketSnapshot();
    render();
    toast("Updated", "success");
  } finally {
    refreshInFlight = false;
    updateGlobalSpinner();
    // Always fully settle PTR so the screen never stays half-scrolled
    resetPtrVisual({ animate: fromPull });
  }
}

// ── Pull to refresh (CMC-style) ────────────────────────────────────────────
// Scroll is the default. PTR only engages when:
//   1) content is already at the top, AND
//   2) the finger pulls DOWN past an activation dead-zone.
// Normal scroll (finger up / content move) is never stolen.

const PTR = {
  /** Finger must pull this far past top before we claim the gesture (px). */
  activateAt: 18,
  /** Finger pull distance to arm refresh on release (px). */
  threshold: 90,
  /** Visual hold while refreshing (px). */
  holdOffset: 52,
  /** Max visual pull (px). */
  maxVisual: 120,
  startY: 0,
  startX: 0,
  /** Touch began at top of list — candidate for PTR. */
  canPull: false,
  /** We've claimed this gesture (preventDefault + rubber band). */
  active: false,
  armed: false,
  distance: 0,
  offset: 0,
};

function getViewsEl() {
  return document.getElementById("views");
}

function isAtScrollTop(el) {
  // Allow 1px of iOS subpixel / bounce noise
  return !!el && el.scrollTop <= 1;
}

/** Rubber-band visual distance from finger travel (diminishing). */
function ptrVisualFromPull(pullPx) {
  if (pullPx <= 0) return 0;
  // Soft spring: never jumps to max instantly
  const v = PTR.maxVisual * (1 - Math.exp(-pullPx / 95));
  return Math.min(PTR.maxVisual, v);
}

function setPtrCssOffset(px) {
  const views = getViewsEl();
  const val = `${Math.max(0, px || 0)}px`;
  document.documentElement.style.setProperty("--ptr-offset", val);
  if (views) views.style.setProperty("--ptr-offset", val);
}

function setPtrOffset(px, { mode } = {}) {
  const ptr = document.getElementById("ptr-indicator");
  const ptrIcon = document.getElementById("ptr-icon");
  const ptrLabel = document.getElementById("ptr-label");
  if (!ptr) return;

  const offset = Math.max(0, px || 0);
  PTR.offset = offset;
  setPtrCssOffset(offset);

  const show = offset > 1 || mode === "refreshing";
  ptr.classList.toggle("visible", show);
  ptr.classList.toggle("refreshing", mode === "refreshing");
  ptr.setAttribute("aria-hidden", show ? "false" : "true");

  if (mode === "refreshing") {
    ptr.classList.remove("armed");
    PTR.armed = false;
    if (ptrIcon) ptrIcon.textContent = "↻";
    if (ptrLabel) ptrLabel.textContent = "Scrying…";
    return;
  }

  PTR.armed = PTR.distance >= PTR.threshold;
  ptr.classList.toggle("armed", PTR.armed && !refreshInFlight);

  if (!refreshInFlight) {
    if (ptrIcon) ptrIcon.textContent = "↓";
    if (ptrLabel) {
      ptrLabel.textContent = PTR.armed ? "Release to scry" : "Scry the markets";
    }
  }
}

function clearPtrStateFlags() {
  PTR.canPull = false;
  PTR.active = false;
  PTR.armed = false;
  PTR.distance = 0;
}

function resetPtrVisual({ animate } = {}) {
  const views = getViewsEl();
  const ptr = document.getElementById("ptr-indicator");
  const current = PTR.offset || 0;

  clearPtrStateFlags();
  PTR.offset = 0;

  const finishClear = () => {
    if (views) {
      views.classList.remove("ptr-animating", "ptr-active");
      views.style.transform = "";
      views.style.removeProperty("--ptr-offset");
      // Hard-settle scroll if iOS left a rubber-band
      if (views.scrollTop < 0) views.scrollTop = 0;
    }
    document.documentElement.style.removeProperty("--ptr-offset");
    if (ptr) {
      ptr.classList.remove("visible", "armed", "refreshing");
      ptr.style.transform = "";
      ptr.setAttribute("aria-hidden", "true");
      const ptrIcon = document.getElementById("ptr-icon");
      const ptrLabel = document.getElementById("ptr-label");
      if (ptrIcon) ptrIcon.textContent = "↓";
      if (ptrLabel) ptrLabel.textContent = "Scry the markets";
    }
  };

  if (animate && current > 1) {
    if (views) views.classList.add("ptr-animating");
    setPtrCssOffset(current);
    void (views && views.offsetHeight);
    setPtrCssOffset(0);
    let done = false;
    const onEnd = () => {
      if (done) return;
      done = true;
      finishClear();
    };
    if (views) views.addEventListener("transitionend", onEnd, { once: true });
    setTimeout(onEnd, 280);
  } else {
    finishClear();
  }
}

function abandonPullGesture() {
  if (PTR.active || PTR.offset > 0) {
    resetPtrVisual({ animate: false });
  } else {
    clearPtrStateFlags();
  }
}

function wirePullToRefresh() {
  const views = getViewsEl();
  if (!views) return;

  views.addEventListener(
    "touchstart",
    (e) => {
      if (refreshInFlight) {
        abandonPullGesture();
        return;
      }
      const t = e.touches[0];
      PTR.startY = t.clientY;
      PTR.startX = t.clientX;
      PTR.distance = 0;
      PTR.armed = false;
      PTR.active = false;
      // Only candidates at the very top — otherwise pure scroll
      PTR.canPull = isAtScrollTop(views);
      if (!PTR.canPull) PTR.offset = 0;
    },
    { passive: true }
  );

  views.addEventListener(
    "touchmove",
    (e) => {
      if (!PTR.canPull || refreshInFlight) return;

      const t = e.touches[0];
      const dy = t.clientY - PTR.startY; // >0 = finger down = overscroll at top
      const dx = t.clientX - PTR.startX;

      // Already scrolled away before we claimed the gesture → pure scroll
      if (!PTR.active && !isAtScrollTop(views)) {
        PTR.canPull = false;
        return;
      }

      // Horizontal pan — don't steal
      if (!PTR.active && Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy) * 1.1) {
        PTR.canPull = false;
        return;
      }

      // Finger moving up (content scrolls down the list) — never PTR
      if (dy <= 0) {
        if (PTR.active) {
          // User reversed; drop pull visual and release claim so scroll can resume
          setPtrOffset(0);
          PTR.active = false;
          PTR.distance = 0;
          PTR.armed = false;
          views.classList.remove("ptr-active");
        }
        return;
      }

      // Still in dead-zone: allow browser/native scroll handling, don't preventDefault
      if (!PTR.active) {
        if (dy < PTR.activateAt) return;
        // Activate only if still glued to the top
        if (!isAtScrollTop(views)) {
          PTR.canPull = false;
          return;
        }
        PTR.active = true;
        views.classList.add("ptr-active");
      }

      // Claimed pull: block scroll rubber-band, show PTR UI
      if (e.cancelable) e.preventDefault();

      // Distance past activation (pulling "way down")
      PTR.distance = dy;
      const visual = ptrVisualFromPull(Math.max(0, dy - PTR.activateAt * 0.35));
      setPtrOffset(visual);
    },
    { passive: false }
  );

  const endPull = () => {
    if (!PTR.canPull && !PTR.active) return;

    const shouldRefresh = PTR.active && PTR.armed && !refreshInFlight;
    views.classList.remove("ptr-active");

    if (shouldRefresh) {
      PTR.canPull = false;
      PTR.active = false;
      setPtrOffset(PTR.holdOffset, { mode: "refreshing" });
      refreshAll({ fromPull: true });
      return;
    }

    // Snap back; normal scroll was never blocked unless we had activated
    if (PTR.active || PTR.offset > 0) {
      resetPtrVisual({ animate: true });
    } else {
      clearPtrStateFlags();
    }
  };

  views.addEventListener("touchend", endPull, { passive: true });
  views.addEventListener("touchcancel", endPull, { passive: true });

  // If the user scrolls with wheel/trackpad, never leave a stuck pull
  views.addEventListener(
    "scroll",
    () => {
      if (!PTR.active && !isAtScrollTop(views) && PTR.canPull) {
        PTR.canPull = false;
      }
    },
    { passive: true }
  );
}

// ── UI helpers ─────────────────────────────────────────────────────────────

function toast(msg, kind = "") {
  const el = document.getElementById("toast");
  el.textContent = msg;
  el.className = "toast" + (kind ? ` ${kind}` : "");
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    el.hidden = true;
  }, 2400);
}

function renderAllocBar(el, rows) {
  el.innerHTML = "";
  if (!rows.length) return;
  for (const r of rows) {
    if (r.alloc < 0.5 && rows.length > 1) continue;
    const seg = document.createElement("div");
    seg.className = "alloc-seg";
    const coin = getAsset(r.coinId);
    seg.style.width = `${Math.max(r.alloc, 1)}%`;
    seg.style.background = coin?.color || "#d4af37";
    seg.title = `${coin?.symbol || r.coinId}: ${r.alloc.toFixed(1)}%`;
    el.appendChild(seg);
  }
}

function setChangePill(container, changeUsd, changePct) {
  const { text, cls } = formatChangeUsd(changeUsd, changePct);
  container.innerHTML = `<span class="pill ${cls}">${text}</span><span class="muted">24h</span>`;
}

// ── Navigation ─────────────────────────────────────────────────────────────

function showView(view, { portfolioId, coinId } = {}) {
  if (view === "tv" && nav.view !== "tv") {
    nav.tvReturn = { view: nav.view, portfolioId: nav.portfolioId, coinId: nav.coinId };
  }
  nav.view = view;
  if (portfolioId !== undefined) nav.portfolioId = portfolioId;
  if (coinId !== undefined) nav.coinId = coinId;
  render();
}

function render() {
  // View visibility
  document.querySelectorAll(".view").forEach((v) => {
    v.classList.toggle("view-active", v.dataset.view === nav.view);
  });
  document.getElementById("app")?.classList.toggle("tv-open", nav.view === "tv");

  const back = document.getElementById("btn-back");
  const settingsBtn = document.getElementById("btn-settings");
  const brand = document.getElementById("topbar-brand");
  const title = document.getElementById("topbar-title");
  const switchBtn = document.getElementById("btn-portfolio-switch");
  const topbarRight = document.querySelector(".topbar-right");

  // Same top-left slot: Settings on home only; Back everywhere else
  const isHome = nav.view === "home";
  if (settingsBtn) settingsBtn.hidden = !isHome;
  if (back) back.hidden = isHome;

  // Portfolio switch sits far right of the header (not under the brand)
  const showPfSwitch =
    nav.view === "portfolio" || nav.view === "asset" || nav.view === "add-coin";
  if (switchBtn) {
    switchBtn.hidden = !showPfSwitch;
    if (showPfSwitch) {
      const pf = getPortfolio(nav.portfolioId) || getActivePortfolio();
      document.getElementById("active-portfolio-label").textContent = pf?.name || "Portfolio";
    }
  }
  if (topbarRight) topbarRight.classList.toggle("has-switch", showPfSwitch);

  // Center: Wizard Portfolio brand on home/portfolio; page title elsewhere
  if (nav.view === "home") {
    if (brand) brand.hidden = false;
    title.hidden = true;
    renderHome();
    syncHomePager(false);
  } else if (nav.view === "portfolio") {
    if (brand) brand.hidden = false;
    title.hidden = true;
    renderPortfolio();
  } else if (nav.view === "asset") {
    if (brand) brand.hidden = true;
    title.hidden = false;
    title.textContent = getAsset(nav.coinId)?.symbol || "Asset";
    renderAsset();
  } else if (nav.view === "add-coin") {
    if (brand) brand.hidden = true;
    title.hidden = false;
    title.textContent = "Add treasure";
    renderAddCoin();
  } else if (nav.view === "settings") {
    if (brand) brand.hidden = true;
    title.hidden = false;
    title.textContent = "Codex";
    renderSettings();
  } else if (nav.view === "tv") {
    if (brand) brand.hidden = true;
    title.hidden = false;
    title.textContent = getAsset(nav.coinId)?.symbol || "Chart";
    renderTvChart();
  }
}

function renderTvChart() {
  const asset = getAsset(nav.coinId);
  if (!asset) {
    showView("home");
    return;
  }
  setCoinAvatarEl(document.getElementById("tv-avatar"), asset);
  const nameEl = document.getElementById("tv-name");
  const subEl = document.getElementById("tv-symbol");
  if (nameEl) nameEl.textContent = asset.name;
  if (subEl) {
    const tvSym = tradingViewSymbol(asset);
    subEl.textContent = `${asset.symbol} · ${tvSym}`;
  }
  const frame = document.getElementById("tv-frame");
  if (!frame) return;
  const symbol = tradingViewSymbol(asset);
  const src = tradingViewEmbedUrl(symbol);
  if (frame.dataset.symbol !== symbol) {
    frame.dataset.symbol = symbol;
    frame.src = src;
  }
}

/** Dashboard: aggregated coin holdings from portfolios included in the total. */
function renderHome() {
  const { totalUsd, changeUsd, changePct, allocRows } = allPortfoliosTotals();
  document.getElementById("home-total").textContent = formatUsd(totalUsd);
  setChangePill(document.getElementById("home-change"), changeUsd, changePct);
  renderAllocBar(document.getElementById("home-alloc-bar"), allocRows);
  updateHomeChart(allocRows);

  const list = document.getElementById("home-holdings-list");
  const empty = document.getElementById("home-empty");
  list.innerHTML = "";

  const rows = (allocRows || []).filter((r) => r.balance > 0 || r.usd > 0);
  if (!rows.length) {
    empty.hidden = false;
    return;
  }
  empty.hidden = true;

  for (const r of rows) {
    const coin = getAsset(r.coinId);
    if (!coin) continue;
    const px = getQuote(coin.id)?.usd;
    const ch = getQuote(coin.id)?.change24h;
    const pct = formatPct(ch);

    // Loading if any included portfolio still fetching this coin
    let anyLoading = false;
    for (const pf of store.portfolios) {
      if (!isIncludedInTotal(pf)) continue;
      const holding = getCoinHolding(pf, coin.id);
      if (holding.addresses.some((a) => balanceCache[pf.id]?.[coin.id]?.[a]?.loading)) {
        anyLoading = true;
        break;
      }
    }

    const row = document.createElement("div");
    row.className = "holding-row";
    row.setAttribute("role", "row");
    row.innerHTML = `
      <div class="holding-left">
        ${coinAvatarHtml(coin)}
        <div>
          <div class="holding-name">${escapeHtml(coin.name)}</div>
          <div class="holding-symbol">${coin.symbol}</div>
        </div>
      </div>
      <div class="holding-mid">
        <div class="holding-price">${px != null ? formatUsd(px) : "—"}</div>
        <div class="holding-pct ${pct.cls}">${pct.text}</div>
      </div>
      <div class="holding-right">
        <div class="holding-value">${anyLoading && r.balance === 0 ? "…" : formatUsd(r.usd)}</div>
        <div class="holding-amount">${r.balance > 0 ? formatAmt(r.balance, coin.symbol) : "—"}</div>
      </div>
    `;
    list.appendChild(row);
  }

  renderHomePl();
}

function renderHomePl() {
  const { totalCost, totalMarket, pl, plPct, rows } = allPortfoliosCostTotals();
  const totalEl = document.getElementById("home-pl-total");
  const changeEl = document.getElementById("home-pl-change");
  const costEl = document.getElementById("home-pl-cost");
  const valueEl = document.getElementById("home-pl-value");
  const countEl = document.getElementById("home-pl-count");
  if (!totalEl || !changeEl) return;

  if (pl == null) {
    totalEl.textContent = "—";
    totalEl.classList.remove("up", "down");
    setChangePill(changeEl, 0, null);
    const pill = changeEl.querySelector(".pill");
    if (pill) {
      pill.textContent = "—";
      pill.className = "pill neutral";
    }
    const muted = changeEl.querySelector(".muted");
    if (muted) muted.textContent = "vs the ledger";
  } else {
    const sign = pl > 0 ? "+" : "";
    totalEl.textContent = `${sign}${formatUsd(pl)}`;
    totalEl.classList.toggle("up", pl > 0);
    totalEl.classList.toggle("down", pl < 0);
    setChangePill(changeEl, pl, plPct);
    const muted = changeEl.querySelector(".muted");
    if (muted) muted.textContent = "vs the ledger";
  }

  if (costEl) costEl.textContent = totalCost > 0 ? formatUsd(totalCost) : "—";
  if (valueEl) valueEl.textContent = formatUsd(totalMarket);
  if (countEl) countEl.textContent = String(rows.length);

  renderAllocBar(
    document.getElementById("home-pl-alloc-bar"),
    rows.map((r) => ({ coinId: r.coinId, usd: r.market, alloc: totalMarket > 0 ? (r.market / totalMarket) * 100 : 0 }))
  );

  const list = document.getElementById("home-pl-list");
  const empty = document.getElementById("home-pl-empty");
  if (!list || !empty) return;
  list.innerHTML = "";

  if (!rows.length) {
    empty.hidden = false;
    return;
  }
  empty.hidden = true;

  for (const r of rows) {
    const coin = getAsset(r.coinId);
    if (!coin) continue;
    const plCls = r.pl == null ? "neutral" : r.pl > 0 ? "up" : r.pl < 0 ? "down" : "neutral";
    const plSign = r.pl != null && r.pl > 0 ? "+" : "";
    const pct = formatPct(r.plPct);

    const row = document.createElement("div");
    row.className = "holding-row";
    row.setAttribute("role", "row");
    row.innerHTML = `
      <div class="holding-left">
        ${coinAvatarHtml(coin)}
        <div>
          <div class="holding-name">${escapeHtml(coin.name)}</div>
          <div class="holding-symbol">${coin.symbol}${r.balance > 0 ? ` · ${formatAmt(r.balance, coin.symbol)}` : ""}</div>
        </div>
      </div>
      <div class="holding-mid">
        <div class="holding-price">${r.avg != null ? formatUsd(r.avg) : "—"}</div>
        <div class="holding-amount">${r.cost > 0 ? formatUsd(r.cost) : "—"}</div>
      </div>
      <div class="holding-right">
        <div class="holding-value ${plCls}">${r.pl == null ? "—" : `${plSign}${formatUsd(r.pl)}`}</div>
        <div class="holding-pl ${pct.cls}">${r.pl == null ? "—" : pct.text}</div>
      </div>
    `;
    list.appendChild(row);
  }
}

/** Settings: portfolio list + include toggles (management lives here, not on Dashboard). */
function renderSettings() {
  const feeInput = document.getElementById("settings-fee-input");
  if (feeInput && document.activeElement !== feeInput) {
    const fee = getExchangeFeePct();
    feeInput.value = fee > 0 ? String(fee) : "";
  }

  const power = getLightningPower();
  const lightning = document.getElementById("settings-lightning");
  const lightningVal = document.getElementById("settings-lightning-value");
  if (lightning && document.activeElement !== lightning) lightning.value = String(power);
  if (lightningVal) lightningVal.textContent = String(power);
  const strikeToggle = document.getElementById("settings-lightning-strikes");
  if (strikeToggle) strikeToggle.checked = getLightningStrikes();

  const { perPf } = allPortfoliosTotals();
  const list = document.getElementById("portfolio-list");
  const empty = document.getElementById("settings-pf-empty");
  list.innerHTML = "";

  if (!store.portfolios.length) {
    empty.hidden = false;
    return;
  }
  empty.hidden = true;

  for (const item of perPf) {
    const { pf, totalUsd: v, changePct: cp, assets, sourceCount, included } = item;
    const pct = formatPct(cp);
    const card = document.createElement("div");
    card.className = "pf-card" + (included ? "" : " pf-card-excluded");

    card.innerHTML = `
      <button type="button" class="pf-card-main" data-open>
        <div class="pf-card-top">
          <div class="pf-card-text">
            <div class="pf-card-name">${escapeHtml(pf.name)}</div>
            <div class="pf-card-meta">${assets} asset${assets === 1 ? "" : "s"} · ${sourceCount} source${sourceCount === 1 ? "" : "s"}</div>
          </div>
          <div class="pf-card-figures">
            <div class="pf-card-value">${formatUsd(v)}</div>
            <div class="pf-card-change ${pct.cls}">${pct.text}</div>
          </div>
        </div>
      </button>
      <div class="pf-card-toggle-row">
        <span class="pf-toggle-label">${included ? "In total" : "Excluded"}</span>
        <label class="switch" title="Include in the hall hoard">
          <input type="checkbox" class="pf-include-toggle" ${included ? "checked" : ""} aria-label="Include ${escapeHtml(pf.name)} in the hall hoard" />
          <span class="switch-track" aria-hidden="true"></span>
        </label>
      </div>
    `;

    card.querySelector("[data-open]").addEventListener("click", () => {
      store.activePortfolioId = pf.id;
      saveStore();
      showView("portfolio", { portfolioId: pf.id });
    });

    card.querySelector(".pf-include-toggle").addEventListener("change", (e) => {
      e.stopPropagation();
      pf.includeInTotal = e.target.checked;
      saveStore();
      renderSettings();
      toast(e.target.checked ? `“${pf.name}” included in total` : `“${pf.name}” excluded from total`);
    });

    card.querySelector(".switch").addEventListener("click", (e) => e.stopPropagation());
    list.appendChild(card);
  }
}

function renderPortfolio() {
  const pf = getPortfolio(nav.portfolioId);
  if (!pf) {
    showView("home");
    return;
  }

  const t = portfolioTotals(pf);
  document.getElementById("pf-name-label").textContent = pf.name;
  document.getElementById("pf-total").textContent = formatUsd(t.totalUsd);
  setChangePill(document.getElementById("pf-change"), t.changeUsd, t.changePct);
  renderAllocBar(document.getElementById("pf-alloc-bar"), t.rows);
  document.getElementById("pf-asset-count").textContent = String(t.assets);
  document.getElementById("pf-addr-count").textContent = String(t.sourceCount);
  document.getElementById("pf-updated").textContent = new Date().toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  const list = document.getElementById("holdings-list");
  const empty = document.getElementById("pf-empty");
  list.innerHTML = "";

  const coinsTracked = allAssets().filter((c) => portfolioHasCoin(pf, c.id));

  if (!coinsTracked.length) {
    empty.hidden = false;
    return;
  }
  empty.hidden = true;

  const sorted = [...coinsTracked].sort((a, b) => {
    const ba = coinBalanceInPortfolio(pf, a.id);
    const bb = coinBalanceInPortfolio(pf, b.id);
    const ua = (ba.hasData ? ba.balance : 0) * (getQuote(a.id)?.usd || 0);
    const ub = (bb.hasData ? bb.balance : 0) * (getQuote(b.id)?.usd || 0);
    return ub - ua;
  });

  for (const coin of sorted) {
    const info = coinBalanceInPortfolio(pf, coin.id);
    const px = getQuote(coin.id)?.usd;
    const ch = getQuote(coin.id)?.change24h;
    const usd = info.hasData ? info.balance * (px || 0) : null;
    const pct = formatPct(ch);
    const holding = getCoinHolding(pf, coin.id);
    const anyLoading = holding.addresses.some(
      (a) => balanceCache[pf.id]?.[coin.id]?.[a]?.loading
    );

    const parts = [];
    if (info.manualCount) parts.push(`${info.manualCount} manual`);
    if (info.addrCount) parts.push(`${info.addrCount} wallet${info.addrCount === 1 ? "" : "s"}`);
    const cb = costBasisInfo(pf, coin.id);
    if (cb.avg != null) parts.push(`avg ${formatUsd(cb.avg)}`);
    const sub = parts.length ? ` · ${parts.join(" · ")}` : "";

    let plLine = "";
    if (cb.pl != null) {
      const sign = cb.pl > 0 ? "+" : "";
      const cls = cb.pl > 0 ? "up" : cb.pl < 0 ? "down" : "neutral";
      plLine = `<div class="holding-pl ${cls}">${sign}${formatUsd(cb.pl)}</div>`;
    }

    const row = document.createElement("button");
    row.type = "button";
    row.className = "holding-row";
    row.innerHTML = `
      <div class="holding-left">
        ${coinAvatarHtml(coin)}
        <div>
          <div class="holding-name">${escapeHtml(coin.name)}</div>
          <div class="holding-symbol">${coin.symbol}${sub}</div>
        </div>
      </div>
      <div class="holding-mid">
        <div class="holding-price">${px != null ? formatUsd(px) : "—"}</div>
        <div class="holding-pct ${pct.cls}">${pct.text}</div>
      </div>
      <div class="holding-right">
        <div class="holding-value">${anyLoading && !info.hasManual ? "…" : usd != null ? formatUsd(usd) : "$0.00"}</div>
        <div class="holding-amount">${info.hasData ? formatAmt(info.balance, coin.symbol) : "—"}</div>
        ${plLine}
      </div>
    `;
    row.addEventListener("click", () => showView("asset", { coinId: coin.id }));
    list.appendChild(row);
  }
}

function renderAsset() {
  const pf = getPortfolio(nav.portfolioId);
  const coin = getAsset(nav.coinId);
  if (!pf || !coin) {
    showView("home");
    return;
  }

  setCoinAvatarEl(document.getElementById("asset-avatar"), coin);

  document.getElementById("asset-name").textContent = coin.name;
  const px = getQuote(coin.id)?.usd;
  const ch = getQuote(coin.id)?.change24h;
  const pct = formatPct(ch);
  document.getElementById("asset-price-line").innerHTML =
    `${px != null ? formatUsd(px) : "—"} · <span class="holding-pct ${pct.cls}">${pct.text}</span>`;

  const info = coinBalanceInPortfolio(pf, coin.id);
  const usd = info.hasData ? info.balance * (px || 0) : 0;
  document.getElementById("asset-total").textContent = formatUsd(usd);
  document.getElementById("asset-amount").textContent = formatAmt(
    info.hasData ? info.balance : 0,
    coin.symbol
  );

  // Breakdown: on-chain + manual = total
  const bd = document.getElementById("asset-breakdown");
  const onchainUsd = info.onchain * (px || 0);
  const manualUsd = info.manual * (px || 0);
  bd.innerHTML = `
    <div class="breakdown-row">
      <span>On-chain (wallets)</span>
      <strong>${formatAmt(info.onchain, coin.symbol)} · ${formatUsd(onchainUsd)}</strong>
    </div>
    <div class="breakdown-row">
      <span>Manual entries</span>
      <strong>${formatAmt(info.manual, coin.symbol)} · ${formatUsd(manualUsd)}</strong>
    </div>
    <div class="breakdown-row">
      <span>Combined total</span>
      <strong>${formatAmt(info.balance, coin.symbol)} · ${formatUsd(usd)}</strong>
    </div>
  `;

  // Cost basis stats
  const cb = costBasisInfo(pf, coin.id);
  document.getElementById("asset-avg-buy").textContent =
    cb.avg != null ? formatUsd(cb.avg) : "—";
  document.getElementById("asset-cost-basis").textContent =
    cb.cost > 0 ? formatUsd(cb.cost) : "—";
  const plEl = document.getElementById("asset-pl");
  if (cb.pl != null) {
    const sign = cb.pl > 0 ? "+" : "";
    const cls = cb.pl > 0 ? "up" : cb.pl < 0 ? "down" : "neutral";
    plEl.className = `stat-value ${cls}`;
    plEl.textContent = `${sign}${formatUsd(cb.pl)}${
      cb.plPct != null ? ` (${sign}${cb.plPct.toFixed(2)}%)` : ""
    }`;
  } else {
    plEl.className = "stat-value";
    plEl.textContent = "—";
  }

  // Prefill cost inputs with current values (don't clobber while typing on re-render after save)
  const avgInput = document.getElementById("avg-buy-input");
  const costInput = document.getElementById("cost-basis-input");
  if (document.activeElement !== avgInput) {
    avgInput.value = cb.avg != null ? String(roundPriceInput(cb.avg)) : "";
  }
  if (document.activeElement !== costInput) {
    costInput.value = cb.cost > 0 ? String(roundPriceInput(cb.cost)) : "";
  }

  const wallets = document.getElementById("asset-wallets");
  if (wallets) wallets.hidden = !coin.fetchBalance;
  if (coin.fetchBalance) {
    document.getElementById("address-input").placeholder = coin.placeholder || "Paste wallet address";
    document.getElementById("address-hint").textContent = coin.note || "";
  }
  document.getElementById("manual-amount-input").placeholder =
    coin.kind === "metal" || coin.unit === "oz" ? "Ounces (oz)" : `Amount in ${coin.symbol}`;

  // Price paid: default to live market price (editable). Don't overwrite user edits.
  if (manualPriceCoinId !== coin.id) {
    manualPriceCoinId = coin.id;
    manualPriceDirty = false;
  }
  const priceInput = document.getElementById("manual-price-input");
  priceInput.placeholder =
    coin.kind === "metal" || coin.unit === "oz" ? "USD per oz" : `USD per ${coin.symbol}`;
  if (document.activeElement !== priceInput && !manualPriceDirty) {
    priceInput.value = px != null && px > 0 ? String(roundPriceInput(px)) : "";
  }

  // Exchange fee % (saved setting, editable here)
  const feeInput = document.getElementById("manual-fee-input");
  if (feeInput && document.activeElement !== feeInput) {
    const fee = getExchangeFeePct();
    feeInput.value = fee > 0 ? String(fee) : "";
  }
  updateManualFeeHint();

  const holding = getCoinHolding(pf, coin.id);

  // Manual list
  const manualList = document.getElementById("asset-manual-list");
  manualList.innerHTML = "";
  if (!holding.manual.length) {
    manualList.innerHTML = `<p class="empty-hint" style="margin:8px 0 12px">No manual amounts yet.</p>`;
  }
  for (const entry of holding.manual) {
    const card = document.createElement("div");
    card.className = "addr-card";
    const v = entry.amount * (px || 0);
    const label = entry.label || "Manual";
    const lotCost =
      entry.costUsd != null
        ? entry.costUsd
        : entry.unitPrice != null
          ? manualLotCost(entry.amount, entry.unitPrice, entry.feePct)
          : null;
    const feeNote =
      entry.unitPrice != null && entry.feePct > 0
        ? ` · fee ${entry.feePct}%`
        : "";
    const priceLine =
      entry.unitPrice != null
        ? `<span class="muted">@ ${formatUsd(entry.unitPrice)}${feeNote}${
            lotCost != null ? ` · cost ${formatUsd(lotCost)}` : ""
          }</span>`
        : `<span class="muted">No price paid</span>`;
    card.innerHTML = `
      <div class="addr-title"><span class="tag manual">Manual</span>${escapeHtml(label)}</div>
      <div class="addr-meta">
        <span class="ok">${formatAmt(entry.amount, coin.symbol)}</span>
        <span>${formatUsd(v)}</span>
      </div>
      <div class="addr-meta">${priceLine}</div>
      <div class="addr-actions">
        <button type="button" class="btn-tiny" data-remove>Remove</button>
      </div>
    `;
    card.querySelector("[data-remove]").addEventListener("click", () => {
      removeManualEntry(holding, entry);
      saveStore();
      render();
      toast("Manual amount removed");
    });
    manualList.appendChild(card);
  }

  // Address list
  const list = document.getElementById("asset-address-list");
  list.innerHTML = "";
  const addrs = holding.addresses;

  if (!addrs.length) {
    list.innerHTML = `<p class="empty-hint" style="margin:8px 0 12px">No wallet addresses yet.</p>`;
  }

  for (const addr of addrs) {
    const st = ensureCacheSlot(pf.id, coin.id, addr);
    const card = document.createElement("div");
    card.className = "addr-card";
    let meta = "";
    if (st.loading) meta = `<span>Looking up…</span>`;
    else if (st.error) meta = `<span class="err">${escapeHtml(st.error)}</span>`;
    else if (st.balance != null) {
      const v = st.balance * (px || 0);
      meta = `
        <span class="ok">${formatAmt(st.balance, coin.symbol)}</span>
        <span>${formatUsd(v)}</span>
        <a href="${coin.explorer(addr)}" target="_blank" rel="noopener">Explorer</a>
      `;
    } else meta = `<span class="muted">Not loaded</span>`;

    card.innerHTML = `
      <div class="addr-title"><span class="tag wallet">Wallet</span></div>
      <div class="addr-text">${escapeHtml(addr)}</div>
      <div class="addr-meta">${meta}</div>
      <div class="addr-actions">
        <button type="button" class="btn-tiny" data-remove>Remove</button>
      </div>
    `;
    card.querySelector("[data-remove]").addEventListener("click", () => {
      holding.addresses = holding.addresses.filter((a) => a !== addr);
      saveStore();
      render();
      toast("Address removed");
    });
    list.appendChild(card);
  }
}

function appendAssetPickRow(list, coin, { badge } = {}) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "coin-pick-row";
  const extra = badge ? `<span class="asset-badge">${escapeHtml(badge)}</span>` : "";
  btn.innerHTML = `
    ${coinAvatarHtml(coin)}
    <div class="grow">
      <div class="name">${escapeHtml(coin.name)}</div>
      <div class="sym">${escapeHtml(coin.symbol)}${extra}</div>
    </div>
    <span class="chev">›</span>
  `;
  return btn;
}

function renderAddCoin() {
  const list = document.getElementById("coin-pick-list");
  if (!list) return;
  list.innerHTML = "";
  const assets = allAssets();
  const pinned = assets.filter((c) => c.kind === "metal");
  const rest = assets.filter((c) => c.kind !== "metal");
  for (const coin of [...pinned, ...rest]) {
    const badge =
      coin.kind === "metal" ? "Metal" : COIN_BY_ID[coin.id] ? null : coin.kind === "stock" ? "Stock" : "Coin";
    const btn = appendAssetPickRow(list, coin, { badge });
    btn.addEventListener("click", () => showView("asset", { coinId: coin.id }));
    list.appendChild(btn);
  }
}

async function searchCrypto(query) {
  const data = await fetchJson(
    `https://api.coingecko.com/api/v3/search?query=${encodeURIComponent(query)}`
  );
  return (data.coins || []).slice(0, 8).map((c) => ({
    kind: "crypto",
    geckoId: c.id,
    name: c.name,
    symbol: String(c.symbol || "").toUpperCase(),
    thumb: c.thumb,
  }));
}

async function searchStocks(query) {
  const data = await fetchJsonCors(
    `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(query)}&quotesCount=8&newsCount=0`
  );
  const allowed = new Set(["EQUITY", "ETF", "INDEX", "MUTUALFUND"]);
  return (data.quotes || [])
    .filter((x) => x.symbol && (!x.quoteType || allowed.has(x.quoteType)))
    .slice(0, 8)
    .map((x) => ({
      kind: "stock",
      yahooSymbol: x.symbol,
      name: x.shortname || x.longname || x.symbol,
      symbol: String(x.symbol || "").toUpperCase(),
      exch: x.exchDisp || x.exchange || "",
    }));
}

function renderSearchResults(results, query) {
  const box = document.getElementById("asset-search-results");
  const status = document.getElementById("asset-search-status");
  if (!box) return;
  box.innerHTML = "";
  if (!results.length) {
    if (status) status.textContent = query ? `No relics match “${query}”.` : "";
    return;
  }
  if (status) status.textContent = `${results.length} result${results.length === 1 ? "" : "s"}`;
  for (const hit of results) {
    const preview = {
      id: hit.geckoId || hit.yahooSymbol,
      name: hit.name,
      symbol: hit.symbol,
      color: colorFromSymbol(hit.symbol),
    };
    const badge =
      hit.kind === "metal" ? "Metal · oz" : hit.kind === "stock" ? `Stock${hit.exch ? ` · ${hit.exch}` : ""}` : "Coin";
    const btn = appendAssetPickRow(box, preview, { badge });
    btn.addEventListener("click", async () => {
      const id = ensureCustomAsset(hit);
      if (!id) {
        toast("Could not add that relic", "error");
        return;
      }
      showView("asset", { coinId: id });
      const asset = getAsset(id);
      if (asset?.yahooSymbol && (asset.kind === "stock" || asset.kind === "metal")) {
        try {
          const q = await fetchStockQuote(asset.yahooSymbol);
          if (q) {
            prices[id] = q;
            rememberQuotes({ [id]: q });
            saveMarketSnapshot();
            render();
          }
        } catch {
          /* last price stays */
        }
      }
      refreshAll();
    });
    box.appendChild(btn);
  }
}

let assetSearchTimer = 0;
let assetSearchToken = 0;

function scheduleAssetSearch(raw) {
  const query = String(raw || "").trim();
  const status = document.getElementById("asset-search-status");
  const box = document.getElementById("asset-search-results");
  clearTimeout(assetSearchTimer);
  if (query.length < 1) {
    if (box) box.innerHTML = "";
    if (status) status.textContent = "";
    return;
  }
  if (status) status.textContent = "Scrying the markets…";
  assetSearchTimer = setTimeout(() => runAssetSearch(query), 320);
}

async function runAssetSearch(query) {
  const token = ++assetSearchToken;
  try {
    const q = query.toLowerCase();
    const metals = allAssets()
      .filter((a) => a.kind === "metal")
      .filter(
        (a) =>
          a.name.toLowerCase().includes(q) ||
          a.symbol.toLowerCase().includes(q) ||
          q === "oz" ||
          q.startsWith("ounce")
      )
      .map((a) => ({
        kind: "metal",
        name: a.name,
        symbol: a.symbol,
        yahooSymbol: a.yahooSymbol,
        existingId: a.id,
      }));
    const [crypto, stocks] = await Promise.all([
      searchCrypto(query).catch(() => []),
      searchStocks(query).catch(() => []),
    ]);
    if (token !== assetSearchToken) return;
    const seen = new Set();
    const merged = [];
    for (const hit of [...metals, ...crypto, ...stocks]) {
      const key = `${hit.kind}:${hit.geckoId || hit.yahooSymbol}`;
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(hit);
    }
    renderSearchResults(merged, query);
  } catch (err) {
    if (token !== assetSearchToken) return;
    const status = document.getElementById("asset-search-status");
    if (status) status.textContent = humanizeError(err);
  }
}

// ── Portfolio CRUD ─────────────────────────────────────────────────────────

function openPortfolioModal(mode) {
  modalMode = mode;
  const modal = document.getElementById("modal-portfolio");
  const title = document.getElementById("modal-portfolio-title");
  const input = document.getElementById("portfolio-name-input");
  title.textContent = mode === "rename" ? "Rename portfolio" : "Create portfolio";
  if (mode === "rename") {
    const pf = getPortfolio(nav.portfolioId);
    input.value = pf?.name || "";
  } else {
    input.value = "";
  }
  modal.hidden = false;
  setTimeout(() => input.focus(), 50);
}

function closePortfolioModal() {
  document.getElementById("modal-portfolio").hidden = true;
  modalMode = null;
}

function savePortfolioModal() {
  const name = document.getElementById("portfolio-name-input").value.trim();
  if (!name) {
    toast("Enter a name", "error");
    return;
  }
  if (modalMode === "create") {
    const id = uid();
    store.portfolios.push({
      id,
      name,
      createdAt: Date.now(),
      includeInTotal: true,
      holdings: emptyHoldings(),
    });
    store.activePortfolioId = id;
    saveStore();
    closePortfolioModal();
    showView("portfolio", { portfolioId: id });
    toast("Portfolio created", "success");
  } else if (modalMode === "rename") {
    const pf = getPortfolio(nav.portfolioId);
    if (pf) {
      pf.name = name;
      saveStore();
      closePortfolioModal();
      render();
      toast("Renamed", "success");
    }
  }
}

function deleteCurrentPortfolio() {
  const pf = getPortfolio(nav.portfolioId);
  if (!pf) return;
  if (store.portfolios.length <= 1) {
    toast("Keep at least one portfolio", "error");
    return;
  }
  if (!confirm(`Delete “${pf.name}” and all its addresses?`)) return;
  store.portfolios = store.portfolios.filter((p) => p.id !== pf.id);
  if (store.activePortfolioId === pf.id) {
    store.activePortfolioId = store.portfolios[0]?.id || null;
  }
  delete balanceCache[pf.id];
  saveStore();
  showView("settings");
  toast("Portfolio deleted");
}

function openPicker() {
  const list = document.getElementById("picker-list");
  list.innerHTML = "";
  for (const pf of store.portfolios) {
    const t = portfolioTotals(pf);
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "picker-item";
    btn.innerHTML = `<span>${escapeHtml(pf.name)}</span><span class="val">${formatUsd(t.totalUsd)}</span>`;
    btn.addEventListener("click", () => {
      store.activePortfolioId = pf.id;
      saveStore();
      document.getElementById("modal-picker").hidden = true;
      showView("portfolio", { portfolioId: pf.id });
    });
    list.appendChild(btn);
  }
  document.getElementById("modal-picker").hidden = false;
}

// ── Address validation & add ───────────────────────────────────────────────

function looksPlausible(coinId, address) {
  const a = address.trim();
  switch (coinId) {
    case "btc":
      return /^(bc1|[13])[a-zA-HJ-NP-Z0-9]{25,90}$/.test(a);
    case "xrp":
      return /^r[1-9A-HJ-NP-Za-km-z]{24,34}$/.test(a);
    case "xlm":
      return /^G[A-Z2-7]{55}$/.test(a);
    case "hbar":
      return /^(0\.0\.\d+|0x[a-fA-F0-9]{40})$/.test(a);
    case "ada":
    case "night":
      return /^addr1[a-z0-9]{20,}$/i.test(a);
    case "doge":
      return /^[DA9][a-km-zA-HJ-NP-Z1-9]{25,34}$/.test(a);
    case "ltc":
      return /^(ltc1|[LM3])[a-zA-HJ-NP-Z0-9]{25,90}$/.test(a);
    default:
      return a.length > 8;
  }
}

async function addAddressToCurrent(address) {
  const pf = getPortfolio(nav.portfolioId);
  const coin = getAsset(nav.coinId);
  if (!pf || !coin) return;
  if (!coin.fetchBalance) {
    toast("This relic uses manual amounts only", "error");
    return;
  }

  const addr = address.trim();
  if (!addr) return;
  if (!looksPlausible(coin.id, addr)) {
    toast(`Invalid ${coin.symbol} address format`, "error");
    return;
  }
  const holding = getCoinHolding(pf, coin.id);
  if (holding.addresses.includes(addr)) {
    toast("Already added", "error");
    return;
  }
  holding.addresses.push(addr);
  saveStore();
  document.getElementById("address-input").value = "";
  render();
  toast("Looking up balance…");
  await refreshBalance(pf.id, coin.id, addr);
  render();
  toast("Address added", "success");
}

function roundPriceInput(n) {
  if (!Number.isFinite(n)) return n;
  if (n >= 1000) return Math.round(n * 100) / 100;
  if (n >= 1) return Math.round(n * 10000) / 10000;
  return Math.round(n * 1e8) / 1e8;
}

/** Remove a manual entry and reverse its contribution to cost basis when priced. */
function removeManualEntry(holding, entry) {
  const lotCost =
    entry.costUsd != null
      ? entry.costUsd
      : entry.unitPrice != null
        ? manualLotCost(entry.amount, entry.unitPrice, entry.feePct)
        : null;
  if (lotCost != null && Number.isFinite(lotCost)) {
    holding.costBasisUsd = Math.max(0, (Number(holding.costBasisUsd) || 0) - lotCost);
  }
  holding.manual = holding.manual.filter((m) => m.id !== entry.id);
}

function updateManualFeeHint() {
  const hint = document.getElementById("manual-price-hint");
  if (!hint) return;
  const fee = getExchangeFeePct();
  if (fee > 0) {
    hint.textContent = `Cost basis uses amount × price × (1 + ${fee}% fee). Fee is saved and applied on add.`;
  } else {
    hint.textContent =
      "Price defaults to market. Cost basis uses amount × price. Set a fee % to include exchange fees.";
  }
}

/**
 * Add manual lot. If unit price is provided, fold it into cost basis with exchange fee:
 * cost = amount × price × (1 + fee%).
 */
function addManualToCurrent(amountRaw, priceRaw, feeRaw, labelRaw) {
  const pf = getPortfolio(nav.portfolioId);
  const coin = getAsset(nav.coinId);
  if (!pf || !coin) return;

  const cleaned = String(amountRaw || "").replace(/,/g, "").trim();
  const amount = Number(cleaned);
  if (!cleaned || !Number.isFinite(amount) || amount <= 0) {
    toast("Enter a valid amount greater than 0", "error");
    return;
  }

  // Persist fee setting from the form (even if price blank)
  const feePct = setExchangeFeePct(feeRaw === "" || feeRaw == null ? getExchangeFeePct() : feeRaw);

  let unitPrice = null;
  const priceStr = String(priceRaw || "").trim();
  if (priceStr) {
    unitPrice = parseOptionalUsd(priceStr);
    if (unitPrice == null || unitPrice <= 0) {
      toast("Enter a valid price paid, or leave it blank", "error");
      return;
    }
  }

  const costUsd = unitPrice != null ? manualLotCost(amount, unitPrice, feePct) : null;

  const holding = getCoinHolding(pf, coin.id);
  holding.manual.push({
    id: uid(),
    amount,
    label: String(labelRaw || "").trim().slice(0, 40),
    unitPrice,
    feePct: unitPrice != null ? feePct : 0,
    costUsd,
  });

  if (costUsd != null) {
    holding.costBasisUsd = (Number(holding.costBasisUsd) || 0) + costUsd;
  }

  saveStore();
  document.getElementById("manual-amount-input").value = "";
  document.getElementById("manual-label-input").value = "";
  // Re-fill price with live market on next render
  manualPriceDirty = false;
  document.getElementById("manual-price-input").value = "";
  render();

  if (unitPrice != null) {
    const cb = costBasisInfo(pf, coin.id);
    const avgTxt = cb.avg != null ? formatUsd(cb.avg) : "—";
    const feeNote = feePct > 0 ? ` · fee ${feePct}%` : "";
    toast(`Added · cost ${formatUsd(costUsd)}${feeNote} · avg ${avgTxt}`, "success");
  } else {
    toast("Manual amount added", "success");
  }
}

// ── Settings: export / import / wipe ───────────────────────────────────────

function exportData() {
  const blob = new Blob([JSON.stringify(store, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `wizard-portfolio-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
  toast("Exported", "success");
}

function importData(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      if (!data?.portfolios || !Array.isArray(data.portfolios)) throw new Error("Invalid file");
      store = {
        version: 2,
        activePortfolioId: data.activePortfolioId || data.portfolios[0]?.id || null,
        exchangeFeePct: normalizeExchangeFeePct(data.exchangeFeePct),
        lightningPower: normalizeLightningPower(
          data.lightningPower != null ? data.lightningPower : getLightningPower()
        ),
        lightningStrikes: data.lightningStrikes != null ? !!data.lightningStrikes : getLightningStrikes(),
        customAssets: normalizeCustomAssets(
          data.customAssets != null ? data.customAssets : store.customAssets
        ),
        portfolios: data.portfolios.map(normalizePortfolio),
      };
      if (!store.portfolios.length) store = defaultStore();
      saveStore();
      balanceCache = {};
      showView("home");
      refreshAll();
      toast("Import complete", "success");
    } catch {
      toast("Could not import file", "error");
    }
  };
  reader.readAsText(file);
}

function wipeAll() {
  if (!confirm("Delete all portfolios and local data?")) return;
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(LEGACY_KEY);
  localStorage.removeItem(SNAPSHOT_KEY);
  store = defaultStore();
  saveStore();
  balanceCache = {};
  prices = {};
  chartCache = {};
  lastChartHoldings = [];
  showView("home");
  render();
  toast("Local data cleared");
}

// ── Event wiring ───────────────────────────────────────────────────────────

function syncHomePager(animate) {
  const pager = document.getElementById("home-pager");
  const track = document.getElementById("home-track");
  if (!pager || !track) return;
  const w = pager.clientWidth || 1;
  track.style.transition = animate ? "transform 0.28s ease" : "none";
  track.style.transform = `translate3d(${-homeSlide * w}px, 0, 0)`;
  document.querySelectorAll(".home-dot").forEach((dot) => {
    const on = Number(dot.dataset.homeSlide) === homeSlide;
    dot.setAttribute("aria-selected", on ? "true" : "false");
  });
}

function setHomeSlide(index, animate = true) {
  homeSlide = index === 0 ? 0 : 1;
  syncHomePager(animate);
}

function wireHomePager() {
  const pager = document.getElementById("home-pager");
  const track = document.getElementById("home-track");
  if (!pager || !track) return;

  const drag = {
    startX: 0,
    startY: 0,
    dx: 0,
    tracking: false,
    locked: null,
    width: 0,
  };

  function paintDrag() {
    const x = -homeSlide * drag.width + drag.dx;
    track.style.transition = "none";
    track.style.transform = `translate3d(${x}px, 0, 0)`;
  }

  pager.addEventListener(
    "touchstart",
    (e) => {
      if (nav.view !== "home" || e.touches.length !== 1) return;
      const t = e.touches[0];
      drag.startX = t.clientX;
      drag.startY = t.clientY;
      drag.dx = 0;
      drag.tracking = true;
      drag.locked = null;
      drag.width = pager.clientWidth || 1;
    },
    { passive: true }
  );

  pager.addEventListener(
    "touchmove",
    (e) => {
      if (!drag.tracking) return;
      const t = e.touches[0];
      const dx = t.clientX - drag.startX;
      const dy = t.clientY - drag.startY;
      if (!drag.locked) {
        if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return;
        drag.locked = Math.abs(dx) > Math.abs(dy) * 1.15 ? "x" : "y";
      }
      if (drag.locked !== "x") return;
      let adx = dx;
      if ((homeSlide === 0 && dx > 0) || (homeSlide === 1 && dx < 0)) {
        adx = dx * 0.28;
      }
      drag.dx = adx;
      e.preventDefault();
      paintDrag();
    },
    { passive: false }
  );

  const endDrag = () => {
    if (!drag.tracking) return;
    const flip = drag.locked === "x" && Math.abs(drag.dx) > Math.max(48, drag.width * 0.2);
    if (flip) {
      homeSlide = drag.dx > 0 ? Math.max(0, homeSlide - 1) : Math.min(1, homeSlide + 1);
    }
    drag.tracking = false;
    drag.locked = null;
    drag.dx = 0;
    syncHomePager(true);
  };

  pager.addEventListener("touchend", endDrag);
  pager.addEventListener("touchcancel", endDrag);

  pager.addEventListener("click", (e) => {
    const dot = e.target.closest(".home-dot");
    if (!dot) return;
    setHomeSlide(Number(dot.dataset.homeSlide), true);
  });

  window.addEventListener("resize", () => {
    if (nav.view === "home") syncHomePager(false);
  });

  syncHomePager(false);
}

// ── Kirlian touch aura ─────────────────────────────────────────────────────

function kirlianPalette() {
  const { changeUsd, totalUsd } = allPortfoliosTotals();
  if (changeUsd > 0 && totalUsd > 0) {
    return {
      core: "rgba(240, 255, 244, 0.95)",
      mid: "rgba(90, 255, 140, 0.9)",
      glow: "rgba(32, 220, 90, 0.55)",
      aura: "rgba(40, 255, 120, 0.16)",
    };
  }
  if (changeUsd < 0) {
    return {
      core: "rgba(255, 240, 240, 0.95)",
      mid: "rgba(255, 80, 80, 0.92)",
      glow: "rgba(255, 36, 36, 0.55)",
      aura: "rgba(255, 40, 40, 0.16)",
    };
  }
  return {
    core: "rgba(255, 246, 220, 0.95)",
    mid: "rgba(232, 197, 71, 0.9)",
    glow: "rgba(212, 175, 55, 0.5)",
    aura: "rgba(212, 175, 55, 0.14)",
  };
}

function kirlianRand(seed) {
  let t = (seed + 0x6d2b79f5) | 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

function strokeLightningPath(ctx, pts, width, pal) {
  if (pts.length < 2) return;
  ctx.beginPath();
  ctx.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
  if (width > 2.2) {
    ctx.strokeStyle = pal.glow;
    ctx.lineWidth = width * 3.1;
    ctx.globalAlpha *= 0.35;
    ctx.stroke();
    ctx.globalAlpha /= 0.35;
  }
  ctx.strokeStyle = pal.mid;
  ctx.lineWidth = width;
  ctx.stroke();
  ctx.strokeStyle = pal.core;
  ctx.lineWidth = Math.max(0.35, width * (width > 2.4 ? 0.22 : 0.38));
  ctx.stroke();
}

function drawKirlianBranch(ctx, x, y, ang, len, width, depth, seed, pal, forkChance) {
  if (depth <= 0 || len < 6) return;
  const steps = 7 + ((seed >>> 2) % 8);
  const pts = [x, y];
  let cx = x;
  let cy = y;
  const forks = [];
  for (let i = 0; i < steps; i++) {
    const r = kirlianRand(seed + i * 17 + depth * 91);
    const r2 = kirlianRand(seed + i * 29 + 4);
    // Mostly small kinks, occasional sharp steps — like a stepped leader
    ang += (r - 0.5) * (r2 > 0.88 ? 1.15 : 0.38);
    const sl = (len / steps) * (0.7 + r2 * 0.7);
    cx += Math.cos(ang) * sl;
    cy += Math.sin(ang) * sl;
    pts.push(cx, cy);
    const along = i / steps;
    if (depth > 1 && along > 0.12 && along < 0.92 && r < forkChance) {
      const side = r2 > 0.5 ? 1 : -1;
      const forkAng = ang + side * (0.28 + r * 0.7);
      // Mix of near-leader, mid, and hairline branches — not only tiny forks
      const tier = kirlianRand(seed + i * 67);
      const scale = tier > 0.82 ? 0.62 + r2 * 0.32 : tier > 0.42 ? 0.34 + r2 * 0.26 : 0.12 + r2 * 0.16;
      forks.push({
        x: cx,
        y: cy,
        ang: forkAng,
        len: len * (0.28 + r2 * 0.48),
        width: Math.max(0.35, width * scale),
        seed: seed + i * 101,
      });
    }
  }
  strokeLightningPath(ctx, pts, width, pal);
  for (const f of forks) {
    drawKirlianBranch(ctx, f.x, f.y, f.ang, f.len, f.width, depth - 1, f.seed, pal, forkChance * 0.85);
  }
}

function pickKirlianTargets(fromX, fromY, count) {
  const skipRe =
    /^(app|views|view|view-active|view-home|home-pager|home-track|home-pane|holdings-list|portfolio-list|address-list|coin-pick-list|kirlian-canvas)$/;
  const nodes = document.querySelectorAll(
    "#app .view.view-active div, #app .view.view-active button, #app .view.view-active h2, #app .holding-row, #app .summary-card, #app .pf-card, #app .settings-group, #app .topbar, #app .brand, #app .coin-avatar, #app .field-input, .modal.sheet"
  );
  const seen = new Set();
  const pool = [];
  for (const el of nodes) {
    if (seen.has(el) || el.id === "kirlian") continue;
    seen.add(el);
    if (el.hidden || el.getAttribute("aria-hidden") === "true") continue;
    if (el.closest("#splash, #kirlian")) continue;
    const cls = el.className && String(el.className).split(/\s+/)[0];
    if (cls && skipRe.test(cls)) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 28 || r.height < 14) continue;
    if (r.width > window.innerWidth * 0.96 && r.height > window.innerHeight * 0.55) continue;
    if (r.bottom < 8 || r.right < 8 || r.top > window.innerHeight - 8 || r.left > window.innerWidth - 8) continue;
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    if (Math.hypot(cx - fromX, cy - fromY) < 48) continue;
    pool.push(r);
  }
  if (!pool.length) return [];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, Math.max(1, Math.min(count, pool.length))).map((r, i) => {
    const rx = 0.18 + Math.random() * 0.64;
    const ry = 0.18 + Math.random() * 0.64;
    const thick = Math.random();
    return {
      x: r.left + r.width * rx,
      y: r.top + r.height * ry,
      left: r.left,
      top: r.top,
      width: r.width,
      height: r.height,
      seed: (Math.random() * 1e9) | 0,
      delay: i * 0.08,
      thick,
    };
  });
}

function drawKirlianBoltTo(ctx, x0, y0, x1, y1, width, depth, seed, pal) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const dist = Math.hypot(dx, dy);
  if (dist < 8) return;
  const ang0 = Math.atan2(dy, dx);
  const steps = Math.max(10, Math.min(28, Math.round(dist / 22)));
  const pts = [x0, y0];
  const forks = [];
  const nx = -dy / dist;
  const ny = dx / dist;
  for (let i = 1; i <= steps; i++) {
    const along = i / steps;
    const r = kirlianRand(seed + i * 19);
    const r2 = kirlianRand(seed + i * 41);
    const amp = Math.sin(along * Math.PI) * (10 + dist * 0.04) * (r - 0.5) * 2;
    const cx = x0 + dx * along + nx * amp;
    const cy = y0 + dy * along + ny * amp;
    pts.push(cx, cy);
    // Few short side-leaders near the strike, not a hair of tiny fractals
    if (depth > 1 && along > 0.62 && along < 0.94 && r < 0.16) {
      const side = r2 > 0.5 ? 1 : -1;
      forks.push({
        x: cx,
        y: cy,
        ang: ang0 + side * (0.22 + r * 0.35),
        len: dist * (0.05 + r2 * 0.07),
        width: Math.max(0.7, width * (0.4 + r2 * 0.28)),
        seed: seed + i * 77,
      });
    }
  }
  pts[pts.length - 2] = x1;
  pts[pts.length - 1] = y1;
  strokeLightningPath(ctx, pts, width, pal);
  for (const f of forks) {
    drawKirlianBranch(ctx, f.x, f.y, f.ang, f.len, f.width, 2, f.seed, pal, 0.16);
  }
}

function drawStruckElement(ctx, hit, pal, tick, fade) {
  if (fade <= 0.03 || hit.width == null) return;
  const pad = 7;
  const x = hit.left - pad;
  const y = hit.top - pad;
  const w = hit.width + pad * 2;
  const h = hit.height + pad * 2;
  const radius = Math.min(12, w * 0.12, h * 0.22);

  ctx.save();
  ctx.globalAlpha = fade;

  ctx.shadowColor = pal.mid;
  ctx.shadowBlur = 18 + fade * 16;
  ctx.fillStyle = pal.aura;
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(x, y, w, h, radius);
  else ctx.rect(x, y, w, h);
  ctx.fill();
  ctx.shadowBlur = 0;

  ctx.strokeStyle = pal.mid;
  ctx.lineWidth = 1.6 + fade * 1.4;
  ctx.stroke();
  ctx.strokeStyle = pal.core;
  ctx.lineWidth = 0.6;
  ctx.stroke();

  const flash = ctx.createRadialGradient(hit.x, hit.y, 1, hit.x, hit.y, 22 + fade * 18);
  flash.addColorStop(0, pal.core);
  flash.addColorStop(0.28, pal.glow);
  flash.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = flash;
  ctx.beginPath();
  ctx.arc(hit.x, hit.y, 22 + fade * 18, 0, Math.PI * 2);
  ctx.fill();

  const residual = 3 + Math.round(fade * 3);
  for (let i = 0; i < residual; i++) {
    const seed = (hit.seed + i * 211 + Math.floor(tick / 3) * 17) | 0;
    const r0 = kirlianRand(seed);
    const ang = r0 * Math.PI * 2;
    const len = 16 + r0 * Math.min(w, h) * 0.45;
    const thick = 0.7 + r0 * 1.6;
    drawKirlianBranch(ctx, hit.x, hit.y, ang, len, thick, 2, seed, pal, 0.14);
  }

  const sparks = 5 + Math.round(fade * 6);
  for (let i = 0; i < sparks; i++) {
    const seed = hit.seed + tick * 3 + i * 53;
    const r = kirlianRand(seed);
    const a = kirlianRand(seed + 2) * Math.PI * 2;
    const d = 6 + r * Math.max(w, h) * 0.28;
    ctx.fillStyle = r > 0.65 ? pal.core : pal.mid;
    ctx.beginPath();
    ctx.arc(hit.x + Math.cos(a) * d, hit.y + Math.sin(a) * d, r > 0.8 ? 1.7 : 0.8, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

function drawWateryRipple(ctx, x, y, radius, wobble, tick, pal, width, segs) {
  if (radius < 4) return;
  ctx.beginPath();
  for (let i = 0; i <= segs; i++) {
    const a = (i / segs) * Math.PI * 2;
    const n =
      Math.sin(a * 3 + tick * 0.11) * wobble +
      Math.sin(a * 7 - tick * 0.17) * wobble * 0.45 +
      Math.sin(a * 13 + tick * 0.09) * wobble * 0.2;
    const px = x + Math.cos(a) * (radius + n);
    const py = y + Math.sin(a) * (radius + n);
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.strokeStyle = pal.glow;
  ctx.lineWidth = width * 2.8;
  ctx.stroke();
  ctx.strokeStyle = pal.mid;
  ctx.lineWidth = width;
  ctx.stroke();
  ctx.strokeStyle = pal.core;
  ctx.lineWidth = Math.max(0.5, width * 0.28);
  ctx.stroke();
}

function drawKirlianContact(ctx, t, pal, tick, screenW, screenH, power01) {
  const { x, y } = t;
  const charging = t.held && !t.blast;
  const charge = Math.max(0, Math.min(1, t.charge || 0));
  const blast = t.blast ? Math.max(0, Math.min(1, t.blastLife)) : 0;
  const expand = t.blast ? 1 - blast : 0;
  const intensity = power01 * (charging ? 0.18 + charge * 0.82 : blast * (0.55 + (t.blastPower || charge) * 0.7));
  const striking = t.targets && t.strikeLife > 0;
  if (intensity <= 0.01 && !striking) return;

  const reach = Math.hypot(screenW, screenH);
  const grow = charging ? charge : 0.4 + blast * 0.75 + expand * 0.45;
  const haloR = 36 + reach * (charging ? 0.16 + charge * 0.34 : 0.22 + expand * 0.55) * power01;
  const leaders = Math.max(2, Math.min(8, Math.round(2 + intensity * (t.blast ? 6 : 4))));
  const hairs = Math.max(4, Math.min(28, Math.round(6 + intensity * (t.blast ? 22 : 14))));
  const baseLen = (26 + reach * 0.92 * power01) * grow;
  const depth = Math.max(3, Math.min(6, Math.round(3 + intensity * (t.blast ? 3 : 2))));
  const alpha = charging ? 0.45 + charge * 0.55 : Math.max(0, blast);

  ctx.save();

  if (intensity > 0.01) {
    ctx.globalAlpha = alpha;

    const halo = ctx.createRadialGradient(x, y, 2, x, y, haloR);
    halo.addColorStop(0, pal.core);
    halo.addColorStop(0.1, pal.glow);
    halo.addColorStop(0.38, pal.aura);
    halo.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(x, y, haloR, 0, Math.PI * 2);
    ctx.fill();

    if (t.blast) {
      const ripples = 5;
      for (let i = 0; i < ripples; i++) {
        const phase = Math.max(0, expand * 1.08 - i * 0.09);
        if (phase <= 0.02) continue;
        const fade = Math.max(0, (1 - phase) * blast) * (1 - i * 0.12);
        if (fade < 0.04) continue;
        const radius = 14 + phase * reach * (0.38 + power01 * 0.5);
        const wobble = 3 + phase * 18 * power01;
        ctx.save();
        ctx.globalAlpha = alpha * fade * (0.85 - i * 0.1);
        drawWateryRipple(ctx, x, y, radius, wobble, tick + i * 9, pal, 1.4 + (1 - i / ripples) * 2.6 * power01, 56);
        ctx.restore();
      }
    }

    if (charging) {
      const circleR = 24 + charge * 40;
      const ripples = 3 + Math.round(charge * 5);
      for (let i = 0; i < ripples; i++) {
        const cycle = (tick * (0.04 + charge * 0.055) + i / ripples) % 1;
        const radius = 5 + cycle * circleR;
        const edge = Math.max(0, 1 - Math.pow(radius / circleR, 2.6));
        const fade = (1 - cycle) * (0.28 + charge * 0.72) * edge;
        if (fade < 0.04) continue;
        ctx.save();
        ctx.globalAlpha = alpha * fade;
        drawWateryRipple(
          ctx,
          x,
          y,
          radius,
          2 + charge * 14 + cycle * 6,
          tick + i * 11,
          pal,
          1.1 + charge * 3.4 * (1 - cycle * 0.4),
          48
        );
        ctx.restore();
      }

      const crackle = 2 + Math.round(charge * 5);
      for (let i = 0; i < crackle; i++) {
        const seed = (t.seed + i * 311 + Math.floor(tick / 2) * 19) | 0;
        const r0 = kirlianRand(seed);
        const ang = r0 * Math.PI * 2 + tick * 0.04;
        const len = 10 + charge * circleR * (0.28 + r0 * 0.32);
        ctx.save();
        ctx.globalAlpha = alpha * (0.35 + charge * 0.5);
        drawKirlianBranch(ctx, x, y, ang, len, 0.6 + charge * 1.8 * r0, 2, seed, pal, 0.12);
        ctx.restore();
      }
    }

    for (let i = 0; i < leaders; i++) {
      const seed = (t.seed + tick * (t.blast ? 5 : 2) + i * 1301) | 0;
      const r0 = kirlianRand(seed);
      const ang = (i / leaders) * Math.PI * 2 + r0 * 0.55 + tick * 0.008;
      const len = baseLen * (0.72 + r0 * 0.5);
      const w = 1.4 + intensity * (t.blast ? 6.4 : 4.2) * (0.25 + r0 * r0 * 1.15);
      drawKirlianBranch(ctx, x, y, ang, len, w, depth, seed, pal, 0.42 + intensity * 0.28);
    }

    for (let i = 0; i < hairs; i++) {
      const seed = (t.seed + 4409 + tick * (t.blast ? 9 : 3) + i * 769) | 0;
      const r0 = kirlianRand(seed);
      const ang = r0 * Math.PI * 2 + tick * 0.02;
      const len = baseLen * (0.28 + r0 * 0.62);
      const w = r0 > 0.72 ? 1.4 + r0 * 2.2 : r0 > 0.38 ? 0.7 + r0 * 1.1 : 0.3 + r0 * 0.55;
      drawKirlianBranch(ctx, x, y, ang, len, w, Math.max(2, depth - 1), seed, pal, 0.5 + intensity * 0.25);
    }

    const sparks = Math.round(8 + intensity * 28);
    for (let i = 0; i < sparks; i++) {
      const seed = t.seed + tick * 7 + i * 131;
      const r = kirlianRand(seed);
      const a2 = kirlianRand(seed + 3) * Math.PI * 2;
      const d = 8 + r * baseLen;
      ctx.fillStyle = r > 0.7 ? pal.core : pal.mid;
      ctx.beginPath();
      ctx.arc(x + Math.cos(a2) * d, y + Math.sin(a2) * d, r > 0.82 ? 1.8 : 0.8, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  if (t.targets && t.strikeLife > 0) {
    const span = 1.55;
    for (let i = 0; i < t.targets.length; i++) {
      const hit = t.targets[i];
      const age = span - t.strikeLife - hit.delay;
      if (age < 0) continue;
      const boltFade = Math.max(0, 1 - age / 0.5);
      const residFade = Math.max(0, 1 - age / 1.2);
      const seed = (hit.seed + Math.floor(age * 8) * 17) | 0;
      const thick = hit.thick ?? 0.5;
      const scale = thick > 0.72 ? 0.85 + thick * 0.55 : thick > 0.38 ? 0.38 + thick * 0.4 : 0.14 + thick * 0.22;
      const w = (1.1 + power01 * 6.2 * (t.blastPower || charge)) * scale;
      if (boltFade > 0.06) {
        ctx.save();
        ctx.globalAlpha = Math.min(1, boltFade * 1.1);
        drawKirlianBoltTo(ctx, x, y, hit.x, hit.y, w, 3, seed, pal);
        ctx.restore();
      }
      if (residFade > 0.04) drawStruckElement(ctx, hit, pal, tick, residFade);
    }
  }

  ctx.restore();
}

function wireKirlian() {
  const canvas = document.getElementById("kirlian");
  if (!canvas) return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    canvas.remove();
    return;
  }

  const ctx = canvas.getContext("2d", { alpha: true });
  if (!ctx) return;

  /**
   * @type {Map<number, {
   *   x: number, y: number, seed: number, held: boolean,
   *   charge: number, blast: boolean, blastLife: number, blastPower: number,
   *   targets: { x: number, y: number, seed: number, delay: number }[]|null,
   *   strikeLife: number
   * }>}
   */
  const contacts = new Map();
  const warped = new Set();
  let warpEls = null;
  let raf = 0;
  let tick = 0;
  let cssW = 0;
  let cssH = 0;
  let dpr = 1;

  function collectWarpEls() {
    return Array.from(
      document.querySelectorAll(
        "#app .view.view-active .summary-card, #app .view.view-active .holding-row, #app .view.view-active .pf-card, #app .view.view-active .settings-group, #app .view.view-active .section-head, #app .view.view-active h2, #app .view.view-active .coin-avatar, #app .view.view-active .field-input, #app .view.view-active .btn-primary, #app .view.view-active .btn-secondary, #app .brand, #app .topbar-title"
      )
    );
  }

  function clearWarp() {
    for (const el of warped) {
      el.classList.remove("kirlian-warped");
      el.style.transform = "";
      el.style.filter = "";
    }
    warped.clear();
    warpEls = null;
  }

  function applyBlastWarp(cx, cy, expand, power01, blastLife) {
    if (!warpEls) warpEls = collectWarpEls();
    const reach = Math.hypot(cssW, cssH);
    const scale = 0.38 + power01 * 0.5;
    const band = 52 + power01 * 90;
    const amp = (12 + power01 * 26) * blastLife;

    for (const el of warpEls) {
      if (!el.isConnected) continue;
      const box = el.getBoundingClientRect();
      if (box.width < 8 || box.height < 8) continue;
      const ex = box.left + box.width / 2;
      const ey = box.top + box.height / 2;
      const d = Math.hypot(ex - cx, ey - cy) || 1;
      let wave = 0;
      for (let i = 0; i < 5; i++) {
        const phase = Math.max(0, expand * 1.08 - i * 0.09);
        if (phase <= 0.02) continue;
        const radius = 14 + phase * reach * scale;
        const delta = d - radius;
        const env = Math.exp(-(delta * delta) / (2 * band * band));
        wave += Math.sin(delta * 0.065 + i * 0.7) * env * (1 - i * 0.12);
      }
      wave *= blastLife;
      if (Math.abs(wave) < 0.025) {
        if (warped.has(el)) {
          el.classList.remove("kirlian-warped");
          el.style.transform = "";
          el.style.filter = "";
          warped.delete(el);
        }
        continue;
      }
      const nx = (ex - cx) / d;
      const ny = (ey - cy) / d;
      el.classList.add("kirlian-warped");
      el.style.transform = `translate3d(${(nx * wave * amp).toFixed(2)}px, ${(ny * wave * amp * 0.92).toFixed(2)}px, 0) scale(${(1 + wave * 0.07).toFixed(4)}, ${(1 - wave * 0.055).toFixed(4)}) skewX(${(wave * 3.6).toFixed(2)}deg)`;
      el.style.filter = `contrast(${(1 + Math.abs(wave) * 0.22).toFixed(3)}) saturate(${(1 + Math.abs(wave) * 0.18).toFixed(3)})`;
      warped.add(el);
    }
  }

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    cssW = window.innerWidth;
    cssH = window.innerHeight;
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
  }

  function kick() {
    if (!raf) raf = requestAnimationFrame(frame);
  }

  function frame() {
    raf = 0;
    tick += 1;
    const power01 = getLightningPower() / 100;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssW, cssH);

    if (power01 <= 0 && ![...contacts.values()].some((t) => t.blast)) {
      contacts.clear();
      ctx.globalCompositeOperation = "source-over";
      return;
    }

    ctx.globalCompositeOperation = "lighter";
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    const pal = kirlianPalette();
    let alive = false;
    let warpSrc = null;
    for (const [id, t] of contacts) {
      if (t.held && !t.blast) {
        // Charge faster at higher Lightning Power (~0.7s at 100, ~1.4s at 20)
        const rate = 0.018 + power01 * 0.028;
        t.charge = Math.min(1, t.charge + rate);
        alive = true;
      } else if (t.blast || t.strikeLife > 0) {
        if (t.blast) t.blastLife -= 0.032 + power01 * 0.01;
        if (t.blast && !t.targets && t.blastLife < 0.5) {
          if (getLightningStrikes()) {
            const n = Math.max(1, Math.min(7, Math.round(1 + power01 * 5 * (0.35 + (t.blastPower || 0)))));
            t.targets = pickKirlianTargets(t.x, t.y, n);
            t.strikeLife = 1.55;
          } else {
            t.targets = [];
            t.strikeLife = 0;
          }
        }
        if (t.strikeLife > 0) t.strikeLife -= 0.026;
        if (t.blastLife <= 0) t.blast = false;
        if (t.blastLife <= 0 && t.strikeLife <= 0) {
          contacts.delete(id);
          continue;
        }
        alive = true;
        if (t.blast) warpSrc = t;
      } else {
        contacts.delete(id);
        continue;
      }
      drawKirlianContact(ctx, t, pal, tick, cssW, cssH, power01);
    }

    if (warpSrc) {
      applyBlastWarp(warpSrc.x, warpSrc.y, 1 - warpSrc.blastLife, power01, Math.max(0, warpSrc.blastLife));
    } else if (warped.size) {
      clearWarp();
    }

    ctx.globalCompositeOperation = "source-over";
    if (alive) raf = requestAnimationFrame(frame);
    else {
      clearWarp();
      ctx.clearRect(0, 0, cssW, cssH);
    }
  }

  function upsert(id, clientX, clientY) {
    if (getLightningPower() <= 0) return;
    let t = contacts.get(id);
    if (!t || t.blast) {
      t = {
        x: clientX,
        y: clientY,
        seed: (Math.random() * 1e9) | 0,
        held: true,
        charge: t && t.blast ? Math.min(1, t.charge * 0.25) : 0,
        blast: false,
        blastLife: 0,
        blastPower: 0,
        targets: null,
        strikeLife: 0,
      };
      contacts.set(id, t);
    }
    t.x = clientX;
    t.y = clientY;
    t.held = true;
    kick();
  }

  function release(id) {
    const t = contacts.get(id);
    if (!t || t.blast) return;
    t.held = false;
    t.blast = true;
    t.blastPower = t.charge;
    t.blastLife = 1;
    t.seed = (t.seed + 7919) | 0;
    kick();
  }

  document.addEventListener(
    "pointerdown",
    (e) => upsert(e.pointerId, e.clientX, e.clientY),
    { capture: true, passive: true }
  );
  document.addEventListener(
    "pointermove",
    (e) => {
      if (e.pointerType === "mouse" && e.buttons === 0) return;
      if (!contacts.has(e.pointerId) && e.pointerType === "mouse") return;
      upsert(e.pointerId, e.clientX, e.clientY);
    },
    { capture: true, passive: true }
  );
  document.addEventListener(
    "pointerup",
    (e) => release(e.pointerId),
    { capture: true, passive: true }
  );
  document.addEventListener(
    "pointercancel",
    (e) => release(e.pointerId),
    { capture: true, passive: true }
  );
  document.addEventListener(
    "pointerleave",
    (e) => {
      if (e.target === document.documentElement || e.target === document.body) release(e.pointerId);
    },
    { capture: true, passive: true }
  );

  window.addEventListener("resize", resize);
  resize();
}

function wire() {
  wirePullToRefresh();
  wireHomePager();
  wireKirlian();

  document.getElementById("home-chart-retry")?.addEventListener("click", () => {
    // Bust cache for current range so retry actually refetches
    const days = chartRange;
    for (const key of Object.keys(chartCache)) {
      if (key.endsWith(`:${days}`)) delete chartCache[key];
    }
    updateHomeChart(null, { force: true });
  });

  document.getElementById("btn-back").addEventListener("click", () => {
    if (nav.view === "tv") {
      const backTo = nav.tvReturn || { view: "home" };
      nav.tvReturn = null;
      showView(backTo.view || "home", {
        portfolioId: backTo.portfolioId,
        coinId: backTo.coinId,
      });
    } else if (nav.view === "asset" || nav.view === "add-coin") {
      showView("portfolio", { portfolioId: nav.portfolioId });
    } else if (nav.view === "portfolio") {
      // Portfolios are managed from Settings
      showView("settings");
    } else if (nav.view === "settings") {
      showView("home");
    }
  });

  document.addEventListener(
    "click",
    (e) => {
      const av = e.target.closest("[data-open-tv]");
      if (!av || nav.view === "tv") return;
      const id = av.getAttribute("data-open-tv");
      if (!id || !getAsset(id)) return;
      e.preventDefault();
      e.stopPropagation();
      showView("tv", { coinId: id });
    },
    true
  );
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    const av = e.target.closest?.("[data-open-tv]");
    if (!av || nav.view === "tv") return;
    const id = av.getAttribute("data-open-tv");
    if (!id || !getAsset(id)) return;
    e.preventDefault();
    showView("tv", { coinId: id });
  });

  document.getElementById("btn-settings").addEventListener("click", () => showView("settings"));

  document.getElementById("btn-new-portfolio").addEventListener("click", () => openPortfolioModal("create"));
  document.getElementById("btn-rename-portfolio").addEventListener("click", () => openPortfolioModal("rename"));
  document.getElementById("btn-delete-portfolio").addEventListener("click", () => deleteCurrentPortfolio());
  document.getElementById("btn-add-holding").addEventListener("click", () => showView("add-coin"));
  document.getElementById("asset-search")?.addEventListener("input", (e) => {
    scheduleAssetSearch(e.target.value);
  });
  document.getElementById("asset-search")?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const first = document.querySelector("#asset-search-results .coin-pick-row");
      if (first) first.click();
    }
  });

  document.getElementById("modal-portfolio-cancel").addEventListener("click", closePortfolioModal);
  document.getElementById("modal-portfolio-save").addEventListener("click", savePortfolioModal);
  document.getElementById("portfolio-name-input").addEventListener("keydown", (e) => {
    if (e.key === "Enter") savePortfolioModal();
  });

  document.getElementById("btn-portfolio-switch").addEventListener("click", openPicker);
  document.getElementById("picker-close").addEventListener("click", () => {
    document.getElementById("modal-picker").hidden = true;
  });
  document.getElementById("picker-all").addEventListener("click", () => {
    document.getElementById("modal-picker").hidden = true;
    showView("settings");
  });

  document.getElementById("add-address-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const val = document.getElementById("address-input").value;
    await addAddressToCurrent(val);
  });

  document.getElementById("add-manual-form").addEventListener("submit", (e) => {
    e.preventDefault();
    addManualToCurrent(
      document.getElementById("manual-amount-input").value,
      document.getElementById("manual-price-input").value,
      document.getElementById("manual-fee-input").value,
      document.getElementById("manual-label-input").value
    );
  });

  document.getElementById("manual-price-input").addEventListener("input", () => {
    manualPriceDirty = true;
  });

  document.getElementById("manual-fee-input").addEventListener("change", () => {
    const fee = setExchangeFeePct(document.getElementById("manual-fee-input").value || 0);
    document.getElementById("manual-fee-input").value = fee > 0 ? String(fee) : "";
    updateManualFeeHint();
    toast(fee > 0 ? `Exchange fee saved: ${fee}%` : "Exchange fee cleared", "success");
  });

  document.getElementById("btn-save-avg-buy").addEventListener("click", () => {
    const pf = getPortfolio(nav.portfolioId);
    const coin = getAsset(nav.coinId);
    if (!pf || !coin) return;
    if (setAvgBuyPrice(pf, coin.id, document.getElementById("avg-buy-input").value)) {
      render();
      const cb = costBasisInfo(pf, coin.id);
      toast(`Avg buy set · cost basis ${formatUsd(cb.cost)}`, "success");
    }
  });

  document.getElementById("btn-save-cost-basis").addEventListener("click", () => {
    const pf = getPortfolio(nav.portfolioId);
    const coin = getAsset(nav.coinId);
    if (!pf || !coin) return;
    if (setCostBasisUsd(pf, coin.id, document.getElementById("cost-basis-input").value)) {
      render();
      const cb = costBasisInfo(pf, coin.id);
      const avgTxt = cb.avg != null ? formatUsd(cb.avg) : "—";
      toast(`Cost basis set · avg buy ${avgTxt}`, "success");
    }
  });

  document.getElementById("btn-clear-cost").addEventListener("click", () => {
    const pf = getPortfolio(nav.portfolioId);
    const coin = getAsset(nav.coinId);
    if (!pf || !coin) return;
    if (!confirm("Clear cost basis and average buy price for this coin?")) return;
    clearCostBasis(pf, coin.id);
    render();
    toast("Cost basis cleared");
  });

  const lightningSlider = document.getElementById("settings-lightning");
  const lightningVal = document.getElementById("settings-lightning-value");
  lightningSlider?.addEventListener("input", () => {
    const power = setLightningPower(lightningSlider.value);
    if (lightningVal) lightningVal.textContent = String(power);
  });
  document.getElementById("settings-lightning-strikes")?.addEventListener("change", (e) => {
    setLightningStrikes(e.target.checked);
  });

  document.getElementById("btn-save-fee").addEventListener("click", () => {
    const fee = setExchangeFeePct(document.getElementById("settings-fee-input").value || 0);
    document.getElementById("settings-fee-input").value = fee > 0 ? String(fee) : "";
    updateManualFeeHint();
    toast(fee > 0 ? `Exchange fee saved: ${fee}%` : "Exchange fee cleared", "success");
  });

  document.getElementById("btn-export").addEventListener("click", exportData);
  document.getElementById("btn-import").addEventListener("click", () => {
    document.getElementById("import-file").click();
  });
  document.getElementById("import-file").addEventListener("change", (e) => {
    const file = e.target.files?.[0];
    if (file) importData(file);
    e.target.value = "";
  });
  document.getElementById("btn-wipe").addEventListener("click", wipeAll);

  // Close modals on backdrop click
  for (const id of ["modal-portfolio", "modal-picker"]) {
    document.getElementById(id).addEventListener("click", (e) => {
      if (e.target.id === id) e.target.hidden = true;
    });
  }
}

// ── Opening splash ─────────────────────────────────────────────────────────

/** Green if the hall hoard is up on 24h, red if down, gold when unknown/flat. */
function splashVideoSrc() {
  const { changeUsd, totalUsd } = allPortfoliosTotals();
  if (!(totalUsd > 0) || changeUsd == null || Number.isNaN(changeUsd) || changeUsd === 0) {
    return "assets/goldenSplash.mov";
  }
  return changeUsd > 0 ? "assets/GreenSplash.mov" : "assets/RedSplash.mov";
}

function startSplash() {
  const el = document.getElementById("splash");
  if (!el) return;

  const video = document.getElementById("splash-video");
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let done = false;

  const dismiss = () => {
    if (done) return;
    done = true;
    if (video) {
      video.pause();
    }
    el.classList.add("splash-out");
    let removed = false;
    const finish = () => {
      if (removed || !el.isConnected) return;
      removed = true;
      el.remove();
    };
    el.addEventListener("animationend", finish, { once: true });
    setTimeout(finish, reduced ? 80 : 600);
  };

  el.addEventListener("click", dismiss);

  if (reduced) {
    setTimeout(dismiss, 500);
    return;
  }

  if (video) {
    video.muted = true;
    video.src = splashVideoSrc();
    video.load();
    const playAttempt = video.play();
    if (playAttempt && typeof playAttempt.catch === "function") {
      playAttempt.catch(() => setTimeout(dismiss, 2600));
    }
    video.addEventListener("ended", dismiss, { once: true });
    video.addEventListener("error", () => setTimeout(dismiss, 800), { once: true });
    setTimeout(dismiss, 7000);
  } else {
    setTimeout(dismiss, 2600);
  }
}

// ── Boot ───────────────────────────────────────────────────────────────────

loadMarketSnapshot(); // restore last prices/balances so UI doesn't flash $0
seedPricesFromAssets();
wire();
render();
startSplash();
refreshAll({ fromPull: false });
