<?php

namespace App\Support;

use App\Models\MedicalDataRaw;
use App\Models\MedicalEvent;
use App\Models\User;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;

class MedicalAlertQuery
{
    /**
     * @param  list<int>|null  $profileIds  null = all (admin)
     */
    public function eventsFor(User $user, Request $request): LengthAwarePaginator
    {
        $profileIds = CoreGridAccess::visibleProfileIds($user);
        $this->assertRequestedProfile($request, $profileIds);

        $query = MedicalEvent::query()->with(['device', 'profile']);
        CoreGridAccess::constrainProfileQuery($query, $this->effectiveProfileIds($request, $profileIds));
        $this->applyEventFilters($query, $request);

        $perPage = min(max((int) $request->integer('per_page', $request->integer('limit', 50)), 1), 200);

        return $query->orderByDesc('occurred_at')->orderByDesc('id')->paginate($perPage)->withQueryString();
    }

    /**
     * @param  list<int>|null  $profileIds
     */
    public function readingsFor(User $user, Request $request): LengthAwarePaginator
    {
        $profileIds = CoreGridAccess::visibleProfileIds($user);
        $this->assertRequestedProfile($request, $profileIds);

        $query = MedicalDataRaw::query()->with(['device', 'profile']);
        CoreGridAccess::constrainProfileQuery($query, $this->effectiveProfileIds($request, $profileIds));
        $this->applyReadingFilters($query, $request);

        $perPage = min(max((int) $request->integer('per_page', $request->integer('limit', 50)), 1), 200);

        return $query->orderByDesc('observed_at')->orderByDesc('id')->paginate($perPage)->withQueryString();
    }

    public function findVisibleEvent(User $user, int $id): ?MedicalEvent
    {
        $query = MedicalEvent::query()->with(['device', 'profile'])->where('id', $id);
        CoreGridAccess::constrainProfileQuery($query, CoreGridAccess::visibleProfileIds($user));

        return $query->first();
    }

    /**
     * @param  list<int>|null  $visible
     */
    private function assertRequestedProfile(Request $request, ?array $visible): void
    {
        if (!$request->filled('profile_id') || $visible === null) {
            return;
        }

        $requested = (int) $request->integer('profile_id');
        if (!in_array($requested, $visible, true)) {
            abort(404, 'Profile not found');
        }
    }

    /**
     * @param  list<int>|null  $visible
     * @return list<int>|null
     */
    private function effectiveProfileIds(Request $request, ?array $visible): ?array
    {
        if (!$request->filled('profile_id')) {
            return $visible;
        }

        return [(int) $request->integer('profile_id')];
    }

    private function applyEventFilters(Builder $query, Request $request): void
    {
        if ($request->filled('from')) {
            $query->where('occurred_at', '>=', $request->query('from'));
        }
        if ($request->filled('to')) {
            $query->where('occurred_at', '<=', $request->query('to'));
        }
        if ($request->filled('event_type')) {
            $query->where('event_type', $request->query('event_type'));
        }
        if ($request->filled('severity')) {
            $severities = collect(explode(',', (string) $request->query('severity')))
                ->map(fn ($s) => strtolower(trim($s)))
                ->filter()
                ->values()
                ->all();
            if ($severities !== []) {
                $expr = MedicalEvent::jsonText('severity');
                $placeholders = implode(',', array_fill(0, count($severities), '?'));
                $query->whereRaw("lower(coalesce({$expr}, severity, 'unknown')) in ({$placeholders})", $severities);
            }
        }
        if ($request->filled('reading_type')) {
            $type = strtolower((string) $request->query('reading_type'));
            $valueKey = match ($type) {
                'spo2' => 'spo2',
                'bp' => 'sys',
                'glucose' => 'mgdl',
                'temp' => 'celsius',
                'weight' => 'kg',
                'pulse' => 'pulse',
                default => $type,
            };
            $typeExpr = MedicalEvent::jsonText('readingType');
            $driver = (new MedicalEvent)->getConnection()->getDriverName();
            $hasValue = $driver === 'pgsql'
                ? "payload->'values' ? ?"
                : "json_extract(payload, '$.values.{$valueKey}') is not null";
            $bindings = $driver === 'pgsql' ? [$type, $valueKey] : [$type];
            $query->whereRaw("(lower(coalesce({$typeExpr}, '')) = ? or {$hasValue})", $bindings);
        }
        if ($request->filled('search')) {
            $term = '%'.str_replace(['%', '_'], ['\\%', '\\_'], (string) $request->query('search')).'%';
            $title = MedicalEvent::jsonText('title');
            $message = MedicalEvent::jsonText('message');
            $query->where(function (Builder $inner) use ($term, $title, $message) {
                $inner->where('event_type', 'like', $term)
                    ->orWhereRaw("{$title} like ?", [$term])
                    ->orWhereRaw("{$message} like ?", [$term]);
            });
        }
    }

    private function applyReadingFilters(Builder $requestQuery, Request $request): void
    {
        if ($request->filled('from')) {
            $requestQuery->where('observed_at', '>=', $request->query('from'));
        }
        if ($request->filled('to')) {
            $requestQuery->where('observed_at', '<=', $request->query('to'));
        }
        if ($request->filled('metric_type')) {
            $type = strtolower((string) $request->query('metric_type'));
            $expr = MedicalEvent::jsonText('type');
            $requestQuery->whereRaw("lower(coalesce({$expr}, '')) = ?", [$type]);
        }
    }
}
