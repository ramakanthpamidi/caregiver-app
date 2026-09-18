<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class LineNotifyLinkPin extends Model
{
    protected $table = 'line_notify_link_pins';

    public $timestamps = false;

    protected $fillable = [
        'profile_id',
        'pin',
        'expires_at',
        'linked_at',
        'line_user_id',
        'line_display_name',
        'created_at',
    ];

    protected function casts(): array
    {
        return [
            'expires_at' => 'datetime',
            'linked_at' => 'datetime',
            'created_at' => 'datetime',
        ];
    }

    public function profile(): BelongsTo
    {
        return $this->belongsTo(Profile::class, 'profile_id');
    }
}
