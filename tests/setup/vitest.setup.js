// Newer Node versions ship an experimental global `localStorage` that shadows
// jsdom's and is unusable without --localstorage-file. Install a plain
// in-memory Storage so unit tests behave the same on every Node version.
class MemoryStorage {
  #items = new Map()
  get length() {
    return this.#items.size
  }
  key(index) {
    return [...this.#items.keys()][index] ?? null
  }
  getItem(key) {
    return this.#items.has(String(key)) ? this.#items.get(String(key)) : null
  }
  setItem(key, value) {
    this.#items.set(String(key), String(value))
  }
  removeItem(key) {
    this.#items.delete(String(key))
  }
  clear() {
    this.#items.clear()
  }
}

for (const name of ['localStorage', 'sessionStorage']) {
  Object.defineProperty(globalThis, name, {
    value: new MemoryStorage(),
    configurable: true,
    writable: true,
  })
}
