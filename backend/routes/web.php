<?php

use App\Http\Controllers\Admin\AuthController;
use App\Http\Controllers\Admin\LocaleController;
use App\Http\Controllers\Admin\MonitoringController;
use App\Http\Controllers\Admin\RecordsController;
use App\Http\Controllers\Admin\RoleManagementController;
use App\Http\Controllers\Admin\UserManagementController;
use App\Http\Middleware\EnsureAdminAccess;
use Illuminate\Support\Facades\Route;

Route::redirect('/', '/admin');

Route::prefix('admin')->name('admin.')->group(function () {
    // Guest auth
    Route::middleware('guest')->group(function () {
        Route::get('/login', [AuthController::class, 'showLogin'])->name('login');
        Route::post('/login', [AuthController::class, 'login'])->name('login.submit');
    });

    Route::post('/logout', [AuthController::class, 'logout'])
        ->middleware('auth')
        ->name('logout');

    Route::post('/locale', LocaleController::class)->name('locale');

    // Protected admin panel
    Route::middleware(['auth', EnsureAdminAccess::class])->group(function () {
        Route::get('/', [RecordsController::class, 'dashboard'])->name('dashboard');
        Route::get('/monitoring', [MonitoringController::class, 'index'])->name('monitoring');

        // Records browser
        Route::get('/records/users', [RecordsController::class, 'users'])->name('users');
        Route::get('/records/users/{id}', [RecordsController::class, 'userShow'])->name('users.show')->whereNumber('id');
        Route::get('/profiles', [RecordsController::class, 'profiles'])->name('profiles');
        Route::get('/vitals', [RecordsController::class, 'vitals'])->name('vitals');
        Route::get('/profiles/{id}', [RecordsController::class, 'profileShow'])->name('profiles.show')->whereNumber('id');
        Route::get('/devices', [RecordsController::class, 'devices'])->name('devices');
        Route::get('/medical-data', [RecordsController::class, 'medicalData'])->name('medical');
        Route::get('/medical-data/{id}', [RecordsController::class, 'medicalDataShow'])->name('medical.show')->whereNumber('id');
        Route::get('/events', [RecordsController::class, 'events'])->name('events');
        Route::get('/events/{id}', [RecordsController::class, 'eventShow'])->name('events.show')->whereNumber('id');
        Route::get('/yuwell-models', [RecordsController::class, 'yuwellModels'])->name('yuwell');
        Route::get('/tables', [RecordsController::class, 'tables'])->name('tables');

        // User management
        Route::get('/management/users', [UserManagementController::class, 'index'])->name('management.users');
        Route::get('/management/users/create', [UserManagementController::class, 'create'])->name('management.users.create');
        Route::post('/management/users', [UserManagementController::class, 'store'])->name('management.users.store');
        Route::get('/management/users/{id}', [UserManagementController::class, 'show'])->name('management.users.show')->whereNumber('id');
        Route::get('/management/users/{id}/edit', [UserManagementController::class, 'edit'])->name('management.users.edit')->whereNumber('id');
        Route::put('/management/users/{id}', [UserManagementController::class, 'update'])->name('management.users.update')->whereNumber('id');
        Route::delete('/management/users/{id}', [UserManagementController::class, 'destroy'])->name('management.users.destroy')->whereNumber('id');

        // Role & permission management
        Route::get('/management/roles', [RoleManagementController::class, 'index'])->name('management.roles');
        Route::get('/management/roles/create', [RoleManagementController::class, 'create'])->name('management.roles.create');
        Route::post('/management/roles', [RoleManagementController::class, 'store'])->name('management.roles.store');
        Route::get('/management/roles/{id}/edit', [RoleManagementController::class, 'edit'])->name('management.roles.edit')->whereNumber('id');
        Route::put('/management/roles/{id}', [RoleManagementController::class, 'update'])->name('management.roles.update')->whereNumber('id');
        Route::delete('/management/roles/{id}', [RoleManagementController::class, 'destroy'])->name('management.roles.destroy')->whereNumber('id');
    });
});
