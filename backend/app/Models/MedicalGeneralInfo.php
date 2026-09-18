<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class MedicalGeneralInfo extends Model
{
    protected $table = 'profile_medical_info';

    public $timestamps = false;

    protected $fillable = [
        'profile_id',
        'date_of_birth',
        'sex',
        'organ_donor',
        'blood_type',
        'height_cm',
        'weight_kg',
        'allergies',
        'chronic_conditions',
        'medications',
        'family_history',
        'emergency_contact',
        'insurance_provider',
        'insurance_number',
        'created_at',
        'updated_at',
        'updated_by',
        'encrypted_payload',
    ];

    protected function casts(): array
    {
        return [
            'date_of_birth' => 'date:Y-m-d',
            'organ_donor' => 'boolean',
            'height_cm' => 'float',
            'weight_kg' => 'float',
            'allergies' => 'array',
            'chronic_conditions' => 'array',
            'medications' => 'array',
            'family_history' => 'array',
            'emergency_contact' => 'array',
            'encrypted_payload' => 'array',
            'created_at' => 'datetime',
            'updated_at' => 'datetime',
        ];
    }

    public function profile(): BelongsTo
    {
        return $this->belongsTo(Profile::class, 'profile_id');
    }

    public function toPayload(): array
    {
        $contact = $this->emergency_contact;
        if (is_array($contact)) {
            $contact = $contact['name'] ?? $contact['value'] ?? json_encode($contact);
        }

        return [
            'id' => (int) $this->id,
            'profile_id' => (int) $this->profile_id,
            'date_of_birth' => optional($this->date_of_birth)?->format('Y-m-d'),
            'sex' => $this->sex,
            'organ_donor' => $this->organ_donor,
            'blood_type' => $this->blood_type,
            'height_cm' => $this->height_cm,
            'weight_kg' => $this->weight_kg,
            'allergies' => $this->allergies,
            'chronic_conditions' => $this->chronic_conditions,
            'medications' => $this->medications,
            'family_history' => $this->family_history,
            'emergency_contact' => $contact,
            'insurance_provider' => $this->insurance_provider,
            'insurance_number' => $this->insurance_number,
            'updated_at' => optional($this->updated_at)?->toISOString(),
        ];
    }
}
