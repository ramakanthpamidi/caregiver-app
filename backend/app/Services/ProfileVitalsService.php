<?php

namespace App\Services;

use App\Models\MedicalDataRaw;
use App\Models\Profile;
use App\Support\VitalStatus;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

class ProfileVitalsService
{
    /**
     * @return array{rows: list<array<string, mixed>>, counts: array<string, int>}
     */
    public function table(Request $request): array
    {
        $q = trim((string) $request->query('q', ''));
        $status = strtolower(trim((string) $request->query('status', 'all')));

        $profiles = Profile::query()
            ->alive()
            ->with('owner')
            ->when($q !== '', function ($query) use ($q) {
                $query->where(function ($inner) use ($q) {
                    $inner->where('profile_label', 'ilike', "%{$q}%")
                        ->orWhere('id', $q)
                        ->orWhereHas('owner', function ($owner) use ($q) {
                            $owner->where('account_label', 'ilike', "%{$q}%")
                                ->orWhereHas('credentials', fn ($c) => $c->where('login_name', 'ilike', "%{$q}%"));
                        });
                });
            })
            ->orderBy('profile_label')
            ->get();

        $latest = $this->latestByProfile($profiles->pluck('id'));

        $rows = [];
        $counts = ['all' => 0, 'critical' => 0, 'warning' => 0, 'normal' => 0, 'none' => 0];

        foreach ($profiles as $profile) {
            $vitals = $latest->get((int) $profile->id, collect());
            $byType = [
                'spo2' => $vitals->get('spo2'),
                'bp' => $vitals->get('bp'),
                'glucose' => $vitals->get('glucose'),
                'temp' => $vitals->get('temp'),
                'weight' => $vitals->get('weight'),
            ];
            $statuses = collect($byType)->filter()->pluck('status')->all();
            $overall = VitalStatus::overall($statuses);
            $counts['all']++;
            $counts[$overall] = ($counts[$overall] ?? 0) + 1;

            $lastAt = collect($byType)->filter()->pluck('at')->filter()->sortDesc()->first();

            $rows[] = [
                'profile' => $profile,
                'owner' => $profile->owner,
                'vitals' => $byType,
                'overall' => $overall,
                'overall_label' => VitalStatus::display($overall),
                'last_at' => $lastAt,
            ];
        }

        if (in_array($status, ['critical', 'warning', 'normal', 'none'], true)) {
            $rows = array_values(array_filter($rows, fn ($row) => $row['overall'] === $status));
        }

        return compact('rows', 'counts');
    }

    /**
     * @param  Collection<int, int|string>  $profileIds
     * @return Collection<int, Collection<string, array<string, mixed>>>
     */
    private function latestByProfile(Collection $profileIds): Collection
    {
        if ($profileIds->isEmpty()) {
            return collect();
        }

        $ids = $profileIds->map(fn ($id) => (int) $id)->all();
        $driver = (new MedicalDataRaw)->getConnection()->getDriverName();
        $typeExpr = $driver === 'pgsql'
            ? "payload->>'type'"
            : "json_extract(payload, '$.type')";

        $grouped = MedicalDataRaw::query()
            ->select('profile_id', DB::raw("{$typeExpr} as vital_type"), DB::raw('max(observed_at) as mx'))
            ->whereIn('profile_id', $ids)
            ->groupBy('profile_id', DB::raw($typeExpr))
            ->get();

        if ($grouped->isEmpty()) {
            return collect();
        }

        $rows = MedicalDataRaw::query()
            ->where(function ($query) use ($grouped) {
                foreach ($grouped as $group) {
                    $query->orWhere(function ($inner) use ($group) {
                        $inner->where('profile_id', $group->profile_id)
                            ->where('observed_at', $group->mx);
                    });
                }
            })
            ->get();

        $out = collect();
        foreach ($rows as $row) {
            $payload = is_array($row->payload) ? $row->payload : [];
            $classified = VitalStatus::fromPayload($payload);
            if (!$classified) {
                continue;
            }
            $classified['at'] = $row->observed_at;
            $classified['id'] = $row->id;
            $pid = (int) $row->profile_id;
            if (!$out->has($pid)) {
                $out->put($pid, collect());
            }
            $out->get($pid)->put($classified['type'], $classified);
        }

        return $out;
    }
}
