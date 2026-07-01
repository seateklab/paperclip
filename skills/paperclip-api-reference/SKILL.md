# A2A Session Create & Message Sync API Reference

> Base URL: `https://api.ai.seateklab.vn/v1/a2a`
>
> Scope: tạo session và gửi chat message sync qua Gateway

## Environment

### Headers

| Header           | Value                                                                 |
| ---------------- | --------------------------------------------------------------------- |
| `x-client-id`    | `69c50207e94adc499d882f21`                                            |
| `x-workspace-id` | `69c50208e94adc499d882f25`                                            |
| `x-app-id`       | `9f8c7e5a-1234-4d3b-9876-abcdef123456`                                |
| `x-api-key`      | `sk_55015677ac32332b9a3cf47e1a1dc95230ff55da1aa6b6af8ed44442b57916b2` |

### Instance IDs

| Instance                       | Instance ID                            |
| ------------------------------ | -------------------------------------- |
| Agent Research Nông nghiệp     | `74634aa1-895a-491c-aff1-f47065f5acc6` |
| Agent Viết bài facebook        | `a288a073-c93c-442f-99de-cd1c3d921c75` |
| Agent Publish bài lên Facebook | `d8e16fcc-20c2-4fa2-8710-f58cc825e6b6` |

### Note: Nếu muốn tự tạo Agent mới, vui lòng vào web ai.seateklab.vn để tạo agent theo template "Facebook Manager Assistant" và dùng `instanceId` của agent đó để test.

---

## 1. Overview

Tài liệu này dành cho dev cần:

1. Tạo session chat mới cho một `instanceId`.
2. Gửi message đồng bộ (`sync`) vào session và nhận ngay assistant response.

Các API bên dưới đi qua Gateway, không gọi trực tiếp `a2a-service`.

---

## 2. Common Headers

Các route này đều yêu cầu auth và header workspace/client để Gateway inject vào payload.

| Header           | Bắt buộc | Mô tả                                        |
| ---------------- | -------: | -------------------------------------------- |
| `x-client-id`    |      Yes | User ID đang thực thi request                |
| `x-api-key`      |      Yes | API key của user hoặc client trong workspace |
| `x-workspace-id` |      Yes | Workspace hiện tại                           |
| `x-app-id`       |      Yes | Application ID                               |
| `Content-Type`   |      Yes | `application/json`                           |

### Permission model

- `POST /v1/a2a/sessions`
  - `AGENT_MANAGEMENT` `CREATE_ANY`
  - `AGENT_MANAGEMENT` `CREATE_OWNER`
- `POST /v1/a2a/sessions/:id/messages`
  - `AGENT_MANAGEMENT` `CREATE_ANY`
  - `AGENT_MANAGEMENT` `CREATE_OWNER`

---

## 3. Create Session

### Endpoint

```http
POST /v1/a2a/sessions
```

### Purpose

Tạo một session mới cho một agent instance. Gateway sẽ tự inject:

- `userId` từ `x-client-id`
- `workspaceId` từ `x-workspace-id`
- `appId` từ `x-app-id`

Bạn không cần gửi các giá trị này trong body.

### Request Body

| Field        | Type          | Required | Mô tả                             |
| ------------ | ------------- | -------: | --------------------------------- |
| `instanceId` | string (uuid) |      Yes | ID của agent instance             |
| `source`     | string        |       No | Nguồn tạo session, mặc định `web` |

### Example Request

```bash
curl -X POST "https://api.ai.seateklab.vn/v1/a2a/sessions" \
  -H "x-client-id: <user_id>" \
  -H "x-api-key: <api_key>" \
  -H "x-workspace-id: <workspace_id>" \
  -H "x-app-id: <app_id>" \
  -H "Content-Type: application/json" \
  -d '{
    "instanceId": "8d7d6f2e-7c67-4a5f-ae2f-8fd0f6f7f0aa",
    "source": "web"
  }'
```

### Response

Gateway trả về envelope chuẩn:

```json
{
  "status": true,
  "statusCode": 200,
  "message": "Success",
  "data": {
    "userId": "69c50207e94adc499d882f21",
    "workspaceId": "69c50208e94adc499d882f25",
    "appId": "9f8c7e5a-1234-4d3b-9876-abcdef123456",
    "protocolName": "a2a",
    "status": "active",
    "source": "web",
    "title": "New Chat",
    "usage": {},
    "metadata": {},
    "instance": {
      "id": "74634aa1-895a-491c-aff1-f47065f5acc6",
      "userId": "69c50207e94adc499d882f21",
      "workspaceId": "69c50208e94adc499d882f25",
      "appId": "9f8c7e5a-1234-4d3b-9876-abcdef123456",
      "name": "Facebook Research Nông Nghiệp",
      "status": "active",
      "isCustomized": true,
      "templateSnapshot": {
        "name": "Facebook Manager Assistant",
        "slug": "facebook-manager-assistant-f1kf",
        "skills": [
          {
            "name": "Facebook Hub",
            "description": "Central orchestration skill for Facebook Manager workflows, routing, required process, and tool policy."
          },
          {
            "name": "Facebook Page Operations",
            "description": "Operate Facebook pages through Graph API tools, including publishing, comments, insights, and page lookup."
          },
          {
            "name": "Facebook Content Studio",
            "description": "Create, rewrite, review, and format Facebook-ready posts, ads, reels, captions, and media publishing payloads."
          },
          {
            "name": "Facebook Research",
            "description": "Research external news, trends, market context, and source material before content creation or publishing."
          },
          {
            "name": "Facebook Chat",
            "description": "Handle casual conversation and general Q&A that does not require Facebook tools or specialized workflows."
          },
          {
            "name": "Facebook Strategy Advisor",
            "description": "Plan Facebook page growth, content pillars, posting cadence, brand voice, positioning, and monetization strategy."
          }
        ],
        "version": "1.0.0",
        "agentUrl": "http://gateway-service.gateway-service.svc.cluster.local:5001/v1/internal-agents/facebook-manager",
        "category": "marketing",
        "protocol": "a2a",
        "agentCard": {
          "name": "Facebook Manager Assistant",
          "color": "#1877F1",
          "avatar": {
            "type": "emoji",
            "value": "F"
          },
          "skills": [
            {
              "id": "fb-hub",
              "name": "Facebook Hub",
              "description": "Central orchestration skill for Facebook Manager workflows, routing, required process, and tool policy."
            },
            {
              "id": "fb-page-ops",
              "name": "Facebook Page Operations",
              "description": "Operate Facebook pages through Graph API tools, including publishing, comments, insights, and page lookup."
            },
            {
              "id": "fb-content-studio",
              "name": "Facebook Content Studio",
              "description": "Create, rewrite, review, and format Facebook-ready posts, ads, reels, captions, and media publishing payloads."
            },
            {
              "id": "fb-research",
              "name": "Facebook Research",
              "description": "Research external news, trends, market context, and source material before content creation or publishing."
            },
            {
              "id": "fb-chat",
              "name": "Facebook Chat",
              "description": "Handle casual conversation and general Q&A that does not require Facebook tools or specialized workflows."
            },
            {
              "id": "fb-strategy-advisor",
              "name": "Facebook Strategy Advisor",
              "description": "Plan Facebook page growth, content pillars, posting cadence, brand voice, positioning, and monetization strategy."
            }
          ],
          "metadata": {
            "framework": "langchain",
            "maxTokens": 120000,
            "temperature": 0.7,
            "defaultSkills": ["fb-hub", "fb-page-ops", "fb-content-studio", "fb-research", "fb-chat", "fb-strategy-advisor"]
          },
          "description": "Manage Facebook pages with content creation, publishing, research, strategy, comments, insights, and media workflows.",
          "capabilities": {
            "streaming": true,
            "pushNotifications": false
          }
        },
        "description": "Manage Facebook pages with content creation, publishing, research, strategy, comments, insights, and media workflows.",
        "agentCardUrl": null,
        "requiredTools": []
      },
      "templateOverrides": {
        "goal": "Research and Crawl sites: https://nongnghiepmoitruong.vn, https://khuyennongvn.gov.vn,https://clrri.org.",
        "skills": [
          {
            "name": "Facebook Hub",
            "description": "Central orchestration skill for Facebook Manager workflows, routing, required process, and tool policy."
          },
          {
            "name": "Facebook Page Operations",
            "description": "Operate Facebook pages through Graph API tools, including publishing, comments, insights, and page lookup."
          },
          {
            "name": "Facebook Content Studio",
            "description": "Create, rewrite, review, and format Facebook-ready posts, ads, reels, captions, and media publishing payloads."
          },
          {
            "name": "Facebook Research",
            "description": "Research external news, trends, market context, and source material before content creation or publishing."
          },
          {
            "name": "Facebook Chat",
            "description": "Handle casual conversation and general Q&A that does not require Facebook tools or specialized workflows."
          },
          {
            "name": "Facebook Strategy Advisor",
            "description": "Plan Facebook page growth, content pillars, posting cadence, brand voice, positioning, and monetization strategy."
          }
        ],
        "maxTokens": 120000,
        "temperature": 0.7
      },
      "memoryConfig": {
        "vaults": [
          {
            "enabled": true,
            "vaultId": "6a3a24109572ff0e36885162",
            "chunkSize": 1024,
            "topKChunks": 5,
            "chunkOverlap": 128,
            "graphEnabled": false,
            "scoreThreshold": 0.6
          }
        ],
        "vectorRag": {
          "topK": 5,
          "enabled": true,
          "autoSummarize": true,
          "scoreThreshold": 0.6
        },
        "windowSize": 20
      },
      "permissions": {
        "rateLimits": {},
        "allowedUsers": ["69c50207e94adc499d882f21"],
        "toolSettings": {
          "GENERATE_IMAGE": {
            "enabled": false
          },
          "GENERATE_VIDEO": {
            "enabled": false
          }
        },
        "isPublicChatbox": false
      },
      "metadata": null,
      "approvalSettings": {},
      "createdAt": "2026-06-23T06:24:18.020Z",
      "updatedAt": "2026-06-23T06:26:36.927Z"
    },
    "taskId": null,
    "id": "ad4b8c26-e418-4a92-b8f5-1bcf3a0d1f79",
    "createdAt": "2026-06-23T06:59:39.631Z",
    "updatedAt": "2026-06-23T06:59:39.631Z",
    "deletedAt": null
  }
}
```

### Response Notes

- `data` là `Session` entity từ `a2a-service`.
- `instance` là nested relation của agent instance.
- Nếu `source = "chatbox"`, `metadata.chatbox` có thể được gắn thêm snapshot tool catalog tự động từ service.

---

## 4. Send Message Sync

### Endpoint

```http
POST /v1/a2a/sessions/:id/messages
```

### Purpose

Gửi một message vào session và chờ assistant trả lời ngay trong cùng request.

Luồng xử lý thực tế:

1. Lưu user message vào DB.
2. Chạy protocol/agent.
3. Lưu assistant message vào DB.
4. Trả về assistant message.

### Path Params

| Param | Type          | Required | Mô tả       |
| ----- | ------------- | -------: | ----------- |
| `id`  | string (uuid) |      Yes | `sessionId` |

### Request Body

| Field         | Type   | Required | Mô tả                                  |
| ------------- | ------ | -------: | -------------------------------------- |
| `text`        | string |      Yes | Nội dung message của user              |
| `mode`        | string |      Yes | Chế độ gửi message, để mặc định `fast` |
| `attachments` | array  |       No | File attachments kèm theo              |

### Attachment Schema (Cần thêm api tải file lên Noto để lấy `fileId`)

| Field      | Type   | Required | Mô tả                         |
| ---------- | ------ | -------: | ----------------------------- |
| `fileId`   | string |      Yes | File ID từ `media-service`    |
| `fileName` | string |      Yes | Tên file gốc                  |
| `mimeType` | string |      Yes | MIME type                     |
| `url`      | string |      Yes | Public URL của file           |
| `size`     | number |       No | Kích thước file, đơn vị bytes |

### Example Request

```bash
curl -X POST "https://api.ai.seateklab.vn/v1/a2a/sessions/2f1c0e84-7f8e-4d5f-9f11-8df93a0b1d26/messages" \
  -H "x-client-id: <user_id>" \
  -H "x-client-key: <client_key>" \
  -H "x-workspace-id: <workspace_id>" \
  -H "x-app-id: <app_id>" \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Xin chao, toi can ho tro don hang #12345",
    "mode": "fast",
    "attachments": [
      {
        "fileId": "65f1c2d9e8b9a7c0d1e2f3a4",
        "fileName": "order-12345.pdf",
        "mimeType": "application/pdf",
        "url": "https://files.example.com/order-12345.pdf",
        "size": 154220
      }
    ]
  }'
```

### Response

Gateway trả về envelope chuẩn:

```json
{
  "status": true,
  "statusCode": 200,
  "message": "Success",
  "data": {
    "role": "assistant",
    "content": "Chào bạn! Rất vui được gặp lại bạn. \n\nTôi đã sẵn sàng hỗ trợ bạn. Nếu bạn quan tâm đến các sự kiện diễn ra vào **tháng 6/2026**, tôi có thông tin về:\n*   **World Cup 2026:** Các trận đấu của Jordan, Algeria, Ecuador... và thông tin về Lionel Messi.\n*   **Truyền hình:** Lịch chiếu phim \"Phía bên kia thành phố\".\n*   **Ngày kỷ niệm:** Ngày Đại dương thế giới.\n\nBạn cần tôi giúp gì thêm không?",
    "status": "completed",
    "sequenceNumber": 6,
    "toolCalls": [],
    "session": {
      "id": "464fa1e5-7b39-4b5c-aa0a-d6535b3e723c"
    },
    "parentId": null,
    "errorMessage": null,
    "id": "2911e587-88b4-4486-acd2-27be7bc76369",
    "artifacts": [],
    "attachments": [],
    "usage": {},
    "isIncludedInRag": false,
    "isPinned": false,
    "createdAt": "2026-06-23T07:29:37.289Z",
    "updatedAt": "2026-06-23T07:29:37.289Z",
    "deletedAt": null
  }
}
```

### Response Notes

- `data` là **assistant message** được lưu sau khi agent xử lý xong.
- User message cũng được persist ở backend, nhưng endpoint này không trả về user message.
- Nếu session bị chặn bởi access/balance guard, `data` có thể là một assistant message với `status: "blocked"` và `content` là thông báo lỗi cho user.

---

## 5. Error Cases

| HTTP code | Trường hợp thường gặp                                                     |
| --------- | ------------------------------------------------------------------------- |
| `400`     | Thiếu `instanceId`, thiếu `text`, UUID sai format, hoặc body không hợp lệ |
| `401`     | Thiếu `x-client-id`, `x-api-key`, `x-workspace-id`, , `x-app-id`          |
| `403`     | Không có quyền tạo session / gửi message vào session đó                   |
| `404`     | `instanceId` hoặc `sessionId` không tồn tại                               |
| `409`     | Xung đột dữ liệu nội bộ từ DB                                             |
| `500`     | Lỗi không xác định từ downstream service hoặc agent runtime               |

---

## 6. Quick Test Flow

```bash
# 1. Create session
POST /v1/a2a/sessions

# 2. Send sync message
POST /v1/a2a/sessions/:id/messages

# 3. Verify full history if needed
GET /v1/a2a/sessions/:id/messages
```

Nếu cần xem toàn bộ cuộc hội thoại sau khi gửi sync message, dùng `GET /v1/a2a/sessions/:id/messages`.
