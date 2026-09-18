<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class MedicalDataArchive extends Model
{
    protected $table = 'medical_data_archive';

    public $timestamps = false;

    protected $guarded = [];

    protected function casts(): array
    {
        return [
            'period_start' => 'datetime',
            'period_end' => 'datetime',
            'metrics' => 'array',
            'archived_at' => 'datetime',
        ];
    }

    public function getTsAttribute()
    {
        return $this->period_start;
    }

    public function profile(): BelongsTo
    {
        return $this->belongsTo(Profile::class, 'profile_id');
    }
}
