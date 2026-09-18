<?php

namespace App\Support;

use App\Models\MedicalDataRaw;
use Carbon\Carbon;
use Illuminate\Support\Collection;

class MedicalTrendBuilder
{
    public static function build(int $profileId, string $period = 'Overall'): array
    {
        $period = self::normalizePeriod($period);
        $since = self::periodStart($period);

        $query = MedicalDataRaw::query()
            ->with('device')
            ->where('profile_id', $profileId)
            ->orderByDesc('observed_at');

        if ($since) {
            $query->where('observed_at', '>=', $since);
        }

        $rows = $query->limit($period === 'Latest' ? 50 : 2000)->get();

        $bp = [];
        $glucose = [];
        $temp = [];
        $spo2 = [];
        $latest = [
            'bp' => [],
            'glucose' => [],
            'temp' => [],
            'spo2' => [],
        ];

        foreach ($rows as $row) {
            $snap = is_array($row->payload) ? $row->payload : [];
            $type = strtolower((string) ($snap['type'] ?? $snap['metric'] ?? ''));
            $ts = optional($row->observed_at)?->toISOString() ?? now()->toISOString();
            $tsMs = optional($row->observed_at)?->getTimestampMs();

            $baseLatest = [
                'ts' => $ts,
                'ts_ms' => $tsMs,
                'device_ref' => $row->device_ref,
                'device_id' => $row->device_id,
                'device_name' => $row->device?->device_name,
                'factory_name' => $row->device?->factory_name,
                'snapshot' => $snap,
            ];

            if (self::isBp($type, $snap)) {
                $sys = self::num($snap, ['sys', 'systolic', 'sbp']);
                $dia = self::num($snap, ['dia', 'diastolic', 'dbp']);
                if ($sys !== null && $dia !== null) {
                    $bp[] = ['ts' => $ts, 'ts_ms' => $tsMs, 'sys' => $sys, 'dia' => $dia];
                    if (count($latest['bp']) < 5) {
                        $latest['bp'][] = $baseLatest + ['sys' => $sys, 'dia' => $dia];
                    }
                }
            }

            if (self::isGlucose($type, $snap)) {
                $mgdl = self::num($snap, ['mgdl', 'glucose', 'bg', 'value']);
                if ($mgdl !== null) {
                    $glucose[] = ['ts' => $ts, 'ts_ms' => $tsMs, 'mgdl' => $mgdl];
                    if (count($latest['glucose']) < 5) {
                        $latest['glucose'][] = $baseLatest + ['mgdl' => $mgdl];
                    }
                }
            }

            if (self::isTemp($type, $snap)) {
                $c = self::num($snap, ['celsius', 'temp', 'temperature', 'value']);
                if ($c !== null) {
                    $temp[] = ['ts' => $ts, 'ts_ms' => $tsMs, 'celsius' => $c];
                    if (count($latest['temp']) < 5) {
                        $latest['temp'][] = $baseLatest + ['celsius' => $c];
                    }
                }
            }

            if (self::isSpo2($type, $snap)) {
                $s = self::num($snap, ['spo2', 'SpO2', 'oxygen', 'value']);
                $pulse = self::num($snap, ['pulse', 'hr', 'heart_rate']);
                if ($s !== null) {
                    $spo2[] = ['ts' => $ts, 'ts_ms' => $tsMs, 'spo2' => $s, 'pulse' => $pulse];
                    if (count($latest['spo2']) < 5) {
                        $latest['spo2'][] = $baseLatest + ['spo2' => $s, 'pulse' => $pulse];
                    }
                }
            }
        }

        // Client charts usually want chronological order
        $bp = array_reverse($bp);
        $glucose = array_reverse($glucose);
        $temp = array_reverse($temp);
        $spo2 = array_reverse($spo2);

        $lastPoint = $rows->first()?->toRow();

        return [
            'period' => $period,
            'source' => 'medical_data_raw',
            'bp_points' => $bp,
            'glucose_points' => $glucose,
            'temp_points' => $temp,
            'spo2_points' => $spo2,
            'latest_points' => $latest,
            'last_point' => $lastPoint,
        ];
    }

    private static function normalizePeriod(string $period): string
    {
        $allowed = ['Latest', 'Daily', 'Weekly', 'Monthly', 'Overall'];
        return in_array($period, $allowed, true) ? $period : 'Overall';
    }

    private static function periodStart(string $period): ?Carbon
    {
        return match ($period) {
            'Latest' => now()->subDays(2),
            'Daily' => now()->startOfDay(),
            'Weekly' => now()->subDays(7),
            'Monthly' => now()->subDays(30),
            default => null,
        };
    }

    private static function isBp(string $type, array $snap): bool
    {
        return str_contains($type, 'bp')
            || str_contains($type, 'pressure')
            || isset($snap['sys'], $snap['dia'])
            || isset($snap['systolic'], $snap['diastolic']);
    }

    private static function isGlucose(string $type, array $snap): bool
    {
        return str_contains($type, 'glucose')
            || str_contains($type, 'bg')
            || isset($snap['mgdl'])
            || (isset($snap['glucose']) && is_numeric($snap['glucose']));
    }

    private static function isTemp(string $type, array $snap): bool
    {
        return str_contains($type, 'temp')
            || str_contains($type, 'therm')
            || isset($snap['celsius']);
    }

    private static function isSpo2(string $type, array $snap): bool
    {
        return str_contains($type, 'spo2')
            || str_contains($type, 'oxim')
            || isset($snap['spo2']);
    }

    private static function num(array $snap, array $keys): ?float
    {
        foreach ($keys as $key) {
            if (array_key_exists($key, $snap) && is_numeric($snap[$key])) {
                return (float) $snap[$key];
            }
        }

        return null;
    }
}
