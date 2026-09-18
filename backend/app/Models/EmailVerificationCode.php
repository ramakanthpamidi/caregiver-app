<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class EmailVerificationCode extends Model
{
    protected $table = 'email_verification_codes';

    public $timestamps = false;

    protected $fillable = [
        'email',
        'code',
        'user_id',
        'expires_at',
        'consumed_at',
        'created_at',
    ];

    protected function casts(): array
    {
        return [
            'expires_at' => 'datetime',
            'consumed_at' => 'datetime',
            'created_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function isValid(): bool
    {
        return $this->consumed_at === null && $this->expires_at !== null && $this->expires_at->isFuture();
    }
}
