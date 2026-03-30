export function cleanImageUrl(url: string): string {
  return url.replace(/^[\["]+|[\]"]+$/g, '');
}
