<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class MedicalDataRaw extends Model
{
    protected $table = 'medical_data_raw';

    public $timestamps = false;

    protected $fillable = [
        'device_id',
        'observed_at',
        'profile_id',
        'payload',
        'source_membership_id',
        'source_ref',
        'ingested_at',
    ];

    protected function casts(): array
    {
        return [
            'observed_at' => 'datetime',
            'ingested_at' => 'datetime',
            'payload' => 'array',
        ];
    }

    public function profile(): BelongsTo
    {
        return $this->belongsTo(Profile::class, 'profile_id');
    }

    public function device(): BelongsTo
    {
        return $this->belongsTo(Device::class, 'device_id');
    }

    public function getTsAttribute()
    {
        return $this->observed_at;
    }

    public function setTsAttribute($value): void
    {
        $this->attributes['observed_at'] = $value;
    }

    public function getSnapshotAttribute()
    {
        return $this->payload;
    }

    public function setSnapshotAttribute($value): void
    {
        $this->payload = $value;
    }

    public function getDeviceRefAttribute(): ?int
    {
        return $this->attributes['device_id'] !== null ? (int) $this->attributes['device_id'] : null;
    }

    public function getCreatedAtAttribute()
    {
        return $this->ingested_at;
    }

    public function scopeForProfiles(Builder $query, iterable $profileIds): Builder
    {
        return $query->whereIn('profile_id', collect($profileIds)->map(fn ($id) => (int) $id)->all());
    }

    public function toRow(): array
    {
        $payload = is_array($this->payload) ? $this->payload : [];
        $device = $this->relationLoaded('device') ? $this->device : null;
        $profile = $this->relationLoaded('profile') ? $this->profile : null;
        $observed = optional($this->observed_at)?->toISOString();

        return [
            'id' => (int) $this->id,
            'profile_id' => (int) $this->profile_id,
            'profile_label' => $profile?->profile_label,
            'device_ref' => $this->device_ref,
            'device_id' => $device?->device_id ?? (string) $this->device_ref,
            'device_name' => $device?->display_name,
            'factory_name' => $device?->factory_name,
            'observed_at' => $observed,
            'ts' => $observed,
            'snapshot' => $payload,
            'payload' => $payload,
            'metric_type' => strtolower((string) ($payload['type'] ?? $payload['metric'] ?? 'unknown')),
            'latitude' => null,
            'longitude' => null,
            'ingested_at' => optional($this->ingested_at)?->toISOString(),
            'created_at' => optional($this->ingested_at)?->toISOString(),
        ];
    }
}
