export function extractNumber(code: string): number {
  const match = code.match(/\d+/);
  return match ? parseInt(match[0], 10) : 0;
}

export function extractPrefix(code: string): string {
  const match = code.match(/^[^\d]+/);
  return match ? match[0] : '';
}

export function compareCodes(a: string, b: string): number {
  const prefixA = extractPrefix(a).toLowerCase();
  const prefixB = extractPrefix(b).toLowerCase();
  
  if (prefixA !== prefixB) {
    return prefixA.localeCompare(prefixB);
  }
  
  const numA = extractNumber(a);
  const numB = extractNumber(b);
  
  if (numA !== numB) {
    return numA - numB;
  }
  
  return a.localeCompare(b);
}
