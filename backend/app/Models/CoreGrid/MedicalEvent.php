<?php

namespace App\Models\CoreGrid;

use App\Models\CoreGrid\Concerns\UsesCoreGrid;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class MedicalEvent extends Model
{
    use UsesCoreGrid;

    protected $table = 'medical_events';

    public $timestamps = false;

    protected $guarded = [];

    protected function casts(): array
    {
        return [
            'occurred_at' => 'datetime',
            'created_at' => 'datetime',
            'payload' => 'array',
            'latitude' => 'float',
            'longitude' => 'float',
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

    public function sourceMembership(): BelongsTo
    {
        return $this->belongsTo(AccountAppMembership::class, 'source_membership_id');
    }

    public function severityLevel(): string
    {
        $payload = is_array($this->payload) ? $this->payload : [];

        return strtolower((string) ($payload['severity'] ?? $this->severity ?? 'unknown'));
    }

    public function readingType(): string
    {
        $payload = is_array($this->payload) ? $this->payload : [];
        $explicit = strtolower((string) ($payload['readingType'] ?? ''));
        if ($explicit !== '') {
            return $explicit;
        }

        $values = is_array($payload['values'] ?? null) ? $payload['values'] : [];
        if (array_key_exists('spo2', $values)) {
            return 'spo2';
        }
        if (array_key_exists('sys', $values) || array_key_exists('dia', $values)) {
            return 'bp';
        }
        if (array_key_exists('mgdl', $values) || array_key_exists('mmol', $values)) {
            return 'glucose';
        }
        if (array_key_exists('celsius', $values) || array_key_exists('fahrenheit', $values)) {
            return 'temp';
        }
        if (array_key_exists('kg', $values) || array_key_exists('weight', $values)) {
            return 'weight';
        }
        if (array_key_exists('pulse', $values)) {
            return 'pulse';
        }

        return 'unknown';
    }

    public function toAlert(): array
    {
        $payload = is_array($this->payload) ? $this->payload : [];
        $device = $this->relationLoaded('device') ? $this->device : null;
        $profile = $this->relationLoaded('profile') ? $this->profile : null;
        $occurred = optional($this->occurred_at)?->toISOString();

        return [
            'id' => (int) $this->id,
            'profile_id' => (int) $this->profile_id,
            'profile_label' => $profile?->profile_label,
            'device_ref' => (int) $this->device_id,
            'device_id' => $device?->external_device_id ?? (string) $this->device_id,
            'device_name' => $device?->display_name,
            'device_type' => $device?->device_type,
            'occurred_at' => $occurred,
            'ts' => $occurred,
            'event_type' => (string) $this->event_type,
            'severity' => $this->severityLevel(),
            'status' => $payload['status'] ?? null,
            'title' => $payload['title'] ?? null,
            'message' => $payload['message'] ?? null,
            'reading' => $payload['reading'] ?? null,
            'reading_type' => $this->readingType(),
            'values' => $payload['values'] ?? null,
            'payload' => $payload,
            'latitude' => $this->latitude,
            'longitude' => $this->longitude,
            'created_at' => optional($this->created_at)?->toISOString(),
        ];
    }

    public function scopeForProfiles(Builder $query, iterable $profileIds): Builder
    {
        return $query->whereIn('profile_id', collect($profileIds)->map(fn ($id) => (int) $id)->all());
    }

    public static function jsonText(string $path): string
    {
        $driver = (new static)->getConnection()->getDriverName();

        if ($driver === 'pgsql') {
            return "payload->>'{$path}'";
        }

        return "json_extract(payload, '$.{$path}')";
    }
}
