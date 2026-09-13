import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import {
  applyCommand,
  stateSchema,
  type Command,
  type State,
} from "../domain/model";
import { createDemo } from "../domain/demo";

interface DemoDatabase extends DBSchema {
  state: { key: string; value: unknown };
}
export interface PanelRepository {
  read(): Promise<State>;
  execute(command: Command): Promise<State>;
  reset(): Promise<State>;
}

let database: Promise<IDBPDatabase<DemoDatabase>> | undefined;
function db() {
  if (!database) {
    database = openDB<DemoDatabase>("bonamassa-painel-demo", 1, {
      upgrade(database) {
        database.createObjectStore("state");
      },
      blocking(_current, _blocked, event) {
        (event.target as IDBDatabase).close();
        database = undefined;
      },
      terminated() {
        database = undefined;
      },
    });
    database.catch(() => {
      database = undefined;
    });
  }
  return database;
}

export const demoRepository: PanelRepository = {
  async read() {
    const database = await db();
    const transaction = database.transaction("state", "readwrite");
    const raw = await transaction.store.get("snapshot");
    if (raw !== undefined) {
      await transaction.done;
      return stateSchema.parse(raw);
    }
    const state = createDemo();
    await transaction.store.put(state, "snapshot");
    await transaction.done;
    return state;
  },
  async execute(command) {
    const database = await db();
    const transaction = database.transaction("state", "readwrite");
    try {
      const current = stateSchema.parse(
        await transaction.store.get("snapshot"),
      );
      const next = applyCommand(current, command);
      await transaction.store.put(next, "snapshot");
      await transaction.done;
      return next;
    } catch (error) {
      try {
        transaction.abort();
      } catch {
        /* Transaction may already have aborted. */
      }
      await transaction.done.catch(() => undefined);
      throw error;
    }
  },
  async reset() {
    const database = await db();
    const transaction = database.transaction("state", "readwrite");
    const previous = await transaction.store.get("snapshot");
    const revision = stateSchema.safeParse(previous);
    const state = createDemo();
    state.revision = revision.success ? revision.data.revision + 1 : 0;
    await transaction.store.put(state, "snapshot");
    await transaction.done;
    return state;
  },
};
