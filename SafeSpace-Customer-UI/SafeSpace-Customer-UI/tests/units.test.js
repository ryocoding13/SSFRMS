// Sơ đồ tình trạng ô kho (src/lib/units.js)
import test from "node:test";
import assert from "node:assert/strict";
import { createFacilities } from "../src/data/seed.js";
import { countBy, unitsFor } from "../src/lib/units.js";

test("mỗi cơ sở có 10 ô, giá khớp gói kho, cơ sở đầu theo đúng Figma", () => {
  const facilities = createFacilities();
  for (const f of facilities) {
    const units = unitsFor(f);
    assert.equal(units.length, 10);
    for (const u of units) assert.equal(u.monthly_rate, f.offers.find((o) => o.key === u.offer_key).monthly_rate);
    if (!f.has_climate) assert.ok(units.every((u) => u.type === "normal"));
  }
  const nlb = unitsFor(facilities[0]);
  assert.deepEqual(countBy(nlb), { FREE: 5, RENTED: 3, HELD: 1, SERVICE: 1 });
  assert.equal(nlb.find((u) => u.code === "K02").status, "RENTED");
});

test("dữ liệu backend: ô kho lấy loại kho từ bảng giá, số ô trống khớp /api/availability/check", async () => {
  const { mapCatalog } = await import("../src/api/mappers.js");
  const unitTypes = [
    { unitTypeId: 1, typeName: "Kho Mini S", area: 1, climateControlled: false, status: "ACTIVE" },
    { unitTypeId: 2, typeName: "Kho M", area: 4, climateControlled: true, status: "ACTIVE" },
    { unitTypeId: 3, typeName: "Kho L", area: 9, climateControlled: true, status: "ACTIVE" },
  ];
  const rates = [1, 2, 3].map((id) => ({ facilityId: 7, unitTypeId: id, monthlyRate: id * 500000 }));
  const { facilities } = mapCatalog({ facilities: [{ facilityId: 7, name: "SafeSpace Nhà Bè", address: "Nhà Bè, TP. Hồ Chí Minh", status: "ACTIVE" }], unitTypes, rates });
  const f = facilities[0];
  const units = unitsFor(f, { "ut-1": 2, "ut-2": 0, "ut-3": 1 });
  assert.equal(units.length, 10);
  assert.ok(units.every((u) => f.offers.some((o) => o.key === u.offer_key)), "mỗi ô gắn với một loại kho thật");
  const free = (key) => units.filter((u) => u.offer_key === key && u.status === "FREE").length;
  assert.equal(free("ut-1"), 2);
  assert.equal(free("ut-2"), 0);
  assert.equal(free("ut-3"), 1);
  assert.equal(units.find((u) => u.offer_key === "ut-1").area_label, "1 m²");
});
