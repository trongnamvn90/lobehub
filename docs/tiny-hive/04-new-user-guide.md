# Tiny Hive: Guide Thêm User Mới

> Hướng dẫn từng bước khi onboard user mới vào Tiny Hive.
> Author: Your Name (Claude)

---

## Tổng Quan

Khi thêm user mới, cần làm 2 việc:

1. **LobeChat** — User tự đăng ký (hoặc admin tạo account)
2. **LiteLLM** — Admin tạo customer với budget để enforce quota

```
User đăng ký LobeChat (Better Auth)
  → User ID được tạo tự động (format: user_xxxxxxxxx)
  → Admin lấy User ID
  → Admin tạo customer trên LiteLLM với User ID đó
  → User chat → LiteLLM track + enforce budget
```

---

## Bước 1: User Đăng Ký LobeChat

### Option A: User tự đăng ký

User truy cập Tiny Hive URL → Sign up bằng:
- Email + password (mặc định)
- Magic link (nếu `AUTH_ENABLE_MAGIC_LINK=1`)
- SSO/OAuth (nếu config `AUTH_SSO_PROVIDERS`)

### Option B: Admin giới hạn ai được đăng ký

Set env var để chỉ cho phép email cụ thể:

```bash
# Cho phép cả domain
AUTH_ALLOWED_EMAILS=yourdomain.com

# Hoặc chỉ email cụ thể
AUTH_ALLOWED_EMAILS=alice@gmail.com,bob@company.com
```

---

## Bước 2: Lấy User ID

Sau khi user đăng ký, admin cần lấy User ID để tạo customer trên LiteLLM.

### Cách 1: Query database (nhanh nhất)

```bash
# Kết nối PostgreSQL
psql $DATABASE_URL

# Tìm user theo email
SELECT id, email, "fullName", "createdAt"
FROM users
WHERE email = 'alice@gmail.com';
```

Kết quả:
```
         id          |      email        | fullName | createdAt
---------------------+-------------------+----------+---------------------
 user_abc123def456   | alice@gmail.com   | Alice    | 2026-02-11 10:00:00
```

### Cách 2: Query qua kubectl (nếu dùng K3s)

```bash
kubectl exec -it deployment/postgresql -n tiny-hive -- \
  psql -U postgres -d lobechat -c \
  "SELECT id, email FROM users ORDER BY \"createdAt\" DESC LIMIT 10;"
```

### Cách 3: Xem tất cả users

```bash
SELECT id, email, "fullName", "createdAt", "lastActiveAt"
FROM users
ORDER BY "createdAt" DESC;
```

---

## Bước 3: Tạo Customer Trên LiteLLM

Dùng User ID từ bước 2 để tạo customer với budget.

### Option A: Qua LiteLLM UI

1. Truy cập LiteLLM Admin UI: `http://litellm:4000/ui`
2. Vào tab **Internal Users** hoặc **Customers**
3. Click **+ New Customer**
4. Điền:
   - **User ID**: `user_abc123def456` (copy từ bước 2)
   - **Max Budget**: `100` (USD)
   - **Budget Duration**: `30d` (hoặc `7d`, `1h`, v.v.)
5. Save

### Option B: Qua API

```bash
LITELLM_URL="http://litellm:4000"
MASTER_KEY="sk-your-master-key"

curl -X POST "$LITELLM_URL/customer/new" \
  -H "Authorization: Bearer $MASTER_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "user_abc123def456",
    "max_budget": 100,
    "budget_duration": "30d"
  }'
```

### Budget Duration Options

| Value | Nghĩa |
|-------|--------|
| `1h` | Reset mỗi giờ |
| `5h` | Reset mỗi 5 giờ |
| `1d` | Reset mỗi ngày |
| `7d` | Reset mỗi tuần |
| `30d` | Reset mỗi tháng |

---

## Bước 4: Verify

### Check customer info

```bash
curl "$LITELLM_URL/customer/info?end_user_id=user_abc123def456" \
  -H "Authorization: Bearer $MASTER_KEY"
```

### Check sau khi user chat

```bash
# Xem spend logs
curl "$LITELLM_URL/spend/logs?user_id=user_abc123def456" \
  -H "Authorization: Bearer $MASTER_KEY"
```

---

## Ví Dụ Theo Persona

### Team member (dùng hàng ngày)

```bash
curl -X POST "$LITELLM_URL/customer/new" \
  -H "Authorization: Bearer $MASTER_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "user_abc123def456",
    "max_budget": 100,
    "budget_duration": "30d"
  }'
```

### Trial user (dùng thử 7 ngày, budget thấp)

```bash
curl -X POST "$LITELLM_URL/customer/new" \
  -H "Authorization: Bearer $MASTER_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "user_trial789",
    "max_budget": 20,
    "budget_duration": "7d"
  }'
```

### Power user (budget cao)

```bash
curl -X POST "$LITELLM_URL/customer/new" \
  -H "Authorization: Bearer $MASTER_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "user_power999",
    "max_budget": 500,
    "budget_duration": "30d"
  }'
```

---

## Thay Đổi Budget Sau Này

### Tăng/giảm budget

```bash
curl -X POST "$LITELLM_URL/customer/update" \
  -H "Authorization: Bearer $MASTER_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "user_abc123def456",
    "max_budget": 200
  }'
```

### Hoặc qua LiteLLM UI

`/ui` → Customers tab → chọn user → Edit budget

---

## Khi User Bị Block (Hết Budget)

1. LiteLLM trả HTTP 429 cho request tiếp theo
2. LobeChat hiện error message cho user
3. Budget tự reset khi hết `budget_duration`
4. Hoặc admin tăng budget thủ công

---

## Xóa User

### Xóa customer trên LiteLLM

```bash
curl -X POST "$LITELLM_URL/customer/delete" \
  -H "Authorization: Bearer $MASTER_KEY" \
  -H "Content-Type: application/json" \
  -d '{"user_ids": ["user_abc123def456"]}'
```

> Xóa trên LiteLLM chỉ xóa quota tracking. Account LobeChat vẫn còn.
> User vẫn chat được nhưng không bị track/enforce budget nữa.

---

## Checklist Onboard User Mới

```
[ ] User đã đăng ký LobeChat thành công
[ ] Admin đã lấy User ID từ database
[ ] Admin đã tạo customer trên LiteLLM với budget phù hợp
[ ] User chat thử → verify spend được track trên LiteLLM
[ ] (Tùy chọn) Thông báo user biết budget bao nhiêu
```

---

## FAQ

**Q: User đăng ký nhưng admin chưa tạo customer trên LiteLLM?**
A: User vẫn chat bình thường. LiteLLM track spend nhưng không enforce budget (không block).

**Q: User ID ở đâu trong LiteLLM logs?**
A: Trong field `user` của mỗi request. Xem tại `/ui` → Usage tab.

**Q: Có cần restart LobeChat sau khi tạo customer?**
A: Không. LiteLLM check budget realtime mỗi request.

**Q: Muốn block user ngay lập tức?**
A: Set `max_budget: 0` cho customer đó, hoặc ban user trên LobeChat (Better Auth admin).
