export function isHardened(env?: Record<string, string | undefined>): boolean;
export function productionSettings(env?: Record<string, string | undefined>): { api: string; origin: string };
