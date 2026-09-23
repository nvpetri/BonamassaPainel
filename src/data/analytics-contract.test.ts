import { describe, expect, it } from "vitest";
import {
  calendarLabel,
  periodSchema,
  recentPeriod,
} from "./analytics-contract";

describe("períodos do dashboard", () => {
  it("usa o calendário de São Paulo mesmo quando UTC já virou o dia", () => {
    expect(recentPeriod(Date.parse("2026-10-01T02:59:59Z"), 7)).toEqual({
      from: "2026-09-24",
      to: "2026-09-30",
    });
    expect(recentPeriod(Date.parse("2026-10-01T03:00:00Z"), 1)).toEqual({
      from: "2026-10-01",
      to: "2026-10-01",
    });
  });
  it("preserva anos bissextos e limita o intervalo inclusivo a 366 dias", () => {
    expect(recentPeriod(Date.parse("2024-03-01T15:00:00Z"), 2)).toEqual({
      from: "2024-02-29",
      to: "2024-03-01",
    });
    expect(
      periodSchema.safeParse({ from: "2024-01-01", to: "2024-12-31" }).success,
    ).toBe(true);
    for (const p of [
      { from: "2024-01-01", to: "2025-01-01" },
      { from: "2026-09-24", to: "2026-09-23" },
      { from: "2026-02-30", to: "2026-03-01" },
    ])
      expect(periodSchema.safeParse(p).success).toBe(false);
    expect(calendarLabel("2024-02-29")).toBe("29/02/2024");
  });
});
