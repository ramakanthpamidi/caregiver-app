<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    public function showLogin()
    {
        if (Auth::check() && Auth::user()->canAccessAdmin()) {
            return redirect()->route('admin.dashboard');
        }

        return view('admin.auth.login');
    }

    public function login(Request $request)
    {
        $credentials = $request->validate([
            'email' => 'required|email',
            'password' => 'required|string',
        ]);

        $email = strtolower(trim($credentials['email']));

        if (!Auth::attempt(['email' => $email, 'password' => $credentials['password']], $request->boolean('remember'))) {
            throw ValidationException::withMessages([
                'email' => __('admin.auth.invalid'),
            ]);
        }

        $user = Auth::user();

        if (!$user || $user->deleted_at !== null || in_array(strtolower((string) $user->status), ['disabled', 'deleted', 'suspended'], true)) {
            Auth::logout();
            throw ValidationException::withMessages([
                'email' => __('admin.auth.disabled'),
            ]);
        }

        if (!$user->canAccessAdmin()) {
            Auth::logout();
            throw ValidationException::withMessages([
                'email' => __('admin.auth.no_role'),
            ]);
        }

        $request->session()->regenerate();
        $user->markCredentialLogin();

        return redirect()->intended(route('admin.dashboard'));
    }

    public function logout(Request $request)
    {
        Auth::logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return redirect()->route('admin.login');
    }
}
