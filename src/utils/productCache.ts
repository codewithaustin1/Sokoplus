import { Product } from "../types";

const cache = new Map<string, Product>();

export const productCache = {
  get(id: string): Product | undefined {
    return cache.get(id);
  },
  set(id: string, product: Product): void {
    cache.set(id, product);
  },
  has(id: string): boolean {
    return cache.has(id);
  },
  clear(): void {
    cache.clear();
  },
};
