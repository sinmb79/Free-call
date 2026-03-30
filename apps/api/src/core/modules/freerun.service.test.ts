import { describe, expect, it } from "vitest";
import { optimizeStops, type RunStop } from "./freerun.service.js";

describe("FreeRun stop optimization", () => {
  it("orders stops by nearest-neighbor distance from the origin", () => {
    const stops: RunStop[] = [
      {
        lat: 37.503,
        lng: 127.003,
        address: "Stop C",
        recipientPhone: "01000000003",
        itemDesc: "Third"
      },
      {
        lat: 37.5005,
        lng: 127.0005,
        address: "Stop A",
        recipientPhone: "01000000001",
        itemDesc: "First"
      },
      {
        lat: 37.5015,
        lng: 127.0015,
        address: "Stop B",
        recipientPhone: "01000000002",
        itemDesc: "Second"
      }
    ];

    const optimized = optimizeStops(37.5, 127, stops);

    expect(optimized.map((stop) => stop.address)).toEqual([
      "Stop A",
      "Stop B",
      "Stop C"
    ]);
    expect(optimized.map((stop) => stop.seq)).toEqual([1, 2, 3]);
  });
});
