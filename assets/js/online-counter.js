/* online-counter.js — đếm số người đang trực tuyến theo thời gian thực.
 *
 * Cách hoạt động:
 *   - Mỗi trình duyệt sinh 1 session_id (lưu ở localStorage) và gọi hàm
 *     Supabase `online_heartbeat(session_id, page)` mỗi 15 giây.
 *   - Hàm trả về số phiên đang trực tuyến (phiên không heartbeat trong hơn
 *     60 giây được dọn tự động).
 *   - Kết quả hiển thị ở badge #online-badge trên header.
 *
 * Yêu cầu: đã nạp supabase-js + config.js, và đã chạy
 *          db/create_online_visitors.sql trên Supabase.
 */
(function () {
  'use strict';

  var INTERVAL_MS = 15000;      // chu kỳ heartbeat
  var SID_KEY = 'notdore_online_sid';
  var RPC_NAME = 'online_heartbeat';

  function getSessionId() {
    var sid = null;
    try { sid = localStorage.getItem(SID_KEY); } catch (e) { /* bị chặn */ }
    if (sid) return sid;

    sid = (window.crypto && typeof crypto.randomUUID === 'function')
      ? crypto.randomUUID()
      : 'sid-' + Date.now() + '-' + Math.random().toString(36).slice(2, 10);

    try { localStorage.setItem(SID_KEY, sid); } catch (e) { /* bị chặn */ }
    return sid;
  }

  function badge() { return document.getElementById('online-badge'); }

  function render(count) {
    var el = badge();
    if (!el) return;
    el.innerHTML =
      '<span class="nd-online-dot" aria-hidden="true"></span>' +
      '<span class="nd-online-label">Đang trực tuyến</span>' +
      '<span class="nd-online-sep" aria-hidden="true">·</span>' +
      '<span class="nd-online-num">' + count + '</span>' +
      '<span class="nd-online-unit">người</span>';
    el.classList.add('is-live');
    el.setAttribute('aria-label', count + ' người đang trực tuyến');
  }

  function getClient() {
    var cfg = window.NOTDORE_CONFIG || {};
    if (!cfg.supabaseUrl || !cfg.supabaseAnonKey || !window.supabase) return null;
    return window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey);
  }

  function tick() {
    var client = getClient();
    if (!client) return;

    var sid = getSessionId();
    client
      .rpc(RPC_NAME, { p_session: sid, p_page: location.pathname })
      .then(function (res) {
        if (res.error) {
          console.info('[online-counter]', res.error.message || res.error);
          return;
        }
        render(typeof res.data === 'number' ? res.data : 0);
      })
      .catch(function (err) {
        console.info('[online-counter]', (err && err.message) || err);
      });
  }

  function start() {
    tick();
    setInterval(tick, INTERVAL_MS);

    // Cập nhật lại ngay khi người dùng quay lại tab đang mở
    document.addEventListener('visibilitychange', function () {
      if (!document.hidden) tick();
    });
  }

  function boot() {
    var ready = window.NOTDORE_CONFIG_READY;
    if (ready && typeof ready.then === 'function') {
      ready.then(start, start);
    } else {
      start();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
