@extends('admin.layout')

@section('title', __('admin.devices.title'))
@section('subtitle', __('admin.devices.subtitle'))

@section('content')
<div class="card">
    <form class="search" method="get" action="{{ route('admin.devices') }}">
        <input type="search" name="q" value="{{ $q }}" placeholder="Search device_id, name, factory…">
        <button type="submit">Search</button>
        @if($q !== '')
            <a class="btn secondary" href="{{ route('admin.devices') }}">Clear</a>
        @endif
    </form>
</div>

<div class="card">
    <table>
        <thead>
        <tr>
            <th>ID</th>
            <th>device_id</th>
            <th>Name</th>
            <th>Factory</th>
            <th>Type</th>
            <th>Owner</th>
            <th>Status</th>
            <th>Created</th>
        </tr>
        </thead>
        <tbody>
        @forelse($devices as $d)
            <tr>
                <td>{{ $d->id }}</td>
                <td class="mono">{{ $d->device_id }}</td>
                <td>{{ $d->device_name }}</td>
                <td>{{ $d->factory_name ?? '—' }}</td>
                <td><span class="badge">{{ $d->medical_device_type ?? $d->device_type }}</span></td>
                <td><a href="{{ route('admin.users.show', $d->owner_user_id) }}">#{{ $d->owner_user_id }}</a></td>
                <td>
                    @if($d->deleted_at)
                        <span class="badge danger">deleted</span>
                    @else
                        <span class="badge ok">{{ $d->status }}</span>
                    @endif
                </td>
                <td class="mono">{{ optional($d->created_at)?->format('Y-m-d H:i') }}</td>
            </tr>
        @empty
            <tr><td colspan="8" class="muted">No devices found.</td></tr>
        @endforelse
        </tbody>
    </table>
    <div class="pagination">{{ $devices->links() }}</div>
</div>
@endsection
