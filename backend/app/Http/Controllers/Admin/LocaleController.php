<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Middleware\SetAdminLocale;
use Illuminate\Http\Request;

class LocaleController extends Controller
{
    public function __invoke(Request $request)
    {
        $locale = $request->validate([
            'locale' => 'required|in:'.implode(',', SetAdminLocale::LOCALES),
        ])['locale'];

        session(['locale' => $locale]);

        return back()->cookie('admin_locale', $locale, 60 * 24 * 365);
    }
}
