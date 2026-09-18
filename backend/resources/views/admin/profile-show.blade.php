@extends('admin.layout')

@section('title', 'Profile #'.$profile->id)
@section('subtitle', $profile->profile_label)

@section('content')
<div class="card">
    <div class="kv">
        <div class="k">ID</div><div>{{ $profile->id }}</div>
        <div class="k">Label</div><div>{{ $profile->profile_label }}</div>
        <div class="k">Owner</div>
        <div>
            @if($owner)
                <a href="{{ route('admin.users.show', $owner->id) }}">#{{ $owner->id }} {{ $owner->user_label }} ({{ $owner->email }})</a>
            @else
                #{{ $profile->owner_user_id }}
            @endif
        </div>
        <div class="k">Access password</div><div>{{ $profile->access_password_hash ? 'set' : 'none' }}</div>
        <div class="k">Last used</div><div class="mono">{{ optional($profile->last_used_at)?->toDateTimeString() ?? '—' }}</div>
        <div class="k">Created</div><div class="mono">{{ optional($profile->created_at)?->toDateTimeString() }}</div>
        <div class="k">Consent</div>
        <div>
            @if($consent)
                <span class="badge {{ $consent->consent_granted ? 'ok' : 'muted' }}">
                    {{ $consent->consent_granted ? 'granted' : 'not granted' }}
                </span>
                @if($consent->source) · {{ $consent->source }} @endif
            @else
                —
            @endif
        </div>
    </div>
    <p style="margin: 14px 0 0;">
        <a class="btn secondary" href="{{ route('admin.medical', ['profile_id' => $profile->id]) }}">Medical data</a>
        <a class="btn secondary" href="{{ route('admin.events', ['profile_id' => $profile->id]) }}">Events</a>
    </p>
</div>

<div class="card">
    <div class="section-title">Medical general info</div>
    @if($medical)
        <div class="kv">
            <div class="k">DOB</div><div>{{ optional($medical->date_of_birth)?->format('Y-m-d') ?? '—' }}</div>
            <div class="k">Sex</div><div>{{ $medical->sex ?? '—' }}</div>
            <div class="k">Blood type</div><div>{{ $medical->blood_type ?? '—' }}</div>
            <div class="k">Height cm</div><div>{{ $medical->height_cm ?? '—' }}</div>
            <div class="k">Weight kg</div><div>{{ $medical->weight_kg ?? '—' }}</div>
            <div class="k">Organ donor</div><div>{{ is_null($medical->organ_donor) ? '—' : ($medical->organ_donor ? 'yes' : 'no') }}</div>
            <div class="k">Emergency</div><div>{{ $medical->emergency_contact ?? '—' }}</div>
            <div class="k">Insurance</div><div>{{ trim(($medical->insurance_provider ?? '').' '.($medical->insurance_number ?? '')) ?: '—' }}</div>
        </div>
        <div style="margin-top:12px;">
            <div class="muted" style="margin-bottom:6px;">Allergies / conditions / meds / family (JSON)</div>
            <pre class="json">{{ json_encode([
                'allergies' => $medical->allergies,
                'chronic_conditions' => $medical->chronic_conditions,
                'medications' => $medical->medications,
                'family_history' => $medical->family_history,
            ], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE) }}</pre>
        </div>
    @else
        <div class="muted">No medical general info.</div>
    @endif
</div>

<div class="card">
    <div class="section-title">Goals</div>
    <table>
        <thead><tr><th>ID</th><th>Title</th><th>Type</th><th>Status</th><th>Target</th><th>Start</th></tr></thead>
        <tbody>
        @forelse($goals as $g)
            <tr>
                <td>{{ $g->id }}</td>
                <td>{{ $g->title }}</td>
                <td>{{ $g->goal_type }}</td>
                <td><span class="badge">{{ $g->status }}</span></td>
                <td class="mono">{{ is_array($g->target) ? json_encode($g->target) : $g->target }}</td>
                <td class="mono">{{ optional($g->start_date)?->format('Y-m-d') }}</td>
            </tr>
        @empty
            <tr><td colspan="6" class="muted">No goals.</td></tr>
        @endforelse
        </tbody>
    </table>
</div>

<div class="card">
    <div class="section-title">Reminders</div>
    <table>
        <thead><tr><th>ID</th><th>Title</th><th>Time</th><th>Repeat</th><th>Enabled</th></tr></thead>
        <tbody>
        @forelse($reminders as $r)
            <tr>
                <td>{{ $r->id }}</td>
                <td>{{ $r->title }}</td>
                <td class="mono">{{ $r->time_of_day }}</td>
                <td>{{ $r->repeat_type }}</td>
                <td>{{ $r->enabled ? 'yes' : 'no' }}</td>
            </tr>
        @empty
            <tr><td colspan="5" class="muted">No reminders.</td></tr>
        @endforelse
        </tbody>
    </table>
</div>

<div class="card">
    <div class="section-title">LINE notify targets</div>
    <table>
        <thead><tr><th>ID</th><th>LINE user</th><th>Display</th><th>Enabled</th><th>Levels</th></tr></thead>
        <tbody>
        @forelse($lineTargets as $t)
            <tr>
                <td>{{ $t->id }}</td>
                <td class="mono">{{ $t->line_user_id }}</td>
                <td>{{ $t->line_display_name ?? '—' }}</td>
                <td>{{ $t->enabled ? 'yes' : 'no' }}</td>
                <td class="mono">
                    C:{{ (int)$t->notify_critical }}
                    W:{{ (int)$t->notify_warning }}
                    G:{{ (int)$t->notify_good }}
                    E:{{ (int)$t->notify_excellent }}
                </td>
            </tr>
        @empty
            <tr><td colspan="5" class="muted">No LINE targets.</td></tr>
        @endforelse
        </tbody>
    </table>
</div>

<div class="card">
    <div class="section-title">Recent medical readings (50)</div>
    <table>
        <thead><tr><th>ID</th><th>Device</th><th>Type</th><th>TS</th></tr></thead>
        <tbody>
        @forelse($readings as $row)
            @php $snap = is_array($row->snapshot) ? $row->snapshot : []; @endphp
            <tr>
                <td><a href="{{ route('admin.medical.show', $row->id) }}">{{ $row->id }}</a></td>
                <td class="mono">{{ $row->device_id ?? '—' }}</td>
                <td><span class="badge">{{ $snap['type'] ?? '—' }}</span></td>
                <td class="mono">{{ optional($row->ts)?->format('Y-m-d H:i:s') }}</td>
            </tr>
        @empty
            <tr><td colspan="4" class="muted">No readings.</td></tr>
        @endforelse
        </tbody>
    </table>
</div>

<div class="card">
    <div class="section-title">Recent events (50)</div>
    <table>
        <thead><tr><th>ID</th><th>Type</th><th>Device</th><th>TS</th></tr></thead>
        <tbody>
        @forelse($events as $ev)
            <tr>
                <td><a href="{{ route('admin.events.show', $ev->id) }}">{{ $ev->id }}</a></td>
                <td><span class="badge">{{ $ev->event_type }}</span></td>
                <td class="mono">{{ $ev->device_id ?? '—' }}</td>
                <td class="mono">{{ optional($ev->ts)?->format('Y-m-d H:i:s') }}</td>
            </tr>
        @empty
            <tr><td colspan="4" class="muted">No events.</td></tr>
        @endforelse
        </tbody>
    </table>
</div>

<p><a href="{{ route('admin.profiles') }}">← Back to profiles</a></p>
@endsection
