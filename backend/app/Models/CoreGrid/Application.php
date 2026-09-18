<?php

namespace App\Models\CoreGrid;

use App\Models\CoreGrid\Concerns\UsesCoreGrid;
use Illuminate\Database\Eloquent\Model;

class Application extends Model
{
    use UsesCoreGrid;

    protected $table = 'applications';

    public $timestamps = false;

    protected $guarded = [];

    protected function casts(): array
    {
        return [
            'is_active' => 'boolean',
            'created_at' => 'datetime',
        ];
    }
}
