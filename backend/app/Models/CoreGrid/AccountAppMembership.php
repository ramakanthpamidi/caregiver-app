<?php

namespace App\Models\CoreGrid;

use App\Models\CoreGrid\Concerns\UsesCoreGrid;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class AccountAppMembership extends Model
{
    use UsesCoreGrid;

    protected $table = 'account_app_memberships';

    public $timestamps = false;

    protected $guarded = [];

    protected function casts(): array
    {
        return [
            'granted_at' => 'datetime',
            'revoked_at' => 'datetime',
            'settings' => 'array',
        ];
    }

    public function account(): BelongsTo
    {
        return $this->belongsTo(Account::class, 'account_id');
    }

    public function application(): BelongsTo
    {
        return $this->belongsTo(Application::class, 'app_id');
    }

    public function profileGrants(): HasMany
    {
        return $this->hasMany(ProfileAccessGrant::class, 'membership_id');
    }

    public function scopeActive($query)
    {
        return $query->where('status', 'Active')->whereNull('revoked_at');
    }

    public function isAdminRole(): bool
    {
        $roles = config('caregiver.core_grid.admin_membership_roles', ['SuperAdmin', 'AppAdmin']);

        return in_array($this->app_role, $roles, true);
    }
}
