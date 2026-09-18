<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Device;
use App\Models\DeviceAccessGrant;
use App\Support\CoreGridAccess;
use Illuminate\Http\Request;

class UserController extends Controller
{
    public function destroyMe(Request $request)
    {
        $user = $request->user();

        $user->tokens()->delete();
        $user->forceFill([
            'status' => 'Deleted',
            'disabled_at' => now(),
        ])->save();
        $user->credentials()->update(['credential_status' => 'Revoked']);

        return response()->json(['ok' => true]);
    }

    public function myDevices(Request $request)
    {
        $user = $request->user();

        $owned = Device::query()
            ->alive()
            ->where('created_by', $user->id)
            ->orderByDesc('id')
            ->get();

        $membershipIds = CoreGridAccess::activeMemberships($user)->pluck('id');
        $grantedIds = DeviceAccessGrant::query()
            ->active()
            ->whereIn('membership_id', $membershipIds)
            ->pluck('device_id');

        $granted = Device::query()
            ->alive()
            ->whereIn('id', $grantedIds)
            ->get();

        $devices = $owned->concat($granted)
            ->unique('id')
            ->values()
            ->map(fn (Device $d) => $d->toSummary((int) $user->id));

        return response()->json(['devices' => $devices]);
    }
}
