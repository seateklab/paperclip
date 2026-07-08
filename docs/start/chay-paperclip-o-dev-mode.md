---
title: Chạy Paperclip ở Dev Mode
summary: How-to ngắn gọn để contributor chạy repo Paperclip ở chế độ development
---

Tài liệu này dành cho contributor **đã có source** và chỉ cần cách chạy Paperclip ở chế độ development nhanh, đúng, và sát với source hiện tại.

Tài liệu này **không** thay thế quickstart cho người dùng cuối. Nếu bạn chỉ muốn dùng Paperclip chứ không phát triển repo, xem `/start/quickstart`.

## Điều kiện cần

Bạn cần:

- Node.js 20+
- pnpm 9+
- repo đã được clone sẵn

Làm việc từ thư mục root của repo.

## Cách chạy dev nhanh nhất

```sh
pnpm install
pnpm dev
```

Kết quả:

- API server chạy tại `http://localhost:3100`
- UI được serve cùng origin bởi API server
- database mặc định là **embedded PostgreSQL**

Bạn không cần tự cài PostgreSQL hoặc Docker chỉ để chạy dev cơ bản.

## Chạy một lần không watch

Nếu bạn muốn chạy dev mà không bật file watcher:

```sh
pnpm dev:once
```

Lệnh này hữu ích khi:

- bạn chỉ muốn boot app để kiểm tra nhanh
- môi trường watch bị nặng hoặc không ổn định

## Chạy dev ở `authenticated/private`

Nếu bạn muốn test đúng flow đăng nhập nội bộ thay vì `local_trusted`, dùng cách đơn giản nhất:

```sh
pnpm dev --bind lan
```

Theo source hiện tại, lệnh này chạy dev với:

- `PAPERCLIP_DEPLOYMENT_MODE=authenticated`
- `PAPERCLIP_DEPLOYMENT_EXPOSURE=private`

Trên instance mới:

1. mở app trên trình duyệt
2. đăng nhập hoặc tạo tài khoản
3. claim admin đầu tiên từ màn hình setup

### Bộ biến môi trường tối thiểu cho `authenticated/private`

Nếu bạn muốn set env thủ công thay vì dùng `--bind lan`, tối thiểu cần:

```env
PAPERCLIP_DEPLOYMENT_MODE=authenticated
PAPERCLIP_DEPLOYMENT_EXPOSURE=private
PAPERCLIP_BIND=lan
BETTER_AUTH_SECRET=paperclip-dev-secret
```

Có thể thêm:

```env
PAPERCLIP_PUBLIC_URL=http://<host-hoac-ip>:3100
```

Nên set rõ `PAPERCLIP_PUBLIC_URL` khi bạn test qua máy khác trong LAN, reverse proxy nội bộ, hoặc Tailscale hostname.

## Chạy dev qua Tailscale

Nếu bạn chỉ muốn app bind vào tailnet address:

```sh
pnpm dev --bind tailnet
```

Nếu cần cho phép hostname riêng:

```sh
pnpm paperclipai allowed-hostname your-tailnet-hostname
```

## Các lệnh dev hay dùng

Khởi động đầy đủ:

```sh
pnpm dev
```

Khởi động không watch:

```sh
pnpm dev:once
```

Xem dev runner đang chạy:

```sh
pnpm dev:list
```

Dừng dev runner:

```sh
pnpm dev:stop
```

Chạy Storybook:

```sh
pnpm storybook
```

Build Storybook:

```sh
pnpm build-storybook
```

## Health checks nhanh

Trong terminal khác:

```sh
curl http://localhost:3100/api/health
curl http://localhost:3100/api/companies
```

Kỳ vọng:

- `/api/health` trả `{"status":"ok"}`
- `/api/companies` trả về JSON array

## Dữ liệu dev local nằm ở đâu

Mặc định, state local của Paperclip nằm dưới:

```text
~/.paperclip/instances/default/
```

Các path quan trọng:

- config: `~/.paperclip/instances/default/config.json`
- database: `~/.paperclip/instances/default/db`
- storage: `~/.paperclip/instances/default/data/storage`
- backups: `~/.paperclip/instances/default/data/backups`
- secrets key: `~/.paperclip/instances/default/secrets/master.key`
- logs: `~/.paperclip/instances/default/logs`

## Đổi nơi lưu dữ liệu local

Nếu máy bạn không ghi được vào home mặc định, hoặc bạn muốn state nằm ngay trong workspace:

```sh
PAPERCLIP_HOME=/custom/path pnpm dev
```

Ví dụ trên Windows:

```powershell
$env:PAPERCLIP_HOME='D:\Workspace\paperclip\.paperclip'
pnpm dev
```

## Reset dev data

Để xóa database local và khởi động lại sạch:

```sh
rm -rf ~/.paperclip/instances/default/db
pnpm dev
```

Nếu bạn đã đổi `PAPERCLIP_HOME`, hãy xóa đúng DB path tương ứng của instance đó.

## Lỗi thường gặp

## Thiếu `BETTER_AUTH_SECRET`

Lỗi này chỉ quan trọng khi bạn chạy ở `authenticated`.

Sửa bằng cách set:

```env
BETTER_AUTH_SECRET=paperclip-dev-secret
```

## Embedded PostgreSQL lỗi quyền ghi

Thường gặp trên Windows hoặc môi trường có home directory bị hạn chế quyền.

Cách xử lý:

```powershell
$env:PAPERCLIP_HOME='D:\Workspace\paperclip\.paperclip'
pnpm dev
```

## Không truy cập được từ máy khác trong mạng

Nguyên nhân thường gặp:

- vẫn đang chạy `local_trusted`
- bind vẫn là loopback
- chưa set hostname/public URL phù hợp

Cách xử lý:

- dùng `pnpm dev --bind lan`
- hoặc set `PAPERCLIP_BIND=lan`
- nếu cần, set thêm `PAPERCLIP_PUBLIC_URL`

## Auth redirect hoặc callback sai URL

Nguyên nhân thường gặp:

- `PAPERCLIP_PUBLIC_URL` sai
- bạn truy cập bằng hostname khác hostname mà app đang tin cậy

Cách xử lý:

- set đúng `PAPERCLIP_PUBLIC_URL`
- thêm hostname bằng `pnpm paperclipai allowed-hostname <hostname>`

## Startup báo schema stale hoặc migration issue

Đọc log trước. Nếu cần, chạy:

```sh
pnpm db:migrate
```

## Khi nào đọc thêm doc khác

- `/deploy/local-development`: mô tả local development đầy đủ hơn
- `/deploy/deployment-modes`: hiểu rõ `local_trusted`, `private`, `public`
- `/start/quickstart`: luồng cho người dùng cuối
- `/start/trien-khai-paperclip-len-vps`: tutorial production-first trên VPS

## Tóm tắt

Nếu bạn chỉ muốn chạy repo ở dev mode:

```sh
pnpm install
pnpm dev
```

Nếu bạn muốn test flow nội bộ có login:

```sh
pnpm dev --bind lan
```

Đó là hai đường chạy dev quan trọng nhất trong repo này.
