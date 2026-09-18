<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class UserDevice extends Model
{
    protected $table = 'user_devices';

    public $timestamps = false;

    protected $fillable = [
        'user_id',
        'device_ref',
        'granted_by',
        'granted_at',
        'can_rename',
        'created_at',
    ];

    protected function casts(): array
    {
        return [
            'granted_at' => 'datetime',
            'created_at' => 'datetime',
            'can_rename' => 'boolean',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function device(): BelongsTo
    {
        return $this->belongsTo(Device::class, 'device_ref');
    }
}
