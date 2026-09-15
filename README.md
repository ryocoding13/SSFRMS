# SafeSpace Customer UI — API Integration Walkthrough

## Architecture: Smart Fallback Mode

The app uses a **graceful dual-mode** approach:

```
┌─────────────────────────────────────────────────────────────┐
│  App Startup (CustomerApp.jsx)                              │
│  ──────────────────────────────────────────────────────     │
│  1. loadServerData() → GET /api/facilities, /unit-types     │
│     ├── Success → isLiveApi = true, load real data          │
│     └── Failure → isLiveApi = false, keep demo data         │
│                                                             │
│  command() dispatcher:                                      │
│    ├── isLiveApi && authenticated → call API service        │
│    ├── isLiveApi && not authenticated → prompt AuthModal    │
│    └── fallback → local reduceCustomer (demo mode)          │
└─────────────────────────────────────────────────────────────┘
```

**Result:** The app works fully in demo mode when the backend is offline, and auto-upgrades to live mode when the backend responds.

---

## Auth Flow

1. User clicks **"Đăng nhập / Đăng ký"** in header or sidebar
2. `AuthModal` opens with Login/Register tabs
3. On success: JWT saved to `localStorage` under `safespace_auth_token`
4. All subsequent API calls automatically include `Authorization: Bearer <token>` via `apiClient.js`
5. On 401 response: token is cleared, user is prompted to log in again
6. Logout: `POST /api/auth/logout` → token cleared → data refreshed to public-only state

---

## Breadcrumb Status Tag

| State | Display |
|-------|---------|
| Backend offline / not reached | `BẢN DEMO UI` (grey) |
| Backend reachable, live API connected | `● KẾT NỐI API .NET` (green) |

---

## Validation Results

| Check | Result |
|-------|--------|
| `npm run build` | ✅ 0 errors, 46 modules transformed |
| `npm test` | ✅ 9/9 tests pass |
| API service structure | ✅ All 7 endpoints groups covered |
| Auth token injection | ✅ Automatic via apiClient.js |
| Loading states | ✅ Spinner on mount, "Đang gửi..." on form submits |
| ID type coercion | ✅ String() wrapping on all .find() calls |
| Demo fallback | ✅ App works offline with full demo data |

---

## Next Steps (Manual Verification)

1. **Start the backend**: `dotnet run --project StorageProject.Api`
2. **Start the frontend**: `npm run dev` in `SafeSpace-Customer-UI/`
3. Open `http://127.0.0.1:5173` — breadcrumb should show **"● KẾT NỐI API .NET"** in green
4. Click **Đăng ký tài khoản**, create a new customer account
5. Verify the following flows end-to-end:
   - Find Storage → Check availability → Book → View reservation
   - View Contracts → Renew / Request return
   - Support Tickets → Create → View status → Cancel
   - Appointments → Confirm handover (after staff confirms)

> [!NOTE]
> The **"Thanh toán" (Payment notice)** flow remains UI-only for now — the backend has GET payment endpoints but no customer-facing payment submission endpoint. The notice modal still works as a staff-communication mechanism.



