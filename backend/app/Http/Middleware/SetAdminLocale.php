<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\App;
use Symfony\Component\HttpFoundation\Response;

class SetAdminLocale
{
    public const LOCALES = ['en', 'th'];

    public function handle(Request $request, Closure $next): Response
    {
        $locale = $request->query('lang')
            ?? $request->input('lang')
            ?? session('locale')
            ?? $request->cookie('admin_locale')
            ?? config('app.locale', 'en');

        if (! in_array($locale, self::LOCALES, true)) {
            $locale = 'en';
        }

        if ($request->has('lang')) {
            session(['locale' => $locale]);
        }

        App::setLocale($locale);

        $response = $next($request);

        if ($request->has('lang')) {
            $response->headers->setCookie(cookie('admin_locale', $locale, 60 * 24 * 365));
        }

        return $response;
    }
}
