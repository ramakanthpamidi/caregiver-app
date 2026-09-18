<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\MedicalDataDaily;
use App\Models\MedicalDataRaw;
use App\Models\MedicalEvent;
use App\Support\CoreGridAccounts;
use App\Support\MedicalTrendBuilder;
use App\Support\ProfileAccess;
use Carbon\Carbon;
use Illuminate\Http\Request;

class MedicalController extends Controller
{
    public function storeData(Request $request)
    {
        $data = $request->validate([
            'device_id' => 'required|string|max:128',
            'profile_id' => 'required|integer',
            'ts' => 'required',
            'snapshot' => 'required|array',
            'lat' => 'nullable|numeric',
            'lng' => 'nullable|numeric',
        ]);

        $profile = ProfileAccess::ownedOrFail($request->user(), $data['profile_id']);
        $device = CoreGridAccounts::resolveDevice($data['device_id'], $request->user(), [
            'device_name' => $data['snapshot']['type'] ?? 'Medical',
        ]);

        $row = MedicalDataRaw::create([
            'profile_id' => $profile->id,
            'device_id' => $device->id,
            'observed_at' => $this->parseTs($data['ts']),
            'payload' => $data['snapshot'],
            'source_membership_id' => $request->user()->caregiverMembership()?->id,
            'source_ref' => $data['device_id'],
            'ingested_at' => now(),
        ]);
        $row->setRelation('device', $device);

        $this->upsertDaily($row);

        return response()->json([
            'ok' => true,
            'row' => $row->toRow(),
        ], 201);
    }

    public function index(Request $request)
    {
        $data = $request->validate([
            'profile_id' => 'required|integer',
            'limit' => 'nullable|integer|min:1|max:500',
            'offset' => 'nullable|integer|min:0',
            'mode' => 'nullable|string',
        ]);

        $profile = ProfileAccess::ownedOrFail($request->user(), $data['profile_id']);
        $mode = $data['mode'] ?? null;

        // Client uses mode=all both for overview trends and raw rows
        if ($mode === 'all') {
            $trends = MedicalTrendBuilder::build((int) $profile->id, 'Overall');

            return response()->json($trends);
        }

        $limit = $data['limit'] ?? 50;
        $offset = $data['offset'] ?? 0;

        $rows = MedicalDataRaw::with('device')
            ->where('profile_id', $profile->id)
            ->orderByDesc('observed_at')
            ->offset($offset)
            ->limit($limit)
            ->get()
            ->map->toRow()
            ->values();

        return response()->json(['rows' => $rows]);
    }

    public function trends(Request $request)
    {
        $data = $request->validate([
            'profile_id' => 'required|integer',
            'period' => 'nullable|string',
        ]);

        $profile = ProfileAccess::ownedOrFail($request->user(), $data['profile_id']);
        $period = $data['period'] ?? 'Overall';

        return response()->json(MedicalTrendBuilder::build((int) $profile->id, $period));
    }

    public function storeEvent(Request $request)
    {
        $data = $request->validate([
            'device_id' => 'required|string|max:128',
            'profile_id' => 'required|integer',
            'ts' => 'required',
            'event_type' => 'required|string|max:128',
            'payload' => 'nullable|array',
            'lat' => 'nullable|numeric',
            'lng' => 'nullable|numeric',
        ]);

        $profile = ProfileAccess::ownedOrFail($request->user(), $data['profile_id']);
        $device = CoreGridAccounts::resolveDevice($data['device_id'], $request->user());

        $event = MedicalEvent::create([
            'profile_id' => $profile->id,
            'device_id' => $device->id,
            'occurred_at' => $this->parseTs($data['ts']),
            'event_type' => $data['event_type'],
            'severity' => strtolower((string) (($data['payload']['severity'] ?? 'unknown'))),
            'payload' => $data['payload'] ?? null,
            'latitude' => $data['lat'] ?? null,
            'longitude' => $data['lng'] ?? null,
            'source_membership_id' => $request->user()->caregiverMembership()?->id,
            'source_ref' => $data['device_id'],
            'created_at' => now(),
        ]);
        $event->setRelation('device', $device);

        return response()->json([
            'ok' => true,
            'event' => $event->toRow(),
        ], 201);
    }

    public function listEvents(Request $request)
    {
        $data = $request->validate([
            'profile_id' => 'required|integer',
            'limit' => 'nullable|integer|min:1|max:500',
            'offset' => 'nullable|integer|min:0',
        ]);

        $profile = ProfileAccess::ownedOrFail($request->user(), $data['profile_id']);
        $limit = $data['limit'] ?? 50;
        $offset = $data['offset'] ?? 0;

        $events = MedicalEvent::with('device')
            ->where('profile_id', $profile->id)
            ->orderByDesc('occurred_at')
            ->offset($offset)
            ->limit($limit)
            ->get()
            ->map->toRow()
            ->values();

        return response()->json(['events' => $events]);
    }

    private function parseTs(mixed $value): Carbon
    {
        if (is_numeric($value)) {
            $n = (int) $value;
            if ($n > 1_000_000_000_000) {
                return Carbon::createFromTimestampMs($n);
            }

            return Carbon::createFromTimestamp($n);
        }

        return Carbon::parse((string) $value);
    }

    private function upsertDaily(MedicalDataRaw $row): void
    {
        $snap = is_array($row->payload) ? $row->payload : [];
        $day = optional($row->observed_at)?->toDateString() ?? now()->toDateString();

        $daily = MedicalDataDaily::firstOrNew([
            'profile_id' => $row->profile_id,
            'day' => $day,
            'device_id' => $row->device_ref,
        ]);

        $metrics = is_array($daily->metrics) ? $daily->metrics : [];
        $metrics['last'] = $snap;
        $metrics['last_ts'] = optional($row->observed_at)?->toISOString();

        $daily->metrics = $metrics;
        $daily->sample_count = (int) ($daily->sample_count ?? 0) + 1;
        $daily->calculated_at = now();
        $daily->save();
    }
}
