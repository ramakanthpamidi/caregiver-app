@extends('admin.layout')

@section('title', __('admin.medical.title'))
@section('subtitle', __('admin.medical.subtitle'))

@section('content')
<div class="card">
    <form class="search" method="get" action="{{ route('admin.medical') }}">
        <input type="search" name="q" value="{{ $q }}" placeholder="Search device_id, id, profile_id…">
        <input type="text" name="profile_id" value="{{ $profileId }}" placeholder="Filter profile_id" style="min-width:140px;">
        <button type="submit">Search</button>
        @if($q !== '' || $profileId)
            <a class="btn secondary" href="{{ route('admin.medical') }}">Clear</a>
        @endif
    </form>
</div>

<div class="card">
    <table>
        <thead>
        <tr>
            <th>ID</th>
            <th>Profile</th>
            <th>Device</th>
            <th>Type</th>
            <th>Summary</th>
            <th>TS</th>
        </tr>
        </thead>
        <tbody>
        @forelse($rows as $row)
            @php
                $snap = is_array($row->snapshot) ? $row->snapshot : [];
                $type = $snap['type'] ?? $snap['metric'] ?? '—';
                $bits = [];
                foreach (['sys','dia','mgdl','celsius','spo2','pulse','weight','bmi'] as $k) {
                    if (isset($snap[$k]) && is_scalar($snap[$k])) $bits[] = "$k=".$snap[$k];
                }
            @endphp
            <tr>
                <td><a href="{{ route('admin.medical.show', $row->id) }}">{{ $row->id }}</a></td>
                <td><a href="{{ route('admin.profiles.show', $row->profile_id) }}">#{{ $row->profile_id }}</a></td>
                <td class="mono">{{ $row->device_id ?? '—' }}</td>
                <td><span class="badge">{{ $type }}</span></td>
                <td class="mono">{{ $bits ? implode(', ', $bits) : '…' }}</td>
                <td class="mono">{{ optional($row->ts)?->format('Y-m-d H:i:s') }}</td>
            </tr>
        @empty
            <tr><td colspan="6" class="muted">No medical rows found.</td></tr>
        @endforelse
        </tbody>
    </table>
    <div class="pagination">{{ $rows->links() }}</div>
</div>
@endsection
