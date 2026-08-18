"""
api/ocr.py
Vercel Python serverless function - Tối ưu tốc độ và độ chính xác
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
from PIL import Image, ImageEnhance, ImageFilter

# Cấu hình logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
VENDOR_DIR = os.path.join(BASE_DIR, 'vendor', 'tesseract')
TESSERACT_BIN = os.path.join(VENDOR_DIR, 'bin', 'tesseract')
TESSERACT_LIB = os.path.join(VENDOR_DIR, 'lib')
TESSDATA_DIR = os.path.join(VENDOR_DIR, 'tesseract', 'share', 'tessdata')

MAX_UPLOAD_BYTES = 10 * 1024 * 1024  # Giảm xuống 10MB để nhanh hơn

# ------------------------------------------------------------------
# Parser tối ưu - Chỉ parse các field cần thiết
# ------------------------------------------------------------------

def strip_diacritics(s):
    """Bỏ dấu tiếng Việt"""
    if not s:
        return s
    s = s.replace('đ', 'd').replace('Đ', 'D')
    try:
        nfkd = unicodedata.normalize('NFD', s)
        return ''.join(c for c in nfkd if unicodedata.category(c) != 'Mn')
    except:
        return s

def norm_label(s):
    """Chuẩn hóa label"""
    if not s:
        return ''
    s = strip_diacritics(s).lower()
    s = re.sub(r'[^a-z0-9\s]', '', s)
    return ' '.join(s.split())

# Pattern matching chính xác cho từng field
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

# Các từ khóa kết thúc - dừng parse
STOP_KEYWORDS = [
    'quy khach vui long', 'hotline', 'cảm ơn', 'thank you',
    'signed', 'receipt', 'equipment'
]

def is_stop_line(line):
    """Kiểm tra dòng cần dừng parse"""
    if not line:
        return True
    line_lower = line.lower()
    for keyword in STOP_KEYWORDS:
        if keyword in line_lower:
            return True
    # Dòng chỉ có ký tự đặc biệt
    if re.match(r'^[.\-_·•\s]{3,}$', line):
        return True
    # Dòng quá ngắn
    if len(line.strip()) < 3:
        return True
    return False

def extract_value(line, patterns):
    """Trích xuất giá trị từ dòng"""
    if not line:
        return None
    
    # Tìm sau dấu :
    if ':' in line:
        parts = line.split(':', 1)
        label = parts[0].strip()
        value = parts[1].strip()
        if value:
            label_norm = norm_label(label)
            for pattern in patterns:
                if pattern in label_norm:
                    return value
    
    # Tìm sau các dấu phân cách
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
    """Parse số tiền"""
    if not text:
        return ''
    
    # Tìm số với dấu phân cách
    matches = re.findall(r'[\d,.]+', text)
    if not matches:
        return text.strip()
    
    # Lấy số cuối cùng (thường là tổng)
    raw = matches[-1]
    
    # Nếu có cả dấu , và . thì đó là số tiền
    if ',' in raw and '.' in raw:
        # Xóa dấu . phân cách hàng nghìn
        raw = raw.replace('.', '')
        raw = raw.replace(',', '.')
    elif ',' in raw:
        # Kiểm tra nếu là số thập phân (ví dụ 1,925,000)
        parts = raw.split(',')
        if len(parts) > 2:
            raw = ''.join(parts)  # 1,925,000 -> 1925000
        elif len(parts) == 2:
            # Có thể là số thập phân (1,5) hoặc phân cách (1,000)
            if len(parts[1]) == 3:  # 1,000 -> phân cách
                raw = ''.join(parts)
    
    # Xóa tất cả dấu phân cách
    raw = re.sub(r'[,.]', '', raw)
    
    # Kiểm tra nếu là số hợp lệ
    if raw.isdigit():
        return raw
    
    return text.strip()

def parse_invoice(text):
    """Parse hóa đơn - tối ưu tốc độ"""
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
    
    # Biến tạm
    found_date = False
    customer_lines = []
    address_lines = []
    is_customer = False
    is_address = False
    
    for i, line in enumerate(lines):
        # Dừng parse nếu gặp dòng kết thúc
        if is_stop_line(line):
            break
        
        # 1. Tìm ngày tháng (ưu tiên dòng đầu)
        if not found_date and i < 5:
            # Tìm ngày theo format DD/MM/YYYY
            date_match = re.search(r'(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})', line)
            if date_match:
                result['ngay'] = date_match.group(1)
                found_date = True
                continue
        
        # 2. Tìm số hóa đơn
        if not result['soHoaDon']:
            value = extract_value(line, FIELD_PATTERNS['soHoaDon'])
            if value:
                # Lấy số đầu tiên
                num_match = re.search(r'\d+', value)
                if num_match:
                    result['soHoaDon'] = num_match.group()
                    continue
        
        # 3. Tìm mã tra cứu
        if not result['maTraCuu']:
            value = extract_value(line, FIELD_PATTERNS['maTraCuu'])
            if value:
                # Mã tra cứu thường là chữ hoa và số
                code_match = re.search(r'[A-Z0-9]{5,}', value)
                if code_match:
                    result['maTraCuu'] = code_match.group()
                    continue
        
        # 4. Tìm số tiền
        if not result['soTien']:
            value = extract_value(line, FIELD_PATTERNS['soTien'])
            if value:
                result['soTien'] = parse_amount(value)
                continue
        
        # 5. Tìm mã số thuế
        if not result['maSoThue']:
            value = extract_value(line, FIELD_PATTERNS['maSoThue'])
            if value:
                # Mã số thuế là 10 hoặc 13 số
                tax_match = re.search(r'\b(\d{10}|\d{13})\b', value)
                if tax_match:
                    result['maSoThue'] = tax_match.group()
                    continue
        
        # 6. Tìm khách hàng
        if not result['khachHang']:
            value = extract_value(line, FIELD_PATTERNS['khachHang'])
            if value:
                # Đánh dấu đã tìm thấy khách hàng
                result['khachHang'] = value
                is_customer = True
                continue
        
        # 7. Tìm địa chỉ
        if not result['diaChi']:
            value = extract_value(line, FIELD_PATTERNS['diaChi'])
            if value:
                result['diaChi'] = value
                is_address = True
                continue
        
        # 8. Tìm link
        if not result['link']:
            if 'http://' in line or 'https://' in line:
                url_match = re.search(r'https?://[^\s"\'<>]+', line)
                if url_match:
                    result['link'] = url_match.group()
                    continue
        
        # 9. Nếu đã tìm thấy khách hàng, gom các dòng tiếp theo vào địa chỉ
        if is_customer and not is_address and len(line) > 10:
            if not any(kw in line.lower() for kw in ['http', 'hotline', 'tel']):
                if not result['diaChi']:
                    result['diaChi'] = line
                    is_address = True
                elif len(result['diaChi']) < len(line):
                    result['diaChi'] = line
    
    # Fallback: tìm link trong toàn bộ text
    if not result['link']:
        url_match = re.search(r'https?://[^\s"\'<>]+', text)
        if url_match:
            result['link'] = url_match.group()
    
    # Clean data
    for key in result:
        if result[key]:
            result[key] = ' '.join(result[key].split())
    
    logger.info(f"Parsed: {json.dumps(result, ensure_ascii=False)}")
    return result

# ------------------------------------------------------------------
# Tesseract OCR - Chỉ chạy 1 PSM mode để nhanh hơn
# ------------------------------------------------------------------

def preprocess_image(image_path):
    """Tiền xử lý ảnh - nhanh và hiệu quả"""
    try:
        img = Image.open(image_path)
        
        # Chuyển grayscale
        if img.mode != 'L':
            img = img.convert('L')
        
        # Tăng độ tương phản
        enhancer = ImageEnhance.Contrast(img)
        img = enhancer.enhance(1.5)
        
        # Tăng độ sắc nét
        enhancer = ImageEnhance.Sharpness(img)
        img = enhancer.enhance(2.0)
        
        # Resize nếu quá lớn để tăng tốc
        max_size = 2500
        if img.width > max_size or img.height > max_size:
            ratio = min(max_size / img.width, max_size / img.height)
            new_size = (int(img.width * ratio), int(img.height * ratio))
            img = img.resize(new_size, Image.Resampling.LANCZOS)
        
        # Lưu
        processed_path = image_path.replace('.png', '_processed.png')
        img.save(processed_path, 'PNG', optimize=True, quality=85)
        return processed_path
        
    except Exception as e:
        logger.warning(f"Preprocess failed: {e}")
        return image_path

def run_tesseract(image_path):
    """Chạy Tesseract - chỉ 1 PSM mode để nhanh"""
    env = os.environ.copy()
    env['LD_LIBRARY_PATH'] = TESSERACT_LIB + ':' + env.get('LD_LIBRARY_PATH', '')
    env['TESSDATA_PREFIX'] = TESSDATA_DIR

    try:
        os.chmod(TESSERACT_BIN, 0o755)
    except OSError:
        pass

    # Chỉ chạy 1 PSM mode (6 - block) để nhanh
    out_base = image_path + '_out'
    
    result = subprocess.run(
        [
            TESSERACT_BIN, image_path, out_base,
            '-l', 'vie+eng',
            '--psm', '6',  # Sử dụng PSM 6 cho block text
            '-c', 'tessedit_char_whitelist=0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz:./- ',
            '-c', 'textord_min_linesize=2.0',
        ],
        capture_output=True, text=True, timeout=20, env=env,
    )
    
    if result.returncode != 0:
        # Fallback: thử PSM 3 (auto)
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
            logger.info(f"Image size: {len(image_bytes)} bytes")

            # Lưu ảnh
            with tempfile.NamedTemporaryFile(suffix='.png', delete=False, dir='/tmp') as tmp:
                tmp.write(image_bytes)
                tmp_path = tmp.name
            
            # Tiền xử lý
            processed_path = preprocess_image(tmp_path)
            
            # OCR
            text = run_tesseract(processed_path)
            logger.info(f"OCR result: {len(text)} chars")
            
            # Parse
            fields = parse_invoice(text)
            
            self._send_json(200, {
                'text': text,
                'fields': fields
            })
            
        except subprocess.TimeoutExpired:
            self._send_json(504, {'error': 'ocr_timeout'})
        except Exception as e:
            logger.error(f"Error: {e}")
            self._send_json(500, {'error': str(e)})
        finally:
            if tmp_path and os.path.exists(tmp_path):
                try:
                    os.remove(tmp_path)
                except OSError:
                    pass
            processed_path = tmp_path.replace('.png', '_processed.png') if tmp_path else None
            if processed_path and os.path.exists(processed_path):
                try:
                    os.remove(processed_path)
                except OSError:
                    pass
