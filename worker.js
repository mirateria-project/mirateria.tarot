// しーちゃんのタロット占い — Gemini中継 v6（GitHubから自動で入る版）
// 鍵は Cloudflare のシークレット GEMINI_API_KEY に入っています（ここには書きません）
const RELAY = "v6";
// 上から順に試す。混雑(503)などなら少し待ってやり直し → 次のモデルへ
const MODELS = ["gemini-2.5-flash", "gemini-flash-latest", "gemini-2.5-flash-lite", "gemini-flash-lite-latest"];
const TOTAL_MS = 90000; // アプリ側は100秒で諦めるので、その前に必ず返す

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Expose-Headers": "X-Model, X-Tried, X-Relay",
};
const sleep = ms => new Promise(r => setTimeout(r, ms));

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") return new Response(null, { headers: CORS });
    if (request.method !== "POST") return new Response("OK " + RELAY, { headers: { ...CORS, "Content-Type": "text/plain" } });

    const body = await request.text();
    const start = Date.now();
    const tried = [];
    let last = null;

    for (const model of MODELS) {
      for (let attempt = 1; attempt <= 2; attempt++) {
        const left = TOTAL_MS - (Date.now() - start);
        if (left < 8000) break;
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), left - 3000);
        let res, text;
        try {
          res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-goog-api-key": env.GEMINI_API_KEY },
            body, signal: ctrl.signal,
          });
          text = await res.text();
        } catch (e) {
          clearTimeout(timer);
          tried.push(`${model}:timeout`);
          last = { status: 504, text: JSON.stringify({ error: { code: 504, status: "TIMEOUT", message: "Gemini took too long" } }) };
          break; // 時間切れ → 次のモデル
        }
        clearTimeout(timer);
        tried.push(`${model}:${res.status}`);
        if (res.ok) {
          return new Response(text, { headers: { ...CORS, "Content-Type": "application/json", "X-Model": model, "X-Tried": tried.join(","), "X-Relay": RELAY } });
        }
        last = { status: res.status, text };
        if (res.status === 400 || res.status === 401 || res.status === 403) {
          // 鍵やリクエストの問題はやり直しても同じなので、すぐ返す
          return out(last, tried);
        }
        if (res.status === 404) break; // そのモデルが無い → 次のモデル
        if (attempt === 1) await sleep(1500); // 混雑 → 少し待って同じモデルでもう1回
      }
    }
    return out(last || { status: 503, text: JSON.stringify({ error: { code: 503, status: "UNAVAILABLE", message: "all models busy" } }) }, tried);
  },
};

function out(last, tried) {
  return new Response(last.text, { status: last.status, headers: { ...CORS, "Content-Type": "application/json", "X-Tried": tried.join(","), "X-Relay": RELAY } });
}
