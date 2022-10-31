/**
 * Copyright 2022 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     https://www.apache.org/licenses/LICENSE-2.0
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
function objectArrayRemoveDuplicatesByKey(arr, key) {
  const hashMap = {};

  arr.forEach((item) => {
    hashMap[item[key]] = item;
  });

  return Object.values(hashMap);
}

/**
 * Cache a function value with lazy evaluation.
 *
 * @param {Function} getValue 
 * @return {Object}
 */
function lazy(getValue) {
  let res;
  return () => {
    if (!res) {
      res = getValue();
    }
    return res;
  }
}

/**
 * Perform a deep copy.
 *
 * @param {Object} 
 * @return {Object}
 */
function copy(object) {
  return JSON.parse(JSON.stringify(object));
}