<?php

namespace Tests\Concerns;

use App\Models\User;
use App\Support\CoreGridAccounts;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

trait InteractsWithCoreGrid
{
    protected function setUpCoreGridSchema(): void
    {
        $schema = Schema::connection(config('database.default'));

        if ($schema->hasTable('accounts')) {
            foreach ([
                'personal_access_tokens',
                'medical_data_raw', 'medical_events', 'profile_access_grants', 'profiles',
                'account_app_memberships', 'account_credentials', 'device_access_grants',
                'devices', 'accounts', 'applications',
            ] as $table) {
                if ($schema->hasTable($table)) {
                    $schema->getConnection()->table($table)->delete();
                }
            }

            return;
        }

        $schema->create('applications', function (Blueprint $table) {
            $table->id();
            $table->string('app_code');
            $table->string('app_name')->nullable();
            $table->string('app_type')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamp('created_at')->nullable();
        });

        $schema->create('accounts', function (Blueprint $table) {
            $table->id();
            $table->string('account_label');
            $table->string('account_kind')->default('User');
            $table->string('status')->default('Active');
            $table->timestamp('created_at')->nullable();
            $table->timestamp('activated_at')->nullable();
            $table->timestamp('disabled_at')->nullable();
            $table->unsignedBigInteger('created_by')->nullable();
        });

        $schema->create('account_credentials', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('account_id');
            $table->unsignedBigInteger('app_id');
            $table->string('login_name');
            $table->string('login_type')->default('Email');
            $table->string('password_hash')->nullable();
            $table->boolean('is_primary')->default(true);
            $table->boolean('is_verified')->default(true);
            $table->string('credential_status')->default('Active');
            $table->timestamp('created_at')->nullable();
            $table->timestamp('updated_at')->nullable();
            $table->timestamp('last_login_at')->nullable();
            $table->string('verification_code_hash')->nullable();
            $table->timestamp('verification_expires_at')->nullable();
            $table->timestamp('verification_sent_at')->nullable();
        });

        $schema->create('account_app_memberships', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('account_id');
            $table->unsignedBigInteger('app_id');
            $table->string('app_role');
            $table->string('status')->default('Active');
            $table->timestamp('granted_at')->nullable();
            $table->unsignedBigInteger('granted_by')->nullable();
            $table->timestamp('revoked_at')->nullable();
            $table->json('settings')->nullable();
        });

        $schema->create('profiles', function (Blueprint $table) {
            $table->id();
            $table->string('profile_label');
            $table->string('access_password_hash')->nullable();
            $table->string('profile_type')->default('Patient');
            $table->string('status')->default('Active');
            $table->timestamp('created_at')->nullable();
            $table->unsignedBigInteger('created_by_account_id')->nullable();
            $table->timestamp('last_used_at')->nullable();
        });

        $schema->create('profile_access_grants', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('membership_id');
            $table->unsignedBigInteger('profile_id');
            $table->string('access_role')->default('Owner');
            $table->timestamp('granted_at')->nullable();
            $table->unsignedBigInteger('granted_by')->nullable();
            $table->timestamp('revoked_at')->nullable();
        });

        $schema->create('devices', function (Blueprint $table) {
            $table->id();
            $table->string('device_uuid')->nullable();
            $table->string('external_device_id');
            $table->string('device_type')->default('Medical');
            $table->string('display_name')->nullable();
            $table->unsignedBigInteger('model_id')->nullable();
            $table->string('lifecycle_status')->default('Online');
            $table->string('control_mode')->default('Read');
            $table->timestamp('last_seen_at')->nullable();
            $table->timestamp('created_at')->nullable();
            $table->timestamp('modified_at')->nullable();
            $table->unsignedBigInteger('created_by')->nullable();
            $table->json('metadata')->nullable();
        });

        $schema->create('medical_events', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('device_id');
            $table->timestamp('occurred_at');
            $table->unsignedBigInteger('profile_id');
            $table->string('event_type')->default('Alert');
            $table->string('severity')->nullable();
            $table->json('payload')->nullable();
            $table->float('latitude')->nullable();
            $table->float('longitude')->nullable();
            $table->unsignedBigInteger('source_membership_id')->nullable();
            $table->string('source_ref')->nullable();
            $table->timestamp('created_at')->nullable();
        });

        $schema->create('medical_data_raw', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('device_id');
            $table->timestamp('observed_at');
            $table->unsignedBigInteger('profile_id');
            $table->json('payload');
            $table->unsignedBigInteger('source_membership_id')->nullable();
            $table->string('source_ref')->nullable();
            $table->timestamp('ingested_at')->nullable();
        });

        if (! $schema->hasTable('personal_access_tokens')) {
        $schema->create('personal_access_tokens', function (Blueprint $table) {
            $table->id();
            $table->morphs('tokenable');
            $table->text('name');
            $table->string('token', 64)->unique();
            $table->text('abilities')->nullable();
            $table->timestamp('last_used_at')->nullable();
            $table->timestamp('expires_at')->nullable();
            $table->timestamps();
        });
        }
    }

    protected function seedRoles(): void
    {
        // Roles live on account_app_memberships in core_grid.
    }

    protected function makeUser(string $email, string $role = null, string $password = 'secret123'): User
    {
        $user = User::findByEmail($email)
            ?: CoreGridAccounts::createUser(explode('@', $email)[0], $email, $password, 'Email', true);

        if ($role) {
            $membership = $user->caregiverMembership();
            $mapped = $role === 'admin' ? 'AppAdmin' : ($role === 'super_admin' ? 'SuperAdmin' : $role);
            if ($membership) {
                $membership->forceFill(['app_role' => $mapped])->save();
            }
        }

        return $user->fresh(['credentials', 'memberships']);
    }
}
