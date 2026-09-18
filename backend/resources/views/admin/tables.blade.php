@extends('admin.layout')

@section('title', 'All tables')
@section('subtitle', 'Row counts in '.$database)

@section('content')
<div class="card">
    <table>
        <thead>
        <tr>
            <th>Table</th>
            <th>Rows</th>
        </tr>
        </thead>
        <tbody>
        @foreach($counts as $table => $count)
            <tr>
                <td class="mono">{{ $table }}</td>
                <td>{{ is_null($count) ? '—' : number_format($count) }}</td>
            </tr>
        @endforeach
        </tbody>
    </table>
</div>
@endsection
