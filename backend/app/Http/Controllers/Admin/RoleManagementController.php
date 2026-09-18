<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;

class RoleManagementController extends Controller
{
    public function index()
    {
        $this->authorizePermission('admin.roles.view');

        $roles = Role::where('guard_name', 'web')
            ->with('permissions')
            ->withCount('users')
            ->orderBy('name')
            ->get();

        $permissions = Permission::where('guard_name', 'web')->orderBy('name')->get();

        return view('admin.management.roles-index', compact('roles', 'permissions'));
    }

    public function create()
    {
        $this->authorizePermission('admin.roles.manage');
        $permissions = Permission::where('guard_name', 'web')->orderBy('name')->get()->groupBy(function ($p) {
            return explode('.', $p->name)[0] ?? 'other';
        });

        return view('admin.management.roles-form', [
            'role' => new Role(['guard_name' => 'web']),
            'permissions' => $permissions,
            'selected' => [],
            'mode' => 'create',
        ]);
    }

    public function store(Request $request)
    {
        $this->authorizePermission('admin.roles.manage');

        $data = $request->validate([
            'name' => [
                'required',
                'string',
                'max:64',
                'regex:/^[a-z0-9_]+$/',
                Rule::unique('roles', 'name')->where(fn ($q) => $q->where('guard_name', 'web')),
            ],
            'permissions' => 'nullable|array',
            'permissions.*' => 'string|exists:permissions,name',
        ]);

        if ($data['name'] === 'super_admin' && !auth()->user()->isSuperAdmin()) {
            abort(403, 'Cannot create super_admin role.');
        }

        $role = Role::create([
            'name' => $data['name'],
            'guard_name' => 'web',
        ]);
        $role->syncPermissions($data['permissions'] ?? []);
        app()[PermissionRegistrar::class]->forgetCachedPermissions();

        return redirect()
            ->route('admin.management.roles')
            ->with('success', 'Role created.');
    }

    public function edit(int $id)
    {
        $this->authorizePermission('admin.roles.manage');
        $role = Role::where('guard_name', 'web')->with('permissions')->findOrFail($id);

        if ($role->name === 'super_admin' && !auth()->user()->isSuperAdmin()) {
            abort(403, 'Only super admins can edit super_admin.');
        }

        $permissions = Permission::where('guard_name', 'web')->orderBy('name')->get()->groupBy(function ($p) {
            return explode('.', $p->name)[0] ?? 'other';
        });

        return view('admin.management.roles-form', [
            'role' => $role,
            'permissions' => $permissions,
            'selected' => $role->permissions->pluck('name')->all(),
            'mode' => 'edit',
        ]);
    }

    public function update(Request $request, int $id)
    {
        $this->authorizePermission('admin.roles.manage');
        $role = Role::where('guard_name', 'web')->findOrFail($id);

        if ($role->name === 'super_admin' && !auth()->user()->isSuperAdmin()) {
            abort(403, 'Only super admins can edit super_admin.');
        }

        $data = $request->validate([
            'name' => [
                'required',
                'string',
                'max:64',
                'regex:/^[a-z0-9_]+$/',
                Rule::unique('roles', 'name')
                    ->where(fn ($q) => $q->where('guard_name', 'web'))
                    ->ignore($role->id),
            ],
            'permissions' => 'nullable|array',
            'permissions.*' => 'string|exists:permissions,name',
        ]);

        // Keep super_admin name stable
        if ($role->name === 'super_admin') {
            $data['name'] = 'super_admin';
        }

        $role->name = $data['name'];
        $role->save();
        $role->syncPermissions($data['permissions'] ?? []);
        app()[PermissionRegistrar::class]->forgetCachedPermissions();

        return redirect()
            ->route('admin.management.roles')
            ->with('success', 'Role updated.');
    }

    public function destroy(Request $request, int $id)
    {
        $this->authorizePermission('admin.roles.manage');
        $role = Role::where('guard_name', 'web')->findOrFail($id);

        if (in_array($role->name, ['super_admin', 'admin', 'support', 'viewer'], true)) {
            return back()->withErrors(['error' => 'Built-in roles cannot be deleted.']);
        }

        $role->delete();
        app()[PermissionRegistrar::class]->forgetCachedPermissions();

        return redirect()
            ->route('admin.management.roles')
            ->with('success', 'Role deleted.');
    }

    private function authorizePermission(string $permission): void
    {
        abort_unless(auth()->user()?->can($permission), 403, 'Missing permission: '.$permission);
    }
}
