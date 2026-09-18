<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AccountCredential;
use App\Models\User;
use App\Support\CoreGridAccounts;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class AuthController extends Controller
{
    public function register(Request $request)
    {
        $data = $request->validate([
            'user_label' => 'required|string|max:120',
            'email' => 'required|email|max:255',
            'password' => 'required|string|min:8',
        ]);

        $email = strtolower(trim($data['email']));

        if (User::findByEmail($email)) {
            return response()->json(['error' => 'Email already registered'], 409);
        }

        $requireVerify = (bool) config('caregiver.require_email_verification', false);

        $user = CoreGridAccounts::createUser(
            trim($data['user_label']),
            $email,
            $data['password'],
            'Email',
            !$requireVerify
        );

        if ($requireVerify) {
            $this->issueVerificationCode($user, $email);

            return response()->json([
                'requiresEmailVerification' => true,
                'email' => $email,
            ], 201);
        }

        $token = $user->issueToken();

        return response()->json([
            'token' => $token,
            'access_token' => $token,
            'user' => $user->toAuthPayload(),
            'isNewAccount' => true,
        ], 201);
    }

    public function login(Request $request)
    {
        $data = $request->validate([
            'email' => 'required|email',
            'password' => 'required|string',
        ]);

        $email = strtolower(trim($data['email']));
        $matched = AccountCredential::query()
            ->active()
            ->whereRaw('lower(login_name) = ?', [$email])
            ->orderByDesc('is_primary')
            ->get()
            ->first(fn (AccountCredential $credential) => self::passwordMatches($credential->password_hash, $data['password']));

        $user = $matched?->account;
        if (!$user) {
            return response()->json(['error' => 'Email or password incorrect'], 401);
        }

        if (!$user->email_verified) {
            return response()->json([
                'error' => 'Email not verified',
                'requiresEmailVerification' => true,
                'email' => $user->email,
            ], 403);
        }

        $status = strtolower((string) $user->status);
        if (in_array($status, ['disabled', 'deleted', 'suspended'], true)) {
            return response()->json(['error' => 'Account disabled'], 403);
        }

        $user->markCredentialLogin();
        $token = $user->issueToken();

        return response()->json([
            'token' => $token,
            'access_token' => $token,
            'user' => $user->toAuthPayload(),
            'hasProfile' => $user->profiles()->alive()->exists(),
        ]);
    }

    public function verifyEmail(Request $request)
    {
        $data = $request->validate([
            'email' => 'required|email',
            'code' => 'required|string',
        ]);

        $email = strtolower(trim($data['email']));
        $code = trim($data['code']);

        $user = User::findByEmail($email);
        $credential = $user?->primaryCredential();
        if (!$user || !$credential) {
            return response()->json(['error' => 'Account not found'], 404);
        }

        $valid = $credential->verification_code_hash
            && $credential->verification_expires_at
            && $credential->verification_expires_at->isFuture()
            && Hash::check($code, $credential->verification_code_hash);

        if (!$valid) {
            return response()->json(['error' => 'Invalid or expired verification code'], 400);
        }

        $credential->forceFill([
            'is_verified' => true,
            'verification_code_hash' => null,
            'verification_expires_at' => null,
        ])->save();
        $user->forceFill([
            'status' => 'Active',
            'activated_at' => $user->activated_at ?: now(),
        ])->save();

        $token = $user->issueToken();

        return response()->json([
            'token' => $token,
            'access_token' => $token,
            'user' => $user->toAuthPayload(),
        ]);
    }

    public function resendVerification(Request $request)
    {
        $data = $request->validate([
            'email' => 'required|email',
        ]);

        $email = strtolower(trim($data['email']));
        $user = User::findByEmail($email);

        if (!$user) {
            // Avoid account enumeration
            return response()->json(['ok' => true]);
        }

        if ($user->email_verified) {
            return response()->json(['ok' => true, 'already_verified' => true]);
        }

        $this->issueVerificationCode($user, $email);

        return response()->json(['ok' => true]);
    }

    public function google(Request $request)
    {
        $data = $request->validate([
            'id_token' => 'required|string',
            'user_label' => 'nullable|string|max:120',
            'mode' => 'nullable|string|in:login,signup',
        ]);

        $profile = $this->resolveGoogleProfile($data['id_token']);
        if (!$profile) {
            return response()->json(['error' => 'Invalid Google token'], 401);
        }

        return $this->completeOauth('google', $profile, $data['user_label'] ?? null, $data['mode'] ?? 'signup');
    }

    public function facebook(Request $request)
    {
        $data = $request->validate([
            'access_token' => 'required|string',
            'user_label' => 'nullable|string|max:120',
            'mode' => 'nullable|string|in:login,signup',
        ]);

        $profile = $this->resolveFacebookProfile($data['access_token']);
        if (!$profile) {
            return response()->json(['error' => 'Invalid Facebook token'], 401);
        }

        return $this->completeOauth('facebook', $profile, $data['user_label'] ?? null, $data['mode'] ?? 'signup');
    }

    public function line(Request $request)
    {
        $data = $request->validate([
            'access_token' => 'required|string',
            'user_label' => 'nullable|string|max:120',
            'mode' => 'nullable|string|in:login,signup',
        ]);

        $profile = $this->resolveLineProfile($data['access_token']);
        if (!$profile) {
            return response()->json(['error' => 'Invalid LINE token'], 401);
        }

        return $this->completeOauth('line', $profile, $data['user_label'] ?? null, $data['mode'] ?? 'signup');
    }

    private function completeOauth(string $provider, array $profile, ?string $userLabel, string $mode)
    {
        $providerUserId = (string) $profile['id'];
        $email = isset($profile['email']) ? strtolower(trim((string) $profile['email'])) : null;
        $displayName = $userLabel
            ?: ($profile['name'] ?? null)
            ?: ($email ? explode('@', $email)[0] : ucfirst($provider).' User');

        $loginType = match ($provider) {
            'google' => 'GoogleAuth',
            'facebook' => 'FacebookAuth',
            'line' => 'LineAuth',
            default => 'Email',
        };

        $isNewAccount = false;
        $user = null;
        if ($email) {
            $user = User::findByEmail($email);
        }
        if (!$user) {
            $user = User::findByEmail($provider.':'.$providerUserId);
        }

        if (!$user) {
            $isNewAccount = true;
            $user = CoreGridAccounts::createUser(
                $displayName,
                $email ?: ($provider.':'.$providerUserId),
                null,
                $loginType,
                true
            );
        }

        if ($userLabel) {
            $user->forceFill(['account_label' => $userLabel])->save();
        }
        $user->markCredentialLogin();

        $token = $user->issueToken($provider);

        return response()->json([
            'token' => $token,
            'access_token' => $token,
            'user' => $user->toAuthPayload(),
            'isNewAccount' => $isNewAccount,
            'hasProfile' => $user->profiles()->alive()->exists(),
        ]);
    }

    private function issueVerificationCode(User $user, string $email): void
    {
        $code = (string) random_int(100000, 999999);
        $credential = $user->primaryCredential();
        if ($credential) {
            $credential->forceFill([
                'verification_code_hash' => Hash::make($code),
                'verification_expires_at' => now()->addMinutes(30),
                'verification_sent_at' => now(),
            ])->save();
        }

        Log::info('Email verification code', ['email' => $email, 'code' => $code]);
    }

    private static function passwordMatches(?string $hash, string $plain): bool
    {
        if (!$hash || $plain === '') {
            return false;
        }

        try {
            if (Hash::check($plain, $hash)) {
                return true;
            }
        } catch (\Throwable) {
            // core_grid may store argon/pgcrypto hashes Laravel's bcrypt driver rejects
        }

        return password_verify($plain, $hash);
    }

    private function resolveGoogleProfile(string $idToken): ?array
    {
        if (config('caregiver.oauth_dev_mode') && str_starts_with($idToken, 'dev:')) {
            $email = substr($idToken, 4) ?: 'google-dev@example.com';

            return [
                'id' => 'dev-google-'.md5($email),
                'email' => $email,
                'name' => explode('@', $email)[0],
            ];
        }

        try {
            $resp = Http::timeout(8)->get('https://oauth2.googleapis.com/tokeninfo', [
                'id_token' => $idToken,
            ]);
            if ($resp->successful() && $resp->json('sub')) {
                return [
                    'id' => (string) $resp->json('sub'),
                    'email' => $resp->json('email'),
                    'name' => $resp->json('name') ?: $resp->json('email'),
                ];
            }
        } catch (\Throwable $e) {
            Log::warning('Google token verify failed', ['error' => $e->getMessage()]);
        }

        if (config('caregiver.oauth_dev_mode')) {
            $hash = substr(hash('sha256', $idToken), 0, 16);

            return [
                'id' => 'dev-google-'.$hash,
                'email' => "google_{$hash}@dev.local",
                'name' => 'Google Dev',
            ];
        }

        return null;
    }

    private function resolveFacebookProfile(string $accessToken): ?array
    {
        if (config('caregiver.oauth_dev_mode') && str_starts_with($accessToken, 'dev:')) {
            $email = substr($accessToken, 4) ?: 'facebook-dev@example.com';

            return [
                'id' => 'dev-fb-'.md5($email),
                'email' => $email,
                'name' => explode('@', $email)[0],
            ];
        }

        try {
            $resp = Http::timeout(8)->get('https://graph.facebook.com/me', [
                'fields' => 'id,name,email',
                'access_token' => $accessToken,
            ]);
            if ($resp->successful() && $resp->json('id')) {
                return [
                    'id' => (string) $resp->json('id'),
                    'email' => $resp->json('email'),
                    'name' => $resp->json('name'),
                ];
            }
        } catch (\Throwable $e) {
            Log::warning('Facebook token verify failed', ['error' => $e->getMessage()]);
        }

        if (config('caregiver.oauth_dev_mode')) {
            $hash = substr(hash('sha256', $accessToken), 0, 16);

            return [
                'id' => 'dev-fb-'.$hash,
                'email' => "facebook_{$hash}@dev.local",
                'name' => 'Facebook Dev',
            ];
        }

        return null;
    }

    private function resolveLineProfile(string $accessToken): ?array
    {
        if (config('caregiver.oauth_dev_mode') && str_starts_with($accessToken, 'dev:')) {
            $name = substr($accessToken, 4) ?: 'line-dev';

            return [
                'id' => 'dev-line-'.md5($name),
                'email' => null,
                'name' => $name,
            ];
        }

        try {
            $resp = Http::timeout(8)
                ->withToken($accessToken)
                ->get('https://api.line.me/v2/profile');
            if ($resp->successful() && $resp->json('userId')) {
                return [
                    'id' => (string) $resp->json('userId'),
                    'email' => null,
                    'name' => $resp->json('displayName'),
                ];
            }
        } catch (\Throwable $e) {
            Log::warning('LINE token verify failed', ['error' => $e->getMessage()]);
        }

        if (config('caregiver.oauth_dev_mode')) {
            $hash = substr(hash('sha256', $accessToken), 0, 16);

            return [
                'id' => 'dev-line-'.$hash,
                'email' => null,
                'name' => 'LINE Dev',
            ];
        }

        return null;
    }

}
