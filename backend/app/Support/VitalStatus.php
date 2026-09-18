<?php

namespace App\Support;

class VitalStatus
{
    public const CRITICAL = 'critical';
    public const WARNING = 'warning';
    public const NORMAL = 'normal';

    /**
     * @param  array<string, mixed>  $payload
     * @return array{type: string, label: string, value: string, status: string}|null
     */
    public static function fromPayload(array $payload): ?array
    {
        $type = strtolower((string) ($payload['type'] ?? $payload['metric'] ?? ''));

        return match ($type) {
            'spo2' => self::spo2($payload),
            'bp', 'pressure' => self::bp($payload),
            'glucose', 'bg' => self::glucose($payload),
            'temp', 'temperature' => self::temp($payload),
            'weight', 'bmi' => self::weight($payload),
            default => match (true) {
                isset($payload['sys']) => self::bp($payload),
                isset($payload['spo2']) => self::spo2($payload),
                isset($payload['mgdl']) => self::glucose($payload),
                isset($payload['celsius']) => self::temp($payload),
                isset($payload['kg']) => self::weight($payload),
                default => null,
            },
        };
    }

    /**
     * @param  list<string>  $statuses
     */
    public static function overall(array $statuses): string
    {
        if (in_array(self::CRITICAL, $statuses, true)) {
            return self::CRITICAL;
        }
        if (in_array(self::WARNING, $statuses, true)) {
            return self::WARNING;
        }
        if ($statuses === []) {
            return 'none';
        }

        return self::NORMAL;
    }

    public static function display(string $status): string
    {
        return match ($status) {
            self::CRITICAL => __('admin.status.critical'),
            self::WARNING => __('admin.status.warning'),
            self::NORMAL => __('admin.status.normal'),
            default => __('admin.status.none'),
        };
    }

    /**
     * @param  array<string, mixed>  $p
     * @return array{type: string, label: string, value: string, status: string}|null
     */
    private static function spo2(array $p): ?array
    {
        $v = self::num($p['spo2'] ?? null);
        if ($v === null) {
            return null;
        }
        $status = $v < 90 ? self::CRITICAL : ($v < 95 ? self::WARNING : self::NORMAL);
        $pulse = self::num($p['pulse'] ?? null);
        $value = $pulse !== null ? "{$v}% / {$pulse} bpm" : "{$v}%";

        return ['type' => 'spo2', 'label' => 'SpO2', 'value' => $value, 'status' => $status];
    }

    /**
     * @param  array<string, mixed>  $p
     * @return array{type: string, label: string, value: string, status: string}|null
     */
    private static function bp(array $p): ?array
    {
        $sys = self::num($p['sys'] ?? $p['systolic'] ?? null);
        $dia = self::num($p['dia'] ?? $p['diastolic'] ?? null);
        if ($sys === null || $dia === null) {
            return null;
        }
        $status = ($sys < 90 || $dia < 60 || $sys >= 140 || $dia >= 90)
            ? self::CRITICAL
            : (($sys >= 130 || $dia >= 80) ? self::WARNING : self::NORMAL);
        $pulse = self::num($p['pulse'] ?? null);
        $value = $pulse !== null ? "{$sys}/{$dia} · {$pulse}" : "{$sys}/{$dia}";

        return ['type' => 'bp', 'label' => 'BP', 'value' => $value.' mmHg', 'status' => $status];
    }

    /**
     * @param  array<string, mixed>  $p
     * @return array{type: string, label: string, value: string, status: string}|null
     */
    private static function glucose(array $p): ?array
    {
        $v = self::num($p['mgdl'] ?? $p['glucose'] ?? null);
        if ($v === null) {
            return null;
        }
        $status = ($v < 70 || $v > 180) ? self::CRITICAL : ($v >= 126 ? self::WARNING : self::NORMAL);

        return ['type' => 'glucose', 'label' => 'Glucose', 'value' => $v.' mg/dL', 'status' => $status];
    }

    /**
     * @param  array<string, mixed>  $p
     * @return array{type: string, label: string, value: string, status: string}|null
     */
    private static function temp(array $p): ?array
    {
        $v = self::num($p['celsius'] ?? $p['temp'] ?? $p['c'] ?? null);
        if ($v === null) {
            return null;
        }
        $status = ($v < 35 || $v > 38.5) ? self::CRITICAL : (($v < 35.5 || $v > 37.7) ? self::WARNING : self::NORMAL);

        return ['type' => 'temp', 'label' => 'Temp', 'value' => round($v, 1).' °C', 'status' => $status];
    }

    /**
     * @param  array<string, mixed>  $p
     * @return array{type: string, label: string, value: string, status: string}|null
     */
    private static function weight(array $p): ?array
    {
        $kg = self::num($p['kg'] ?? $p['weight'] ?? $p['weight_kg'] ?? null);
        $bmi = self::num($p['bmi'] ?? null);
        if ($kg === null && $bmi === null) {
            return null;
        }
        $status = self::NORMAL;
        if ($bmi !== null) {
            $status = ($bmi < 16 || $bmi >= 35) ? self::CRITICAL : (($bmi < 18.5 || $bmi >= 30) ? self::WARNING : self::NORMAL);
        }
        $bits = [];
        if ($kg !== null) {
            $bits[] = round($kg, 1).' kg';
        }
        if ($bmi !== null) {
            $bits[] = 'BMI '.round($bmi, 1);
        }

        return ['type' => 'weight', 'label' => 'Weight', 'value' => implode(' · ', $bits), 'status' => $status];
    }

    private static function num(mixed $value): ?float
    {
        if ($value === null || $value === '' || !is_numeric($value)) {
            return null;
        }

        return (float) $value;
    }
}
