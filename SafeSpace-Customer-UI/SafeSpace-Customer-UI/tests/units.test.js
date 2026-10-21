// Sơ đồ tình trạng ô kho (src/lib/units.js) — Figma 14/10: 12 ô mỗi cơ sở
import test from "node:test";
import assert from "node:assert/strict";
import { createFacilities } from "../src/app/data/appSeed.js";
import { countBy, unitsFor } from "../src/shared/utils/units.js";

const kinds = (units) => units.map((u) => `${u.row}:${u.type}`);

test("mỗi cơ sở có 12 ô: dãy A cỡ M (4 thường + 2 lạnh), dãy B cỡ L (4 thường + 2 lạnh), giá khớp gói kho", () => {
  const facilities = createFacilities();
  for (const f of facilities) {
    const units = unitsFor(f);
    assert.equal(units.length, 12);
    assert.deepEqual(kinds(units), [
      "A:normal", "A:normal", "A:normal", "A:normal", "A:climate", "A:climate",
      "B:normal", "B:normal", "B:normal", "B:normal", "B:climate", "B:climate",
    ]);
    assert.ok(units.filter((u) => u.row === "A").every((u) => u.area === 15));
    assert.ok(units.filter((u) => u.row === "B").every((u) => u.area === 30));
    for (const u of units) assert.equal(u.monthly_rate, f.offers.find((o) => o.key === u.offer_key).monthly_rate);
  }
  const nlb = unitsFor(facilities[0]);
  assert.deepEqual(countBy(nlb), { FREE: 6, RENTED: 4, HELD: 1, SERVICE: 1 });
  assert.equal(nlb.find((u) => u.code === "K02").status, "RENTED");
  assert.equal(nlb.find((u) => u.code === "K12").position, "Tầng trệt · Dãy B");
});

test("dữ liệu backend: ô kho lấy đúng loại + cỡ từ bảng giá, số ô trống khớp /api/availability/check", async () => {
  const { mapCatalog } = await import("../src/shared/api/apiMappers.js");
  const unitTypes = [
    { unitTypeId: 1, typeName: "Kho thường M", area: 15, climateControlled: false, status: "ACTIVE" },
    { unitTypeId: 2, typeName: "Kho thường L", area: 30, climateControlled: false, status: "ACTIVE" },
    { unitTypeId: 3, typeName: "Kho lạnh M", area: 15, climateControlled: true, status: "ACTIVE" },
    { unitTypeId: 4, typeName: "Kho lạnh L", area: 30, climateControlled: true, status: "ACTIVE" },
  ];
  const rates = [1, 2, 3, 4].map((id) => ({ facilityId: 7, unitTypeId: id, monthlyRate: id * 500000 }));
  const { facilities } = mapCatalog({ facilities: [{ facilityId: 7, name: "SafeSpace Nhà Bè", address: "Nhà Bè, TP. Hồ Chí Minh", status: "ACTIVE" }], unitTypes, rates });
  const f = facilities[0];
  const units = unitsFor(f, { "ut-1": 2, "ut-2": 0, "ut-3": 1, "ut-4": 2 });
  assert.equal(units.length, 12);
  assert.deepEqual(units.map((u) => u.offer_key), ["ut-1", "ut-1", "ut-1", "ut-1", "ut-3", "ut-3", "ut-2", "ut-2", "ut-2", "ut-2", "ut-4", "ut-4"]);
  const free = (key) => units.filter((u) => u.offer_key === key && u.status === "FREE").length;
  assert.equal(free("ut-1"), 2);
  assert.equal(free("ut-2"), 0);
  assert.equal(free("ut-3"), 1);
  assert.equal(free("ut-4"), 2);
  assert.equal(units.find((u) => u.offer_key === "ut-2").area_label, "30 m²");
});

test("dữ liệu backend thiếu loại kho: ô vẫn gắn với một gói có thật", async () => {
  const { mapCatalog } = await import("../src/shared/api/apiMappers.js");
  const unitTypes = [{ unitTypeId: 9, typeName: "Kho thường M", area: 15, climateControlled: false, status: "ACTIVE" }];
  const { facilities } = mapCatalog({ facilities: [{ facilityId: 3, name: "SafeSpace Phú Xuân", address: "Quận 7, TP. Hồ Chí Minh", status: "ACTIVE" }], unitTypes, rates: [{ facilityId: 3, unitTypeId: 9, monthlyRate: 890000 }] });
  const units = unitsFor(facilities[0]);
  assert.equal(units.length, 12);
  assert.ok(units.every((u) => u.offer_key === "ut-9" && u.monthly_rate === 890000));
});

test("dữ liệu StorageUnit thực tế từ backend (GET /api/facilities/{id}/units): map đúng trạng thái DB", async () => {
  const facilities = createFacilities();
  const f = facilities[0];
  const realUnits = [
    { unitNumber: "K01", status: "AVAILABLE" },
    { unitNumber: "K02", status: "MAINTENANCE" },
    { unitNumber: "K03", status: "OCCUPIED" },
    { unitNumber: "K04", status: "RESERVED" },
    { unitNumber: "K05", status: "ASSIGNED" },
    { unitNumber: "K06", status: "INSPECTION" },
    { unitNumber: "K07", status: "RETURN_PENDING" },
    { unitNumber: "K08", status: "OUT_OF_SERVICE" },
    { unitNumber: "K09", status: "AVAILABLE" },
    { unitNumber: "K10", status: "AVAILABLE" },
    { unitNumber: "K11", status: "AVAILABLE" },
    { unitNumber: "K12", status: "AVAILABLE" },
  ];
  const units = unitsFor(f, null, realUnits);
  assert.equal(units.length, 12);
  assert.equal(units.find((u) => u.code === "K01").status, "FREE");
  assert.equal(units.find((u) => u.code === "K02").status, "SERVICE");
  assert.equal(units.find((u) => u.code === "K03").status, "RENTED");
  assert.equal(units.find((u) => u.code === "K04").status, "HELD");
  assert.equal(units.find((u) => u.code === "K05").status, "HELD");
  assert.equal(units.find((u) => u.code === "K06").status, "SERVICE");
  assert.equal(units.find((u) => u.code === "K07").status, "RENTED");
  assert.equal(units.find((u) => u.code === "K08").status, "SERVICE");
  assert.equal(units.find((u) => u.code === "K09").status, "FREE");
});

