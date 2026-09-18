@extends('admin.layout')

@section('title', 'Yuwell models')
@section('subtitle', 'Public device catalog')

@section('content')
<div class="card">
    <table>
        <thead>
        <tr>
            <th>ID</th>
            <th>Factory name</th>
            <th>Display name</th>
            <th>Medical type</th>
        </tr>
        </thead>
        <tbody>
        @forelse($models as $m)
            <tr>
                <td>{{ $m->id }}</td>
                <td class="mono">{{ $m->factory_name }}</td>
                <td>{{ $m->display_name ?? '—' }}</td>
                <td><span class="badge">{{ $m->medical_device_type ?? '—' }}</span></td>
            </tr>
        @empty
            <tr><td colspan="4" class="muted">No models seeded.</td></tr>
        @endforelse
        </tbody>
    </table>
</div>
@endsection
