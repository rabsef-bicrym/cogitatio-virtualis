// cogitatio-virtualis/cogitatio-terminal/components/Terminal/utils/deepMerge.ts

/**
 * Helper type for making deep partial types.
 * Each property of T is recursively made optional.
 */
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

/**
 * Type guard to check if a value is a plain object (excluding arrays).
 * @param item - The value to check.
 * @returns True if the item is a plain object, false otherwise.
 */
function isMergeableObject(item: unknown): item is Record<string, unknown> {
  return typeof item === 'object' && item !== null && !Array.isArray(item);
}

/**
 * Deeply merges two objects without using any `any` types.
 * - Primitive values in the source override those in the target.
 * - Nested objects are merged recursively.
 * - Arrays in the source replace those in the target.
 *
 * @param target - The base object.
 * @param source - The object containing updates.
 * @returns A new object resulting from deep merging source into target.
 */
export function deepMerge<T>(target: T, source: DeepPartial<T>): T {
  // If either target or source isn't a mergeable object, return source (overrides target)
  if (!isMergeableObject(target) || !isMergeableObject(source)) {
    return source as T;
  }

  // Create a shallow copy of the target to avoid mutations
  const result: Record<string, unknown> = { ...target };

  for (const key in source) {
    if (Object.prototype.hasOwnProperty.call(source, key)) {
      const sourceValue = source[key];
      const targetValue = (target as Record<string, unknown>)[key];

      if (isMergeableObject(sourceValue) && isMergeableObject(targetValue)) {
        // Recursively merge nested objects
        result[key] = deepMerge(
          targetValue,
          sourceValue as DeepPartial<typeof targetValue>,
        );
      } else {
        // For primitives and arrays, override the target value with the source value
        result[key] = sourceValue as T[Extract<keyof T, string>];
      }
    }
  }

  return result as T;
}
