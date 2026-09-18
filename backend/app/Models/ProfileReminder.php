<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ProfileReminder extends Model
{
    protected $table = 'profile_reminders';

    public $timestamps = false;

    protected $fillable = [
        'profile_id',
        'title',
        'description',
        'enabled',
        'time_of_day',
        'timezone',
        'repeat_type',
        'repeat_rule',
        'next_fire_at',
        'created_by',
        'updated_by',
    ];

    protected function casts(): array
    {
        return [
            'enabled' => 'boolean',
            'repeat_rule' => 'array',
            'next_fire_at' => 'datetime',
        ];
    }

    public function profile(): BelongsTo
    {
        return $this->belongsTo(Profile::class, 'profile_id');
    }

    public function toPayload(): array
    {
        $time = $this->time_of_day;
        if ($time instanceof \DateTimeInterface) {
            $time = $time->format('H:i:s');
        }

        return [
            'id' => (int) $this->id,
            'profile_id' => (int) $this->profile_id,
            'title' => (string) $this->title,
            'description' => $this->description,
            'enabled' => (bool) $this->enabled,
            'time_of_day' => (string) $time,
            'timezone' => $this->timezone,
            'repeat_type' => (string) $this->repeat_type,
            'repeat_rule' => $this->repeat_rule,
            'next_fire_at' => optional($this->next_fire_at)?->toISOString(),
            'created_at' => optional($this->created_at)?->toISOString(),
            'updated_at' => optional($this->updated_at)?->toISOString(),
            'created_by' => $this->created_by !== null ? (int) $this->created_by : null,
            'updated_by' => $this->updated_by !== null ? (int) $this->updated_by : null,
        ];
    }
}
