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

            if ($this->overlaps($data['room_id'], $data['starts_at'], $data['ends_at'])) {
                return response()->json(['message' => 'Room is already booked for this period.'], 422);
            }

            $booking = Booking::create($data);

            return response()->json($booking, 201);
        });
    }

    public function update(StoreBookingRequest $request, Booking $booking): JsonResponse
    {
        $data = $request->validated();

        return DB::transaction(function () use ($data, $booking) {
            $room = Room::lockForUpdate()->find($data['room_id']);

            if (! $room->is_active) {
                return response()->json(['message' => 'Room is not active.'], 422);
            }

            // Exclude this booking itself from the overlap check
            if ($this->overlaps($data['room_id'], $data['starts_at'], $data['ends_at'], $booking->id)) {
                return response()->json(['message' => 'Room is already booked for this period.'], 422);
            }

            $booking->update($data);

            return response()->json($booking->fresh());
        });
    }

    public function destroy(Booking $booking): JsonResponse
    {
        $booking->delete();

        return response()->json(null, 204);
    }

    /**
     * Two periods overlap when an existing one starts before the new one ends
     * AND ends after the new one starts. Strict < and > allow back-to-back bookings.
     */
    private function overlaps(int $roomId, string $startsAt, string $endsAt, ?int $excludeBookingId = null): bool
    {
        return Booking::where('room_id', $roomId)
            ->when($excludeBookingId, fn ($q) => $q->where('id', '!=', $excludeBookingId))
            ->where('starts_at', '<', $endsAt)
            ->where('ends_at', '>', $startsAt)
            ->exists();
    }
}