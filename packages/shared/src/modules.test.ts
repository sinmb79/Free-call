import { describe, expect, it } from "vitest";
import { MODULE_CONFIG, ModuleType } from "./index.js";

describe("MODULE_CONFIG", () => {
  it("includes all known module labels", () => {
    expect(MODULE_CONFIG[ModuleType.FREECAB].label).toBeTruthy();
    expect(MODULE_CONFIG[ModuleType.FREEDRIVE].label).toBeTruthy();
    expect(MODULE_CONFIG[ModuleType.FREECARGO].label).toBeTruthy();
    expect(MODULE_CONFIG[ModuleType.FREERUN].label).toBeTruthy();
    expect(MODULE_CONFIG[ModuleType.FREESHUTTLE].label).toBeTruthy();
  });

  it("starts with FreeShuttle disabled", () => {
    expect(MODULE_CONFIG[ModuleType.FREESHUTTLE].enabled).toBe(false);
  });

  it("starts with FreeCab enabled", () => {
    expect(MODULE_CONFIG[ModuleType.FREECAB].enabled).toBe(true);
  });
});
