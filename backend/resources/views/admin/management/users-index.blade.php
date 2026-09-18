@extends('admin.layout')

@section('title', __('admin.mgmt.users_title'))
@section('subtitle', __('admin.mgmt.users_sub'))

@section('content')
<div class="card">
    <div class="actions" style="justify-content: space-between;">
        <div class="tabs">
            <a href="{{ route('admin.management.users', ['filter' => 'admins'] + request()->except('filter','page')) }}" class="{{ $filter === 'admins' ? 'active' : '' }}">{{ __('admin.mgmt.admin_users') }}</a>
            <a href="{{ route('admin.management.users', ['filter' => 'all'] + request()->except('filter','page')) }}" class="{{ $filter === 'all' ? 'active' : '' }}">{{ __('admin.mgmt.all_users') }}</a>
            <a href="{{ route('admin.management.users', ['filter' => 'app'] + request()->except('filter','page')) }}" class="{{ $filter === 'app' ? 'active' : '' }}">{{ __('admin.mgmt.app_only') }}</a>
        </div>
        @can('admin.users.manage')
            <a class="btn" href="{{ route('admin.management.users.create') }}">+ New user</a>
        @endcan
    </div>
</div>

<div class="card">
    <form class="search" method="get" action="{{ route('admin.management.users') }}">
        <input type="hidden" name="filter" value="{{ $filter }}">
        <input type="search" name="q" value="{{ $q }}" placeholder="Search email, label, id…">
        <select name="role">
            <option value="">Any role</option>
            @foreach($roles as $r)
                <option value="{{ $r->name }}" @selected($role === $r->name)>{{ $r->name }}</option>
            @endforeach
        </select>
        <button type="submit">Search</button>
        @if($q !== '' || $role !== '')
            <a class="btn secondary" href="{{ route('admin.management.users', ['filter' => $filter]) }}">Clear</a>
        @endif
    </form>
</div>

<div class="card">
    <table>
        <thead>
        <tr>
            <th>ID</th>
            <th>Label</th>
            <th>Email</th>
            <th>Roles</th>
            <th>Status</th>
            <th>Last login</th>
            <th></th>
        </tr>
        </thead>
        <tbody>
        @forelse($users as $user)
            <tr>
                <td>{{ $user->id }}</td>
                <td>{{ $user->user_label }}</td>
                <td>{{ $user->email ?? '—' }}</td>
                <td>
                    @forelse($user->roles as $r)
                        <span class="badge">{{ $r->name }}</span>
                    @empty
                        <span class="badge muted">none</span>
                    @endforelse
                </td>
                <td><span class="badge">{{ $user->status }}</span></td>
                <td class="mono">{{ optional($user->last_login_at)?->format('Y-m-d H:i') ?? '—' }}</td>
                <td class="actions">
                    <a class="btn secondary sm" href="{{ route('admin.management.users.show', $user->id) }}">View</a>
                    @can('admin.users.manage')
                        <a class="btn sm" href="{{ route('admin.management.users.edit', $user->id) }}">Edit</a>
                    @endcan
                </td>
            </tr>
        @empty
            <tr><td colspan="7" class="muted">No users found.</td></tr>
        @endforelse
        </tbody>
    </table>
    <div class="pagination">{{ $users->links() }}</div>
</div>
@endsection
