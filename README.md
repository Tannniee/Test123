
## 📂 Kiến trúc Module (Project Architecture)
```
POE/
├── data/
│   └── cache/             # File JSON cache cục bộ & snapshots lịch sử
├── public/
│   ├── css/
│   │   └── style.css      # Dark Slate Theme, PoE Tooltips, Badges, Modals
│   ├── js/
│   │   ├── modules/
│   │   │   ├── state.js      # Quản lý State, LocalStorage (Favorites, Alerts, Settings)
│   │   │   ├── api.js        # HTTP Client (Leagues, Items, Diagnostics, Refresh)
│   │   │   ├── search.js     # Levenshtein Fuzzy Search & Multi-Token Ranking
│   │   │   ├── render.js     # Render Table & Grid (100% Event Delegation, Liquidity Badges)
│   │   │   ├── modals.js     # Calculator, Compare Mode, Price Alerts, Diagnostics
│   │   │   └── clipboard.js  # Whisper Copy, XSS-Safe Toast Notification
│   │   ├── app.js            # Main Orchestrator & Event Delegation Controller
│   │   └── itemParser.js     # Bộ parser định dạng Ctrl+C vật phẩm trong game
│   └── index.html         # Giao diện chính của ứng dụng
├── services/
│   ├── conversionMath.js  # Utility toán học quy đổi tiền tệ & Rate Anomaly Guard
│   └── cacheManager.js    # Logic nạp API poe.ninja, Dynamic Leagues, Retry & Schedulers
├── test/
│   ├── conversionMath.test.js # Unit test quy đổi tiền tệ và bảo vệ tỷ giá
│   └── frontendFeatures.mjs   # Unit test fuzzy search và liquidity badges
├── package.json
├── server.js              # Express web server, API Endpoints & Proxy
├── start.bat              # Script 1-click khởi chạy cho Windows
└── README.md

