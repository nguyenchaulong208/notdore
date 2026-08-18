"""
api/ocr.py
Vercel Python serverless function. Receives a base64 image, runs it through
a self-contained Tesseract binary (bundled under api/vendor/tesseract/,
built for Amazon Linux 2023 by bweigel/aws-lambda-tesseract-layer), and
returns both the raw OCR text and the parsed fields.

No external Python dependencies required (stdlib only) — tesseract's
bundled leptonica handles PNG/JPEG decoding natively.
"""

from http.server import BaseHTTPRequestHandler
import json
import os
import re
import subprocess
import tempfile
import base64
import unicodedata
import logging
from io import BytesIO

# Cấu hình logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
VENDOR_DIR = os.path.join(BASE_DIR, 'vendor', 'tesseract')
TESSERACT_BIN = os.path.join(VENDOR_DIR, 'bin', 'tesseract')
TESSERACT_LIB = os.path.join(VENDOR_DIR, 'lib')
TESSDATA_DIR = os.path.join(VENDOR_DIR, 'tesseract', 'share', 'tessdata')

MAX_UPLOAD_BYTES = 15 * 1024 * 1024  # 15MB safety cap per image

# ------------------------------------------------------------------
# Field parser — mirrors js/invoice-ocr-parser.js field-for-field.
# Keep both in sync if label patterns change.
# ------------------------------------------------------------------

def strip_diacritics(s):
    s = s.replace('đ', 'd').replace('Đ', 'D')
    nfkd = unicodedata.normalize('NFD', s)
    return ''.join(c for c in nfkd if unicodedata.category(c) != 'Mn')

def norm_label(s):
    s = strip_diacritics(s).lower()
    return re.sub(r'[^a-z0-9]', '', s)

# Mở rộng các pattern để nhận diện tốt hơn
LABELS = [
    ('soHoaDon', [
        'sohoadon', 'so hoa don', 'so hd', 'invoice no', 'invoice number',
        'số hóa đơn', 'hóa đơn số', 'hd số', 'invoice'
    ]),
    ('maTraCuu', [
        'matracuu', 'ma tra cuu', 'tra cuu', 'ma tc', 'reference code',
        'mã tra cứu', 'tra cứu'
    ]),
    ('soTien', [
        'sotien', 'so tien', 'tong tien', 'total', 'amount', 
        'số tiền', 'tổng tiền', 'thanh toán'
    ]),
    ('maSoThue', [
        'masothue', 'ma so thue', 'mst', 'tax code', 'tax number',
        'mã số thuế', 'thuế'
    ]),
    ('khachHang', [
        'khachhang', 'ten khach hang', 'customer', 'ten don vi',
        'khách hàng', 'tên khách hàng', 'đơn vị'
    ]),
    ('diaChi', [
        'diachi', 'dia chi', 'address', 'địa chỉ'
    ]),
    ('ngay', [
        'ngay', 'date', 'ngay thang', 'ngày', 'tháng'
    ]),
]

MULTILINE_KEYS = {'khachHang', 'diaChi'}

# Cải thiện regex
DATE_RE = re.compile(r'\b(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})(?:\s+(\d{1,2}:\d{2}(?::\d{2})?))?\b')
DATE_RE_ALT = re.compile(r'\b(ngày|date)[\s:]+(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})', re.IGNORECASE)
URL_RE = re.compile(r'https?://[^\s"\'<>]+', re.IGNORECASE)
SEP_RE = re.compile(r'^[.\-_·•\s]{3,}$')
AMOUNT_RE = re.compile(r'[\d][\d.,\s]*\d|[\d]+')

# Thêm các pattern mới
SECTION_END_PATTERNS = [
    'quykhachvuilong', 'hotline', 'hotro', 'vuilongquet',
    'cảm ơn', 'thank you', 'trân trọng'
]

def is_section_end(line_norm):
    return any(line_norm.startswith(p) for p in SECTION_END_PATTERNS)

def find_label_key(line_norm):
    # Tìm kiếm pattern trong line
    for key, patterns in LABELS:
        for p in patterns:
            normalized_p = p.replace(' ', '')
            # Kiểm tra nhiều cách
            if (line_norm.startswith(p) or 
                line_norm.startswith(normalized_p) or
                p in line_norm or
                normalized_p in line_norm):
                return key
    return None

def value_after_colon(line):
    idx = line.find(':')
    if idx != -1:
        return line[idx + 1:].strip()
    # Thử tìm sau khoảng trắng
    for sep in ['-', '–', '—']:
        if sep in line:
            parts = line.split(sep, 1)
            if len(parts) > 1 and len(parts[1].strip()) > 0:
                return parts[1].strip()
    return ''

def parse_amount(value_str):
    if not value_str:
        return '', None
    # Tìm tất cả số
    matches = AMOUNT_RE.findall(value_str)
    if not matches:
        return value_str.strip(), None
    
    # Lấy số cuối cùng (thường là tổng)
    raw = matches[-1].strip()
    # Xóa dấu phân cách hàng nghìn
    digits = re.sub(r'[^\d]', '', raw)
    number = int(digits) if digits else None
    return raw, number

def clean_trailing_url_punct(url):
    return re.sub(r'[.,;:)\]]+$', '', url)

def parse_fields(raw_text):
    text = (raw_text or '').replace('\r', '')
    lines = [l.strip() for l in text.split('\n') if l.strip()]
    
    logger.debug(f"Parsing {len(lines)} lines of text")
    logger.debug(f"Text preview: {text[:500]}")

    result = {
        'ngay': '', 'soHoaDon': '', 'maTraCuu': '', 'soTien': '',
        'soTienRaw': '', 'maSoThue': '', 'khachHang': '', 'diaChi': '', 'link': '',
    }
    
    current_multiline_key = None
    found_dates = []
    
    for i, line in enumerate(lines):
        logger.debug(f"Processing line {i}: {line[:50]}")
        
        line_norm = norm_label(line)

        if is_section_end(line_norm) or SEP_RE.match(line):
            current_multiline_key = None
            continue

        # Kiểm tra URL
        url_match = URL_RE.search(line)
        if url_match and not result['link']:
            result['link'] = clean_trailing_url_punct(url_match.group(0))

        # Tìm key trong line
        key = find_label_key(line_norm)
        
        if key:
            val = value_after_colon(line)
            logger.debug(f"Found key: {key} with value: {val[:30]}")
            
            if key == 'soTien':
                raw, number = parse_amount(val)
                if raw:
                    result['soTienRaw'] = raw
                    result['soTien'] = number if number is not None else ''
            else:
                # Chỉ cập nhật nếu chưa có hoặc multiline
                if not result[key] or key in MULTILINE_KEYS:
                    if val:
                        if result[key] and key in MULTILINE_KEYS:
                            result[key] = (result[key] + ' ' + val).strip()
                        else:
                            result[key] = val
            current_multiline_key = key if key in MULTILINE_KEYS else None
            continue

        # Xử lý multiline
        if current_multiline_key and line:
            result[current_multiline_key] = (result[current_multiline_key] + ' ' + line).strip()
            continue

        # Tìm ngày tháng trong line
        if not result['ngay']:
            date_match = DATE_RE.search(line)
            if date_match:
                date_str = f"{date_match.group(1)} {date_match.group(2)}" if date_match.group(2) else date_match.group(1)
                found_dates.append(date_str)
            
            # Tìm ngày tháng với prefix
            date_match_alt = DATE_RE_ALT.search(line)
            if date_match_alt:
                found_dates.append(date_match_alt.group(2))

        # Tìm các thông tin khác trong line không có label
        # Thử tìm số tiền
        if not result['soTien']:
            amount_match = AMOUNT_RE.search(line)
            if amount_match:
                # Kiểm tra nếu là số tiền (có dấu phân cách)
                amount_str = amount_match.group()
                if ',' in amount_str or '.' in amount_str or len(amount_str) > 4:
                    raw, number = parse_amount(amount_str)
                    if raw and number and number > 1000:
                        result['soTienRaw'] = raw
                        result['soTien'] = number

    # Fallback cho ngày tháng
    if not result['ngay'] and found_dates:
        result['ngay'] = found_dates[0]
    elif not result['ngay']:
        # Tìm ngày trong toàn bộ text
        date_match = DATE_RE.search(text)
        if date_match:
            result['ngay'] = f"{date_match.group(1)} {date_match.group(2)}" if date_match.group(2) else date_match.group(1)

    # Fallback cho URL nếu chưa tìm thấy
    if not result['link']:
        url_match = URL_RE.search(text)
        if url_match:
            result['link'] = clean_trailing_url_punct(url_match.group(0))

    logger.debug(f"Parsed result: {json.dumps(result, ensure_ascii=False)}")
    return result

# ------------------------------------------------------------------
# OCR
# ------------------------------------------------------------------

def preprocess_image(image_path):
    """Tiền xử lý ảnh để tăng độ chính xác OCR"""
    try:
        from PIL import Image
        import cv2
        import numpy as np
        
        # Đọc ảnh
        img = cv2.imread(image_path)
        if img is None:
            logger.warning(f"Cannot read image: {image_path}")
            return image_path
        
        # Chuyển sang grayscale
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        
        # Tăng độ tương phản
        gray = cv2.equalizeHist(gray)
        
        # Áp dụng adaptive threshold
        thresh = cv2.adaptiveThreshold(
            gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, 
            cv2.THRESH_BINARY, 11, 2
        )
        
        # Denoise
        denoised = cv2.fastNlMeansDenoising(thresh)
        
        # Lưu ảnh đã xử lý
        processed_path = image_path.replace('.png', '_processed.png')
        cv2.imwrite(processed_path, denoised)
        logger.debug(f"Preprocessed image saved: {processed_path}")
        return processed_path
        
    except Exception as e:
        logger.warning(f"Image preprocessing failed: {e}")
        return image_path

def run_tesseract(image_path):
    """Run Tesseract OCR với nhiều PSM modes và chọn kết quả tốt nhất"""
    env = os.environ.copy()
    env['LD_LIBRARY_PATH'] = TESSERACT_LIB + ':' + env.get('LD_LIBRARY_PATH', '')
    env['TESSDATA_PREFIX'] = TESSDATA_DIR

    try:
        os.chmod(TESSERACT_BIN, 0o755)
    except OSError:
        pass

    # Thử các PSM modes khác nhau
    psm_modes = ['3', '4', '6', '7']  # 3: auto, 4: single column, 6: block, 7: single line
    best_text = ""
    best_score = 0
    best_path = None

    for psm in psm_modes:
        try:
            out_base = image_path + f'_out_{psm}'
            
            # Thử với các cấu hình khác nhau
            result = subprocess.run(
                [
                    TESSERACT_BIN, image_path, out_base,
                    '-l', 'vie+eng',
                    '--psm', psm,
                    '-c', 'tessedit_char_whitelist=0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz:./- ',
                    '-c', 'textord_min_linesize=2.5',
                    '-c', 'tessedit_pageseg_mode=' + psm,
                ],
                capture_output=True, text=True, timeout=30, env=env,
            )
            
            if result.returncode == 0:
                txt_path = out_base + '.txt'
                if os.path.exists(txt_path):
                    with open(txt_path, 'r', encoding='utf-8') as f:
                        text = f.read()
                    
                    # Đánh giá chất lượng text
                    score = len(text.split()) + len(re.findall(r'\d', text)) * 2
                    if score > best_score:
                        best_score = score
                        best_text = text
                        best_path = txt_path
                    
                    # Xóa file tạm
                    try:
                        os.remove(txt_path)
                    except OSError:
                        pass
                        
            logger.debug(f"PSM {psm} completed with score {score if result.returncode == 0 else 'error'}")
            
        except subprocess.TimeoutExpired:
            logger.warning(f"PSM {psm} timed out")
            continue
        except Exception as e:
            logger.warning(f"PSM {psm} failed: {e}")
            continue

    # Nếu không có kết quả, thử với PSM mặc định
    if not best_text:
        logger.warning("All PSM modes failed, trying default")
        out_base = image_path + '_out_default'
        result = subprocess.run(
            [TESSERACT_BIN, image_path, out_base, '-l', 'vie+eng', '--psm', '6'],
            capture_output=True, text=True, timeout=25, env=env,
        )
        if result.returncode == 0:
            txt_path = out_base + '.txt'
            if os.path.exists(txt_path):
                with open(txt_path, 'r', encoding='utf-8') as f:
                    best_text = f.read()
                try:
                    os.remove(txt_path)
                except OSError:
                    pass

    if not best_text:
        raise RuntimeError('Tesseract failed to produce output')

    return best_text

class handler(BaseHTTPRequestHandler):
    def _send_json(self, code, obj):
        body = json.dumps(obj, ensure_ascii=False).encode('utf-8')
        self.send_response(code)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

    def do_POST(self):
        tmp_path = None
        try:
            length = int(self.headers.get('Content-Length', 0))
            if length <= 0:
                self._send_json(400, {'error': 'empty_body'})
                return
            if length > MAX_UPLOAD_BYTES * 2:
                self._send_json(413, {'error': 'payload_too_large'})
                return

            raw = self.rfile.read(length)
            payload = json.loads(raw)
            image_b64 = payload.get('image', '')
            if not image_b64:
                self._send_json(400, {'error': 'missing_image'})
                return
            
            # Xóa data URL prefix nếu có
            if ',' in image_b64[:60]:
                image_b64 = image_b64.split(',', 1)[1]
            
            image_bytes = base64.b64decode(image_b64)
            logger.debug(f"Received image size: {len(image_bytes)} bytes")

            # Lưu ảnh tạm
            with tempfile.NamedTemporaryFile(suffix='.png', delete=False, dir='/tmp') as tmp:
                tmp.write(image_bytes)
                tmp_path = tmp.name
            
            # Tiền xử lý ảnh
            processed_path = preprocess_image(tmp_path)
            
            # OCR
            text = run_tesseract(processed_path)
            logger.debug(f"OCR result length: {len(text)} characters")
            logger.debug(f"OCR preview: {text[:200]}")

            # Parse fields
            fields = parse_fields(text)
            
            self._send_json(200, {'text': text, 'fields': fields})
            
        except subprocess.TimeoutExpired:
            logger.error("OCR timeout")
            self._send_json(504, {'error': 'ocr_timeout'})
        except Exception as e:
            logger.error(f"OCR error: {e}", exc_info=True)
            self._send_json(500, {'error': str(e)})
        finally:
            # Dọn dẹp file tạm
            if tmp_path and os.path.exists(tmp_path):
                try:
                    os.remove(tmp_path)
                except OSError:
                    pass
            # Xóa file processed nếu tồn tại
            processed_path = tmp_path.replace('.png', '_processed.png') if tmp_path else None
            if processed_path and os.path.exists(processed_path):
                try:
                    os.remove(processed_path)
                except OSError:
                    pass
