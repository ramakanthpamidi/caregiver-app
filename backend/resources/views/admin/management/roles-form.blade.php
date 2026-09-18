@extends('admin.layout')

@section('title', $mode === 'create' ? 'Create role' : 'Edit role: '.$role->name)
@section('subtitle', 'Pick permissions for this role')

@section('content')
<div class="card">
    <form method="post" action="{{ $mode === 'create' ? route('admin.management.roles.store') : route('admin.management.roles.update', $role->id) }}">
        @csrf
        @if($mode === 'edit')
            @method('PUT')
        @endif

        <div class="form-row">
            <label class="field" for="name">Role name (snake_case)</label>
            <input id="name" type="text" name="name" value="{{ old('name', $role->name) }}"
                   required pattern="[a-z0-9_]+"
                   {{ $role->name === 'super_admin' ? 'readonly' : '' }}
                   placeholder="e.g. clinic_manager">
        </div>

        <div class="form-row">
            <label class="field">Permissions</label>
            @foreach($permissions as $group => $items)
                <div style="margin-bottom: 14px;">
                    <div class="muted" style="font-weight:700;margin-bottom:8px;text-transform:uppercase;font-size:0.75rem;letter-spacing:0.05em;">{{ $group }}</div>
                    <div class="check-grid">
                        @foreach($items as $perm)
                            <label class="check-item">
                                <input type="checkbox" name="permissions[]" value="{{ $perm->name }}"
                                    @checked(in_array($perm->name, old('permissions', $selected), true))>
                                <span class="mono">{{ $perm->name }}</span>
                            </label>
                        @endforeach
                    </div>
                </div>
            @endforeach
        </div>

        <div class="actions">
            <button type="submit">{{ $mode === 'create' ? 'Create role' : 'Save role' }}</button>
            <a class="btn secondary" href="{{ route('admin.management.roles') }}">Cancel</a>
        </div>
    </form>
</div>
@endsection
