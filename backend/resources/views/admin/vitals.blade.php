@extends('admin.layout')

@section('title', __('admin.vitals.title'))
@section('subtitle', __('admin.vitals.subtitle'))

@php
    $badge = function (?array $vital) {
        if (!$vital) {
            return '<span class="muted">'.e(__('admin.none')).'</span>';
        }
        $cls = $vital['status'] === 'critical' ? 'danger' : ($vital['status'] === 'warning' ? 'warn' : 'ok');
        $label = __('admin.status.'.$vital['status']);
        return e($vital['value']).' <span class="badge '.$cls.'">'.$label.'</span>';
    };
@endphp

@section('content')
<div class="grid" style="margin-bottom: 16px;">
    <div class="stat"><div class="label">{{ __('admin.vitals.profiles') }}</div><div class="value">{{ number_format($counts['all'] ?? 0) }}</div></div>
    <div class="stat"><div class="label">{{ __('admin.vitals.critical') }}</div><div class="value" style="color: var(--danger);">{{ number_format($counts['critical'] ?? 0) }}</div></div>
    <div class="stat"><div class="label">{{ __('admin.vitals.warning') }}</div><div class="value">{{ number_format($counts['warning'] ?? 0) }}</div></div>
    <div class="stat"><div class="label">{{ __('admin.vitals.normal') }}</div><div class="value" style="color: var(--ok);">{{ number_format($counts['normal'] ?? 0) }}</div></div>
    <div class="stat"><div class="label">{{ __('admin.vitals.no_data') }}</div><div class="value">{{ number_format($counts['none'] ?? 0) }}</div></div>
</div>

<div class="card">
    <form class="search" method="get" action="{{ route('admin.vitals') }}">
        <input type="search" name="q" value="{{ $q }}" placeholder="{{ __('admin.vitals.search') }}">
        <select name="status">
            <option value="all" @selected($status === 'all')>{{ __('admin.vitals.all_statuses') }}</option>
            <option value="critical" @selected($status === 'critical')>{{ __('admin.vitals.critical') }}</option>
            <option value="warning" @selected($status === 'warning')>{{ __('admin.vitals.warning') }}</option>
            <option value="normal" @selected($status === 'normal')>{{ __('admin.vitals.normal') }}</option>
            <option value="none" @selected($status === 'none')>{{ __('admin.vitals.no_data') }}</option>
        </select>
        <button type="submit">{{ __('admin.filter') }}</button>
        @if($q !== '' || $status !== 'all')
            <a class="btn secondary" href="{{ route('admin.vitals') }}">{{ __('admin.clear') }}</a>
        @endif
    </form>
    <div class="tabs" style="margin-top:12px;">
        <a href="{{ route('admin.vitals', ['q' => $q]) }}" class="{{ $status === 'all' ? 'active' : '' }}">{{ __('admin.vitals.all') }} ({{ $counts['all'] ?? 0 }})</a>
        <a href="{{ route('admin.vitals', ['q' => $q, 'status' => 'critical']) }}" class="{{ $status === 'critical' ? 'active' : '' }}">{{ __('admin.vitals.critical') }} ({{ $counts['critical'] ?? 0 }})</a>
        <a href="{{ route('admin.vitals', ['q' => $q, 'status' => 'warning']) }}" class="{{ $status === 'warning' ? 'active' : '' }}">{{ __('admin.vitals.warning') }} ({{ $counts['warning'] ?? 0 }})</a>
        <a href="{{ route('admin.vitals', ['q' => $q, 'status' => 'normal']) }}" class="{{ $status === 'normal' ? 'active' : '' }}">{{ __('admin.vitals.normal') }} ({{ $counts['normal'] ?? 0 }})</a>
    </div>
</div>

<div class="card">
    <table>
        <thead>
        <tr>
            <th>{{ __('admin.profile') }}</th>
            <th>{{ __('admin.user') }}</th>
            <th>{{ __('admin.vitals.spo2') }}</th>
            <th>{{ __('admin.vitals.bp') }}</th>
            <th>{{ __('admin.vitals.glucose') }}</th>
            <th>{{ __('admin.vitals.temp') }}</th>
            <th>{{ __('admin.vitals.weight') }}</th>
            <th>{{ __('admin.vitals.overall') }}</th>
            <th>{{ __('admin.vitals.last_reading') }}</th>
        </tr>
        </thead>
        <tbody>
        @forelse($rows as $row)
            @php
                $p = $row['profile'];
                $owner = $row['owner'];
                $overall = $row['overall'];
                $rowClass = $overall === 'critical' ? 'row-critical' : ($overall === 'warning' ? 'row-warning' : '');
                $overallCls = $overall === 'critical' ? 'danger' : ($overall === 'warning' ? 'warn' : ($overall === 'normal' ? 'ok' : 'muted'));
            @endphp
            <tr class="{{ $rowClass }}">
                <td>
                    <a href="{{ route('admin.profiles.show', $p->id) }}">{{ $p->profile_label }}</a>
                    <div class="muted mono">#{{ $p->id }}</div>
                </td>
                <td>
                    @if($owner)
                        <a href="{{ route('admin.users.show', $owner->id) }}">{{ $owner->user_label }}</a>
                        <div class="muted">{{ $owner->email }}</div>
                    @else
                        <span class="muted">—</span>
                    @endif
                </td>
                <td>{!! $badge($row['vitals']['spo2']) !!}</td>
                <td>{!! $badge($row['vitals']['bp']) !!}</td>
                <td>{!! $badge($row['vitals']['glucose']) !!}</td>
                <td>{!! $badge($row['vitals']['temp']) !!}</td>
                <td>{!! $badge($row['vitals']['weight']) !!}</td>
                <td><span class="badge {{ $overallCls }}">{{ $row['overall_label'] }}</span></td>
                <td class="mono">{{ $row['last_at'] ? $row['last_at']->format('Y-m-d H:i') : '—' }}</td>
            </tr>
        @empty
            <tr><td colspan="9" class="muted">{{ __('admin.vitals.empty') }}</td></tr>
        @endforelse
        </tbody>
    </table>
</div>
@endsection
