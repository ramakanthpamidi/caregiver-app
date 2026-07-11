import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '../../profiles/api/profileApi';

const KEY_YUWELL_MODELS = 'yuwellModels.v1';

export type YuwellModel = {
  factory_name: string;
  display_name?: string | null;
  endpoint_uuid?: string | null;
};

function normalizeText(value: unknown): string {
  return String(value || '').trim();
}

function buildCandidates(factoryName: string): string[] {
  const base = normalizeText(factoryName);
  if (!base) return [];

  const candidates = [base, base.replace(/^Yuwell\s+/i, '')];
  if (base.indexOf('-') !== -1) {
    candidates.push(base.substring(0, base.lastIndexOf('-')));
  }
  if (base.indexOf(' ') !== -1) {
    candidates.push(base.substring(base.indexOf(' ') + 1));
  }

  return [...new Set(candidates.map(normalizeText).filter((v) => v.length > 0))];
}

function parseModels(raw: string | null): YuwellModel[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((row) => ({
        factory_name: normalizeText((row as any)?.factory_name),
        display_name: (row as any)?.display_name ? normalizeText((row as any).display_name) : null,
        endpoint_uuid: (row as any)?.endpoint_uuid ?? null,
      }))
      .filter((row) => row.factory_name.length > 0);
  } catch {
    return [];
  }
}

async function saveModels(models: YuwellModel[]): Promise<void> {
  await AsyncStorage.setItem(KEY_YUWELL_MODELS, JSON.stringify(models));
}

export async function getCachedYuwellModels(): Promise<YuwellModel[]> {
  const raw = await AsyncStorage.getItem(KEY_YUWELL_MODELS);
  return parseModels(raw);
}

export async function upsertCachedYuwellModel(model: YuwellModel): Promise<void> {
  const factoryName = normalizeText(model.factory_name);
  if (!factoryName) return;

  const existing = await getCachedYuwellModels();
  const next = [...existing];
  const index = next.findIndex((m) => normalizeText(m.factory_name).toLowerCase() === factoryName.toLowerCase());
  if (index >= 0) {
    next[index] = {
      ...next[index],
      factory_name: factoryName,
      display_name: model.display_name ? normalizeText(model.display_name) : null,
      endpoint_uuid: model.endpoint_uuid ?? null,
    };
  } else {
    next.push({
      factory_name: factoryName,
      display_name: model.display_name ? normalizeText(model.display_name) : null,
      endpoint_uuid: model.endpoint_uuid ?? null,
    });
  }
  await saveModels(next);
}

export async function findCachedYuwellModel(factoryName: string): Promise<YuwellModel | null> {
  const models = await getCachedYuwellModels();
  if (!models.length) return null;

  const candidates = buildCandidates(factoryName);
  if (!candidates.length) return null;

  for (const cand of candidates) {
    const exact = models.find((row) => normalizeText(row.factory_name).toLowerCase() === cand.toLowerCase());
    if (exact) return exact;
  }

  for (const cand of candidates) {
    const fuzzy = models.find((row) => normalizeText(row.factory_name).toLowerCase().includes(cand.toLowerCase()));
    if (fuzzy) return fuzzy;
  }

  return null;
}

export async function refreshYuwellModelCache(): Promise<number> {
  const resp = await fetch(`${API_BASE_URL}/yuwell/models`);
  if (!resp.ok) {
    throw new Error(`Failed to refresh Yuwell models (status ${resp.status})`);
  }

  const data = await resp.json();
  const models = Array.isArray(data?.models)
    ? data.models
        .map((row: any) => ({
          factory_name: normalizeText(row?.factory_name),
          display_name: row?.display_name ? normalizeText(row.display_name) : null,
          endpoint_uuid: row?.endpoint_uuid ?? null,
        }))
        .filter((row: YuwellModel) => row.factory_name.length > 0)
    : [];

  await saveModels(models);
  return models.length;
}

export async function resolveYuwellModel(factoryName: string): Promise<YuwellModel | null> {
  const fromCache = await findCachedYuwellModel(factoryName);
  if (fromCache) return fromCache;

  const resp = await fetch(`${API_BASE_URL}/yuwell/models/${encodeURIComponent(factoryName)}`);
  if (!resp.ok) return null;

  const data = await resp.json();
  const model = data?.model;
  if (!model?.factory_name) return null;

  const normalized: YuwellModel = {
    factory_name: normalizeText(model.factory_name),
    display_name: model.display_name ? normalizeText(model.display_name) : null,
    endpoint_uuid: model.endpoint_uuid ?? null,
  };

  await upsertCachedYuwellModel(normalized);
  return normalized;
}
