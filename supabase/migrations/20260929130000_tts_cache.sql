-- Kho lưu file giọng đọc Google Chirp 3 HD đã tạo (Edge Function "tts").
-- Bucket công khai để web phát file trực tiếp; chỉ Edge Function (service role)
-- được ghi, vì không có policy nào cho anon/authenticated trên storage.objects.
-- Tên file là mã băm của giọng + câu, nội dung chỉ là câu tiếng Anh để luyện nghe.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('tts-cache', 'tts-cache', true, 1048576, array['audio/mpeg'])
on conflict (id) do nothing;
