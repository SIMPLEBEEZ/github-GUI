import { useState } from "react";

const PROXY_DEVICE_URL = "https://github-oauth-proxy-omega.vercel.app/api/github-device";
const PROXY_TOKEN_URL  = "https://github-oauth-proxy-omega.vercel.app/api/github-token";

export function useGitHubOAuth() {
  const [auth, setAuth] = useState(null);
  const [loading, setLoading] = useState(false);

  async function login() {
    setLoading(true);
    try {
      // 1) Ask proxy for device & user codes
      const res = await fetch(PROXY_DEVICE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Device init failed");

      // nice UX: open verification link and show code
      const uri = data.verification_uri_complete || data.verification_uri;
      window.open(uri, "_blank", "noopener,noreferrer");
      alert(`Enter this code on GitHub:\n\n${data.user_code}\n\nA new tab was opened for you.`);

      const intervalMs = Math.max(5, data.interval || 5) * 1000;

      // 2) Poll token via proxy
      let delay = intervalMs;
      while (true) {
        await new Promise(r => setTimeout(r, delay));
        const tRes = await fetch(PROXY_TOKEN_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Accept": "application/json" },
          body: JSON.stringify({ device_code: data.device_code })
        });
        const tData = await tRes.json();

        if (tData.access_token) {
          // 3) Optional: fetch user
          const uRes = await fetch("https://api.github.com/user", {
            headers: { Authorization: `token ${tData.access_token}` }
          });
          const user = await uRes.json();
          setAuth({ token: tData.access_token, user });
          break;
        }

        if (tData.error === "authorization_pending") {
          // keep polling
          continue;
        }
        if (tData.error === "slow_down") {
          delay += 5000; // backoff +5s
          continue;
        }
        if (tData.error === "access_denied") {
          throw new Error("Access denied by user.");
        }
        if (tData.error) {
          throw new Error(tData.error_description || tData.error);
        }
      }
    } catch (err) {
      alert(`GitHub login failed. Please try again.\n${err.message || err}`);
    } finally {
      setLoading(false);
    }
  }

  return { auth, login, loading };
}
