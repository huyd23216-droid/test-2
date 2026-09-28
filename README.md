# Tiếng Anh Mỗi Ngày

Web app học tiếng Anh cá nhân: mỗi ngày tối thiểu 10 phút, hướng tới **IELTS 6.5** và **nghe hiểu người bản xứ nói tự nhiên**.

- **Từ vựng**: thẻ lật + lặp lại ngắt quãng (SM-2), chấm 4 mức Quên / Khó / Được / Dễ, bộ 300 từ thông dụng nhất, tự thêm, sửa, xóa thẻ.
- **Nối âm, nuốt âm**: 6 nhóm hiện tượng (linking, weak forms, flap T, assimilation, elision, rút gọn), 40 câu mẫu, 2 kiểu bài tập.
- **Chép chính tả**: 60 câu ở 3 mức độ, chỉnh tốc độ đọc, chấm từng từ. Có thêm phần **clip thật** từ YouTube do bạn tự lưu.
- **Nghe người thật nói**: mở YouGlish cho mọi từ hoặc câu.
- **Buổi học 10 phút**: tự ghép thẻ đến hạn, từ mới, 1 câu nối âm và 2 câu chính tả.
- **Chuỗi ngày học** (mỗi tuần được nghỉ 2 ngày), thống kê đơn giản, xuất dữ liệu ra JSON.
- Dữ liệu lưu trên Supabase nên **đồng bộ giữa MacBook và điện thoại**. Giao diện ưu tiên điện thoại, có chế độ tối.

Công nghệ: React + Vite, Supabase (Postgres + Auth, magic link), Web Speech API, deploy trên Vercel.

---

## Mục lục

1. [Tạo project Supabase và chạy migration](#1-tạo-project-supabase-và-chạy-migration)
2. [Cấu hình biến môi trường](#2-cấu-hình-biến-môi-trường)
3. [Chạy trên máy (local)](#3-chạy-trên-máy-local)
4. [Deploy lên Vercel](#4-deploy-lên-vercel)
5. [Thêm dữ liệu vào các file JSON](#5-thêm-dữ-liệu-vào-các-file-json)
6. [App hoạt động thế nào](#6-app-hoạt-động-thế-nào)
7. [Cấu trúc thư mục](#7-cấu-trúc-thư-mục)

---

## 1. Tạo project Supabase và chạy migration

### 1.1. Tạo project

1. Vào <https://supabase.com>, đăng nhập và bấm **New project**.
2. Đặt tên (ví dụ `tieng-anh`), đặt mật khẩu database (lưu lại) và chọn region gần Việt Nam (ví dụ **Southeast Asia (Singapore)**).
3. Đợi khoảng 1–2 phút để project khởi tạo xong.

### 1.2. Chạy migration (tạo bảng + Row Level Security)

**Cách 1: dùng SQL Editor (dễ nhất)**

1. Trong dashboard, mở **SQL Editor** → **New query**.
2. Mở file [`supabase/migrations/20260928000000_init.sql`](supabase/migrations/20260928000000_init.sql), sao chép **toàn bộ** nội dung và dán vào.
3. Bấm **Run**. Thấy `Success. No rows returned` là xong.
4. Kiểm tra ở **Table Editor**: sẽ có 6 bảng `user_settings`, `cards`, `connected_speech_progress`, `clips`, `dictation_history`, `study_sessions`, bảng nào cũng có nhãn RLS đang bật.

**Cách 2: dùng Supabase CLI**

```bash
npm install -g supabase         # hoặc: brew install supabase/tap/supabase
supabase login
supabase link --project-ref <mã-project>   # mã nằm trong URL dashboard
supabase db push
```

> Migration chỉ chạy **một lần**. Nếu chạy lại sẽ báo lỗi "already exists". Muốn làm lại từ đầu thì xóa các bảng trước.

### 1.3. Cấu hình đăng nhập bằng email (magic link)

Mở **Authentication** trong dashboard:

1. **URL Configuration**:
   - **Site URL**: địa chỉ app sau khi deploy, ví dụ `https://tieng-anh.vercel.app` (tạm thời để `http://localhost:5173` cũng được).
   - **Redirect URLs**: thêm cả hai dòng
     - `http://localhost:5173/**`
     - `https://tieng-anh.vercel.app/**` (thay bằng tên miền Vercel thật của bạn)
2. **Sign In / Providers → Email**: đảm bảo **Email** đang bật (mặc định là bật).
3. **(Nên làm) Thêm mã số vào email đăng nhập**: vào **Emails → Templates → Magic Link**, thêm dòng sau vào nội dung email:

   ```html
   <p>Hoặc nhập mã: <strong>{{ .Token }}</strong></p>
   ```

   Nhờ mã này bạn có thể đăng nhập kể cả khi link bị mở ở trình duyệt khác. Hay gặp nhất là khi bạn thêm app ra **màn hình chính iPhone**: bấm link trong Mail sẽ mở Safari chứ không mở app đã cài. Lúc đó chỉ cần gõ mã vào ô "Mã trong email" trong app.
4. **(Nên làm, sau khi bạn đã đăng nhập lần đầu)** Ở **Sign In / Providers**, tắt **Allow new users to sign up** để người lạ không tự tạo tài khoản được. Dữ liệu vốn đã được RLS tách riêng theo từng người, bước này chỉ để app hoàn toàn là của riêng bạn.

> **Giới hạn gửi email**: máy chủ email mặc định của Supabase chỉ gửi được vài email mỗi giờ. Vì mỗi thiết bị chỉ cần đăng nhập một lần (phiên đăng nhập được giữ lâu dài), mức này thường là đủ. Nếu thấy báo "gửi hơi nhiều lần", hãy đợi ít phút. Muốn gửi nhiều hơn thì cấu hình SMTP riêng trong **Authentication → Emails → SMTP Settings**.

---

## 2. Cấu hình biến môi trường

App cần 2 biến, lấy từ **Project Settings → API Keys** (hoặc nút **Connect** ở đầu dashboard):

| Biến | Giá trị |
|---|---|
| `VITE_SUPABASE_URL` | Project URL, dạng `https://xxxxxxxx.supabase.co` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | **Publishable key**, dạng `sb_publishable_...` |

Tạo file `.env.local` ở thư mục gốc (đã có mẫu trong `.env.example`):

```bash
cp .env.example .env.local
# rồi mở .env.local và điền 2 giá trị trên
```

> - Publishable key được thiết kế để nằm trong code chạy trên trình duyệt. An toàn là nhờ RLS: mỗi user chỉ đọc/ghi được dữ liệu của chính mình.
> - **Tuyệt đối không** dùng *secret key* (`sb_secret_...`) hay *service_role key* trong app này.
> - Project cũ chỉ có *anon key* (`eyJ...`) cũng được: đặt vào biến `VITE_SUPABASE_ANON_KEY` thay cho biến trên.
> - `.env.local` đã nằm trong `.gitignore`, sẽ không bị đẩy lên GitHub.

---

## 3. Chạy trên máy (local)

Cần **Node.js 20.19+** (hoặc 22+).

```bash
npm install
npm run dev
```

Mở <http://localhost:5173>, nhập email và bấm link trong email. Lần đầu đăng nhập, app tự nạp bộ 300 thẻ từ vựng vào tài khoản của bạn.

Các lệnh khác:

| Lệnh | Công dụng |
|---|---|
| `npm test` | Chạy unit test (thuật toán SM-2, chấm câu, streak…) **và kiểm tra các file JSON dữ liệu** |
| `npm run lint` | Kiểm tra lỗi code |
| `npm run build` | Build bản production vào thư mục `dist/` |
| `npm run preview` | Chạy thử bản build |

**Thử trên điện thoại cùng Wi-Fi:** chạy `npm run dev -- --host`, mở địa chỉ `http://192.168.x.x:5173` mà Vite in ra, và thêm `http://192.168.x.x:5173/**` vào Redirect URLs của Supabase.

---

## 4. Deploy lên Vercel

1. Đẩy code lên GitHub (repo này).
2. Vào <https://vercel.com> → **Add New… → Project** → chọn repo.
3. Vercel tự nhận ra **Vite**, giữ nguyên các thiết lập mặc định (Build Command `npm run build`, Output Directory `dist`).
4. Mở mục **Environment Variables** và thêm `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` (giống file `.env.local`).
5. Bấm **Deploy**. Xong sẽ có địa chỉ dạng `https://ten-app.vercel.app`.
6. Quay lại Supabase → **Authentication → URL Configuration**: đặt **Site URL** là địa chỉ Vercel và thêm `https://ten-app.vercel.app/**` vào **Redirect URLs**.

Lưu ý:

- File `vercel.json` đã cấu hình để các đường dẫn như `/vocab`, `/dictation` không bị lỗi 404 khi tải lại trang.
- Biến môi trường được "đóng gói" vào lúc build. **Sửa biến trên Vercel xong phải Redeploy** thì mới có hiệu lực.
- Từ đó mỗi lần bạn push lên nhánh chính, Vercel tự deploy lại (ví dụ sau khi thêm từ vào file JSON).

**Cài lên màn hình chính điện thoại** (dùng như app):

- iPhone (Safari): nút **Chia sẻ** → **Thêm vào MH chính**. App đã cài có bộ nhớ riêng, nên bạn cần đăng nhập lại bên trong app bằng **mã trong email** (xem mục 1.3).
- Android (Chrome): menu ⋮ → **Thêm vào màn hình chính**.

---

## 5. Thêm dữ liệu vào các file JSON

Nội dung khởi đầu nằm trong `src/data/`. Quy tắc chung:

- Mỗi mục có **`id` duy nhất**. **Không đổi `id`** của mục đã có, vì tiến độ học được gắn với `id`.
- Sửa xong chạy **`npm test`**. Test báo chính xác mục nào thiếu trường, trùng `id` hay sai nhóm.
- Sau đó commit và push, Vercel tự deploy lại.
- Nếu JSON sai cú pháp (thiếu dấu phẩy, thừa dấu phẩy cuối…), `npm run build` sẽ báo lỗi. Có thể dùng VS Code để thấy lỗi ngay khi gõ.

### 5.1. `src/data/vocabulary.json`: thẻ từ vựng

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
| `id` | ✔ | Nên nối tiếp: `w301`, `w302`… |
| `word` | ✔ | Từ hoặc cụm từ tiếng Anh |
| `ipa` | ✔ | Phiên âm (giọng Mỹ). Có thể ghi thêm dạng yếu như `/tuː/ (dạng yếu: /tə/)` |
| `pos` | ✔ | Loại từ, dùng một (hoặc vài, cách nhau dấu phẩy) trong: `noun`, `verb`, `adjective`, `adverb`, `pronoun`, `preposition`, `conjunction`, `determiner`, `article`, `modal`, `number`, `interjection`, `phrase`, `idiom`. App hiển thị bằng tiếng Việt |
| `meaning_vi` | ✔ | Nghĩa tiếng Việt |
| `example_en`, `example_vi` | ✔ | Câu ví dụ và nghĩa |
| `youglish_query` | | Cụm tìm trên YouGlish; bỏ trống thì tìm chính `word` |

Cách nạp vào tài khoản:

- **Thứ tự trong file = thứ tự học từ mới.** Thêm vào cuối file thì học sau cùng.
- **Thẻ mới trong JSON được tự nạp vào tài khoản** ở lần mở app tiếp theo, không cần làm gì thêm.
- Thẻ đã nạp rồi thì **sửa JSON sẽ không cập nhật thẻ trong tài khoản** (để không ghi đè chỉnh sửa của bạn trong app). Muốn sửa thì sửa ngay trong app.
- Thẻ khởi đầu mà bạn đã xóa trong app sẽ **không** bị nạp lại.
- Thẻ tự thêm trong app được xếp **trước** bộ từ khởi đầu trong hàng từ mới.

### 5.2. `src/data/connected-speech.json`: nối âm, nuốt âm

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
- `full`: câu đầy đủ (dùng làm đáp án và để máy đọc trong bài "nghe → gõ").
- `reduced`: cách người bản xứ đọc (hiện ở bài "đọc cách nói → gõ câu đầy đủ").
- Muốn thêm nhóm mới: thêm vào `groups` một mục có `id`, `name`, `explanation`, `example`.

### 5.3. `src/data/dictation.json`: chép chính tả

```json
{
  "id": "d2-21",
  "level": 2,
  "text": "I usually go jogging in the park near my house.",
  "meaning_vi": "Tôi thường chạy bộ ở công viên gần nhà.",
  "youglish_query": "go jogging in the park"
}
```

- `level`: `1` (câu ngắn), `2` (trung bình), `3` (dài, có nối âm).
- **Viết số bằng chữ** (`eight` thay vì `8`) để chấm chính xác.
- `youglish_query`: YouGlish chỉ tìm được cụm ngắn, nên chọn 2–5 từ quan trọng nhất của câu.

### 5.4. Clip thật (không cần sửa JSON)

Clip YouTube được thêm ngay trong app: **Chính tả → Thêm clip**. Dán link YouTube (link có `?t=` sẽ tự điền mốc thời gian), nhập câu thoại làm đáp án và nghĩa tiếng Việt nếu muốn.

---

## 6. App hoạt động thế nào

### Lặp lại ngắt quãng (SM-2)

| Mức | Thẻ mới | Thẻ đang ôn |
|---|---|---|
| **Quên** | Hiện lại ngay trong lượt ôn, đến hạn lại hôm nay | Quay về đầu, giảm độ dễ (ease) |
| **Khó** | 1 ngày | Khoảng ôn × 1.2, giảm ease |
| **Được** | 1 ngày → 3 ngày → khoảng cũ × ease | |
| **Dễ** | 4 ngày | Khoảng ôn dài hơn, tăng ease |

Số ngày dự kiến hiện ngay dưới mỗi nút. Trên máy tính: **Space** để lật thẻ, phím **1–4** để chấm.
Một từ được tính **"đã thuộc"** khi khoảng ôn từ 7 ngày trở lên.

### Buổi học "Học tối thiểu 10 phút"

Thẻ đến hạn (tối đa 50 thẻ để không bị ngợp sau vài ngày nghỉ) → từ mới (theo cài đặt, mặc định 5) → 1 câu nối âm (ngẫu nhiên đọc hoặc nghe) → 2 câu chính tả (ưu tiên câu chưa làm, từ dễ đến khó). Có thể dừng bất cứ lúc nào, cuối buổi có tóm tắt.

### Chấm câu

So từng từ, bỏ qua viết hoa và dấu câu. Chấp nhận dạng viết tắt tương đương (`don't` = `do not` = `dont`) và dấu nháy cong của bàn phím iPhone. Màu: **xanh** = đúng, **đỏ gạch ngang** = sai hoặc thừa (kèm từ đúng bên cạnh), **vàng viền đứt** = thiếu. Ô gõ đã tắt tự sửa chính tả để kết quả phản ánh đúng những gì bạn nghe được.

### Chuỗi ngày học và thời gian học

- Một ngày được tính là "đã học" khi làm ít nhất một bài hoặc học từ 1 phút trở lên.
- Mỗi tuần (Thứ Hai → Chủ nhật) được nghỉ **2 ngày** mà chuỗi vẫn giữ. Hôm nay chưa học thì chưa bị tính là nghỉ.
- Thời gian học chỉ đếm khi bạn đang ở màn hình luyện tập, tab đang mở và có thao tác trong 2 phút gần nhất.

### Tùy chỉnh nhanh

Các hằng số trong [`src/config.js`](src/config.js): tốc độ đọc, ngưỡng "đã thuộc", số thẻ tối đa trong buổi học, số câu nối âm / chính tả mỗi buổi, số ngày nghỉ mỗi tuần.

### Cơ sở dữ liệu

| Bảng | Nội dung |
|---|---|
| `user_settings` | Tốc độ đọc mặc định, số từ mới/ngày, danh sách thẻ khởi đầu đã xóa |
| `cards` | Thẻ từ vựng + trạng thái SM-2 (`ease`, `interval_days`, `repetitions`, `lapses`, `reviews_count`, `due_date`…) |
| `connected_speech_progress` | Tiến độ từng câu nối âm: số lần làm, đúng/sai, điểm gần nhất |
| `dictation_history` | Mỗi lần chép chính tả: câu, câu trả lời, số từ đúng/sai/thiếu/thừa, điểm, số lần nghe, thời gian |
| `clips` | Clip YouTube: link, mốc thời gian, câu thoại |
| `study_sessions` | Mỗi buổi học: ngày, thời lượng, các hoạt động đã làm |

Mọi bảng bật Row Level Security với policy `auth.uid() = user_id`. **Cài đặt → Xuất dữ liệu (JSON)** tải toàn bộ các bảng trên về máy để sao lưu.

### Giới hạn của bản MVP

- Cần có mạng để lưu tiến độ (chưa có chế độ offline).
- Giọng đọc phụ thuộc thiết bị: Mac/iPhone thường có giọng tốt (Samantha, Ava…), có thể chọn giọng khác trong **Cài đặt**.
- Đồng bộ giữa các thiết bị diễn ra khi mở app hoặc quay lại app sau hơn 1 phút (không phải tức thời).

---

## 7. Cấu trúc thư mục

```
├── supabase/migrations/     # SQL tạo bảng + RLS
├── public/                  # icon, manifest (thêm vào màn hình chính)
├── src/
│   ├── config.js            # hằng số tùy chỉnh
│   ├── data/                # nội dung học (JSON) ← bạn thêm dữ liệu ở đây
│   ├── lib/                 # logic thuần: SM-2, chấm câu, streak, TTS, YouGlish, YouTube, truy vấn Supabase
│   │   └── __tests__/       # unit test
│   ├── context/             # đăng nhập, dữ liệu, đếm thời gian học, thông báo
│   ├── components/          # thẻ lật, bài nối âm, bài chính tả, nút nghe…
│   ├── pages/               # các trang
│   └── styles/global.css    # giao diện, màu sáng/tối
├── vercel.json              # cấu hình SPA cho Vercel
└── .env.example             # mẫu biến môi trường
```
