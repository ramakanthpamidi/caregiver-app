<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class YuwellModel extends Model
{
    protected $table = 'caregiver_device_models';

    public $timestamps = false;

    protected $fillable = [
        'manufacturer',
        'factory_name',
        'device_type',
        'device_subtype',
        'display_name',
        'ble_local_name',
        'ble_service_uuids',
        'ble_characteristics',
        'model_metadata',
        'created_at',
        'updated_at',
    ];

    protected function casts(): array
    {
        return [
            'ble_service_uuids' => 'array',
            'ble_characteristics' => 'array',
            'model_metadata' => 'array',
            'created_at' => 'datetime',
            'updated_at' => 'datetime',
        ];
    }

    public function getMedicalDeviceTypeAttribute(): ?string
    {
        return $this->device_subtype;
    }

    public function getMetaAttribute()
    {
        return $this->model_metadata;
    }

    public function toPayload(): array
    {
        return [
            'id' => (int) $this->id,
            'factory_name' => (string) $this->factory_name,
            'display_name' => $this->display_name,
            'medical_device_type' => $this->device_subtype,
        ];
    }
}
