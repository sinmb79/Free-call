import { describe, expect, it } from "vitest";
import { ModuleType } from "@iwootcall/shared";
import { buildDevSeedPlan } from "./dev-seed.js";

describe("buildDevSeedPlan", () => {
  it("creates deterministic demo data for enabled modules", () => {
    const plan = buildDevSeedPlan([
      ModuleType.FREECAB,
      ModuleType.FREEDRIVE
    ]);

    expect(plan.customer.phone).toBe("01099990001");
    expect(plan.customer.vehicles).toHaveLength(1);
    expect(plan.customer.favorites).toHaveLength(2);
    expect(plan.workers.map((worker) => worker.module)).toEqual([
      ModuleType.FREECAB,
      ModuleType.FREEDRIVE
    ]);
  });
});
