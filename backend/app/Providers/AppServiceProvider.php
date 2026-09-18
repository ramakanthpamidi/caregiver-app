<?php

namespace App\Providers;

use App\Auth\CoreGridUserProvider;
use Illuminate\Pagination\Paginator;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        Paginator::useBootstrapFive();

        Auth::provider('core_grid', function ($app, array $config) {
            return new CoreGridUserProvider($app['hash']);
        });

        Gate::before(function ($user, $ability) {
            if (is_object($user) && method_exists($user, 'authorizeCoreGrid')) {
                return $user->authorizeCoreGrid((string) $ability);
            }

            return null;
        });
    }
}
