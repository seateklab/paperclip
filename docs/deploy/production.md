---
title: Triển khai Production
summary: Hướng dẫn self-host Paperclip an toàn trên VPS, Docker hoặc systemd
---

Tài liệu này hướng dẫn cách đưa Paperclip lên production theo cách thực dụng nhất:

- chạy trên một máy chủ riêng hoặc VPS
- dùng `authenticated/private` hoặc `authenticated/public`
- tách rõ dữ liệu bền vững, secrets và workspace ra khỏi filesystem hệ thống
- giới hạn Paperclip chỉ được ghi vào đúng thư mục instance của nó

Nếu bạn chỉ cần chạy local một người dùng, xem [Local Development](/deploy/local-development).
Nếu bạn cần cloud reference lớn hơn, xem [AWS ECS Fargate](/deploy/aws-ecs).

## Chọn mode trước

Production không nên dùng `local_trusted`.

Chọn theo nhu cầu:

- `authenticated/private` nếu người dùng truy cập qua LAN, VPN hoặc Tailscale
- `authenticated/public` nếu Paperclip mở ra Internet

Xem thêm: [Deployment Modes](/deploy/deployment-modes).

## Kiến trúc khuyến nghị

Mô hình production tối thiểu nên là:

```text
Browser
  -> reverse proxy TLS
  -> Paperclip server
  -> PostgreSQL
  -> object storage hoặc local volume cho attachment
  -> persistent PAPERCLIP_HOME
```

Nguyên tắc quan trọng:

- Paperclip chỉ được đọc/ghi trong `PAPERCLIP_HOME`
- workspace thực thi chỉ được mount vào thư mục riêng, không mount cả home của host
- production không nên dùng embedded PostgreSQL
- nếu triển khai public hoặc nhiều node, dùng storage S3-compatible

## File mẫu

Repo đã có sẵn bộ file mẫu production:

- `docker/docker-compose.production.yml`
- `docker/.env.production.example`

Chạy theo flow:

```sh
cp docker/.env.production.example docker/.env.production
docker compose -f docker/docker-compose.production.yml --env-file docker/.env.production up -d --build
```

## Chuẩn bị host

Bạn cần:

- Linux server hoặc VPS 64-bit
- Docker Engine + Docker Compose plugin, hoặc systemd nếu không dùng container
- PostgreSQL managed hoặc PostgreSQL riêng trên máy khác
- domain hoặc hostname canonical
- TLS do reverse proxy cấp

Khuyến nghị tối thiểu:

- CPU: 2 vCPU
- RAM: 4 GB
- Disk: 20 GB trở lên

## Biến môi trường tối thiểu

Những giá trị cốt lõi nên có trong production:

```sh
PAPERCLIP_DEPLOYMENT_MODE=authenticated
PAPERCLIP_DEPLOYMENT_EXPOSURE=public
PAPERCLIP_PUBLIC_URL=https://paperclip.example.com
BETTER_AUTH_SECRET=replace-with-a-long-random-secret
DATABASE_URL=postgres://paperclip:...@db.example.com:5432/paperclip
DATABASE_MIGRATION_URL=postgres://paperclip:...@db.example.com:5432/paperclip
PAPERCLIP_HOME=/paperclip
PAPERCLIP_SECRETS_STRICT_MODE=true
```

Ghi nhớ:

- `DATABASE_URL` phải trỏ tới PostgreSQL thật
- nếu app dùng URL pooled, `DATABASE_MIGRATION_URL` nên là connection direct
- `PAPERCLIP_PUBLIC_URL` phải là URL mà browser thật sự truy cập
- `BETTER_AUTH_SECRET` phải đủ dài và ổn định qua mọi lần redeploy

Chi tiết đầy đủ xem [Environment Variables](/deploy/environment-variables), [Database](/deploy/database), [Secrets](/deploy/secrets), và [Storage](/deploy/storage).

## Cấu hình storage

Chọn storage theo topology:

- `local_disk` cho single-machine deployment có disk persistent
- `s3` cho production cloud hoặc multi-node

Cấu hình qua CLI:

```sh
pnpm paperclipai configure --section storage
```

Nếu bạn dùng `local_disk`, hãy mount persistent volume cho `PAPERCLIP_HOME` và backup cả thư mục đó.
Nếu bạn dùng `s3`, attachment không còn phụ thuộc vào disk local của container, nhưng `PAPERCLIP_HOME` vẫn phải persist để giữ config, logs, secrets và workspace metadata.

## Cấu hình secrets

Production nên bật strict mode:

```sh
pnpm paperclipai configure --section secrets
```

Hoặc kiểm tra nhanh:

```sh
pnpm paperclipai doctor
```

Nếu dùng `local_encrypted`, bắt buộc backup cả database lẫn file master key:

```text
~/.paperclip/instances/<instance-id>/secrets/master.key
```

Nếu mất một trong hai, secret local không thể khôi phục đầy đủ.

## Triển khai bằng Docker

Đây là đường dễ nhất cho VPS/single-node production.

### 1. Chuẩn bị thư mục persistent

```sh
mkdir -p /srv/paperclip
mkdir -p /srv/paperclip/data
mkdir -p /srv/paperclip/workspaces
```

Nếu bạn dùng attachment local disk, hãy giữ toàn bộ `PAPERCLIP_HOME` trên volume này.

### 2. Tạo file `.env`

```sh
cat > /srv/paperclip/.env <<'EOF'
PAPERCLIP_DEPLOYMENT_MODE=authenticated
PAPERCLIP_DEPLOYMENT_EXPOSURE=public
PAPERCLIP_PUBLIC_URL=https://paperclip.example.com
BETTER_AUTH_SECRET=replace-with-a-long-random-secret
DATABASE_URL=postgres://paperclip:password@db.example.com:5432/paperclip
DATABASE_MIGRATION_URL=postgres://paperclip:password@db.example.com:5432/paperclip
PAPERCLIP_HOME=/paperclip
PAPERCLIP_SECRETS_STRICT_MODE=true
EOF
```

Nếu bạn cần kết nối qua reverse proxy nội bộ hoặc Tailscale, đổi `PAPERCLIP_PUBLIC_URL` cho đúng URL mà người dùng mở thật sự.

### 3. Chạy container với phạm vi filesystem hẹp

Ví dụ `docker run`:

```sh
docker run --name paperclip \
  --restart unless-stopped \
  --read-only \
  --tmpfs /tmp \
  --cap-drop ALL \
  --security-opt no-new-privileges:true \
  -p 3100:3100 \
  --env-file /srv/paperclip/.env \
  -e HOST=0.0.0.0 \
  -e PAPERCLIP_HOME=/paperclip \
  -v /srv/paperclip:/paperclip \
  paperclip-local
```

Điểm chính của cấu hình này:

- container không được ghi ra filesystem host ngoài volume đã mount
- chỉ `/srv/paperclip` được map vào `/paperclip`
- `/tmp` là thư mục tạm duy nhất được cấp quyền ghi
- container không giữ quyền Linux capability không cần thiết

### 4. Nếu dùng Docker Compose

Bạn có thể bọc cấu hình trên trong `compose.yml`. Điều quan trọng là:

- chỉ mount volume riêng cho `PAPERCLIP_HOME`
- không mount `/`, `~`, `.ssh`, `.aws`, hoặc Docker socket
- bật `read_only: true` nếu image và runtime của bạn không cần ghi thêm ngoài volume đã mount

### 5. Build và khởi động

Nếu bạn deploy từ repo source thay vì image dựng sẵn:

```sh
pnpm install
pnpm build
pnpm --filter @paperclipai/server start
```

`@paperclipai/server` dùng `dist/index.js`, nên production phải build trước.

## Triển khai bằng systemd

Nếu không dùng Docker, systemd là đường an toàn tiếp theo.

Ví dụ unit file:

```ini
[Unit]
Description=Paperclip Server
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=paperclip
Group=paperclip
WorkingDirectory=/opt/paperclip
Environment=PAPERCLIP_HOME=/srv/paperclip
Environment=PAPERCLIP_DEPLOYMENT_MODE=authenticated
Environment=PAPERCLIP_DEPLOYMENT_EXPOSURE=public
Environment=PAPERCLIP_PUBLIC_URL=https://paperclip.example.com
Environment=BETTER_AUTH_SECRET=replace-with-a-long-random-secret
Environment=DATABASE_URL=postgres://paperclip:password@db.example.com:5432/paperclip
Environment=DATABASE_MIGRATION_URL=postgres://paperclip:password@db.example.com:5432/paperclip
Environment=PAPERCLIP_SECRETS_STRICT_MODE=true
ExecStart=/usr/bin/node /opt/paperclip/server/dist/index.js
Restart=always
RestartSec=5
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/srv/paperclip

[Install]
WantedBy=multi-user.target
```

Nếu Paperclip cần workspace riêng cho agent runs, mount thêm một path rõ ràng vào `ReadWritePaths` và không mount rộng hơn mức cần thiết.

## Claim admin đầu tiên

Khi instance lần đầu khởi động ở `authenticated` mode, hãy hoàn tất bootstrap admin đầu tiên.

Tuỳ cách bạn triển khai:

- dùng flow claim trong UI
- hoặc dùng CLI bootstrap nếu quy trình vận hành yêu cầu

Xem thêm ở [Local Development](/deploy/local-development) và [Deployment Modes](/deploy/deployment-modes).

## Kiểm tra sau deploy

Sau khi lên production, kiểm tra theo thứ tự:

```sh
curl https://paperclip.example.com/api/health
curl https://paperclip.example.com/api/companies
```

Kỳ vọng:

- `/api/health` trả về trạng thái hợp lệ theo deployment mode
- `/api/companies` trả về dữ liệu JSON đúng với auth hiện tại
- board login hoạt động
- tạo được company, agent, issue và comment
- upload attachment hoạt động nếu storage đã cấu hình

Nếu bạn dùng `authenticated/public`, hãy chắc chắn reverse proxy đang truyền đúng host và scheme để `PAPERCLIP_PUBLIC_URL` không bị lệch.

## Bảo vệ phạm vi filesystem

Nếu mục tiêu của bạn là “Paperclip không can thiệp ra ngoài folder”, đây là phần quan trọng nhất.

Làm đúng các điểm sau:

1. Chỉ mount đúng một thư mục instance, ví dụ `/srv/paperclip` -> `/paperclip`.
2. Không mount home directory của host.
3. Không mount thư mục chứa secrets hệ thống như `~/.ssh`, `~/.aws`, kubeconfig hoặc Docker socket.
4. Chạy container hoặc service bằng user không phải root.
5. Bật sandbox OS-level:
   - Docker: `--read-only`, `--cap-drop ALL`, `--security-opt no-new-privileges:true`
   - systemd: `ProtectSystem=strict`, `ProtectHome=true`, `PrivateTmp=true`, `ReadWritePaths=...`
6. Nếu có project execution workspace, mount workspace đó vào path riêng, không reuse cùng volume với dữ liệu hệ thống.

Lưu ý: giới hạn này phải được cưỡng bức ở tầng hạ tầng. Không nên trông chờ vào prompt hoặc policy của agent để bảo vệ filesystem.

## Backup và vận hành

Tối thiểu nên backup:

- PostgreSQL
- `PAPERCLIP_HOME`
- `secrets/master.key` nếu dùng `local_encrypted`
- attachment storage nếu dùng `local_disk`

Lịch vận hành nên có:

- backup định kỳ
- kiểm tra restore định kỳ
- log rotation
- monitor cho disk, RAM, và DB health
- quy trình xoay `BETTER_AUTH_SECRET` và secrets provider nếu bị lộ

## Khi nào chuyển sang cloud

Nếu bạn cần:

- nhiều node
- storage tách biệt
- HA tốt hơn
- public traffic lớn

thì đừng cố ép single-node VPS thành cloud.

Chuyển sang:

- managed PostgreSQL
- S3-compatible storage
- reverse proxy/TLS chuẩn
- deployment flow cloud như [AWS ECS Fargate](/deploy/aws-ecs)

## Troubleshooting

### `?` hoặc `�` trong nội dung tiếng Việt

Lỗi này thường là do terminal/code page hoặc process environment không dùng UTF-8.

Trên Windows, dùng `chcp 65001` và set `OutputEncoding`.

### Auth không khớp URL

Kiểm tra lại `PAPERCLIP_PUBLIC_URL` và reverse proxy host/scheme headers.

### Không kết nối được PostgreSQL

Kiểm tra `DATABASE_URL`, network ACL, và nếu có pooling thì thêm `DATABASE_MIGRATION_URL`.

### Upload attachment thất bại

Kiểm tra storage provider, quyền ghi vào `PAPERCLIP_HOME`, và nếu dùng local disk thì kiểm tra volume mount.

### Instance boot nhưng không claim được admin đầu tiên

Kiểm tra mode đang là `authenticated`, board user đã đăng nhập đúng, và auth secret không thay đổi giữa các lần khởi động.

## Tóm tắt

Production đúng cách cho Paperclip là:

- dùng `authenticated/private` hoặc `authenticated/public`
- dùng PostgreSQL thật
- persist `PAPERCLIP_HOME`
- giới hạn filesystem bằng container hoặc systemd sandbox
- không mount bừa host filesystem
- backup database, secrets và storage theo topology

Nếu bạn cần một đường triển khai cụ thể hơn cho:

- VPS đơn máy bằng Docker Compose
- Tailscale/private access
- AWS ECS/Fargate

xem các tài liệu tương ứng trong nhóm `Deploy`.
