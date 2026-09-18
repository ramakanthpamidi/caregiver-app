<?php

namespace App\Http\Controllers\Admin\Concerns;

trait AuthorizesAdminPermissions
{
    protected function authorizePermission(string $permission): void
    {
        abort_unless(auth()->user()?->can($permission), 403, 'Missing permission: '.$permission);
    }
}
