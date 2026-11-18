<?php
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Redis;

Route::get('/stats', function () {
  $total = DB::table('orders')->count();
  $since = DB::table('orders')->where('created_at','>=',now()->subMinute())->count();
  $top = DB::table('order_items')->select('dish_name',DB::raw('SUM(quantity) as qty'))->groupBy('dish_name')->orderByDesc('qty')->first();
  $statusBreakdown = DB::table('orders')->select('status', DB::raw('count(*) as count'))->groupBy('status')->pluck('count', 'status')->all();

  $workerRaw = null;
  $workerHeartbeat = null;
  try {
    Redis::setex('stats:last-read',60,(string)now());
    $workerHeartbeat = Redis::get('worker:heartbeat');
    $workerRaw = Redis::get('worker:status');
  } catch (\Throwable $e) {}

  $workerStatus = $workerRaw ? json_decode($workerRaw, true) : ($workerHeartbeat ? ['status' => 'active', 'heartbeat' => $workerHeartbeat] : ['status' => 'idle']);

  return response()->json([
    'total_orders' => $total,
    'orders_per_minute' => $since,
    'top_dish' => $top?->dish_name ?? 'No orders',
    'status_breakdown' => $statusBreakdown,
    'worker' => $workerStatus,
    'system_status' => 'healthy',
    'updated_at' => now()->toIso8601String(),
  ]);
});

$health = require __DIR__ . '/health.php';

Route::get('/health', $health);
Route::get('/heath', $health);
Route::get('/info', fn() => response()->json([
  'service' => 'stats-api',
  'version' => env('APP_VERSION', 'dev'),
  'status' => 'ok',
  'service_type' => 'analytics',
  'timestamp' => now()->toIso8601String(),
  'endpoints' => ['/health', '/stats', '/info'],
]));
