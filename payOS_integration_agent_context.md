# payOS VietQR Integration Context for Coding Agent

## 1. Purpose

This document is the implementation context for integrating **payOS VietQR** into a system with:

- **Backend:** .NET Web API
- **Frontend:** React
- **Database:** relational database accessed through EF Core / `AppDbContext`
- **Payment method:** payOS-generated VietQR
- **Payment confirmation:** payOS Webhook
- **Frontend status update:** polling the backend every 3 seconds

The intended business flow is **storage-unit reservation and payment**.

> Important: Treat this file as project context. Before changing existing project code, inspect the actual project structure, entities, enums, DbContext, configuration, and installed payOS SDK version. Do not blindly copy namespaces or method signatures from this document if the project differs.

---

# 2. Target Architecture

```text
┌──────────────┐
│ React Client │
└──────┬───────┘
       │
       │ 1. Create reservation + payment
       ▼
┌──────────────────┐
│ .NET Web API     │
│                  │
│ - Validate unit  │
│ - Create Pending │
│ - Call payOS SDK │
└──────┬───────────┘
       │
       │ Create payment link
       ▼
┌──────────────────┐
│ payOS Server     │
└──────┬───────────┘
       │
       │ Return:
       │ - orderCode
       │ - qrCode
       │ - checkoutUrl
       ▼
┌──────────────┐
│ React Client │
│ Show VietQR  │
└──────┬───────┘
       │
       │ Customer scans QR
       │ and transfers money
       ▼
┌──────────────────┐
│ payOS Server     │
└──────┬───────────┘
       │
       │ 2. Webhook
       ▼
┌────────────────────────────┐
│ .NET Web API               │
│                            │
│ - Verify webhook signature │
│ - Find reservation         │
│ - Set status = Paid        │
│ - Set unit = Occupied      │
└────────────┬───────────────┘
             │
             ▼
        ┌──────────┐
        │ Database │
        └──────────┘

React periodically calls:

GET /api/v1/reservations/{id}/status

until `isPaid = true`.
```

---

# 3. Business Rules

## Reservation lifecycle

The intended reservation states in this integration are:

```text
Available storage unit
        ↓
Create reservation
        ↓
Pending
        ↓
Customer pays
        ↓
payOS Webhook
        ↓
Paid
        ↓
Storage Unit = Occupied
```

When creating a reservation:

1. Find the requested storage unit.
2. Reject the request if the unit does not exist.
3. Reject the request if the unit is not `Available`.
4. Generate a unique `orderCode`.
5. Create a reservation with `Pending` status.
6. Save the reservation.
7. Create the payOS payment data.
8. Return payment information to React.

When the payment Webhook is received:

1. Verify the payOS Webhook signature.
2. Check that the payment code is `"00"`.
3. Find the reservation by `orderCode`.
4. Only process the reservation when it is still `Pending`.
5. Change reservation status to `Paid`.
6. Set `PaidAt`.
7. Change the associated storage unit to `Occupied`.
8. Save the changes.
9. Return HTTP success to payOS.

---

# 4. payOS Dashboard Configuration

Configure the payment channel in the payOS Dashboard.

Required configuration values:

```text
Client ID
API Key
Checksum Key
```

Webhook URL:

```text
https://api.yourdomain.com/api/v1/payments/payos-webhook
```

The Webhook URL must point to the public backend endpoint that receives payOS payment notifications.

Never commit real payment credentials to source control.

---

# 5. Backend Configuration

## 5.1 Install payOS SDK

For the .NET backend:

```bash
dotnet add package PayOS
```

The original implementation targets a modern .NET Web API project such as .NET 8/9/10.

---

## 5.2 `appsettings.json`

Expected configuration shape:

```json
{
  "PayOS": {
    "ClientId": "YOUR_CLIENT_ID",
    "ApiKey": "YOUR_API_KEY",
    "ChecksumKey": "YOUR_CHECKSUM_KEY"
  }
}
```

Use environment variables or a secure secret store for real credentials in development/production where appropriate.

---

# 6. Register payOS in `Program.cs`

Reference implementation:

```csharp
using NetcoreBooking.PayOS;

var builder = WebApplication.CreateBuilder(args);

PayOS payOS = new PayOS(
    builder.Configuration["PayOS:ClientId"]!,
    builder.Configuration["PayOS:ApiKey"]!,
    builder.Configuration["PayOS:ChecksumKey"]!
);

builder.Services.AddSingleton(payOS);

builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowReact", policy =>
    {
        policy.WithOrigins(
                "http://localhost:3000",
                "http://localhost:5173",
                "https://yourdomain.com"
              )
              .AllowAnyHeader()
              .AllowAnyMethod();
    });
});

var app = builder.Build();

app.UseCors("AllowReact");
```

### Agent instruction

Before implementing this code:

- Check the actual namespace used by the installed payOS SDK.
- Check the actual SDK constructor/API for the installed package version.
- Preserve the existing application's dependency-injection structure.
- Do not overwrite an existing CORS policy.
- Add the React origin to the existing configuration if one already exists.

---

# 7. API Contract

The integration uses three main backend endpoints.

| Method | Endpoint | Purpose |
|---|---|---|
| `POST` | `/api/v1/reservations/create-payos-qr` | Create reservation and payment QR |
| `POST` | `/api/v1/payments/payos-webhook` | Receive payment confirmation |
| `GET` | `/api/v1/reservations/{id}/status` | Check reservation payment status |

---

# 8. Endpoint 1 — Create Reservation + payOS QR

## Request

The endpoint receives a `CreateReservationDto`.

Expected business fields include:

```text
StorageUnitId
Amount
```

---

## Processing

Reference implementation:

```csharp
using NetcoreBooking.PayOS.Types;

app.MapPost("/api/v1/reservations/create-payos-qr", async (
    CreateReservationDto dto,
    AppDbContext db,
    PayOS payOS) =>
{
    // 1. Check storage unit availability
    var unit = await db.StorageUnits.FindAsync(dto.StorageUnitId);

    if (unit == null || unit.Status != StorageUnitStatus.Available)
        return Results.BadRequest(new
        {
            message = "Kho không sẵn sàng để đặt."
        });

    // 2. Generate unique orderCode
    long orderCode =
        long.Parse(
            DateTime.UtcNow.ToString("yyMMddHHmmss")
            + Random.Shared.Next(10, 99)
        );

    var reservation = new Reservation
    {
        Id = Guid.NewGuid(),
        OrderCode = orderCode,
        StorageUnitId = dto.StorageUnitId,
        Amount = dto.Amount,
        Status = ReservationStatus.Pending,
        CreatedAt = DateTime.UtcNow
    };

    db.Reservations.Add(reservation);
    await db.SaveChangesAsync();

    // 3. Build payOS payment data
    var item = new ItemData(
        $"Thue kho {unit.UnitNumber}",
        1,
        (int)dto.Amount
    );

    var paymentData = new PaymentData(
        orderCode: orderCode,
        amount: (int)dto.Amount,
        description: $"Dat kho {unit.UnitNumber}",
        items: new List<ItemData> { item },
        cancelUrl: "https://yourdomain.com/payment-cancel",
        returnUrl: "https://yourdomain.com/payment-success"
    );

    // 4. Create payment link / QR
    CreatePaymentResult createResult =
        await payOS.createPaymentLink(paymentData);

    return Results.Ok(new
    {
        reservationId = reservation.Id,
        orderCode = orderCode,
        checkoutUrl = createResult.checkoutUrl,
        qrCode = createResult.qrCode,
        amount = dto.Amount
    });
});
```

## Response shape

```json
{
  "reservationId": "GUID",
  "orderCode": 26093012345678,
  "checkoutUrl": "...",
  "qrCode": "...",
  "amount": 100000
}
```

The React client uses:

- `reservationId` for status polling.
- `qrCode` for the embedded QR.
- `checkoutUrl` as an alternative full payOS checkout page.
- `amount` for displaying the payment amount.
- `orderCode` as the payment reference.

---

# 9. Endpoint 2 — payOS Webhook

Endpoint:

```text
POST /api/v1/payments/payos-webhook
```

Reference implementation:

```csharp
app.MapPost("/api/v1/payments/payos-webhook", async (
    WebhookType webhookBody,
    AppDbContext db,
    PayOS payOS) =>
{
    try
    {
        // 1. Verify the payment Webhook signature
        WebhookData verifiedData =
            payOS.verifyPaymentWebhookData(webhookBody);

        // 2. "00" means successful payment
        if (webhookBody.code == "00" && verifiedData != null)
        {
            long orderCode = verifiedData.orderCode;

            // 3. Find pending reservation
            var reservation = await db.Reservations
                .Include(r => r.StorageUnit)
                .FirstOrDefaultAsync(
                    r =>
                        r.OrderCode == orderCode &&
                        r.Status == ReservationStatus.Pending
                );

            if (reservation != null)
            {
                // 4. Update reservation
                reservation.Status = ReservationStatus.Paid;
                reservation.PaidAt = DateTime.UtcNow;

                // 5. Occupy storage unit
                if (reservation.StorageUnit != null)
                {
                    reservation.StorageUnit.Status =
                        StorageUnitStatus.Occupied;
                }

                await db.SaveChangesAsync();
            }
        }

        return Results.Ok(new { success = true });
    }
    catch (Exception ex)
    {
        return Results.BadRequest(new
        {
            message = "Xác thực Webhook thất bại",
            error = ex.Message
        });
    }
});
```

## Critical Webhook rules

The Webhook is the source used to update the payment state in the database.

The backend must:

1. Verify the Webhook signature.
2. Use the verified `orderCode`.
3. Find the matching reservation.
4. Only transition a `Pending` reservation to `Paid`.
5. Update the storage unit as part of the same business operation.
6. Handle repeated Webhooks safely.

The `Pending` check is important because payment notifications may be received more than once.

---

# 10. Endpoint 3 — Reservation Payment Status

Endpoint:

```text
GET /api/v1/reservations/{id}/status
```

Reference implementation:

```csharp
app.MapGet(
    "/api/v1/reservations/{id:guid}/status",
    async (Guid id, AppDbContext db) =>
{
    var res = await db.Reservations.FindAsync(id);

    if (res == null)
        return Results.NotFound();

    return Results.Ok(new
    {
        status = res.Status.ToString(),
        isPaid = res.Status == ReservationStatus.Paid
    });
});
```

Response example:

```json
{
  "status": "Paid",
  "isPaid": true
}
```

---

# 11. React Frontend

Create a component similar to:

```text
PayOSEmbeddedModal.jsx
```

Its responsibilities are:

1. Display the payment amount.
2. Display the VietQR returned by the backend.
3. Allow the customer to open the full payOS checkout page.
4. Poll the reservation status every 3 seconds.
5. Stop polling when payment succeeds.
6. Show a success state.
7. Notify the parent component through `onSuccess`.
8. Allow the user to close the modal.

---

# 12. React Reference Implementation

```jsx
import React, { useEffect, useState } from 'react';
import axios from 'axios';

export default function PayOSEmbeddedModal({
  reservationData,
  onSuccess,
  onClose
}) {
  const [status, setStatus] = useState('Pending');

  useEffect(() => {
    if (status === 'Paid') return;

    const interval = setInterval(async () => {
      try {
        const res = await axios.get(
          `https://api.yourdomain.com/api/v1/reservations/${reservationData.reservationId}/status`
        );

        if (res.data.isPaid) {
          setStatus('Paid');
          clearInterval(interval);

          setTimeout(() => {
            onSuccess();
          }, 2000);
        }
      } catch (err) {
        console.error(
          'Lỗi khi kiểm tra trạng thái thanh toán:',
          err
        );
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [reservationData.reservationId, status, onSuccess]);

  return (
    <div className="modal-overlay">
      <div className="modal-content">

        <button
          className="close-btn"
          onClick={onClose}
        >
          ✕
        </button>

        {status === 'Pending' ? (
          <>
            <h2>Thanh toán qua VietQR</h2>

            <p className="amount-label">
              Số tiền:{' '}
              <strong>
                {reservationData.amount.toLocaleString()} VNĐ
              </strong>
            </p>

            <div className="qr-container">
              <img
                src={reservationData.qrCode}
                alt="Mã VietQR payOS"
                style={{
                  width: '260px',
                  height: '260px'
                }}
              />
            </div>

            <div className="payment-note">
              <p>
                Đang chờ hệ thống ghi nhận chuyển khoản...
              </p>

              <small>
                Mở ứng dụng Ngân hàng/Ví điện tử để quét mã QR trên.
              </small>
            </div>

            <a
              href={reservationData.checkoutUrl}
              target="_blank"
              rel="noreferrer"
              className="payos-link-btn"
            >
              Hoặc mở trang thanh toán payOS đầy đủ
            </a>
          </>
        ) : (
          <div className="success-container">
            <div className="success-icon">✓</div>

            <h3>Thanh toán thành công!</h3>

            <p>
              Kho của bạn đã được cập nhật trạng thái ĐÃ THUÊ.
            </p>
          </div>
        )}

      </div>
    </div>
  );
}
```

---

# 13. Frontend Payment Flow

```text
User clicks "Đặt kho"
        ↓
React POST
/api/v1/reservations/create-payos-qr
        ↓
Backend creates Pending reservation
        ↓
Backend creates payOS payment
        ↓
Backend returns qrCode + reservationId
        ↓
React displays QR
        ↓
User scans QR and transfers money
        ↓
payOS sends Webhook
        ↓
Backend verifies Webhook
        ↓
Reservation = Paid
Storage Unit = Occupied
        ↓
React polling detects isPaid = true
        ↓
Show "Thanh toán thành công"
        ↓
Call onSuccess()
```

---

# 14. Data Model Expectations

The reference implementation assumes entities similar to:

## Reservation

```text
Id
OrderCode
StorageUnitId
Amount
Status
CreatedAt
PaidAt
StorageUnit
```

## StorageUnit

```text
Id
UnitNumber
Status
```

## ReservationStatus

At minimum:

```text
Pending
Paid
```

## StorageUnitStatus

At minimum:

```text
Available
Occupied
```

The actual project may use different names. The agent must adapt the implementation to the existing domain model instead of creating duplicate entities.

---

# 15. Required API/Data Dependencies

The implementation expects the following concepts from the payOS SDK:

```text
PayOS
ItemData
PaymentData
CreatePaymentResult
WebhookType
WebhookData
```

Expected operations:

```text
createPaymentLink(...)
verifyPaymentWebhookData(...)
```

> SDK APIs can change between versions. Check the installed package version and its official documentation/source before resolving compilation errors or changing method names.

---

# 16. Security and Reliability Rules

## Credentials

Never place real values for:

```text
ClientId
ApiKey
ChecksumKey
```

inside committed source code.

Use configuration/secrets.

## Webhook

Never mark an order as paid solely because the frontend says that payment succeeded.

The backend should rely on the verified payOS Webhook to update the database.

## Idempotency

A Webhook may be received more than once.

Therefore:

```text
Pending → Paid
```

should be the valid payment transition.

If the reservation is already:

```text
Paid
```

the Webhook must not perform the payment transition again.

## Amount validation

The reservation amount stored in the database should be the authoritative business amount.

Do not blindly trust a client-provided amount if the actual application calculates the rental price on the server.

## Storage-unit concurrency

Two users must not be able to successfully reserve the same storage unit at the same time.

Before production implementation, inspect the existing reservation/availability logic and database constraints/transactions.

---

# 17. Important Implementation Notes for the Agent

When working on the existing project:

### Do

- Inspect existing `.NET` project structure first.
- Reuse the existing `DbContext`.
- Reuse existing `Reservation` and `StorageUnit` entities if they exist.
- Reuse existing enums/status values when possible.
- Reuse existing authentication/authorization middleware.
- Add payOS configuration without destroying existing configuration.
- Add endpoints following the existing API/controller architecture.
- Follow the existing frontend API service pattern.
- Keep payment credentials outside committed code.
- Verify the installed payOS SDK API before coding against it.

### Do not

- Create duplicate Reservation or StorageUnit entities without checking the existing model.
- Hardcode real API credentials.
- Mark a reservation as paid from the React frontend alone.
- Assume the payOS SDK method names are unchanged across versions.
- Replace existing CORS/authentication/database configuration unnecessarily.
- Expose API keys or checksum keys to React.
- Treat the `returnUrl` page as proof that payment was completed.

---

# 18. Suggested Implementation Order

Implement in this order:

```text
1. Inspect existing project
       ↓
2. Confirm Reservation / StorageUnit models
       ↓
3. Install / verify PayOS SDK
       ↓
4. Add PayOS configuration
       ↓
5. Register PayOS service
       ↓
6. Implement create-payment endpoint
       ↓
7. Test QR/payment response
       ↓
8. Implement Webhook endpoint
       ↓
9. Test Webhook verification
       ↓
10. Update Reservation + StorageUnit
       ↓
11. Implement status endpoint
       ↓
12. Build React payment modal
       ↓
13. Add polling
       ↓
14. Test complete payment flow
```

---

# 19. Expected End-to-End Result

The completed system should behave as follows:

```text
Customer selects available storage unit
                ↓
       Clicks "Đặt kho"
                ↓
Backend creates Pending Reservation
                ↓
       payOS creates payment
                ↓
React receives QR information
                ↓
      React displays VietQR
                ↓
Customer scans and pays
                ↓
      payOS sends Webhook
                ↓
Backend verifies Webhook
                ↓
Reservation becomes Paid
                ↓
Storage Unit becomes Occupied
                ↓
React polling detects Paid
                ↓
UI shows payment success
```

---

# 20. Reference Endpoint Summary

| Endpoint | Method | Caller | Main responsibility |
|---|---:|---|---|
| `/api/v1/reservations/create-payos-qr` | POST | React | Create Pending reservation and payOS payment |
| `/api/v1/payments/payos-webhook` | POST | payOS | Verify payment and update database |
| `/api/v1/reservations/{id}/status` | GET | React | Return current payment status |

---

# 21. Core Principle

The payment architecture should follow this separation:

```text
React
  │
  │ requests payment
  ▼
.NET API
  │
  │ creates payment
  ▼
payOS
  │
  │ confirms payment through Webhook
  ▼
.NET API
  │
  │ updates authoritative DB state
  ▼
Database
  │
  │ status polling
  ▼
React
```

**Frontend displays the payment UI.**

**payOS confirms the payment.**

**Backend owns the authoritative payment and reservation state.**

**Database stores the final business state.**
