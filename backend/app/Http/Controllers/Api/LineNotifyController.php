<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\LineNotifyLinkPin;
use App\Models\LineNotifyTarget;
use App\Models\MedicalDataRaw;
use App\Models\MedicalEvent;
use App\Support\ProfileAccess;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

class LineNotifyController extends Controller
{
    public function index(Request $request)
    {
        $data = $request->validate([
            'profile_id' => 'required|integer',
        ]);

        $profile = ProfileAccess::ownedOrFail($request->user(), $data['profile_id']);
        $membershipId = $request->user()->caregiverMembership()?->id;
        $targets = LineNotifyTarget::query()
            ->when($membershipId, fn ($q) => $q->where('membership_id', $membershipId))
            ->where('channel_type', 'LINE')
            ->orderBy('id')
            ->get()
            ->map->toPayload();

        return response()->json(['targets' => $targets]);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'profile_id' => 'required|integer',
            'line_user_id' => 'required|string|max:128',
            'line_display_name' => 'nullable|string|max:255',
            'notify_critical' => 'nullable|boolean',
            'notify_warning' => 'nullable|boolean',
            'notify_good' => 'nullable|boolean',
            'notify_excellent' => 'nullable|boolean',
        ]);

        $profile = ProfileAccess::ownedOrFail($request->user(), $data['profile_id']);
        $membership = $request->user()->caregiverMembership();
        if (!$membership) {
            return response()->json(['error' => 'No caregiver membership'], 403);
        }

        $target = LineNotifyTarget::updateOrCreate(
            [
                'membership_id' => $membership->id,
                'channel_type' => 'LINE',
                'target_key' => $data['line_user_id'],
            ],
            [
                'display_name' => $data['line_display_name'] ?? null,
                'enabled' => true,
                'preferences' => [
                    'notify_critical' => $data['notify_critical'] ?? true,
                    'notify_warning' => $data['notify_warning'] ?? true,
                    'notify_good' => $data['notify_good'] ?? false,
                    'notify_excellent' => $data['notify_excellent'] ?? false,
                ],
                'created_at' => now(),
                'created_by' => $request->user()->id,
            ]
        );

        return response()->json(['target' => $target->toPayload()], 201);
    }

    public function update(Request $request, int $id)
    {
        $target = LineNotifyTarget::find($id);
        if (!$target) {
            return response()->json(['error' => 'Target not found'], 404);
        }

        $membership = $request->user()->caregiverMembership();
        if (!$membership || (int) $target->membership_id !== (int) $membership->id) {
            return response()->json(['error' => 'Target not found'], 404);
        }

        $data = $request->validate([
            'line_display_name' => 'nullable|string|max:255',
            'notify_critical' => 'nullable|boolean',
            'notify_warning' => 'nullable|boolean',
            'notify_good' => 'nullable|boolean',
            'notify_excellent' => 'nullable|boolean',
            'enabled' => 'nullable|boolean',
        ]);

        $target->fill($data);
        $target->save();

        return response()->json(['target' => $target->toPayload()]);
    }

    public function destroy(Request $request, int $id)
    {
        $target = LineNotifyTarget::find($id);
        if (!$target) {
            return response()->json(['error' => 'Target not found'], 404);
        }

        $membership = $request->user()->caregiverMembership();
        if (!$membership || (int) $target->membership_id !== (int) $membership->id) {
            return response()->json(['error' => 'Target not found'], 404);
        }
        $target->delete();

        return response()->json(['ok' => true]);
    }

    public function linkPin(Request $request)
    {
        $data = $request->validate([
            'profile_id' => 'required|integer',
        ]);

        $profile = ProfileAccess::ownedOrFail($request->user(), $data['profile_id']);
        $pin = (string) random_int(100000, 999999);
        $expiresAt = now()->addMinutes(10);

        LineNotifyLinkPin::create([
            'profile_id' => $profile->id,
            'pin' => $pin,
            'expires_at' => $expiresAt,
            'created_at' => now(),
        ]);

        return response()->json([
            'pin' => $pin,
            'expiresAt' => $expiresAt->toISOString(),
        ]);
    }

    public function linkStatus(Request $request)
    {
        $data = $request->validate([
            'pin' => 'required|string',
        ]);

        $row = LineNotifyLinkPin::where('pin', $data['pin'])->orderByDesc('id')->first();
        if (!$row) {
            return response()->json(['linked' => false, 'expired' => true]);
        }

        if ($row->expires_at && $row->expires_at->isPast() && !$row->linked_at) {
            return response()->json(['linked' => false, 'expired' => true]);
        }

        if ($row->linked_at) {
            return response()->json([
                'linked' => true,
                'lineDisplayName' => $row->line_display_name,
            ]);
        }

        // Local helper: if OAUTH_DEV_MODE, auto-link on poll after 2s for easier testing
        if (config('caregiver.oauth_dev_mode') && $row->created_at && $row->created_at->diffInSeconds(now()) >= 3) {
            $display = 'Dev LINE User';
            $lineUserId = 'dev-line-'.Str::lower(Str::random(8));
            $row->forceFill([
                'linked_at' => now(),
                'line_user_id' => $lineUserId,
                'line_display_name' => $display,
            ])->save();

            LineNotifyTarget::updateOrCreate(
                [
                    'profile_id' => $row->profile_id,
                    'line_user_id' => $lineUserId,
                ],
                [
                    'line_display_name' => $display,
                    'notify_critical' => true,
                    'notify_warning' => true,
                    'notify_good' => false,
                    'notify_excellent' => false,
                    'enabled' => true,
                ]
            );

            return response()->json([
                'linked' => true,
                'lineDisplayName' => $display,
            ]);
        }

        return response()->json(['linked' => false, 'expired' => false]);
    }

    public function simulate(Request $request)
    {
        $data = $request->validate([
            'profile_id' => 'required|integer',
            'severity' => 'required|string',
            'event_type' => 'required|string',
            'device_name' => 'nullable|string',
            'payload' => 'nullable|array',
            'lat' => 'nullable|numeric',
            'lng' => 'nullable|numeric',
        ]);

        $profile = ProfileAccess::ownedOrFail($request->user(), $data['profile_id']);

        MedicalEvent::create([
            'profile_id' => $profile->id,
            'device_id' => null,
            'ts' => now(),
            'event_type' => $data['event_type'],
            'payload' => array_merge($data['payload'] ?? [], [
                'severity' => $data['severity'],
                'device_name' => $data['device_name'] ?? null,
                'simulated' => true,
            ]),
            'latitude' => $data['lat'] ?? null,
            'longitude' => $data['lng'] ?? null,
            'captured_by_user_id' => $request->user()->id,
            'created_at' => now(),
        ]);

        $targets = LineNotifyTarget::where('profile_id', $profile->id)->where('enabled', true)->get();
        Log::info('LINE notify simulate', [
            'profile_id' => $profile->id,
            'severity' => $data['severity'],
            'targets' => $targets->pluck('line_user_id'),
        ]);

        return response()->json(['ok' => true, 'sent' => $targets->count()]);
    }

    public function dailySummary(Request $request)
    {
        $data = $request->validate([
            'profile_id' => 'required|integer',
        ]);

        $profile = ProfileAccess::ownedOrFail($request->user(), $data['profile_id']);
        $count = MedicalDataRaw::where('profile_id', $profile->id)
            ->where('ts', '>=', now()->startOfDay())
            ->count();

        $targets = LineNotifyTarget::where('profile_id', $profile->id)->where('enabled', true)->get();

        Log::info('LINE daily summary', [
            'profile_id' => $profile->id,
            'readings_today' => $count,
            'targets' => $targets->pluck('line_user_id'),
        ]);

        return response()->json([
            'ok' => true,
            'sent' => $targets->count(),
            'readings_today' => $count,
        ]);
    }
}
