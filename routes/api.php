<?php

use App\Http\Controllers\Api\BookingController;
use App\Http\Controllers\Api\RoomController;
use Illuminate\Support\Facades\Route;

Route::middleware('verify.key')->group(function () {
    Route::get('/rooms', [RoomController::class, 'index']);
    Route::get('/rooms/{room}', [RoomController::class, 'show']);
    Route::get('/rooms/{room}/schedule/{date}', [RoomController::class, 'schedule']);
    Route::get('/rooms/{room}/current', [RoomController::class, 'current']);
    Route::get('/rooms/{room}/upcoming', [RoomController::class, 'upcoming']);

    Route::post('/rooms', [RoomController::class, 'store']);
    Route::post('/bookings', [BookingController::class, 'store']);
    Route::patch('/bookings/{booking}', [BookingController::class, 'update']);
    Route::delete('/bookings/{booking}', [BookingController::class, 'destroy']);
});