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
from PIL import Image, ImageOps, ImageEnhance, ImageFilter

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
VENDOR_DIR = os.path.join(BASE_DIR, 'vendor', 'tesseract')
TESSERACT_BIN = os.path.join(VENDOR_DIR, 'bin', 'tesseract')
TESSERACT_LIB = os.path.join(VENDOR_DIR, 'lib')
TESSDATA_DIR = os.path.join(VENDOR_DIR, 'tesseract', 'share', 'tessdata')

# bump this on every meaningful change so the deployed version can be
# confirmed at a glance (check the "version" field in the API response,
# e.g. via DevTools Network tab) instead of guessing which file is live
OCR_VERSION = '2026-08-22-v5-multi-pass-image-enhancement'

MAX_UPLOAD_BYTES = 15 * 1024 * 1024
MAX_LONG_EDGE = 2600  # only downscale genuinely oversized phone photos

# ------------------------------------------------------------------
# OCR
# ------------------------------------------------------------------

def preprocess_image(image_path):
    """Downscale only oversized photos.  OCR variants are created separately
    in run_tesseract so the original image remains available as a fallback."""
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


def _ocr_quality_score(text):
    """Prefer OCR output that contains invoice labels and useful values.

    Different layouts benefit from different Tesseract segmentation modes.
    Scoring lets us keep the complete text from the best pass instead of
    concatenating incompatible passes and duplicating fields.
    """
    normalized = strip_diacritics(text or '').lower()
    compact = re.sub(r'[^a-z0-9]', '', normalized)
    score = 0

    expected_labels = (
        ('sohoadon', 8),
        ('matracuu', 8),
        ('sotien', 7),
        ('masothue', 7),
        ('khachhang', 6),
        ('tendonvi', 6),
        ('diachi', 5),
        ('ngay', 5),
    )
    for label, points in expected_labels:
        if label in compact:
            score += points

    score += min(len(re.findall(r'\d{4,}', text or '')), 5)
    score += min(len((text or '').splitlines()), 40) / 40
    return score


def _build_ocr_variants(image_path):
    """Return (path, temporary) variants for difficult phone photographs."""
    variants = [(image_path, False)]
    enhanced_path = image_path + '_enhanced.png'

    try:
        img = Image.open(image_path)
        if img.mode not in ('RGB', 'L'):
            img = img.convert('RGB')

        # Upscaling helps small thermal-printer glyphs.  Keep the long edge
        # bounded because the request may contain a large phone photograph.
        long_edge = max(img.size)
        scale = 2.0 if long_edge < 2200 else 1.25
        size = (max(1, int(img.width * scale)), max(1, int(img.height * scale)))
        gray = ImageOps.grayscale(img.resize(size, Image.Resampling.LANCZOS))
        gray = ImageOps.autocontrast(gray, cutoff=1)
        gray = ImageEnhance.Contrast(gray).enhance(1.35)
        gray = ImageEnhance.Sharpness(gray).enhance(1.5)
        gray = gray.filter(ImageFilter.UnsharpMask(radius=1.2, percent=130, threshold=3))
        gray.save(enhanced_path, 'PNG', optimize=True)
        variants.append((enhanced_path, True))
        del img, gray
    except Exception as e:
        logger.warning(f'Enhanced OCR variant failed: {e}')

    return variants


def _run_tesseract_pass(image_path, psm, env):
    out_base = image_path + f'_out_{psm}'
    result = subprocess.run(
        [TESSERACT_BIN, image_path, out_base, '-l', 'vie+eng',
         '--oem', '1', '--psm', str(psm)],
        capture_output=True, text=True, timeout=25, env=env,
    )
    txt_path = out_base + '.txt'
    try:
        if result.returncode != 0:
            raise RuntimeError(
                f'tesseract exited {result.returncode}: {result.stderr.strip()}'
            )
        with open(txt_path, 'r', encoding='utf-8') as f:
            return f.read()
    finally:
        try:
            os.remove(txt_path)
        except OSError:
            pass


def run_tesseract(image_path):
    env = os.environ.copy()
    env['LD_LIBRARY_PATH'] = TESSERACT_LIB + ':' + env.get('LD_LIBRARY_PATH', '')
    env['TESSDATA_PREFIX'] = TESSDATA_DIR
    try:
        os.chmod(TESSERACT_BIN, 0o755)
    except OSError:
        pass

    variants = _build_ocr_variants(image_path)
    candidates = []
    first_error = None
    try:
        # PSM 6 suits structured receipts; PSM 11 suits full-page invoices
        # and layouts with larger gaps between text blocks.
        for variant_path, _ in variants:
            for psm in (6, 11):
                try:
                    text = _run_tesseract_pass(variant_path, psm, env)
                    candidates.append((_ocr_quality_score(text), text))
                except Exception as e:
                    first_error = first_error or e

        if not candidates:
            raise first_error or RuntimeError('Tesseract returned no OCR text')
        return max(candidates, key=lambda item: item[0])[1]
    finally:
        for variant_path, temporary in variants:
            if temporary:
                try:
                    os.remove(variant_path)
                except OSError:
                    pass


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
        'quykhachvuilong' in line_norm
        or 'hotline' in line_norm
        or 'hotro' in line_norm
        or 'vuilongquet' in line_norm
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
    # Prefer a properly-grouped number (groups of exactly 3 digits after
    # each separator) — this avoids merging an unrelated stray digit that
    # happens to sit right after the real amount separated by just a space
    # (e.g. "1925000 4" must NOT become 19250004).
    m = re.search(r'\d{1,3}(?:[.,\s]\d{3})+', value_str)
    if not m:
        m = re.search(r'\d+', value_str)  # fallback: plain contiguous digits only
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


def classify_line(line):
    """Independently classify a single line: which field label (if any) it
    declares, ignoring all other lines/fields."""
    if not line:
        return None
    line_norm = norm_label(line)
    sep_m = re.search(r'[:;]', line)
    has_sep = sep_m is not None
    label_norm = norm_label(line[:sep_m.start()]) if has_sep else line_norm
    value = line[sep_m.end():].strip() if has_sep else ''

    info = {
        'raw': line,
        'has_sep': has_sep,
        'label_norm': label_norm,
        'value': value,
        'key': None,
        'is_section_end': is_section_end(line_norm),
        'is_separator_line': bool(SEP_RE.match(line)),
    }

    if info['is_section_end'] or info['is_separator_line'] or not has_sep:
        return info

    # "Mã khách hàng" (customer CODE) vs "Khách hàng" (customer NAME) —
    # textually close enough to fool the fuzzy matcher; exclude explicitly.
    if len(label_norm) >= 10 and (
        'makhachhang' in label_norm
        or difflib.SequenceMatcher(None, label_norm, 'makhachhang').ratio() >= 0.72
    ):
        info['key'] = 'EXCLUDE'
        return info

    key = find_label_key(label_norm)
    if not key:
        key = find_label_key_fallback(label_norm)
    if not key and label_norm.endswith('don') and len(label_norm) <= 10:
        key = 'soHoaDon'
    if not key:
        key = fuzzy_label_match(label_norm)
    info['key'] = key
    return info


MAX_CONTINUATION_LINES = 3  # hard cap for khachHang/diaChi — a safety net so
                            # a missed stop-marker can never let a multi-line
                            # field run away and swallow unrelated content


def extract_single(line_table, key):
    """soHoaDon / maTraCuu / maSoThue: first line independently classified
    as this key, anywhere in the document."""
    for info in line_table:
        if info and info.get('key') == key:
            return extract_shaped_value(key, info['value'])
    return ''


def extract_amount(line_table):
    for info in line_table:
        if info and info.get('key') == 'soTien':
            return parse_amount(info['value'])
    return '', None


def extract_ngay(line_table, full_text):
    for info in line_table:
        if info and info.get('key') == 'ngay':
            dm = DATE_RE.search(info['value']) or DATE_RE.search(info['raw'])
            if dm:
                return f"{dm.group(1)} {dm.group(2)}" if dm.group(2) else dm.group(1)
    # fallback: any bare date pattern in the whole text, independent of labels
    dm = DATE_RE.search(full_text)
    if dm:
        return f"{dm.group(1)} {dm.group(2)}" if dm.group(2) else dm.group(1)
    return ''


def extract_multiline(line_table, key):
    """khachHang / diaChi: find the labeled start line, then append
    following lines only while none of them independently look like the
    start of a DIFFERENT known field, a section-end, or a separator —
    capped at MAX_CONTINUATION_LINES regardless, so a detection miss can
    never cause runaway absorption of unrelated content (e.g. footer/link)."""
    start = None
    for idx, info in enumerate(line_table):
        if info and info.get('key') == key:
            start = idx
            break
    if start is None:
        return ''

    parts = [clean_trailing_noise(line_table[start]['value'])]
    taken = 0
    idx = start + 1
    while idx < len(line_table) and taken < MAX_CONTINUATION_LINES:
        info = line_table[idx]
        if info is None:  # blank line ends the block
            break
        if info['is_section_end'] or info['is_separator_line']:
            break
        if info.get('key'):  # any other recognized field label -> stop
            break
        cleaned = clean_trailing_noise(info['raw'])
        if cleaned:
            parts.append(cleaned)
        taken += 1
        idx += 1

    return ' '.join(p for p in parts if p).strip()


def parse_fields(raw_text):
    text = (raw_text or '').replace('\r', '')
    lines = [l.strip() for l in text.split('\n')]

    # OCR already ran once, fully, upstream — `text` is the complete cached
    # result. Classify every line exactly once here; every field below then
    # reads only from this shared table, independently of one another, so
    # one field's misdetection can never cascade into another field.
    line_table = [classify_line(l) if l else None for l in lines]

    result = {
        'ngay': extract_ngay(line_table, text),
        'soHoaDon': extract_single(line_table, 'soHoaDon'),
        'maTraCuu': extract_single(line_table, 'maTraCuu'),
        'maSoThue': extract_single(line_table, 'maSoThue'),
        'khachHang': extract_multiline(line_table, 'khachHang'),
        'diaChi': extract_multiline(line_table, 'diaChi'),
        'soTienRaw': '',
        'soTien': '',
        'link': '',
    }

    raw_amount, number = extract_amount(line_table)
    result['soTienRaw'] = raw_amount
    result['soTien'] = number if number is not None else ''

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

    def do_GET(self):
        # quick way to confirm which version is actually deployed:
        # GET https://<domain>/api/ocr
        self._send_json(200, {'status': 'ok', 'version': OCR_VERSION})

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
            self._send_json(200, {'text': text, 'fields': fields, 'version': OCR_VERSION})
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