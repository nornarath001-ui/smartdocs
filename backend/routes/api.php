<?php

use App\Http\Controllers\Api\ActivityController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\TranslateController;
use App\Http\Controllers\Api\CategoryController;
use App\Http\Controllers\Api\DocumentController;
use App\Http\Controllers\Api\PublicDocumentController;
use App\Http\Controllers\Api\UserController;
use App\Http\Middleware\LogActivity;
use App\Http\Controllers\Api\ConvertController;
use App\Http\Controllers\Api\PublicTranslateController;
use Illuminate\Support\Facades\Route;

// Public
Route::post('/login', [AuthController::class, 'login'])->middleware(['throttle:10,1', LogActivity::class]);
Route::post('/forgot-password', [AuthController::class, 'forgotPassword'])->middleware('throttle:5,1');
Route::post('/reset-password', [AuthController::class, 'resetPassword'])->middleware('throttle:10,1');

// Public portal (published documents only)
Route::prefix('public')->middleware('throttle:120,1')->group(function () {
    Route::get('/documents', [PublicDocumentController::class, 'index']);
    Route::get('/categories', [PublicDocumentController::class, 'categories']);
    Route::get('/filters', [PublicDocumentController::class, 'filters']);
    Route::get('/summary', [PublicDocumentController::class, 'summary']);
    Route::get('/documents/{document}/download', [PublicDocumentController::class, 'download']);
    Route::get('/documents/{document}/preview', [PublicDocumentController::class, 'preview']);
});

// Authenticated
Route::middleware(['auth:sanctum', LogActivity::class])->group(function () {
    Route::post('/logout', [AuthController::class, 'logout']);
    Route::get('/me', [AuthController::class, 'me']);
    Route::get('/translate/config', [TranslateController::class, 'config']);
    Route::post('/translate', [TranslateController::class, 'translate'])->middleware('throttle:30,1');
    Route::put('/translate/settings', [TranslateController::class, 'updateSettings']);
    Route::put('/me', [AuthController::class, 'updateProfile']);
    Route::put('/me/password', [AuthController::class, 'changePassword']);

    Route::apiResource('users', UserController::class)->except('show');
    Route::apiResource('categories', CategoryController::class)->except('show');

    Route::get('/activities', [ActivityController::class, 'index']);
    Route::get('/activities/summary', [ActivityController::class, 'summary']);
    Route::get('/dashboard/users', [ActivityController::class, 'users']);
    Route::get('/dashboard/stats', [DocumentController::class, 'stats']);

    Route::post('/documents/check-duplicates', [DocumentController::class, 'checkDuplicates']);
    Route::get('/documents/{document}/download', [DocumentController::class, 'download']);
    Route::get('/documents/{document}/preview', [DocumentController::class, 'preview']);
    Route::apiResource('documents', DocumentController::class);
});

// File converter (public, rate limited)
Route::prefix('convert')->middleware('throttle:20,1')->group(function () {
    Route::post('/word-to-pdf', [ConvertController::class, 'wordToPdf']);
    Route::post('/pdf-to-word', [ConvertController::class, 'pdfToWord']);
});

// Public translator (no login, rate limited, nothing stored)
Route::prefix('public/translate')->group(function () {
    Route::get('/config', [PublicTranslateController::class, 'config'])->middleware('throttle:120,1');
    Route::post('/', [PublicTranslateController::class, 'text'])->middleware('throttle:40,1');
    Route::post('/file', [PublicTranslateController::class, 'file'])->middleware('throttle:30,1');
});
