<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>@yield('title', 'Records') · Caregiver Admin</title>
    <style>
        :root {
            --bg: #f4f7fb;
            --card: #ffffff;
            --text: #0f172a;
            --muted: #64748b;
            --border: #e2e8f0;
            --primary: #0b6aa0;
            --primary-soft: #e8f4fb;
            --danger: #b91c1c;
            --ok: #15803d;
            --shadow: 0 8px 24px rgba(15, 23, 42, 0.06);
        }
        * { box-sizing: border-box; }
        body {
            margin: 0;
            font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif;
            background: var(--bg);
            color: var(--text);
            line-height: 1.45;
        }
        a { color: var(--primary); text-decoration: none; }
        a:hover { text-decoration: underline; }
        .shell { display: grid; grid-template-columns: 250px 1fr; min-height: 100vh; }
        .sidebar {
            background: #064b75;
            color: #fff;
            padding: 20px 16px;
        }
        .brand { font-weight: 700; font-size: 1.05rem; margin-bottom: 4px; }
        .brand-sub { color: #b6d7ea; font-size: 0.8rem; margin-bottom: 18px; }
        .nav-section {
            color: #9ec9e4;
            font-size: 0.72rem;
            text-transform: uppercase;
            letter-spacing: 0.06em;
            margin: 14px 8px 6px;
            font-weight: 700;
        }
        .nav a {
            display: block;
            color: #e8f4fb;
            padding: 9px 12px;
            border-radius: 10px;
            margin-bottom: 3px;
            text-decoration: none;
            font-size: 0.93rem;
        }
        .nav a:hover, .nav a.active {
            background: rgba(255,255,255,0.12);
            text-decoration: none;
        }
        .user-box {
            margin-top: 18px;
            padding: 12px;
            border-radius: 12px;
            background: rgba(0,0,0,0.15);
            font-size: 0.85rem;
        }
        .user-box .name { font-weight: 700; }
        .user-box .email { color: #b6d7ea; font-size: 0.78rem; word-break: break-all; }
        .user-box form { margin-top: 10px; }
        .user-box button {
            width: 100%;
            border: 0;
            background: rgba(255,255,255,0.14);
            color: #fff;
            border-radius: 8px;
            padding: 8px;
            cursor: pointer;
            font: inherit;
        }
        .main { padding: 24px; }
        .top {
            display: flex;
            justify-content: space-between;
            align-items: center;
            gap: 12px;
            margin-bottom: 18px;
            flex-wrap: wrap;
        }
        h1 { margin: 0; font-size: 1.45rem; }
        .muted { color: var(--muted); }
        .flash {
            border-radius: 12px;
            padding: 11px 14px;
            margin-bottom: 14px;
            font-size: 0.92rem;
        }
        .flash.ok { background: #dcfce7; color: var(--ok); border: 1px solid #bbf7d0; }
        .flash.err { background: #fef2f2; color: var(--danger); border: 1px solid #fecaca; }
        .card {
            background: var(--card);
            border: 1px solid var(--border);
            border-radius: 14px;
            box-shadow: var(--shadow);
            padding: 16px;
            margin-bottom: 16px;
        }
        .grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
            gap: 12px;
        }
        .stat {
            background: var(--card);
            border: 1px solid var(--border);
            border-radius: 14px;
            padding: 14px 16px;
            box-shadow: var(--shadow);
        }
        .stat .label { color: var(--muted); font-size: 0.82rem; }
        .stat .value { font-size: 1.5rem; font-weight: 700; margin-top: 4px; }
        table { width: 100%; border-collapse: collapse; font-size: 0.92rem; }
        th, td {
            text-align: left;
            padding: 10px 8px;
            border-bottom: 1px solid var(--border);
            vertical-align: top;
        }
        th { color: var(--muted); font-weight: 600; font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.03em; }
        tr:hover td { background: #f8fafc; }
        .badge {
            display: inline-block;
            padding: 2px 8px;
            border-radius: 999px;
            font-size: 0.75rem;
            font-weight: 600;
            background: var(--primary-soft);
            color: var(--primary);
            margin: 1px 2px 1px 0;
        }
        .badge.ok { background: #dcfce7; color: var(--ok); }
        .badge.danger { background: #fee2e2; color: var(--danger); }
        .badge.warn { background: #fef3c7; color: #b45309; }
        .badge.muted { background: #f1f5f9; color: var(--muted); }
        tr.row-critical td { background: #fef2f2; }
        tr.row-warning td { background: #fffbeb; }
        .lang-switch { display: flex; gap: 4px; }
        .lang-switch button {
            border: 1px solid var(--border);
            background: #fff;
            color: var(--text);
            border-radius: 8px;
            padding: 6px 10px;
            font: inherit;
            font-size: 0.8rem;
            font-weight: 700;
            min-width: 42px;
        }
        .lang-switch button.active { background: var(--primary); color: #fff; border-color: var(--primary); }
        .search { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
        input[type="search"], input[type="text"], input[type="email"], input[type="password"], select, textarea {
            border: 1px solid var(--border);
            border-radius: 10px;
            padding: 9px 12px;
            min-width: 180px;
            font: inherit;
            background: #fff;
        }
        textarea { width: 100%; min-height: 90px; }
        label.field { display: block; font-size: 0.85rem; font-weight: 600; margin: 0 0 6px; }
        .form-row { margin-bottom: 14px; }
        .check-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
            gap: 8px 12px;
        }
        .check-item {
            display: flex;
            gap: 8px;
            align-items: flex-start;
            font-size: 0.9rem;
            padding: 6px 8px;
            border: 1px solid var(--border);
            border-radius: 10px;
            background: #f8fafc;
        }
        button, .btn {
            border: 0;
            background: var(--primary);
            color: #fff;
            border-radius: 10px;
            padding: 9px 14px;
            font: inherit;
            cursor: pointer;
            display: inline-block;
            text-decoration: none;
        }
        button:hover, .btn:hover { filter: brightness(1.05); text-decoration: none; }
        .btn.secondary { background: #e2e8f0; color: var(--text); }
        .btn.danger { background: var(--danger); }
        .btn.sm { padding: 6px 10px; font-size: 0.85rem; }
        .actions { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
        .mono {
            font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
            font-size: 0.85rem;
        }
        pre.json {
            background: #0f172a;
            color: #e2e8f0;
            border-radius: 12px;
            padding: 14px;
            overflow: auto;
            font-size: 0.82rem;
            line-height: 1.4;
            margin: 0;
        }
        .pagination { margin-top: 14px; }
        .pagination .pagination { display: flex; flex-wrap: wrap; gap: 4px; list-style: none; padding: 0; margin: 0; }
        .pagination .page-item .page-link {
            display: inline-block;
            padding: 6px 10px;
            border: 1px solid var(--border);
            border-radius: 8px;
            background: #fff;
            color: var(--primary);
            text-decoration: none;
        }
        .pagination .page-item.active .page-link {
            background: var(--primary);
            color: #fff;
            border-color: var(--primary);
        }
        .pagination .page-item.disabled .page-link { color: var(--muted); }
        .kv { display: grid; grid-template-columns: 180px 1fr; gap: 8px 12px; }
        .kv .k { color: var(--muted); }
        .section-title { font-size: 1rem; font-weight: 700; margin: 0 0 12px; }
        .tabs { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 12px; }
        .tabs a {
            padding: 7px 12px;
            border-radius: 999px;
            background: #e2e8f0;
            color: var(--text);
            text-decoration: none;
            font-size: 0.88rem;
        }
        .tabs a.active { background: var(--primary); color: #fff; }
        @media (max-width: 900px) {
            .shell { grid-template-columns: 1fr; }
            .sidebar { padding-bottom: 8px; }
            .nav { display: flex; flex-wrap: wrap; gap: 4px; }
            .nav a { margin: 0; }
            .nav-section { width: 100%; }
            .kv { grid-template-columns: 1fr; }
        }
    </style>
</head>
<body>
@php $authUser = auth()->user(); @endphp
<div class="shell">
    <aside class="sidebar">
        <div class="brand">{{ __('admin.brand') }}</div>
        <div class="brand-sub">{{ __('admin.brand_sub') }}</div>
        <nav class="nav">
            <div class="nav-section">{{ __('admin.nav.records') }}</div>
            @can('dashboard.view')
                <a href="{{ route('admin.dashboard') }}" class="{{ request()->routeIs('admin.dashboard') ? 'active' : '' }}">{{ __('admin.nav.dashboard') }}</a>
            @endcan
            @can('monitoring.kpi.view')
                <a href="{{ route('admin.monitoring') }}" class="{{ request()->routeIs('admin.monitoring*') ? 'active' : '' }}">{{ __('admin.nav.monitoring') }}</a>
            @endcan
            @can('records.users.view')
                <a href="{{ route('admin.users') }}" class="{{ request()->routeIs('admin.users*') ? 'active' : '' }}">{{ __('admin.nav.app_users') }}</a>
            @endcan
            @can('records.profiles.view')
                <a href="{{ route('admin.profiles') }}" class="{{ request()->routeIs('admin.profiles') || request()->routeIs('admin.profiles.show') ? 'active' : '' }}">{{ __('admin.nav.profiles') }}</a>
            @endcan
            @can('records.medical.view')
                <a href="{{ route('admin.vitals') }}" class="{{ request()->routeIs('admin.vitals') ? 'active' : '' }}">{{ __('admin.nav.vitals') }}</a>
            @endcan
            @can('records.devices.view')
                <a href="{{ route('admin.devices') }}" class="{{ request()->routeIs('admin.devices*') ? 'active' : '' }}">{{ __('admin.nav.devices') }}</a>
            @endcan
            @can('records.medical.view')
                <a href="{{ route('admin.medical') }}" class="{{ request()->routeIs('admin.medical*') ? 'active' : '' }}">{{ __('admin.nav.medical') }}</a>
            @endcan
            @can('records.events.view')
                <a href="{{ route('admin.events') }}" class="{{ request()->routeIs('admin.events*') ? 'active' : '' }}">{{ __('admin.nav.events') }}</a>
            @endcan
            @can('records.yuwell.view')
                <a href="{{ route('admin.yuwell') }}" class="{{ request()->routeIs('admin.yuwell') ? 'active' : '' }}">{{ __('admin.nav.yuwell') }}</a>
            @endcan
            @can('records.tables.view')
                <a href="{{ route('admin.tables') }}" class="{{ request()->routeIs('admin.tables') ? 'active' : '' }}">{{ __('admin.nav.tables') }}</a>
            @endcan

            @if($authUser?->can('admin.users.view') || $authUser?->can('admin.roles.view'))
                <div class="nav-section">{{ __('admin.nav.admin') }}</div>
            @endif
            @can('admin.users.view')
                <a href="{{ route('admin.management.users') }}" class="{{ request()->routeIs('admin.management.users*') ? 'active' : '' }}">{{ __('admin.nav.user_mgmt') }}</a>
            @endcan
            @can('admin.roles.view')
                <a href="{{ route('admin.management.roles') }}" class="{{ request()->routeIs('admin.management.roles*') ? 'active' : '' }}">{{ __('admin.nav.roles') }}</a>
            @endcan
        </nav>

        @if($authUser)
            <div class="user-box">
                <div class="name">{{ $authUser->user_label }}</div>
                <div class="email">{{ $authUser->email }}</div>
                <div style="margin-top:6px;">
                    @foreach($authUser->memberships as $membership)
                        <span class="badge" style="background:rgba(255,255,255,0.18);color:#fff;">{{ $membership->app_role }}</span>
                    @endforeach
                </div>
                <form method="post" action="{{ route('admin.logout') }}">
                    @csrf
                    <button type="submit">{{ __('admin.sign_out') }}</button>
                </form>
            </div>
        @endif
    </aside>
    <main class="main">
        <div class="top">
            <div>
                <h1>@yield('title', 'Records')</h1>
                @hasSection('subtitle')
                    <div class="muted">@yield('subtitle')</div>
                @endif
            </div>
            <div class="lang-switch">
                @foreach(['en' => 'EN', 'th' => 'TH'] as $code => $label)
                    <form method="post" action="{{ route('admin.locale') }}">
                        @csrf
                        <input type="hidden" name="locale" value="{{ $code }}">
                        <button type="submit" class="{{ app()->getLocale() === $code ? 'active' : '' }}">{{ $label }}</button>
                    </form>
                @endforeach
            </div>
        </div>

        @if(session('success'))
            <div class="flash ok">{{ session('success') }}</div>
        @endif
        @if($errors->any())
            <div class="flash err">
                @foreach($errors->all() as $error)
                    <div>{{ $error }}</div>
                @endforeach
            </div>
        @endif

        @yield('content')
    </main>
</div>
</body>
</html>
