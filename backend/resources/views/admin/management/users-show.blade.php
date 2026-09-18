@extends('admin.layout')

@section('title', 'User #'.$user->id)
@section('subtitle', $user->user_label.' · '.$user->email)

@section('content')
<div class="card">
    <div class="actions" style="margin-bottom: 12px;">
        @can('admin.users.manage')
            <a class="btn" href="{{ route('admin.management.users.edit', $user->id) }}">Edit</a>
        @endcan
        <a class="btn secondary" href="{{ route('admin.management.users') }}">Back</a>
        @can('admin.users.manage')
            @if((int) auth()->id() !== (int) $user->id)
                <form method="post" action="{{ route('admin.management.users.destroy', $user->id) }}" onsubmit="return confirm('Delete this user?');">
                    @csrf
                    @method('DELETE')
                    <button type="submit" class="btn danger">Delete</button>
                </form>
            @endif
        @endcan
    </div>

    <div class="kv">
        <div class="k">ID</div><div>{{ $user->id }}</div>
        <div class="k">Label</div><div>{{ $user->user_label }}</div>
        <div class="k">Email</div><div>{{ $user->email ?? '—' }}</div>
        <div class="k">Status</div><div><span class="badge">{{ $user->status }}</span></div>
        <div class="k">Email verified</div><div>{{ $user->email_verified ? 'yes' : 'no' }}</div>
        <div class="k">Roles</div>
        <div>
            @forelse($user->roles as $r)
                <span class="badge">{{ $r->name }}</span>
            @empty
                <span class="badge muted">none</span>
            @endforelse
        </div>
        <div class="k">Direct permissions</div>
        <div>
            @forelse($user->getDirectPermissions() as $p)
                <span class="badge muted">{{ $p->name }}</span>
            @empty
                <span class="muted">none (via roles only)</span>
            @endforelse
        </div>
        <div class="k">Effective permissions</div>
        <div>
            @foreach($user->getAllPermissions()->sortBy('name') as $p)
                <span class="badge">{{ $p->name }}</span>
            @endforeach
        </div>
        <div class="k">Last login</div><div class="mono">{{ optional($user->last_login_at)?->toDateTimeString() ?? '—' }}</div>
        <div class="k">Created</div><div class="mono">{{ optional($user->created_at)?->toDateTimeString() }}</div>
    </div>
</div>
@endsection
