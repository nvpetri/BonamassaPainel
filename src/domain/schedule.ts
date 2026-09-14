export function storeDate(value: number | string) {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).format(new Date(value));
}
export function needsEarlyConfirmation(store: {
  open: boolean; scheduleEnabled?: boolean; scheduledOpen?: boolean;
}) {
  return !store.open && !!store.scheduleEnabled && !store.scheduledOpen;
}
