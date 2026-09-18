<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Device;
use App\Models\DeviceAccessGrant;
use App\Models\YuwellModel;
use App\Support\CoreGridAccess;
use App\Support\CoreGridAccounts;
use Illuminate\Http\Request;

class DeviceController extends Controller
{
    public function store(Request $request)
    {
        $data = $request->validate([
            'device_id' => 'required|string|max:128',
            'device_name' => 'nullable|string|max:200',
            'factory_name' => 'nullable|string|max:200',
            'device_type' => 'nullable|string|max:64',
            'medical_device_type' => 'nullable|string|max:128',
            'comm_protocol' => 'nullable|string|max:32',
            'platform' => 'nullable|string|max:64',
            'display_name' => 'nullable|string|max:200',
        ]);

        $user = $request->user();
        $deviceId = trim($data['device_id']);
        $existing = Device::query()->where('external_device_id', $deviceId)->first();

        if ($existing && $existing->deleted_at === null) {
            if ((int) $existing->created_by === (int) $user->id) {
                return response()->json([
                    'error' => 'Device already exists',
                    'device_ref' => (int) $existing->id,
                    'device' => $existing->toSummary((int) $user->id),
                ], 409);
            }

            $membership = $user->caregiverMembership();
            if ($membership) {
                DeviceAccessGrant::query()->firstOrCreate(
                    [
                        'membership_id' => $membership->id,
                        'device_id' => $existing->id,
                    ],
                    [
                        'access_role' => 'Viewer',
                        'can_read' => true,
                        'granted_at' => now(),
                        'granted_by' => $user->id,
                    ]
                );
            }

            return response()->json([
                'device_ref' => (int) $existing->id,
                'device' => $existing->toSummary((int) $user->id),
            ], 201);
        }

        $device = CoreGridAccounts::resolveDevice($deviceId, $user, [
            'device_type' => $data['device_type'] ?? 'Medical',
            'display_name' => $data['display_name'] ?? $data['device_name'] ?? $data['factory_name'] ?? $deviceId,
        ]);

        return response()->json([
            'device_ref' => (int) $device->id,
            'device' => $device->toSummary((int) $user->id),
        ], 201);
    }

    public function update(Request $request, string $id)
    {
        $user = $request->user();
        $device = $this->findAccessibleDevice((int) $user->id, $id);

        if (!$device) {
            return response()->json(['error' => 'Device not found'], 404);
        }

        if ((int) $device->created_by !== (int) $user->id) {
            return response()->json(['error' => 'Not device owner'], 403);
        }

        $data = $request->validate([
            'device_name' => 'required|string|max:200',
        ]);

        $device->forceFill([
            'display_name' => trim($data['device_name']),
            'modified_at' => now(),
            'modified_by' => $user->id,
        ])->save();

        return response()->json(['device' => $device->toSummary((int) $user->id)]);
    }

    public function destroy(Request $request, string $id)
    {
        $user = $request->user();
        $device = $this->findAccessibleDevice((int) $user->id, $id);

        if (!$device) {
            return response()->json(['error' => 'Device not found'], 404);
        }

        $soft = filter_var($request->query('soft', true), FILTER_VALIDATE_BOOLEAN);

        if ((int) $device->created_by === (int) $user->id) {
            if ($soft) {
                $device->forceFill([
                    'lifecycle_status' => 'Retired',
                    'modified_at' => now(),
                    'modified_by' => $user->id,
                ])->save();
            } else {
                $device->delete();
            }
        } else {
            $membershipIds = CoreGridAccess::activeMemberships($user)->pluck('id');
            DeviceAccessGrant::query()
                ->whereIn('membership_id', $membershipIds)
                ->where('device_id', $device->id)
                ->update(['revoked_at' => now()]);
        }

        return response()->json(['ok' => true]);
    }

    public function yuwellModels()
    {
        $models = YuwellModel::orderBy('factory_name')->get()->map->toPayload();

        return response()->json(['models' => $models]);
    }

    public function yuwellModel(string $factoryName)
    {
        $model = YuwellModel::where('factory_name', $factoryName)->first();
        if (!$model) {
            $model = YuwellModel::where('factory_name', 'like', '%'.$factoryName.'%')->first();
        }

        if (!$model) {
            return response()->json(['error' => 'Model not found'], 404);
        }

        return response()->json(['model' => $model->toPayload()]);
    }

    private function findAccessibleDevice(int $userId, string $id): ?Device
    {
        $device = Device::query()->alive()->where('external_device_id', $id)->first();
        if (!$device && ctype_digit($id)) {
            $device = Device::query()->alive()->where('id', (int) $id)->first();
        }

        if (!$device) {
            return null;
        }

        if ((int) $device->created_by === $userId) {
            return $device;
        }

        $user = request()->user();
        $membershipIds = CoreGridAccess::activeMemberships($user)->pluck('id');
        $granted = DeviceAccessGrant::query()
            ->active()
            ->whereIn('membership_id', $membershipIds)
            ->where('device_id', $device->id)
            ->exists();

        return $granted ? $device : null;
    }
}
