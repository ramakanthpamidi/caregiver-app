<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AccountCredential extends Model
{
    protected $table = 'account_credentials';

    public $timestamps = false;

    protected $guarded = [];

    protected $hidden = [
        'password_hash',
        'verification_code_hash',
    ];

    protected function casts(): array
    {
        return [
            'is_primary' => 'boolean',
            'is_verified' => 'boolean',
            'verification_expires_at' => 'datetime',
            'verification_sent_at' => 'datetime',
            'last_login_at' => 'datetime',
            'created_at' => 'datetime',
            'updated_at' => 'datetime',
        ];
    }

    public function account(): BelongsTo
    {
        return $this->belongsTo(User::class, 'account_id');
    }

    public function application(): BelongsTo
    {
        return $this->belongsTo(Application::class, 'app_id');
    }

    public function scopeActive(Builder $query): Builder
    {
        return $query->where('credential_status', 'Active');
    }
}
