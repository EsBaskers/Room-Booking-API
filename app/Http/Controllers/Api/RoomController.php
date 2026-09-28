<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreRoomRequest;
use App\Models\Room;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Validator;

class RoomController extends Controller
{
    public function index(): JsonResponse
    {
        $rooms = Room::where('is_active', true)
            ->get(['id', 'name', 'capacity', 'location']);

        return response()->json($rooms);
    }

    public function show(Room $room): JsonResponse
    {
        return response()->json($room);
    }

    public function store(StoreRoomRequest $request): JsonResponse
    {
        $room = Room::create($request->validated());

        return response()->json($room, 201);
    }

    public function schedule(Room $room, string $date): JsonResponse
    {
        Validator::make(['date' => $date], [
            'date' => 'required|date_format:Y-m-d',
        ])->validate();

        $bookings = $room->bookings()
            ->whereDate('starts_at', $date)
            ->orderBy('starts_at')
            ->get()
            ->map(fn ($b) => [
                'title' => $b->title,
                'booked_by' => $b->booked_by,
                'starts_at' => $b->starts_at->format('H:i'),
                'ends_at' => $b->ends_at->format('H:i'),
            ]);

        return response()->json($bookings);
    }

    public function current(Room $room): JsonResponse
    {
        $booking = $room->bookings()
            ->where('starts_at', '<=', now())
            ->where('ends_at', '>', now())
            ->first();

        if (! $booking) {
            return response()->json(['occupied' => false]);
        }

        return response()->json([
            'occupied' => true,
            'booking' => [
                'title' => $booking->title,
                'booked_by' => $booking->booked_by,
                'starts_at' => $booking->starts_at->format('H:i'),
                'ends_at' => $booking->ends_at->format('H:i'),
            ],
        ]);
    }

    public function upcoming(Room $room): JsonResponse
    {
        $bookings = $room->bookings()
            ->where('starts_at', '>', now())
            ->orderBy('starts_at')
            ->limit(5)
            ->get();

        return response()->json($bookings);
    }
}