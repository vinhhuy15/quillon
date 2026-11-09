import { ui, useUi, type Lang } from './state/store';

/** [Tiếng Việt, English] */
const STRINGS = {
  untitled: ['Chưa đặt tên', 'Untitled'],
  new: ['Mới', 'New'],
  open: ['Mở…', 'Open…'],
  save: ['Lưu', 'Save'],
  saveAs: ['Lưu thành…', 'Save as…'],
  undo: ['Hoàn tác', 'Undo'],
  redo: ['Làm lại', 'Redo'],
  cut: ['Cắt', 'Cut'],
  copy: ['Sao chép', 'Copy'],
  paste: ['Dán', 'Paste'],
  delete: ['Xóa', 'Delete'],
  duplicate: ['Nhân bản', 'Duplicate'],
  selectAll: ['Chọn tất cả', 'Select all'],
  bringFront: ['Đưa lên trên cùng', 'Bring to front'],
  sendBack: ['Đưa xuống dưới cùng', 'Send to back'],
  newEquation: ['Công thức mới', 'New equation'],
  newText: ['Văn bản mới', 'New text'],
  zoomIn: ['Phóng to', 'Zoom in'],
  zoomOut: ['Thu nhỏ', 'Zoom out'],
  zoomReset: ['Về 100%', 'Reset to 100%'],
  zoomFit: ['Vừa màn hình', 'Fit to screen'],
  export: ['Xuất…', 'Export…'],
  copyForWord: ['Sao chép cho Word', 'Copy for Word'],
  copyLatex: ['Sao chép LaTeX', 'Copy LaTeX'],
  copyMathml: ['Sao chép MathML', 'Copy MathML'],
  copyImage: ['Sao chép ảnh PNG', 'Copy PNG image'],
  copySvg: ['Sao chép mã SVG', 'Copy SVG code'],
  copied: ['Đã sao chép', 'Copied'],
  copiedWord: ['Đã sao chép — dán vào Word sẽ thành equation có thể sửa', 'Copied — paste into Word as an editable equation'],
  clipboardFailed: ['Không truy cập được clipboard', 'Clipboard is not available'],
  nothingSelected: ['Hãy chọn một công thức trước', 'Select an equation first'],
  language: ['Ngôn ngữ', 'Language'],
  about: ['Giới thiệu', 'About'],
  // Editor
  editorPlaceholder: ['Gõ công thức hoặc LaTeX (vd. \\frac, \\alpha)… bấm vào bảng ký hiệu để chèn', 'Type math or LaTeX (e.g. \\frac, \\alpha)… or click a symbol to insert'],
  editing: ['Đang sửa', 'Editing'],
  newMode: ['Công thức mới (gõ để tạo)', 'New equation (start typing)'],
  source: ['Mã LaTeX', 'LaTeX source'],
  fontSize: ['Cỡ chữ', 'Size'],
  color: ['Màu', 'Color'],
  displayStyle: ['Hiển thị lớn', 'Display style'],
  numbered: ['Đánh số', 'Numbered'],
  saveToLibrary: ['Lưu vào thư viện', 'Save to library'],
  latexError: ['Lỗi LaTeX', 'LaTeX error'],
  done: ['Xong', 'Done'],
  // Panels
  templates: ['Mẫu công thức', 'Templates'],
  myLibrary: ['Thư viện của tôi', 'My library'],
  libraryEmpty: ['Chưa có gì. Chọn một công thức rồi bấm “Lưu vào thư viện”.', 'Empty. Select an equation and click “Save to library”.'],
  savedToLibrary: ['Đã lưu vào thư viện', 'Saved to library'],
  remove: ['Xóa', 'Remove'],
  search: ['Tìm…', 'Search…'],
  // Export dialog
  exportTitle: ['Xuất file', 'Export'],
  scope: ['Phạm vi', 'Scope'],
  scopeSelection: ['Đối tượng đang chọn', 'Selection'],
  scopeAll: ['Toàn bộ tài liệu', 'Whole document'],
  format: ['Định dạng', 'Format'],
  resolution: ['Độ phân giải', 'Resolution'],
  background: ['Nền', 'Background'],
  transparent: ['Trong suốt', 'Transparent'],
  white: ['Trắng', 'White'],
  cancel: ['Hủy', 'Cancel'],
  exportBtn: ['Xuất', 'Export'],
  exported: ['Đã xuất', 'Exported'],
  fmtPng: ['Ảnh PNG (có nhúng mã nguồn để sửa lại)', 'PNG image (with editable source)'],
  fmtSvg: ['Ảnh vector SVG (có nhúng mã nguồn)', 'SVG vector (with editable source)'],
  fmtDocx: ['Word .docx (equation gốc của Word)', 'Word .docx (native equations)'],
  fmtTex: ['LaTeX .tex', 'LaTeX .tex'],
  fmtHtml: ['Trang web HTML + MathML', 'HTML page with MathML'],
  emptyDoc: ['Tài liệu đang trống', 'The document is empty'],
  // File ops
  unsavedConfirm: ['Tài liệu có thay đổi chưa lưu. Bỏ qua các thay đổi?', 'You have unsaved changes. Discard them?'],
  openFailed: ['Không mở được file', 'Could not open file'],
  saved: ['Đã lưu', 'Saved'],
  restored: ['Đã khôi phục bản làm việc trước', 'Restored your previous session'],
  importedEquation: ['Đã nhập công thức có thể chỉnh sửa', 'Imported an editable equation'],
  imageNoSource: ['Ảnh này không chứa mã nguồn SciForge', 'This image has no SciForge source'],
  // Status
  objects: ['đối tượng', 'objects'],
  selected: ['đang chọn', 'selected'],
  unsaved: ['chưa lưu', 'unsaved'],
  hintCanvas: ['Nháy đúp vào vùng trống để thêm công thức · Ctrl+cuộn để phóng to · Space+kéo để di chuyển', 'Double-click empty space to add an equation · Ctrl+wheel to zoom · Space+drag to pan'],
  aboutText: [
    'SciForge v0.1 — bộ công cụ mã nguồn mở cho toán học và hình vẽ khoa học. Giấy phép Apache-2.0.',
    'SciForge v0.1 — an open-source toolkit for math and scientific figures. Apache-2.0 licensed.',
  ],
  shortcuts: ['Phím tắt', 'Keyboard shortcuts'],
  close: ['Đóng', 'Close'],
} satisfies Record<string, [string, string]>;

export type StringKey = keyof typeof STRINGS;

export function t(key: StringKey, lang: Lang = ui.get().lang): string {
  return STRINGS[key][lang === 'vi' ? 0 : 1];
}

export function useT(): (key: StringKey) => string {
  const lang = useUi((s) => s.lang);
  return (key) => t(key, lang);
}

export function setLang(lang: Lang) {
  ui.set({ lang });
  try {
    localStorage.setItem('sciforge:lang', lang);
  } catch {
    /* ignore */
  }
}
