import { describe, expect, it } from "vitest";
import { needsEarlyConfirmation, storeDate } from "./schedule";
import { catalogSchema } from "../data/api-contract";
import { statusLabels, minutesWaiting, type Order } from "./model";

describe("horários e reservas", () => {
  it("pede confirmação somente ao abrir fora da programação", () => {
    expect(
      needsEarlyConfirmation({
        open: false,
        scheduleEnabled: true,
        scheduledOpen: false,
      }),
    ).toBe(true);
    expect(
      needsEarlyConfirmation({
        open: false,
        scheduleEnabled: true,
        scheduledOpen: true,
      }),
    ).toBe(false);
    expect(
      needsEarlyConfirmation({
        open: true,
        scheduleEnabled: true,
        scheduledOpen: false,
      }),
    ).toBe(false);
    expect(needsEarlyConfirmation({ open: false })).toBe(false);
  });
  it("formata a reserva no fuso de São Paulo", () => {
    expect(storeDate("2026-09-14T20:00:00Z")).toContain("17:00");
    expect(storeDate("2026-09-15T05:00:00Z")).toContain("02:00");
  });
  it("não conta a espera da reserva como atraso de produção", () => {
    expect(
      minutesWaiting(
        { status: "SCHEDULED", createdAt: 0 } as Order,
        86_400_000,
      ),
    ).toBe(0);
    expect(
      minutesWaiting(
        { status: "NEW", createdAt: 0, queuedAt: 60_000 } as Order,
        120_000,
      ),
    ).toBe(1);
    expect(statusLabels.SCHEDULED).toBe("Agendado");
  });
  it("contrato legado continua válido e não habilita reservas sozinho", () => {
    const c = catalogSchema.parse({
      store: {
        id: "s",
        slug: "bonamassa",
        name: "Bonamassa",
        open: false,
        deliveryFee: 700,
        driverFee: 800,
        version: 1,
      },
      products: [],
      promotions: [],
      serverTime: "2026-09-14T12:00:00Z",
    });
    expect(c.store.reservationsAvailable).toBe(false);
    expect(c.store.scheduleEnabled).toBe(false);
  });
});
