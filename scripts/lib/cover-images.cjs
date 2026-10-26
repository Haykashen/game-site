// Stable priority: cover scans before shop renders, without discarding fallbacks.
function prioritizeImages(urls) {
  return [...new Set(urls.filter(Boolean))].sort((a,b) => Number(b.startsWith('https://showgames.ru/')) - Number(a.startsWith('https://showgames.ru/')));
}
module.exports = { prioritizeImages };
