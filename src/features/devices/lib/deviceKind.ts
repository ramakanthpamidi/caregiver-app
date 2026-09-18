/**
 * Classify BLE medical devices for Home vitals, BLE monitoring, and device list.
 * Yuwell often advertises only a model code (e.g. "Yuwell BO-YX310-434f") without
 * words like "oximeter" — match known model prefixes as well as keywords.
 */

export type VitalDeviceKind = 'Pressure' | 'Glucose' | 'Thermometer' | 'Oximeter' | 'Scale';
export type MeasurementDeviceKind = 'bp' | 'glucose' | 'temp' | 'spo2' | 'unknown';

export type DeviceLike = {
  device_type?: string | null;
  device_name?: string | null;
  factory_name?: string | null;
  display_name?: string | null;
  medical_device_type?: string | null;
  platform?: string | null;
};

function buildText(device: DeviceLike | null | undefined): string {
  if (!device) return '';
  return [
    device.medical_device_type,
    device.device_type,
    device.display_name,
    device.device_name,
    device.factory_name,
    device.platform,
  ]
    .map((v) => String(v || ''))
    .join(' ')
    .toLowerCase();
}

/** Strip common advertising suffixes like "-434f" / MAC fragments. */
function modelTokens(text: string): string[] {
  const compact = text.replace(/[^a-z0-9]+/gi, ' ').trim();
  return compact.split(/\s+/).filter(Boolean);
}

/**
 * Infer vital kind from free-form names / model codes.
 * Returns null when the device is not a known medical vital type.
 */
export function classifyVitalDeviceKind(device: DeviceLike | null | undefined): VitalDeviceKind | null {
  const text = buildText(device);
  if (!text.trim()) return null;

  // Explicit stored type / display labels first (add-device writes these).
  const explicitType = String(device?.medical_device_type || '').trim().toLowerCase();
  if (explicitType === 'thermometer' || explicitType.includes('thermometer') || explicitType.includes('temperature')) {
    return 'Thermometer';
  }
  if (explicitType === 'oximeter' || explicitType.includes('oximeter') || explicitType.includes('spo2')) {
    return 'Oximeter';
  }
  if (explicitType === 'pressure' || explicitType.includes('pressure')) {
    return 'Pressure';
  }
  if (explicitType === 'glucose' || explicitType.includes('glucose')) {
    return 'Glucose';
  }
  if (explicitType === 'scale' || explicitType.includes('scale') || explicitType.includes('weight')) {
    return 'Scale';
  }

  // Keyword pass. Thermometer before generic "temp" collisions with other words.
  if (
    text.includes('thermometer') ||
    text.includes('temperature') ||
    text.includes('infrared') ||
    (text.includes('temp') && !text.includes('attempt'))
  ) {
    return 'Thermometer';
  }
  if (
    text.includes('oximeter') ||
    text.includes('spo2') ||
    text.includes('oxygen') ||
    text.includes('pulse ox')
  ) {
    return 'Oximeter';
  }
  if (text.includes('pressure') || text.includes('blood pressure') || /\bbp\b/.test(text)) {
    return 'Pressure';
  }
  if (text.includes('glucose') || text.includes('blood glucose') || text.includes('glucometer')) {
    return 'Glucose';
  }
  if (
    text.includes('weight') ||
    text.includes('scale') ||
    text.includes('body fat') ||
    text.includes('ailink')
  ) {
    return 'Scale';
  }

  // Yuwell / vendor model-code heuristics (BLE localName often has no type words).
  // Oximeters: BO-YX*, YX*, BOYX*
  if (/\bbo[-\s]?yx\d*/i.test(text) || /\byx\d{2,}/i.test(text) || /\bboyx\d*/i.test(text)) {
    return 'Oximeter';
  }
  // BP: YE*, YE6*, BPM*
  if (/\bye\d{2,}/i.test(text) || /\bbpm\b/i.test(text)) {
    return 'Pressure';
  }
  // Glucose: bare numeric models like "582", "AG-6xx"
  if (/\b(582|ag[-\s]?\d+)\b/i.test(text)) {
    return 'Glucose';
  }
  // Thermometer: YT-*, YHT*, FT*, RT*, THP*, IR*, HT*
  if (
    /\byt[-\s]?\d+/i.test(text) ||
    /\byht[-\s]?\d+/i.test(text) ||
    /\bft[-\s]?[a-z]?\d+/i.test(text) ||
    /\brt[-\s]?\d+/i.test(text) ||
    /\bthp[-\s]?\d+/i.test(text) ||
    /\bir[-\s]?\d+/i.test(text) ||
    /\bht[-\s]?\d+/i.test(text)
  ) {
    return 'Thermometer';
  }

  // Token pass for compact names like "bo-yx310-434f" / "yt-1c"
  for (const token of modelTokens(text)) {
    if (/^bo-?yx/i.test(token) || /^yx\d+/i.test(token)) return 'Oximeter';
    if (/^ye\d+/i.test(token)) return 'Pressure';
    if (/^(yt|yht|ft|rt|thp|ir|ht)-?[a-z]?\d+/i.test(token)) return 'Thermometer';
  }

  return null;
}

export function vitalKindToMeasurementKind(kind: VitalDeviceKind | null): MeasurementDeviceKind {
  switch (kind) {
    case 'Pressure':
      return 'bp';
    case 'Glucose':
      return 'glucose';
    case 'Thermometer':
      return 'temp';
    case 'Oximeter':
      return 'spo2';
    default:
      return 'unknown';
  }
}

export function classifyMeasurementKind(device: DeviceLike | null | undefined): MeasurementDeviceKind {
  return vitalKindToMeasurementKind(classifyVitalDeviceKind(device));
}

/** Human label used when model catalog lookup fails at add-device time. */
export function inferMedicalDeviceTypeLabel(device: DeviceLike | null | undefined): string | undefined {
  const kind = classifyVitalDeviceKind(device);
  switch (kind) {
    case 'Oximeter':
      return 'Oximeter';
    case 'Pressure':
      return 'Pressure';
    case 'Glucose':
      return 'Glucose';
    case 'Thermometer':
      return 'Thermometer';
    case 'Scale':
      return 'Scale';
    default:
      return undefined;
  }
}

export function inferDisplayName(device: DeviceLike | null | undefined): string | undefined {
  const kind = classifyVitalDeviceKind(device);
  switch (kind) {
    case 'Oximeter':
      return 'Pulse Oximeter';
    case 'Pressure':
      return 'Blood Pressure Monitor';
    case 'Glucose':
      return 'Blood Glucose Meter';
    case 'Thermometer':
      return 'Infrared Thermometer';
    case 'Scale':
      return 'Weight Scale';
    default:
      return undefined;
  }
}
