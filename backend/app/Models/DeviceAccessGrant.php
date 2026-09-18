<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DeviceAccessGrant extends Model
{
    protected $table = 'device_access_grants';

    public $timestamps = false;

    protected $guarded = [];

    protected function casts(): array
    {
        return [
            'can_read' => 'boolean',
            'can_control' => 'boolean',
            'can_administer' => 'boolean',
            'granted_at' => 'datetime',
            'revoked_at' => 'datetime',
            'access_metadata' => 'array',
        ];
    }

    public function membership(): BelongsTo
    {
        return $this->belongsTo(AccountAppMembership::class, 'membership_id');
    }

    public function device(): BelongsTo
    {
        return $this->belongsTo(Device::class, 'device_id');
    }

    public function scopeActive(Builder $query): Builder
    {
        return $query->whereNull('revoked_at');
    }
}
