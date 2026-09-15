import test from "node:test";
import assert from "node:assert/strict";
import {
  addMonths,
  validateBooking,
  reduceCustomer,
  today,
  addDays,
} from "../src/domain.js";
import { createDemoData } from "../src/data.js";
test("Calendar months clamp month-end, including leap years", () => {
  assert.equal(addMonths("2026-01-31", 1), "2026-02-28");
  assert.equal(addMonths("2028-01-31", 1), "2028-02-29");
  assert.equal(addMonths("2026-12-31", 2), "2027-02-28");
});
test("Reject past dates and fractional, missing or negative month periods", () => {
  assert.ok(
    validateBooking(
      { start_date: "2026-01-01", rental_period_months: 1 },
      "2026-01-02",
    ).start_date,
  );
  for (const m of ["", 0, -1, 1.5, 25])
    assert.ok(
      validateBooking(
        { start_date: "2026-01-02", rental_period_months: m },
        "2026-01-02",
      ).rental_period_months,
    );
});
test("Booking captures estimate and awaits assignment without manufacturing a payment", () => {
  const d = createDemoData();
  const next = reduceCustomer(d, {
    type: "BOOK",
    payload: {
      reservation_id: "new",
      facility_id: 1,
      unit_type_id: 1,
      start_date: today(),
      rental_period_months: 2,
    },
  });
  assert.equal(next.reservations[0].status, "PENDING_PAYMENT");
  assert.equal(next.reservations[0].estimated_amount, 1500000);
  assert.equal(next.payments.length, d.payments.length);
  assert.equal(next.contracts.length, d.contracts.length);
  assert.equal(d.reservations.length, 2);
});
test("Customer notification cannot mark a payment PAID or submit twice", () => {
  const d = createDemoData();
  const action = {
    type: "PAYMENT_NOTICE",
    payload: { id: d.payments[0].payment_id, method: "BANK_TRANSFER" },
  };
  const next = reduceCustomer(d, action);
  assert.equal(next.payments[0].status, "PENDING");
  assert.ok(next.paymentNotices[d.payments[0].payment_id]);
  assert.throws(() => reduceCustomer(next, action));
  assert.throws(() =>
    reduceCustomer(d, {
      ...action,
      payload: { id: "TT-2026-006", method: "CASH" },
    }),
  );
});
test("Renewal does not extend contract before manager approval/payment and rejects duplicates", () => {
  const d = createDemoData(),
    c = d.contracts[0],
    action = {
      type: "RENEW",
      payload: { contract_id: c.contract_id, months: 3 },
    };
  const next = reduceCustomer(d, action);
  assert.equal(next.contracts[0].end_date, c.end_date);
  assert.equal(next.renewals[0].status, "PENDING");
  assert.throws(() => reduceCustomer(next, action));
});
test("Return request stays pending and rejects past date / draft contract", () => {
  const d = createDemoData();
  assert.throws(() =>
    reduceCustomer(d, {
      type: "RETURN",
      payload: {
        contract_id: d.contracts[0].contract_id,
        date: addDays(today(), -1),
      },
    }),
  );
  assert.throws(() =>
    reduceCustomer(d, {
      type: "RETURN",
      payload: { contract_id: d.contracts[2].contract_id, date: today() },
    }),
  );
  const next = reduceCustomer(d, {
    type: "RETURN",
    payload: {
      contract_id: d.contracts[0].contract_id,
      date: today(),
      notes: "",
    },
  });
  assert.equal(next.contracts[0].status, "RETURN_PENDING");
  assert.equal(next.returnRequests[0].status, "PENDING");
});
test("Handover needs staff verification; customer cannot finish scheduled handover", () => {
  const d = createDemoData();
  assert.throws(() =>
    reduceCustomer(d, { type: "CONFIRM_HANDOVER", payload: { id: "BG-003" } }),
  );
  d.handovers[0].status = "VERIFIED";
  d.handovers[0].staff_confirmed = true;
  const next = reduceCustomer(d, {
    type: "CONFIRM_HANDOVER",
    payload: { id: "BG-003" },
  });
  assert.equal(next.handovers[0].customer_confirmed, true);
  assert.equal(next.contracts[2].status, "DRAFT");
});
test("Support binds customer and unit from owned contract, not caller unit_id", () => {
  const d = createDemoData();
  const next = reduceCustomer(d, {
    type: "TICKET",
    payload: {
      ticket_id: "test",
      contract_id: d.contracts[0].contract_id,
      unit_id: 999,
      issue_type: "LOCK",
      title: "Khóa bị kẹt",
      description: "Không mở được kho.",
    },
  });
  assert.equal(next.tickets[0].unit_id, d.contracts[0].unit_id);
  assert.equal(next.tickets[0].status, "OPEN");
  assert.throws(() =>
    reduceCustomer(d, {
      type: "TICKET",
      payload: {
        contract_id: "other",
        title: "Test",
        description: "Test",
        issue_type: "UNIT",
      },
    }),
  );
});
test("Cancellation allowed only before assignment and requires reason", () => {
  const d = createDemoData();
  assert.throws(() =>
    reduceCustomer(d, {
      type: "CANCEL_RESERVATION",
      payload: { id: "DC-2026-003", reason: "Test" },
    }),
  );
  assert.throws(() =>
    reduceCustomer(d, {
      type: "CANCEL_RESERVATION",
      payload: { id: "DC-2026-004", reason: " " },
    }),
  );
  assert.equal(
    reduceCustomer(d, {
      type: "CANCEL_RESERVATION",
      payload: { id: "DC-2026-004", reason: "Thay đổi kế hoạch" },
    }).reservations[1].status,
    "CANCELLED",
  );
});
