"""
api/ocr.py
Tối ưu memory cho Vercel Hobby plan (1024MB)
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
import gc
from PIL import Image, ImageEnhance, ImageFilter

# Cấu hình logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
VENDOR_DIR = os.path.join(BASE_DIR, 'vendor', 'tesseract')
TESSERACT_BIN = os.path.join(VENDOR_DIR, 'bin', 'tesseract')
TESSERACT_LIB = os.path.join(VENDOR_DIR, 'lib')
TESSDATA_DIR = os.path.join(VENDOR_DIR, 'tesseract', 'share', 'tessdata')

# Giới hạn memory-safe
MAX_UPLOAD_BYTES = 5 * 1024 * 1024  # Giảm xuống 5MB để an toàn
MAX_IMAGE_SIZE = 2000  # Giới hạn kích thước ảnh

# ------------------------------------------------------------------
# Parser - Giữ nguyên như cũ
# ------------------------------------------------------------------

def strip_diacritics(s):
    if not s:
        return s
    s = s.replace('đ', 'd').replace('Đ', 'D')
    try:
        nfkd = unicodedata.normalize('NFD', s)
        return ''.join(c for c in nfkd if unicodedata.category(c) != 'Mn')
    except:
        return s

def norm_label(s):
    if not s:
        return ''
    s = strip_diacritics(s).lower()
    s = re.sub(r'[^a-z0-9\s]', '', s)
    return ' '.join(s.split())

FIELD_PATTERNS = {
    'soHoaDon': [
        'so hoa don', 'sohoadon', 'số hóa đơn', 'số hoá đơn', 
        'invoice no', 'so hd', 'hd so'
    ],
    'maTraCuu': [
        'ma tra cuu', 'matracuu', 'mã tra cứu', 'tra cuu'
    ],
    'soTien': [
        'so tien', 'sotien', 'số tiền', 'tong tien', 'total'
    ],
    'maSoThue': [
        'ma so thue', 'masothue', 'mst', 'mã số thuế', 'tax code'
    ],
    'khachHang': [
        'khach hang', 'khachhang', 'khách hàng', 'ten don vi', 
        'ten khach hang', 'customer'
    ],
    'diaChi': [
        'dia chi', 'diachi', 'địa chỉ', 'address'
    ],
    'ngay': [
        'ngay', 'ngày', 'date', 'thoi gian'
    ],
    'link': [
        'http://', 'https://', 'tracuu', 'tra cứu'
    ]
}

STOP_KEYWORDS = [
    'quy khach vui long', 'hotline', 'cảm ơn', 'thank you',
    'signed', 'receipt', 'equipment'
]

def is_stop_line(line):
    if not line:
        return True
    line_lower = line.lower()
    for keyword in STOP_KEYWORDS:
        if keyword in line_lower:
            return True
    if re.match(r'^[.\-_·•\s]{3,}$', line):
        return True
    if len(line.strip()) < 3:
        return True
    return False

def extract_value(line, patterns):
    if not line:
        return None
    
    if ':' in line:
        parts = line.split(':', 1)
        label = parts[0].strip()
        value = parts[1].strip()
        if value:
            label_norm = norm_label(label)
            for pattern in patterns:
                if pattern in label_norm:
                    return value
    
    for sep in ['-', '–', '—']:
        if sep in line:
            parts = line.split(sep, 1)
            if len(parts) == 2:
                label = parts[0].strip()
                value = parts[1].strip()
                if value:
                    label_norm = norm_label(label)
                    for pattern in patterns:
                        if pattern in label_norm:
                            return value
    
    return None

def parse_amount(text):
    if not text:
        return ''
    
    matches = re.findall(r'[\d,.]+', text)
    if not matches:
        return text.strip()
    
    raw = matches[-1]
    
    if ',' in raw and '.' in raw:
        raw = raw.replace('.', '')
        raw = raw.replace(',', '.')
    elif ',' in raw:
        parts = raw.split(',')
        if len(parts) > 2:
            raw = ''.join(parts)
        elif len(parts) == 2:
            if len(parts[1]) == 3:
                raw = ''.join(parts)
    
    raw = re.sub(r'[,.]', '', raw)
    
    if raw.isdigit():
        return raw
    
    return text.strip()

def parse_invoice(text):
    if not text:
        return {}
    
    lines = [l.strip() for l in text.split('\n') if l.strip()]
    
    result = {
        'ngay': '',
        'soHoaDon': '',
        'maTraCuu': '',
        'soTien': '',
        'maSoThue': '',
        'khachHang': '',
        'diaChi': '',
        'link': ''
    }
    
    found_date = False
    is_customer = False
    is_address = False
    
    for i, line in enumerate(lines):
        if is_stop_line(line):
            break
        
        if not found_date and i < 5:
            date_match = re.search(r'(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})', line)
            if date_match:
                result['ngay'] = date_match.group(1)
                found_date = True
                continue
        
        if not result['soHoaDon']:
            value = extract_value(line, FIELD_PATTERNS['soHoaDon'])
            if value:
                num_match = re.search(r'\d+', value)
                if num_match:
                    result['soHoaDon'] = num_match.group()
                    continue
        
        if not result['maTraCuu']:
            value = extract_value(line, FIELD_PATTERNS['maTraCuu'])
            if value:
                code_match = re.search(r'[A-Z0-9]{5,}', value)
                if code_match:
                    result['maTraCuu'] = code_match.group()
                    continue
        
        if not result['soTien']:
            value = extract_value(line, FIELD_PATTERNS['soTien'])
            if value:
                result['soTien'] = parse_amount(value)
                continue
        
        if not result['maSoThue']:
            value = extract_value(line, FIELD_PATTERNS['maSoThue'])
            if value:
                tax_match = re.search(r'\b(\d{10}|\d{13})\b', value)
                if tax_match:
                    result['maSoThue'] = tax_match.group()
                    continue
        
        if not result['khachHang']:
            value = extract_value(line, FIELD_PATTERNS['khachHang'])
            if value:
                result['khachHang'] = value
                is_customer = True
                continue
        
        if not result['diaChi']:
            value = extract_value(line, FIELD_PATTERNS['diaChi'])
            if value:
                result['diaChi'] = value
                is_address = True
                continue
        
        if not result['link']:
            if 'http://' in line or 'https://' in line:
                url_match = re.search(r'https?://[^\s"\'<>]+', line)
                if url_match:
                    result['link'] = url_match.group()
                    continue
        
        if is_customer and not is_address and len(line) > 10:
            if not any(kw in line.lower() for kw in ['http', 'hotline', 'tel']):
                if not result['diaChi']:
                    result['diaChi'] = line
                    is_address = True
                elif len(result['diaChi']) < len(line):
                    result['diaChi'] = line
    
    if not result['link']:
        url_match = re.search(r'https?://[^\s"\'<>]+', text)
        if url_match:
            result['link'] = url_match.group()
    
    for key in result:
        if result[key]:
            result[key] = ' '.join(result[key].split())
    
    return result

# ------------------------------------------------------------------
# OCR - Tối ưu memory
# ------------------------------------------------------------------

def preprocess_image(image_path):
    """Tiền xử lý ảnh - tối ưu memory"""
    try:
        # Đọc ảnh với giới hạn kích thước
        img = Image.open(image_path)
        
        # Giảm kích thước nếu quá lớn (tiết kiệm memory)
        if img.width > MAX_IMAGE_SIZE or img.height > MAX_IMAGE_SIZE:
            ratio = min(MAX_IMAGE_SIZE / img.width, MAX_IMAGE_SIZE / img.height)
            new_size = (int(img.width * ratio), int(img.height * ratio))
            img = img.resize(new_size, Image.Resampling.LANCZOS)
        
        # Chuyển grayscale
        if img.mode != 'L':
            img = img.convert('L')
        
        # Tăng độ tương phản nhẹ
        enhancer = ImageEnhance.Contrast(img)
        img = enhancer.enhance(1.3)
        
        # Lưu với chất lượng thấp hơn để tiết kiệm memory
        processed_path = image_path.replace('.png', '_processed.png')
        img.save(processed_path, 'PNG', optimize=True, quality=80)
        
        # Giải phóng memory
        del img
        gc.collect()
        
        return processed_path
        
    except Exception as e:
        logger.warning(f"Preprocess failed: {e}")
        return image_path

def run_tesseract(image_path):
    """Chạy Tesseract - chỉ 1 PSM mode"""
    env = os.environ.copy()
    env['LD_LIBRARY_PATH'] = TESSERACT_LIB + ':' + env.get('LD_LIBRARY_PATH', '')
    env['TESSDATA_PREFIX'] = TESSDATA_DIR

    try:
        os.chmod(TESSERACT_BIN, 0o755)
    except OSError:
        pass

    out_base = image_path + '_out'
    
    # Chỉ chạy 1 PSM mode
    result = subprocess.run(
        [
            TESSERACT_BIN, image_path, out_base,
            '-l', 'vie+eng',
            '--psm', '6',
            '-c', 'tessedit_char_whitelist=0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz:./- ',
            '-c', 'textord_min_linesize=2.0',
        ],
        capture_output=True, text=True, timeout=20, env=env,
    )
    
    if result.returncode != 0:
        # Fallback
        result = subprocess.run(
            [TESSERACT_BIN, image_path, out_base, '-l', 'vie+eng', '--psm', '3'],
            capture_output=True, text=True, timeout=15, env=env,
        )
        if result.returncode != 0:
            raise RuntimeError(f'Tesseract failed: {result.stderr}')
    
    txt_path = out_base + '.txt'
    if not os.path.exists(txt_path):
        raise RuntimeError('Tesseract output not found')
    
    with open(txt_path, 'r', encoding='utf-8') as f:
        text = f.read()
    
    try:
        os.remove(txt_path)
    except OSError:
        pass
    
    return text

# ------------------------------------------------------------------
# Vercel Handler
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
            
            # Giới hạn kích thước upload
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
            logger.info(f"Image size: {len(image_bytes)} bytes")

            # Lưu ảnh
            with tempfile.NamedTemporaryFile(suffix='.png', delete=False, dir='/tmp') as tmp:
                tmp.write(image_bytes)
                tmp_path = tmp.name
            
            # Giải phóng memory
            del image_bytes
            gc.collect()
            
            # Tiền xử lý (tối ưu memory)
            processed_path = preprocess_image(tmp_path)
            
            # OCR
            text = run_tesseract(processed_path)
            
            # Parse
            fields = parse_invoice(text)
            
            self._send_json(200, {
                'text': text,
                'fields': fields
            })
            
        except subprocess.TimeoutExpired:
            self._send_json(504, {'error': 'ocr_timeout'})
        except MemoryError:
            logger.error("Memory limit exceeded")
            self._send_json(507, {'error': 'insufficient_memory'})
        except Exception as e:
            logger.error(f"Error: {e}")
            self._send_json(500, {'error': str(e)})
        finally:
            # Dọn dẹp file
            if tmp_path and os.path.exists(tmp_path):
                try:
                    os.remove(tmp_path)
                except OSError:
                    pass
            
            if processed_path and processed_path != tmp_path and os.path.exists(processed_path):
                try:
                    os.remove(processed_path)
                except OSError:
                    pass
            
            # Force garbage collection
            gc.collect()
