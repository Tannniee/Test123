# ⚡ Path of Exile Quick Price Checker (PoE 1 & PoE 2)

> Ứng dụng tra cứu giá thị trường tức thời cho **Path of Exile 1** và **Path of Exile 2**, lấy trực tiếp 100% dữ liệu từ **Faustus Currency Exchange** qua poe.ninja API với cơ chế quay vòng cache thông minh, thuật toán tìm kiếm mờ (Fuzzy Search), tính năng so sánh (Compare Mode), cảnh báo giá (Price Alerts) và bảo vệ tỷ giá chống lỗi (Rate Guard).

---

## ✨ Điểm nổi bật (Features)

- 🔄 **100% Faustus Currency Exchange Data**:
  - Chỉ lọc lấy tỷ giá giao dịch thực tế từ Faustus Exchange, loại bỏ hoàn toàn nhiễu từ Stash Tabs truyền thống.
  - Phân loại tự động 11 vật phẩm **Catalysts** và 16 vật phẩm **Vaal** vào nhóm `Currency` gốc của API với metadata `sourceType` chuẩn xác, loại bỏ nguy cơ trùng lặp dữ liệu.
  - Tự động nhận diện league hiện hành qua API `https://poe.ninja/${game}/api/economy/leagues` (ví dụ: *Forbidden Rites* cho PoE 2).
  - **Non-Silent League Warming**: Chuyển sang league chưa có cache sẽ tự động kích hoạt nạp ngầm và hiển thị trạng thái `warming`, tuyệt đối không bao giờ âm thầm trả về Standard.

- 🗂️ **Data-Driven Category Registry & Seasonal Auto-Hiding**:
  - Hệ thống Registry nhận diện toàn bộ các type hỗ trợ của PoE 1 (Djinn Coins, Astrolabes, Resonators, Ducats,...) và PoE 2 (Fragments, Uncut Gems, Essences, Soul Cores, Idols, Runes, Verisium, Omens, Catalysts, Liquid Emotions, Abyssal Bones).
  - **Tự động ẩn/hiện danh mục theo mùa**: Danh mục theo mùa như *Ducats* tự động xuất hiện khi league hỗ trợ (Allflame) và tự động ẩn khỏi sidebar khi league không hỗ trợ (Standard).
  - **Scheduler tự thích ứng**: Hàng đợi luân phiên Round-Robin tự động co giãn từ các categories thực sự khả dụng mà không phụ thuộc vào mảng batch tĩnh.

- 🛡️ **Rate Validation & Anomaly Guard xuyên suốt Pipeline**:
  - Nếu tỷ giá từ API trả về `0`, `null`, `NaN` hoặc biến động bất thường (> 3x hoặc < 0.3x so với cache hiện tại), hệ thống tự động giữ lại tỷ giá tốt nhất đã biết (*last-known-good rate*) và gắn cờ cảnh báo `stale`.
  - Tỷ giá đã qua Rate Guard được truyền trực tiếp vào quá trình tính toán giá trị của từng item (`item.divineValue`, `exaltedValue`, `chaosValue`), bảo đảm giá item, header và calculator luôn nhất quán 100%.
  - Tự động trích xuất tỷ giá Exalted / Divine động từ `core.rates.exalted` hoặc `exaltedLine.primaryValue`, tuyệt đối không dùng số cố định (*hardcoded*).

- ⏱️ **Cơ chế Cache quay vòng & Retry với Exponential Backoff**:
  - **Priority Sync (30 phút)**: Các danh mục biến động cao (*Currency*, *Scarabs*, *Fragments*) luôn được cập nhật định kỳ mỗi 30 phút.
  - **Rotation Batches (5 phút)**: Các danh mục thứ cấp được chia thành 6 cặp hợp lệ cho PoE 1 và 3 cặp cho PoE 2 tải luân phiên mỗi 5 phút một lần để tránh nghẽn mạng.
  - **Retry tự động**: Cơ chế thử lại 2 lần với độ trễ lũy tiến (500ms → 1500ms) khi gặp lỗi mạng hoặc server 5xx.
  - **Làm mới riêng từng danh mục (Per-Category Refresh)**: Nút làm mới tức thì ngay tại thanh tiêu đề danh mục mà không cần tải lại toàn bộ app.

- 🔍 **Fuzzy Search & Multi-Token Ranking**:
  - Thuật toán Levenshtein tối ưu không cần thư viện ngoài: gõ sai chính tả nhẹ (ví dụ `divne orb`, `apothcary`) vẫn tìm thấy chính xác vật phẩm mong muốn.
  - Xếp hạng ưu tiên đa tầng: Khớp 100% tên (Score 100) → Khớp tiền tố (80) → Khớp toàn bộ từ (60) → Khớp cụm từ (40) → Khớp mờ Fuzzy (20).

- ⭐ **Danh sách Yêu thích (Favorites / Watchlist)**:
  - Bấm ngôi sao ★ trên từng vật phẩm để lưu vào `localStorage`.
  - Bộ lọc nhanh `★ Yêu thích` giúp xem lại các món đồ theo dõi chỉ với 1 click.

- ⚖️ **So sánh vật phẩm (Compare Mode)**:
  - Tick chọn 2 đến 5 vật phẩm bất kỳ và mở bảng so sánh trực diện (giá quy đổi, biến động 7 ngày, biểu đồ sparkline, khối lượng 24h và thanh khoản).

- 💧 **Huy hiệu Thanh khoản (Liquidity Indicator)**:
  - Phân loại trực quan khối lượng giao dịch 24h:
    - 🟢 **High**: Volume > 10,000 / 24h
    - 🟡 **Med**: Volume 1,000 - 10,000 / 24h
    - ⚪ **Low**: Volume < 1,000 / 24h
    - ⚫ **No Vol**: Ít hoặc không có giao dịch

- 🚨 **Cảnh báo giá cục bộ (Price Alerts)**:
  - Thiết lập điều kiện thông báo (ví dụ: *Divine Orb > 180 Chaos*, *The Doctor < 10 Divine*).
  - Tự động kiểm tra và bắn thông báo Toast khi mở app hoặc khi cache cập nhật.

- 📊 **API Diagnostics & Status Panel**:
  - Bảng kiểm tra tình trạng kết nối của từng danh mục: mã HTTP (200 / 404), latency ms, số lượng items và lần cập nhật gần nhất.

- 🧮 **Máy tính giá nhanh (Quantity Calculator)**:
  - Các nút preset tiện lợi: `1`, `+5`, `+10`, `+20`, `Full Stack` (tự động nhận diện stack tối đa của Divination Card, Currency, Fossil...), và `Reset`.
  - Nút sao chép giá định dạng whisper in-game chuẩn với hiệu ứng `✓ Đã sao chép!`.

- ⌨️ **Phím tắt nhanh (Keyboard Shortcuts)**:
  - `/` : Focus nhanh vào thanh tìm kiếm.
  - `Enter` : Mở nhanh modal tính giá cho kết quả đầu tiên.
  - `Esc` : Đóng modal đang mở.

---

## 🚀 Cài đặt & Khởi chạy (Quick Start)

### 1. Yêu cầu hệ thống
- [Node.js](https://nodejs.org/) (**v18.0.0 trở lên**, bắt buộc để hỗ trợ native `fetch()` và ES Modules).
- Git

### 2. Cài đặt các gói phụ thuộc
```bash
npm install
```

### 3. Chạy kiểm thử tự động (Unit Tests)
Kiểm tra toàn diện công thức quy đổi tiền tệ và thuật toán tìm kiếm mờ:
```bash
npm test
```

### 4. Khởi động ứng dụng
- **Cách 1: Sử dụng file batch (Windows)**
  Click đúp vào file `start.bat`. File này sẽ tự kiểm tra môi trường, cài đặt dependencies nếu thiếu, khởi động server và tự mở trình duyệt tại `http://localhost:3000`.

- **Cách 2: Dòng lệnh**
  ```bash
  npm start
  ```
  Sau đó mở trình duyệt tại: [http://localhost:3000](http://localhost:3000)

---

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
```

---

## 📜 Giấy phép (License)
Dự án được phân phối dưới giấy phép [MIT License](LICENSE).
