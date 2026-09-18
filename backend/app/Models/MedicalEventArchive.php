<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class MedicalEventArchive extends Model
{
    protected $table = 'medical_events_archive';

    public $timestamps = false;

    protected $guarded = [];

    protected function casts(): array
    {
        return [
            'occurred_at' => 'datetime',
            'archived_at' => 'datetime',
            'payload' => 'array',
        ];
    }

    public function getTsAttribute()
    {
        return $this->occurred_at;
    }

    public function profile(): BelongsTo
    {
        return $this->belongsTo(Profile::class, 'profile_id');
    }
}
