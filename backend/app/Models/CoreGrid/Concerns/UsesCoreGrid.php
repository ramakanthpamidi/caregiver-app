<?php

namespace App\Models\CoreGrid\Concerns;

trait UsesCoreGrid
{
    public function getConnectionName(): ?string
    {
        return 'core_grid';
    }
}
