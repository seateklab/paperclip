---
title: Triển khai Paperclip lên VPS
summary: Tutorial production-first để self-host Paperclip bằng Docker Compose trên 1 máy hoặc VPS
---

Tài liệu này hướng dẫn bạn triển khai Paperclip theo luồng production-ready trên **một máy chủ hoặc VPS** bằng **Docker Compose**.

Đây là một tutorial cho người mới, nhưng ưu tiên cách làm có thể dùng thật cho:

- developer muốn self-host nội bộ cho team nhỏ
- operator muốn có một instance ổn định để tiếp tục harden thành production/public deployment

Tutorial này **không** đi sâu vào Kubernetes, ECS/Fargate, plugin authoring, hay adapter authoring. Mục tiêu là: dựng được một instance Paperclip chạy bền vững, có auth, có persistence, có database, và có checklist vận hành cơ bản.

## Bạn sẽ dựng cái gì

Kết quả cuối tutorial:

- một instance Paperclip chạy bằng Docker Compose
- UI và API phục vụ trên một URL ổn định
- PostgreSQL chạy cùng stack
- dữ liệu Paperclip được persist qua volume
- đăng nhập bằng chế độ `authenticated`
- bootstrap được admin đầu tiên
- có sẵn checklist kiểm tra sau deploy, update, backup, và troubleshooting cơ bản

Kiến trúc tối thiểu:

```text
Browser
  -> Reverse proxy hoặc trực tiếp tới VPS
  -> Paperclip server container
  -> PostgreSQL container
  -> persistent volume cho /paperclip và PostgreSQL data
```

## Khi nào dùng `private` và khi nào dùng `public`

Paperclip có hai mode triển khai đáng dùng cho môi trường thật:

- `authenticated/private`
  - phù hợp khi team truy cập qua LAN, VPN, Tailscale, hoặc mạng nội bộ
  - dễ triển khai hơn
  - là lựa chọn nên bắt đầu nếu bạn self-host cho team nhỏ
- `authenticated/public`
  - phù hợp khi Paperclip sẽ mở ra Internet
  - cần URL public canonical, TLS, reverse proxy và kiểm tra cấu hình chặt hơn

Trong tutorial này, ta sẽ triển khai với mindset production-ready nhưng đi theo đường dễ nhất:

1. dựng stack bằng Docker Compose
2. mặc định nghĩ theo `authenticated/private`
3. sau đó chỉ rõ các chỉnh sửa tối thiểu để đi lên `authenticated/public`

## Điều kiện cần trước khi bắt đầu

Bạn cần:

- một máy Linux hoặc VPS
- Docker Engine
- Docker Compose plugin (`docker compose`)
- quyền mở cổng mạng cần dùng
- ít nhất một domain hoặc subdomain nếu muốn chạy ở mode `public`

Khuyến nghị thực tế:

- CPU: 2 vCPU trở lên
- RAM: 4 GB trở lên
- Disk: 20 GB trở lên

Nếu bạn muốn agent local trong container dùng được Claude/Codex:

- `ANTHROPIC_API_KEY`
- `OPENAI_API_KEY`

Không có các key này, Paperclip vẫn chạy bình thường. Chỉ các adapter tương ứng mới không chạy được.

## Bước 1: chạy smoke test local thật nhanh

Bước này chỉ để xác nhận image và app boot được. Không dùng nó làm production thật.

Từ repo Paperclip:

```sh
export BETTER_AUTH_SECRET="$(openssl rand -hex 32)"
docker compose -f docker/docker-compose.quickstart.yml up --build
```

Mở:

```text
http://localhost:3100
```

Xác nhận nhanh:

- UI mở được
- `GET /api/health` trả về `200`

Sau đó dừng lại:

```sh
docker compose -f docker/docker-compose.quickstart.yml down
```

Nếu bước này lỗi, đừng đi tiếp lên VPS. Sửa ngay ở đây trước.

## Bước 2: chọn mode triển khai

### Trường hợp A: nội bộ cho team nhỏ

Chọn:

```text
PAPERCLIP_DEPLOYMENT_MODE=authenticated
PAPERCLIP_DEPLOYMENT_EXPOSURE=private
```

Dùng khi:

- truy cập qua Tailscale
- qua VPN nội bộ
- hoặc chỉ qua reverse proxy trong mạng riêng

### Trường hợp B: truy cập từ Internet

Chọn:

```text
PAPERCLIP_DEPLOYMENT_MODE=authenticated
PAPERCLIP_DEPLOYMENT_EXPOSURE=public
```

Dùng khi:

- người dùng truy cập từ Internet
- có domain public ổn định
- có TLS/reverse proxy chuẩn

Nếu bạn chưa chắc, bắt đầu bằng `private`.

## Bước 3: chuẩn bị thư mục persistent và biến môi trường

Trên VPS, tạo một thư mục triển khai riêng, ví dụ:

```sh
mkdir -p /opt/paperclip
cd /opt/paperclip
mkdir -p data/postgres
mkdir -p data/paperclip
```

Tạo file `.env`:

```sh
cat > .env <<'EOF'
POSTGRES_USER=paperclip
POSTGRES_PASSWORD=change-this-now
POSTGRES_DB=paperclip

BETTER_AUTH_SECRET=replace-with-long-random-secret

PAPERCLIP_DEPLOYMENT_MODE=authenticated
PAPERCLIP_DEPLOYMENT_EXPOSURE=private
PAPERCLIP_PUBLIC_URL=http://your-host-or-domain:3100

OPENAI_API_KEY=
ANTHROPIC_API_KEY=
EOF
```

### Cách chọn `PAPERCLIP_PUBLIC_URL`

- nếu chạy nội bộ: dùng URL mà người dùng thực sự mở trên trình duyệt
- nếu đi qua reverse proxy: dùng URL public cuối cùng
- nếu public deployment: dùng `https://your-domain`

Ví dụ:

- `http://paperclip.internal:3100`
- `https://paperclip.example.com`

Không đặt sai giá trị này. Auth, callback và host validation phụ thuộc vào nó.

### Tạo secret đủ mạnh

Ví dụ:

```sh
openssl rand -hex 32
```

Đưa kết quả vào `BETTER_AUTH_SECRET`.

## Bước 4: tạo file Docker Compose production-first

Tạo `compose.yml`:

```yaml
services:
  db:
    image: postgres:17-alpine
    restart: unless-stopped
    environment:
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: ${POSTGRES_DB}
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER} -d ${POSTGRES_DB}"]
      interval: 5s
      timeout: 5s
      retries: 30
    volumes:
      - ./data/postgres:/var/lib/postgresql/data

  paperclip:
    build:
      context: /path/to/your/cloned/paperclip-repo
      dockerfile: Dockerfile
    restart: unless-stopped
    depends_on:
      db:
        condition: service_healthy
    ports:
      - "3100:3100"
    environment:
      DATABASE_URL: postgres://${POSTGRES_USER}:${POSTGRES_PASSWORD}@db:5432/${POSTGRES_DB}
      PORT: "3100"
      HOST: "0.0.0.0"
      SERVE_UI: "true"
      PAPERCLIP_HOME: "/paperclip"
      PAPERCLIP_DEPLOYMENT_MODE: ${PAPERCLIP_DEPLOYMENT_MODE}
      PAPERCLIP_DEPLOYMENT_EXPOSURE: ${PAPERCLIP_DEPLOYMENT_EXPOSURE}
      PAPERCLIP_PUBLIC_URL: ${PAPERCLIP_PUBLIC_URL}
      BETTER_AUTH_SECRET: ${BETTER_AUTH_SECRET}
      OPENAI_API_KEY: ${OPENAI_API_KEY}
      ANTHROPIC_API_KEY: ${ANTHROPIC_API_KEY}
      PAPERCLIP_SECRETS_STRICT_MODE: "true"
    volumes:
      - ./data/paperclip:/paperclip
```

### Cần sửa gì trong file trên

Bạn **phải** thay:

```yaml
context: /path/to/your/cloned/paperclip-repo
```

bằng đường dẫn thật đến repo đã clone trên máy chủ, ví dụ:

```yaml
context: /srv/paperclip
```

### Vì sao mount `/paperclip`

Đây là nơi Paperclip lưu:

- config instance
- embedded state nếu có
- local storage attachments
- logs
- local secrets key
- workspaces
- backups

Ngay cả khi bạn dùng Postgres container riêng, volume `/paperclip` vẫn phải được persist.

## Bước 5: khởi động stack

Từ thư mục `/opt/paperclip`:

```sh
docker compose up -d --build
```

Xem log:

```sh
docker compose logs -f paperclip
```

Các tín hiệu tốt cần thấy:

- server boot thành công
- DB connect được
- không có lỗi stale schema
- UI được serve

Kiểm tra health:

```sh
curl -i http://127.0.0.1:3100/api/health
```

Kỳ vọng:

```json
{"status":"ok"}
```

## Bước 6: bootstrap admin đầu tiên

### Nếu đang chạy `authenticated/private`

Luồng khuyến nghị:

1. mở `PAPERCLIP_PUBLIC_URL` trên trình duyệt
2. đăng ký hoặc đăng nhập
3. dùng màn hình setup để claim instance đầu tiên

Đây là browser-first flow hiện có trong source.

### Nếu đang chạy `authenticated/public`

Ưu tiên dùng URL public thật, sau đó bootstrap admin theo luồng invite/claim an toàn.

CLI fallback:

```sh
docker compose exec paperclip node cli/node_modules/tsx/dist/cli.mjs cli/src/index.ts auth bootstrap-ceo
```

Nếu bạn đang chạy từ source ngoài container, có thể chạy tương đương trong repo:

```sh
pnpm paperclipai auth bootstrap-ceo
```

Sau khi bootstrap xong:

- đăng nhập được vào board
- user đầu tiên có quyền admin

## Bước 7: kiểm tra deployment sau khi lên

Đừng dừng ở việc “mở được trang”.

Hãy kiểm tra lần lượt:

### 1. Health API

```sh
curl http://127.0.0.1:3100/api/health
```

### 2. Đăng nhập và vào dashboard

Xác nhận:

- đăng nhập thành công
- không bị redirect loop
- dashboard mở bình thường

### 3. Tạo company đầu tiên

Xác nhận:

- tạo company được
- company hiển thị lại sau refresh

### 4. Tạo agent thử nghiệm

Xác nhận:

- agent lưu được
- adapter config lưu được
- không có lỗi auth hoặc validation bất thường

### 5. Tạo issue thử nghiệm

Xác nhận:

- tạo issue được
- comment được
- activity log ghi nhận mutation

### 6. Kiểm tra persistence

Restart stack:

```sh
docker compose restart
```

Sau restart, xác nhận:

- user vẫn đăng nhập được
- company/agent/issue vẫn còn

Nếu mất dữ liệu, volume của bạn đang sai.

## Bước 8: chuyển từ “chạy được” sang “production dùng được”

Đây là các việc tối thiểu nên làm ngay sau khi deploy thành công.

### 1. Đặt reverse proxy và TLS nếu dùng public URL

Nếu bạn chạy public:

- dùng Nginx, Caddy hoặc reverse proxy tương đương
- terminate TLS ở proxy
- dùng domain thật
- đặt `PAPERCLIP_PUBLIC_URL=https://your-domain`

Khuyến nghị cho public deployment:

- để reverse proxy public-facing
- Paperclip bind nội bộ phía sau proxy

### 2. Không dùng `local_trusted`

Cho môi trường có nhiều người truy cập, chỉ dùng:

- `authenticated/private`
- hoặc `authenticated/public`

### 3. Giữ `PAPERCLIP_SECRETS_STRICT_MODE=true`

Điều này giúp chặn việc tiếp tục nhét inline secret trực tiếp vào config nhạy cảm.

### 4. Xác định chiến lược storage

Cho **một máy/VPS duy nhất**, `local_disk` là chấp nhận được nếu:

- bạn có backup định kỳ
- không scale sang nhiều node

Khi nên chuyển sang S3-compatible storage:

- cần multi-node
- cần tách storage khỏi máy chạy app
- cần durability tốt hơn local disk

### 5. Xác định chiến lược database

Tutorial này dùng Postgres trong Compose vì dễ triển khai.

Khi nên chuyển DB ra ngoài:

- muốn backup/restore chuyên nghiệp hơn
- muốn giảm coupling giữa app và DB
- muốn nâng cấp hoặc bảo trì từng lớp độc lập

Khi chuyển sang external Postgres:

- set `DATABASE_URL`
- nếu runtime URL dùng pooling, set thêm `DATABASE_MIGRATION_URL` bằng direct connection

## Bước 9: backup tối thiểu

Một instance Paperclip self-host không chỉ có database.

Bạn cần backup ít nhất:

- PostgreSQL data hoặc logical dump
- thư mục `/paperclip`

Trong `/paperclip`, đặc biệt quan trọng:

- local secrets master key
- local storage files
- logs nếu bạn cần forensic
- config instance

Nếu bạn chỉ backup database mà không backup secrets key và attachment storage, khôi phục sẽ không đầy đủ.

### Backup database từ app/CLI

Repo hiện có hỗ trợ logical DB backup. Nếu bạn vận hành từ source, tham khảo:

- `docs/deploy/database`
- `docs/deploy/secrets`
- `doc/DEVELOPING.md`

### Nguyên tắc thực tế

- backup định kỳ
- test restore trên môi trường riêng
- không đợi đến khi hỏng mới thử restore

## Bước 10: update instance

Khi muốn cập nhật source Paperclip:

1. pull code mới trong repo clone
2. rebuild image
3. rollout lại stack

Ví dụ:

```sh
cd /srv/paperclip
git pull

cd /opt/paperclip
docker compose up -d --build
```

Sau update:

- xem log startup
- kiểm tra `/api/health`
- đăng nhập lại
- kiểm tra một company thật

Nếu startup báo schema stale hoặc migration issue, đọc log trước khi retry mù quáng.

## Troubleshooting

## Lỗi 1: mở được trang nhưng auth redirect lỗi

Nguyên nhân thường gặp:

- `PAPERCLIP_PUBLIC_URL` sai
- reverse proxy không forward đúng host/origin
- chạy public URL nhưng vẫn dùng giá trị localhost

Cách xử lý:

- sửa `PAPERCLIP_PUBLIC_URL` thành URL người dùng thật sự truy cập
- restart stack

## Lỗi 2: container lên nhưng không connect được DB

Nguyên nhân thường gặp:

- `DATABASE_URL` sai
- DB container chưa healthy
- volume DB hỏng hoặc permission sai

Cách xử lý:

- `docker compose logs -f db`
- `docker compose logs -f paperclip`
- kiểm tra `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`

## Lỗi 3: restart xong mất dữ liệu

Nguyên nhân:

- chưa mount volume đúng
- mount nhầm thư mục tạm

Cách xử lý:

- kiểm tra `./data/postgres:/var/lib/postgresql/data`
- kiểm tra `./data/paperclip:/paperclip`

## Lỗi 4: bootstrap admin không thành công

Nguyên nhân thường gặp:

- đang ở mode authenticated nhưng URL/host setup sai
- browser claim flow không đi đúng URL thật
- public deployment nhưng chưa dùng flow bootstrap phù hợp

Cách xử lý:

- kiểm tra `PAPERCLIP_PUBLIC_URL`
- thử lại browser claim nếu là `private`
- dùng `auth bootstrap-ceo` nếu cần

## Lỗi 5: agent local không chạy

Nguyên nhân thường gặp:

- thiếu `OPENAI_API_KEY`
- thiếu `ANTHROPIC_API_KEY`
- adapter dùng runtime/CLI chưa sẵn sàng

Cách xử lý:

- thêm API key vào environment
- redeploy container
- kiểm tra log adapter/runtime

## Khi nào nên tách tutorial này ra các doc sâu hơn

Sau khi bạn đã deploy thành công bằng tutorial này, đọc tiếp:

- [`/deploy/docker`](/deploy/docker) để xem các biến thể Docker khác
- [`/deploy/deployment-modes`](/deploy/deployment-modes) để hiểu rõ `local_trusted`, `private`, `public`
- [`/deploy/database`](/deploy/database) để chuyển sang external/managed Postgres
- [`/deploy/secrets`](/deploy/secrets) để vận hành secrets đúng cách
- [`/deploy/storage`](/deploy/storage) để chuyển sang S3-compatible storage
- [`/start/quickstart`](/start/quickstart) nếu bạn muốn quay lại luồng local đơn giản hơn

## Kết luận

Nếu bạn làm đúng tutorial này, bạn đã có:

- một Paperclip instance chạy bằng Docker Compose
- auth mode đúng cho self-host thật
- database và data directory được persist
- quy trình bootstrap admin đầu tiên
- checklist kiểm tra sau deploy
- baseline đủ tốt để đi tiếp lên reverse proxy, TLS, S3 và managed Postgres

Đó là điểm khởi đầu đúng cho một deployment Paperclip dùng được, thay vì chỉ là một bản demo chạy tạm.
