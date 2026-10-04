// Some Android recognizers append growing hypotheses as separate results.
// Collapse those prefixes before either rendering or interpreting the phrase.
// Independent chunks and repeated complete entries must remain separate.
export function assembleVoiceTranscript(results) {
  const chunks = [];
  for (const result of Array.from(results || [])) {
    const text = String(result?.[0]?.transcript || '').trim();
    if (!text) continue;
    const key = text.toLocaleLowerCase().replace(/ё/g, 'е').replace(/[^\p{L}\p{N}]/gu, '');
    if (!key) continue;
    let growthCount = 0;
    while (chunks.length) {
      const previous = chunks.at(-1);
      const words = previous.text.match(/[\p{L}\p{N}]+/gu) || [];
      const hypothesis = !previous.isFinal || previous.growthCount > 0 || words.length >= 2 || /^(я|i|eu|我)$/u.test(previous.key);
      const growing = hypothesis && key.length > previous.key.length && key.startsWith(previous.key);
      const repeated = key === previous.key && (!previous.isFinal || !result.isFinal || (words.length >= 2 && !/\p{N}/u.test(key)) || previous.growthCount >= 2);
      if (!growing && !repeated) break;
      growthCount += previous.growthCount + (growing ? 1 : 0);
      chunks.pop();
    }
    chunks.push({text, key, growthCount, isFinal: Boolean(result.isFinal)});
  }
  return chunks.map(chunk => chunk.text).join(' ');
}
