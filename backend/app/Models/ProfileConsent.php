<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ProfileConsent extends Model
{
    protected $table = 'profile_consents';

    public $timestamps = false;

    protected $fillable = [
        'profile_id',
        'consent_code',
        'consent_granted',
        'source',
        'created_at',
        'updated_at',
        'updated_by',
    ];

    protected function casts(): array
    {
        return [
            'consent_granted' => 'boolean',
            'created_at' => 'datetime',
            'updated_at' => 'datetime',
        ];
    }

    public function profile(): BelongsTo
    {
        return $this->belongsTo(Profile::class, 'profile_id');
    }

    public function getGrantedAtAttribute()
    {
        return $this->updated_at ?? $this->created_at;
    }

    public function toPayload(): array
    {
        return [
            'consent_granted' => (bool) $this->consent_granted,
            'source' => $this->source,
            'consent_code' => $this->consent_code,
            'granted_at' => optional($this->granted_at)?->toISOString(),
        ];
    }
}
