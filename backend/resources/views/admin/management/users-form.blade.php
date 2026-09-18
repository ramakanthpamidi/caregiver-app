@extends('admin.layout')

@section('title', $mode === 'create' ? 'Create user' : 'Edit user #'.$user->id)
@section('subtitle', 'Assign roles and permissions via role membership')

@section('content')
<div class="card">
    <form method="post" action="{{ $mode === 'create' ? route('admin.management.users.store') : route('admin.management.users.update', $user->id) }}">
        @csrf
        @if($mode === 'edit')
            @method('PUT')
        @endif

        <div class="form-row">
            <label class="field" for="user_label">Display name</label>
            <input id="user_label" type="text" name="user_label" value="{{ old('user_label', $user->user_label) }}" required>
        </div>

        <div class="form-row">
            <label class="field" for="email">Email</label>
            <input id="email" type="email" name="email" value="{{ old('email', $user->email) }}" required>
        </div>

        <div class="form-row">
            <label class="field" for="password">Password {{ $mode === 'edit' ? '(leave blank to keep)' : '' }}</label>
            <input id="password" type="password" name="password" {{ $mode === 'create' ? 'required' : '' }} autocomplete="new-password">
        </div>

        <div class="form-row">
            <label class="field" for="password_confirmation">Confirm password</label>
            <input id="password_confirmation" type="password" name="password_confirmation" autocomplete="new-password">
        </div>

        <div class="form-row">
            <label class="field" for="status">Status</label>
            <select id="status" name="status">
                @foreach(['active','pending_verification','disabled'] as $st)
                    <option value="{{ $st }}" @selected(old('status', $user->status ?: 'active') === $st)>{{ $st }}</option>
                @endforeach
            </select>
        </div>

        <div class="form-row">
            <label class="field">Roles</label>
            <div class="check-grid">
                @foreach($roles as $r)
                    @php
                        $disabled = $r->name === 'super_admin' && !auth()->user()->isSuperAdmin();
                        $checked = in_array($r->name, old('roles', $selectedRoles), true);
                    @endphp
                    <label class="check-item">
                        <input type="checkbox" name="roles[]" value="{{ $r->name }}" @checked($checked) @disabled($disabled)>
                        <span>
                            <strong>{{ $r->name }}</strong>
                            <div class="muted" style="font-size:0.8rem;">{{ $r->permissions_count ?? $r->permissions->count() }} permissions</div>
                        </span>
                    </label>
                @endforeach
            </div>
            @if(!auth()->user()->isSuperAdmin())
                <div class="muted" style="margin-top:8px;font-size:0.85rem;">Only super admins can assign the <code>super_admin</code> role.</div>
            @endif
        </div>

        <div class="actions">
            <button type="submit">{{ $mode === 'create' ? 'Create user' : 'Save changes' }}</button>
            <a class="btn secondary" href="{{ route('admin.management.users') }}">Cancel</a>
        </div>
    </form>
</div>
@endsection
