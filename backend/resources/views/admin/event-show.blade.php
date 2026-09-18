@extends('admin.layout')

@section('title', 'Event #'.$event->id)
@section('subtitle', $event->event_type)

@section('content')
<div class="card">
    <div class="kv">
        <div class="k">ID</div><div>{{ $event->id }}</div>
        <div class="k">Profile</div>
        <div>
            @if($profile)
                <a href="{{ route('admin.profiles.show', $profile->id) }}">#{{ $profile->id }} {{ $profile->profile_label }}</a>
            @else
                #{{ $event->profile_id }}
            @endif
        </div>
        <div class="k">Event type</div><div><span class="badge">{{ $event->event_type }}</span></div>
        <div class="k">Device id</div><div class="mono">{{ $event->device_id ?? '—' }}</div>
        <div class="k">Device</div><div>{{ $event->device?->device_name ?? '—' }}</div>
        <div class="k">TS</div><div class="mono">{{ optional($event->ts)?->toDateTimeString() }}</div>
        <div class="k">Lat / Lng</div><div class="mono">{{ $event->latitude ?? '—' }} / {{ $event->longitude ?? '—' }}</div>
        <div class="k">Captured by</div><div>{{ $event->captured_by_user_id ?? '—' }}</div>
        <div class="k">Created</div><div class="mono">{{ optional($event->created_at)?->toDateTimeString() }}</div>
    </div>
</div>

<div class="card">
    <div class="section-title">Payload JSON</div>
    <pre class="json">{{ json_encode($event->payload, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE) }}</pre>
</div>

<p><a href="{{ route('admin.events') }}">← Back to events</a></p>
@endsection
