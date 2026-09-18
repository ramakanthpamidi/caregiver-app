<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ProfileGoal extends Model
{
    protected $table = 'profile_goals';

    public $timestamps = false;

    protected $fillable = [
        'profile_id',
        'title',
        'description',
        'goal_type',
        'target',
        'start_date',
        'end_date',
        'status',
        'created_by',
        'updated_by',
    ];

    protected function casts(): array
    {
        return [
            'target' => 'array',
            'start_date' => 'date:Y-m-d',
            'end_date' => 'date:Y-m-d',
        ];
    }

    public function profile(): BelongsTo
    {
        return $this->belongsTo(Profile::class, 'profile_id');
    }

    public function toPayload(): array
    {
        return [
            'id' => (int) $this->id,
            'profile_id' => (int) $this->profile_id,
            'title' => (string) $this->title,
            'description' => $this->description,
            'goal_type' => (string) $this->goal_type,
            'target' => $this->target,
            'start_date' => optional($this->start_date)?->format('Y-m-d') ?? (string) $this->start_date,
            'end_date' => optional($this->end_date)?->format('Y-m-d'),
            'status' => (string) $this->status,
            'created_at' => optional($this->created_at)?->toISOString(),
            'updated_at' => optional($this->updated_at)?->toISOString(),
            'created_by' => $this->created_by !== null ? (int) $this->created_by : null,
            'updated_by' => $this->updated_by !== null ? (int) $this->updated_by : null,
        ];
    }
}
