-- Giao bài tập cho học viên và nhận xét bài viết.
-- Chạy trong Supabase → SQL Editor. Thay email bên dưới bằng email của học viên.

-- 1. Thêm một bộ bài tập
--    items: mảng các câu { id, type, prompt, options?, answer?, accept?, explain_vi }
--    type 'mcq'  : chọn một trong options, đúng khi bằng answer
--    type 'gap'  : prompt có chỗ trống ___, đúng khi khớp answer hoặc một giá trị trong accept
--    type 'fix'  : prompt là câu sai, học viên gõ lại câu đúng
--    type 'write': viết tự do, không chấm tự động
insert into public.homework_sets (user_id, title, tag, instructions_vi, due_on, items)
select
  id,
  'Unit 10: Thói quen hằng ngày',
  'Unit 10',
  'Làm cẩn thận, chú ý động từ với ngôi thứ ba số ít (he, she, it).',
  current_date + 3,
  $$[
    {
      "id": "q1",
      "type": "mcq",
      "prompt": "She ___ to school every day.",
      "options": ["go", "goes", "going", "gone"],
      "answer": "goes",
      "explain_vi": "Chủ ngữ she là ngôi thứ ba số ít, thì hiện tại đơn nên động từ thêm -es: goes."
    },
    {
      "id": "q2",
      "type": "gap",
      "prompt": "I usually ___ coffee in the morning.",
      "answer": "drink",
      "accept": ["have"],
      "explain_vi": "Nói về thói quen dùng thì hiện tại đơn; với I giữ nguyên động từ: drink (hoặc have)."
    },
    {
      "id": "q3",
      "type": "fix",
      "prompt": "He don't like tea.",
      "answer": "He doesn't like tea.",
      "accept": ["He does not like tea."],
      "explain_vi": "Phủ định với he/she/it dùng doesn't, không dùng don't."
    },
    {
      "id": "q4",
      "type": "write",
      "prompt": "Viết 3–4 câu tiếng Anh về buổi sáng của bạn (dùng thì hiện tại đơn).",
      "explain_vi": "Gợi ý: I get up at…, I have…, then I…"
    }
  ]$$::jsonb
from auth.users
where email = 'ban@example.com';

-- 2. Xem các bài viết đang chờ nhận xét
select a.id, s.title, a.item_id, a.answer, a.created_at
from public.homework_answers a
join public.homework_sets s on s.id = a.set_id
where a.is_correct is null and a.feedback_vi is null
order by a.created_at;

-- 3. Ghi nhận xét cho một bài viết (học viên sẽ thấy trong phần "Xem lại bài")
-- update public.homework_answers
-- set feedback_vi = 'Bài viết tốt! Lưu ý: "I get up" (không phải "I gets up").'
-- where id = '<id bài viết ở bước 2>';
