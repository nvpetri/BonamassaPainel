import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import {
  applyCommand,
  migrateState,
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
    database = openDB<DemoDatabase>("bonamassa-painel-demo", 2, {
      upgrade(database, oldVersion) {
        if (oldVersion < 1) database.createObjectStore("state");
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
    try {
      const raw = await transaction.store.get("snapshot");
      const state = raw === undefined ? createDemo() : migrateState(raw);
      if (raw === undefined || (raw as { schema?: number }).schema !== 2)
        await transaction.store.put(state, "snapshot");
      await transaction.done;
      return state;
    } catch (error) {
      try {
        transaction.abort();
      } catch {
        /* Already aborted. */
      }
      await transaction.done.catch(() => undefined);
      throw error;
    }
  },
  async execute(command) {
    const database = await db();
    const transaction = database.transaction("state", "readwrite");
    try {
      const current = migrateState(await transaction.store.get("snapshot"));
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
    const state = createDemo();
    try {
      state.revision = migrateState(previous).revision + 1;
    } catch {
      state.revision = 0;
    }
    await transaction.store.put(state, "snapshot");
    await transaction.done;
    return state;
  },
};
