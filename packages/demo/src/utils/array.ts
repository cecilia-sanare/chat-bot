export function groupBy<T, K extends keyof T, V extends string | number | symbol = T[K] & (string | number | symbol)>(
  items: T[],
  key: K
): Partial<Record<V, T[]>> {
  return items.reduce<Partial<Record<V, T[]>>>((output, item) => {
    const groupKey = item[key] as V;

    if (output[groupKey]) {
      output[groupKey]!.push(item);
    } else {
      output[groupKey] = [item];
    }

    return output;
  }, {});
}
