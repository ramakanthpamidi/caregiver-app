<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\AccountAppMembership;
use App\Models\User;
use App\Support\CoreGridAccess;
use App\Support\CoreGridAccounts;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;

class UserManagementController extends Controller
{
    public function index(Request $request)
    {
        $this->authorizePermission('admin.users.view');

        $q = trim((string) $request->query('q', ''));
        $role = trim((string) $request->query('role', ''));
        $filter = $request->query('filter', 'admins');

        $users = User::query()
            ->with(['credentials', 'memberships.application'])
            ->when($filter === 'admins', function ($query) {
                $query->whereHas('memberships', function ($m) {
                    $m->whereIn('app_id', \App\Support\CoreGridAccess::caregiverAppIds())
                        ->whereIn('app_role', User::ADMIN_ROLES)->where('status', 'Active');
                });
            })
            ->when($filter === 'app', fn ($query) => $query->forCaregiverApps())
            ->when($role !== '', function ($query) use ($role) {
                $query->whereHas('memberships', fn ($m) => $m->where('app_role', $role));
            })
            ->when($q !== '', function ($query) use ($q) {
                $query->where(function ($inner) use ($q) {
                    $inner->where('account_label', 'ilike', "%{$q}%")
                        ->orWhere('id', $q)
                        ->orWhereHas('credentials', fn ($c) => $c->where('login_name', 'ilike', "%{$q}%"));
                });
            })
            ->orderByDesc('id')
            ->paginate(25)
            ->withQueryString();

        $roles = collect(User::ADMIN_ROLES)->map(fn ($name) => (object) ['name' => $name]);

        return view('admin.management.users-index', compact('users', 'q', 'role', 'filter', 'roles'));
    }

    public function create()
    {
        $this->authorizePermission('admin.users.manage');

        return view('admin.management.users-form', [
            'user' => new User(),
            'roles' => collect(User::ADMIN_ROLES)->map(fn ($name) => (object) ['name' => $name]),
            'mode' => 'create',
            'selectedRoles' => [],
        ]);
    }

    public function store(Request $request)
    {
        $this->authorizePermission('admin.users.manage');

        $data = $request->validate([
            'user_label' => 'required|string|max:120',
            'email' => 'required|email|max:255',
            'password' => 'required|string|min:8|confirmed',
            'status' => 'required|string',
            'roles' => 'nullable|array',
        ]);

        if (User::findByEmail($data['email'])) {
            return back()->withErrors(['email' => 'Email already registered in core_grid.'])->withInput();
        }

        $user = CoreGridAccounts::createUser(
            trim($data['user_label']),
            strtolower(trim($data['email'])),
            $data['password'],
            'Email',
            true
        );
        $user->forceFill(['status' => $this->normalizeStatus($data['status'])])->save();
        $this->syncMembershipRole($user, $data['roles'][0] ?? 'CaregiverUser');

        return redirect()
            ->route('admin.management.users.show', $user->id)
            ->with('success', 'User created in core_grid.');
    }

    public function show(int $id)
    {
        $this->authorizePermission('admin.users.view');
        $user = User::with(['credentials', 'memberships.application'])->findOrFail($id);

        return view('admin.management.users-show', compact('user'));
    }

    public function edit(int $id)
    {
        $this->authorizePermission('admin.users.manage');
        $user = User::with('memberships')->findOrFail($id);

        return view('admin.management.users-form', [
            'user' => $user,
            'roles' => collect(User::ADMIN_ROLES)->map(fn ($name) => (object) ['name' => $name]),
            'mode' => 'edit',
            'selectedRoles' => $user->memberships->pluck('app_role')->all(),
        ]);
    }

    public function update(Request $request, int $id)
    {
        $this->authorizePermission('admin.users.manage');
        $user = User::findOrFail($id);

        $data = $request->validate([
            'user_label' => 'required|string|max:120',
            'email' => 'required|email|max:255',
            'password' => 'nullable|string|min:8|confirmed',
            'status' => 'required|string',
            'roles' => 'nullable|array',
        ]);

        $user->forceFill([
            'account_label' => trim($data['user_label']),
            'status' => $this->normalizeStatus($data['status']),
        ])->save();

        $credential = $user->primaryCredential();
        if ($credential) {
            $credential->login_name = strtolower(trim($data['email']));
            if (!empty($data['password'])) {
                $credential->password_hash = Hash::make($data['password']);
            }
            $credential->save();
        }

        if (!empty($data['roles'][0])) {
            $this->syncMembershipRole($user, $data['roles'][0]);
        }

        return redirect()
            ->route('admin.management.users.show', $user->id)
            ->with('success', 'User updated.');
    }

    public function destroy(Request $request, int $id)
    {
        $this->authorizePermission('admin.users.manage');
        $user = User::findOrFail($id);

        if ((int) $request->user()->id === (int) $user->id) {
            return back()->withErrors(['error' => 'You cannot delete your own account.']);
        }

        $user->forceFill(['status' => 'Deleted', 'disabled_at' => now()])->save();
        $user->credentials()->update(['credential_status' => 'Revoked']);
        $user->tokens()->delete();

        return redirect()
            ->route('admin.management.users')
            ->with('success', 'User deleted.');
    }

    private function authorizePermission(string $permission): void
    {
        abort_unless(auth()->user()?->can($permission), 403, 'Missing permission: '.$permission);
    }

    private function normalizeStatus(string $status): string
    {
        return match (strtolower($status)) {
            'active' => 'Active',
            'disabled' => 'Disabled',
            'pending_verification', 'pending' => 'Pending',
            'deleted' => 'Deleted',
            default => $status,
        };
    }

    private function syncMembershipRole(User $user, string $role): void
    {
        $appId = CoreGridAccess::caregiverAppId();
        if (!$appId) {
            return;
        }

        $membership = AccountAppMembership::query()->firstOrNew([
            'account_id' => $user->id,
            'app_id' => $appId,
        ]);
        $membership->app_role = $role;
        $membership->status = 'Active';
        $membership->granted_at = $membership->granted_at ?? now();
        $membership->save();
    }
}
