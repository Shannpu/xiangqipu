/* Service Worker：全量离线缓存 */
var CACHE = 'xqp-v1';
var ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './js/app.js',
  './puzzles/puzzles.json',
  './lib/jquery.min.js',
  './lib/xiangqiboard.min.js',
  './lib/xiangqiboard.min.css',
  './lib/xiangqi.min.js',
  './engine/cchess.js',
  './engine/position.js',
  './engine/search.js',
  './engine/book.js'
];
var PIECES = ['bA','bB','bC','bK','bN','bP','bR','rA','rB','rC','rK','rN','rP','rR'];
PIECES.forEach(function (p) { ASSETS.push('./lib/pieces/' + p + '.svg'); });

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(ASSETS); }).then(function () {
    return self.skipWaiting();
  }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== CACHE; })
      .map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener('fetch', function (e) {
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then(function (r) {
    return r || fetch(e.request);
  }));
});
