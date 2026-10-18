/* ============================================================================
 * Live2D "kanban" widget cho NotDore  —  assets/js/live2d-widget-loader.js
 * ----------------------------------------------------------------------------
 * NGUỒN MIỄN PHÍ & ĐIỀU KIỆN SỬ DỤNG:
 *
 *  1) Mã widget — "live2d-widget" của stevenjoezhang
 *     npm:       live2d-widgets@1.0.1
 *     repo:      https://github.com/stevenjoezhang/live2d-widget
 *     giấy phép: GPL-3.0 (áp dụng cho phần mã nguồn; KHÔNG bao gồm Live2D SDK)
 *
 *  2) Live2D Cubism 2.1 Core — live2d.min.js
 *     © Live2D Inc. — phát hành kèm Live2D SDK, được phép phân phối lại theo
 *     "Live2D Proprietary Software License Agreement".
 *     https://www.live2d.com/en/sdk/download/web/
 *
 *  3) Kho model — "live2d_api" của fghrsh
 *     repo: https://github.com/fghrsh/live2d_api
 *     Bản quyền từng nhân vật thuộc về tác giả gốc của nó. Kho model này chỉ
 *     dành cho mục đích HỌC TẬP / PHI THƯƠNG MẠI. Nếu dùng cho mục đích
 *     thương mại, bạn PHẢI tự xin phép chủ sở hữu của từng model.
 *
 *  4) CDN phân phối — jsDelivr  https://www.jsdelivr.com/
 *
 *  Ý tưởng ban đầu: https://www.fghrsh.net/post/123.html
 * ========================================================================== */

(function () {
  'use strict';

  var WIDGET_VERSION = '1.0.1';
  var CDN = 'https://fastly.jsdelivr.net/npm/live2d-widgets@' + WIDGET_VERSION + '/dist/';
  var MODEL_CDN = 'https://fastly.jsdelivr.net/gh/fghrsh/live2d_api/';
  var CUBISM2_PATH = CDN + 'live2d.min.js';
  var CUBISM5_PATH = 'https://cubism.live2d.com/sdk-web/cubismcore/live2dcubismcore.min.js';
  var MIN_WIDTH = 768;
  var CDN_HOST_RE = /^https?:\/\/(?:[^/]*\.)?(?:jsdelivr\.net|live2d\.com)\//i;

  /**
   * Ghi nguồn free vào footer (luôn hiển thị, kể cả trên màn hình nhỏ).
   */
  function addCredit() {
    var footer = document.querySelector('.anime-footer');
    if (!footer || footer.querySelector('.anime-footer-credit')) return;
    var p = document.createElement('p');
    p.className = 'anime-footer-credit';
    p.innerHTML =
      'Nhân vật Live2D: ' +
      '<a href="https://github.com/stevenjoezhang/live2d-widget" target="_blank" rel="noopener">live2d-widget</a> ' +
      '(GPL-3.0) · model © tác giả gốc, dùng phi thương mại.';
    footer.appendChild(p);
  }

  /**
   * Chỉ gắn crossOrigin="anonymous" cho ảnh texture của Live2D (tránh WebGL
   * từ chối texture khác origin) mà KHÔNG động tới ảnh khác của trang web —
   * an toàn hơn so với việc ghi đè window.Image toàn cục.
   */
  function patchImage() {
    var OriginalImage = window.Image;
    if (!OriginalImage || OriginalImage.__notdorePatched) return;
    function PatchedImage() {
      var img = new OriginalImage();
      try {
        Object.defineProperty(img, 'src', {
          configurable: true,
          get: function () { return this.getAttribute('src'); },
          set: function (value) {
            if (CDN_HOST_RE.test(value)) img.crossOrigin = 'anonymous';
            this.setAttribute('src', value);
          }
        });
      } catch (e) { /* bỏ qua */ }
      return img;
    }
    PatchedImage.prototype = OriginalImage.prototype;
    PatchedImage.__notdorePatched = true;
    window.Image = PatchedImage;
  }

  function loadResource(url, type) {
    return new Promise(function (resolve, reject) {
      var tag;
      if (type === 'css') {
        tag = document.createElement('link');
        tag.rel = 'stylesheet';
        tag.href = url;
      } else {
        tag = document.createElement('script');
        tag.type = 'module';
        tag.src = url;
      }
      tag.onload = function () { resolve(); };
      tag.onerror = function () { reject(new Error('Không tải được ' + url)); };
      document.head.appendChild(tag);
    });
  }

  function startWidget() {
    if (window.innerWidth < MIN_WIDTH) return;
    patchImage();
    Promise.all([
      loadResource(CDN + 'waifu.css', 'css'),
      loadResource(CDN + 'waifu-tips.js', 'js')
    ]).then(function () {
      if (typeof window.initWidget !== 'function') return;
      window.initWidget({
        waifuPath: CDN + 'waifu-tips.json',
        cdnPath: MODEL_CDN,
        cubism2Path: CUBISM2_PATH,
        cubism5Path: CUBISM5_PATH,
        tools: ['switch-model', 'switch-texture', 'photo', 'info', 'quit'],
        drag: true,
        showToggleAfterQuit: true,
        logLevel: 'error'
      });
    }).catch(function (err) {
      console.warn('[NotDore] Live2D widget:', err.message);
    });
  }

  function start() {
    addCredit();
    startWidget();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
