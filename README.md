<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Quangthoai Restore

Frontend Vite/React + Cloudflare Pages Functions + Cloudflare D1.

App khong con goi Gemini truc tiep tu frontend. Gemini API key duoc luu theo guest session, ma hoa o backend, va chi duoc dung trong Cloudflare Functions.

## Local Frontend

Dieu kien:

- Node.js
- npm

Chay frontend local:

1. `npm install`
2. `npm run dev`

Luu y:

- Frontend local chi phuc vu UI.
- Cac endpoint `/api/*` se can Cloudflare Pages Functions de hoat dong dung.

## Cloudflare Setup

Ban can thao tac tren Cloudflare cho cac buoc sau:

1. Tao D1 database ten `photo-db`
2. Lay `database_id` va thay vao `wrangler.toml`
3. Dat secret `MASTER_SECRET` tren Cloudflare
4. Chay migration `schema.sql` len D1
5. Deploy Pages project co Functions

### 1. Tao D1 Database

Dung mot trong hai cach:

- Cloudflare Dashboard
- Hoac CLI: `wrangler d1 create photo-db`

Sau khi tao xong, cap nhat `database_id` trong `wrangler.toml`.

### 2. Chay Migration

Local D1:

`npm run cf:d1:local`

Remote D1:

`npm run cf:d1:remote`

### 3. Dat Secret

Dat secret `MASTER_SECRET` la mot chuoi ngau nhien dai it nhat 32 ky tu.

Bang CLI:

`wrangler secret put MASTER_SECRET`

### 4. Preview Functions Local

Sau khi build frontend:

1. `npm run build`
2. `npm run cf:dev`

## API Hien Co

- `GET /api/health`
- `GET /api/user-settings/status`
- `POST /api/user-settings/api-key`
- `DELETE /api/user-settings/api-key`
- `POST /api/process/restore`
- `POST /api/process/id-photo`

## Guest Session

App hien tai chua dung dang nhap that.

- Moi trinh duyet duoc cap mot guest session cookie rieng
- API key duoc luu theo cookie session nay
- Neu xoa cookie, app se xem nhu mot user moi

## Trang Thai Hien Tai

Da hoan thanh:

- Cloudflare Pages/Functions scaffold
- D1 schema cho `user_settings` va `usage_logs`
- Guest session bang cookie/UUID
- API luu/xoa/kiem tra Gemini API key da ma hoa
- Chuyen xu ly Gemini sang backend Functions

Chua lam trong pha nay:

- R2 luu input/output image
- Dang nhap that
- Tinh cost USD thuc te theo bang gia model
