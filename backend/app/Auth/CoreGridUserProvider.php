<?php

namespace App\Auth;

use App\Models\AccountCredential;
use App\Models\User;
use Illuminate\Contracts\Auth\Authenticatable as UserContract;
use Illuminate\Auth\EloquentUserProvider;
use Illuminate\Contracts\Auth\Authenticatable;
use Illuminate\Contracts\Hashing\Hasher;
use Illuminate\Support\Facades\Hash;

class CoreGridUserProvider extends EloquentUserProvider
{
    public function __construct(Hasher $hasher)
    {
        parent::__construct($hasher, User::class);
    }

    public function retrieveById($identifier): ?Authenticatable
    {
        return User::query()->find($identifier);
    }

    public function retrieveByCredentials(array $credentials): ?Authenticatable
    {
        $email = strtolower(trim((string) ($credentials['email'] ?? $credentials['login_name'] ?? '')));
        if ($email === '') {
            return null;
        }

        $credential = AccountCredential::query()
            ->active()
            ->whereRaw('lower(login_name) = ?', [$email])
            ->orderByDesc('is_primary')
            ->first();

        return $credential?->account;
    }

    public function validateCredentials(Authenticatable $user, array $credentials): bool
    {
        $plain = (string) ($credentials['password'] ?? '');
        if ($plain === '' || !$user instanceof User) {
            return false;
        }

        return AccountCredential::query()
            ->active()
            ->where('account_id', $user->id)
            ->get()
            ->contains(function (AccountCredential $credential) use ($plain) {
                $hash = (string) $credential->password_hash;
                if ($hash === '') {
                    return false;
                }
                try {
                    return Hash::check($plain, $hash);
                } catch (\Throwable) {
                    return password_verify($plain, $hash);
                }
            });
    }

    public function rehashPasswordIfRequired(Authenticatable $user, array $credentials, bool $force = false): void
    {
        // Password lives on account_credentials; skip Eloquent rehash against accounts.
    }
}
