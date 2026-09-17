# ⚡ Path of Exile Quick Price Checker (PoE 1 & PoE 2)

> Ứng dụng tra cứu giá thị trường nhanh cho **Path of Exile 1** và **Path of Exile 2**, lấy trực tiếp 100% dữ liệu từ **Faustus Currency Exchange** qua poe.ninja API với cơ chế quay vòng cache thông minh và giao diện tối ưu tốc độ tra cứu.

---

## ✨ Điểm nổi bật (Features)

- 🔄 **100% Faustus Currency Exchange Data**:
  - Chỉ lọc lấy tỷ giá giao dịch thực tế từ Faustus Exchange, loại bỏ hoàn toàn nhiễu từ Stash Tabs truyền thống.
  - Hỗ trợ đầy đủ cả **Path of Exile 1** và **Path of Exile 2** với các danh mục riêng biệt.
  
- ⏱️ **Cơ chế Cache quay vòng thông minh (Smart Round-robin & Priority Rotation)**:
  - **Priority Sync (30 phút)**: Các danh mục biến động cao như *Currency*, *Scarabs*, *Fragments* luôn được cập nhật định kỳ mỗi 30 phút.
  - **Rotation Batches (5 phút)**: Các danh mục thứ cấp (Allflame Embers, Divination Cards, Essences, Runegrafts, Fossils, Oils, Catalysts, Tattoos, Omens, Incubators...) được chia thành các cặp tải luân phiên mỗi 5 phút một lần để tránh nghẽn mạng và tối ưu băng thông.

- 🔍 **Instant Search & Interactive Table**:
  - Tìm kiếm tức thì theo tên vật phẩm mà không cần tải lại trang.
  - Sắp xếp đa tiêu chí linh hoạt: Theo Tên (A-Z, Z-A), Giá Chaos / Divine / Exalt, Xu hướng 7 ngày (Sparkline), và Khối lượng giao dịch 24h.
  - Bộ lọc nhanh (All, < 10c, 10c - 100c, 1d - 5d, > 5d).

- 🧮 **Quick Quantity Calculator (Máy tính số lượng nhanh)**:
  - Click vào bất kỳ vật phẩm nào để mở bộ tính giá nhanh.
  - Các nút preset tiện lợi: `+1`, `+5`, `+10`, `+20`, `Full Stack` (nguyên stack tối đa), và `Reset`.
  - Hiển thị quy đổi tức thời sang cả Chaos Orb, Divine Orb và Exalted Orb.

- 📖 **In-Game Tooltip & Direct Wiki Links**:
  - Tooltip mô tả vật phẩm chuẩn phong cách in-game của Path of Exile.
  - Tích hợp link tra cứu trực tiếp sang **poewiki.net** cho từng vật phẩm.

- ⌨️ **Phím tắt nhanh (Keyboard Shortcuts)**:
  - `/` : Focus nhanh vào thanh tìm kiếm.
  - `Enter` : Mở nhanh modal tính giá cho kết quả đầu tiên.
  - `Esc` : Đóng modal tính giá.

---

## 🚀 Cài đặt & Chạy ứng dụng (Quick Start)

### 1. Yêu cầu hệ thống
- [Node.js](https://nodejs.org/) (phiên bản v16 trở lên)
- Git

### 2. Cài đặt các gói phụ thuộc
```bash
npm install
```

### 3. Chạy ứng dụng
- **Cách 1: Sử dụng file batch (Windows)**
  Chỉ cần click đúp vào file `start.bat`. File này sẽ tự động cài đặt dependencies nếu chưa có, khởi động server và mở trình duyệt tại `http://localhost:3000`.

- **Cách 2: Chạy bằng dòng lệnh**
  ```bash
  npm start
  ```
  Sau đó mở trình duyệt tại: [http://localhost:3000](http://localhost:3000)

---

## 📂 Cấu trúc dự án (Project Structure)

```
POE/
├── data/
│   └── cache/             # Thư mục lưu trữ file JSON cache cục bộ
├── public/
│   ├── css/
│   │   └── style.css      # Giao diện Dark Slate, PoE styled tooltips, responsive
│   ├── js/
│   │   ├── app.js         # Logic tìm kiếm, lọc, sort, pagination, calculator modal
│   │   └── itemParser.js  # Parser dữ liệu, tính toán quy đổi tỷ giá
│   └── index.html         # Giao diện chính của ứng dụng
├── services/
│   └── cacheManager.js    # Logic nạp API poe.ninja, priority sync & round-robin rotation
├── package.json
├── server.js              # Express web server & API proxy
├── start.bat              # Script 1-click khởi động cho Windows
└── README.md
```

---

## 🛠️ Công nghệ sử dụng (Tech Stack)

- **Backend**: Node.js, Express.js, Axios
- **Frontend**: Vanilla JavaScript (ES6+), Modern CSS3 (Dark Theme, Glassmorphism), Semantic HTML5
- **Icons**: FontAwesome 6, PoE Ninja Assets
- **Data Source**: [poe.ninja](https://poe.ninja) Faustus Currency Exchange API & [poewiki.net](https://poewiki.net)

---

## 📜 Giấy phép (License)
Dự án được phân phối dưới giấy phép [MIT License](LICENSE).
