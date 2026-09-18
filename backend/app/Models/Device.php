<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Str;

class Device extends Model
{
    protected $table = 'devices';

    public $timestamps = false;

    protected $fillable = [
        'device_uuid',
        'external_device_id',
        'device_type',
        'display_name',
        'model_id',
        'lifecycle_status',
        'control_mode',
        'location_id',
        'installed_at',
        'last_seen_at',
        'created_at',
        'modified_at',
        'created_by',
        'modified_by',
        'metadata',
    ];

    protected function casts(): array
    {
        return [
            'installed_at' => 'datetime',
            'last_seen_at' => 'datetime',
            'created_at' => 'datetime',
            'modified_at' => 'datetime',
            'metadata' => 'array',
        ];
    }

    protected static function booted(): void
    {
        static::creating(function (Device $device) {
            if (empty($device->device_uuid)) {
                $device->device_uuid = (string) Str::uuid();
            }
            if (empty($device->created_at)) {
                $device->created_at = now();
            }
            if (empty($device->lifecycle_status)) {
                $device->lifecycle_status = 'Online';
            }
            if (empty($device->control_mode)) {
                $device->control_mode = 'Read';
            }
            if (empty($device->device_type)) {
                $device->device_type = 'Medical';
            }
        });
    }

    public function owner(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function model(): BelongsTo
    {
        return $this->belongsTo(YuwellModel::class, 'model_id');
    }

    public function grants(): HasMany
    {
        return $this->hasMany(DeviceAccessGrant::class, 'device_id');
    }

    public function getDeviceIdAttribute(): string
    {
        return (string) ($this->attributes['external_device_id'] ?? '');
    }

    public function setDeviceIdAttribute($value): void
    {
        $this->attributes['external_device_id'] = $value;
    }

    public function getDeviceNameAttribute(): ?string
    {
        return $this->display_name;
    }

    public function setDeviceNameAttribute($value): void
    {
        $this->attributes['display_name'] = $value;
    }

    public function getFactoryNameAttribute(): ?string
    {
        return $this->relationLoaded('model') ? $this->model?->factory_name : null;
    }

    public function getOwnerUserIdAttribute(): ?int
    {
        return $this->created_by !== null ? (int) $this->created_by : null;
    }

    public function getStatusAttribute(): string
    {
        return (string) ($this->lifecycle_status ?: 'Online');
    }

    public function getDeletedAtAttribute(): mixed
    {
        $status = strtolower((string) $this->lifecycle_status);

        return in_array($status, ['retired', 'deleted', 'decommissioned'], true) ? $this->modified_at : null;
    }

    public function scopeAlive(Builder $query): Builder
    {
        return $query->whereNotIn('lifecycle_status', ['Retired', 'Deleted', 'Decommissioned']);
    }

    public function scopeMedical(Builder $query): Builder
    {
        return $query->where('device_type', 'Medical');
    }

    public function toSummary(?int $viewerUserId = null): array
    {
        $isOwner = $viewerUserId !== null && (int) $this->created_by === $viewerUserId;

        return [
            'id' => (int) $this->id,
            'device_id' => $this->device_id,
            'device_uuid' => $this->device_uuid,
            'endpoint_uuid' => null,
            'device_name' => $this->display_name,
            'factory_name' => $this->factory_name,
            'display_name' => $this->display_name,
            'device_type' => $this->device_type,
            'medical_device_type' => $this->relationLoaded('model') ? $this->model?->device_subtype : null,
            'comm_protocol' => $this->relationLoaded('model') ? $this->model?->protocol_family : 'BLE',
            'platform' => $this->relationLoaded('model') ? $this->model?->platform : null,
            'status' => $this->status,
            'granted_at' => optional($this->created_at)?->toISOString(),
            'granted_by' => $this->owner_user_id,
            'can_rename' => $isOwner,
        ];
    }
}
