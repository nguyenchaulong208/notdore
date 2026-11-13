-- =====================================================================
-- Đếm số người đang trực tuyến theo thời gian thực (NotDore)
--
-- Cách hoạt động:
--   1. Mỗi trình duyệt tạo 1 session_id (lưu trong localStorage) và gọi
--      hàm public.online_heartbeat(session_id, page) mỗi 15 giây.
--   2. Hàm này ghi/cập nhật dòng của phiên đó, dọn các phiên không còn
--      heartbeat sau 60 giây, trả về số phiên đang trực tuyến.
--   3. Website hiển thị con số đó ở badge trên header.
--
-- Hàm là SECURITY DEFINER nên anon KHÔNG cần quyền INSERT/DELETE trực
-- tiếp vào bảng — chỉ cần quyền EXECUTE, hạn chế được việc spam bảng.
--
-- Chạy file này 1 lần trong Supabase (SQL Editor hoặc admin dashboard).
-- An toàn khi chạy lại nhiều lần (IF NOT EXISTS / OR REPLACE).
-- =====================================================================

-- 1. Bảng lưu phiên trực tuyến
CREATE TABLE IF NOT EXISTS public.online_visitors (
  session_id text PRIMARY KEY,
  page       text,
  last_seen  timestamptz NOT NULL DEFAULT now()
);

-- Không cho anon đọc/thao tác trực tiếp — mọi thứ đi qua hàm online_heartbeat
ALTER TABLE public.online_visitors ENABLE ROW LEVEL SECURITY;

-- Index để dọn phiên cũ nhanh
CREATE INDEX IF NOT EXISTS online_visitors_last_seen_idx
  ON public.online_visitors (last_seen);

-- 2. Hàm heartbeat: upsert phiên + dọn phiên hết hạn + trả về số online
CREATE OR REPLACE FUNCTION public.online_heartbeat(p_session text, p_page text DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count integer;
BEGIN
  -- Cập nhật nếu phiên đã có, chèn mới nếu chưa (tránh ON CONFLICT)
  UPDATE public.online_visitors
     SET page = p_page,
         last_seen = now()
   WHERE session_id = p_session;

  IF NOT FOUND THEN
    INSERT INTO public.online_visitors (session_id, page, last_seen)
    VALUES (p_session, p_page, now());
  END IF;

  -- Dọn phiên không cập nhật trong 60 giây
  DELETE FROM public.online_visitors
   WHERE last_seen < now() - interval '60 seconds';

  SELECT count(*) INTO v_count FROM public.online_visitors;

  RETURN v_count;
END;
$$;

-- 3. Quyền: chỉ cho phép gọi hàm, không cho anon đụng vào bảng
REVOKE ALL ON FUNCTION public.online_heartbeat(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.online_heartbeat(text, text) TO anon, authenticated;

-- (Không cần GRANT trên bảng: hàm SECURITY DEFINER đi bằng quyền chủ sở hữu)
