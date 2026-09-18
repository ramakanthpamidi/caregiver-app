@extends('admin.layout')

@section('title', __('admin.dashboard.title'))
@section('subtitle', __('admin.dashboard.subtitle'))

@section('content')
<div class="grid" style="margin-bottom: 16px;">
    @foreach($stats as $label => $value)
        <div class="stat">
            <div class="label">{{ __('admin.dashboard.'.$label) }}</div>
            <div class="value">{{ number_format($value) }}</div>
        </div>
    @endforeach
</div>

<div class="card">
    <div class="section-title">{{ __('admin.dashboard.recent_users') }}</div>
    <table>
        <thead>
        <tr>
            <th>{{ __('admin.id') }}</th>
            <th>{{ __('admin.label') }}</th>
            <th>{{ __('admin.email') }}</th>
            <th>{{ __('admin.status') }}</th>
            <th>{{ __('admin.created') }}</th>
        </tr>
        </thead>
        <tbody>
        @forelse($recentUsers as $user)
            <tr>
                <td><a href="{{ route('admin.users.show', $user->id) }}">{{ $user->id }}</a></td>
                <td>{{ $user->user_label }}</td>
                <td>{{ $user->email }}</td>
                <td><span class="badge">{{ $user->status }}</span></td>
                <td class="mono">{{ optional($user->created_at)?->format('Y-m-d H:i') }}</td>
            </tr>
        @empty
            <tr><td colspan="5" class="muted">{{ __('admin.dashboard.no_users') }}</td></tr>
        @endforelse
        </tbody>
    </table>
</div>

<div class="card">
    <div class="section-title">{{ __('admin.dashboard.recent_profiles') }}</div>
    <table>
        <thead>
        <tr>
            <th>{{ __('admin.id') }}</th>
            <th>{{ __('admin.label') }}</th>
            <th>{{ __('admin.owner') }}</th>
            <th>{{ __('admin.last_used') }}</th>
        </tr>
        </thead>
        <tbody>
        @forelse($recentProfiles as $p)
            <tr>
                <td><a href="{{ route('admin.profiles.show', $p->id) }}">{{ $p->id }}</a></td>
                <td>{{ $p->profile_label }}</td>
                <td><a href="{{ route('admin.users.show', $p->owner_user_id) }}">#{{ $p->owner_user_id }}</a></td>
                <td class="mono">{{ optional($p->last_used_at)?->format('Y-m-d H:i') ?? '—' }}</td>
            </tr>
        @empty
            <tr><td colspan="4" class="muted">{{ __('admin.dashboard.no_profiles') }}</td></tr>
        @endforelse
        </tbody>
    </table>
</div>

<div class="card">
    <div class="section-title">{{ __('admin.dashboard.latest_readings') }}</div>
    <table>
        <thead>
        <tr>
            <th>{{ __('admin.id') }}</th>
            <th>{{ __('admin.profile') }}</th>
            <th>{{ __('admin.device') }}</th>
            <th>{{ __('admin.type') }}</th>
            <th>{{ __('admin.vitals.last_reading') }}</th>
        </tr>
        </thead>
        <tbody>
        @forelse($recentReadings as $row)
            @php $snap = is_array($row->snapshot) ? $row->snapshot : []; @endphp
            <tr>
                <td><a href="{{ route('admin.medical.show', $row->id) }}">{{ $row->id }}</a></td>
                <td><a href="{{ route('admin.profiles.show', $row->profile_id) }}">#{{ $row->profile_id }}</a></td>
                <td class="mono">{{ $row->device_id ?? '—' }}</td>
                <td><span class="badge">{{ $snap['type'] ?? $snap['metric'] ?? '—' }}</span></td>
                <td class="mono">{{ optional($row->ts)?->format('Y-m-d H:i:s') }}</td>
            </tr>
        @empty
            <tr><td colspan="5" class="muted">{{ __('admin.dashboard.no_medical') }}</td></tr>
        @endforelse
        </tbody>
    </table>
</div>

<div class="card">
    <div class="section-title">{{ __('admin.dashboard.latest_events') }}</div>
    <table>
        <thead>
        <tr>
            <th>{{ __('admin.id') }}</th>
            <th>{{ __('admin.profile') }}</th>
            <th>{{ __('admin.type') }}</th>
            <th>{{ __('admin.device') }}</th>
            <th>{{ __('admin.vitals.last_reading') }}</th>
        </tr>
        </thead>
        <tbody>
        @forelse($recentEvents as $ev)
            <tr>
                <td><a href="{{ route('admin.events.show', $ev->id) }}">{{ $ev->id }}</a></td>
                <td><a href="{{ route('admin.profiles.show', $ev->profile_id) }}">#{{ $ev->profile_id }}</a></td>
                <td><span class="badge">{{ $ev->event_type }}</span></td>
                <td class="mono">{{ $ev->device_id ?? '—' }}</td>
                <td class="mono">{{ optional($ev->ts)?->format('Y-m-d H:i:s') }}</td>
            </tr>
        @empty
            <tr><td colspan="5" class="muted">{{ __('admin.dashboard.no_events') }}</td></tr>
        @endforelse
        </tbody>
    </table>
</div>
@endsection
