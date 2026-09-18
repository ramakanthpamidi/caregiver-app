<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\DeviceController;
use App\Http\Controllers\Api\LineNotifyController;
use App\Http\Controllers\Api\MedicalAlertController;
use App\Http\Controllers\Api\MedicalController;
use App\Http\Controllers\Api\MonitoringKpiController;
use App\Http\Controllers\Api\ProfileController;
use App\Http\Controllers\Api\UserController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| Caregiver mobile API (paths match client: no /api prefix)
|--------------------------------------------------------------------------
*/

// Public auth
Route::post('/users', [AuthController::class, 'register']);
Route::post('/auth/login', [AuthController::class, 'login']);
Route::post('/auth/google', [AuthController::class, 'google']);
Route::post('/auth/facebook', [AuthController::class, 'facebook']);
Route::post('/auth/line', [AuthController::class, 'line']);
Route::post('/auth/verify-email', [AuthController::class, 'verifyEmail']);
Route::post('/auth/resend-verification', [AuthController::class, 'resendVerification']);

// Public device catalog
Route::get('/yuwell/models', [DeviceController::class, 'yuwellModels']);
Route::get('/yuwell/models/{factoryName}', [DeviceController::class, 'yuwellModel']);

// Authenticated
Route::middleware('auth:sanctum')->group(function () {
    // Users
    Route::delete('/users/me', [UserController::class, 'destroyMe']);
    Route::get('/users/me/devices', [UserController::class, 'myDevices']);

    // Profiles
    Route::get('/profiles/me', [ProfileController::class, 'me']);
    Route::post('/profiles', [ProfileController::class, 'store']);
    Route::post('/profiles/with-medical', [ProfileController::class, 'storeWithMedical']);
    Route::put('/profiles/{id}', [ProfileController::class, 'update'])->whereNumber('id');
    Route::delete('/profiles/{id}', [ProfileController::class, 'destroy'])->whereNumber('id');
    Route::post('/profiles/{id}/verify-password', [ProfileController::class, 'verifyPassword'])->whereNumber('id');
    Route::post('/profiles/{id}/use', [ProfileController::class, 'markUsed'])->whereNumber('id');

    Route::get('/profiles/{id}/consents', [ProfileController::class, 'getConsents'])->whereNumber('id');
    Route::put('/profiles/{id}/consents', [ProfileController::class, 'putConsents'])->whereNumber('id');
    Route::get('/profiles/{id}/medical-general', [ProfileController::class, 'getMedicalGeneral'])->whereNumber('id');
    Route::put('/profiles/{id}/medical-general', [ProfileController::class, 'putMedicalGeneral'])->whereNumber('id');
    Route::get('/profiles/{id}/health-report-data', [ProfileController::class, 'healthReportData'])->whereNumber('id');
    Route::get('/profiles/{id}/medical-data-summary', [ProfileController::class, 'medicalDataSummary'])->whereNumber('id');
    Route::delete('/profiles/{id}/medical-data/{category}', [ProfileController::class, 'deleteMedicalData'])->whereNumber('id');

    Route::get('/profiles/{id}/reminders', [ProfileController::class, 'listReminders'])->whereNumber('id');
    Route::post('/profiles/{id}/reminders', [ProfileController::class, 'createReminder'])->whereNumber('id');
    Route::put('/profiles/{id}/reminders/{reminderId}', [ProfileController::class, 'updateReminder'])->whereNumber('id')->whereNumber('reminderId');
    Route::delete('/profiles/{id}/reminders/{reminderId}', [ProfileController::class, 'deleteReminder'])->whereNumber('id')->whereNumber('reminderId');

    Route::get('/profiles/{id}/goals', [ProfileController::class, 'listGoals'])->whereNumber('id');
    Route::post('/profiles/{id}/goals', [ProfileController::class, 'createGoal'])->whereNumber('id');
    Route::put('/profiles/{id}/goals/{goalId}', [ProfileController::class, 'updateGoal'])->whereNumber('id')->whereNumber('goalId');
    Route::put('/profiles/{id}/goals/{goalId}/status', [ProfileController::class, 'updateGoalStatus'])->whereNumber('id')->whereNumber('goalId');
    Route::delete('/profiles/{id}/goals/{goalId}', [ProfileController::class, 'deleteGoal'])->whereNumber('id')->whereNumber('goalId');

    // Medical data / events (local mysql capture used by the mobile app)
    Route::post('/medical-data', [MedicalController::class, 'storeData']);
    Route::get('/medical-data', [MedicalController::class, 'index']);
    Route::get('/medical-data/trends', [MedicalController::class, 'trends']);
    Route::post('/medical-events', [MedicalController::class, 'storeEvent']);
    Route::get('/medical-events', [MedicalController::class, 'listEvents']);

    // core_grid medical alerts / user-wise records
    Route::get('/medical-alerts', [MedicalAlertController::class, 'index']);
    Route::get('/medical-alerts/{id}', [MedicalAlertController::class, 'show'])->whereNumber('id');
    Route::get('/medical-records', [MedicalAlertController::class, 'records']);

    // Admin monitoring room (JSON; /admin/* is the HTML panel)
    Route::get('/monitoring/kpi', MonitoringKpiController::class);
    Route::get('/monitoring/alerts', [MedicalAlertController::class, 'adminIndex']);

    // Devices
    Route::post('/devices', [DeviceController::class, 'store']);
    Route::patch('/devices/{id}', [DeviceController::class, 'update']);
    Route::delete('/devices/{id}', [DeviceController::class, 'destroy']);

    // LINE notify
    Route::get('/line-notify', [LineNotifyController::class, 'index']);
    Route::post('/line-notify', [LineNotifyController::class, 'store']);
    Route::put('/line-notify/{id}', [LineNotifyController::class, 'update'])->whereNumber('id');
    Route::delete('/line-notify/{id}', [LineNotifyController::class, 'destroy'])->whereNumber('id');
    Route::post('/line-notify/link-pin', [LineNotifyController::class, 'linkPin']);
    Route::get('/line-notify/link-status', [LineNotifyController::class, 'linkStatus']);
    Route::post('/line-notify/simulate', [LineNotifyController::class, 'simulate']);
    Route::post('/line-notify/daily-summary', [LineNotifyController::class, 'dailySummary']);
});
