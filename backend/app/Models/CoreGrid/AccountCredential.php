<?php

namespace App\Models\CoreGrid;

use App\Models\CoreGrid\Concerns\UsesCoreGrid;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AccountCredential extends Model
{
    use UsesCoreGrid;

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
        return $this->belongsTo(Account::class, 'account_id');
    }

    public function application(): BelongsTo
    {
        return $this->belongsTo(Application::class, 'app_id');
    }

    public function scopeActive($query)
    {
        return $query->where('credential_status', 'Active');
    }
}
