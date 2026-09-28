<?php

use App\Http\Controllers\Api\BookingController;
use App\Http\Controllers\Api\RoomController;
use Illuminate\Support\Facades\Route;

Route::get('/rooms', [RoomController::class, 'index']);
Route::post('/rooms', [RoomController::class, 'store']);
Route::get('/rooms/{room}', [RoomController::class, 'show']);
Route::get('/rooms/{room}/schedule/{date}', [RoomController::class, 'schedule']);
Route::get('/rooms/{room}/current', [RoomController::class, 'current']);
Route::get('/rooms/{room}/upcoming', [RoomController::class, 'upcoming']);

Route::post('/bookings', [BookingController::class, 'store']);