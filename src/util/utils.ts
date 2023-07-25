/**
 * Copyright 2023 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *       http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * Remove Objects from Arrays of Objects by key.
 *
 * @param {Array<Object>} arr
 * @param {string} key
 */
export function objectArrayRemoveDuplicatesByKey(
  arr: Array<Record<string, unknown>>,
  key: string
) {
  const hashMap: Record<string, unknown> = {};

  arr.forEach(item => {
    hashMap[item[key] as string] = item;
  });

  return Object.values(hashMap);
}

/**
 * Cache a function value with lazy evaluation.
 *
 * @param {Function} getValue
 * @return {Object}
 */
export function lazy(getValue: Function) {
  let res: unknown;

  return () => {
    if (!res) {
      res = getValue();
    }
    return res;
  };
}

/**
 * Perform a deep copy.
 *
 * @param {Record<string, unknown>}
 * @return {Record<string, unknown>}
 */
export function copy(object: Record<string, unknown>) {
  return JSON.parse(JSON.stringify(object));
}
