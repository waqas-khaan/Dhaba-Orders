<?php

use Illuminate\Support\Facades\Route;

Route::get('/', fn() => response()->json(['service' => 'stats-api']));
Route::get('/health', fn() => response()->json(['status' => 'ok', 'version' => env('APP_VERSION', 'dev')]));

$health = require __DIR__ . '/health.php';
Route::get('/api/health', $health);
Route::get('/api/heath', $health);
