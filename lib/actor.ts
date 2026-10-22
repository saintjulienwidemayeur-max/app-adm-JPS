// Who is doing the current action: set by act() for the whole action, read when a record is made (who scanned, made, loaded, received...).
import { AsyncLocalStorage } from "node:async_hooks";
import { actorRef } from "./wh-store";
const store = new AsyncLocalStorage<string>();
export const runAs = <T>(name: string, fn: () => T): T => store.run(name, fn);
export const actor = () => store.getStore() ?? "";
actorRef.get = actor;
