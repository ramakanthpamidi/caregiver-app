<?php

namespace App\Services;

use App\Models\Device;
use App\Models\MedicalDataRaw;
use App\Models\MedicalEvent;
use App\Models\Profile;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class MonitoringKpiService
{
    /**
     * Admin monitoring-room snapshot from core_grid medical tables.
     *
     * @return array<string, mixed>
     */
    public function build(Request $request): array
    {
        $to = $request->filled('to')
            ? Carbon::parse((string) $request->query('to'))
            : now();
        $from = $request->filled('from')
            ? Carbon::parse((string) $request->query('from'))
            : $to->copy()->subDays(30);

        $todayStart = $to->copy()->startOfDay();
        $severityExpr = $this->severitySql();
        $statusExpr = $this->jsonText('status');

        $alertsInRange = MedicalEvent::query()
            ->whereBetween('occurred_at', [$from, $to]);

        $severityCounts = (clone $alertsInRange)
            ->selectRaw("{$severityExpr} as severity, count(*) as count")
            ->groupBy(DB::raw($severityExpr))
            ->pluck('count', 'severity')
            ->map(fn ($n) => (int) $n)
            ->all();

        $byProfile = (clone $alertsInRange)
            ->select('profile_id', DB::raw('count(*) as count'))
            ->groupBy('profile_id')
            ->orderByDesc('count')
            ->limit(10)
            ->get();

        $profileLabels = Profile::query()
            ->whereIn('id', $byProfile->pluck('profile_id'))
            ->pluck('profile_label', 'id');

        $recentCritical = MedicalEvent::query()
            ->with(['device', 'profile'])
            ->whereBetween('occurred_at', [$from, $to])
            ->where(function ($q) use ($severityExpr) {
                $q->whereRaw("{$severityExpr} in (?, ?)", ['critical', 'warning']);
            })
            ->orderByDesc('occurred_at')
            ->limit(20)
            ->get()
            ->map->toAlert()
            ->values();

        $byHour = $this->groupByBucket($from, $to, 'hour');
        $byDay = $this->groupByBucket($from, $to, 'day');

        $readingTypes = $this->readingTypeCounts($from, $to);

        $medicalDevices = Device::query()->medical();

        return [
            'source' => 'core_grid',
            'range' => [
                'from' => $from->toIso8601String(),
                'to' => $to->toIso8601String(),
            ],
            'totals' => [
                'profiles' => Profile::query()->active()->count(),
                'medical_devices' => (clone $medicalDevices)->count(),
                'devices_seen_today' => (clone $medicalDevices)->where('last_seen_at', '>=', $todayStart)->count(),
                'readings_in_range' => MedicalDataRaw::query()->whereBetween('observed_at', [$from, $to])->count(),
                'readings_today' => MedicalDataRaw::query()->where('observed_at', '>=', $todayStart)->count(),
                'alerts_in_range' => (clone $alertsInRange)->count(),
                'alerts_today' => MedicalEvent::query()->where('occurred_at', '>=', $todayStart)->count(),
                'critical_in_range' => (int) ($severityCounts['critical'] ?? 0),
                'warning_in_range' => (int) ($severityCounts['warning'] ?? 0),
            ],
            'alerts_by_severity' => [
                'critical' => (int) ($severityCounts['critical'] ?? 0),
                'warning' => (int) ($severityCounts['warning'] ?? 0),
                'good' => (int) ($severityCounts['good'] ?? 0),
                'excellent' => (int) ($severityCounts['excellent'] ?? 0),
                'unknown' => (int) ($severityCounts['unknown'] ?? 0),
            ],
            'alerts_by_status' => (clone $alertsInRange)
                ->selectRaw("coalesce({$statusExpr}, 'unknown') as status, count(*) as count")
                ->groupBy(DB::raw("coalesce({$statusExpr}, 'unknown')"))
                ->orderByDesc('count')
                ->get()
                ->map(fn ($row) => ['label' => (string) $row->status, 'count' => (int) $row->count])
                ->all(),
            'alerts_by_reading_type' => $readingTypes,
            'alerts_by_hour' => $byHour,
            'alerts_by_day' => $byDay,
            'top_profiles' => $byProfile->map(fn ($row) => [
                'profile_id' => (int) $row->profile_id,
                'profile_label' => $profileLabels[$row->profile_id] ?? ('#'.$row->profile_id),
                'alert_count' => (int) $row->count,
            ])->values()->all(),
            'devices' => [
                'total_medical' => (clone $medicalDevices)->count(),
                'online' => (clone $medicalDevices)->whereIn('lifecycle_status', ['Online', 'online'])->count(),
                'offline' => (clone $medicalDevices)->whereIn('lifecycle_status', ['Offline', 'offline'])->count(),
                'seen_today' => (clone $medicalDevices)->where('last_seen_at', '>=', $todayStart)->count(),
            ],
            'recent_critical' => $recentCritical,
        ];
    }

    /**
     * @return list<array{label: string, count: int}>
     */
    private function readingTypeCounts(Carbon $from, Carbon $to): array
    {
        $events = MedicalEvent::query()
            ->whereBetween('occurred_at', [$from, $to])
            ->get(['payload', 'severity']);

        $counts = [];
        foreach ($events as $event) {
            $type = $event->readingType();
            $counts[$type] = ($counts[$type] ?? 0) + 1;
        }
        arsort($counts);

        return collect($counts)
            ->map(fn ($count, $label) => ['label' => (string) $label, 'count' => (int) $count])
            ->values()
            ->all();
    }

    /**
     * @return list<array{bucket: string, count: int}>
     */
    private function groupByBucket(Carbon $from, Carbon $to, string $grain): array
    {
        $driver = (new MedicalEvent)->getConnection()->getDriverName();
        $trunc = $grain === 'hour'
            ? ($driver === 'pgsql'
                ? "to_char(date_trunc('hour', occurred_at), 'YYYY-MM-DD HH24:00')"
                : "strftime('%Y-%m-%d %H:00', occurred_at)")
            : ($driver === 'pgsql'
                ? "to_char(date_trunc('day', occurred_at), 'YYYY-MM-DD')"
                : "strftime('%Y-%m-%d', occurred_at)");

        return MedicalEvent::query()
            ->whereBetween('occurred_at', [$from, $to])
            ->selectRaw("{$trunc} as bucket, count(*) as count")
            ->groupBy(DB::raw($trunc))
            ->orderBy(DB::raw($trunc))
            ->get()
            ->map(fn ($row) => ['bucket' => (string) $row->bucket, 'count' => (int) $row->count])
            ->all();
    }

    private function severitySql(): string
    {
        $expr = $this->jsonText('severity');

        return "lower(coalesce({$expr}, severity, 'unknown'))";
    }

    private function jsonText(string $path): string
    {
        return MedicalEvent::jsonText($path);
    }
}
