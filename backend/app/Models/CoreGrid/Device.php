<?php

namespace App\Models\CoreGrid;

use App\Models\CoreGrid\Concerns\UsesCoreGrid;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Device extends Model
{
    use UsesCoreGrid;

    protected $table = 'devices';

    public $timestamps = false;

    protected $guarded = [];

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

    public function medicalEvents(): HasMany
    {
        return $this->hasMany(MedicalEvent::class, 'device_id');
    }

    public function medicalReadings(): HasMany
    {
        return $this->hasMany(MedicalDataRaw::class, 'device_id');
    }

    public function scopeMedical($query)
    {
        return $query->where('device_type', 'Medical');
    }
}
