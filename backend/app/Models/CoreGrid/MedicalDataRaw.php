<?php

namespace App\Models\CoreGrid;

use App\Models\CoreGrid\Concerns\UsesCoreGrid;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class MedicalDataRaw extends Model
{
    use UsesCoreGrid;

    protected $table = 'medical_data_raw';

    public $timestamps = false;

    protected $guarded = [];

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
            'device_ref' => (int) $this->device_id,
            'device_id' => $device?->external_device_id ?? (string) $this->device_id,
            'device_name' => $device?->display_name,
            'observed_at' => $observed,
            'ts' => $observed,
            'snapshot' => $payload,
            'payload' => $payload,
            'metric_type' => strtolower((string) ($payload['type'] ?? $payload['metric'] ?? 'unknown')),
            'ingested_at' => optional($this->ingested_at)?->toISOString(),
        ];
    }

    public function scopeForProfiles(Builder $query, iterable $profileIds): Builder
    {
        return $query->whereIn('profile_id', collect($profileIds)->map(fn ($id) => (int) $id)->all());
    }
}
