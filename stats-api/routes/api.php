<?php
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Redis;
Route::get('/stats', function () {
  $total = DB::table('orders')->count();
  $since = DB::table('orders')->where('created_at','>=',now()->subMinute())->count();
  $top = DB::table('order_items')->select('dish_name',DB::raw('SUM(quantity) as qty'))->groupBy('dish_name')->orderByDesc('qty')->first();
  Redis::setex('stats:last-read',60,(string)now());
  return response()->json(['total_orders'=>$total,'orders_per_minute'=>$since,'top_dish'=>$top?->dish_name ?? 'No orders']);
});
$health = fn()=>response()->json(['status'=>'ok','version'=>env('APP_VERSION','dev')]);

Route::get('/health', $health);
Route::get('/heath', $health);
