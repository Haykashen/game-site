import type { GameWithStatsDto, Paginated } from '@discvault/shared';

export interface CatalogPageState {
  items: GameWithStatsDto[];
  total: number;
  page: number;
  hasMore: boolean;
  loading: boolean;
  error: string | null;
}
type PageLoader = (page: number, signal: AbortSignal) => Promise<Paginated<GameWithStatsDto>>;

/** One request at a time, retry the same failed page, discard aborted responses. */
export class CatalogPager {
  private state: CatalogPageState = {items: [], total: 0, page: 0, hasMore: true, loading: false, error: null};
  private listeners = new Set<() => void>();
  private controller: AbortController | null = null;
  private generation = 0;
  constructor(private load: PageLoader) {}
  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => {this.listeners.add(listener); return () => {this.listeners.delete(listener);};};
  private publish(state: CatalogPageState) {
    this.state = state;
    this.listeners.forEach((listener) => listener());
  }
  loadNext = async () => {
    if (this.state.loading || !this.state.hasMore) return;
    const controller = new AbortController();
    this.controller = controller;
    const generation = ++this.generation;
    const page = this.state.page + 1;
    this.publish({...this.state, loading: true, error: null});
    try {
      const result = await this.load(page, controller.signal);
      if (controller.signal.aborted || generation !== this.generation) return;
      if (result.page !== page || !Array.isArray(result.items) || !Number.isInteger(result.total) || result.total < 0 || typeof result.hasMore !== 'boolean') {
        throw new Error('Сервер вернул некорректную страницу каталога.');
      }
      const existing = new Set(this.state.items.map((item) => item.id));
      const additions = result.items.filter((item) => {
        if (existing.has(item.id)) return false;
        existing.add(item.id); return true;
      });
      if (result.hasMore && !additions.length) throw new Error('Сервер повторил страницу каталога. Повторите загрузку.');
      this.publish({items: [...this.state.items, ...additions], total: result.total, page, hasMore: result.hasMore, loading: false, error: null});
    } catch (cause) {
      if (controller.signal.aborted || generation !== this.generation) return;
      this.publish({...this.state, loading: false, error: cause instanceof Error ? cause.message : 'Не удалось загрузить игры.'});
    }
  };
  dispose = () => {
    this.generation += 1;
    this.controller?.abort();
    if (this.state.loading) this.publish({...this.state, loading: false});
  };
  refresh = async () => {
    this.dispose();
    this.publish({items: [], total: 0, page: 0, hasMore: true, loading: false, error: null});
    await this.loadNext();
  };
}
