@extends('admin.layout')

@section('title', __('admin.users.title'))
@section('subtitle', __('admin.users.subtitle'))

@section('content')
<div class="card">
    <form class="search" method="get" action="{{ route('admin.users') }}">
        <input type="search" name="q" value="{{ $q }}" placeholder="{{ __('admin.users.search') }}">
        <button type="submit">{{ __('admin.search') }}</button>
        @if($q !== '')
            <a class="btn secondary" href="{{ route('admin.users') }}">{{ __('admin.clear') }}</a>
        @endif
    </form>
</div>

<div class="card">
    <table>
        <thead>
        <tr>
            <th>{{ __('admin.id') }}</th>
            <th>{{ __('admin.label') }}</th>
            <th>{{ __('admin.email') }}</th>
            <th>{{ __('admin.applications') }}</th>
            <th>{{ __('admin.role') }}</th>
            <th>{{ __('admin.verified') }}</th>
            <th>{{ __('admin.status') }}</th>
            <th>{{ __('admin.last_login') }}</th>
            <th>{{ __('admin.created') }}</th>
        </tr>
        </thead>
        <tbody>
        @forelse($users as $user)
            <tr>
                <td><a href="{{ route('admin.users.show', $user->id) }}">{{ $user->id }}</a></td>
                <td>{{ $user->user_label }}</td>
                <td>{{ $user->email ?? '—' }}</td>
                <td>
                    @forelse($user->memberships as $m)
                        <span class="badge">{{ $m->application?->app_name ?? ('app '.$m->app_id) }}</span>
                    @empty
                        @foreach($user->credentials as $c)
                            <span class="badge muted">app {{ $c->app_id }}</span>
                        @endforeach
                    @endforelse
                </td>
                <td>
                    @forelse($user->memberships as $m)
                        <span class="badge">{{ $m->app_role }}</span>
                    @empty
                        <span class="badge muted">—</span>
                    @endforelse
                </td>
                <td>
                    @if($user->email_verified)
                        <span class="badge ok">{{ __('admin.yes') }}</span>
                    @else
                        <span class="badge muted">{{ __('admin.no') }}</span>
                    @endif
                </td>
                <td><span class="badge">{{ $user->status }}</span></td>
                <td class="mono">{{ optional($user->last_login_at)?->format('Y-m-d H:i') ?? '—' }}</td>
                <td class="mono">{{ optional($user->created_at)?->format('Y-m-d H:i') }}</td>
            </tr>
        @empty
            <tr><td colspan="9" class="muted">{{ __('admin.users.empty') }}</td></tr>
        @endforelse
        </tbody>
    </table>
    <div class="pagination">{{ $users->links() }}</div>
</div>
@endsection
