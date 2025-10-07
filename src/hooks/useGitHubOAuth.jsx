import { useState } from "react";
import toast from "react-hot-toast";

const PROXY_DEVICE_URL = "https://github-oauth-proxy-omega.vercel.app/api/github-device";
const PROXY_TOKEN_URL  = "https://github-oauth-proxy-omega.vercel.app/api/github-token";

export function useGitHubOAuth() {
  const [auth, setAuth] = useState(() => {
    const saved = localStorage.getItem("github_auth");
    return saved ? JSON.parse(saved) : null;
  });
  const [loading, setLoading] = useState(false);

  // 🪟 Opens a real popup window with device code and link
  const openPopup = (code, uri) => {
    const w = 420, h = 380;
    const left = window.screenX + (window.outerWidth - w) / 2;
    const top = window.screenY + (window.outerHeight - h) / 2;
    const popup = window.open("", "GitHubLogin", `width=${w},height=${h},left=${left},top=${top}`);

    popup.document.write(`
      <html>
        <head>
          <title>Verify on GitHub</title>
          <style>
            body { font-family: system-ui, sans-serif; background: #f6f8fa; color: #24292f;
                   text-align: center; padding: 2em; margin: 0; }
            a { color: #0969da; text-decoration: none; font-weight: 500; }
            h2 { margin-bottom: 0.5em; }
            .code-box {
              display: inline-block;
              padding: 0.6em 1.2em;
              background: white;
              border: 1px solid #d0d7de;
              border-radius: 8px;
              font-size: 1.5em;
              font-family: monospace;
              margin: 0.8em 0;
            }
            button {
              background: #2da44e;
              color: white;
              border: none;
              border-radius: 6px;
              padding: 0.6em 1.2em;
              cursor: pointer;
              font-weight: 500;
            }
            button:hover { background: #2c974b; }
          </style>
        </head>
        <body>
          <h2>Verify on GitHub</h2>
          <p>1️⃣ Go to <a href="${uri}" target="_blank">${uri}</a></p>
          <p>2️⃣ Enter this code:</p>
          <div class="code-box">${code}</div>
          <p>
            <button onclick="navigator.clipboard.writeText('${code}')">📋 Copy Code</button>
          </p>
          <p style="margin-top:1.5em;font-size:0.9em;color:#57606a">
            You can close this window after authorization.
          </p>
        </body>
      </html>
    `);
    popup.document.close();
    return popup;
  };

  async function login() {
    setLoading(true);
    try {
      // 1️⃣ Ask proxy for device & user codes
      const res = await fetch(PROXY_DEVICE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Device init failed");

      const uri = data.verification_uri_complete || data.verification_uri;
      const popup = openPopup(data.user_code, uri);

      // 2️⃣ Poll for token
      const waitToast = toast.loading("Waiting for GitHub authorization...");
      const intervalMs = Math.max(5, data.interval || 5) * 1000;
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
          const uRes = await fetch("https://api.github.com/user", {
            headers: { Authorization: `token ${tData.access_token}` }
          });
          const user = await uRes.json();

          toast.dismiss(waitToast);
          toast.success(`Welcome, ${user.login}! 🎉`);

          const session = { token: tData.access_token, user };
          localStorage.setItem("github_auth", JSON.stringify(session));
          setAuth(session);

          if (popup && !popup.closed) popup.close();
          break;
        }

        if (tData.error === "authorization_pending") continue;
        if (tData.error === "slow_down") { delay += 5000; continue; }
        if (tData.error === "access_denied") throw new Error("Access denied by user.");
        if (tData.error) throw new Error(tData.error_description || tData.error);
      }
    } catch (err) {
      toast.dismiss();
      toast.error(`GitHub login failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }

  function logout() {
    localStorage.removeItem("github_auth");
    setAuth(null);
    toast("Logged out 👋");
  }

  return { auth, login, logout, loading };
}
