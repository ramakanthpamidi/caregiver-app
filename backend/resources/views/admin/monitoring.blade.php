@extends('admin.layout')

@section('title', __('admin.monitoring.title'))
@section('subtitle', __('admin.monitoring.subtitle'))

@section('content')
@php
    $totals = $kpi['totals'] ?? [];
    $severity = $kpi['alerts_by_severity'] ?? [];
    $devices = $kpi['devices'] ?? [];
@endphp

<div class="muted" style="margin-bottom: 12px;">
    {{ __('admin.monitoring.window') }} {{ $kpi['range']['from'] ?? '' }} → {{ $kpi['range']['to'] ?? '' }}
    · {{ __('admin.monitoring.source') }} <span class="badge">{{ $kpi['source'] ?? 'core_grid' }}</span>
</div>

<div class="grid" style="margin-bottom: 16px;">
    <div class="stat"><div class="label">{{ __('admin.monitoring.profiles') }}</div><div class="value">{{ number_format($totals['profiles'] ?? 0) }}</div></div>
    <div class="stat"><div class="label">{{ __('admin.monitoring.alerts_in_range') }}</div><div class="value">{{ number_format($totals['alerts_in_range'] ?? 0) }}</div></div>
    <div class="stat"><div class="label">{{ __('admin.monitoring.alerts_today') }}</div><div class="value">{{ number_format($totals['alerts_today'] ?? 0) }}</div></div>
    <div class="stat"><div class="label">{{ __('admin.monitoring.critical') }}</div><div class="value" style="color: var(--danger);">{{ number_format($severity['critical'] ?? 0) }}</div></div>
    <div class="stat"><div class="label">{{ __('admin.monitoring.warning') }}</div><div class="value">{{ number_format($severity['warning'] ?? 0) }}</div></div>
    <div class="stat"><div class="label">{{ __('admin.monitoring.readings_today') }}</div><div class="value">{{ number_format($totals['readings_today'] ?? 0) }}</div></div>
    <div class="stat"><div class="label">{{ __('admin.monitoring.medical_devices') }}</div><div class="value">{{ number_format($devices['total_medical'] ?? 0) }}</div></div>
    <div class="stat"><div class="label">{{ __('admin.monitoring.devices_seen_today') }}</div><div class="value">{{ number_format($devices['seen_today'] ?? 0) }}</div></div>
</div>

<div class="card">
    <div class="section-title">{{ __('admin.monitoring.severity_mix') }}</div>
    <table>
        <thead><tr><th>{{ __('admin.monitoring.severity') }}</th><th>{{ __('admin.count') }}</th></tr></thead>
        <tbody>
        @foreach($severity as $label => $count)
            <tr>
                <td>
                    <span class="badge {{ $label === 'critical' ? 'danger' : ($label === 'excellent' || $label === 'good' ? 'ok' : ($label === 'warning' ? 'warn' : '')) }}">{{ __('admin.status.'.$label) }}</span>
                </td>
                <td>{{ number_format($count) }}</td>
            </tr>
        @endforeach
        </tbody>
    </table>
</div>

<div class="card">
    <div class="section-title">{{ __('admin.monitoring.reading_types') }}</div>
    <table>
        <thead><tr><th>{{ __('admin.type') }}</th><th>{{ __('admin.monitoring.alerts') }}</th></tr></thead>
        <tbody>
        @forelse(($kpi['alerts_by_reading_type'] ?? []) as $row)
            <tr><td>{{ $row['label'] }}</td><td>{{ number_format($row['count']) }}</td></tr>
        @empty
            <tr><td colspan="2" class="muted">{{ __('admin.monitoring.none_types') }}</td></tr>
        @endforelse
        </tbody>
    </table>
</div>

<div class="card">
    <div class="section-title">{{ __('admin.monitoring.top_patients') }}</div>
    <table>
        <thead><tr><th>{{ __('admin.profile') }}</th><th>{{ __('admin.monitoring.alerts') }}</th></tr></thead>
        <tbody>
        @forelse(($kpi['top_profiles'] ?? []) as $row)
            <tr>
                <td>#{{ $row['profile_id'] }} {{ $row['profile_label'] }}</td>
                <td>{{ number_format($row['alert_count']) }}</td>
            </tr>
        @empty
            <tr><td colspan="2" class="muted">{{ __('admin.monitoring.none_patients') }}</td></tr>
        @endforelse
        </tbody>
    </table>
</div>

<div class="card">
    <div class="section-title">{{ __('admin.monitoring.critical_feed') }}</div>
    <table>
        <thead>
        <tr>
            <th>{{ __('admin.monitoring.when') }}</th>
            <th>{{ __('admin.profile') }}</th>
            <th>{{ __('admin.monitoring.severity') }}</th>
            <th>{{ __('admin.monitoring.title_col') }}</th>
            <th>{{ __('admin.monitoring.reading') }}</th>
        </tr>
        </thead>
        <tbody>
        @forelse(($kpi['recent_critical'] ?? []) as $event)
            <tr>
                <td class="mono">{{ \Illuminate\Support\Str::of($event['occurred_at'] ?? '')->substr(0, 19) }}</td>
                <td>#{{ $event['profile_id'] }} {{ $event['profile_label'] }}</td>
                <td><span class="badge {{ ($event['severity'] ?? '') === 'critical' ? 'danger' : '' }}">{{ __('admin.status.'.($event['severity'] ?? 'none')) }}</span></td>
                <td>{{ $event['title'] }}</td>
                <td class="mono">{{ $event['reading'] }}</td>
            </tr>
        @empty
            <tr><td colspan="5" class="muted">{{ __('admin.monitoring.no_critical') }}</td></tr>
        @endforelse
        </tbody>
    </table>
</div>

<div class="card">
    <div class="section-title">{{ __('admin.monitoring.all_alerts') }}</div>
    <table>
        <thead>
        <tr>
            <th>{{ __('admin.id') }}</th>
            <th>{{ __('admin.monitoring.when') }}</th>
            <th>{{ __('admin.profile') }}</th>
            <th>{{ __('admin.monitoring.severity') }}</th>
            <th>{{ __('admin.monitoring.title_col') }}</th>
            <th>{{ __('admin.device') }}</th>
        </tr>
        </thead>
        <tbody>
        @forelse($alerts as $event)
            @php $row = $event->toAlert(); @endphp
            <tr>
                <td class="mono">{{ $row['id'] }}</td>
                <td class="mono">{{ \Illuminate\Support\Str::of($row['occurred_at'] ?? '')->substr(0, 19) }}</td>
                <td>#{{ $row['profile_id'] }} {{ $row['profile_label'] }}</td>
                <td><span class="badge {{ ($row['severity'] ?? '') === 'critical' ? 'danger' : (($row['severity'] ?? '') === 'excellent' || ($row['severity'] ?? '') === 'good' ? 'ok' : '') }}">{{ $row['severity'] }}</span></td>
                <td>{{ $row['title'] }}</td>
                <td>{{ $row['device_name'] ?: $row['device_id'] }}</td>
            </tr>
        @empty
            <tr><td colspan="6" class="muted">{{ __('admin.monitoring.no_alerts') }}</td></tr>
        @endforelse
        </tbody>
    </table>
    <div class="pagination">{{ $alerts->withQueryString()->links() }}</div>
</div>
@endsection
