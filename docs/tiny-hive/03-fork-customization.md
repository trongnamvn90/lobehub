# Tiny Hive: LobeChat Fork — Branding, Quota & Usage UI

> Fork LobeChat để thêm 4 custom features: branding, per-user virtual key, multi-layer budget warning, usage menu.
> LiteLLM hierarchy: Key (short-term) + Team (long-term) + Key expires (subscription end).
> Depends on: Tiny Hive deployed (02-deployment.md).
> Author: Your Name (Claude)

---

## 1. Vấn Đề & Giải Pháp

### Vấn đề

LobeChat server mode dùng 1 API key chung cho tất cả users → không enforce per-user quota, không phân biệt short-term vs long-term budget.

### Giải pháp

Dùng LiteLLM multi-layer budget hierarchy:

```
User (auth via Better Auth)
  → LobeChat server [CUSTOM: per-user virtual key thay shared key]
    → LiteLLM (check Key budget + Team budget + Key expiry)
      → OpenAI / Claude / Gemini

LiteLLM hierarchy:
  Key    = short-term budget  (VD: $30/5h)     ← auto-reset
  Team   = long-term budget   (VD: $100/7d)    ← auto-reset
  Key expires = subscription end (VD: 2026-06-15) ← hard block

Admin quản lý qua: LiteLLM UI (/ui) hoặc API
LobeChat UI: budget warning banner + usage menu [polling LiteLLM API]
```

### Scope (4 changes, ~400 LOC + assets)

| # | Custom | File(s) cần sửa | Effort |
|---|--------|-----------------|--------|
| 1 | Branding (logo, name, favicon, links) | `src/const/branding.ts` + assets | ~10 LOC + assets |
| 2 | Per-user virtual key (auto-provision on first login) | Middleware + DB mapping | ~50-80 LOC |
| 3 | Multi-layer budget warning banner | New React component + hook | ~100-150 LOC |
| 4 | Usage menu (xem chi tiêu, 2 layers) | New page/modal component | ~200-300 LOC |

> Rủi ro merge conflict thấp — không đụng core logic.

---

## 2. Custom #0: Branding

LobeChat branding nằm gọn trong 1 file + assets:

### 2.1 File cần sửa

```typescript
// File: src/const/branding.ts

export const LOBE_CHAT_CLOUD = 'Tiny Hive Cloud';
export const BRANDING_NAME = 'Tiny Hive';
export const BRANDING_LOGO_URL = '/icons/tiny-hive-logo.svg';  // hoặc PNG
export const ORG_NAME = 'Tiny Hive';

export const BRANDING_URL = {
  help: 'https://chat.yourdomain.com/help',
  privacy: undefined,
  terms: undefined,
};

export const SOCIAL_URL = {
  discord: undefined,
  github: undefined,
  medium: undefined,
  x: undefined,
  youtube: undefined,
};

export const BRANDING_EMAIL = {
  business: 'admin@yourdomain.com',
  support: 'admin@yourdomain.com',
};
```

### 2.2 Assets cần thay

```
public/
├── icons/
│   ├── tiny-hive-logo.svg      # Logo chính (sidebar, login)
│   ├── apple-touch-icon.png    # 180x180
│   └── favicon.ico             # 32x32
├── og-image.png                # 1200x630 (social share preview)
└── manifest.json               # Đổi "name": "Tiny Hive"
```

> BRANDING_NAME dùng cho: page title, OG meta, sidebar header, welcome screen.

### 2.2b Logo Asset ✅

**Đã chọn:** `logo-A-bee-minimal.png` — 🐝 geometric bee + honeycomb (đã xóa nền, sẵn sàng dùng).

Source: `docs/tiny-hive/assets/logo-A-bee-minimal.png`

**Cần resize cho LobeChat:**
- `public/icons/tiny-hive-logo.png` — logo chính (sidebar, login)
- `public/icons/apple-touch-icon.png` — 180×180
- `public/icons/favicon.ico` — 32×32
- `public/og-image.png` — 1200×630 (logo + "Tiny Hive" text + tagline)

> Các bản draft khác lưu ở `docs/tiny-hive/assets/logo-drafts/` để tham khảo.

### 2.3 Attribution

Thêm `"Powered by LobeChat"` ở footer/about page để respect upstream license:

```
File: src/app/(main)/_layout/Desktop/SideBar/ (hoặc footer component)
Thêm text nhỏ: "Powered by LobeChat" + link https://lobechat.com
```

> LobeHub Community License yêu cầu commercial license nếu sửa branding + thương mại hóa.
> Giữ attribution line = thiện chí, giảm rủi ro license.

---

## 3. Fork Setup & Maintenance

### 3.1 Initial Fork

```bash
# Fork trên GitHub UI: lobehub/lobe-chat → your-org/lobe-chat
git clone https://github.com/your-org/lobe-chat.git
cd lobe-chat
git remote add upstream https://github.com/lobehub/lobe-chat.git
git checkout -b custom/per-user-quota
```

### 3.2 Merge Upstream (Monthly)

```bash
git fetch upstream
git checkout custom/per-user-quota
git merge upstream/main
# Fix conflicts nếu có (hiếm)
bun install && bun run build && bun run test
git push origin custom/per-user-quota
```

### 3.3 Custom Docker Build

```dockerfile
# Dockerfile.custom (đặt ở root repo)
FROM node:20-slim AS builder
WORKDIR /app
COPY . .
RUN npm install -g bun && bun install && bun run build

FROM node:20-slim
WORKDIR /app
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
EXPOSE 3210
CMD ["node", ".next/standalone/server.js"]
```

### 3.4 CI/CD: Tag-Based Build → GHCR (Private)

Anh merge upstream bằng tay, push tag → GitHub Actions tự build + push image đúng version.

**Tag convention:**

| Nguồn | Tag format | Ví dụ |
|-------|-----------|-------|
| Upstream LobeChat | `v{semver}` | `v2.1.27` |
| Fork (anh push) | `v{semver}-custom` | `v2.1.27-custom` |
| Docker image | `v{semver}-custom` + `latest` | `ghcr.io/.../lobechat-custom:v2.1.27-custom` |

**Workflow:**

```
Anh merge upstream v2.1.27 vào fork
  → git tag v2.1.27-custom
  → git push origin v2.1.27-custom
    → GitHub Actions trigger
      → Build Docker image
      → Push ghcr.io/your-username/lobechat-custom:v2.1.27-custom
      → Push ghcr.io/your-username/lobechat-custom:latest
```

**Workflow file:**

```yaml
# .github/workflows/build-push.yml
name: 🐝 Build & Push Custom LobeChat

on:
  push:
    tags:
      - 'v*-custom'    # Chỉ trigger khi push tag v*-custom

env:
  REGISTRY: ghcr.io
  IMAGE_NAME: ${{ github.repository_owner }}/lobechat-custom

jobs:
  build:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write

    steps:
      - uses: actions/checkout@v4

      - name: Extract version from tag
        id: version
        run: |
          TAG="${GITHUB_REF#refs/tags/}"
          UPSTREAM="${TAG%-custom}"
          echo "tag=$TAG" >> $GITHUB_OUTPUT
          echo "upstream=$UPSTREAM" >> $GITHUB_OUTPUT
          echo "🏷️ Tag: $TAG | Upstream: $UPSTREAM"

      - uses: docker/setup-buildx-action@v3

      - uses: docker/login-action@v3
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - uses: docker/build-push-action@v5
        with:
          context: .
          file: Dockerfile.custom
          push: true
          tags: |
            ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}:${{ steps.version.outputs.tag }}
            ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}:latest
          labels: |
            org.opencontainers.image.source=${{ github.server_url }}/${{ github.repository }}
            org.opencontainers.image.version=${{ steps.version.outputs.tag }}
            org.opencontainers.image.upstream=lobehub/lobe-chat:${{ steps.version.outputs.upstream }}
          cache-from: type=gha
          cache-to: type=gha,mode=max
```

> **OCI label** `org.opencontainers.image.upstream` ghi rõ upstream version → script version monitor đọc label này để compare.
> GitHub Actions free: 2000 min/tháng (private repo). Build LobeChat ~10-15 min/lần → ~130 builds/tháng.

**Quy trình khi upstream release mới:**

```bash
# 1. Fetch upstream
git fetch upstream --tags

# 2. Merge upstream tag vào fork branch
git checkout custom/per-user-quota
git merge v2.1.27
# Fix conflicts nếu có → test → commit

# 3. Tag + push → CI/CD tự chạy
git tag v2.1.27-custom
git push origin custom/per-user-quota --tags
# → GitHub Actions build + push GHCR

# 4. Deploy lên K3s
kubectl set image deployment/lobechat \
  lobechat=ghcr.io/your-username/lobechat-custom:v2.1.27-custom \
  -n tiny-hive
```

**K3s pull private image — tạo imagePullSecret:**

```bash
# Tạo GitHub Personal Access Token (PAT) với scope: read:packages
# Settings > Developer settings > Personal access tokens > Tokens (classic)

kubectl create secret docker-registry ghcr-secret \
  --namespace=tiny-hive \
  --docker-server=ghcr.io \
  --docker-username=YOUR_GITHUB_USERNAME \
  --docker-password=YOUR_GITHUB_PAT
```

**Update LobeChat deployment (07-lobechat.yaml):**

```yaml
spec:
  template:
    spec:
      imagePullSecrets:
        - name: ghcr-secret
      containers:
        - name: lobechat
          image: ghcr.io/your-username/lobechat-custom:latest
```

**Deploy new image trên server:**

```bash
# Sau khi GitHub Actions build xong:
kubectl rollout restart deployment/lobechat -n tiny-hive
# Hoặc set image cụ thể:
kubectl set image deployment/lobechat lobechat=ghcr.io/your-username/lobechat-custom:<sha> -n tiny-hive
```

---

## 4. Custom #1: Per-User Virtual Key

### 4.1 Concept

Thay vì dùng 1 shared API key, mỗi user có **virtual key riêng** trên LiteLLM. Key này thuộc 1 team (team-of-one), tạo ra 2 layer budget:

- **Key** = short-term budget (VD: $30/5h, auto-reset)
- **Team** = long-term budget (VD: $100/7d, auto-reset)
- **Key `expires`** = subscription end date

### 4.2 Implementation

On first login, LobeChat fork tự provision team + key:

```typescript
// File: src/app/api/chat/[provider]/route.ts hoặc middleware

const session = await getSession(req);
const userId = session?.user?.id;

// Check DB: user đã có virtual key chưa?
let userKey = await db.getUserLitellmKey(userId);

if (!userKey) {
  // 1. Tạo team (long-term)
  const team = await litellm.post('/team/new', {
    team_alias: `team-${userId}`,
    max_budget: 100, budget_duration: '7d'
  });
  // 2. Tạo key (short-term + subscription end)
  const key = await litellm.post('/key/generate', {
    team_id: team.team_id, user_id: userId,
    max_budget: 30, budget_duration: '5h',
    expires: subscriptionEndDate
  });
  // 3. Lưu key vào DB
  await db.saveUserLitellmKey(userId, key.key, team.team_id);
  userKey = key.key;
}

// Dùng per-user key thay shared key
chatPayload.apiKey = userKey;
```

> Admin thay đổi budget per user qua **LiteLLM UI** (`/ui` → Teams / Keys tab) hoặc API.

### 4.3 Verification

```bash
# Check key info (cả 2 layer)
curl 'http://litellm:4000/key/info?key=sk-user-xxx' \
  -H 'Authorization: Bearer <master-key>'
# Expected: key budget + team budget + expires
```

---

## 5. Custom #2: Multi-Layer Budget Warning Banner

### 5.1 Internal API Route

Query cả **key info** (short-term) lẫn **team info** (long-term):

```typescript
// File: src/app/api/budget/route.ts (NEW)

import { getSession } from '@/libs/auth';

export async function GET(req: Request) {
  const session = await getSession(req);
  if (!session?.user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { litellmKey, teamId } = await db.getUserLitellmKey(session.user.id);
  const litellmUrl = process.env.LITELLM_PROXY_URL || 'http://litellm:4000';
  const masterKey = process.env.LITELLM_MASTER_KEY;
  const headers = { 'Authorization': `Bearer ${masterKey}` };

  const [keyRes, teamRes] = await Promise.all([
    fetch(`${litellmUrl}/key/info?key=${litellmKey}`, { headers }),
    fetch(`${litellmUrl}/team/info?team_id=${teamId}`, { headers }),
  ]);
  const [keyData, teamData] = await Promise.all([keyRes.json(), teamRes.json()]);

  return Response.json({
    shortTerm: {
      spend: keyData.spend || 0,
      maxBudget: keyData.max_budget,
      duration: keyData.budget_duration,
      resetAt: keyData.budget_reset_at,
    },
    longTerm: {
      spend: teamData.spend || 0,
      maxBudget: teamData.max_budget,
      duration: teamData.budget_duration,
      resetAt: teamData.budget_reset_at,
    },
    expires: keyData.expires,
    blocked: (keyData.spend >= keyData.max_budget) || (teamData.spend >= teamData.max_budget)
             || (keyData.expires && new Date(keyData.expires) < new Date()),
  });
}
```

### 5.2 React Hook

```typescript
// File: src/hooks/useBudgetWarning.ts (NEW)
// Poll mỗi 60s, trả về worst-case level từ cả 2 layers

interface BudgetLayer { spend: number; maxBudget: number; duration: string; resetAt: string; }
interface BudgetInfo {
  shortTerm: BudgetLayer;
  longTerm: BudgetLayer;
  expires: string | null;
  blocked: boolean;
  worstLevel: 'ok' | 'warning' | 'critical' | 'blocked';
}
// Logic: blocked nếu bất kỳ layer nào >= 100%, critical >= 95%, warning >= 80%
```

### 5.3 Banner Component

```tsx
// File: src/components/BudgetWarning.tsx (NEW)
// Hiển thị 2 dòng: short-term status + long-term status
// VD: "⚡ 5h: $25/$30 (83%) | 📅 7d: $60/$100 (60%)"
// Blocked: "🚫 Hết quota [short-term/long-term]. Reset lúc ..."
// Subscription hết: "🚫 Subscription đã hết hạn [ngày]"
```

### 5.4 Integration

```
File: src/app/(main)/chat/features/ChatInput/index.tsx
Mount <BudgetWarning /> ngay trước chat input
Khi blocked === true → disable textarea
```

---

## 6. Custom #3: Usage Menu

### 6.1 Extended API Route

```typescript
// File: src/app/api/budget/usage/route.ts (NEW)
// Trả về: shortTerm + longTerm budget info + spend logs
// Dùng /key/info + /team/info + /spend/logs (tương tự Section 4.1)
```

### 6.2 Usage Panel Component

```
// File: src/components/UsagePanel.tsx (NEW)
// Hiển thị 2 progress bars: short-term + long-term
//
// ⚡ Short-term (5h):   $25/$30  [████████░░] 83%  reset 14:30
// 📅 Long-term (7d):    $60/$100 [██████░░░░] 60%  reset 15/02
// 📆 Subscription:      còn 126 ngày (đến 15/06/2026)
//
// Lịch sử gần đây: table [thời gian, model, chi phí] — 20 entries
```

### 6.3 Integration

```
File: src/app/(main)/_layout/Desktop/SideBar/
Thêm icon button → onClick mở modal/drawer chứa <UsagePanel />
Hoặc route mới: src/app/(main)/usage/page.tsx
```

---

## 7. LiteLLM Multi-Layer Budget Configuration

### 7.1 Hierarchy

```
Per request, LiteLLM checks (tất cả đồng thời):
  1. Key budget    → short-term (VD: $30/5h)
  2. Team budget   → long-term  (VD: $100/7d)
  3. Key expires   → subscription end
Vượt bất kỳ layer nào → block request.
```

### 7.2 Ví dụ Setup User

```bash
# User A: $30/5h + $100/7d + subscription đến 15/06/2026
# 1. Team (long-term)
curl -X POST 'http://litellm:4000/team/new' \
  -H 'Authorization: Bearer <MASTER_KEY>' \
  -d '{"team_alias":"team-user-a", "max_budget":100, "budget_duration":"7d"}'

# 2. Key (short-term + subscription)
curl -X POST 'http://litellm:4000/key/generate' \
  -H 'Authorization: Bearer <MASTER_KEY>' \
  -d '{"team_id":"<team_id>", "user_id":"user-a", "max_budget":30, "budget_duration":"5h", "expires":"2026-06-15T00:00:00Z"}'
```

### 7.3 Quản lý qua UI

LiteLLM Admin Dashboard tại `/ui`:
- **Teams tab**: tạo/sửa team budget (long-term)
- **Keys tab**: tạo/sửa key budget (short-term), set expiry
- **Usage tab**: xem spend analytics per user/team/model

> Admin không cần curl — set tay hoàn toàn qua UI được.

---

## 8. Environment Variables Mới

Thêm vào LobeChat deployment:

```yaml
LITELLM_PROXY_URL: "http://litellm-svc.tiny-hive.svc.cluster.local:4000"
LITELLM_MASTER_KEY: "<same-as-litellm-master-key>"
```

---

## 9. Files Summary

### Files MỚI

| File | Mục đích |
|------|----------|
| `src/app/api/budget/route.ts` | Multi-layer budget info (key + team) |
| `src/app/api/budget/usage/route.ts` | Usage detail + spend logs |
| `src/hooks/useBudgetWarning.ts` | Polling 2-layer budget status |
| `src/components/BudgetWarning.tsx` | Multi-layer warning banner |
| `src/components/UsagePanel.tsx` | Usage detail panel (2 progress bars) |
| `Dockerfile.custom` | Custom Docker build |

### Files SỬA (minimal)

| File | Thay đổi |
|------|----------|
| `src/const/branding.ts` | Logo, name, org, emails, social links |
| `public/icons/*`, `public/og-image.png`, `public/manifest.json` | Assets thay thế |
| `src/app/api/chat/[provider]/route.ts` | Per-user virtual key (auto-provision team + key) |
| `src/app/(main)/chat/.../ChatInput` | Mount `<BudgetWarning />` |
| `src/app/(main)/_layout/.../SideBar` | Thêm Usage menu item |

---

## 10. Testing Checklist

```
□ Deploy custom image lên K3s
□ Branding: logo, favicon, page title hiển thị "Tiny Hive"
□ First login → auto-provision team + key trên LiteLLM
□ User A gửi message → spend tracked riêng
□ Short-term budget >80% → banner vàng
□ Short-term budget =100% → block, hiện reset time (VD: "reset sau 2h")
□ Long-term budget =100% → block, hiện reset time (VD: "reset 15/02")
□ Key expires hết hạn → block, hiện "Subscription đã hết"
□ Chat input disabled khi bất kỳ layer nào blocked
□ Usage panel hiển thị đúng 2 progress bars + subscription date
□ Admin đổi budget qua LiteLLM UI → có hiệu lực ngay
```
