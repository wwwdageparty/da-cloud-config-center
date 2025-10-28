# Da Cloud Config Center (DCCC) — Demo Console

This is the demo admin console for **Da Cloud Config Center (DCCC)** — a lightweight configuration and secret management service built on Cloudflare Workers.

🌐 **Live Demo:** [https://democcc.pages.dev/](https://democcc.pages.dev/)

📦 **Repository:** [https://github.com/wwwdageparty/dademo-cloud-config-center](https://github.com/wwwdageparty/dademo-cloud-config-center)

---

## 🚀 Features

- Query any config key by **service**, **instance**, and **key**
- View all configs under a given service & instance
- Create / update / delete configuration values
- Fetch and view secrets (read-only)
- Cloudflare Pages front-end only (no backend required)
- Works directly with a DCCC-compatible API endpoint

---

## 🧩 Default Setup

The demo site is pre-configured with:

| Setting | Value |
|----------|--------|
| **Base API** | `https://dccc.dagedemo.workers.dev/` |
| **Write Token** | `Demo111+` |
| **Read Token** | `Demo222-` |
| **Default Service** | `dademo` |
| **Default Instance** | `test` |
| **Default Key** | `timeout` |
| **Secret Key Example** | `DASECRET_TEST1` → `SECRET_TEST1` (read-only) |

> 🔒 The secret key (`DASECRET_TEST1`) cannot be modified — it exists for demonstration only.

---

## 🧠 Usage

1. Open the demo at [democcc.pages.dev](https://democcc.pages.dev/)
2. The page is ready to use — no authentication or setup needed.
3. You can:
   - Query a config key
   - View / edit / delete configs (where allowed)
   - View secret values (read-only)

---

## 🛠️ Deployment

You can deploy your own copy easily on **Cloudflare Pages**:

1. Fork this repo:  
   👉 [https://github.com/wwwdageparty/dademo-cloud-config-center](https://github.com/wwwdageparty/dademo-cloud-config-center)
2. Go to [Cloudflare Pages](https://pages.cloudflare.com/)
3. Create a new project and connect it to your fork
4. Set **Build command:** `npm run build` *(if applicable)*  
   or just deploy the static `index.html`
5. Once deployed, your DCCC demo will be live!

---

## 🧩 API Endpoint Example

All API calls go through your configured base endpoint.  
Example:  
```bash
curl -H "Authorization: Bearer Demo222-"   "https://dccc.dagedemo.workers.dev/get?service=dademo&instance=test&key=timeout"
```

Response:
```json
{
  "found": true,
  "key": "timeout",
  "value": "300",
  "source": { "c1": "dademo", "c2": "test", "c3": "timeout" }
}
```

---

## 🧱 Architecture

```
+----------------------------+
| DCCC Demo Console (Pages)  |
|  → HTML + Tailwind + JS    |
+-------------+--------------+
              |
              ↓
+----------------------------+
| DCCC API (Cloudflare Worker) |
|  /list /get /set /delete /secret |
+----------------------------+
```

---

## 🪪 License

MIT License © dage.party — 2025
