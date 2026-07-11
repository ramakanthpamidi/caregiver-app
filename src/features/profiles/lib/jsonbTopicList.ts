function cleanList(values: any[]): string[] {
  return values
    .map((item) => String(item ?? '').trim())
    .filter((item) => item.length > 0);
}

export function parseJsonbTopicList(value: any): string[] {
  if (Array.isArray(value)) {
    const cleaned = cleanList(value);
    return cleaned.length > 0 ? cleaned : [''];
  }

  if (typeof value === 'string') {
    const raw = value.trim();
    if (!raw) return [''];

    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        const cleaned = cleanList(parsed);
        return cleaned.length > 0 ? cleaned : [''];
      }
    } catch {
      // Ignore parse errors and continue with plain-string handling.
    }

    const split = raw
      .split(/\r?\n|,/) // Backward compatibility for old comma/newline text entries.
      .map((item) => item.trim())
      .filter((item) => item.length > 0);

    if (split.length > 1) return split;
    return [raw];
  }

  if (value && typeof value === 'object' && Array.isArray((value as any).items)) {
    const cleaned = cleanList((value as any).items);
    return cleaned.length > 0 ? cleaned : [''];
  }

  return [''];
}

export function serializeJsonbTopicList(values: string[]): string[] | null {
  const cleaned = values
    .map((item) => String(item ?? '').trim())
    .filter((item) => item.length > 0);

  return cleaned.length > 0 ? cleaned : null;
}
