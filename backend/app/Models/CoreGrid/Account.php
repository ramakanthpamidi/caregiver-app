<?php

namespace App\Models\CoreGrid;

use App\Models\CoreGrid\Concerns\UsesCoreGrid;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Account extends Model
{
    use UsesCoreGrid;

    protected $table = 'accounts';

    public $timestamps = false;

    protected $guarded = [];

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

    public function createdProfiles(): HasMany
    {
        return $this->hasMany(Profile::class, 'created_by_account_id');
    }
}
