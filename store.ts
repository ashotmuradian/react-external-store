import * as immer from "immer";
import { useDebugValue, useMemo, useSyncExternalStore } from "react";
import shallowEqual from "./shallowEqual";

/**
 * <strong>note</strong>:
 *
 * store calls every subscribed selector every time data changes and
 * despite selectors' results being cached, it's still a good idea to keep them simple
 * and offload complex calculations from the selector to a different place.
 *
 * If the selector is complex, it's better to extract complex calculations into a separate
 * place, using `useMemo(...)` for example and leave the selector itself simple.
 *
 * @example:
 * // it's better to replace this somewhat complex selector
 * const [details] = useSomeStore(useCallback(state => ({
 *   summary: `${state.products.length} product${state.products.length === 1 ? "" : "s"}`,
 *   sum: state.products.reduce((partialSum, product) => partialSum + product.price * product.quantity, 0)
 * }), []));
 *
 * // with this combination of a simpler selector and a memoization
 * const [products] = useSomeStore(useCallback(state => state.products), []));
 * const details = useMemo(() => ({
 *   summary: `${products.length} product${products.length === 1 ? "" : "s"}`,
 *   sum: products.reduce((partialSum, product) => partialSum + product.price * product.quantity, 0)
 * }), [products]);
 *
 */

const nullStub = <T>() => null;

type Selector<TStore, TStateSelection> =
  TStore extends Store<infer TState>
    ? (state: TState) => TStateSelection
    : never;

export function useStore<TStore, TStateSelection>(
  store: TStore extends Store<infer TState> ? TStore : never,
  selector: Selector<TStore, TStateSelection>,
): [TStateSelection, TStore] {
  const getSnapshot = useMemo(() => {
    let curr: TStateSelection;
    return getSnapshotSelection;

    function getSnapshotSelection() {
      const next = selector(store.getState());

      if (shallowEqual(curr, next)) {
        return curr;
      }

      curr = next;
      return curr;
    }
  }, [store, selector]);

  const selection = useSyncExternalStore(
    store.subscribe,
    selector == null ? nullStub<TStateSelection> : getSnapshot,
    selector == null ? nullStub<TStateSelection> : getSnapshot,
  );

  useDebugValue(selection);

  return [selection as TStateSelection, store];
}

export interface StoreListener {
  (): void;
}

export type StoreDispatch<T> = ((x: T) => T) | ((x: T) => void);

export abstract class Store<T> {
  private readonly _listeners = new Set<StoreListener>();

  public abstract state: T;

  public getState = (): T => this.state;

  public setState = (dispatch: StoreDispatch<T>): void => {
    this.state = immer.produce(this.state, dispatch);
    this._listeners.forEach((listener) => listener());
  };

  public subscribe = (listener: StoreListener): StoreListener => {
    this._listeners.add(listener);
    return () => {
      this._listeners.delete(listener);
    };
  };
}

