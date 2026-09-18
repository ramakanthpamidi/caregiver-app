@extends('admin.layout')

@section('title', __('admin.events.title'))
@section('subtitle', __('admin.events.subtitle'))

@section('content')
<div class="card">
    <form class="search" method="get" action="{{ route('admin.events') }}">
        <input type="search" name="q" value="{{ $q }}" placeholder="Search event_type, device_id…">
        <input type="text" name="profile_id" value="{{ $profileId }}" placeholder="Filter profile_id" style="min-width:140px;">
        <button type="submit">Search</button>
        @if($q !== '' || $profileId)
            <a class="btn secondary" href="{{ route('admin.events') }}">Clear</a>
        @endif
    </form>
</div>

<div class="card">
    <table>
        <thead>
        <tr>
            <th>ID</th>
            <th>Profile</th>
            <th>Event type</th>
            <th>Device</th>
            <th>Payload preview</th>
            <th>TS</th>
        </tr>
        </thead>
        <tbody>
        @forelse($events as $ev)
            @php
                $payload = is_array($ev->payload) ? $ev->payload : [];
                $preview = $payload ? \Illuminate\Support\Str::limit(json_encode($payload), 80) : '—';
            @endphp
            <tr>
                <td><a href="{{ route('admin.events.show', $ev->id) }}">{{ $ev->id }}</a></td>
                <td><a href="{{ route('admin.profiles.show', $ev->profile_id) }}">#{{ $ev->profile_id }}</a></td>
                <td><span class="badge">{{ $ev->event_type }}</span></td>
                <td class="mono">{{ $ev->device_id ?? '—' }}</td>
                <td class="mono">{{ $preview }}</td>
                <td class="mono">{{ optional($ev->ts)?->format('Y-m-d H:i:s') }}</td>
            </tr>
        @empty
            <tr><td colspan="6" class="muted">No events found.</td></tr>
        @endforelse
        </tbody>
    </table>
    <div class="pagination">{{ $events->links() }}</div>
</div>
@endsection
