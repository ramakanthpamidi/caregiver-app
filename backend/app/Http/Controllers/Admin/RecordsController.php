<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Admin\Concerns\AuthorizesAdminPermissions;
use App\Http\Controllers\Controller;
use App\Models\Device;
use App\Models\LineNotifyTarget;
use App\Models\MedicalDataRaw;
use App\Models\MedicalEvent;
use App\Models\MedicalGeneralInfo;
use App\Models\Profile;
use App\Models\ProfileGoal;
use App\Models\ProfileReminder;
use App\Models\User;
use App\Models\YuwellModel;
use App\Services\ProfileVitalsService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class RecordsController extends Controller
{
    use AuthorizesAdminPermissions;

    public function dashboard()
    {
        $this->authorizePermission('dashboard.view');

        $stats = [
            'users' => User::active()->count(),
            'profiles' => Profile::alive()->count(),
            'devices' => Device::alive()->count(),
            'medical_raw' => MedicalDataRaw::count(),
            'medical_events' => MedicalEvent::count(),
            'reminders' => ProfileReminder::count(),
            'goals' => ProfileGoal::count(),
            'line_targets' => LineNotifyTarget::count(),
        ];

        $recentUsers = User::active()->orderByDesc('id')->limit(8)->get();
        $recentProfiles = Profile::alive()->orderByDesc('id')->limit(8)->get();
        $recentReadings = MedicalDataRaw::with('device')->orderByDesc('id')->limit(10)->get();
        $recentEvents = MedicalEvent::with('device')->orderByDesc('id')->limit(10)->get();

        return view('admin.dashboard', compact('stats', 'recentUsers', 'recentProfiles', 'recentReadings', 'recentEvents'));
    }

    public function users(Request $request)
    {
        $this->authorizePermission('records.users.view');

        $q = trim((string) $request->query('q', ''));
        $appIds = \App\Support\CoreGridAccess::caregiverAppIds();
        $users = User::query()
            ->forCaregiverApps()
            ->with([
                'credentials' => fn ($c) => $c->whereIn('app_id', $appIds),
                'memberships' => fn ($m) => $m->whereIn('app_id', $appIds)->with('application'),
            ])
            ->when($q !== '', function ($query) use ($q) {
                $query->where(function ($inner) use ($q) {
                    $inner->where('account_label', 'ilike', "%{$q}%")
                        ->orWhere('id', $q)
                        ->orWhereHas('credentials', fn ($c) => $c->where('login_name', 'ilike', "%{$q}%"));
                });
            })
            ->orderByDesc('id')
            ->paginate(25)
            ->withQueryString();

        return view('admin.users', compact('users', 'q'));
    }

    public function userShow(int $id)
    {
        $this->authorizePermission('records.users.view');

        $user = User::findOrFail($id);
        $profiles = Profile::where('created_by_account_id', $user->id)->orderByDesc('id')->get();
        $devices = Device::where('created_by', $user->id)->orderByDesc('id')->get();
        $oauth = $user->credentials()->get();

        return view('admin.user-show', compact('user', 'profiles', 'devices', 'oauth'));
    }

    public function profiles(Request $request)
    {
        $this->authorizePermission('records.profiles.view');

        $q = trim((string) $request->query('q', ''));
        $profiles = Profile::query()
            ->when($q !== '', function ($query) use ($q) {
                $query->where(function ($inner) use ($q) {
                    $inner->where('profile_label', 'like', "%{$q}%")
                        ->orWhere('id', $q)
                        ->orWhere('created_by_account_id', $q);
                });
            })
            ->orderByDesc('id')
            ->paginate(25)
            ->withQueryString();

        return view('admin.profiles', compact('profiles', 'q'));
    }

    public function vitals(Request $request, ProfileVitalsService $vitals)
    {
        $this->authorizePermission('records.medical.view');

        $q = trim((string) $request->query('q', ''));
        $status = strtolower(trim((string) $request->query('status', 'all')));
        $table = $vitals->table($request);

        return view('admin.vitals', [
            'q' => $q,
            'status' => $status,
            'rows' => $table['rows'],
            'counts' => $table['counts'],
        ]);
    }

    public function profileShow(int $id)
    {
        $this->authorizePermission('records.profiles.view');

        $profile = Profile::findOrFail($id);
        $owner = User::find($profile->created_by_account_id);
        $medical = MedicalGeneralInfo::where('profile_id', $profile->id)->first();
        $consent = DB::table('profile_consents')->where('profile_id', $profile->id)->first();
        $reminders = ProfileReminder::where('profile_id', $profile->id)->orderByDesc('id')->get();
        $goals = ProfileGoal::where('profile_id', $profile->id)->orderByDesc('id')->get();
        $readings = MedicalDataRaw::with('device')->where('profile_id', $profile->id)->orderByDesc('observed_at')->limit(50)->get();
        $events = MedicalEvent::with('device')->where('profile_id', $profile->id)->orderByDesc('occurred_at')->limit(50)->get();
        $lineTargets = LineNotifyTarget::query()->where('channel_type', 'LINE')->limit(0)->get();

        return view('admin.profile-show', compact(
            'profile', 'owner', 'medical', 'consent', 'reminders', 'goals', 'readings', 'events', 'lineTargets'
        ));
    }

    public function devices(Request $request)
    {
        $this->authorizePermission('records.devices.view');

        $q = trim((string) $request->query('q', ''));
        $devices = Device::query()
            ->when($q !== '', function ($query) use ($q) {
                $query->where(function ($inner) use ($q) {
                    $inner->where('external_device_id', 'ilike', "%{$q}%")
                        ->orWhere('display_name', 'ilike', "%{$q}%")
                        ->orWhere('id', $q);
                });
            })
            ->orderByDesc('id')
            ->paginate(25)
            ->withQueryString();

        return view('admin.devices', compact('devices', 'q'));
    }

    public function medicalData(Request $request)
    {
        $this->authorizePermission('records.medical.view');

        $profileId = $request->query('profile_id');
        $q = trim((string) $request->query('q', ''));

        $rows = MedicalDataRaw::with('device')
            ->when($profileId, fn ($query) => $query->where('profile_id', $profileId))
            ->when($q !== '', function ($query) use ($q) {
                $query->where(function ($inner) use ($q) {
                    $inner->where('id', $q)
                        ->orWhere('profile_id', $q)
                        ->orWhere('device_id', $q);
                });
            })
            ->orderByDesc('observed_at')
            ->paginate(40)
            ->withQueryString();

        return view('admin.medical-data', compact('rows', 'q', 'profileId'));
    }

    public function medicalDataShow(int $id)
    {
        $this->authorizePermission('records.medical.view');

        $row = MedicalDataRaw::with('device')->findOrFail($id);
        $profile = Profile::find($row->profile_id);

        return view('admin.medical-data-show', compact('row', 'profile'));
    }

    public function events(Request $request)
    {
        $this->authorizePermission('records.events.view');

        $profileId = $request->query('profile_id');
        $q = trim((string) $request->query('q', ''));

        $events = MedicalEvent::with('device')
            ->when($profileId, fn ($query) => $query->where('profile_id', $profileId))
            ->when($q !== '', function ($query) use ($q) {
                $query->where(function ($inner) use ($q) {
                    $inner->where('event_type', 'ilike', "%{$q}%")
                        ->orWhere('id', $q)
                        ->orWhere('profile_id', $q)
                        ->orWhere('device_id', $q);
                });
            })
            ->orderByDesc('occurred_at')
            ->paginate(40)
            ->withQueryString();

        return view('admin.events', compact('events', 'q', 'profileId'));
    }

    public function eventShow(int $id)
    {
        $this->authorizePermission('records.events.view');

        $event = MedicalEvent::with('device')->findOrFail($id);
        $profile = Profile::find($event->profile_id);

        return view('admin.event-show', compact('event', 'profile'));
    }

    public function yuwellModels()
    {
        $this->authorizePermission('records.yuwell.view');

        $models = YuwellModel::orderBy('factory_name')->get();

        return view('admin.yuwell-models', compact('models'));
    }

    public function tables()
    {
        $this->authorizePermission('records.tables.view');

        $tables = DB::select("select tablename as name from pg_tables where schemaname = 'public' order by tablename");
        $counts = [];

        foreach ($tables as $table) {
            $name = $table->name;
            try {
                $counts[$name] = DB::table($name)->count();
            } catch (\Throwable $e) {
                $counts[$name] = null;
            }
        }

        return view('admin.tables', [
            'database' => DB::getDatabaseName(),
            'counts' => $counts,
        ]);
    }
}
