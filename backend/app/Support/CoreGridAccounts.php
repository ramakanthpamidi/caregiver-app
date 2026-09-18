<?php

namespace App\Support;

use App\Models\AccountAppMembership;
use App\Models\AccountCredential;
use App\Models\Device;
use App\Models\User;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class CoreGridAccounts
{
    public static function findByLogin(string $loginName): ?User
    {
        return User::findByEmail($loginName);
    }

    public static function createUser(string $label, string $email, ?string $password, string $loginType = 'Email', bool $verified = true): User
    {
        $now = now();
        $user = User::query()->create([
            'account_label' => $label,
            'account_kind' => 'User',
            'status' => $verified ? 'Active' : 'Pending',
            'created_at' => $now,
            'activated_at' => $verified ? $now : null,
        ]);

        $appId = CoreGridAccess::caregiverAppId();
        if ($appId) {
            AccountCredential::query()->create([
                'account_id' => $user->id,
                'app_id' => $appId,
                'login_name' => strtolower(trim($email)),
                'login_type' => $loginType,
                'password_hash' => $password ? Hash::make($password) : null,
                'is_primary' => true,
                'is_verified' => $verified,
                'credential_status' => 'Active',
                'created_at' => $now,
            ]);

            AccountAppMembership::query()->create([
                'account_id' => $user->id,
                'app_id' => $appId,
                'app_role' => 'CaregiverUser',
                'status' => 'Active',
                'granted_at' => $now,
            ]);
        }

        return $user->fresh(['credentials', 'memberships']);
    }

    public static function resolveDevice(string $externalId, User $owner, array $attrs = []): Device
    {
        $device = Device::query()->where('external_device_id', $externalId)->first();
        if ($device) {
            return $device;
        }

        return Device::query()->create([
            'device_uuid' => (string) Str::uuid(),
            'external_device_id' => $externalId,
            'device_type' => $attrs['device_type'] ?? 'Medical',
            'display_name' => $attrs['display_name'] ?? $attrs['device_name'] ?? $externalId,
            'lifecycle_status' => 'Online',
            'control_mode' => 'Read',
            'created_at' => now(),
            'created_by' => $owner->id,
            'last_seen_at' => now(),
        ]);
    }
}
