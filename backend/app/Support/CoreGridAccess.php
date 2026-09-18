<?php

namespace App\Support;

use App\Models\AccountAppMembership;
use App\Models\Application;
use App\Models\Profile;
use App\Models\ProfileAccessGrant;
use App\Models\User;
use Illuminate\Http\Exceptions\HttpResponseException;
use Illuminate\Support\Collection;

class CoreGridAccess
{
    public static function isAdmin(User $user): bool
    {
        return $user->canAccessAdmin();
    }

    /**
     * Profile ids the user may read. Null means unrestricted (admin).
     *
     * @return list<int>|null
     */
    public static function visibleProfileIds(User $user): ?array
    {
        if (self::isAdmin($user)) {
            return null;
        }

        $membershipIds = self::activeMemberships($user)->pluck('id');

        $granted = ProfileAccessGrant::query()
            ->active()
            ->whereIn('membership_id', $membershipIds)
            ->pluck('profile_id');

        $owned = Profile::query()
            ->where('created_by_account_id', $user->id)
            ->pluck('id');

        return $granted->merge($owned)->unique()->map(fn ($id) => (int) $id)->values()->all();
    }

    public static function canViewProfile(User $user, int $profileId): bool
    {
        $ids = self::visibleProfileIds($user);

        return $ids === null || in_array($profileId, $ids, true);
    }

    public static function assertCanViewProfile(User $user, int $profileId): void
    {
        if (!self::canViewProfile($user, $profileId)) {
            throw new HttpResponseException(response()->json([
                'error' => 'Profile not found',
                'message' => 'Profile not found',
            ], 404));
        }
    }

    public static function assertAdmin(User $user): void
    {
        if (!self::isAdmin($user)) {
            throw new HttpResponseException(response()->json([
                'error' => 'Forbidden',
                'message' => 'Admin access required',
            ], 403));
        }
    }

    /**
     * @param  list<int>|null  $profileIds
     */
    public static function constrainProfileQuery($query, ?array $profileIds)
    {
        if ($profileIds === null) {
            return $query;
        }

        if ($profileIds === []) {
            return $query->whereRaw('1 = 0');
        }

        return $query->whereIn('profile_id', $profileIds);
    }

    /**
     * @return Collection<int, AccountAppMembership>
     */
    public static function activeMemberships(User $user): Collection
    {
        $appIds = self::caregiverAppIds();

        return $user->memberships()
            ->active()
            ->with('application')
            ->when($appIds !== [], fn ($query) => $query->whereIn('app_id', $appIds))
            ->get()
            ->values();
    }

    public static function caregiverAppIds(): array
    {
        $configured = array_map('intval', config('caregiver.core_grid.caregiver_app_ids', [5, 6]));
        $existing = Application::query()->whereIn('id', $configured)->pluck('id')->all();
        if ($existing !== []) {
            return array_map('intval', $existing);
        }

        $codes = config('caregiver.core_grid.caregiver_app_codes', ['CaregiverMobile', 'CaregiverSite']);

        return Application::query()
            ->whereIn('app_code', $codes)
            ->pluck('id')
            ->all();
    }

    public static function caregiverAppId(): ?int
    {
        $ids = self::caregiverAppIds();

        return $ids[0] ?? null;
    }
}
