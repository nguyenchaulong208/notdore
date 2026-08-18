"""
api/ocr.py
Vercel Python serverless function với Tesseract OCR
Sử dụng Pillow thay vì OpenCV/NumPy để tránh lỗi build trên Python 3.12
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
from PIL import Image, ImageEnhance, ImageFilter, ImageOps

# Cấu hình logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
VENDOR_DIR = os.path.join(BASE_DIR, 'vendor', 'tesseract')
TESSERACT_BIN = os.path.join(VENDOR_DIR, 'bin', 'tesseract')
TESSERACT_LIB = os.path.join(VENDOR_DIR, 'lib')
TESSDATA_DIR = os.path.join(VENDOR_DIR, 'tesseract', 'share', 'tessdata')

MAX_UPLOAD_BYTES = 15 * 1024 * 1024

# ------------------------------------------------------------------
# Parser tối ưu cho hóa đơn Việt Nam
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
    """Chuẩn hóa label để so sánh"""
    if not s:
        return ''
    s = strip_diacritics(s).lower()
    # Xóa các ký tự đặc biệt
    s = re.sub(r'[^a-z0-9\s]', '', s)
    return ' '.join(s.split())

# Pattern matching mở rộng dựa trên mẫu thực tế
LABEL_PATTERNS = {
    'ngay': [
        'ngay', 'date', 'ngày', 'ngay thang', 'date time',
        'ngay gio', 'thoi gian'
    ],
    'soHoaDon': [
        'so hoa don', 'sohoadon', 'so hd', 'invoice no', 'invoice number',
        'số hoá đơn', 'số hóa đơn', 'hoa don so', 'hóa đơn số',
        'invoice', 'inv no', 'so don hang', 'so hoa don'
    ],
    'maTraCuu': [
        'ma tra cuu', 'matracuu', 'tra cuu', 'ma tc', 'reference code',
        'mã tra cứu', 'ma tracuu', 'reference', 'ref code'
    ],
    'soTien': [
        'so tien', 'sotien', 'tong tien', 'total', 'amount',
        'số tiền', 'tổng tiền', 'thanh toan', 'tong cong',
        'so tien vnd', 'total amount'
    ],
    'maSoThue': [
        'ma so thue', 'masothue', 'mst', 'tax code', 'tax number',
        'mã số thuế', 'ma khach hang', 'mst khach hang',
        'ma so thue khach hang', 'mã khách hàng'
    ],
    'khachHang': [
        'khach hang', 'khachhang', 'ten khach hang', 'customer',
        'khách hàng', 'tên khách hàng', 'don vi', 'ten don vi',
        'khach hang', 'customer name', 'company', 'ten cong ty'
    ],
    'diaChi': [
        'dia chi', 'diachi', 'address', 'địa chỉ',
        'dia chi khach hang', 'address'
    ],
    'link': [
        'link tra cuu', 'http', 'https', 'tracuu', 'tra cứu',
        'website', 'web', 'url'
    ]
}

# Các từ khóa đánh dấu kết thúc section
SECTION_END_KEYWORDS = [
    'quy khach vui long', 'vuilong', 'hotline', 'hotro',
    'cảm ơn', 'thank you', 'trân trọng', 'xin cảm ơn',
    'signed', 'sign', 'receipt', 'equipment'
]

def is_section_end(text):
    """Kiểm tra xem có phải là kết thúc section không"""
    if not text:
        return False
    text_lower = text.lower()
    for keyword in SECTION_END_KEYWORDS:
        if keyword in text_lower:
            return True
    return False

def extract_value_from_line(line, patterns):
    """Trích xuất giá trị từ dòng text"""
    if not line:
        return None
    
    line_lower = line.lower()
    
    # Thử tìm sau dấu :
    if ':' in line:
        parts = line.split(':', 1)
        label_part = parts[0].strip()
        value_part = parts[1].strip()
        
        if not value_part:
            return None
            
        # Kiểm tra xem label có khớp pattern không
        label_norm = norm_label(label_part)
        for pattern in patterns:
            if pattern in label_norm or label_norm in pattern:
                return value_part
    
    # Thử tìm sau các dấu phân cách khác
    for sep in ['-', '–', '—', '|']:
        if sep in line:
            parts = line.split(sep, 1)
            if len(parts) == 2:
                label_part = parts[0].strip()
                value_part = parts[1].strip()
                if value_part:
                    label_norm = norm_label(label_part)
                    for pattern in patterns:
                        if pattern in label_norm or label_norm in pattern:
                            return value_part
    
    return None

def parse_amount(value_str):
    """Parse số tiền từ string"""
    if not value_str:
        return None, None
    
    # Tìm số trong string
    numbers = re.findall(r'[\d,.\s]+', value_str)
    if not numbers:
        return None, None
    
    # Lấy số cuối cùng (thường là tổng)
    raw = numbers[-1].strip()
    
    # Xóa dấu phân cách
    cleaned = re.sub(r'[,.]', '', raw)
    cleaned = re.sub(r'\s', '', cleaned)
    
    try:
        number = int(cleaned)
        return raw, number
    except:
        return raw, None

def clean_url(url):
    """Làm sạch URL"""
    if not url:
        return None
    
    # Tìm URL trong string
    url_match = re.search(r'https?://[^\s"\'<>]+', url, re.IGNORECASE)
    if url_match:
        url = url_match.group(0)
        # Xóa dấu câu cuối
        url = re.sub(r'[.,;:)\]]+$', '', url)
        return url
    
    return None

def parse_invoice(text):
    """Parse hóa đơn từ text OCR"""
    if not text:
        return {}
    
    lines = [l.strip() for l in text.split('\n') if l.strip()]
    
    logger.info(f"Parsing {len(lines)} lines")
    
    result = {
        'ngay': '',
        'soHoaDon': '',
        'maTraCuu': '',
        'soTien': '',
        'soTienRaw': '',
        'maSoThue': '',
        'khachHang': '',
        'diaChi': '',
        'link': ''
    }
    
    # 1. Tìm ngày tháng - ưu tiên dòng đầu
    date_patterns = [
        r'(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})',
        r'(\d{1,2}:\d{2}(?::\d{2})?)',
        r'ngày\s*[:]?\s*(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})',
        r'date\s*[:]?\s*(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})'
    ]
    
    for line in lines[:10]:  # Chỉ kiểm tra 10 dòng đầu
        if not result['ngay']:
            for pattern in date_patterns:
                match = re.search(pattern, line, re.IGNORECASE)
                if match:
                    date_str = match.group(1)
                    # Kiểm tra xem có giờ không
                    time_match = re.search(r'(\d{1,2}:\d{2}(?::\d{2})?)', line)
                    if time_match:
                        date_str += f" {time_match.group(1)}"
                    result['ngay'] = date_str
                    logger.info(f"Found date: {result['ngay']}")
                    break
    
    # 2. Tìm các field đơn giản (số hóa đơn, mã tra cứu, mã số thuế)
    for key in ['soHoaDon', 'maTraCuu', 'maSoThue']:
        value = find_field_in_lines(lines, key)
        if value:
            result[key] = value
            logger.info(f"Found {key}: {value}")
    
    # 3. Tìm số tiền đặc biệt
    amount_value = find_field_in_lines(lines, 'soTien')
    if amount_value:
        raw, number = parse_amount(amount_value)
        if raw:
            result['soTienRaw'] = raw
            result['soTien'] = str(number) if number else raw
            logger.info(f"Found amount: {result['soTien']}")
    
    # 4. Tìm khách hàng và địa chỉ
    customer_lines = []
    address_lines = []
    found_customer = False
    found_address = False
    
    for line in lines:
        if is_section_end(line):
            break
            
        if not found_customer:
            value = extract_value_from_line(line, LABEL_PATTERNS['khachHang'])
            if value:
                customer_lines.append(value)
                found_customer = True
                continue
        
        if found_customer and not found_address:
            # Nếu đã tìm thấy khách hàng, các dòng tiếp theo có thể là địa chỉ
            # Kiểm tra xem có phải là địa chỉ không (chứa số nhà, đường, etc)
            line_lower = line.lower()
            if any(keyword in line_lower for keyword in ['đường', 'phường', 'quận', 'huyện', 'tỉnh', 'tp', 'kcn']):
                address_lines.append(line)
                found_address = True
            elif len(line) > 10 and not re.search(r'\d{1,2}[/-]\d{1,2}[/-]\d{2,4}', line):
                # Nếu là dòng văn bản dài và không chứa ngày tháng
                if not found_address:
                    address_lines.append(line)
    
    # Kết hợp khách hàng và địa chỉ
    if customer_lines:
        result['khachHang'] = ' '.join(customer_lines)
    
    if address_lines:
        result['diaChi'] = ' '.join(address_lines)
    
    # 5. Fallback: tìm khách hàng và địa chỉ từ dòng chứa keyword
    if not result['khachHang']:
        for line in lines:
            if any(kw in line.lower() for kw in ['ten don vi', 'ten khach hang', 'khach hang']):
                parts = line.split(':', 1)
                if len(parts) == 2:
                    result['khachHang'] = parts[1].strip()
                    break
    
    if not result['diaChi']:
        for line in lines:
            if any(kw in line.lower() for kw in ['dia chi', 'địa chỉ']):
                parts = line.split(':', 1)
                if len(parts) == 2:
                    result['diaChi'] = parts[1].strip()
                    break
    
    # 6. Tìm link
    for line in lines:
        url = clean_url(line)
        if url:
            result['link'] = url
            logger.info(f"Found link: {url}")
            break
    
    # Fallback: tìm link trong toàn bộ text
    if not result['link']:
        url = clean_url(text)
        if url:
            result['link'] = url
    
    # 7. Clean data
    for key in result:
        if isinstance(result[key], str):
            # Xóa khoảng trắng thừa
            result[key] = ' '.join(result[key].split())
            
            # Xóa các ký tự đặc biệt không cần thiết
            if key != 'link':
                result[key] = re.sub(r'^[:.\s-]+', '', result[key])
                result[key] = re.sub(r'[:.\s-]+$', '', result[key])
    
    logger.info(f"Final result: {json.dumps(result, ensure_ascii=False)}")
    return result

def find_field_in_lines(lines, field_key):
    """Tìm field trong danh sách dòng text"""
    patterns = LABEL_PATTERNS.get(field_key, [])
    
    for line in lines:
        if is_section_end(line):
            break
            
        # Thử extract value
        value = extract_value_from_line(line, patterns)
        if value:
            return value
        
        # Nếu không tìm thấy với pattern, thử kiểm tra chứa keyword
        line_norm = norm_label(line)
        for pattern in patterns:
            if pattern in line_norm:
                # Lấy phần sau keyword
                idx = line_norm.find(pattern)
                if idx != -1:
                    # Tìm vị trí tương ứng trong line gốc
                    remaining = line[idx + len(pattern):].strip()
                    if remaining:
                        # Nếu bắt đầu bằng dấu : hoặc khoảng trắng, lấy phần sau
                        if remaining.startswith(':') or remaining.startswith(' '):
                            remaining = remaining.lstrip(': ').strip()
                        # Lấy từ đầu tiên hoặc cả dòng nếu ngắn
                        words = remaining.split()
                        if words:
                            if len(words) == 1:
                                return words[0]
                            # Kiểm tra nếu là số hoặc mã
                            if re.match(r'^[A-Z0-9]+$', words[0], re.IGNORECASE):
                                return words[0]
                            return ' '.join(words[:3])  # Lấy 3 từ đầu
                break
    
    return None

# ------------------------------------------------------------------
# Tesseract OCR với tiền xử lý (chỉ dùng Pillow)
# ------------------------------------------------------------------

def preprocess_image(image_path):
    """Tiền xử lý ảnh để tăng độ chính xác OCR - chỉ dùng Pillow"""
    try:
        # Mở ảnh
        img = Image.open(image_path)
        
        # Chuyển sang grayscale
        if img.mode != 'L':
            img = img.convert('L')
        
        # Tăng độ tương phản
        enhancer = ImageEnhance.Contrast(img)
        img = enhancer.enhance(1.8)
        
        # Tăng độ sáng
        enhancer = ImageEnhance.Brightness(img)
        img = enhancer.enhance(1.2)
        
        # Tăng độ sắc nét
        enhancer = ImageEnhance.Sharpness(img)
        img = enhancer.enhance(2.5)
        
        # Làm sạch noise
        img = img.filter(ImageFilter.MedianFilter(size=3))
        
        # Áp dụng threshold để làm rõ chữ
        threshold = 180
        img = img.point(lambda p: p > threshold and 255)
        
        # Lưu ảnh đã xử lý
        processed_path = image_path.replace('.png', '_processed.png')
        img.save(processed_path, 'PNG', quality=100, optimize=True)
        logger.info(f"Preprocessed image: {processed_path}")
        
        return processed_path
        
    except Exception as e:
        logger.warning(f"Image preprocessing failed: {e}")
        return image_path

def run_tesseract(image_path):
    """Chạy Tesseract OCR với cấu hình tối ưu"""
    env = os.environ.copy()
    env['LD_LIBRARY_PATH'] = TESSERACT_LIB + ':' + env.get('LD_LIBRARY_PATH', '')
    env['TESSDATA_PREFIX'] = TESSDATA_DIR

    try:
        os.chmod(TESSERACT_BIN, 0o755)
    except OSError:
        pass

    # Thử nhiều PSM modes
    psm_modes = ['3', '4', '6']  # 3: auto, 4: single column, 6: block
    best_text = ""
    best_score = 0

    for psm in psm_modes:
        try:
            out_base = image_path + f'_out_{psm}'
            
            result = subprocess.run(
                [
                    TESSERACT_BIN, image_path, out_base,
                    '-l', 'vie+eng',
                    '--psm', psm,
                    '-c', 'tessedit_char_whitelist=0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz:./- ',
                    '-c', 'textord_min_linesize=2.5',
                ],
                capture_output=True, text=True, timeout=30, env=env,
            )
            
            if result.returncode == 0:
                txt_path = out_base + '.txt'
                if os.path.exists(txt_path):
                    with open(txt_path, 'r', encoding='utf-8') as f:
                        text = f.read()
                    
                    # Đánh giá chất lượng text
                    word_count = len(text.split())
                    digit_count = len(re.findall(r'\d', text))
                    score = word_count + digit_count * 2
                    
                    if score > best_score:
                        best_score = score
                        best_text = text
                    
                    try:
                        os.remove(txt_path)
                    except OSError:
                        pass
                        
            logger.info(f"PSM {psm} completed, score: {best_score}")
            
        except subprocess.TimeoutExpired:
            logger.warning(f"PSM {psm} timed out")
            continue
        except Exception as e:
            logger.warning(f"PSM {psm} failed: {e}")
            continue

    if not best_text:
        raise RuntimeError('Tesseract failed to produce output')

    logger.info(f"OCR result length: {len(best_text)} chars")
    return best_text

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
            
            try:
                image_bytes = base64.b64decode(image_b64)
            except Exception as e:
                self._send_json(400, {'error': f'invalid_base64: {str(e)}'})
                return
                
            logger.info(f"Received image: {len(image_bytes)} bytes")

            # Lưu ảnh
            with tempfile.NamedTemporaryFile(suffix='.png', delete=False, dir='/tmp') as tmp:
                tmp.write(image_bytes)
                tmp_path = tmp.name
            
            # Tiền xử lý
            processed_path = preprocess_image(tmp_path)
            
            # OCR
            text = run_tesseract(processed_path)
            logger.info(f"OCR completed: {len(text)} chars")
            
            # Parse
            fields = parse_invoice(text)
            
            self._send_json(200, {
                'text': text,
                'fields': fields
            })
            
        except subprocess.TimeoutExpired:
            logger.error("OCR timeout")
            self._send_json(504, {'error': 'ocr_timeout'})
        except Exception as e:
            logger.error(f"OCR error: {e}", exc_info=True)
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
