"""
api/ocr.py
Vercel Python serverless function. Receives a base64 image, runs it through
a self-contained Tesseract binary (bundled under api/vendor/tesseract/,
built for Amazon Linux 2023 by bweigel/aws-lambda-tesseract-layer), and
returns both the raw OCR text and the parsed fields.

v2 changes (after accuracy regression report):
- REMOVED tessedit_char_whitelist. It excluded Vietnamese diacritics, which
  didn't just strip them — it forced Tesseract to mis-recognize the glyph
  as a wrong ASCII character instead ("Ngày" -> "Negay", "Số" -> "S6"),
  corrupting every label the parser matches against. This was the main
  cause of "thông tin lấy ra không đúng".
- REMOVED grayscale/contrast preprocessing. Tested against real sample
  receipts: it sometimes introduced new OCR noise rather than helping.
  Only oversized photos are now downscaled (to cap processing time);
  otherwise the original image is sent to Tesseract untouched.
- Parser: added value-shape-anchored extraction (cuts off trailing OCR
  garbage on the same line), a short fallback keyword list and a fuzzy
  (difflib) label matcher for cases where OCR drops/mangles part of a
  label, and an explicit exclusion so "Mã khách hàng" (customer CODE)
  never gets confused with "Khách hàng" (customer NAME).
"""

from http.server import BaseHTTPRequestHandler
import json
import os
import re
import subprocess
import tempfile
import base64
import unicodedata
import difflib
import gc
import logging
from PIL import Image

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
VENDOR_DIR = os.path.join(BASE_DIR, 'vendor', 'tesseract')
TESSERACT_BIN = os.path.join(VENDOR_DIR, 'bin', 'tesseract')
TESSERACT_LIB = os.path.join(VENDOR_DIR, 'lib')
TESSDATA_DIR = os.path.join(VENDOR_DIR, 'tesseract', 'share', 'tessdata')

MAX_UPLOAD_BYTES = 15 * 1024 * 1024
MAX_LONG_EDGE = 2600  # only downscale genuinely oversized phone photos

# ------------------------------------------------------------------
# OCR
# ------------------------------------------------------------------

def preprocess_image(image_path):
    """Only downscales oversized photos to cap processing time — no
    grayscale/contrast enhancement (tested to sometimes hurt more than help
    on real receipt photos at this resolution)."""
    try:
        img = Image.open(image_path)
        if max(img.size) <= MAX_LONG_EDGE:
            return image_path
        ratio = MAX_LONG_EDGE / max(img.size)
        new_size = (int(img.width * ratio), int(img.height * ratio))
        img = img.resize(new_size, Image.Resampling.LANCZOS)
        processed_path = image_path + '_proc.png'
        img.save(processed_path, 'PNG')
        del img
        gc.collect()
        return processed_path
    except Exception as e:
        logger.warning(f"Preprocess failed: {e}")
        return image_path


def run_tesseract(image_path):
    env = os.environ.copy()
    env['LD_LIBRARY_PATH'] = TESSERACT_LIB + ':' + env.get('LD_LIBRARY_PATH', '')
    env['TESSDATA_PREFIX'] = TESSDATA_DIR
    try:
        os.chmod(TESSERACT_BIN, 0o755)
    except OSError:
        pass

    out_base = image_path + '_out'
    result = subprocess.run(
        [TESSERACT_BIN, image_path, out_base, '-l', 'vie+eng', '--psm', '6'],
        capture_output=True, text=True, timeout=25, env=env,
    )
    if result.returncode != 0:
        raise RuntimeError(f'tesseract exited {result.returncode}: {result.stderr.strip()}')

    txt_path = out_base + '.txt'
    with open(txt_path, 'r', encoding='utf-8') as f:
        text = f.read()
    try:
        os.remove(txt_path)
    except OSError:
        pass
    return text


# ------------------------------------------------------------------
# Field parser
# ------------------------------------------------------------------

def strip_diacritics(s):
    if not s:
        return s
    s = s.replace('đ', 'd').replace('Đ', 'D')
    nfkd = unicodedata.normalize('NFD', s)
    return ''.join(c for c in nfkd if unicodedata.category(c) != 'Mn')


def norm_label(s):
    s = strip_diacritics(s).lower()
    return re.sub(r'[^a-z0-9]', '', s)


LABELS = [
    ('soHoaDon', ['sohoadon']),
    ('maTraCuu', ['matracuu']),
    ('soTien', ['sotien']),
    ('maSoThue', ['masothue', 'mst']),
    ('khachHang', ['khachhang', 'tendonvi']),
    ('diaChi', ['diachi']),
    ('ngay', ['ngay']),
]
MULTILINE_KEYS = {'khachHang', 'diaChi'}

DATE_RE = re.compile(r'(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})(?:\s+(\d{1,2}:\d{2}(?::\d{2})?))?')
URL_RE = re.compile(r'https?:\s?//[^\s"\'<>]+', re.IGNORECASE)
SEP_RE = re.compile(r'^[.\-_·•\s]{3,}$')

VALUE_SHAPE = {
    'soHoaDon': re.compile(r'\d{4,12}'),
    'maTraCuu': re.compile(r'[A-Za-z0-9]{7,16}'),
    'maSoThue': re.compile(r'\d{10}(?:\d{3})?'),
}

LABEL_FALLBACK = [
    ('soHoaDon', ['hoadon', 'sodon']),
    ('maTraCuu', ['tracuu']),
    ('maSoThue', ['sothue', 'mst']),
    ('soTien', ['tien']),
]

LABEL_FULL = {
    'soHoaDon': 'sohoadon', 'maTraCuu': 'matracuu', 'soTien': 'sotien',
    'maSoThue': 'masothue', 'khachHang': 'khachhang', 'diaChi': 'diachi', 'ngay': 'ngay',
}


def is_section_end(line_norm):
    return (
        line_norm.startswith('quykhachvuilong')
        or line_norm.startswith('hotline')
        or line_norm.startswith('hotro')
        or line_norm.startswith('vuilongquet')
    )


def find_label_key(label_norm):
    for key, patterns in LABELS:
        for p in patterns:
            if label_norm.startswith(p):
                return key
    return None


def find_label_key_fallback(label_norm):
    for key, fragments in LABEL_FALLBACK:
        for frag in fragments:
            if frag in label_norm:
                return key
    return None


def fuzzy_label_match(label_norm, threshold=0.68):
    if not label_norm or len(label_norm) > 16:
        return None
    best_key, best_score = None, 0.0
    for key, pat in LABEL_FULL.items():
        score = difflib.SequenceMatcher(None, label_norm, pat).ratio()
        if score > best_score:
            best_score, best_key = score, key
    return best_key if best_score >= threshold else None


def value_after_sep(line):
    m = re.search(r'[:;]', line)
    return line[m.end():].strip() if m else ''


def parse_amount(value_str):
    if not value_str:
        return '', None
    m = re.search(r'[\d][\d.,\s]*\d|\d', value_str)
    raw = m.group(0).strip() if m else value_str.strip()
    digits = re.sub(r'[^\d]', '', raw)
    number = int(digits) if digits else None
    return raw, number


def clean_trailing_noise(s):
    if not s:
        return s
    s = re.split(r'\s[|\\¥`~^]{1,}\s', s)[0]
    s = re.sub(r'\s{2,}', ' ', s)
    return s.strip(' .,-')


def extract_shaped_value(key, raw_val):
    pat = VALUE_SHAPE.get(key)
    if not pat:
        return raw_val
    m = pat.search(raw_val)
    val = m.group(0) if m else raw_val.strip()
    if key == 'maTraCuu':
        val = val.upper()
    return val


def parse_fields(raw_text):
    text = (raw_text or '').replace('\r', '')
    lines = [l.strip() for l in text.split('\n')]

    result = {
        'ngay': '', 'soHoaDon': '', 'maTraCuu': '', 'soTien': '',
        'soTienRaw': '', 'maSoThue': '', 'khachHang': '', 'diaChi': '', 'link': '',
    }
    current_multiline_key = None

    for line in lines:
        if not line:
            current_multiline_key = None
            continue
        line_norm = norm_label(line)
        if is_section_end(line_norm) or SEP_RE.match(line):
            current_multiline_key = None
            continue

        sep_m = re.search(r'[:;]', line)
        has_sep = sep_m is not None
        label_norm = norm_label(line[:sep_m.start()]) if has_sep else line_norm

        # "Mã khách hàng" (customer CODE) vs "Khách hàng" (customer NAME) —
        # textually close enough to fool the fuzzy matcher; exclude explicitly.
        if has_sep and len(label_norm) >= 10 and (
            'makhachhang' in label_norm
            or difflib.SequenceMatcher(None, label_norm, 'makhachhang').ratio() >= 0.72
        ):
            current_multiline_key = None
            continue

        key = find_label_key(label_norm)
        if not key and has_sep:
            key = find_label_key_fallback(label_norm)
        if not key and has_sep and not result['soHoaDon'] and label_norm.endswith('don') and len(label_norm) <= 10:
            key = 'soHoaDon'
        if not key and has_sep:
            fk = fuzzy_label_match(label_norm)
            if fk and not result.get(fk):
                key = fk

        if key:
            val = value_after_sep(line)
            if key == 'soTien':
                raw, number = parse_amount(val)
                result['soTienRaw'] = raw
                result['soTien'] = number if number is not None else ''
            elif key in VALUE_SHAPE:
                if not result[key]:
                    result[key] = extract_shaped_value(key, val)
            elif key in MULTILINE_KEYS:
                cleaned = clean_trailing_noise(val)
                result[key] = (result[key] + ' ' + cleaned).strip() if result[key] else cleaned
            elif not result[key]:
                result[key] = val
            current_multiline_key = key if key in MULTILINE_KEYS else None
            continue

        if current_multiline_key:
            cleaned = clean_trailing_noise(line)
            if cleaned:
                result[current_multiline_key] = (result[current_multiline_key] + ' ' + cleaned).strip()
            continue

        if not result['ngay']:
            dm = DATE_RE.search(line)
            if dm:
                result['ngay'] = f"{dm.group(1)} {dm.group(2)}" if dm.group(2) else dm.group(1)

    if not result['ngay']:
        dm = DATE_RE.search(text)
        if dm:
            result['ngay'] = f"{dm.group(1)} {dm.group(2)}" if dm.group(2) else dm.group(1)

    um = URL_RE.search(text)
    if um:
        link = re.sub(r'^(https?):\s+//', r'\1://', um.group(0))
        result['link'] = re.sub(r'[.,;:)\]]+$', '', link)

    return result


# ------------------------------------------------------------------
# Vercel handler
# ------------------------------------------------------------------

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
        processed_path = None
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
            if ',' in image_b64[:60]:
                image_b64 = image_b64.split(',', 1)[1]
            image_bytes = base64.b64decode(image_b64)

            with tempfile.NamedTemporaryFile(suffix='.png', delete=False, dir='/tmp') as tmp:
                tmp.write(image_bytes)
                tmp_path = tmp.name
            del image_bytes

            processed_path = preprocess_image(tmp_path)
            text = run_tesseract(processed_path)
            fields = parse_fields(text)
            self._send_json(200, {'text': text, 'fields': fields})
        except subprocess.TimeoutExpired:
            self._send_json(504, {'error': 'ocr_timeout'})
        except Exception as e:
            logger.error(f"OCR error: {e}")
            self._send_json(500, {'error': str(e)})
        finally:
            for p in {tmp_path, processed_path}:
                if p and os.path.exists(p):
                    try:
                        os.remove(p)
                    except OSError:
                        pass
            gc.collect()
