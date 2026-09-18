@extends('admin.layout')

@section('title', 'User #'.$user->id)
@section('subtitle', $user->user_label.' · '.$user->email)

@section('content')
<div class="card">
    <div class="kv">
        <div class="k">ID</div><div>{{ $user->id }}</div>
        <div class="k">Label</div><div>{{ $user->user_label }}</div>
        <div class="k">Email</div><div>{{ $user->email ?? '—' }}</div>
        <div class="k">Status</div><div><span class="badge">{{ $user->status }}</span></div>
        <div class="k">Email verified</div><div>{{ $user->email_verified ? 'yes' : 'no' }}</div>
        <div class="k">Last login</div><div class="mono">{{ optional($user->last_login_at)?->toDateTimeString() ?? '—' }}</div>
        <div class="k">Created</div><div class="mono">{{ optional($user->created_at)?->toDateTimeString() }}</div>
        <div class="k">Deleted</div><div class="mono">{{ optional($user->deleted_at)?->toDateTimeString() ?? '—' }}</div>
    </div>
</div>

<div class="card">
    <div class="section-title">OAuth identities</div>
    <table>
        <thead><tr><th>Provider</th><th>Provider user id</th><th>Email</th><th>Display</th></tr></thead>
        <tbody>
        @forelse($oauth as $row)
            <tr>
                <td><span class="badge">{{ $row->provider }}</span></td>
                <td class="mono">{{ $row->provider_user_id }}</td>
                <td>{{ $row->email ?? '—' }}</td>
                <td>{{ $row->display_name ?? '—' }}</td>
            </tr>
        @empty
            <tr><td colspan="4" class="muted">No OAuth links.</td></tr>
        @endforelse
        </tbody>
    </table>
</div>

<div class="card">
    <div class="section-title">Profiles</div>
    <table>
        <thead><tr><th>ID</th><th>Label</th><th>Password</th><th>Last used</th></tr></thead>
        <tbody>
        @forelse($profiles as $p)
            <tr>
                <td><a href="{{ route('admin.profiles.show', $p->id) }}">{{ $p->id }}</a></td>
                <td>{{ $p->profile_label }}</td>
                <td>{{ $p->access_password_hash ? 'yes' : 'no' }}</td>
                <td class="mono">{{ optional($p->last_used_at)?->toDateTimeString() ?? '—' }}</td>
            </tr>
        @empty
            <tr><td colspan="4" class="muted">No profiles.</td></tr>
        @endforelse
        </tbody>
    </table>
</div>

<div class="card">
    <div class="section-title">Devices</div>
    <table>
        <thead><tr><th>ID</th><th>device_id</th><th>Name</th><th>Factory</th><th>Status</th></tr></thead>
        <tbody>
        @forelse($devices as $d)
            <tr>
                <td>{{ $d->id }}</td>
                <td class="mono">{{ $d->device_id }}</td>
                <td>{{ $d->device_name }}</td>
                <td>{{ $d->factory_name }}</td>
                <td>
                    @if($d->deleted_at)
                        <span class="badge danger">deleted</span>
                    @else
                        <span class="badge ok">{{ $d->status }}</span>
                    @endif
                </td>
            </tr>
        @empty
            <tr><td colspan="5" class="muted">No devices.</td></tr>
        @endforelse
        </tbody>
    </table>
</div>

<p><a href="{{ route('admin.users') }}">← Back to users</a></p>
@endsection
