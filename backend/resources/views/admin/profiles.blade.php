@extends('admin.layout')

@section('title', __('admin.profiles.title'))
@section('subtitle', __('admin.profiles.subtitle'))

@section('content')
<div class="card">
    <form class="search" method="get" action="{{ route('admin.profiles') }}">
        <input type="search" name="q" value="{{ $q }}" placeholder="{{ __('admin.profiles.search') }}">
        <button type="submit">{{ __('admin.search') }}</button>
        @if($q !== '')
            <a class="btn secondary" href="{{ route('admin.profiles') }}">{{ __('admin.clear') }}</a>
        @endif
    </form>
</div>

<div class="card">
    <table>
        <thead>
        <tr>
            <th>ID</th>
            <th>Label</th>
            <th>Owner user</th>
            <th>Password</th>
            <th>Last used</th>
            <th>Created</th>
        </tr>
        </thead>
        <tbody>
        @forelse($profiles as $p)
            <tr>
                <td><a href="{{ route('admin.profiles.show', $p->id) }}">{{ $p->id }}</a></td>
                <td>{{ $p->profile_label }}</td>
                <td><a href="{{ route('admin.users.show', $p->owner_user_id) }}">#{{ $p->owner_user_id }}</a></td>
                <td>{{ $p->access_password_hash ? 'yes' : 'no' }}</td>
                <td class="mono">{{ optional($p->last_used_at)?->format('Y-m-d H:i') ?? '—' }}</td>
                <td class="mono">{{ optional($p->created_at)?->format('Y-m-d H:i') }}</td>
            </tr>
        @empty
            <tr><td colspan="6" class="muted">No profiles found.</td></tr>
        @endforelse
        </tbody>
    </table>
    <div class="pagination">{{ $profiles->links() }}</div>
</div>
@endsection
