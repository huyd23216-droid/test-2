# Tiếng Anh Mỗi Ngày

Web app học tiếng Anh cá nhân: mỗi ngày tối thiểu 10 phút, hướng tới **IELTS 6.5** và **nghe hiểu người bản xứ nói tự nhiên**.

**Từ vựng**
- Thẻ lật, xếp lịch ôn bằng thuật toán **FSRS**, chấm 4 mức Quên / Khó / Được / Dễ.
- Bộ 300 từ thông dụng nhất, cùng **9 bộ từ IELTS theo chủ đề** (gồm Academic Word List) để bạn tự bật.
- Tự thêm, sửa, xóa thẻ. Nhập nhiều từ một lúc, app **tự tra** phiên âm và nghĩa.

**Luyện nghe**
- Nối âm, nuốt âm: 6 hiện tượng, 40 câu mẫu.
- Chép chính tả: 60 câu ở 3 mức độ.
- Nghe điền từ còn thiếu.
- Phân biệt âm dễ nhầm (can/can't, thirteen/thirty, -ed, -s…).
- **Clip YouTube thật**, phát ngay trong app và tự lặp đoạn.
- Từ nào nghe sai khi chép chính tả thì bấm một nút là thành thẻ ôn tập.

**Học đều mỗi ngày**
- Nút "Học tối thiểu 10 phút" tự ghép một buổi học.
- Chuỗi ngày học, mỗi tuần được nghỉ 2 ngày.
- Trang **Tiến độ** có biểu đồ.
- Nhắc học nhẹ nhàng, mặc định tắt: thêm vào Lịch hoặc nhận thông báo đẩy.

**Dùng mọi nơi**
- Đồng bộ giữa MacBook và điện thoại qua Supabase.
- **Học được cả khi mất mạng**, có mạng lại thì tự đồng bộ.
- Giọng đọc Mỹ, Anh hoặc xen kẽ.
- Chế độ tối. Cài được ra màn hình chính như một app.

Công nghệ: React + Vite, Supabase (Postgres, Auth magic link, Edge Functions), Web Speech API, Service Worker, deploy trên Vercel.

---

## Mục lục

1. [Tạo project Supabase và chạy migration](#1-tạo-project-supabase-và-chạy-migration)
2. [Cấu hình biến môi trường](#2-cấu-hình-biến-môi-trường)
3. [Chạy trên máy (local)](#3-chạy-trên-máy-local)
4. [Deploy lên Vercel](#4-deploy-lên-vercel)
5. [Nhắc học (tùy chọn)](#5-nhắc-học-tùy-chọn)
6. [Thêm dữ liệu vào các file JSON](#6-thêm-dữ-liệu-vào-các-file-json)
7. [App hoạt động thế nào](#7-app-hoạt-động-thế-nào)
8. [Cấu trúc thư mục](#8-cấu-trúc-thư-mục)

---

## 1. Tạo project Supabase và chạy migration

### 1.1. Tạo project

1. Vào <https://supabase.com>, đăng nhập và bấm **New project**.
2. Đặt tên (ví dụ `tieng-anh`), đặt mật khẩu database (lưu lại) và chọn region gần Việt Nam (ví dụ **Southeast Asia (Singapore)**).
3. Đợi khoảng 1–2 phút để project khởi tạo xong.

### 1.2. Chạy migration (tạo bảng + Row Level Security)

Có **2 file migration**, chạy **theo đúng thứ tự**:

1. [`supabase/migrations/20260928000000_init.sql`](supabase/migrations/20260928000000_init.sql): các bảng chính.
2. [`supabase/migrations/20260929000000_extensions.sql`](supabase/migrations/20260929000000_extensions.sql): FSRS, cài đặt mới, luyện nghe, thông báo.

**Cách 1: dùng SQL Editor (dễ nhất)**

1. Trong dashboard, mở **SQL Editor** → **New query**.
2. Mở file migration thứ nhất, sao chép **toàn bộ** nội dung, dán vào rồi bấm **Run**. Thấy `Success. No rows returned` là xong.
3. Tạo query mới, làm tương tự với file thứ hai.
4. Kiểm tra ở **Table Editor**: sẽ có 8 bảng, bảng nào cũng có nhãn RLS đang bật:
   `user_settings`, `cards`, `connected_speech_progress`, `listening_progress`, `clips`, `dictation_history`, `study_sessions`, `push_subscriptions`.

**Cách 2: dùng Supabase CLI**

```bash
npm install -g supabase         # hoặc: brew install supabase/tap/supabase
supabase login
supabase link --project-ref <mã-project>   # mã nằm trong URL dashboard
supabase db push                           # chạy mọi migration còn thiếu, đúng thứ tự
```

> - Mỗi migration chỉ chạy **một lần**. Chạy lại sẽ báo lỗi "already exists".
> - **Đã dùng bản cũ (chỉ có migration 1)?** Chỉ cần chạy thêm file thứ hai, dữ liệu cũ được giữ nguyên. Nếu quên chạy, app sẽ hiện màn hình nhắc bạn.

### 1.3. Cấu hình đăng nhập bằng email (magic link)

Mở **Authentication** trong dashboard:

1. **URL Configuration**:
   - **Site URL**: địa chỉ app sau khi deploy, ví dụ `https://tieng-anh.vercel.app`. Tạm thời để `http://localhost:5173` cũng được.
   - **Redirect URLs**: thêm cả hai dòng
     - `http://localhost:5173/**`
     - `https://tieng-anh.vercel.app/**` (thay bằng tên miền Vercel thật của bạn)
2. **Sign In / Providers → Email**: đảm bảo **Email** đang bật (mặc định là bật).
3. **(Nên làm) Thêm mã số vào email đăng nhập**: vào **Emails → Templates → Magic Link**, thêm dòng sau vào nội dung email:

   ```html
   <p>Hoặc nhập mã: <strong>{{ .Token }}</strong></p>
   ```

   Nhờ mã này bạn đăng nhập được kể cả khi link bị mở ở trình duyệt khác. Hay gặp nhất là khi bạn đã thêm app ra **màn hình chính iPhone**: bấm link trong Mail sẽ mở Safari chứ không mở app đã cài, lúc đó chỉ cần gõ mã vào ô "Mã trong email".
4. **(Nên làm, sau khi bạn đăng nhập lần đầu)** Ở **Sign In / Providers**, tắt **Allow new users to sign up** để người lạ không tự tạo tài khoản được. Dữ liệu vốn đã được RLS tách riêng theo từng người, bước này chỉ để app hoàn toàn là của riêng bạn.

> **Giới hạn gửi email**: máy chủ email mặc định của Supabase chỉ gửi được vài email mỗi giờ. Mỗi thiết bị chỉ cần đăng nhập một lần (phiên được giữ lâu dài) nên thường là đủ. Nếu thấy báo "gửi hơi nhiều lần", hãy đợi ít phút. Muốn gửi nhiều hơn thì cấu hình SMTP riêng trong **Authentication → Emails → SMTP Settings**.

---

## 2. Cấu hình biến môi trường

Lấy 2 giá trị bắt buộc ở **Project Settings → API Keys** (hoặc nút **Connect** ở đầu dashboard):

| Biến | Bắt buộc | Giá trị |
|---|---|---|
| `VITE_SUPABASE_URL` | ✔ | Project URL, dạng `https://xxxxxxxx.supabase.co` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | ✔ | **Publishable key**, dạng `sb_publishable_...` |
| `VITE_VAPID_PUBLIC_KEY` | | Chỉ cần nếu dùng thông báo đẩy nhắc học (xem [mục 5](#5-nhắc-học-tùy-chọn)) |

Tạo file `.env.local` ở thư mục gốc (đã có mẫu trong `.env.example`):

```bash
cp .env.example .env.local
# rồi mở .env.local và điền các giá trị
```

> - Publishable key được thiết kế để nằm trong code chạy trên trình duyệt. An toàn là nhờ RLS: mỗi user chỉ đọc/ghi được dữ liệu của chính mình.
> - **Tuyệt đối không** dùng *secret key* (`sb_secret_...`) hay *service_role key* trong app này.
> - Project cũ chỉ có *anon key* (`eyJ...`) cũng được: đặt vào biến `VITE_SUPABASE_ANON_KEY`.
> - `.env.local` đã nằm trong `.gitignore`, sẽ không bị đẩy lên GitHub.

---

## 3. Chạy trên máy (local)

Cần **Node.js 20.19+** (hoặc 22+).

```bash
npm install
npm run dev
```

Mở <http://localhost:5173>, nhập email và bấm link trong email. Lần đầu đăng nhập, app tự nạp bộ 300 thẻ từ vựng vào tài khoản.

| Lệnh | Công dụng |
|---|---|
| `npm test` | Chạy unit test (FSRS, chấm câu, streak, điền từ, nhắc học…) **và kiểm tra các file JSON dữ liệu** |
| `npm run lint` | Kiểm tra lỗi code |
| `npm run build` | Build bản production vào thư mục `dist/` |
| `npm run preview` | Chạy thử bản build (có service worker để thử chế độ offline) |

**Thử trên điện thoại cùng Wi-Fi:** chạy `npm run dev -- --host`, mở địa chỉ `http://192.168.x.x:5173` mà Vite in ra, và thêm `http://192.168.x.x:5173/**` vào Redirect URLs của Supabase.

> Chế độ offline và thông báo đẩy chỉ hoạt động ở bản build (`npm run build && npm run preview`, hoặc bản trên Vercel), không chạy ở `npm run dev`.

---

## 4. Deploy lên Vercel

1. Đẩy code lên GitHub (repo này).
2. Vào <https://vercel.com> → **Add New… → Project** → chọn repo.
3. Vercel tự nhận ra **Vite**, giữ nguyên các thiết lập mặc định (Build Command `npm run build`, Output Directory `dist`).
4. Mở mục **Environment Variables**, thêm `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` (và `VITE_VAPID_PUBLIC_KEY` nếu dùng thông báo).
5. Bấm **Deploy**. Xong sẽ có địa chỉ dạng `https://ten-app.vercel.app`.
6. Quay lại Supabase → **Authentication → URL Configuration**: đặt **Site URL** là địa chỉ Vercel và thêm `https://ten-app.vercel.app/**` vào **Redirect URLs**.

Lưu ý:

- `vercel.json` đã cấu hình để các đường dẫn như `/vocab`, `/listen` không bị lỗi 404 khi tải lại trang, và để service worker luôn được cập nhật.
- Biến môi trường được "đóng gói" vào lúc build. **Sửa biến trên Vercel xong phải Redeploy** thì mới có hiệu lực.
- Từ đó mỗi lần push lên nhánh chính, Vercel tự deploy lại. App đang mở sẽ dùng bản mới ở lần mở tiếp theo.

**Cài lên màn hình chính điện thoại** (dùng như app, mở được cả khi offline):

- iPhone (Safari): nút **Chia sẻ** → **Thêm vào MH chính**. App đã cài có bộ nhớ riêng, nên bạn cần đăng nhập lại bên trong app bằng **mã trong email** (xem mục 1.3).
- Android (Chrome): menu ⋮ → **Thêm vào màn hình chính**.

---

## 5. Nhắc học (tùy chọn)

Mặc định **tắt**. App chỉ nhắc tối đa 1 lần/ngày vào giờ bạn chọn, **không nhắc nếu hôm đó bạn đã học**, và lời nhắc luôn nhẹ nhàng. Có 2 cách:

### Cách 1: thêm vào Lịch (dễ, không cần cài đặt gì)

**Cài đặt → Nhắc học nhẹ nhàng**: chọn giờ, bấm **Thêm lời nhắc vào Lịch**. App tải về một file `.ics` (sự kiện lặp lại mỗi ngày, có báo thức). Mở file trên Mac/iPhone là thêm được vào ứng dụng Lịch, hoặc nhập vào Google Calendar. Cách này nhắc cả những hôm bạn đã học.

### Cách 2: thông báo đẩy (thông minh hơn, cần cài đặt một lần)

Thông báo được gửi từ Supabase Edge Function [`supabase/functions/send-reminders`](supabase/functions/send-reminders/index.ts), chạy mỗi 15 phút.

1. **Tạo cặp khóa VAPID** (trên máy của bạn):

   ```bash
   npx web-push generate-vapid-keys
   ```

2. **Đặt public key cho app**: thêm `VITE_VAPID_PUBLIC_KEY=<public key>` vào `.env.local` và vào Environment Variables trên Vercel, rồi Redeploy.
3. **Đặt secrets cho Edge Function** (`CRON_SECRET` là một chuỗi ngẫu nhiên do bạn tự nghĩ):

   ```bash
   supabase secrets set VAPID_PUBLIC_KEY=<public key> VAPID_PRIVATE_KEY=<private key> \
     VAPID_SUBJECT=mailto:email-cua-ban@example.com CRON_SECRET=<chuỗi-ngẫu-nhiên-dài>
   ```

4. **Deploy function** (cờ `--no-verify-jwt` vì function tự kiểm tra `CRON_SECRET`):

   ```bash
   supabase functions deploy send-reminders --no-verify-jwt
   ```

5. **Lên lịch chạy mỗi 15 phút**: mở [`supabase/snippets/schedule-reminders.sql`](supabase/snippets/schedule-reminders.sql), thay `<MÃ-PROJECT>` và `<CRON_SECRET>`, rồi chạy trong SQL Editor. File này tự bật 2 extension `pg_cron` và `pg_net`.
6. Trong app: **Cài đặt → Bật thông báo trên thiết bị này** trên từng thiết bị muốn nhận.
   - **iPhone**: chỉ nhận được khi app đã được thêm ra màn hình chính (iOS 16.4 trở lên) và bật thông báo từ trong app đó.
   - **Mac**: Safari hoặc Chrome đều được.

> Edge Function dùng sẵn các biến `SUPABASE_URL` và khóa bí mật mà Supabase tự cấp cho function, bạn không cần đặt thêm.

---

## 6. Thêm dữ liệu vào các file JSON

Nội dung học nằm trong `src/data/`. Quy tắc chung:

- Mỗi mục có **`id` duy nhất**. **Không đổi `id`** của mục đã có, vì tiến độ học được gắn với `id`.
- Sửa xong chạy **`npm test`**. Test báo chính xác mục nào thiếu trường, trùng `id` hay sai nhóm.
- Sau đó commit và push, Vercel tự deploy lại.
- JSON sai cú pháp (thiếu dấu phẩy, thừa dấu phẩy cuối…) thì `npm run build` sẽ báo lỗi. Dùng VS Code sẽ thấy lỗi ngay khi gõ.

### 6.1. `vocabulary.json`: bộ từ cơ bản (tự nạp vào tài khoản)

```json
{
  "id": "w301",
  "word": "improve",
  "ipa": "/ɪmˈpruːv/",
  "pos": "verb",
  "meaning_vi": "cải thiện",
  "example_en": "I want to improve my English.",
  "example_vi": "Tôi muốn cải thiện tiếng Anh.",
  "youglish_query": "improve my English"
}
```

| Trường | Bắt buộc | Ghi chú |
|---|---|---|
| `id` | ✔ | Nên nối tiếp: `w301`, `w302`… **Duy nhất trên mọi file từ vựng** (kể cả `ielts-sets.json`) |
| `word` | ✔ | Từ hoặc cụm từ tiếng Anh |
| `ipa` | ✔ | Phiên âm (giọng Mỹ). Có thể ghi thêm dạng yếu như `/tuː/ (dạng yếu: /tə/)` |
| `pos` | ✔ | Loại từ, dùng một hoặc vài giá trị (cách nhau dấu phẩy) trong: `noun`, `verb`, `adjective`, `adverb`, `pronoun`, `preposition`, `conjunction`, `determiner`, `article`, `modal`, `number`, `interjection`, `phrase`, `idiom`. App hiển thị bằng tiếng Việt |
| `meaning_vi` | ✔ | Nghĩa tiếng Việt |
| `example_en`, `example_vi` | ✔ | Câu ví dụ và nghĩa |
| `youglish_query` | | Cụm tìm trên YouGlish; bỏ trống thì tìm chính `word` |

Cách nạp vào tài khoản:

- Thứ tự trong file là thứ tự học từ mới.
- **Thẻ mới trong JSON được tự nạp vào tài khoản** ở lần mở app tiếp theo, không cần làm gì thêm.
- Thẻ đã nạp rồi thì **sửa JSON sẽ không cập nhật** (để không ghi đè chỉnh sửa của bạn). Muốn sửa thì sửa trong app.
- Thẻ bạn đã xóa sẽ không bị nạp lại. Từ đã có trong thẻ (trùng chữ) cũng không bị thêm trùng.

### 6.2. `ielts-sets.json`: bộ từ IELTS theo chủ đề (bật trong app)

Gồm mảng `sets`. Mỗi bộ có `id`, `name`, `description` và `cards` (mỗi thẻ có các trường như bảng trên). Bộ nào chỉ được thêm vào tài khoản khi bạn bật trong **Từ vựng → Bộ từ IELTS theo chủ đề**. Thêm từ vào một bộ đang bật thì từ mới cũng tự được nạp.

### 6.3. `connected-speech.json`: nối âm, nuốt âm

Gồm `groups` (các nhóm hiện tượng) và `items` (các câu):

```json
{
  "id": "cs-reduc-08",
  "group": "reductions",
  "full": "I have got to tell you something.",
  "reduced": "I gotta tell ya something.",
  "meaning_vi": "Tôi phải nói với bạn một chuyện.",
  "note_vi": "got to → gotta, you → ya.",
  "youglish_query": "gotta tell you"
}
```

- `group` phải trùng `id` của một nhóm có sẵn: `linking`, `weak_forms`, `flap_t`, `assimilation`, `elision`, `reductions`.
- `full`: câu đầy đủ, dùng làm đáp án và để máy đọc trong bài "nghe → gõ".
- `reduced`: cách người bản xứ đọc, hiện ở bài "đọc cách nói → gõ câu đầy đủ".
- Muốn thêm nhóm mới: thêm vào `groups` một mục có `id`, `name`, `explanation`, `example`.

### 6.4. `dictation.json`: chép chính tả và điền từ

```json
{
  "id": "d2-21",
  "level": 2,
  "text": "I usually go jogging in the park near my house.",
  "meaning_vi": "Tôi thường chạy bộ ở công viên gần nhà.",
  "youglish_query": "go jogging in the park"
}
```

- `level`: `1` (câu ngắn), `2` (trung bình), `3` (dài, có nối âm). Mức càng cao thì bài điền từ càng nhiều chỗ trống.
- **Viết số bằng chữ** (`eight` thay vì `8`) để chấm chính xác.
- `youglish_query`: YouGlish chỉ tìm được cụm ngắn, nên chọn 2–5 từ quan trọng nhất của câu.

### 6.5. `listening-drills.json`: phân biệt âm dễ nhầm

```json
{
  "id": "can-cant-09",
  "options": ["We can meet at five.", "We can't meet at five."]
}
```

Mỗi bài (`drills`) có `id`, `name`, `explanation`, `items`. Mỗi mục có 2–3 câu trong `options`, **chỉ khác nhau ở đúng chỗ cần luyện**. Máy đọc ngẫu nhiên một câu, bạn chọn câu nghe được.

### 6.6. Clip thật (không cần sửa JSON)

Thêm ngay trong app: **Chính tả → Thêm clip**.
- Dán link YouTube; link có `?t=` sẽ tự điền mốc bắt đầu.
- Hoặc phát video ngay trong form rồi bấm **Lấy mốc bắt đầu / kết thúc**.
- Nhập câu thoại làm đáp án.

---

## 7. App hoạt động thế nào

### Lặp lại ngắt quãng (FSRS)

App dùng **FSRS-5** (thuật toán của Anki bản mới) với bộ tham số mặc định. Mỗi thẻ có:
- **stability**: số ngày để khả năng nhớ giảm còn khoảng 90%.
- **difficulty**: độ khó của thẻ, từ 1 đến 10.

Từ đó app xếp lịch để khi đến hạn ôn, bạn vẫn nhớ khoảng **90%** (chỉnh được 85/90/95% trong Cài đặt).

- Thẻ mới: Quên = ôn lại ngay, Khó = 1 ngày, Được = 3 ngày, Dễ = 16 ngày. Ôn đúng hạn và chấm "Được" thì khoảng ôn tăng dần: 3 → 11 → 35 → 100 ngày…
- Số ngày dự kiến hiện ngay dưới mỗi nút. Trên máy tính: **Space** để lật thẻ, phím **1–4** để chấm.
- Thẻ đang học dở theo SM-2 (bản cũ) được tự chuyển đổi ở lần ôn tới, không mất tiến độ.
- Một từ được tính **"đã thuộc"** khi lần ôn tới cách từ 7 ngày trở lên.

### Buổi học "Học tối thiểu 10 phút"

Buổi học gồm theo thứ tự:
1. Thẻ đến hạn (tối đa 50 thẻ, để không bị ngợp sau vài ngày nghỉ).
2. Từ mới (theo cài đặt, mặc định 5).
3. 1 câu nối âm (ngẫu nhiên kiểu đọc hoặc kiểu nghe).
4. 2 câu chính tả (ưu tiên câu chưa làm, từ dễ đến khó).

Dừng lúc nào cũng được, cuối buổi có tóm tắt.

### Chấm câu

- So từng từ, bỏ qua viết hoa và dấu câu.
- Chấp nhận dạng viết tắt tương đương (`don't` = `do not` = `dont`) và dấu nháy cong của bàn phím iPhone.
- Màu: **xanh** = đúng, **đỏ gạch ngang** = sai hoặc thừa (kèm từ đúng bên cạnh), **vàng viền đứt** = thiếu.
- Ô gõ đã tắt tự sửa chính tả để kết quả phản ánh đúng những gì bạn nghe được.
- Từ nội dung bạn nghe sai hiện thành nút: **+ từ** tạo thẻ mới kèm câu đó làm ví dụ, hoặc **ôn lại sớm** nếu đã có thẻ.

### Offline và đồng bộ

- Mọi thay đổi hiện ngay và được lưu vào một hàng đợi trên máy (IndexedDB), rồi gửi lên Supabase theo thứ tự. Mất mạng thì hàng đợi giữ lại và tự gửi khi có mạng.
- App lưu một bản sao dữ liệu trên máy, nên mở được cả khi không có mạng (cần mở app ít nhất một lần khi có mạng).
- Thanh báo nhẹ ở đầu trang cho biết đang offline hay còn bao nhiêu thay đổi chờ đồng bộ.
- Hai thiết bị cùng sửa một thẻ khi offline thì bản gửi lên sau cùng được giữ.

### Chuỗi ngày học và thời gian học

- Một ngày được tính là "đã học" khi làm ít nhất một bài hoặc học từ 1 phút trở lên.
- Mỗi tuần (Thứ Hai → Chủ nhật) được nghỉ **2 ngày** mà chuỗi vẫn giữ. Hôm nay chưa học thì chưa bị tính là nghỉ.
- Thời gian học chỉ đếm khi bạn đang ở màn hình luyện tập, tab đang mở và có thao tác trong 2 phút gần nhất.

### Tùy chỉnh nhanh

Các hằng số trong [`src/config.js`](src/config.js): tốc độ đọc, ngưỡng "đã thuộc", số thẻ tối đa trong buổi học, số câu nối âm / chính tả mỗi buổi, số ngày nghỉ mỗi tuần, các mức ghi nhớ.

### Cơ sở dữ liệu

| Bảng | Nội dung |
|---|---|
| `user_settings` | Tốc độ và giọng đọc, số từ mới/ngày, mức ghi nhớ, bộ từ IELTS đã bật, giờ nhắc học, thẻ khởi đầu đã xóa |
| `cards` | Thẻ từ vựng + trạng thái ôn tập (`stability`, `difficulty`, `interval_days`, `due_date`, `reviews_count`, `lapses`…) |
| `connected_speech_progress` | Tiến độ từng câu nối âm |
| `listening_progress` | Tiến độ bài điền từ và phân biệt âm |
| `dictation_history` | Mỗi lần chép chính tả: câu, câu trả lời, số từ đúng/sai/thiếu/thừa, điểm, số lần nghe, thời gian |
| `clips` | Clip YouTube: link, mốc thời gian, câu thoại |
| `study_sessions` | Mỗi buổi học: ngày, thời lượng, các hoạt động đã làm |
| `push_subscriptions` | Thiết bị nhận thông báo nhắc học |

- Mọi bảng bật Row Level Security với policy `auth.uid() = user_id`.
- **Cài đặt → Xuất dữ liệu (JSON)** tải toàn bộ dữ liệu về máy để sao lưu.
- **Khôi phục từ file sao lưu** ghi lại dữ liệu từ file đó, kể cả vào tài khoản mới. Chạy lại nhiều lần cũng không bị trùng.

### Dịch vụ bên ngoài

- **Tự tra từ** (khi thêm thẻ, nhập danh sách, tạo thẻ từ lỗi chính tả) dùng 2 dịch vụ miễn phí, không cần khóa:
  - [Free Dictionary API](https://dictionaryapi.dev/): phiên âm, loại từ, câu ví dụ.
  - [MyMemory](https://mymemory.translated.net/): dịch nghĩa. Nghĩa dịch máy chỉ là gợi ý, bạn nên xem lại.
- **YouTube** (clip thật) và **YouGlish** (nghe người thật nói) mở trực tiếp từ trình duyệt của bạn.

### Giới hạn

- Giọng đọc phụ thuộc thiết bị:
  - Mac/iPhone có giọng Mỹ (Samantha, Ava…) và Anh (Daniel, Kate…) khá tốt.
  - Thiếu giọng Anh thì tải thêm trong Cài đặt → Trợ năng → Nội dung được đọc.
- Clip YouTube chỉ phát trong app được khi chủ video cho phép nhúng; nếu không, dùng nút mở trên YouTube.

---

## 8. Cấu trúc thư mục

```
├── supabase/
│   ├── migrations/              # SQL tạo bảng + RLS (chạy theo thứ tự)
│   ├── functions/send-reminders # Edge Function gửi thông báo nhắc học
│   └── snippets/                # SQL mẫu lên lịch cron
├── public/                      # icon, manifest, service worker (sw.js)
├── src/
│   ├── config.js                # hằng số tùy chỉnh
│   ├── data/                    # nội dung học (JSON) ← bạn thêm dữ liệu ở đây
│   ├── lib/                     # logic thuần: FSRS, chấm câu, streak, điền từ, hàng đợi đồng bộ,
│   │   │                          TTS, tra từ, YouTube, sao lưu, biểu đồ…
│   │   └── __tests__/           # unit test
│   ├── context/                 # đăng nhập, dữ liệu + đồng bộ, đếm thời gian học, thông báo
│   ├── components/              # thẻ lật, các bài tập, trình phát YouTube, biểu đồ…
│   ├── pages/                   # các trang
│   └── styles/global.css        # giao diện, màu sáng/tối
├── vercel.json                  # cấu hình SPA + service worker cho Vercel
└── .env.example                 # mẫu biến môi trường
```
