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


LABELS = [
    ('soHoaDon', ['sohoadon']),
    ('maTraCuu', ['matracuu']),
    ('soTien', ['sotien']),
    ('maSoThue', ['masothue', 'mst']),
    ('khachHang', ['khachhang', 'tendonvi']),
    ('diaChi', ['diachi']),
    ('ngay', ['ngay']),  # keep last: common substring
]
MULTILINE_KEYS = {'khachHang', 'diaChi'}

DATE_RE = re.compile(r'\b(\d{1,2}/\d{1,2}/\d{2,4})(?:\s+(\d{1,2}:\d{2}(?::\d{2})?))?\b')
URL_RE = re.compile(r'https?://[^\s"\'<>]+', re.IGNORECASE)
SEP_RE = re.compile(r'^[.\-_·•\s]{3,}$')


def is_section_end(line_norm):
    return (
        line_norm.startswith('quykhachvuilong')
        or line_norm.startswith('hotline')
        or line_norm.startswith('hotro')
        or line_norm.startswith('vuilongquet')
    )


def find_label_key(line_norm):
    for key, patterns in LABELS:
        for p in patterns:
            if line_norm.startswith(p):
                return key
    return None


def value_after_colon(line):
    idx = line.find(':')
    return line[idx + 1:].strip() if idx != -1 else ''


def parse_amount(value_str):
    if not value_str:
        return '', None
    m = re.search(r'[\d][\d.,\s]*\d|\d', value_str)
    raw = m.group(0).strip() if m else value_str.strip()
    digits = re.sub(r'[^\d]', '', raw)
    number = int(digits) if digits else None
    return raw, number


def clean_trailing_url_punct(url):
    return re.sub(r'[.,;:)\]]+$', '', url)


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

        key = find_label_key(line_norm)
        if key:
            val = value_after_colon(line)
            if key == 'soTien':
                raw, number = parse_amount(val)
                result['soTienRaw'] = raw
                result['soTien'] = number if number is not None else ''
            elif not result[key]:
                result[key] = val
            elif key in MULTILINE_KEYS:
                result[key] = (result[key] + ' ' + val).strip()
            current_multiline_key = key if key in MULTILINE_KEYS else None
            continue

        if current_multiline_key:
            result[current_multiline_key] = (result[current_multiline_key] + ' ' + line).strip()
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
        result['link'] = clean_trailing_url_punct(um.group(0))

    return result


# ------------------------------------------------------------------
# OCR
# ------------------------------------------------------------------

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
            if length > MAX_UPLOAD_BYTES * 2:  # base64 inflates ~33%, generous cap
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

            text = run_tesseract(tmp_path)
            fields = parse_fields(text)
            self._send_json(200, {'text': text, 'fields': fields})
        except subprocess.TimeoutExpired:
            self._send_json(504, {'error': 'ocr_timeout'})
        except Exception as e:  # noqa: BLE001 — surface any failure as JSON, not a raw 500 page
            self._send_json(500, {'error': str(e)})
        finally:
            if tmp_path and os.path.exists(tmp_path):
                try:
                    os.remove(tmp_path)
                except OSError:
                    pass
