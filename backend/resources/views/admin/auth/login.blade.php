<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>{{ __('admin.auth.title') }}</title>
    <style>
        :root {
            --bg: #eef5fa;
            --card: #fff;
            --text: #0f172a;
            --muted: #64748b;
            --border: #e2e8f0;
            --primary: #0b6aa0;
            --danger: #b91c1c;
        }
        * { box-sizing: border-box; }
        body {
            margin: 0;
            min-height: 100vh;
            display: grid;
            place-items: center;
            font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif;
            background:
                radial-gradient(1200px 600px at 10% -10%, #b9e0f7 0%, transparent 55%),
                radial-gradient(900px 500px at 100% 0%, #d7ecf8 0%, transparent 50%),
                var(--bg);
            color: var(--text);
        }
        .card {
            width: min(420px, 92vw);
            background: var(--card);
            border: 1px solid var(--border);
            border-radius: 18px;
            padding: 28px 26px;
            box-shadow: 0 18px 40px rgba(15, 23, 42, 0.08);
        }
        .brand { font-weight: 800; font-size: 1.25rem; color: #064b75; }
        .sub { color: var(--muted); margin: 6px 0 22px; font-size: 0.92rem; }
        label { display: block; font-size: 0.85rem; font-weight: 600; margin-bottom: 6px; }
        input[type="email"], input[type="password"] {
            width: 100%;
            border: 1px solid var(--border);
            border-radius: 10px;
            padding: 11px 12px;
            font: inherit;
            margin-bottom: 14px;
        }
        .row {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 10px;
            margin-bottom: 16px;
            font-size: 0.9rem;
        }
        button {
            width: 100%;
            border: 0;
            background: var(--primary);
            color: #fff;
            border-radius: 10px;
            padding: 12px 14px;
            font: inherit;
            font-weight: 700;
            cursor: pointer;
        }
        button:hover { filter: brightness(1.05); }
        .error {
            background: #fef2f2;
            color: var(--danger);
            border: 1px solid #fecaca;
            border-radius: 10px;
            padding: 10px 12px;
            margin-bottom: 14px;
            font-size: 0.9rem;
        }
        .hint {
            margin-top: 16px;
            color: var(--muted);
            font-size: 0.8rem;
            line-height: 1.4;
        }
        code { background: #f1f5f9; padding: 1px 6px; border-radius: 6px; }
        .lang-switch { display: flex; gap: 6px; justify-content: flex-end; margin-bottom: 12px; }
        .lang-switch button {
            border: 1px solid var(--border);
            background: #fff;
            border-radius: 8px;
            padding: 5px 10px;
            font: inherit;
            font-size: 0.8rem;
            font-weight: 700;
            cursor: pointer;
        }
        .lang-switch button.active { background: var(--primary); color: #fff; border-color: var(--primary); }
    </style>
</head>
<body>
<div class="card">
    <div class="lang-switch">
        @foreach(['en' => 'EN', 'th' => 'TH'] as $code => $label)
            <form method="post" action="{{ route('admin.locale') }}">
                @csrf
                <input type="hidden" name="locale" value="{{ $code }}">
                <button type="submit" class="{{ app()->getLocale() === $code ? 'active' : '' }}">{{ $label }}</button>
            </form>
        @endforeach
    </div>
    <div class="brand">{{ __('admin.auth.brand') }}</div>
    <div class="sub">{{ __('admin.auth.sub') }}</div>

    @if ($errors->any())
        <div class="error">
            @foreach ($errors->all() as $error)
                <div>{{ $error }}</div>
            @endforeach
        </div>
    @endif

    <form method="post" action="{{ route('admin.login.submit') }}">
        @csrf
        <label for="email">{{ __('admin.auth.email') }}</label>
        <input id="email" type="email" name="email" value="{{ old('email') }}" required autofocus autocomplete="username">

        <label for="password">{{ __('admin.auth.password') }}</label>
        <input id="password" type="password" name="password" required autocomplete="current-password">

        <div class="row">
            <label style="margin:0;font-weight:500;">
                <input type="checkbox" name="remember" value="1" @checked(old('remember'))>
                {{ __('admin.auth.remember') }}
            </label>
        </div>

        <button type="submit">{{ __('admin.auth.sign_in') }}</button>
    </form>

    <div class="hint">
        {{ __('admin.auth.hint') }}<br>
        <code>debug@debug.com</code> / <code>BPS@1234</code>
    </div>
</div>
</body>
</html>
