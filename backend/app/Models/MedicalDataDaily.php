<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class MedicalDataDaily extends Model
{
    protected $table = 'medical_data_daily';

    public $timestamps = false;

    protected $fillable = [
        'device_id',
        'day',
        'profile_id',
        'sample_count',
        'metrics',
        'calculated_at',
    ];

    protected function casts(): array
    {
        return [
            'day' => 'date',
            'metrics' => 'array',
            'calculated_at' => 'datetime',
        ];
    }

    public function getDayDateAttribute()
    {
        return $this->day;
    }

    public function setDayDateAttribute($value): void
    {
        $this->attributes['day'] = $value;
    }

    public function getSummaryAttribute()
    {
        return $this->metrics;
    }

    public function setSummaryAttribute($value): void
    {
        $this->metrics = $value;
    }

    public function profile(): BelongsTo
    {
        return $this->belongsTo(Profile::class, 'profile_id');
    }

    public function device(): BelongsTo
    {
        return $this->belongsTo(Device::class, 'device_id');
    }
}
