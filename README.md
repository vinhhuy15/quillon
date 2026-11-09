# SciForge

**Bộ công cụ mã nguồn mở cho toán học và hình vẽ khoa học** — dành cho người làm nghiên cứu, giáo viên và sinh viên.
*An open-source toolkit for math and scientific figures — for researchers, teachers and students.*

> v0.1 — Trình soạn công thức (Phase 0 + 1). Vẽ hình, xử lý figure và data viz nằm trong [roadmap](docs/ROADMAP.md).

## Tính năng v0.1

| | |
|---|---|
| **Soạn công thức WYSIWYG** | Gõ trực tiếp hoặc gõ LaTeX (`\frac`, `\alpha`…), 11 bảng ký hiệu (Hy Lạp, phép toán, quan hệ, mũi tên, cấu trúc, tổng/tích phân, ngoặc, ma trận, hàm, hóa học, ký hiệu khác) |
| **Mẫu công thức** | ~50 mẫu: đại số, lượng giác, giải tích, ĐSTT, xác suất, vật lý, hóa học — có tìm kiếm |
| **Thư viện cá nhân** | Lưu công thức hay dùng |
| **Canvas** | Nhiều công thức + văn bản trên một trang; chọn, kéo, chọn vùng, phóng to/thu nhỏ, di chuyển, z-order, nhân bản |
| **Undo / redo** | Không giới hạn trong phiên (gộp các thao tác kéo/gõ) |
| **Đánh số phương trình** | Tự động theo thứ tự đọc |
| **File `.sci`** | Định dạng mở (ZIP + JSON), tự lưu nháp & khôi phục |
| **Word** | *Sao chép cho Word* → dán thành **equation gốc của Word** (sửa được); xuất `.docx` |
| **Xuất** | PNG (96–1200 DPI, nền trong suốt), SVG vector, LaTeX `.tex`, HTML + MathML, sao chép LaTeX / MathML |
| **Sửa lại ảnh đã xuất** | PNG/SVG xuất ra có nhúng mã nguồn: kéo thả/dán lại vào SciForge là sửa tiếp được |
| **Song ngữ** | Tiếng Việt / English |

## Chạy thử

Yêu cầu: Node.js ≥ 20.

```bash
npm install
npm run dev        # mở http://localhost:1420
```

```bash
npm test           # unit tests (doc-model, math-core, nội dung palette)
npm run typecheck
npm run build      # bản web tĩnh trong apps/desktop/dist
```

### Bản desktop (Windows / macOS / Linux)

Cần thêm [Rust](https://rustup.rs) và các [yêu cầu hệ thống của Tauri](https://tauri.app/start/prerequisites/)
(trên Windows: *Microsoft C++ Build Tools* + WebView2 — Windows 11 đã có sẵn WebView2).

```bash
npm run tauri dev      # cửa sổ desktop, hot reload
npm run tauri build    # bộ cài .msi/.exe (Windows), .dmg (macOS), .deb/.AppImage (Linux)
```

## Cấu trúc

```
packages/doc-model   Mô hình tài liệu: schema, lệnh thuần, undo/redo, file .sci
packages/math-core   LaTeX → SVG/MathML (MathJax), MathML → OMML (Word), .docx, metadata PNG/SVG
apps/desktop         Ứng dụng React + MathLive; src-tauri/ là vỏ desktop Tauri 2
docs/                Kiến trúc, định dạng file, roadmap
```

Xem [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) và [docs/FILE_FORMAT.md](docs/FILE_FORMAT.md).

## Đóng góp

Xem [CONTRIBUTING.md](CONTRIBUTING.md). Mọi đóng góp — code, bộ ký hiệu, mẫu công thức, bản dịch — đều được chào đón.

## Giấy phép

[Apache-2.0](LICENSE). Thư viện bên thứ ba: MathJax (Apache-2.0), MathLive (MIT), fflate (MIT), React (MIT), Tauri (Apache-2.0/MIT).
