<?php

use Illuminate\Auth\AuthenticationException;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use App\Http\Middleware\SetAdminLocale;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
        apiPrefix: '',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->redirectGuestsTo(fn (Request $request) => $request->is('admin') || $request->is('admin/*')
            ? route('admin.login')
            : null);

        $middleware->redirectUsersTo(fn () => route('admin.dashboard'));

        $middleware->web(append: [
            SetAdminLocale::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $isAdminUi = fn (Request $request) => $request->is('admin') || $request->is('admin/*');

        $exceptions->shouldRenderJsonWhen(
            fn (Request $request) => ! $isAdminUi($request)
        );

        $exceptions->render(function (ValidationException $e, Request $request) use ($isAdminUi) {
            if ($isAdminUi($request)) {
                return null;
            }

            $message = collect($e->errors())->flatten()->first() ?: $e->getMessage();

            return response()->json([
                'error' => $message,
                'message' => $message,
                'errors' => $e->errors(),
            ], 400);
        });

        $exceptions->render(function (AuthenticationException $e, Request $request) use ($isAdminUi) {
            if ($isAdminUi($request)) {
                return redirect()->guest(route('admin.login'));
            }

            return response()->json([
                'error' => 'Unauthenticated',
                'message' => 'Unauthenticated',
            ], 401);
        });

        $exceptions->render(function (HttpExceptionInterface $e, Request $request) use ($isAdminUi) {
            if ($isAdminUi($request)) {
                return null;
            }

            $message = $e->getMessage() ?: 'Request failed';

            return response()->json([
                'error' => $message,
                'message' => $message,
            ], $e->getStatusCode());
        });
    })->create();
