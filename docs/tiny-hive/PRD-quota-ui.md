# PRD: Per-User Quota & Usage UI

> LobeChat fork — thêm multi-layer budget enforcement + usage visibility cho Tiny Hive users.
> Author: Your Name (Claude)
> Status: Draft
> Created: 2026-02-11

---

## 1. Problem Statement

LobeChat server-db mode dùng **1 API key chung** cho tất cả users. Hậu quả:

- **Không kiểm soát chi phí per user** — 1 user spam 100 câu hỏi, cả team hết budget
- **Không có short-term rate limiting** — user có thể "burn" $50 trong 1 giờ
- **User không biết mình đã xài bao nhiêu** — không có UI hiển thị spending
- **Admin phải check LiteLLM dashboard thủ công** — không scale khi thêm users
- **Không có subscription management** — không cách nào set ngày hết hạn per user

### Tình huống thực tế

> Anh mời 5 bạn dùng Tiny Hive. Bạn A dùng Claude Opus liên tục → tốn $40/ngày.
> Cuối tháng anh mới biết khi check LiteLLM dashboard. Bill API $300 thay vì $100 dự kiến.

---

## 2. Goals

| # | Goal | Metric |
|---|------|--------|
| G1 | Enforce per-user spending limits tự động | 0 trường hợp vượt budget không kiểm soát |
| G2 | User tự biết quota còn bao nhiêu | 100% users thấy budget status realtime |
| G3 | Admin set budget 1 lần, hệ thống tự enforce | Admin effort < 5 phút/user setup |
| G4 | 2 lớp budget: short-term (burst) + long-term (monthly) | Cả 2 lớp hoạt động đồng thời |
| G5 | Subscription end date per user | Block access tự động khi hết hạn |

### Non-Goals

- ❌ Billing / payment integration (Stripe, etc.)
- ❌ Self-service budget change (admin-only)
- ❌ Per-model pricing display (chỉ show tổng spend)
- ❌ Usage analytics dashboard (dùng LiteLLM UI cho admin)

---

## 3. Target Users

| Persona | Mô tả | Pain point |
|---------|--------|------------|
| **Admin (anh)** | Host Tiny Hive, trả bill API | Cần kiểm soát chi phí, set budget per user |
| **Team member** | Được mời dùng Tiny Hive | Cần biết quota còn bao nhiêu, khi nào reset |
| **Guest / trial user** | Dùng thử có thời hạn | Cần biết subscription còn mấy ngày |

---

## 4. Solution Overview

Tận dụng **LiteLLM multi-layer budget hierarchy** (đã có sẵn, không cần build):

```
User sends message
  → LobeChat server [per-user virtual key thay shared key]
    → LiteLLM checks 3 layers đồng thời:
      ├── Layer 1: Key budget    (short-term, VD: $30/5h, auto-reset)
      ├── Layer 2: Team budget   (long-term, VD: $100/7d, auto-reset)
      └── Layer 3: Key expires   (subscription end, VD: 2026-06-15)
    → Vượt BẤT KỲ layer → block request (HTTP 429)
```

**LobeChat fork thêm 4 thứ:**

| # | Feature | User thấy gì |
|---|---------|-------------|
| F1 | Branding | Logo "Tiny Hive", favicon, tên app |
| F2 | Per-user virtual key | (invisible) — auto-provision on first login |
| F3 | Budget warning banner | Banner vàng/đỏ phía trên chat input |
| F4 | Usage menu | Panel xem chi tiết spending + subscription |

---

## 5. Feature Specifications

### F1: Branding 🐝

**Mục đích:** Tiny Hive là platform riêng, không phải "LobeChat mà ai đó host".

| Element | Hiện tại | Sau khi sửa |
|---------|---------|-------------|
| App name | LobeChat | Tiny Hive |
| Logo (sidebar, login) | LobeChat logo | Tiny Hive bee logo |
| Favicon | LobeChat icon | Tiny Hive icon |
| Page title | LobeChat | Tiny Hive |
| Social links | GitHub, Discord... | Ẩn hết |
| Footer | (none) | "Powered by LobeChat" (attribution) |

**Effort:** ~10 LOC + asset files

---

### F2: Per-User Virtual Key (auto-provision)

**Mục đích:** Mỗi user có LiteLLM key riêng → budget tracked independently.

**User flow:**

```
User lần đầu login
  → LobeChat detect: chưa có virtual key
  → Tự động gọi LiteLLM API:
    1. POST /team/new   → tạo team-of-one (long-term budget)
    2. POST /key/generate → tạo key thuộc team (short-term + expiry)
    3. Lưu key vào DB (mapping userId → litellm_key)
  → Các lần sau: lookup key từ DB, dùng luôn

User gửi message
  → LobeChat dùng per-user key thay shared key
  → LiteLLM track spend per key/team
```

**Admin workflow:**
- Default budget: set khi tạo (VD: $30/5h + $100/7d + 30 ngày trial)
- Thay đổi budget: LiteLLM UI (`/ui` → Keys/Teams tab) hoặc API
- Gia hạn subscription: update key `expires` field

**Edge cases:**

| Case | Xử lý |
|------|-------|
| User login, key đã tồn tại | Dùng key hiện có, không tạo mới |
| Admin xóa key trên LiteLLM | Lần gửi message tiếp → detect 401 → auto-provision lại |
| User bị block (budget hết) | LiteLLM trả 429 → LobeChat hiện banner blocked |
| 2 users login cùng lúc | Key creation idempotent (check DB trước khi tạo) |

**Effort:** ~50-80 LOC

---

### F3: Multi-Layer Budget Warning Banner

**Mục đích:** User biết ngay mình sắp/đã hết quota — TRƯỚC khi bị block bất ngờ.

**States:**

| State | Trigger | UI | Chat input |
|-------|---------|-----|------------|
| ✅ OK | Cả 2 layers < 80% | Ẩn banner | Enabled |
| ⚠️ Warning | Bất kỳ layer ≥ 80% | Banner vàng | Enabled |
| 🔴 Critical | Bất kỳ layer ≥ 95% | Banner đỏ nhạt | Enabled |
| 🚫 Blocked | Bất kỳ layer ≥ 100% HOẶC subscription hết | Banner đỏ đậm | **Disabled** |

**Banner content (2 dòng):**

```
⚡ Short-term: $25/$30 (83%) — reset lúc 14:30
📅 Long-term: $60/$100 (60%) — reset 15/02
```

**Blocked states:**

```
🚫 Hết quota ngắn hạn ($30/$30). Reset sau 2 giờ 15 phút.
```

```
🚫 Hết quota dài hạn ($100/$100). Reset ngày 15/02.
```

```
🚫 Subscription đã hết hạn (15/06/2026). Liên hệ admin.
```

**Behavior:**
- Poll LiteLLM mỗi 60 giây (qua internal API route)
- Refresh ngay sau mỗi message gửi thành công
- Worst-case level hiển thị (nếu short-term OK nhưng long-term critical → show critical)
- Banner position: fixed ngay trên chat input, không che messages

**Effort:** ~100-150 LOC (hook + component)

---

### F4: Usage Menu

**Mục đích:** User xem chi tiết spending — biết mình xài model nào nhiều, bao nhiêu tiền.

**Access:** Icon button ở sidebar → mở modal/drawer

**Content:**

```
┌─────────────────────────────────────────────┐
│ 📊 Usage — Tiny Hive                        │
│                                              │
│ ⚡ Short-term (5h)                           │
│ $25 / $30    [████████░░] 83%                │
│ Reset: 14:30 hôm nay                         │
│                                              │
│ 📅 Long-term (7d)                            │
│ $60 / $100   [██████░░░░] 60%                │
│ Reset: 15/02/2026                            │
│                                              │
│ 📆 Subscription                              │
│ Còn 126 ngày (đến 15/06/2026)               │
│                                              │
│ ─────────────────────────────────────────── │
│ 📋 Recent Usage                              │
│                                              │
│ Thời gian          Model              Cost   │
│ 09:15 hôm nay     claude-sonnet-4    $0.12  │
│ 09:10 hôm nay     claude-sonnet-4    $0.08  │
│ 08:45 hôm nay     gemini-2.0-flash   $0.002 │
│ 08:30 hôm nay     gpt-4o-mini        $0.003 │
│ ...                                          │
│                                              │
│ Tổng hôm nay: $2.15                         │
└─────────────────────────────────────────────┘
```

**Data source:** LiteLLM API `/spend/logs` + `/key/info` + `/team/info`

**Effort:** ~200-300 LOC (page/modal component)

---

## 6. Budget Model Examples

### Ví dụ 1: Team member chuẩn

```
Short-term:  $30 / 5 giờ    ← chống spam burst
Long-term:   $100 / 7 ngày  ← budget tuần
Subscription: 1 năm         ← gia hạn hàng năm
```

Tình huống: User chat bình thường 5-10 câu/giờ → tốn ~$2-5/giờ → không trigger warning.
Nếu user spam 50 câu Claude Opus trong 1 giờ → ~$25 → trigger warning ở 80% ($24).

### Ví dụ 2: Trial user

```
Short-term:  $10 / 5 giờ    ← giới hạn chặt hơn
Long-term:   $20 / 7 ngày
Subscription: 7 ngày        ← trial 1 tuần
```

### Ví dụ 3: Power user

```
Short-term:  $100 / 5 giờ   ← thoải mái hơn
Long-term:   $500 / 30 ngày
Subscription: vô hạn        ← không set expires
```

> Admin config tất cả qua LiteLLM UI — không cần sửa code.

---

## 7. Technical Architecture

```
┌─────────────────────────────────────────────────────────┐
│ LobeChat Fork (Next.js)                                  │
│                                                          │
│  ┌──────────────┐    ┌───────────────────┐              │
│  │ Chat Input   │    │ Sidebar           │              │
│  │ + Banner ⬆️   │    │ + Usage icon 📊   │              │
│  └──────┬───────┘    └───────┬───────────┘              │
│         │                    │                           │
│  ┌──────▼────────────────────▼───────────┐              │
│  │ useBudgetWarning hook (poll 60s)       │              │
│  │ → GET /api/budget                      │              │
│  └──────────────┬────────────────────────┘              │
│                 │                                        │
│  ┌──────────────▼────────────────────────┐              │
│  │ /api/budget/route.ts (server-side)     │              │
│  │ → Fetch key/info + team/info           │              │
│  │ → Return merged budget status          │              │
│  └──────────────┬────────────────────────┘              │
│                 │                                        │
│  ┌──────────────▼────────────────────────┐              │
│  │ Chat middleware                        │              │
│  │ → Lookup per-user virtual key          │              │
│  │ → Auto-provision if first login        │              │
│  │ → Replace shared key with user key     │              │
│  └──────────────┬────────────────────────┘              │
└─────────────────┼────────────────────────────────────────┘
                  │ HTTP (ClusterIP)
┌─────────────────▼────────────────────────────────────────┐
│ LiteLLM Proxy (:4000)                                    │
│                                                          │
│  ┌──────────────────────────────────────────────┐        │
│  │ Budget Enforcement (built-in, không sửa gì)   │        │
│  │                                                │        │
│  │  Check 1: Key budget   ($30/5h)  → 429 if over │        │
│  │  Check 2: Team budget  ($100/7d) → 429 if over │        │
│  │  Check 3: Key expires  (date)    → 429 if past │        │
│  └──────────────────────────────────────────────┘        │
│                                                          │
│  Admin UI (/ui) — manage keys, teams, budgets            │
└──────────────────────────────────────────────────────────┘
```

**Dependency:** LiteLLM đã support multi-layer budget → fork chỉ cần **UI layer** + **key provisioning**.

---

## 8. Implementation Scope

| Feature | New Files | Modified Files | LOC | Priority |
|---------|-----------|---------------|-----|----------|
| F1: Branding | Assets only | `branding.ts`, `manifest.json` | ~10 | P1 — làm đầu tiên |
| F2: Virtual Key | DB migration | Chat middleware/route | ~50-80 | P1 — core feature |
| F3: Budget Banner | `BudgetWarning.tsx`, `useBudgetWarning.ts`, `/api/budget` | `ChatInput` | ~100-150 | P1 — user-facing |
| F4: Usage Menu | `UsagePanel.tsx`, `/api/budget/usage` | Sidebar layout | ~200-300 | P2 — nice to have |
| **Total** | **6 files** | **5 files** | **~400 LOC** | |

### Phase 1 (MVP): F1 + F2 + F3

User thấy branding mới, có per-user key, thấy budget warning → đủ để enforce quota.

### Phase 2: F4

Usage menu cho user xem chi tiết — không blocking, có thể thêm sau.

---

## 9. Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Upstream merge conflict | Delay updates | Chỉ sửa ~5 existing files, conflict area nhỏ |
| LiteLLM API changes | Budget query breaks | Pin LiteLLM version, test before upgrade |
| Key provision race condition | Duplicate keys | DB unique constraint on userId |
| LiteLLM down | Budget check fails | Fallback: allow requests (fail-open), log warning |
| Poll 60s too frequent | Extra load on LiteLLM | LiteLLM handles 1000s req/s, 1 req/60s negligible |

---

## 10. Success Criteria

- [ ] Mỗi user có virtual key riêng — verify qua LiteLLM `/key/info`
- [ ] Budget enforcement hoạt động: user bị block khi vượt bất kỳ layer
- [ ] Banner hiện đúng state (OK → Warning → Critical → Blocked)
- [ ] Chat input disabled khi blocked
- [ ] Banner hiện reset time chính xác
- [ ] Admin đổi budget qua LiteLLM UI → có hiệu lực trong 60 giây
- [ ] Upstream merge không conflict (test với ≥ 2 upstream versions)
- [ ] Page load time không tăng > 100ms so với stock LobeChat

---

## 11. Open Questions

| # | Question | Impact | Proposed Answer |
|---|----------|--------|-----------------|
| Q1 | Default budget cho user mới? | User experience | $30/5h + $100/7d + 30 ngày trial |
| Q2 | Fail-open hay fail-closed khi LiteLLM down? | Availability vs cost | Fail-open (allow requests) |
| Q3 | Hiện budget bằng USD hay token count? | UX clarity | USD (user quan tâm tiền, không quan tâm tokens) |
| Q4 | Banner language? | i18n | Vietnamese mặc định, follow LobeChat i18n system |
| Q5 | Có cần email notification khi sắp hết quota? | Scope creep | Không — banner + Telegram (admin) đủ |
