<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class LineNotifyTarget extends Model
{
    protected $table = 'notification_targets';

    public $timestamps = false;

    protected $fillable = [
        'membership_id',
        'channel_type',
        'target_key',
        'display_name',
        'enabled',
        'is_verified',
        'verified_at',
        'preferences',
        'created_at',
        'updated_at',
        'created_by',
        'pin_code',
        'pin_expires_at',
    ];

    protected function casts(): array
    {
        return [
            'enabled' => 'boolean',
            'is_verified' => 'boolean',
            'verified_at' => 'datetime',
            'preferences' => 'array',
            'created_at' => 'datetime',
            'updated_at' => 'datetime',
            'pin_expires_at' => 'datetime',
        ];
    }

    public function membership(): BelongsTo
    {
        return $this->belongsTo(AccountAppMembership::class, 'membership_id');
    }

    public function getLineUserIdAttribute(): string
    {
        return (string) $this->target_key;
    }

    public function getLineDisplayNameAttribute(): ?string
    {
        return $this->display_name;
    }

    public function getProfileIdAttribute(): ?int
    {
        return $this->membership?->profileGrants()->value('profile_id');
    }

    public function prefFlag(string $key, bool $default = false): bool
    {
        $prefs = is_array($this->preferences) ? $this->preferences : [];

        return (bool) ($prefs[$key] ?? $default);
    }

    public function toPayload(): array
    {
        return [
            'id' => (int) $this->id,
            'profile_id' => $this->profile_id,
            'line_user_id' => $this->line_user_id,
            'line_display_name' => $this->display_name,
            'notify_critical' => $this->prefFlag('notify_critical', true),
            'notify_warning' => $this->prefFlag('notify_warning', true),
            'notify_good' => $this->prefFlag('notify_good', false),
            'notify_excellent' => $this->prefFlag('notify_excellent', false),
            'enabled' => (bool) $this->enabled,
            'created_at' => optional($this->created_at)?->toISOString() ?? now()->toISOString(),
            'updated_at' => optional($this->updated_at)?->toISOString(),
        ];
    }
}
