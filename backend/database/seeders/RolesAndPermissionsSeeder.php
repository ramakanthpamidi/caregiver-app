<?php

namespace Database\Seeders;

use App\Models\AccountAppMembership;
use App\Models\AccountCredential;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class RolesAndPermissionsSeeder extends Seeder
{
    public function run(): void
    {
        $password = (string) env('ADMIN_PASSWORD', 'BPS@1234');
        $hash = Hash::make($password);

        $accountIds = AccountAppMembership::query()
            ->where('app_role', 'SuperAdmin')
            ->where('status', 'Active')
            ->pluck('account_id')
            ->unique()
            ->all();

        if ($accountIds === []) {
            $this->command?->warn('No SuperAdmin memberships in core_grid.');

            return;
        }

        $updated = AccountCredential::query()
            ->whereIn('account_id', $accountIds)
            ->update([
                'password_hash' => $hash,
                'is_verified' => true,
                'credential_status' => 'Active',
            ]);

        $this->command?->info("Set SuperAdmin password on {$updated} core_grid credential(s).");
    }
}
