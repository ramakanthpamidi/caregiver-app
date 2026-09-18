<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Support\Facades\Hash;

class Profile extends Model
{
    protected $table = 'profiles';

    public $timestamps = false;

    protected $fillable = [
        'profile_label',
        'access_password_hash',
        'profile_type',
        'status',
        'created_at',
        'created_by_account_id',
        'last_used_at',
    ];

    protected function casts(): array
    {
        return [
            'created_at' => 'datetime',
            'last_used_at' => 'datetime',
        ];
    }

    public function owner(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by_account_id');
    }

    public function consents(): HasMany
    {
        return $this->hasMany(ProfileConsent::class, 'profile_id');
    }

    public function medicalGeneral(): HasOne
    {
        return $this->hasOne(MedicalGeneralInfo::class, 'profile_id');
    }

    public function reminders(): HasMany
    {
        return $this->hasMany(ProfileReminder::class, 'profile_id');
    }

    public function goals(): HasMany
    {
        return $this->hasMany(ProfileGoal::class, 'profile_id');
    }

    public function getOwnerUserIdAttribute(): ?int
    {
        return $this->created_by_account_id !== null ? (int) $this->created_by_account_id : null;
    }

    public function setOwnerUserIdAttribute($value): void
    {
        $this->attributes['created_by_account_id'] = $value;
    }

    public function getDeletedAtAttribute(): mixed
    {
        $status = strtolower((string) $this->status);

        return in_array($status, ['deleted', 'archived'], true) ? ($this->last_used_at ?? $this->created_at) : null;
    }

    public function setAccessPassword(?string $password): void
    {
        $this->access_password_hash = $password ? Hash::make($password) : null;
    }

    public function verifyAccessPassword(string $password): bool
    {
        if (!$this->access_password_hash) {
            return true;
        }

        return Hash::check($password, $this->access_password_hash);
    }

    public function scopeAlive(Builder $query): Builder
    {
        return $query->whereNotIn('status', ['Deleted', 'deleted', 'Archived', 'archived']);
    }

    public function scopeActive(Builder $query): Builder
    {
        return $this->scopeAlive($query);
    }

    public function toSummary(): array
    {
        return [
            'id' => (int) $this->id,
            'profile_label' => (string) $this->profile_label,
            'owner_user_id' => $this->owner_user_id,
            'created_by_account_id' => $this->owner_user_id,
            'created_at' => optional($this->created_at)?->toISOString() ?? now()->toISOString(),
            'last_used' => optional($this->last_used_at)?->toISOString(),
            'last_used_at' => optional($this->last_used_at)?->toISOString(),
            'has_access_password' => !empty($this->access_password_hash),
        ];
    }
}
