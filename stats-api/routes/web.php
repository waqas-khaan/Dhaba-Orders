<?php

use Illuminate\Support\Facades\Route;

Route::get('/', fn() => response()->json(['service' => 'stats-api']));
Route::get('/health', fn() => response()->json(['status' => 'ok', 'version' => env('APP_VERSION', 'dev')]));
