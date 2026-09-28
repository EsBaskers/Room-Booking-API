<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreBookingRequest;
use App\Models\Booking;
use App\Models\Room;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;

class BookingController extends Controller
{
    public function store(StoreBookingRequest $request): JsonResponse
    {
        $data = $request->validated();

        return DB::transaction(function () use ($data) {
            // Lock the room row so two simultaneous requests can't both pass the check
            $room = Room::lockForUpdate()->find($data['room_id']);

            if (! $room->is_active) {
                return response()->json(['message' => 'Room is not active.'], 422);
            }

            // Overlap: existing starts before the new one ends AND ends after the new one starts.
            // Strict < and > allow back-to-back bookings (10:00-11:00 then 11:00-12:00).
            $overlap = Booking::where('room_id', $room->id)
                ->where('starts_at', '<', $data['ends_at'])
                ->where('ends_at', '>', $data['starts_at'])
                ->exists();

            if ($overlap) {
                return response()->json(['message' => 'Room is already booked for this period.'], 422);
            }

            $booking = Booking::create($data);

            return response()->json($booking, 201);
        });
    }
}