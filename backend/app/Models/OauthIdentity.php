<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class OauthIdentity extends Model
{
    protected $table = 'oauth_identities';

    protected $fillable = [
        'user_id',
        'provider',
        'provider_user_id',
        'email',
        'display_name',
        'raw_profile',
    ];

    protected function casts(): array
    {
        return [
            'raw_profile' => 'array',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }
}
