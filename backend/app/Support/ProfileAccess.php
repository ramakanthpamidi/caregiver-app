<?php

namespace App\Support;

use App\Models\Profile;
use App\Models\User;
use Illuminate\Http\Exceptions\HttpResponseException;

class ProfileAccess
{
    public static function ownedOrFail(User $user, int|string $profileId): Profile
    {
        $profile = Profile::query()->alive()->where('id', $profileId)->first();

        if (!$profile || !CoreGridAccess::canViewProfile($user, (int) $profile->id)) {
            throw new HttpResponseException(response()->json([
                'error' => 'Profile not found',
            ], 404));
        }

        return $profile;
    }
}
