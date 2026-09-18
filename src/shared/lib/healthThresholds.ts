/**
 * Health Thresholds
 * 
 * Defines thresholds for medical measurements and functions to evaluate health status.
 * Status levels: Critical | Warning | Good | Excellent
 */

export type HealthStatusLevel = 'Critical' | 'Warning' | 'Good' | 'Excellent';

// For UI display purposes (legacy compatible)
export type HealthTrendStatus = 'Alert' | 'Warning' | 'Normal';

export interface BloodPressureValues {
  sys: number;
  dia: number;
  pulse?: number;
}

export interface SpO2Values {
  spo2: number;
  pulse?: number;
}

export interface GlucoseValues {
  mgdl: number;
}

export interface TemperatureValues {
  celsius: number;
}

/**
 * Blood Pressure Thresholds (American Heart Association)
 * 
 * Excellent (Normal): sys < 120 AND dia < 80
 * Good (Elevated): sys 120-129 AND dia < 80
 * Warning (High Stage 1): sys 130-139 OR dia 80-89
 * Critical (High Stage 2+): sys >= 140 OR dia >= 90
 * Also critical if too low: sys < 90 OR dia < 60
 */
export function evaluateBloodPressure(values: BloodPressureValues): HealthStatusLevel {
  const { sys, dia } = values;
  
  // Critical - too low
  if (sys < 90 || dia < 60) {
    return 'Critical';
  }
  
  // Critical - too high (Stage 2 hypertension or higher)
  if (sys >= 140 || dia >= 90) {
    return 'Critical';
  }
  
  // Warning - High Stage 1
  if (sys >= 130 || dia >= 80) {
    return 'Warning';
  }
  
  // Good - Elevated
  if (sys >= 120 && dia < 80) {
    return 'Good';
  }
  
  // Excellent - Normal
  return 'Excellent';
}

/**
 * SpO2 Thresholds
 * 
 * Excellent: 98-100%
 * Good: 95-97%
 * Warning: 90-94%
 * Critical: < 90%
 */
export function evaluateSpO2(values: SpO2Values): HealthStatusLevel {
  const { spo2 } = values;
  
  if (spo2 < 90) {
    return 'Critical';
  }
  
  if (spo2 < 95) {
    return 'Warning';
  }
  
  if (spo2 < 98) {
    return 'Good';
  }
  
  return 'Excellent';
}

/**
 * Blood Glucose Thresholds (mg/dL) - Fasting reference
 * 
 * Excellent: 70-99 mg/dL
 * Good: 100-125 mg/dL (prediabetic range)
 * Warning: 126-180 mg/dL (diabetic / high)
 * Critical: < 70 mg/dL (hypoglycemia) OR > 180 mg/dL (severe high)
 */
export function evaluateGlucose(values: GlucoseValues): HealthStatusLevel {
  const { mgdl } = values;
  
  // Critical - hypoglycemia or severe hyperglycemia
  if (mgdl < 70 || mgdl > 180) {
    return 'Critical';
  }
  
  // Warning - elevated diabetic range
  if (mgdl >= 126) {
    return 'Warning';
  }
  
  // Good - prediabetic
  if (mgdl >= 100) {
    return 'Good';
  }
  
  // Excellent - normal
  return 'Excellent';
}

/**
 * Temperature Thresholds (Celsius)
 * 
 * Excellent: 36.1-37.2°C
 * Good: 35.5-36.0°C or 37.3-37.7°C
 * Warning: 35.0-35.4°C or 37.8-38.5°C
 * Critical: < 35°C (hypothermia) or > 38.5°C (high fever)
 */
export function evaluateTemperature(values: TemperatureValues | Record<string, number>): HealthStatusLevel {
  const celsius = Number((values as TemperatureValues).celsius ?? (values as Record<string, number>).c);
  
  // Critical - hypothermia or high fever
  if (celsius < 35 || celsius > 38.5) {
    return 'Critical';
  }
  
  // Warning - low or fever
  if (celsius < 35.5 || celsius > 37.7) {
    return 'Warning';
  }
  
  // Good - slightly off normal
  if (celsius < 36.1 || celsius > 37.2) {
    return 'Good';
  }
  
  // Excellent - normal body temperature
  return 'Excellent';
}

/**
 * Get color for health status level
 */
export function getStatusColor(status: HealthStatusLevel): string {
  switch (status) {
    case 'Critical':
      return '#ef4444'; // red
    case 'Warning':
      return '#f59e0b'; // amber
    case 'Good':
      return '#16a34a'; // green
    case 'Excellent':
      return '#3b82f6'; // blue
  }
}

/**
 * Get background color for health status level
 */
export function getStatusBgColor(status: HealthStatusLevel): string {
  switch (status) {
    case 'Critical':
      return '#fef2f2';
    case 'Warning':
      return '#fffbeb';
    case 'Good':
      return '#f0fdf4';
    case 'Excellent':
      return '#eff6ff';
  }
}

/**
 * Convert HealthStatusLevel to HealthTrendStatus (for HomeScreen widget)
 */
export function toTrendStatus(status: HealthStatusLevel): HealthTrendStatus {
  switch (status) {
    case 'Critical':
      return 'Alert';
    case 'Warning':
      return 'Warning';
    case 'Good':
    case 'Excellent':
      return 'Normal';
  }
}

/**
 * Get overall status from an array of individual statuses
 * Returns the worst status found
 */
export function getOverallStatus(statuses: HealthStatusLevel[]): HealthStatusLevel {
  const validStatuses = statuses.filter(s => s);
  if (validStatuses.length === 0) return 'Good';
  
  if (validStatuses.includes('Critical')) return 'Critical';
  if (validStatuses.includes('Warning')) return 'Warning';
  if (validStatuses.includes('Good')) return 'Good';
  return 'Excellent';
}

/**
 * Get message for overall status
 */
export function getStatusMessage(status: HealthStatusLevel, hasDevices: boolean): string {
  if (!hasDevices) {
    return 'Connect medical devices to monitor your health';
  }
  
  switch (status) {
    case 'Critical':
      return 'One or more readings require immediate attention';
    case 'Warning':
      return 'Some readings are outside normal range';
    case 'Good':
      return 'Your health metrics are within acceptable range';
    case 'Excellent':
      return 'All your health metrics are in excellent range';
  }
}

/**
 * Convert HealthStatusLevel to widget overall status
 */
export function toWidgetOverallStatus(status: HealthStatusLevel): 'ALERT' | 'WARNING' | 'GOOD' | 'EXCELLENT' {
  switch (status) {
    case 'Critical':
      return 'ALERT';
    case 'Warning':
      return 'WARNING';
    case 'Excellent':
      return 'EXCELLENT';
    case 'Good':
    default:
      return 'GOOD';
  }
}

/**
 * Generate alert title based on reading type and status
 */
export function getAlertTitle(type: 'bp' | 'spo2' | 'glucose' | 'temp' | 'bmi', status: HealthStatusLevel, lang: 'en' | 'th' = 'en'): string {
  if (lang === 'th') {
    const typeNamesTh = {
      bp: 'ความดันโลหิต',
      spo2: 'ระดับออกซิเจน',
      glucose: 'น้ำตาลในเลือด',
      temp: 'อุณหภูมิร่างกาย',
      bmi: 'ดัชนีมวลกาย',
    };
    const statusLabelsTh = {
      Critical: 'วิกฤต',
      Warning: 'ผิดปกติ',
      Good: 'ปกติ',
      Excellent: 'ดีเยี่ยม',
    };
    return `${typeNamesTh[type]}${statusLabelsTh[status]}`;
  }

  const typeNames = {
    bp: 'Blood Pressure',
    spo2: 'Oxygen Level',
    glucose: 'Blood Glucose',
    temp: 'Temperature',
    bmi: 'BMI',
  };
  
  const statusLabels = {
    Critical: 'Critical',
    Warning: 'Abnormal',
    Good: 'Good',
    Excellent: 'Excellent',
  };
  
  return `${statusLabels[status]} ${typeNames[type]} Reading`;
}

/**
 * Generate alert message based on reading type, status, and values
 */
export function getAlertMessage(
  type: 'bp' | 'spo2' | 'glucose' | 'temp' | 'bmi',
  status: HealthStatusLevel,
  values: Record<string, number>,
  lang: 'en' | 'th' = 'en'
): string {
  if (lang === 'th') {
    switch (type) {
      case 'bp': {
        const { sys, dia } = values;
        if (status === 'Critical') {
          if (sys < 90 || dia < 60) {
            return `ความดันโลหิตของคุณ (${sys}/${dia} mmHg) ต่ำผิดปกติ ควรปรึกษาแพทย์`;
          }
          return `ความดันโลหิตของคุณ (${sys}/${dia} mmHg) สูงวิกฤต กรุณาพบแพทย์หากมีอาการ`;
        }
        if (status === 'Warning') {
          return `ความดันโลหิตของคุณ (${sys}/${dia} mmHg) สูงกว่าปกติ ควรพักผ่อนและติดตามอย่างใกล้ชิด`;
        }
        if (status === 'Good') {
          return `ความดันโลหิตของคุณ (${sys}/${dia} mmHg) สูงกว่าปกติเล็กน้อย แต่ยังอยู่ในเกณฑ์ที่ยอมรับได้`;
        }
        return `ความดันโลหิตของคุณ (${sys}/${dia} mmHg) อยู่ในเกณฑ์ปกติ`;
      }
      case 'spo2': {
        const { spo2 } = values;
        if (status === 'Critical') {
          return `ระดับออกซิเจนในเลือดของคุณ (${spo2}%) ต่ำอย่างอันตราย กรุณาพบแพทย์ทันที`;
        }
        if (status === 'Warning') {
          return `ระดับออกซิเจนในเลือดของคุณ (${spo2}%) ต่ำกว่าปกติ ควรติดตามอย่างใกล้ชิด`;
        }
        if (status === 'Good') {
          return `ระดับออกซิเจนในเลือดของคุณ (${spo2}%) อยู่ในเกณฑ์ที่ยอมรับได้`;
        }
        return `ระดับออกซิเจนในเลือดของคุณ (${spo2}%) ดีเยี่ยม`;
      }
      case 'glucose': {
        const { mgdl } = values;
        if (status === 'Critical') {
          if (mgdl < 70) {
            return `ระดับน้ำตาลในเลือดของคุณ (${mgdl} mg/dL) ต่ำเกินไป ควรรับประทานอาหารที่มีน้ำตาล`;
          }
          return `ระดับน้ำตาลในเลือดของคุณ (${mgdl} mg/dL) สูงมาก ควรปรึกษาแพทย์`;
        }
        if (status === 'Warning') {
          return `ระดับน้ำตาลในเลือดของคุณ (${mgdl} mg/dL) สูงกว่าปกติ ควรปรับเปลี่ยนอาหาร`;
        }
        if (status === 'Good') {
          return `ระดับน้ำตาลในเลือดของคุณ (${mgdl} mg/dL) สูงกว่าปกติเล็กน้อย แต่ยังยอมรับได้`;
        }
        return `ระดับน้ำตาลในเลือดของคุณ (${mgdl} mg/dL) อยู่ในเกณฑ์ปกติ`;
      }
      case 'temp': {
        const celsius = Number(values.celsius ?? values.c);
        if (status === 'Critical') {
          if (celsius < 35) {
            return `อุณหภูมิร่างกายของคุณ (${celsius.toFixed(1)}°C) บ่งชี้ภาวะอุณหภูมิร่างกายต่ำ กรุณาให้ความอบอุ่นและพบแพทย์`;
          }
          return `อุณหภูมิร่างกายของคุณ (${celsius.toFixed(1)}°C) บ่งชี้ไข้สูง ควรรับประทานยาและปรึกษาแพทย์`;
        }
        if (status === 'Warning') {
          return `อุณหภูมิร่างกายของคุณ (${celsius.toFixed(1)}°C) อยู่นอกช่วงปกติ ควรติดตามการเปลี่ยนแปลง`;
        }
        if (status === 'Good') {
          return `อุณหภูมิร่างกายของคุณ (${celsius.toFixed(1)}°C) อยู่ในเกณฑ์ที่ยอมรับได้`;
        }
        return `อุณหภูมิร่างกายของคุณ (${celsius.toFixed(1)}°C) ปกติดี`;
      }
      case 'bmi': {
        const b = values.bmi;
        if (status === 'Critical') return `ค่าดัชนีมวลกาย (BMI ${b}) อยู่ในระดับที่ต้องระวัง ควรปรึกษาแพทย์`;
        if (status === 'Warning') return `ค่าดัชนีมวลกาย (BMI ${b}) อยู่นอกเกณฑ์ปกติ ควรปรึกษาแพทย์เรื่องการดูแลน้ำหนัก`;
        if (status === 'Good') return `ค่าดัชนีมวลกาย (BMI ${b}) สูงกว่าเกณฑ์ปกติเล็กน้อย`;
        return `ค่าดัชนีมวลกาย (BMI ${b}) อยู่ในเกณฑ์สุขภาพดี`;
      }
    }
  }

  switch (type) {
    case 'bp': {
      const { sys, dia } = values;
      if (status === 'Critical') {
        if (sys < 90 || dia < 60) {
          return `Your blood pressure (${sys}/${dia} mmHg) is unusually low. Consider consulting a healthcare provider.`;
        }
        return `Your blood pressure (${sys}/${dia} mmHg) is critically high. Please seek medical attention if symptoms occur.`;
      }
      if (status === 'Warning') {
        return `Your blood pressure (${sys}/${dia} mmHg) is elevated. Monitor closely and consider lifestyle adjustments.`;
      }
      if (status === 'Good') {
        return `Your blood pressure (${sys}/${dia} mmHg) is slightly elevated but within acceptable range.`;
      }
      return `Your blood pressure (${sys}/${dia} mmHg) is within healthy range.`;
    }
    
    case 'spo2': {
      const { spo2 } = values;
      if (status === 'Critical') {
        return `Your oxygen level (${spo2}%) is dangerously low. Seek immediate medical attention.`;
      }
      if (status === 'Warning') {
        return `Your oxygen level (${spo2}%) is below normal. Monitor closely and consider seeking medical advice.`;
      }
      if (status === 'Good') {
        return `Your oxygen level (${spo2}%) is acceptable.`;
      }
      return `Your oxygen level (${spo2}%) is excellent.`;
    }
    
    case 'glucose': {
      const { mgdl } = values;
      if (status === 'Critical') {
        if (mgdl < 70) {
          return `Your blood glucose (${mgdl} mg/dL) is too low. Consider eating something with sugar.`;
        }
        return `Your blood glucose (${mgdl} mg/dL) is very high. Monitor closely and consult your healthcare provider.`;
      }
      if (status === 'Warning') {
        return `Your blood glucose (${mgdl} mg/dL) is elevated. Consider dietary adjustments.`;
      }
      if (status === 'Good') {
        return `Your blood glucose (${mgdl} mg/dL) is slightly elevated but acceptable.`;
      }
      return `Your blood glucose (${mgdl} mg/dL) is within healthy range.`;
    }
    
    case 'temp': {
      const celsius = Number(values.celsius ?? values.c);
      if (status === 'Critical') {
        if (celsius < 35) {
          return `Your body temperature (${celsius.toFixed(1)}°C) indicates hypothermia. Seek warmth and medical attention.`;
        }
        return `Your body temperature (${celsius.toFixed(1)}°C) indicates high fever. Consider taking medication and consulting a doctor.`;
      }
      if (status === 'Warning') {
        return `Your body temperature (${celsius.toFixed(1)}°C) is outside normal range. Monitor for changes.`;
      }
      if (status === 'Good') {
        return `Your body temperature (${celsius.toFixed(1)}°C) is acceptable.`;
      }
      return `Your body temperature (${celsius.toFixed(1)}°C) is normal.`;
    }

    case 'bmi': {
      const b = values.bmi;
      if (status === 'Critical') {
        return `Your BMI (${b}) is in a critical range. Please consult your clinician about a weight-management plan.`;
      }
      if (status === 'Warning') {
        return `Your BMI (${b}) is outside the healthy range. Consider a weight-management plan with your clinician.`;
      }
      if (status === 'Good') {
        return `Your BMI (${b}) is slightly above the healthy range. Regular activity and balanced meals can help.`;
      }
      return `Your BMI (${b}) is within the healthy range.`;
    }
  }
}

/**
 * Format reading text for display
 */
export function formatReadingText(type: 'bp' | 'spo2' | 'glucose' | 'temp' | 'bmi', values: Record<string, number>): string {
  switch (type) {
    case 'bp':
      return values.pulse
        ? `${values.sys}/${values.dia} mmHg • ${values.pulse} bpm`
        : `${values.sys}/${values.dia} mmHg`;
    case 'spo2':
      return values.pulse
        ? `${values.spo2}% / ${values.pulse} bpm`
        : `${values.spo2}%`;
    case 'glucose':
      return `${values.mgdl} mg/dL`;
    case 'temp': {
      const celsius = Number(values.celsius ?? values.c);
      return Number.isFinite(celsius) ? `${celsius.toFixed(1)}°C` : '';
    }
    case 'bmi':
      return Number.isFinite(values.kg) && values.kg > 0
        ? `BMI ${values.bmi} • ${values.kg} kg`
        : `BMI ${values.bmi}`;
  }
}

/**
 * Get device name for a reading type
 */
export function getDeviceNameForType(type: 'bp' | 'spo2' | 'glucose' | 'temp' | 'bmi'): string {
  switch (type) {
    case 'bp':
      return 'Blood Pressure Monitor';
    case 'spo2':
      return 'Pulse Oximeter';
    case 'glucose':
      return 'Glucose Meter';
    case 'temp':
      return 'Thermometer';
    case 'bmi':
      return 'Body Fat Scale';
  }
}
