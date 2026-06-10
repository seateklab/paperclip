---
name: post-facebook
required: false
description: >
  Đăng bài Facebook qua SeaTek Lab API connector từ trong Paperclip.
  Dùng khi cần đăng nội dung lên Facebook Page do người dùng quản lý,
  bao gồm text, link, hoặc media thông qua connector đã kết nối sẵn.
  API gateway: https://api.ai.seateklab.vn.
---

# Post Facebook

Operational skill để đăng bài Facebook từ Paperclip server hoặc adapter layer.
Skill này cung cấp 3 bước workflow: lấy danh sách tools, lấy thông tin managed pages,
và thực thi post bài. Agent/coder implement theo đúng contract API dưới đây.

## When to use

Trigger khi assignment yêu cầu:

- 'đăng bài Facebook', 'post lên Facebook page', 'chia sẻ lên FB'
- 'publish nội dung lên fanpage', 'gửi bài lên trang Facebook'
- Tích hợp SeaTek Lab Facebook connector vào Paperclip để tự động đăng bài
- Agent cần lấy danh sách page trước khi đăng bài

## When NOT to use

- User muốn đăng bài Facebook thủ công từ CLI. Đây là server-side integration skill, không phải CLI tool.
- Thay thế Paperclip Activity Log. Facebook post là side-channel; activity log vẫn phải ghi nhận mutation chính thức.
- Assignment là xây dựng Facebook API từ đầu. Skill này dùng SeaTek connector đã có sẵn.
- Không có network access hoặc API key SeaTek Lab không khả dụng — đây là external dependency blocker.
- Đăng bài lên Facebook cá nhân (profile) thay vì Page. Connector này chỉ hỗ trợ managed pages.

## API Contract

### Headers (Required for all steps)
| Header | Value |
|--------|-------|
| Content-Type | application/json |
| x-client-id | 6a1e447cbf5bcd92a553aa24 |
| x-workspace-id | 6a1e447ebf5bcd92a553aa28 |
| x-app-id | 9f8c7e5a-1234-4d3b-9876-abcdef123456 |
| x-api-key | sk_6bf68a2b17cafb7f855600953acc4d61ff2f19d96277f5f4e55bcd802156ba86 |

### Step 1: Lấy danh sách tools

**Endpoint:**
`
GET https://api.ai.seateklab.vn/v1/connectors/tools?connectionIds=6a1f94cf57af7f63a9472c47
`

**Mục đích:** Lấy các function definitions và input schemas cần thiết để post Facebook.
Kết quả trả về danh sách tools khả dụng cho connection Facebook.

### Step 2: Lấy thông tin Facebook managed pages

**Endpoint:**
`
POST https://api.ai.seateklab.vn/v1/connectors/connections/6a1f94cf57af7f63a9472c47/execute
`

**Request Body:**
`json
{
  "functionName": "FACEBOOK_LIST_MANAGED_PAGES",
  "input": {}
}
`

**Mục đích:** Lấy danh sách các Facebook Page mà user quản lý (page_id, page_name, access_token).
Agent PHẢI gọi bước này trước khi đăng bài để biết page target hợp lệ.

### Step 3: Thực thi post Facebook

**Endpoint:**
`
POST https://api.ai.seateklab.vn/v1/connectors/connections/6a1f94cf57af7f63a9472c47/execute
`

**Request Body:**
Sử dụng các tool lấy được từ Step 1. Thông thường sẽ là một trong các function:
- FACEBOOK_POST_TO_PAGE (hoặc tương đương do API trả về ở Step 1)

Ví dụ body:
`json
{
  "functionName": "FACEBOOK_POST_TO_PAGE",
  "input": {
    "page_id": "<page_id_from_step_2>",
    "message": "<nội dung bài đăng>",
    "link": "<optional_url>"
  }
}
`

**Lưu ý:** Tên functionName chính xác phải lấy từ kết quả Step 1. Không hardcode nếu API trả về tên khác.

## Procedure

### Step 1: Chọn integration layer

| Layer | Phù hợp khi |
|-------|-------------|
| **Server service** (server/src/services/) | Post bài từ business logic (task done, report daily, publish content). Đây là khuyến nghị mặc định. |
| **Adapter layer** (packages/adapters/) | Post bài từ agent lifecycle (agent milestone, summary). Chỉ dùng nếu cần adapter-specific behavior. |
| **Plugin** (packages/plugins/) | Externalize post logic cho phép bật/tắt, cấu hình qua plugin manager. Dùng cho production. |

### Step 2: Implement 3-bước workflow

Tạo server/src/services/facebook.ts (hoặc tương đương):

`	ypescript
const FACEBOOK_BASE_URL = "https://api.ai.seateklab.vn/v1/connectors";
const FACEBOOK_CONNECTION_ID = "6a1f94cf57af7f63a9472c47";

const FACEBOOK_HEADERS = {
  "Content-Type": "application/json",
  "x-client-id": "6a1e447cbf5bcd92a553aa24",
  "x-workspace-id": "6a1e447ebf5bcd92a553aa28",
  "x-app-id": "9f8c7e5a-1234-4d3b-9876-abcdef123456",
  "x-api-key": "sk_6bf68a2b17cafb7f855600953acc4d61ff2f19d96277f5f4e55bcd802156ba86",
};

export interface FacebookPage {
  id: string;
  name: string;
}

export interface FacebookPostInput {
  page_id: string;
  message: string;
  link?: string;
}

export interface FacebookPostResult {
  ok: boolean;
  postId?: string;
  error?: string;
}

/**
 * Step 1: Lấy danh sách tools khả dụng
 */
export async function getFacebookTools(): Promise<any[]> {
  const url = ${FACEBOOK_BASE_URL}/tools?connectionIds=;
  const res = await fetch(url, { headers: FACEBOOK_HEADERS });
  if (!res.ok) throw new Error(Failed to fetch tools: );
  const data = await res.json();
  return data.tools || [];
}

/**
 * Step 2: Lấy danh sách managed pages
 */
export async function listManagedPages(): Promise<FacebookPage[]> {
  const url = ${FACEBOOK_BASE_URL}/connections//execute;
  const res = await fetch(url, {
    method: "POST",
    headers: FACEBOOK_HEADERS,
    body: JSON.stringify({
      functionName: "FACEBOOK_LIST_MANAGED_PAGES",
      input: {},
    }),
  });
  if (!res.ok) throw new Error(Failed to list pages: );
  const data = await res.json();
  return data.pages || [];
}

/**
 * Step 3: Post bài lên Facebook Page
 */
export async function postToFacebook(
  input: FacebookPostInput
): Promise<FacebookPostResult> {
  const url = ${FACEBOOK_BASE_URL}/connections//execute;

  // Lấy tools trước để xác định đúng functionName
  const tools = await getFacebookTools();
  const postTool = tools.find((t: any) =>
    t.functionName?.toLowerCase().includes("post")
  );

  const functionName = postTool?.functionName || "FACEBOOK_POST_TO_PAGE";

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: FACEBOOK_HEADERS,
      body: JSON.stringify({ functionName, input }),
    });

    if (!res.ok) {
      const errText = await res.text();
      return { ok: false, error: HTTP :  };
    }

    const data = (await res.json()) as { postId?: string };
    return { ok: true, postId: data.postId };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}
`

### Step 3: Add convenience wrapper

`	ypescript
export async function publishFacebookPost(
  pageId: string,
  message: string,
  link?: string
): Promise<FacebookPostResult> {
  // Validate page exists
  const pages = await listManagedPages();
  const targetPage = pages.find((p) => p.id === pageId);
  if (!targetPage) {
    return { ok: false, error: Page  not found in managed pages };
  }

  const result = await postToFacebook({ page_id: pageId, message, link });

  // Activity log (nếu có)
  // await createActivityLog({ type: "facebook_post", companyId, metadata: result });

  return result;
}
`

### Step 4: Wire vào call site

Gọi từ nơi cần đăng bài (ví dụ: task completion handler, scheduled job, hoặc adapter lifecycle):

`	ypescript
import { publishFacebookPost } from "../services/facebook";

// Ví dụ: đăng báo cáo hoàn thành task
const result = await publishFacebookPost(
  "123456789012345",      // page_id từ Step 2
  "Task #42 đã hoàn thành!", // message
  "https://paperclip.local/task/42" // optional link
);

if (!result.ok) {
  console.error("Facebook post failed:", result.error);
}
`

## Pitfalls

- **Hardcode functionName mà không lấy từ Step 1.** API SeaTek có thể đổi tên tool. Luôn gọi getFacebookTools() trước để xác định đúng function name.
- **Post lên page chưa được quản lý.** Nếu page_id không nằm trong danh sách từ FACEBOOK_LIST_MANAGED_PAGES, API sẽ trả lỗi permission.
- **Bỏ qua Step 2.** Đừng giả định page_id. Luôn list pages trước để xác nhận quyền và lấy đúng ID.
- **Leak page token giữa companies.** Nếu multi-tenant, đảm bảo page list và post call scoped đúng company.
- **UTF-8 encoding trên Windows/PowerShell.** Khi gọi API qua PowerShell, tiếng Việt có dấu bị mojibake nếu console code page không phải UTF-8. Xem section "UTF-8 Encoding Fix" bên dưới.
- **Không log activity.** Mỗi post thành công hoặc thất bại đều nên ghi vào Paperclip Activity Log để audit.

---

## UTF-8 Encoding Fix (Windows / PowerShell)

### Vấn đề

Khi agent chạy trên Windows và gọi Facebook API qua PowerShell:

`powershell
# ❌ SAI: ConvertTo-Json không encode UTF-8 đúng nếu console là CP437/CP1252
 = @{ ... } | ConvertTo-Json
Invoke-RestMethod ... -Body 
`

Kết quả: Tiếng Việt có dấu bị chuyển thành ? hoặc mojibake.

### Nguyên nhân

- PowerShell ConvertTo-Json serialize string theo [Console]::OutputEncoding
- Windows cmd/PowerShell mặc định dùng code page **CP437** hoặc **CP1252** (single-byte)
- Khi serialize tiếng Việt (UTF-8 multi-byte) ra single-byte encoding → ký tự bị hỏng

### Giải pháp 1: Set UTF-8 trong PowerShell trước khi gọi API (Quick Fix)

`powershell
# ✅ ĐÚNG: Set UTF-8 encoding trước khi serialize
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::InputEncoding = [System.Text.Encoding]::UTF8

 = @{
    functionName = "FACEBOOK_POST_TO_PAGE"
    input = @{
        page_id = "123456789012345"
        message = "Tiếng Việt có dấu: Bài đăng mới"
        link = "https://example.com"
    }
} | ConvertTo-Json -Depth 10

Invoke-RestMethod -Uri  -Method POST 
    -Headers  
    -Body  
    -ContentType "application/json; charset=utf-8"
`

### Giải pháp 2: Dùng Node.js fetch() (Khuyến nghị — Agent đang chạy Node.js)

Thay vì PowerShell, agent nên dùng Node.js etch() (vì agent runtime là Node.js):

`	ypescript
// ✅ ĐÚNG: Node.js fetch() tự động handle UTF-8 đúng
const body = JSON.stringify({
  functionName: "FACEBOOK_POST_TO_PAGE",
  input: {
    page_id: "123456789012345",
    message: "Tiếng Việt có dấu: Bài đăng mới",
    link: "https://example.com",
  },
});

const res = await fetch(url, {
  method: "POST",
  headers: {
    ...FACEBOOK_HEADERS,
    "Content-Type": "application/json; charset=utf-8",
  },
  body,
});
`

**Ưu điểm:**
- Node.js JSON.stringify() tự động escape newlines đúng cách (`\n` trong JSON, không phải literal `\n`)
- Node.js JSON.stringify() luôn output UTF-8
- fetch() gửi body dưới dạng UTF-8 bytes
- Không phụ thuộc vào PowerShell console code page

**Lưu ý quan trọng về newline characters:**

- ✅ **ĐÚNG**: Giữ nguyên newline thực tế trong message string
  ```typescript
  const message = `Màn sương mỏng phủ đồng xanh,
Tiếng gà gáy vọng chào lành buổi mai.`;
  // JSON.stringify() sẽ tự động encode \n thành escape sequence đúng cách
  const body = JSON.stringify({ message });
  ```

- ❌ **SAI**: Escape thủ công thành `\n` literal
  ```typescript
  // Đừng làm thế này:
  const message = "Màn sương mỏng phủ đồng xanh,\\nTiếng gà gáy vọng chào lành buổi mai.";
  // Kết quả: Facebook sẽ hiển thị ký tự \n literal thay vì xuống dòng
  ```

### Giải pháp 3: Dùng curl từ Git Bash / WSL

`ash
# ✅ ĐÚNG: curl với explicit UTF-8
export LANG=en_US.UTF-8
curl -X POST "" \
  -H "Content-Type: application/json; charset=utf-8" \
  -H "x-client-id: 6a1e447cbf5bcd92a553aa24" \
  -d '{"functionName":"FACEBOOK_POST_TO_PAGE","input":{"page_id":"123456789012345","message":"Tiếng Việt có dấu","link":"https://example.com"}}'
`

### Kiểm tra nhanh

Trước khi gửi message tiếng Việt, kiểm tra console encoding:

`powershell
# PowerShell
[Console]::OutputEncoding.EncodingName
# Kỳ vọng: Unicode (UTF-8)
# Nếu ra: Western European (Windows) → cần set UTF-8
`

### Tóm tắt

| Cách gọi | UTF-8 an toàn? | Khuyến nghị |
|----------|---------------|-------------|
| PowerShell mặc định | ❌ Không | Tránh |
| PowerShell + [Console]::OutputEncoding = UTF8 | ✅ Có | Dùng khi bắt buộc PowerShell |
| Node.js etch() + JSON.stringify() | ✅ Có | **Khuyến nghị #1** |
| curl từ Git Bash/WSL | ✅ Có | Dùng khi có sẵn |

---

## Changelog

- **2026-06-03**: Cập nhật UTF-8 encoding fix — thêm hướng dẫn chi tiết cho Windows/PowerShell và khuyến nghị dùng Node.js fetch() thay vì PowerShell để tránh mojibake.
- **2026-06-03**: Tạo skill post-facebook với 3-bước workflow (get tools → list pages → post).

## Verification checklist

- [ ] Step 1 getFacebookTools() trả về danh sách tools không lỗi.
- [ ] Step 2 listManagedPages() trả về ít nhất 1 page hợp lệ.
- [ ] Step 3 postToFacebook() trả về { ok: true, postId: ... } hoặc { ok: false, error: ... } — không throw unhandled.
- [ ] Bài đăng hiển thị đúng trên Facebook Page với nội dung mong muốn.
- [ ] server/.env.example đã cập nhật các biến Facebook (nếu cần config page ID mặc định).
- [ ] Mỗi post call có matching createActivityLog entry.
- [ ] Dynamic content được sanitize trước khi inject vào message.
- [ ] Service được import và gọi từ ít nhất 1 call site (task done, scheduled job, hoặc adapter).
- [ ] pnpm -r typecheck pass sau khi thêm service.
