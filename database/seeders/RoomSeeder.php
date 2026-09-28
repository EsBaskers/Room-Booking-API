<?php

namespace Database\Seeders;

use App\Models\Room;
use Illuminate\Database\Seeder;

class RoomSeeder extends Seeder
{
    public function run(): void
    {
        Room::insert([
            ['name' => 'Meeting Room A', 'capacity' => 4,  'location' => '1. stāvs', 'is_active' => true, 'created_at' => now(), 'updated_at' => now()],
            ['name' => 'Meeting Room B', 'capacity' => 6,  'location' => '3. stāvs', 'is_active' => true, 'created_at' => now(), 'updated_at' => now()],
            ['name' => 'Conference Hall', 'capacity' => 20, 'location' => '2. stāvs', 'is_active' => true, 'created_at' => now(), 'updated_at' => now()],
            ['name' => 'Focus Room',      'capacity' => 2,  'location' => '1. stāvs', 'is_active' => true, 'created_at' => now(), 'updated_at' => now()],
            ['name' => 'Workshop Space',  'capacity' => 12, 'location' => '4. stāvs', 'is_active' => true, 'created_at' => now(), 'updated_at' => now()],
        ]);
    }
}