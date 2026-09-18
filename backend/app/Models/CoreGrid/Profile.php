<?php

namespace App\Models\CoreGrid;

use App\Models\CoreGrid\Concerns\UsesCoreGrid;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Profile extends Model
{
    use UsesCoreGrid;

    protected $table = 'profiles';

    public $timestamps = false;

    protected $guarded = [];

    protected function casts(): array
    {
        return [
            'created_at' => 'datetime',
            'last_used_at' => 'datetime',
        ];
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(Account::class, 'created_by_account_id');
    }

    public function accessGrants(): HasMany
    {
        return $this->hasMany(ProfileAccessGrant::class, 'profile_id');
    }

    public function medicalEvents(): HasMany
    {
        return $this->hasMany(MedicalEvent::class, 'profile_id');
    }

    public function medicalReadings(): HasMany
    {
        return $this->hasMany(MedicalDataRaw::class, 'profile_id');
    }

    public function scopeActive($query)
    {
        return $query->where('status', 'Active');
    }
}
