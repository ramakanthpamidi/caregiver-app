<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\MedicalDataArchive;
use App\Models\MedicalDataDaily;
use App\Models\MedicalDataRaw;
use App\Models\MedicalEvent;
use App\Models\MedicalEventArchive;
use App\Models\MedicalGeneralInfo;
use App\Models\Profile;
use App\Models\ProfileConsent;
use App\Models\ProfileGoal;
use App\Models\ProfileReminder;
use App\Support\ProfileAccess;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ProfileController extends Controller
{
    public function me(Request $request)
    {
        $profiles = Profile::query()
            ->alive()
            ->where('created_by_account_id', $request->user()->id)
            ->orderByDesc('last_used_at')
            ->orderByDesc('id')
            ->get()
            ->map(fn (Profile $p) => $p->toSummary());

        return response()->json(['profiles' => $profiles]);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'profile_label' => 'required|string|max:120',
            'access_password' => 'nullable|string|min:4|max:100',
        ]);

        $profile = new Profile([
            'profile_label' => trim($data['profile_label']),
            'created_by_account_id' => $request->user()->id,
            'profile_type' => 'Patient',
            'status' => 'Active',
            'created_at' => now(),
        ]);
        $profile->setAccessPassword($data['access_password'] ?? null);
        $profile->save();

        return response()->json(['profile' => $profile->toSummary()], 201);
    }

    public function storeWithMedical(Request $request)
    {
        $data = $request->validate([
            'profile_label' => 'required|string|max:120',
            'access_password' => 'nullable|string|min:4|max:100',
            'medical_general_info' => 'nullable|array',
            'profile_consents' => 'nullable|array',
            'profile_consents.consent_granted' => 'nullable|boolean',
            'profile_consents.source' => 'nullable|string|max:64',
        ]);

        return DB::transaction(function () use ($request, $data) {
            $profile = new Profile([
                'profile_label' => trim($data['profile_label']),
                'owner_user_id' => $request->user()->id,
            ]);
            $profile->setAccessPassword($data['access_password'] ?? null);
            $profile->save();

            $medical = null;
            if (!empty($data['medical_general_info']) && is_array($data['medical_general_info'])) {
                $medical = $this->upsertMedicalRow($profile->id, $data['medical_general_info']);
            }

            $consents = null;
            if (!empty($data['profile_consents']) && is_array($data['profile_consents'])) {
                $consents = $this->upsertConsentRow($profile->id, $data['profile_consents']);
            }

            return response()->json([
                'profile' => $profile->toSummary(),
                'medical' => $medical?->toPayload(),
                'consents' => $consents?->toPayload(),
            ], 201);
        });
    }

    public function update(Request $request, int $id)
    {
        $profile = ProfileAccess::ownedOrFail($request->user(), $id);

        $data = $request->validate([
            'profile_label' => 'sometimes|string|max:120',
            'access_password' => 'nullable|string|min:4|max:100',
        ]);

        if (array_key_exists('profile_label', $data)) {
            $profile->profile_label = trim($data['profile_label']);
        }
        if (array_key_exists('access_password', $data)) {
            $profile->setAccessPassword($data['access_password'] ?: null);
        }
        $profile->save();

        return response()->json(['profile' => $profile->toSummary()]);
    }

    public function destroy(Request $request, int $id)
    {
        $profile = ProfileAccess::ownedOrFail($request->user(), $id);
        $profile->forceFill(['status' => 'Deleted'])->save();

        return response()->json(['ok' => true]);
    }

    public function verifyPassword(Request $request, int $id)
    {
        $profile = ProfileAccess::ownedOrFail($request->user(), $id);
        $data = $request->validate([
            'password' => 'required|string',
        ]);

        return response()->json([
            'valid' => $profile->verifyAccessPassword($data['password']),
        ]);
    }

    public function markUsed(Request $request, int $id)
    {
        $profile = ProfileAccess::ownedOrFail($request->user(), $id);
        $profile->forceFill(['last_used_at' => now()])->save();

        return response()->json([
            'ok' => true,
            'profile' => $profile->toSummary(),
        ]);
    }

    public function getConsents(Request $request, int $id)
    {
        $profile = ProfileAccess::ownedOrFail($request->user(), $id);
        $consents = ProfileConsent::where('profile_id', $profile->id)->first();

        return response()->json([
            'consents' => $consents?->toPayload(),
        ]);
    }

    public function putConsents(Request $request, int $id)
    {
        $profile = ProfileAccess::ownedOrFail($request->user(), $id);
        $data = $request->validate([
            'consent_granted' => 'required|boolean',
            'source' => 'nullable|string|max:64',
        ]);

        $consents = $this->upsertConsentRow($profile->id, $data);

        return response()->json(['consents' => $consents->toPayload()]);
    }

    public function getMedicalGeneral(Request $request, int $id)
    {
        $profile = ProfileAccess::ownedOrFail($request->user(), $id);
        $medical = MedicalGeneralInfo::where('profile_id', $profile->id)->first();

        return response()->json(['medical' => $medical?->toPayload()]);
    }

    public function putMedicalGeneral(Request $request, int $id)
    {
        $profile = ProfileAccess::ownedOrFail($request->user(), $id);
        $data = $request->validate([
            'date_of_birth' => 'nullable|date',
            'sex' => 'nullable|string|max:32',
            'organ_donor' => 'nullable|boolean',
            'blood_type' => 'nullable|string|max:16',
            'height_cm' => 'nullable|numeric',
            'weight_kg' => 'nullable|numeric',
            'allergies' => 'nullable',
            'chronic_conditions' => 'nullable',
            'medications' => 'nullable',
            'family_history' => 'nullable',
            'emergency_contact' => 'nullable|string|max:255',
            'insurance_provider' => 'nullable|string|max:255',
            'insurance_number' => 'nullable|string|max:128',
        ]);

        $medical = $this->upsertMedicalRow($profile->id, $data);

        return response()->json(['medical' => $medical->toPayload()]);
    }

    public function healthReportData(Request $request, int $id)
    {
        $profile = ProfileAccess::ownedOrFail($request->user(), $id);

        return response()->json([
            'profile' => [
                'id' => (int) $profile->id,
                'profile_label' => $profile->profile_label,
            ],
            'generated_at' => now()->toISOString(),
            'table_sources' => [
                'medical_general_info' => 'medical_general_info',
                'medical_data_raw' => 'medical_data_raw',
                'medical_data_daily' => 'medical_data_daily',
                'medical_data_archeive' => 'medical_data_archeive',
                'medical_events' => 'medical_events',
                'medical_events_archive' => 'medical_events_archive',
            ],
            'tables' => [
                'medical_general_info' => MedicalGeneralInfo::where('profile_id', $profile->id)->get()->map->toPayload()->values(),
                'medical_data_raw' => MedicalDataRaw::with('device')->where('profile_id', $profile->id)->orderByDesc('observed_at')->limit(500)->get()->map->toRow()->values(),
                'medical_data_daily' => MedicalDataDaily::where('profile_id', $profile->id)->orderByDesc('day')->limit(500)->get()->values(),
                'medical_data_archeive' => MedicalDataArchive::where('profile_id', $profile->id)->orderByDesc('period_start')->limit(500)->get()->values(),
                'medical_events' => MedicalEvent::with('device')->where('profile_id', $profile->id)->orderByDesc('occurred_at')->limit(500)->get()->map->toRow()->values(),
                'medical_events_archive' => MedicalEventArchive::where('profile_id', $profile->id)->orderByDesc('occurred_at')->limit(500)->get()->values(),
            ],
        ]);
    }

    public function medicalDataSummary(Request $request, int $id)
    {
        $profile = ProfileAccess::ownedOrFail($request->user(), $id);

        return response()->json([
            'summary' => [
                'profile_id' => (int) $profile->id,
                'profile_label' => (string) $profile->profile_label,
                'general_info_count' => MedicalGeneralInfo::where('profile_id', $profile->id)->count(),
                'raw_data_count' => MedicalDataRaw::where('profile_id', $profile->id)->count(),
                'daily_data_count' => MedicalDataDaily::where('profile_id', $profile->id)->count(),
                'archive_data_count' => MedicalDataArchive::where('profile_id', $profile->id)->count(),
                'events_archive_count' => MedicalEventArchive::where('profile_id', $profile->id)->count(),
            ],
        ]);
    }

    public function deleteMedicalData(Request $request, int $id, string $category)
    {
        $profile = ProfileAccess::ownedOrFail($request->user(), $id);
        $period = $request->query('period', 'all');
        $fromTs = $request->query('from_ts');
        $toTs = $request->query('to_ts');

        $applyPeriod = function ($query, string $tsColumn = 'ts') use ($period, $fromTs, $toTs) {
            if ($period === 'last_7_days') {
                $query->where($tsColumn, '>=', now()->subDays(7));
            } elseif ($period === 'last_30_days') {
                $query->where($tsColumn, '>=', now()->subDays(30));
            } elseif ($period === 'last_90_days') {
                $query->where($tsColumn, '>=', now()->subDays(90));
            } elseif ($period === 'custom') {
                if ($fromTs !== null) {
                    $query->where($tsColumn, '>=', $this->parseTs($fromTs));
                }
                if ($toTs !== null) {
                    $query->where($tsColumn, '<=', $this->parseTs($toTs));
                }
            }

            return $query;
        };

        $map = [
            'general' => fn () => MedicalGeneralInfo::where('profile_id', $profile->id)->delete(),
            'raw' => fn () => $applyPeriod(MedicalDataRaw::where('profile_id', $profile->id), 'observed_at')->delete(),
            'daily' => fn () => $applyPeriod(MedicalDataDaily::where('profile_id', $profile->id), 'day')->delete(),
            'archive' => fn () => $applyPeriod(MedicalDataArchive::where('profile_id', $profile->id), 'period_start')->delete(),
            'events' => fn () => $applyPeriod(MedicalEvent::where('profile_id', $profile->id), 'occurred_at')->delete(),
            'events_archive' => fn () => $applyPeriod(MedicalEventArchive::where('profile_id', $profile->id), 'occurred_at')->delete(),
        ];

        if (!isset($map[$category])) {
            return response()->json(['error' => 'Unknown category'], 400);
        }

        $map[$category]();

        return response()->json(['ok' => true]);
    }

    // --- Reminders ---

    public function listReminders(Request $request, int $id)
    {
        $profile = ProfileAccess::ownedOrFail($request->user(), $id);
        $reminders = ProfileReminder::where('profile_id', $profile->id)
            ->orderBy('id')
            ->get()
            ->map->toPayload();

        return response()->json(['reminders' => $reminders]);
    }

    public function createReminder(Request $request, int $id)
    {
        $profile = ProfileAccess::ownedOrFail($request->user(), $id);
        $data = $request->validate([
            'title' => 'required|string|max:200',
            'description' => 'nullable|string',
            'enabled' => 'nullable|boolean',
            'time_of_day' => 'required|string',
            'timezone' => 'nullable|string|max:64',
            'repeat_type' => 'nullable|string|max:32',
            'repeat_rule' => 'nullable',
        ]);

        $reminder = ProfileReminder::create([
            'profile_id' => $profile->id,
            'title' => $data['title'],
            'description' => $data['description'] ?? null,
            'enabled' => $data['enabled'] ?? true,
            'time_of_day' => $data['time_of_day'],
            'timezone' => $data['timezone'] ?? null,
            'repeat_type' => $data['repeat_type'] ?? 'None',
            'repeat_rule' => $data['repeat_rule'] ?? null,
            'created_by' => $request->user()->id,
            'updated_by' => $request->user()->id,
            'created_at' => now(),
        ]);

        return response()->json(['reminder' => $reminder->toPayload()], 201);
    }

    public function updateReminder(Request $request, int $id, int $reminderId)
    {
        $profile = ProfileAccess::ownedOrFail($request->user(), $id);
        $reminder = ProfileReminder::where('profile_id', $profile->id)->where('id', $reminderId)->firstOrFail();

        $data = $request->validate([
            'title' => 'sometimes|string|max:200',
            'description' => 'nullable|string',
            'enabled' => 'nullable|boolean',
            'time_of_day' => 'sometimes|string',
            'timezone' => 'nullable|string|max:64',
            'repeat_type' => 'nullable|string|max:32',
            'repeat_rule' => 'nullable',
        ]);

        $reminder->fill($data);
        $reminder->updated_by = $request->user()->id;
        $reminder->save();

        return response()->json(['reminder' => $reminder->toPayload()]);
    }

    public function deleteReminder(Request $request, int $id, int $reminderId)
    {
        $profile = ProfileAccess::ownedOrFail($request->user(), $id);
        ProfileReminder::where('profile_id', $profile->id)->where('id', $reminderId)->delete();

        return response()->json(['ok' => true]);
    }

    // --- Goals ---

    public function listGoals(Request $request, int $id)
    {
        $profile = ProfileAccess::ownedOrFail($request->user(), $id);
        $goals = ProfileGoal::where('profile_id', $profile->id)->orderByDesc('id')->get()->map->toPayload();

        return response()->json(['goals' => $goals]);
    }

    public function createGoal(Request $request, int $id)
    {
        $profile = ProfileAccess::ownedOrFail($request->user(), $id);
        $data = $request->validate([
            'title' => 'required|string|max:200',
            'description' => 'nullable|string',
            'goal_type' => 'required|string|max:64',
            'target' => 'nullable',
            'start_date' => 'required|date',
            'end_date' => 'nullable|date',
            'status' => 'nullable|string|max:32',
        ]);

        $goal = ProfileGoal::create([
            'profile_id' => $profile->id,
            'title' => $data['title'],
            'description' => $data['description'] ?? null,
            'goal_type' => $data['goal_type'],
            'target' => $data['target'] ?? null,
            'start_date' => $data['start_date'],
            'end_date' => $data['end_date'] ?? null,
            'status' => $data['status'] ?? 'Active',
            'created_by' => $request->user()->id,
            'updated_by' => $request->user()->id,
            'created_at' => now(),
        ]);

        return response()->json(['goal' => $goal->toPayload()], 201);
    }

    public function updateGoal(Request $request, int $id, int $goalId)
    {
        $profile = ProfileAccess::ownedOrFail($request->user(), $id);
        $goal = ProfileGoal::where('profile_id', $profile->id)->where('id', $goalId)->firstOrFail();

        $data = $request->validate([
            'title' => 'sometimes|string|max:200',
            'description' => 'nullable|string',
            'goal_type' => 'sometimes|string|max:64',
            'target' => 'nullable',
            'start_date' => 'sometimes|date',
            'end_date' => 'nullable|date',
            'status' => 'nullable|string|max:32',
        ]);

        $goal->fill($data);
        $goal->updated_by = $request->user()->id;
        $goal->save();

        return response()->json(['goal' => $goal->toPayload()]);
    }

    public function updateGoalStatus(Request $request, int $id, int $goalId)
    {
        $profile = ProfileAccess::ownedOrFail($request->user(), $id);
        $goal = ProfileGoal::where('profile_id', $profile->id)->where('id', $goalId)->firstOrFail();
        $data = $request->validate([
            'status' => 'required|string|max:32',
        ]);

        $goal->status = $data['status'];
        $goal->updated_by = $request->user()->id;
        $goal->save();

        return response()->json(['goal' => $goal->toPayload()]);
    }

    public function deleteGoal(Request $request, int $id, int $goalId)
    {
        $profile = ProfileAccess::ownedOrFail($request->user(), $id);
        ProfileGoal::where('profile_id', $profile->id)->where('id', $goalId)->delete();

        return response()->json(['ok' => true]);
    }

    private function upsertMedicalRow(int $profileId, array $data): MedicalGeneralInfo
    {
        $payload = [
            'date_of_birth' => $data['date_of_birth'] ?? null,
            'sex' => $data['sex'] ?? null,
            'organ_donor' => $data['organ_donor'] ?? null,
            'blood_type' => $data['blood_type'] ?? null,
            'height_cm' => $data['height_cm'] ?? null,
            'weight_kg' => $data['weight_kg'] ?? null,
            'allergies' => $data['allergies'] ?? null,
            'chronic_conditions' => $data['chronic_conditions'] ?? null,
            'medications' => $data['medications'] ?? null,
            'family_history' => $data['family_history'] ?? null,
            'emergency_contact' => $data['emergency_contact'] ?? null,
            'insurance_provider' => $data['insurance_provider'] ?? null,
            'insurance_number' => $data['insurance_number'] ?? null,
        ];

        if (is_string($payload['emergency_contact'])) {
            $payload['emergency_contact'] = ['value' => $payload['emergency_contact']];
        }
        $payload['updated_at'] = now();

        $row = MedicalGeneralInfo::query()->firstOrNew(['profile_id' => $profileId]);
        if (!$row->exists) {
            $payload['created_at'] = now();
        }
        $row->fill($payload)->save();

        return $row;
    }

    private function upsertConsentRow(int $profileId, array $data): ProfileConsent
    {
        $granted = (bool) ($data['consent_granted'] ?? false);

        $row = ProfileConsent::query()->firstOrNew([
            'profile_id' => $profileId,
            'consent_code' => $data['consent_code'] ?? 'app_onboarding',
        ]);
        $row->consent_granted = $granted;
        $row->source = $data['source'] ?? $row->source;
        $row->updated_at = now();
        if (!$row->exists) {
            $row->created_at = now();
        }
        $row->save();

        return $row;
    }

    private function parseTs(mixed $value): \Carbon\Carbon
    {
        if (is_numeric($value)) {
            $n = (int) $value;
            // ms timestamps from client
            if ($n > 1_000_000_000_000) {
                return \Carbon\Carbon::createFromTimestampMs($n);
            }

            return \Carbon\Carbon::createFromTimestamp($n);
        }

        return \Carbon\Carbon::parse((string) $value);
    }
}
