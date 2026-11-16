<?php

use App\Http\Controllers\StateController;
use App\Http\Middleware\OwnerToken;
use Illuminate\Support\Facades\Route;

Route::get('/health', fn () => ['service' => 'ritmo-api', 'status' => 'ok', 'ai' => 'not_configured']);
Route::post('/planning', fn () => response()->json([
    'code' => 'AI_NOT_CONFIGURED',
    'message' => 'A API PHP está conectada. O provedor de IA ainda não foi configurado; nenhum plano personalizado foi gerado.',
], 503));
Route::middleware(OwnerToken::class)->group(function () {
    Route::get('/state', [StateController::class, 'show']);
    Route::put('/state', [StateController::class, 'update']);
});
