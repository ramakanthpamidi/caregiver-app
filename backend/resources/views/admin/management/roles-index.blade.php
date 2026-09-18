@extends('admin.layout')

@section('title', 'Roles & permissions')
@section('subtitle', 'Control what each admin role can access')

@section('content')
<div class="card">
    <div class="actions" style="justify-content: space-between;">
        <div class="muted">{{ $roles->count() }} roles · {{ $permissions->count() }} permissions</div>
        @can('admin.roles.manage')
            <a class="btn" href="{{ route('admin.management.roles.create') }}">+ New role</a>
        @endcan
    </div>
</div>

<div class="card">
    <table>
        <thead>
        <tr>
            <th>Role</th>
            <th>Users</th>
            <th>Permissions</th>
            <th></th>
        </tr>
        </thead>
        <tbody>
        @foreach($roles as $role)
            <tr>
                <td><strong>{{ $role->name }}</strong></td>
                <td>{{ $role->users_count }}</td>
                <td>
                    @foreach($role->permissions->sortBy('name') as $p)
                        <span class="badge">{{ $p->name }}</span>
                    @endforeach
                    @if($role->permissions->isEmpty())
                        <span class="badge muted">none</span>
                    @endif
                </td>
                <td class="actions">
                    @can('admin.roles.manage')
                        <a class="btn sm" href="{{ route('admin.management.roles.edit', $role->id) }}">Edit</a>
                        @if(!in_array($role->name, ['super_admin','admin','support','viewer'], true))
                            <form method="post" action="{{ route('admin.management.roles.destroy', $role->id) }}" onsubmit="return confirm('Delete role?');">
                                @csrf
                                @method('DELETE')
                                <button class="btn danger sm" type="submit">Delete</button>
                            </form>
                        @endif
                    @endcan
                </td>
            </tr>
        @endforeach
        </tbody>
    </table>
</div>

<div class="card">
    <div class="section-title">All permissions</div>
    <div>
        @foreach($permissions as $p)
            <span class="badge muted">{{ $p->name }}</span>
        @endforeach
    </div>
</div>
@endsection
