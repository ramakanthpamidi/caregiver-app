@extends('admin.layout')

@section('title', 'Reading #'.$row->id)
@section('subtitle', 'medical_data_raw')

@section('content')
<div class="card">
    <div class="kv">
        <div class="k">ID</div><div>{{ $row->id }}</div>
        <div class="k">Profile</div>
        <div>
            @if($profile)
                <a href="{{ route('admin.profiles.show', $profile->id) }}">#{{ $profile->id }} {{ $profile->profile_label }}</a>
            @else
                #{{ $row->profile_id }}
            @endif
        </div>
        <div class="k">Device id</div><div class="mono">{{ $row->device_id ?? '—' }}</div>
        <div class="k">Device ref</div><div>{{ $row->device_ref ?? '—' }} · {{ $row->device?->device_name ?? '' }}</div>
        <div class="k">TS</div><div class="mono">{{ optional($row->ts)?->toDateTimeString() }}</div>
        <div class="k">Lat / Lng</div><div class="mono">{{ $row->latitude ?? '—' }} / {{ $row->longitude ?? '—' }}</div>
        <div class="k">Captured by</div><div>{{ $row->captured_by_user_id ?? '—' }}</div>
        <div class="k">Created</div><div class="mono">{{ optional($row->created_at)?->toDateTimeString() }}</div>
    </div>
</div>

<div class="card">
    <div class="section-title">Snapshot JSON</div>
    <pre class="json">{{ json_encode($row->snapshot, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE) }}</pre>
</div>

<p><a href="{{ route('admin.medical') }}">← Back to medical data</a></p>
@endsection
