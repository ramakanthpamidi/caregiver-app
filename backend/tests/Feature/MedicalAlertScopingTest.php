<?php

namespace Tests\Feature;

use App\Models\AccountAppMembership;
use App\Models\AccountCredential;
use App\Models\Application;
use App\Models\Device;
use App\Models\MedicalDataRaw;
use App\Models\MedicalEvent;
use App\Models\Profile;
use App\Models\ProfileAccessGrant;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\Concerns\InteractsWithCoreGrid;
use Tests\TestCase;

class MedicalAlertScopingTest extends TestCase
{
    use RefreshDatabase;
    use InteractsWithCoreGrid;

    protected function setUp(): void
    {
        parent::setUp();
        $this->setUpCoreGridSchema();
        $this->seedRoles();
        $this->seedCoreGridFixture();
    }

    public function test_user_sees_only_granted_profile_alerts(): void
    {
        $user = $this->makeUser('carer@example.com');
        Sanctum::actingAs($user);

        $response = $this->getJson('/medical-alerts');

        $response->assertOk()
            ->assertJsonPath('scope', 'user')
            ->assertJsonCount(1, 'events')
            ->assertJsonPath('events.0.profile_label', 'Mine')
            ->assertJsonPath('events.0.severity', 'warning');
    }

    public function test_user_cannot_fetch_another_users_alert(): void
    {
        $user = $this->makeUser('carer@example.com');
        Sanctum::actingAs($user);

        $this->getJson('/medical-alerts/2')->assertNotFound();
        $other = Profile::query()->where('profile_label', 'Theirs')->value('id');
        $this->getJson('/medical-alerts?profile_id='.$other)->assertNotFound();
    }

    public function test_admin_sees_all_alerts(): void
    {
        $admin = $this->makeUser('admin@example.com', 'admin');
        Sanctum::actingAs($admin);

        $response = $this->getJson('/medical-alerts');

        $response->assertOk()
            ->assertJsonPath('scope', 'admin')
            ->assertJsonPath('meta.total', 2);
    }

    public function test_user_records_are_scoped(): void
    {
        $user = $this->makeUser('carer@example.com');
        Sanctum::actingAs($user);

        $this->getJson('/medical-records')
            ->assertOk()
            ->assertJsonCount(1, 'rows')
            ->assertJsonPath('rows.0.profile_label', 'Mine');
    }

    public function test_user_cannot_read_admin_kpi(): void
    {
        $user = $this->makeUser('carer@example.com');
        Sanctum::actingAs($user);

        $this->getJson('/monitoring/kpi')->assertForbidden();
        $this->getJson('/monitoring/alerts')->assertForbidden();
    }

    public function test_admin_kpi_counts_all_alerts(): void
    {
        $admin = $this->makeUser('admin@example.com', 'admin');
        Sanctum::actingAs($admin);

        $this->getJson('/monitoring/kpi')
            ->assertOk()
            ->assertJsonPath('source', 'core_grid')
            ->assertJsonPath('totals.alerts_in_range', 2)
            ->assertJsonPath('alerts_by_severity.critical', 1)
            ->assertJsonPath('alerts_by_severity.warning', 1);
    }

    public function test_core_grid_super_admin_membership_unlocks_kpi(): void
    {
        $user = $this->makeUser('boss@example.com', 'SuperAdmin');
        Sanctum::actingAs($user);

        $this->getJson('/monitoring/kpi')
            ->assertOk()
            ->assertJsonPath('totals.alerts_in_range', 2);
    }

    private function seedCoreGridFixture(): void
    {
        $app = Application::query()->create([
            'app_code' => 'CaregiverMobile',
            'app_name' => 'Caregiver Mobile',
            'app_type' => 'Mobile',
            'is_active' => true,
            'created_at' => now(),
        ]);

        $carer = User::query()->create([
            'account_label' => 'Carer',
            'account_kind' => 'User',
            'status' => 'Active',
            'created_at' => now(),
        ]);
        $boss = User::query()->create([
            'account_label' => 'Boss',
            'account_kind' => 'User',
            'status' => 'Active',
            'created_at' => now(),
        ]);

        AccountCredential::query()->create([
            'account_id' => $carer->id,
            'app_id' => $app->id,
            'login_name' => 'carer@example.com',
            'login_type' => 'Email',
            'password_hash' => bcrypt('secret123'),
            'is_primary' => true,
            'is_verified' => true,
            'credential_status' => 'Active',
            'created_at' => now(),
        ]);
        AccountCredential::query()->create([
            'account_id' => $boss->id,
            'app_id' => $app->id,
            'login_name' => 'boss@example.com',
            'login_type' => 'Email',
            'password_hash' => bcrypt('secret123'),
            'is_primary' => true,
            'is_verified' => true,
            'credential_status' => 'Active',
            'created_at' => now(),
        ]);

        $carerMembership = AccountAppMembership::query()->create([
            'account_id' => $carer->id,
            'app_id' => $app->id,
            'app_role' => 'CaregiverUser',
            'status' => 'Active',
            'granted_at' => now(),
        ]);
        AccountAppMembership::query()->create([
            'account_id' => $boss->id,
            'app_id' => $app->id,
            'app_role' => 'SuperAdmin',
            'status' => 'Active',
            'granted_at' => now(),
        ]);

        $mine = Profile::query()->create([
            'id' => 10,
            'profile_label' => 'Mine',
            'profile_type' => 'Patient',
            'status' => 'Active',
            'created_at' => now(),
            'created_by_account_id' => $carer->id,
        ]);
        $theirs = Profile::query()->create([
            'id' => 20,
            'profile_label' => 'Theirs',
            'profile_type' => 'Patient',
            'status' => 'Active',
            'created_at' => now(),
            'created_by_account_id' => $boss->id,
        ]);

        ProfileAccessGrant::query()->create([
            'membership_id' => $carerMembership->id,
            'profile_id' => $mine->id,
            'access_role' => 'Owner',
            'granted_at' => now(),
        ]);

        $device = Device::query()->create([
            'device_uuid' => '11111111-1111-1111-1111-111111111111',
            'external_device_id' => 'AA:BB:CC:DD:EE:FF',
            'device_type' => 'Medical',
            'display_name' => 'Oximeter',
            'lifecycle_status' => 'Online',
            'last_seen_at' => now(),
            'created_at' => now(),
        ]);

        MedicalEvent::query()->create([
            'id' => 1,
            'device_id' => $device->id,
            'occurred_at' => now()->subHour(),
            'profile_id' => $mine->id,
            'event_type' => 'Alert',
            'payload' => [
                'title' => 'Low oxygen',
                'status' => 'Warning',
                'severity' => 'warning',
                'reading' => '91%',
                'values' => ['spo2' => 91],
            ],
            'created_at' => now(),
        ]);
        MedicalEvent::query()->create([
            'id' => 2,
            'device_id' => $device->id,
            'occurred_at' => now()->subMinutes(10),
            'profile_id' => $theirs->id,
            'event_type' => 'Alert',
            'payload' => [
                'title' => 'High BP',
                'status' => 'Critical',
                'severity' => 'critical',
                'reading' => '180/110',
                'values' => ['sys' => 180, 'dia' => 110],
            ],
            'created_at' => now(),
        ]);

        MedicalDataRaw::query()->create([
            'device_id' => $device->id,
            'observed_at' => now()->subMinutes(5),
            'profile_id' => $mine->id,
            'payload' => ['type' => 'spo2', 'spo2' => 91],
            'ingested_at' => now(),
        ]);
        MedicalDataRaw::query()->create([
            'device_id' => $device->id,
            'observed_at' => now()->subMinutes(4),
            'profile_id' => $theirs->id,
            'payload' => ['type' => 'bp', 'sys' => 180, 'dia' => 110],
            'ingested_at' => now(),
        ]);
    }
}
