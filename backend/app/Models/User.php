<?php

namespace App\Models;

use App\Support\CoreGridAccess;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    use HasApiTokens, Notifiable;

    protected $table = 'accounts';

    public $timestamps = false;

    public const ADMIN_ROLES = ['SuperAdmin', 'AppAdmin'];

    protected $fillable = [
        'account_label',
        'account_kind',
        'status',
        'created_at',
        'activated_at',
        'disabled_at',
        'created_by',
    ];

    protected $appends = [
        'email',
        'user_label',
        'email_verified',
    ];

    protected $hidden = [
        'access_password_hash',
    ];

    protected function casts(): array
    {
        return [
            'created_at' => 'datetime',
            'activated_at' => 'datetime',
            'disabled_at' => 'datetime',
        ];
    }

    public function credentials(): HasMany
    {
        return $this->hasMany(AccountCredential::class, 'account_id');
    }

    public function memberships(): HasMany
    {
        return $this->hasMany(AccountAppMembership::class, 'account_id');
    }

    public function profiles(): HasMany
    {
        return $this->hasMany(Profile::class, 'created_by_account_id');
    }

    public function ownedDevices(): HasMany
    {
        return $this->hasMany(Device::class, 'created_by');
    }

    public function primaryCredential(): ?AccountCredential
    {
        if ($this->relationLoaded('credentials')) {
            return $this->credentials
                ->firstWhere('is_primary', true)
                ?? $this->credentials->first();
        }

        $appIds = \App\Support\CoreGridAccess::caregiverAppIds();

        return $this->credentials()
            ->active()
            ->when($appIds !== [], fn ($query) => $query->whereIn('app_id', $appIds))
            ->orderByDesc('is_primary')
            ->first()
            ?? $this->credentials()->active()->orderByDesc('is_primary')->first();
    }

    public function scopeForCaregiverApps($query)
    {
        $appIds = \App\Support\CoreGridAccess::caregiverAppIds();

        return $query->where(function ($inner) use ($appIds) {
            $inner->whereHas('memberships', function ($m) use ($appIds) {
                $m->where('status', 'Active')->whereIn('app_id', $appIds);
            })->orWhereHas('credentials', function ($c) use ($appIds) {
                $c->where('credential_status', 'Active')->whereIn('app_id', $appIds);
            });
        });
    }

    public function getLastLoginAtAttribute()
    {
        $appIds = \App\Support\CoreGridAccess::caregiverAppIds();
        $credentials = $this->relationLoaded('credentials')
            ? $this->credentials
            : $this->credentials()->get();

        return $credentials
            ->when($appIds !== [], fn ($set) => $set->whereIn('app_id', $appIds))
            ->pluck('last_login_at')
            ->filter()
            ->sortDesc()
            ->first();
    }

    public function getEmailAttribute(): ?string
    {
        return $this->primaryCredential()?->login_name;
    }

    /** @return \Illuminate\Support\Collection<int, object> */
    public function getRolesAttribute()
    {
        $memberships = $this->relationLoaded('memberships')
            ? $this->memberships
            : $this->memberships()->get();

        return $memberships->map(fn (AccountAppMembership $m) => (object) ['name' => $m->app_role]);
    }

    public function getUserLabelAttribute(): string
    {
        return (string) $this->account_label;
    }

    public function setUserLabelAttribute(string $value): void
    {
        $this->attributes['account_label'] = $value;
    }

    public function getEmailVerifiedAttribute(): bool
    {
        return (bool) ($this->primaryCredential()?->is_verified);
    }

    public function getDeletedAtAttribute(): mixed
    {
        return strtolower((string) $this->status) === 'deleted' ? $this->disabled_at : null;
    }

    public function getAuthPassword(): ?string
    {
        return $this->primaryCredential()?->password_hash;
    }

    public function issueToken(string $name = 'mobile'): string
    {
        return $this->createToken($name)->plainTextToken;
    }

    public function toAuthPayload(): array
    {
        return [
            'id' => $this->id,
            'user_label' => $this->user_label,
            'email' => $this->email,
            'email_verified' => $this->email_verified,
            'status' => $this->status,
        ];
    }

    public function caregiverMembership(): ?AccountAppMembership
    {
        return CoreGridAccess::activeMemberships($this)->first();
    }

    public function hasMembershipRole(array|string $roles): bool
    {
        $roles = is_array($roles) ? $roles : [$roles];

        return CoreGridAccess::activeMemberships($this)
            ->contains(fn (AccountAppMembership $m) => in_array($m->app_role, $roles, true));
    }

    public function canAccessAdmin(): bool
    {
        $status = strtolower((string) $this->status);
        if (in_array($status, ['disabled', 'deleted', 'suspended'], true)) {
            return false;
        }

        return $this->hasMembershipRole(config('caregiver.core_grid.admin_membership_roles', self::ADMIN_ROLES));
    }

    public function isSuperAdmin(): bool
    {
        return $this->hasMembershipRole('SuperAdmin');
    }

    public function authorizeCoreGrid(string $ability): bool
    {
        if ($this->isSuperAdmin()) {
            return true;
        }

        if (!$this->canAccessAdmin()) {
            return false;
        }

        if ($ability === 'admin.roles.manage') {
            return false;
        }

        if (str_contains($ability, 'manage')) {
            return $this->hasMembershipRole('AppAdmin');
        }

        return true;
    }

    public function markCredentialLogin(): void
    {
        $credential = $this->primaryCredential();
        if ($credential) {
            $credential->forceFill(['last_login_at' => now()])->save();
        }
        if ($this->activated_at === null) {
            $this->forceFill(['activated_at' => now(), 'status' => 'Active'])->save();
        }
    }

    public function scopeActive(Builder $query): Builder
    {
        return $query->whereNotIn('status', ['Deleted', 'deleted', 'Disabled', 'disabled']);
    }

    public static function findByEmail(string $email): ?self
    {
        $email = strtolower(trim($email));
        if ($email === '') {
            return null;
        }

        $credential = AccountCredential::query()
            ->active()
            ->whereRaw('lower(login_name) = ?', [$email])
            ->orderByDesc('is_primary')
            ->first();

        return $credential?->account;
    }
}
