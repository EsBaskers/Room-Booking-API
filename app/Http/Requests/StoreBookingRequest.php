<?php

namespace App\Http\Requests;

use Carbon\Carbon;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Contracts\Validation\Validator;

class StoreBookingRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'room_id' => 'required|integer|exists:rooms,id',
            'title' => 'required|string|max:255',
            'booked_by' => 'required|string|max:255',
            'starts_at' => 'required|date',
            'ends_at' => 'required|date|after:starts_at',
        ];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator) {
            if (! $this->starts_at || ! $this->ends_at) {
                return;
            }

            $start = Carbon::parse($this->starts_at);
            $end = Carbon::parse($this->ends_at);

            $open = $start->copy()->setTime(7, 0);
            $close = $start->copy()->setTime(21, 0);

            if ($start->lt($open) || $end->gt($close)) {
                $validator->errors()->add('starts_at', 'Bookings must be between 07:00 and 21:00.');
            }
        });
    }
}