<?php

namespace Database\Seeders;

use App\Models\Booking;
use App\Models\Room;
use Illuminate\Database\Seeder;

class BookingSeeder extends Seeder
{
    public function run(): void
    {
        $people = ['Anna', 'Toms', 'Līga', 'Jānis', 'Marta'];
        $titles = ['Team Sync', 'Client Call', 'Planning', 'Workshop', 'Interview'];

        // 3 bookings per room on different days (15 total)
        foreach (Room::all() as $i => $room) {
            foreach ([-1, 1, 2] as $j => $dayOffset) {
                $start = now()->startOfDay()->addDays($dayOffset)->addHours(9 + $j * 2);

                Booking::create([
                    'room_id' => $room->id,
                    'title' => $titles[($i + $j) % 5],
                    'booked_by' => $people[($i + $j) % 5],
                    'starts_at' => $start,
                    'ends_at' => $start->copy()->addHour(),
                ]);
            }
        }

        // One booking active right now, so /current shows occupied: true
        Booking::create([
            'room_id' => Room::first()->id,
            'title' => 'Live Meeting',
            'booked_by' => 'Toms',
            'starts_at' => now()->subMinutes(30),
            'ends_at' => now()->addMinutes(30),
        ]);
    }
}